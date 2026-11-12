(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const drillNumber = Number(params.get('drill')) || 1;
  const drillTitle = 'Drill ' + drillNumber;
  const activityId = 'toeic-part5-drill-' + drillNumber;
  document.body.dataset.activityId = activityId;

  const screens = ['startScreen','quizScreen','resultScreen'].map($);
  const categoryOrder = ['Grammar','Word forms','Vocabulary','Connectors'];
  let bank = [], questions = [], currentIndex = 0, answers = [];
  let timerId = null, deadline = 0, secondsLeft = 20, pendingSave = Promise.resolve(true);
  let resumeQuiz = null, startedAt = 0, saveFailed = false, locked = false;

  function shuffle(list) {
    const copy = list.slice();
    for (let i=copy.length-1;i>0;i--) {
      const j=Math.floor(Math.random()*(i+1));
      [copy[i],copy[j]]=[copy[j],copy[i]];
    }
    return copy;
  }
  function showScreen(screen) {
    screens.forEach(node=>node.classList.remove('active'));
    screen.classList.add('active');
    const heading=screen.querySelector('h1,h2');
    if(heading) heading.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function saveState() {
    if(window.EnglishLabTracker && questions.length) {
      void window.EnglishLabTracker.saveState({
        kind:'toeic-part5-drill',drill:drillNumber,questions,currentIndex,answers,startedAt
      });
    }
  }
  function stopTimer() {
    if(timerId) clearInterval(timerId);
    timerId=null;
  }
  function paintTimer() {
    const remaining=Math.max(0,(deadline-Date.now())/1000);
    secondsLeft=remaining;
    $('timerValue').textContent=String(Math.ceil(remaining));
    $('timerFill').style.width=(remaining/20*100)+'%';
    $('timerTrack').setAttribute('aria-valuenow',String(Math.ceil(remaining)));
    $('timerTrack').classList.toggle('urgent',remaining<=5);
  }
  function startTimer() {
    stopTimer();
    deadline=Date.now()+20000;
    paintTimer();
    timerId=setInterval(()=>{
      paintTimer();
      if(Date.now()>=deadline) {
        stopTimer();
        if(!answers[currentIndex]) {
          $('questionStatus').textContent='Time is up. Moving to the next question…';
          $('nextBtn').disabled=true;
          pendingSave=recordAnswer('', 'Time expired');
          pendingSave.finally(()=>setTimeout(advanceQuestion,450));
        }
      }
    },100);
  }
  function recordAnswer(selected, reason) {
    const item=questions[currentIndex];
    const correct=selected===item.answer;
    const row={
      question:item.q,selected:selected||reason,answer:item.answer,correct,
      category:item.category,topic:item.topic,why:item.why
    };
    answers[currentIndex]=row;
    locked=true;
    Array.from($('optionsBox').querySelectorAll('button')).forEach(button=>button.disabled=true);
    $('nextBtn').disabled=false;
    $('nextBtn').hidden=false;
    $('nextBtn').textContent=currentIndex===questions.length-1?'See results →':'Next question →';
    $('questionStatus').textContent=selected?'Answer selected. Continue when you are ready.':reason+'.';
    $('scoreValue').textContent=String(answers.filter(a=>a&&a.correct).length);
    saveState();
    if(window.EnglishLabTracker) {
      return window.EnglishLabTracker.record({
        questionIndex:currentIndex,totalQuestions:questions.length,
        questionText:item.q,topic:item.topic,subtopic:item.category.toLowerCase().replace(/\s+/g,'-'),
        selectedAnswer:selected||reason,correctAnswer:item.answer,isCorrect:correct,
        errorDetail:correct?null:(selected?'Part 5 '+item.category+' error':'Part 5 '+item.category+' — '+reason)
      }).then(ok=>{
        if(!ok){saveFailed=true;$('saveStatus').textContent='One answer could not be confirmed as saved. Keep this page open and check your connection.';}
        return ok;
      }).catch(()=>{
        saveFailed=true;$('saveStatus').textContent='An answer could not be saved. Keep this page open and check your connection.';
        return false;
      });
    }
    return Promise.resolve(true);
  }
  function renderQuestion() {
    stopTimer();
    locked=false;
    const item=questions[currentIndex];
    $('sectionLabel').textContent='QUESTION '+(currentIndex+1)+' OF '+questions.length;
    $('percentLabel').textContent=Math.round(currentIndex/questions.length*100)+'% complete';
    $('progressFill').style.width=(currentIndex/questions.length*100)+'%';
    $('progressTrack').setAttribute('aria-valuenow',String(currentIndex));
    $('topicLabel').textContent=item.category.toUpperCase();
    $('questionText').textContent=item.q;
    $('optionsBox').replaceChildren();
    item.shuffledOptions.forEach((option,index)=>{
      const button=document.createElement('button');
      button.type='button';button.className='toeic-option';
      const key=document.createElement('span');key.className='toeic-key';key.textContent=String.fromCharCode(65+index);
      const label=document.createElement('span');label.textContent=option;
      button.append(key,label);
      button.addEventListener('click',()=>{
        if(locked)return;
        stopTimer();
        pendingSave=recordAnswer(option,'');
        $('questionStatus').textContent='Answer selected. You can continue now.';
        $('nextBtn').hidden=false;
        $('nextBtn').disabled=false;
      });
      $('optionsBox').appendChild(button);
    });
    $('nextBtn').hidden=false;
    $('nextBtn').disabled=false;
    $('nextBtn').textContent='Next question →';
    $('questionStatus').textContent='Choose the best answer before the timer reaches zero.';
    $('saveStatus').textContent='Your answers are being recorded in your student account.';
    const done=currentIndex/questions.length*100;
    $('percentLabel').textContent=Math.round(done)+'% complete';
    saveState();
    startTimer();
  }
  async function advanceQuestion() {
    if(currentIndex>=questions.length)return;
    stopTimer();
    if(!answers[currentIndex]) {
      $('nextBtn').disabled=true;
      pendingSave=recordAnswer('','Skipped');
    }
    await pendingSave;
    currentIndex++;
    if(currentIndex>=questions.length) {
      finishDrill();
      return;
    }
    renderQuestion();
  }
  async function startDrill() {
    stopTimer();
    if(resumeQuiz) {
      questions=resumeQuiz.questions;
      currentIndex=Number(resumeQuiz.currentIndex)||0;
      answers=Array.isArray(resumeQuiz.answers)?resumeQuiz.answers:[];
      startedAt=Number(resumeQuiz.startedAt)||Date.now();
      resumeQuiz=null;
      while(currentIndex<questions.length && answers[currentIndex]) currentIndex++;
      if(currentIndex>=questions.length){finishDrill();return;}
      showScreen($('quizScreen'));
      renderQuestion();
      return;
    }
    const chosen=bank.filter(item=>item.drill===drillNumber);
    questions=shuffle(chosen).map(item=>({...item,shuffledOptions:shuffle(item.options)}));
    currentIndex=0;answers=[];startedAt=Date.now();saveFailed=false;
    if(window.EnglishLabTracker) {
      const session=await window.EnglishLabTracker.startNewSession(questions.length);
      if(!session) {
        $('loadStatus').textContent='We could not start account tracking. Refresh the page and sign in again.';
        return;
      }
    }
    showScreen($('quizScreen'));
    renderQuestion();
    saveState();
  }
  function renderResults() {
    const correct=answers.filter(a=>a&&a.correct).length;
    const total=questions.length,accuracy=Math.round(correct/total*100);
    $('finalScore').textContent=correct+' / '+total;
    $('correctTotal').textContent=String(correct);
    $('incorrectTotal').textContent=String(total-correct);
    $('accuracyTotal').textContent=accuracy+'%';
    $('scoreRing').style.setProperty('--score',(accuracy*3.6)+'deg');
    let title='Keep practicing!',message='Use your skill breakdown to decide what to review next.',icon='🎯';
    if(accuracy===100){title='Perfect score!';message='You answered every question correctly. Excellent timing and accuracy.';icon='🏆';}
    else if(accuracy>=80){title='Excellent work!';message='You showed strong control of Part 5 sentence completion.';icon='🌟';}
    else if(accuracy>=60){title='Good progress!';message='Review the categories below and focus on the areas that need more practice.';icon='💪';}
    $('resultTitle').textContent=title;$('resultMessage').textContent=message;$('resultIcon').textContent=icon;
    const stats={};
    categoryOrder.forEach(category=>stats[category]={total:0,correct:0});
    answers.forEach(a=>{if(!a)return;stats[a.category].total++;if(a.correct)stats[a.category].correct++;});
    const root=$('skillResults');root.replaceChildren();
    categoryOrder.forEach(category=>{
      const data=stats[category],pct=data.total?Math.round(data.correct/data.total*100):0;
      const row=document.createElement('article');row.className='drill-skill';
      const top=document.createElement('div');top.className='drill-skill-top';
      const name=document.createElement('b');name.textContent=category;
      const score=document.createElement('span');score.textContent=data.correct+' / '+data.total+' · '+pct+'%';
      top.append(name,score);
      const track=document.createElement('div');track.className='drill-skill-track';
      const fill=document.createElement('span');fill.style.width=pct+'%';track.append(fill);
      row.append(top,track);root.append(row);
    });
    const review=$('reviewList');review.replaceChildren();
    const missed=answers.map((a,index)=>({...a,index})).filter(a=>!a.correct);
    if(!missed.length){const p=document.createElement('p');p.textContent='No missed questions. Excellent work!';review.append(p);}
    missed.forEach(item=>{
      const card=document.createElement('article');card.className='drill-review-item';
      const q=document.createElement('b');q.textContent=(item.index+1)+'. '+item.question;
      const yours=document.createElement('p');yours.textContent='Your answer: '+item.selected;
      const right=document.createElement('p');right.textContent='Correct answer: '+item.answer;
      const why=document.createElement('p');why.textContent=item.why;
      const skill=document.createElement('small');skill.textContent=item.category+' · '+item.topic;
      card.append(q,yours,right,why,skill);review.append(card);
    });
    $('reviewBtn').hidden=!missed.length;
    $('resultSaveStatus').textContent=saveFailed
      ?'Your score is shown, but at least one answer may not have been saved. Check your connection before leaving.'
      :'Your answers and final score have been sent to your student account.';
  }
  function finishDrill() {
    stopTimer();
    showScreen($('resultScreen'));
    renderResults();
  }

  window.addEventListener('englishlab:resume',event=>{
    const saved=event.detail.custom;
    if(saved&&saved.kind==='toeic-part5-drill'&&Number(saved.drill)===drillNumber&&Array.isArray(saved.questions)&&saved.questions.length) {
      resumeQuiz=saved;
      $('startBtn').textContent='Resume drill →';
      $('loadStatus').textContent='An unfinished drill was found. Resume to continue where you left off.';
    }
  });
  $('startBtn').addEventListener('click',startDrill);
  $('nextBtn').addEventListener('click',advanceQuestion);
  $('restartBtn').addEventListener('click',()=>{
    resumeQuiz=null;
    if(window.EnglishLabTracker) {
      $('loadStatus').textContent='Starting a new attempt…';
      startDrill();
    } else startDrill();
  });
  $('reviewBtn').addEventListener('click',()=>{
    const box=$('reviewBox');box.hidden=!box.hidden;
    $('reviewBtn').textContent=box.hidden?'Review mistakes':'Hide review';
    if(!box.hidden)box.scrollIntoView({behavior:'smooth',block:'start'});
  });
  document.addEventListener('keydown',event=>{
    if(!$('quizScreen').classList.contains('active'))return;
    if(!locked&&['1','2','3','4'].includes(event.key)) {
      const button=$('optionsBox').querySelectorAll('button')[Number(event.key)-1];
      if(button)button.click();
    } else if(event.key==='Enter'&& !$('nextBtn').hidden && !$('nextBtn').disabled) {
      event.preventDefault();$('nextBtn').click();
    }
  });

  async function loadBank() {
    try {
      if(![1,2,3].includes(drillNumber))throw new Error('Invalid drill number.');
      const response=await fetch('../data/toeic-part5-drills.json',{cache:'no-store'});
      if(!response.ok)throw new Error('Question bank unavailable.');
      bank=await response.json();
      const chosen=bank.filter(item=>item.drill===drillNumber);
      if(chosen.length!==10)throw new Error('This drill does not contain exactly 10 questions.');
      const counts=categoryOrder.map(category=>chosen.filter(item=>item.category===category).length);
      if(counts.reduce((a,b)=>a+b,0)!==10)throw new Error('Invalid question distribution.');
      $('startEyebrow').textContent='TOEIC READING · PART 5';
      $('quizTitle').textContent='Part 5 '+drillTitle;
      $('quizLead').textContent='10 TOEIC-style incomplete sentences. You have 20 seconds for each question.';
      $('featureCount').textContent='10 questions';
      $('loadStatus').textContent='Your drill is ready. Each question has a 20-second limit.';
      $('startBtn').disabled=false;
      $('drillHeading').textContent=drillTitle;
      document.title='TOEIC Part 5 '+drillTitle+' · English Lab';
    } catch(error) {
      console.error(error);
      $('loadStatus').textContent='This drill could not load. Return to the Part 5 page and try again.';
    }
  }
  loadBank();
})();