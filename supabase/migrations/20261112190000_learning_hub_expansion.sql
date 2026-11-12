-- English Lab learning hub expansion
-- Student grouping, avatar inventory, and private live teacher/student chat.
-- Existing Shift values are preserved as the initial Group codes for current students.

alter table public.profiles
  add column if not exists educational_center text,
  add column if not exists group_code text;

alter table public.profiles drop constraint if exists profiles_shift_check;

update public.profiles
set educational_center = coalesce(
      nullif(trim(educational_center), ''),
      case when school_id ilike '%@mottach.superate.org' then 'Mottach' else 'Unassigned' end
    ),
    group_code = upper(coalesce(nullif(trim(group_code), ''), nullif(trim(shift), ''), 'A')),
    shift = upper(coalesce(nullif(trim(group_code), ''), nullif(trim(shift), ''), 'A'));

alter table public.profiles
  alter column educational_center set default 'Unassigned',
  alter column group_code set default 'A';

alter table public.profiles
  drop constraint if exists profiles_educational_center_check,
  drop constraint if exists profiles_group_code_check;

alter table public.profiles
  add constraint profiles_educational_center_check
    check (account_type <> 'student' or (educational_center is not null and length(trim(educational_center)) between 2 and 120)),
  add constraint profiles_group_code_check
    check (account_type <> 'student' or (group_code is not null and group_code = upper(group_code) and group_code ~ '^[A-Z0-9][A-Z0-9_-]{0,11}$'));

create or replace function private.guard_profile_academic_fields()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if not (select private.is_admin()) then
    if new.prom is distinct from old.prom
      or new.shift is distinct from old.shift
      or new.group_code is distinct from old.group_code
      or new.educational_center is distinct from old.educational_center
      or new.account_type is distinct from old.account_type then
      raise exception 'Only an administrator can change a student Educational Center, Prom, group, or account type.';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_profile_academic_fields on public.profiles;
create trigger guard_profile_academic_fields
before update on public.profiles
for each row execute function private.guard_profile_academic_fields();

create or replace function public.sync_profile_group_code()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.account_type <> 'student' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.group_code := upper(coalesce(nullif(trim(new.group_code), ''), nullif(trim(new.shift), ''), 'A'));
    new.shift := new.group_code;
  elsif new.group_code is distinct from old.group_code then
    new.group_code := upper(trim(new.group_code));
    new.shift := new.group_code;
  elsif new.shift is distinct from old.shift then
    new.group_code := upper(trim(new.shift));
    new.shift := new.group_code;
  end if;
  return new;
end;
$function$;

drop trigger if exists sync_profile_group_code on public.profiles;
create trigger sync_profile_group_code
before insert or update of shift, group_code on public.profiles
for each row execute function public.sync_profile_group_code();

create or replace function public.handle_new_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested_type text;
  assigned_type text;
  school_identifier text;
  center_name text;
  group_name text;
  admin_email constant text := 'julian.remy.prof@gmail.com';
begin
  requested_type := lower(coalesce(new.raw_user_meta_data->>'account_type', 'student'));
  school_identifier := lower(trim(new.email));

  if lower(new.email) = admin_email then
    assigned_type := 'admin';
  elsif requested_type = 'teacher' then
    assigned_type := 'teacher';
  else
    assigned_type := 'student';
  end if;

  if school_identifier is null or length(school_identifier) < 2 then
    raise exception 'A valid email is required to create an account.';
  end if;

  center_name := coalesce(nullif(trim(new.raw_user_meta_data->>'educational_center'), ''), 'Unassigned');
  group_name := upper(coalesce(
    nullif(trim(new.raw_user_meta_data->>'group_code'), ''),
    nullif(trim(new.raw_user_meta_data->>'shift'), ''),
    'A'
  ));

  insert into public.profiles
    (id, email, username, full_name, account_type, school_id, prom, shift, educational_center, group_code)
  values
    (new.id, lower(new.email), null,
     coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'User'),
     assigned_type, school_identifier,
     case when assigned_type = 'student'
       then coalesce(nullif(new.raw_user_meta_data->>'prom', '')::smallint, 2026)
       else null end,
     case when assigned_type = 'student' then group_name else null end,
     case when assigned_type = 'student' then center_name else null end,
     case when assigned_type = 'student' then group_name else null end);

  if assigned_type in ('teacher', 'admin') then
    insert into public.teacher_access(user_id, note, status, is_admin)
    values (
      new.id,
      case when assigned_type = 'admin' then 'Bootstrap administrator' else 'Teacher registration awaiting admin approval' end,
      case when assigned_type = 'admin' then 'approved' else 'pending' end,
      assigned_type = 'admin'
    );
  end if;

  return new;
end;
$function$;

-- Avatar catalogue and student-owned balances / equipment.
create table if not exists public.avatar_items (
  id text primary key,
  name text not null,
  category text not null check (category in ('avatar', 'background', 'clothing', 'accessory', 'power')),
  price integer not null check (price >= 0),
  rarity text not null default 'common' check (rarity in ('common', 'rare', 'epic', 'legendary')),
  description text not null default '',
  icon text not null default '✦',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.avatar_wallets (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 500 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.avatar_inventory (
  student_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.avatar_items(id) on delete restrict,
  purchased_at timestamptz not null default now(),
  primary key (student_id, item_id)
);

create table if not exists public.avatar_equipment (
  student_id uuid not null references public.profiles(id) on delete cascade,
  slot text not null check (slot in ('avatar', 'background', 'clothing', 'accessory', 'power')),
  item_id text not null references public.avatar_items(id) on delete restrict,
  equipped_at timestamptz not null default now(),
  primary key (student_id, slot)
);

create or replace function private.create_avatar_wallet_for_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.account_type = 'student' then
    insert into public.avatar_wallets(student_id, balance)
    values (new.id, 500)
    on conflict (student_id) do nothing;
  end if;
  return new;
end;
$function$;

drop trigger if exists create_avatar_wallet_after_profile on public.profiles;
create trigger create_avatar_wallet_after_profile
after insert on public.profiles
for each row execute function private.create_avatar_wallet_for_student();

insert into public.avatar_wallets(student_id, balance)
select p.id, 500 from public.profiles p where p.account_type = 'student'
on conflict (student_id) do nothing;

insert into public.avatar_items(id, name, category, price, rarity, description, icon) values
('avatar-explorer', 'Campus Explorer', 'avatar', 180, 'common', 'A curious learner ready for every challenge.', '🧑‍🎓'),
('avatar-scholar', 'The Scholar', 'avatar', 320, 'rare', 'A focused academic look for a serious streak.', '🧑‍🏫'),
('avatar-astronaut', 'Orbit Explorer', 'avatar', 650, 'epic', 'Take your learning journey beyond the ordinary.', '🧑‍🚀'),
('bg-library', 'Quiet Library', 'background', 120, 'common', 'A calm study-space backdrop.', '📚'),
('bg-night-sky', 'Midnight Study', 'background', 250, 'rare', 'A deep blue night-sky background.', '🌌'),
('bg-campus', 'Campus Green', 'background', 180, 'common', 'A fresh campus-inspired scene.', '🏫'),
('clothes-varsity', 'Varsity Jacket', 'clothing', 160, 'common', 'A classic academic jacket.', '🧥'),
('clothes-formal', 'Presentation Outfit', 'clothing', 240, 'rare', 'A polished look for big presentations.', '👔'),
('clothes-hoodie', 'Focus Hoodie', 'clothing', 140, 'common', 'Comfortable style for long study sessions.', '🧢'),
('acc-headphones', 'Focus Headphones', 'accessory', 110, 'common', 'A small reminder to stay in the zone.', '🎧'),
('acc-star', 'Achievement Pin', 'accessory', 190, 'rare', 'A collectible pin for your profile.', '⭐'),
('acc-glasses', 'Scholar Glasses', 'accessory', 150, 'common', 'A thoughtful finishing touch.', '👓'),
('power-hint', 'Hint Spark', 'power', 220, 'rare', 'A collectible profile effect. Cosmetic only.', '✨'),
('power-streak', 'Streak Aura', 'power', 300, 'epic', 'A glowing streak effect for your profile. Cosmetic only.', '⚡'),
('power-orbit', 'Orbit Trail', 'power', 420, 'epic', 'A subtle orbit effect around your avatar. Cosmetic only.', '🪐')
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  price = excluded.price,
  rarity = excluded.rarity,
  description = excluded.description,
  icon = excluded.icon,
  active = true;

alter table public.avatar_items enable row level security;
alter table public.avatar_wallets enable row level security;
alter table public.avatar_inventory enable row level security;
alter table public.avatar_equipment enable row level security;

drop policy if exists "Students read active avatar items" on public.avatar_items;
create policy "Students read active avatar items" on public.avatar_items
for select to authenticated using (active = true);

drop policy if exists "Users read own avatar wallet" on public.avatar_wallets;
create policy "Users read own avatar wallet" on public.avatar_wallets
for select to authenticated using (student_id = (select auth.uid()));

drop policy if exists "Users read own avatar inventory" on public.avatar_inventory;
create policy "Users read own avatar inventory" on public.avatar_inventory
for select to authenticated using (student_id = (select auth.uid()));

drop policy if exists "Users read own avatar equipment" on public.avatar_equipment;
create policy "Users read own avatar equipment" on public.avatar_equipment
for select to authenticated using (student_id = (select auth.uid()));

grant select on public.avatar_items, public.avatar_wallets, public.avatar_inventory, public.avatar_equipment to authenticated;

create or replace function private.purchase_avatar_item(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  uid uuid := auth.uid();
  item public.avatar_items%rowtype;
  wallet public.avatar_wallets%rowtype;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in to purchase items.');
  end if;
  select * into item from public.avatar_items where id = p_item_id and active = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'This item is no longer available.');
  end if;
  if exists(select 1 from public.avatar_inventory where student_id = uid and item_id = p_item_id) then
    return jsonb_build_object('ok', true, 'owned', true, 'balance',
      (select balance from public.avatar_wallets where student_id = uid));
  end if;
  select * into wallet from public.avatar_wallets where student_id = uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Your avatar wallet is not ready yet.');
  end if;
  if wallet.balance < item.price then
    return jsonb_build_object('ok', false, 'error', 'You need more coins to purchase this item.');
  end if;
  update public.avatar_wallets
    set balance = balance - item.price, updated_at = now()
    where student_id = uid returning * into wallet;
  insert into public.avatar_inventory(student_id, item_id) values (uid, p_item_id);
  return jsonb_build_object('ok', true, 'owned', false, 'balance', wallet.balance);
end;
$function$;

create or replace function private.equip_avatar_item(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  uid uuid := auth.uid();
  item public.avatar_items%rowtype;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in to equip items.');
  end if;
  select i.* into item
  from public.avatar_items i
  join public.avatar_inventory v on v.item_id = i.id and v.student_id = uid
  where i.id = p_item_id and i.active = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Purchase this item before equipping it.');
  end if;
  insert into public.avatar_equipment(student_id, slot, item_id)
  values (uid, item.category, item.id)
  on conflict (student_id, slot) do update
    set item_id = excluded.item_id, equipped_at = now();
  return jsonb_build_object('ok', true, 'slot', item.category);
end;
$function$;

create or replace function public.purchase_avatar_item(p_item_id text)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.purchase_avatar_item(p_item_id);
$function$;

create or replace function public.equip_avatar_item(p_item_id text)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.equip_avatar_item(p_item_id);
$function$;

grant usage on schema private to authenticated;
grant execute on function private.purchase_avatar_item(text) to authenticated;
grant execute on function private.equip_avatar_item(text) to authenticated;
grant execute on function public.purchase_avatar_item(text) to authenticated;
grant execute on function public.equip_avatar_item(text) to authenticated;

-- Private one-to-one teacher/student conversations.
create table if not exists public.teacher_conversations (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_id, student_id),
  check (teacher_id <> student_id)
);

create table if not exists public.teacher_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.teacher_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists teacher_messages_conversation_created_idx
  on public.teacher_messages(conversation_id, created_at);

alter table public.teacher_conversations enable row level security;
alter table public.teacher_messages enable row level security;

drop policy if exists "Chat participants read conversations" on public.teacher_conversations;
create policy "Chat participants read conversations" on public.teacher_conversations
for select to authenticated
using (
  student_id = (select auth.uid())
  or (teacher_id = (select auth.uid()) and (select private.teacher_can_access_student(student_id)))
);

drop policy if exists "Authorized teachers create student conversations" on public.teacher_conversations;
create policy "Authorized teachers create student conversations" on public.teacher_conversations
for insert to authenticated
with check (
  teacher_id = (select auth.uid())
  and (select private.teacher_can_access_student(student_id))
);

drop policy if exists "Chat participants read messages" on public.teacher_messages;
create policy "Chat participants read messages" on public.teacher_messages
for select to authenticated
using (
  exists (
    select 1 from public.teacher_conversations c
    where c.id = conversation_id
      and (
        c.student_id = (select auth.uid())
        or (c.teacher_id = (select auth.uid()) and (select private.teacher_can_access_student(c.student_id)))
      )
  )
);

drop policy if exists "Chat participants send messages" on public.teacher_messages;
create policy "Chat participants send messages" on public.teacher_messages
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.teacher_conversations c
    where c.id = conversation_id
      and (
        c.student_id = (select auth.uid())
        or (c.teacher_id = (select auth.uid()) and (select private.teacher_can_access_student(c.student_id)))
      )
  )
);

grant select, insert on public.teacher_conversations, public.teacher_messages to authenticated;

drop policy if exists "Students can read their chat teachers" on public.profiles;
create policy "Students can read their chat teachers" on public.profiles
for select to authenticated
using (
  exists (
    select 1 from public.teacher_conversations c
    where c.student_id = (select auth.uid()) and c.teacher_id = profiles.id
  )
);

do $publication$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'teacher_messages'
     ) then
    alter publication supabase_realtime add table public.teacher_messages;
  end if;
end;
$publication$;

-- Keep group-targeted practice assignments explicit in the expanded hierarchy.
alter table public.practice_assignments
  add column if not exists target_educational_center text,
  add column if not exists target_group text;

update public.practice_assignments
set target_group = coalesce(target_group, target_shift),
    target_educational_center = coalesce(target_educational_center, 'Unassigned')
where target_type = 'group';

-- Update existing Part 5 drill activity metadata and register Drill 4.
update public.activities
set question_count = 30,
    title = 'TOEIC Part 5 · Drill ' || right(id, 1),
    path = 'practices/toeic-part5-drills.html?drill=' || right(id, 1),
    active = true
where id in ('toeic-part5-drill-1', 'toeic-part5-drill-2', 'toeic-part5-drill-3');

insert into public.activities(id, title, category, question_count, path, active)
values ('toeic-part5-drill-4', 'TOEIC Part 5 · Drill 4', 'TOEIC', 30,
        'practices/toeic-part5-drills.html?drill=4', true)
on conflict (id) do update set
  title = excluded.title,
  category = excluded.category,
  question_count = excluded.question_count,
  path = excluded.path,
  active = true;


-- Reward completed practices with coins, without duplicate payouts on retried saves.
create table if not exists public.avatar_coin_ledger (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  source_type text not null,
  source_id uuid not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  unique (source_type, source_id)
);

create index if not exists avatar_coin_ledger_student_created_idx
  on public.avatar_coin_ledger(student_id, created_at desc);

alter table public.avatar_coin_ledger enable row level security;

drop policy if exists "Users read own avatar coin ledger" on public.avatar_coin_ledger;
create policy "Users read own avatar coin ledger" on public.avatar_coin_ledger
for select to authenticated using (student_id = (select auth.uid()));

grant select on public.avatar_coin_ledger to authenticated;

create or replace function private.reward_avatar_coins_for_completed_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  reward integer;
  inserted_id uuid;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;
  if new.student_id is null or new.total_questions is null or new.total_questions < 1 then
    return new;
  end if;

  reward := 10;
  if new.score is not null and (new.score::numeric / new.total_questions::numeric) >= 0.80 then
    reward := reward + 5;
  end if;

  insert into public.avatar_coin_ledger(student_id, amount, source_type, source_id, description)
  values (
    new.student_id,
    reward,
    'practice_completion',
    new.id,
    case when reward = 15 then 'Practice completed with at least 80% accuracy'
         else 'Practice completed' end
  )
  on conflict (source_type, source_id) do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    insert into public.avatar_wallets(student_id, balance)
    values (new.student_id, 500)
    on conflict (student_id) do nothing;
    update public.avatar_wallets
      set balance = balance + reward, updated_at = now()
      where student_id = new.student_id;
  end if;

  return new;
end;
$function$;

drop trigger if exists reward_avatar_coins_after_practice on public.practice_sessions;
create trigger reward_avatar_coins_after_practice
after update of status on public.practice_sessions
for each row execute function private.reward_avatar_coins_for_completed_session();


-- Include Educational Center in teacher-facing group error analytics.
create or replace view public.practice_group_error_patterns
with (security_invoker = true)
as
select
  p.prom,
  p.shift,
  a.activity_id,
  a.topic,
  coalesce(a.error_type, 'unclassified'::text) as error_type,
  count(*) as error_attempts,
  count(distinct a.student_id) as affected_students,
  count(distinct row(a.student_id, a.question_text)) as affected_questions,
  max(a.answered_at) as last_seen,
  avg(a.time_to_answer_seconds) filter (where a.time_to_answer_seconds is not null) as avg_time_to_answer_seconds,
  count(*) filter (where lower(coalesce(a.selected_answer, ''::text)) = 'time expired'::text) as timed_out_answers,
  count(*) filter (where lower(coalesce(a.selected_answer, ''::text)) = 'skipped'::text) as skipped_answers,
  coalesce(p.educational_center, 'Unassigned') as educational_center
from public.practice_answers a
join public.profiles p on p.id = a.student_id
where a.is_correct = false
group by p.prom, p.shift, a.activity_id, a.topic, coalesce(a.error_type, 'unclassified'::text),
         coalesce(p.educational_center, 'Unassigned');
