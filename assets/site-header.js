(() => {
  'use strict';

  const script = document.currentScript;
  if (!script) return;

  // This script lives in /assets/, so the parent directory is the site root.
  const siteRoot = new URL('../', script.src);
  const mount = document.getElementById('site-header');
  if (!mount) return;

  // Resolve favicon assets relative to the GitHub Pages project path.
  document.head.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')
    .forEach(link => link.remove());
  [
    { rel: 'icon', href: 'favicon.ico', sizes: 'any' },
    { rel: 'icon', href: 'favicon-32x32.png', type: 'image/png', sizes: '32x32' },
    { rel: 'icon', href: 'favicon-16x16.png', type: 'image/png', sizes: '16x16' },
    { rel: 'apple-touch-icon', href: 'apple-touch-icon.png', sizes: '180x180' },
    { rel: 'manifest', href: 'site.webmanifest' }
  ].forEach(config => {
    const link = document.createElement('link');
    Object.entries(config).forEach(([key, value]) => { link[key] = value; });
    link.href = new URL(config.href, siteRoot).href;
    document.head.appendChild(link);
  });

  const version = '20261112-4';
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('assets/site-header.css?v=' + version, siteRoot).href;
  const stylesheetReady = new Promise(resolve => {
    stylesheet.addEventListener('load', resolve, { once: true });
    stylesheet.addEventListener('error', resolve, { once: true });
  });
  document.head.appendChild(stylesheet);

  const headerReady = fetch(new URL('header.html?v=' + version, siteRoot).href, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('Shared header could not be loaded (' + response.status + ').');
      return response.text();
    });

  Promise.all([headerReady, stylesheetReady])
    .then(([markup]) => {
      mount.innerHTML = markup;

      mount.querySelectorAll('[data-site-href]').forEach(link => {
        link.href = new URL(link.dataset.siteHref, siteRoot).href;
      });

      if (!window.location.pathname.toLowerCase().endsWith('/chat.html')) {
      const toeicPages = ['toeic.html', ...Array.from({ length: 7 }, (_, i) => 'toeic-part-' + (i + 1) + '.html')]
        .map(path => new URL(path, siteRoot).pathname);

      if (toeicPages.includes(currentPath)) {
        mount.querySelector('.el-toeic-link')?.setAttribute('aria-current', 'page');
      }

      const partMatch = currentPath.match(/toeic-part-([1-7])\.html$/);
      if (partMatch) {
        mount.querySelectorAll('[data-toeic-part="' + partMatch[1] + '"]').forEach(link => {
          link.setAttribute('aria-current', 'page');
        });
      }

      const dropdown = mount.querySelector('#toeicNavDropdown');
      const dropdownToggle = mount.querySelector('.el-dropdown-toggle');
      const closeDropdown = () => {
        dropdown?.classList.remove('open');
        dropdownToggle?.setAttribute('aria-expanded', 'false');
      };

      if (dropdown && dropdownToggle) {
        dropdownToggle.addEventListener('click', event => {
          event.preventDefault();
          const open = dropdown.classList.toggle('open');
          dropdownToggle.setAttribute('aria-expanded', String(open));
        });
        dropdown.querySelectorAll('.el-dropdown-menu a').forEach(link => {
          link.addEventListener('click', closeDropdown);
        });
      }

      const menu = mount.querySelector('#siteMobileMenu');
      const menuToggle = mount.querySelector('#siteMenuToggle');
      const mobileGroup = mount.querySelector('#mobileToeicGroup');
      const mobileSubToggle = mount.querySelector('.el-mobile-sub-toggle');

      const closeMenu = () => {
        if (!menu || !menuToggle) return;
        menu.classList.remove('open');
        menu.setAttribute('aria-hidden', 'true');
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-label', 'Open navigation menu');
        document.body.style.overflow = '';
      };

      if (menu && menuToggle) {
        menuToggle.addEventListener('click', () => {
          const open = !menu.classList.contains('open');
          menu.classList.toggle('open', open);
          menu.setAttribute('aria-hidden', String(!open));
          menuToggle.setAttribute('aria-expanded', String(open));
          menuToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
          document.body.style.overflow = open ? 'hidden' : '';
        });
        menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
        menu.addEventListener('click', event => {
          if (event.target === menu) closeMenu();
        });
      }

      if (mobileGroup && mobileSubToggle) {
        mobileSubToggle.addEventListener('click', () => {
          const open = mobileGroup.classList.toggle('open');
          mobileSubToggle.setAttribute('aria-expanded', String(open));
        });
      }

      document.addEventListener('click', event => {
        if (dropdown && !dropdown.contains(event.target)) closeDropdown();
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          closeDropdown();
          closeMenu();
        }
      });
      window.addEventListener('resize', () => {
        if (window.matchMedia('(min-width: 901px)').matches) closeMenu();
      });
      if (!/\\/chat\\.html$/i.test(window.location.pathname)) {
        const chatWidget = document.createElement('script');
        chatWidget.src = new URL('assets/chat-widget.js?v=20261112-4', siteRoot).href;
        chatWidget.defer = true;
        document.body.appendChild(chatWidget);
      }
    })
    .catch(error => {
      console.error('English Lab navigation:', error);
      mount.textContent = 'English Lab';
    });
})();
