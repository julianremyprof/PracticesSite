(() => {
  'use strict';
  if (window.__englishLabChatWidget || /\/chat\.html$/i.test(location.pathname)) return;
  const db = window.englishLabSupabase || (window.supabase?.createClient
    ? window.supabase.createClient('https://kehopukcypesrecyfrvp.supabase.co', 'sb_publishable_zDWMioaroblLV0cRMh-SoQ_RvGYnCE6')
    : null);
  if (!db) return;
  window.englishLabSupabase = db;
  window.__englishLabChatWidget = true;
  const style=document.createElement('style');style.textContent="\n.el-chat-widget{position:fixed;right:22px;bottom:20px;z-index:10050;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;color:#1d1d1f}\n.el-chat-launch{position:relative;display:flex;align-items:center;justify-content:center;width:62px;height:62px;border:0;border-radius:50%;background:#18324f;color:#fff;box-shadow:0 9px 28px #132c4933;cursor:pointer}\n.el-chat-launch svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}\n.el-chat-badge{position:absolute;top:-4px;right:-4px;display:none;min-width:22px;height:22px;padding:0 6px;align-items:center;justify-content:center;border:2px solid #fff;border-radius:99px;background:#e3343f;color:#fff;font-size:11px;font-weight:850;line-height:1}\n.el-chat-badge.show{display:flex}\n.el-chat-panel{position:absolute;right:0;bottom:76px;display:flex;width:min(370px,calc(100vw - 28px));height:min(540px,calc(100vh - 120px));flex-direction:column;overflow:hidden;border:1px solid #dfe5eb;border-radius:20px;background:#fff;box-shadow:0 18px 55px #162b4430}\n.el-chat-panel[hidden]{display:none}\n.el-chat-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;background:#18324f;color:#fff}\n.el-chat-head strong{display:block;font-size:14px}.el-chat-head small{display:block;margin-top:3px;color:#d4e0eb;font-size:11px}\n.el-chat-head-actions{display:flex;gap:6px}\n.el-chat-head-actions button{display:grid;place-items:center;width:30px;height:30px;border:0;border-radius:8px;background:#ffffff1c;color:white;font-size:18px;cursor:pointer}\n.el-chat-main{display:grid;grid-template-rows:132px minmax(0,1fr) auto;min-height:0;flex:1}\n.el-chat-people{overflow:auto;padding:7px;border-bottom:1px solid #e8edf1;background:#fbfcfd}\n.el-chat-person{display:flex;align-items:center;gap:9px;width:100%;padding:8px 9px;border:0;border-radius:10px;background:transparent;text-align:left;cursor:pointer}\n.el-chat-person:hover{background:#f0f4f7}.el-chat-person.active{background:#e8f0f7}\n.el-chat-avatar{display:grid;place-items:center;width:32px;height:32px;flex:0 0 32px;border-radius:11px;background:#e0edf3;color:#18324f;font-size:12px;font-weight:850}\n.el-chat-person-copy{min-width:0;flex:1}.el-chat-person-copy strong{display:block;overflow:hidden;color:#293d51;font-size:12px;text-overflow:ellipsis;white-space:nowrap}\n.el-chat-person-copy small{display:block;overflow:hidden;margin-top:2px;color:#7b8792;font-size:10px;text-overflow:ellipsis;white-space:nowrap}\n.el-chat-person-unread{width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:#e3343f}\n.el-chat-messages{display:flex;min-height:0;flex-direction:column;gap:9px;overflow:auto;padding:12px;background:#fcfdfe}\n.el-chat-empty{display:grid;place-items:center;min-height:100%;padding:18px;color:#7b8792;font-size:12px;line-height:1.5;text-align:center}\n.el-chat-message{max-width:86%;padding:9px 11px;border:1px solid #e2e8ed;border-radius:13px 13px 13px 4px;background:#f2f6f8;color:#354659;overflow-wrap:anywhere}\n.el-chat-message.mine{align-self:flex-end;border-color:#cddfec;border-radius:13px 13px 4px 13px;background:#e8f1f8}\n.el-chat-message p{margin:0;font-size:12px;line-height:1.45;white-space:pre-wrap}\n.el-chat-message time{display:block;margin-top:5px;color:#7b8792;font-size:9px;text-align:right}\n.el-chat-compose{display:flex;gap:7px;padding:10px;border-top:1px solid #e6ebef;background:white}\n.el-chat-compose textarea{min-width:0;min-height:40px;max-height:90px;flex:1;resize:vertical;padding:9px 10px;border:1px solid #d8e1e8;border-radius:10px;font:inherit;font-size:12px}\n.el-chat-send{padding:0 13px;border:0;border-radius:10px;background:#18324f;color:white;font-size:12px;font-weight:750;cursor:pointer}\n.el-chat-send:disabled{opacity:.45;cursor:not-allowed}\n.el-chat-toast{position:absolute;right:0;bottom:86px;width:min(310px,calc(100vw - 28px));padding:12px 14px;border:1px solid #dce4ec;border-radius:13px;background:white;box-shadow:0 10px 30px #162b4426;cursor:pointer}\n.el-chat-toast strong{display:block;color:#21374d;font-size:12px}.el-chat-toast span{display:block;margin-top:3px;color:#667383;font-size:11px;line-height:1.4}\n.el-chat-status{min-height:17px;padding:0 12px 7px;color:#647181;font-size:10px}\n@media(max-width:500px){.el-chat-widget{right:12px;bottom:12px}.el-chat-panel{bottom:72px;height:min(520px,calc(100vh - 94px))}.el-chat-launch{width:56px;height:56px}}\n";document.head.appendChild(style);
  const root=document.createElement('div');root.className='el-chat-widget';root.innerHTML="\n<section class=\"el-chat-panel\" id=\"elChatPanel\" hidden aria-label=\"Teacher messages\">\n  <header class=\"el-chat-head\">\n    <div><strong>Teacher messages</strong><small id=\"elChatSubtitle\">Private conversations</small></div>\n    <div class=\"el-chat-head-actions\"><button type=\"button\" id=\"elChatMinimize\" aria-label=\"Minimize chat\">−</button></div>\n  </header>\n  <div class=\"el-chat-main\">\n    <div class=\"el-chat-people\" id=\"elChatPeople\"><div class=\"el-chat-empty\">Loading conversations…</div></div>\n    <div class=\"el-chat-messages\" id=\"elChatMessages\"><div class=\"el-chat-empty\">Choose a conversation to read or send a message.</div></div>\n    <form class=\"el-chat-compose\" id=\"elChatForm\">\n      <textarea id=\"elChatInput\" maxlength=\"4000\" placeholder=\"Write a message…\" disabled required></textarea>\n      <button class=\"el-chat-send\" id=\"elChatSend\" type=\"submit\" disabled>Send</button>\n    </form>\n  </div>\n  <div class=\"el-chat-status\" id=\"elChatStatus\" role=\"status\" aria-live=\"polite\"></div>\n</section>\n<div class=\"el-chat-toast\" id=\"elChatToast\" hidden role=\"alert\"></div>\n<button class=\"el-chat-launch\" id=\"elChatLaunch\" type=\"button\" aria-label=\"Open teacher messages\" aria-expanded=\"false\">\n  <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-5.5A7.5 7.5 0 0 1 10.5 8h2A7.5 7.5 0 0 1 20 15.5Z\" transform=\"translate(0 -3)\"></path><path d=\"M8 9h8M8 13h5\"></path></svg>\n  <span class=\"el-chat-badge\" id=\"elChatBadge\">0</span>\n</button>\n";document.body.appendChild(root);
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const clock=v=>new Date(v).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  let user=null,isTeacher=false,people=[],conversations=[],activeConversation=null,messages=[],channel=null,toastTimer=null,busy=false,unread=new Map();
  function setStatus(v){$('elChatStatus').textContent=v||'';}
  function updateBadge(){const count=[...unread.values()].reduce((a,b)=>a+b,0),badge=$('elChatBadge');badge.textContent=count>99?'99+':String(count);badge.classList.toggle('show',count>0);$('elChatLaunch').setAttribute('aria-label',count?'Open teacher messages, '+count+' unread':'Open teacher messages');}
  function openPanel(){if('Notification'in window&&Notification.permission==='default'){try{Notification.requestPermission();}catch{}}$('elChatPanel').hidden=false;$('elChatLaunch').setAttribute('aria-expanded','true');if(activeConversation)markRead(activeConversation.id);}
  function minimize(){ $('elChatPanel').hidden=true;$('elChatLaunch').setAttribute('aria-expanded','false');}
  function toast(title,body,conversationId){const el=$('elChatToast');el.innerHTML='<strong>'+esc(title)+'</strong><span>'+esc(body||'You have a new message.')+'</span>';el.hidden=false;el.onclick=()=>{openPanel();if(conversationId)selectConversation(conversationId);el.hidden=true;};clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,6500);}
  function notify(title,body,id){toast(title,body,id);if('Notification'in window&&Notification.permission==='granted'){try{const n=new Notification(title,{body:body||'You have a new message.',tag:'english-lab-'+id});n.onclick=()=>{window.focus();openPanel();selectConversation(id);n.close();};}catch{}}}
  function otherId(c){return isTeacher?c.student_id:c.teacher_id;}
  function renderPeople(){
    const box=$('elChatPeople');
    if(!people.length){box.innerHTML='<div class="el-chat-empty">'+(isTeacher?'No students are available in your assigned Proms.':'Your teacher has not started a conversation yet.')+'</div>';return;}
    box.innerHTML=people.map(p=>{const c=conversations.find(x=>otherId(x)===p.id),active=c&&activeConversation?.id===c.id,n=c?unread.get(c.id)||0:0;
      const sub=isTeacher?'Prom '+(p.prom||'—')+' · Group '+(p.group_code||'—'):'Teacher';
      return '<button class="el-chat-person '+(active?'active':'')+'" type="button" data-chat-person="'+esc(p.id)+'"><span class="el-chat-avatar">'+esc((p.full_name||'?').trim().slice(0,1).toUpperCase())+'</span><span class="el-chat-person-copy"><strong>'+esc(p.full_name||'User')+'</strong><small>'+esc(sub)+(c?'':' · Start chat')+'</small></span>'+(n?'<span class="el-chat-person-unread" aria-label="'+n+' unread"></span>':'')+'</button>';
    }).join('');
    box.querySelectorAll('[data-chat-person]').forEach(b=>b.addEventListener('click',()=>isTeacher?startTeacherChat(b.dataset.chatPerson):openStudentChat(b.dataset.chatPerson)));
  }
  async function loadConversations(){
    if(isTeacher){
      const [p,c]=await Promise.all([
        db.from('profiles').select('id,full_name,email,prom,group_code,educational_center,account_type').eq('account_type','student').order('full_name'),
        db.from('teacher_conversations').select('id,teacher_id,student_id,created_at').eq('teacher_id',user.id).order('created_at',{ascending:false})
      ]);
      if(p.error)throw p.error;if(c.error)throw c.error;people=p.data||[];conversations=c.data||[];
    }else{
      const c=await db.from('teacher_conversations').select('id,teacher_id,student_id,created_at').eq('student_id',user.id).order('created_at',{ascending:false});
      if(c.error)throw c.error;conversations=c.data||[];
      const ids=conversations.map(x=>x.teacher_id);
      if(ids.length){const p=await db.from('profiles').select('id,full_name,account_type').in('id',ids);if(p.error)throw p.error;people=p.data||[];}else people=[];
    }
    renderPeople();
  }
  async function refreshUnread(){
    const r=await db.from('teacher_messages').select('id,conversation_id').neq('sender_id',user.id).is('read_at',null);
    if(r.error)throw r.error;unread=new Map();(r.data||[]).forEach(m=>unread.set(m.conversation_id,(unread.get(m.conversation_id)||0)+1));updateBadge();renderPeople();
  }
  async function startTeacherChat(studentId){
    let c=conversations.find(x=>x.student_id===studentId);
    if(!c){const created=await db.from('teacher_conversations').insert({teacher_id:user.id,student_id:studentId}).select('id,teacher_id,student_id,created_at').single();
      if(created.error){const retry=await db.from('teacher_conversations').select('id,teacher_id,student_id,created_at').eq('teacher_id',user.id).eq('student_id',studentId).maybeSingle();if(retry.error||!retry.data)throw created.error;c=retry.data;}else c=created.data;
      conversations.unshift(c);}
    openPanel();await selectConversation(c.id);
  }
  async function openStudentChat(teacherId){const c=conversations.find(x=>x.teacher_id===teacherId);if(c){openPanel();await selectConversation(c.id);}}
  async function selectConversation(id){
    const c=conversations.find(x=>x.id===id);if(!c)return;activeConversation=c;
    const p=people.find(x=>x.id===otherId(c));$('elChatSubtitle').textContent=p?.full_name||'Private conversation';
    $('elChatInput').disabled=false;$('elChatSend').disabled=false;renderPeople();await loadMessages();
    if(channel)await db.removeChannel(channel);
    channel=db.channel('english-lab-widget-active-'+c.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'teacher_messages',filter:'conversation_id=eq.'+c.id},payload=>{
      const m=payload.new;if(messages.some(x=>x.id===m.id))return;messages.push(m);renderMessages();if(m.sender_id!==user.id&& !$('elChatPanel').hidden)markRead(c.id);
    }).subscribe(s=>setStatus(s==='SUBSCRIBED'?'Live messages':'Connecting…'));
  }
  async function loadMessages(){
    const r=await db.from('teacher_messages').select('id,conversation_id,sender_id,body,created_at,read_at').eq('conversation_id',activeConversation.id).order('created_at',{ascending:true}).limit(200);
    if(r.error)throw r.error;messages=r.data||[];renderMessages();await markRead(activeConversation.id);
  }
  async function markRead(id){
    const r=await db.from('teacher_messages').update({read_at:new Date().toISOString()}).eq('conversation_id',id).neq('sender_id',user.id).is('read_at',null);
    if(r.error)return;unread.delete(id);updateBadge();renderPeople();
  }
  function renderMessages(){const box=$('elChatMessages');box.innerHTML=messages.length?messages.map(m=>'<article class="el-chat-message '+(m.sender_id===user.id?'mine':'')+'"><p>'+esc(m.body)+'</p><time>'+esc(clock(m.created_at))+'</time></article>').join(''):'<div class="el-chat-empty">This conversation is ready. Send the first message to begin.</div>';box.scrollTop=box.scrollHeight;}
  async function onIncoming(m){
    if(!m||m.sender_id===user.id)return;
    const c=conversations.find(x=>x.id===m.conversation_id);if(!c)return;
    if(activeConversation?.id===m.conversation_id&&!$('elChatPanel').hidden){if(!messages.some(x=>x.id===m.id)){messages.push(m);renderMessages();}await markRead(m.conversation_id);return;}
    unread.set(m.conversation_id,(unread.get(m.conversation_id)||0)+1);updateBadge();renderPeople();
    const p=people.find(x=>x.id===otherId(c));notify(p?.full_name||'New teacher message',m.body,m.conversation_id);
  }
  async function send(event){
    event.preventDefault();if(busy||!activeConversation)return;const body=$('elChatInput').value.trim();if(!body)return;
    busy=true;$('elChatSend').disabled=true;setStatus('Sending…');
    try{const r=await db.from('teacher_messages').insert({conversation_id:activeConversation.id,sender_id:user.id,body});if(r.error)throw r.error;$('elChatInput').value='';setStatus('Message sent');await loadMessages();}
    catch(e){setStatus(e.message||'Message could not be sent.');}
    finally{busy=false;$('elChatSend').disabled=!activeConversation;}
  }
  async function init(){
    const auth=await db.auth.getUser();if(auth.error||!auth.data?.user){root.remove();window.__englishLabChatWidget=false;return;}user=auth.data.user;
    const p=await db.from('profiles').select('id,full_name,account_type').eq('id',user.id).single();if(p.error)throw p.error;isTeacher=p.data.account_type!=='student';
    if(isTeacher){const a=await db.from('teacher_access').select('status,is_admin').eq('user_id',user.id).maybeSingle();if(a.error)throw a.error;if(!a.data||a.data.status!=='approved'){root.remove();window.__englishLabChatWidget=false;return;}}
    await loadConversations();await refreshUnread();
    const realtime=db.channel('english-lab-chat-notifications-'+user.id)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'teacher_messages'},payload=>onIncoming(payload.new))
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'teacher_messages'},()=>refreshUnread().catch(()=>{}))
      .subscribe();
    window.addEventListener('beforeunload',()=>{db.removeChannel(realtime);if(channel)db.removeChannel(channel);});
  }
  $('elChatLaunch').addEventListener('click',()=>{if($('elChatPanel').hidden)openPanel();else minimize();});
  $('elChatMinimize').addEventListener('click',minimize);
  $('elChatForm').addEventListener('submit',send);
  $('elChatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('elChatForm').requestSubmit();}});
  init().catch(error=>{console.error('English Lab chat widget:',error);root.remove();window.__englishLabChatWidget=false;});
})();
