(() => {
  'use strict';
  const script=document.currentScript;
  if(!script)return;
  const siteRoot=new URL('../',script.src);
  const mount=document.getElementById('site-header');
  if(!mount)return;

  const stylesheet=document.createElement('link');
  stylesheet.rel='stylesheet';
  stylesheet.href=new URL('assets/site-header.css',siteRoot).href;
  document.head.appendChild(stylesheet);

  fetch(new URL('header.html',siteRoot).href,{cache:'no-cache'})
    .then(response=>{if(!response.ok)throw new Error('Shared header could not be loaded.');return response.text();})
    .then(markup=>{
      mount.innerHTML=markup;
      mount.querySelectorAll('[data-site-href]').forEach(link=>{
        link.href=new URL(link.dataset.siteHref,siteRoot).href;
      });

      const currentPath=window.location.pathname.endsWith('/')?window.location.pathname.slice(0,-1):window.location.pathname;
      const toeicPages=['toeic.html',...Array.from({length:7},(_,i)=>'toeic-part-'+(i+1)+'.html')].map(path=>new URL(path,siteRoot).pathname);
      if(toeicPages.includes(currentPath)){
        const link=mount.querySelector('[data-site-route="toeic"]');
        if(link)link.setAttribute('aria-current','page');
      }
      const partMatch=currentPath.match(/toeic-part-([1-7])\.html$/);
      if(partMatch){
        const partLink=mount.querySelector('[data-toeic-part="'+partMatch[1]+'"]');
        if(partLink)partLink.setAttribute('aria-current','page');
      }

      const dropdown=mount.querySelector('#toeicNavDropdown');
      const dropdownToggle=mount.querySelector('.el-dropdown-toggle');
      if(dropdown&&dropdownToggle){
        dropdownToggle.addEventListener('click',event=>{
          event.preventDefault();
          const open=dropdown.classList.toggle('open');
          dropdownToggle.setAttribute('aria-expanded',String(open));
        });
      }

      const menu=mount.querySelector('#siteMobileMenu');
      const menuToggle=mount.querySelector('#siteMenuToggle');
      const mobileGroup=mount.querySelector('#mobileToeicGroup');
      const mobileSubToggle=mount.querySelector('.el-mobile-sub-toggle');
      const closeMenu=()=>{
        if(!menu||!menuToggle)return;
        menu.classList.remove('open');
        menu.setAttribute('aria-hidden','true');
        menuToggle.setAttribute('aria-expanded','false');
        menuToggle.setAttribute('aria-label','Open navigation menu');
        document.body.style.overflow='';
      };
      if(menu&&menuToggle){
        menuToggle.addEventListener('click',()=>{
          const open=!menu.classList.contains('open');
          menu.classList.toggle('open',open);
          menu.setAttribute('aria-hidden',String(!open));
          menuToggle.setAttribute('aria-expanded',String(open));
          menuToggle.setAttribute('aria-label',open?'Close navigation menu':'Open navigation menu');
          document.body.style.overflow=open?'hidden':'';
        });
        menu.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
      }
      if(mobileGroup&&mobileSubToggle){
        mobileSubToggle.addEventListener('click',()=>{
          const open=mobileGroup.classList.toggle('open');
          mobileSubToggle.setAttribute('aria-expanded',String(open));
        });
      }
      document.addEventListener('click',event=>{
        if(dropdown&&!dropdown.contains(event.target)){
          dropdown.classList.remove('open');
          if(dropdownToggle)dropdownToggle.setAttribute('aria-expanded','false');
        }
      });
      document.addEventListener('keydown',event=>{
        if(event.key==='Escape'){
          if(dropdown){
            dropdown.classList.remove('open');
            if(dropdownToggle)dropdownToggle.setAttribute('aria-expanded','false');
          }
          closeMenu();
        }
      });
    })
    .catch(error=>{console.error(error);mount.textContent='English Lab';});
})();