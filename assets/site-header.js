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
      const currentPath = window.location.pathname.endsWith('/') ? window.location.pathname.slice(0,-1) : window.location.pathname;
      const toeicPaths = ['toeic.html','toeic-part-1.html','toeic-part-2.html','toeic-part-3.html','toeic-part-4.html','toeic-part-5.html','toeic-part-6.html','toeic-part-7.html'].map(path => new URL(path,siteRoot).pathname);
      if (toeicPaths.includes(currentPath)) {
        const active = mount.querySelector('[data-site-route="toeic"]');
        if (active) active.setAttribute('aria-current','page');
      }
      const match = currentPath.match(/toeic-part-([1-7])\.html$/);
      if (match) {
        const partLink = mount.querySelector('[data-toeic-part="' + match[1] + '"]');
        if (partLink) partLink.setAttribute('aria-current','page');
      }
      const dropdown = mount.querySelector('#toeicNavDropdown');
      const toggle = mount.querySelector('.site-dropdown-toggle');
      if (dropdown && toggle) {
        toggle.addEventListener('click', event => {
          event.preventDefault();
          const open = dropdown.classList.toggle('open');
          toggle.setAttribute('aria-expanded',String(open));
        });
        document.addEventListener('click', event => {
          if (!dropdown.contains(event.target)) {
            dropdown.classList.remove('open');
            toggle.setAttribute('aria-expanded','false');
          }
        });
        document.addEventListener('keydown', event => {
          if (event.key === 'Escape') {
            dropdown.classList.remove('open');
            toggle.setAttribute('aria-expanded','false');
            toggle.focus();
          }
        });
      }
    })
    .catch(error => {
      console.error(error);
      mount.textContent = 'English Lab';
    });
})();