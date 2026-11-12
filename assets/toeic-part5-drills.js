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
  let timerId = null, deadline = 0, secondsLeft = 20, pendingSaves = [], questionStartedAt = 0;
  let resumeQuiz = null, startedAt = 0, saveFailed = false, locked = false;
  let bankReady = false;
  let pendingResumeDetail = null;
  let trackerReady = !window.EnglishLabTracker?.ready;
  function syncStartButton() {
    $('startBtn').disabled = !(bankReady && trackerReady);
  }

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
    questionStartedAt=Date.now();
    deadline=questionStartedAt+20000;
    paintTimer();
    timerId=setInterval(()=>{
      paintTimer();
      if(Date.now()>=deadline) {
        stopTimer();
        if(!answers[currentIndex]) recordAnswer('', 'Time expired');
        $('questionStatus').textContent='Time is up. Moving to the next question…';
        $('nextBtn').disabled=true;
        setTimeout(()=>{
          $('nextBtn').disabled=false;
          advanceQuestion();
        },220);
      }
    },100);
  }
  function recordAnswer(selected, reason) {
    if(answers[currentIndex]) return Promise.resolve(true);
    const item=questions[currentIndex];
    const correct=selected===item.answer;
    const elapsedSeconds=Math.max(0,Math.min(20,(Date.now()-questionStartedAt)/1000));
    const row={
      question:item.q,selected:selected||reason,answer:item.answer,correct,
      category:item.category,topic:item.topic,why:item.why,
      timeToAnswerSeconds:Math.round(elapsedSeconds*10)/10
    };
    answers[currentIndex]=row;
    locked=true;
    Array.from($('optionsBox').querySelectorAll('button')).forEach(button=>button.disabled=true);
    $('nextBtn').disabled=false;
    $('nextBtn').hidden=false;
    $('nextBtn').textContent=currentIndex===questions.length-1?'See results →':'Next question →';
    $('questionStatus').textContent=selected?'Answer selected. Press Next to continue, or use the remaining time.':reason+'.';
    $('scoreValue').textContent=String(answers.filter(a=>a&&a.correct).length);
    saveState();
    const payload={
      questionIndex:currentIndex,totalQuestions:questions.length,
      questionText:item.q,topic:item.topic,
      selectedAnswer:selected||reason,correctAnswer:item.answer,isCorrect:correct,
      timeToAnswerSeconds:row.timeToAnswerSeconds,
      errorType:reason==='Time expired'?'timed_out':reason==='Skipped'?'skipped':undefined,
      errorDetail:correct?null:(reason||('Part 5 '+item.category+' error'))
    };
    let savePromise;
    if(window.EnglishLabTracker) {
      savePromise=window.EnglishLabTracker.record(payload).then(ok=>{
        if(!ok){saveFailed=true;$('saveStatus').textContent='One answer could not be confirmed as saved. Keep this page open and check your connection.';}
        return ok;
      }).catch(()=>{
        saveFailed=true;$('saveStatus').textContent='An answer could not be saved. Keep this page open and check your connection.';
        return false;
      });
    } else {
      savePromise=Promise.resolve(true);
    }
    pendingSaves.push(savePromise);
    return savePromise;
  }
  function renderQuestion() {
    stopTimer();
    locked=false;
    const item=questions[currentIndex];
    $('sectionLabel').textContent='QUESTION '+(currentIndex+1)+' OF '+questions.length;
    $('percentLabel').textContent=Math.round(currentIndex/questions.length*100)+'% complete';
    $('progressFill').style.width=(currentIndex/questions.length*100)+'%';
    $('progressTrack').setAttribute('aria-valuemax',String(questions.length));
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
        recordAnswer(option,'');
        $('questionStatus').textContent='Answer selected. Press Next to move on early, or let the 20-second timer continue.';
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
  function advanceQuestion() {
    if(currentIndex>=questions.length)return;
    stopTimer();
    if(!answers[currentIndex]) recordAnswer('','Skipped');
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
      $('scoreValue').textContent=String(answers.filter(a=>a&&a.correct).length);
      resumeQuiz=null;
      while(currentIndex<questions.length && answers[currentIndex]) currentIndex++;
      if(currentIndex>=questions.length){finishDrill();return;}
      showScreen($('quizScreen'));
      renderQuestion();
      return;
    }
    const chosen=bank.filter(item=>item.drill===drillNumber);
    questions=shuffle(chosen).map(item=>({...item,shuffledOptions:shuffle(item.options)}));
    currentIndex=0;answers=[];pendingSaves=[];startedAt=Date.now();saveFailed=false;
    $('scoreValue').textContent='0';
    if(window.EnglishLabTracker) {
      const session=await window.EnglishLabTracker.startNewSession(questions.length);
      if(!session) {
        const savedDetail=window.EnglishLabTracker.getResumeDetails?.();
        if(savedDetail && applyDrillResume(savedDetail)) return startDrill();
        $('loadStatus').textContent='An unfinished drill already exists. Refresh this page to restore it; your saved answers have not been replaced.';
        showResumeStartScreen();
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
    const status=$('resultSaveStatus');
    const restart=$('restartBtn');
    restart.disabled=true;
    status.textContent='Saving your answers, skill results, and final score to your account…';
    Promise.allSettled(pendingSaves).then(results=>{
      const allSaved=results.every(result=>result.status==='fulfilled'&&result.value===true);
      const saveConfirmed=allSaved&&!saveFailed;
      if(saveConfirmed) {
        status.textContent='Your answers, response times, skill breakdown, and final score have been recorded in your student account.';
      } else {
        status.textContent='Your score is displayed, but at least one answer or the final summary could not be confirmed as saved. Keep this result open and check your connection before leaving.';
      }
      restart.disabled=!saveConfirmed;
    });
  }

  function showResumeStartScreen() {
    screens.forEach(node=>node.classList.remove('active'));
    $('startScreen').classList.add('active');
    $('startBtn').hidden=false;
    syncStartButton();
  }
  function applyDrillResume(detail) {
    if (!detail || !detail.session) return false;
    const saved=detail.custom;
    const rows=Array.isArray(detail.latestAnswers)?detail.latestAnswers:[];
    if(saved && saved.kind==='toeic-part5-drill' &&
       Number(saved.drill)===drillNumber &&
       Array.isArray(saved.questions) && saved.questions.length===30) {
      const restored=Array.isArray(saved.answers)?saved.answers.slice():[];
      restored.length=saved.questions.length;
      rows.forEach(row=>{
        // The tracker exposes latestAnswers with zero-based indexes.
        const index=Number(row.question_index);
        const item=saved.questions[index];
        if(!item || !Number.isInteger(index) || index<0 || index>=saved.questions.length)return;
        restored[index]={
          question:item.q,selected:row.selected_answer,answer:item.answer,
          correct:Boolean(row.is_correct),category:item.category,topic:item.topic,why:item.why,
          timeToAnswerSeconds:row.time_to_answer_seconds
        };
      });
      let next=0;
      while(next<saved.questions.length && restored[next])next++;
      resumeQuiz={...saved,answers:restored,currentIndex:next};
      showResumeStartScreen();
      $('startBtn').textContent='Resume drill →';
      $('loadStatus').textContent='Your saved answers were restored. Continue from question '+(next+1)+'.';
      return true;
    }

    // Legacy recovery: reconstruct the saved question order from the answer
    // history if the custom question snapshot is missing or from an older format.
    if(!bankReady) {
      pendingResumeDetail=detail;
      return false;
    }
    const chosen=bank.filter(item=>Number(item.drill)===drillNumber);
    const total=Number(detail.session.total_questions)||chosen.length;
    if(!chosen.length || total!==chosen.length)return false;
    const recoveredQuestions=new Array(total);
    const restoredAnswers=new Array(total);
    const used=new Set();
    const normalize=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
    let recoveredCount=0;
    rows.forEach(row=>{
      const index=Number(row.question_index);
      if(!Number.isInteger(index)||index<0||index>=total)return;
      const text=normalize(row.question_text);
      const bankIndex=chosen.findIndex((item,candidateIndex)=>
        !used.has(candidateIndex)&&normalize(item.q)===text);
      if(bankIndex<0)return;
      const item=chosen[bankIndex];
      recoveredQuestions[index]={...item,shuffledOptions:shuffle(item.options)};
      restoredAnswers[index]={
        question:item.q,selected:row.selected_answer,answer:item.answer,
        correct:Boolean(row.is_correct),category:item.category,topic:item.topic,why:item.why,
        timeToAnswerSeconds:row.time_to_answer_seconds
      };
      used.add(bankIndex);
      recoveredCount++;
    });
    if(rows.length && !recoveredCount)return false;
    const remaining=shuffle(chosen.filter((item,index)=>!used.has(index)))
      .map(item=>({...item,shuffledOptions:shuffle(item.options)}));
    for(let index=0;index<total;index++) {
      if(!recoveredQuestions[index])recoveredQuestions[index]=remaining.shift();
    }
    let next=0;
    while(next<total && restoredAnswers[next])next++;
    resumeQuiz={
      kind:'toeic-part5-drill',drill:drillNumber,questions:recoveredQuestions,
      answers:restoredAnswers,currentIndex:next,startedAt:Date.parse(detail.session.started_at)||Date.now()
    };
    showResumeStartScreen();
    $('startBtn').textContent='Resume drill →';
    $('loadStatus').textContent=recoveredCount
      ?'Your saved answers were recovered from your account. Continue from question '+(next+1)+'.'
      :'Your unfinished drill was found. Continue from question 1.';
    return true;
  }
  window.addEventListener('englishlab:resume',event=>{
    const detail=event.detail||{};
    if(!bankReady) {
      pendingResumeDetail=detail;
      return;
    }
    if(!applyDrillResume(detail)) {
      showResumeStartScreen();
      $('loadStatus').textContent='An unfinished drill was found, but its saved question format could not be matched. Your recorded answers remain in your account.';
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
      if(![1,2,3,4].includes(drillNumber))throw new Error('Invalid drill number.');
      const response=await fetch('../data/toeic-part5-drills.json',{cache:'no-store'});
      if(!response.ok)throw new Error('Question bank unavailable.');
      bank=await response.json();
      if(bank.length!==120)throw new Error('The question bank must contain exactly 120 questions.');
      const normalizeQuestion=value=>String(value||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
      for(const number of [1,2,3,4]){
        const set=bank.filter(item=>Number(item.drill)===number);
        if(set.length!==30)throw new Error('Drill '+number+' must contain exactly 30 questions.');
        if(new Set(set.map(item=>normalizeQuestion(item.q))).size!==30)
          throw new Error('Drill '+number+' contains a repeated sentence.');
      }
      if(bank.some(item=>!Array.isArray(item.options)||item.options.length!==4||new Set(item.options).size!==4||!item.options.includes(item.answer)))throw new Error('Each question must have one correct answer and four distinct options.');
      const overall=categoryOrder.map(category=>bank.filter(item=>item.category===category).length);
      if(JSON.stringify(overall)!==JSON.stringify([41,32,27,20]))throw new Error('The overall skill distribution is incorrect.');
      const chosen=bank.filter(item=>Number(item.drill)===drillNumber);
      if(chosen.length!==30)throw new Error('This drill does not contain exactly 30 questions.');
      const counts=categoryOrder.map(category=>chosen.filter(item=>item.category===category).length);
      const expected={1:[10,8,7,5],2:[10,8,7,5],3:[10,8,7,5],4:[11,8,6,5]}[drillNumber];
      if(JSON.stringify(counts)!==JSON.stringify(expected))throw new Error('This drill has an incorrect skill distribution.');
      $('startEyebrow').textContent='TOEIC READING · PART 5';
      $('quizTitle').textContent='Part 5 '+drillTitle;
      $('quizLead').textContent='30 TOEIC-style incomplete sentences. You have 20 seconds for each question.';
      $('featureCount').textContent='30 questions';
      bankReady=true;
      $('loadStatus').textContent='Questions loaded. Checking for an unfinished drill…';
      if(pendingResumeDetail) {
        const pending=pendingResumeDetail;
        pendingResumeDetail=null;
        applyDrillResume(pending);
      }
      if(window.EnglishLabTracker?.ready) await window.EnglishLabTracker.ready;
      const savedDetail=window.EnglishLabTracker?.getResumeDetails?.();
      if(savedDetail && !resumeQuiz) {
        if(!applyDrillResume(savedDetail)) {
          showResumeStartScreen();
          $('loadStatus').textContent='We found an unfinished drill, but could not match its saved questions. Your recorded answers are still in your account.';
        }
      }
      trackerReady=true;
      syncStartButton();
      $('drillHeading').textContent=drillTitle;
      document.title='TOEIC Part 5 '+drillTitle+' · English Lab';
      if(resumeQuiz) {
        // Rebuild the saved timed-drill question and fresh click handlers after
        // both the question bank and the tracking session have finished loading.
        $('loadStatus').textContent='Your unfinished drill has been restored. Loading your next question…';
        await startDrill();
        return;
      }
      if(!savedDetail) $('loadStatus').textContent='30 questions are ready. Each question has a 20-second limit.';
    } catch(error) {
      console.error(error);
      $('loadStatus').textContent='This drill could not load. Return to the Part 5 page and try again.';
    }
  }
  loadBank();
})();