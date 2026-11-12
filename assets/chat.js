(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const db=window.englishLabSupabase;
  let user=null,profile=null,isTeacher=false,people=[],conversations=[],activeConversation=null,channel=null,messages=[],busy=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const roleName=p=>p?.account_type==='student'?'Student':p?.account_type==='admin'?'Administrator':'Teacher';
  const dateTime=v=>new Date(v).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  function setStatus(t){$('connectionStatus').textContent=t;}
  async function init(){
    const {data:{user:current},error:authError}=await db.auth.getUser();
    if(authError||!current){location.href='student-login.html';return;}
    user=current;
    const p=await db.from('profiles').select('id,full_name,account_type,prom,group_code,educational_center').eq('id',user.id).single();
    if(p.error)throw p.error;profile=p.data;
    if(profile.account_type==='student'){
      isTeacher=false;
      $('chatListTitle').textContent='Your teachers';
      $('chatListSubtitle').textContent='Teachers who have started a conversation with you';
      await loadStudentConversations();
    }else{
      isTeacher=true;
      const access=await db.from('teacher_access').select('status,is_admin').eq('user_id',user.id).maybeSingle();
      if(access.error)throw access.error;
      if(!access.data||access.data.status!=='approved'){
        $('chatList').innerHTML='<div class="chat-empty">Teacher chat becomes available after administrator approval.</div>';
        setStatus('Not approved');return;
      }
      $('chatListTitle').textContent='Students';
      $('chatListSubtitle').textContent='Select a student to start or continue a private chat';
      await loadTeacherDirectory();
    }
    $('chatSearch').addEventListener('input',renderPeople);
    $('chatForm').addEventListener('submit',sendMessage);
    $('chatInput').addEventListener('keydown',event=>{
      if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();$('chatForm').requestSubmit();}
    });
    setStatus('Live');
  }
  async function loadStudentConversations(){
    const r=await db.from('teacher_conversations').select('id,teacher_id,student_id,created_at').eq('student_id',user.id).order('created_at',{ascending:false});
    if(r.error)throw r.error;conversations=r.data||[];
    const ids=conversations.map(c=>c.teacher_id);
    if(ids.length){
      const t=await db.from('profiles').select('id,full_name,account_type').in('id',ids);
      if(t.error)throw t.error;people=t.data||[];
    }else people=[];
    renderPeople();
    if(conversations.length)selectConversation(conversations[0].id);
    else $('chatMessages').innerHTML='<div class="chat-empty">No teacher conversations yet. Your teacher can start a private chat with you from the student list.</div>';
  }
  async function loadTeacherDirectory(){
    const [p,c]=await Promise.all([
      db.from('profiles').select('id,full_name,email,prom,group_code,educational_center,account_type').eq('account_type','student').order('full_name'),
      db.from('teacher_conversations').select('id,teacher_id,student_id,created_at').eq('teacher_id',user.id).order('created_at',{ascending:false})
    ]);
    if(p.error)throw p.error;if(c.error)throw c.error;
    people=p.data||[];conversations=c.data||[];renderPeople();
    if(conversations.length)selectConversation(conversations[0].id);
  }
  function renderPeople(){
    const q=$('chatSearch').value.trim().toLowerCase();
    let list=people.filter(p=>(p.full_name||'').toLowerCase().includes(q)||(p.email||'').toLowerCase().includes(q)||(p.group_code||'').toLowerCase().includes(q));
    if(!isTeacher)list=list.filter(p=>conversations.some(c=>c.teacher_id===p.id));
    $('chatList').innerHTML=list.length?list.map(p=>{
      const conv=isTeacher?conversations.find(c=>c.student_id===p.id):conversations.find(c=>c.teacher_id===p.id);
      const active=conv&&activeConversation?.id===conv.id;
      const detail=isTeacher?'Prom '+(p.prom||'—')+' · Group '+(p.group_code||'—'):(p.account_type==='teacher'?'Teacher':'Administrator');
      return '<button type="button" class="chat-person '+(active?'active':'')+'" data-person="'+esc(p.id)+'"><span class="chat-person-avatar">'+esc((p.full_name||'?').trim().slice(0,1).toUpperCase())+'</span><span class="chat-person-copy"><strong>'+esc(p.full_name||'User')+'</strong><small>'+esc(detail)+(conv?' · Open chat':' · Start chat')+'</small></span></button>';
    }).join(''):'<div class="chat-empty">'+(isTeacher?'No students are available in your assigned Proms.':'No teacher conversations yet.')+'</div>';
    $('chatList').querySelectorAll('[data-person]').forEach(btn=>btn.addEventListener('click',()=>isTeacher?openOrCreateConversation(btn.dataset.person):openStudentTeacherConversation(btn.dataset.person)));
  }
  async function openOrCreateConversation(studentId){
    let conv=conversations.find(c=>c.student_id===studentId);
    if(!conv){
      const created=await db.from('teacher_conversations').insert({teacher_id:user.id,student_id:studentId}).select('id,teacher_id,student_id,created_at').single();
      if(created.error){
        const retry=await db.from('teacher_conversations').select('id,teacher_id,student_id,created_at').eq('teacher_id',user.id).eq('student_id',studentId).maybeSingle();
        if(retry.error||!retry.data)throw created.error;
        conv=retry.data;
      }else conv=created.data;
      conversations.unshift(conv);
    }
    await selectConversation(conv.id);
    renderPeople();
  }
  async function openStudentTeacherConversation(teacherId){
    const conv=conversations.find(c=>c.teacher_id===teacherId);
    if(conv)await selectConversation(conv.id);
  }
  async function selectConversation(id){
    const conv=conversations.find(c=>c.id===id);if(!conv)return;
    activeConversation=conv;
    const otherId=isTeacher?conv.student_id:conv.teacher_id;
    const other=people.find(p=>p.id===otherId);
    $('chatTitle').textContent=other?.full_name||'Conversation';
    $('chatSubtitle').textContent=isTeacher?'Private conversation with your student':'Private conversation with your teacher';
    $('chatInput').disabled=false;$('chatSend').disabled=false;
    renderPeople();
    await loadMessages();
    if(channel)await db.removeChannel(channel);
    channel=db.channel('teacher-chat-'+conv.id)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'teacher_messages',filter:'conversation_id=eq.'+conv.id},payload=>{
        if(!messages.some(m=>m.id===payload.new.id)){messages.push(payload.new);renderMessages();}
      }).subscribe(status=>setStatus(status==='SUBSCRIBED'?'Live':'Connecting…'));
  }
  async function loadMessages(){
    const r=await db.from('teacher_messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id',activeConversation.id).order('created_at',{ascending:true}).limit(500);
    if(r.error)throw r.error;messages=r.data||[];renderMessages();
  }
  function renderMessages(){
    const box=$('chatMessages');
    box.innerHTML=messages.length?messages.map(m=>{
      const mine=m.sender_id===user.id;
      return '<div class="chat-bubble-row '+(mine?'mine':'')+'"><article class="chat-bubble"><p>'+esc(m.body)+'</p><time>'+esc(dateTime(m.created_at))+'</time></article></div>';
    }).join(''):'<div class="chat-empty">This conversation is ready. Send the first message to begin.</div>';
    box.scrollTop=box.scrollHeight;
  }
  async function sendMessage(event){
    event.preventDefault();if(busy||!activeConversation)return;
    const body=$('chatInput').value.trim();if(!body)return;
    busy=true;$('chatSend').disabled=true;$('chatMessage').textContent='Sending…';
    try{
      const r=await db.from('teacher_messages').insert({conversation_id:activeConversation.id,sender_id:user.id,body});
      if(r.error)throw r.error;
      $('chatInput').value='';$('chatMessage').textContent='Message sent.';
      await loadMessages();
    }catch(error){$('chatMessage').textContent=error.message||'Message could not be sent.';}
    finally{busy=false;$('chatSend').disabled=!activeConversation;}
  }
  document.addEventListener('DOMContentLoaded',()=>init().catch(error=>{$('chatMessage').textContent=error.message||'Chat could not load. Check your account access.';setStatus('Unavailable');}));
  window.addEventListener('beforeunload',()=>{if(channel)db.removeChannel(channel);});
})();