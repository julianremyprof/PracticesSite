(() => {
  "use strict";
  const SUPABASE_URL = "https://kehopukcypesrecyfrvp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_zDWMioaroblLV0cRMh-SoQ_RvGYnCE6";
  const db = window.englishLabSupabase || (window.supabase && window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY));
  if (!db) {
    console.error("English Lab tracking could not start: Supabase client unavailable.");
    return;
  }
  window.englishLabSupabase = db;

  let sessionId = null;
  let sessionPromise = null;
  let sessionStartedAt = null;
  let summarySaved = false;
  let totalQuestions = 0;
  let sessionStudentId = null;
  let resumeCustom = null;
  let resumeDetails = null;
  let restoredAnswers = [];
  let restoreReady = false;
  let saveTimer = null;
  let stateWriteQueue = Promise.resolve();
  const attemptsByQuestion = new Map();
  const latestCorrectByQuestion = new Map();
  const touchedQuestions = new Set();
  let statusNote = null;
  let initializationPromise = null;
  let resolveReady = null;
  const ready = new Promise(resolve => { resolveReady = resolve; });

  function activityId() {
    const bodyId = document.body && document.body.dataset.activityId;
    if (bodyId) return bodyId;
    const set = new URLSearchParams(window.location.search).get("set");
    return set ? "toeic-part5-" + set : "";
  }

  function note(message, isError) {
    if (!statusNote && document.body) {
      statusNote = document.createElement("p");
      statusNote.id = "practiceTrackingStatus";
      statusNote.setAttribute("role", "status");
      statusNote.setAttribute("aria-live", "polite");
      statusNote.style.cssText = "margin:10px auto;padding:8px 12px;max-width:900px;font-size:.9rem;color:#667085;text-align:center";
      const host = document.querySelector(".actions") || document.querySelector(".controls") || document.querySelector("main") || document.body;
      host.appendChild(statusNote);
    }
    if (statusNote) {
      statusNote.textContent = message;
      statusNote.style.color = isError ? "#b42318" : "#667085";
    }
  }

  function showPracticeRankResult(rank, score, total) {
    if (!rank) return;
    const host = document.querySelector("main") || document.body;
    let panel = document.getElementById("practiceRankResult");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "practiceRankResult";
      panel.setAttribute("role", "status");
      panel.setAttribute("aria-live", "polite");
      host.appendChild(panel);
    }
    panel.replaceChildren();
    panel.style.cssText = "display:grid;grid-template-columns:auto 1fr;align-items:center;gap:14px;max-width:900px;margin:18px auto;padding:18px 20px;border:1px solid #dbe6f3;border-radius:16px;background:#f8fbff;color:#243449;box-shadow:0 8px 24px #18324f0a";

    const colors = rank.grade === "SSS"
      ? {background:"#fff2cc",color:"#795300",border:"#ead7a1"}
      : rank.grade === "A" || rank.grade === "B"
        ? {background:"#e8f1ff",color:"#1e5796",border:"#cbdcf2"}
        : rank.grade === "C"
          ? {background:"#e8f6ee",color:"#176b47",border:"#cde8d8"}
          : {background:"#f0f3f7",color:"#536174",border:"#dce3ec"};

    const badge = document.createElement("span");
    badge.textContent = rank.grade;
    badge.style.cssText = "display:grid;place-items:center;min-width:68px;height:68px;padding:0 10px;border:1px solid "+colors.border+";border-radius:16px;background:"+colors.background+";color:"+colors.color+";font-size:24px;font-weight:900;letter-spacing:-.05em";
    
    const content = document.createElement("div");
    const kicker = document.createElement("div");
    kicker.textContent = "PRACTICE COMPLETE · YOUR RANK";
    kicker.style.cssText = "margin-bottom:3px;color:#66758a;font-size:10px;font-weight:850;letter-spacing:.12em";
    const heading = document.createElement("strong");
    heading.textContent = rank.heading;
    heading.style.cssText = "display:block;color:#18324f;font-size:18px;letter-spacing:-.025em";
    const scoreLine = document.createElement("div");
    scoreLine.textContent = score + " / " + total + " correct · " + rank.percentage.toFixed(1) + "%";
    scoreLine.style.cssText = "margin-top:3px;color:#4f5f72;font-size:13px;font-weight:750";
    const message = document.createElement("p");
    message.textContent = rank.message;
    message.style.cssText = "margin:6px 0 0;color:#526174;font-size:13px;line-height:1.5";
    const bonus = document.createElement("p");
    bonus.textContent = rank.bonusMessage;
    bonus.style.cssText = "margin:7px 0 0;color:"+(rank.bonus>0?"#176b47":"#66758a")+";font-size:12px;font-weight:800;line-height:1.45";
    content.append(kicker, heading, scoreLine, message, bonus);
    panel.append(badge, content);
  }

  const clean = value => String(value == null ? "" : value).trim().toLowerCase().replace(/\s+/g, " ");
  const display = value => typeof value === "string" ? value.trim() : JSON.stringify(value);

  function classifyWordClass(value) {
    const word = clean(value).split(" / ")[0];
    if (/ly$/.test(word)) return "adverb";
    if (/(tion|sion|ment|ness|ity|ance|ence|ship|hood|dom|er|or|ist|ism|ure|age)$/.test(word)) return "noun";
    if (/(ous|ful|less|able|ible|ive|al|ic|y|ent|ant)$/.test(word)) return "adjective";
    if (/(ize|ise|ify|en)$/.test(word)) return "verb";
    return "general";
  }

  function topicFor(payload) {
    const base = clean(payload.topic || "general");
    if (base === "articles") {
      const expected = clean(payload.correctAnswer);
      return "articles/" + (expected === "the" ? "definite-article" : expected === "-" ? "zero-article" : "indefinite-article");
    }
    if (base === "word-formation") {
      const exactClass = payload.subtopic ? clean(payload.subtopic) : classifyWordClass(payload.correctAnswer);
      return "word-formation/" + exactClass;
    }
    if (base === "tag-questions") {
      const q = clean(payload.questionText);
      let area = "simple-present-or-past";
      if (q.includes("let's") || /^(open|close|listen|please)\b/.test(q)) area = "imperatives";
      else if (q.includes("going to")) area = "be-going-to";
      else if (q.includes("will have") || q.includes("had finished")) area = "perfect-tenses";
      else if (q.includes("has been") || q.includes("have been")) area = "perfect-progressive";
      else if (/\b(has|have|had)\b/.test(q)) area = "perfect-tenses";
      else if (/\b(can|could|should|must|may|might|would)\b/.test(q)) area = "modal-verbs";
      else if (/\b(am|is|are|was|were)\b/.test(q)) area = "forms-of-be";
      return "tag-questions/" + area;
    }
    return String(payload.topic || "general").slice(0, 200);
  }

  function inferError(payload) {
    if (payload.isCorrect) return null;
    if (payload.errorType) return payload.errorType;
    const topic = clean(payload.topic);
    const selected = clean(payload.selectedAnswer);
    const expected = clean(payload.correctAnswer);
    const question = clean(payload.questionText);
    if (topic.includes("article")) {
      if (expected === "the") return "definite_article_use_or_omission";
      if (expected === "a" || expected === "an") return "indefinite_article_choice";
      if (expected === "-") return "zero_article_overuse";
      return "article_use";
    }
    if (topic.includes("tag-question") || topic.includes("tag question")) {
      if (!String(payload.selectedAnswer || "").trim().endsWith("?")) return "missing_question_mark";
      const chosen = selected.replace(/\?$/, "").split(" ");
      const right = expected.replace(/\?$/, "").split(" ");
      if (chosen[0] && right[0] && (chosen[0].endsWith("n't") !== right[0].endsWith("n't"))) return "tag_polarity";
      if (chosen[0] !== right[0]) return "auxiliary_selection";
      if (chosen[1] !== right[1]) return "subject_pronoun";
      return "tag_word_order_or_polarity";
    }
    if (topic.includes("for-since") || topic.includes("present-perfect-progressive")) {
      const chosen = selected.split(" ");
      const right = expected.split(" ");
      if ((right[0] === "has" || right[0] === "have") && chosen[0] !== right[0]) return "subject_auxiliary_agreement";
      if (right.includes("for") || right.includes("since")) {
        const expectedTime = right.find(word => word === "for" || word === "since");
        const selectedTime = chosen.find(word => word === "for" || word === "since");
        if (selectedTime && selectedTime !== expectedTime) return "for_vs_since";
      }
      if (right.includes("been") && !chosen.includes("been")) return "missing_been";
      if (right.some(word => word.endsWith("ing")) && !chosen.some(word => word.endsWith("ing"))) return "verb_ing_form";
      return "present_perfect_progressive_structure";
    }
    if (topic.includes("subject-verb-agreement")) return "subject_verb_agreement";
    if (topic.includes("conditionals")) return "conditional_form_or_meaning";
    if (topic.includes("verb-tenses")) return "verb_tense_or_aspect";
    if (topic.includes("word-formation")) {
      if (topic.includes("adverb-formation")) return "adverb_word_formation";
      if (topic.includes("adjective-formation")) return "adjective_word_formation";
      if (topic.includes("verb-formation")) return "verb_word_formation";
      if (topic.includes("noun-formation")) return "noun_word_formation";
      if (payload.errorDetail && payload.errorDetail.includes("base_word_class")) return "base_word_class";
      if (payload.errorDetail && payload.errorDetail.includes("derived_word_class")) return "derived_word_class";
      if (payload.errorDetail && payload.errorDetail.includes("derived_word_form")) return "derived_word_form";
      if (/\b(un|in|im|il|ir|dis|mis|re)[a-z-]*/.test(expected) && !expected.startsWith(selected.slice(0, 2))) return "prefix_or_negative_form";
      if (/s$/.test(expected) && !/s$/.test(selected)) return "noun_number_or_plural";
      const suffixType = value => {
        if (/ly$/.test(value)) return "adverb";
        if (/(tion|sion|ment|ness|ity|ance|ence|ship|hood|dom|er|or|ist|ism|ure|age)$/.test(value)) return "noun";
        if (/(ous|ful|less|able|ible|ive|al|ic|y|ent|ant)$/.test(value)) return "adjective";
        if (/(ize|ise|ify|en)$/.test(value)) return "verb";
        return "unknown";
      };
      const selectedClass = suffixType(selected), expectedClass = suffixType(expected);
      if (selectedClass !== "unknown" && expectedClass !== "unknown" && selectedClass !== expectedClass) return "wrong_part_of_speech_or_suffix";
      return "word_formation_or_spelling";
    }
    if (topic.includes("preposition")) return "preposition_or_collocation";
    if (topic.includes("conjunction")) return "conjunction_or_clause_relationship";
    if (topic.includes("vocabulary")) return "word_choice_or_collocation";
    if (topic.includes("tense") || topic.includes("grammar")) return "grammar_form_or_usage";
    if (question.includes("article")) return "article_use";
    return "incorrect_answer";
  }

  function pathFor(element) {
    if (element.id) return {id: element.id};
    const parts = [];
    let node = element;
    while (node && node !== document.body && node.parentElement) {
      const siblings = Array.from(node.parentElement.children).filter(el => el.tagName === node.tagName);
      parts.unshift(node.tagName.toLowerCase() + ":nth-of-type(" + (siblings.indexOf(node) + 1) + ")");
      node = node.parentElement;
    }
    return {path: parts.join(" > ")};
  }

  function isTextStateElement(element) {
    if (element.matches("[role='status']")) return true;
    if (/^(score|progress|overallScore|progressText|message|scoreValue|streakValue|percentLabel|sectionLabel|finalScore|accuracyTotal|correctTotal|incorrectTotal|result-\d+|feedback-\d+)$/i.test(element.id || "")) return true;
    return element.matches(".feedback,.result,.question-result") &&
      !element.querySelector("[id],input,select,textarea,button");
  }

  function captureDom() {
    if (!document.body) return [];
    const selector = "input,select,textarea,button,[id],[role='status'],.feedback,.result,.question-result";
    return Array.from(document.querySelectorAll(selector)).slice(0, 2500).map(element => {
      const item = {target: pathFor(element), tag: element.tagName};
      if ("value" in element) item.value = element.value;
      if ("checked" in element) item.checked = element.checked;
      if ("disabled" in element) item.disabled = element.disabled;
      if (element.className && typeof element.className === "string") item.className = element.className;
      if ("hidden" in element) item.hidden = element.hidden;
      if (element.style && element.style.display) item.display = element.style.display;
      if (isTextStateElement(element)) {
        const text = element.textContent || "";
        if (text.length <= 1200) item.text = text;
      }
      return item;
    });
  }

  function findTarget(target) {
    if (target.id) return document.getElementById(target.id);
    if (!target.path) return null;
    try { return document.querySelector("body > " + target.path); } catch (_) { return null; }
  }

  function restoreDom(items) {
    (items || []).forEach(item => {
      const element = findTarget(item.target || {});
      if (!element || element.tagName !== item.tag) return;
      if (Object.prototype.hasOwnProperty.call(item, "value") && "value" in element) element.value = item.value;
      if (Object.prototype.hasOwnProperty.call(item, "checked") && "checked" in element) element.checked = item.checked;
      if (Object.prototype.hasOwnProperty.call(item, "disabled") && "disabled" in element) element.disabled = item.disabled;
      if (Object.prototype.hasOwnProperty.call(item, "className") && typeof element.className === "string") element.className = item.className;
      if (Object.prototype.hasOwnProperty.call(item, "hidden")) element.hidden = item.hidden;
      if (Object.prototype.hasOwnProperty.call(item, "display")) element.style.display = item.display;
      if (Object.prototype.hasOwnProperty.call(item, "text") && isTextStateElement(element)) element.textContent = item.text;
    });
  }

  async function persistState(custom) {
    if (!sessionId || summarySaved) return false;
    if (custom !== undefined) resumeCustom = custom;
    const targetSessionId = sessionId;
    const targetStudentId = sessionStudentId;
    const resume_state = {
      dom: captureDom(),
      custom: resumeCustom == null ? null : JSON.parse(JSON.stringify(resumeCustom)),
      saved_at: new Date().toISOString()
    };
    // Serialize writes so a slower, older autosave cannot overwrite a newer snapshot.
    const write = stateWriteQueue.then(async () => {
      if (sessionId !== targetSessionId || summarySaved) return false;
      const {error} = await db.from("practice_sessions")
        .update({resume_state})
        .eq("id", targetSessionId)
        .eq("student_id", targetStudentId);
      if (error) {
        console.warn("Could not save resume state:", error);
        note("Your latest screen state could not be saved. Your checked answers are still being recorded.", true);
        return false;
      }
      return true;
    });
    stateWriteQueue = write.catch(error => {
      console.warn("Could not save resume state:", error);
      note("Your latest screen state could not be saved. Your checked answers are still being recorded.", true);
      return false;
    });
    return write;
  }

  function scheduleStateSave() {
    if (!sessionId || summarySaved) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void persistState(); }, 500);
  }

  async function ensureSession(expectedTotal) {
    const requestedTotal = Number(expectedTotal);
    if (!Number.isInteger(requestedTotal) || requestedTotal < 1) {
      throw new Error("The total number of questions is required before tracking can start.");
    }
    if (sessionId) return sessionId;
    if (sessionPromise) return sessionPromise;
    sessionPromise = (async () => {
      const id = activityId();
      if (!id) throw new Error("This practice has no activity ID.");
      const { data: { user }, error: authError } = await db.auth.getUser();
      if (authError || !user) throw new Error("Please sign in again to save your practice answers.");
      sessionStudentId = user.id;
      sessionStartedAt = Date.now();
      totalQuestions = requestedTotal;
      const { data, error } = await db.from("practice_sessions").insert({
        student_id: user.id,
        activity_id: id,
        total_questions: requestedTotal,
        resume_state: {},
        status: "in_progress",
        started_at: new Date(sessionStartedAt).toISOString()
      }).select("id").single();
      if (error) throw error;
      sessionId = data.id;
      note("Your practice is ready. Your progress will be saved as you work.");
      return sessionId;
    })();
    try {
      return await sessionPromise;
    } catch (error) {
      sessionPromise = null;
      console.error("Could not create practice session:", error);
      note(error.message || "Could not start answer tracking. Please refresh and sign in again.", true);
      return null;
    }
  }

  async function withRetry(operation, label) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 450 * (attempt + 1)));
      }
    }
    console.error(label + " failed:", lastError);
    note("An answer could not be saved. Keep this page open and try checking it again.", true);
    return null;
  }

  async function finishSession(total) {
    if (!sessionId || !sessionStudentId) return false;
    await stateWriteQueue.catch(() => false);
    const activity = activityId();
    const score = [...latestCorrectByQuestion.values()].filter(Boolean).length;
    const duration = Math.max(0, Math.round((Date.now() - sessionStartedAt) / 1000));
    const completedAt = new Date().toISOString();
    const update = await withRetry(async () => {
      const { error } = await db.from("practice_sessions").update({
        status: "completed",
        completed_at: completedAt,
        score,
        total_questions: total,
        duration_seconds: duration,
        resume_state: {}
      }).eq("id", sessionId);
      if (error) throw error;
      return true;
    }, "Practice session completion");
    if (!update) return false;
    const summary = await withRetry(async () => {
      const { error } = await db.from("attempts").upsert({
        practice_session_id: sessionId,
        student_id: sessionStudentId,
        activity_id: activity,
        score,
        total_questions: total,
        duration_seconds: duration,
        completed_at: completedAt
      }, { onConflict: "practice_session_id" });
      if (error) throw error;
      return true;
    }, "Practice summary");
    if (summary) {
      summarySaved = true;
      const rank = window.RaisingDiamondsRanks
        ? window.RaisingDiamondsRanks.fromScore(score, total)
        : null;
      showPracticeRankResult(rank, score, total);
      let resultMessage="Your practice result has been saved to your account.";
      try{
        const {data:assignments,error:assignmentError}=await db.from("practice_assignments")
          .select("id,required_score,created_at")
          .eq("student_id",sessionStudentId).eq("activity_id",activity)
          .lte("created_at",completedAt).order("created_at",{ascending:false});
        if(assignmentError)throw assignmentError;
        const requiredAssignments=(assignments||[]).filter(a=>a.required_score!==null&&a.required_score!==undefined);
        if(requiredAssignments.length){
          const earliestAssignment=requiredAssignments.reduce((earliest,row)=>row.created_at<earliest?row.created_at:earliest,requiredAssignments[0].created_at);
          const {data:attempts,error:attemptError}=await db.from("attempts")
            .select("score,total_questions,completed_at")
            .eq("student_id",sessionStudentId).eq("activity_id",activity).gte("completed_at",earliestAssignment);
          if(attemptError)throw attemptError;
          const unmet=requiredAssignments.filter(assignment=>{
            const required=Number(assignment.required_score);
            return !(attempts||[]).some(attempt=>
              new Date(attempt.completed_at).getTime()>=new Date(assignment.created_at).getTime() &&
              Number(attempt.total_questions)>0 &&
              Number(attempt.score)/Number(attempt.total_questions)*100+1e-9>=required
            );
          });
          if(unmet.length){
            const targets=[...new Set(unmet.map(row=>Number(row.required_score)))].sort((a,b)=>a-b);
            resultMessage="You scored "+(score/total*100).toFixed(1)+"%. This assignment still requires a passing score of "+targets.join("% and ")+"%. Review your mistakes and try again until you pass.";
          }else{
            resultMessage="Your score meets the minimum requirement for your assigned practice. The assignment is marked as completed.";
          }
        }
      }catch(error){
        console.warn("Could not check assignment passing score:",error);
      }
      note(resultMessage,resultMessage.startsWith("You scored"));
      return true;
    }
    return false;
  }

  async function record(payload) {
    const index = Number(payload.questionIndex);
    const total = Number(payload.totalQuestions || totalQuestions);
    if (!Number.isInteger(index) || index < 0 || !Number.isInteger(total) || total < 1) {
      console.warn("Practice answer was not saved: invalid question index or total.", payload);
      return false;
    }
    totalQuestions = total;
    const id = await ensureSession(total);
    if (!id) return false;
    const attemptNumber = (attemptsByQuestion.get(index) || 0) + 1;
    attemptsByQuestion.set(index, attemptNumber);
    touchedQuestions.add(index);
    latestCorrectByQuestion.set(index, Boolean(payload.isCorrect));
    const chosen = display(payload.selectedAnswer);
    const expected = display(payload.correctAnswer);
    const isCorrect = Boolean(payload.isCorrect);
    const topic = topicFor(payload);
    const errorType = inferError({...payload, topic, isCorrect});
    const row = {
      session_id: id,
      student_id: sessionStudentId,
      activity_id: activityId(),
      question_index: index + 1,
      question_text: String(payload.questionText || ("Question " + (index + 1))).slice(0, 4000),
      answer_options: Array.isArray(payload.options) ? payload.options.slice(0, 8).map(value => String(value).slice(0, 2000)) : [],
      topic: String(topic).slice(0, 200),
      selected_answer: chosen.slice(0, 2000),
      correct_answer: expected.slice(0, 2000),
      is_correct: isCorrect,
      attempt_number: attemptNumber,
      time_to_answer_seconds: Number.isFinite(Number(payload.timeToAnswerSeconds))
        ? Math.max(0, Math.min(3600, Math.round(Number(payload.timeToAnswerSeconds))))
        : null,
      error_type: errorType,
      error_detail: isCorrect ? null : String(payload.errorDetail || ("Selected: " + chosen + " | Expected: " + expected)).slice(0, 1000)
    };
    const saved = await withRetry(async () => {
      const { error } = await db.from("practice_answers").insert(row);
      if (error) throw error;
      return true;
    }, "Practice answer");
    if (!saved) return false;
    await persistState();
    if (touchedQuestions.size >= totalQuestions) {
      const completed = await finishSession(totalQuestions);
      if (!completed) return false;
    }
    return true;
  }

  async function startNewSession(total) {
    if (sessionId && !summarySaved) {
      note("An unfinished practice is already saved. Resume it before starting another attempt.", true);
      return null;
    }
    sessionId = null;
    sessionPromise = null;
    sessionStartedAt = null;
    summarySaved = false;
    totalQuestions = 0;
    sessionStudentId = null;
    resumeCustom = null;
    resumeDetails = null;
    restoredAnswers = [];
    restoreReady = false;
    attemptsByQuestion.clear();
    latestCorrectByQuestion.clear();
    touchedQuestions.clear();
    const requestedTotal = Number(total);
    if (Number.isInteger(requestedTotal) && requestedTotal > 0) {
      const id = await ensureSession(requestedTotal);
      if (id) await persistState();
      return id;
    }
    return null;
  }

  async function restoreExistingSession() {
    const id = activityId();
    if (!id) return false;
    const {data:{user},error:authError}=await db.auth.getUser();
    if (authError || !user) return false;

    // A student can have several unfinished attempts after a refresh or a previous
    // failed resume. Read them all and prefer the one with the most saved progress,
    // rather than silently choosing a newer but empty session.
    const {data:sessions,error}=await db.from("practice_sessions")
      .select("id,student_id,activity_id,status,started_at,total_questions,resume_state")
      .eq("student_id",user.id).eq("activity_id",id)
      .in("status",["in_progress","abandoned"])
      .order("started_at",{ascending:false}).limit(25);
    if (error) throw error;
    if (!sessions || !sessions.length) {
      resumeDetails = null;
      return false;
    }

    const sessionIds=sessions.map(session=>session.id);
    const {data:allAnswers,error:answerError}=await db.from("practice_answers")
      .select("session_id,question_index,selected_answer,correct_answer,is_correct,attempt_number,question_text,topic,error_type,error_detail,answered_at")
      .in("session_id",sessionIds).order("answered_at",{ascending:true});
    if (answerError) throw answerError;

    const answersBySession=new Map(sessions.map(session=>[session.id,[]]));
    (allAnswers||[]).forEach(row=>{
      if(!answersBySession.has(row.session_id))answersBySession.set(row.session_id,[]);
      answersBySession.get(row.session_id).push(row);
    });
    const asTime=value=>{
      const time=value?Date.parse(value):0;
      return Number.isFinite(time)?time:0;
    };
    const ranked=sessions.map(session=>{
      const rows=answersBySession.get(session.id)||[];
      const latest=new Map();
      rows.forEach(row=>{
        const index=Number(row.question_index)-1;
        if(Number.isInteger(index)&&index>=0)latest.set(index,row);
      });
      const custom=session.resume_state?.custom??null;
      const customAnswers=Array.isArray(custom?.answers)?custom.answers.filter(Boolean).length:0;
      const snapshotTime=asTime(session.resume_state?.saved_at);
      const answerTime=rows.reduce((value,row)=>Math.max(value,asTime(row.answered_at)),0);
      return {
        session,
        rows,
        latest,
        progress:Math.max(latest.size,customAnswers),
        lastActivity:Math.max(snapshotTime,answerTime),
        startedAt:asTime(session.started_at)
      };
    }).sort((a,b)=>
      b.progress-a.progress ||
      b.lastActivity-a.lastActivity ||
      b.startedAt-a.startedAt
    );

    const selected=ranked[0];
    const session=selected.session;
    const rows=selected.rows;
    const latest=selected.latest;

    sessionId=session.id;
    sessionStudentId=user.id;
    sessionStartedAt=asTime(session.started_at)||Date.now();
    totalQuestions=Number(session.total_questions)||0;
    summarySaved=false;
    resumeCustom=session.resume_state?.custom??null;
    restoredAnswers=rows;
    restoreReady=true;
    attemptsByQuestion.clear();
    latestCorrectByQuestion.clear();
    touchedQuestions.clear();
    latest.forEach((row,index)=>{
      attemptsByQuestion.set(index,Math.max(attemptsByQuestion.get(index)||0,Number(row.attempt_number)||1));
      touchedQuestions.add(index);
      latestCorrectByQuestion.set(index,Boolean(row.is_correct));
    });

    const detail={
      session,
      answers:restoredAnswers,
      latestAnswers:Array.from(latest.entries()).map(([index,row])=>({...row,question_index:index})),
      state:session.resume_state||{},
      custom:resumeCustom,
      openSessionCount:sessions.length,
      recoveredProgress:selected.progress
    };
    resumeDetails=detail;
    // Custom quiz engines rebuild their question DOM and attach fresh click
    // handlers from the saved question array. Replaying a captured DOM snapshot
    // here can show the old quiz screen while leaving its old, nonfunctional
    // button state behind after a refresh.
    const engineManagedResumeKinds=new Set([
      "toeic-part5",
      "toeic-part5-drill",
      "toeic-part6-drill",
      "toeic-part6-skill",
      "preposition-challenge",
      "wordformation-sentences",
      "conjunctions-practice"
    ]);
    if(session.resume_state?.dom && !engineManagedResumeKinds.has(resumeCustom?.kind)) {
      restoreDom(session.resume_state.dom);
    }
    window.dispatchEvent(new CustomEvent("englishlab:resume",{detail}));
    note(
      sessions.length>1
        ? "Your saved practice has been restored. We selected the unfinished attempt with the most progress."
        : "Your unfinished practice has been restored. Continue where you left off."
    );
    return true;
  }

  function initialize() {
    if (initializationPromise) return initializationPromise;
    initializationPromise = (async () => {
      let restored = false;
      let available = true;
      try {
        restored = await restoreExistingSession();
        if (!restored) {
          const count = Number(document.body?.dataset.questionCount);
          if (Number.isInteger(count) && count > 0) {
            const started = await ensureSession(count);
            if (!started) available = false;
          }
        }
      } catch (error) {
        available = false;
        console.error("Practice resume check failed:", error);
        note("Could not check for a saved practice. Your account is still signed in; try refreshing.", true);
      }
      const result = { restored, available };
      if (resolveReady) resolveReady(result);
      return result;
    })();
    return initializationPromise;
  }

  document.addEventListener("input",scheduleStateSave,true);
  document.addEventListener("change",scheduleStateSave,true);
  document.addEventListener("click",()=>setTimeout(scheduleStateSave,350),true);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")void persistState();});

  window.EnglishLabTracker = {
    ready,
    record,
    start: ensureSession,
    startNewSession,
    saveState: persistState,
    getResumeState: () => resumeCustom,
    getResumeAnswers: () => restoredAnswers.slice(),
    getResumeDetails: () => resumeDetails,
    get activityId() { return activityId(); }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",initialize,{once:true});
  else initialize();
})();