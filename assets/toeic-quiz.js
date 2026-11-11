(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const configs = {
    vocabulary: {title:'TOEIC Part 5: Vocabulary', accent:'Vocabulary', description:'Choose synonyms and antonyms for direct vocabulary items, including common business and workplace expressions.', activityId:'toeic-part5-vocabulary'},
    'grammar-tenses': {title:'TOEIC Part 5: Grammar Tenses', accent:'Grammar Tenses', description:'Complete business-context sentences using the correct tense, conditional, comparison, gerund or infinitive.', activityId:'toeic-part5-grammar-tenses'},
    conjunctions: {title:'TOEIC Part 5: Conjunctions', accent:'Conjunctions', description:'Choose coordinating, subordinating and correlative conjunctions in natural professional contexts.', activityId:'toeic-part5-conjunctions'},
    prepositions: {title:'TOEIC Part 5: Prepositions', accent:'Prepositions', description:'Identify the correct preposition, dependent preposition or business expression in each sentence.', activityId:'toeic-part5-prepositions'}
  };
  const setKey = new URLSearchParams(window.location.search).get('set');
  const config = configs[setKey];
  if (!config) {
    byId('loadStatus').textContent = 'This practice link is incomplete. Return to the TOEIC library and choose a practice.';
    byId('startBtn').disabled = true;
    return;
  }
  document.body.dataset.activityId = config.activityId;
  document.title = `${config.title} · English Lab`;
  byId('quizTitle').innerHTML = `${config.title} <span id="quizAccent">${config.accent}</span>`;
  byId('quizLead').textContent = config.description;

  const screens = ['startScreen','quizScreen','resultScreen'].map(byId);
  const optionsBox = byId('optionsBox');
  let questionBank = [], questions = [], currentIndex = 0, score = 0, streak = 0, answers = [], answered = false;
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
    if (!questionBank.length) return;
    questions = shuffle(questionBank).map(item => ({...item, shuffledOptions:shuffle(item.options)}));
    currentIndex = 0; score = 0; streak = 0; answers = []; answered = false;
    if (window.EnglishLabTracker) void window.EnglishLabTracker.startNewSession();
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
    if (window.EnglishLabTracker) {
      void window.EnglishLabTracker.record({
        questionIndex: currentIndex,
        totalQuestions: questions.length,
        questionText: item.q,
        topic: item.topic || config.accent,
        selectedAnswer: selected,
        correctAnswer: item.answer,
        isCorrect
      });
    }
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
  async function loadQuestions() {
    try {
      const response = await fetch(`../data/toeic-part5-${setKey}.json`, {cache:'no-store'});
      if (!response.ok) throw new Error(`Question bank unavailable (${response.status}).`);
      const raw = await response.json();
      if (!Array.isArray(raw) || !raw.length) throw new Error('The question bank is empty or invalid.');
      questionBank = raw.map((row,index) => {
        if (!Array.isArray(row) || row.length !== 7) throw new Error(`Question ${index + 1} has an invalid format.`);
        const [topic,q,answer,d1,d2,d3,why] = row;
        const options = [answer,d1,d2,d3];
        if (new Set(options).size !== 4 || !options.every(value => typeof value === 'string')) throw new Error(`Question ${index + 1} must have four distinct answer choices.`);
        return {topic,q,answer,options,why};
      });
      byId('startEyebrow').textContent = `${questionBank.length}-question practice`;
      byId('featureCount').textContent = `${questionBank.length} questions`;
      byId('sectionLabel').textContent = `QUESTION 1 OF ${questionBank.length}`;
      byId('progressTrack').setAttribute('aria-valuemax',String(questionBank.length));
      byId('finalScore').textContent = `0 / ${questionBank.length}`;
      byId('questionCountMeta').textContent = `${questionBank.length} questions · Your result can be saved to your student account.`;
      byId('loadStatus').textContent = `${questionBank.length} questions are ready. Start when you are set.`;
      byId('startBtn').disabled = false;
    } catch (error) {
      console.error(error);
      byId('loadStatus').textContent = 'This practice could not load. Refresh the page or return to the library.';
      byId('startBtn').disabled = true;
    }
  }
  byId('startBtn').disabled = true;
  loadQuestions();
})();