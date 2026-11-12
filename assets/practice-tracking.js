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
  let restoredAnswers = [];
  let restoreReady = false;
  let saveTimer = null;
  const attemptsByQuestion = new Map();
  const latestCorrectByQuestion = new Map();
  const touchedQuestions = new Set();
  let statusNote = null;

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
    const resume_state = {
      dom: captureDom(),
      custom: resumeCustom,
      saved_at: new Date().toISOString()
    };
    const {error} = await db.from("practice_sessions").update({resume_state}).eq("id", sessionId).eq("student_id", sessionStudentId);
    if (error) {
      console.warn("Could not save resume state:", error);
      note("Your latest screen state could not be saved. Your checked answers are still being recorded.", true);
      return false;
    }
    return true;
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
    if (!sessionId || !sessionStudentId) return;
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
    if (!update) return;
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
      note("All checked answers and your practice result have been saved.");
    }
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
      topic: String(topic).slice(0, 200),
      selected_answer: chosen.slice(0, 2000),
      correct_answer: expected.slice(0, 2000),
      is_correct: isCorrect,
      attempt_number: attemptNumber,
      time_to_answer_seconds: Number.isFinite(Number(payload.timeToAnswerSeconds))
        ? Math.max(0, Math.min(3600, Number(payload.timeToAnswerSeconds)))
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
    if (touchedQuestions.size >= totalQuestions) await finishSession(totalQuestions);
    return true;
  }

  async function startNewSession(total) {
    if (sessionId && !summarySaved) {
      note("Your current practice is saved. Resume it before starting another attempt.", true);
      return sessionId;
    }
    sessionId = null;
    sessionPromise = null;
    sessionStartedAt = null;
    summarySaved = false;
    totalQuestions = 0;
    sessionStudentId = null;
    resumeCustom = null;
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
    const {data:session,error}=await db.from("practice_sessions")
      .select("id,student_id,activity_id,status,started_at,total_questions,resume_state")
      .eq("student_id",user.id).eq("activity_id",id)
      .in("status",["in_progress","abandoned"])
      .order("started_at",{ascending:false}).limit(1).maybeSingle();
    if (error) throw error;
    if (!session) return false;
    sessionId=session.id;
    sessionStudentId=user.id;
    sessionStartedAt=new Date(session.started_at).getTime();
    totalQuestions=Number(session.total_questions)||0;
    summarySaved=false;
    resumeCustom=session.resume_state?.custom??null;
    const {data:answers,error:answerError}=await db.from("practice_answers")
      .select("question_index,selected_answer,correct_answer,is_correct,attempt_number,question_text,topic,error_type,error_detail,answered_at")
      .eq("session_id",session.id).order("answered_at",{ascending:true});
    if(answerError)throw answerError;
    restoredAnswers=answers||[];
    const latest=new Map();
    restoredAnswers.forEach(row=>{
      const index=Number(row.question_index)-1;
      if(index<0)return;
      attemptsByQuestion.set(index,Math.max(attemptsByQuestion.get(index)||0,Number(row.attempt_number)||1));
      latest.set(index,row);
    });
    latest.forEach((row,index)=>{
      touchedQuestions.add(index);
      latestCorrectByQuestion.set(index,Boolean(row.is_correct));
    });
    if(session.resume_state?.dom)restoreDom(session.resume_state.dom);
    restoreReady=true;
    window.dispatchEvent(new CustomEvent("englishlab:resume",{detail:{
      session,
      answers:restoredAnswers,
      latestAnswers:Array.from(latest.entries()).map(([question_index,row])=>({...row,question_index})),
      state:session.resume_state||{},
      custom:resumeCustom
    }}));
    note("Your unfinished practice has been restored. Continue where you left off.");
    return true;
  }

  function initialize() {
    restoreExistingSession().then(restored=>{
      if (!restored) {
        const count=Number(document.body?.dataset.questionCount);
        if (Number.isInteger(count)&&count>0) void ensureSession(count);
      }
    }).catch(error=>{
      console.error("Practice resume check failed:",error);
      note("Could not check for a saved practice. Your account is still signed in; try refreshing.",true);
    });
  }

  document.addEventListener("input",scheduleStateSave,true);
  document.addEventListener("change",scheduleStateSave,true);
  document.addEventListener("click",()=>setTimeout(scheduleStateSave,350),true);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")void persistState();});

  window.EnglishLabTracker = {
    record,
    start: ensureSession,
    startNewSession,
    saveState: persistState,
    getResumeState: () => resumeCustom,
    getResumeAnswers: () => restoredAnswers.slice(),
    get activityId() { return activityId(); }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",initialize,{once:true});
  else initialize();
})();