(() => {
'use strict';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const skillKey=params.get('skill')||'text-type';
const skillNames={
 'text-type':{title:'Identify the type of text',short:'TEXT TYPE',topic:'toeic-part6-text-type'},
 'context':{title:'Read the surrounding context',short:'CONTEXT',topic:'toeic-part6-context'},
 'blank-function':{title:'Identify what each blank requires',short:'BLANK FUNCTION',topic:'toeic-part6-blank-function'},
 'elimination':{title:'Eliminate incorrect options',short:'ELIMINATION',topic:'toeic-part6-elimination'}
};
const meta=skillNames[skillKey];
const activityId='toeic-part6-skill-'+skillKey;
document.body.dataset.activityId=activityId;
let bank=[],questions=[],currentIndex=0,answers=[],draft=null,resumeDetail=null;
let startedAt=Date.now(),pendingSaves=[],trackerReady=!window.EnglishLabTracker?.ready,resumeFound=false;
const screens=['startScreen','quizScreen','resultScreen'].map($);
function screen(node){screens.forEach(s=>s.classList.remove('active'));node.classList.add('active');window.scrollTo({top:0,behavior:'smooth'});const h=node.querySelector('h1,h2');if(h)h.focus({preventScroll:true});}
function snapshot(){return {kind:'toeic-part6-skill',skill:skillKey,questions,answers,currentIndex,startedAt,draft};}
function saveState(){if(window.EnglishLabTracker&&questions.length)void window.EnglishLabTracker.saveState(snapshot());}
function applyResume(detail){
 const c=detail?.custom;if(!c||c.kind!=='toeic-part6-skill'||c.skill!==skillKey||!Array.isArray(c.questions)||c.questions.length!==10)return false;
 questions=c.questions;answers=Array.isArray(c.answers)?c.answers.slice():[];answers.length=10;currentIndex=Number(c.currentIndex)||0;startedAt=Number(c.startedAt)||Date.now();draft=c.draft||null;resumeFound=true;
 const rows=Array.isArray(detail.latestAnswers)?detail.latestAnswers:[];
 rows.forEach(row=>{const i=Number(row.question_index);const item=questions[i];if(!item||i<0||i>=10)return;answers[i]={question:item.prompt,selected:row.selected_answer,answer:item.answer,correct:Boolean(row.is_correct),explanation:item.explanation,topic:item.topic};});
 while(currentIndex<10&&answers[currentIndex])currentIndex++;
 $('startButton').textContent='Resume skill practice →';
 $('loadStatus').textContent='Your saved work was restored. Continue with question '+(currentIndex+1)+'.';
 return true;
}
function renderStart(){
 $('pageTitle').textContent=meta.title;$('pageShort').textContent=meta.short;
 $('questionCount').textContent=questions.length+' questions';$('loadStatus').textContent='Questions are ready.';
 $('startButton').disabled=false;
}
function renderQuestion(){
 const item=questions[currentIndex];draft=null;
 $('questionProgress').textContent='QUESTION '+(currentIndex+1)+' OF '+questions.length;
 $('progressFill').style.width=(currentIndex/questions.length*100)+'%';
 $('skillTag').textContent=meta.short;
 $('contextText').textContent=item.context;
 $('promptText').textContent=item.prompt;
 $('options').replaceChildren();
 item.options.forEach((option,i)=>{
  const label=document.createElement('label');label.className='skill-option';
  const input=document.createElement('input');input.type='radio';input.name='skillAnswer';input.value=option;
  input.addEventListener('change',()=>{draft=option;$('checkButton').disabled=false;saveState();});
  const key=document.createElement('span');key.className='skill-key';key.textContent=String.fromCharCode(65+i);
  const txt=document.createElement('span');txt.textContent=option;
  label.append(input,key,txt);$('options').append(label);
 });
 $('feedback').hidden=true;$('checkButton').hidden=false;$('checkButton').disabled=true;$('nextButton').hidden=true;
 $('checkButton').textContent='Check answer';
 saveState();
}
async function checkAnswer(){
 if(draft==null||answers[currentIndex])return;
 const item=questions[currentIndex],correct=draft===item.answer;
 answers[currentIndex]={question:item.prompt,selected:draft,answer:item.answer,correct,explanation:item.explanation,topic:item.topic};
 Array.from($('options').querySelectorAll('input')).forEach(input=>input.disabled=true);
 $('feedback').hidden=false;$('feedback').className='skill-feedback '+(correct?'is-correct':'is-incorrect');
 $('feedbackTitle').textContent=correct?'Correct':'Not quite';
 $('feedbackText').textContent=item.explanation;
 $('checkButton').hidden=true;$('nextButton').hidden=false;
 $('nextButton').textContent=currentIndex===9?'See results →':'Next question →';
 $('correctLive').textContent=answers.filter(a=>a&&a.correct).length+' correct';
 saveState();
 const payload={questionIndex:currentIndex,totalQuestions:10,questionText:item.prompt,topic:item.topic,selectedAnswer:draft,correctAnswer:item.answer,isCorrect:correct,timeToAnswerSeconds:0,errorDetail:correct?null:'Part 6 skill practice: '+item.explanation};
 const p=window.EnglishLabTracker?window.EnglishLabTracker.record(payload).then(ok=>{if(!ok)$('saveStatus').textContent='Your answer could not be confirmed as saved. Check your connection.';return ok;}):Promise.resolve(true);
 pendingSaves.push(p);
}
function results(){
 screen($('resultScreen'));
 const correct=answers.filter(a=>a&&a.correct).length,total=questions.length,pct=Math.round(correct/total*100);
 $('finalScore').textContent=correct+' / '+total;$('accuracy').textContent=pct+'%';$('correctCount').textContent=correct;$('incorrectCount').textContent=total-correct;
 $('scoreRing').style.setProperty('--score',(pct*3.6)+'deg');
 $('resultHeading').textContent=pct===100?'Excellent work!':pct>=80?'Strong progress!':'Keep building this skill.';
 $('resultMessage').textContent='Review the explanations below and identify the clue that helped or misled you.';
 $('reviewList').replaceChildren();
 answers.forEach((a,i)=>{const card=document.createElement('article');card.className='review-item';const h=document.createElement('b');h.textContent=(i+1)+'. '+questions[i].prompt;const yours=document.createElement('p');yours.textContent='Your answer: '+(a?.selected||'Not answered');const right=document.createElement('p');right.textContent='Best answer: '+questions[i].answer;const why=document.createElement('small');why.textContent=questions[i].explanation;card.append(h,yours,right,why);$('reviewList').append(card);});
 $('retryButton').disabled=true;
 $('saveResult').textContent='Saving your result to your student account…';
 Promise.allSettled(pendingSaves).then(arr=>{const ok=arr.every(x=>x.status==='fulfilled'&&x.value===true);$('saveResult').textContent=ok?'Your answers and score have been recorded in your student account.':'Your score is shown, but a save could not be confirmed. Keep this page open and check your connection.';$('retryButton').disabled=!ok;});
}
function next(){currentIndex++;if(currentIndex>=10){results();return;}renderQuestion();window.scrollTo({top:0,behavior:'smooth'});}
function restart(){questions=bank.filter(x=>x.topic===meta.topic);answers=[];currentIndex=0;draft=null;pendingSaves=[];startedAt=Date.now();screen($('quizScreen'));renderQuestion();}
async function initialize(){
 if(!meta){$('loadStatus').textContent='This skill link is not valid.';return;}
 try{
  const response=await fetch('../data/toeic-part6-skills.json',{cache:'no-store'});if(!response.ok)throw new Error('Question bank unavailable.');
  bank=await response.json();questions=bank[skillKey]||[];
  if(questions.length!==10)throw new Error('This skill must contain exactly 10 questions.');
  $('pageTitle').textContent=meta.title;$('pageShort').textContent=meta.short;$('questionCount').textContent='10 focused questions';
  $('startButton').disabled=false;$('loadStatus').textContent='Checking for saved progress…';
  if(window.EnglishLabTracker?.ready)await window.EnglishLabTracker.ready;
  const detail=window.EnglishLabTracker?.getResumeDetails?.();
  if(detail){if(!applyResume(detail)){$('loadStatus').textContent='An unfinished activity was found in this account. Return to it before starting another attempt.';$('startButton').disabled=true;}}
  trackerReady=true;$('loadStatus').textContent=resumeFound?'Your saved practice is ready to resume.':'Questions loaded. Your score will be recorded.';
 }catch(e){console.error(e);$('loadStatus').textContent='The questions could not be loaded. Refresh the page to try again.';}
}
$('startButton').addEventListener('click',async()=>{
 if(questions.length!==10)return;
 if(!answers.length&&!window.EnglishLabTracker?.getResumeDetails?.()){
  if(window.EnglishLabTracker){const id=await window.EnglishLabTracker.startNewSession(10);if(!id){$('loadStatus').textContent='An unfinished attempt is already saved. Resume it before starting again.';return;}}
  answers=[];currentIndex=0;pendingSaves=[];startedAt=Date.now();
 }
 if(currentIndex>=10){results();return;}
 screen($('quizScreen'));renderQuestion();
});
$('checkButton').addEventListener('click',checkAnswer);$('nextButton').addEventListener('click',next);
$('retryButton').addEventListener('click',async()=>{if(window.EnglishLabTracker){const id=await window.EnglishLabTracker.startNewSession(10);if(!id)return;}restart();});
$('reviewToggle').addEventListener('click',()=>{$('reviewList').hidden=!$('reviewList').hidden;$('reviewToggle').textContent=$('reviewList').hidden?'Show explanations':'Hide explanations';});
initialize();
})();