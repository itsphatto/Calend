(function(){
  // ======================================================================
  // FIREBASE CONFIG
  // (This config is public by design. Security comes from your database
  // rules, API key restrictions and App Check, not from hiding this.)
  // ======================================================================
  const firebaseConfig = {
    apiKey: "AIzaSyC3Sm_VhUTcoaAy6xLUJ9H4f6htVtwV9AA",
    authDomain: "calend-60421.firebaseapp.com",
    databaseURL: "https://calend-60421-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "calend-60421",
    storageBucket: "calend-60421.firebasestorage.app",
    messagingSenderId: "699098434446",
    appId: "1:699098434446:web:288783ebf41d33da14b2df"
  };
  // ======================================================================

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const NOTE_MAX_LEN = 20;
  const WEEKDAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const PRESET_COLORS = ["#E2A33D","#2F6B5C","#C1503B","#3B6EA8","#8A5FBF","#3E9C6E","#D46FA0","#C77A2B","#4C8FA0","#7A6BC7"];

  const today = new Date();
  const state = {
    year: today.getFullYear(),
    month: today.getMonth(),
    groupId: null,
    profile: null,
    uid: null,
    boardCreator: null,
    monthData: {},
    selectedDate: null,
    editingId: null
  };

  const $ = (id) => document.getElementById(id);
  const grid = $("grid");
  const overlay = $("overlay");
  const panel = $("dayPanel");
  const profileModal = $("profileModal");
  const groupModal = $("groupModal");
  const toastEl = $("toast");
  const connBanner = $("connBanner");

  function pad(n){ return String(n).padStart(2,"0"); }
  function monthKey(y,m){ return `${y}-${pad(m+1)}`; }
  function dateStr(y,m,d){ return `${y}-${pad(m+1)}-${pad(d)}`; }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function hashStr(s){
    let h = 0;
    for(let i=0;i<s.length;i++){ h = (h*31 + s.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }
  function luminanceTextColor(hex){
    const c = hex.replace('#','');
    if(c.length !== 6) return '#1E2A35';
    const r = parseInt(c.substr(0,2),16), g = parseInt(c.substr(2,2),16), b = parseInt(c.substr(4,2),16);
    const yiq = (r*299 + g*587 + b*114) / 1000;
    return yiq >= 150 ? '#1E2A35' : '#FFFFFF';
  }
  function showToast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=> toastEl.classList.remove('show'), 2200);
  }


  let db = null;
  let firebaseReady = false;
  try{
    if(typeof firebase !== 'undefined' && firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY"){
      firebase.initializeApp(firebaseConfig);
      db = firebase.database();
      firebaseReady = true;
    }
  }catch(e){
    console.error('Firebase init failed', e);
    firebaseReady = false;
  }

  function showConnBanner(){
    if(!firebaseReady){
      connBanner.innerHTML = 'Not connected to a shared database yet — notices in this tab are <strong>local preview only</strong> and won\'t be saved or shared. Paste your Firebase config into the script to enable syncing.';
      connBanner.classList.add('show');
      connBanner.classList.remove('error');
    }else{
      connBanner.classList.remove('show');
    }
  }

  function showConnError(msg){
    connBanner.innerHTML = 'Connection problem: ' + escapeHtml(msg) + ' — check your Firebase config and database rules.';
    connBanner.classList.add('show');
    connBanner.classList.add('error');
  }

  // ---------- Anonymous sign-in ----------
  // Every visitor gets a private, persistent anonymous uid (no account needed).
  // The database rules use it for ownership and for rate limiting.
  async function ensureSignedIn(){
    if(!firebaseReady) return null;
    try{
      const auth = firebase.auth();
      let user = await new Promise((resolve) => {
        const unsub = auth.onAuthStateChanged((u) => { unsub(); resolve(u); });
      });
      if(!user){
        const cred = await auth.signInAnonymously();
        user = cred.user;
      }
      state.uid = user ? user.uid : null;
      return state.uid;
    }catch(e){
      console.error('Anonymous sign-in failed', e);
      showConnError('sign-in failed (' + (e.message || e.code || 'unknown') + ')');
      return null;
    }
  }


  const GROUP_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  function generateGroupCode(len){
    len = len || 8;
    let out = '';
    for(let i=0;i<len;i++) out += GROUP_CODE_CHARS[Math.floor(Math.random()*GROUP_CODE_CHARS.length)];
    return out;
  }

  function getGroupFromURL(){
    const params = new URLSearchParams(location.search);
    const g = params.get('group');
    return g ? g.trim().toUpperCase() : null;
  }

  function setGroupInURL(code){
    const url = new URL(location.href);
    url.searchParams.set('group', code);
    history.replaceState({}, '', url.toString());
  }

  function clearGroupInURL(){
    const url = new URL(location.href);
    url.searchParams.delete('group');
    history.replaceState({}, '', url.toString());
  }

  function saveLastGroup(code){
    try{ localStorage.setItem('noticeboard_last_group', code); }catch(e){}
  }
  function getLastGroup(){
    try{ return localStorage.getItem('noticeboard_last_group'); }catch(e){ return null; }
  }

  const RECENT_GROUPS_KEY = 'noticeboard_recent_groups';
  const RECENT_GROUPS_MAX = 8;

  function loadRecentGroups(){
    try{
      const raw = localStorage.getItem(RECENT_GROUPS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    }catch(e){ return []; }
  }

  function addRecentGroup(code){
    try{
      let list = loadRecentGroups();
      list = list.filter(g => g.code !== code);
      list.unshift({ code, lastVisited: Date.now() });
      list = list.slice(0, RECENT_GROUPS_MAX);
      localStorage.setItem(RECENT_GROUPS_KEY, JSON.stringify(list));
    }catch(e){
      console.error('Could not save recent board', e);
    }
  }

  function removeRecentGroup(code){
    try{
      const list = loadRecentGroups().filter(g => g.code !== code);
      localStorage.setItem(RECENT_GROUPS_KEY, JSON.stringify(list));
      if(getLastGroup() === code){ localStorage.removeItem('noticeboard_last_group'); }
    }catch(e){
      console.error('Could not clean up recent board', e);
    }
  }

  function renderBoardBar(){
    $("boardCode").textContent = state.groupId || '—';
  }

  const BOARD_CODE_LEN = 8;
  const codeBoxes = Array.from(document.querySelectorAll('#codeBoxes .code-box'));

  function setGateError(msg){
    const el = $("gateError");
    el.textContent = msg || '';
    el.classList.toggle('show', !!msg);
    codeBoxes.forEach(b => b.classList.remove('has-error'));
    $("joinGroupInput").classList.remove('has-error');
    if(msg){
      const targets = groupModal.dataset.tab === 'create' ? codeBoxes : [$("joinGroupInput")];
      targets.forEach(t => { t.classList.remove('has-error'); void t.offsetWidth; t.classList.add('has-error'); });
    }
  }

  function setGateBusy(busy){
    const joinBtn = $("joinGroupBtn"), createBtn = $("createGroupBtn");
    joinBtn.disabled = busy;
    createBtn.disabled = busy;
    joinBtn.textContent = busy ? 'Checking…' : 'Join board';
    createBtn.textContent = busy ? 'Checking…' : 'Create board';
  }

  function readCreateCode(){ return codeBoxes.map(b => b.value).join('').toUpperCase(); }

  function fillCreateCode(str, startAt){
    const chars = str.toUpperCase().replace(/[^A-Z0-9]/g, '').split('');
    let i = startAt || 0;
    chars.forEach(ch => { if(i < codeBoxes.length) codeBoxes[i++].value = ch; });
    codeBoxes[Math.min(i, codeBoxes.length - 1)].focus();
  }

  codeBoxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      setGateError('');
      const clean = box.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      box.value = clean.slice(-1);
      if(box.value && i < codeBoxes.length - 1) codeBoxes[i + 1].focus();
    });
    box.addEventListener('keydown', (e) => {
      if(e.key === 'Backspace' && !box.value && i > 0){ codeBoxes[i - 1].value = ''; codeBoxes[i - 1].focus(); e.preventDefault(); }
      else if(e.key === 'ArrowLeft' && i > 0){ codeBoxes[i - 1].focus(); e.preventDefault(); }
      else if(e.key === 'ArrowRight' && i < codeBoxes.length - 1){ codeBoxes[i + 1].focus(); e.preventDefault(); }
      else if(e.key === 'Enter'){ $("createGroupBtn").click(); }
    });
    box.addEventListener('paste', (e) => {
      e.preventDefault();
      setGateError('');
      fillCreateCode((e.clipboardData || window.clipboardData).getData('text'), i);
    });
    box.addEventListener('focus', () => box.select());
  });

  $("randomCodeBtn").addEventListener('click', () => {
    setGateError('');
    codeBoxes.forEach(b => b.value = '');
    fillCreateCode(generateGroupCode(BOARD_CODE_LEN), 0);
  });
  $("joinGroupInput").addEventListener('input', () => setGateError(''));

  // A board exists if it is registered under boards/ or already has notices (older boards)
  async function boardExists(code){
    const [reg, notes] = await Promise.all([
      db.ref(`boards/${code}`).once('value').catch(() => null),
      db.ref(`notices/${code}`).limitToFirst(1).once('value')
    ]);
    return !!((reg && reg.exists()) || notes.exists());
  }

  // Atomically claim a new code: 'ok' | 'taken' | 'error'
  async function claimBoard(code){
    try{
      if(await boardExists(code)) return 'taken';
      const res = await db.ref(`boards/${code}`).transaction(cur => (cur === null ? { createdAt: Date.now(), creatorUid: state.uid } : undefined));
      return res.committed ? 'ok' : 'taken';
    }catch(e){
      console.error('Could not create board', e);
      return 'error';
    }
  }

  // Only the board's creator (matched by anonymous uid) sees the delete button.
  // Boards created before this feature have no creatorUid, so nobody can delete
  // them from the UI (remove those from the Firebase console).
  function renderDeleteButton(){
    const btn = $("deleteBoardBtn");
    if(!btn) return;
    const mine = !!(state.uid && state.boardCreator && state.boardCreator === state.uid);
    btn.style.display = mine ? 'flex' : 'none';
  }

  async function loadBoardMeta(){
    state.boardCreator = null;
    if(firebaseReady && state.groupId){
      try{
        const snap = await db.ref(`boards/${state.groupId}/creatorUid`).once('value');
        state.boardCreator = snap.val() || null;
      }catch(e){
        console.error('Could not load board info', e);
      }
    }
    renderDeleteButton();
  }

  function setGateTab(tab){
    groupModal.dataset.tab = tab;
    groupModal.querySelectorAll('.gate-tab').forEach(t => {
      const on = t.dataset.tab === tab;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });
    setGateError('');
    if(tab === 'join') $("joinGroupInput").focus();
    else codeBoxes[0].focus();
  }
  groupModal.querySelectorAll('.gate-tab').forEach(t => t.addEventListener('click', () => setGateTab(t.dataset.tab)));
  $("joinGroupInput").addEventListener('keydown', (e) => { if(e.key === 'Enter') $("joinGroupBtn").click(); });

  function openGroupGate(onResolved){
    const last = getLastGroup();
    if(last && last !== state.groupId){
      $("continueGroupCode").textContent = last;
      $("groupContinueRow").style.display = 'block';
    }else{
      $("groupContinueRow").style.display = 'none';
    }
    $("joinGroupInput").value = '';
    codeBoxes.forEach(b => b.value = '');
    setGateBusy(false);
    groupModal.classList.add('show');
    setGateTab('join');
    overlay.classList.add('show');
    groupModal.dataset.forced = '1';
    $("app").classList.add('app-locked');
    document.body.style.overflow = 'hidden';

    const finish = (code) => {
      if(!code) return;
      state.groupId = code;
      setGroupInURL(code);
      saveLastGroup(code);
      addRecentGroup(code);
      renderBoardBar();
      groupModal.classList.remove('show');
      groupModal.dataset.forced = '0';
      $("app").classList.remove('app-locked');
      document.body.style.overflow = '';
      if(!panel.classList.contains('open') && !profileModal.classList.contains('show')){
        overlay.classList.remove('show');
      }
      onResolved();
    };

    $("continueGroupBtn").onclick = () => finish(last);
    $("createGroupBtn").onclick = async () => {
      const code = readCreateCode();
      if(code.length < BOARD_CODE_LEN){ setGateError(`Fill in all ${BOARD_CODE_LEN} characters.`); return; }
      setGateBusy(true);
      const result = await claimBoard(code);
      setGateBusy(false);
      if(result === 'taken'){ setGateError(`${code} is already taken. Try a different code.`); return; }
      if(result === 'error'){ setGateError("Couldn't create the board. Check your connection or database rules."); return; }
      finish(code);
    };
    $("joinGroupBtn").onclick = async () => {
      const val = $("joinGroupInput").value.trim().toUpperCase();
      if(!val){ setGateError('Enter a board code first.'); return; }
      setGateBusy(true);
      let found;
      try{ found = await boardExists(val); }
      catch(e){ console.error('Board lookup failed', e); setGateBusy(false); setGateError("Couldn't reach the database. Try again."); return; }
      setGateBusy(false);
      if(!found){ setGateError(`No board found with code ${val}.`); return; }
      finish(val);
    };
  }

  async function resolveGroup(){
    const fromURL = getGroupFromURL();
    if(fromURL){
      let found = true;
      try{ found = await boardExists(fromURL); }catch(e){ console.error('Board lookup failed', e); }
      if(!found){
        clearGroupInURL();
        return new Promise((resolve) => {
          openGroupGate(resolve);
          setGateError(`No board found with code ${fromURL}.`);
        });
      }
      state.groupId = fromURL;
      saveLastGroup(fromURL);
      addRecentGroup(fromURL);
      renderBoardBar();
      return Promise.resolve();
    }
    return new Promise((resolve) => openGroupGate(resolve));
  }

  function loadProfileLocal(){
    try{
      const raw = localStorage.getItem('noticeboard_profile');
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }
  function saveProfileLocal(profile){
    try{
      localStorage.setItem('noticeboard_profile', JSON.stringify(profile));
      return true;
    }catch(e){
      console.error('localStorage save failed', e);
      return false;
    }
  }

  async function loadProfile(){
    state.profile = loadProfileLocal();
    renderProfileChip();
    if(!state.profile){
      openProfileModal(true);
    }
  }

  function renderProfileChip(){
    const dot = $("profileDot");
    const nameEl = $("profileName");
    if(state.profile){
      dot.style.background = state.profile.color;
      nameEl.textContent = state.profile.name;
    }else{
      dot.style.background = '#D7DEE4';
      nameEl.textContent = 'Set up profile';
    }
  }

  function readableOn(hex){
    let h = (hex || '#000000').replace('#', '');
    if(h.length === 3) h = h.split('').map(ch => ch + ch).join('');
    const n = parseInt(h, 16);
    const lum = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255);
    return lum > 150 ? '#1A1A1A' : '#FFFFFF';
  }

  function updateProfilePreview(){
    const input = $("nameInput");
    const name = input.value.trim();
    const ci = $("colorInput");
    const color = ci ? ci.value : PRESET_COLORS[0];
    const av = $("previewAvatar");
    av.style.background = color;
    av.style.color = readableOn(color);
    av.textContent = name ? [...name][0].toUpperCase() : '?';
    $("previewName").textContent = name || 'Your name';
    $("nameCounter").textContent = `${input.value.length}/${input.maxLength}`;
  }

  function buildSwatchRow(selectedColor){
    const row = $("swatchRow");
    row.innerHTML = '';
    PRESET_COLORS.forEach(color => {
      const sw = document.createElement('div');
      sw.className = 'swatch' + (color.toLowerCase() === (selectedColor||'').toLowerCase() ? ' active' : '');
      sw.style.background = color;
      sw.dataset.color = color;
      sw.addEventListener('click', () => {
        row.querySelectorAll('.swatch').forEach(s=>s.classList.remove('active'));
        sw.classList.add('active');
        colorInput.value = color;
        colorInput.dataset.chosen = color;
        updateProfilePreview();
      });
      row.appendChild(sw);
    });
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.id = 'colorInput';
    colorInput.value = selectedColor || PRESET_COLORS[0];
    colorInput.addEventListener('input', () => {
      row.querySelectorAll('.swatch').forEach(s=>s.classList.remove('active'));
      updateProfilePreview();
    });
    row.appendChild(colorInput);
  }

  function openProfileModal(forced){
    $("nameInput").value = state.profile ? state.profile.name : '';
    buildSwatchRow(state.profile ? state.profile.color : PRESET_COLORS[hashStr(String(Date.now()))%PRESET_COLORS.length]);
    updateProfilePreview();
    $("profileCancelBtn").style.display = forced ? 'none' : 'block';
    profileModal.classList.add('show');
    overlay.classList.add('show');
    profileModal.dataset.forced = forced ? '1' : '0';
    $("nameInput").focus();
  }
  function closeProfileModal(){
    profileModal.classList.remove('show');
    if(!panel.classList.contains('open') && !groupModal.classList.contains('show')) overlay.classList.remove('show');
  }

  $("nameInput").addEventListener('input', updateProfilePreview);
  $("nameInput").addEventListener('keydown', (e) => { if(e.key === 'Enter') $("profileSaveBtn").click(); });
  $("profileChip").addEventListener('click', ()=> openProfileModal(false));
  $("profileCancelBtn").addEventListener('click', closeProfileModal);
  $("setupLink").addEventListener('click', ()=> openProfileModal(false));

  // Recolors only notices that belong to this browser's anonymous uid
  // (the database rules reject edits to anyone else's notices anyway).
  async function recolorMyNotices(newColor){
    const uid = state.uid;
    if(!uid) return 0;

    let localMatches = 0;
    Object.keys(state.monthData).forEach(mKey => {
      const monthObj = state.monthData[mKey] || {};
      Object.keys(monthObj).forEach(dateKey => {
        const dayObj = monthObj[dateKey] || {};
        Object.keys(dayObj).forEach(noticeId => {
          const n = dayObj[noticeId];
          if(n && n.uid === uid && n.color !== newColor){
            n.color = newColor;
            localMatches++;
          }
        });
      });
    });

    if(!firebaseReady || !state.groupId) return localMatches;

    try{
      const snap = await db.ref(`notices/${state.groupId}`).once('value');
      const allMonths = snap.val() || {};
      const updates = {};
      Object.keys(allMonths).forEach(mKey => {
        const monthObj = allMonths[mKey] || {};
        Object.keys(monthObj).forEach(dateKey => {
          const dayObj = monthObj[dateKey] || {};
          Object.keys(dayObj).forEach(noticeId => {
            const n = dayObj[noticeId];
            if(n && n.uid === uid && n.color !== newColor){
              updates[`notices/${state.groupId}/${mKey}/${dateKey}/${noticeId}/color`] = newColor;
            }
          });
        });
      });
      const count = Object.keys(updates).length;
      if(count > 0){
        await db.ref().update(updates);
      }
      return count;
    }catch(e){
      console.error('Recolor failed', e);
      showConnError(e.message || 'could not update your existing notices');
      return localMatches;
    }
  }

  $("profileSaveBtn").addEventListener('click', async () => {
    const name = $("nameInput").value.trim();
    if(!name){ showToast('Please enter a name.'); return; }
    const colorInput = $("colorInput");
    const color = colorInput ? colorInput.value : PRESET_COLORS[0];

    const prevProfile = state.profile;
    const sameName = prevProfile && prevProfile.name === name;
    const colorChanged = prevProfile && prevProfile.color !== color;

    state.profile = { name, color };
    renderProfileChip();
    closeProfileModal();
    const ok = saveProfileLocal(state.profile);

    if(sameName && colorChanged){
      showToast('Updating your existing notices…');
      const count = await recolorMyNotices(color);
      showToast(count > 0 ? `Recolored ${count} existing notice${count===1?'':'s'}.` : 'Color saved.');
    }else{
      showToast(ok ? 'Profile saved on this browser.' : 'Could not save profile locally.');
    }

    renderGrid();
    if(state.selectedDate) renderPanel(state.selectedDate);
  });


  const listenedMonths = new Set();

  function detachAllMonthListeners(){
    if(!firebaseReady || !state.groupId) return;
    listenedMonths.forEach(key => {
      try{ db.ref(`notices/${state.groupId}/${key}`).off('value'); }catch(e){}
    });
    listenedMonths.clear();
  }

  function loadMonth(year, month){
    const key = monthKey(year, month);

    if(!firebaseReady){
      state.monthData[key] = state.monthData[key] || {};
      return Promise.resolve(state.monthData[key]);
    }

    if(listenedMonths.has(key)){
      return Promise.resolve(state.monthData[key] || {});
    }
    listenedMonths.add(key);

    return new Promise((resolve) => {
      let first = true;
      db.ref(`notices/${state.groupId}/${key}`).on('value', (snapshot) => {
        const data = snapshot.val() || {};
        state.monthData[key] = data;
        if(first){
          first = false;
          resolve(data);
        }else{

          if(key === monthKey(state.year, state.month)){
            renderGrid();
            renderLegend();
          }
          if(state.selectedDate){
            const parts = state.selectedDate.split('-');
            const sy = parseInt(parts[0],10), sm = parseInt(parts[1],10)-1;
            if(monthKey(sy, sm) === key){
              renderPanel(state.selectedDate, sy, sm);
            }
          }
        }
      }, (err) => {
        console.error('Firebase read failed', err);
        listenedMonths.delete(key);
        showConnError(err.message || 'could not read notices');
        if(first){ first = false; resolve({}); }
      });
    });
  }

  function noticesFor(year, month, ds){
    const key = monthKey(year, month);
    const data = state.monthData[key] || {};
    const dayObj = data[ds] || {};
    const list = Object.keys(dayObj).map(id => Object.assign({id}, dayObj[id]));
    list.sort((a, b) => {
      const ao = (a.order !== undefined) ? a.order : a.createdAt;
      const bo = (b.order !== undefined) ? b.order : b.createdAt;
      return ao - bo;
    });
    return list;
  }


  function populateSelects(){
    const monthSel = $("monthSelect");
    monthSel.innerHTML = '';
    MONTH_NAMES.forEach((m,i) => {
      const opt = document.createElement('option');
      opt.value = i; opt.textContent = m;
      monthSel.appendChild(opt);
    });
    const yearSel = $("yearSelect");
    yearSel.innerHTML = '';
    const curYear = today.getFullYear();
    for(let y = curYear - 6; y <= curYear + 6; y++){
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      yearSel.appendChild(opt);
    }
  }

  // Size each select to its current text so "May 2026" and "September 2026" both read as one tight label
  function fitSelect(sel){
    const opt = sel.options[sel.selectedIndex];
    if(!opt) return;
    const cs = getComputedStyle(sel);
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;';
    probe.style.fontFamily = cs.fontFamily;
    probe.style.fontSize = cs.fontSize;
    probe.style.fontWeight = cs.fontWeight;
    probe.style.letterSpacing = cs.letterSpacing;
    probe.textContent = opt.textContent;
    document.body.appendChild(probe);
    sel.style.width = (Math.ceil(probe.getBoundingClientRect().width) + 2) + 'px';
    probe.remove();
  }

  function fitDateSelects(){
    fitSelect($("monthSelect"));
    fitSelect($("yearSelect"));
  }

  function syncSelects(){
    $("monthSelect").value = state.month;
    $("yearSelect").value = state.year;
    fitDateSelects();
  }

  if(document.fonts && document.fonts.ready){ document.fonts.ready.then(fitDateSelects); }


  async function renderMonth(){
    await loadMonth(state.year, state.month);
    syncSelects();
    renderGrid();
    renderLegend();
  }

  function renderLegend(){
    const key = monthKey(state.year, state.month);
    const data = state.monthData[key] || {};
    const people = new Map();
    Object.values(data).forEach(dayObj => {
      Object.values(dayObj||{}).forEach(n => { if(!people.has(n.name)) people.set(n.name, n.color); });
    });
    const legend = $("legend");
    legend.innerHTML = '';
    if(people.size === 0){
      legend.innerHTML = '<span style="color:var(--ink-faint)">No notices pinned this month yet</span>';
      return;
    }
    people.forEach((color, name) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.innerHTML = `<span class="dot" style="background:${escapeHtml(color)}"></span>${escapeHtml(name)}`;
      legend.appendChild(span);
    });
  }

  function renderGrid(){
    grid.innerHTML = '';
    const y = state.year, m = state.month;
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const daysInPrevMonth = new Date(y, m, 0).getDate();
    const totalCells = 42;

    for(let i=0; i<totalCells; i++){
      const cellIndex = i - firstDay;
      let cellY = y, cellM = m, cellD, otherMonth = false;

      if(cellIndex < 0){
        cellD = daysInPrevMonth + cellIndex + 1;
        cellM = m - 1; cellY = y;
        if(cellM < 0){ cellM = 11; cellY = y - 1; }
        otherMonth = true;
      }else if(cellIndex >= daysInMonth){
        cellD = cellIndex - daysInMonth + 1;
        cellM = m + 1; cellY = y;
        if(cellM > 11){ cellM = 0; cellY = y + 1; }
        otherMonth = true;
      }else{
        cellD = cellIndex + 1;
      }

      const ds = dateStr(cellY, cellM, cellD);
      const isToday = (cellY===today.getFullYear() && cellM===today.getMonth() && cellD===today.getDate());

      const cell = document.createElement('div');
      cell.className = 'day-cell' + (otherMonth ? ' other-month' : '') + (isToday ? ' is-today' : '') + (state.selectedDate===ds ? ' selected' : '');
      cell.dataset.date = ds;
      cell.dataset.y = cellY; cell.dataset.m = cellM; cell.dataset.d = cellD;
      cell.style.setProperty('--i', i);

      const dayHead = document.createElement('div');
      dayHead.className = 'day-head';

      const weekdayEl = document.createElement('div');
      weekdayEl.className = 'day-weekday';
      weekdayEl.textContent = WEEKDAY_NAMES[new Date(cellY, cellM, cellD).getDay()].slice(0,3);
      dayHead.appendChild(weekdayEl);

      const numEl = document.createElement('div');
      numEl.className = 'day-num';
      numEl.textContent = cellD;
      dayHead.appendChild(numEl);

      cell.appendChild(dayHead);

      const list = otherMonth ? noticesFor(cellY, cellM, ds) : noticesFor(y, m, ds);

      if(list.length > 0){
        const stack = document.createElement('div');
        stack.className = 'tag-stack';
        const shown = list.slice(0,2);
        shown.forEach(n => {
          const tag = document.createElement('div');
          tag.className = 'pin-tag';
          tag.style.background = n.color;
          tag.style.color = luminanceTextColor(n.color);
          const rot = (hashStr(n.id) % 5) - 2;
          tag.style.setProperty('--tag-rot', `${rot*0.6}deg`);
          tag.textContent = n.text;
          tag.title = `${n.name}: ${n.text}`;
          stack.appendChild(tag);
        });
        if(list.length > 2){
          const more = document.createElement('div');
          more.className = 'more-indicator';
          more.textContent = `+${list.length - 2} more`;
          stack.appendChild(more);
        }
        cell.appendChild(stack);
      }else{
        const hint = document.createElement('div');
        hint.className = 'empty-hint';
        hint.textContent = '+';
        cell.appendChild(hint);
      }

      cell.addEventListener('click', () => openDayPanel(cellY, cellM, cellD, ds));
      grid.appendChild(cell);
    }
  }


  async function openDayPanel(y, m, d, ds){
    state.selectedDate = ds;
    state.editingId = null;
    await loadMonth(y, m);
    renderGrid();
    renderPanel(ds, y, m);
    panel.classList.add('open');
    overlay.classList.add('show');
    $("newNoticeText").value = '';
    $("newNoticeCounter").textContent = `0/${NOTE_MAX_LEN}`;
    $("newNoticeCounter").classList.remove('limit');
  }

  function closeDayPanel(){
    panel.classList.remove('open');
    overlay.classList.remove('show');
    state.selectedDate = null;
    state.editingId = null;
    renderGrid();
  }

  function isMyNotice(n){
    // Ownership is the anonymous uid, matching what the database rules enforce.
    // Local preview mode (no Firebase) has no uid, so fall back to the name.
    if(firebaseReady) return !!(state.uid && n.uid && n.uid === state.uid);
    return !!(state.profile && n.name === state.profile.name);
  }

  function renderPanel(ds, yArg, mArg){
    const [yy, mm, dd] = ds.split('-').map(Number);
    const y = yArg!==undefined?yArg:yy, m = mArg!==undefined?mArg:(mm-1), d = dd;
    const dow = new Date(y, m, d).getDay();
    $("panelDate").textContent = `${WEEKDAY_NAMES[dow]}, ${MONTH_NAMES[m]} ${d}`;
    $("panelEyebrow").textContent = `Notices for ${y}`;

    const list = noticesFor(y, m, ds);
    const body = $("panelBody");
    body.innerHTML = '';

    if(list.length === 0){
      const empty = document.createElement('div');
      empty.className = 'empty-day';
      empty.textContent = 'No notices pinned yet. Be the first!';
      body.appendChild(empty);
    }

    list.forEach(n => {
      const card = document.createElement('div');
      card.className = 'notice-card';
      card.dataset.noticeId = n.id;
      card.style.borderLeftColor = n.color;

      const isMine = isMyNotice(n);
      const editedTag = n.updatedAt && n.updatedAt !== n.createdAt ? ' · edited' : '';

      if(state.editingId === n.id){
        card.innerHTML = `
          <div class="meta">
            <span class="author"><span class="dot" style="background:${escapeHtml(n.color)}"></span>${escapeHtml(n.name)}</span>
            <span class="char-counter" id="editCounter_${n.id}">${n.text.length}/${NOTE_MAX_LEN}</span>
          </div>
          <div class="edit-area">
            <textarea id="editArea_${n.id}" maxlength="${NOTE_MAX_LEN}">${escapeHtml(n.text)}</textarea>
            <div class="edit-actions">
              <button class="btn-primary" style="flex:none;padding:6px 12px;" data-save="${n.id}">Save</button>
              <button class="btn-secondary" style="flex:none;padding:6px 12px;" data-cancel="1">Cancel</button>
            </div>
          </div>
        `;
      }else{
        card.innerHTML = `
          <div class="meta">
            <span class="drag-handle" title="Drag to reorder">⠿</span>
            <span class="author"><span class="dot" style="background:${escapeHtml(n.color)}"></span>${escapeHtml(n.name)}</span>
            ${isMine ? `<span class="actions">
              <button class="icon-btn" data-edit="${n.id}" title="Rename / edit">✎</button>
              <button class="icon-btn danger" data-del="${n.id}" title="Delete">🗑</button>
            </span>` : ''}
          </div>
          <div class="text">${escapeHtml(n.text)}</div>
          <div class="timestamp">${new Date(n.createdAt).toLocaleString()}${editedTag}</div>
        `;
      }
      body.appendChild(card);
    });

    attachDragHandlers(body, ds, y, m);

    body.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.editingId = btn.dataset.edit;
        renderPanel(ds, y, m);
      });
    });
    body.querySelectorAll('[data-cancel]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.editingId = null;
        renderPanel(ds, y, m);
      });
    });
    body.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await deleteNotice(y, m, ds, btn.dataset.del);
        renderPanel(ds, y, m);
        renderGrid();
        renderLegend();
      });
    });
    body.querySelectorAll('[data-save]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.save;
        const ta = $(`editArea_${id}`);
        const newText = ta.value.trim().slice(0, NOTE_MAX_LEN);
        if(!newText){ showToast('Notice text cannot be empty.'); return; }
        await editNotice(y, m, ds, id, newText);
        state.editingId = null;
        renderPanel(ds, y, m);
        renderGrid();
      });
    });
    if(state.editingId){
      const editTa = $(`editArea_${state.editingId}`);
      const editCounter = $(`editCounter_${state.editingId}`);
      if(editTa && editCounter){
        editTa.addEventListener('input', () => {
          const len = editTa.value.length;
          editCounter.textContent = `${len}/${NOTE_MAX_LEN}`;
          editCounter.classList.toggle('limit', len >= NOTE_MAX_LEN);
        });
      }
    }

    const needNote = $("needProfileNote");
    const pinBtn = $("pinBtn");
    if(!state.profile){
      needNote.style.display = 'block';
      pinBtn.disabled = true;
    }else{
      needNote.style.display = 'none';
      pinBtn.disabled = false;
    }
  }

  // Returns true if the notice was saved, false if it was rejected
  // (for example by the 3-second rate limit in the database rules).
  async function addNotice(y, m, ds, text){
    const key = monthKey(y, m);
    const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random().toString(16).slice(2));
    const now = Date.now();
    const notice = {
      name: state.profile.name,
      color: state.profile.color,
      text: text,
      createdAt: now,
      updatedAt: now
    };
    if(state.uid) notice.uid = state.uid;

    if(!firebaseReady){
      // local preview only
      if(!state.monthData[key]) state.monthData[key] = {};
      if(!state.monthData[key][ds]) state.monthData[key][ds] = {};
      state.monthData[key][ds][id] = notice;
      return true;
    }

    if(!state.uid){
      showConnError('you are not signed in yet, please reload the page');
      return false;
    }

    // Optimistic local add so the UI feels instant
    if(!state.monthData[key]) state.monthData[key] = {};
    if(!state.monthData[key][ds]) state.monthData[key][ds] = {};
    state.monthData[key][ds][id] = notice;

    // Create the notice and bump the per-user rate-limit stamp in ONE atomic
    // write. The rules reject it if the previous stamp is less than 3s old.
    const TS = firebase.database.ServerValue.TIMESTAMP;
    const updates = {};
    updates[`notices/${state.groupId}/${key}/${ds}/${id}`] =
      Object.assign({}, notice, { uid: state.uid, createdAt: TS, updatedAt: TS });
    updates[`rateLimit/${state.uid}`] = TS;

    try{
      await db.ref().update(updates);
      return true;
    }catch(e){
      console.error('Failed to save notice', e);
      // roll back the optimistic add
      if(state.monthData[key] && state.monthData[key][ds]) delete state.monthData[key][ds][id];
      if(e && e.code === 'PERMISSION_DENIED'){
        showToast('Slow down, wait a few seconds and try again.');
      }else{
        showConnError(e.message || 'could not save notice');
      }
      return false;
    }
  }

  async function editNotice(y, m, ds, id, newText){
    const key = monthKey(y, m);
    const updates = { text: newText, updatedAt: Date.now() };
    const dayObj = (state.monthData[key] && state.monthData[key][ds]) || {};
    if(dayObj[id]) Object.assign(dayObj[id], updates);

    if(firebaseReady){
      try{
        await db.ref(`notices/${state.groupId}/${key}/${ds}/${id}`).update(updates);
      }catch(e){
        console.error('Failed to edit notice', e);
        if(e && e.code === 'PERMISSION_DENIED') showToast('You can only edit your own notices.');
        else showConnError(e.message || 'could not save edit');
      }
    }
  }

  async function deleteNotice(y, m, ds, id){
    const key = monthKey(y, m);
    const dayObj = (state.monthData[key] && state.monthData[key][ds]) || {};
    const backup = dayObj[id];
    delete dayObj[id];

    if(firebaseReady){
      try{
        await db.ref(`notices/${state.groupId}/${key}/${ds}/${id}`).remove();
      }catch(e){
        console.error('Failed to delete notice', e);
        if(backup) dayObj[id] = backup;   // restore locally if the database refused
        if(e && e.code === 'PERMISSION_DENIED') showToast('You can only delete your own notices.');
        else showConnError(e.message || 'could not delete notice');
      }
    }
  }

  //
  let dragState = null;

  function getDragAfterElement(container, pointerY){
    const cards = Array.from(container.querySelectorAll('.notice-card:not(.dragging)'));
    return cards.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = pointerY - box.top - box.height / 2;
      if(offset < 0 && offset > closest.offset){
        return { offset, element: child };
      }
      return closest;
    }, { offset: -Infinity, element: null }).element;
  }

  function attachDragHandlers(container, ds, y, m){
    container.querySelectorAll('.drag-handle').forEach(handle => {
      handle.addEventListener('pointerdown', (e) => {
        const card = handle.closest('.notice-card');
        if(!card) return;
        e.preventDefault();
        dragState = { id: card.dataset.noticeId, ds, y, m, container };
        card.classList.add('dragging');
        try{ handle.setPointerCapture(e.pointerId); }catch(err){}
      });
    });
  }

  document.addEventListener('pointermove', (e) => {
    if(!dragState) return;
    const { container, id } = dragState;
    const draggedEl = container.querySelector(`.notice-card[data-notice-id="${id}"]`);
    if(!draggedEl) return;
    const afterEl = getDragAfterElement(container, e.clientY);
    if(afterEl == null){
      container.appendChild(draggedEl);
    }else if(afterEl !== draggedEl){
      container.insertBefore(draggedEl, afterEl);
    }
  });

  document.addEventListener('pointerup', async () => {
    if(!dragState) return;
    const { container, id, ds, y, m } = dragState;
    dragState = null;
    const draggedEl = container.querySelector(`.notice-card[data-notice-id="${id}"]`);
    if(draggedEl) draggedEl.classList.remove('dragging');
    const orderedIds = Array.from(container.querySelectorAll('.notice-card')).map(c => c.dataset.noticeId);
    if(orderedIds.length) await persistNoticeOrder(y, m, ds, orderedIds);
  });

  async function persistNoticeOrder(y, m, ds, orderedIds){
    const key = monthKey(y, m);
    const dayObj = (state.monthData[key] && state.monthData[key][ds]) || {};
    const updates = {};
    orderedIds.forEach((id, idx) => {
      const n = dayObj[id];
      if(n){
        n.order = idx;
        if(firebaseReady && state.groupId){
          updates[`notices/${state.groupId}/${key}/${ds}/${id}/order`] = idx;
        }
      }
    });
    renderGrid();
    if(firebaseReady && state.groupId && Object.keys(updates).length){
      try{
        await db.ref().update(updates);
      }catch(e){
        console.error('Failed to save notice order', e);
        showConnError(e.message || 'could not save the new order');
      }
    }
  }

  let pinBusy = false;
  $("pinBtn").addEventListener('click', async () => {
    if(!state.profile){ openProfileModal(false); return; }
    if(pinBusy) return;
    const ta = $("newNoticeText");
    const text = ta.value.trim().slice(0, NOTE_MAX_LEN);
    if(!text){ showToast('Write something first.'); return; }
    const ds = state.selectedDate;
    const [yy, mm] = ds.split('-').map(Number);

    pinBusy = true;
    $("pinBtn").disabled = true;
    const ok = await addNotice(yy, mm-1, ds, text);
    pinBusy = false;
    $("pinBtn").disabled = !state.profile;

    if(ok){
      ta.value = '';
      $("newNoticeCounter").textContent = `0/${NOTE_MAX_LEN}`;
      $("newNoticeCounter").classList.remove('limit');
      showToast('Notice pinned.');
    }
    // on failure the text stays in the box so nothing is lost
    renderPanel(ds, yy, mm-1);
    renderGrid();
    renderLegend();
  });

  $("newNoticeText").addEventListener('input', (e) => {
    const len = e.target.value.length;
    const counter = $("newNoticeCounter");
    counter.textContent = `${len}/${NOTE_MAX_LEN}`;
    counter.classList.toggle('limit', len >= NOTE_MAX_LEN);
  });


  $("prevBtn").addEventListener('click', () => {
    state.month--;
    if(state.month < 0){ state.month = 11; state.year--; }
    renderMonth();
  });
  $("nextBtn").addEventListener('click', () => {
    state.month++;
    if(state.month > 11){ state.month = 0; state.year++; }
    renderMonth();
  });
  $("monthSelect").addEventListener('change', (e) => {
    state.month = parseInt(e.target.value, 10);
    renderMonth();
  });
  $("yearSelect").addEventListener('change', (e) => {
    state.year = parseInt(e.target.value, 10);
    renderMonth();
  });

  $("panelClose").addEventListener('click', closeDayPanel);
  overlay.addEventListener('click', () => {
    if($("termsModal").classList.contains('show')) return;   // terms gate can't be dismissed by clicking outside
    if($("deleteModal") && $("deleteModal").classList.contains('show')) return;   // delete dialog closes via Cancel/Escape only
    closeDayPanel();
    if(groupModal.dataset.forced !== '1') closeProfileModal();
  });
  document.addEventListener('keydown', (e) => {
    if($("termsModal").classList.contains('show')) return;   // ...or with Escape
    if($("deleteModal") && $("deleteModal").classList.contains('show')){
      if(e.key === 'Escape') closeDeleteModal();
      return;
    }
    if(e.key === 'Escape'){
      closeDayPanel();
      if(profileModal.dataset.forced !== '1' && groupModal.dataset.forced !== '1') closeProfileModal();
    }
  });


  const lightBtn = $("buttonlightmode");
  const darkBtn = $("buttondarkmode");

  const themeStorageKey = 'calend-theme';

  function applyTheme(theme){
    document.documentElement.setAttribute('data-theme', theme);
    lightBtn.setAttribute('aria-pressed', String(theme === 'light'));
    darkBtn.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  function setTheme(theme){
    applyTheme(theme);
    try{ localStorage.setItem(themeStorageKey, theme); }catch(e){}
  }

  function initTheme(){
    let saved = null;
    try{ saved = localStorage.getItem(themeStorageKey) || localStorage.getItem('noticeboard_theme'); }catch(e){}
    applyTheme(saved === 'light' ? 'light' : 'dark');
  }

  lightBtn.addEventListener('click', () => setTheme('light'));
  darkBtn.addEventListener('click', () => setTheme('dark'));
  window.addEventListener("storage", (event) => {
    if (event.key === themeStorageKey) applyTheme(event.newValue);
  });

  // ---------- Delete board (creator only) ----------
  const deleteModal = $("deleteModal");
  const deleteInput = $("deleteConfirmInput");
  const deleteConfirmBtn = $("deleteConfirmBtn");
  const deleteError = $("deleteError");

  function setDeleteError(msg){
    deleteError.textContent = msg || '';
    deleteError.classList.toggle('show', !!msg);
  }

  function openDeleteModal(){
    if(!state.groupId) return;
    closeDayPanel();
    $("deleteCodeHint").textContent = state.groupId;
    deleteInput.value = '';
    deleteConfirmBtn.disabled = true;
    deleteConfirmBtn.textContent = 'Delete board';
    setDeleteError('');
    deleteModal.classList.add('show');
    overlay.classList.add('show');
    deleteInput.focus();
  }

  function closeDeleteModal(){
    deleteModal.classList.remove('show');
    overlay.classList.remove('show');
  }

  async function deleteBoard(){
    const code = state.groupId;
    if(!firebaseReady || !code) return;
    deleteConfirmBtn.disabled = true;
    deleteConfirmBtn.textContent = 'Deleting…';
    setDeleteError('');

    detachAllMonthListeners();
    try{
      // One atomic write: all notices and the board record go together or not at all.
      const updates = {};
      updates[`notices/${code}`] = null;
      updates[`boards/${code}`] = null;
      await db.ref().update(updates);
    }catch(e){
      console.error('Failed to delete board', e);
      setDeleteError(e && e.code === 'PERMISSION_DENIED'
        ? 'Only the board creator can delete this board.'
        : "Couldn't delete the board. Check your connection and try again.");
      deleteConfirmBtn.textContent = 'Delete board';
      deleteConfirmBtn.disabled = deleteInput.value.trim().toUpperCase() !== code;
      renderMonth();   // re-attach the listeners we detached
      return;
    }

    removeRecentGroup(code);
    try{ sessionStorage.setItem('calend-stay-home', '1'); }catch(e){}
    location.href = 'index.html?home';
  }

  if($("deleteBoardBtn")){
    $("deleteBoardBtn").addEventListener('click', openDeleteModal);
    $("deleteCancelBtn").addEventListener('click', closeDeleteModal);
    deleteInput.addEventListener('input', () => {
      setDeleteError('');
      deleteConfirmBtn.disabled = deleteInput.value.trim().toUpperCase() !== state.groupId;
    });
    deleteInput.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' && !deleteConfirmBtn.disabled) deleteBoard();
    });
    deleteConfirmBtn.addEventListener('click', deleteBoard);
  }

  // ---------- "Stay on landing page" flag ----------
  // Clear the flag when we're on the board page,
  // and set it again when the user clicks any link back to the landing page
  try { sessionStorage.removeItem('calend-stay-home'); } catch(e) {}
  document.querySelectorAll('a[href^="index.html"]').forEach(a => {
    a.addEventListener('click', () => {
      try { sessionStorage.setItem('calend-stay-home', '1'); } catch(e) {}
    });
  });

  // ---------- Terms / Privacy gate ----------
  const TERMS_KEY = 'calend-terms-accepted';
  const TERMS_VERSION = '2026-10';   // bump this when you change the policies → everyone sees the gate again

  function termsAccepted(){
    try{ return localStorage.getItem(TERMS_KEY) === TERMS_VERSION; }catch(e){ return false; }
  }

  function openTermsGate(){
    return new Promise((resolve) => {
      const modal = $("termsModal"), doc = $("termsDoc");
      const boxA = $("agreePrivacy"), boxB = $("agreeTerms"), btn = $("termsAcceptBtn");
      const pages = { privacy: 'Privacy.html', terms: 'Termofservice.html' };
      const cache = {};
      let current = 'privacy';

      async function showDoc(key){
        current = key;
        modal.querySelectorAll('.gate-tab').forEach(t => {
          const on = t.dataset.doc === key;
          t.classList.toggle('active', on);
          t.setAttribute('aria-selected', String(on));
        });
        if(cache[key]){ doc.innerHTML = cache[key]; doc.scrollTop = 0; return; }
        doc.textContent = 'Loading…';
        try{
          const res = await fetch(pages[key]);
          const html = await res.text();
          const main = new DOMParser().parseFromString(html, 'text/html').querySelector('main');
          cache[key] = main ? main.innerHTML : '';
          if(current !== key) return;   // user switched tabs while loading
          doc.innerHTML = cache[key] || `<a href="${pages[key]}" target="_blank" rel="noopener">Open the document</a>`;
          doc.scrollTop = 0;
        }catch(e){
          if(current === key) doc.innerHTML = `Couldn't load it here. <a href="${pages[key]}" target="_blank" rel="noopener">Open it in a new tab</a>.`;
        }
      }

      modal.querySelectorAll('.gate-tab').forEach(t => t.addEventListener('click', () => showDoc(t.dataset.doc)));
      const sync = () => { btn.disabled = !(boxA.checked && boxB.checked); };
      boxA.addEventListener('change', sync);
      boxB.addEventListener('change', sync);

      btn.addEventListener('click', () => {
        if(btn.disabled) return;
        try{ localStorage.setItem(TERMS_KEY, TERMS_VERSION); }catch(e){}
        modal.classList.remove('show');
        modal.dataset.forced = '0';
        overlay.classList.remove('show');
        $("app").classList.remove('app-locked');
        document.body.style.overflow = '';
        resolve();
      });

      modal.dataset.forced = '1';
      modal.classList.add('show');
      overlay.classList.add('show');
      $("app").classList.add('app-locked');
      document.body.style.overflow = 'hidden';
      showDoc('privacy');
    });
  }

  (async function init(){
    initTheme();
    showConnBanner();
    populateSelects();
    syncSelects();
    if(!termsAccepted()) await openTermsGate();
    if(firebaseReady){
      await ensureSignedIn();   // must happen before any database read or write
      await resolveGroup();
      await loadBoardMeta();
    }else{
      $("boardCodeWrap").style.display = 'none';
    }
    await loadProfile();
    await renderMonth();
    // entrance animation plays once on load, never again on re-renders
    setTimeout(() => document.body.classList.add('anim-done'), 1200);
  })();
})();