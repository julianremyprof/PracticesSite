(() => {
  "use strict";
  const form = document.getElementById("assessmentForm");
  const cards = Array.from(document.querySelectorAll(".question-card"));
  const progressText = document.getElementById("progressText");
  const progressFill = document.getElementById("progressFill");
  const progressBar = document.getElementById("progressBar");
  const status = document.getElementById("testStatus");
  const submitButton = document.getElementById("submitTest");
  const resultPanel = document.getElementById("resultPanel");
  const gradeSaveStatus = document.getElementById("gradeSaveStatus");
  const retrySave = document.getElementById("retrySave");
  const tracker = window.EnglishLabTracker;
  const total = cards.length;
  let graded = false;
  let latestSaved = new Map();
  let latestScore = null;

  function selectedFor(index) {
    const input = form.querySelector('input[name="q' + (index + 1) + '"]:checked');
    return input ? input.value : "";
  }

  function updateProgress() {
    const answered = cards.reduce((sum, card, index) => sum + (selectedFor(index) ? 1 : 0), 0);
    progressText.textContent = answered + " of " + total;
    progressFill.style.width = (answered / total * 100) + "%";
    progressBar.setAttribute("aria-valuenow", String(answered));
  }

  function buildReview(score) {
    document.getElementById("resultScore").textContent = score + " / 20";
    const pct = Math.round(score / total * 100);
    let note = "Keep practising the four relationships: addition, choice, reason and contrast.";
    if (score === 20) note = "Excellent work. You identified all four conjunctions accurately in context.";
    else if (score >= 17) note = "Very strong result. Review the few items you missed to make your choices even more precise.";
    else if (score >= 14) note = "Good progress. Use the skill breakdown to decide which conjunction needs more attention.";
    else if (score >= 10) note = "You have a foundation to build on. Read each explanation and notice the relationship between the ideas.";
    document.getElementById("resultSubtitle").textContent = pct + "% · " + note;

    const skillNames = ["and","or","because","but"];
    const skills = Object.fromEntries(skillNames.map(name => [name,{correct:0,total:0}]));
    const reviewList = document.getElementById("reviewList");
    reviewList.replaceChildren();

    cards.forEach((card,index) => {
      const expected = card.dataset.answer;
      const skill = expected;
      const selected = selectedFor(index);
      const isCorrect = selected === expected;
      skills[skill].total++;
      if (isCorrect) skills[skill].correct++;

      card.classList.toggle("correct", isCorrect);
      card.classList.toggle("incorrect", !isCorrect);
      const result = card.querySelector(".question-result");
      result.classList.add("show");
      result.textContent = isCorrect
        ? "1 point · " + card.dataset.explanation
        : "0 points · Correct answer: " + expected + ". " + card.dataset.explanation;

      const item = document.createElement("article");
      item.className = "review-item " + (isCorrect ? "correct" : "incorrect");
      const prompt = document.createElement("b");
      prompt.textContent = (index + 1) + ". " + card.querySelector(".prompt-text").textContent;
      const statusLine = document.createElement("p");
      statusLine.className = "review-status";
      statusLine.textContent = isCorrect
        ? "✓ Your answer: " + selected + " · 1 point"
        : "Your answer: " + (selected || "No answer") + " · Correct answer: " + expected + " · 0 points";
      const explanation = document.createElement("p");
      explanation.textContent = card.dataset.explanation;
      item.append(prompt,statusLine,explanation);
      reviewList.appendChild(item);
    });

    const skillGrid = document.getElementById("skillGrid");
    skillGrid.replaceChildren();
    skillNames.forEach(name => {
      const item = document.createElement("div");
      item.className = "skill-item";
      const scoreLine = document.createElement("b");
      scoreLine.textContent = skills[name].correct + " / " + skills[name].total;
      const label = document.createElement("span");
      label.textContent = name.toUpperCase();
      item.append(scoreLine,label);
      skillGrid.appendChild(item);
    });

    resultPanel.hidden = false;
  }

  function freezeTest() {
    form.querySelectorAll("input[type=radio]").forEach(input => { input.disabled = true; });
    submitButton.disabled = true;
    submitButton.textContent = "Test submitted";
  }

  async function saveGrade() {
    if (!tracker) {
      gradeSaveStatus.textContent = "Your score is calculated, but account tracking is unavailable on this page.";
      retrySave.hidden = true;
      return false;
    }
    retrySave.disabled = true;
    retrySave.textContent = "Saving…";
    gradeSaveStatus.textContent = "Saving your 20 answers and final score to your student account…";
    let allSaved = true;
    const pending = [];

    cards.forEach((card,index) => {
      const selected = selectedFor(index);
      const previous = latestSaved.get(index);
      if (!previous || String(previous).toLowerCase() !== selected) pending.push(index);
    });

    // Save all changed, previously recorded answers first. Save not-yet-recorded
    // questions last so the tracking system completes the session only after the
    // final version of every answer has been recorded.
    for (const index of pending) {
      const card = cards[index];
      const selected = selectedFor(index);
      const prompt = card.querySelector(".prompt-text").textContent;
      const okay = await tracker.record({
        questionIndex:index,
        totalQuestions:total,
        questionText:prompt,
        topic:"conjunctions-test/" + card.dataset.answer,
        selectedAnswer:selected,
        correctAnswer:card.dataset.answer,
        isCorrect:selected === card.dataset.answer,
        errorDetail:selected === card.dataset.answer ? null : "This item assesses " + card.dataset.answer + " in a context of " + card.dataset.skill.toLowerCase() + "."
      });
      if (okay) latestSaved.set(index,selected);
      else allSaved = false;
    }

    // If all answers were already present but the final summary write was
    // interrupted, retry one saved answer to ask the tracker to finalize again.
    if (pending.length === 0 && latestSaved.size === total) {
      const index = total - 1;
      const card = cards[index];
      const selected = selectedFor(index);
      const okay = await tracker.record({
        questionIndex:index,
        totalQuestions:total,
        questionText:card.querySelector(".prompt-text").textContent,
        topic:"conjunctions-test/" + card.dataset.answer,
        selectedAnswer:selected,
        correctAnswer:card.dataset.answer,
        isCorrect:selected === card.dataset.answer
      });
      if (!okay) allSaved = false;
      else latestSaved.set(index,selected);
    }

    if (allSaved && latestSaved.size === total) {
      gradeSaveStatus.textContent = "✓ Your 20 answers and your grade have been saved to your student account.";
      retrySave.hidden = true;
      retrySave.textContent = "Retry saving grade";
      return true;
    }
    gradeSaveStatus.textContent = "Your grade is calculated, but the account save is not complete. Check your connection and retry.";
    retrySave.hidden = false;
    retrySave.disabled = false;
    retrySave.textContent = "Retry saving grade";
    return false;
  }

  function submitTest(event) {
    event.preventDefault();
    if (graded) return;
    const firstMissing = cards.findIndex((card,index) => !selectedFor(index));
    if (firstMissing !== -1) {
      status.textContent = "Please answer all 20 questions. Question " + (firstMissing + 1) + " is still unanswered.";
      const first = cards[firstMissing];
      first.scrollIntoView({behavior:"smooth",block:"center"});
      const focusable = first.querySelector("input");
      if (focusable) focusable.focus({preventScroll:true});
      return;
    }

    latestScore = cards.reduce((sum,card,index) => sum + (selectedFor(index) === card.dataset.answer ? 1 : 0),0);
    graded = true;
    buildReview(latestScore);
    freezeTest();
    status.textContent = "Assessment graded: " + latestScore + " out of 20 points.";
    resultPanel.scrollIntoView({behavior:"smooth",block:"start"});
    void saveGrade();
  }

  form.addEventListener("change",updateProgress);
  form.addEventListener("submit",submitTest);
  retrySave.addEventListener("click",() => { void saveGrade(); });
  document.getElementById("retakeTest").addEventListener("click",() => window.location.reload());

  window.addEventListener("englishlab:resume", event => {
    const rows = event.detail && Array.isArray(event.detail.latestAnswers) ? event.detail.latestAnswers : [];
    rows.forEach(row => {
      const index = Number(row.question_index);
      if (Number.isInteger(index) && index >= 0 && index < total) latestSaved.set(index,String(row.selected_answer || ""));
    });
    updateProgress();
    if (rows.length) status.textContent = "Your saved answers were restored. Continue the test, then submit when all 20 are answered.";
    if (!resultPanel.hidden) {
      const complete = cards.every((card,index) => Boolean(selectedFor(index)));
      if (complete) {
        graded = true;
        latestScore = cards.reduce((sum,card,index) => sum + (selectedFor(index) === card.dataset.answer ? 1 : 0),0);
        buildReview(latestScore);
        freezeTest();
        status.textContent = "Your assessment was restored. Retry the grade save to finish recording it.";
        gradeSaveStatus.textContent = "The result screen was restored, but the final account save may need to be retried.";
        retrySave.hidden = false;
        retrySave.disabled = false;
        void tracker.ready.then(() => {});
      }
    }
  });

  updateProgress();
  if (tracker && tracker.ready) {
    tracker.ready.then(result => {
      if (result && result.available) {
        status.textContent = result.restored
          ? "Your previous progress is ready. Your selections have been restored."
          : "Your test is ready. Your answers and grade will be saved to your student account.";
      } else {
        status.textContent = "You can complete the test, but account tracking could not be confirmed. Refresh and sign in again if needed.";
      }
      updateProgress();
    }).catch(error => {
      console.error("Could not initialize assessment tracking:", error);
      status.textContent = "The test can still be graded locally, but account tracking could not be initialized.";
    });
  }
})();