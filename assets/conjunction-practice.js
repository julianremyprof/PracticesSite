(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const setKey = document.body.dataset.practiceSet;
  const configs = {
    "and-but-or-because": {
      title:"Conjunctions: AND, BUT, OR & BECAUSE",
      description:"Build clear connections between ideas using addition, contrast, choice and reason.",
      accent:"AND · BUT · OR · BECAUSE"
    },
    "fanboys-foundations": {
      title:"FANBOYS: All Seven Coordinating Conjunctions",
      description:"Practise for, and, nor, but, or, yet and so through clear, everyday situations.",
      accent:"FOR · AND · NOR · BUT · OR · YET · SO"
    },
    "fanboys-clauses": {
      title:"FANBOYS: Joining Clauses & Punctuation",
      description:"Choose the right connector and notice when a comma is needed between independent clauses.",
      accent:"CLAUSES & PUNCTUATION"
    },
    "fanboys-context": {
      title:"FANBOYS: Meaning in Academic & Workplace Contexts",
      description:"Choose the conjunction that best expresses the precise relationship between ideas.",
      accent:"MEANING IN CONTEXT"
    }
  };
  const config = configs[setKey];
  const screens = ["startScreen","quizScreen","resultScreen"].map(byId);
  const startButton = byId("startBtn");
  const optionsBox = byId("optionsBox");
  const tracker = window.EnglishLabTracker;
  let questionBank = [];
  let questions = [];
  let currentIndex = 0;
  let score = 0;
  let streak = 0;
  let answers = [];
  let answered = false;
  let resumeQuiz = null;
  let pendingResumeDetail = null;
  let questionBankReady = false;
  let trackerReady = false;
  let latestSaveOkay = true;

  function showScreen(screen) {
    screens.forEach(node => node.classList.remove("active"));
    screen.classList.add("active");
    const heading = screen.querySelector("h1,h2");
    if (heading) heading.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function setStatus(message, isError) {
    const load = byId("loadStatus");
    const save = byId("saveStatus");
    if (load) { load.textContent = message; load.style.color = isError ? "#b42318" : ""; }
    if (save) { save.textContent = message; save.style.color = isError ? "#b42318" : ""; }
  }
  function syncStartButton() {
    startButton.disabled = !(questionBankReady && trackerReady && config);
  }
  function normalize(value) {
    return String(value == null ? "" : value).trim().toLowerCase().replace(/\s+/g," ");
  }
  function cloneQuestions(items) {
    return items.map(item => ({...item,options:item.options.slice()}));
  }
  function currentNextIndex(restored) {
    let next = 0;
    while (next < restored.length && restored[next] && restored[next].recorded !== false) next++;
    return next;
  }
  function scoreFromAnswers(restored) {
    return restored.filter(item => item && item.recorded !== false && item.correct).length;
  }
  function streakFromAnswers(restored, next) {
    let value = 0;
    for (let i = next - 1; i >= 0 && restored[i] && restored[i].recorded !== false; i--) {
      if (!restored[i].correct) break;
      value++;
    }
    return value;
  }
  function applyResumeDetail(detail) {
    const saved = detail && detail.custom;
    if (saved && saved.kind === "conjunctions-practice" &&
        Array.isArray(saved.questions) && saved.questions.length === questionBank.length) {
      const restored = Array.isArray(saved.answers) ? saved.answers.slice() : [];
      (detail.latestAnswers || []).forEach(row => {
        const index = Number(row.question_index);
        const item = saved.questions[index];
        if (!item || !Number.isInteger(index) || index < 0 || index >= saved.questions.length) return;
        restored[index] = {
          question:item.q,
          selected:row.selected_answer,
          answer:item.answer,
          correct:Boolean(row.is_correct),
          why:item.why,
          topic:item.topic,
          recorded:true
        };
      });
      const next = currentNextIndex(restored);
      resumeQuiz = {
        kind:"conjunctions-practice",
        questions:cloneQuestions(saved.questions),
        answers:restored,
        currentIndex:next,
        score:scoreFromAnswers(restored),
        streak:streakFromAnswers(restored,next),
        answered:false
      };
      byId("startBtn").textContent = "Resume practice →";
      byId("loadStatus").textContent = next < questionBank.length
        ? "Your saved answers were restored. Continue from question " + (next + 1) + "."
        : "All 30 answers were restored. Open your results.";
      return true;
    }

    // Recovery for an older or incomplete snapshot: this bank is fixed-order,
    // so a saved question index always refers to the same question after refresh.
    const total = Number(detail && detail.session && detail.session.total_questions) || questionBank.length;
    if (!questionBankReady || total !== questionBank.length) return false;
    const recoveredQuestions = cloneQuestions(questionBank);
    const restored = [];
    let allRowsMatched = true;
    (detail.latestAnswers || []).forEach(row => {
      const index = Number(row.question_index);
      if (!Number.isInteger(index) || index < 0 || index >= total) {
        allRowsMatched = false;
        return;
      }
      const item = recoveredQuestions[index];
      if (normalize(item.q) !== normalize(row.question_text)) {
        allRowsMatched = false;
        return;
      }
      restored[index] = {
        question:item.q,
        selected:row.selected_answer,
        answer:item.answer,
        correct:Boolean(row.is_correct),
        why:item.why,
        topic:item.topic,
        recorded:true
      };
    });
    if (!allRowsMatched) return false;
    const next = currentNextIndex(restored);
    resumeQuiz = {
      kind:"conjunctions-practice",
      questions:recoveredQuestions,
      answers:restored,
      currentIndex:next,
      score:scoreFromAnswers(restored),
      streak:streakFromAnswers(restored,next),
      answered:false
    };
    byId("startBtn").textContent = "Resume practice →";
    byId("loadStatus").textContent = restored.filter(Boolean).length
      ? "Your saved answers were recovered. Continue from question " + (next + 1) + "."
      : "An unfinished attempt was found. Continue from question 1.";
    return true;
  }

  window.addEventListener("englishlab:resume", event => {
    if (!questionBankReady) {
      pendingResumeDetail = event.detail;
      return;
    }
    if (!applyResumeDetail(event.detail || {})) {
      byId("startBtn").disabled = true;
      byId("loadStatus").textContent =
        "An unfinished attempt was found, but its saved questions could not be matched. Your recorded answers remain in your account; please contact your teacher before restarting.";
    }
  });

  async function saveQuizState() {
    if (!tracker || !questions.length) return false;
    const okay = await tracker.saveState({
      kind:"conjunctions-practice",
      setKey,
      questions,
      currentIndex,
      score,
      streak,
      answers,
      answered
    });
    latestSaveOkay = Boolean(okay);
    return latestSaveOkay;
  }

  function restoreDisplayProgress() {
    byId("scoreValue").textContent = String(score);
    byId("streakValue").textContent = String(streak);
  }

  function renderQuestion() {
    answered = false;
    const item = questions[currentIndex];
    if (!item) {
      finishGame();
      return;
    }
    const progress = currentIndex / questions.length * 100;
    byId("sectionLabel").textContent = "QUESTION " + (currentIndex + 1) + " OF " + questions.length;
    byId("percentLabel").textContent = Math.round(progress) + "% complete";
    byId("progressFill").style.width = progress + "%";
    byId("progressTrack").setAttribute("aria-valuenow",String(currentIndex));
    byId("topicLabel").textContent = item.topic;
    byId("questionText").textContent = item.q;
    optionsBox.replaceChildren();
    item.options.forEach((option,index) => {
      const button = document.createElement("button");
      button.className = "toeic-option";
      button.type = "button";
      const key = document.createElement("span");
      key.className = "toeic-key";
      key.textContent = String(index + 1);
      const label = document.createElement("span");
      label.textContent = option;
      button.append(key,label);
      button.addEventListener("click",() => chooseAnswer(option,button));
      optionsBox.appendChild(button);
    });
    byId("feedbackBox").className = "toeic-feedback";
    byId("feedbackTitle").textContent = "";
    byId("feedbackText").textContent = "";
    byId("nextBtn").hidden = true;
    byId("nextBtn").disabled = false;
    byId("nextBtn").textContent = currentIndex === questions.length - 1 ? "Finish practice →" : "Next question →";
    byId("hintText").textContent = "Choose the best conjunction. Keyboard: press 1–4.";
    byId("saveStatus").textContent = "Your checked answers are saved to your student account.";
    restoreDisplayProgress();
    void saveQuizState();
  }

  function markAnswer(selected, selectedButton, item, isCorrect) {
    const buttons = Array.from(optionsBox.querySelectorAll("button"));
    buttons.forEach(button => {
      button.disabled = true;
      const label = button.querySelector("span:last-child");
      if (label && label.textContent === item.answer) button.classList.add("correct");
    });
    if (!isCorrect) {
      selectedButton.classList.add("incorrect");
      byId("feedbackBox").className = "toeic-feedback show bad";
      byId("feedbackTitle").textContent = "Not quite. The best answer is “" + item.answer + ".”";
      byId("hintText").textContent = "Review the explanation before moving on.";
    } else {
      byId("feedbackBox").className = "toeic-feedback show good";
      byId("feedbackTitle").textContent = "✓ Correct!";
      byId("hintText").textContent = "Good work. Read the explanation, then continue.";
    }
    byId("feedbackText").textContent = item.why;
    byId("scoreValue").textContent = String(score);
    byId("streakValue").textContent = String(streak);
  }

  async function saveCurrentAnswer() {
    const item = questions[currentIndex];
    const savedAnswer = answers[currentIndex];
    if (!item || !savedAnswer || savedAnswer.recorded) return Boolean(savedAnswer && savedAnswer.recorded);
    byId("nextBtn").disabled = true;
    byId("nextBtn").textContent = "Saving answer…";
    byId("saveStatus").textContent = "Saving this answer to your student account…";
    const okay = await tracker.record({
      questionIndex:currentIndex,
      totalQuestions:questions.length,
      questionText:item.q,
      topic:"conjunctions/" + String(item.topic || "general").toLowerCase().replace(/\s+/g,"-"),
      selectedAnswer:savedAnswer.selected,
      correctAnswer:item.answer,
      isCorrect:savedAnswer.correct
    });
    if (!okay) {
      byId("nextBtn").disabled = false;
      byId("nextBtn").textContent = "Retry saving answer →";
      byId("saveStatus").textContent = "This answer has not been confirmed as saved. Check your connection and choose Retry saving answer.";
      byId("saveStatus").style.color = "#b42318";
      return false;
    }
    savedAnswer.recorded = true;
    await saveQuizState();
    byId("saveStatus").style.color = "";
    byId("saveStatus").textContent = "Answer saved · Your progress is linked to your student account.";
    byId("nextBtn").disabled = false;
    byId("nextBtn").textContent = currentIndex === questions.length - 1 ? "Finish practice →" : "Next question →";
    if (currentIndex === questions.length - 1) finishGame();
    return true;
  }

  async function chooseAnswer(selected, selectedButton) {
    if (answered) return;
    answered = true;
    const item = questions[currentIndex];
    const isCorrect = selected === item.answer;
    if (isCorrect) {
      score++;
      streak++;
    } else {
      streak = 0;
    }
    answers[currentIndex] = {
      question:item.q,
      selected,
      answer:item.answer,
      correct:isCorrect,
      why:item.why,
      topic:item.topic,
      recorded:false
    };
    markAnswer(selected,selectedButton,item,isCorrect);
    byId("nextBtn").hidden = false;
    byId("nextBtn").disabled = true;
    byId("nextBtn").textContent = "Saving answer…";
    await saveQuizState();
    await saveCurrentAnswer();
  }

  async function nextQuestion() {
    if (!answered) return;
    if (answers[currentIndex] && !answers[currentIndex].recorded) {
      await saveCurrentAnswer();
      return;
    }
    currentIndex++;
    if (currentIndex >= questions.length) {
      finishGame();
      return;
    }
    renderQuestion();
  }

  function renderReview() {
    const list = byId("reviewList");
    list.replaceChildren();
    const missed = answers.map((answer,index) => ({...answer,index})).filter(item => item && !item.correct);
    if (!missed.length) {
      const note = document.createElement("p");
      note.className = "toeic-perfect";
      note.textContent = "No mistakes to review. Excellent work!";
      list.appendChild(note);
      return;
    }
    missed.forEach((item,index) => {
      const card = document.createElement("article");
      card.className = "toeic-review-item";
      const question = document.createElement("b");
      question.textContent = (index + 1) + ". " + item.question;
      const response = document.createElement("p");
      response.textContent = "Your answer: " + item.selected;
      const correct = document.createElement("p");
      correct.textContent = "Best answer: " + item.answer;
      const explanation = document.createElement("p");
      explanation.textContent = item.why;
      card.append(question,response,correct,explanation);
      list.appendChild(card);
    });
  }

  function renderSkillBreakdown() {
    const root = byId("skillResults");
    root.replaceChildren();
    const stats = new Map();
    answers.forEach(answer => {
      if (!answer) return;
      const key = answer.topic || "General";
      if (!stats.has(key)) stats.set(key,{total:0,correct:0});
      const row = stats.get(key);
      row.total++;
      if (answer.correct) row.correct++;
    });
    Array.from(stats.entries()).forEach(([name,data]) => {
      const pct = Math.round(data.correct / data.total * 100);
      const row = document.createElement("article");
      row.className = "toeic-review-item";
      const title = document.createElement("b");
      title.textContent = name;
      const scoreLine = document.createElement("p");
      scoreLine.textContent = data.correct + " / " + data.total + " correct · " + pct + "%";
      const bar = document.createElement("div");
      bar.className = "toeic-progress-track";
      const fill = document.createElement("div");
      fill.className = "toeic-progress-fill";
      fill.style.width = pct + "%";
      bar.appendChild(fill);
      row.append(title,scoreLine,bar);
      root.appendChild(row);
    });
  }

  function finishGame() {
    showScreen(byId("resultScreen"));
    const total = questions.length;
    const incorrect = total - score;
    const accuracy = Math.round(score / total * 100);
    byId("finalScore").textContent = score + " / " + total;
    byId("correctTotal").textContent = String(score);
    byId("incorrectTotal").textContent = String(incorrect);
    byId("accuracyTotal").textContent = accuracy + "%";
    byId("scoreRing").style.setProperty("--score",(accuracy * 3.6) + "deg");
    let title = "Keep building your skills.";
    let message = "Review the explanations, identify the conjunctions you need to reinforce and try again.";
    let icon = "🎯";
    if (accuracy === 100) {
      title = "Flawless work!";
      message = "You selected the best conjunction in every context.";
      icon = "🏆";
    } else if (accuracy >= 85) {
      title = "Excellent work!";
      message = "You show strong control of the relationships between ideas.";
      icon = "🌟";
    } else if (accuracy >= 70) {
      title = "Good progress!";
      message = "You are developing your sentence-connection skills. Use the topic report to choose what to review.";
      icon = "💪";
    }
    byId("resultTitle").textContent = title;
    byId("resultMessage").textContent = message;
    byId("resultIcon").textContent = icon;
    renderSkillBreakdown();
    renderReview();
    byId("reviewBox").hidden = false;
    byId("reviewBtn").textContent = "Hide answer review";
    byId("resultSaveStatus").textContent = answers.every(item => item && item.recorded)
      ? "All 30 answers and your final score have been recorded in your student account."
      : "Your answers are saved locally on this page, but one or more account saves could not be confirmed.";
    if (tracker) void tracker.saveState({
      kind:"conjunctions-practice",
      setKey,
      completed:true,
      questions,
      currentIndex,
      score,
      answers
    });
  }

  async function startGame() {
    if (resumeQuiz) {
      questions = cloneQuestions(resumeQuiz.questions);
      currentIndex = Number(resumeQuiz.currentIndex) || 0;
      answers = Array.isArray(resumeQuiz.answers) ? resumeQuiz.answers.slice() : [];
      score = Number(resumeQuiz.score) || 0;
      streak = Number(resumeQuiz.streak) || 0;
      resumeQuiz = null;
      restoreDisplayProgress();
      if (currentIndex >= questions.length) {
        finishGame();
        return;
      }
      showScreen(byId("quizScreen"));
      answered = false;
      renderQuestion();
      return;
    }
    questions = cloneQuestions(questionBank);
    currentIndex = 0;
    score = 0;
    streak = 0;
    answers = [];
    answered = false;
    const created = await tracker.startNewSession(questions.length);
    if (!created) {
      const detail = tracker.getResumeDetails && tracker.getResumeDetails();
      if (detail && applyResumeDetail(detail)) {
        setStatus("An unfinished attempt was found. Resume it to keep your saved answers.",false);
        return;
      }
      setStatus("A previous attempt is still open or account tracking is unavailable. Refresh to restore it; your saved answers have not been replaced.",true);
      startButton.textContent = "Resume practice →";
      syncStartButton();
      return;
    }
    restoreDisplayProgress();
    await saveQuizState();
    showScreen(byId("quizScreen"));
    renderQuestion();
  }

  async function loadQuestions() {
    if (!config) {
      byId("loadStatus").textContent = "This practice link is incomplete. Return to the practice library and choose a set.";
      startButton.disabled = true;
      return;
    }
    document.title = config.title + " · RaisingDiamonds";
    byId("quizTitle").textContent = config.title;
    byId("quizLead").textContent = config.description;
    byId("startEyebrow").textContent = "30-question conjunction practice";
    byId("featureCount").textContent = "30 questions";
    byId("questionCountMeta").textContent = "30 questions · Your progress is saved to your student account.";
    byId("quizAccent").textContent = config.accent;
    try {
      const response = await fetch("../data/conjunction-practices.json",{cache:"no-store"});
      if (!response.ok) throw new Error("Question bank unavailable (" + response.status + ").");
      const bankData = await response.json();
      const bank = bankData[setKey];
      if (!bank || !Array.isArray(bank.questions) || bank.questions.length !== 30) {
        throw new Error("This question set is incomplete.");
      }
      questionBank = bank.questions.map((row,index) => {
        if (!Array.isArray(row) || row.length !== 5) throw new Error("Question " + (index + 1) + " has an invalid format.");
        const [topic,q,answer,options,why] = row;
        if (typeof q !== "string" || !q.includes("___") || !Array.isArray(options) ||
            options.length !== 4 || new Set(options).size !== 4 || !options.includes(answer)) {
          throw new Error("Question " + (index + 1) + " must contain one blank and four distinct choices.");
        }
        return {topic,q,answer,options:options.slice(),why};
      });
      byId("sectionLabel").textContent = "QUESTION 1 OF 30";
      byId("progressTrack").setAttribute("aria-valuemax","30");
      byId("finalScore").textContent = "0 / 30";
      questionBankReady = true;

      if (tracker && tracker.ready) {
        const readyResult = await tracker.ready;
        trackerReady = Boolean(readyResult && readyResult.available);
      }
      if (!tracker) trackerReady = false;

      if (pendingResumeDetail) {
        const pending = pendingResumeDetail;
        pendingResumeDetail = null;
        if (!applyResumeDetail(pending)) {
          byId("loadStatus").textContent = "An unfinished attempt was found, but its saved question order could not be matched. Your recorded answers remain in your account.";
          startButton.disabled = true;
          return;
        }
      }
      const savedDetail = tracker && tracker.getResumeDetails ? tracker.getResumeDetails() : null;
      if (savedDetail && !resumeQuiz) {
        if (!applyResumeDetail(savedDetail)) {
          byId("loadStatus").textContent = "We found an unfinished attempt, but could not match its saved questions. Your recorded answers remain in your account.";
          startButton.disabled = true;
          return;
        }
      }
      syncStartButton();
      if (!trackerReady) {
        byId("loadStatus").textContent = "Account tracking could not be verified. Refresh the page and sign in again before starting.";
        return;
      }
      if (resumeQuiz) {
        byId("loadStatus").textContent = "Your unfinished practice is ready to resume from question " + (resumeQuiz.currentIndex + 1) + ".";
      } else {
        byId("loadStatus").textContent = "30 questions are ready. Your answers, score and progress will be recorded automatically.";
      }
    } catch (error) {
      console.error(error);
      byId("loadStatus").textContent = "This practice could not load. Refresh the page or return to the library.";
      startButton.disabled = true;
    }
  }

  startButton.disabled = true;
  startButton.addEventListener("click",startGame);
  byId("nextBtn").addEventListener("click",nextQuestion);
  byId("restartBtn").addEventListener("click",startGame);
  byId("reviewBtn").addEventListener("click",() => {
    const box = byId("reviewBox");
    box.hidden = !box.hidden;
    byId("reviewBtn").textContent = box.hidden ? "Show answer review" : "Hide answer review";
    if (!box.hidden) box.scrollIntoView({behavior:"smooth",block:"start"});
  });
  document.addEventListener("keydown",event => {
    if (!byId("quizScreen").classList.contains("active") || answered) return;
    const key = Number(event.key);
    if (key >= 1 && key <= 4) {
      const button = optionsBox.querySelectorAll("button")[key - 1];
      if (button) button.click();
    }
  });
  void loadQuestions();
})();