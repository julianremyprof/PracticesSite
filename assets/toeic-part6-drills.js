(() => {
'use strict';
const $=id=>document.getElementById(id);
const drillNumber=Number(new URLSearchParams(location.search).get('drill'))||1;
const activityId='toeic-part6-drill-'+drillNumber;
const TOTAL_TEXTS=4,QUESTIONS_PER_TEXT=4,TOTAL_QUESTIONS=16,TEXT_SECONDS=150;
document.body.dataset.activityId=activityId;
let bank=[],drill=null,texts=[],currentTextIndex=0,answers=Array(TOTAL_QUESTIONS).fill(null),selected=Array(QUESTIONS_PER_TEXT).fill(null);
let deadlineAt=0,timerId=null,locked=false,pendingSaves=[],startedAt=Date.now(),resumeFound=false;
const screens=['startScreen','quizScreen','resultScreen'].map($);
function showScreen(node){screens.forEach(s=>s.classList.remove('active'));node.classList.add('active');window.scrollTo({top:0,behavior:'smooth'});const h=node.querySelector('h1');if(h)h.focus({preventScroll:true});}
function snapshot(){return {kind:'toeic-part6-drill',drill:drillNumber,texts,currentTextIndex,answers,selected,deadlineAt,startedAt};}
function saveState(){if(window.EnglishLabTracker&&texts.length)void window.EnglishLabTracker.saveState(snapshot());}
function stopTimer(){if(timerId)clearInterval(timerId);timerId=null;}
function remainingSeconds(){return Math.max(0,(deadlineAt-Date.now())/1000);}
function paintTimer(){
 const left=remainingSeconds(),seconds=Math.ceil(left),m=Math.floor(seconds/60),s=seconds%60;
 $('timerValue').textContent=m+':'+String(s).padStart(2,'0');
 $('timerFill').style.width=(left/TEXT_SECONDS*100)+'%';
 $('timerTrack').classList.toggle('urgent',left<=20);
}
function startTimer(remaining=TEXT_SECONDS){
 stopTimer();deadlineAt=Date.now()+Math.max(0,remaining)*1000;paintTimer();
 timerId=setInterval(()=>{paintTimer();if(Date.now()>=deadlineAt){stopTimer();void submitText('time');}},200);
 saveState();
}
function renderText(remaining=TEXT_SECONDS){
 locked=false;selected=Array.isArray(selected)?selected.slice(0,4):[null,null,null,null];selected.length=4;
 const item=texts[currentTextIndex];if(!item){finishDrill();return;}
 $('textCounter').textContent='TEXT '+(currentTextIndex+1)+' OF 4';
 $('questionCounter').textContent='QUESTIONS '+(currentTextIndex*4+1)+'–'+(currentTextIndex*4+4)+' OF 16';
 $('progressFill').style.width=(currentTextIndex/4*100)+'%';
 $('progressTrack').setAttribute('aria-valuenow',String(currentTextIndex));
 $('scoreLive').textContent=answers.filter(a=>a&&a.correct).length+' / 16 correct so far';
 $('passageType').textContent=item.type.toUpperCase();$('passageTitle').textContent=item.title;renderPassage(item.body);
 $('questionList').replaceChildren();
 item.questions.forEach((question,i)=>{
  const field=document.createElement('fieldset');field.className='d-question';
  const legend=document.createElement('legend');const focus=document.createElement('span');focus.className='d-focus';focus.textContent=question.focus;
  legend.append(focus,document.createTextNode((currentTextIndex*4+i+1)+'. '+question.prompt));field.append(legend);
  const options=document.createElement('div');options.className='d-options';
  question.options.forEach((option,j)=>{
   const label=document.createElement('label');label.className='d-option';
   const input=document.createElement('input');input.type='radio';input.name='q'+i;input.value=String(j);input.checked=selected[i]!==null&&selected[i]!==undefined&&Number(selected[i])===j;input.disabled=locked;
   input.addEventListener('change',()=>{selected[i]=j;saveState();updateSubmitHint();});
   const letter=document.createElement('span');letter.className='letter';letter.textContent=String.fromCharCode(65+j)+'.';
   const txt=document.createElement('span');txt.textContent=option;
   label.append(input,letter,txt);options.append(label);
  });
  field.append(options);$('questionList').append(field);
 });
 $('submitText').disabled=false;$('submitText').textContent='Submit text →';$('saveStatus').textContent='Your selections are saved as you work. All four questions stay on this page.';
 updateSubmitHint();startTimer(remaining);
}
function renderPassage(body){
 const root=$('passageText');root.replaceChildren();
 String(body||'').split(/(\[[1-4]\])/g).forEach(part=>{
  if(/^\[[1-4]\]$/.test(part)){
   const marker=document.createElement('span');marker.className='d-blank';marker.textContent='________ '+part;root.append(marker);
  }else root.append(document.createTextNode(part));
 });
}
function updateSubmitHint(){
 const count=selected.filter(v=>v!==null&&v!==undefined).length;
 $('submitHint').textContent=count+' of 4 answered. You can submit now; unanswered questions count as incorrect.';
}
function applyResume(detail){
 const c=detail?.custom;if(!c||c.kind!=='toeic-part6-drill'||Number(c.drill)!==drillNumber||!Array.isArray(c.texts)||c.texts.length!==4)return false;
 texts=c.texts;answers=Array.isArray(c.answers)?c.answers.slice():[];answers.length=16;
 currentTextIndex=Math.max(0,Math.min(4,Number(c.currentTextIndex)||0));
 selected=Array.isArray(c.selected)?c.selected.slice(0,4):[null,null,null,null];selected.length=4;
 deadlineAt=Number(c.deadlineAt)||0;startedAt=Number(c.startedAt)||Date.now();resumeFound=true;
 (detail.latestAnswers||[]).forEach(row=>{
  const index=Number(row.question_index);if(index<0||index>=16)return;
  const textIndex=Math.floor(index/4),questionIndex=index%4,q=texts[textIndex]?.questions?.[questionIndex];if(!q)return;
  const chosen=q.options.findIndex(x=>x===row.selected_answer);
  answers[index]={question:q.prompt,selected:row.selected_answer,answer:q.options[q.answer],correct:Boolean(row.is_correct),explanation:q.explanation,focus:q.focus};
 });
 const savedTextIndex=currentTextIndex;
 while(currentTextIndex<4&&answers.slice(currentTextIndex*4,currentTextIndex*4+4).every(Boolean))currentTextIndex++;
 if(currentTextIndex!==savedTextIndex){selected=[null,null,null,null];deadlineAt=0;}
 if(currentTextIndex>=4){finishDrill();return true;}
 $('startButton').textContent='Resume drill →';
 $('loadStatus').textContent='Your saved answers were restored. Continue with text '+(currentTextIndex+1)+'.';
 return true;
}
async function submitText(reason){
 if(locked)return;locked=true;stopTimer();$('submitText').disabled=true;
 Array.from($('questionList').querySelectorAll('input')).forEach(el=>el.disabled=true);
 const text=texts[currentTextIndex],elapsed=Math.max(0,Math.min(TEXT_SECONDS,TEXT_SECONDS-remainingSeconds()));
 $('saveStatus').textContent=reason==='time'?'Time is up. Recording this text and moving to the next one…':'Recording your answers…';
 const payloads=[];
 text.questions.forEach((q,i)=>{
  const globalIndex=currentTextIndex*4+i,choice=selected[i]===null||selected[i]===undefined?null:Number(selected[i]);
  const correct=choice===q.answer;
  const chosen=choice===null?'No answer':q.options[choice];
  answers[globalIndex]={question:q.prompt,selected:chosen,answer:q.options[q.answer],correct,explanation:q.explanation,focus:q.focus,chosenIndex:choice};
  payloads.push({questionIndex:globalIndex,totalQuestions:16,questionText:q.prompt,topic:'toeic-part6-'+String(q.focus||'text-completion').toLowerCase().replace(/[^a-z0-9]+/g,'-'),selectedAnswer:chosen,correctAnswer:q.options[q.answer],isCorrect:correct,timeToAnswerSeconds:Math.round(elapsed/4),errorType:choice===null?'unanswered':undefined,errorDetail:correct?null:q.explanation});
 });
 saveState();
 let allSaved=true;
 for(const payload of payloads){
  try{
   const ok=window.EnglishLabTracker?await window.EnglishLabTracker.record(payload):true;
   pendingSaves.push(Promise.resolve(ok));if(!ok)allSaved=false;
  }catch(error){pendingSaves.push(Promise.resolve(false));allSaved=false;}
 }
 if(!allSaved)$('saveStatus').textContent='A response could not be confirmed as saved. Check your connection.';
 currentTextIndex++;
 selected=[null,null,null,null];
 if(currentTextIndex>=4){finishDrill(allSaved);return;}
 if(!allSaved)$('saveStatus').textContent='Some answers could not be confirmed as saved. Your current screen will remain available.';
 saveState();renderText(TEXT_SECONDS);window.scrollTo({top:0,behavior:'smooth'});
}
function finishDrill(lastBatchSaved=true){
 stopTimer();showScreen($('resultScreen'));
 const correct=answers.filter(a=>a&&a.correct).length,incorrect=16-correct,pct=Math.round(correct/16*100);
 $('finalScore').textContent=correct+' / 16';$('correctTotal').textContent=correct;$('incorrectTotal').textContent=incorrect;$('accuracyTotal').textContent=pct+'%';$('scoreRing').style.setProperty('--score',(pct*3.6)+'deg');
 $('resultTitle').textContent=pct===100?'Perfect performance!':pct>=80?'Excellent work!':pct>=60?'Good progress!':'Keep training your Part 6 skills.';
 $('resultMessage').textContent='You completed four texts and sixteen questions. Review each passage and the reason behind every answer.';
 $('reviewContainer').replaceChildren();
 texts.forEach((t,ti)=>{
  const section=document.createElement('section');section.className='d-review-text';
  const h=document.createElement('h3');h.textContent='Text '+(ti+1)+' · '+t.title;section.append(h);
  t.questions.forEach((q,qi)=>{
   const index=ti*4+qi,a=answers[index],item=document.createElement('div');item.className='d-review-q';
   const title=document.createElement('b');title.textContent=(index+1)+'. '+q.prompt;
   const yours=document.createElement('p');yours.textContent='Your answer: '+(a?.selected||'No answer');
   const right=document.createElement('p');right.className='correct';right.textContent='Correct answer: '+q.options[q.answer];
   const why=document.createElement('p');why.textContent=q.explanation;
   item.append(title,yours,right,why);section.append(item);
  });
  $('reviewContainer').append(section);
 });
 $('retryButton').disabled=true;
 $('resultSaveStatus').textContent='Checking that all responses and your score have been saved…';
 Promise.allSettled(pendingSaves).then(arr=>{
  const ok=lastBatchSaved&&arr.every(x=>x.status==='fulfilled'&&x.value===true);
  $('resultSaveStatus').textContent=ok?'Your sixteen answers and final score have been recorded in your student account.':'Your score is displayed, but at least one answer could not be confirmed as saved. Keep this result open and check your connection before leaving.';
  $('retryButton').disabled=!ok;
 });
}
async function initialize(){
 try{
  const response=await fetch('../data/toeic-part6-drills.json',{cache:'no-store'});if(!response.ok)throw new Error('Question bank unavailable.');
  bank=await response.json();drill=bank.find(x=>Number(x.drill)===drillNumber);
  if(!drill||drill.texts.length!==4||drill.texts.some(t=>t.questions.length!==4))throw new Error('This drill must contain four texts and four questions per text.');
  texts=drill.texts;
  $('drillTitle').textContent='Part 6 · Drill '+drillNumber+' — '+drill.title;
  $('drillDescription').textContent=drill.description+' Read four texts, answer all sixteen questions and work within 2 minutes 30 seconds for each text.';
  $('loadStatus').textContent='Questions loaded. Checking for saved progress…';
  if(window.EnglishLabTracker?.ready)await window.EnglishLabTracker.ready;
  const detail=window.EnglishLabTracker?.getResumeDetails?.();
  if(detail&&!applyResume(detail)){$('loadStatus').textContent='An unfinished Part 6 drill was found but could not be matched. Return to the saved activity before starting again.';$('startButton').disabled=true;return;}
  $('startButton').disabled=false;
  if(resumeFound)$('loadStatus').textContent='Saved progress is ready. Resume with text '+(currentTextIndex+1)+'.';
  else $('loadStatus').textContent='Your full drill is ready. Your answers will be saved to your student account.';
 }catch(e){console.error(e);$('loadStatus').textContent='The drill could not be loaded. Refresh the page to try again.';}
}
$('startButton').addEventListener('click',async()=>{
 if(texts.length!==4)return;
 if(!resumeFound&&window.EnglishLabTracker){const id=await window.EnglishLabTracker.startNewSession(16);if(!id){$('loadStatus').textContent='An unfinished attempt is already saved. Resume it before starting a new one.';return;}}
 if(!resumeFound){answers=Array(16).fill(null);selected=[null,null,null,null];currentTextIndex=0;pendingSaves=[];startedAt=Date.now();}
 showScreen($('quizScreen'));
 let remaining=TEXT_SECONDS;
 if(resumeFound&&deadlineAt)remaining=Math.max(0,Math.min(TEXT_SECONDS,(deadlineAt-Date.now())/1000));
 if(resumeFound&&remaining<=0){selected=Array.isArray(selected)?selected:[null,null,null,null];renderText(0);void submitText('time');}
 else renderText(remaining);
});
$('submitText').addEventListener('click',()=>submitText('manual'));
$('retryButton').addEventListener('click',async()=>{
 if(window.EnglishLabTracker){const id=await window.EnglishLabTracker.startNewSession(16);if(!id)return;}
 resumeFound=false;currentTextIndex=0;answers=Array(16).fill(null);selected=[null,null,null,null];pendingSaves=[];startedAt=Date.now();showScreen($('quizScreen'));renderText(TEXT_SECONDS);
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveState();});
window.addEventListener('pagehide',saveState);
initialize();
})();