(() => {
  const SUPABASE_URL = "https://kehopukcypesrecyfrvp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_zDWMioaroblLV0cRMh-SoQ_RvGYnCE6";
  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.englishLabSupabase = supabaseClient;

  const form = document.getElementById("authForm");
  if (!form) return;
  const message = document.getElementById("authMessage");
  const modeButtons = [...document.querySelectorAll("[data-mode]")];
  const loginMethod = document.getElementById("loginMethod");
  const loginFields = document.getElementById("loginFields");
  const registerFields = document.getElementById("registerFields");
  const submit = document.getElementById("authSubmit");
  let mode = "login";
  let method = "email";

  function say(text, kind = "") { message.textContent = text; message.className = "message " + kind; }
  function setMode(next) {
    mode = next;
    modeButtons.forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
    loginFields.hidden = mode !== "login";
    registerFields.hidden = mode !== "register";
    loginMethod.hidden = mode !== "login";
    submit.textContent = mode === "login" ? "Sign in" : "Create student account";
    say("");
  }
  function setMethod(next) {
    method = next;
    document.getElementById("emailLoginField").hidden = method !== "email";
    document.getElementById("usernameLoginField").hidden = method !== "username";
    document.getElementById("emailLogin").required = method === "email";
    document.getElementById("usernameLogin").required = method === "username";
  }
  modeButtons.forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  document.querySelectorAll("[data-method]").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll("[data-method]").forEach(x => x.classList.toggle("active", x === b));
    setMethod(b.dataset.method);
  }));
  form.addEventListener("submit", async event => {
    event.preventDefault();
    submit.disabled = true;
    say(mode === "login" ? "Signing you in…" : "Creating your account…");
    try {
      if (mode === "register") {
        const full_name = document.getElementById("fullName").value.trim();
        const username = document.getElementById("username").value.trim().toLowerCase();
        const email = document.getElementById("email").value.trim().toLowerCase();
        const password = document.getElementById("password").value;
        const prom = Number(document.getElementById("prom").value);
        const shift = document.getElementById("shift").value;
        if (!/^[a-z0-9._-]{3,24}$/.test(username)) throw new Error("Username must be 3–24 characters (letters, numbers, dots, underscores or hyphens).");
        const { data, error } = await supabaseClient.auth.signUp({
          email, password,
          options: { data: { full_name, username, prom, shift } }
        });
        if (error) throw error;
        if (data.session) location.href = "dashboard.html";
        else say("Account created. Check your email to confirm your address, then sign in.", "success");
      } else if (method === "email") {
        const { error } = await supabaseClient.auth.signInWithPassword({
          email: document.getElementById("emailLogin").value.trim(),
          password: document.getElementById("passwordLogin").value
        });
        if (error) throw error;
        location.href = "dashboard.html";
      } else {
        const response = await fetch(SUPABASE_URL + "/functions/v1/username-login", {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
          body: JSON.stringify({
            username: document.getElementById("usernameLogin").value.trim(),
            password: document.getElementById("passwordLogin").value
          })
        });
        const result = await response.json();
        if (!response.ok || !result.session) throw new Error(result.error || "Invalid username or password.");
        const { error } = await supabaseClient.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token
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
  setMethod("email");
  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) location.href = "dashboard.html";
  });
})();