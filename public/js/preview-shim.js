// Makes AI-generated websites behave inside the sandboxed preview iframe (participant + host pages).
// The sandbox has no same-origin access, so by default: #section links don't scroll, relative links
// (about.html) do nothing, external links replace the whole preview, forms navigate away, and
// localStorage / history.pushState throw SecurityError (which crashes the site's own scripts).
// frameShim() is injected at the very top of the generated page so it runs before the page's own scripts.
function frameShim() {
  if (window.__apwShim) return; window.__apwShim = true;
  var toastEl, toastTimer;
  function toast(msg) {
    try {
      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.setAttribute('role', 'status');
        toastEl.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);max-width:88%;padding:9px 16px;border-radius:999px;background:rgba(15,23,42,.94);color:#fff;font:600 13px/1.3 system-ui,sans-serif;z-index:2147483647;pointer-events:none;box-shadow:0 6px 24px rgba(0,0,0,.35);transition:opacity .2s';
        (document.body || document.documentElement).appendChild(toastEl);
      }
      toastEl.textContent = msg; toastEl.style.opacity = '1';
      clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.style.opacity = '0'; }, 2200);
    } catch (e) {}
  }

  // 1) Storage: the sandbox blocks real storage, so give the page in-memory storage instead.
  function memStore() {
    var d = {};
    return {
      getItem: function (k) { k = String(k); return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
      setItem: function (k, v) { d[String(k)] = String(v); },
      removeItem: function (k) { delete d[String(k)]; },
      clear: function () { d = {}; },
      key: function (i) { return Object.keys(d)[i] || null; },
      get length() { return Object.keys(d).length; }
    };
  }
  ['localStorage', 'sessionStorage'].forEach(function (name) {
    try { window[name].getItem('x'); } catch (e) {
      try { Object.defineProperty(window, name, { value: memStore(), configurable: true }); } catch (e2) {}
    }
  });

  // 2) History API: pushState/replaceState throw in an opaque origin; make them harmless no-ops.
  ['pushState', 'replaceState'].forEach(function (k) {
    try { var orig = history[k]; history[k] = function () { try { return orig.apply(history, arguments); } catch (e) {} }; } catch (e) {}
  });

  // 3) Never open new windows / tabs from the preview (participants must stay in the event).
  window.open = function () { toast('Opening new windows is disabled during the event.'); return null; };

  // Scrolling that accounts for fixed / sticky headers.
  function headerOffset() {
    var h = 0, els = document.querySelectorAll('header,nav,[class*="nav"],[class*="header"],[class*="Header"],[class*="Nav"]');
    for (var i = 0; i < els.length && i < 60; i++) {
      var cs = getComputedStyle(els[i]);
      if (cs.position === 'fixed' || cs.position === 'sticky') {
        var r = els[i].getBoundingClientRect();
        if (r.top <= 2 && r.height < 220 && r.width > window.innerWidth * 0.4) h = Math.max(h, r.bottom);
      }
    }
    return h;
  }
  function scrollToEl(el) {
    var y = el.getBoundingClientRect().top + window.pageYOffset - headerOffset() - 6;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }
  function scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function byId(id) {
    try { id = decodeURIComponent(id); } catch (e) {}
    return document.getElementById(id) || document.getElementsByName(id)[0] || null;
  }
  // Map "about.html", "/contact", "./menu/" ... onto a section of the same page.
  function findSection(raw) {
    var p = raw.split('#')[0].split('?')[0].replace(/^(\.\/|\/)+/, '').replace(/\/$/, '').replace(/\.html?$/i, '').toLowerCase();
    if (!p || p === 'index' || p === 'home') return 'top';
    var last = p.split('/').pop(), hash = raw.indexOf('#') > -1 ? raw.split('#')[1] : '';
    var t = (hash && byId(hash)) || byId(last) || byId(p);
    if (t) return t;
    var all = document.querySelectorAll('[id]');
    for (var i = 0; i < all.length; i++) { var id = all[i].id.toLowerCase(); if (id.indexOf(last) > -1 || (last.length > 3 && last.indexOf(id) > -1 && id.length > 3)) return all[i]; }
    return null;
  }

  // 4) Links
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href],area[href]') : null;
    if (!a) return;
    var raw = (a.getAttribute('href') || '').trim();
    if (/^javascript:/i.test(raw)) return;                       // page's own code handles it
    if (raw === '' || raw === '#' || /^#top$/i.test(raw)) { e.preventDefault(); scrollTop(); return; }
    if (raw.charAt(0) === '#') {
      e.preventDefault();
      var t = byId(raw.slice(1)); if (t) scrollToEl(t); else toast('That section does not exist on this page.');
      return;
    }
    e.preventDefault();
    if (/^(mailto:|tel:|sms:)/i.test(raw)) { toast('Email / phone links are disabled in the preview.'); return; }
    if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(raw) || /^[a-z][a-z0-9+.-]*:/i.test(raw)) { toast('External links are disabled during the event.'); return; }
    var s = findSection(raw);
    if (s === 'top') scrollTop(); else if (s) scrollToEl(s); else { scrollTop(); toast('This preview is a single page — use the section links.'); }
  }, true);

  // 5) Forms must never navigate the preview away; the page's own handlers still run.
  document.addEventListener('submit', function (e) { e.preventDefault(); }, true);

  // 6) Hash changes made by scripts (location.hash = '#x') also get header-aware scrolling.
  window.addEventListener('hashchange', function () {
    var t = byId(location.hash.replace(/^#/, '')); if (t) scrollToEl(t);
  });
}

function preparePreviewHtml(html) {
  if (!html) return '';
  // AI output sometimes includes a restrictive CSP meta tag that blocks inline scripts/eval
  // inside srcdoc. The event preview is already sandboxed, so remove only document CSP tags.
  html = String(html).replace(/<meta[^>]+http-equiv=[\"']?Content-Security-Policy[\"']?[^>]*>/gi, '');
  html = html.replace(/<meta[^>]+content=[\"'][^\"']*(?:script-src|default-src)[^\"']*[\"'][^>]*>/gi, '');
  var tag = '<script>(' + frameShim.toString() + ')();<' + '/script>';
  var m;
  if ((m = /<head(?=[\s>])[^>]*>/i.exec(html))) return html.slice(0, m.index + m[0].length) + tag + html.slice(m.index + m[0].length);
  if ((m = /<html[^>]*>/i.exec(html))) return html.slice(0, m.index + m[0].length) + '<head>' + tag + '</head>' + html.slice(m.index + m[0].length);
  if ((m = /<!doctype[^>]*>/i.exec(html))) return html.slice(0, m.index + m[0].length) + tag + html.slice(m.index + m[0].length);
  return tag + html;
}
window.preparePreviewHtml = preparePreviewHtml;
