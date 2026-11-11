(() => {
  'use strict';
  const script = document.currentScript;
  if (!script) return;
  const siteRoot = new URL('../', script.src);
  const mount = document.getElementById('site-header');
  if (!mount) return;

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('assets/site-header.css', siteRoot).href;
  document.head.appendChild(stylesheet);

  fetch(new URL('header.html', siteRoot).href, {cache:'no-cache'})
    .then(response => {
      if (!response.ok) throw new Error('Shared header could not be loaded.');
      return response.text();
    })
    .then(markup => {
      mount.innerHTML = markup;
      mount.querySelectorAll('[data-site-href]').forEach(link => {
        link.href = new URL(link.dataset.siteHref, siteRoot).href;
      });
      const currentPath = window.location.pathname.replace(/\\/+$/, '');
      const toeicPath = new URL('toeic.html', siteRoot).pathname;
      if (currentPath === toeicPath) {
        const active = mount.querySelector('[data-site-route="toeic"]');
        if (active) active.setAttribute('aria-current','page');
      }
    })
    .catch(error => {
      console.error(error);
      mount.textContent = 'English Lab';
    });
})();