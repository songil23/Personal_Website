/* app.js — 디자인_명세.md §8 계약(v5: §2-v5 「app.js v5」). 의존성 0, body 끝에서 실행.
   v5에서 더한 것: 하위 전환 스크롤 오프셋에 고정 빵부스러기 높이, ✉ 메일 복사 버튼, file://에서 유튜브 대체 링크.
   v4 사본: 임시/v4_2026-09-17/app.js */
(function () {
  'use strict';

  var root = document.documentElement;
  var SITE = (window.SITE && typeof window.SITE === 'object') ? window.SITE : {};

  function all(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }
  function one(sel, ctx) { return (ctx || document).querySelector(sel); }
  function store(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* 저장 불가 */ } }
  function mark(el, on, value) {
    if (!el) return;
    if (on) el.setAttribute('aria-current', value || 'page');
    else el.removeAttribute('aria-current');
  }
  function focusQuiet(el) {
    if (!el) return;
    if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
      el.setAttribute('tabindex', '-1');
    }
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }

  /* ===== parseHash 시작 ===== 순수 함수: 해시 + SITE → {view, sub, hash}. 테스트가 이 블록만 떼어 쓴다. */
  function parseHash(hash, SITE) {
    var home = { view: 'home', sub: null, hash: '#' };
    var raw = hash == null ? '' : String(hash);
    if (raw.charAt(0) === '#') raw = raw.slice(1);
    if (!raw || raw === 'home') return home;

    var parts = raw.split('/');
    var view = parts[0];
    var sub = parts.length > 1 ? parts[1] : null;
    try {
      view = decodeURIComponent(view);
      if (sub !== null) sub = decodeURIComponent(sub);
    } catch (e) { return home; }

    if (!SITE || !Object.prototype.hasOwnProperty.call(SITE, view)) return home;   // 모르는 절
    var subs = SITE[view];
    if (!subs || typeof subs.indexOf !== 'function') return home;
    if (!subs.length) return { view: view, sub: null, hash: '#' + view };          // 하위 없는 절

    // #절 이거나 모르는 하위 → 그 절의 첫 하위 (모르는 절만 홈)
    if (sub === null || sub === '' || subs.indexOf(sub) < 0) sub = subs[0];

    return { view: view, sub: sub, hash: '#' + view + '/' + sub };
  }
  /* ===== parseHash 끝 ===== */

  /* ---------- 1. 라우팅 ---------- */
  var current = { view: null, sub: null, hash: null };

  function stickyOffset() {
    var header = one('header.site-header');
    if (!header) return 0;
    var candidates = [header, one('.header-inner', header), one('.header-row', header)];
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (!el) continue;
      var pos = getComputedStyle(el).position;
      if (pos === 'sticky' || pos === 'fixed') return el.getBoundingClientRect().height;
    }
    return 0;
  }
  /* v5: 빵부스러기가 헤더 아래에 고정되므로(§2-v5) 하위 전환 스크롤은 그 높이만큼 더 내려 잡는다 */
  function stuckOffset() {
    var crumb = one('.view.is-active .crumb');
    return stickyOffset() + (crumb && getComputedStyle(crumb).position === 'sticky' ? crumb.getBoundingClientRect().height : 0);
  }

  function route(initial) {
    if (location.hash === '#main') return;   // 건너뛰기 링크(.skip): 라우팅 대상이 아니다
    var r = parseHash(location.hash, SITE);

    // 주소 교정: 빈 해시 + 홈이면 그대로 둔다.
    if (location.hash !== r.hash && !(r.view === 'home' && location.hash === '')) {
      try {
        history.replaceState(history.state, '', location.pathname + location.search + r.hash);
      } catch (e) { /* file:// 등에서 실패 가능 */ }
    }

    var viewChanged = current.view !== r.view;
    var subChanged = current.sub !== r.sub;
    current = r;
    closeAll(false);

    root.setAttribute('data-view', r.view);
    if (r.sub) root.setAttribute('data-sub', r.view + '/' + r.sub);
    else root.removeAttribute('data-sub');

    var subKey = r.sub ? r.view + '/' + r.sub : null;
    all('.view').forEach(function (v) {
      v.classList.toggle('is-active', v.getAttribute('data-view') === r.view);
    });
    all('.sub').forEach(function (s) {
      s.classList.toggle('is-active', subKey !== null && s.getAttribute('data-sub') === subKey);
    });

    // 절 표시: nav-item 하나당 nav-btn + nav-link
    all('.nav-item').forEach(function (item) {
      var link = one('.nav-link', item);
      var section = item.getAttribute('data-section');
      if (!section && link) section = (link.getAttribute('href') || '').replace(/^#/, '').split('/')[0];
      var on = section === r.view;
      mark(one('.nav-btn', item), on);
      mark(link, on);
    });

    // 하위 표시: 메뉴·subnav·푸터의 해시 링크
    all('.menu-list a[href], .subnav a[href], .footer-col ul a[href]').forEach(function (a) {   // .footer-head 제외(첫 하위일 때 둘 다 잡히던 것, 검증 F5)
      mark(a, subKey !== null && a.getAttribute('href') === r.hash);
    });

    setTitle();            // v4: 탭 이름 · 이름

    if (initial) return;   // 첫 로드에서는 스크롤·포커스 이동 없음(브라우저 복원 존중)

    var view = one('.view.is-active');
    if (viewChanged) {
      window.scrollTo(0, 0);
      focusQuiet(view && (one('.view-title', view) || one('.hero-name', view)));
    } else if (subChanged) {
      var head = view && one('.view-head', view);
      if (head) {
        var y = window.scrollY + head.getBoundingClientRect().top - stuckOffset();
        window.scrollTo(0, y > 0 ? y : 0);
      }
      focusQuiet(one('.sub.is-active .sub-title'));
    }
  }

  /* v4: document.title = "<절 제목(현재 언어)> · <이름>", 홈은 이름만 */
  var NAME = (one('.brand') && one('.brand').textContent.trim()) || document.title;
  function visibleText(el) {
    if (!el) return '';
    var lang = root.getAttribute('data-lang') === 'ko' ? 'ko' : 'en';
    var span = one('[lang="' + lang + '"]', el);
    return (span || el).textContent.replace(/\s+/g, ' ').trim();
  }
  function setTitle() {
    var view = one('.view.is-active');
    var title = view && view.getAttribute('data-view') !== 'home' ? visibleText(one('.view-title', view)) : '';
    document.title = title ? title + ' · ' + NAME : NAME;
  }

  /* ---------- 2. disclosure 공통 ---------- */
  var groups = [];
  var openGroup = null;
  var narrow = window.matchMedia('(max-width: 1199px)');   // v3: <1200은 탭 대신 ⋯ 메뉴
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');

  function onMedia(mq, fn) {
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }
  function clearTimers(g) {
    clearTimeout(g.openTimer);
    clearTimeout(g.closeTimer);
    g.openTimer = 0;
    g.closeTimer = 0;
  }
  function openPanel(g, pinned) {
    if (openGroup && openGroup !== g) closePanel(openGroup, false);
    clearTimers(g);
    g.panel.hidden = false;
    g.btn.setAttribute('aria-expanded', 'true');
    g.owner.classList.add('is-open');
    if (pinned) g.pinned = true;
    openGroup = g;
  }
  function closePanel(g, refocus) {
    if (!g) return;
    clearTimers(g);
    g.panel.hidden = true;
    g.btn.setAttribute('aria-expanded', 'false');
    g.owner.classList.remove('is-open');
    g.pinned = false;
    if (openGroup === g) openGroup = null;
    if (refocus) focusQuiet(g.btn);
  }
  function closeAll(refocus) { closePanel(openGroup, refocus); }
  function inside(g, node) {
    return node instanceof Node && (g.btn.contains(node) || g.panel.contains(node));
  }
  function groupOf(node) {
    for (var i = 0; i < groups.length; i++) if (inside(groups[i], node)) return groups[i];
    return null;
  }

  all('.nav-btn, .ctl-contact, .ctl-more, .lang-btn').forEach(function (btn) {   // v3: ⋯(more-menu) 추가
    var panel = document.getElementById(btn.getAttribute('aria-controls') || '');
    if (!panel) return;
    var isNav = btn.classList.contains('nav-btn');
    var g = {
      btn: btn,
      panel: panel,
      isNav: isNav,
      owner: (isNav ? btn.closest('.nav-item') : btn.closest('.disclosure')) || btn.parentNode,
      pinned: false,
      openTimer: 0,
      closeTimer: 0
    };
    groups.push(g);
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');

    btn.addEventListener('click', function () {
      if (openGroup === g) closePanel(g, false);
      else openPanel(g, true);
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'Down') return;
      e.preventDefault();
      openPanel(g, true);
      focusQuiet(one('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', panel));
    });
    panel.addEventListener('click', function (e) {
      // v5: 복사 버튼(.copy)은 팝오버를 닫지 않는다 — 주소를 눈으로 확인한 채 ✓를 본다
      if (e.target.closest && e.target.closest('a[href], button:not(.copy)')) closePanel(g, false);
    });
    g.owner.addEventListener('focusout', function (e) {
      if (openGroup !== g) return;
      if (e.relatedTarget && inside(g, e.relatedTarget)) return;
      closePanel(g, false);
    });

    if (!isNav) return;
    g.owner.addEventListener('pointerenter', function () {
      if (!fine.matches || narrow.matches) return;
      clearTimeout(g.closeTimer);
      if (openGroup === g) return;
      g.openTimer = setTimeout(function () { openPanel(g, false); }, 80);
    });
    g.owner.addEventListener('pointerleave', function () {
      clearTimeout(g.openTimer);
      if (openGroup !== g || g.pinned) return;      // 클릭으로 연 것은 hover 이탈로 닫지 않는다
      g.closeTimer = setTimeout(function () {
        if (openGroup === g && !g.pinned && !inside(g, document.activeElement)) closePanel(g, false);
      }, 200);
    });
  });

  document.addEventListener('pointerdown', function (e) {
    if (openGroup && !inside(openGroup, e.target)) closeAll(false);
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Escape' || e.key === 'Esc') && openGroup) {
      e.preventDefault();
      closeAll(true);
    }
  });
  onMedia(narrow, function () { closeAll(false); });
  onMedia(fine, function () { if (!fine.matches && openGroup && !openGroup.pinned) closeAll(false); });

  /* ---------- 3. 언어 ---------- */
  function markLang(lang) {
    all('.lang-menu button[data-lang]').forEach(function (b) {
      mark(b, b.getAttribute('data-lang') === lang, 'true');
    });
  }
  all('.lang-menu button[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      var lang = b.getAttribute('data-lang') === 'ko' ? 'ko' : 'en';
      root.setAttribute('data-lang', lang);
      root.lang = lang;
      store('lang', lang);
      markLang(lang);
      setTitle();
      closePanel(groupOf(b), true);
    });
  });
  markLang(root.getAttribute('data-lang') === 'ko' ? 'ko' : 'en');

  /* ---------- 4. 테마 ---------- */
  function markTheme(theme) {
    all('.ctl-theme').forEach(function (b) {
      b.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    });
    // v4: 브라우저 크롬 색 = 바탕 토큰 --bg(색 리터럴 중복 없음). body의 계산값은 200ms 전환 중이라 못 쓴다
    var meta = one('meta[name="theme-color"]');
    if (meta) {
      var bg = getComputedStyle(root).getPropertyValue('--bg').trim();
      if (bg) meta.setAttribute('content', bg);
    }
  }
  all('.ctl-theme').forEach(function (b) {
    b.addEventListener('click', function () {
      var theme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', theme);
      store('theme', theme);
      markTheme(theme);
    });
  });
  markTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  /* ---------- 5. ✉ 메일 주소 복사 (v5 §2-v5) ---------- */
  var COPY_DONE_MS = 1500;
  function writeClipboard(text) {
    // clipboard API는 안전한 문맥(https·file·localhost)에서만. 실패하면 옛 방식(임시 textarea + execCommand)
    var viaApi = (navigator.clipboard && navigator.clipboard.writeText)
      ? navigator.clipboard.writeText(text) : Promise.reject(new Error('no clipboard api'));
    return viaApi.catch(function () {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (!ok) throw new Error('copy failed');
    });
  }
  all('.copy[data-copy]').forEach(function (b) {
    var timer = 0;
    b.addEventListener('click', function () {
      writeClipboard(b.getAttribute('data-copy') || '').then(function () {
        b.classList.add('is-done');
        var live = one('.copy-live', b.closest('.menu') || document);
        if (live) {
          live.textContent = '';                       // 같은 문구를 다시 읽게 비웠다가 넣는다
          live.textContent = live.getAttribute(root.getAttribute('data-lang') === 'ko' ? 'data-ko' : 'data-en') || '';
        }
        clearTimeout(timer);
        timer = setTimeout(function () { b.classList.remove('is-done'); }, COPY_DONE_MS);
      }, function () { /* 복사 불가(권한 거부 등): 표시 없음 — 주소는 그대로 보이니 손으로 복사할 수 있다 */ });
    });
  });

  /* ---------- 6. file://에서는 유튜브 플레이어 대신 링크 (v5 §2-v5) ----------
     YouTube는 임베드에 Referer가 필요한데(오류 153) 파일을 직접 열면 브라우저가 보내지 않는다.
     http(s)(미리보기 서버·GitHub Pages)에서는 iframe 그대로 */
  if (location.protocol === 'file:') {
    all('.video > .frame').forEach(function (frame) {
      var link = one('.video-fallback', frame);
      if (!link) return;
      all('iframe', frame).forEach(function (f) { f.parentNode.removeChild(f); });
      link.hidden = false;
    });
  }

  /* ---------- 7. 기사 탭 (v6 §2-v6 `묶음: 탭`) ----------
     WAI-ARIA tabs: 클릭·←→(순환)·Home/End. 해시·저장 없음 — 절/하위 라우팅과 무관 */
  all('.tabs').forEach(function (box) {
    var tabs = all('[role="tab"]', box);
    if (!tabs.length) return;
    function select(i, focus) {
      tabs.forEach(function (t, k) {
        var on = k === i;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.setAttribute('tabindex', on ? '0' : '-1');
        var panel = document.getElementById(t.getAttribute('aria-controls') || '');
        if (panel) panel.hidden = !on;
      });
      if (focus) focusQuiet(tabs[i]);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i, false); });
      t.addEventListener('keydown', function (e) {
        var n = tabs.length, j = -1;
        if (e.key === 'ArrowRight' || e.key === 'Right') j = (i + 1) % n;
        else if (e.key === 'ArrowLeft' || e.key === 'Left') j = (i - 1 + n) % n;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = n - 1;
        if (j < 0) return;
        e.preventDefault();
        select(j, true);
      });
    });
  });

  /* ---------- 실행 ---------- */
  window.addEventListener('hashchange', function () { route(false); });
  route(true);
})();
