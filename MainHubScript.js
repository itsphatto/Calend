(function(){
  // ---------- Firebase (public config, protected by database rules) ----------
  const firebaseConfig = {
    apiKey: "AIzaSyC3Sm_VhUTcoaAy6xLUJ9H4f6htVtwV9AA",
    authDomain: "calend-60421.firebaseapp.com",
    databaseURL: "https://calend-60421-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "calend-60421",
    storageBucket: "calend-60421.firebasestorage.app",
    messagingSenderId: "699098434446",
    appId: "1:699098434446:web:288783ebf41d33da14b2df"
  };

  const $ = (id) => document.getElementById(id);
  const CODE_LEN = 8;
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const LAST_KEY = 'noticeboard_last_group';
  const RECENT_KEY = 'noticeboard_recent_groups';
  const TERMS_KEY = 'calend-terms-accepted';
  const TERMS_VERSION = '2026-10';   // keep in sync with calendarBackEnd.js

  let db = null, uid = null, signInPromise = null;
  try{
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
  }catch(e){
    console.error('Firebase init failed', e);
  }

  // ---------- Theme ----------
  const root = document.documentElement;
  function setTheme(t){
    root.setAttribute('data-theme', t);
    $('buttonlightmode').setAttribute('aria-pressed', String(t === 'light'));
    $('buttondarkmode').setAttribute('aria-pressed', String(t === 'dark'));
    try{ localStorage.setItem('calend-theme', t); }catch(e){}
  }
  $('buttonlightmode').addEventListener('click', () => setTheme('light'));
  $('buttondarkmode').addEventListener('click', () => setTheme('dark'));
  setTheme(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

  // ---------- Local storage helpers ----------
  function getLast(){ try{ return localStorage.getItem(LAST_KEY); }catch(e){ return null; } }
  function loadRecent(){
    try{
      const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    }catch(e){ return []; }
  }
  function removeRecent(code){
    try{
      localStorage.setItem(RECENT_KEY, JSON.stringify(loadRecent().filter(g => g.code !== code)));
      if(getLast() === code) localStorage.removeItem(LAST_KEY);
    }catch(e){}
  }
  function rememberBoard(code){
    try{
      let list = loadRecent().filter(g => g.code !== code);
      list.unshift({ code, lastVisited: Date.now() });
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
      localStorage.setItem(LAST_KEY, code);
    }catch(e){}
  }
  function termsAccepted(){
    try{ return localStorage.getItem(TERMS_KEY) === TERMS_VERSION; }catch(e){ return false; }
  }

  function timeAgo(ts){
    if(!ts) return '';
    const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if(s < 60) return 'just now';
    const m = Math.round(s / 60);  if(m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
    const h = Math.round(m / 60);  if(h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    const d = Math.round(h / 24);  if(d < 30) return d + (d === 1 ? ' day ago' : ' days ago');
    const mo = Math.round(d / 30); if(mo < 12) return mo + (mo === 1 ? ' month ago' : ' months ago');
    return 'over a year ago';
  }
  const goTo = (code) => { location.href = 'calendar.html?group=' + encodeURIComponent(code); };

  // ---------- Your boards (right column) ----------
  function renderBoards(){
    const body = $('boardsBody');
    const recent = loadRecent();
    const last = getLast() || (recent[0] && recent[0].code);
    body.innerHTML = '';

    if(!recent.length && !last){
      body.innerHTML = '<div class="empty"><strong>Nothing here yet</strong>Boards you open or create will show up here so you can jump back in with one click.</div>';
      return;
    }

    if(last){
      const a = document.createElement('a');
      a.className = 'resume';
      a.href = 'calendar.html?group=' + encodeURIComponent(last);
      a.innerHTML = '<span class="meta"><span>Pick up where you left off</span><strong></strong></span><span class="go-arrow">Open →</span>';
      a.querySelector('strong').textContent = last;
      body.appendChild(a);
    }

    const others = recent.filter(g => g.code !== last);
    if(others.length){
      const t = document.createElement('p');
      t.className = 'recent-title';
      t.textContent = 'Recent boards';
      body.appendChild(t);

      const ul = document.createElement('ul');
      ul.className = 'recent';
      others.forEach(g => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = 'calendar.html?group=' + encodeURIComponent(g.code);
        const rc = document.createElement('span'); rc.className = 'rc'; rc.textContent = g.code;
        const rt = document.createElement('span'); rt.className = 'rt'; rt.textContent = timeAgo(g.lastVisited);
        a.append(rc, rt);

        const rm = document.createElement('button');
        rm.type = 'button'; rm.className = 'rm';
        rm.title = 'Remove from this list';
        rm.setAttribute('aria-label', 'Remove ' + g.code + ' from recent boards');
        rm.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
        rm.addEventListener('click', () => { removeRecent(g.code); renderBoards(); });

        li.append(a, rm);
        ul.appendChild(li);
      });
      body.appendChild(ul);
    }
  }

  // ---------- Code tiles ----------
  function makeCode(container){
    const boxes = [];
    for(let i = 0; i < CODE_LEN; i++){
      const b = document.createElement('input');
      b.type = 'text'; b.maxLength = 1; b.placeholder = '·';
      b.autocomplete = 'off'; b.autocapitalize = 'characters'; b.spellcheck = false;
      b.setAttribute('aria-label', 'Character ' + (i + 1));
      container.appendChild(b);
      boxes.push(b);
    }
    const api = {
      boxes,
      value: () => boxes.map(b => b.value).join('').toUpperCase(),
      fill(str, start){
        const chars = str.toUpperCase().replace(/[^A-Z0-9]/g, '').split('');
        let i = start || 0;
        chars.forEach(ch => { if(i < CODE_LEN) boxes[i++].value = ch; });
        boxes[Math.min(i, CODE_LEN - 1)].focus();
      },
      clear(){ boxes.forEach(b => b.value = ''); },
      focus(){ boxes[0].focus(); },
      onSubmit: null
    };
    boxes.forEach((b, i) => {
      b.addEventListener('input', () => {
        clearMessage();
        b.value = b.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-1);
        if(b.value && i < CODE_LEN - 1) boxes[i + 1].focus();
      });
      b.addEventListener('keydown', (e) => {
        if(e.key === 'Backspace' && !b.value && i > 0){ boxes[i - 1].value = ''; boxes[i - 1].focus(); e.preventDefault(); }
        else if(e.key === 'ArrowLeft' && i > 0){ boxes[i - 1].focus(); e.preventDefault(); }
        else if(e.key === 'ArrowRight' && i < CODE_LEN - 1){ boxes[i + 1].focus(); e.preventDefault(); }
        else if(e.key === 'Enter'){ $('goBtn').click(); }
      });
      b.addEventListener('paste', (e) => {
        e.preventDefault();
        clearMessage();
        api.fill((e.clipboardData || window.clipboardData).getData('text'), i);
      });
      b.addEventListener('focus', () => b.select());
    });
    return api;
  }
  const joinCode = makeCode($('joinCode'));
  const createCode = makeCode($('createCode'));

  function randomCode(){
    let out = '';
    for(let i = 0; i < CODE_LEN; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return out;
  }
  function rollCode(){ createCode.clear(); createCode.fill(randomCode(), 0); createCode.boxes[CODE_LEN - 1].blur(); }
  $('randomBtn').addEventListener('click', () => { clearMessage(); rollCode(); });

  // ---------- Tabs ----------
  let tab = 'join';
  function setTab(next){
    tab = next;
    $('card').dataset.tab = next;
    ['join', 'create'].forEach(t => {
      const sel = t === next;
      $(t === 'join' ? 'tabJoin' : 'tabCreate').setAttribute('aria-selected', String(sel));
      $(t === 'join' ? 'paneJoin' : 'paneCreate').classList.toggle('active', sel);
    });
    $('goBtn').textContent = next === 'join' ? 'Join board' : 'Create board';
    clearMessage();
    (next === 'join' ? joinCode : createCode).focus();
  }
  $('tabJoin').addEventListener('click', () => setTab('join'));
  $('tabCreate').addEventListener('click', () => setTab('create'));

  // ---------- Messages ----------
  const msg = $('message');
  function clearMessage(){
    msg.textContent = '';
    msg.classList.remove('ok');
    $('joinCode').classList.remove('error');
    $('createCode').classList.remove('error');
  }
  function showError(text){
    msg.classList.remove('ok');
    msg.textContent = text;
    const el = tab === 'join' ? $('joinCode') : $('createCode');
    el.classList.remove('error'); void el.offsetWidth; el.classList.add('error');
  }
  function showConn(text){
    $('conn').textContent = text;
    $('conn').classList.add('show');
  }

  // ---------- Terms ----------
  if(!termsAccepted()) $('termsRow').classList.add('show');
  function termsOk(){ return termsAccepted() || $('termsCheck').checked; }
  function recordTerms(){ try{ localStorage.setItem(TERMS_KEY, TERMS_VERSION); }catch(e){} }

  // ---------- Database ----------
  function ensureSignedIn(){
    if(!db) return Promise.resolve(null);
    if(signInPromise) return signInPromise;
    signInPromise = (async () => {
      try{
        const auth = firebase.auth();
        let user = await new Promise(res => { const un = auth.onAuthStateChanged(u => { un(); res(u); }); });
        if(!user) user = (await auth.signInAnonymously()).user;
        uid = user ? user.uid : null;
        return uid;
      }catch(e){
        console.error('Anonymous sign-in failed', e);
        signInPromise = null;
        return null;
      }
    })();
    return signInPromise;
  }

  // A board exists if it is registered under boards/ or already has notices (older boards)
  async function boardExists(code){
    const [reg, notes] = await Promise.all([
      db.ref('boards/' + code).once('value').catch(() => null),
      db.ref('notices/' + code).limitToFirst(1).once('value')
    ]);
    return !!((reg && reg.exists()) || notes.exists());
  }

  // Atomically claim a new code: 'ok' | 'taken' | 'error'
  async function claimBoard(code){
    try{
      if(await boardExists(code)) return 'taken';
      const res = await db.ref('boards/' + code).transaction(cur => (cur === null ? { createdAt: Date.now(), creatorUid: uid } : undefined));
      return res.committed ? 'ok' : 'taken';
    }catch(e){
      console.error('Could not create board', e);
      return 'error';
    }
  }

  // ---------- Submit ----------
  const goBtn = $('goBtn');
  function busy(on){
    goBtn.disabled = on;
    goBtn.textContent = on ? 'Checking…' : (tab === 'join' ? 'Join board' : 'Create board');
  }

  goBtn.addEventListener('click', async () => {
    clearMessage();
    const box = tab === 'join' ? joinCode : createCode;
    const code = box.value();

    if(code.length < CODE_LEN){ showError(code.length ? 'Fill in all ' + CODE_LEN + ' characters.' : 'Enter a board code first.'); return; }
    if(!termsOk()){ msg.textContent = 'Accept the Privacy Policy and Terms of Service to continue.'; return; }
    if(!db){ showConn("Couldn't connect to the database. Check your connection and reload the page."); return; }

    busy(true);
    const user = await ensureSignedIn();
    if(!user){ busy(false); showConn("Couldn't sign in. Check your connection and reload the page."); return; }

    if(tab === 'join'){
      let found;
      try{ found = await boardExists(code); }
      catch(e){ console.error('Board lookup failed', e); busy(false); showError("Couldn't reach the database. Try again."); return; }
      if(!found){ busy(false); showError('No board found with code ' + code + '. Check the code and try again.'); return; }
    }else{
      const result = await claimBoard(code);
      if(result === 'taken'){ busy(false); showError(code + ' is already taken. Pick a different code.'); return; }
      if(result === 'error'){ busy(false); showError("Couldn't create the board. Check your connection and try again."); return; }
    }

    recordTerms();
    rememberBoard(code);
    goBtn.textContent = 'Opening…';
    msg.classList.add('ok');
    msg.textContent = tab === 'join' ? 'Board found.' : 'Board created. Share ' + code + ' with your group.';
    goTo(code);
  });

  // ---------- Init ----------
  renderBoards();
  rollCode();
  joinCode.focus();
  ensureSignedIn();   // warm up sign-in so the first click is fast

  // Back/forward cache: refresh the list and reset the button
  window.addEventListener('pageshow', (e) => { if(e.persisted){ renderBoards(); busy(false); } });
})();