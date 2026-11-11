(() => {
  'use strict';

  const script = document.currentScript;
  const siteRoot = new URL('../', script.src);
  const loginUrl = new URL('student-login.html', siteRoot);

  function redirectToLogin() {
    const requestedPage = window.location.pathname + window.location.search + window.location.hash;
    loginUrl.searchParams.set('redirect', requestedPage);
    window.location.replace(loginUrl.href);
  }

  try {
    if (!window.supabase?.createClient) {
      redirectToLogin();
      return;
    }

    const SUPABASE_URL = 'https://kehopukcypesrecyfrvp.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_zDWMioaroblLV0cRMh-SoQ_RvGYnCE6';
    const client = window.englishLabSupabase || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.englishLabSupabase = client;

    let verified = false;

    client.auth.onAuthStateChange((event, session) => {
      if (verified && (!session || event === 'SIGNED_OUT')) {
        redirectToLogin();
      }
    });

    client.auth.getUser()
      .then(({ data, error }) => {
        verified = true;
        if (error || !data?.user) {
          redirectToLogin();
          return;
        }
        document.documentElement.classList.add('practice-authenticated');
      })
      .catch(() => {
        verified = true;
        redirectToLogin();
      });
  } catch (error) {
    console.error('English Lab practice access check failed:', error);
    redirectToLogin();
  }
})();
