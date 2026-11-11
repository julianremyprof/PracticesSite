(() => {
  const SUPABASE_URL = "https://kehopukcypesrecyfrvp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_zDWMioaroblLV0cRMh-SoQ_RvGYnCE6";
  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.englishLabSupabase = supabaseClient;
  const form=document.getElementById("authForm"); if(!form)return;
  const message=document.getElementById("authMessage"), modeButtons=[...document.querySelectorAll("[data-mode]")];
  const loginFields=document.getElementById("loginFields"), registerFields=document.getElementById("registerFields");
  const submit=document.getElementById("authSubmit"), accountType=document.getElementById("accountType");
  const studentDetails=document.getElementById("studentDetails"), teacherDetails=document.getElementById("teacherDetails");
  let mode="login";
  function say(text,kind=""){message.textContent=text;message.className="message "+kind;}
  function updateAccountType(){
    const isTeacher=accountType.value==="teacher";
    studentDetails.hidden=isTeacher; teacherDetails.hidden=!isTeacher;
    document.getElementById("prom").required=!isTeacher;
    document.getElementById("shift").required=!isTeacher;
  }
  accountType.addEventListener("change",updateAccountType);\n  document.getElementById("email").addEventListener("input",syncAdminOption);
  function setMode(next){
    mode=next;modeButtons.forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
    loginFields.hidden=mode!=="login";registerFields.hidden=mode!=="register";
    submit.textContent=mode==="login"?"Sign in":"Create "+(accountType.value==="admin"?"administrator":accountType.value)+" account";
    say("");
  }
  modeButtons.forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
  accountType.addEventListener("change",updateAccountType);
  form.addEventListener("submit",async event=>{
    event.preventDefault();submit.disabled=true;say(mode==="login"?"Signing you in…":"Creating your account…");
    try{
      if(mode==="register"){
        const full_name=document.getElementById("fullName").value.trim();
        const school_id=document.getElementById("schoolId").value.trim();
        const email=document.getElementById("email").value.trim().toLowerCase();
        const password=document.getElementById("password").value;
        const account_type=accountType.value;
        if(!full_name)throw new Error("Please enter your full name.");
        if(school_id.length<2)throw new Error("Please enter a valid school or staff ID.");
        if(!document.getElementById("email").checkValidity())throw new Error("Please enter a valid email address.");
        if(password.length<8)throw new Error("Use a password with at least 8 characters.");
        const metadata={full_name,school_id,account_type};
        if(account_type==="student"){
          metadata.prom=Number(document.getElementById("prom").value);
          metadata.shift=document.getElementById("shift").value;
        }
        const {data,error}=await supabaseClient.auth.signUp({
          email,password,options:{
            emailRedirectTo:"https://julianremyprof.github.io/PracticesSite/dashboard.html",
            data:metadata
          }
        });
        if(error)throw error;
        if(data.session)location.href="dashboard.html";
        else if(email==="julian.remy.prof@gmail.com")say("Administrator account created. Check your email to confirm your address, then sign in.","success");
        else if(account_type==="teacher")say("Teacher registration received. Confirm your email, then wait for an administrator to approve your teacher access.","success");
        else say("Student account created. Check your email to confirm your address, then sign in.","success");
      }else{
        const {error}=await supabaseClient.auth.signInWithPassword({
          email:document.getElementById("emailLogin").value.trim().toLowerCase(),
          password:document.getElementById("passwordLogin").value
        });
        if(error)throw error;location.href="dashboard.html";
      }
    }catch(error){say(error.message||"Something went wrong. Please try again.","error");}
    finally{submit.disabled=false;}
  });
  syncAdminOption();updateAccountType();setMode("login");
  supabaseClient.auth.getSession().then(({data})=>{if(data.session)location.href="dashboard.html";});
})();