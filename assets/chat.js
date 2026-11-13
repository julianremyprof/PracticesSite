(() => {
'use strict';
const $=id=>document.getElementById(id),db=window.englishLabSupabase;
let user,profile,mode='teacher',people=[],conversations=[],active=null,channel=null,messages=[],busy=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateTime=v=>new Date(v).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
function status(s){$('connectionStatus').textContent=s;}
function peerId(c){return c.participant_a===user.id?c.participant_b:c.participant_a;}
function renderPeople(){
 const q=$('chatSearch').value.trim().toLowerCase();
 const list=people.filter(p=>(p.full_name||'').toLowerCase().includes(q)||(p.email||'').toLowerCase().includes(q)||(p.group_code||'').toLowerCase().includes(q));
 $('chatList').innerHTML=list.length?list.map(p=>{
  const c=conversations.find(x=>mode==='teacher'?x.student_id===p.id:x.participant_a===p.id||x.participant_b===p.id);
  const isActive=c&&active?.id===c.id;
  const sub=mode==='teacher'?'Prom '+(p.prom||'—')+' · Group '+(p.group_code||'—'):'Student · Prom '+(p.prom||'—')+' · Group '+(p.group_code||'—');
  return '<button class="chat-person '+(isActive?'active':'')+'" data-person="'+esc(p.id)+'"><span class="chat-person-avatar">'+esc((p.full_name||'?').slice(0,1).toUpperCase())+'</span><span class="chat-person-copy"><strong>'+esc(p.full_name||'Student')+'</strong><small>'+esc(sub)+(c?' · Open chat':' · Start chat')+'</small></span></button>';
 }).join(''):'<div class="chat-empty">No people match your search.</div>';
 $('chatList').querySelectorAll('[data-person]').forEach(b=>b.addEventListener('click',()=>mode==='teacher'?openTeacher(b.dataset.person):openPeer(b.dataset.person)));
}
async function init(){
 const auth=await db.auth.getUser();if(auth.error||!auth.data.user){location.href='student-login.html';return;}user=auth.data.user;
 const p=await db.from('profiles').select('id,full_name,account_type,prom,group_code,educational_center').eq('id',user.id).single();if(p.error)throw p.error;profile=p.data;
 if(profile.account_type==='student'){
  mode='peer';$('chatListTitle').textContent='Students';$('chatListSubtitle').textContent='Search for a classmate and start a private conversation';$('chatSearch').placeholder='Find a student';
  const [peopleResult,convs]=await Promise.all([db.from('student_chat_directory').select('id,full_name,prom,group_code').order('full_name'),db.from('community_conversations').select('id,participant_a,participant_b,created_at').or('participant_a.eq.'+user.id+',participant_b.eq.'+user.id).order('created_at',{ascending:false})]);
  if(peopleResult.error)throw peopleResult.error;if(convs.error)throw convs.error;people=(peopleResult.data||[]).filter(x=>x.id!==user.id);conversations=convs.data||[];
 }else{
  const access=await db.from('teacher_access').select('status,is_admin').eq('user_id',user.id).maybeSingle();if(access.error)throw access.error;
  if(profile.account_type!=='admin'&&(!access.data||access.data.status!=='approved')){status('Not approved');$('chatList').textContent='Teacher chat is available after administrator approval.';return;}
  mode='teacher';$('chatListTitle').textContent='Students';$('chatListSubtitle').textContent='Search for a student to start or continue a private chat';
  const [p,c]=await Promise.all([db.from('profiles').select('id,full_name,email,prom,group_code,educational_center').eq('account_type','student').order('full_name'),db.from('teacher_conversations').select('id,teacher_id,student_id,created_at').eq('teacher_id',user.id).order('created_at',{ascending:false})]);
  if(p.error)throw p.error;if(c.error)throw c.error;people=p.data||[];conversations=c.data||[];
 }
 renderPeople();$('chatSearch').addEventListener('input',renderPeople);$('chatForm').addEventListener('submit',send);
 $('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('chatForm').requestSubmit();}});
 status('Live');
}
async function openTeacher(studentId){
 let c=conversations.find(x=>x.student_id===studentId);
 if(!c){const r=await db.from('teacher_conversations').insert({teacher_id:user.id,student_id:studentId}).select('id,teacher_id,student_id,created_at').single();if(r.error){const retry=await db.from('teacher_conversations').select('id,teacher_id,student_id,created_at').eq('teacher_id',user.id).eq('student_id',studentId).maybeSingle();if(retry.error||!retry.data)throw r.error;c=retry.data;}else c=r.data;conversations.unshift(c);}
 await select(c);
}
async function openPeer(studentId){
 const ids=[user.id,studentId].sort();let c=conversations.find(x=>x.participant_a===ids[0]&&x.participant_b===ids[1]);
 if(!c){const r=await db.from('community_conversations').insert({participant_a:ids[0],participant_b:ids[1]}).select('id,participant_a,participant_b,created_at').single();if(r.error){const retry=await db.from('community_conversations').select('id,participant_a,participant_b,created_at').eq('participant_a',ids[0]).eq('participant_b',ids[1]).maybeSingle();if(retry.error||!retry.data)throw r.error;c=retry.data;}else c=r.data;conversations.unshift(c);}
 await select(c);
}
async function select(c){
 active=c;const other=people.find(p=>p.id===(mode==='teacher'?c.student_id:peerId(c)));
 $('chatTitle').textContent=other?.full_name||'Private conversation';$('chatSubtitle').textContent=mode==='teacher'?'Private conversation with your student':'Private student-to-student conversation';
 $('chatInput').disabled=false;$('chatSend').disabled=false;renderPeople();await loadMessages();
 if(channel)await db.removeChannel(channel);const table=mode==='teacher'?'teacher_messages':'community_messages';
 channel=db.channel('raisingdiamonds-chat-'+c.id).on('postgres_changes',{event:'INSERT',schema:'public',table,filter:'conversation_id=eq.'+c.id},payload=>{if(!messages.some(m=>m.id===payload.new.id)){messages.push(payload.new);renderMessages();}}).subscribe(s=>status(s==='SUBSCRIBED'?'Live':'Connecting…'));
}
async function loadMessages(){
 const table=mode==='teacher'?'teacher_messages':'community_messages';
 const r=await db.from(table).select('id,conversation_id,sender_id,body,created_at').eq('conversation_id',active.id).order('created_at',{ascending:true}).limit(500);
 if(r.error)throw r.error;messages=r.data||[];renderMessages();
}
function renderMessages(){
 $('chatMessages').innerHTML=messages.length?messages.map(m=>'<div class="chat-bubble-row '+(m.sender_id===user.id?'mine':'')+'"><article class="chat-bubble"><p>'+esc(m.body)+'</p><time>'+esc(dateTime(m.created_at))+'</time></article></div>').join(''):'<div class="chat-empty">This conversation is ready. Send the first message to begin.</div>';
 $('chatMessages').scrollTop=$('chatMessages').scrollHeight;
}
async function send(e){
 e.preventDefault();if(busy||!active)return;const body=$('chatInput').value.trim();if(!body)return;busy=true;$('chatSend').disabled=true;$('chatMessage').textContent='Sending…';
 try{const table=mode==='teacher'?'teacher_messages':'community_messages';const r=await db.from(table).insert({conversation_id:active.id,sender_id:user.id,body});if(r.error)throw r.error;$('chatInput').value='';$('chatMessage').textContent='Message sent.';await loadMessages();}
 catch(err){$('chatMessage').textContent=err.message||'Message could not be sent.';}
 finally{busy=false;$('chatSend').disabled=!active;}
}
document.addEventListener('DOMContentLoaded',()=>init().catch(e=>{$('chatMessage').textContent=e.message||'Chat could not load.';status('Unavailable');}));
window.addEventListener('beforeunload',()=>{if(channel)db.removeChannel(channel);});
})();