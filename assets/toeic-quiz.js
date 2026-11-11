(() => {
  'use strict';
  const dataNode = document.getElementById('questionData');
  const configNode = document.getElementById('quizConfig');
  if (!dataNode || !configNode) return;
  let questionBank, config;
  try { questionBank = JSON.parse(dataNode.textContent); config = JSON.parse(configNode.textContent); }
  catch (error) { console.error('Unable to load this practice.', error); return; }
  const byId = id => document.getElementById(id);
  const screens = ['startScreen','quizScreen','resultScreen'].map(byId);
  const optionsBox = byId('optionsBox');
  let questions = [], currentIndex = 0, score = 0, streak = 0, answers = [], answered = false;
  function shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i],copy[j]] = [copy[j],copy[i]]; }
    return copy;
  }
  function showScreen(screen) {
    screens.forEach(node => node.classList.remove('active'));
    screen.classList.add('active');
    const heading = screen.querySelector('h1,h2');
    if (heading) heading.focus({preventScroll:true});
  }
  function startGame() {
    questions = shuffle(questionBank).map(item => ({...item, shuffledOptions:shuffle(item.options)}));
    currentIndex = 0; score = 0; streak = 0; answers = []; answered = false;
    byId('scoreValue').textContent = '0'; byId('streakValue').textContent = '0';
    showScreen(byId('quizScreen')); renderQuestion();
  }
  function renderQuestion() {
    answered = false;
    const item = questions[currentIndex], progress = currentIndex / questions.length * 100;
    byId('sectionLabel').textContent = `QUESTION ${currentIndex + 1} OF ${questions.length}`;
    byId('percentLabel').textContent = `${Math.round(progress)}% complete`;
    byId('progressFill').style.width = `${progress}%`;
    byId('progressTrack').setAttribute('aria-valuenow', String(currentIndex));
    byId('topicLabel').textContent = item.topic;
    byId('questionText').textContent = item.q;
    optionsBox.replaceChildren();
    byId('feedbackBox').className = 'toeic-feedback';
    byId('feedbackTitle').textContent = ''; byId('feedbackText').textContent = '';
    byId('nextBtn').hidden = true;
    byId('nextBtn').textContent = currentIndex === questions.length - 1 ? 'See my results →' : 'Next question →';
    item.shuffledOptions.forEach((option,index) => {
      const button = document.createElement('button'); button.className = 'toeic-option'; button.type = 'button';
      const key = document.createElement('span'); key.className = 'toeic-key'; key.textContent = String(index + 1);
      const label = document.createElement('span'); label.textContent = option;
      button.append(key,label); button.addEventListener('click',() => chooseAnswer(option,button)); optionsBox.appendChild(button);
    });
    byId('hintText').textContent = 'Choose the best answer. Keyboard: press 1–4.';
  }
  function chooseAnswer(selected, selectedButton) {
    if (answered) return;
    answered = true;
    const item = questions[currentIndex], isCorrect = selected === item.answer;
    const buttons = Array.from(optionsBox.querySelectorAll('button'));
    buttons.forEach(button => {
      button.disabled = true;
      if (button.querySelector('span:last-child').textContent === item.answer) button.classList.add('correct');
    });
    if (isCorrect) {
      score++; streak++;
      byId('feedbackBox').className = 'toeic-feedback show good';
      byId('feedbackTitle').textContent = '✓ Correct!';
    } else {
      streak = 0;
      selectedButton.classList.add('incorrect');
      byId('feedbackBox').className = 'toeic-feedback show bad';
      byId('feedbackTitle').textContent = `Not quite. The correct answer is “${item.answer}.”`;
    }
    byId('feedbackText').innerHTML = item.why;
    answers.push({question:item.q,selected,answer:item.answer,correct:isCorrect,why:item.why,topic:item.topic});
    byId('scoreValue').textContent = String(score); byId('streakValue').textContent = String(streak);
    const done = (currentIndex + 1) / questions.length * 100;
    byId('progressFill').style.width = `${done}%`;
    byId('progressTrack').setAttribute('aria-valuenow',String(currentIndex + 1));
    byId('percentLabel').textContent = `${Math.round(done)}% complete`;
    byId('nextBtn').hidden = false;
    byId('hintText').textContent = isCorrect ? 'Nice work. Read the explanation, then continue.' : 'Review the explanation before moving on.';
    byId('nextBtn').focus({preventScroll:true});
  }
  function nextQuestion() {
    if (!answered) return;
    currentIndex++;
    if (currentIndex < questions.length) renderQuestion(); else window.finishGame();
  }
  function renderReview() {
    const missed = answers.filter(item => !item.correct), list = byId('reviewList');
    list.replaceChildren();
    if (!missed.length) {
      const note = document.createElement('p'); note.className = 'toeic-perfect'; note.textContent = 'No mistakes to review. Excellent work!'; list.appendChild(note); return;
    }
    missed.forEach((item,index) => {
      const card = document.createElement('div'); card.className = 'toeic-review-item';
      const q = document.createElement('b'); q.textContent = `${index + 1}. ${item.question}`;
      const yours = document.createElement('p'); yours.className = 'your-answer'; yours.textContent = `Your answer: ${item.selected}`;
      const right = document.createElement('p'); right.className = 'right-answer'; right.textContent = `Correct answer: ${item.answer}`;
      const why = document.createElement('p'); why.innerHTML = item.why;
      card.append(q,yours,right,why); list.appendChild(card);
    });
  }
  window.finishGame = function finishGame() {
    showScreen(byId('resultScreen'));
    const total = questions.length, incorrect = total - score, accuracy = Math.round(score / total * 100);
    byId('finalScore').textContent = `${score} / ${total}`;
    byId('correctTotal').textContent = String(score);
    byId('incorrectTotal').textContent = String(incorrect);
    byId('accuracyTotal').textContent = `${accuracy}%`;
    byId('scoreRing').style.setProperty('--score',`${accuracy * 3.6}deg`);
    const title = byId('resultTitle'), message = byId('resultMessage'), icon = byId('resultIcon');
    if (accuracy === 100) { title.textContent = 'Flawless work!'; title.className = 'toeic-perfect'; message.textContent = 'Every answer is correct. Your Part 5 skills are in excellent shape.'; icon.textContent = '🏆'; }
    else if (accuracy >= 80) { title.textContent = 'Excellent job!'; title.className = ''; message.textContent = 'You have a strong understanding. Review the questions you missed.'; icon.textContent = '🌟'; }
    else if (accuracy >= 60) { title.textContent = 'Good effort!'; title.className = ''; message.textContent = 'You are making progress. Read the explanations and try again.'; icon.textContent = '💪'; }
    else { title.textContent = 'Keep practicing!'; title.className = ''; message.textContent = 'Review the feedback, identify the patterns, and give it another try.'; icon.textContent = '🎯'; }
    byId('reviewBtn').hidden = incorrect === 0;
    byId('reviewBox').hidden = true;
    byId('reviewBtn').textContent = 'Review mistakes';
    renderReview();
  };
  byId('startBtn').addEventListener('click',startGame);
  byId('nextBtn').addEventListener('click',nextQuestion);
  byId('restartBtn').addEventListener('click',startGame);
  byId('reviewBtn').addEventListener('click',() => {
    const box = byId('reviewBox'); box.hidden = !box.hidden;
    byId('reviewBtn').textContent = box.hidden ? 'Review mistakes' : 'Hide review';
    if (!box.hidden) box.scrollIntoView({behavior:'smooth',block:'start'});
  });
  document.addEventListener('keydown',event => {
    if (!byId('quizScreen').classList.contains('active')) return;
    if (!answered && ['1','2','3','4'].includes(event.key)) {
      event.preventDefault(); const button = optionsBox.querySelectorAll('button')[Number(event.key) - 1]; if (button) button.click();
    } else if (answered && (event.key === 'Enter' || event.key === ' ') && event.target !== byId('nextBtn')) {
      event.preventDefault(); byId('nextBtn').click();
    }
  });
  document.title = `${config.title} · English Lab`;
  byId('startEyebrow').textContent = `${questionBank.length}-question practice`;
  byId('featureCount').textContent = `${questionBank.length} questions`;
  byId('sectionLabel').textContent = `QUESTION 1 OF ${questionBank.length}`;
  byId('progressTrack').setAttribute('aria-valuemax',String(questionBank.length));
  byId('finalScore').textContent = `0 / ${questionBank.length}`;
  byId('questionCountMeta').textContent = `${questionBank.length} questions`;
})();
