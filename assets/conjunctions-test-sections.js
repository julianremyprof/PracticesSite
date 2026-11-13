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
  const skillNames = ["and","or","because","but"];
  let graded = false;
  let savedAnswers = new Map();
  let currentScore = 0;

  function answerFor(index) {
    const card = cards[index];
    const type = card.dataset.type;
    if (type === "fill") {
      const field = card.querySelector('input[type="text"]');
      return field ? field.value.trim().toLowerCase() : "";
    }
    if (type === "match") {
      const field = card.querySelector("select");
      return field ? field.value : "";
    }
    const checked = card.querySelector('input[type="radio"]:checked');
    return checked ? checked.value : "";
  }

  function updateProgress() {
    const answered = cards.reduce((sum,card,index)=>sum+(answerFor(index)!==""?1:0),0);
    progressText.textContent = answered + " of " + total;
    progressFill.style.width = (answered / total * 100) + "%";
    progressBar.setAttribute("aria-valuenow",String(answered));
  }

  function gradeSummary(score) {
    const percent = Math.round(score / total * 100);
    let comment = "Review your responses and use the feedback to strengthen your control of the four conjunctions.";
    if (score === 20) comment = "Excellent work. You answered every item accurately.";
    else if (score >= 17) comment = "Very good result. Review the few items you missed.";
    else if (score >= 14) comment = "Good progress. Use the section feedback to guide your revision.";
    else if (score >= 10) comment = "Keep practising. Focus on how each conjunction connects the ideas in a sentence.";
    document.getElementById("resultSubtitle").textContent = percent + "% · " + comment;
  }

  function makeReview(score) {
    document.getElementById("resultScore").textContent = score + " / 20";
    gradeSummary(score);
    const skills = Object.fromEntries(skillNames.map(name=>[name,{correct:0,total:0}]));
    const list = document.getElementById("reviewList");
    list.replaceChildren();

    cards.forEach((card,index)=>{
      const selected = answerFor(index);
      const expected = card.dataset.answer;
      const correct = selected === expected;
      const skill = card.dataset.skill;
      skills[skill].total++;
      if(correct) skills[skill].correct++;

      card.classList.toggle("correct",correct);
      card.classList.toggle("incorrect",!correct);
      const feedback = card.querySelector(".item-feedback");
      feedback.classList.add("show");
      feedback.textContent = correct
        ? "1 point. " + card.dataset.explanation
        : "0 points. Correct answer: " + displayAnswer(expected,card.dataset.type) + ". " + card.dataset.explanation;

      const review = document.createElement("article");
      review.className = "review-item";
      const prompt = document.createElement("b");
      prompt.textContent = (index+1) + ". " + card.querySelector(".prompt").textContent;
      const response = document.createElement("p");
      response.className = "status-line " + (correct?"good":"bad");
      response.textContent = correct
        ? "✓ Your answer: " + displayAnswer(selected,card.dataset.type) + " · 1 point"
        : "Your answer: " + displayAnswer(selected,card.dataset.type) + " · Correct answer: " + displayAnswer(expected,card.dataset.type) + " · 0 points";
      const explanation = document.createElement("p");
      explanation.textContent = card.dataset.explanation;
      review.append(prompt,response,explanation);
      list.appendChild(review);
    });

    const skillGrid = document.getElementById("skillGrid");
    skillGrid.replaceChildren();
    skillNames.forEach(name=>{
      const node = document.createElement("div");
      node.className = "skill";
      const scoreLine = document.createElement("b");
      scoreLine.textContent = skills[name].correct + " / " + skills[name].total;
      const label = document.createElement("span");
      label.textContent = name.toUpperCase();
      node.append(scoreLine,label);
      skillGrid.appendChild(node);
    });
    resultPanel.hidden = false;
  }

  function displayAnswer(value,type) {
    if(!value) return "No answer";
    if(type==="tf") return value==="true"?"True":"False";
    if(type==="match") return value.toUpperCase();
    return value;
  }

  function lockTest() {
    form.querySelectorAll("input,select").forEach(control=>{control.disabled=true;});
    submitButton.disabled=true;
    submitButton.textContent="Test submitted";
  }

  async function saveGrade() {
    if(!tracker) {
      gradeSaveStatus.textContent="Your score is calculated, but account tracking is unavailable.";
      retrySave.hidden=true;
      return false;
    }
    retrySave.disabled=true;
    retrySave.textContent="Saving…";
    gradeSaveStatus.textContent="Saving your 20 responses and final score to your student account…";
    let allSaved=true;
    const pending=[];
    cards.forEach((card,index)=>{
      const selected=answerFor(index);
      if(savedAnswers.get(index)!==selected) pending.push(index);
    });

    // Save pending responses sequentially; the tracker closes the session when
    // it has received all 20 final answers.
    for(const index of pending) {
      const card=cards[index];
      const selected=answerFor(index);
      const okay=await tracker.record({
        questionIndex:index,
        totalQuestions:total,
        questionText:card.querySelector(".prompt").textContent,
        topic:"conjunctions-test-v2/"+card.dataset.skill,
        selectedAnswer:selected,
        correctAnswer:card.dataset.answer,
        isCorrect:selected===card.dataset.answer
      });
      if(okay) savedAnswers.set(index,selected);
      else allSaved=false;
    }

    if(allSaved && savedAnswers.size===total) {
      gradeSaveStatus.textContent="✓ Your 20 answers and final grade have been saved to your student account.";
      retrySave.hidden=true;
      retrySave.textContent="Retry saving grade";
      return true;
    }
    gradeSaveStatus.textContent="The score is calculated, but the account save is not complete. Check your connection and retry.";
    retrySave.hidden=false;
    retrySave.disabled=false;
    retrySave.textContent="Retry saving grade";
    return false;
  }

  function submitTest(event) {
    event.preventDefault();
    if(graded) return;
    const missing=cards.findIndex((card,index)=>answerFor(index)==="");
    if(missing!==-1) {
      status.textContent="Please complete all 20 questions. Question "+(missing+1)+" is unanswered.";
      cards[missing].scrollIntoView({behavior:"smooth",block:"center"});
      const control=cards[missing].querySelector("input,select");
      if(control) control.focus({preventScroll:true});
      return;
    }
    currentScore=cards.reduce((sum,card,index)=>sum+(answerFor(index)===card.dataset.answer?1:0),0);
    graded=true;
    makeReview(currentScore);
    lockTest();
    status.textContent="Test graded: "+currentScore+" out of 20 points.";
    resultPanel.scrollIntoView({behavior:"smooth",block:"start"});
    void saveGrade();
  }

  form.addEventListener("change",updateProgress);
  form.addEventListener("input",updateProgress);
  form.addEventListener("submit",submitTest);
  retrySave.addEventListener("click",()=>{void saveGrade();});
  document.getElementById("retakeTest").addEventListener("click",()=>window.location.reload());

  window.addEventListener("englishlab:resume",event=>{
    const rows=event.detail&&Array.isArray(event.detail.latestAnswers)?event.detail.latestAnswers:[];
    rows.forEach(row=>{
      const index=Number(row.question_index);
      if(Number.isInteger(index)&&index>=0&&index<total) savedAnswers.set(index,String(row.selected_answer||"").toLowerCase());
    });
    updateProgress();
    if(rows.length) status.textContent="Your previous responses were restored. Complete any unanswered items, then submit for your grade.";
  });

  updateProgress();
  if(tracker&&tracker.ready) {
    tracker.ready.then(result=>{
      status.textContent=result&&result.available
        ? (result.restored?"Your saved progress has been restored.":"Your test is ready. Your work will be saved to your student account.")
        : "Your test can be graded, but account tracking could not be confirmed. Refresh and sign in again if necessary.";
      updateProgress();
    }).catch(error=>{
      console.error("Assessment tracking initialization failed:",error);
      status.textContent="Your test can still be graded, but account tracking could not be initialized.";
    });
  }
})();