/* ==========================================================================
   LIFELEDGER AI — INTELLIGENT LIFE DASHBOARD
   User Authentication & Blank State Life Analytics Engine
   ========================================================================== */

// Clean blank state for every new user/session — no pre-filled data!
// Clean blank state for user session — no pre-filled sample data!
function blankState() {
  return {
    income: [],
    expenses: [],
    budget: {
      "Housing & Rent": 20000,
      "Food & Dining": 7000,
      "Transport": 6000,
      "Utilities": 5000,
      "Subscriptions": 2000,
      "Entertainment": 3000,
      "Shopping": 5000,
      "Healthcare": 4000,
      "Other": 3000
    },
    tasks: [],
    bills: [],
    subscriptions: [],
    documents: [],
    appointments: [],
    goals: [],
    purchases: [],
    passwords: [],
    healthRecords: [],
    waterIntake: [],
    sleepRecords: [],
    workouts: [],
    medications: [],
    habits: [],
    habitCompletions: [],
    doctorVisits: [],
    notes: [],
    contacts: [],
    reminders: [],
    vehicles: [],
    warranties: [],
    importantIds: []
  };
}

// In-memory database of registered user accounts for browser tab session.
let usersDB = {};
let currentUser = null;
let state = blankState();
let activeGoalTab = "today"; // Sub-tab inside Goals
let activeDocCategory = "Yours Document"; // Sub-tab inside Documents
let activeApptCategory = "Personal"; // Sub-tab inside Appointments
let selectedBillMonthYear = "";
let selectedFinanceMonthYear = "";

// Module Sub-tab & Filter States
let activeHealthTab = "overview"; // 'overview', 'records'
let activeAssetsTab = "vehicles"; // 'vehicles', 'warranties', 'ids'
let notesCategoryFilter = "All";
let contactsRelationshipFilter = "All";
let remindersCategoryFilter = "All";
let healthRecordTypeFilter = "All";
let maskedIdsState = {}; // Keyed by ID entry id to track visibility (default hidden)
let selectedIdPdfFile = null;

/* ===== DATABASE SECURITY & DOCUMENT FILTERING ===== */
function normalizeUserDocuments(userId) {
  if (!userId || !usersDB[userId] || !usersDB[userId].data) return;
  if (!Array.isArray(usersDB[userId].data.documents)) {
    usersDB[userId].data.documents = [];
  }
  usersDB[userId].data.documents.forEach(doc => {
    if (!doc.userId) doc.userId = userId;
    if (!doc.category) doc.category = "Yours Document";
    if (!doc.documentTitle && doc.name) doc.documentTitle = doc.name;
    if (!doc.name && doc.documentTitle) doc.name = doc.documentTitle;
    if (!doc.documentType && doc.type) doc.documentType = doc.type;
    if (!doc.type && doc.documentType) doc.type = doc.documentType;
  });
}

function getUserDocuments(userId, category) {
  // Validate authenticated identity (Phase 8 Security)
  if (!userId || userId !== currentUser) {
    console.warn("Security alert: Unauthorized access attempt to document database for user:", userId);
    return [];
  }

  normalizeUserDocuments(userId);

  const userRecord = usersDB[userId];
  if (!userRecord || !userRecord.data || !Array.isArray(userRecord.data.documents)) {
    return [];
  }

  // Filter documents by ownership and category (Phase 5 & Phase 6)
  return userRecord.data.documents.filter(doc => {
    // Ownership check (Phase 5 & 8)
    const docUserId = doc.userId || userId;
    if (docUserId !== userId) return false;

    // Category check (Phase 2, 3 & 6 legacy default)
    const docCategory = doc.category || "Yours Document";
    return docCategory === category;
  });
}

function switchDocCategory(category) {
  if (category === activeDocCategory) return;
  activeDocCategory = category;
  renderMain();
}

/* ===== APPOINTMENTS DATABASE SECURITY & FILTERING ===== */
function normalizeUserAppointments(userId) {
  if (!userId || !usersDB[userId] || !usersDB[userId].data) return;
  if (!Array.isArray(usersDB[userId].data.appointments)) {
    usersDB[userId].data.appointments = [];
  }
  usersDB[userId].data.appointments.forEach(appt => {
    if (!appt.userId) appt.userId = userId;
    if (!appt.category) appt.category = "Personal";
  });
}

function getUserAppointments(userId, category) {
  if (!userId || userId !== currentUser) {
    console.warn("Security alert: Unauthorized access attempt to appointments database for user:", userId);
    return [];
  }

  normalizeUserAppointments(userId);

  const userRecord = usersDB[userId];
  if (!userRecord || !userRecord.data || !Array.isArray(userRecord.data.appointments)) {
    return [];
  }

  return userRecord.data.appointments.filter(appt => {
    const apptUserId = appt.userId || userId;
    if (apptUserId !== userId) return false;
    const apptCategory = appt.category || "Personal";
    return apptCategory === category;
  });
}

function switchApptCategory(category) {
  if (category === activeApptCategory) return;
  activeApptCategory = category;
  renderMain();
}

function deleteAppointment(id) {
  if (!currentUser) return;
  const apptIndex = (state.appointments || []).findIndex(a => a.id === id && (a.userId || currentUser) === currentUser);
  if (apptIndex === -1) {
    showToast("Unauthorized or appointment not found.");
    return;
  }
  state.appointments.splice(apptIndex, 1);
  saveSessionData();
  renderMain();
  showToast("Appointment deleted");
}

function openEditApptModal(id) {
  const appt = (state.appointments || []).find(a => a.id === id);
  if (!appt) return;
  document.getElementById("editApptId").value = appt.id;
  document.getElementById("editApptTitle").value = appt.title || "";
  document.getElementById("editApptDate").value = appt.date || new Date().toISOString().split("T")[0];
  document.getElementById("editApptTime").value = appt.time || "10:00 AM";
  document.getElementById("editApptCategory").value = appt.category || "Personal";
  document.getElementById("editApptModal").style.display = "flex";
}

function closeEditApptModal() {
  document.getElementById("editApptModal").style.display = "none";
}

function saveEditAppt(e) {
  if (e) e.preventDefault();
  const id = parseFloat(document.getElementById("editApptId").value);
  const title = document.getElementById("editApptTitle").value.trim();
  const date = document.getElementById("editApptDate").value;
  const time = document.getElementById("editApptTime").value.trim() || "10:00 AM";
  const category = document.getElementById("editApptCategory").value;

  if (!title || !date) {
    showToast("Please provide appointment title and select a date");
    return;
  }

  const appt = (state.appointments || []).find(a => a.id === id);
  if (appt) {
    appt.title = title;
    appt.date = date;
    appt.time = time;
    appt.category = category;
    saveSessionData();
    closeEditApptModal();
    renderMain();
    showToast(`Appointment "${title}" updated successfully`);
  }
}

/* ===== BILLS & SUBSCRIPTIONS DATABASE NORMALIZATION ===== */
function normalizeUserBills(userId) {
  if (!userId || !usersDB[userId] || !usersDB[userId].data) return;
  if (!Array.isArray(usersDB[userId].data.bills)) {
    usersDB[userId].data.bills = [];
  }
  usersDB[userId].data.bills.forEach(b => {
    if (!b.id) b.id = Date.now() + Math.floor(Math.random() * 1000);
    if (!b.userId) b.userId = userId;
    if (!b.name) b.name = "Untitled Bill";
    if (typeof b.amount !== "number") b.amount = parseFloat(b.amount) || 0;
    if (!b.due) b.due = new Date().toISOString().split("T")[0];
    if (!b.category) b.category = "Utilities";
    if (!b.frequency) b.frequency = "Monthly";
    if (!b.notes) b.notes = "";
    if (!b.status) b.status = "Upcoming";
  });
}

function normalizeUserSubscriptions(userId) {
  if (!userId || !usersDB[userId] || !usersDB[userId].data) return;
  if (!Array.isArray(usersDB[userId].data.subscriptions)) {
    usersDB[userId].data.subscriptions = [];
  }
  usersDB[userId].data.subscriptions.forEach(s => {
    if (!s.id) s.id = Date.now() + Math.floor(Math.random() * 1000);
    if (!s.userId) s.userId = userId;
    if (!s.name) s.name = "Untitled Service";
    if (typeof s.amount !== "number") s.amount = parseFloat(s.amount) || 0;
    if (!s.cycle) s.cycle = (s.period && (s.period === "Yearly" || s.period === "yearly")) ? "Yearly" : "Monthly";
    if (!s.startDate) s.startDate = new Date().toISOString().split("T")[0];
    if (!s.nextBilling) s.nextBilling = new Date().toISOString().split("T")[0];
    if (!s.category) s.category = "Entertainment";
    if (!s.paymentMethod) s.paymentMethod = "Auto-debit";
    if (!s.autoRenewal) s.autoRenewal = "Yes";
    if (!s.status) s.status = "Active";
    if (!s.notes) s.notes = "";
  });
}

/* ===== FINANCE, BILLS & SUBSCRIPTIONS SYNCHRONIZATION ===== */
function syncBillToFinance(bill) {
  if (!bill || !bill.id) return;
  if (!Array.isArray(state.expenses)) state.expenses = [];

  const categoryMap = {
    "Utilities": "Utilities",
    "Rent": "Housing & Rent",
    "Subscriptions": "Subscriptions",
    "Insurance": "Insurance",
    "Credit Card": "Credit Card",
    "Medical": "Healthcare",
    "Education": "Education",
    "Other": "Other"
  };
  const mappedCategory = categoryMap[bill.category] || bill.category || "Utilities";
  const expenseDate = bill.due || new Date().toISOString().split("T")[0];
  const monthKey = getMonthYearKey(expenseDate);

  const existingIndex = state.expenses.findIndex(e => (e.sourceType === "bill" || e.source === "bill") && (e.sourceId === bill.id || e.id === bill.id));

  if (existingIndex !== -1) {
    state.expenses[existingIndex].amount = bill.amount;
    state.expenses[existingIndex].desc = `Bill: ${bill.name}`;
    state.expenses[existingIndex].category = mappedCategory;
    state.expenses[existingIndex].date = expenseDate;
    state.expenses[existingIndex].billingPeriod = monthKey;
  } else {
    state.expenses.unshift({
      id: bill.id,
      source: "bill",
      sourceType: "bill",
      sourceId: bill.id,
      billingPeriod: monthKey,
      desc: `Bill: ${bill.name}`,
      amount: bill.amount,
      category: mappedCategory,
      date: expenseDate
    });
  }
}

function unlinkBillFromFinance(billId) {
  if (!Array.isArray(state.expenses)) state.expenses = [];
  state.expenses = state.expenses.filter(e => !((e.sourceType === "bill" || e.source === "bill") && (e.sourceId === billId || e.id === billId)));
}

function checkSubCycleMatch(sub, targetYyyy, targetMm, startYyyy, startMm) {
  if (targetYyyy < startYyyy || (targetYyyy === startYyyy && targetMm < startMm)) {
    return false;
  }

  const cycle = (sub.cycle || "Monthly").toLowerCase();
  if (cycle === "monthly") {
    return true;
  } else if (cycle === "yearly" || cycle === "annually") {
    let nextBillingMonth = startMm;
    if (sub.nextBilling) {
      const k = getMonthYearKey(sub.nextBilling);
      if (k && k.includes("-")) {
        nextBillingMonth = parseInt(k.split("-")[1], 10);
      }
    }
    return targetMm === nextBillingMonth;
  } else if (cycle === "quarterly") {
    const diffMonths = (targetYyyy - startYyyy) * 12 + (targetMm - startMm);
    return diffMonths % 3 === 0;
  } else if (cycle === "weekly") {
    return true;
  }
  return true;
}

function syncSubscriptionToFinance(sub, monthKey) {
  if (!sub || !sub.id || !monthKey) return;
  if (!Array.isArray(state.expenses)) state.expenses = [];

  const categoryMap = {
    "Entertainment": "Subscriptions",
    "Utilities": "Utilities",
    "Software": "Software",
    "Health": "Healthcare",
    "Gaming": "Entertainment",
    "Cloud Services": "Utilities",
    "Other": "Other"
  };
  const mappedCategory = categoryMap[sub.category] || sub.category || "Subscriptions";

  const [targetYyyy, targetMm] = monthKey.split("-").map(n => parseInt(n, 10));
  
  let startMonthKey = getMonthYearKey(sub.startDate || sub.nextBilling);
  if (!startMonthKey) startMonthKey = monthKey;
  const [startYyyy, startMm] = startMonthKey.split("-").map(n => parseInt(n, 10));

  let isBilledInMonth = false;

  if (sub.status === "Cancelled") {
    const cancelMonthKey = getMonthYearKey(sub.cancelledDate) || getMonthYearKey(sub.nextBilling) || monthKey;
    const [cancelYyyy, cancelMm] = cancelMonthKey.split("-").map(n => parseInt(n, 10));
    if (targetYyyy > cancelYyyy || (targetYyyy === cancelYyyy && targetMm > cancelMm)) {
      isBilledInMonth = false;
    } else {
      isBilledInMonth = checkSubCycleMatch(sub, targetYyyy, targetMm, startYyyy, startMm);
    }
  } else if (sub.status === "Paused") {
    isBilledInMonth = false;
  } else {
    isBilledInMonth = checkSubCycleMatch(sub, targetYyyy, targetMm, startYyyy, startMm);
  }

  const expId = `sub_${sub.id}_${monthKey}`;
  const existingIndex = state.expenses.findIndex(e => (e.sourceType === "subscription" || e.source === "subscription") && (e.sourceId === sub.id || e.id === expId) && e.billingPeriod === monthKey);

  if (isBilledInMonth) {
    let billingDay = 15;
    if (sub.nextBilling) {
      const d = new Date(sub.nextBilling);
      if (!isNaN(d.getDate())) billingDay = d.getDate();
    }
    const dateStr = `${monthKey}-${String(billingDay).padStart(2, "0")}`;

    if (existingIndex !== -1) {
      state.expenses[existingIndex].amount = sub.amount;
      state.expenses[existingIndex].desc = `Subscription: ${sub.name}`;
      state.expenses[existingIndex].category = mappedCategory;
      state.expenses[existingIndex].date = dateStr;
      state.expenses[existingIndex].billingPeriod = monthKey;
    } else {
      state.expenses.unshift({
        id: expId,
        source: "subscription",
        sourceType: "subscription",
        sourceId: sub.id,
        billingPeriod: monthKey,
        desc: `Subscription: ${sub.name}`,
        amount: sub.amount,
        category: mappedCategory,
        date: dateStr
      });
    }
  } else {
    if (existingIndex !== -1) {
      state.expenses.splice(existingIndex, 1);
    }
  }
}

function unlinkSubscriptionFromFinance(subId) {
  if (!Array.isArray(state.expenses)) state.expenses = [];
  state.expenses = state.expenses.filter(e => !((e.sourceType === "subscription" || e.source === "subscription") && e.sourceId === subId));
}

function getAvailableFinanceMonthYears() {
  const set = new Set();
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  set.add(currentKey);

  for (let i = -12; i <= 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    set.add(k);
  }

  if (state.income) {
    state.income.forEach(i => {
      const k = getMonthYearKey(i.date);
      if (k) set.add(k);
    });
  }

  if (state.expenses) {
    state.expenses.forEach(e => {
      const k = getMonthYearKey(e.date);
      if (k) set.add(k);
    });
  }

  if (state.bills) {
    state.bills.forEach(b => {
      const k1 = getMonthYearKey(b.due);
      if (k1) set.add(k1);
      const k2 = getMonthYearKey(b.paidDate);
      if (k2) set.add(k2);
    });
  }

  if (state.subscriptions) {
    state.subscriptions.forEach(s => {
      const k1 = getMonthYearKey(s.startDate);
      if (k1) set.add(k1);
      const k2 = getMonthYearKey(s.nextBilling);
      if (k2) set.add(k2);
    });
  }

  return Array.from(set).sort();
}

function syncAllBillsAndSubscriptionsToFinance() {
  if (!state.bills) state.bills = [];
  if (!state.subscriptions) state.subscriptions = [];
  if (!state.expenses) state.expenses = [];

  const availableMonths = getAvailableFinanceMonthYears();

  state.bills.forEach(bill => {
    syncBillToFinance(bill);
  });

  state.subscriptions.forEach(sub => {
    availableMonths.forEach(mKey => {
      syncSubscriptionToFinance(sub, mKey);
    });
  });

  const activeBillIds = new Set(state.bills.map(b => b.id));
  const activeSubIds = new Set(state.subscriptions.map(s => s.id));

  state.expenses = state.expenses.filter(e => {
    if (e.sourceType === "bill" || e.source === "bill") {
      return activeBillIds.has(e.sourceId || e.id);
    }
    if (e.sourceType === "subscription" || e.source === "subscription") {
      return activeSubIds.has(e.sourceId);
    }
    return true;
  });
}

function changeFinanceMonthFilter(val) {
  selectedFinanceMonthYear = val;
  renderMain();
}

/* ===== PERSISTENCE HELPERS WITH FIREBASE CLOUD SYNC ===== */
function saveSessionData() {
  if (currentUser && usersDB[currentUser]) {
    normalizeUserDocuments(currentUser);
    normalizeUserAppointments(currentUser);
    normalizeUserBills(currentUser);
    normalizeUserSubscriptions(currentUser);
    syncAllBillsAndSubscriptionsToFinance();
    usersDB[currentUser].data = state;
    try {
      localStorage.setItem("lifeledger_usersDB", JSON.stringify(usersDB));
      localStorage.setItem("lifeledger_currentUser", currentUser);
    } catch (e) {
      console.warn("LocalStorage write error:", e);
    }

    // Real-time Cloud Sync with Firebase Firestore
    if (window.Firebase && typeof window.Firebase.syncUserDataToCloud === "function") {
      window.Firebase.syncUserDataToCloud(currentUser, state);
    }
  }
}

function loadSessionData() {
  try {
    const savedDB = localStorage.getItem("lifeledger_usersDB");
    if (savedDB) usersDB = JSON.parse(savedDB);
    const savedUser = localStorage.getItem("lifeledger_currentUser");
    if (savedUser && usersDB[savedUser]) {
      currentUser = savedUser;
      state = usersDB[savedUser].data;
      if (!state.passwords) state.passwords = [];
      if (!state.documents) state.documents = [];
      if (!state.appointments) state.appointments = [];
      if (!state.bills) state.bills = [];
      if (!state.subscriptions) state.subscriptions = [];
      if (!state.expenses) state.expenses = [];
      if (!state.income) state.income = [];
      if (!state.healthRecords) state.healthRecords = [];
      if (!state.waterIntake) state.waterIntake = [];
      if (!state.sleepRecords) state.sleepRecords = [];
      if (!state.workouts) state.workouts = [];
      if (!state.medications) state.medications = [];
      if (!state.habits) state.habits = [];
      if (!state.habitCompletions) state.habitCompletions = [];
      if (!state.doctorVisits) state.doctorVisits = [];
      if (!state.notes) state.notes = [];
      if (!state.contacts) state.contacts = [];
      if (!state.reminders) state.reminders = [];
      if (!state.vehicles) state.vehicles = [];
      if (!state.warranties) state.warranties = [];
      if (!state.importantIds) state.importantIds = [];
      normalizeUserDocuments(currentUser);
      normalizeUserAppointments(currentUser);
      normalizeUserBills(currentUser);
      normalizeUserSubscriptions(currentUser);
      syncAllBillsAndSubscriptionsToFinance();

      // Async fetch cloud state from Firebase Firestore
      if (window.Firebase && typeof window.Firebase.fetchUserDataFromCloud === "function") {
        window.Firebase.fetchUserDataFromCloud(currentUser).then(cloudData => {
          if (cloudData && typeof cloudData === 'object') {
            state = { ...state, ...cloudData };
            if (usersDB[currentUser]) {
              usersDB[currentUser].data = state;
              localStorage.setItem("lifeledger_usersDB", JSON.stringify(usersDB));
            }
            if (typeof renderMain === 'function' && currentUser) {
              renderMain();
            }
          }
        });
      }

      // Real-time live NoSQL Firestore subscription listener across browser tabs / devices
      if (window.Firebase && typeof window.Firebase.subscribeToCloudData === "function") {
        window.Firebase.subscribeToCloudData(currentUser, (cloudData) => {
          if (cloudData && typeof cloudData === 'object') {
            state = { ...state, ...cloudData };
            if (usersDB[currentUser]) {
              usersDB[currentUser].data = state;
              try { localStorage.setItem("lifeledger_usersDB", JSON.stringify(usersDB)); } catch(e){}
            }
            if (typeof renderMain === 'function' && currentUser) {
              renderMain();
            }
          }
        });
      }

      return savedUser;
    }
  } catch (e) {
    console.warn("LocalStorage read error:", e);
  }
  return null;
}

/* ===== LIVE DATE & TIME DISPLAY ===== */
function updateLiveDate() {
  const now = new Date();
  const optionsDate = { day: 'numeric', month: 'long', year: 'numeric' };
  const dateStr = now.toLocaleDateString('en-GB', optionsDate);
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  const dateFullEl = document.getElementById("dateFull");
  const dateTimeEl = document.getElementById("dateTime");

  if (dateFullEl) dateFullEl.textContent = dateStr;
  if (dateTimeEl) dateTimeEl.textContent = timeStr;
}

/* ===== TOAST ALERTS & COPY HELPERS ===== */
function showToast(msg) {
  let toast = document.getElementById("toastBox");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toastBox";
    toast.className = "toast-box";
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> <span>${msg}</span>`;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function copyToClipboard(text, label = "Item") {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${label} copied to clipboard!`);
    }).catch(() => fallbackCopy(text, label));
  } else {
    fallbackCopy(text, label);
  }
}

function fallbackCopy(text, label) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  showToast(`${label} copied to clipboard!`);
}

function generateSecurePassword(length = 14) {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=";
  let ret = "";
  for (let i = 0; i < length; i++) {
    ret += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return ret;
}

function evaluatePwdStrength(pwd) {
  if (!pwd) return { label: 'Weak', class: 'weak' };
  if (pwd.length >= 10 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) {
    return { label: 'Strong (Secure)', class: 'strong' };
  } else if (pwd.length >= 6) {
    return { label: 'Good', class: 'medium' };
  }
  return { label: 'Weak', class: 'weak' };
}

/* ===== HELPERS ===== */
const fmt = n => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const totalIncome = () => state.income.reduce((s, i) => s + i.amount, 0);
const totalExpense = () => state.expenses.reduce((s, e) => s + e.amount, 0);

function getCurrentFinanceMonthKey() {
  const availableMonths = getAvailableFinanceMonthYears();
  const nowKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  if (!selectedFinanceMonthYear || !availableMonths.includes(selectedFinanceMonthYear)) {
    selectedFinanceMonthYear = availableMonths.includes(nowKey) ? nowKey : (availableMonths[0] || nowKey);
  }
  return selectedFinanceMonthYear;
}

function getFinanceIncomeForMonth(monthKey) {
  if (!Array.isArray(state.income)) return [];
  if (!monthKey) return state.income;
  return state.income.filter(i => getMonthYearKey(i.date) === monthKey);
}

function getFinanceExpensesForMonth(monthKey) {
  if (!Array.isArray(state.expenses)) return [];
  if (!monthKey) return state.expenses;
  return state.expenses.filter(e => getMonthYearKey(e.date) === monthKey);
}

function totalIncomeForMonth(monthKey) {
  return getFinanceIncomeForMonth(monthKey).reduce((s, i) => s + (i.amount || 0), 0);
}

function totalExpenseForMonth(monthKey) {
  return getFinanceExpensesForMonth(monthKey).reduce((s, e) => s + (e.amount || 0), 0);
}

const categoryTotals = () => {
  const t = {};
  state.expenses.forEach(e => {
    let cat = e.category;
    if (cat === "Rent") cat = "Housing & Rent";
    t[cat] = (t[cat] || 0) + e.amount;
  });
  return t;
};

function categoryTotalsForMonth(monthKey) {
  const t = {};
  const categoryAlias = {
    "Rent": "Housing & Rent",
    "Housing": "Housing & Rent",
    "Food": "Food & Dining",
    "Dining": "Food & Dining",
    "Health": "Healthcare",
    "Medical": "Healthcare"
  };
  getFinanceExpensesForMonth(monthKey).forEach(e => {
    let cat = categoryAlias[e.category] || e.category || "Other";
    t[cat] = (t[cat] || 0) + (e.amount || 0);
  });
  return t;
}

/* ===== AI INPUT PARSER ===== */
const CATEGORY_MAP = {
  "Food & Dining": ["food", "lunch", "dinner", "breakfast", "restaurant", "swiggy", "zomato", "grocery", "groceries", "snack", "coffee"],
  "Transport": ["petrol", "fuel", "gas", "taxi", "uber", "ola", "transport", "bus", "train", "cab", "auto"],
  "Shopping": ["shopping", "clothes", "shoes", "bought", "amazon", "flipkart", "store", "headphones", "electronics"],
  "Entertainment": ["movie", "netflix", "game", "entertainment", "concert", "spotify", "cinema"],
  "Utilities": ["bill", "electricity", "internet", "water", "phone", "airtel", "broadband", "bses", "recharge"],
  "Housing & Rent": ["rent", "maintenance", "house", "flat"],
  "Healthcare": ["doctor", "medicine", "hospital", "pharmacy", "consultation", "dental"]
};

function detectCategory(text) {
  const low = text.toLowerCase();
  for (const cat in CATEGORY_MAP) {
    if (CATEGORY_MAP[cat].some(k => low.includes(k))) return cat;
  }
  return "Shopping";
}

function parseEntry(text) {
  const low = text.toLowerCase();
  const amtMatch = text.match(/(?:₹|rs\.?|inr)?\s?(\d[\d,]*)(?:\.\d+)?/i);
  const amount = amtMatch ? parseInt(amtMatch[1].replace(/,/g, ""), 10) : null;
  const isIncome = /(received|earned|got paid|income|salary|credited)/.test(low);
  const isBill = /(bill|due|subscription)/.test(low) && amount;
  const todayIso = new Date().toISOString().split("T")[0];

  if (isBill && !isIncome) {
    return { type: "Bill", name: text.replace(/(?:₹|rs\.?)\s?\d[\d,]*/gi, "").replace(/is due.*$/i, "").trim() || "New Bill", amount, due: todayIso };
  }
  if (isIncome && amount) {
    return { type: "Income", amount, source: text.replace(/\d+/g, "").replace(/received|salary|credited/gi, "").trim() || "Income", date: todayIso };
  }
  if (amount) {
    return { type: "Expense", amount, category: detectCategory(text), desc: text.replace(/(?:₹|rs\.?)\s?\d[\d,]*/gi, "").trim() || "Expense", date: todayIso };
  }
  return { type: "Task", title: text.trim(), priority: low.includes("urgent") || low.includes("tomorrow") ? "high" : "medium", deadline: "Tomorrow" };
}

function handleParsed(p) {
  const todayIso = new Date().toISOString().split("T")[0];
  if (p.type === "Expense") {
    const expDate = (p.date && p.date !== "Today") ? p.date : todayIso;
    state.expenses.unshift({ id: Date.now(), desc: p.desc, amount: p.amount, category: p.category, date: expDate });
    saveSessionData();
    return `<div class="pr-row"><span class="pr-field">Type: <b>Expense</b></span><span class="pr-field">Amount: <b>${fmt(p.amount)}</b></span><span class="pr-field">Category: <b>${p.category}</b></span></div>`;
  }
  if (p.type === "Income") {
    const incDate = (p.date && p.date !== "Today") ? p.date : todayIso;
    state.income.unshift({ id: Date.now(), source: p.source, amount: p.amount, date: incDate, category: "Income" });
    saveSessionData();
    return `<div class="pr-row"><span class="pr-field">Type: <b>Income</b></span><span class="pr-field">Amount: <b>${fmt(p.amount)}</b></span></div>`;
  }
  if (p.type === "Bill") {
    const billDue = (p.due && p.due !== "Next Week") ? p.due : todayIso;
    const newBill = { id: Date.now(), name: p.name, amount: p.amount, due: billDue, status: "Upcoming", icon: "zap" };
    state.bills.unshift(newBill);
    syncBillToFinance(newBill);
    saveSessionData();
    return `<div class="pr-row"><span class="pr-field">Type: <b>Bill</b></span><span class="pr-field">Amount: <b>${fmt(p.amount)}</b></span><span class="pr-field">Due: <b>${billDue}</b></span></div>`;
  }
  state.tasks.unshift({ id: Date.now(), title: p.title, priority: p.priority, deadline: p.deadline, done: false });
  saveSessionData();
  return `<div class="pr-row"><span class="pr-field">Type: <b>Task</b></span><span class="pr-field">Title: <b>${p.title}</b></span><span class="pr-field">Priority: <b>${p.priority.toUpperCase()}</b></span></div>`;
}

/* ===== NAV ICONS ===== */
const NAV_ICONS = {
  Dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
  Finance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19V10"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M20 19H4"/></svg>`,
  "Health & Wellness": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.72-8.72 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  Productivity: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  Tasks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  Bills: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>`,
  Documents: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  Appointments: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  Goals: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  Assets: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`,
  "Notes & Journal": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  Contacts: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  Password: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
};

const views = ["Dashboard", "Finance", "Bills", "Health & Wellness", "Productivity", "Documents", "Appointments", "Assets", "Notes & Journal", "Contacts", "Password"];
let activeView = "Dashboard";

function renderNav() {
  const nav = document.getElementById("mainNav");
  nav.innerHTML = views.map(v =>
    `<button data-view="${v}" class="${v === activeView ? 'active' : ''}">${NAV_ICONS[v] || ''}<span>${v}</span></button>`
  ).join("");
  nav.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      activeView = btn.dataset.view;
      renderNav();
      renderMain();
    });
  });
}

/* ==========================================================================
   DYNAMIC CHART BUILDERS (Renders with User's Manual Data)
   ========================================================================== */

const CHART_COLORS = ['#7c3aed', '#a78bfa', '#3b82f6', '#06b6d4', '#f59e0b', '#ef4444', '#ec4899', '#64748b'];

// Donut Chart Generator
function buildDonutChart(cats) {
  const entries = Object.entries(cats || {}).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (!entries.length || total === 0) {
    return `
      <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 36px; margin-bottom: 8px;">🍩</div>
        <div style="font-weight: 700; color: #334155; margin-bottom: 4px; font-size: 15px;">No expenses logged yet</div>
        <div style="font-size: 12.5px; max-width: 320px; margin: 0 auto;">Type a phrase like <b>“Spent ₹450 on food today”</b> above to build your spending chart.</div>
      </div>`;
  }

  let cumulativePct = 0;
  const gradientStops = entries.map(([c, v], i) => {
    const pct = (v / total) * 100;
    const start = cumulativePct;
    cumulativePct += pct;
    const color = CHART_COLORS[i % CHART_COLORS.length];
    return `${color} ${start.toFixed(2)}% ${cumulativePct.toFixed(2)}%`;
  }).join(", ");

  let legendItems = [];
  if (entries.length <= 6) {
    legendItems = entries.map(([c, v], i) => ({
      color: CHART_COLORS[i % CHART_COLORS.length],
      label: c,
      amount: v
    }));
  } else {
    const top5 = entries.slice(0, 5);
    const rest = entries.slice(5);
    const restTotal = rest.reduce((s, [, v]) => s + v, 0);
    legendItems = top5.map(([c, v], i) => ({
      color: CHART_COLORS[i % CHART_COLORS.length],
      label: c,
      amount: v
    }));
    legendItems.push({
      color: CHART_COLORS[5 % CHART_COLORS.length],
      label: `${rest.length} more categories`,
      amount: restTotal
    });
  }

  const legendHtml = legendItems.map(item => {
    const amtStr = item.amount >= 1000 ? `₹${(item.amount / 1000).toFixed(1)}k` : fmt(item.amount);
    return `
      <div class="legend-row">
        <span class="legend-swatch" style="background:${item.color}"></span>
        <span class="legend-label">${item.label}</span>
        <span class="legend-amt num">${amtStr}</span>
      </div>`;
  }).join("");

  const totalStr = total >= 1000 ? `₹${(total / 1000).toFixed(1)}k` : fmt(total);

  return `
    <div class="donut-container">
      <div class="donut-graphic-wrapper">
        <div class="donut-graphic" style="background: conic-gradient(${gradientStops});">
          <div class="donut-hole">
            <div class="lbl">Total</div>
            <div class="val num">${totalStr}</div>
          </div>
        </div>
      </div>
      <div class="donut-legend">${legendHtml}</div>
    </div>`;
}

// Income vs Expenses Dual Bar Chart (Dynamic from User Data)
function buildDualBarChart(monthKey) {
  const inc = totalIncomeForMonth ? totalIncomeForMonth(monthKey) : totalIncome();
  const exp = totalExpenseForMonth ? totalExpenseForMonth(monthKey) : totalExpense();

  if (inc === 0 && exp === 0 && (!state.expenses || state.expenses.length === 0)) {
    return `
      <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 36px; margin-bottom: 8px;">📊</div>
        <div style="font-weight: 700; color: #334155; margin-bottom: 4px; font-size: 15px;">No cashflow entries logged</div>
        <div style="font-size: 12.5px;">Add your income or expenses to render comparative financial bars.</div>
      </div>`;
  }

  const maxVal = Math.max(inc, exp, 1000) * 1.25;
  const chartH = 180, chartW = 520, padL = 50, padB = 30, padT = 15, padR = 20;
  const plotH = chartH - padB - padT;

  const yTicks = [maxVal, maxVal * 0.75, maxVal * 0.5, maxVal * 0.25, 0];
  const gridLines = yTicks.map(val => {
    const y = padT + plotH * (1 - val / maxVal);
    const labelText = val === 0 ? "₹0" : (val >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : fmt(val));
    return `
      <g class="grid-line-group">
        <line x1="${padL}" y1="${y}" x2="${chartW - padR}" y2="${y}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3,3" />
        <text x="${padL - 8}" y="${y + 4}" font-size="10" font-weight="600" fill="#94a3b8" text-anchor="end">${labelText}</text>
      </g>`;
  }).join("");

  const incH = (inc / maxVal) * plotH;
  const expH = (exp / maxVal) * plotH;
  const yInc = padT + plotH - incH;
  const yExp = padT + plotH - expH;

  return `
    <div class="svg-bar-chart-wrap">
      <svg viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none">
        ${gridLines}
        <g class="bar-group">
          <rect x="180" y="${yInc}" width="30" height="${incH}" rx="4" fill="#00a86b" />
          <text x="195" y="${chartH - 8}" font-size="11" font-weight="600" fill="#64748b" text-anchor="middle">Income (${fmt(inc)})</text>

          <rect x="310" y="${yExp}" width="30" height="${expH}" rx="4" fill="#dc2626" />
          <text x="325" y="${chartH - 8}" font-size="11" font-weight="600" fill="#64748b" text-anchor="middle">Expenses (${fmt(exp)})</text>
        </g>
      </svg>
    </div>`;
}

// Daily Balance Trend Line Chart (Dynamic from User's Data)
function buildBalanceTrendChart(monthKey) {
  let incList = getFinanceIncomeForMonth ? getFinanceIncomeForMonth(monthKey) : (state.income || []);
  let expList = getFinanceExpensesForMonth ? getFinanceExpensesForMonth(monthKey) : (state.expenses || []);

  const inc = incList.reduce((s, i) => s + (i.amount || 0), 0);

  if (inc === 0 && expList.length === 0) {
    return `
      <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 36px; margin-bottom: 8px;">📈</div>
        <div style="font-weight: 700; color: #334155; margin-bottom: 4px; font-size: 15px;">No balance trend data</div>
        <div style="font-size: 12.5px;">Log income or expenses to plot your real-time balance curve.</div>
      </div>`;
  }

  let points = [inc];
  let running = inc;
  expList.slice().reverse().forEach(e => {
    running -= (e.amount || 0);
    points.push(running);
  });
  if (points.length < 2) points.push(points[0]);

  const maxV = Math.max(...points, 1000) * 1.1;
  const minV = Math.min(...points, 0);
  const chartW = 600, chartH = 220, padL = 50, padB = 30, padT = 15, padR = 20;
  const plotH = chartH - padB - padT;
  const plotW = chartW - padL - padR;

  const yTicks = [maxV, maxV * 0.75, maxV * 0.5, maxV * 0.25, 0];
  const gridLines = yTicks.map(val => {
    const y = padT + plotH * (1 - (val - minV) / ((maxV - minV) || 1));
    const labelText = val === 0 ? "₹0" : (val >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : fmt(val));
    return `
      <g class="grid-line-group">
        <line x1="${padL}" y1="${y}" x2="${chartW - padR}" y2="${y}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3,3" />
        <text x="${padL - 8}" y="${y + 4}" font-size="10" font-weight="600" fill="#94a3b8" text-anchor="end">${labelText}</text>
      </g>`;
  }).join("");

  const getX = i => padL + (i / (points.length - 1)) * plotW;
  const getY = v => padT + plotH * (1 - (v - minV) / ((maxV - minV) || 1));

  let pathD = `M ${getX(0)} ${getY(points[0])}`;
  for (let i = 1; i < points.length; i++) {
    const x0 = getX(i - 1), y0 = getY(points[i - 1]);
    const x1 = getX(i), y1 = getY(points[i]);
    const mx = (x0 + x1) / 2;
    pathD += ` C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`;
  }

  const areaD = `${pathD} L ${getX(points.length - 1)} ${chartH - padB} L ${padL} ${chartH - padB} Z`;

  return `
    <div class="svg-line-chart-wrap" style="height: 240px;">
      <svg viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#6366f1" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="#6366f1" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        ${gridLines}
        <path d="${areaD}" fill="url(#balanceGrad)" />
        <path d="${pathD}" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" />
      </svg>
    </div>`;
}

/* ==========================================================================
   PASSWORD VAULT VIEW
   ========================================================================== */

const PRESET_PLATFORMS = {
  instagram: {
    name: "Instagram",
    class: "platform-instagram",
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`
  },
  facebook: {
    name: "Facebook",
    class: "platform-facebook",
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`
  },
  google: {
    name: "Google ID",
    class: "platform-google",
    icon: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>`
  },
  snapchat: {
    name: "Snapchat",
    class: "platform-snapchat",
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12.04 2c-3.3 0-5.7 2.13-5.7 5.23 0 1.25.32 2.37.91 3.25-.63.38-1.39.81-2.12 1.33-.42.3-.41.81 0 1.13.88.67 1.87 1.19 2.92 1.55.12.87.48 1.63 1.22 2.22-.52.27-1.28.52-2.02.66-.46.09-.54.61-.17.91 1.72 1.37 3.86 1.94 5.96 1.94s4.24-.57 5.96-1.94c.37-.3.29-.82-.17-.91-.74-.14-1.5-.39-2.02-.66.74-.59 1.1-1.35 1.22-2.22 1.05-.36 2.04-.88 2.92-1.55.41-.32.42-.83 0-1.13-.73-.52-1.49-.95-2.12-1.33.59-.88.91-2 .91-3.25C17.74 4.13 15.34 2 12.04 2z"/></svg>`
  },
  twitter: {
    name: "Twitter / X",
    class: "platform-twitter",
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`
  },
  linkedin: {
    name: "LinkedIn",
    class: "platform-linkedin",
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.25V10.9H6.46M7.86 6.7a1.64 1.64 0 1 0 0 3.28 1.64 1.64 0 0 0 0-3.28z"/></svg>`
  },
  digilocker: {
    name: "DigiLocker",
    class: "platform-digilocker",
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-5.45 8-12V6l-8-4z" fill="rgba(255,255,255,0.18)"/><rect x="8.5" y="10.5" width="7" height="5.5" rx="1.5" fill="currentColor"/><path d="M10 10.5V8.5a2 2 0 1 1 4 0v2"/><path d="M10.5 13.2l1 1 2-2" stroke="#0b4182" stroke-width="1.8"/></svg>`
  },
  crunchyroll: {
    name: "Crunchyroll",
    class: "platform-crunchyroll",
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M11 4.5A7.5 7.5 0 1 0 18.5 12 7.5 7.5 0 0 0 11 4.5zm0 11.5a4 4 0 1 1 4-4 4 4 0 0 1-4 4z"/><circle cx="15.5" cy="12" r="2"/></svg>`
  },
  custom: {
    name: "Custom Platform",
    class: "platform-custom",
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
  }
};

function viewPassword() {
  if (!state.passwords) state.passwords = [];
  const totalSaved = state.passwords.length;

  return `
  <div class="pwd-vault-container">
    <!-- Presets Banner -->
    <div class="pwd-presets-banner">
      <div class="pwd-presets-header">
        <div>
          <h2>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Password Vault & Credential Manager
          </h2>
          <div style="font-size: 13px; color: #cbd5e1; margin-top: 4px;">
            Securely save & manage passwords for Instagram, Facebook, Google ID, Snapchat, Twitter, LinkedIn, DigiLocker, Crunchyroll, and custom accounts.
          </div>
        </div>
        <div class="badge-sec">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Encrypted Session Storage (${totalSaved} saved)
        </div>
      </div>

      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 10px;">
        Quick Select Platform:
      </div>
      <div class="pwd-presets-grid">
        <button type="button" class="pwd-preset-chip" data-platform="instagram">
          <div class="pwd-preset-icon platform-instagram">${PRESET_PLATFORMS.instagram.icon}</div>
          <span>Instagram</span>
        </button>
        <button type="button" class="pwd-preset-chip" data-platform="facebook">
          <div class="pwd-preset-icon platform-facebook">${PRESET_PLATFORMS.facebook.icon}</div>
          <span>Facebook</span>
        </button>
        <button type="button" class="pwd-preset-chip" data-platform="google">
          <div class="pwd-preset-icon platform-google">${PRESET_PLATFORMS.google.icon}</div>
          <span>Google ID</span>
        </button>
        <button type="button" class="pwd-preset-chip" data-platform="snapchat">
          <div class="pwd-preset-icon platform-snapchat">${PRESET_PLATFORMS.snapchat.icon}</div>
          <span>Snapchat</span>
        </button>
        <button type="button" class="pwd-preset-chip" data-platform="twitter">
          <div class="pwd-preset-icon platform-twitter">${PRESET_PLATFORMS.twitter.icon}</div>
          <span>Twitter / X</span>
        </button>
        <button type="button" class="pwd-preset-chip" data-platform="linkedin">
          <div class="pwd-preset-icon platform-linkedin">${PRESET_PLATFORMS.linkedin.icon}</div>
          <span>LinkedIn</span>
        </button>
        <button type="button" class="pwd-preset-chip" data-platform="digilocker">
          <div class="pwd-preset-icon platform-digilocker">${PRESET_PLATFORMS.digilocker.icon}</div>
          <span>DigiLocker</span>
        </button>
        <button type="button" class="pwd-preset-chip" data-platform="crunchyroll">
          <div class="pwd-preset-icon platform-crunchyroll">${PRESET_PLATFORMS.crunchyroll.icon}</div>
          <span>Crunchyroll</span>
        </button>
        <button type="button" class="pwd-preset-chip" data-platform="custom">
          <div class="pwd-preset-icon platform-custom">${PRESET_PLATFORMS.custom.icon}</div>
          <span>Custom</span>
        </button>
      </div>
    </div>

    <!-- Add New Credential Form Card -->
    <div class="pwd-form-card">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <h3 style="font-size: 16px; font-weight: 700; color: #0f172a;" id="pwdFormTitle">Add New Password Entry</h3>
        <span style="font-size: 12px; color: var(--text-muted);">Save login credentials securely</span>
      </div>

      <form id="pwdAddForm">
        <div class="pwd-form-grid">
          <div class="pwd-input-group">
            <label for="pwdPlatformSelect">Platform / Account</label>
            
            <select id="pwdPlatformSelect" style="padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 13.5px; outline: none; background: #f8fafc;">
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="google">Google ID</option>
              <option value="snapchat">Snapchat</option>
              <option value="twitter">Twitter / X</option>
              <option value="linkedin">LinkedIn</option>
              <option value="digilocker">DigiLocker</option>
              <option value="crunchyroll">Crunchyroll</option>
              <option value="custom">✏️ Type Manually (Custom Platform)...</option>
            </select>

            <input type="text" id="pwdManualPlatformInput" placeholder="Type platform name (e.g. LinkedIn, Netflix, Spotify)" style="display: none; padding: 10px; border: 1px solid var(--primary-brand); border-radius: 8px; font-size: 13.5px; outline: none; background: #ffffff; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);">
          </div>

          <div class="pwd-input-group">
            <label for="pwdUsernameInput">Username / Email / User ID *</label>
            <input type="text" id="pwdUsernameInput" placeholder="e.g. john_doe or name@gmail.com" required style="padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 13.5px; outline: none; background: #f8fafc;">
          </div>

          <div class="pwd-input-group">
            <label for="pwdPasswordInput">Password *</label>
            <div class="pwd-input-wrap">
              <input type="password" id="pwdPasswordInput" placeholder="Enter password" required>
              <button type="button" class="pwd-toggle-btn" id="pwdFormToggleBtn" title="Show/Hide Password">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 12px; margin-top: 16px; align-items: center; justify-content: flex-end; flex-wrap: wrap;">
          <button type="button" class="pwd-btn-secondary" id="pwdGenBtn" style="background: #f1f5f9; border: 1px solid var(--border-color); padding: 10px 16px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; color: #334155;">
            🎲 Generate Secure Password
          </button>
          <button type="submit" style="background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 13.5px; cursor: pointer; box-shadow: 0 4px 12px rgba(79,70,229,0.25);">
            💾 Save Credential Session
          </button>
        </div>
      </form>
    </div>

    <!-- Search & Saved Password Cards -->
    <div>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
        <h3 style="font-size: 17px; font-weight: 800; color: #0f172a;">Your Saved Passwords (${totalSaved})</h3>
        <input type="text" id="pwdSearchInput" placeholder="🔍 Search passwords..." style="padding: 8px 14px; border: 1px solid var(--border-color); border-radius: 20px; font-size: 13px; outline: none; width: 220px; background: #fff;">
      </div>

      ${totalSaved === 0 ? `
        <div style="background: #fff; border: 1px solid var(--border-color); border-radius: 14px; padding: 40px 20px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 40px; margin-bottom: 12px;">🔑</div>
          <h4 style="font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 6px;">No saved passwords yet</h4>
          <p style="font-size: 13px; max-width: 440px; margin: 0 auto 16px;">
            Click on Instagram, Facebook, Google ID, Snapchat, Twitter, LinkedIn, DigiLocker, or Crunchyroll above to quickly save your login details. All entries are kept saved in your browser session.
          </p>
        </div>
      ` : `
        <div class="pwd-card-grid" id="pwdCardContainer">
          ${renderPasswordCards(state.passwords)}
        </div>
      `}
    </div>
  </div>
  `;
}

function renderPasswordCards(list) {
  return list.map(item => {
    const platKey = item.platform || "custom";
    const platInfo = PRESET_PLATFORMS[platKey] || PRESET_PLATFORMS.custom;
    const displayName = item.customName || platInfo.name;
    const strInfo = evaluatePwdStrength(item.password);

    return `
      <div class="pwd-item-card" data-id="${item.id}">
        <div class="pwd-card-top">
          <div class="pwd-brand-badge">
            <div class="pwd-brand-icon ${platInfo.class}">
              ${platInfo.icon}
            </div>
            <div>
              <div class="pwd-brand-title">${displayName}</div>
              <div class="pwd-brand-sub">Saved ${item.date || 'Recently'}</div>
            </div>
          </div>
          <button class="pwd-btn-danger" onclick="deletePassword(${item.id})">Delete</button>
        </div>

        <div class="pwd-card-field">
          <div class="pwd-field-info">
            <span class="pwd-field-label">Username / Email</span>
            <span class="pwd-field-val">${item.username}</span>
          </div>
          <button type="button" class="pwd-card-btn" onclick="copyToClipboard('${escapeHtml(item.username)}', 'Username')" title="Copy Username">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        </div>

        <div class="pwd-card-field">
          <div class="pwd-field-info">
            <span class="pwd-field-label">Password</span>
            <span class="pwd-field-val pwd-masked" id="pwdText_${item.id}">••••••••••••</span>
          </div>
          <div style="display: flex; gap: 4px; align-items: center;">
            <button type="button" class="pwd-card-btn" onclick="togglePasswordVisibility(${item.id}, '${escapeHtml(item.password)}')" title="Show/Hide Password">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button type="button" class="pwd-card-btn" onclick="copyToClipboard('${escapeHtml(item.password)}', 'Password')" title="Copy Password">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
        </div>

        <div class="pwd-card-actions">
          <div class="pwd-sec-indicator ${strInfo.class}">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: currentColor;"></span>
            Security: ${strInfo.label}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function escapeHtml(str) {
  return String(str || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

function deletePassword(id) {
  state.passwords = state.passwords.filter(p => p.id !== id);
  saveSessionData();
  renderMain();
  showToast("Password entry deleted");
}

function togglePasswordVisibility(id, realPassword) {
  const el = document.getElementById(`pwdText_${id}`);
  if (!el) return;
  if (el.classList.contains("pwd-masked")) {
    el.textContent = realPassword;
    el.classList.remove("pwd-masked");
  } else {
    el.textContent = "••••••••••••";
    el.classList.add("pwd-masked");
  }
}

/* ==========================================================================
   VIEW RENDERERS
   ========================================================================== */

function renderMain() {
  const main = document.getElementById("mainContent");
  if (activeView === "Dashboard") main.innerHTML = viewDashboard();
  else if (activeView === "Finance") main.innerHTML = viewFinance();
  else if (activeView === "Health & Wellness") main.innerHTML = viewHealthAndWellness();
  else if (activeView === "Productivity" || activeView === "Tasks") main.innerHTML = viewTasks();
  else if (activeView === "Bills") main.innerHTML = viewBills();
  else if (activeView === "Documents") main.innerHTML = viewDocuments();
  else if (activeView === "Appointments") main.innerHTML = viewAppointments();
  else if (activeView === "Goals") main.innerHTML = viewGoals();
  else if (activeView === "Assets") main.innerHTML = viewAssets();
  else if (activeView === "Notes & Journal") main.innerHTML = viewNotesAndJournal();
  else if (activeView === "Contacts") main.innerHTML = viewContacts();
  else if (activeView === "Password") main.innerHTML = viewPassword();
  attachHandlers();
  checkAlerts();
}

/* ===== 1. DASHBOARD VIEW ===== */
function viewDashboard() {
  const currentMonth = getCurrentFinanceMonthKey();
  const mIncList = getFinanceIncomeForMonth(currentMonth);
  const mExpList = getFinanceExpensesForMonth(currentMonth);

  const inc = mIncList.reduce((s, i) => s + (i.amount || 0), 0);
  const exp = mExpList.reduce((s, e) => s + (e.amount || 0), 0);
  const bal = inc - exp;
  const cats = categoryTotalsForMonth(currentMonth);

  const activeGoals = (state.goals || []).filter(g => !g.completed);
  const totalSaved = (state.goals || []).reduce((s, g) => s + (g.current || 0), 0);
  const totalTarget = (state.goals || []).reduce((s, g) => s + (g.target || 0), 0);
  const targetPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  const insights = [];
  if (exp > 0 && inc > 0 && exp > inc) {
    insights.push({ kind: "warn", title: "Expenses exceed income", text: `Your spending (${fmt(exp)}) is higher than your logged income (${fmt(inc)}).` });
  } else if (inc > 0) {
    const rate = Math.round((bal / inc) * 100);
    insights.push({ kind: "good", title: "Within monthly income target", text: `${fmt(bal)} remaining after expenses — ${rate}% savings rate.` });
  }
  if ((state.tasks || []).filter(t => !t.done).length > 0) {
    insights.push({ kind: "note", title: "Open Tasks Pending", text: `${state.tasks.filter(t => !t.done).length} active tasks pending completion.` });
  }
  if (insights.length === 0) {
    insights.push({ kind: "good", title: "Clean Slate!", text: "Log your first expense, income, bill, or task above to generate personalized AI insights." });
  }

  const upcomingBills = (state.bills || []).filter(b => b.status !== "Paid");
  const upcomingAppts = state.appointments || [];
  const totalUpcoming = upcomingBills.length + upcomingAppts.length;

  return `
  <!-- Stat Cards (4 Columns) -->
  <div class="stat-cards-row">
    <div class="stat-block c-green">
      <div class="sb-top">
        <div class="sb-icon">↙</div>
        <div class="sb-delta">${inc > 0 ? 'Active' : '0%'}</div>
      </div>
      <div class="sb-label">MONTHLY INCOME</div>
      <div class="sb-value num">${fmt(inc)}</div>
      <div class="sb-sub">${mIncList.length} ${mIncList.length === 1 ? 'record' : 'records'} logged</div>
    </div>
    <div class="stat-block c-red">
      <div class="sb-top">
        <div class="sb-icon">↗</div>
        <div class="sb-delta">${inc > 0 ? Math.round((exp / inc) * 100) + '%' : '0%'}</div>
      </div>
      <div class="sb-label">MONTHLY EXPENSES</div>
      <div class="sb-value num">${fmt(exp)}</div>
      <div class="sb-sub">${inc > 0 ? Math.round((exp / inc) * 100) + '% of income' : 'No income logged'}</div>
    </div>
    <div class="stat-block c-indigo">
      <div class="sb-top">
        <div class="sb-icon">💳</div>
        <div class="sb-delta">${inc > 0 ? Math.round((bal / inc) * 100) + '%' : '0%'}</div>
      </div>
      <div class="sb-label">NET BALANCE</div>
      <div class="sb-value num">${fmt(bal)}</div>
      <div class="sb-sub">${bal >= 0 ? 'Surplus balance' : 'Deficit balance'}</div>
    </div>
    <div class="stat-block c-gold">
      <div class="sb-top">
        <div class="sb-icon">🐖</div>
        <div class="sb-delta">${targetPct}%</div>
      </div>
      <div class="sb-label">SAVINGS GOAL</div>
      <div class="sb-value num">${fmt(totalSaved)}</div>
      <div class="sb-sub">${totalTarget > 0 ? `${targetPct}% of ${fmt(totalTarget)} target` : 'Set a goal in Goals tab'}</div>
    </div>
  </div>

  <!-- Charts Row (2 Columns) -->
  <div class="grid-2" style="margin-bottom: 24px;">
    <div class="card">
      <div class="card-header">
        <div>
          <h2>Spending by Category</h2>
          <div class="sub">Total Expenses: ${fmt(exp)}</div>
        </div>
      </div>
      ${buildDonutChart(cats)}
    </div>

    <div class="card bar-chart-card">
      <div class="card-header">
        <div>
          <h2>Income vs Expenses</h2>
          <div class="sub">Cashflow Comparison (${getMonthYearLabel(currentMonth)})</div>
        </div>
        <div class="chart-legend">
          <span><span class="legend-dot" style="background:#00a86b"></span>Income</span>
          <span><span class="legend-dot" style="background:#dc2626"></span>Expenses</span>
        </div>
      </div>
      ${buildDualBarChart(currentMonth)}
    </div>
  </div>

  <!-- Bottom Row Widgets (3 Columns Grid) -->
  <div class="grid-3">
    <!-- Column 1: Upcoming -->
    <div class="card">
      <div class="card-header">
        <div>
          <h2>Upcoming</h2>
          <div class="sub">Bills and appointments scheduled</div>
        </div>
        <span class="status-badge upcoming-badge">${totalUpcoming} items</span>
      </div>
      <div class="upcoming-list">
        ${upcomingBills.map(b => `
          <div class="upcoming-row">
            <div class="ur-left">
              <div class="ur-icon icon-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
              <div>
                <div class="ur-title">${b.name}</div>
                <div class="ur-sub">Due: ${b.due}</div>
              </div>
            </div>
            <div class="ur-right">
              <div class="ur-amt num">${fmt(b.amount)}</div>
              <span class="pill-tag ${b.status === 'Due Soon' ? 'warning' : 'info'}">${b.status || 'Upcoming'}</span>
            </div>
          </div>
        `).join("")}
        ${upcomingAppts.map(a => `
          <div class="upcoming-row">
            <div class="ur-left">
              <div class="ur-icon icon-amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
              <div>
                <div class="ur-title">${a.title}</div>
                <div class="ur-sub">${a.date} at ${a.time}</div>
              </div>
            </div>
            <div class="ur-right">
              <span class="pill-tag info">Upcoming</span>
            </div>
          </div>
        `).join("")}
        ${totalUpcoming === 0 ? `
          <div style="padding: 24px; text-align:center; color:var(--text-muted); font-size:13px;">
            No upcoming items yet. Log a bill or appointment above!
          </div>` : ''}
      </div>
    </div>

    <!-- Column 2: AI Insights -->
    <div class="card">
      <div class="card-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="header-icon-badge badge-purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.6 4.9L18.5 9.5l-4.9 1.6L12 16l-1.6-4.9L5.5 9.5l4.9-1.6L12 3z"/></svg>
          </div>
          <div>
            <h2>AI Insights</h2>
            <div class="sub">Generated from your current data</div>
          </div>
        </div>
      </div>
      <div class="insights-list">
        ${insights.map(i => `
          <div class="insight-banner ${i.kind}">
            <div class="ib-icon">${i.kind === 'warn' ? '⚠' : i.kind === 'good' ? '✓' : 'ⓘ'}</div>
            <div class="ib-body">
              <span class="ib-title">${i.title}</span>
              <span>${i.text}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Column 3: Goals in Progress -->
    <div class="card">
      <div class="card-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="header-icon-badge badge-purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
          </div>
          <div>
            <h2>Goals in Progress</h2>
            <div class="sub">${activeGoals.length} active goals</div>
          </div>
        </div>
      </div>
      <div class="goals-list">
        ${(state.goals || []).map(g => {
          const pct = g.completed ? 100 : Math.round(((g.current || 0) / (g.target || 1)) * 100);
          return `
            <div class="goal-item">
              <div class="goal-top">
                <span class="goal-name">${g.name} ${g.completed ? '🎉' : ''}</span>
                <span class="goal-pct" style="color: ${g.completed ? '#10b981' : (g.color || '#6366f1')}">${pct}%</span>
              </div>
              <div class="bb-track">
                <div class="bb-fill" style="width: ${pct}%; background: ${g.completed ? '#10b981' : (g.color || '#6366f1')}"></div>
              </div>
              <div class="goal-nums">
                <span>${fmt(g.current || 0)}</span>
                <span>${fmt(g.target || 0)}</span>
              </div>
            </div>`;
        }).join("")}
        ${(!state.goals || state.goals.length === 0) ? `
          <div style="padding: 24px 0; text-align:center; color:var(--text-muted); font-size:12.5px;">
            No goals created yet. Add one in the Goals tab!
          </div>` : ''}
        ${(state.goals || []).length > 0 ? `
          <div class="goals-status-banner">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            <span>${activeGoals.length} goals active in your tracker</span>
          </div>` : ''}
      </div>
    </div>
  </div>`;
}

/* ===== 2. FINANCE VIEW ===== */
function viewFinance() {
  if (!currentUser) return '<div class="card"><p>Please log in to view finance.</p></div>';

  const availableMonths = getAvailableFinanceMonthYears();
  const nowKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  if (!selectedFinanceMonthYear || !availableMonths.includes(selectedFinanceMonthYear)) {
    selectedFinanceMonthYear = availableMonths.includes(nowKey) ? nowKey : (availableMonths[0] || nowKey);
  }
  const currentMonth = selectedFinanceMonthYear;

  const mIncList = getFinanceIncomeForMonth(currentMonth);
  const mExpList = getFinanceExpensesForMonth(currentMonth);

  const inc = mIncList.reduce((s, i) => s + (i.amount || 0), 0);
  const exp = mExpList.reduce((s, e) => s + (e.amount || 0), 0);
  const bal = inc - exp;
  const cats = categoryTotalsForMonth(currentMonth);

  return `
  <!-- Top Header & Export -->
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; flex-wrap:wrap; gap:12px;">
    <div>
      <h2>Finance Overview</h2>
      <div class="sub" style="color:var(--text-muted);">Real-time breakdown of logged entries for <strong>${getMonthYearLabel(currentMonth)}</strong></div>
    </div>
    <div style="display:flex; gap:10px; align-items:center;">
      <label style="font-size: 12px; font-weight: 700; color: var(--text-muted);">Period:</label>
      <select id="financeMonthFilter" onchange="changeFinanceMonthFilter(this.value)" style="padding: 6px 12px; border-radius: 8px; font-weight: 700; border: 1px solid var(--border-color); background: #fff; font-size: 12.5px;">
        ${availableMonths.map(m => `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${getMonthYearLabel(m)}</option>`).join('')}
      </select>
      <button id="exportCsvBtn" style="background:#ffffff; border:1px solid var(--border-color); padding:8px 16px; border-radius:10px; font-weight:600; cursor:pointer; font-size:13px;">Export CSV</button>
    </div>
  </div>

  <!-- 4 Pastel Stat Cards -->
  <div class="stat-cards-row">
    <div class="soft-stat-block green">
      <div class="ss-top">
        <span class="ss-label">Total Income</span>
        <div class="ss-icon">↙</div>
      </div>
      <div class="ss-value num">${fmt(inc)}</div>
      <div class="ss-sub">${mIncList.length} income records</div>
    </div>

    <div class="soft-stat-block red">
      <div class="ss-top">
        <span class="ss-label">Total Expenses</span>
        <div class="ss-icon">↗</div>
      </div>
      <div class="ss-value num">${fmt(exp)}</div>
      <div class="ss-sub">${mExpList.length} expense records</div>
    </div>

    <div class="soft-stat-block blue">
      <div class="ss-top">
        <span class="ss-label">Net Savings</span>
        <div class="ss-icon">💳</div>
      </div>
      <div class="ss-value num">${fmt(bal)}</div>
      <div class="ss-sub">${inc > 0 ? Math.round((bal / inc) * 100) + '% savings rate' : 'No income'}</div>
    </div>

    <div class="soft-stat-block yellow">
      <div class="ss-top">
        <span class="ss-label">Transactions</span>
        <div class="ss-icon">📊</div>
      </div>
      <div class="ss-value num">${mExpList.length + mIncList.length}</div>
      <div class="ss-sub">Logged entries in ${getMonthYearLabel(currentMonth)}</div>
    </div>
  </div>

  <!-- Charts Row -->
  <div class="grid-main-side" style="margin-bottom:24px;">
    <div class="card">
      <div class="card-header">
        <div>
          <h2>Daily Balance Trend</h2>
          <div class="sub">Available balance throughout ${getMonthYearLabel(currentMonth)}</div>
        </div>
      </div>
      ${buildBalanceTrendChart(currentMonth)}
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h2>Budget Utilization</h2>
          <div class="sub">Spend vs limit by category</div>
        </div>
      </div>
      <div class="budget-bars-list">
        ${(() => {
          const catColors = {
            "Housing & Rent": "#6366f1",
            "Food & Dining": "#ec4899",
            "Transport": "#2563eb",
            "Utilities": "#06b6d4",
            "Entertainment": "#ea580c",
            "Healthcare": "#059669",
            "Shopping": "#8b5cf6",
            "Subscriptions": "#3b82f6"
          };
          const budgetKeys = Object.keys(state.budget || {});
          const expenseCatKeys = Object.keys(cats || {});
          const allCats = Array.from(new Set([...budgetKeys, ...expenseCatKeys]));

          if (allCats.length === 0) {
            return `<div style="padding:24px; text-align:center; color:var(--text-muted);">No budget categories set.</div>`;
          }

          return allCats.map(catName => {
            const limit = (state.budget && state.budget[catName]) || 0;
            const spent = cats[catName] || 0;
            const isOver = limit > 0 && spent > limit;
            const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : (spent > 0 ? 100 : 0);
            const overPct = limit > 0 && isOver ? Math.round(((spent - limit) / limit) * 100) : 0;
            const barColor = isOver ? "#dc2626" : (catColors[catName] || "#4f46e5");

            const spentStr = spent >= 1000 ? `₹${(spent / 1000).toFixed(1)}k` : (spent === 0 ? "₹0" : fmt(spent));
            const limitStr = limit >= 1000 ? `₹${(limit / 1000).toFixed(0)}k` : (limit === 0 ? "No limit" : fmt(limit));

            return `
              <div class="budget-bar-item">
                <div class="bb-header">
                  <span class="bb-name ${isOver ? 'warning-title' : ''}">
                    ${isOver ? `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#dc2626" stroke-width="2.5" style="display:inline-block; vertical-align:-1px; margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 1 1.71 3h16.94a2 2 0 0 1 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>` : ''}
                    ${catName}
                  </span>
                  <span class="bb-amounts num ${isOver ? 'warning-amt' : ''}">${spentStr} / ${limitStr}</span>
                </div>
                <div class="bb-track">
                  <div class="bb-fill" style="width: ${pct}%; background: ${barColor};"></div>
                </div>
                ${isOver ? `<div class="bb-warning-msg">+${overPct}% over budget</div>` : ''}
              </div>
            `;
          }).join('');
        })()}
      </div>
    </div>
  </div>

  <!-- Transactions Table -->
  <div class="card">
    <div class="card-header" style="margin-bottom:12px;">
      <div>
        <h2>Transactions</h2>
        <div class="sub">${mExpList.length + mIncList.length} entries for ${getMonthYearLabel(currentMonth)}</div>
      </div>
    </div>

    <div class="table-toolbar">
      <div class="table-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="txSearchInput" placeholder="Search transactions...">
      </div>
      <div class="filter-pills">
        <button class="filter-pill active" data-filter="all">All</button>
        <button class="filter-pill" data-filter="income">Income</button>
        <button class="filter-pill" data-filter="expense">Expense</button>
      </div>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>DATE</th>
          <th>DESCRIPTION</th>
          <th>CATEGORY</th>
          <th>TYPE</th>
          <th style="text-align:right;">AMOUNT</th>
          <th style="text-align:center;">ACTIONS</th>
        </tr>
      </thead>
      <tbody id="txTableBody">
        ${mExpList.map(e => `
          <tr>
            <td class="num">${e.date}</td>
            <td style="font-weight:600; color:#0f172a;">${e.desc}</td>
            <td><span class="cat-badge ${e.category.split(' ')[0]}">${e.category}</span></td>
            <td><span class="type-pill expense">Expense</span></td>
            <td style="text-align:right;" class="amt-neg">-${fmt(e.amount)}</td>
            <td style="text-align:center;"><button style="background:none; border:none; color:var(--red-main); cursor:pointer; font-weight:600;" onclick="deleteExpense('${e.id}')">Delete</button></td>
          </tr>
        `).join("")}
        ${mIncList.map(i => `
          <tr>
            <td class="num">${i.date}</td>
            <td style="font-weight:600; color:#0f172a;">${i.source}</td>
            <td><span class="cat-badge Salary">Salary</span></td>
            <td><span class="type-pill income">Income</span></td>
            <td style="text-align:right;" class="amt-pos">+${fmt(i.amount)}</td>
            <td style="text-align:center;">—</td>
          </tr>
        `).join("")}
        ${(mExpList.length === 0 && mIncList.length === 0) ? `
          <tr>
            <td colspan="6" style="text-align:center; padding: 24px; color:var(--text-muted);">
              No transactions logged for <strong>${getMonthYearLabel(currentMonth)}</strong>. Add an expense or income above!
            </td>
          </tr>` : ''}
      </tbody>
    </table>
  </div>`;
}

/* ===== 3. TASKS VIEW ===== */
function viewTasks() {
  const pending = state.tasks.filter(t => !t.done);
  const completed = state.tasks.filter(t => t.done);
  const highPriority = state.tasks.filter(t => t.priority === "high" && !t.done).length;

  return `
  <div class="stat-cards-row">
    <div class="soft-stat-block blue">
      <div class="ss-top"><span class="ss-label">Total Tasks</span><div class="ss-icon">📋</div></div>
      <div class="ss-value num">${state.tasks.length}</div>
      <div class="ss-sub">${pending.length} pending, ${completed.length} done</div>
    </div>
    <div class="soft-stat-block red">
      <div class="ss-top"><span class="ss-label">High Priority</span><div class="ss-icon">🔥</div></div>
      <div class="ss-value num">${highPriority}</div>
      <div class="ss-sub">Urgent action required</div>
    </div>
    <div class="soft-stat-block green">
      <div class="ss-top"><span class="ss-label">Completion Rate</span><div class="ss-icon">✓</div></div>
      <div class="ss-value num">${state.tasks.length ? Math.round((completed.length / state.tasks.length) * 100) : 0}%</div>
      <div class="ss-sub">${completed.length} completed tasks</div>
    </div>
    <div class="soft-stat-block yellow">
      <div class="ss-top"><span class="ss-label">Pending</span><div class="ss-icon">⏰</div></div>
      <div class="ss-value num">${pending.length}</div>
      <div class="ss-sub">Remaining tasks</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <div>
        <h2>Tasks & Priorities</h2>
        <div class="sub">Manage to-do list</div>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; gap:10px;">
      ${state.tasks.map(t => `
        <div class="upcoming-row" style="background: ${t.done ? '#f8fafc' : '#ffffff'}; opacity:${t.done ? 0.7 : 1};">
          <div class="ur-left">
            <input type="checkbox" data-id="${t.id}" class="taskCheck" ${t.done ? 'checked' : ''} style="width:18px; height:18px; accent-color:#4f46e5; cursor:pointer;">
            <div>
              <div class="ur-title" style="text-decoration: ${t.done ? 'line-through' : 'none'};">${t.title}</div>
              <div class="ur-sub">Deadline: ${t.deadline}</div>
            </div>
          </div>
          <div class="ur-right">
            <span class="status-badge ${t.priority === 'high' ? 'urgent' : 'upcoming'}">${t.priority}</span>
          </div>
        </div>
      `).join("")}
      ${state.tasks.length === 0 ? `
        <div style="padding: 24px; text-align:center; color:var(--text-muted);">
          No tasks added yet. Create a task below or type in Quick Entry!
        </div>` : ''}
    </div>

    <div class="addrow">
      <input type="text" id="taskTitleInput" placeholder="Add a new task...">
      <select id="taskPrioritySelect">
        <option value="high">High Priority</option>
        <option value="medium" selected>Medium Priority</option>
        <option value="low">Low Priority</option>
      </select>
      <input type="text" id="taskDeadlineInput" placeholder="Deadline" style="width:140px;">
      <button id="taskAddBtn">Add Task</button>
    </div>
  </div>`;
}

/* ===== 4. BILLS & SUBSCRIPTIONS LOGIC & VIEW ===== */

/* ===== 4. BILLS & SUBSCRIPTIONS LOGIC & VIEW ===== */

let activeBillSearchQuery = "";
let activeBillStatusFilter = "All"; // 'All', 'Unpaid', 'Paid', 'Overdue'
let activeBillCategoryFilter = "All";
let activeBillSort = "dueDateAsc";
let pendingAddBillPdf = null;
let pendingEditBillPdf = null;

function getMonthYearKey(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  }
  return "";
}

function getMonthYearLabel(monthYearKey) {
  if (!monthYearKey || !monthYearKey.includes("-")) return "Current Month";
  const [yyyy, mm] = monthYearKey.split("-");
  const date = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function getAvailableBillMonthYears() {
  const set = new Set();
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  set.add(currentKey);

  // Generate 12 past months and 24 future months dynamically
  for (let i = -12; i <= 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    set.add(k);
  }

  if (state.bills) {
    state.bills.forEach(b => {
      const k1 = getMonthYearKey(b.due || b.dueDate);
      if (k1) set.add(k1);
      const k2 = getMonthYearKey(b.paidDate);
      if (k2) set.add(k2);
    });
  }

  return Array.from(set).sort();
}

function prevBillMonth() {
  const availableMonths = getAvailableBillMonthYears();
  const currentIndex = availableMonths.indexOf(selectedBillMonthYear);
  if (currentIndex > 0) {
    selectedBillMonthYear = availableMonths[currentIndex - 1];
  } else {
    const [y, m] = (selectedBillMonthYear || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`).split("-").map(n => parseInt(n, 10));
    let prevM = m - 1, prevY = y;
    if (prevM < 1) { prevM = 12; prevY--; }
    selectedBillMonthYear = `${prevY}-${String(prevM).padStart(2, "0")}`;
  }
  renderMain();
}

function nextBillMonth() {
  const availableMonths = getAvailableBillMonthYears();
  const currentIndex = availableMonths.indexOf(selectedBillMonthYear);
  if (currentIndex !== -1 && currentIndex < availableMonths.length - 1) {
    selectedBillMonthYear = availableMonths[currentIndex + 1];
  } else {
    const [y, m] = (selectedBillMonthYear || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`).split("-").map(n => parseInt(n, 10));
    let nextM = m + 1, nextY = y;
    if (nextM > 12) { nextM = 1; nextY++; }
    selectedBillMonthYear = `${nextY}-${String(nextM).padStart(2, "0")}`;
  }
  renderMain();
}

function goToCurrentBillMonth() {
  const now = new Date();
  selectedBillMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  renderMain();
}

function changeBillMonthFilter(val) {
  selectedBillMonthYear = val;
  renderMain();
}

function setBillStatusFilter(status) {
  activeBillStatusFilter = status;
  renderMain();
}

function setBillCategoryFilter(cat) {
  activeBillCategoryFilter = cat;
  renderMain();
}

function setBillSort(sortVal) {
  activeBillSort = sortVal;
  renderMain();
}

function setBillSearchQuery(query) {
  activeBillSearchQuery = query;
  renderMain();
}

/* PDF Upload Handlers */
function handleAddBillPdfSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    showToast("Please select a valid PDF file.");
    e.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = function(evt) {
    pendingAddBillPdf = {
      pdfData: evt.target.result,
      pdfFileName: file.name
    };
    if (document.getElementById("addBillPdfPlaceholder")) document.getElementById("addBillPdfPlaceholder").style.display = "none";
    if (document.getElementById("addBillPdfPreview")) document.getElementById("addBillPdfPreview").style.display = "flex";
    if (document.getElementById("addBillPdfName")) document.getElementById("addBillPdfName").textContent = file.name;
    if (document.getElementById("addBillPdfSize")) document.getElementById("addBillPdfSize").textContent = `${Math.round(file.size / 1024)} KB PDF Document`;
  };
  reader.readAsDataURL(file);
}

function clearAddBillPdf(e) {
  if (e) e.stopPropagation();
  pendingAddBillPdf = null;
  if (document.getElementById("addBillPdfInput")) document.getElementById("addBillPdfInput").value = "";
  if (document.getElementById("addBillPdfPlaceholder")) document.getElementById("addBillPdfPlaceholder").style.display = "block";
  if (document.getElementById("addBillPdfPreview")) document.getElementById("addBillPdfPreview").style.display = "none";
}

function handleEditBillPdfSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    showToast("Please select a valid PDF file.");
    e.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = function(evt) {
    pendingEditBillPdf = {
      pdfData: evt.target.result,
      pdfFileName: file.name
    };
    if (document.getElementById("editBillPdfPlaceholder")) document.getElementById("editBillPdfPlaceholder").style.display = "none";
    if (document.getElementById("editBillPdfPreview")) document.getElementById("editBillPdfPreview").style.display = "flex";
    if (document.getElementById("editBillPdfName")) document.getElementById("editBillPdfName").textContent = file.name;
    if (document.getElementById("editBillPdfSize")) document.getElementById("editBillPdfSize").textContent = `${Math.round(file.size / 1024)} KB PDF Document`;
  };
  reader.readAsDataURL(file);
}

function clearEditBillPdf(e) {
  if (e) e.stopPropagation();
  pendingEditBillPdf = { pdfData: null, pdfFileName: null, clearExisting: true };
  if (document.getElementById("editBillPdfInput")) document.getElementById("editBillPdfInput").value = "";
  if (document.getElementById("editBillPdfPlaceholder")) document.getElementById("editBillPdfPlaceholder").style.display = "block";
  if (document.getElementById("editBillPdfPreview")) document.getElementById("editBillPdfPreview").style.display = "none";
}

function openBillPdfModal(billId) {
  const bill = state.bills.find(b => b.id === billId);
  if (!bill || !bill.pdfData) {
    showToast("No PDF attached to this bill.");
    return;
  }
  document.getElementById("billPdfModalTitle").textContent = `${bill.name} - Invoice PDF`;
  document.getElementById("billPdfModalSub").textContent = `Category: ${bill.category} • ${fmt(bill.amount)}`;
  const iframe = document.getElementById("billPdfIframe");
  iframe.src = bill.pdfData;
  const dlBtn = document.getElementById("billPdfDownloadBtn");
  dlBtn.href = bill.pdfData;
  dlBtn.download = bill.pdfFileName || `${bill.name.replace(/\s+/g, '_')}_Bill.pdf`;
  document.getElementById("billPdfModal").style.display = "flex";
}

function closeBillPdfModal() {
  document.getElementById("billPdfModal").style.display = "none";
  document.getElementById("billPdfIframe").src = "";
}

function toggleAddRecurringFrequency(checked) {
  const wrap = document.getElementById("addBillRecurringFreqWrap");
  if (wrap) wrap.style.display = checked ? "block" : "none";
}

function toggleEditRecurringFrequency(checked) {
  const wrap = document.getElementById("editBillRecurringFreqWrap");
  if (wrap) wrap.style.display = checked ? "block" : "none";
}

function openAddBillModal() {
  pendingAddBillPdf = null;
  document.getElementById("addBillName").value = "";
  document.getElementById("addBillAmount").value = "";
  document.getElementById("addBillCategory").value = "Electricity";
  document.getElementById("addBillDue").value = new Date().toISOString().split("T")[0];
  document.getElementById("addBillStatus").value = "Unpaid";
  document.getElementById("addBillNotes").value = "";
  document.getElementById("addBillRecurring").checked = false;
  document.getElementById("addBillRecurringType").value = "Monthly";
  toggleAddRecurringFrequency(false);
  clearAddBillPdf();
  document.getElementById("addBillModal").style.display = "flex";
}

function closeAddBillModal() {
  document.getElementById("addBillModal").style.display = "none";
}

function saveAddBill(e) {
  if (e) e.preventDefault();
  const name = document.getElementById("addBillName").value.trim();
  const amount = parseFloat(document.getElementById("addBillAmount").value) || 0;
  const category = document.getElementById("addBillCategory").value;
  const due = document.getElementById("addBillDue").value;
  const status = document.getElementById("addBillStatus").value;
  const notes = document.getElementById("addBillNotes").value.trim();
  const recurring = document.getElementById("addBillRecurring").checked;
  const recurringType = document.getElementById("addBillRecurringType").value;

  if (!name || !amount || !due) {
    showToast("Please provide bill name, amount, and due date.");
    return;
  }

  BillsAPI.createBill({
    name,
    amount,
    category,
    due,
    status,
    notes,
    recurring,
    recurringType,
    pdfData: pendingAddBillPdf ? pendingAddBillPdf.pdfData : null,
    pdfFileName: pendingAddBillPdf ? pendingAddBillPdf.pdfFileName : null
  }).then(res => {
    closeAddBillModal();
    renderMain();
    showToast(`Bill "${name}" added successfully!`);
  });
}

function openEditBillModal(id) {
  const bill = state.bills.find(b => b.id === id);
  if (!bill) return;
  pendingEditBillPdf = null;
  document.getElementById("editBillId").value = bill.id;
  document.getElementById("editBillName").value = bill.name || "";
  document.getElementById("editBillAmount").value = bill.amount || "";
  document.getElementById("editBillCategory").value = bill.category || "Electricity";
  document.getElementById("editBillDue").value = bill.due || bill.dueDate || "";
  document.getElementById("editBillStatus").value = bill.status === "Paid" ? "Paid" : "Unpaid";
  document.getElementById("editBillNotes").value = bill.notes || "";
  document.getElementById("editBillRecurring").checked = !!bill.recurring;
  document.getElementById("editBillRecurringType").value = bill.recurringType || "Monthly";
  toggleEditRecurringFrequency(!!bill.recurring);

  if (bill.pdfData) {
    document.getElementById("editBillPdfPlaceholder").style.display = "none";
    document.getElementById("editBillPdfPreview").style.display = "flex";
    document.getElementById("editBillPdfName").textContent = bill.pdfFileName || "Bill_Document.pdf";
  } else {
    document.getElementById("editBillPdfPlaceholder").style.display = "block";
    document.getElementById("editBillPdfPreview").style.display = "none";
  }

  document.getElementById("editBillModal").style.display = "flex";
}

function closeEditBillModal() {
  document.getElementById("editBillModal").style.display = "none";
}

function saveEditBill(e) {
  if (e) e.preventDefault();
  const id = parseFloat(document.getElementById("editBillId").value);
  const name = document.getElementById("editBillName").value.trim();
  const amount = parseFloat(document.getElementById("editBillAmount").value) || 0;
  const category = document.getElementById("editBillCategory").value;
  const due = document.getElementById("editBillDue").value;
  const status = document.getElementById("editBillStatus").value;
  const notes = document.getElementById("editBillNotes").value.trim();
  const recurring = document.getElementById("editBillRecurring").checked;
  const recurringType = document.getElementById("editBillRecurringType").value;

  if (!name || !amount || !due) {
    showToast("Please enter bill name, amount, and due date");
    return;
  }

  const updates = {
    name,
    billName: name,
    amount,
    category,
    due,
    dueDate: due,
    status,
    notes,
    recurring,
    recurringType,
    paidDate: status === "Paid" ? (state.bills.find(b=>b.id===id)?.paidDate || new Date().toISOString().split("T")[0]) : null
  };

  if (pendingEditBillPdf) {
    if (pendingEditBillPdf.clearExisting) {
      updates.pdfData = null;
      updates.pdfFileName = null;
    } else {
      updates.pdfData = pendingEditBillPdf.pdfData;
      updates.pdfFileName = pendingEditBillPdf.pdfFileName;
    }
  }

  BillsAPI.updateBill(id, updates).then(res => {
    closeEditBillModal();
    renderMain();
    showToast("Bill updated successfully!");
  });
}

function deleteBill(id) {
  const bill = state.bills.find(b => b.id === id);
  if (!bill) return;
  if (!confirm(`Are you sure you want to delete bill "${bill.name}"?`)) return;
  BillsAPI.deleteBill(id).then(res => {
    renderMain();
    showToast("Bill deleted");
  });
}

function markBillAsPaid(id) {
  BillsAPI.patchBillStatus(id, "Paid").then(res => {
    renderMain();
    showToast("Bill marked as Paid! Finance & Dashboard updated.");
  });
}

function markBillAsUnpaid(id) {
  BillsAPI.patchBillStatus(id, "Unpaid").then(res => {
    renderMain();
    showToast("Bill marked as Unpaid. Finance expense reversed.");
  });
}

/* ===== SUBSCRIPTION MODAL HANDLERS & LOGIC ===== */

function openSubscriptionModal(id = null) {
  const modal = document.getElementById("subscriptionModal");
  if (!modal) return;
  const title = document.getElementById("subModalTitle");
  if (id) {
    const sub = state.subscriptions.find(s => s.id === id);
    if (!sub) return;
    if (title) title.textContent = "Edit Subscription";
    document.getElementById("subId").value = sub.id;
    document.getElementById("subName").value = sub.name || "";
    document.getElementById("subAmount").value = sub.amount || "";
    document.getElementById("subCycle").value = sub.cycle || "Monthly";
    document.getElementById("subStartDate").value = sub.startDate || new Date().toISOString().split("T")[0];
    document.getElementById("subNextBilling").value = sub.nextBilling || new Date().toISOString().split("T")[0];
    document.getElementById("subCategory").value = sub.category || "Entertainment";
    document.getElementById("subPaymentMethod").value = sub.paymentMethod || "Auto-debit";
    document.getElementById("subAutoRenewal").value = sub.autoRenewal || "Yes";
    document.getElementById("subStatus").value = sub.status || "Active";
    document.getElementById("subNotes").value = sub.notes || "";
  } else {
    if (title) title.textContent = "+ Add Subscription";
    document.getElementById("subId").value = "";
    document.getElementById("subName").value = "";
    document.getElementById("subAmount").value = "";
    document.getElementById("subCycle").value = "Monthly";
    document.getElementById("subStartDate").value = new Date().toISOString().split("T")[0];
    document.getElementById("subNextBilling").value = new Date().toISOString().split("T")[0];
    document.getElementById("subCategory").value = "Entertainment";
    document.getElementById("subPaymentMethod").value = "Auto-debit";
    document.getElementById("subAutoRenewal").value = "Yes";
    document.getElementById("subStatus").value = "Active";
    document.getElementById("subNotes").value = "";
  }
  modal.style.display = "flex";
}

function closeSubscriptionModal() {
  const modal = document.getElementById("subscriptionModal");
  if (modal) modal.style.display = "none";
}

function saveSubscription(e) {
  if (e) e.preventDefault();
  const idVal = document.getElementById("subId").value;
  const name = document.getElementById("subName").value.trim();
  const amount = parseFloat(document.getElementById("subAmount").value) || 0;
  const cycle = document.getElementById("subCycle").value;
  const startDate = document.getElementById("subStartDate").value;
  const nextBilling = document.getElementById("subNextBilling").value;
  const category = document.getElementById("subCategory").value;
  const paymentMethod = document.getElementById("subPaymentMethod").value;
  const autoRenewal = document.getElementById("subAutoRenewal").value;
  const status = document.getElementById("subStatus").value;
  const notes = document.getElementById("subNotes").value.trim();

  if (!name || !amount) {
    showToast("Please provide subscription name and amount");
    return;
  }

  const subData = {
    name,
    amount,
    cycle,
    startDate: startDate || new Date().toISOString().split("T")[0],
    nextBilling: nextBilling || new Date().toISOString().split("T")[0],
    category,
    paymentMethod,
    autoRenewal,
    status,
    notes
  };

  if (idVal) {
    const id = parseFloat(idVal);
    SubscriptionsAPI.updateSubscription(id, subData).then(res => {
      closeSubscriptionModal();
      renderMain();
      showToast(`Subscription "${name}" updated!`);
    });
  } else {
    SubscriptionsAPI.createSubscription(subData).then(res => {
      closeSubscriptionModal();
      renderMain();
      showToast(`Subscription "${name}" added!`);
    });
  }
}

function togglePauseSubscription(id) {
  const sub = state.subscriptions.find(s => s.id === id);
  if (!sub) return;
  const nextStatus = sub.status === "Paused" ? "Active" : "Paused";
  SubscriptionsAPI.patchSubscriptionStatus(id, nextStatus).then(res => {
    renderMain();
    showToast(`Subscription set to ${nextStatus}`);
  });
}

function cancelSubscription(id) {
  const sub = state.subscriptions.find(s => s.id === id);
  if (!sub) return;
  if (!confirm(`Are you sure you want to cancel subscription "${sub.name}"?`)) return;
  SubscriptionsAPI.patchSubscriptionStatus(id, "Cancelled").then(res => {
    renderMain();
    showToast(`Subscription "${sub.name}" Cancelled`);
  });
}

function deleteSubscription(id) {
  const sub = state.subscriptions.find(s => s.id === id);
  if (!sub) return;
  if (!confirm(`Are you sure you want to delete subscription "${sub.name}"?`)) return;
  SubscriptionsAPI.deleteSubscription(id).then(res => {
    renderMain();
    showToast("Subscription deleted");
  });
}

/* ===== REST API ENDPOINTS FOR BILLS ===== */
const BillsAPI = {
  async getBills(monthYear = null) {
    if (!currentUser || !usersDB[currentUser]) return { status: 401, error: "Unauthorized" };
    normalizeUserBills(currentUser);
    let userBills = usersDB[currentUser].data.bills.filter(b => b.userId === currentUser);
    if (monthYear) {
      userBills = userBills.filter(b => getMonthYearKey(b.due) === monthYear || getMonthYearKey(b.paidDate) === monthYear);
    }
    return { status: 200, data: userBills };
  },
  async createBill(billData) {
    if (!currentUser || !usersDB[currentUser]) return { status: 401, error: "Unauthorized" };
    const billId = Date.now() + Math.floor(Math.random() * 1000);
    const todayIso = new Date().toISOString().split("T")[0];
    const dueStr = billData.due || billData.dueDate || todayIso;
    const k = getMonthYearKey(dueStr);
    let month = billData.month, year = billData.year;
    if (!month || !year) {
      if (k && k.includes("-")) {
        const [y, m] = k.split("-").map(n => parseInt(n, 10));
        year = y; month = m;
      }
    }
    const newBill = {
      id: billId,
      _id: `bill_${billId}`,
      userId: currentUser,
      name: billData.name || billData.billName || "Untitled Bill",
      billName: billData.name || billData.billName || "Untitled Bill",
      category: billData.category || "Utilities",
      amount: parseFloat(billData.amount) || 0,
      due: dueStr,
      dueDate: dueStr,
      month: month || new Date().getMonth() + 1,
      year: year || new Date().getFullYear(),
      status: billData.status || "Unpaid",
      paidDate: billData.status === "Paid" ? (billData.paidDate || todayIso) : null,
      notes: billData.notes || "",
      pdfData: billData.pdfData || null,
      pdfFileName: billData.pdfFileName || null,
      recurring: !!billData.recurring,
      recurringType: billData.recurringType || "Monthly",
      financeTransactionId: `bill_exp_${billId}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.bills.unshift(newBill);
    syncBillToFinance(newBill);
    saveSessionData();
    return { status: 201, data: newBill };
  },
  async updateBill(id, updates) {
    if (!currentUser || !usersDB[currentUser]) return { status: 401, error: "Unauthorized" };
    const bill = state.bills.find(b => b.id === id && b.userId === currentUser);
    if (!bill) return { status: 404, error: "Bill not found or unauthorized" };
    Object.assign(bill, updates);
    bill.updatedAt = new Date().toISOString();
    syncBillToFinance(bill);
    saveSessionData();
    return { status: 200, data: bill };
  },
  async patchBillStatus(id, newStatus) {
    if (!currentUser || !usersDB[currentUser]) return { status: 401, error: "Unauthorized" };
    const bill = state.bills.find(b => b.id === id && b.userId === currentUser);
    if (!bill) return { status: 404, error: "Bill not found or unauthorized" };
    bill.status = newStatus;
    if (newStatus === "Paid") {
      bill.paidDate = new Date().toISOString().split("T")[0];
    } else {
      bill.paidDate = null;
    }
    bill.updatedAt = new Date().toISOString();
    syncBillToFinance(bill);
    saveSessionData();
    return { status: 200, data: bill };
  },
  async deleteBill(id) {
    if (!currentUser || !usersDB[currentUser]) return { status: 401, error: "Unauthorized" };
    const index = state.bills.findIndex(b => b.id === id && b.userId === currentUser);
    if (index === -1) return { status: 404, error: "Bill not found or unauthorized" };
    state.bills.splice(index, 1);
    unlinkBillFromFinance(id);
    saveSessionData();
    return { status: 200, success: true };
  }
};

/* ===== REST API ENDPOINTS FOR SUBSCRIPTIONS ===== */
const SubscriptionsAPI = {
  async getSubscriptions() {
    if (!currentUser || !usersDB[currentUser]) return { status: 401, error: "Unauthorized" };
    normalizeUserSubscriptions(currentUser);
    const subs = usersDB[currentUser].data.subscriptions.filter(s => s.userId === currentUser);
    return { status: 200, data: subs };
  },
  async createSubscription(subData) {
    if (!currentUser || !usersDB[currentUser]) return { status: 401, error: "Unauthorized" };
    const subId = Date.now() + Math.floor(Math.random() * 1000);
    const todayIso = new Date().toISOString().split("T")[0];
    const newSub = {
      id: subId,
      _id: `sub_${subId}`,
      userId: currentUser,
      name: subData.name || "Untitled Service",
      amount: parseFloat(subData.amount) || 0,
      cycle: subData.cycle || "Monthly",
      startDate: subData.startDate || todayIso,
      nextBilling: subData.nextBilling || todayIso,
      category: subData.category || "Entertainment",
      paymentMethod: subData.paymentMethod || "Auto-debit",
      autoRenewal: subData.autoRenewal || "Yes",
      status: subData.status || "Active",
      notes: subData.notes || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.subscriptions.unshift(newSub);
    syncAllBillsAndSubscriptionsToFinance();
    saveSessionData();
    return { status: 201, data: newSub };
  },
  async updateSubscription(id, updates) {
    if (!currentUser || !usersDB[currentUser]) return { status: 401, error: "Unauthorized" };
    const sub = state.subscriptions.find(s => s.id === id && s.userId === currentUser);
    if (!sub) return { status: 404, error: "Subscription not found or unauthorized" };
    Object.assign(sub, updates);
    sub.updatedAt = new Date().toISOString();
    syncAllBillsAndSubscriptionsToFinance();
    saveSessionData();
    return { status: 200, data: sub };
  },
  async patchSubscriptionStatus(id, newStatus) {
    if (!currentUser || !usersDB[currentUser]) return { status: 401, error: "Unauthorized" };
    const sub = state.subscriptions.find(s => s.id === id && s.userId === currentUser);
    if (!sub) return { status: 404, error: "Subscription not found or unauthorized" };
    sub.status = newStatus;
    if (newStatus === "Cancelled") {
      sub.cancelledDate = new Date().toISOString().split("T")[0];
    }
    sub.updatedAt = new Date().toISOString();
    syncAllBillsAndSubscriptionsToFinance();
    saveSessionData();
    return { status: 200, data: sub };
  },
  async deleteSubscription(id) {
    if (!currentUser || !usersDB[currentUser]) return { status: 401, error: "Unauthorized" };
    const index = state.subscriptions.findIndex(s => s.id === id && s.userId === currentUser);
    state.subscriptions.splice(index, 1);
    unlinkSubscriptionFromFinance(id);
    saveSessionData();
    return { status: 200, success: true };
  }
};

/* ===== BILLS CATEGORY HELPERS ===== */
function getBillCategoryIcon(category) {
  const catLower = (category || "").toLowerCase();
  if (catLower.includes("electric")) return "⚡";
  if (catLower.includes("water")) return "💧";
  if (catLower.includes("internet") || catLower.includes("wifi")) return "🌐";
  if (catLower.includes("mobile") || catLower.includes("phone")) return "📱";
  if (catLower.includes("rent") || catLower.includes("house")) return "🏠";
  if (catLower.includes("credit") || catLower.includes("card")) return "💳";
  if (catLower.includes("loan") || catLower.includes("bank")) return "🏦";
  if (catLower.includes("insurance")) return "🛡️";
  if (catLower.includes("subscrip") || catLower.includes("stream")) return "📺";
  if (catLower.includes("educat") || catLower.includes("tuition")) return "🎓";
  if (catLower.includes("medic") || catLower.includes("health")) return "🏥";
  if (catLower.includes("shop") || catLower.includes("store")) return "🛍️";
  if (catLower.includes("utilit")) return "💡";
  return "📄";
}

function getBillCategoryBg(category) {
  const catLower = (category || "").toLowerCase();
  if (catLower.includes("electric")) return "background: #fef3c7; color: #b45309;";
  if (catLower.includes("water")) return "background: #e0f2fe; color: #0369a1;";
  if (catLower.includes("internet") || catLower.includes("wifi")) return "background: #e0e7ff; color: #4338ca;";
  if (catLower.includes("mobile") || catLower.includes("phone")) return "background: #f3e8ff; color: #6b21a8;";
  if (catLower.includes("rent") || catLower.includes("house")) return "background: #ecfdf5; color: #047857;";
  if (catLower.includes("credit") || catLower.includes("card")) return "background: #fee2e2; color: #b91c1c;";
  if (catLower.includes("loan") || catLower.includes("bank")) return "background: #ffedd5; color: #c2410c;";
  if (catLower.includes("insurance")) return "background: #f0fdf4; color: #15803d;";
  if (catLower.includes("subscrip")) return "background: #fae8ff; color: #86198f;";
  return "background: #f1f5f9; color: #475569;";
}

/* ===== BILLS PAGE VIEW TEMPLATE ===== */
function viewBills() {
  if (!currentUser) return '<div class="card"><p>Please log in to view bills.</p></div>';

  normalizeUserBills(currentUser);
  normalizeUserSubscriptions(currentUser);

  const availableMonths = getAvailableBillMonthYears();
  const now = new Date();
  const currentRealMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (!selectedBillMonthYear || !availableMonths.includes(selectedBillMonthYear)) {
    selectedBillMonthYear = currentRealMonthKey;
  }

  // Filter bills by selected month
  const monthBills = state.bills.filter(b => {
    const dueKey = getMonthYearKey(b.due || b.dueDate);
    const paidKey = getMonthYearKey(b.paidDate);
    return dueKey === selectedBillMonthYear || paidKey === selectedBillMonthYear;
  });

  const todayIso = now.toISOString().split("T")[0];

  // Calculated Month Summary Metrics
  const totalBillsCount = monthBills.length;
  const totalBillAmount = monthBills.reduce((s, b) => s + (b.amount || 0), 0);
  const paidAmount = monthBills.filter(b => b.status === "Paid").reduce((s, b) => s + (b.amount || 0), 0);
  const pendingAmount = monthBills.filter(b => b.status !== "Paid" && (b.due >= todayIso)).reduce((s, b) => s + (b.amount || 0), 0);
  const overdueAmount = monthBills.filter(b => b.status !== "Paid" && (b.due < todayIso)).reduce((s, b) => s + (b.amount || 0), 0);

  // Apply Status, Category, Search, and Sort Filters
  let filteredBills = monthBills.filter(b => {
    const isPaid = b.status === "Paid";
    const isOverdue = !isPaid && (b.due < todayIso);
    const isUnpaid = !isPaid && !isOverdue;

    if (activeBillStatusFilter === "Paid" && !isPaid) return false;
    if (activeBillStatusFilter === "Unpaid" && !isUnpaid) return false;
    if (activeBillStatusFilter === "Overdue" && !isOverdue) return false;

    if (activeBillCategoryFilter !== "All" && b.category !== activeBillCategoryFilter) return false;

    if (activeBillSearchQuery.trim()) {
      const q = activeBillSearchQuery.toLowerCase();
      const matchName = (b.name || "").toLowerCase().includes(q);
      const matchNotes = (b.notes || "").toLowerCase().includes(q);
      const matchCat = (b.category || "").toLowerCase().includes(q);
      if (!matchName && !matchNotes && !matchCat) return false;
    }
    return true;
  });

  // Sort Bills
  filteredBills.sort((a, b) => {
    if (activeBillSort === "dueDateAsc") return (a.due || "").localeCompare(b.due || "");
    if (activeBillSort === "dueDateDesc") return (b.due || "").localeCompare(a.due || "");
    if (activeBillSort === "amtDesc") return (b.amount || 0) - (a.amount || 0);
    if (activeBillSort === "amtAsc") return (a.amount || 0) - (b.amount || 0);
    if (activeBillSort === "name") return (a.name || "").localeCompare(b.name || "");
    return 0;
  });

  const categoryList = ["Electricity", "Water", "Internet", "Mobile", "Rent", "Credit Card", "Loan", "Insurance", "Subscription", "Education", "Medical", "Shopping", "Other"];

  return `
  <!-- Bills Page Header & Dynamic Month Selector -->
  <div class="card" style="margin-bottom: 24px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;">
      <div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);">🧾</div>
          <div>
            <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">Bills & Subscriptions</h1>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">Manage monthly bills, due dates, payment status, and PDF invoices.</div>
          </div>
        </div>
      </div>

      <button type="button" onclick="openAddBillModal()" style="display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border: none; padding: 11px 22px; border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35); transition: all 0.2s ease;">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>+ Add Bill</span>
      </button>
    </div>

    <!-- Dynamic Month Selector Bar -->
    <div style="display: flex; align-items: center; justify-content: space-between; background: #ffffff; padding: 10px 16px; border-radius: 14px; border: 1px solid var(--border-color); flex-wrap: wrap; gap: 12px; box-shadow: var(--shadow-sm);">
      <div style="display: flex; align-items: center; gap: 8px;">
        <button type="button" onclick="prevBillMonth()" title="Previous Month" style="background: #f1f5f9; border: 1px solid var(--border-color); padding: 7px 14px; border-radius: 8px; font-weight: 700; color: #475569; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 12.5px;">&larr; Prev</button>
        <div style="position: relative;">
          <select id="billMonthSelect" onchange="changeBillMonthFilter(this.value)" style="padding: 8px 32px 8px 14px; border-radius: 8px; font-weight: 800; border: 1.5px solid #6366f1; background: #ffffff; color: #4f46e5; font-size: 14px; cursor: pointer; outline: none;">
            ${availableMonths.map(m => `<option value="${m}" ${m === selectedBillMonthYear ? 'selected' : ''}>${getMonthYearLabel(m)} ${m === currentRealMonthKey ? ' (Current)' : ''}</option>`).join('')}
          </select>
        </div>
        <button type="button" onclick="nextBillMonth()" title="Next Month" style="background: #f1f5f9; border: 1px solid var(--border-color); padding: 7px 14px; border-radius: 8px; font-weight: 700; color: #475569; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 12.5px;">Next &rarr;</button>
      </div>

      <div style="display: flex; align-items: center; gap: 8px;">
        <button type="button" onclick="goToCurrentBillMonth()" style="background: #e0e7ff; border: 1px solid #c7d2fe; color: #4338ca; padding: 7px 14px; border-radius: 8px; font-weight: 700; font-size: 12.5px; cursor: pointer;">📅 Current Month</button>
      </div>
    </div>
  </div>

  <!-- Monthly Summary Cards -->
  <div class="stat-cards-row" style="margin-bottom: 24px;">
    <div class="soft-stat-block blue">
      <div class="ss-top"><span class="ss-label">Total Bills</span><div class="ss-icon">📑</div></div>
      <div class="ss-value num">${totalBillsCount}</div>
      <div class="ss-sub">${getMonthYearLabel(selectedBillMonthYear)} Records</div>
    </div>
    <div class="soft-stat-block yellow">
      <div class="ss-top"><span class="ss-label">Total Amount</span><div class="ss-icon">💰</div></div>
      <div class="ss-value num">${fmt(totalBillAmount)}</div>
      <div class="ss-sub">Combined Monthly Target</div>
    </div>
    <div class="soft-stat-block green">
      <div class="ss-top"><span class="ss-label">Paid Amount</span><div class="ss-icon">✓</div></div>
      <div class="ss-value num">${fmt(paidAmount)}</div>
      <div class="ss-sub">${monthBills.filter(b=>b.status==='Paid').length} Bills Cleared</div>
    </div>
    <div class="soft-stat-block red">
      <div class="ss-top"><span class="ss-label">Pending / Overdue</span><div class="ss-icon">⏳</div></div>
      <div class="ss-value num">${fmt(pendingAmount + overdueAmount)}</div>
      <div class="ss-sub">${monthBills.filter(b=>b.status!=='Paid').length} Unpaid Items</div>
    </div>
  </div>

  <!-- Filters & Controls Bar -->
  <div class="card" style="margin-bottom: 20px; padding: 16px 20px;">
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
      <!-- Search Input -->
      <div style="flex: 1; min-width: 220px; position: relative;">
        <input type="text" value="${escapeHtml(activeBillSearchQuery)}" oninput="setBillSearchQuery(this.value)" placeholder="🔍 Search bills by name, category, notes..." style="width: 100%; padding: 9px 14px; border-radius: 10px; border: 1px solid var(--border-color); font-size: 13px; outline: none; background: #ffffff;">
      </div>

      <!-- Filter Pills -->
      <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        <button type="button" class="filter-pill ${activeBillStatusFilter === 'All' ? 'active' : ''}" onclick="setBillStatusFilter('All')" style="padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 12px; cursor: pointer; border: 1px solid var(--border-color); background: ${activeBillStatusFilter === 'All' ? '#1e293b' : '#fff'}; color: ${activeBillStatusFilter === 'All' ? '#fff' : '#64748b'};">All (${monthBills.length})</button>
        <button type="button" class="filter-pill ${activeBillStatusFilter === 'Unpaid' ? 'active' : ''}" onclick="setBillStatusFilter('Unpaid')" style="padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 12px; cursor: pointer; border: 1px solid #fde68a; background: ${activeBillStatusFilter === 'Unpaid' ? '#f59e0b' : '#fffce8'}; color: ${activeBillStatusFilter === 'Unpaid' ? '#fff' : '#d97706'};">Unpaid (${monthBills.filter(b=>b.status!=='Paid' && b.due>=todayIso).length})</button>
        <button type="button" class="filter-pill ${activeBillStatusFilter === 'Paid' ? 'active' : ''}" onclick="setBillStatusFilter('Paid')" style="padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 12px; cursor: pointer; border: 1px solid #a7f3d0; background: ${activeBillStatusFilter === 'Paid' ? '#10b981' : '#ecfdf5'}; color: ${activeBillStatusFilter === 'Paid' ? '#fff' : '#059669'};">Paid (${monthBills.filter(b=>b.status==='Paid').length})</button>
        <button type="button" class="filter-pill ${activeBillStatusFilter === 'Overdue' ? 'active' : ''}" onclick="setBillStatusFilter('Overdue')" style="padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 12px; cursor: pointer; border: 1px solid #fecaca; background: ${activeBillStatusFilter === 'Overdue' ? '#ef4444' : '#fef2f2'}; color: ${activeBillStatusFilter === 'Overdue' ? '#fff' : '#dc2626'};">Overdue (${monthBills.filter(b=>b.status!=='Paid' && b.due<todayIso).length})</button>
      </div>

      <!-- Category Filter -->
      <div>
        <select onchange="setBillCategoryFilter(this.value)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-weight: 600; font-size: 12.5px; background: #fff; cursor: pointer;">
          <option value="All" ${activeBillCategoryFilter === 'All' ? 'selected' : ''}>All Categories</option>
          ${categoryList.map(c => `<option value="${c}" ${activeBillCategoryFilter === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>

      <!-- Sort Dropdown -->
      <div>
        <select onchange="setBillSort(this.value)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-weight: 600; font-size: 12.5px; background: #fff; cursor: pointer;">
          <option value="dueDateAsc" ${activeBillSort === 'dueDateAsc' ? 'selected' : ''}>Due Date (Earliest)</option>
          <option value="dueDateDesc" ${activeBillSort === 'dueDateDesc' ? 'selected' : ''}>Due Date (Latest)</option>
          <option value="amtDesc" ${activeBillSort === 'amtDesc' ? 'selected' : ''}>Amount (High to Low)</option>
          <option value="amtAsc" ${activeBillSort === 'amtAsc' ? 'selected' : ''}>Amount (Low to High)</option>
          <option value="name" ${activeBillSort === 'name' ? 'selected' : ''}>Bill Name (A-Z)</option>
        </select>
      </div>
    </div>
  </div>

  <!-- Bills Cards Grid -->
  ${filteredBills.length > 0 ? `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px;">
      ${filteredBills.map(b => {
        const isPaid = b.status === "Paid";
        const isOverdue = !isPaid && (b.due < todayIso);
        const cardClass = isPaid ? "paid-card" : (isOverdue ? "overdue-card" : "unpaid-card");
        const statusBadge = isPaid ? '<span class="status-badge paid">✓ PAID</span>' : (isOverdue ? '<span class="status-badge overdue">⚠️ OVERDUE</span>' : '<span class="status-badge unpaid">⏳ UNPAID</span>');
        const catIcon = getBillCategoryIcon(b.category);
        const catStyle = getBillCategoryBg(b.category);

        return `
        <div class="bill-card ${cardClass}">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
              <div class="cat-icon-avatar" style="${catStyle}">${catIcon}</div>
              <div style="min-width: 0; flex: 1;">
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 3px;">
                  <span class="cat-pill">${escapeHtml(b.category || 'Utilities')}</span>
                  ${b.recurring ? `<span class="recurring-pill">🔁 ${b.recurringType || 'Monthly'}</span>` : ''}
                </div>
                <h3 class="bill-card-title" title="${escapeHtml(b.name)}">${escapeHtml(b.name)}</h3>
              </div>
            </div>
            <div style="flex-shrink: 0;">${statusBadge}</div>
          </div>

          <div class="bill-amount-block">
            <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px;">
              <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Amount Due</div>
              <div class="num bill-amount-value ${isPaid ? 'paid' : (isOverdue ? 'overdue' : 'unpaid')}">${fmt(b.amount)}</div>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #64748b;">
              <div>📅 Due Date:</div>
              <div style="font-weight: 700; color: #0f172a;">${b.due || b.dueDate || 'N/A'}</div>
            </div>

            ${isPaid ? `
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #059669; margin-top: 6px; padding-top: 6px; border-top: 1px dashed #a7f3d0;">
                <div>✓ Payment Date:</div>
                <div style="font-weight: 700;">${b.paidDate || 'Paid'}</div>
              </div>` : ''}

            ${isOverdue ? `
              <div style="font-size: 11.5px; color: #dc2626; font-weight: 700; margin-top: 6px; padding-top: 6px; border-top: 1px dashed #fecaca; display: flex; align-items: center; gap: 4px;">
                ⚠️ Overdue since ${b.due || b.dueDate}
              </div>` : ''}
          </div>

          ${b.notes ? `
            <div class="bill-notes-box">
              <span style="flex-shrink: 0;">📝</span>
              <span style="overflow: hidden; text-overflow: ellipsis; max-width: 100%; white-space: nowrap;">${escapeHtml(b.notes)}</span>
            </div>` : ''}

          <!-- PDF Attachment Button -->
          ${b.pdfData ? `
            <div class="bill-pdf-attachment">
              <div class="bill-pdf-info">
                <span class="bill-pdf-icon">📄</span>
                <span class="bill-pdf-name" title="${escapeHtml(b.pdfFileName || 'Bill_Invoice.pdf')}">${escapeHtml(b.pdfFileName || 'Bill_Invoice.pdf')}</span>
              </div>
              <div class="bill-pdf-actions">
                <button type="button" onclick="openBillPdfModal(${b.id})" class="pdf-pill-btn view">👁️ View</button>
                <a href="${b.pdfData}" download="${escapeHtml(b.pdfFileName || 'Bill_Invoice.pdf')}" class="pdf-pill-btn download">📥 Download</a>
              </div>
            </div>` : ''}

          <!-- Actions -->
          <div class="bill-card-actions">
            <div>
              ${isPaid ? `
                <button type="button" onclick="markBillAsUnpaid(${b.id})" class="bill-action-btn mark-unpaid">↺ Mark Unpaid</button>
              ` : `
                <button type="button" onclick="markBillAsPaid(${b.id})" class="bill-action-btn mark-paid">✓ Mark as Paid</button>
              `}
            </div>

            <div style="display: flex; align-items: center; gap: 6px;">
              <button type="button" onclick="openEditBillModal(${b.id})" class="bill-action-btn edit" title="Edit Bill">✏️ Edit</button>
              <button type="button" onclick="deleteBill(${b.id})" class="bill-action-btn delete" title="Delete Bill">🗑 Delete</button>
            </div>
          </div>
        </div>
        `;
      }).join('')}
    </div>
  ` : `
    <div class="card" style="padding: 48px 24px; text-align: center; color: var(--text-muted);">
      <div style="font-size: 48px; margin-bottom: 12px;">🧾</div>
      <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">No bills found for ${getMonthYearLabel(selectedBillMonthYear)}</h3>
      <p style="font-size: 13.5px; max-width: 420px; margin: 0 auto 20px;">There are no bill records matching your selected filters for this month.</p>
      <button type="button" onclick="openAddBillModal()" style="display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border: none; padding: 10px 20px; border-radius: 10px; font-size: 13.5px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
        <span>+ Add Bill</span>
      </button>
    </div>
  `}

  <!-- Active Subscriptions Table -->
  <div class="card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h2>Active Subscriptions</h2>
          <div class="sub">Recurring services & memberships</div>
        </div>
        <button class="action-btn pay-btn" onclick="openSubscriptionModal()" style="padding: 6px 14px; font-weight: 700; font-size: 12.5px;">
          + Add Subscription
        </button>
      </div>

      <div style="overflow-x: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>SERVICE</th>
              <th>CYCLE</th>
              <th>AMOUNT</th>
              <th>NEXT BILLING</th>
              <th>STATUS</th>
              <th style="text-align:right;">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            ${state.subscriptions.map(s => {
              const statusClass = (s.status || 'Active').toLowerCase();
              const isYearly = s.cycle === 'Yearly';
              const monthlyEquiv = isYearly ? s.amount / 12 : s.amount;
              return `
              <tr style="${s.status === 'Cancelled' ? 'opacity: 0.6; background: #fef2f2;' : s.status === 'Paused' ? 'background: #fffbeb;' : ''}">
                <td style="font-weight:700; color:#0f172a;">
                  <div>${escapeHtml(s.name)}</div>
                  <div style="font-size: 11px; font-weight: 400; color: #64748b;">${s.category || 'Service'} ${s.paymentMethod ? '• ' + s.paymentMethod : ''}</div>
                </td>
                <td>
                  <span class="cat-badge ${isYearly ? 'Health' : 'Entertainment'}">${s.cycle || 'Monthly'}</span>
                </td>
                <td class="num font-semibold">
                  <div>${fmt(s.amount)}</div>
                  ${isYearly ? `<div style="font-size: 10.5px; color: #64748b;">(${fmt(monthlyEquiv)}/mo equiv)</div>` : ''}
                </td>
                <td style="font-size: 12px; color: #475569;">${s.nextBilling || 'N/A'}</td>
                <td>
                  <span class="status-badge ${statusClass}">${s.status || 'Active'}</span>
                </td>
                <td style="text-align:right;">
                  <div class="action-btn-group" style="justify-content: flex-end;">
                    <button class="action-btn" onclick="openSubscriptionModal(${s.id})" title="Edit">✏️</button>
                    ${s.status !== 'Cancelled' ? `
                      <button class="action-btn warning-btn" onclick="togglePauseSubscription(${s.id})" title="${s.status === 'Paused' ? 'Resume' : 'Pause'}">
                        ${s.status === 'Paused' ? '▶ Resume' : '⏸ Pause'}
                      </button>
                      <button class="action-btn warning-btn" onclick="cancelSubscription(${s.id})" title="Cancel">🚫 Cancel</button>
                    ` : ''}
                    <button class="action-btn danger-btn" onclick="deleteSubscription(${s.id})" title="Delete">🗑</button>
                  </div>
                </td>
              </tr>
            `}).join('')}
            ${state.subscriptions.length === 0 ? `
              <tr>
                <td colspan="6" style="text-align:center; padding: 24px; color:var(--text-muted);">
                  No subscriptions logged yet. Click <strong>+ Add Subscription</strong> to track recurring services!
                </td>
              </tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

/* ===== 5. DOCUMENTS VIEW ===== */
function viewDocuments() {
  if (!state.documents) state.documents = [];

  // Query database enforcing authenticated user ID and selected category (Phase 2, 3, 5, 8)
  const filteredDocs = getUserDocuments(currentUser, activeDocCategory);
  const totalUploaded = filteredDocs.filter(d => d.fileData).length;

  return `
  <div class="stat-cards-row">
    <div class="soft-stat-block blue">
      <div class="ss-top"><span class="ss-label">${escapeHtml(activeDocCategory)}s</span><div class="ss-icon">📁</div></div>
      <div class="ss-value num">${filteredDocs.length}</div>
      <div class="ss-sub">${escapeHtml(activeDocCategory)} count</div>
    </div>
    <div class="soft-stat-block green">
      <div class="ss-top"><span class="ss-label">Status</span><div class="ss-icon">🛡️</div></div>
      <div class="ss-value num">Encrypted</div>
      <div class="ss-sub">Local vault storage</div>
    </div>
    <div class="soft-stat-block yellow">
      <div class="ss-top"><span class="ss-label">Uploaded Files</span><div class="ss-icon">📎</div></div>
      <div class="ss-value num">${totalUploaded}</div>
      <div class="ss-sub">Files attached</div>
    </div>
    <div class="soft-stat-block green">
      <div class="ss-top"><span class="ss-label">Vault Backup</span><div class="ss-icon">☁️</div></div>
      <div class="ss-value num">Ready</div>
      <div class="ss-sub">Local session synced</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
      <div>
        <h2>Document Vault & File Storage</h2>
        <div class="sub">Upload, manage, view, and delete personal documents</div>
      </div>

      <!-- Document Category Navigation Pills -->
      <div class="filter-pills">
        <button type="button" class="filter-pill ${activeDocCategory === 'Yours Document' ? 'active' : ''}" onclick="switchDocCategory('Yours Document')">
          Yours Document
        </button>
        <button type="button" class="filter-pill ${activeDocCategory === 'Others Document' ? 'active' : ''}" onclick="switchDocCategory('Others Document')">
          Others Document
        </button>
      </div>
    </div>

    <!-- Document List -->
    <div class="upcoming-list" id="docListContainer">
      ${filteredDocs.map(d => `
        <div class="upcoming-row" style="padding: 14px 16px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div class="ur-left" style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 220px;">
            <div class="ur-icon" style="background: #eef2ff; color: #4f46e5; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
              ${d.fileData && d.fileType && d.fileType.includes("image") ? '🖼️' : d.fileType && d.fileType.includes("pdf") ? '📄' : '📁'}
            </div>
            <div>
              <div class="ur-title" style="font-weight: 700; color: #0f172a; font-size: 14px;">${escapeHtml(d.name || d.documentTitle)}</div>
              <div class="ur-sub" style="font-size: 12px; color: var(--text-muted); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 2px;">
                <span>Type: <strong style="color: #0f172a; font-weight: 700;">${escapeHtml(d.documentType || d.type || 'Other Document')}</strong></span>
                <span style="background: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">${escapeHtml(d.category || 'Yours Document')}</span>
                ${d.fileName ? `• <span style="color: #6366f1; font-weight: 600;">📎 ${escapeHtml(d.fileName)}</span>` : ''}
              </div>
            </div>
          </div>

          <div class="ur-right" style="display: flex; flex-direction: row; align-items: center; justify-content: flex-end; gap: 12px; flex-wrap: wrap;">
            <div style="text-align: right; margin-right: 4px;">
              <div class="ur-amt num" style="font-size: 12.5px; font-weight: 700; color: #334155; white-space: nowrap;">Uploaded: ${escapeHtml(d.date || 'Today')}</div>
            </div>

            <div class="doc-btn-group" style="display: flex; flex-direction: row; align-items: center; gap: 8px; flex-wrap: nowrap;">
              <button type="button" onclick="previewDocument(${d.id})" class="pwd-card-btn" style="background: #eef2ff; color: #4f46e5; border: 1px solid #c7d2fe; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 12.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;" title="View Document Preview">
                👁️ View
              </button>

              ${d.fileData ? `
                <a href="${d.fileData}" download="${escapeHtml(d.fileName || d.name || d.documentTitle)}" class="pwd-card-btn" style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 12.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; text-decoration: none; white-space: nowrap;" title="Download File">
                  📥 Download
                </a>
              ` : ''}

              <button type="button" onclick="deleteDocument(${d.id})" class="pwd-btn-danger" style="background: #fef2f2; color: #dc2626; border: 1px solid #fee2e2; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 12.5px; cursor: pointer; white-space: nowrap;" title="Delete Document">
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      `).join("")}

      ${filteredDocs.length === 0 ? `
        <div style="padding: 35px 20px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 36px; margin-bottom: 8px;">📂</div>
          <div style="font-weight: 700; color: #1e293b; margin-bottom: 4px;">No ${escapeHtml(activeDocCategory.toLowerCase())}s saved in vault</div>
          <div style="font-size: 13px;">Upload and save documents under "${escapeHtml(activeDocCategory)}" using the form below.</div>
        </div>` : ''}
    </div>

    <!-- Upload & Save New Document Form (Phase 4) -->
    <div style="background: #f8fafc; border-top: 1px solid var(--border-color); padding: 16px; border-radius: 0 0 14px 14px; margin-top: 10px;">
      <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 10px;">➕ Upload & Save New Document</div>
      <div class="addrow" style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
        <input type="text" id="docNameInput" placeholder="Document Title (e.g. My Passport)" style="flex: 1; min-width: 180px; padding: 9px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 13px;">
        
        <select id="docTypeSelect" style="padding: 9px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 13px; background: #ffffff; color: var(--text-main); font-weight: 600; cursor: pointer; min-width: 190px;">
          <option value="" disabled selected>📄 Select Document Type</option>
          <optgroup label="Government / Identity">
            <option value="Aadhaar Card">Aadhaar Card</option>
            <option value="PAN Card">PAN Card</option>
            <option value="Voter ID">Voter ID</option>
            <option value="Passport">Passport</option>
            <option value="Driving License">Driving License</option>
            <option value="Government ID">Government ID</option>
            <option value="Birth Certificate">Birth Certificate</option>
          </optgroup>
          <optgroup label="Bank / Financial">
            <option value="Bank Card">Bank Card</option>
            <option value="Bank Document">Bank Document</option>
            <option value="Cheque">Cheque</option>
            <option value="Insurance Document">Insurance Document</option>
          </optgroup>
          <optgroup label="Education">
            <option value="Student ID">Student ID</option>
            <option value="College ID">College ID</option>
            <option value="School Certificate">School Certificate</option>
            <option value="Degree Certificate">Degree Certificate</option>
            <option value="Mark Sheet">Mark Sheet</option>
          </optgroup>
          <optgroup label="Work / Professional">
            <option value="Employee ID">Employee ID</option>
            <option value="Company ID">Company ID</option>
            <option value="Work Permit">Work Permit</option>
            <option value="Professional License">Professional License</option>
          </optgroup>
          <optgroup label="Other">
            <option value="Warranty Card">Warranty Card</option>
            <option value="Membership Card">Membership Card</option>
            <option value="Medical Document">Medical Document</option>
            <option value="Prescription">Prescription</option>
            <option value="Other Document">Other Document</option>
          </optgroup>
        </select>

        <select id="docCategoryInput" style="padding: 9px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 13px; background: #ffffff; color: var(--text-main); font-weight: 600; cursor: pointer;">
          <option value="Yours Document" ${activeDocCategory === 'Yours Document' ? 'selected' : ''}>Yours Document</option>
          <option value="Others Document" ${activeDocCategory === 'Others Document' ? 'selected' : ''}>Others Document</option>
        </select>

        <input type="file" id="docFileInput" accept="image/*,.pdf,.doc,.docx,.txt" style="display: none;">
        <button type="button" id="docUploadTriggerBtn" style="background: #ffffff; border: 1px solid var(--border-color); padding: 9px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 600; cursor: pointer; color: #334155; display: flex; align-items: center; gap: 6px;">
          📎 <span id="docFileLabel">Choose File...</span>
        </button>

        <button id="docAddBtn" style="background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(79,70,229,0.2);">
          💾 Save Document
        </button>
      </div>
    </div>
  </div>`;
}

function previewDocument(id) {
  if (!currentUser) return;
  const doc = (state.documents || []).find(d => d.id === id && (d.userId || currentUser) === currentUser);
  if (!doc) {
    showToast("Unauthorized or document not found.");
    return;
  }

  const modal = document.getElementById("docPreviewModal");
  const modalTitle = document.getElementById("docModalTitle");
  const modalSub = document.getElementById("docModalSub");
  const modalBody = document.getElementById("docModalBody");
  const dlBtn = document.getElementById("docModalDownloadBtn");

  if (!modal) return;

  if (modalTitle) modalTitle.textContent = doc.name || doc.documentTitle;
  if (modalSub) modalSub.textContent = `Category: ${doc.category || 'Yours Document'} • Type: ${doc.documentType || doc.type || 'Other Document'} • Uploaded: ${doc.date || 'Today'} ${doc.fileName ? '• 📎 ' + doc.fileName : ''}`;

  if (dlBtn) {
    if (doc.fileData) {
      dlBtn.href = doc.fileData;
      dlBtn.download = doc.fileName || doc.name || doc.documentTitle;
      dlBtn.style.display = "inline-flex";
    } else {
      dlBtn.style.display = "none";
    }
  }

  if (doc.fileData) {
    const isImg = doc.fileType && doc.fileType.includes("image");
    if (isImg) {
      modalBody.innerHTML = `<img src="${doc.fileData}" alt="${escapeHtml(doc.name || doc.documentTitle)}" style="max-width: 100%; max-height: 65vh; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); object-fit: contain;">`;
    } else {
      modalBody.innerHTML = `<iframe src="${doc.fileData}" style="width: 100%; height: 65vh; border: none; border-radius: 8px; background: #fff;"></iframe>`;
    }
  } else {
    modalBody.innerHTML = `
      <div style="background: #fff; padding: 40px; border-radius: 12px; text-align: center; max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="font-size: 48px; margin-bottom: 12px;">📁</div>
        <h4 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">${escapeHtml(doc.name || doc.documentTitle)}</h4>
        <p style="font-size: 13px; color: #64748b;">No physical file was attached to this document record.</p>
      </div>`;
  }

  modal.style.display = "flex";
}

function closeDocModal() {
  const modal = document.getElementById("docPreviewModal");
  if (modal) modal.style.display = "none";
}

function deleteDocument(id) {
  if (!currentUser) return;
  const docIndex = (state.documents || []).findIndex(d => d.id === id && (d.userId || currentUser) === currentUser);
  if (docIndex === -1) {
    showToast("Unauthorized or document not found.");
    return;
  }
  state.documents.splice(docIndex, 1);
  saveSessionData();
  renderMain();
  showToast("Document deleted from vault");
}

/* ===== 6. APPOINTMENTS VIEW ===== */
function viewAppointments() {
  if (!state.appointments) state.appointments = [];

  const filteredAppts = getUserAppointments(currentUser, activeApptCategory);

  return `
  <div class="stat-cards-row">
    <div class="soft-stat-block blue">
      <div class="ss-top"><span class="ss-label">${escapeHtml(activeApptCategory)} Scheduled</span><div class="ss-icon">📅</div></div>
      <div class="ss-value num">${filteredAppts.length}</div>
      <div class="ss-sub">${escapeHtml(activeApptCategory)} appointments</div>
    </div>
    <div class="soft-stat-block green">
      <div class="ss-top"><span class="ss-label">Alerts</span><div class="ss-icon">🔔</div></div>
      <div class="ss-value num">Active</div>
      <div class="ss-sub">Notifications enabled</div>
    </div>
    <div class="soft-stat-block yellow">
      <div class="ss-top"><span class="ss-label">Calendar</span><div class="ss-icon">🔄</div></div>
      <div class="ss-value num">Synced</div>
      <div class="ss-sub">Schedule ready</div>
    </div>
    <div class="soft-stat-block green">
      <div class="ss-top"><span class="ss-label">Visits</span><div class="ss-icon">🏥</div></div>
      <div class="ss-value num">${filteredAppts.length}</div>
      <div class="ss-sub">Upcoming events</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
      <div>
        <h2>Appointments & Schedule</h2>
        <div class="sub">Manage personal and business schedule</div>
      </div>

      <!-- Appointment Category Selector Toggle -->
      <div class="appt-category-toggle">
        <button type="button" class="appt-category-pill ${activeApptCategory === 'Personal' ? 'active' : ''}" onclick="switchApptCategory('Personal')">
          ${activeApptCategory === 'Personal' ? '✓ ' : ''}Personal
        </button>
        <button type="button" class="appt-category-pill ${activeApptCategory === 'Business' ? 'active' : ''}" onclick="switchApptCategory('Business')">
          ${activeApptCategory === 'Business' ? '✓ ' : ''}Business
        </button>
      </div>
    </div>

    <div class="upcoming-list">
      ${filteredAppts.map(a => `
        <div class="upcoming-row" style="padding: 14px 16px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div class="ur-left" style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 220px;">
            <div class="ur-icon" style="background: #eef2ff; color: #4f46e5; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
              📅
            </div>
            <div>
              <div class="ur-title" style="font-weight: 700; color: #0f172a; font-size: 14px;">${escapeHtml(a.title)}</div>
              <div class="ur-sub" style="font-size: 12px; color: var(--text-muted); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 2px;">
                <span>📅 ${escapeHtml(a.date)} at ${escapeHtml(a.time)}</span>
                <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; color: #475569;">${escapeHtml(a.category || 'Personal')}</span>
              </div>
            </div>
          </div>

          <div class="ur-right" style="display: flex; flex-direction: row; align-items: center; gap: 8px;">
            <span class="status-badge upcoming">${escapeHtml(a.category || 'Personal')}</span>
            <button type="button" onclick="openEditApptModal(${a.id})" class="pwd-btn" style="background: #ffffff; color: #475569; border: 1px solid var(--border-color); padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 12.5px; cursor: pointer;" title="Edit Appointment">
              ✏️ Edit
            </button>
            <button type="button" onclick="deleteAppointment(${a.id})" class="pwd-btn-danger" style="background: #fef2f2; color: #dc2626; border: 1px solid #fee2e2; padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 12.5px; cursor: pointer;" title="Delete Appointment">
              🗑️ Delete
            </button>
          </div>
        </div>
      `).join("")}

      ${filteredAppts.length === 0 ? `
        <div style="padding: 35px 20px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 36px; margin-bottom: 8px;">📅</div>
          <div style="font-weight: 700; color: #1e293b; margin-bottom: 4px;">No ${escapeHtml(activeApptCategory.toLowerCase())} appointments scheduled yet</div>
          <div style="font-size: 13px;">Add your ${escapeHtml(activeApptCategory.toLowerCase())} events, meetings, or reminders using the form below.</div>
        </div>` : ''}
    </div>

    <!-- Add New Appointment Form -->
    <div style="background: #f8fafc; border-top: 1px solid var(--border-color); padding: 16px; border-radius: 0 0 14px 14px; margin-top: 10px;">
      <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 10px;">➕ Add New Appointment</div>
      <div class="addrow" style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
        <input type="text" id="apptTitleInput" placeholder="Appointment Title (e.g. Doctor Visit)" style="flex: 1; min-width: 180px; padding: 9px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 13px;">
        <input type="date" id="apptDateInput" aria-label="Appointment Date" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: #fff; font-size: 13px; font-weight: 600; cursor: pointer; color: #0f172a;">
        <input type="text" id="apptTimeInput" placeholder="Time (e.g. 11:00 AM)" style="width: 130px; padding: 9px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 13px;">
        
        <select id="apptCategoryInput" style="padding: 9px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 13px; background: #ffffff; color: var(--text-main); font-weight: 600; cursor: pointer;">
          <option value="Personal" ${activeApptCategory === 'Personal' ? 'selected' : ''}>Personal</option>
          <option value="Business" ${activeApptCategory === 'Business' ? 'selected' : ''}>Business</option>
        </select>

        <button id="apptAddBtn" style="background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(79,70,229,0.2);">
          💾 Save Appointment
        </button>
      </div>
    </div>
  </div>`;
}

/* ===== 7. UNIFIED DATE-BASED GOALS SYSTEM ===== */
function getGoalStatus(g) {
  if (g.completed || (g.current >= g.target && g.target > 0)) {
    return {
      label: "Completed",
      class: "status-badge",
      badgeHtml: `<span class="status-badge" style="background:#dcfce7; color:#15803d; padding:3px 10px; border-radius:12px; font-weight:700;">✓ Completed 🎉</span>`
    };
  }
  
  const todayStr = new Date().toISOString().split("T")[0];
  const startDate = g.startDate || "";
  const deadlineDate = g.deadlineDate || "";

  if (deadlineDate && todayStr > deadlineDate) {
    return {
      label: "Overdue",
      class: "status-badge",
      badgeHtml: `<span class="status-badge" style="background:#fee2e2; color:#dc2626; padding:3px 10px; border-radius:12px; font-weight:700;">⚠️ Overdue</span>`
    };
  }

  if (startDate && todayStr < startDate) {
    return {
      label: "Upcoming",
      class: "status-badge",
      badgeHtml: `<span class="status-badge" style="background:#f1f5f9; color:#475569; padding:3px 10px; border-radius:12px; font-weight:700;">📅 Upcoming</span>`
    };
  }

  return {
    label: "In Progress",
    class: "status-badge upcoming",
    badgeHtml: `<span class="status-badge upcoming">⚡ In Progress</span>`
  };
}

function formatGoalDateDisplay(dateStr) {
  if (!dateStr) return "N/A";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    }
  }
  return dateStr;
}

function finishGoal(id) {
  const goal = (state.goals || []).find(g => g.id === id);
  if (goal) {
    goal.completed = true;
    goal.current = goal.target;
    saveSessionData();
    renderMain();
    showToast(`Goal "${goal.name}" marked as finished! 🎉`);
  }
}

function deleteGoal(id) {
  state.goals = (state.goals || []).filter(g => g.id !== id);
  saveSessionData();
  renderMain();
  showToast("Goal deleted");
}

function addGoalFunds(id) {
  const goal = (state.goals || []).find(g => g.id === id);
  if (!goal) return;
  const input = prompt(`Add funds/progress to "${goal.name}" (Target: ${fmt(goal.target)}):`, "1000");
  if (input === null) return;
  const amt = parseFloat(input);
  if (isNaN(amt) || amt <= 0) {
    showToast("Please enter a valid amount");
    return;
  }
  goal.current = (goal.current || 0) + amt;
  if (goal.current >= goal.target) {
    goal.completed = true;
    goal.current = goal.target;
    showToast(`🎉 Congratulations! Goal "${goal.name}" achieved!`);
  } else {
    showToast(`Added ${fmt(amt)} to "${goal.name}"`);
  }
  saveSessionData();
  renderMain();
}

function openEditGoalModal(id) {
  const goal = (state.goals || []).find(g => g.id === id);
  if (!goal) return;
  const todayStr = new Date().toISOString().split("T")[0];
  document.getElementById("editGoalId").value = goal.id;
  document.getElementById("editGoalTitle").value = goal.name || "";
  document.getElementById("editGoalDetails").value = goal.details || "";
  document.getElementById("editGoalTarget").value = goal.target || 0;
  document.getElementById("editGoalStartDate").value = goal.startDate || todayStr;
  document.getElementById("editGoalDeadlineDate").value = goal.deadlineDate || todayStr;
  document.getElementById("editGoalModal").style.display = "flex";
}

function closeEditGoalModal() {
  const modal = document.getElementById("editGoalModal");
  if (modal) modal.style.display = "none";
}

function saveEditGoal(e) {
  if (e) e.preventDefault();
  const id = parseFloat(document.getElementById("editGoalId").value);
  const name = document.getElementById("editGoalTitle").value.trim();
  const details = document.getElementById("editGoalDetails").value.trim();
  const target = parseFloat(document.getElementById("editGoalTarget").value);
  const startDate = document.getElementById("editGoalStartDate").value;
  const deadlineDate = document.getElementById("editGoalDeadlineDate").value;

  if (!name || isNaN(target) || target <= 0 || !startDate || !deadlineDate) {
    showToast("Please provide valid goal title, target amount, and dates");
    return;
  }

  const goal = (state.goals || []).find(g => g.id === id);
  if (goal) {
    goal.name = name;
    goal.details = details;
    goal.target = target;
    goal.startDate = startDate;
    goal.deadlineDate = deadlineDate;
    if (goal.current >= goal.target) {
      goal.completed = true;
    }
    saveSessionData();
    closeEditGoalModal();
    renderMain();
    showToast(`Goal "${name}" updated successfully`);
  }
}

function viewGoals() {
  if (!state.goals) state.goals = [];

  const totalGoals = state.goals.length;
  const activeGoals = state.goals.filter(g => {
    const st = getGoalStatus(g).label;
    return st === "In Progress" || st === "Upcoming";
  }).length;
  const totalSaved = state.goals.reduce((s, g) => s + (g.completed ? g.target : (g.current || 0)), 0);
  const combinedTarget = state.goals.reduce((s, g) => s + (g.target || 0), 0);

  const todayStr = new Date().toISOString().split("T")[0];

  return `
  <!-- Stat Cards -->
  <div class="stat-cards-row">
    <div class="soft-stat-block blue">
      <div class="ss-top"><span class="ss-label">TOTAL GOALS</span><div class="ss-icon">🎯</div></div>
      <div class="ss-value num">${totalGoals}</div>
      <div class="ss-sub">All created goals</div>
    </div>
    <div class="soft-stat-block yellow">
      <div class="ss-top"><span class="ss-label">ACTIVE GOALS</span><div class="ss-icon">⚡</div></div>
      <div class="ss-value num">${activeGoals}</div>
      <div class="ss-sub">In progress or upcoming</div>
    </div>
    <div class="soft-stat-block green">
      <div class="ss-top"><span class="ss-label">TOTAL SAVED</span><div class="ss-icon">🏦</div></div>
      <div class="ss-value num">${fmt(totalSaved)}</div>
      <div class="ss-sub">${combinedTarget > 0 ? Math.round((totalSaved / combinedTarget) * 100) + '% achieved' : '0%'}</div>
    </div>
    <div class="soft-stat-block green">
      <div class="ss-top"><span class="ss-label">COMBINED TARGET</span><div class="ss-icon">💰</div></div>
      <div class="ss-value num">${fmt(combinedTarget)}</div>
      <div class="ss-sub">Total savings target</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 18px;">
      <div>
        <h2>Financial Goals & Milestones</h2>
        <div class="sub">Track and achieve your personal financial targets</div>
      </div>
    </div>

    <div class="goals-list">
      ${state.goals.map(g => {
        const stInfo = getGoalStatus(g);
        const isFinished = stInfo.label === "Completed";
        const pct = isFinished ? 100 : Math.min(100, Math.round(((g.current || 0) / (g.target || 1)) * 100));
        const color = g.color || CHART_COLORS[0];
        
        return `
          <div class="goal-item" style="padding:16px; margin-bottom:14px; border:1px solid var(--border-color); border-radius:12px; background:${isFinished ? '#f0fdf4' : '#ffffff'};">
            <div class="goal-top" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:8px;">
              <div>
                <span style="font-weight:700; font-size:16px; color:#0f172a;">${escapeHtml(g.name)}</span>
                ${stInfo.badgeHtml}
              </div>
              <span class="goal-pct" style="color:${isFinished ? '#16a34a' : color}; font-weight:800; font-size:15px;">${pct}%</span>
            </div>

            ${g.details ? `
              <div style="font-size:13px; color:#475569; margin-bottom:8px; line-height:1.4;">
                ${escapeHtml(g.details)}
              </div>` : ''}

            <div class="goal-dates" style="font-size:12.5px; color:var(--text-muted); margin-bottom:10px; display:flex; gap:20px; flex-wrap:wrap;">
              <span>📅 Start Date: <b style="color:#334155;">${formatGoalDateDisplay(g.startDate)}</b></span>
              <span>🏁 Deadline: <b style="color:#334155;">${formatGoalDateDisplay(g.deadlineDate)}</b></span>
            </div>

            <div class="bb-track" style="height:10px; margin:8px 0; background:#e2e8f0; border-radius:5px; overflow:hidden;">
              <div class="bb-fill" style="width:${pct}%; background:${isFinished ? '#16a34a' : color}; height:100%; border-radius:5px; transition:width 0.3s ease;"></div>
            </div>

            <div class="goal-nums" style="display:flex; justify-content:space-between; font-size:13px; margin-top:10px; align-items:center; flex-wrap:wrap; gap:10px;">
              <span>Saved: <b class="num" style="color:#0f172a; font-weight:700;">${fmt(isFinished ? g.target : g.current)}</b> of <b class="num" style="color:#0f172a; font-weight:700;">${fmt(g.target)}</b></span>
              
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${!isFinished ? `
                  <button onclick="addGoalFunds(${g.id})" style="background:#eef2ff; color:#4f46e5; border:1px solid #c7d2fe; padding:6px 12px; border-radius:8px; font-size:12.5px; font-weight:700; cursor:pointer;" title="Add Progress">
                    💵 Add Funds
                  </button>
                  <button onclick="finishGoal(${g.id})" style="background:#10b981; color:#ffffff; border:none; padding:6px 12px; border-radius:8px; font-size:12.5px; font-weight:700; cursor:pointer; box-shadow: 0 2px 6px rgba(16,185,129,0.2);">
                    ✓ Mark as Finished
                  </button>` : `<span style="font-size:12.5px; font-weight:700; color:#16a34a; align-self:center;">Finished 🎉</span>`}
                <button onclick="openEditGoalModal(${g.id})" style="background:#ffffff; color:#475569; border:1px solid var(--border-color); padding:6px 12px; border-radius:8px; font-weight:700; font-size:12.5px; cursor:pointer;" title="Edit Goal">
                  ✏️ Edit
                </button>
                <button onclick="deleteGoal(${g.id})" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca; padding:6px 14px; border-radius:8px; font-weight:700; font-size:12.5px; cursor:pointer;" title="Delete Goal">
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>`;
      }).join("")}

      ${state.goals.length === 0 ? `
        <div style="padding: 35px 20px; text-align:center; color:var(--text-muted);">
          <div style="font-size: 36px; margin-bottom: 8px;">🎯</div>
          <div style="font-weight: 700; color: #1e293b; margin-bottom: 4px;">No financial goals set yet</div>
          <div style="font-size: 13px;">Create your first goal with custom dates and target amounts using the form below!</div>
        </div>` : ''}
    </div>

    <!-- Manual Goal Add Form -->
    <div style="margin-top:20px; background:#f8fafc; padding:18px 20px; border-radius:14px; border:1px solid var(--border-color);">
      <div style="font-size:13.5px; font-weight:700; color:#0f172a; margin-bottom:12px;">
        ➕ Add New Goal
      </div>

      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <input type="text" id="goalNameInput" placeholder="Goal Title (e.g. Save for New Laptop)" style="flex:2; min-width:200px; padding:9px 12px; border-radius:8px; border:1px solid var(--border-color); background:#fff; font-size:13px;">
          <input type="number" id="goalTargetInput" placeholder="Target Amount (₹)" style="flex:1; min-width:140px; padding:9px 12px; border-radius:8px; border:1px solid var(--border-color); background:#fff; font-size:13px;">
        </div>
        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <input type="text" id="goalDetailsInput" placeholder="Goal Details / Description (e.g. Save money for purchasing a new laptop)" style="flex:3; min-width:240px; padding:9px 12px; border-radius:8px; border:1px solid var(--border-color); background:#fff; font-size:13px;">
          <div style="display:flex; gap:6px; align-items:center;">
            <label for="goalStartDateInput" style="font-size:12.5px; font-weight:700; color:var(--text-muted);">Start Date:</label>
            <input type="date" id="goalStartDateInput" aria-label="Start Date" value="${todayStr}" style="padding:8px 12px; border-radius:8px; border:1px solid var(--border-color); background:#fff; font-size:13px; font-weight:600; cursor:pointer;">
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <label for="goalDeadlineDateInput" style="font-size:12.5px; font-weight:700; color:var(--text-muted);">Deadline:</label>
            <input type="date" id="goalDeadlineDateInput" aria-label="Deadline" value="${todayStr}" style="padding:8px 12px; border-radius:8px; border:1px solid var(--border-color); background:#fff; font-size:13px; font-weight:600; cursor:pointer;">
          </div>
          <button id="goalAddBtn" style="padding:10px 20px; background:linear-gradient(135deg, #6366f1, #4f46e5); color:#ffffff; border:none; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; box-shadow: 0 4px 12px rgba(79,70,229,0.2); white-space:nowrap;">
            Add Goal
          </button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ==========================================================================
   EVENT HANDLERS
   ========================================================================== */

function deleteExpense(id) {
  const exp = state.expenses.find(e => e.id === id);
  if (exp && exp.source === "bill") {
    const billId = exp.sourceId || exp.id;
    state.bills = state.bills.filter(b => b.id !== billId);
  }
  state.expenses = state.expenses.filter(e => e.id !== id);
  saveSessionData();
  renderMain();
}

function attachHandlers() {
  const $ = id => document.getElementById(id);

  // CSV Export
  if ($("exportCsvBtn")) {
    $("exportCsvBtn").addEventListener("click", () => {
      let csv = "Date,Description,Category,Type,Amount\n";
      const mExp = getFinanceExpensesForMonth(selectedFinanceMonthYear);
      const mInc = getFinanceIncomeForMonth(selectedFinanceMonthYear);
      mExp.forEach(e => csv += `"${e.date}","${e.desc}","${e.category}","Expense",-${e.amount}\n`);
      mInc.forEach(i => csv += `"${i.date}","${i.source}","Salary","Income",${i.amount}\n`);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LifeLedger_Transactions_${selectedFinanceMonthYear || 'All'}.csv`;
      a.click();
    });
  }

  // Task check toggle
  document.querySelectorAll(".taskCheck").forEach(cb => {
    cb.addEventListener("change", e => {
      const id = +e.target.dataset.id;
      const task = state.tasks.find(t => t.id === id);
      if (task) task.done = e.target.checked;
      renderMain();
    });
  });

  // Task Add
  if ($("taskAddBtn")) {
    $("taskAddBtn").addEventListener("click", () => {
      const title = $("taskTitleInput").value.trim();
      if (!title) return;
      state.tasks.unshift({
        id: Date.now(),
        title,
        priority: $("taskPrioritySelect").value,
        deadline: $("taskDeadlineInput").value || "Soon",
        done: false
      });
      renderMain();
    });
  }

  // Add Bill Form submit
  if ($("addBillForm")) {
    $("addBillForm").onsubmit = e => {
      saveAddBill(e);
    };
  }

  // Edit Bill Form submit
  if ($("editBillForm")) {
    $("editBillForm").onsubmit = e => {
      saveEditBill(e);
    };
  }

  // User Profile Form submit
  if ($("userProfileForm")) {
    $("userProfileForm").onsubmit = e => {
      e.preventDefault();
      if (!currentUser || !usersDB[currentUser]) return;
      const newName = $("editProfileName") ? $("editProfileName").value.trim() : "";
      if (!newName) {
        showToast("Please enter a display name");
        return;
      }
      const newPhone = $("editProfilePhone") ? $("editProfilePhone").value.trim() : "";
      const newBio = $("editProfileBio") ? $("editProfileBio").value.trim() : "";

      usersDB[currentUser].name = newName;
      usersDB[currentUser].phone = newPhone;
      usersDB[currentUser].bio = newBio;

      const initial = newName.split(" ").map(n => n[0]).join("").toUpperCase() || "U";
      if ($("profileAvatar")) $("profileAvatar").textContent = initial;

      saveSessionData();
      closeUserProfileModal();
      showToast("Profile details updated successfully!");
    };
  }

  // Edit Bill Form submit
  if ($("editBillForm")) {
    $("editBillForm").addEventListener("submit", saveEditBill);
  }

  // Subscription Form submit
  if ($("subscriptionForm")) {
    $("subscriptionForm").addEventListener("submit", saveSubscription);
  }

  // Doc Upload & Add Handlers
  let selectedDocFile = null;

  if ($("docUploadTriggerBtn") && $("docFileInput")) {
    $("docUploadTriggerBtn").addEventListener("click", () => {
      $("docFileInput").click();
    });

    $("docFileInput").addEventListener("change", e => {
      const file = e.target.files[0];
      if (file) {
        selectedDocFile = file;
        if ($("docFileLabel")) $("docFileLabel").textContent = file.name;
      }
    });
  }

  if ($("docAddBtn")) {
    $("docAddBtn").addEventListener("click", () => {
      const name = $("docNameInput") ? $("docNameInput").value.trim() : "";
      if (!name) {
        showToast("Please enter a document title");
        return;
      }
      const typeEl = $("docTypeSelect") || $("docTypeInput");
      const docType = typeEl ? typeEl.value.trim() : "";
      if (!docType) {
        showToast("Please select a document type");
        return;
      }
      const category = $("docCategoryInput") ? $("docCategoryInput").value : activeDocCategory;

      const newDoc = {
        id: Date.now(),
        name: name,
        documentTitle: name,
        type: docType,
        documentType: docType,
        category: category,
        userId: currentUser,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        verified: true,
        fileName: selectedDocFile ? selectedDocFile.name : "",
        fileType: selectedDocFile ? selectedDocFile.type : "",
        fileData: ""
      };

      if (!state.documents) state.documents = [];

      const saveDocAndFinish = () => {
        state.documents.unshift(newDoc);
        saveSessionData();
        activeDocCategory = category; // Dynamically switch to active category view
        renderMain();
        showToast(`Document "${name}" (${docType}) saved under ${category}!`);
        selectedDocFile = null;
        if ($("docNameInput")) $("docNameInput").value = "";
        if ($("docTypeSelect")) $("docTypeSelect").value = "";
        if ($("docTypeInput")) $("docTypeInput").value = "";
        if ($("docFileInput")) $("docFileInput").value = "";
        if ($("docFileLabel")) $("docFileLabel").textContent = "Choose File...";
      };

      if (selectedDocFile) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          newDoc.fileData = evt.target.result;
          saveDocAndFinish();
        };
        reader.readAsDataURL(selectedDocFile);
      } else {
        saveDocAndFinish();
      }
    });
  }

  // Appt Add Handler
  if ($("apptAddBtn")) {
    $("apptAddBtn").addEventListener("click", () => {
      const title = $("apptTitleInput").value.trim();
      const dateVal = $("apptDateInput") ? $("apptDateInput").value : "";
      if (!title) {
        showToast("Please enter an appointment title");
        return;
      }
      if (!dateVal) {
        showToast("Please select an appointment date");
        return;
      }
      const time = $("apptTimeInput").value.trim() || "10:00 AM";
      const category = $("apptCategoryInput") ? $("apptCategoryInput").value : activeApptCategory;

      const newAppt = {
        id: Date.now(),
        title: title,
        date: dateVal,
        time: time,
        category: category,
        userId: currentUser
      };

      if (!state.appointments) state.appointments = [];
      state.appointments.unshift(newAppt);
      saveSessionData();
      activeApptCategory = category;
      renderMain();
      showToast(`Appointment "${title}" saved for ${dateVal}!`);

      if ($("apptTitleInput")) $("apptTitleInput").value = "";
      if ($("apptDateInput")) $("apptDateInput").value = "";
      if ($("apptTimeInput")) $("apptTimeInput").value = "";
    });
  }

  // Edit Appt Form Handler
  if ($("editApptForm")) {
    $("editApptForm").addEventListener("submit", saveEditAppt);
  }

  // Edit Goal Form Handler
  if ($("editGoalForm")) {
    $("editGoalForm").addEventListener("submit", saveEditGoal);
  }

  // Goal Add Handler
  if ($("goalAddBtn")) {
    $("goalAddBtn").addEventListener("click", () => {
      const name = $("goalNameInput") ? $("goalNameInput").value.trim() : "";
      const details = $("goalDetailsInput") ? $("goalDetailsInput").value.trim() : "";
      const target = $("goalTargetInput") ? parseFloat($("goalTargetInput").value) : 0;
      const startDate = ($("goalStartDateInput") && $("goalStartDateInput").value) ? $("goalStartDateInput").value : new Date().toISOString().split("T")[0];
      const deadlineDate = ($("goalDeadlineDateInput") && $("goalDeadlineDateInput").value) ? $("goalDeadlineDateInput").value : startDate;

      if (!name || isNaN(target) || target <= 0) {
        showToast("Please enter a valid goal title and target amount");
        return;
      }

      if (!state.goals) state.goals = [];

      state.goals.unshift({
        id: Date.now(),
        userId: currentUser,
        name: name,
        details: details,
        target: target,
        current: 0,
        startDate: startDate,
        deadlineDate: deadlineDate,
        createdDate: new Date().toISOString().split("T")[0],
        completed: false,
        color: CHART_COLORS[state.goals.length % CHART_COLORS.length]
      });
      saveSessionData();
      renderMain();
      showToast(`Goal "${name}" added successfully!`);
    });
  }

  // Transactions Filter Pills
  document.querySelectorAll(".filter-pill[data-filter]").forEach(pill => {
    pill.addEventListener("click", e => {
      document.querySelectorAll(".filter-pill[data-filter]").forEach(p => p.classList.remove("active"));
      e.target.classList.add("active");
      const filter = e.target.dataset.filter;
      const tbody = $("txTableBody");
      if (!tbody) return;

      let expList = getFinanceExpensesForMonth(selectedFinanceMonthYear);
      let incList = getFinanceIncomeForMonth(selectedFinanceMonthYear);

      if (filter === "income") expList = [];
      if (filter === "expense") incList = [];

      tbody.innerHTML = `
        ${expList.map(e => `
          <tr>
            <td class="num">${e.date}</td>
            <td style="font-weight:600; color:#0f172a;">${e.desc}</td>
            <td><span class="cat-badge ${e.category.split(' ')[0]}">${e.category}</span></td>
            <td><span class="type-pill expense">Expense</span></td>
            <td style="text-align:right;" class="amt-neg">-${fmt(e.amount)}</td>
            <td style="text-align:center;"><button style="background:none; border:none; color:var(--red-main); cursor:pointer; font-weight:600;" onclick="deleteExpense('${e.id}')">Delete</button></td>
          </tr>
        `).join("")}
        ${incList.map(i => `
          <tr>
            <td class="num">${i.date}</td>
            <td style="font-weight:600; color:#0f172a;">${i.source}</td>
            <td><span class="cat-badge Salary">Salary</span></td>
            <td><span class="type-pill income">Income</span></td>
            <td style="text-align:right;" class="amt-pos">+${fmt(i.amount)}</td>
            <td style="text-align:center;">—</td>
          </tr>
        `).join("")}
      `;
    });
  });

  // Table Search Filter
  if ($("txSearchInput")) {
    $("txSearchInput").addEventListener("input", e => {
      const q = e.target.value.toLowerCase();
      const tbody = $("txTableBody");
      if (!tbody) return;

      const mExp = getFinanceExpensesForMonth(selectedFinanceMonthYear);
      const mInc = getFinanceIncomeForMonth(selectedFinanceMonthYear);

      const expList = mExp.filter(x => x.desc.toLowerCase().includes(q) || x.category.toLowerCase().includes(q));
      const incList = mInc.filter(x => x.source.toLowerCase().includes(q));

      tbody.innerHTML = `
        ${expList.map(e => `
          <tr>
            <td class="num">${e.date}</td>
            <td style="font-weight:600; color:#0f172a;">${e.desc}</td>
            <td><span class="cat-badge ${e.category.split(' ')[0]}">${e.category}</span></td>
            <td><span class="type-pill expense">Expense</span></td>
            <td style="text-align:right;" class="amt-neg">-${fmt(e.amount)}</td>
            <td style="text-align:center;"><button style="background:none; border:none; color:var(--red-main); cursor:pointer; font-weight:600;" onclick="deleteExpense('${e.id}')">Delete</button></td>
          </tr>
        `).join("")}
        ${incList.map(i => `
          <tr>
            <td class="num">${i.date}</td>
            <td style="font-weight:600; color:#0f172a;">${i.source}</td>
            <td><span class="cat-badge Salary">Salary</span></td>
            <td><span class="type-pill income">Income</span></td>
            <td style="text-align:right;" class="amt-pos">+${fmt(i.amount)}</td>
            <td style="text-align:center;">—</td>
          </tr>
        `).join("")}
      `;
    });
  }
  // Password Vault Handlers
  const selectEl = $("pwdPlatformSelect");
  const manualInput = $("pwdManualPlatformInput");

  function setCustomInputMode(isCustom) {
    if (!selectEl || !manualInput) return;
    if (isCustom) {
      selectEl.style.display = "none";
      manualInput.style.display = "block";
      manualInput.focus();
      if ($("pwdFormTitle")) $("pwdFormTitle").textContent = "Add New Custom Platform Password";
    } else {
      selectEl.style.display = "block";
      manualInput.style.display = "none";
      const plat = selectEl.value;
      if ($("pwdFormTitle") && PRESET_PLATFORMS[plat]) {
        $("pwdFormTitle").textContent = `Add New ${PRESET_PLATFORMS[plat].name} Password`;
      }
    }
  }

  if (selectEl) {
    selectEl.addEventListener("change", e => {
      setCustomInputMode(e.target.value === "custom");
    });
  }

  if ($("pwdAddForm")) {
    $("pwdAddForm").addEventListener("submit", e => {
      e.preventDefault();
      const isCustomMode = selectEl && (selectEl.value === "custom" || manualInput.style.display !== "none");
      const platformKey = isCustomMode ? "custom" : (selectEl ? selectEl.value : "custom");
      const customName = isCustomMode ? manualInput.value.trim() : (PRESET_PLATFORMS[platformKey] ? PRESET_PLATFORMS[platformKey].name : "");
      const username = $("pwdUsernameInput").value.trim();
      const password = $("pwdPasswordInput").value;

      if (!username || !password) return;

      if (!state.passwords) state.passwords = [];

      state.passwords.unshift({
        id: Date.now(),
        platform: platformKey,
        customName: customName || "Custom Account",
        username,
        password,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      });

      saveSessionData();
      renderMain();
      const pName = customName || (PRESET_PLATFORMS[platformKey] ? PRESET_PLATFORMS[platformKey].name : "Account");
      showToast(`${pName} password saved securely!`);
    });
  }

  // Preset Chips Quick Select
  document.querySelectorAll(".pwd-preset-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const plat = chip.dataset.platform;
      if (selectEl) selectEl.value = plat;
      if (plat === "custom") {
        setCustomInputMode(true);
      } else {
        setCustomInputMode(false);
        if ($("pwdUsernameInput")) $("pwdUsernameInput").focus();
      }
    });
  });

  // Password Generator Button
  if ($("pwdGenBtn")) {
    $("pwdGenBtn").addEventListener("click", () => {
      const newPwd = generateSecurePassword(16);
      const pwdInput = $("pwdPasswordInput");
      if (pwdInput) {
        pwdInput.value = newPwd;
        pwdInput.type = "text";
        showToast("Generated 16-character secure password!");
      }
    });
  }

  // Password Form Toggle Visibility Button
  if ($("pwdFormToggleBtn")) {
    $("pwdFormToggleBtn").addEventListener("click", () => {
      const pwdInput = $("pwdPasswordInput");
      if (pwdInput) {
        pwdInput.type = pwdInput.type === "password" ? "text" : "password";
      }
    });
  }

  // Password Search Filter
  if ($("pwdSearchInput")) {
    $("pwdSearchInput").addEventListener("input", e => {
      const q = e.target.value.toLowerCase();
      const container = $("pwdCardContainer");
      if (!container) return;
      const filtered = (state.passwords || []).filter(p => {
        const pName = (p.customName || (PRESET_PLATFORMS[p.platform] ? PRESET_PLATFORMS[p.platform].name : "")).toLowerCase();
        const uName = (p.username || "").toLowerCase();
        return pName.includes(q) || uName.includes(q);
      });
      container.innerHTML = renderPasswordCards(filtered);
    });
  }
}

/* ==========================================================================
   AUTHENTICATION & INITIALIZATION FLOW
   ========================================================================== */

document.querySelectorAll(".chip-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const text = btn.dataset.text;
    const input = document.getElementById("nlInput");
    input.value = text;
    document.getElementById("nlForm").dispatchEvent(new Event("submit"));
  });
});

document.getElementById("nlForm").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("nlInput");
  const text = input.value.trim();
  if (!text) return;
  const parsed = parseEntry(text);
  const html = handleParsed(parsed);
  const box = document.getElementById("parseResult");
  box.innerHTML = html;
  box.classList.add("show");
  input.value = "";
  renderMain();
});

const authScreen = document.getElementById("authScreen");
const appShell = document.getElementById("appShell");
const tabLogin = document.getElementById("tabLogin");
const tabSignup = document.getElementById("tabSignup");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const loginError = document.getElementById("loginError");
const signupError = document.getElementById("signupError");
const loginSuccess = document.getElementById("loginSuccess");

function showAuthTab(which) {
  const loginActive = which === "login";
  if (tabLogin) tabLogin.classList.toggle("active", loginActive);
  if (tabSignup) tabSignup.classList.toggle("active", !loginActive);
  
  if (loginForm) {
    loginForm.classList.toggle("active", loginActive);
    loginForm.style.display = loginActive ? "flex" : "none";
  }
  if (signupForm) {
    signupForm.classList.toggle("active", !loginActive);
    signupForm.style.display = !loginActive ? "flex" : "none";
  }

  if (loginError) loginError.classList.remove("show");
  if (signupError) signupError.classList.remove("show");
  if (loginSuccess && !loginActive) loginSuccess.classList.remove("show");
}

if (tabLogin) tabLogin.addEventListener("click", () => showAuthTab("login"));
if (tabSignup) tabSignup.addEventListener("click", () => showAuthTab("signup"));
window.onFirebaseUserAuthenticated = function(user) {
  if (user && user.email && user.emailVerified) {
    const email = user.email.toLowerCase();
    const displayName = user.displayName || email.split("@")[0];
    if (!currentUser || currentUser !== email) {
      if (!usersDB[email]) {
        usersDB[email] = { name: displayName, data: blankState() };
      }
      enterApp(email, displayName);
    }
  }
};

async function enterApp(email, name) {
  const normEmail = String(email || '').trim().toLowerCase();
  currentUser = normEmail;

  if (!usersDB[normEmail]) {
    usersDB[normEmail] = { name: name || normEmail.split("@")[0], data: blankState() };
  }

  // 1. Await fetching existing cloud data BEFORE rendering or saving state
  if (window.Firebase && typeof window.Firebase.fetchUserDataFromCloud === "function") {
    try {
      const cloudData = await window.Firebase.fetchUserDataFromCloud(normEmail);
      if (cloudData && typeof cloudData === "object" && Object.keys(cloudData).length > 0) {
        usersDB[normEmail].data = { ...blankState(), ...cloudData };
        console.log("⚡ [Multi-Device Sync] Successfully restored cloud data from Firestore for:", normEmail);
      }
    } catch (e) {
      console.warn("Cloud fetch warning:", e);
    }
  }

  state = usersDB[normEmail].data;
  if (!state.passwords) state.passwords = [];

  // 2. Persist merged session locally
  try {
    localStorage.setItem("lifeledger_usersDB", JSON.stringify(usersDB));
    localStorage.setItem("lifeledger_currentUser", normEmail);
  } catch (e) {}

  // 3. Attach real-time subscription for live multi-device streaming
  if (window.Firebase && typeof window.Firebase.subscribeToCloudData === "function") {
    window.Firebase.subscribeToCloudData(normEmail, cloudData => {
      if (cloudData && typeof cloudData === "object" && Object.keys(cloudData).length > 0) {
        state = { ...blankState(), ...cloudData };
        usersDB[normEmail].data = state;
        try { localStorage.setItem("lifeledger_usersDB", JSON.stringify(usersDB)); } catch(e){}
        if (typeof renderMain === "function" && currentUser === normEmail) {
          renderMain();
        }
        if (typeof checkAlerts === "function") checkAlerts();
      }
    });
  }

  const displayName = usersDB[normEmail].name || "User";
  if (document.getElementById("profileName")) document.getElementById("profileName").textContent = displayName;
  if (document.getElementById("profileEmail")) document.getElementById("profileEmail").textContent = normEmail;
  if (document.getElementById("profileAvatar")) document.getElementById("profileAvatar").textContent = displayName.split(" ").map(n => n[0]).join("").toUpperCase() || "U";
  
  authScreen.style.display = "none";
  appShell.style.display = "flex";
  activeView = "Dashboard";
  renderNav();
  renderMain();
}

function openUserProfileModal() {
  if (!currentUser || !usersDB[currentUser]) return;
  const user = usersDB[currentUser];
  const modal = document.getElementById("userProfileModal");
  const editName = document.getElementById("editProfileName");
  const editEmail = document.getElementById("editProfileEmail");
  const editPhone = document.getElementById("editProfilePhone");
  const editBio = document.getElementById("editProfileBio");
  const modalAvatar = document.getElementById("modalProfileAvatar");

  if (!modal) return;

  const displayName = user.name || currentUser.split("@")[0];
  if (editName) editName.value = displayName;
  if (editEmail) editEmail.value = currentUser;
  if (editPhone) editPhone.value = user.phone || "";
  if (editBio) editBio.value = user.bio || "";
  if (modalAvatar) modalAvatar.textContent = displayName.split(" ").map(n => n[0]).join("").toUpperCase() || "U";

  modal.style.display = "flex";
}

function closeUserProfileModal() {
  const modal = document.getElementById("userProfileModal");
  if (modal) modal.style.display = "none";
}

/* ===== REPORT AN ISSUE TO ADMIN ===== */
function openReportIssueModal() {
  closeUserProfileModal();
  const modal = document.getElementById("reportIssueModal");
  if (modal) {
    modal.style.display = "flex";
    const subjectInput = document.getElementById("reportIssueSubject");
    if (subjectInput) subjectInput.focus();
  }
}

function closeReportIssueModal() {
  const modal = document.getElementById("reportIssueModal");
  if (modal) modal.style.display = "none";
}

function submitReportIssue(e) {
  if (e && e.preventDefault) e.preventDefault();

  const categoryInput = document.getElementById("reportIssueCategory");
  const subjectInput = document.getElementById("reportIssueSubject");
  const detailsInput = document.getElementById("reportIssueDetails");

  const category = categoryInput ? categoryInput.value : "Bug / Error";
  const subject = subjectInput ? subjectInput.value.trim() : "";
  const details = detailsInput ? detailsInput.value.trim() : "";

  if (!subject || !details) {
    showToast("Please provide both an issue subject and description.");
    return;
  }

  const user = currentUser ? (usersDB[currentUser] && usersDB[currentUser].name ? usersDB[currentUser].name : currentUser) : "User";
  const userEmail = currentUser || "Not logged in";
  const adminEmail = "airesumeash@gmail.com";

  // Construct mailto link
  const mailSubject = encodeURIComponent(`[LifeLedger Issue Report] ${category}: ${subject}`);
  const mailBody = encodeURIComponent(
    `Issue Report from LifeLedger Web Application\n` +
    `-----------------------------------------\n` +
    `User Name: ${user}\n` +
    `User Email: ${userEmail}\n` +
    `Issue Category: ${category}\n` +
    `Subject: ${subject}\n\n` +
    `Description:\n${details}\n\n` +
    `Submitted at: ${new Date().toLocaleString()}`
  );

  const mailtoUrl = `mailto:${adminEmail}?subject=${mailSubject}&body=${mailBody}`;

  // Open default mail app / window
  window.open(mailtoUrl, "_blank");

  showToast("Issue report submitted successfully!");

  const form = document.getElementById("reportIssueForm");
  if (form) form.reset();

  closeReportIssueModal();
}

/* ===== FIREBASE AUTHENTICATION & EMAIL VERIFICATION HANDLERS ===== */
/* ===== FIREBASE AUTHENTICATION & EMAIL VERIFICATION HANDLERS ===== */
signupForm.addEventListener("submit", async e => {
  e.preventDefault();
  const nameInput = document.getElementById("signupName");
  const emailInput = document.getElementById("signupEmail");
  const passInput = document.getElementById("signupPass");
  const submitBtn = signupForm.querySelector("button[type='submit']");

  const name = nameInput ? nameInput.value.trim() : "";
  const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
  const pass = passInput ? passInput.value : "";

  if (!name || !email || !pass) {
    if (signupError) {
      signupError.textContent = "Please fill in all fields (Name, Email, and Password).";
      signupError.classList.add("show");
    }
    return;
  }

  if (signupError) signupError.classList.remove("show");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending Verification Link...";
  }

  try {
    if (window.Firebase && typeof window.Firebase.signUpWithEmail === "function") {
      const res = await window.Firebase.signUpWithEmail(name, email, pass);

      if (res.success) {
        showAuthTab("login");
        if (loginSuccess) {
          loginSuccess.innerHTML = `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 12px 14px; border-radius: 10px; font-size: 12.5px; line-height: 1.5; margin-bottom: 12px;">
              <strong>📩 Verification Link Sent to Email Inbox!</strong><br>
              We sent a verification link to <b>${escapeHtml(email)}</b>.<br>
              Please check your email inbox, click the link to verify, then log in below.
            </div>
          `;
          loginSuccess.classList.add("show");
        }
        showToast("Verification email sent! Check your email inbox.");
        signupForm.reset();
      } else {
        let msg = res.message || "Failed to create account.";
        if (res.code === "auth/email-already-in-use") {
          msg = "An account with this email address already exists. Please switch to the 'Log in' tab to log in.";
        } else if (res.code === "auth/weak-password") {
          msg = "Password should be at least 6 characters long.";
        } else if (res.code === "auth/invalid-email") {
          msg = "Please enter a valid email address.";
        }
        if (signupError) {
          signupError.textContent = msg;
          signupError.classList.add("show");
        }
      }
    } else {
      // Local session fallback
      usersDB[email] = { name, password: pass, data: blankState() };
      enterApp(email, name);
    }
  } catch (err) {
    console.error("Signup handler exception:", err);
    if (signupError) {
      signupError.textContent = "An error occurred during account creation: " + (err.message || err);
      signupError.classList.add("show");
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create account";
    }
  }
});

loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  const emailInput = document.getElementById("loginEmail");
  const passInput = document.getElementById("loginPass");
  const submitBtn = loginForm.querySelector("button[type='submit']");

  const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
  const pass = passInput ? passInput.value : "";

  if (!email || !pass) {
    if (loginError) {
      loginError.textContent = "Please enter both your email address and password.";
      loginError.classList.add("show");
    }
    return;
  }

  if (loginError) loginError.classList.remove("show");
  if (loginSuccess) loginSuccess.classList.remove("show");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Verifying Credentials...";
  }

  try {
    if (window.Firebase && typeof window.Firebase.signInWithEmail === "function") {
      const res = await window.Firebase.signInWithEmail(email, pass);

      if (res.success) {
        const displayName = (res.user && res.user.displayName) ? res.user.displayName : email.split("@")[0];
        if (!usersDB[email]) {
          usersDB[email] = { name: displayName, data: blankState() };
        }
        enterApp(email, displayName);
        showToast(`Email verified! Welcome back, ${displayName}!`);
      } else {
        if (res.emailUnverified) {
          // 1. Browser Alert Popup
          alert(`⚠️ EMAIL VERIFICATION REQUIRED!\n\nYour email address (${email}) has not been verified yet.\n\nPlease open your email inbox, click the verification link sent to your email, and then log in.`);
          
          // 2. Toast Alert
          showToast("⚠️ Email not verified! Please check your inbox.");

          // 3. High-Visibility Warning Banner in Form
          if (loginError) {
            loginError.innerHTML = `
              <div style="background: #fef2f2; border: 1.5px solid #fca5a5; color: #991b1b; padding: 14px 16px; border-radius: 12px; font-size: 13px; line-height: 1.5; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.12); margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; color: #dc2626; margin-bottom: 6px;">
                  <span>⚠️</span> EMAIL VERIFICATION REQUIRED FIRST
                </div>
                <div>A verification link was sent to <b style="color: #0f172a; text-decoration: underline;">${escapeHtml(email)}</b>.</div>
                <div style="margin-top: 4px; font-size: 12px; color: #7f1d1d;">Please open your email inbox and click the link to verify before logging in.</div>
                <button type="button" id="resendVerifBtn" style="margin-top: 10px; background: linear-gradient(135deg, #ef4444, #dc2626); color: #ffffff; border: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 8px rgba(220,38,38,0.25); display: inline-flex; align-items: center; gap: 6px;">
                  📩 Resend Verification Link to Inbox
                </button>
              </div>
            `;
            loginError.classList.add("show");

            setTimeout(() => {
              const resendBtn = document.getElementById("resendVerifBtn");
              if (resendBtn) {
                resendBtn.onclick = async () => {
                  resendBtn.disabled = true;
                  resendBtn.textContent = "Sending Verification Link...";
                  const resendRes = await window.Firebase.resendVerificationEmail(email, pass);
                  if (resendRes.success) {
                    showToast("Verification link re-sent! Check your email inbox.");
                    resendBtn.textContent = "✓ Link Re-sent to Inbox!";
                  } else {
                    showToast("Failed to resend: " + resendRes.message);
                    resendBtn.disabled = false;
                    resendBtn.textContent = "📩 Resend Verification Link to Inbox";
                  }
                };
              }
            }, 100);
          }
        } else {
          let msg = res.message || "Invalid email address or password.";
          if (res.code === "auth/invalid-credential" || res.code === "auth/user-not-found" || res.code === "auth/wrong-password") {
            msg = "Account not found or password incorrect. If you haven't created an account yet, click 'Sign up' above!";
          }
          if (loginError) {
            loginError.textContent = msg;
            loginError.classList.add("show");
          }
        }
      }
    } else {
      // Local session fallback
      if (usersDB[email] && usersDB[email].password === pass) {
        enterApp(email, usersDB[email].name);
      } else {
        usersDB[email] = { name: email.split("@")[0], password: pass, data: blankState() };
        enterApp(email, usersDB[email].name);
      }
    }
  } catch (err) {
    console.error("Login handler exception:", err);
    if (loginError) {
      loginError.textContent = "An error occurred during sign in: " + (err.message || err);
      loginError.classList.add("show");
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Log in";
    }
  }
});

/* ==========================================================================
   HEALTH & WELLNESS MODULE
   ========================================================================== */
function switchHealthTab(tab) {
  if (tab !== 'overview' && tab !== 'records') {
    tab = 'overview';
  }
  activeHealthTab = tab;
  renderMain();
}

function calculateHealthScore() {
  const todayIso = new Date().toISOString().split("T")[0];
  let score = 50;
  
  const todayWater = (state.waterIntake || []).filter(w => w.date === todayIso).reduce((s, w) => s + w.amount, 0);
  if (todayWater >= 2000) score += 20;
  else if (todayWater >= 1000) score += 10;
  else if (todayWater > 0) score += 5;

  const recentSleep = (state.sleepRecords || [])[0];
  if (recentSleep && recentSleep.duration >= 7 && recentSleep.duration <= 9) score += 15;
  else if (recentSleep && recentSleep.duration > 0) score += 8;

  const recentWorkouts = (state.workouts || []).filter(w => w.date === todayIso);
  if (recentWorkouts.length > 0) score += 15;

  return Math.min(100, score);
}

function viewHealthAndWellness() {
  if (!currentUser) return '<div class="card"><p>Please log in to view Health & Wellness.</p></div>';

  const healthScore = calculateHealthScore();
  const todayIso = new Date().toISOString().split("T")[0];
  const waterToday = (state.waterIntake || []).filter(w => w.date === todayIso).reduce((s, w) => s + w.amount, 0);
  const waterGoal = 2500;
  const waterPct = Math.min(100, Math.round((waterToday / waterGoal) * 100));

  const recentSleep = (state.sleepRecords || [])[0] || { duration: 0, bedtime: 'N/A', waketime: 'N/A' };
  const workoutsToday = (state.workouts || []).filter(w => w.date === todayIso);
  const upcomingDoctorAppts = (state.appointments || []).filter(a => a.category === "Medical / Doctor Visit" || a.category === "Medical");

  return `
  <div class="subnav-bar">
    <button class="subnav-btn ${activeHealthTab === 'overview' ? 'active' : ''}" onclick="switchHealthTab('overview')">📊 Health Overview</button>
    <button class="subnav-btn ${activeHealthTab === 'records' ? 'active' : ''}" onclick="switchHealthTab('records')">🧪 Health Records</button>
  </div>

  ${activeHealthTab === 'overview' ? `
    <div class="health-score-card">
      <div>
        <h2 style="color: #ffffff; font-size: 20px; margin-bottom: 4px;">User Activity Wellness Score</h2>
        <div style="font-size: 13px; color: #cbd5e1;">Score calculated strictly based on your recorded water intake, sleep, and workouts today.</div>
        <div class="wellness-disclaimer">ⓘ Tracking score based only on recorded user data. Not a medical diagnosis.</div>
      </div>
      <div class="health-score-circle">
        <span class="health-score-num">${healthScore}</span>
        <span class="health-score-lbl">SCORE</span>
      </div>
    </div>

    <div class="stat-cards-row">
      <div class="soft-stat-block blue">
        <div class="ss-top"><span class="ss-label">💧 Water Intake</span><div class="ss-icon">💧</div></div>
        <div class="ss-value num">${(waterToday / 1000).toFixed(1)} L / ${(waterGoal / 1000).toFixed(1)} L</div>
        <div class="ss-sub">${waterPct}% of daily goal</div>
      </div>

      <div class="soft-stat-block green">
        <div class="ss-top"><span class="ss-label">😴 Sleep Duration</span><div class="ss-icon">🌙</div></div>
        <div class="ss-value num">${recentSleep.duration || 0} hrs</div>
        <div class="ss-sub">Bedtime: ${recentSleep.bedtime || 'N/A'}</div>
      </div>

      <div class="soft-stat-block yellow">
        <div class="ss-top"><span class="ss-label">🏃 Workouts Today</span><div class="ss-icon">🏋️</div></div>
        <div class="ss-value num">${workoutsToday.length}</div>
        <div class="ss-sub">${workoutsToday.map(w => w.type).join(', ') || 'No workout logged'}</div>
      </div>

      <div class="soft-stat-block red">
        <div class="ss-top"><span class="ss-label">💊 Medications</span><div class="ss-icon">💊</div></div>
        <div class="ss-value num">${(state.medications || []).filter(m => m.active).length}</div>
        <div class="ss-sub">Active reminders</div>
      </div>
    </div>

    <div class="grid-2" style="margin-top: 20px;">
      <div class="card">
        <div class="card-header">
          <h2>🩺 Upcoming Doctor Visits</h2>
          <span class="pill-tag info">${upcomingDoctorAppts.length} scheduled</span>
        </div>
        <div class="upcoming-list">
          ${upcomingDoctorAppts.map(a => `
            <div class="upcoming-row">
              <div class="ur-left">
                <div class="ur-icon icon-blue">🩺</div>
                <div>
                  <div class="ur-title">${escapeHtml(a.title)}</div>
                  <div class="ur-sub">${escapeHtml(a.date)} at ${escapeHtml(a.time || '10:00 AM')}</div>
                </div>
              </div>
            </div>
          `).join("")}
          ${upcomingDoctorAppts.length === 0 ? `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">No doctor visits scheduled.</div>` : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2>🧪 Recent Health Records</h2>
          <span class="pill-tag warning">${(state.healthRecords || []).length} records</span>
        </div>
        <div class="upcoming-list">
          ${(state.healthRecords || []).slice(0, 3).map(r => `
            <div class="upcoming-row">
              <div class="ur-left">
                <div class="ur-icon icon-amber">📑</div>
                <div>
                  <div class="ur-title">${escapeHtml(r.title)}</div>
                  <div class="ur-sub">${escapeHtml(r.type)} • ${escapeHtml(r.date)}</div>
                </div>
              </div>
              ${r.fileData ? `<button class="action-btn" onclick="openDocModalFromHealth('${escapeHtml(r.title)}', '${r.fileData}')">👁 View File</button>` : ''}
            </div>
          `).join("")}
          ${(state.healthRecords || []).length === 0 ? `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">No health records added yet.</div>` : ''}
        </div>
      </div>
    </div>
  ` : renderHealthRecordsSection()}
  `;
}

function renderHealthRecordsSection() {
  const records = (state.healthRecords || []).filter(r => healthRecordTypeFilter === "All" || r.type === healthRecordTypeFilter);

  return `
  <div class="card">
    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
      <div>
        <h2>Health Records & Prescriptions</h2>
        <div class="sub">Store medical documents, lab reports, and vaccination records</div>
      </div>
      <div style="display: flex; gap: 10px;">
        <select onchange="healthRecordTypeFilter = this.value; renderMain();" style="padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 12.5px; font-weight: 600;">
          <option value="All" ${healthRecordTypeFilter === 'All' ? 'selected' : ''}>All Record Types</option>
          <option value="Prescription" ${healthRecordTypeFilter === 'Prescription' ? 'selected' : ''}>Prescriptions</option>
          <option value="Lab Report" ${healthRecordTypeFilter === 'Lab Report' ? 'selected' : ''}>Lab Reports</option>
          <option value="Vaccination Record" ${healthRecordTypeFilter === 'Vaccination Record' ? 'selected' : ''}>Vaccination Records</option>
          <option value="Medical Document" ${healthRecordTypeFilter === 'Medical Document' ? 'selected' : ''}>Medical Documents</option>
          <option value="Other" ${healthRecordTypeFilter === 'Other' ? 'selected' : ''}>Other</option>
        </select>
      </div>
    </div>

    <div class="upcoming-list" style="margin-top: 14px;">
      ${records.map(r => `
        <div class="upcoming-row" style="padding: 14px; border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 10px; background: #fff;">
          <div class="ur-left">
            <div class="ur-icon icon-blue">📋</div>
            <div>
              <div class="ur-title" style="font-size: 14px; font-weight: 700;">${escapeHtml(r.title)}</div>
              <div class="ur-sub" style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                <span class="cat-badge Utilities">${escapeHtml(r.type)}</span> • Date: <b>${escapeHtml(r.date)}</b> ${r.doctor ? '• Doctor: ' + escapeHtml(r.doctor) : ''}
              </div>
              ${r.notes ? `<div style="font-size: 12px; color: #475569; margin-top: 4px;">📝 ${escapeHtml(r.notes)}</div>` : ''}
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            ${r.fileData ? `<button class="action-btn" onclick="openDocModalFromHealth('${escapeHtml(r.title)}', '${r.fileData}')">👁 View Attachment</button>` : ''}
            <button class="action-btn danger-btn" onclick="deleteHealthRecord(${r.id})">🗑 Delete</button>
          </div>
        </div>
      `).join("")}

      ${records.length === 0 ? `
        <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 36px; margin-bottom: 8px;">📂</div>
          <div style="font-weight: 700; color: #1e293b;">No health records yet</div>
          <div style="font-size: 13px;">Add your first prescription, lab report, or vaccination record below!</div>
        </div>` : ''}
    </div>

    <!-- Add Health Record Form -->
    <div style="margin-top: 20px; background: #f8fafc; padding: 18px; border-radius: 12px; border: 1px solid var(--border-color);">
      <div style="font-weight: 700; font-size: 13.5px; margin-bottom: 12px; color: #0f172a;">➕ Add New Health Record</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <input type="text" id="hrTitleInput" placeholder="Record Title (e.g. Blood Test Results)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <select id="hrTypeSelect" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
          <option value="Prescription">Prescription</option>
          <option value="Lab Report">Lab Report</option>
          <option value="Vaccination Record">Vaccination Record</option>
          <option value="Medical Document">Medical Document</option>
          <option value="Other">Other Health Record</option>
        </select>
        <input type="date" id="hrDateInput" value="${new Date().toISOString().split("T")[0]}" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="text" id="hrDoctorInput" placeholder="Doctor / Hospital Name" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="text" id="hrNotesInput" placeholder="Notes (Optional)" style="grid-column: span 2; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="file" id="hrFileInput" style="grid-column: span 2; font-size: 12px;">
        <button id="hrAddBtn" onclick="addHealthRecord()" style="grid-column: span 2; padding: 10px; background: var(--primary-brand); color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">Save Health Record</button>
      </div>
    </div>
  </div>`;
}

function addHealthRecord() {
  const title = document.getElementById("hrTitleInput").value.trim();
  if (!title) { showToast("Please provide record title"); return; }
  const type = document.getElementById("hrTypeSelect").value;
  const date = document.getElementById("hrDateInput").value;
  const doctor = document.getElementById("hrDoctorInput").value.trim();
  const notes = document.getElementById("hrNotesInput").value.trim();
  const fileInput = document.getElementById("hrFileInput");
  const file = fileInput ? fileInput.files[0] : null;

  const newRec = {
    id: Date.now(),
    userId: currentUser,
    title,
    type,
    date,
    doctor,
    notes,
    fileData: ""
  };

  if (!state.healthRecords) state.healthRecords = [];

  const finishSave = () => {
    state.healthRecords.unshift(newRec);
    if (!state.documents) state.documents = [];
    state.documents.unshift({
      id: newRec.id,
      name: title,
      documentTitle: title,
      type: type,
      documentType: type,
      category: "Yours Document",
      userId: currentUser,
      date: date,
      fileData: newRec.fileData
    });
    saveSessionData();
    renderMain();
    showToast("Health record saved successfully!");
  };

  if (file) {
    const reader = new FileReader();
    reader.onload = e => { newRec.fileData = e.target.result; finishSave(); };
    reader.readAsDataURL(file);
  } else {
    finishSave();
  }
}

function deleteHealthRecord(id) {
  state.healthRecords = (state.healthRecords || []).filter(r => r.id !== id);
  saveSessionData();
  renderMain();
  showToast("Health record deleted");
}

function openDocModalFromHealth(title, dataUrl) {
  const modal = document.getElementById("docPreviewModal");
  const body = document.getElementById("docModalBody");
  const titleEl = document.getElementById("docModalTitle");
  const dlBtn = document.getElementById("docModalDownloadBtn");
  if (!modal || !body) return;
  titleEl.textContent = title;
  dlBtn.href = dataUrl;
  if (dataUrl.startsWith("data:image")) {
    body.innerHTML = `<img src="${dataUrl}" style="max-width: 100%; border-radius: 8px;">`;
  } else if (dataUrl.startsWith("data:application/pdf")) {
    body.innerHTML = `<iframe src="${dataUrl}" style="width: 100%; height: 400px; border: none;"></iframe>`;
  } else {
    body.innerHTML = `<div style="padding: 20px; text-align: center;">Attachment available for download.</div>`;
  }
  modal.style.display = "flex";
}

function renderFitnessAndHabitsSection() {
  const todayIso = new Date().toISOString().split("T")[0];
  const waterToday = (state.waterIntake || []).filter(w => w.date === todayIso).reduce((s, w) => s + w.amount, 0);

  return `
  <div class="grid-2">
    <div class="card">
      <div class="card-header">
        <h2>💧 Daily Water Tracker</h2>
        <span class="pill-tag info">Goal: 2.5 L</span>
      </div>
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 32px; font-weight: 800; font-family: 'IBM Plex Mono', monospace; color: #2563eb;">
          ${(waterToday / 1000).toFixed(1)} L / 2.5 L
        </div>
        <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 4px;">
          ${waterToday >= 2500 ? '🎉 Goal achieved today!' : `${2500 - waterToday} ml remaining`}
        </div>
        <div class="bb-track" style="margin: 16px 0; height: 10px; border-radius: 5px;">
          <div class="bb-fill" style="width: ${Math.min(100, (waterToday / 2500) * 100)}%; background: #2563eb; height: 100%;"></div>
        </div>
        <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
          <button class="action-btn" onclick="addWaterIntake(250)">+250 ml</button>
          <button class="action-btn" onclick="addWaterIntake(500)">+500 ml</button>
          <button class="action-btn" onclick="addWaterIntake(1000)">+1 L</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>😴 Sleep Duration Tracker</h2>
        <span class="pill-tag warning">Target: 8 hrs</span>
      </div>
      <div style="padding: 10px 0;">
        <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px; flex-wrap: wrap;">
          <input type="text" id="sleepBedtime" placeholder="Bedtime (e.g. 11:00 PM)" style="flex: 1; min-width: 120px; padding: 8px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
          <input type="text" id="sleepWaketime" placeholder="Wake time (e.g. 7:00 AM)" style="flex: 1; min-width: 120px; padding: 8px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
          <input type="number" id="sleepHours" placeholder="Hours" style="width: 75px; padding: 8px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
          <button class="action-btn pay-btn" onclick="logSleep()">Log Sleep</button>
        </div>
        <div class="upcoming-list">
          ${(state.sleepRecords || []).slice(0, 3).map(s => `
            <div class="upcoming-row" style="padding: 8px 12px;">
              <div>
                <div style="font-weight: 700;">${s.duration} hours sleep</div>
                <div style="font-size: 11.5px; color: var(--text-muted);">${s.date} • ${s.bedtime} to ${s.waketime}</div>
              </div>
            </div>
          `).join("")}
          ${(state.sleepRecords || []).length === 0 ? `<div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 12.5px;">No sleep records logged yet.</div>` : ''}
        </div>
      </div>
    </div>
  </div>

  <div class="card" style="margin-top: 20px;">
    <div class="card-header">
      <h2>🏃 Workout Tracker</h2>
      <span class="pill-tag info">${(state.workouts || []).length} workouts logged</span>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 14px;">
      <select id="workoutTypeSelect" style="padding: 8px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <option value="Walking">Walking</option>
        <option value="Running">Running</option>
        <option value="Cycling">Cycling</option>
        <option value="Gym">Gym Workout</option>
        <option value="Yoga">Yoga</option>
        <option value="Sports">Sports</option>
        <option value="Other">Other</option>
      </select>
      <input type="number" id="workoutDuration" placeholder="Duration (mins)" style="padding: 8px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
      <input type="number" id="workoutCalories" placeholder="Calories (optional)" style="padding: 8px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
      <button class="action-btn pay-btn" onclick="logWorkout()">Log Workout</button>
    </div>

    <div class="upcoming-list">
      ${(state.workouts || []).map(w => `
        <div class="upcoming-row" style="padding: 10px 14px;">
          <div class="ur-left">
            <div class="ur-icon icon-amber">🏋️</div>
            <div>
              <div class="ur-title" style="font-weight: 700;">${w.type} (${w.duration} mins)</div>
              <div class="ur-sub">${w.date} ${w.calories ? '• ' + w.calories + ' kcal' : ''}</div>
            </div>
          </div>
          <button class="action-btn danger-btn" onclick="deleteWorkout(${w.id})">🗑</button>
        </div>
      `).join("")}
      ${(state.workouts || []).length === 0 ? `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">No workouts logged yet. Select a workout type above!</div>` : ''}
    </div>
  </div>

  <div class="card" style="margin-top: 20px;">
    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h2>⚡ Habit Tracker & Streak Heatmap</h2>
        <div class="sub">Build daily habits & track completion streaks</div>
      </div>
    </div>

    <div style="display: flex; gap: 10px; margin-bottom: 16px;">
      <input type="text" id="habitNameInput" placeholder="New Habit (e.g. Reading 20 mins, Meditation)" style="flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
      <button class="action-btn pay-btn" onclick="createHabit()">+ Add Habit</button>
    </div>

    <div class="grid-2">
      ${(state.habits || []).map(h => {
        const completions = (state.habitCompletions || []).filter(c => c.habitId === h.id);
        const isDoneToday = completions.some(c => c.date === todayIso);
        const currentStreak = calculateHabitStreak(h.id);

        return `
          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 12px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-weight: 700; font-size: 14px; color: #0f172a;">${escapeHtml(h.name)}</span>
              <span class="pill-tag warning">🔥 ${currentStreak} day streak</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">
                <input type="checkbox" ${isDoneToday ? 'checked' : ''} onchange="toggleHabitCheck(${h.id}, '${todayIso}', this.checked)" style="width: 18px; height: 18px; accent-color: #10b981;">
                Completed Today
              </label>
              <button class="action-btn danger-btn" onclick="deleteHabit(${h.id})" style="font-size: 11px;">Delete</button>
            </div>
          </div>
        `;
      }).join("")}
      ${(state.habits || []).length === 0 ? `<div style="grid-column: span 2; padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">No habits created yet. Add a habit like "Reading" or "Meditation" above!</div>` : ''}
    </div>
  </div>`;
}

function addWaterIntake(amt) {
  const todayIso = new Date().toISOString().split("T")[0];
  if (!state.waterIntake) state.waterIntake = [];
  state.waterIntake.push({ id: Date.now(), userId: currentUser, date: todayIso, amount: amt });
  saveSessionData();
  renderMain();
  showToast(`Added ${amt} ml water intake! 💧`);
}

function logSleep() {
  const bedtime = document.getElementById("sleepBedtime").value.trim();
  const waketime = document.getElementById("sleepWaketime").value.trim();
  const hours = parseFloat(document.getElementById("sleepHours").value) || 0;
  if (!hours) { showToast("Please enter sleep hours"); return; }
  const todayIso = new Date().toISOString().split("T")[0];
  if (!state.sleepRecords) state.sleepRecords = [];
  state.sleepRecords.unshift({ id: Date.now(), userId: currentUser, date: todayIso, bedtime, waketime, duration: hours });
  saveSessionData();
  renderMain();
  showToast("Sleep logged!");
}

function logWorkout() {
  const type = document.getElementById("workoutTypeSelect").value;
  const duration = parseFloat(document.getElementById("workoutDuration").value) || 0;
  const calories = parseFloat(document.getElementById("workoutCalories").value) || 0;
  if (!duration) { showToast("Please enter workout duration"); return; }
  const todayIso = new Date().toISOString().split("T")[0];
  if (!state.workouts) state.workouts = [];
  state.workouts.unshift({ id: Date.now(), userId: currentUser, date: todayIso, type, duration, calories });
  saveSessionData();
  renderMain();
  showToast(`Logged ${type} workout!`);
}

function deleteWorkout(id) {
  state.workouts = (state.workouts || []).filter(w => w.id !== id);
  saveSessionData();
  renderMain();
}

function createHabit() {
  const name = document.getElementById("habitNameInput").value.trim();
  if (!name) { showToast("Please enter habit name"); return; }
  if (!state.habits) state.habits = [];
  state.habits.push({ id: Date.now(), userId: currentUser, name, createdAt: new Date().toISOString() });
  saveSessionData();
  renderMain();
  showToast(`Habit "${name}" created!`);
}

function deleteHabit(id) {
  state.habits = (state.habits || []).filter(h => h.id !== id);
  state.habitCompletions = (state.habitCompletions || []).filter(c => c.habitId !== id);
  saveSessionData();
  renderMain();
}

function toggleHabitCheck(habitId, dateStr, isChecked) {
  if (!state.habitCompletions) state.habitCompletions = [];
  if (isChecked) {
    if (!state.habitCompletions.some(c => c.habitId === habitId && c.date === dateStr)) {
      state.habitCompletions.push({ id: Date.now(), habitId, date: dateStr });
    }
  } else {
    state.habitCompletions = state.habitCompletions.filter(c => !(c.habitId === habitId && c.date === dateStr));
  }
  saveSessionData();
  renderMain();
}

function calculateHabitStreak(habitId) {
  const completions = (state.habitCompletions || []).filter(c => c.habitId === habitId).map(c => c.date);
  if (completions.length === 0) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    if (completions.includes(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

function renderMedicationsSection() {
  const meds = state.medications || [];

  return `
  <div class="card">
    <div class="card-header">
      <div>
        <h2>💊 Medication Reminders</h2>
        <div class="sub">Track prescribed daily medications and reminder schedules</div>
      </div>
    </div>

    <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; font-size: 12px; color: #1e40af;">
      ⓘ <strong>Reminder Feature Only:</strong> LifeLedger AI does not provide medical dosage recommendations or medical advice. Consult your doctor for medical instructions.
    </div>

    <div class="upcoming-list">
      ${meds.map(m => `
        <div class="upcoming-row" style="padding: 12px 14px; border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 8px;">
          <div class="ur-left">
            <div class="ur-icon icon-blue">💊</div>
            <div>
              <div class="ur-title" style="font-size: 14px; font-weight: 700;">${escapeHtml(m.name)} (${escapeHtml(m.dosage)})</div>
              <div class="ur-sub" style="font-size: 12px; color: var(--text-muted);">
                Frequency: <b>${escapeHtml(m.frequency)}</b> • Time: <b>${escapeHtml(m.reminderTime || '8:00 AM')}</b>
              </div>
              ${m.notes ? `<div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">📝 ${escapeHtml(m.notes)}</div>` : ''}
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span class="pill-tag ${m.active ? 'warning' : 'info'}">${m.active ? 'Active' : 'Inactive'}</span>
            <button class="action-btn danger-btn" onclick="deleteMedication(${m.id})">🗑 Delete</button>
          </div>
        </div>
      `).join("")}
      ${meds.length === 0 ? `<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">No medication reminders set yet.</div>` : ''}
    </div>

    <div style="margin-top: 20px; background: #f8fafc; padding: 18px; border-radius: 12px; border: 1px solid var(--border-color);">
      <div style="font-weight: 700; font-size: 13.5px; margin-bottom: 10px; color: #0f172a;">➕ Add Medication Reminder</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <input type="text" id="medNameInput" placeholder="Medication Name (e.g. Paracetamol)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="text" id="medDosageInput" placeholder="Dosage (e.g. 500mg)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <select id="medFreqSelect" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
          <option value="Once Daily">Once Daily</option>
          <option value="Twice Daily">Twice Daily</option>
          <option value="Thrice Daily">Thrice Daily</option>
          <option value="As Needed">As Needed</option>
        </select>
        <input type="text" id="medTimeInput" placeholder="Reminder Time (e.g. 9:00 AM)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="text" id="medNotesInput" placeholder="Notes (Optional)" style="grid-column: span 2; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <button class="action-btn pay-btn" onclick="addMedication()" style="grid-column: span 2; padding: 10px;">Save Reminder</button>
      </div>
    </div>
  </div>`;
}

function addMedication() {
  const name = document.getElementById("medNameInput").value.trim();
  const dosage = document.getElementById("medDosageInput").value.trim();
  if (!name) { showToast("Please enter medication name"); return; }
  const frequency = document.getElementById("medFreqSelect").value;
  const reminderTime = document.getElementById("medTimeInput").value.trim();
  const notes = document.getElementById("medNotesInput").value.trim();

  if (!state.medications) state.medications = [];
  state.medications.push({ id: Date.now(), userId: currentUser, name, dosage, frequency, reminderTime, notes, active: true });
  saveSessionData();
  renderMain();
  showToast("Medication reminder added!");
}

function deleteMedication(id) {
  state.medications = (state.medications || []).filter(m => m.id !== id);
  saveSessionData();
  renderMain();
}

function renderDoctorVisitsSection() {
  const visits = (state.appointments || []).filter(a => a.category === "Medical / Doctor Visit" || a.category === "Medical");

  return `
  <div class="card">
    <div class="card-header">
      <div>
        <h2>🩺 Doctor Visit History & Timeline</h2>
        <div class="sub">Integrated doctor appointments, consultations, and follow-ups</div>
      </div>
    </div>

    <div class="upcoming-list">
      ${visits.map(v => `
        <div class="upcoming-row" style="padding: 14px; border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 8px;">
          <div class="ur-left">
            <div class="ur-icon icon-amber">🩺</div>
            <div>
              <div class="ur-title" style="font-size: 14px; font-weight: 700;">${escapeHtml(v.title)}</div>
              <div class="ur-sub" style="font-size: 12px; color: var(--text-muted);">
                Date: <b>${escapeHtml(v.date)}</b> at <b>${escapeHtml(v.time || '10:00 AM')}</b>
              </div>
            </div>
          </div>
          <button class="action-btn danger-btn" onclick="deleteAppointment(${v.id})">🗑 Delete</button>
        </div>
      `).join("")}
      ${visits.length === 0 ? `<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">No doctor visits scheduled yet.</div>` : ''}
    </div>
  </div>`;
}

/* ==========================================================================
   NOTES & JOURNAL MODULE
   ========================================================================== */
function viewNotesAndJournal() {
  if (!currentUser) return '<div class="card"><p>Please log in to view Notes & Journal.</p></div>';

  const notesList = (state.notes || []).filter(n => {
    if (notesCategoryFilter !== "All" && n.category !== notesCategoryFilter) return false;
    return true;
  });

  const pinnedNotes = notesList.filter(n => n.isPinned);
  const unpinnedNotes = notesList.filter(n => !n.isPinned);

  return `
  <div class="card">
    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
      <div>
        <h2>📝 Notes & Journal Entries</h2>
        <div class="sub">Organized workspace for personal ideas, study notes, and journal entries</div>
      </div>
      <div style="display: flex; gap: 10px;">
        <select onchange="notesCategoryFilter = this.value; renderMain();" style="padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 12.5px; font-weight: 600;">
          <option value="All" ${notesCategoryFilter === 'All' ? 'selected' : ''}>All Categories</option>
          <option value="Personal" ${notesCategoryFilter === 'Personal' ? 'selected' : ''}>Personal</option>
          <option value="Study" ${notesCategoryFilter === 'Study' ? 'selected' : ''}>Study</option>
          <option value="Work" ${notesCategoryFilter === 'Work' ? 'selected' : ''}>Work</option>
          <option value="Ideas" ${notesCategoryFilter === 'Ideas' ? 'selected' : ''}>Ideas</option>
          <option value="Journal" ${notesCategoryFilter === 'Journal' ? 'selected' : ''}>Journal</option>
          <option value="Other" ${notesCategoryFilter === 'Other' ? 'selected' : ''}>Other</option>
        </select>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-top: 16px;">
      ${[...pinnedNotes, ...unpinnedNotes].map(n => `
        <div style="background: ${n.isPinned ? '#fefce8' : '#ffffff'}; border: 1px solid ${n.isPinned ? '#fde68a' : 'var(--border-color)'}; border-radius: 12px; padding: 16px; position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <span style="font-weight: 700; font-size: 15px; color: #0f172a;">${escapeHtml(n.title)}</span>
            <span class="cat-badge Utilities">${escapeHtml(n.category || 'Personal')}</span>
          </div>
          <div style="font-size: 13px; color: #475569; white-space: pre-wrap; line-height: 1.5; margin-bottom: 12px;">${escapeHtml(n.content)}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: var(--text-muted);">
            <span>📅 ${escapeHtml(n.date)}</span>
            <div style="display: flex; gap: 6px;">
              <button class="action-btn" onclick="togglePinNote(${n.id})">${n.isPinned ? '📌 Unpin' : '📌 Pin'}</button>
              <button class="action-btn danger-btn" onclick="deleteNote(${n.id})">🗑</button>
            </div>
          </div>
        </div>
      `).join("")}

      ${notesList.length === 0 ? `
        <div style="grid-column: span 2; padding: 40px 20px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 36px; margin-bottom: 8px;">📓</div>
          <div style="font-weight: 700; color: #1e293b;">No notes or journal entries found</div>
          <div style="font-size: 13px;">Write your first note using the form below!</div>
        </div>` : ''}
    </div>

    <div style="margin-top: 24px; background: #f8fafc; padding: 18px; border-radius: 12px; border: 1px solid var(--border-color);">
      <div style="font-weight: 700; font-size: 13.5px; margin-bottom: 12px; color: #0f172a;">✏️ Create New Note / Journal Entry</div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; gap: 10px;">
          <input type="text" id="noteTitleInput" placeholder="Note Title..." style="flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
          <select id="noteCatSelect" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
            <option value="Personal">Personal</option>
            <option value="Study">Study</option>
            <option value="Work">Work</option>
            <option value="Ideas">Ideas</option>
            <option value="Journal">Journal</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <textarea id="noteContentInput" placeholder="Write content or journal entry..." style="height: 100px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px; outline: none; font-family: inherit; resize: vertical;"></textarea>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; cursor: pointer;">
            <input type="checkbox" id="notePinCheck" style="accent-color: #4f46e5;"> Pin to Top
          </label>
          <button class="action-btn pay-btn" onclick="saveNote()">💾 Save Note</button>
        </div>
      </div>
    </div>
  </div>`;
}

function saveNote() {
  const title = document.getElementById("noteTitleInput").value.trim();
  const content = document.getElementById("noteContentInput").value.trim();
  if (!title || !content) { showToast("Please provide title and content"); return; }
  const category = document.getElementById("noteCatSelect").value;
  const isPinned = document.getElementById("notePinCheck").checked;
  const dateIso = new Date().toISOString().split("T")[0];

  if (!state.notes) state.notes = [];
  state.notes.unshift({ id: Date.now(), userId: currentUser, title, content, category, isPinned, date: dateIso });
  saveSessionData();
  renderMain();
  showToast("Note saved!");
}

function deleteNote(id) {
  state.notes = (state.notes || []).filter(n => n.id !== id);
  saveSessionData();
  renderMain();
}

function togglePinNote(id) {
  const note = (state.notes || []).find(n => n.id === id);
  if (note) {
    note.isPinned = !note.isPinned;
    saveSessionData();
    renderMain();
  }
}

/* ==========================================================================
   CONTACTS MODULE
   ========================================================================== */
function viewContacts() {
  if (!currentUser) return '<div class="card"><p>Please log in to view Contacts.</p></div>';

  const contactsList = (state.contacts || []).filter(c => {
    if (contactsRelationshipFilter !== "All" && c.relationship !== contactsRelationshipFilter) return false;
    return true;
  });

  const todayIso = new Date().toISOString().split("T")[0];

  const upcomingBirthdays = (state.contacts || []).filter(c => {
    if (!c.birthday) return false;
    const bMonth = c.birthday.split("-")[1];
    const bDay = c.birthday.split("-")[2];
    const now = new Date();
    const bDate = new Date(now.getFullYear(), parseInt(bMonth) - 1, parseInt(bDay));
    const diffDays = Math.ceil((bDate - now) / (86400000));
    return diffDays >= 0 && diffDays <= 30;
  });

  const notContactedRecently = (state.contacts || []).filter(c => {
    if (!c.lastContacted) return true;
    const diffDays = Math.ceil((new Date(todayIso) - new Date(c.lastContacted)) / (86400000));
    return diffDays > 30;
  });

  return `
  <div class="grid-2" style="margin-bottom: 20px;">
    <div class="card">
      <div class="card-header">
        <h2>🎂 Upcoming Birthdays</h2>
        <span class="pill-tag info">${upcomingBirthdays.length} upcoming</span>
      </div>
      <div class="upcoming-list">
        ${upcomingBirthdays.map(c => `
          <div class="upcoming-row">
            <div class="ur-left">
              <div class="ur-icon icon-amber">🎂</div>
              <div>
                <div class="ur-title" style="font-weight: 700;">${escapeHtml(c.name)}</div>
                <div class="ur-sub">Birthday: ${escapeHtml(c.birthday)}</div>
              </div>
            </div>
          </div>
        `).join("")}
        ${upcomingBirthdays.length === 0 ? `<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12.5px;">No birthdays in the next 30 days.</div>` : ''}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>📞 People You Haven't Contacted Recently</h2>
        <span class="pill-tag warning">${notContactedRecently.length} contacts</span>
      </div>
      <div class="upcoming-list">
        ${notContactedRecently.slice(0, 3).map(c => `
          <div class="upcoming-row">
            <div class="ur-left">
              <div class="ur-icon icon-blue">📞</div>
              <div>
                <div class="ur-title" style="font-weight: 700;">${escapeHtml(c.name)}</div>
                <div class="ur-sub">Last contacted: ${escapeHtml(c.lastContacted || 'Never recorded')}</div>
              </div>
            </div>
          </div>
        `).join("")}
        ${notContactedRecently.length === 0 ? `<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12.5px;">All contacts recently updated!</div>` : ''}
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
      <div>
        <h2>👥 Contact Directory</h2>
        <div class="sub">Manage personal, family, professional, and client contacts</div>
      </div>
      <select onchange="contactsRelationshipFilter = this.value; renderMain();" style="padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 12.5px; font-weight: 600;">
        <option value="All" ${contactsRelationshipFilter === 'All' ? 'selected' : ''}>All Relationships</option>
        <option value="Family" ${contactsRelationshipFilter === 'Family' ? 'selected' : ''}>Family</option>
        <option value="Friend" ${contactsRelationshipFilter === 'Friend' ? 'selected' : ''}>Friend</option>
        <option value="Colleague" ${contactsRelationshipFilter === 'Colleague' ? 'selected' : ''}>Colleague</option>
        <option value="Teacher" ${contactsRelationshipFilter === 'Teacher' ? 'selected' : ''}>Teacher</option>
        <option value="Client" ${contactsRelationshipFilter === 'Client' ? 'selected' : ''}>Client</option>
        <option value="Other" ${contactsRelationshipFilter === 'Other' ? 'selected' : ''}>Other</option>
      </select>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; margin-top: 16px;">
      ${contactsList.map(c => `
        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 12px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <span style="font-weight: 700; font-size: 15px; color: #0f172a;">${escapeHtml(c.name)}</span>
            <span class="cat-badge Utilities">${escapeHtml(c.relationship || 'Other')}</span>
          </div>
          <div style="font-size: 12.5px; color: #475569; margin-bottom: 4px;">📞 ${escapeHtml(c.phone || 'N/A')}</div>
          <div style="font-size: 12.5px; color: #475569; margin-bottom: 4px;">✉️ ${escapeHtml(c.email || 'N/A')}</div>
          ${c.birthday ? `<div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">🎂 Birthday: ${escapeHtml(c.birthday)}</div>` : ''}
          <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
            <button class="action-btn danger-btn" onclick="deleteContact(${c.id})">🗑 Delete</button>
          </div>
        </div>
      `).join("")}

      ${contactsList.length === 0 ? `
        <div style="grid-column: span 2; padding: 40px 20px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 36px; margin-bottom: 8px;">👤</div>
          <div style="font-weight: 700; color: #1e293b;">No contacts added yet</div>
          <div style="font-size: 13px;">Add your first contact below!</div>
        </div>` : ''}
    </div>

    <div style="margin-top: 24px; background: #f8fafc; padding: 18px; border-radius: 12px; border: 1px solid var(--border-color);">
      <div style="font-weight: 700; font-size: 13.5px; margin-bottom: 12px; color: #0f172a;">➕ Add New Contact</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <input type="text" id="contactNameInput" placeholder="Name *" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="text" id="contactPhoneInput" placeholder="Phone Number" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="email" id="contactEmailInput" placeholder="Email Address" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <select id="contactRelSelect" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
          <option value="Family">Family</option>
          <option value="Friend">Friend</option>
          <option value="Colleague">Colleague</option>
          <option value="Teacher">Teacher</option>
          <option value="Client">Client</option>
          <option value="Other">Other</option>
        </select>
        <input type="date" id="contactBirthdayInput" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="date" id="contactLastContactedInput" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <button class="action-btn pay-btn" onclick="saveContact()" style="grid-column: span 2; padding: 10px;">Save Contact</button>
      </div>
    </div>
  </div>`;
}

function saveContact() {
  const name = document.getElementById("contactNameInput").value.trim();
  if (!name) { showToast("Please enter contact name"); return; }
  const phone = document.getElementById("contactPhoneInput").value.trim();
  const email = document.getElementById("contactEmailInput").value.trim();
  const relationship = document.getElementById("contactRelSelect").value;
  const birthday = document.getElementById("contactBirthdayInput").value;
  const lastContacted = document.getElementById("contactLastContactedInput").value;

  if (!state.contacts) state.contacts = [];
  state.contacts.push({ id: Date.now(), userId: currentUser, name, phone, email, relationship, birthday, lastContacted });
  saveSessionData();
  renderMain();
  showToast(`Contact "${name}" saved!`);
}

function deleteContact(id) {
  state.contacts = (state.contacts || []).filter(c => c.id !== id);
  saveSessionData();
  renderMain();
}



/* ==========================================================================
   ASSETS MODULE (VEHICLES, WARRANTIES, IMPORTANT IDs)
   ========================================================================== */
function switchAssetsTab(tab) {
  activeAssetsTab = tab;
  renderMain();
}

function viewAssets() {
  if (!currentUser) return '<div class="card"><p>Please log in to view Assets.</p></div>';

  return `
  <div class="subnav-bar">
    <button class="subnav-btn ${activeAssetsTab === 'vehicles' ? 'active' : ''}" onclick="switchAssetsTab('vehicles')">🚗 Vehicles</button>
    <button class="subnav-btn ${activeAssetsTab === 'warranties' ? 'active' : ''}" onclick="switchAssetsTab('warranties')">🛡️ Warranties</button>
    <button class="subnav-btn ${activeAssetsTab === 'ids' ? 'active' : ''}" onclick="switchAssetsTab('ids')">🔒 Important IDs</button>
  </div>

  ${activeAssetsTab === 'vehicles' ? renderVehiclesSection()
    : activeAssetsTab === 'warranties' ? renderWarrantiesSection()
    : renderImportantIdsSection()}
  `;
}

function renderVehiclesSection() {
  const todayIso = new Date().toISOString().split("T")[0];
  const list = state.vehicles || [];

  return `
  <div class="card">
    <div class="card-header">
      <div>
        <h2>🚗 Vehicle Management</h2>
        <div class="sub">Track vehicle insurance, PUC, registration, and service schedules</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-top: 14px;">
      ${list.map(v => {
        const insStatus = !v.insuranceExpiry ? 'Safe' : v.insuranceExpiry < todayIso ? 'Expired' : (new Date(v.insuranceExpiry) - new Date(todayIso)) / 86400000 <= 30 ? 'Expiring Soon' : 'Safe';
        const pucStatus = !v.pucExpiry ? 'Safe' : v.pucExpiry < todayIso ? 'Expired' : (new Date(v.pucExpiry) - new Date(todayIso)) / 86400000 <= 15 ? 'Expiring Soon' : 'Safe';

        return `
          <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 14px; padding: 18px; box-shadow: var(--shadow-sm);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
              <div>
                <div style="font-weight: 800; font-size: 16px; color: #0f172a;">${escapeHtml(v.name)}</div>
                <div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(v.manufacturer || '')} ${escapeHtml(v.model || '')} • ${escapeHtml(v.vehicleType || 'Vehicle')}</div>
              </div>
              <span class="num" style="font-weight: 700; font-size: 13px; background: #f1f5f9; padding: 4px 8px; border-radius: 6px;">${escapeHtml(v.regNumber)}</span>
            </div>

            <div style="font-size: 12.5px; display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between;">
                <span>Insurance: <b>${v.insuranceExpiry || 'N/A'}</b></span>
                <span class="badge-status-${insStatus === 'Safe' ? 'safe' : insStatus === 'Expiring Soon' ? 'expiring' : 'expired'}">${insStatus}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>PUC: <b>${v.pucExpiry || 'N/A'}</b></span>
                <span class="badge-status-${pucStatus === 'Safe' ? 'safe' : pucStatus === 'Expiring Soon' ? 'expiring' : 'expired'}">${pucStatus}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Next Service: <b>${v.nextServiceDate || 'N/A'}</b></span>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end;">
              <button class="action-btn danger-btn" onclick="deleteVehicle(${v.id})">🗑 Delete</button>
            </div>
          </div>
        `;
      }).join("")}

      ${list.length === 0 ? `
        <div style="grid-column: span 2; padding: 40px 20px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 36px; margin-bottom: 8px;">🚗</div>
          <div style="font-weight: 700; color: #1e293b;">No vehicles added</div>
          <div style="font-size: 13px;">Add a vehicle to track insurance, PUC, registration, and service dates.</div>
        </div>` : ''}
    </div>

    <div style="margin-top: 24px; background: #f8fafc; padding: 18px; border-radius: 12px; border: 1px solid var(--border-color);">
      <div style="font-weight: 700; font-size: 13.5px; margin-bottom: 12px; color: #0f172a;">➕ Add New Vehicle</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <input type="text" id="vNameInput" placeholder="Vehicle Name (e.g. My Honda City)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="text" id="vNumberInput" placeholder="Registration Number (e.g. KA 01 AB 1234)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <select id="vTypeSelect" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
          <option value="Car">Car</option>
          <option value="Bike / Scooter">Bike / Scooter</option>
          <option value="EV">Electric Vehicle</option>
          <option value="Other">Other Vehicle</option>
        </select>
        <input type="text" id="vModelInput" placeholder="Manufacturer / Model" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <div style="display: flex; flex-direction: column;">
          <label style="font-size: 11px; font-weight: 700; color: #64748b;">Insurance Expiry:</label>
          <input type="date" id="vInsInput" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        </div>
        <div style="display: flex; flex-direction: column;">
          <label style="font-size: 11px; font-weight: 700; color: #64748b;">PUC Expiry:</label>
          <input type="date" id="vPucInput" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        </div>
        <div style="display: flex; flex-direction: column;">
          <label style="font-size: 11px; font-weight: 700; color: #64748b;">Next Service Date:</label>
          <input type="date" id="vServiceInput" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        </div>
        <input type="text" id="vNotesInput" placeholder="Notes (Optional)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px; align-self: flex-end;">
        <button class="action-btn pay-btn" onclick="saveVehicle()" style="grid-column: span 2; padding: 10px;">Save Vehicle</button>
      </div>
    </div>
  </div>`;
}

function saveVehicle() {
  const name = document.getElementById("vNameInput").value.trim();
  const regNumber = document.getElementById("vNumberInput").value.trim();
  if (!name || !regNumber) { showToast("Please enter vehicle name and registration number"); return; }
  const vehicleType = document.getElementById("vTypeSelect").value;
  const model = document.getElementById("vModelInput").value.trim();
  const insuranceExpiry = document.getElementById("vInsInput").value;
  const pucExpiry = document.getElementById("vPucInput").value;
  const nextServiceDate = document.getElementById("vServiceInput").value;
  const notes = document.getElementById("vNotesInput").value.trim();

  if (!state.vehicles) state.vehicles = [];
  state.vehicles.push({ id: Date.now(), userId: currentUser, name, regNumber, vehicleType, model, insuranceExpiry, pucExpiry, nextServiceDate, notes });
  saveSessionData();
  renderMain();
  showToast(`Vehicle "${name}" saved!`);
}

function deleteVehicle(id) {
  state.vehicles = (state.vehicles || []).filter(v => v.id !== id);
  saveSessionData();
  renderMain();
}

function renderWarrantiesSection() {
  const todayIso = new Date().toISOString().split("T")[0];
  const list = state.warranties || [];

  return `
  <div class="card">
    <div class="card-header">
      <div>
        <h2>🛡️ Warranty Tracker</h2>
        <div class="sub">Track product warranties, purchase receipts, and expiration countdowns</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 14px;">
      ${list.map(w => {
        const diffDays = w.expiryDate ? Math.ceil((new Date(w.expiryDate) - new Date(todayIso)) / 86400000) : -1;
        const isExpired = diffDays < 0;
        const countdownText = isExpired ? 'Warranty expired' : `Warranty expires in ${diffDays} days`;

        return `
          <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 14px; padding: 18px;">
            <div style="font-weight: 800; font-size: 16px; color: #0f172a; margin-bottom: 2px;">${escapeHtml(w.productName)}</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 10px;">Brand: <b>${escapeHtml(w.brand || 'N/A')}</b> • Store: ${escapeHtml(w.sellerStore || 'N/A')}</div>

            <div style="margin-bottom: 12px;">
              <span class="pill-tag ${isExpired ? 'urgent' : diffDays <= 30 ? 'warning' : 'info'}">${countdownText}</span>
            </div>

            <div style="font-size: 12px; color: #475569; display: flex; flex-direction: column; gap: 4px;">
              <div>Purchase Date: <b>${w.purchaseDate || 'N/A'}</b></div>
              <div>Expiry Date: <b>${w.expiryDate || 'N/A'}</b></div>
              ${w.price ? `<div>Price: <b>₹${w.price}</b></div>` : ''}
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
              <button class="action-btn danger-btn" onclick="deleteWarranty(${w.id})">🗑 Delete</button>
            </div>
          </div>
        `;
      }).join("")}

      ${list.length === 0 ? `
        <div style="grid-column: span 2; padding: 40px 20px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 36px; margin-bottom: 8px;">🛡️</div>
          <div style="font-weight: 700; color: #1e293b;">No warranties added</div>
          <div style="font-size: 13px;">Add laptop, phone, appliance, or gadget warranties below!</div>
        </div>` : ''}
    </div>

    <div style="margin-top: 24px; background: #f8fafc; padding: 18px; border-radius: 12px; border: 1px solid var(--border-color);">
      <div style="font-weight: 700; font-size: 13.5px; margin-bottom: 12px; color: #0f172a;">➕ Add New Warranty</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <input type="text" id="wProductInput" placeholder="Product Name (e.g. MacBook Air)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="text" id="wBrandInput" placeholder="Brand / Manufacturer" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="date" id="wPurchaseDateInput" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="date" id="wExpiryDateInput" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="number" id="wPriceInput" placeholder="Purchase Price (₹)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="text" id="wSellerInput" placeholder="Store / Seller" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <button class="action-btn pay-btn" onclick="saveWarranty()" style="grid-column: span 2; padding: 10px;">Save Warranty</button>
      </div>
    </div>
  </div>`;
}

function saveWarranty() {
  const productName = document.getElementById("wProductInput").value.trim();
  const expiryDate = document.getElementById("wExpiryDateInput").value;
  if (!productName || !expiryDate) { showToast("Please provide product name and expiry date"); return; }
  const brand = document.getElementById("wBrandInput").value.trim();
  const purchaseDate = document.getElementById("wPurchaseDateInput").value;
  const price = parseFloat(document.getElementById("wPriceInput").value) || 0;
  const sellerStore = document.getElementById("wSellerInput").value.trim();

  if (!state.warranties) state.warranties = [];
  state.warranties.push({ id: Date.now(), userId: currentUser, productName, brand, purchaseDate, expiryDate, price, sellerStore });
  saveSessionData();
  renderMain();
  showToast(`Warranty for "${productName}" saved!`);
}

function deleteWarranty(id) {
  state.warranties = (state.warranties || []).filter(w => w.id !== id);
  saveSessionData();
  renderMain();
}

function handleIdPdfSelect(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showToast("Please upload a PDF document (.pdf)");
      input.value = "";
      selectedIdPdfFile = null;
      const label = document.getElementById("idFileLabel");
      if (label) label.textContent = "Choose PDF Document...";
      return;
    }
    selectedIdPdfFile = file;
    const label = document.getElementById("idFileLabel");
    if (label) label.textContent = "📎 " + file.name;
  }
}

function viewVehiclePdf(id) {
  if (!currentUser) return;
  const item = (state.importantIds || []).find(i => i.id === id && (!i.userId || i.userId === currentUser));
  if (!item) {
    showToast("Document record not found.");
    return;
  }
  const pdfData = item.documentFile || item.fileData;
  if (!pdfData) {
    showToast("No physical PDF file was attached to this record.");
    return;
  }

  const docTitle = item.fileName || item.documentType || item.idType || "Vehicle Document";

  try {
    const win = window.open();
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${escapeHtml(docTitle)}</title>
          <style>
            html, body { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; background: #323639; }
            iframe { width: 100%; height: 100%; border: none; }
          </style>
        </head>
        <body>
          <iframe src="${pdfData}"></iframe>
        </body>
        </html>
      `);
      win.document.close();
    } else {
      showToast("Pop-up blocked. Please allow pop-ups to view PDF.");
    }
  } catch (err) {
    console.error("Error opening PDF viewer:", err);
    showToast("Could not open PDF viewer.");
  }
}

function renderImportantIdsSection() {
  const list = (state.importantIds || []).filter(item => !item.userId || item.userId === currentUser);

  return `
  <div class="card">
    <div class="card-header">
      <div>
        <h2>🔒 Vehicle IDs & Official Documents</h2>
        <div class="sub">Secure storage for Driving License, RC, Vehicle Insurance, PUC, and official vehicle documents</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-top: 14px;">
      ${list.map(idItem => {
        const isShown = maskedIdsState[idItem.id] === true;
        const rawNum = idItem.documentNumber || idItem.idNumber || '';
        const displayNum = isShown ? escapeHtml(rawNum) : maskIdNumber(rawNum);
        const docType = escapeHtml(idItem.documentType || idItem.idType || 'Vehicle Document');

        return `
          <div class="id-card">
            <div class="id-card-top">
              <span class="id-card-type">🚗 ${docType}</span>
              ${rawNum ? `
                <button class="id-toggle-btn" onclick="toggleIdMask(${idItem.id})">${isShown ? '🙈 Hide' : '👁 Show'}</button>
              ` : ''}
            </div>

            ${rawNum ? `<div class="id-number-display">${displayNum}</div>` : ''}

            <div style="font-size: 12px; color: #cbd5e1; display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px;">
              ${idItem.fileName ? `<div style="color: #a5b4fc; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📄 ${escapeHtml(idItem.fileName)}</div>` : ''}
              <div style="display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
                <span>Issue: <b>${escapeHtml(idItem.issueDate || 'N/A')}</b></span>
                <span>Expiry: <b>${escapeHtml(idItem.expiryDate || 'N/A')}</b></span>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; border-top: 1px solid rgba(255,255,255,0.12); padding-top: 10px; margin-top: 6px;">
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                ${(idItem.documentFile || idItem.fileData) ? `
                  <button type="button" onclick="viewVehiclePdf(${idItem.id})" style="background: #eef2ff; color: #4f46e5; border: 1px solid #c7d2fe; padding: 5px 10px; font-weight: 700; font-size: 11.5px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                    👁 View
                  </button>
                  <a href="${idItem.documentFile || idItem.fileData}" download="${escapeHtml(idItem.fileName || docType + '.pdf')}" style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; text-decoration: none; padding: 5px 10px; font-weight: 700; font-size: 11.5px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                    ⬇ Download
                  </a>
                ` : ''}
              </div>
              <button class="action-btn danger-btn" onclick="deleteImportantId(${idItem.id})" style="font-size: 11px; padding: 5px 10px;">🗑 Delete</button>
            </div>
          </div>
        `;
      }).join("")}

      ${list.length === 0 ? `
        <div style="grid-column: 1 / -1; padding: 40px 20px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 36px; margin-bottom: 8px;">🚗</div>
          <div style="font-weight: 700; color: #1e293b;">No vehicle documents saved yet</div>
          <div style="font-size: 13px;">Save your Driving License, RC, Insurance, PUC, or other vehicle records below!</div>
        </div>` : ''}
    </div>

    <!-- Add Vehicle Document Form -->
    <div style="margin-top: 24px; background: #f8fafc; padding: 18px; border-radius: 12px; border: 1px solid var(--border-color);">
      <div style="font-weight: 700; font-size: 13.5px; margin-bottom: 12px; color: #0f172a;">➕ Add Vehicle Document / ID Record</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div style="display: flex; flex-direction: column;">
          <label style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 3px;">Document Type *</label>
          <select id="idTypeSelect" style="padding: 9px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px; background: #ffffff; color: var(--text-main); font-weight: 600; cursor: pointer;">
            <option value="Driving License" selected>Driving License</option>
            <option value="Vehicle Registration Certificate (RC)">Vehicle Registration Certificate (RC)</option>
            <option value="Vehicle Insurance">Vehicle Insurance</option>
            <option value="Pollution Under Control (PUC)">Pollution Under Control (PUC)</option>
            <option value="Vehicle Permit">Vehicle Permit</option>
            <option value="Vehicle Fitness Certificate">Vehicle Fitness Certificate</option>
            <option value="Road Tax Receipt">Road Tax Receipt</option>
            <option value="Vehicle Purchase Document">Vehicle Purchase Document</option>
            <option value="Vehicle Warranty Document">Vehicle Warranty Document</option>
            <option value="Other Vehicle Document">Other Vehicle Document</option>
          </select>
        </div>

        <div style="display: flex; flex-direction: column;">
          <label style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 3px;">ID / Document Number</label>
          <input type="text" id="idNumberInput" placeholder="e.g. DL-1420110012345 or RC number" style="padding: 9px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        </div>

        <div style="display: flex; flex-direction: column;">
          <label style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 3px;">Issue Date</label>
          <input type="date" id="idIssueInput" style="padding: 9px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        </div>

        <div style="display: flex; flex-direction: column;">
          <label style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 3px;">Expiry Date</label>
          <input type="date" id="idExpiryInput" style="padding: 9px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        </div>

        <div style="grid-column: span 2; display: flex; flex-direction: column;">
          <label style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 3px;">Choose Vehicle Document (PDF Only)</label>
          <input type="file" id="idFileInput" accept=".pdf,application/pdf" style="display: none;" onchange="handleIdPdfSelect(this)">
          <button type="button" onclick="document.getElementById('idFileInput').click()" style="background: #ffffff; border: 1px solid var(--border-color); padding: 9px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 600; cursor: pointer; color: #334155; display: flex; align-items: center; gap: 6px; width: 100%;">
            📄 <span id="idFileLabel">${selectedIdPdfFile ? '📎 ' + selectedIdPdfFile.name : 'Choose PDF Document...'}</span>
          </button>
        </div>

        <button class="action-btn pay-btn" onclick="saveImportantId()" style="grid-column: span 2; padding: 10px; font-weight: 700; font-size: 13.5px; margin-top: 4px;">
          💾 Save ID Record
        </button>
      </div>
    </div>
  </div>`;
}

function maskIdNumber(numStr) {
  if (!numStr) return "XXXX XXXX XXXX";
  const str = String(numStr).trim();
  if (str.length <= 4) return "XXXX " + str;
  return "XXXX XXXX " + str.slice(-4);
}

function toggleIdMask(id) {
  maskedIdsState[id] = !maskedIdsState[id];
  renderMain();
}

function saveImportantId() {
  const docTypeSelect = document.getElementById("idTypeSelect");
  const documentType = docTypeSelect ? docTypeSelect.value : "Driving License";
  const documentNumber = document.getElementById("idNumberInput") ? document.getElementById("idNumberInput").value.trim() : "";
  const issueDate = document.getElementById("idIssueInput") ? document.getElementById("idIssueInput").value : "";
  const expiryDate = document.getElementById("idExpiryInput") ? document.getElementById("idExpiryInput").value : "";
  const fileInput = document.getElementById("idFileInput");
  const file = selectedIdPdfFile || (fileInput && fileInput.files ? fileInput.files[0] : null);

  if (file && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    showToast("Please upload a PDF document (.pdf)");
    return;
  }

  const newRecord = {
    id: Date.now(),
    userId: currentUser,
    idType: documentType,
    documentType: documentType,
    idNumber: documentNumber,
    documentNumber: documentNumber,
    issueDate: issueDate,
    expiryDate: expiryDate,
    documentFile: "",
    fileData: "",
    fileName: file ? file.name : ""
  };

  if (!state.importantIds) state.importantIds = [];

  const finishSave = () => {
    state.importantIds.unshift(newRecord);
    saveSessionData();
    selectedIdPdfFile = null;
    renderMain();
    showToast(`Vehicle document "${documentType}" saved!`);
  };

  if (file) {
    const reader = new FileReader();
    reader.onload = e => {
      newRecord.documentFile = e.target.result;
      newRecord.fileData = e.target.result;
      finishSave();
    };
    reader.readAsDataURL(file);
  } else {
    finishSave();
  }
}

function deleteImportantId(id) {
  if (!currentUser) return;
  state.importantIds = (state.importantIds || []).filter(i => (i.id !== id) || (i.userId && i.userId !== currentUser));
  saveSessionData();
  renderMain();
  showToast("Vehicle document deleted");
}

/* ==========================================================================
   GLOBAL SEARCH & NOTIFICATION ALERT CENTER LOGIC
   ========================================================================== */
function handleGlobalSearch(query) {
  const container = document.getElementById("globalSearchResults");
  if (!container) return;
  if (!query || query.trim().length < 2) {
    container.style.display = "none";
    return;
  }

  const q = query.trim().toLowerCase();
  const results = [];

  (state.bills || []).forEach(b => {
    if ((b.name && b.name.toLowerCase().includes(q)) || (b.category && b.category.toLowerCase().includes(q))) {
      results.push({ category: "Bills", title: b.name, date: b.due, status: b.status, view: "Bills" });
    }
  });

  (state.documents || []).forEach(d => {
    const t = d.documentTitle || d.name || "";
    if (t.toLowerCase().includes(q) || (d.documentType || "").toLowerCase().includes(q)) {
      results.push({ category: "Documents", title: t, date: d.date || "", status: d.category || "Document", view: "Documents" });
    }
  });

  (state.appointments || []).forEach(a => {
    if ((a.title && a.title.toLowerCase().includes(q)) || (a.category && a.category.toLowerCase().includes(q))) {
      results.push({ category: "Appointments", title: a.title, date: a.date, status: a.category, view: "Appointments" });
    }
  });

  (state.healthRecords || []).forEach(h => {
    if ((h.title && h.title.toLowerCase().includes(q)) || (h.type && h.type.toLowerCase().includes(q)) || (h.doctor && h.doctor.toLowerCase().includes(q))) {
      results.push({ category: "Health", title: h.title, date: h.date, status: h.type, view: "Health & Wellness" });
    }
  });

  (state.notes || []).forEach(n => {
    if ((n.title && n.title.toLowerCase().includes(q)) || (n.content && n.content.toLowerCase().includes(q)) || (n.category && n.category.toLowerCase().includes(q))) {
      results.push({ category: "Notes", title: n.title, date: n.date, status: n.category, view: "Notes & Journal" });
    }
  });

  (state.contacts || []).forEach(c => {
    if ((c.name && c.name.toLowerCase().includes(q)) || (c.email && c.email.toLowerCase().includes(q)) || (c.phone && c.phone.includes(q))) {
      results.push({ category: "Contacts", title: c.name, date: c.lastContacted ? `Contacted: ${c.lastContacted}` : "", status: c.relationship, view: "Contacts" });
    }
  });



  (state.vehicles || []).forEach(v => {
    if ((v.name && v.name.toLowerCase().includes(q)) || (v.regNumber && v.regNumber.toLowerCase().includes(q))) {
      results.push({ category: "Vehicles", title: `${v.name} (${v.regNumber})`, date: `Service: ${v.nextServiceDate || 'N/A'}`, status: v.vehicleType || "Vehicle", view: "Assets" });
    }
  });

  (state.warranties || []).forEach(w => {
    if ((w.productName && w.productName.toLowerCase().includes(q)) || (w.brand && w.brand.toLowerCase().includes(q))) {
      results.push({ category: "Warranties", title: `${w.brand ? w.brand + ' ' : ''}${w.productName}`, date: `Expires: ${w.expiryDate}`, status: "Warranty", view: "Assets" });
    }
  });

  if (results.length === 0) {
    container.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12.5px;">No results found for "${escapeHtml(query)}"</div>`;
  } else {
    container.innerHTML = results.slice(0, 10).map(r => `
      <div class="search-result-item" onclick="navigateFromSearch('${r.view}')">
        <div class="search-result-header">
          <span class="search-result-title">${escapeHtml(r.title)}</span>
          <span class="search-result-cat">${r.category}</span>
        </div>
        <div class="search-result-sub">${r.date ? r.date + ' • ' : ''}${r.status}</div>
      </div>
    `).join("");
  }
  container.style.display = "block";
}

function navigateFromSearch(viewName) {
  activeView = viewName;
  const searchInput = document.getElementById("globalSearchInput");
  const searchDropdown = document.getElementById("globalSearchResults");
  if (searchInput) searchInput.value = "";
  if (searchDropdown) searchDropdown.style.display = "none";
  renderNav();
  renderMain();
}

function checkAlerts() {
  const badge = document.getElementById("notifCountBadge");
  const list = document.getElementById("notifList");
  if (!badge || !list) return;

  const todayIso = new Date().toISOString().split("T")[0];
  const alerts = [];

  (state.bills || []).forEach(b => {
    if (b.status !== "Paid" && b.due) {
      if (b.due < todayIso) {
        alerts.push({ type: "urgent", icon: "🧾", title: `Overdue Bill: ${b.name}`, text: `Due date was ${b.due}. Amount: ₹${b.amount}` });
      } else {
        const diffDays = Math.ceil((new Date(b.due) - new Date(todayIso)) / (86400000));
        if (diffDays <= 7) {
          alerts.push({ type: "due_soon", icon: "🧾", title: `Bill Due Soon: ${b.name}`, text: `Due in ${diffDays} day(s) (${b.due}). Amount: ₹${b.amount}` });
        }
      }
    }
  });

  (state.appointments || []).forEach(a => {
    if (a.date && a.date >= todayIso) {
      const diffDays = Math.ceil((new Date(a.date) - new Date(todayIso)) / (86400000));
      if (diffDays <= 3) {
        alerts.push({ type: "due_soon", icon: "🩺", title: `Doctor/Appt: ${a.title}`, text: `Scheduled for ${a.date} at ${a.time || '10:00 AM'}` });
      }
    }
  });

  (state.vehicles || []).forEach(v => {
    if (v.insuranceExpiry) {
      if (v.insuranceExpiry < todayIso) {
        alerts.push({ type: "urgent", icon: "🚗", title: `Insurance Expired: ${v.name}`, text: `Insurance expired on ${v.insuranceExpiry}` });
      } else {
        const diffDays = Math.ceil((new Date(v.insuranceExpiry) - new Date(todayIso)) / (86400000));
        if (diffDays <= 30) {
          alerts.push({ type: "due_soon", icon: "🚗", title: `Insurance Expiring: ${v.name}`, text: `Expires in ${diffDays} day(s) (${v.insuranceExpiry})` });
        }
      }
    }
  });

  (state.warranties || []).forEach(w => {
    if (w.expiryDate) {
      if (w.expiryDate < todayIso) {
        alerts.push({ type: "urgent", icon: "🛡️", title: `Warranty Expired: ${w.productName}`, text: `Expired on ${w.expiryDate}` });
      } else {
        const diffDays = Math.ceil((new Date(w.expiryDate) - new Date(todayIso)) / (86400000));
        if (diffDays <= 30) {
          alerts.push({ type: "due_soon", icon: "🛡️", title: `Warranty Expiring Soon: ${w.productName}`, text: `Expires in ${diffDays} day(s)` });
        }
      }
    }
  });



  if (alerts.length > 0) {
    badge.textContent = alerts.length;
    badge.style.display = "inline-block";
    list.innerHTML = alerts.map(a => `
      <div class="notif-item ${a.type}">
        <div class="notif-icon">${a.icon}</div>
        <div class="notif-content">
          <div class="notif-title">${escapeHtml(a.title)}</div>
          <div class="notif-sub">${escapeHtml(a.text)}</div>
        </div>
      </div>
    `).join("");
  } else {
    badge.style.display = "none";
    list.innerHTML = `<div class="notif-empty">✓ No active alerts. All reminders and expiries up to date!</div>`;
  }
}

function toggleNotifDrawer() {
  const drawer = document.getElementById("notifDrawer");
  if (!drawer) return;
  drawer.style.display = drawer.style.display === "none" ? "block" : "none";
}

function logoutUser() {
  currentUser = null;
  localStorage.removeItem("lifeledger_currentUser");
  const authScreen = document.getElementById("authScreen");
  const appShell = document.getElementById("appShell");
  if (appShell) appShell.style.display = "none";
  if (authScreen) authScreen.style.display = "flex";
  showToast("Logged out successfully!");
}

function attachGlobalHeaderEvents() {
  const gSearch = document.getElementById("globalSearchInput");
  if (gSearch && !gSearch.dataset.bound) {
    gSearch.dataset.bound = "true";
    gSearch.addEventListener("input", e => handleGlobalSearch(e.target.value));
  }
  const notifBtn = document.getElementById("notifBellBtn");
  if (notifBtn && !notifBtn.dataset.bound) {
    notifBtn.dataset.bound = "true";
    notifBtn.addEventListener("click", toggleNotifDrawer);
  }
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = "true";
    logoutBtn.addEventListener("click", logoutUser);
  }
}

// INITIAL STATE & LIVE DATE TIMER
(function initApp() {
  const restoredUser = loadSessionData();
  if (restoredUser) {
    enterApp(restoredUser, usersDB[restoredUser].name);
  } else {
    authScreen.style.display = "flex";
    appShell.style.display = "none";
  }
  attachGlobalHeaderEvents();
  setInterval(updateLiveDate, 1000);
  updateLiveDate();
})();

