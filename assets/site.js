(() => {
  'use strict';
  const root = document.documentElement;
  const body = document.body;
  const t = s => (window.timTranslateUI ? window.timTranslateUI(s) : s);
  const searchNormalize = value => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const storageKey = 'timstollery-reading-v1';
  const allowed = { theme: ['system', 'light', 'dark', 'contrast'], size: ['1', '1.25', '1.5', '2'], font: ['standard', 'serif', 'sans'] };
  let preferences = { theme: 'system', size: '1', font: 'standard' };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    for (const key of Object.keys(allowed)) if (allowed[key].includes(saved[key])) preferences[key] = saved[key];
  } catch (_) { /* Reading still works when local storage is unavailable. */ }
  function applyPreferences() {
    if (preferences.theme === 'system') delete body.dataset.theme;
    else body.dataset.theme = preferences.theme;
    body.dataset.font = preferences.font;
    root.style.setProperty('--reading-scale', preferences.size);
    body.dataset.largeText = String(Number(preferences.size) >= 1.5);
    for (const [key, value] of Object.entries(preferences)) {
      const input = document.querySelector('input[name="' + key + '"][value="' + value + '"]');
      if (input) input.checked = true;
    }
  }
  applyPreferences();
  const readingDialog = document.getElementById('reading-dialog');
  const searchDialog = document.getElementById('search-dialog');
  function wireDialog(dialog, trigger) {
    if (!dialog || !trigger || typeof dialog.showModal !== 'function') return;
    trigger.hidden = false;
    trigger.addEventListener('click', () => dialog.showModal());
    dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dialog.close(); }
    });
    dialog.addEventListener('close', () => trigger.focus());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
  }
  const navigationDialog = document.getElementById('navigation-dialog');
  const navigationTrigger = document.getElementById('navigation-open');
  wireDialog(navigationDialog, navigationTrigger);
  if (navigationDialog && typeof navigationDialog.showModal === 'function') root.classList.add('dialogs-ready');
  wireDialog(readingDialog, document.getElementById('reading-open'));
  wireDialog(searchDialog, document.getElementById('search-open'));
  if (readingDialog) {
    readingDialog.addEventListener('change', event => {
      const { name, value } = event.target;
      if (!allowed[name] || !allowed[name].includes(value)) return;
      preferences[name] = value;
      applyPreferences();
      try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch (_) {}
    });
    const reset = document.getElementById('reading-reset');
    if (reset) reset.addEventListener('click', () => {
      preferences = { theme: 'system', size: '1', font: 'standard' };
      applyPreferences();
      try { localStorage.removeItem(storageKey); } catch (_) {}
    });
  }
  const searchInput = document.getElementById('story-search');
  const resultList = document.getElementById('search-results');
  const searchStatus = document.getElementById('search-status');
  const searchPrefix = body.dataset.root || './';
  if (searchInput && resultList && searchStatus) {
    let timer;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const query = searchNormalize(searchInput.value.trim());
        resultList.replaceChildren();
        if (query.length < 2) { searchStatus.textContent = t('Enter at least two characters to search the English diary.'); return; }
        const words = query.split(/\s+/).filter(Boolean);
        const matches = (window.storySearchData || []).filter(item => {
          const haystack = searchNormalize(item.title + ' ' + item.text);
          return words.every(word => haystack.includes(word));
        });
        searchStatus.textContent = matches.length ? matches.length + (matches.length === 1 ? t(' matching section.') : t(' matching sections.')) : t('No matching sections. Try another word.');
        matches.slice(0, 30).forEach(item => {
          const li = document.createElement('li');
          const link = document.createElement('a');
          const resultURL = new URL(searchPrefix + item.url, window.location.href);
          const selectedLanguage = new URLSearchParams(window.location.search).get('lang');
          if (selectedLanguage && selectedLanguage !== 'en') resultURL.searchParams.set('lang',selectedLanguage);
          link.href = resultURL.pathname + resultURL.search + resultURL.hash;
          link.textContent = item.title;
          const p = document.createElement('p');
          const at = searchNormalize(item.text).indexOf(words[0]);
          const from = Math.max(0, at - 65);
          p.textContent = (from ? '…' : '') + item.text.slice(from, from + 210) + (item.text.length > from + 210 ? '…' : '');
          li.append(link, p);
          resultList.append(li);
        });
      }, 150);
    });
    searchDialog.addEventListener('close', () => { searchInput.value = ''; resultList.replaceChildren(); searchStatus.textContent = t('Search the English diary, including dates, people and treatment.'); });
  }
  const photoDialog = document.getElementById('photo-dialog');
  const photoLinks = Array.from(document.querySelectorAll('[data-photo-link]'));
  let currentPhoto = 0;
  let openedPhoto;
  function visiblePhotoLinks() { return photoLinks.filter(link => !link.closest('figure').hidden); }
  function showPhoto(index) {
    const visible = visiblePhotoLinks();
    if (!visible.length) return;
    currentPhoto = (index + visible.length) % visible.length;
    const link = visible[currentPhoto];
    const original = link.querySelector('img');
    const image = document.getElementById('photo-full');
    image.src = (link.dataset.fullImage || (link.querySelector('img') || {}).src || link.href);
    image.alt = original.alt;
    const galleryCaption = link.closest('figure').querySelector('figcaption');
    const period = galleryCaption.querySelector('.photo-period, time');
    const captionTarget = document.getElementById('photo-caption');
    captionTarget.replaceChildren();
    if (period) {
      const dateText = document.createElement('span');
      dateText.className = 'photo-caption-date';
      dateText.textContent = period.textContent.trim();
      captionTarget.append(dateText);
    }
    const description = document.createElement('span');
    description.className = 'photo-caption-description';
    description.textContent = Array.from(galleryCaption.childNodes).filter(node => node !== period).map(node => node.textContent).join(' ').replace(/\s+/g, ' ').trim();
    captionTarget.append(description);
    document.getElementById('photo-position').textContent = (currentPhoto + 1) + t(' of ') + visible.length;
  }
  if (photoDialog && typeof photoDialog.showModal === 'function') {
    photoLinks.forEach(link => link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openedPhoto = link;
      showPhoto(visiblePhotoLinks().indexOf(link));
      photoDialog.showModal();
    }));
    photoDialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => photoDialog.close()));
    photoDialog.addEventListener('close', () => { if (openedPhoto) openedPhoto.focus(); });
    document.getElementById('photo-prev').addEventListener('click', () => showPhoto(currentPhoto - 1));
    document.getElementById('photo-next').addEventListener('click', () => showPhoto(currentPhoto + 1));
    photoDialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); photoDialog.close(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); showPhoto(currentPhoto - 1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); showPhoto(currentPhoto + 1); }
    });
  }
  const filters = document.querySelectorAll('[data-photo-filter]');
  const count = document.getElementById('photo-count');
  if (filters.length) {
    document.getElementById('photo-filters').hidden = false;
    filters.forEach(button => button.addEventListener('click', () => {
      const category = button.dataset.photoFilter;
      let total = 0;
      document.querySelectorAll('[data-photo-category]').forEach(figure => {
        figure.hidden = category !== 'all' && figure.dataset.photoCategory !== category;
        if (!figure.hidden) total += 1;
      });
      filters.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
      if (count) count.textContent = total + (total === 1 ? t(' photograph shown.') : t(' photographs shown.'));
    }));
  }
  document.querySelectorAll('.lang-switch').forEach(details => {
    details.addEventListener('keydown', event => { if (event.key === 'Escape') { details.open = false; details.querySelector('summary').focus(); } });
    document.addEventListener('click', event => { if (!details.contains(event.target)) details.open = false; });
  });
})();
