const root = document.documentElement;
const themeStorageKey = "calend-theme";
const lightModeButton = document.getElementById("buttonlightmode");
const darkModeButton = document.getElementById("buttondarkmode");


(function () {
  const bar = document.querySelector(".bar");
  if (!bar) return;
  const ENTER = 24, EXIT = 8;   
  let on = false;
  function check() {
    const y = window.scrollY;
    if (!on && y > ENTER) { on = true; bar.classList.add("scrolled"); }
    else if (on && y < EXIT) { on = false; bar.classList.remove("scrolled"); }
  }
  window.addEventListener("scroll", check, { passive: true });
  check();
})();


function applyTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  root.setAttribute("data-theme", nextTheme);
  lightModeButton.setAttribute("aria-pressed", String(nextTheme === "light"));
  darkModeButton.setAttribute("aria-pressed", String(nextTheme === "dark"));

  const fullImg = document.querySelector(".reveal .full");
  const cropImg = document.querySelector(".reveal .crop");
  if (fullImg && cropImg) {
    fullImg.src = `/assets/expandedexample1${nextTheme}.png`;
    cropImg.src = `/assets/example1${nextTheme}.png`;
  }
}

function setTheme(theme) {
  applyTheme(theme);
  try { localStorage.setItem(themeStorageKey, theme); } catch (e) {}
}

try {
  const savedTheme = localStorage.getItem(themeStorageKey);
  applyTheme(savedTheme);
} catch (e) {
  applyTheme("dark");
}

lightModeButton.addEventListener("click", () => setTheme("light"));
darkModeButton.addEventListener("click", () => setTheme("dark"));
window.addEventListener("storage", (event) => {
  if (event.key === themeStorageKey) applyTheme(event.newValue);
});

const showcase = document.getElementById("showcase");
const full  = showcase.querySelector(".full");
const crop  = showcase.querySelector(".crop");
const stage = showcase.querySelector(".sticky");
const hero  = showcase.querySelector(".hero");

// move low → slower page move when expanding
const MOVE = 0.4;

// Fit the full image on screen and work out how big the crop is inside it
// (assumes example1 is the centered, same-scale crop of expandedexample1)
function layout() {
  if (!full.naturalWidth || !crop.naturalWidth) return;
  const ratio = full.naturalHeight / full.naturalWidth;
  const W = Math.min(stage.clientWidth, 1600);
  showcase.style.setProperty("--W", W + "px");
  showcase.style.setProperty("--H", W * ratio + "px");
  showcase.style.setProperty("--fx", Math.min(1, crop.naturalWidth / full.naturalWidth));
  const fy = Math.min(1, crop.naturalHeight / full.naturalHeight);
  showcase.style.setProperty("--fy", fy);
  // how much of the expanded image hangs below the screen while pinned
  const pinned = showcase.offsetHeight - stage.clientHeight;
  const over = hero.offsetHeight + 24 + W * ratio - stage.clientHeight - pinned * MOVE;
  showcase.style.setProperty("--over", over + "px");
}
full.addEventListener("load", layout);
crop.addEventListener("load", layout);

function update() {
  // progress = how far we've scrolled through the pinned part (starts at the very top of the page)
  const pinned = showcase.offsetHeight - stage.clientHeight;
  const p = Math.min(1, Math.max(0, window.scrollY / pinned));
  showcase.style.setProperty("--p", p.toFixed(3));
  // let the page drift up slowly while it expands
  stage.style.transform = `translateY(${(-p * pinned * MOVE).toFixed(1)}px)`;
}

window.addEventListener("scroll", update, { passive: true });
window.addEventListener("resize", () => { layout(); update(); });
layout();
update();

// Recent Boards Logic
function loadRecentBoards() {
  try {
    const raw = localStorage.getItem('noticeboard_recent_groups');
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function removeRecentBoard(code) {
  try {
    const list = loadRecentBoards().filter(g => g.code !== code);
    localStorage.setItem('noticeboard_recent_groups', JSON.stringify(list));
    if (localStorage.getItem('noticeboard_last_group') === code) {
      localStorage.removeItem('noticeboard_last_group');
    }
  } catch (e) {}
}

const recentBoardsContainer = document.getElementById("recentBoardsContainer");
const recentBoardsBtn = document.getElementById("recentBoardsBtn");
const recentBoardsDropdown = document.getElementById("recentBoardsDropdown");
const recentBoardsList = document.getElementById("recentBoardsList");

const recentBoards = loadRecentBoards();

if (recentBoards && recentBoards.length > 0) {
  recentBoardsContainer.style.display = "inline-block";
  
  recentBoards.forEach(board => {
    const li = document.createElement("li");
    
    const delBtn = document.createElement("button");
    delBtn.className = "recentDeleteBtn";
    delBtn.type = "button";
    delBtn.title = "Remove from recent boards";
    delBtn.setAttribute("aria-label", `Remove ${board.code}`);
    delBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
    
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeRecentBoard(board.code);
      li.remove();
      if (recentBoardsList.children.length === 0) {
        recentBoardsDropdown.classList.remove("show");
        recentBoardsContainer.style.display = "none";
      }
    });

    const a = document.createElement("a");
    a.href = `calendar.html?group=${board.code}`;
    a.textContent = board.code;
    
    li.appendChild(delBtn);
    li.appendChild(a);
    recentBoardsList.appendChild(li);
  });
  
  recentBoardsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    recentBoardsDropdown.classList.toggle("show");
  });
  
  document.addEventListener("click", (e) => {
    if (!recentBoardsContainer.contains(e.target)) {
      recentBoardsDropdown.classList.remove("show");
    }
  });
}

// Image Modal Popup Logic
const revealContainer = document.getElementById("revealContainer");
const imageModal = document.getElementById("imageModal");
const imageModalImg = document.getElementById("imageModalImg");
const imageModalClose = document.getElementById("imageModalClose");

function openImageModal() {
  const currentTheme = root.getAttribute("data-theme") || "dark";
  imageModalImg.src = `/assets/expandedexample1${currentTheme}.png`;
  imageModal.classList.add("show");
  document.body.style.overflow = "hidden";
}

function closeImageModal() {
  imageModal.classList.remove("show");
  document.body.style.overflow = "";
}

if (revealContainer) {
  revealContainer.addEventListener("click", () => {
    if (window.innerWidth <= 700) {
      openImageModal();
    }
  });
}

if (imageModalClose) {
  imageModalClose.addEventListener("click", closeImageModal);
}

if (imageModal) {
  imageModal.addEventListener("click", (e) => {
    if (e.target === imageModal) {
      closeImageModal();
    }
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && imageModal && imageModal.classList.contains("show")) {
    closeImageModal();
  }
});


const sharedWord = document.querySelector(".sharedWord");
const calendarWord = document.querySelector(".calendarWord");

const HOLD = 4000;   // how long "The Shared Calendar" stays before the animation starts
const CYCLE = 9500;  // total loop length

function animateTitle() {
    // Reset
    sharedWord.classList.remove("strike");
    calendarWord.classList.remove("blue");
    calendarWord.textContent = "Calendar";

    // Cross out Shared, dim it, and make it italic
    setTimeout(() => {
        sharedWord.classList.add("strike");
    }, HOLD);

    // Calendar → Calenda
    setTimeout(() => {
        calendarWord.textContent = "Calenda";
    }, HOLD + 800);

    // Calenda → Calend
    setTimeout(() => {
        calendarWord.textContent = "Calend";
    }, HOLD + 1300);

    // Turn Calend blue
    setTimeout(() => {
        calendarWord.classList.add("blue");
    }, HOLD + 1700);
}

animateTitle();
setInterval(animateTitle, CYCLE);