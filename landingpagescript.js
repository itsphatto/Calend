(function(){
  const RECENT_GROUPS_KEY = 'noticeboard_recent_groups';

  function loadRecentGroups(){
    try{
      const raw = localStorage.getItem(RECENT_GROUPS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    }catch(e){ return []; }
  }

  function clearRecentGroups(){
    try{ localStorage.removeItem(RECENT_GROUPS_KEY); }catch(e){}
  }

  function relativeTime(ts){
    const diffMs = Date.now() - ts;
    const mins = Math.round(diffMs / 60000);
    if(mins < 1) return 'just now';
    if(mins < 60) return `${mins} min${mins===1?'':'s'} ago`;
    const hours = Math.round(mins / 60);
    if(hours < 24) return `${hours} hour${hours===1?'':'s'} ago`;
    const days = Math.round(hours / 24);
    if(days < 30) return `${days} day${days===1?'':'s'} ago`;
    const months = Math.round(days / 30);
    return `${months} month${months===1?'':'s'} ago`;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  function renderRecentBoards(){
    const section = document.getElementById('recentSection');
    const list = document.getElementById('recentList');
    const boards = loadRecentGroups();

    if(!boards.length){
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    section.classList.add('reveal-in');
    list.innerHTML = boards.map(b => `
      <a class="recent-card" href="calendar.html?group=${encodeURIComponent(b.code)}">
        <span class="recent-card-info">
          <span class="recent-card-code">${escapeHtml(b.code)}</span>
          <span class="recent-card-time">${escapeHtml(relativeTime(b.lastVisited))}</span>
        </span>
        <span class="recent-card-arrow">→</span>
      </a>
    `).join('');
  }

  document.getElementById('clearRecentBtn').addEventListener('click', () => {
    clearRecentGroups();
    renderRecentBoards();
  });

  
  const themeToggleBtn = document.getElementById('themeToggle');
  const themeIconEl = document.getElementById('themeIcon');

  function applyTheme(theme){
    document.documentElement.setAttribute('data-theme', theme);
    themeIconEl.textContent = theme === 'dark' ? '☾' : '☀';
  }

  function initTheme(){
    let saved = null;
    try{ saved = localStorage.getItem('noticeboard_theme'); }catch(e){}
    const theme = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(theme);
  }

  themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try{ localStorage.setItem('noticeboard_theme', next); }catch(e){}
  });

 
  function initScrollReveal(){
    const targets = document.querySelectorAll('.feature-card, .step, .closing');
    if(!('IntersectionObserver' in window)){
      targets.forEach(el => el.classList.add('in-view'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    targets.forEach(el => observer.observe(el));
  }

  initTheme();
  renderRecentBoards();
  initScrollReveal();
})();