(() => {
  const SUPABASE_URL = "https://kehopukcypesrecyfrvp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_zDWMioaroblLV0cRMh-SoQ_RvGYnCE6";
  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.englishLabSupabase = supabaseClient;

  const form = document.getElementById("authForm");
  if (!form) return;
  const message = document.getElementById("authMessage");
  const modeButtons = [...document.querySelectorAll("[data-mode]")];
  const loginFields = document.getElementById("loginFields");
  const registerFields = document.getElementById("registerFields");
  const submit = document.getElementById("authSubmit");
  let mode = "login";

  function say(text, kind = "") { message.textContent = text; message.className = "message " + kind; }
  function setMode(next) {
    mode = next;
    modeButtons.forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
    loginFields.hidden = mode !== "login";
    registerFields.hidden = mode !== "register";
    submit.textContent = mode === "login" ? "Sign in" : "Create student account";
    say("");
  }
  modeButtons.forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  form.addEventListener("submit", async event => {
    event.preventDefault();
    submit.disabled = true;
    say(mode === "login" ? "Signing you in…" : "Creating your account…");
    try {
      if (mode === "register") {
        const full_name = document.getElementById("fullName").value.trim();
        const email = document.getElementById("email").value.trim().toLowerCase();
        const password = document.getElementById("password").value;
        if (!full_name) throw new Error("Please enter your full name.");
        if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
        if (!document.getElementById("email").checkValidity()) throw new Error("Please enter a valid email address.");
        const prom = Number(document.getElementById("prom").value);
        const shift = document.getElementById("shift").value;
        const { data, error } = await supabaseClient.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: "https://julianremyprof.github.io/PracticesSite/dashboard.html",
            data: { full_name, prom, shift }
          }
        });
        if (error) throw error;
        if (data.session) location.href = "dashboard.html";
        else say("Account created. Check your email to confirm your address, then sign in.", "success");
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({
          email: document.getElementById("emailLogin").value.trim().toLowerCase(),
          password: document.getElementById("passwordLogin").value
        });
        if (error) throw error;
        location.href = "dashboard.html";
      }
    } catch (error) {
      say(error.message || "Something went wrong. Please try again.", "error");
    } finally {
      submit.disabled = false;
    }
  });
  setMode("login");
  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) location.href = "dashboard.html";
  });
})();