// ═══════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════
const MONGO_URI = "mongodb+srv://yegnessh18_db_user:xx7xNDmIpWOwuxrV@cluster0.p6seise.mongodb.net/?appName=Cluster0"; // filled in later
const MONGO_API_KEY = "YOUR_API_KEY";           // filled in later
const DB = "habit_tracker";

const HUNTER_RANKS = [
  { rank: "E", title: "E Rank Hunter",  min: 0    },
  { rank: "D", title: "D Rank Hunter",  min: 100  },
  { rank: "C", title: "C Rank Hunter",  min: 300  },
  { rank: "B", title: "B Rank Hunter",  min: 600  },
  { rank: "A", title: "A Rank Hunter",  min: 1000 },
  { rank: "S", title: "S Rank Hunter",  min: 1500 },
  { rank: "✦", title: "Shadow Monarch", min: 2000 },
];

const DIFFICULTY_XP = { E:10, D:25, C:50, B:100, A:200, S:500 };
const STATS = ["Strength","Intelligence","Endurance","Discipline","Perception"];
const STAT_ICONS = {
  Strength:"💪", Intelligence:"🧠",
  Endurance:"🧘", Discipline:"⚔️", Perception:"👁️"
};
const LOGIN_BONUS = 5;

const TEMPLATES = [
  { name:"Morning Run",      frequency:"daily",   difficulty:"E", stat:"Strength"     },
  { name:"Workout Session",  frequency:"daily",   difficulty:"C", stat:"Strength"     },
  { name:"Study 1 Hour",     frequency:"daily",   difficulty:"D", stat:"Intelligence" },
  { name:"Read 20 Pages",    frequency:"daily",   difficulty:"E", stat:"Intelligence" },
  { name:"Coding Practice",  frequency:"daily",   difficulty:"C", stat:"Intelligence" },
  { name:"Meditate 10 min",  frequency:"daily",   difficulty:"E", stat:"Endurance"    },
  { name:"Sleep by 11pm",    frequency:"daily",   difficulty:"D", stat:"Endurance"    },
  { name:"Drink 2L Water",   frequency:"daily",   difficulty:"E", stat:"Endurance"    },
  { name:"No Phone Morning", frequency:"daily",   difficulty:"D", stat:"Discipline"   },
  { name:"Weekly Review",    frequency:"weekly",  difficulty:"B", stat:"Discipline"   },
  { name:"Monthly Goal Set", frequency:"monthly", difficulty:"A", stat:"Perception"   },
  { name:"Daily Reflection", frequency:"daily",   difficulty:"E", stat:"Perception"   },
];

// ═══════════════════════════════════════════════════
// LOCAL DATABASE (IndexedDB)
// ═══════════════════════════════════════════════════
let idb;

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open("TheSystemDB", 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("quests"))
        db.createObjectStore("quests", { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains("completions"))
        db.createObjectStore("completions", { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains("logs"))
        db.createObjectStore("logs", { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains("user"))
        db.createObjectStore("user", { keyPath: "id" });
    };
    req.onsuccess = e => { idb = e.target.result; res(idb); };
    req.onerror   = () => rej(req.error);
  });
}

function dbGet(store, id) {
  return new Promise((res, rej) => {
    const tx  = idb.transaction(store, "readonly");
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

function dbGetAll(store) {
  return new Promise((res, rej) => {
    const tx  = idb.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

function dbPut(store, data) {
  return new Promise((res, rej) => {
    const tx  = idb.transaction(store, "readwrite");
    const req = tx.objectStore(store).put(data);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

function dbDelete(store, id) {
  return new Promise((res, rej) => {
    const tx  = idb.transaction(store, "readwrite");
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

// ═══════════════════════════════════════════════════
// USER
// ═══════════════════════════════════════════════════
async function getUser() {
  let user = await dbGet("user", 1);
  if (!user) {
    user = { id:1, username:"Yegnessh", total_xp:0, level:1, last_login:"" };
    await dbPut("user", user);
  }
  return user;
}

function getRank(xp) {
  let rank = HUNTER_RANKS[0];
  for (const r of HUNTER_RANKS) { if (xp >= r.min) rank = r; }
  return rank;
}

function xpToNext(xp) {
  for (const r of HUNTER_RANKS) {
    if (xp < r.min) return { needed: r.min - xp, title: r.title };
  }
  return { needed: 0, title: "Maximum Rank Achieved" };
}

async function awardXP(questId, difficulty) {
  const xp   = DIFFICULTY_XP[difficulty];
  const user = await getUser();
  user.total_xp += xp;
  user.level     = HUNTER_RANKS.filter(r => user.total_xp >= r.min).length;
  await dbPut("user", user);

  await dbPut("completions", {
    quest_id    : questId,
    xp_earned   : xp,
    completed_at: new Date().toISOString()
  });

  return { xp, user };
}

// ═══════════════════════════════════════════════════
// LOGIN BONUS
// ═══════════════════════════════════════════════════
async function checkLoginBonus() {
  const user  = await getUser();
  const today = new Date().toDateString();
  if (user.last_login !== today) {
    user.total_xp  += LOGIN_BONUS;
    user.last_login = today;
    await dbPut("user", user);
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════
// TEMPORAL FILTER
// ═══════════════════════════════════════════════════
function isTodaysQuest(quest) {
  const now = new Date();
  if (quest.frequency === "daily")   return true;
  if (quest.frequency === "weekly")  return now.getDay() === 1;
  if (quest.frequency === "monthly") return now.getDate() === 1;
  if (quest.frequency === "yearly")
    return now.getDate() === 1 && now.getMonth() === 0;
  return false;
}

// ═══════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

// ═══════════════════════════════════════════════════
// POPUP
// ═══════════════════════════════════════════════════
function showPopup(html) {
  document.getElementById("popup-content").innerHTML = html;
  document.getElementById("popup-overlay").classList.add("show");
}

function closePopup() {
  document.getElementById("popup-overlay").classList.remove("show");
}

// ═══════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════
function navigate(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");
  document.querySelector(`[data-page="${pageId}"]`).classList.add("active");

  if (pageId === "page-quests")  renderQuests();
  if (pageId === "page-status")  renderStatus();
  if (pageId === "page-log")     renderLogs();
  if (pageId === "page-add")     renderAdd();
}

// ═══════════════════════════════════════════════════
// PAGE 1 — DAILY QUESTS
// ═══════════════════════════════════════════════════
async function renderQuests() {
  const container = document.getElementById("quests-list");
  const now       = new Date();
  const days      = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  document.getElementById("quests-date").textContent =
    `${days[now.getDay()].toUpperCase()}, ${now.toLocaleDateString("en-GB",
    {day:"2-digit", month:"long", year:"numeric"}).toUpperCase()}`;

  const allQuests   = await dbGetAll("quests");
  const completions = await dbGetAll("completions");
  const todayStr    = now.toDateString();

  const completedToday = new Set(
    completions
      .filter(c => new Date(c.completed_at).toDateString() === todayStr)
      .map(c => c.quest_id)
  );

  const todays = allQuests.filter(isTodaysQuest);

  if (todays.length === 0) {
    container.innerHTML = `
      <div class="system-box">
        🎯 No quests scheduled for today, Hunter.<br>
        <span class="tag-blue">Add quests from the Add Quest tab.</span>
      </div>`;
    return;
  }

  container.innerHTML = todays.map(q => {
    const done = completedToday.has(q.id);
    return `
    <div class="system-box" style="${done ? 'opacity:0.5' : ''}">
      <div style="font-size:16px;font-weight:700;color:#7eb8ff;letter-spacing:1px">
        ${q.name.toUpperCase()}
      </div>
      <div style="margin:6px 0;font-size:13px">
        <span class="tag-blue">[${q.difficulty} RANK]</span>
        &nbsp;·&nbsp;
        <span class="tag-dim">${STAT_ICONS[q.stat]} ${q.stat}</span>
        &nbsp;·&nbsp;
        <span class="tag-blue">+${DIFFICULTY_XP[q.difficulty]} XP</span>
        &nbsp;·&nbsp;
        <span class="tag-dim">${q.frequency.toUpperCase()}</span>
      </div>
      ${done
        ? `<button class="btn success small" disabled>✅ COMPLETED</button>`
        : `<button class="btn small" onclick="completeQuest(${q.id},'${q.difficulty}','${q.name}','${q.stat}')">
             ⚡ COMPLETE MISSION
           </button>`
      }
    </div>`;
  }).join("");
}

async function completeQuest(id, difficulty, name, stat) {
  const { xp, user } = await awardXP(id, difficulty);
  const rank = getRank(user.total_xp);

  showPopup(`
    <div style="color:#3a6fff;font-size:22px;letter-spacing:2px">⚡ QUEST COMPLETE ⚡</div>
    <hr class="divider">
    <div style="font-size:16px;color:#7eb8ff;margin:8px 0">${name.toUpperCase()}</div>
    <div style="font-size:28px;font-weight:700;color:#3a6fff">+${xp} XP</div>
    <div style="color:#5a7aaf;margin:8px 0">${STAT_ICONS[stat]} ${stat} increased</div>
    <div style="color:#7eb8ff">Rank: ${rank.title}</div>
    <div style="color:#5a7aaf">Total XP: ${user.total_xp}</div>
    <button class="btn" style="margin-top:16px" onclick="closePopup();renderQuests()">
      CONTINUE
    </button>
  `);
}

// ═══════════════════════════════════════════════════
// PAGE 2 — STATUS WINDOW
// ═══════════════════════════════════════════════════
async function renderStatus() {
  const user        = await getUser();
  const rank        = getRank(user.total_xp);
  const next        = xpToNext(user.total_xp);
  const completions = await dbGetAll("completions");
  const todayStr    = new Date().toDateString();

  const todayCount  = completions.filter(
    c => new Date(c.completed_at).toDateString() === todayStr
  ).length;

  const rankIdx     = HUNTER_RANKS.indexOf(rank);
  const prevMin     = rank.min;
  const nextMin     = rankIdx < HUNTER_RANKS.length - 1
    ? HUNTER_RANKS[rankIdx + 1].min : rank.min + 500;
  const progress    = Math.min(
    ((user.total_xp - prevMin) / (nextMin - prevMin)) * 100, 100
  );

  document.getElementById("status-content").innerHTML = `
    <div class="system-box">
      <div class="tag-dim" style="font-size:12px">HUNTER NAME</div>
      <div style="font-size:22px;font-weight:700;color:#7eb8ff;letter-spacing:2px">
        ${user.username.toUpperCase()}
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="tag-dim" style="font-size:11px">RANK</div>
        <div style="font-size:24px;font-weight:700;color:#3a6fff">${rank.rank}</div>
        <div style="font-size:11px;color:#7eb8ff">${rank.title}</div>
      </div>
      <div class="stat-card">
        <div class="tag-dim" style="font-size:11px">TOTAL XP</div>
        <div style="font-size:24px;font-weight:700;color:#3a6fff">${user.total_xp}</div>
      </div>
      <div class="stat-card">
        <div class="tag-dim" style="font-size:11px">NEXT RANK</div>
        <div style="font-size:24px;font-weight:700;color:#3a6fff">${next.needed}</div>
        <div style="font-size:11px;color:#7eb8ff">XP needed</div>
      </div>
    </div>

    <div style="margin:14px 0">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#5a7aaf;margin-bottom:4px">
        <span>${rank.title}</span><span>${next.title}</span>
      </div>
      <div class="xp-bar-wrap">
        <div class="xp-bar" style="width:${progress}%"></div>
      </div>
      <div style="font-size:12px;color:#5a7aaf;text-align:center">
        ${user.total_xp} XP · ${next.needed} to next rank
      </div>
    </div>

    <hr class="divider">
    <h2>📈 MISSION STATS</h2>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="tag-dim" style="font-size:11px">TOTAL MISSIONS</div>
        <div style="font-size:28px;font-weight:700;color:#3a6fff">${completions.length}</div>
      </div>
      <div class="stat-card">
        <div class="tag-dim" style="font-size:11px">TODAY</div>
        <div style="font-size:28px;font-weight:700;color:#3a6fff">${todayCount}</div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════
// PAGE 3 — MISSION LOG
// ═══════════════════════════════════════════════════
async function renderLogs() {
  const logs = await dbGetAll("logs");
  logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const container = document.getElementById("logs-list");

  if (logs.length === 0) {
    container.innerHTML = `<div class="system-box tag-dim">No log entries yet, Hunter.</div>`;
    return;
  }

  container.innerHTML = logs.map(log => `
    <div class="expander">
      <div class="expander-header" onclick="toggleExpander(this)">
        <span>📝 ${new Date(log.created_at).toLocaleDateString("en-GB",
          {day:"2-digit", month:"short", year:"numeric"})
          } · ${new Date(log.created_at).toLocaleTimeString("en-GB",
          {hour:"2-digit", minute:"2-digit"})}</span>
        <span>▼</span>
      </div>
      <div class="expander-body">
        <textarea id="log-text-${log.id}">${log.entry}</textarea>
        <div class="two-col" style="margin-top:8px">
          <button class="btn success" onclick="saveLog(${log.id})">💾 SAVE</button>
          <button class="btn danger"  onclick="deleteLog(${log.id})">🗑️ DELETE</button>
        </div>
      </div>
    </div>
  `).join("");
}

async function addLog() {
  const entry = document.getElementById("log-entry").value.trim();
  if (!entry) { showToast("Write something first, Hunter."); return; }

  await dbPut("logs", {
    entry,
    created_at: new Date().toISOString(),
    synced: false
  });

  document.getElementById("log-entry").value = "";
  showToast("⚡ Log entry saved.");
  renderLogs();
}

async function saveLog(id) {
  const log   = await dbGet("logs", id);
  log.entry   = document.getElementById(`log-text-${id}`).value;
  log.synced  = false;
  await dbPut("logs", log);
  showToast("✅ Log updated.");
}

async function deleteLog(id) {
  await dbDelete("logs", id);
  showToast("🗑️ Entry deleted.");
  renderLogs();
}

// ═══════════════════════════════════════════════════
// PAGE 4 — ADD QUEST
// ═══════════════════════════════════════════════════
async function renderAdd() {
  // Render templates
  const container  = document.getElementById("templates-list");
  const allQuests  = await dbGetAll("quests");
  const addedNames = new Set(allQuests.map(q => q.name));

  container.innerHTML = TEMPLATES.map(t => `
    <div class="system-box" style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-weight:700;color:#7eb8ff">${t.name.toUpperCase()}</div>
        <div style="font-size:12px">
          <span class="tag-blue">[${t.difficulty}]</span>
          <span class="tag-dim"> ${STAT_ICONS[t.stat]} ${t.stat}</span>
          <span class="tag-blue"> +${DIFFICULTY_XP[t.difficulty]} XP</span>
          <span class="tag-dim"> · ${t.frequency.toUpperCase()}</span>
        </div>
      </div>
      ${addedNames.has(t.name)
        ? `<button class="btn small success" disabled>✅</button>`
        : `<button class="btn small" onclick='addTemplate(${JSON.stringify(t)})'>ADD</button>`
      }
    </div>
  `).join("");

  // Render manage list
  renderManage(allQuests);
}

async function addTemplate(t) {
  await dbPut("quests", { ...t, streak:0, synced:false, created_at: new Date().toISOString() });
  showToast(`✅ ${t.name} added!`);
  renderAdd();
}

async function addCustomQuest() {
  const name       = document.getElementById("c-name").value.trim();
  const frequency  = document.getElementById("c-freq").value;
  const difficulty = document.getElementById("c-diff").value;
  const stat       = document.getElementById("c-stat").value;

  if (!name) { showToast("Enter a quest name, Hunter."); return; }

  const allQuests = await dbGetAll("quests");
  if (allQuests.find(q => q.name === name)) {
    showToast("Quest already exists."); return;
  }

  await dbPut("quests", {
    name, frequency, difficulty, stat,
    streak: 0, synced: false,
    created_at: new Date().toISOString()
  });

  document.getElementById("c-name").value = "";
  showToast(`✅ Quest '${name}' created!`);
  renderAdd();
}

function renderManage(quests) {
  const container = document.getElementById("manage-list");
  if (quests.length === 0) {
    container.innerHTML = `<div class="system-box tag-dim">No quests yet.</div>`;
    return;
  }

  container.innerHTML = quests.map(q => `
    <div class="expander">
      <div class="expander-header" onclick="toggleExpander(this)">
        <span>⚔️ ${q.name.toUpperCase()}</span><span>▼</span>
      </div>
      <div class="expander-body">
        <label>QUEST NAME</label>
        <input id="q-name-${q.id}" value="${q.name}">

        <label>FREQUENCY</label>
        <select id="q-freq-${q.id}">
          ${["daily","weekly","monthly","yearly"].map(f =>
            `<option ${q.frequency===f?"selected":""}>${f}</option>`
          ).join("")}
        </select>

        <label>DIFFICULTY</label>
        <select id="q-diff-${q.id}">
          ${["E","D","C","B","A","S"].map(d =>
            `<option ${q.difficulty===d?"selected":""}>${d}</option>`
          ).join("")}
        </select>

        <label>STAT</label>
        <select id="q-stat-${q.id}">
          ${STATS.map(s =>
            `<option ${q.stat===s?"selected":""}>${s}</option>`
          ).join("")}
        </select>

        <div class="two-col" style="margin-top:10px">
          <button class="btn success" onclick="saveQuest(${q.id})">💾 SAVE</button>
          <button class="btn danger"  onclick="deleteQuest(${q.id})">🗑️ DELETE</button>
        </div>
      </div>
    </div>
  `).join("");
}

async function saveQuest(id) {
  const quest      = await dbGet("quests", id);
  quest.name       = document.getElementById(`q-name-${id}`).value;
  quest.frequency  = document.getElementById(`q-freq-${id}`).value;
  quest.difficulty = document.getElementById(`q-diff-${id}`).value;
  quest.stat       = document.getElementById(`q-stat-${id}`).value;
  quest.synced     = false;
  await dbPut("quests", quest);
  showToast("✅ Quest updated!");
  renderAdd();
}

async function deleteQuest(id) {
  await dbDelete("quests", id);
  showToast("🗑️ Quest deleted.");
  renderAdd();
}

// ═══════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════
function switchTab(tabId, btn) {
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  btn.classList.add("active");
}

function toggleExpander(header) {
  const body = header.nextElementSibling;
  body.classList.toggle("open");
}

// ═══════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════
async function init() {
  await openDB();

  // Register service worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  // Login bonus
  const bonus = await checkLoginBonus();
  if (bonus) {
    setTimeout(() => showToast(`⚡ Daily login bonus: +${LOGIN_BONUS} XP`), 800);
  }

  // Update XP display in top bar
  const user = await getUser();
  const rank = getRank(user.total_xp);
  document.getElementById("topbar-rank").textContent =
    `${rank.rank} · ${user.total_xp} XP`;

  // Load first page
  navigate("page-quests");
}

init();