"use strict";

/* ============================================================
   ثوابت الدورة
============================================================ */
const COURSE_START = "2026-09-13"; // الأحد
const COURSE_WEEKS = 5;
const MUSHRIFA_CODE = "2026";
const EMAIL_SUFFIX = "@hifth-course.local";

const TASKS = [
  { key: "selfRecite", emoji: "🥭", label: "السرد الذاتي" },
  { key: "friendRecite", emoji: "🥝", label: "السرد على الرفيقة" },
  { key: "repeat3", emoji: "🍉", label: "التكرار ٣ مرات" },
  { key: "prayerWerd", emoji: "🍍", label: "ورد الصلاة" },
  { key: "cumulativeRecite", emoji: "🥥", label: "السرد التراكمي" },
];
const POINTS_PER_TASK = 5;
const MAX_PAGE = 604;

const AR_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

/* ============================================================
   أدوات التاريخ
============================================================ */
function parseISODate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function isoDate(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayStr() { return isoDate(new Date()); }
function formatDateHuman(dateStr) {
  const d = parseISODate(dateStr);
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]}`;
}
function weekdayName(dateStr) { return AR_DAYS[parseISODate(dateStr).getDay()]; }

function courseDateList() {
  const start = parseISODate(COURSE_START);
  const list = [];
  for (let i = 0; i < COURSE_WEEKS * 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    list.push(isoDate(d));
  }
  return list;
}
const COURSE_DATES = courseDateList();
const COURSE_END = COURSE_DATES[COURSE_DATES.length - 1];

function dayType(dateStr) {
  const dow = parseISODate(dateStr).getDay(); // 0 أحد .. 6 سبت
  if (dow >= 0 && dow <= 3) return "tasks";
  if (dow === 4) return "review";
  if (dow === 5) return "rest";
  return "test";
}
function weekIndexOf(dateStr) {
  const diffDays = Math.round((parseISODate(dateStr) - parseISODate(COURSE_START)) / 86400000);
  return Math.floor(diffDays / 7) + 1;
}
function taskDayDates() { return COURSE_DATES.filter((d) => dayType(d) === "tasks"); }
function clampToCourse(dateStr) {
  if (dateStr < COURSE_START) return COURSE_START;
  if (dateStr > COURSE_END) return COURSE_END;
  return dateStr;
}

/* ============================================================
   أدوات مشتركة للانقسام المتساوي
============================================================ */
function splitCounts(total, parts) {
  const base = Math.floor(total / parts);
  const rem = total % parts;
  const counts = [];
  for (let i = 0; i < parts; i++) counts.push(base + (i < rem ? 1 : 0));
  return counts;
}
function formatAyatRange(fromGlobal, toGlobal) {
  const a = fromGlobalAyah(fromGlobal);
  const b = fromGlobalAyah(toGlobal);
  if (a.surahIndex === b.surahIndex) {
    return a.ayah === b.ayah
      ? `${SURAHS[a.surahIndex].name} : ${a.ayah}`
      : `${SURAHS[a.surahIndex].name} : ${a.ayah}-${b.ayah}`;
  }
  return `${SURAHS[a.surahIndex].name}:${a.ayah} ← ${SURAHS[b.surahIndex].name}:${b.ayah}`;
}
function formatPageRange(fromPage, toPage) {
  return fromPage === toPage ? `صفحة ${fromPage}` : `من صفحة ${fromPage} إلى ${toPage}`;
}

/* ============================================================
   حالة التطبيق العامة
============================================================ */
const state = {
  uid: null,
  username: null,
  role: null, // hafitha | mushrifa | admin
  activeTab: null,
  todayTabDate: null,
  myProgress: null, // {days:{...}}
  myTests: null,
  myPlan: null,
};

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

function usernameToEmail(u) { return u.trim().toLowerCase() + EMAIL_SUFFIX; }

/* ============================================================
   المصادقة (Auth)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  setupAuthScreen();
  auth.onAuthStateChanged(onAuthChanged);
});

function setupAuthScreen() {
  const btnLogin = document.getElementById("btnShowLogin");
  const btnSignup = document.getElementById("btnShowSignup");
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");

  btnLogin.addEventListener("click", () => {
    btnLogin.classList.add("active"); btnSignup.classList.remove("active");
    loginForm.hidden = false; signupForm.hidden = true;
    clearAuthMsg();
  });
  btnSignup.addEventListener("click", () => {
    btnSignup.classList.add("active"); btnLogin.classList.remove("active");
    signupForm.hidden = false; loginForm.hidden = true;
    clearAuthMsg();
  });

  document.querySelectorAll('input[name="signupRole"]').forEach((r) => {
    r.addEventListener("change", () => {
      const checkedVal = document.querySelector('input[name="signupRole"]:checked').value;
      document.getElementById("roleHafithaLabel").classList.toggle("checked", checkedVal === "hafitha");
      document.getElementById("roleMushrifaLabel").classList.toggle("checked", checkedVal === "mushrifa");
      document.getElementById("mushrifaCodeField").hidden = checkedVal !== "mushrifa";
    });
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAuthMsg();
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;
    const btn = document.getElementById("loginSubmitBtn");
    btn.disabled = true; btn.textContent = "...جارِ الدخول";
    try {
      await doLogin(username, password);
    } catch (err) {
      showAuthMsg(loginErrorText(err), "error");
    } finally {
      btn.disabled = false; btn.textContent = "دخول";
    }
  });

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAuthMsg();
    const username = document.getElementById("signupUsername").value.trim();
    const password = document.getElementById("signupPassword").value;
    const role = document.querySelector('input[name="signupRole"]:checked').value;
    const code = document.getElementById("signupCode").value.trim();
    const btn = document.getElementById("signupSubmitBtn");

    if (!/^[a-zA-Z0-9_؀-ۿ]{3,}$/.test(username)) {
      showAuthMsg("اسم المستخدم لازم يكون ٣ أحرف على الأقل (بدون مسافات أو رموز خاصة)", "error");
      return;
    }
    if (username.toLowerCase() === "admin") {
      showAuthMsg("اسم المستخدم هذا محجوز", "error");
      return;
    }
    if (role === "mushrifa" && code !== MUSHRIFA_CODE) {
      showAuthMsg("رمز المشرفة غير صحيح", "error");
      return;
    }

    btn.disabled = true; btn.textContent = "...جارِ التسجيل";
    try {
      await doSignup(username, password, role);
    } catch (err) {
      showAuthMsg(signupErrorText(err), "error");
    } finally {
      btn.disabled = false; btn.textContent = "تسجيل الحساب";
    }
  });
}

function showAuthMsg(text, type) {
  const el = document.getElementById("authMsg");
  el.textContent = text;
  el.className = "msg " + type;
}
function clearAuthMsg() {
  const el = document.getElementById("authMsg");
  el.textContent = ""; el.className = "";
}

// ملاحظة: تُستخدم فقط من لوحة الأدمن (وقتها المستخدمة مسجلة دخولها فعلاً
// فتقدر تقرأ من Firestore حسب القواعد). ما تُستخدم في تسجيل حساب جديد
// عادي لأن المستخدمة الجديدة لسه ما سجلت دخولها، والقواعد ما تسمح بالقراءة
// قبل تسجيل الدخول.
async function usernameExists(username) {
  const snap = await db.collection("profiles").where("username", "==", username).limit(1).get();
  return !snap.empty;
}

async function doSignup(username, password, role) {
  // ما نتحقق من تكرار اسم المستخدم هنا (المستخدمة الجديدة لسه ما سجلت
  // دخولها، فما تقدر تقرأ من Firestore). بدل كذا نعتمد على أن كل اسم
  // مستخدم يتحول لبريد إلكتروني فريد، فلو الاسم مستخدم من قبل، Firebase
  // Auth نفسه يرفض بخطأ "auth/email-already-in-use" ونعرض رسالة واضحة
  // (بالأسفل في signupErrorText).
  const cred = await auth.createUserWithEmailAndPassword(usernameToEmail(username), password);
  await db.collection("profiles").doc(cred.user.uid).set({
    username, role, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function doLogin(username, password) {
  const email = usernameToEmail(username);
  if (username.toLowerCase() === "admin") {
    try {
      await auth.signInWithEmailAndPassword(email, password);
      return;
    } catch (err) {
      if (err.code === "auth/user-not-found" && password === "admin123") {
        const cred = await auth.createUserWithEmailAndPassword(email, "admin123");
        await db.collection("profiles").doc(cred.user.uid).set({
          username: "admin", role: "admin", createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }
      throw err;
    }
  }
  await auth.signInWithEmailAndPassword(email, password);
}

function loginErrorText(err) {
  if (err.code === "auth/user-not-found") return "ما فيه حساب بهذا الاسم";
  if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") return "كلمة المرور غير صحيحة";
  if (err.code === "auth/invalid-email") return "اسم المستخدم غير صالح";
  return "حصل خطأ، حاولي مرة ثانية (" + (err.message || "") + ")";
}
function signupErrorText(err) {
  if (err.code === "auth/email-already-in-use") return "اسم المستخدم موجود مسبقاً";
  if (err.code === "auth/weak-password") return "كلمة المرور ضعيفة، لازم ٦ أحرف على الأقل";
  return "حصل خطأ، حاولي مرة ثانية (" + (err.message || "") + ")";
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logoutBtn").addEventListener("click", () => auth.signOut());
});

async function onAuthChanged(user) {
  const loading = document.getElementById("loadingScreen");
  const authScreen = document.getElementById("authScreen");
  const appShell = document.getElementById("appShell");

  if (!user) {
    state.uid = null; state.role = null; state.username = null;
    loading.hidden = true; appShell.hidden = true; authScreen.hidden = false;
    return;
  }

  loading.hidden = false; authScreen.hidden = true; appShell.hidden = true;

  // نحاول عدة مرات بفارق بسيط: عند إنشاء حساب جديد للتو قد يصل حدث تغيّر
  // حالة الدخول قبل ما تكتمل كتابة ملف التعريف بجزء من الثانية، فما نبي
  // نعتبرها "حساب محذوف" غلط. لو فشلت كل المحاولات فعلاً معناته الحساب
  // محذوف من الإدارة.
  let profSnap = await db.collection("profiles").doc(user.uid).get();
  let attempts = 0;
  while (!profSnap.exists && attempts < 6) {
    await new Promise((r) => setTimeout(r, 350));
    profSnap = await db.collection("profiles").doc(user.uid).get();
    attempts++;
  }
  if (!profSnap.exists) {
    // حساب بدون ملف تعريف (تم حذفه من الإدارة مثلاً)
    await auth.signOut();
    loading.hidden = true; authScreen.hidden = false;
    showAuthMsg("هذا الحساب غير موجود بعد الآن، تواصلي مع الإدارة", "error");
    return;
  }
  const prof = profSnap.data();
  state.uid = user.uid; state.username = prof.username; state.role = prof.role;

  document.getElementById("welcomeLine").textContent =
    prof.role === "hafitha" ? `أهلاً ${prof.username} 🌸` :
    prof.role === "admin" ? `مرحباً أدمن 👑` : `أهلاً مشرفة ${prof.username} 🌿`;

  buildTabbar();
  loading.hidden = true; appShell.hidden = false;
}

/* ============================================================
   شريط التبويبات
============================================================ */
const HAFITHA_TABS = [
  { key: "today", label: "اليوم" },
  { key: "achievements", label: "إنجازاتي" },
  { key: "leaderboard", label: "المتصدرات" },
  { key: "dailyplan", label: "المراجعة اليومية" },
  { key: "calculator", label: "حاسبة المراجعة" },
];
const MUSHRIFA_TABS = [
  { key: "mleaderboard", label: "المتصدرات" },
  { key: "mtests", label: "الاختبارات" },
  { key: "madmin", label: "الإدارة" },
];

function buildTabbar() {
  const tabs = state.role === "hafitha" ? HAFITHA_TABS : MUSHRIFA_TABS;
  const bar = document.getElementById("tabbar");
  bar.innerHTML = "";
  tabs.forEach((t, i) => {
    const b = document.createElement("button");
    b.textContent = t.label;
    b.dataset.key = t.key;
    if (i === 0) b.classList.add("active");
    b.addEventListener("click", () => switchTab(t.key));
    bar.appendChild(b);
  });
  switchTab(tabs[0].key);
}

function switchTab(key) {
  state.activeTab = key;
  document.querySelectorAll("#tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.key === key));
  const map = {
    today: renderTodayTab,
    achievements: renderAchievementsTab,
    leaderboard: renderLeaderboardTab,
    dailyplan: renderDailyPlanTab,
    calculator: renderCalculatorTab,
    mleaderboard: renderMushrifaLeaderboardTab,
    mtests: renderMushrifaTestsTab,
    madmin: renderAdminTab,
  };
  (map[key] || (() => {}))();
}

/* ============================================================
   Firestore helpers
============================================================ */
async function fetchMyProgress() {
  const snap = await db.collection("progress").doc(state.uid).get();
  return snap.exists ? (snap.data().days || {}) : {};
}
async function fetchMyTests() {
  const snap = await db.collection("tests").doc(state.uid).get();
  return snap.exists ? (snap.data().weeks || {}) : {};
}
async function fetchMyPlan() {
  const snap = await db.collection("reviewPlans").doc(state.uid).get();
  return snap.exists ? snap.data() : null;
}
async function fetchAllHafithaProfiles() {
  const snap = await db.collection("profiles").where("role", "==", "hafitha").get();
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}
async function fetchAllProfiles() {
  const snap = await db.collection("profiles").get();
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}
async function fetchAllProgress() {
  const snap = await db.collection("progress").get();
  const map = {};
  snap.docs.forEach((d) => (map[d.id] = d.data().days || {}));
  return map;
}
async function fetchAllTests() {
  const snap = await db.collection("tests").get();
  const map = {};
  snap.docs.forEach((d) => (map[d.id] = d.data().weeks || {}));
  return map;
}

function computeTotalPoints(daysObj) {
  const today = todayStr();
  let total = 0;
  taskDayDates().forEach((d) => {
    if (d > today) return; // لسه ما وصلها
    total += (daysObj[d] && daysObj[d].points) || 0;
  });
  return total;
}

/* ============================================================
   تبويب "اليوم"
============================================================ */
async function renderTodayTab() {
  const el = document.getElementById("tabContent");
  el.innerHTML = `<div class="card"><div class="hint">...جارِ التحميل</div></div>`;
  state.myProgress = await fetchMyProgress();
  updatePointsPill();

  if (!state.todayTabDate) state.todayTabDate = clampToCourse(todayStr());
  renderTodayContent();
}

function updatePointsPill() {
  const pill = document.getElementById("pointsPill");
  if (state.role !== "hafitha" || !state.myProgress) { pill.hidden = true; return; }
  pill.hidden = false;
  document.getElementById("pointsPillValue").textContent = computeTotalPoints(state.myProgress);
}

function renderTodayContent() {
  const el = document.getElementById("tabContent");
  const date = state.todayTabDate;
  const type = dayType(date);
  const maxDate = todayStr() > COURSE_END ? COURSE_END : todayStr();

  let inner = `
    <div class="card">
      <h2>📅 اليوم</h2>
      <div class="date-row">
        <input type="date" id="todayDateInput" value="${date}" min="${COURSE_START}" max="${maxDate < COURSE_START ? COURSE_START : maxDate}" />
      </div>
      <div class="hint">${weekdayName(date)} - ${formatDateHuman(date)} (الأسبوع ${weekIndexOf(date)})
        <span class="daytype-badge daytype-${type}">${dayTypeLabel(type)}</span>
      </div>
    </div>
  `;

  if (type === "tasks") {
    const saved = (state.myProgress[date] && state.myProgress[date].tasks) || TASKS.map(() => false);
    inner += `<div class="card"><h2>مهام اليوم</h2><div id="taskList">`;
    TASKS.forEach((t, i) => {
      inner += `
        <div class="task-item ${saved[i] ? "on" : ""}" data-idx="${i}">
          <div class="task-check">${saved[i] ? "✓" : ""}</div>
          <span class="emoji">${t.emoji}</span>
          <span class="label">${t.label}</span>
          <span class="pts">${POINTS_PER_TASK} نقاط</span>
        </div>`;
    });
    inner += `</div>
      <button class="btn-main" id="saveTasksBtn" style="margin-top:8px">حفظ المهام</button>
    </div>`;
  } else if (type === "review") {
    inner += bigNoteHtml("📖", "يوم مراجعة أسبوعية", "راجعي محفوظاتك من بداية الأسبوع. هذا اليوم بدون مهام أو نقاط.");
  } else if (type === "rest") {
    inner += bigNoteHtml("🌙", "راحة مباركة", "يوم الجمعة يوم راحة، لا يوجد مهام.");
  } else if (type === "test") {
    const wk = weekIndexOf(date);
    const score = state.myTests && state.myTests[wk];
    inner += bigNoteHtml("📝", "يوم الاختبار",
      score !== undefined && score !== null ? `درجتك هذا الأسبوع: <b>${score} / 10</b>` : "لم تُدخل الدرجة بعد");
  }

  el.innerHTML = inner;

  document.getElementById("todayDateInput").addEventListener("change", (e) => {
    state.todayTabDate = clampToCourse(e.target.value);
    if (dayType(state.todayTabDate) === "test") {
      fetchMyTests().then((t) => { state.myTests = t; renderTodayContent(); });
    } else {
      renderTodayContent();
    }
  });

  if (type === "tasks") {
    document.querySelectorAll("#taskList .task-item").forEach((row) => {
      row.addEventListener("click", () => row.classList.toggle("on"));
    });
    document.getElementById("saveTasksBtn").addEventListener("click", saveTodayTasks);
  }
  if (type === "test" && !state.myTests) {
    fetchMyTests().then((t) => { state.myTests = t; renderTodayContent(); });
  }
}

function dayTypeLabel(t) {
  return { tasks: "✅ مهام", review: "📖 مراجعة", rest: "🌙 راحة", test: "📝 اختبار" }[t];
}
function bigNoteHtml(emoji, title, text) {
  return `<div class="card"><div class="big-note"><span class="emoji">${emoji}</span><h3>${title}</h3><p>${text}</p></div></div>`;
}

async function saveTodayTasks() {
  const date = state.todayTabDate;
  const rows = document.querySelectorAll("#taskList .task-item");
  const tasksBool = Array.from(rows).map((r) => r.classList.contains("on"));
  const points = tasksBool.filter(Boolean).length * POINTS_PER_TASK;
  const btn = document.getElementById("saveTasksBtn");
  btn.disabled = true; btn.textContent = "...جارِ الحفظ";
  try {
    await db.collection("progress").doc(state.uid).set(
      { days: { [date]: { tasks: tasksBool, points } } },
      { merge: true }
    );
    state.myProgress[date] = { tasks: tasksBool, points };
    updatePointsPill();
    toast("✅ تم حفظ المهام (" + points + " نقطة)");
  } catch (err) {
    toast("حصل خطأ بالحفظ");
  } finally {
    btn.disabled = false; btn.textContent = "حفظ المهام";
  }
}

/* ============================================================
   تبويب "إنجازاتي"
============================================================ */
async function renderAchievementsTab() {
  const el = document.getElementById("tabContent");
  el.innerHTML = `<div class="card"><div class="hint">...جارِ التحميل</div></div>`;
  const [progress, tests] = await Promise.all([fetchMyProgress(), fetchMyTests()]);
  state.myProgress = progress; state.myTests = tests;
  updatePointsPill();

  const today = todayStr();
  const total = computeTotalPoints(progress);
  const doneDaysCount = taskDayDates().filter((d) => d <= today && progress[d]).length;
  const passedDaysCount = taskDayDates().filter((d) => d <= today).length;

  let weeksHtml = "";
  for (let w = 1; w <= COURSE_WEEKS; w++) {
    const weekDates = taskDayDates().filter((d) => weekIndexOf(d) === w);
    weeksHtml += `<div class="week-block"><div class="week-title">الأسبوع ${w}</div>
      <div class="table-wrap"><table class="simple"><thead><tr>
      ${weekDates.map((d) => `<th>${weekdayName(d)}<br>${formatDateHuman(d)}</th>`).join("")}
      </tr></thead><tbody><tr>
      ${weekDates.map((d) => {
        if (d > today) return `<td style="color:#bbb">—</td>`;
        if (progress[d]) return `<td style="color:var(--green-700)">${progress[d].points} ن</td>`;
        return `<td style="color:var(--danger)">غائبة</td>`;
      }).join("")}
      </tr></tbody></table></div></div>`;
  }

  let testsHtml = `<div class="table-wrap"><table class="simple"><thead><tr>
    ${[1,2,3,4,5].map((w) => `<th>الأسبوع ${w}</th>`).join("")}
    </tr></thead><tbody><tr>
    ${[1,2,3,4,5].map((w) => {
      const s = tests[w];
      return `<td>${s !== undefined && s !== null ? s + "/10" : "—"}</td>`;
    }).join("")}
    </tr></tbody></table></div>`;

  el.innerHTML = `
    <div class="card">
      <h2>🏆 إنجازاتي</h2>
      <div class="stat-grid">
        <div class="stat-box"><div class="num">${total}</div><div class="lbl">مجموع النقاط</div></div>
        <div class="stat-box"><div class="num">${doneDaysCount}/${passedDaysCount || 0}</div><div class="lbl">أيام منجزة</div></div>
      </div>
    </div>
    <div class="card"><h2>السجل الأسبوعي</h2>${weeksHtml}</div>
    <div class="card"><h2>درجات الاختبارات</h2>${testsHtml}</div>
  `;
}

/* ============================================================
   تبويب "المتصدرات" (حافظة - بدون أسماء)
============================================================ */
async function buildLeaderboardData() {
  const [profiles, progressMap] = await Promise.all([fetchAllHafithaProfiles(), fetchAllProgress()]);
  const rows = profiles.map((p) => ({
    uid: p.uid, username: p.username, points: computeTotalPoints(progressMap[p.uid] || {}),
  }));
  rows.sort((a, b) => b.points - a.points);
  return rows;
}
function medalFor(rank) { return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : ""; }

async function renderLeaderboardTab() {
  const el = document.getElementById("tabContent");
  el.innerHTML = `<div class="card"><div class="hint">...جارِ التحميل</div></div>`;
  const rows = await buildLeaderboardData();
  let html = `<div class="card"><h2>🥇 المتصدرات</h2>`;
  if (!rows.length) html += `<div class="hint">ما فيه بيانات بعد</div>`;
  rows.forEach((r, i) => {
    const rank = i + 1;
    const isMe = r.uid === state.uid;
    html += `<div class="leader-row ${isMe ? "me" : ""}">
      <div class="leader-rank">${medalFor(rank) || rank}</div>
      <div class="leader-name">${isMe ? "أنتِ" : "حافظة"}</div>
      <div class="leader-pts">${r.points} ن</div>
    </div>`;
  });
  html += `</div>`;
  el.innerHTML = html;
}

async function renderMushrifaLeaderboardTab() {
  const el = document.getElementById("tabContent");
  el.innerHTML = `<div class="card"><div class="hint">...جارِ التحميل</div></div>`;
  const rows = await buildLeaderboardData();
  let html = `<div class="card"><h2>🥇 المتصدرات</h2>`;
  if (!rows.length) html += `<div class="hint">ما فيه بيانات بعد</div>`;
  rows.forEach((r, i) => {
    const rank = i + 1;
    html += `<div class="leader-row">
      <div class="leader-rank">${medalFor(rank) || rank}</div>
      <div class="leader-name">@${r.username}</div>
      <div class="leader-pts">${r.points} ن</div>
    </div>`;
  });
  html += `</div>`;
  el.innerHTML = html;
}

/* ============================================================
   تبويب "الاختبارات" (مشرفة)
============================================================ */
async function renderMushrifaTestsTab() {
  const el = document.getElementById("tabContent");
  el.innerHTML = `<div class="card"><div class="hint">...جارِ التحميل</div></div>`;
  const [profiles, testsMap] = await Promise.all([fetchAllHafithaProfiles(), fetchAllTests()]);

  let html = `<div class="card"><h2>📝 درجات الاختبارات</h2><div class="hint">تُحفظ الدرجة فوراً عند الكتابة</div></div>`;
  if (!profiles.length) html += `<div class="card"><div class="hint">ما فيه حافظات مسجلات بعد</div></div>`;

  profiles.forEach((p) => {
    const weeks = testsMap[p.uid] || {};
    html += `<div class="card">
      <div class="admin-row" style="background:transparent;padding:0;margin-bottom:10px">
        <div class="who"><b>@${p.username}</b></div>
      </div>
      <div class="grid4">
      ${[1,2,3,4,5].map((w) => `
        <div>
          <div class="hint" style="margin-bottom:4px">أسبوع ${w}</div>
          <input type="number" min="0" max="10" class="score-input" data-uid="${p.uid}" data-week="${w}" value="${weeks[w] ?? ""}" />
        </div>`).join("")}
      </div>
    </div>`;
  });

  el.innerHTML = html;
  document.querySelectorAll(".score-input").forEach((inp) => {
    inp.addEventListener("change", async () => {
      let v = inp.value === "" ? null : Number(inp.value);
      if (v !== null && (isNaN(v) || v < 0 || v > 10)) { toast("الدرجة لازم تكون بين 0 و10"); return; }
      const uid = inp.dataset.uid, week = inp.dataset.week;
      try {
        await db.collection("tests").doc(uid).set({ weeks: { [week]: v } }, { merge: true });
        toast("✅ تم حفظ الدرجة");
      } catch (e) { toast("حصل خطأ بالحفظ"); }
    });
  });
}

/* ============================================================
   تبويب "الإدارة" (مشرفة / أدمن)
============================================================ */
async function renderAdminTab() {
  const el = document.getElementById("tabContent");
  el.innerHTML = `<div class="card"><div class="hint">...جارِ التحميل</div></div>`;
  const [profiles, progressMap] = await Promise.all([fetchAllHafithaProfiles(), fetchAllProgress()]);

  let html = `<div class="card"><h2>⚙️ الحافظات المسجلات</h2>`;
  if (!profiles.length) html += `<div class="hint">ما فيه حافظات مسجلات بعد</div>`;
  profiles
    .map((p) => ({ ...p, points: computeTotalPoints(progressMap[p.uid] || {}) }))
    .sort((a, b) => b.points - a.points)
    .forEach((p) => {
      html += `<div class="admin-row"><div class="who"><b>@${p.username}</b><span>حافظة</span></div><div class="leader-pts">${p.points} ن</div></div>`;
    });
  html += `</div>`;

  if (state.role === "admin") {
    const allProfiles = await fetchAllProfiles();
    html += `<div class="card"><h2>👑 إدارة كل المستخدمات</h2>`;
    allProfiles.forEach((p) => {
      html += `<div class="admin-row">
        <div class="who"><b>@${p.username}</b><span>${roleLabel(p.role)}</span></div>
        ${p.username === "admin" ? "" : `<button class="btn-outline danger" data-uid="${p.uid}" data-name="${p.username}">حذف</button>`}
      </div>`;
    });
    html += `</div>`;

    html += `<div class="card">
      <h2>➕ إضافة حافظة يدوياً</h2>
      <form id="adminAddForm">
        <div class="field"><label>اسم المستخدم</label><input type="text" id="newHafithaUsername" required minlength="3" /></div>
        <div class="field"><label>كلمة المرور</label><input type="password" id="newHafithaPassword" required minlength="6" /></div>
        <button class="btn-main" type="submit">إضافة الحساب</button>
      </form>
      <div id="adminAddMsg"></div>
    </div>`;
  }

  el.innerHTML = html;

  document.querySelectorAll("#tabContent button.btn-outline.danger").forEach((btn) => {
    btn.addEventListener("click", () => deleteUserAccount(btn.dataset.uid, btn.dataset.name));
  });

  const addForm = document.getElementById("adminAddForm");
  if (addForm) {
    addForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("newHafithaUsername").value.trim();
      const password = document.getElementById("newHafithaPassword").value;
      const msgEl = document.getElementById("adminAddMsg");
      msgEl.textContent = ""; msgEl.className = "";
      if (username.toLowerCase() === "admin") { msgEl.textContent = "اسم محجوز"; msgEl.className = "msg error"; return; }
      if (await usernameExists(username)) { msgEl.textContent = "اسم المستخدم موجود مسبقاً"; msgEl.className = "msg error"; return; }
      try {
        await adminAddHafitha(username, password);
        msgEl.textContent = "تمت الإضافة ✅"; msgEl.className = "msg ok";
        renderAdminTab();
      } catch (err) {
        msgEl.textContent = "حصل خطأ: " + (err.message || ""); msgEl.className = "msg error";
      }
    });
  }
}

function roleLabel(r) { return { hafitha: "حافظة", mushrifa: "مشرفة", admin: "أدمن" }[r] || r; }

function getSecondaryAuth() {
  let secApp;
  try { secApp = firebase.app("Secondary"); } catch (e) { secApp = firebase.initializeApp(firebaseConfig, "Secondary"); }
  return secApp.auth();
}
async function adminAddHafitha(username, password) {
  const secAuth = getSecondaryAuth();
  const cred = await secAuth.createUserWithEmailAndPassword(usernameToEmail(username), password);
  const uid = cred.user.uid;
  await db.collection("profiles").doc(uid).set({
    username, role: "hafitha", createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  await secAuth.signOut();
}

async function deleteUserAccount(uid, username) {
  if (!confirm(`متأكدة تبين تحذفين حساب @${username}؟`)) return;
  try {
    await Promise.all([
      db.collection("profiles").doc(uid).delete(),
      db.collection("progress").doc(uid).delete(),
      db.collection("tests").doc(uid).delete(),
      db.collection("reviewPlans").doc(uid).delete(),
    ]);
    toast("تم الحذف");
    renderAdminTab();
  } catch (err) { toast("حصل خطأ بالحذف"); }
}

/* ============================================================
   تبويب "المراجعة اليومية"
============================================================ */
function surahOptionsHtml(selectedIdx) {
  return SURAHS.map((s, i) => `<option value="${i}" ${i === selectedIdx ? "selected" : ""}>${i + 1}. ${s.name}</option>`).join("");
}

async function renderDailyPlanTab() {
  const el = document.getElementById("tabContent");
  el.innerHTML = `<div class="card"><div class="hint">...جارِ التحميل</div></div>`;
  state.myPlan = await fetchMyPlan();
  renderDailyPlanContent();
}

function renderDailyPlanContent() {
  const el = document.getElementById("tabContent");
  let html = `<div class="card">
    <h2>📖 خطة المراجعة اليومية</h2>
    <div class="hint">حددي من وين لين وين تبين تحفظين/تراجعين، والموقع بيوزعها تلقائياً على أيام الأحد والاثنين والثلاثاء والأربعاء طول الأسابيع الخمسة (٢٠ يوم).</div>
    <div class="divider"></div>
    <div class="section-label">نقطة البداية</div>
    <div class="mini-input-group" style="margin-bottom:10px">
      <select id="planStartSurah">${surahOptionsHtml(0)}</select>
      <input type="number" id="planStartAyah" min="1" value="1" style="width:70px" />
    </div>
    <div class="section-label">نقطة النهاية</div>
    <div class="mini-input-group" style="margin-bottom:14px">
      <select id="planEndSurah">${surahOptionsHtml(1)}</select>
      <input type="number" id="planEndAyah" min="1" value="286" style="width:70px" />
    </div>
    <button class="btn-main" id="genPlanBtn">توليد الخطة وحفظها</button>
    <div id="planMsg"></div>
  </div>`;

  if (state.myPlan && state.myPlan.slots) {
    html += `<div class="card"><h2>خطتك المحفوظة</h2>${renderPlanTableHtml(state.myPlan.slots)}</div>`;
  }

  el.innerHTML = html;
  document.getElementById("planStartSurah").addEventListener("change", (e) => {
    document.getElementById("planStartAyah").max = SURAHS[Number(e.target.value)].ayahs;
  });
  document.getElementById("planEndSurah").addEventListener("change", (e) => {
    document.getElementById("planEndAyah").max = SURAHS[Number(e.target.value)].ayahs;
  });
  document.getElementById("genPlanBtn").addEventListener("click", generateDailyPlan);
}

function renderPlanTableHtml(slots) {
  let html = "";
  for (let w = 1; w <= COURSE_WEEKS; w++) {
    const weekSlots = slots.filter((s) => weekIndexOf(s.date) === w);
    html += `<div class="week-block"><div class="week-title">الأسبوع ${w}</div>
      <div class="table-wrap"><table class="simple"><thead><tr><th>اليوم</th><th>التاريخ</th><th>المقطع</th></tr></thead><tbody>
      ${weekSlots.map((s) => `<tr><td>${weekdayName(s.date)}</td><td>${formatDateHuman(s.date)}</td><td>${formatAyatRange(s.fromGlobal, s.toGlobal)}</td></tr>`).join("")}
      </tbody></table></div></div>`;
  }
  return html;
}

async function generateDailyPlan() {
  const startSurah = Number(document.getElementById("planStartSurah").value);
  const startAyah = Number(document.getElementById("planStartAyah").value);
  const endSurah = Number(document.getElementById("planEndSurah").value);
  const endAyah = Number(document.getElementById("planEndAyah").value);
  const msgEl = document.getElementById("planMsg");
  msgEl.textContent = ""; msgEl.className = "";

  if (!startAyah || startAyah < 1 || startAyah > SURAHS[startSurah].ayahs) { msgEl.textContent = "رقم آية البداية غير صحيح"; msgEl.className = "msg error"; return; }
  if (!endAyah || endAyah < 1 || endAyah > SURAHS[endSurah].ayahs) { msgEl.textContent = "رقم آية النهاية غير صحيح"; msgEl.className = "msg error"; return; }

  const startGlobal = toGlobalAyah(startSurah, startAyah);
  const endGlobal = toGlobalAyah(endSurah, endAyah);
  if (endGlobal < startGlobal) { msgEl.textContent = "نقطة النهاية لازم تكون بعد نقطة البداية"; msgEl.className = "msg error"; return; }

  const dates = taskDayDates();
  const total = endGlobal - startGlobal + 1;
  const counts = splitCounts(total, dates.length);
  const slots = [];
  let cursor = startGlobal;
  dates.forEach((date, i) => {
    const segEnd = cursor + counts[i] - 1;
    slots.push({ date, fromGlobal: cursor, toGlobal: segEnd });
    cursor = segEnd + 1;
  });

  const plan = { startSurah, startAyah, endSurah, endAyah, slots, createdAt: Date.now() };
  try {
    await db.collection("reviewPlans").doc(state.uid).set(plan);
    state.myPlan = plan;
    toast("✅ تم توليد الخطة وحفظها");
    renderDailyPlanContent();
  } catch (err) {
    msgEl.textContent = "حصل خطأ بالحفظ"; msgEl.className = "msg error";
  }
}

/* ============================================================
   تبويب "حاسبة المراجعة التراكمية"
============================================================ */
const calcState = { unit: "ayat", mode: "auto" };

function renderCalculatorTab() {
  const el = document.getElementById("tabContent");
  el.innerHTML = `
    <div class="card">
      <h2>🧮 حاسبة المراجعة التراكمية</h2>
      <div class="hint">أداة تخطيط بس (بدون نقاط). كل مقطع تراجعينه يبقى معك طول بقية الأسبوع، وتنتهي كل أسبوع بمراجعة أسبوعية شاملة يوم الخميس.</div>
      <div class="divider"></div>
      <div class="section-label">وحدة القياس</div>
      <div class="unit-toggle">
        <button data-unit="ayat" class="${calcState.unit === "ayat" ? "active" : ""}">بالآيات</button>
        <button data-unit="pages" class="${calcState.unit === "pages" ? "active" : ""}">بالصفحات / الأوجه</button>
      </div>
      <div class="section-label">طريقة الإدخال</div>
      <div class="unit-toggle">
        <button data-mode="auto" class="${calcState.mode === "auto" ? "active" : ""}">تلقائي من نطاق واحد</button>
        <button data-mode="manual" class="${calcState.mode === "manual" ? "active" : ""}">يدوي (أسبوع واحد)</button>
      </div>
    </div>
    <div id="calcForm"></div>
    <div id="calcResult"></div>
  `;

  document.querySelectorAll(".unit-toggle button[data-unit]").forEach((b) => {
    b.addEventListener("click", () => { calcState.unit = b.dataset.unit; renderCalculatorTab(); });
  });
  document.querySelectorAll(".unit-toggle button[data-mode]").forEach((b) => {
    b.addEventListener("click", () => { calcState.mode = b.dataset.mode; renderCalculatorTab(); });
  });

  if (calcState.mode === "auto") renderCalcAutoForm(); else renderCalcManualForm();
}

function renderCalcAutoForm() {
  const formEl = document.getElementById("calcForm");
  if (calcState.unit === "ayat") {
    formEl.innerHTML = `<div class="card">
      <div class="section-label">نقطة البداية</div>
      <div class="mini-input-group" style="margin-bottom:10px">
        <select id="calcStartSurah">${surahOptionsHtml(1)}</select>
        <input type="number" id="calcStartAyah" min="1" value="1" style="width:70px" />
      </div>
      <div class="section-label">نقطة النهاية</div>
      <div class="mini-input-group" style="margin-bottom:10px">
        <select id="calcEndSurah">${surahOptionsHtml(1)}</select>
        <input type="number" id="calcEndAyah" min="1" value="88" style="width:70px" />
      </div>
      <div class="section-label">عدد الأسابيع</div>
      <input type="number" id="calcWeeks" min="1" max="5" value="5" style="width:70px;padding:9px;border-radius:9px;border:1.5px solid #dfe6e1;margin-bottom:14px" />
      <button class="btn-main" id="calcRunBtn">احسبي الجدول</button>
    </div>`;
  } else {
    formEl.innerHTML = `<div class="card">
      <div class="grid2">
        <div><div class="section-label">من صفحة</div><input type="number" id="calcStartPage" min="1" max="${MAX_PAGE}" value="1" style="width:100%;padding:9px;border-radius:9px;border:1.5px solid #dfe6e1" /></div>
        <div><div class="section-label">إلى صفحة</div><input type="number" id="calcEndPage" min="1" max="${MAX_PAGE}" value="20" style="width:100%;padding:9px;border-radius:9px;border:1.5px solid #dfe6e1" /></div>
      </div>
      <div class="section-label" style="margin-top:12px">عدد الأسابيع</div>
      <input type="number" id="calcWeeks" min="1" max="5" value="5" style="width:70px;padding:9px;border-radius:9px;border:1.5px solid #dfe6e1;margin-bottom:14px" />
      <button class="btn-main" id="calcRunBtn">احسبي الجدول</button>
    </div>`;
  }
  document.getElementById("calcRunBtn").addEventListener("click", runCalcAuto);
}

function runCalcAuto() {
  const weeks = Math.min(5, Math.max(1, Number(document.getElementById("calcWeeks").value) || 5));
  const resultEl = document.getElementById("calcResult");
  let startVal, endVal;
  if (calcState.unit === "ayat") {
    const ss = Number(document.getElementById("calcStartSurah").value);
    const sa = Number(document.getElementById("calcStartAyah").value);
    const es = Number(document.getElementById("calcEndSurah").value);
    const ea = Number(document.getElementById("calcEndAyah").value);
    startVal = toGlobalAyah(ss, sa); endVal = toGlobalAyah(es, ea);
  } else {
    startVal = Number(document.getElementById("calcStartPage").value);
    endVal = Number(document.getElementById("calcEndPage").value);
  }
  if (endVal < startVal) { resultEl.innerHTML = `<div class="card"><div class="msg error">نقطة النهاية لازم تكون بعد نقطة البداية</div></div>`; return; }

  const totalSlots = weeks * 4;
  const total = endVal - startVal + 1;
  const counts = splitCounts(total, totalSlots);
  const segs = [];
  let cursor = startVal;
  counts.forEach((c) => { const segEnd = cursor + c - 1; segs.push([cursor, segEnd]); cursor = segEnd + 1; });

  let html = "";
  for (let w = 0; w < weeks; w++) {
    const weekSegs = segs.slice(w * 4, w * 4 + 4);
    html += buildCumulativeWeekTable(w + 1, weekSegs, calcState.unit);
  }
  resultEl.innerHTML = html;
}

function fmt(unit, from, to) { return unit === "ayat" ? formatAyatRange(from, to) : formatPageRange(from, to); }

function buildCumulativeWeekTable(weekNum, daySegs, unit) {
  // daySegs: [[from,to], [from,to], [from,to], [from,to]] لأحد-اثنين-ثلاثاء-اربعاء
  const dayLabels = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء"];
  const weekStart = daySegs[0][0];
  let rows = "";
  daySegs.forEach((seg, i) => {
    const newPart = fmt(unit, seg[0], seg[1]);
    const cum = i === 0 ? "—" : fmt(unit, weekStart, seg[1]);
    rows += `<tr class="rev-row"><td>${dayLabels[i]}</td><td>${newPart}</td><td class="cum">${cum}</td></tr>`;
  });
  const weekEnd = daySegs[daySegs.length - 1][1];
  rows += `<tr class="rev-row thu"><td>الخميس</td><td>مراجعة أسبوعية</td><td class="cum">${fmt(unit, weekStart, weekEnd)}</td></tr>`;
  rows += `<tr class="rev-row fri"><td>الجمعة</td><td>راحة</td><td>—</td></tr>`;
  rows += `<tr class="rev-row sat"><td>السبت</td><td>اختبار</td><td class="cum">${fmt(unit, weekStart, weekEnd)} (تراكمي)</td></tr>`;

  return `<div class="card"><h2>الأسبوع ${weekNum}</h2>
    <div class="table-wrap"><table class="simple"><thead><tr><th>اليوم</th><th>مراجعة</th><th>مراجعة تراكمية</th></tr></thead>
    <tbody>${rows}</tbody></table></div></div>`;
}

function renderCalcManualForm() {
  const formEl = document.getElementById("calcForm");
  const dayLabels = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء"];
  let inputsHtml = "";
  dayLabels.forEach((lbl, i) => {
    if (calcState.unit === "ayat") {
      inputsHtml += `<div class="divider"></div><div class="section-label">${lbl}</div>
        <div class="mini-input-group">
          <select id="mSurah${i}">${surahOptionsHtml(0)}</select>
          <input type="number" id="mFrom${i}" min="1" value="1" style="width:60px" placeholder="من" />
          <input type="number" id="mTo${i}" min="1" value="10" style="width:60px" placeholder="إلى" />
        </div>`;
    } else {
      inputsHtml += `<div class="divider"></div><div class="section-label">${lbl}</div>
        <div class="mini-input-group">
          <input type="number" id="mFrom${i}" min="1" max="${MAX_PAGE}" value="${i * 2 + 1}" style="width:80px" placeholder="من صفحة" />
          <input type="number" id="mTo${i}" min="1" max="${MAX_PAGE}" value="${i * 2 + 2}" style="width:80px" placeholder="إلى صفحة" />
        </div>`;
    }
  });
  formEl.innerHTML = `<div class="card">${inputsHtml}<button class="btn-main" id="calcManualRunBtn" style="margin-top:14px">احسبي الجدول</button></div>`;
  document.getElementById("calcManualRunBtn").addEventListener("click", runCalcManual);
}

function runCalcManual() {
  const resultEl = document.getElementById("calcResult");
  const dayLabels = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء"];
  const daySegLabels = [];
  for (let i = 0; i < 4; i++) {
    if (calcState.unit === "ayat") {
      const s = Number(document.getElementById(`mSurah${i}`).value);
      const from = Number(document.getElementById(`mFrom${i}`).value);
      const to = Number(document.getElementById(`mTo${i}`).value);
      daySegLabels.push(from === to ? `${SURAHS[s].name} : ${from}` : `${SURAHS[s].name} : ${from}-${to}`);
    } else {
      const from = Number(document.getElementById(`mFrom${i}`).value);
      const to = Number(document.getElementById(`mTo${i}`).value);
      daySegLabels.push(formatPageRange(from, to));
    }
  }
  let rows = "";
  let cumList = [];
  daySegLabels.forEach((lbl, i) => {
    rows += `<tr class="rev-row"><td>${dayLabels[i]}</td><td>${lbl}</td><td class="cum">${i === 0 ? "—" : cumList.join("، ")}</td></tr>`;
    cumList.push(lbl);
  });
  rows += `<tr class="rev-row thu"><td>الخميس</td><td>مراجعة أسبوعية</td><td class="cum">${cumList.join("، ")}</td></tr>`;
  rows += `<tr class="rev-row fri"><td>الجمعة</td><td>راحة</td><td>—</td></tr>`;
  rows += `<tr class="rev-row sat"><td>السبت</td><td>اختبار</td><td class="cum">${cumList.join("، ")} (تراكمي)</td></tr>`;

  resultEl.innerHTML = `<div class="card"><h2>جدول الأسبوع</h2>
    <div class="table-wrap"><table class="simple"><thead><tr><th>اليوم</th><th>مراجعة</th><th>مراجعة تراكمية</th></tr></thead>
    <tbody>${rows}</tbody></table></div></div>`;
}
