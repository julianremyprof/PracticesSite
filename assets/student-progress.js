(() => {
  const URL = "https://kehopukcypesrecyfrvp.supabase.co";
  const KEY = "sb_publishable_zDWMioaroblLV0cRMh-SoQ_RvGYnCE6";
  const client = window.englishLabSupabase || window.supabase.createClient(URL, KEY);
  window.englishLabSupabase = client;
  let startedAt = Date.now();
  let saved = false;
  window.saveEnglishLabAttempt = async (score, total, activityId) => {
    if (saved || !Number.isFinite(Number(score)) || !Number.isFinite(Number(total)) || Number(total) < 1) return;
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;
    const { error } = await client.from("attempts").insert({
      student_id: user.id,
      activity_id: activityId || document.body.dataset.activityId,
      score: Math.max(0, Math.min(Number(total), Number(score))),
      total_questions: Number(total),
      accuracy: Math.round((Number(score) / Number(total)) * 10000) / 100,
      duration_seconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000))
    });
    if (!error) {
      saved = true;
      const note = document.getElementById("progressSaveNote");
      if (note) note.textContent = "Your result has been saved to your English Lab account.";
    }
  };
  const nav = document.querySelector(".site-topbar");
  if (nav) {
    const link = document.createElement("a");
    link.className = "site-library-link";
    link.href = "../student-login.html";
    link.textContent = "Student account";
    nav.appendChild(link);
    client.auth.getUser().then(({ data }) => {
      if (data.user) link.textContent = "My progress";
    });
  }
})();