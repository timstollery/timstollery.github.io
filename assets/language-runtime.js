/* Tim Stollery: dynamic, static-host-compatible language packs.
   English HTML is always the no-JavaScript fallback.
   Language packs are curated local files, not an online translation service. */
(() => {
  'use strict';
  const script = document.currentScript;
  const root = new URL('../', script.src);
  const languageFolder = new URL('languages/', root);
  const current = new URL(window.location.href);
  const choice = current.searchParams.get('lang') || 'en';
  const englishCode = 'en';
  let uiDictionary = {};
  window.timTranslateUI = function(value) {
    return typeof value === 'string' ? (uiDictionary[value] ?? value) : value;
  };
  const pagePath = decodeURIComponent(current.pathname).slice(root.pathname.length).replace(/^\/+/, '') || 'index.html';
  const pageName = pagePath.endsWith('/') ? pagePath + 'index.html' : pagePath;
  const menu = document.querySelector('.language-list') || document.querySelector('.standalone-language');
  const originalMain = document.querySelector('main');

  function pageLink(code) {
    const u = new URL(current.href);
    if (code === englishCode) u.searchParams.delete('lang');
    else u.searchParams.set('lang', code);
    return u.pathname + u.search + u.hash;
  }
  function setMenu(entries) {
    if (!menu) return;
    menu.replaceChildren();
    // A flag is only a visual cue. Keep the language name for clarity and screen readers.
    const items = [{code:'en',name:'English',flag:'🇬🇧'}, ...entries];
    const selected = items.find(l => l.code === choice) || items[0];
    const summary = menu.closest('.lang-switch')?.querySelector('summary');
    function labelledFlag(lang, container) {
      if (typeof lang.flag === 'string' && lang.flag) {
        const icon = document.createElement('span');
        icon.className = 'language-flag';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = lang.flag;
        container.appendChild(icon);
      }
      const label = document.createElement('span');
      label.className = 'language-label';
      label.textContent = lang.name;
      container.appendChild(label);
    }
    if (summary) {
      summary.replaceChildren();
      labelledFlag(selected, summary);
      summary.setAttribute('aria-label', (uiDictionary['Language'] || 'Language') + ' : ' + selected.name);
      summary.lang = selected.code;
    }
    for (const l of items) {
      const a = document.createElement('a');
      a.href = pageLink(l.code);
      a.lang = l.code;
      a.hreflang = l.code;
      labelledFlag(l, a);
      if (l.code === selected.code) a.setAttribute('aria-current','page');
      menu.appendChild(a);
    }
  }
  function replaceMarkedText(fields) {
    if (!fields || typeof fields !== 'object') return;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const value = fields[el.getAttribute('data-i18n')];
      if (typeof value === 'string') el.textContent = value;
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      const key = el.getAttribute('data-i18n-attr');
      const entry = fields[key];
      if (!entry || typeof entry !== 'object') return;
      for (const attr of ['alt','title','aria-label','placeholder']) {
        if (typeof entry[attr] === 'string') el.setAttribute(attr,entry[attr]);
      }
    });
  }
  function translateSharedInterface(chrome) {
    if (!chrome || typeof chrome !== 'object') return;
    // Only site chrome, dialogs and footer. Main content has separate per-page translation.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const pending=[];
    while(walker.nextNode()) {
      const text=walker.currentNode;
      const parent=text.parentElement;
      if (!parent || parent.closest('main,script,style,textarea,[data-i18n],.language-list')) continue;
      const key=(text.textContent||'').trim();
      if (key && typeof chrome[key]==='string') pending.push([text,chrome[key]]);
    }
    document.querySelectorAll('[lang="en-GB"]').forEach(el=>{
      if(!el.closest('main') && !el.closest('.language-list'))el.lang=choice;
    });
    for(const [node,value] of pending) {
      const current=node.textContent || '';
      node.textContent=current.replace(/\S[\s\S]*\S|\S/,()=>value);
    }
    for(const el of document.querySelectorAll('body [aria-label],body [placeholder],body [title]')) {
      if (el.closest('main')) continue;
      for(const attr of ['aria-label','placeholder','title']) {
        const old=el.getAttribute(attr);
        if (old && typeof chrome[old]==='string') el.setAttribute(attr,chrome[old]);
      }
    }
  }
  // Only text nodes can be translated: the English page remains the sole source
  // of HTML structure, buttons, links, IDs and interactive behaviour.
  function translateTextNodes(nodes) {
    if (!Array.isArray(nodes) || !originalMain || nodes.length===0) return false;
    const walker=document.createTreeWalker(originalMain,NodeFilter.SHOW_TEXT);
    const currentNodes=[];
    while (walker.nextNode()) {
      const node=walker.currentNode;
      if (!node.textContent.trim() || node.parentElement?.closest('script,style,template,.standalone-language,.language-list'))continue;
      currentNodes.push(node);
    }
    // Fail safely if an English page has changed: never attach the wrong text
    // to a different label, link or paragraph.
    if (currentNodes.length!==nodes.length || nodes.some((entry,i)=>
      !entry || typeof entry.source!=='string' || typeof entry.text!=='string' ||
      currentNodes[i].textContent.trim()!==entry.source.trim())) {
      console.warn('Translation does not match this page; leaving English content unchanged.');
      return false;
    }
    currentNodes.forEach((node,i)=>{
      const raw=node.nodeValue;
      const leading=raw.match(/^\s*/)?.[0]||'';
      const trailing=raw.match(/\s*$/)?.[0]||'';
      node.nodeValue=leading+nodes[i].text+trailing;
    });
    return true;
  }
  function translateAttributes(attributes) {
    const candidates=[];
    for(const el of originalMain.querySelectorAll('[alt],[title],[aria-label],[placeholder]')) {
      if(el.closest('.standalone-language'))continue;
      for(const attribute of ['alt','title','aria-label','placeholder']) {
        const value=el.getAttribute(attribute);
        if(value && value.trim())candidates.push({el,attribute,value:value.trim()});
      }
    }
    // Validate every attribute before changing any of them.
    if(candidates.length!==attributes.length || attributes.some((entry,i)=>
      entry.attribute!==candidates[i].attribute || entry.source!==candidates[i].value)) {
      console.warn('Translated attributes do not match this page; leaving them in English.');
      return;
    }
    candidates.forEach((item,i)=>item.el.setAttribute(item.attribute,attributes[i].text));
  }
  function translateDynamicText(dict) {
    if(!dict || typeof dict!=='object')return;
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()) {
      const n=walker.currentNode;
      if(n.parentElement?.closest('main,script,style,textarea,.language-list'))continue;
      const raw=n.nodeValue;
      const key=raw.trim();
      if(typeof dict[key]==='string' && dict[key]!==key) {
        n.nodeValue=raw.replace(key,dict[key]);
      }
    }
  }
  function rewriteInternalLinks(code) {
    if(code==='en')return;
    document.querySelectorAll('a[href]').forEach(a=>{
      if (a.closest('.language-list,.standalone-language') || a.hasAttribute('download'))return;
      const href=a.getAttribute('href');
      if(!href || /^(?:#|mailto:|tel:|javascript:)/i.test(href))return;
      try {
        const url=new URL(href,current.href);
        if(url.origin!==current.origin || !url.pathname.startsWith(root.pathname))return;
        if(!(/\.html$/i.test(url.pathname) || url.pathname.endsWith('/')))return;
        url.searchParams.set('lang',code);
        a.href=url.pathname+url.search+url.hash;
      }catch(_){ /* leave unusual URLs alone */ }
    });
  }
  function translateDownloads(downloads) {
    if(!downloads || typeof downloads!=='object')return;
    document.querySelectorAll('a[download][href]').forEach(a=>{
      const source=new URL(a.getAttribute('href'),current.href);
      if(source.origin!==root.origin || !source.pathname.startsWith(root.pathname))return;
      const key=source.pathname.slice(root.pathname.length);
      const translated=downloads[key];
      if(!translated || typeof translated.href!=='string')return;
      const target=new URL(translated.href,root);
      if(target.origin!==root.origin || !target.pathname.startsWith(root.pathname))return;
      a.href=target.href;
      if(typeof translated.filename==='string')a.download=translated.filename;
    });
  }
  function showEnglishFallback(lang) {
    if(!originalMain || !originalMain.isConnected)return;
    originalMain.lang='en-GB';
    const banner=document.createElement('aside');
    banner.className='translation-pending';
    banner.lang=lang;
    banner.setAttribute('role','note');
    const title=document.createElement('strong');
    const note=document.createElement('span');
    if(lang==='fr') {
      title.textContent='Ce chapitre est disponible en anglais.';
      note.textContent=' La traduction française de cette page n’est pas encore disponible.';
    }else {
      title.textContent='Translation not yet available.';
      note.textContent=' This page is currently available in English.';
    }
    banner.append(title,note);
    originalMain.insertAdjacentElement('afterbegin',banner);
  }
  async function loadJSON(url) {
    const response=await fetch(url,{cache:'no-cache'});
    if(!response.ok)throw new Error('Missing language file '+response.status);
    return await response.json();
  }
  async function init() {
    let installed=[];
    try {
      const manifest=await loadJSON(new URL('index.json',languageFolder));
      installed=Array.isArray(manifest.languages)?manifest.languages.filter(l=>l && /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(l.code) && typeof l.name==='string'):[];
    }catch(e){console.warn('Language menu unavailable:',e.message);}
    setMenu(installed);
    if(choice==='en')return;
    if(!installed.some(l=>l.code===choice))return;
    let pack;
    try {pack=await loadJSON(new URL(choice+'.json',languageFolder));}
    catch(e){console.warn(e.message);showEnglishFallback(choice);return;}
    if(pack.lang!==choice || typeof pack.pages!=='object')return;
    uiDictionary=Object.assign({},pack.chrome || {},pack.dynamic || {});
    setMenu(installed);
    const entry=pack.pages[pageName];
    const didTranslate=Boolean(entry && (
      (Array.isArray(entry.nodes) && translateTextNodes(entry.nodes)) ||
      (entry.fields && replaceMarkedText(entry.fields)!==false)
    ));
    if(entry && typeof entry.title==='string' && didTranslate) document.title=entry.title;
    if(entry && Array.isArray(entry.attributes) && didTranslate) translateAttributes(entry.attributes);
    if(entry && typeof entry.description==='string' && didTranslate) {
      const meta=document.querySelector('meta[name="description"]');
      if(meta)meta.content=entry.description;
    }
    if(didTranslate) {
      originalMain.lang=choice;
      originalMain.querySelectorAll('[lang="en-GB"],[lang="en"]').forEach(el=>{
        if(!el.closest('.standalone-language,.language-list'))el.lang=choice;
      });
      for(const name of ['og:title','twitter:title','og:description','twitter:description']) {
        const meta=document.querySelector('meta[property="'+name+'"],meta[name="'+name+'"]');
        const value=name.endsWith('title')?entry.title:entry.description;
        if(meta && typeof value==='string')meta.content=value;
      }
      const locale=document.querySelector('meta[property="og:locale"]');
      if(locale && typeof pack.locale==='string')locale.content=pack.locale;
      translateDownloads(pack.downloads);
    }
    document.documentElement.lang=choice;
    translateSharedInterface(pack.chrome);
    // Replace dynamic text that had already been placed into the document.
    translateDynamicText(uiDictionary);
    rewriteInternalLinks(choice);
    if(!didTranslate)showEnglishFallback(choice);
    if(didTranslate && Array.isArray(pack.searchData)) window.storySearchData = pack.searchData;
    if(current.hash) {
      const target=document.getElementById(decodeURIComponent(current.hash.slice(1)));
      if(target)requestAnimationFrame(()=>target.scrollIntoView());
    }
  }
  window.timLanguageReady=init();
})();
