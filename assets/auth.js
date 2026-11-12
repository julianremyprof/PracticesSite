(() => {
  const SUPABASE_URL = "https://kehopukcypesrecyfrvp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_zDWMioaroblLV0cRMh-SoQ_RvGYnCE6";
  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.englishLabSupabase = supabaseClient;
  const siteRoot = new URL("../", document.currentScript.src);
  const dashboardUrl = new URL("dashboard.html", siteRoot).href;

  function getAfterAuthUrl() {
    const requested = new URLSearchParams(window.location.search).get("redirect");
    if (!requested) return dashboardUrl;
    try {
      const destination = new URL(requested, siteRoot);
      const loginPath = new URL("student-login.html", siteRoot).pathname;
      if (
        destination.origin !== window.location.origin ||
        !destination.pathname.startsWith(siteRoot.pathname) ||
        destination.pathname === loginPath
      ) return dashboardUrl;
      return destination.href;
    } catch {
      return dashboardUrl;
    }
  }

  const afterAuthUrl = getAfterAuthUrl();

  const form = document.getElementById("authForm");
  if (!form) return;
  const message = document.getElementById("authMessage");
  const modeButtons = [...document.querySelectorAll("[data-mode]")];
  const loginFields = document.getElementById("loginFields");
  const registerFields = document.getElementById("registerFields");
  const submit = document.getElementById("authSubmit");
  const accountType = document.getElementById("accountType");
  const studentDetails = document.getElementById("studentDetails");
  const staffDetails = document.getElementById("teacherDetails");
  const emailInput = document.getElementById("email");
  let mode = "login";

  function say(text, kind = "") {
    message.textContent = text;
    message.className = "message " + kind;
  }

  function updateAccountType() {
    const type = accountType.value;
    const isStudent = type === "student";
    const isAdmin = type === "admin";
    studentDetails.hidden = !isStudent;
    staffDetails.hidden = isStudent;
    document.getElementById("prom").required = isStudent;
    document.getElementById("educationalCenter").required = isStudent;
    document.getElementById("groupCode").required = isStudent;
    document.getElementById("staffHint").innerHTML = isAdmin
      ? 'Prom: <strong>N/A</strong>. Administrator access is reserved for the designated administrator email.'
      : 'Prom: <strong>N/A</strong>. Teacher accounts require administrator approval before teacher tools and student reports become available.';
    if (mode === "register") {
      submit.textContent = "Create " + (isAdmin ? "administrator" : type) + " account";
    }
  }

  function syncAdminOption() {
    const isDesignatedAdmin = emailInput.value.trim().toLowerCase() === "julian.remy.prof@gmail.com";
    const adminOption = accountType.querySelector('option[value="admin"]');
    adminOption.hidden = !isDesignatedAdmin;
    if (isDesignatedAdmin) accountType.value = "admin";
    else if (accountType.value === "admin") accountType.value = "student";
    updateAccountType();
  }

  function setMode(next) {
    mode = next;
    modeButtons.forEach(button => button.classList.toggle("active", button.dataset.mode === mode));
    loginFields.hidden = mode !== "login";
    registerFields.hidden = mode !== "register";
    submit.textContent = mode === "login"
      ? "Sign in"
      : "Create " + (accountType.value === "admin" ? "administrator" : accountType.value) + " account";
    say("");
  }

  modeButtons.forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode)));
  accountType.addEventListener("change", updateAccountType);
  emailInput.addEventListener("input", syncAdminOption);
  const groupInput = document.getElementById("groupCode");
  groupInput.addEventListener("input", () => {
    const start = groupInput.selectionStart;
    groupInput.value = groupInput.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 12);
    try { groupInput.setSelectionRange(start, start); } catch {}
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    submit.disabled = true;
    say(mode === "login" ? "Signing you in…" : "Creating your account…");
    try {
      if (mode === "register") {
        const full_name = document.getElementById("fullName").value.trim();
        const email = emailInput.value.trim().toLowerCase();
        const password = document.getElementById("password").value;
        const account_type = accountType.value;

        if (!full_name) throw new Error("Please enter your full name.");
        if (!emailInput.checkValidity()) throw new Error("Please enter a valid email address.");
        if (password.length < 8) throw new Error("Use a password with at least 8 characters.");

        const metadata = { full_name, account_type };
        if (account_type === "student") {
          metadata.prom = Number(document.getElementById("prom").value);
          metadata.educational_center = document.getElementById("educationalCenter").value.trim();
          metadata.group_code = document.getElementById("groupCode").value.trim().toUpperCase();
          if (!metadata.educational_center || metadata.educational_center.length < 2) throw new Error("Enter your Educational Center.");
          if (!/^[A-Z0-9][A-Z0-9_-]{0,11}$/.test(metadata.group_code)) throw new Error("Use a group code such as AM, PM, A, B, or C.");
        }

        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: "https://julianremyprof.github.io/PracticesSite/dashboard.html",
            data: metadata
          }
        });
        if (error) throw error;
        if (data.session) {
          location.href = afterAuthUrl;
        } else if (email === "julian.remy.prof@gmail.com") {
          say("Administrator account created. Check your email to confirm your address, then sign in.", "success");
        } else if (account_type === "teacher") {
          say("Teacher registration received. Confirm your email, then wait for an administrator to approve your teacher access.", "success");
        } else {
          say("Account created. Check your email to confirm your address, then sign in.", "success");
        }
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({
          email: document.getElementById("emailLogin").value.trim().toLowerCase(),
          password: document.getElementById("passwordLogin").value
        });
        if (error) throw error;
        location.href = afterAuthUrl;
      }
    } catch (error) {
      say(error.message || "Something went wrong. Please try again.", "error");
    } finally {
      submit.disabled = false;
    }
  });

  syncAdminOption();
  setMode("login");
  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) location.href = afterAuthUrl;
  });
})();