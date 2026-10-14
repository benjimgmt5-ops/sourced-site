/* Sourced. — applies the content saved in the back end (/admin) to the page.
   Loaded at the end of index.html, after the main site script. */
(function () {
  'use strict';
  var EDIT = /[?&]edit=1\b/.test(location.search) && window.parent !== window;
  var SKIP = '#chat,form,.item,#view-item,.reelgrid,script,style,svg,dialog,elevenlabs-convai,.dd-menu,#lb,noscript';
  var TAB_CAT = { properties: 'Properties', cars: 'Cars', transport: 'Transport', security: 'Security', crew: 'Crew & Kit', misc: 'Miscellaneous' };
  var G = (function () { try { return GALS; } catch (_) { return {}; } })();
  var I = (function () { try { return IMGS; } catch (_) { return {}; } })();

  /* ---------- stable addresses for every editable bit, taken from the untouched page ---------- */
  function pathOf(el) {
    var parts = [], n = el;
    while (n && n !== document.body && !n.id) {
      var p = n.parentElement; if (!p) break;
      parts.unshift(':nth-child(' + (Array.prototype.indexOf.call(p.children, n) + 1) + ')');
      n = p;
    }
    var root = (!n || n === document.body) ? 'body' : '#' + CSS.escape(n.id);
    return root + (parts.length ? '>' + parts.join('>') : '');
  }
  function hasOwnText(el) {
    for (var i = 0; i < el.childNodes.length; i++) {
      var c = el.childNodes[i];
      if (c.nodeType === 3 && c.nodeValue.trim()) return true;
    }
    return false;
  }
  var textEls = [], imgEls = [];
  document.querySelectorAll('body *').forEach(function (el) {
    if (el.closest(SKIP)) return;
    if (el.tagName === 'IMG') { imgEls.push(el); el.dataset.p = pathOf(el); return; }
    if (/^(BUTTON|INPUT|TEXTAREA|SELECT|OPTION|CANVAS|VIDEO)$/.test(el.tagName)) return;
    if (!hasOwnText(el)) return;
    var up = el.parentElement, nested = false;
    while (up && up !== document.body) { if (up.dataset && up.dataset.t) { nested = true; break; } up = up.parentElement; }
    if (nested) return;
    el.dataset.t = '1'; el.dataset.p = pathOf(el); textEls.push(el);
  });

  /* ---------- safe HTML for edited text: only bold/italic/line breaks ---------- */
  function clean(html) {
    var t = document.createElement('template'); t.innerHTML = String(html);
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 1) {
          walk(c);
          if (/^(B|STRONG|I|EM|BR|SPAN)$/.test(c.tagName)) {
            Array.prototype.slice.call(c.attributes).forEach(function (a) { c.removeAttribute(a.name); });
          } else {
            var f = document.createDocumentFragment();
            if (c.tagName === 'DIV' || c.tagName === 'P') f.appendChild(document.createElement('br'));
            while (c.firstChild) f.appendChild(c.firstChild);
            c.replaceWith(f);
          }
        } else if (c.nodeType !== 3) c.remove();
      });
    })(t.content);
    return t.innerHTML.replace(/^(<br>)+/, '');
  }

  function q(sel) { try { return document.querySelector(sel); } catch (_) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var keyN = 0;
  function imgKey(url) { if (/^k:/.test(url)) return url.slice(2); var k ='u' + (++keyN) + '_' + Math.random().toString(36).slice(2, 7); I[k] = url; return k; }

  /* ---------- listings ---------- */
  function cardFor(id) { var b = q('.open[data-g="' + CSS.escape(id) + '"]'); return b && b.closest('.item'); }
  function updateCounts() {
    document.querySelectorAll('.group').forEach(function (g) {
      var s = g.querySelector('.group-head span'); if (!s || !/^\d+ available$/.test(s.textContent.trim())) return;
      var n = g.querySelectorAll('.item').length; s.textContent = n + ' available';
    });
  }
  function camera(n) {
    return '<span class="count"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14"></rect><circle cx="12" cy="13" r="3.5"></circle><path d="M8 6l2-3h4l2 3"></path></svg>' + n + '</span>';
  }
  function wireCard(art) {
    var add = art.querySelector('.add'), open = art.querySelector('.open');
    open.addEventListener('click', function () { location.hash = '#/item/' + open.dataset.g; });
    add.addEventListener('click', function () {
      var box = document.getElementById('f-items'); if (!box) return;
      var name = add.dataset.item, lines = box.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      if (lines.indexOf(name) > -1) { lines = lines.filter(function (l) { return l !== name; }); add.setAttribute('aria-pressed', 'false'); add.textContent = 'Add to brief'; }
      else { lines.push(name); add.setAttribute('aria-pressed', 'true'); add.textContent = 'Added'; try { checkCat(add.dataset.cat); } catch (_) {} }
      box.value = lines.join('\n');
    });
  }
  function findGrid(tab, group) {
    var sec = document.getElementById('view-' + tab); if (!sec) return null;
    var groups = sec.querySelectorAll('.group'), target = null;
    groups.forEach(function (g) { var h = g.querySelector('.group-head h3'); if (h && h.textContent.trim().toLowerCase() === String(group || '').trim().toLowerCase()) target = g; });
    if (!target) {
      var wrap = sec.querySelector('.wrap') || sec;
      target = document.createElement('div'); target.className = 'group';
      target.innerHTML = '<div class="group-head"><h3>' + esc(group || 'More') + '</h3><span>0 available</span></div><div class="grid"></div>';
      var anchor = sec.querySelector('.group:last-of-type');
      if (anchor) anchor.after(target); else wrap.appendChild(target);
    }
    var grid = target.querySelector('.grid');
    if (!grid) { grid = document.createElement('div'); grid.className = 'grid'; target.appendChild(grid); }
    return grid;
  }
  function applyListings(L) {
    if (!L) return;
    (L.hidden || []).forEach(function (id) { var c = cardFor(id); if (c) c.remove(); });
    Object.keys(L.edits || {}).forEach(function (id) {
      var e = L.edits[id], g = G[id], c = cardFor(id); if (!g) return;
      var oldItem = g.item;
      if (e.name) { g.name = e.name; g.item = e.name; }
      if (e.sub != null) g.sub = e.sub;
      if (e.desc != null) g.desc = e.desc;
      if (e.loc != null) g.loc = e.loc;
      if (Array.isArray(e.imgs) && e.imgs.length) g.imgs = e.imgs.map(imgKey);
      if (!c) return;
      if (e.name) { c.querySelector('h4').textContent = e.name; var a = c.querySelector('.add'); if (a && a.dataset.item === oldItem) a.dataset.item = e.name; }
      if (e.sub != null) { var p = c.querySelector('.item-foot p'); if (p) p.textContent = e.sub; }
      var im = c.querySelector('figure img');
      if (im) { var v0 = I[g.imgs[0]] || ''; im.src = /^(data:|media\/|https?:)/.test(v0) ? v0 : 'data:image/jpeg;base64,' + v0; im.alt = g.name; }
      var cnt = c.querySelector('.count'); if (cnt) cnt.outerHTML = camera(g.imgs.length);
      var op = c.querySelector('.open'); if (op) op.setAttribute('aria-label', 'See ' + g.imgs.length + ' photo' + (g.imgs.length === 1 ? '' : 's') + ' of ' + g.name);
    });
    (L.added || []).forEach(function (it) {
      if (!it || !it.id || !it.name || !Array.isArray(it.imgs) || !it.imgs.length) return;
      var grid = findGrid(it.tab, it.group); if (!grid) return;
      var keys = it.imgs.map(imgKey);
      G[it.id] = { name: it.name, sub: it.sub || '', desc: it.desc || '', loc: it.loc || '', imgs: keys, item: it.name, tab: it.tab };
      var art = document.createElement('article'); art.className = 'item';
      art.innerHTML = '<button class="open" type="button" data-g="' + esc(it.id) + '" aria-label="See ' + keys.length + ' photo' + (keys.length === 1 ? '' : 's') + ' of ' + esc(it.name) + '"><figure><img alt="' + esc(it.name) + '" loading="lazy" src="' + esc(it.imgs[0]) + '"></figure>' + camera(keys.length) + '</button>' +
        '<div class="item-foot"><div><h4>' + esc(it.name) + '</h4><p>' + esc(it.sub || '') + '</p></div><button class="add" type="button" data-item="' + esc(it.name) + '" data-cat="' + esc(TAB_CAT[it.tab] || 'Other') + '" aria-pressed="false">Add to brief</button></div>';
      grid.appendChild(art); wireCard(art);
    });
    updateCounts();
    if (/^#\/item\//.test(location.hash)) { try { route(); } catch (_) {} }
  }

  /* ---------- videos ---------- */
  function applyReels(reels) {
    if (!Array.isArray(reels)) return;
    var grid = q('.reelgrid'); if (!grid) return;
    grid.innerHTML = reels.filter(function (r) { return r && r.src; }).map(function (r) {
      return '<figure class="vcard"><video autoplay muted loop playsinline preload="none"' + (r.poster ? ' poster="' + esc(r.poster) + '"' : '') + ' data-src="' + esc(r.src) + '" aria-label="' + esc(r.caption || 'Sourced. video') + '"></video>' + (r.caption ? '<figcaption>' + esc(r.caption) + '</figcaption>' : '') + '</figure>';
    }).join('');
  }
  function lazyVideos() {
    var vs = document.querySelectorAll('.reelgrid video[data-src]:not([data-obs])');
    function go(v) { if (!v.getAttribute('src')) v.src = v.dataset.src; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    if (!('IntersectionObserver' in window)) { vs.forEach(go); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) go(e.target); else if (e.target.getAttribute('src')) e.target.pause(); }); }, { rootMargin: '300px 0px' });
    vs.forEach(function (v) { v.dataset.obs = '1'; io.observe(v); });
  }

  /* ---------- apply everything ---------- */
  var DEFAULT_REELS = Array.prototype.map.call(document.querySelectorAll('.reelgrid .vcard'), function (f) {
    var v = f.querySelector('video'), c = f.querySelector('figcaption');
    return { src: v.dataset.src || v.getAttribute('src'), poster: v.getAttribute('poster') || '', caption: c ? c.textContent : '' };
  });
  var LISTING_INDEX = Array.prototype.map.call(document.querySelectorAll('.item .open[data-g]'), function (b) {
    var sec = b.closest('.view'), grp = b.closest('.group'), h = grp && grp.querySelector('.group-head h3');
    return { id: b.dataset.g, tab: sec ? sec.id.replace('view-', '') : '', group: h ? h.textContent.trim() : '' };
  });
  var GROUPS = {};
  document.querySelectorAll('.cat-view').forEach(function (sec) {
    GROUPS[sec.id.replace('view-', '')] = Array.prototype.map.call(sec.querySelectorAll('.group-head h3'), function (h) { return h.textContent.trim(); });
  });

  function apply(c) {
    c = c || {};
    var T = c.text || {}; Object.keys(T).forEach(function (p) { var el = q(p); if (el && el.dataset.t) el.innerHTML = clean(T[p]); });
    var M = c.images || {}; Object.keys(M).forEach(function (p) { var el = q(p); if (el && el.tagName === 'IMG' && /^https:\/\//.test(M[p])) { el.removeAttribute('srcset'); el.src = M[p]; } });
    applyReels(c.reels);
    applyListings(c.listings);
    lazyVideos();
  }

  var api = window.__sourced = {
    content: {}, defaults: { reels: DEFAULT_REELS, listings: LISTING_INDEX, groups: GROUPS, tabs: TAB_CAT },
    gals: function () { return G; }, imgs: function () { return I; },
    ready: null, edit: EDIT
  };
  api.ready = fetch('/api/content', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
    .then(function (c) { api.content = c || {}; apply(api.content); if (EDIT) startEdit(); return api.content; });

  /* ---------- edit mode (only inside the back end) ---------- */
  function startEdit() {
    var css = document.createElement('style');
    css.textContent = '[data-t][contenteditable]{outline:1px dashed rgba(255,196,0,.55);outline-offset:3px;cursor:text}' +
      '[data-t][contenteditable]:hover{outline-color:#ffc400}[data-t][contenteditable]:focus{outline:2px solid #ffc400;background:rgba(255,196,0,.06)}' +
      'img[data-p]{cursor:pointer}img[data-p]:hover{outline:3px solid #ffc400;outline-offset:-3px}' +
      '[data-t].ed-changed{outline:2px solid #3ddc84!important}';
    document.head.appendChild(css);
    var changes = api.changes = { text: {}, images: {} };
    textEls.forEach(function (el) {
      if (!el.isConnected) return;
      el.setAttribute('contenteditable', 'true'); el.spellcheck = true;
      el.addEventListener('input', function () { changes.text[el.dataset.p] = clean(el.innerHTML); el.classList.add('ed-changed'); notify(); });
      el.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); }, true);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && /^H\d$/.test(el.tagName)) e.preventDefault(); });
      el.addEventListener('paste', function (e) { e.preventDefault(); var t = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, t); });
    });
    imgEls.forEach(function (img) {
      if (!img.isConnected) return;
      img.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (!window.parent.SourcedAdmin) return;
        window.parent.SourcedAdmin.pickImage(function (url) { img.removeAttribute('srcset'); img.src = url; changes.images[img.dataset.p] = url; notify(); });
      }, true);
    });
    function notify() { try { window.parent.SourcedAdmin.onChange(Object.keys(changes.text).length + Object.keys(changes.images).length); } catch (_) {} }
    try { window.parent.SourcedAdmin.onFrameReady(); } catch (_) {}
  }
})();
