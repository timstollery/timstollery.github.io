/* SEO navigation enhancement. English source and language JSON are unchanged. */
(() => {
  'use strict';
  const self = document.currentScript;
  if (!self) return;
  const root = new URL('../', self.src);
  const current = new URL(location.href);
  const page = decodeURIComponent(current.pathname).replace(root.pathname, '').replace(/^\/+/, '') || 'index.html';
  const picked = current.searchParams.get('lang');
  fetch(new URL('assets/seo-pages.json', root), {cache:'no-cache'}).then(r => r.ok ? r.json() : {}).then(pages => {
    function staticLink(code) {
      if (code === 'en') return new URL(page,root).pathname;
      if (!Array.isArray(pages[code]) || !pages[code].includes(page)) return null;
      const url = new URL(code+'/'+page,root);
      return url.pathname+current.hash;
    }
    function adjustLinks(){
      document.querySelectorAll('.language-list a[hreflang]').forEach(a => {
        const target=staticLink(a.getAttribute('hreflang'));
        if (target && a.getAttribute('href')!==target) a.href=target;
      });
    }
    if (picked && staticLink(picked)) {
      const dest=staticLink(picked);
      if (dest!==current.pathname+current.hash) location.replace(dest);
      return;
    }
    adjustLinks();
    const nav=document.querySelector('.language-list');
    if(nav) new MutationObserver(adjustLinks).observe(nav,{childList:true,subtree:true});
  }).catch(() => {});
})();
