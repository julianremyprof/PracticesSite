(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const client = window.englishLabSupabase;
  if (!client) { document.addEventListener('DOMContentLoaded',()=>{$('storeMessage').textContent='Account connection unavailable. Please sign in again.';}); return; }
  let user=null, profile=null, items=[], owned=new Set(), equipped={}, category='all', busy=false;
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const labels={avatar:'Avatar',background:'Background',clothing:'Clothing',accessory:'Accessory',power:'Power'};
  async function load(){
    const {data:{user:current},error:userError}=await client.auth.getUser();
    if(userError||!current){location.href='student-login.html';return;}
    user=current;
    const p=await client.from('profiles').select('id,full_name,account_type').eq('id',user.id).single();
    if(p.error)throw p.error;
    profile=p.data;
    if(profile.account_type!=='student'){
      $('storeGrid').innerHTML='<div class="store-empty">The Avatar Store is available to student accounts.</div>';
      $('studentName').textContent=profile.full_name||'English Lab';
      return;
    }
    $('studentName').textContent=profile.full_name||'Your avatar';
    const results=await Promise.all([
      client.from('avatar_items').select('id,name,category,price,rarity,description,icon').eq('active',true).order('price'),
      client.from('avatar_wallets').select('balance').eq('student_id',user.id).single(),
      client.from('avatar_inventory').select('item_id').eq('student_id',user.id),
      client.from('avatar_equipment').select('slot,item_id').eq('student_id',user.id)
    ]);
    for(const r of results)if(r.error)throw r.error;
    items=results[0].data||[];
    $('coinBalance').textContent=Number(results[1].data?.balance||0).toLocaleString()+' coins';
    owned=new Set((results[2].data||[]).map(x=>x.item_id));
    equipped=Object.fromEntries((results[3].data||[]).map(x=>[x.slot,x.item_id]));
    const eqItems=Object.entries(equipped).map(([slot,id])=>items.find(x=>x.id===id)?.name||labels[slot]).filter(Boolean);
    const face=items.find(x=>x.id===equipped.avatar)?.icon||'🧑‍🎓';
    $('avatarPreview').textContent=face;
    $('equippedSummary').textContent=eqItems.length?'Equipped: '+eqItems.join(' · '):'No items equipped yet — explore the collection below.';
    render();
  }
  function render(){
    const list=items.filter(item=>category==='all'||item.category===category);
    $('storeGrid').innerHTML=list.length?list.map(item=>{
      const has=owned.has(item.id),active=equipped[item.category]===item.id;
      const action=active?'<button class="store-action" disabled>Equipped</button>':
        has?'<button class="store-action" data-equip="'+esc(item.id)+'">Equip</button>':
        '<button class="store-action" data-buy="'+esc(item.id)+'">Purchase</button>';
      return '<article class="store-item"><div class="store-item-top"><div class="store-item-icon">'+esc(item.icon)+'</div><span class="store-rarity">'+esc(item.rarity)+'</span></div><h3>'+esc(item.name)+'</h3><p>'+esc(item.description)+'</p><div class="store-meta"><span class="store-price">'+Number(item.price).toLocaleString()+' coins</span>'+action+'</div></article>';
    }).join(''):'<div class="store-empty">There are no items in this category yet.</div>';
    $('storeGrid').querySelectorAll('[data-buy]').forEach(button=>button.addEventListener('click',()=>purchase(button.dataset.buy,button)));
    $('storeGrid').querySelectorAll('[data-equip]').forEach(button=>button.addEventListener('click',()=>equip(button.dataset.equip,button)));
  }
  async function purchase(id,button){
    if(busy)return;busy=true;button.disabled=true;$('storeMessage').textContent='Processing your purchase…';
    try{
      const {data,error}=await client.rpc('purchase_avatar_item',{p_item_id:id});
      if(error)throw error;
      if(!data?.ok)throw new Error(data?.error||'Purchase could not be completed.');
      $('storeMessage').textContent=data.owned?'You already own this item.': 'Purchase successful. Your new item has been added to your collection.';
      await load();
    }catch(error){$('storeMessage').textContent=error.message||'Purchase failed. Please try again.';}
    finally{busy=false;}
  }
  async function equip(id,button){
    if(busy)return;busy=true;button.disabled=true;$('storeMessage').textContent='Equipping your item…';
    try{
      const {data,error}=await client.rpc('equip_avatar_item',{p_item_id:id});
      if(error)throw error;
      if(!data?.ok)throw new Error(data?.error||'This item could not be equipped.');
      $('storeMessage').textContent='Item equipped to your profile.';
      await load();
    }catch(error){$('storeMessage').textContent=error.message||'Could not equip item.';}
    finally{busy=false;}
  }
  $('storeTabs').addEventListener('click',event=>{
    const button=event.target.closest('[data-category]');if(!button)return;
    category=button.dataset.category;
    $('storeTabs').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===button));
    render();
  });
  document.addEventListener('DOMContentLoaded',()=>load().catch(error=>{$('storeGrid').innerHTML='<div class="store-empty">The store could not load: '+esc(error.message)+'</div>';}));
})();