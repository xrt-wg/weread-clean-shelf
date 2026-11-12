// WeRead REA shelf runtime __WR_REA_VERSION__
(() => {
  'use strict';
  /* WR_REA_MODEL */
  window.__wrReaShelfCleanup?.();
  const VERSION = '__WR_REA_VERSION__';
  const NAV = 'wr-rea-shelf-nav';
  const HEADING = 'wr-rea-shelf-heading';
  const VIEW = 'wr-rea-cover-view';
  const STYLE = 'wr-rea-shelf-style';
  const ROOT = '/web/shelf';
  const ROUTE = /^\/web\/shelf(?:\/archive\/(\d+))?\/?$/;
  const controller = new AbortController();
  const cachedViews = new Map();
  let catalog = null;
  let loading = false;
  let disposed = false;
  let scheduled = false;
  let currentView = null;
  let observer = null;
  let intersection = null;
  let loadFailed = false;
  let preferences = { theme:'light', collapsed:false };
  let positions = {};
  try { const saved=JSON.parse(localStorage.getItem('wr-rea-shelf-preferences') || '{}'); preferences={theme:saved.theme === 'dark' ? 'dark' : 'light',collapsed:saved.collapsed === true}; } catch {}
  try { positions=JSON.parse(sessionStorage.getItem('wr-rea-shelf-positions') || '{}'); } catch {}
  const root = document.documentElement;
  root.dataset.wrReaStartPhase = document.readyState;
  root.dataset.wrReaTheme = preferences.theme;
  root.classList.toggle('wr-rea-collapsed',preferences.collapsed);
  if (ROUTE.test(location.pathname)) root.classList.add('wr-rea-pending');
  const pendingTimer = setTimeout(()=>root.classList.remove('wr-rea-pending'),6000);
  document.documentElement.dataset.wrReaInstance = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  document.documentElement.dataset.wrReaNavigation = 'ready';

  const style = document.createElement('style');
  style.id = STYLE;
  style.dataset.version = VERSION;
  style.textContent = `
    html.wr-rea-shelf, html.wr-rea-pending {
      --wr-bg:#fff; --wr-panel:#f7f9fb; --wr-text:#262c35; --wr-muted:#69717d;
      --wr-faint:#89929f; --wr-line:#e8ecf1; --wr-hover:#f1f4f8; --wr-selected:#edf4ff; --wr-accent:#226bce;
      background:var(--wr-bg)!important; color-scheme:light;
    }
    html[data-wr-rea-theme="dark"].wr-rea-shelf, html[data-wr-rea-theme="dark"].wr-rea-pending {
      --wr-bg:#17191d; --wr-panel:#202329; --wr-text:#e6e8ed; --wr-muted:#adb4c0;
      --wr-faint:#929ba9; --wr-line:#30353e; --wr-hover:#272c34; --wr-selected:#253a56; --wr-accent:#9bc7ff;
      color-scheme:dark;
    }
    html.wr-rea-shelf body, html.wr-rea-pending body, html.wr-rea-shelf #app, html.wr-rea-pending #app { background:var(--wr-bg)!important; }
    html.wr-rea-pending .shelf_container { visibility:hidden!important; }
    html.wr-rea-pending::after { content:'正在整理书架…'; position:fixed; top:110px; left:32px; color:var(--wr-faint); font:13px/1.5 "Microsoft YaHei",sans-serif; }
    html.wr-rea-shelf .navBar, html.wr-rea-pending .navBar { background:var(--wr-bg)!important; border-color:var(--wr-line)!important; box-shadow:none!important; }
    html.wr-rea-shelf .navBar a, html.wr-rea-shelf .navBar button { color:var(--wr-muted)!important; }
    html.wr-rea-shelf .navBar_input { background:var(--wr-panel)!important; color:var(--wr-text)!important; }
    html[data-wr-rea-theme="dark"].wr-rea-shelf .navBar_logo { filter:invert(.9) hue-rotate(180deg); }
    html.wr-rea-shelf .navBar, html.wr-rea-pending .navBar { height:64px!important; }
    html.wr-rea-shelf .navBar_inner, html.wr-rea-pending .navBar_inner {
      box-sizing:border-box; display:grid!important; grid-template-columns:184px minmax(180px,1fr) auto auto 30px;
      align-items:center; column-gap:32px; max-width:1440px!important; width:100%!important;
      height:64px!important; padding:0 32px!important; margin:0 auto!important;
    }
    html.wr-rea-shelf .navBar_link_ink, html.wr-rea-shelf .navBar_link_Phone, html.wr-rea-shelf .navBar_separator,
    html.wr-rea-pending .navBar_link_ink, html.wr-rea-pending .navBar_link_Phone, html.wr-rea-pending .navBar_separator { display:none!important; }
    html.wr-rea-shelf .navBar_inner > *, html.wr-rea-pending .navBar_inner > * { margin:0!important; min-width:0; }
    html.wr-rea-shelf .navBar_input, html.wr-rea-pending .navBar_input { box-sizing:border-box; width:100%!important; border-radius:8px!important; height:34px!important; }
    html.wr-rea-shelf .navBar_link, html.wr-rea-pending .navBar_link { white-space:nowrap; font-size:13px!important; }
    html.wr-rea-shelf .navBar .menu_container, html.wr-rea-pending .navBar .menu_container { width:30px!important; justify-self:end; }
    html.wr-rea-shelf .navBar_avatar, html.wr-rea-pending .navBar_avatar { margin:0!important; }
    html.wr-rea-shelf, html.wr-rea-shelf body { height:100%; overflow:hidden!important; }
    html.wr-rea-shelf .shelf_header,
    html.wr-rea-shelf .shelf_container > .shelf_list,
    html.wr-rea-shelf .shelfBook_loadingView { display:none!important; }
    html.wr-rea-shelf .shelf_container {
      box-sizing:border-box; display:grid!important; grid-template-columns:184px minmax(0,1fr);
      grid-template-rows:30px minmax(0,1fr); gap:18px 32px; align-items:start;
      width:100%!important; max-width:1440px!important; height:100vh;
      margin:0 auto!important; padding:84px 32px 20px!important;
    }
    .wr-rea-ui { font-family:"PingFang SC","Microsoft YaHei",sans-serif; }
    #${NAV} { grid-column:1; grid-row:1/span 2; min-width:0; padding-right:18px; border-right:1px solid var(--wr-line); }
    #${NAV} .wr-rea-nav-title { display:flex; align-items:center; justify-content:space-between; margin:0 0 16px; color:#262c35; font-size:17px; font-weight:600; line-height:30px; }
    #${NAV} .wr-rea-group-count { color:#9ba2ad; font-size:12px; font-weight:400; }
    #${NAV} .wr-rea-filter { box-sizing:border-box; width:100%; height:34px; padding:0 10px; margin:0 0 14px; border:1px solid #e8ecf1; border-radius:6px; background:#f7f9fb; color:#303947; font:inherit; font-size:12px; }
    #${NAV} .wr-rea-filter::placeholder { color:#939ba7; }
    #${NAV} .wr-rea-filter:focus { outline:2px solid #d9e7fd; border-color:#83adf1; }
    #${NAV} .wr-rea-tabs { position:relative; display:flex; flex-direction:column; gap:3px; max-height:calc(100vh - 210px); overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:#e0e5ec transparent; padding-right:3px; }
    #${NAV} [data-wr-rea-path] { box-sizing:border-box; width:100%; position:relative; flex:none; display:block; padding:7px 10px; border:0; border-radius:5px; background:transparent; text-align:left; color:#69717d; font:inherit; font-size:13px; line-height:20px; cursor:pointer; overflow-wrap:anywhere; }
    #${NAV} [data-wr-rea-path]:first-child { position:sticky; top:0; z-index:1; margin-bottom:8px; background:#fff; box-shadow:0 6px 0 #fff; }
    #${NAV} [data-wr-rea-path]:hover { background:#f5f7fa; color:#20242a; }
    #${NAV} [aria-current="page"] { background:#edf4ff; color:#226bce; font-weight:600; }
    #${NAV} [hidden] { display:none!important; }
    #${NAV} [draggable="true"] { padding-right:24px; cursor:grab; }
    #${NAV} [draggable="true"]:active { cursor:grabbing; }
    #${NAV} .wr-rea-grip { position:absolute; right:7px; top:50%; transform:translateY(-50%); color:var(--wr-faint); opacity:.3; pointer-events:none; }
    #${NAV} .wr-rea-grip svg { display:block; width:8px; height:12px; fill:currentColor; }
    #${NAV} [draggable="true"]:hover .wr-rea-grip, #${NAV} [draggable="true"]:focus-visible .wr-rea-grip { opacity:.8; }
    #${NAV} .wr-rea-dragging { opacity:.35; }
    .wr-rea-drag-ghost { position:fixed; z-index:1000; box-sizing:border-box; pointer-events:none; padding:7px 10px; border:1px solid var(--wr-line); border-radius:5px; background:var(--wr-bg); color:var(--wr-text); box-shadow:0 5px 18px #0002; font-size:13px; line-height:20px; opacity:.95; }
    #${NAV} [data-drop="before"] { box-shadow:inset 0 2px var(--wr-accent); border-radius:0; }
    #${NAV} [data-drop="after"] { box-shadow:inset 0 -2px var(--wr-accent); border-radius:0; }
    .wr-rea-sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; border:0; }
    #${NAV} .wr-rea-empty { margin:12px 8px; color:#939ba7; font-size:12px; }
    #${HEADING} { grid-column:2; grid-row:1; display:flex; align-items:baseline; justify-content:space-between; gap:16px; min-width:0; }
    #${HEADING} h1 { margin:0; color:#262c35; font-size:21px; font-weight:600; line-height:30px; }
    #${HEADING} p { margin:0; color:#939ba7; font-size:12px; white-space:nowrap; }
    #${VIEW} { grid-column:2; grid-row:2; height:100%; min-height:0; min-width:0; overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain; scrollbar-gutter:stable; scrollbar-width:thin; scrollbar-color:#dce2ea transparent; }
    #${VIEW} .wr-rea-cover-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(124px,1fr)); gap:20px 18px; padding:0 5px 20px 0; }
    #${VIEW} .wr-rea-book { display:block; min-width:0; aspect-ratio:128/185; background:#f5f6f8; box-shadow:0 2px 8px rgb(25 35 50 / 7%); transition:box-shadow 120ms ease; }
    #${VIEW} .wr-rea-book:hover { box-shadow:0 5px 16px rgb(25 35 50 / 14%); }
    #${VIEW} .wr-rea-book img { display:block; width:100%; height:100%; object-fit:contain; object-position:center; }
    #${VIEW} .wr-rea-unavailable { cursor:default; opacity:.65; }
    #${VIEW} .wr-rea-more { height:1px; }
    #${VIEW} .wr-rea-empty-view { margin:36px 0; text-align:center; color:#939ba7; font-size:13px; }
    #${NAV} button:focus-visible, #${VIEW} a:focus-visible { outline:2px solid #2776ed; outline-offset:-2px; }
    #${NAV} .wr-rea-nav-title, #${HEADING} h1 { color:var(--wr-text); }
    #${NAV} .wr-rea-group-count, #${HEADING} p, #${NAV} .wr-rea-empty, #${VIEW} .wr-rea-empty-view { color:var(--wr-faint); }
    #${NAV} .wr-rea-filter { background:var(--wr-panel); color:var(--wr-text); border-color:var(--wr-line); }
    #${NAV} [data-wr-rea-path] { color:var(--wr-muted); }
    #${NAV} [data-wr-rea-path]:first-child { background:var(--wr-bg); box-shadow:0 6px 0 var(--wr-bg); }
    #${NAV} [data-wr-rea-path]:hover { background:var(--wr-hover); color:var(--wr-text); }
    #${NAV} [aria-current="page"] { background:var(--wr-selected); color:var(--wr-accent); }
    #${VIEW} .wr-rea-book { background:var(--wr-panel); }
    #${NAV} .wr-rea-tabs, #${VIEW} { scrollbar-color:var(--wr-line) transparent; }
    #${HEADING} { align-items:center; }
    .wr-rea-heading-start, .wr-rea-heading-end { display:flex; align-items:center; gap:12px; min-width:0; }
    .wr-rea-icon-button { flex:none; display:grid; place-items:center; width:30px; height:30px; padding:0; border:1px solid var(--wr-line); border-radius:6px; background:var(--wr-bg); color:var(--wr-muted); cursor:pointer; }
    .wr-rea-icon-button:hover { color:var(--wr-text); background:var(--wr-hover); }
    .wr-rea-icon-button:focus-visible { outline:2px solid var(--wr-accent); outline-offset:2px; }
    .wr-rea-icon-button svg { width:17px; height:17px; fill:none; stroke:currentColor; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }
    #wr-rea-fold { width:26px; background:transparent; border:0; border-radius:4px; }
    #wr-rea-fold:hover { background:var(--wr-hover); }
    #wr-rea-fold svg { width:18px; height:18px; stroke-width:1.4; }
    html.wr-rea-collapsed #wr-rea-fold svg { transform:rotate(180deg); }
    .wr-rea-heading-start { gap:9px; }
    html.wr-rea-shelf.wr-rea-collapsed .shelf_container { grid-template-columns:minmax(0,1fr); column-gap:0; }
    html.wr-rea-collapsed #${NAV} { display:none; }
    html.wr-rea-collapsed #${HEADING}, html.wr-rea-collapsed #${VIEW} { grid-column:1; }
    @media(max-width:680px) {
      html.wr-rea-shelf .shelf_container { grid-template-columns:140px minmax(0,1fr); gap:18px; padding:82px 18px 18px!important; }
      html.wr-rea-shelf .navBar_inner, html.wr-rea-pending .navBar_inner { grid-template-columns:auto minmax(80px,1fr) auto 28px; padding:0 18px!important; column-gap:16px; }
      html.wr-rea-shelf .navBar_link_Home, html.wr-rea-pending .navBar_link_Home { display:none!important; }
      #${NAV} { padding-right:10px; } #${NAV} [data-wr-rea-path] { font-size:12px; padding:7px 8px; }
      #${HEADING} h1 { font-size:18px; }
      #${VIEW} .wr-rea-cover-grid { grid-template-columns:repeat(auto-fill,minmax(104px,1fr)); gap:18px 14px; }
    }
    @media(prefers-reduced-motion:reduce) { #${VIEW} .wr-rea-book { transition:none; } }
  `;
  (document.head || root).append(style);

  function applyPreferences() {
    root.dataset.wrReaTheme=preferences.theme;
    root.classList.toggle('wr-rea-collapsed',preferences.collapsed);
    const fold=document.getElementById('wr-rea-fold');
    if(fold) { fold.setAttribute('aria-expanded',String(!preferences.collapsed)); fold.setAttribute('aria-label',preferences.collapsed?'展开分组侧栏':'折叠分组侧栏'); fold.title=fold.getAttribute('aria-label'); }
    const theme=document.getElementById('wr-rea-theme');
    if(theme) { theme.setAttribute('aria-label',preferences.theme==='dark'?'切换浅色主题':'切换暗色主题'); theme.title=theme.getAttribute('aria-label'); theme.setAttribute('aria-pressed',String(preferences.theme==='dark')); theme.innerHTML=preferences.theme==='dark'?'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>':'<svg viewBox="0 0 24 24"><path d="M20.5 13a8.5 8.5 0 0 1-9.5-9.5A8.5 8.5 0 1 0 20.5 13Z"/></svg>'; }
    try { localStorage.setItem('wr-rea-shelf-preferences',JSON.stringify(preferences)); } catch {}
  }

  function savePositions() {
    if(currentView) currentView.scroll=document.getElementById(VIEW)?.scrollTop || 0;
    for(const [path,view] of cachedViews) positions[path]={scroll:view.scroll,rendered:view.rendered};
    try { sessionStorage.setItem('wr-rea-shelf-positions',JSON.stringify(positions)); } catch {}
  }

  async function readJson(url, options = {}) {
    const response = await fetch(url, { credentials:'same-origin', cache:'no-store', signal:controller.signal, ...options });
    const payload = await response.json();
    const data = payload.data || payload;
    if (!response.ok || payload.errCode || data.errCode) {
      const error=new Error('Shelf data unavailable'); error.code=payload.errCode || data.errCode || response.status; throw error;
    }
    return data;
  }

  function safeReader(link) {
    try {
      const url = new URL(link, location.origin);
      return url.origin === location.origin && /^\/web\/(?:mp\/)?reader\//.test(url.pathname) ? url.href : '';
    } catch { return ''; }
  }

  function resolveMpBook(full) {
    const book = full.mp?.show && full.mp.book;
    if (!book?.bookId) return null;
    if (safeReader(book.readerLink)) return book;
    return { ...book, readerLink:`/web/mp/reader/${encodeShelfId(book.bookId)}` };
  }

  async function loadCatalog() {
    if (loading || catalog || loadFailed) return;
    loading = true;
    try {
      const [index, full] = await Promise.all([readJson('/web/shelf/sync?onlyBookid=1'), readJson('/web/shelf/sync')]);
      if (!Array.isArray(index.bookIds) || !Array.isArray(index.archive) || !Array.isArray(full.books)) throw new Error('Unsupported shelf data');
      const known = new Set(full.books.map(book => String(book.bookId)));
      const missing = index.bookIds.filter(item => !known.has(shelfBookId(item)));
      let supplement = { books:[], emptyInfoIds:[] };
      let supplementError=null;
      if (missing.length) {
        try {
          // This is the original FETCH_SHELF_LOAD_MORE metadata read, not a
          // library edit. Only the missing records are requested.
          const body={bookIds:missing};
          let signature='2097d7b063d6f8b5';
          if(typeof window.__WRPA__?.sr==='function') signature=await window.__WRPA__.sr({body}).catch(()=>signature);
          supplement = await readJson('/web/shelf/syncBook', { method:'POST', headers:{'Content-Type':'application/json','x-wrpa-0':signature}, body:JSON.stringify(body) });
        } catch(error) { supplementError=error.code || 'request-failed'; }
      }
      const mp = resolveMpBook(full);
      if (disposed) return;
      catalog = makeShelfCatalog(index, full, supplement.books || [], supplement.emptyInfoIds || [], mp);
      document.documentElement.dataset.wrReaCatalog = JSON.stringify({ groups:catalog.groups.length, books:catalog.books.size, missingMetadata:missing.length, supplemented:supplement.books?.length || 0, unavailable:supplement.emptyInfoIds?.length || 0, supplementError, mp:!!mp });
      schedule();
    } catch (error) {
      if (error.name !== 'AbortError') { loadFailed=true; root.classList.remove('wr-rea-pending'); root.dataset.wrReaStatus = 'data-unavailable'; }
    } finally { loading = false; }
  }

  function createNavigation() {
    const nav = document.createElement('nav');
    nav.id = NAV;
    nav.className = 'wr-rea-ui';
    nav.setAttribute('aria-label','书架分组');
    const title = document.createElement('p');
    title.className = 'wr-rea-nav-title';
    title.append('书架');
    const count = document.createElement('span');
    count.className = 'wr-rea-group-count';
    count.textContent = `${catalog.groups.length} 个分组`;
    title.append(count);
    const filter = document.createElement('input');
    filter.type = 'search'; filter.className = 'wr-rea-filter'; filter.placeholder = '筛选分组'; filter.setAttribute('aria-label','筛选书架分组');
    const list = document.createElement('div'); list.className = 'wr-rea-tabs';
    let remembered = [];
    try { remembered = JSON.parse(localStorage.getItem('wr-rea-group-order') || sessionStorage.getItem('wr-rea-group-order') || '[]'); } catch {}
    const groups=orderShelfGroups(catalog.groups,remembered);
    for (const group of [{id:'',name:'未分组'},...groups]) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = group.name;
      button.dataset.wrReaPath = group.id ? `${ROOT}/archive/${group.id}` : ROOT;
      if(group.id) {
        button.dataset.wrReaGroup=group.id; button.draggable=true;
        button.title='拖动调整顺序；也可按 Alt + ↑ / ↓';
        const grip=document.createElement('span'); grip.className='wr-rea-grip'; grip.setAttribute('aria-hidden','true');
        grip.innerHTML='<svg viewBox="0 0 8 12"><circle cx="2" cy="2" r="1"/><circle cx="6" cy="2" r="1"/><circle cx="2" cy="6" r="1"/><circle cx="6" cy="6" r="1"/><circle cx="2" cy="10" r="1"/><circle cx="6" cy="10" r="1"/></svg>';
        button.append(grip);
      }
      list.append(button);
    }
    const sortStatus=document.createElement('p'); sortStatus.className='wr-rea-sr-only'; sortStatus.setAttribute('role','status');
    const groupButtons=()=>[...list.querySelectorAll('[data-wr-rea-group]')];
    const ids=()=>groupButtons().map(button=>button.dataset.wrReaGroup);
    function reorder(source,target,after) {
      const byId=new Map(groupButtons().map(button=>[button.dataset.wrReaGroup,button]));
      const next=moveShelfGroup(ids(),source,target,after);
      const scroll=list.scrollTop;
      for(const id of next) list.append(byId.get(id));
      list.scrollTop=scroll;
      let saved=true;
      try { localStorage.setItem('wr-rea-group-order',JSON.stringify(next)); } catch { saved=false; }
      try { sessionStorage.setItem('wr-rea-group-order',JSON.stringify(next)); } catch {}
      sortStatus.textContent=`已调整分组顺序${saved?'，已在本机保存':'，仅本次有效'}`;
      root.dataset.wrReaOrderSaved=String(saved);
    }
    let dragging=null,dropTarget=null,dropAfter=false,suppressClickUntil=0,pointerDrag=null,ghost=null,scrollFrame=0,scrollDirection=0;
    function clearDrop() { if(dropTarget) delete dropTarget.dataset.drop; dropTarget=null; }
    function setDropAt(x,y) {
      const button=document.elementFromPoint(x,y)?.closest('[data-wr-rea-group]');
      clearDrop();
      if(!button || !list.contains(button) || button===dragging) return;
      const rect=button.getBoundingClientRect(); dropAfter=y>rect.top+rect.height/2;
      dropTarget=button; button.dataset.drop=dropAfter?'after':'before';
    }
    function scrollWhileDragging() {
      scrollFrame=0;
      if(!dragging || !pointerDrag || !scrollDirection) return;
      list.scrollTop+=5*scrollDirection;
      setDropAt(pointerDrag.lastX,pointerDrag.lastY);
      scrollFrame=requestAnimationFrame(scrollWhileDragging);
    }
    function finishDrag(commit=false) {
      const source=dragging,target=dropTarget,after=dropAfter,previous=pointerDrag;
      pointerDrag=null; dragging=null; scrollDirection=0; cancelAnimationFrame(scrollFrame); scrollFrame=0;
      if(source) {
        source.classList.remove('wr-rea-dragging'); suppressClickUntil=Date.now()+250;
      }
      ghost?.remove(); ghost=null; clearDrop();
      try { previous?.button.releasePointerCapture(previous.id); } catch {}
      if(commit && source && target) reorder(source.dataset.wrReaGroup,target.dataset.wrReaGroup,after);
    }
    // Pointer capture keeps movement consistent inside the independent scroller
    // and avoids relying on native HTML drag payloads for a local-only reorder.
    list.addEventListener('dragstart',event=>event.preventDefault());
    list.addEventListener('pointerdown',event=>{
      if(event.button!==0 || event.ctrlKey || event.metaKey || event.altKey) return;
      const button=event.target.closest('[data-wr-rea-group]');
      if(!button) return;
      pointerDrag={button,id:event.pointerId,x:event.clientX,y:event.clientY};
      button.setPointerCapture(event.pointerId);
    });
    list.addEventListener('pointermove',event=>{
      if(!pointerDrag || event.pointerId!==pointerDrag.id) return;
      if(!dragging) {
        if(Math.hypot(event.clientX-pointerDrag.x,event.clientY-pointerDrag.y)<5) return;
        dragging=pointerDrag.button; dragging.classList.add('wr-rea-dragging');
        ghost=document.createElement('div'); ghost.className='wr-rea-drag-ghost wr-rea-ui'; ghost.textContent=dragging.textContent; ghost.setAttribute('aria-hidden','true');
        ghost.style.width=`${dragging.getBoundingClientRect().width}px`; (document.body || root).append(ghost);
      }
      event.preventDefault();
      ghost.style.left=`${event.clientX+12}px`; ghost.style.top=`${event.clientY+8}px`;
      pointerDrag.lastX=event.clientX; pointerDrag.lastY=event.clientY;
      const area=list.getBoundingClientRect();
      scrollDirection=event.clientY>area.bottom-30?1:event.clientY<area.top+55?-1:0;
      if(scrollDirection && !scrollFrame)scrollFrame=requestAnimationFrame(scrollWhileDragging);
      setDropAt(event.clientX,event.clientY);
    });
    list.addEventListener('pointerup',event=>{if(event.pointerId===pointerDrag?.id)finishDrag(true);});
    list.addEventListener('pointercancel',()=>finishDrag());
    list.addEventListener('lostpointercapture',()=>finishDrag());
    controller.signal.addEventListener('abort',()=>finishDrag(),{once:true});
    list.addEventListener('keydown',event=>{
      if(!event.altKey || !['ArrowUp','ArrowDown'].includes(event.key)) return;
      const button=event.target.closest('[data-wr-rea-group]'); if(!button)return;
      event.preventDefault();
      const visible=groupButtons().filter(item=>!item.hidden); const direction=event.key==='ArrowUp'?-1:1;
      const target=visible[visible.indexOf(button)+direction];
      if(target) { reorder(button.dataset.wrReaGroup,target.dataset.wrReaGroup,direction>0); button.focus({preventScroll:true}); }
    });
    const empty = document.createElement('p'); empty.className = 'wr-rea-empty'; empty.textContent = '没有匹配的分组'; empty.hidden = true;
    filter.addEventListener('input',()=>{
      const query = filter.value.trim().toLocaleLowerCase(); let matches = 0;
      for (const button of list.children) {
        const root = button.dataset.wrReaPath === ROOT;
        button.hidden = !root && !button.textContent.toLocaleLowerCase().includes(query);
        if (!root && !button.hidden) matches++;
      }
      empty.hidden = !query || matches > 0;
    });
    nav.addEventListener('click',event=>{
      const button = event.target.closest('[data-wr-rea-path]');
      if (!button || (event.button != null && event.button !== 0)) return;
      event.preventDefault();
      if(Date.now()<suppressClickUntil) return;
      const path = button.dataset.wrReaPath;
      if (event.ctrlKey || event.metaKey || event.shiftKey) { window.open(path,'_blank','noopener'); return; }
      if (location.pathname.replace(/\/$/,'') !== path) history.pushState({...history.state,wrReaShelf:true},'',path);
      renderRoute(path);
    });
    nav.append(title,filter,list,empty,sortStatus);
    return nav;
  }

  function coverCard(book) {
    const card = document.createElement('a'); card.className = 'wr-rea-book';
    const reader = safeReader(book.readerLink);
    if (reader) card.href = reader;
    else { card.classList.add('wr-rea-unavailable'); card.setAttribute('aria-disabled','true'); }
    card.title = book.title; card.setAttribute('aria-label',book.title);
    const image = document.createElement('img'); image.src = book.cover; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async'; image.width = 128; image.height = 185;
    card.append(image);
    return card;
  }

  function appendPage(view) {
    if (view.rendered >= view.books.length) return;
    const end = Math.min(view.rendered + 36,view.books.length);
    const fragment = document.createDocumentFragment();
    for (let index=view.rendered;index<end;index++) fragment.append(coverCard(view.books[index]));
    view.grid.append(fragment); view.rendered = end;
    if (view === currentView) updateCount();
  }

  function updateCount() {
    const status = document.querySelector(`#${HEADING} p`);
    if (!status || !currentView) return;
    const view = currentView;
    const text = view.rendered < view.books.length ? `${view.rendered} / ${view.books.length} 本` : `共 ${view.books.length} 本`;
    status.textContent = view.missing ? `${text} · ${view.missing} 项暂未返回` : text;
  }

  function renderRoute(path) {
    const host = document.getElementById(VIEW);
    const match = path.match(ROUTE);
    if (!host || !catalog || !match) return;
    if (currentView?.path !== path || !currentView.grid.isConnected) {
      if (currentView) currentView.scroll = host.scrollTop;
      let view = cachedViews.get(path);
      if (!view) {
        const data = catalog.view(match[1] || '');
        view = {...data,path,rendered:0,scroll:0,grid:document.createElement('div'),more:document.createElement('div')};
        view.grid.className = 'wr-rea-cover-grid'; view.more.className = 'wr-rea-more';
        if (!view.books.length) {
          const empty = document.createElement('p'); empty.className = 'wr-rea-empty-view'; empty.textContent = data.missing ? '部分书籍信息暂未返回。' : '这里还没有书籍。';
          view.grid.append(empty);
        }
        const saved=positions[path];
        const restoreCount=Math.min(view.books.length,Math.max(36,Number(saved?.rendered)||0));
        do { appendPage(view); } while(view.rendered<restoreCount);
        view.scroll=Math.max(0,Number(saved?.scroll)||0); cachedViews.set(path,view);
      }
      intersection?.disconnect(); currentView = view;
      host.replaceChildren(view.grid,view.more); host.scrollTop = view.scroll;
      intersection = new IntersectionObserver(entries=>{ if(entries.some(entry=>entry.isIntersecting) && currentView) appendPage(currentView); },{root:host,rootMargin:'320px 0px'});
      intersection.observe(view.more);
    }
    const title = document.querySelector(`#${HEADING} h1`);
    if (title && title.textContent !== currentView.name) title.textContent = currentView.name;
    const list = document.querySelector(`#${NAV} .wr-rea-tabs`);
    if (list) for (const button of list.children) {
      if (button.dataset.wrReaPath === path) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    }
    updateCount();
    document.documentElement.dataset.wrReaNavigation = 'ready';
  }

  function schedule() {
    if (scheduled || disposed) return; scheduled = true;
    requestAnimationFrame(()=>{ scheduled = false; if(!disposed) refresh(); });
  }

  function refresh() {
    const match = location.pathname.match(ROUTE);
    if (!match) { disable(); return; }
    if (!catalog) loadCatalog();
    const container = document.querySelector('.shelf_container');
    if (!container) return;
    if (!catalog) return;
    document.documentElement.classList.add('wr-rea-shelf');
    document.documentElement.classList.remove('wr-rea-navigating','wr-rea-pending');
    clearTimeout(pendingTimer);
    document.documentElement.dataset.wrReaStatus = 'active';
    if (!document.getElementById(NAV)) container.prepend(createNavigation());
    if (!document.getElementById(HEADING)) {
      const heading = document.createElement('header'); heading.id = HEADING; heading.className = 'wr-rea-ui';
      const title = document.createElement('h1'); const count = document.createElement('p'); count.setAttribute('role','status');
      const start=document.createElement('div'); start.className='wr-rea-heading-start';
      const end=document.createElement('div'); end.className='wr-rea-heading-end';
      const fold=document.createElement('button'); fold.type='button'; fold.id='wr-rea-fold'; fold.className='wr-rea-icon-button'; fold.setAttribute('aria-controls',NAV);
      fold.innerHTML='<svg viewBox="0 0 24 24"><path d="m14 6-6 6 6 6"/></svg>';
      fold.addEventListener('click',()=>{preferences.collapsed=!preferences.collapsed;applyPreferences();});
      const theme=document.createElement('button'); theme.type='button'; theme.id='wr-rea-theme'; theme.className='wr-rea-icon-button';
      theme.addEventListener('click',()=>{preferences.theme=preferences.theme==='dark'?'light':'dark';applyPreferences();});
      start.append(fold,title); end.append(count,theme); heading.append(start,end); container.append(heading); applyPreferences();
    }
    if (!document.getElementById(VIEW)) {
      const host = document.createElement('div'); host.id = VIEW; host.className = 'wr-rea-ui'; host.setAttribute('aria-label','书籍封面');
      host.addEventListener('click',event=>{if(event.target.closest('a'))savePositions();});
      container.append(host);
    }
    renderRoute(match[1] ? `${ROOT}/archive/${match[1]}` : ROOT);
  }

  function disable() {
    intersection?.disconnect();
    document.documentElement.classList.remove('wr-rea-shelf','wr-rea-navigating','wr-rea-pending');
    for (const id of [NAV,HEADING,VIEW]) document.getElementById(id)?.remove();
    document.documentElement.dataset.wrReaStatus = 'inactive';
  }

  observer = new MutationObserver(records=>{if(records.some(record=>!record.target.closest?.('.wr-rea-ui'))) schedule();});
  observer.observe(root,{childList:true,subtree:true});
  window.addEventListener('popstate',schedule);
  window.addEventListener('pageshow',schedule);
  window.addEventListener('pagehide',savePositions);
  window.addEventListener('resize',schedule,{passive:true});
  const timer = setInterval(()=>{if(ROUTE.test(location.pathname)) schedule();},1000);
  window.__wrReaShelfCleanup = ()=>{
    savePositions(); disposed = true; observer.disconnect(); intersection?.disconnect(); clearInterval(timer); clearTimeout(pendingTimer); controller.abort();
    window.removeEventListener('popstate',schedule); window.removeEventListener('resize',schedule);
    window.removeEventListener('pageshow',schedule); window.removeEventListener('pagehide',savePositions);
    disable(); style.remove(); cachedViews.clear(); delete window.__wrReaShelfCleanup;
  };
  schedule();
})();
