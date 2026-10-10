/* ==========================================================================
   LIFELEDGER AI — INTELLIGENT LIFE DASHBOARD
   User Authentication & Blank State Life Analytics Engine
   ========================================================================== */

function getDefaultTimetablePeriods() {
  return [
    { id: "period_1", name: "Period 1: Morning Focus", startTime: "08:30", endTime: "10:00", color: "#4f46e5" },
    { id: "period_2", name: "Period 2: Core Work & Study", startTime: "10:15", endTime: "11:45", color: "#059669" },
    { id: "period_3", name: "Period 3: Projects & Practice", startTime: "12:00", endTime: "13:30", color: "#0284c7" },
    { id: "period_4", name: "Period 4: Afternoon Tasks", startTime: "14:30", endTime: "16:00", color: "#d97706" },
    { id: "period_5", name: "Period 5: Review & Assignments", startTime: "16:15", endTime: "17:45", color: "#7c3aed" },
    { id: "period_6", name: "Period 6: Evening Wrap-up & Planning", startTime: "18:30", endTime: "20:00", color: "#e11d48" }
  ];
}

// Clean blank state for user session — no pre-filled sample data!
function blankState() {
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return {
    profile: {
      name: "",
      phone: "",
      bio: "",
      createdAt: now.toISOString()
    },
    startMonth: currentKey,
    startingBalance: null,
    monthlyBalances: {},
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
    timetablePeriods: getDefaultTimetablePeriods(),
    timetableTasks: [],
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

function sanitizeUserState(targetState, userEmail) {
  if (!targetState || typeof targetState !== 'object') return targetState;

  // 1. Wipe mock startingBalance
  if (targetState.startingBalance !== null && targetState.startingBalance !== undefined) {
    targetState.startingBalance = null;
  }

  // 2. Wipe any mock monthlyBalances from 2026-09 with 2700
  if (targetState.monthlyBalances && typeof targetState.monthlyBalances === 'object') {
    if (targetState.monthlyBalances["2026-09"] !== undefined) {
      const val = Number(targetState.monthlyBalances["2026-09"]);
      if (val === 2700 || isNaN(val)) {
        delete targetState.monthlyBalances["2026-09"];
      }
    }
  }

  // 3. For users with no transactions prior to the current active month, ensure startMonth is current active month
  const actualCurrent = (typeof getActualCurrentMonthKey === 'function') ? getActualCurrentMonthKey() : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const hasPastActivity = (
    (Array.isArray(targetState.income) && targetState.income.some(i => { const k = typeof getMonthYearKey === 'function' ? getMonthYearKey(i.date) : ""; return k && k < actualCurrent; })) ||
    (Array.isArray(targetState.expenses) && targetState.expenses.some(e => { const k = typeof getMonthYearKey === 'function' ? getMonthYearKey(e.date) : ""; return k && k < actualCurrent; })) ||
    (Array.isArray(targetState.bills) && targetState.bills.some(b => { const k = typeof getMonthYearKey === 'function' ? getMonthYearKey(b.due || b.dueDate) : ""; return k && k < actualCurrent; })) ||
    (targetState.monthlyBalances && typeof targetState.monthlyBalances === 'object' && Object.keys(targetState.monthlyBalances).some(k => k && k < actualCurrent && targetState.monthlyBalances[k] !== undefined && targetState.monthlyBalances[k] !== null))
  );

  if (!hasPastActivity) {
    if (!targetState.startMonth || targetState.startMonth < actualCurrent) {
      targetState.startMonth = actualCurrent;
    }
  }

  // 4. Ensure Timetable Periods and Tasks structure
  if (!targetState.timetablePeriods || !Array.isArray(targetState.timetablePeriods) || targetState.timetablePeriods.length === 0) {
    targetState.timetablePeriods = getDefaultTimetablePeriods();
  }
  if (!targetState.timetableTasks || !Array.isArray(targetState.timetableTasks)) {
    targetState.timetableTasks = [];
  }

  return targetState;
}

// In-memory database of registered user accounts for browser tab session.
let usersDB = {};
let currentUser = null;
let state = sanitizeUserState(blankState());
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
  const expenseDate = (bill.status === "Paid" && bill.paidDate) ? bill.paidDate : (bill.due || new Date().toISOString().split("T")[0]);
  const monthKey = getMonthYearKey(expenseDate);

  const existingIndex = state.expenses.findIndex(e => (e.sourceType === "bill" || e.source === "bill") && (e.sourceId === bill.id || e.id === bill.id));

  if (existingIndex !== -1) {
    state.expenses[existingIndex].amount = bill.amount;
    state.expenses[existingIndex].desc = `Bill: ${bill.name}`;
    state.expenses[existingIndex].category = mappedCategory;
    state.expenses[existingIndex].date = expenseDate;
    state.expenses[existingIndex].billingPeriod = monthKey;
    state.expenses[existingIndex].paidFrom = bill.paidFrom || "income";
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
      date: expenseDate,
      paidFrom: bill.paidFrom || "income"
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

  if (state.monthlyBalances) {
    Object.keys(state.monthlyBalances).forEach(k => {
      if (k) set.add(k);
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

    // Ensure state.profile is updated and in sync with usersDB[currentUser]
    if (!state.profile) state.profile = {};
    if (usersDB[currentUser].name) state.profile.name = usersDB[currentUser].name;
    if (usersDB[currentUser].phone) state.profile.phone = usersDB[currentUser].phone;
    if (usersDB[currentUser].bio) state.profile.bio = usersDB[currentUser].bio;

    usersDB[currentUser].data = state;

    // Real-time Cloud Sync with Firebase Firestore (Single Source of Truth)
    if ((typeof navigator === 'undefined' || navigator.onLine) && window.Firebase && typeof window.Firebase.syncUserDataToCloud === "function") {
      window.Firebase.syncUserDataToCloud(currentUser, state);
    }
  }
}

function loadSessionData() {
  try {
    const activeUser = currentUser || (window.Firebase && window.Firebase.auth && window.Firebase.auth.currentUser ? window.Firebase.auth.currentUser.email : null);
    if (activeUser) {
      currentUser = String(activeUser).trim().toLowerCase();
      if (!usersDB[currentUser]) {
        usersDB[currentUser] = { name: currentUser.split("@")[0], data: blankState() };
      }
      state = sanitizeUserState(usersDB[currentUser].data || blankState(), currentUser);
      usersDB[currentUser].data = state;

      const applyCloudSync = (cloudData) => {
        if (cloudData && typeof cloudData === 'object' && Object.keys(cloudData).length > 0) {
          state = sanitizeUserState({ ...blankState(), ...state, ...cloudData }, currentUser);
          if (currentUser) {
            if (!usersDB[currentUser]) {
              usersDB[currentUser] = { name: (state.profile && state.profile.name) || currentUser.split("@")[0], data: state };
            }
            if (state.profile) {
              if (state.profile.name) usersDB[currentUser].name = state.profile.name;
              if (state.profile.phone) usersDB[currentUser].phone = state.profile.phone;
              if (state.profile.bio) usersDB[currentUser].bio = state.profile.bio;
            }
            usersDB[currentUser].data = state;
          }
          const displayName = (currentUser && usersDB[currentUser] && usersDB[currentUser].name) || (state.profile && state.profile.name) || (currentUser ? currentUser.split("@")[0] : "User");
          if (document.getElementById("profileName")) document.getElementById("profileName").textContent = displayName;
          if (document.getElementById("profileAvatar")) document.getElementById("profileAvatar").textContent = displayName.split(" ").map(n => n[0]).join("").toUpperCase() || "U";
          
          if (document.getElementById("userProfileModal") && document.getElementById("userProfileModal").style.display !== "none") {
            openUserProfileModal();
          }
          if (typeof renderMain === 'function' && currentUser) {
            renderMain();
          }
        }
      };

      // Async fetch cloud state from Firebase Firestore
      if (typeof navigator === 'undefined' || navigator.onLine) {
        if (window.Firebase && typeof window.Firebase.fetchUserDataFromCloud === "function") {
          window.Firebase.fetchUserDataFromCloud(currentUser).then(cloudData => {
            applyCloudSync(cloudData);
          }).catch(() => {});
        }

        // Real-time live NoSQL Firestore subscription listener across browser tabs / devices
        if (window.Firebase && typeof window.Firebase.subscribeToCloudData === "function") {
          window.Firebase.subscribeToCloudData(currentUser, (cloudData) => {
            applyCloudSync(cloudData);
          });
        }
      }

      return currentUser;
    }
  } catch (e) {
    console.warn("Firebase session load error:", e);
  }
  return null;
}

/* ===== LIVE DATE & TIME DISPLAY ===== */
function updateLiveDate() {
  const now = new Date();
  const optionsDate = { day: 'numeric', month: 'long', year: 'numeric' };
  const localeMap = { en: 'en-US', ta: 'ta-IN', hi: 'hi-IN', ml: 'ml-IN', te: 'te-IN', es: 'es-ES', fr: 'fr-FR' };
  const loc = (typeof currentLanguage !== "undefined" && localeMap[currentLanguage]) ? localeMap[currentLanguage] : 'en-US';
  const dateStr = now.toLocaleDateString(loc, optionsDate);
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

function totalIncomeExpenseForMonth(monthKey) {
  return getFinanceExpensesForMonth(monthKey)
    .filter(e => e.paidFrom !== "savings")
    .reduce((s, e) => s + (e.amount || 0), 0);
}

function totalSavingsExpenseForMonth(monthKey) {
  return getFinanceExpensesForMonth(monthKey)
    .filter(e => e.paidFrom === "savings")
    .reduce((s, e) => s + (e.amount || 0), 0);
}

function getActualCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getUserStartMonth() {
  if (state.startMonth) return state.startMonth;
  if (state.profile && state.profile.createdAt) {
    const k = getMonthYearKey(state.profile.createdAt);
    if (k) return k;
  }
  const allMonths = [];
  if (state.income) state.income.forEach(i => { const k = getMonthYearKey(i.date); if (k) allMonths.push(k); });
  if (state.expenses) state.expenses.forEach(e => { const k = getMonthYearKey(e.date); if (k) allMonths.push(k); });
  if (state.bills) state.bills.forEach(b => { const k = getMonthYearKey(b.due || b.dueDate); if (k) allMonths.push(k); });
  if (state.monthlyBalances) Object.keys(state.monthlyBalances).forEach(k => { if (k) allMonths.push(k); });
  if (allMonths.length > 0) {
    allMonths.sort();
    return allMonths[0];
  }
  return getActualCurrentMonthKey();
}

function getNextMonthKey(monthKey) {
  if (!monthKey || !monthKey.includes("-")) {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const [yyyy, mm] = monthKey.split("-").map(n => parseInt(n, 10));
  const d = new Date(yyyy, mm, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getCompletedMonths() {
  const currentKey = getActualCurrentMonthKey();
  const set = new Set();

  if (Array.isArray(state.income)) {
    state.income.forEach(i => {
      const k = getMonthYearKey(i.date);
      if (k && k < currentKey) set.add(k);
    });
  }
  if (Array.isArray(state.expenses)) {
    state.expenses.forEach(e => {
      const k = getMonthYearKey(e.date);
      if (k && k < currentKey) set.add(k);
    });
  }
  if (Array.isArray(state.bills)) {
    state.bills.forEach(b => {
      const k = getMonthYearKey(b.due || b.dueDate);
      if (k && k < currentKey) set.add(k);
    });
  }
  if (state.monthlyBalances && typeof state.monthlyBalances === 'object') {
    Object.keys(state.monthlyBalances).forEach(k => {
      if (k === "2026-09" && Number(state.monthlyBalances[k]) === 2700) {
        delete state.monthlyBalances[k];
        return;
      }
      if (k && k < currentKey && state.monthlyBalances[k] !== undefined && state.monthlyBalances[k] !== null) {
        set.add(k);
      }
    });
  }
  return Array.from(set).sort().reverse();
}

function isUserFirstMonth() {
  const completed = getCompletedMonths();
  return completed.length === 0;
}

function getStartingBalance() {
  if (state.startingBalance) {
    state.startingBalance = null;
  }
  return null;
}

function getPreviousMonthKey(monthKey) {
  if (!monthKey || !monthKey.includes("-")) {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const [yyyy, mm] = monthKey.split("-").map(n => parseInt(n, 10));
  const d = new Date(yyyy, mm - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function hasPreviousMonthSavings(targetMonthKey) {
  if (isUserFirstMonth()) return false;
  const currentKey = targetMonthKey || getCurrentFinanceMonthKey();
  const completed = getCompletedMonths();
  const savingsData = getMonthlySavingsData(currentKey);
  return completed.length > 0 && savingsData.lastMonthBalance > 0;
}

function getChronologicalCompletedBalances() {
  const completed = getCompletedMonths();
  if (!completed || completed.length === 0) return {};

  const chronological = completed.slice().sort();
  const results = {};
  let previousClosing = 0;

  for (const m of chronological) {
    if (state.monthlyBalances && state.monthlyBalances[m] !== undefined && state.monthlyBalances[m] !== null) {
      const customVal = Number(state.monthlyBalances[m]);
      if (!isNaN(customVal)) {
        previousClosing = customVal;
        results[m] = customVal;
        continue;
      }
    }

    const inc = totalIncomeForMonth(m);
    const incExp = totalIncomeExpenseForMonth(m);
    const savExp = totalSavingsExpenseForMonth(m);
    const netFlow = inc - incExp;

    const closing = previousClosing + netFlow - savExp;
    previousClosing = closing;
    results[m] = closing;
  }

  return results;
}

function getMonthlyBalance(monthKey) {
  if (!state.monthlyBalances) state.monthlyBalances = {};
  if (state.monthlyBalances[monthKey] !== undefined && state.monthlyBalances[monthKey] !== null) {
    const val = Number(state.monthlyBalances[monthKey]);
    if (!isNaN(val)) return val;
  }

  const completedMap = getChronologicalCompletedBalances();
  if (completedMap[monthKey] !== undefined) {
    return completedMap[monthKey];
  }

  const inc = totalIncomeForMonth(monthKey);
  const exp = totalIncomeExpenseForMonth(monthKey);
  return inc - exp;
}

function getMonthlySavingsData(targetMonthKey) {
  const monthKey = targetMonthKey || getCurrentFinanceMonthKey();
  const prevKey = getPreviousMonthKey(monthKey);

  const isFirst = isUserFirstMonth();

  let lastMonthBalance = 0;
  if (!isFirst) {
    const completedMap = getChronologicalCompletedBalances();
    if (completedMap[prevKey] !== undefined) {
      lastMonthBalance = Math.max(0, completedMap[prevKey]);
    } else {
      const prevNet = getMonthlyBalance(prevKey);
      lastMonthBalance = Math.max(0, prevNet);
    }
  }

  const currentInc = totalIncomeForMonth(monthKey);
  const currentExp = totalExpenseForMonth(monthKey);
  const incomeExp = totalIncomeExpenseForMonth(monthKey);
  const savingsExp = totalSavingsExpenseForMonth(monthKey);
  const currentNet = currentInc - incomeExp;

  const remainingRollover = Math.max(0, lastMonthBalance - savingsExp);
  // Do not add currentNet to Savings; savings only contains previous balance amount (minus savings-funded expenses)
  const totalSavings = isFirst ? 0 : remainingRollover;

  return {
    monthKey,
    prevKey,
    prevMonthLabel: getMonthYearLabel(prevKey),
    currentMonthLabel: getMonthYearLabel(monthKey),
    lastMonthBalance,
    savingsFundedExp: savingsExp,
    allTimeSavingsExp: savingsExp,
    remainingRollover,
    currentInc,
    currentExp,
    incomeFundedExp: incomeExp,
    currentNet,
    totalSavings,
    isFirstMonth: isFirst
  };
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
  const isSavingsFunded = /(from saving|out of saving|from my saving|take.*from saving|took.*from saving|withdrew.*from saving|deduct.*saving)/i.test(low);
  const todayIso = new Date().toISOString().split("T")[0];

  if (isBill && !isIncome) {
    return {
      type: "Bill",
      name: text.replace(/(?:₹|rs\.?)\s?\d[\d,]*/gi, "").replace(/is due.*$/i, "").trim() || "New Bill",
      amount,
      due: todayIso,
      paidFrom: isSavingsFunded ? "savings" : "income"
    };
  }
  if (isIncome && amount) {
    let cleanSource = text.replace(/(?:₹|rs\.?|inr|\$|,)/gi, "").replace(/\d+/g, "").replace(/received|salary|credited|earned|got paid|income/gi, "").trim();
    if (!cleanSource || cleanSource.length < 2) cleanSource = "Monthly Salary";
    return { type: "Income", amount, source: cleanSource, category: "Salary", date: todayIso };
  }
  if (amount) {
    let cleanDesc = text
      .replace(/(?:₹|rs\.?|inr|\$)/gi, "")
      .replace(/\b\d[\d,]*\b/g, "")
      .replace(/spent on|spent for|paid for|paid|took from savings|take from savings|from savings|out of savings|from saving|took from saving|spent/gi, "")
      .trim();
    if (!cleanDesc || cleanDesc.length < 2) {
      cleanDesc = isSavingsFunded ? "Taken from Savings" : "Expense";
    }
    return {
      type: "Expense",
      amount,
      category: detectCategory(text),
      desc: cleanDesc,
      date: todayIso,
      paidFrom: isSavingsFunded ? "savings" : "income"
    };
  }
  return { type: "Task", title: text.trim(), priority: low.includes("urgent") || low.includes("tomorrow") ? "high" : "medium", deadline: "Tomorrow" };
}

function handleParsed(p) {
  const todayIso = new Date().toISOString().split("T")[0];
  if (p.type === "Expense") {
    const expDate = (p.date && p.date !== "Today") ? p.date : todayIso;
    const paidFrom = p.paidFrom || "income";
    state.expenses.unshift({
      id: Date.now(),
      desc: p.desc,
      amount: p.amount,
      category: p.category,
      date: expDate,
      paidFrom
    });
    saveSessionData();
    return `<div class="pr-row">
      <span class="pr-field">Type: <b>Expense</b></span>
      <span class="pr-field">Amount: <b>${fmt(p.amount)}</b></span>
      <span class="pr-field">Category: <b>${p.category}</b></span>
      <span class="pr-field">Source: <b>${paidFrom === 'savings' ? '🏦 Savings' : '💵 Income'}</b></span>
    </div>`;
  }
  if (p.type === "Income") {
    const incDate = (p.date && p.date !== "Today") ? p.date : todayIso;
    state.income.unshift({ id: Date.now(), source: p.source, amount: p.amount, date: incDate, category: p.category || "Salary" });
    saveSessionData();
    return `<div class="pr-row"><span class="pr-field">Type: <b>Income</b></span><span class="pr-field">Amount: <b>${fmt(p.amount)}</b></span><span class="pr-field">Category: <b>${p.category || 'Salary'}</b></span></div>`;
  }
  if (p.type === "Bill") {
    const billDue = (p.due && p.due !== "Next Week") ? p.due : todayIso;
    const paidFrom = p.paidFrom || "income";
    const newBill = { id: Date.now(), name: p.name, amount: p.amount, due: billDue, status: "Upcoming", icon: "zap", paidFrom };
    state.bills.unshift(newBill);
    syncBillToFinance(newBill);
    saveSessionData();
    return `<div class="pr-row">
      <span class="pr-field">Type: <b>Bill</b></span>
      <span class="pr-field">Amount: <b>${fmt(p.amount)}</b></span>
      <span class="pr-field">Due: <b>${billDue}</b></span>
      <span class="pr-field">Source: <b>${paidFrom === 'savings' ? '🏦 Savings' : '💵 Income'}</b></span>
    </div>`;
  }
  if (!state.timetableTasks) state.timetableTasks = [];
  const todayKey = typeof getActualTodayKey === "function" ? getActualTodayKey() : new Date().toISOString().split("T")[0];
  const periods = (state.timetablePeriods && state.timetablePeriods.length) ? state.timetablePeriods : (typeof getDefaultTimetablePeriods === "function" ? getDefaultTimetablePeriods() : []);
  const periodId = periods.length > 0 ? periods[0].id : "period_1";
  state.timetableTasks.push({
    id: Date.now(),
    title: p.title,
    periodId: periodId,
    date: todayKey,
    priority: p.priority || "medium",
    done: false,
    createdAt: new Date().toISOString()
  });
  state.tasks.unshift({ id: Date.now(), title: p.title, priority: p.priority, deadline: p.deadline, done: false });
  saveSessionData();
  return `<div class="pr-row"><span class="pr-field">Type: <b>Daily Task</b></span><span class="pr-field">Title: <b>${p.title}</b></span><span class="pr-field">Priority: <b>${p.priority.toUpperCase()}</b></span></div>`;
}

/* ===== NAV ICONS ===== */
const NAV_ICONS = {
  Dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
  Finance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19V10"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M20 19H4"/></svg>`,
  Productivity: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h4"/><path d="M8 18h8"/></svg>`,
  Tasks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h4"/><path d="M8 18h8"/></svg>`,
  Bills: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>`,
  Documents: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  Appointments: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  Goals: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  "Notes & Journal": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  Contacts: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  Password: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
};

const views = ["Dashboard", "Finance", "Bills", "Productivity", "Documents", "Appointments", "Notes & Journal", "Contacts", "Password"];
let activeView = "Dashboard";

/* ==========================================================================
   MULTI-LANGUAGE LOCALIZATION (Tamil, English, Hindi, etc.)
   ========================================================================== */
let currentLanguage = localStorage.getItem("lifeleader_lang") || "en";

const TRANSLATIONS = {
  en: {
    // Navigation
    "Dashboard": "Dashboard",
    "Finance": "Finance",
    "Bills": "Bills",
    "Health & Wellness": "Health & Wellness",
    "Productivity": "Productivity",
    "Tasks": "Tasks",
    "Documents": "Documents",
    "Appointments": "Appointments",
    "Goals": "Goals",
    "Assets": "Assets",
    "Notes & Journal": "Notes & Journal",
    "Contacts": "Contacts",
    "Password": "Password",
    "Balance Settings": "Monthly Balance History",

    // Top Bar & Quick Entry
    "Search across all modules...": "Search across all modules...",
    "Search transactions, notes, goals...": "Search transactions, notes, goals...",
    "Tell LifeLedger what happened — it sorts the rest...": "Tell LifeLedger what happened — it sorts the rest...",
    "e.g. “Spent ₹450 on food today” or “Finish the ML assignment tomorrow”": "e.g. “Spent ₹450 on food today” or “Finish the ML assignment tomorrow”",
    "Add": "Add",
    "Try:": "Try:",
    "I spent ₹450 on food today": "I spent ₹450 on food today",
    "Paid electricity bill ₹1,200": "Paid electricity bill ₹1,200",
    "Received salary ₹85,000": "Received salary ₹85,000",
    "Doctor appointment next Friday at 11am": "Doctor appointment next Friday at 11am",
    "Spent ₹450 on food today": "Spent ₹450 on food today",
    "Click to view & edit profile": "Click to view & edit profile",
    "🔔 Urgent Alerts & Expiries": "🔔 Urgent Alerts & Expiries",
    "No active alerts at present.": "No active alerts at present.",

    // Dashboard View
    "MONTHLY INCOME": "MONTHLY INCOME",
    "MONTHLY EXPENSES": "MONTHLY EXPENSES",
    "NET BALANCE": "NET AMOUNT",
    "NET AMOUNT": "NET AMOUNT",
    "Net Amount": "Net Amount",
    "Net Balance": "Net Amount",
    "Remaining from income": "Remaining from income",
    "Deficit from income": "Deficit from income",
    "Savings": "Savings",
    "Spending by Category": "Spending by Category",
    "Total Expenses": "Total Expenses",
    "Income vs Expenses": "Income vs Expenses",
    "Cashflow Comparison": "Cashflow Comparison",
    "Income": "Income",
    "Expenses": "Expenses",
    "Upcoming": "Upcoming",
    "Bills and appointments scheduled": "Bills and appointments scheduled",
    "items": "items",
    "AI Insights": "AI Insights",
    "Generated from your current data": "Generated from your current data",
    "Goals in Progress": "Goals in Progress",
    "active goals": "active goals",
    "Clean Slate!": "Clean Slate!",
    "Log your first expense, income, bill, or task above to generate personalized AI insights.": "Log your first expense, income, bill, or task above to generate personalized AI insights.",
    "No upcoming items yet. Log a bill or appointment above!": "No upcoming items yet. Log a bill or appointment above!",
    "No goals created yet. Add one in the Goals tab!": "No goals created yet. Add one in the Goals tab!",
    "goals active in your tracker": "goals active in your tracker",
    "Due": "Due",
    "Due Soon": "Due Soon",

    // Dedicated Monthly Balance History View
    "← Back to Dashboard": "← Back to Dashboard",
    "Monthly Balance History": "Monthly Balance History",
    "Current Active Month": "Current Active Month",
    "(Current Active Month)": "(Current Active Month)",
    "Actively tracking daily transactions. Finalizes into balance history after month ends.": "Actively tracking daily transactions. Finalizes into balance history after month ends.",
    "Dashboard Savings": "Dashboard Savings",
    "Carried From Prev Month": "Carried From Prev Month",
    "Current Logged Income": "Current Logged Income",
    "Current Logged Expenses": "Current Logged Expenses",
    "Current Month Net Flow": "Current Month Net Flow",
    "Completed Months' Balance History": "Completed Months' Balance History",
    "+ Record Older Month Balance": "+ Record Older Month Balance",
    "Record Balance for an Earlier Month": "Record Balance for an Earlier Month",
    "Closing Balance": "Closing Balance",
    "Edit Balance": "Edit Balance",
    "Reset": "Reset",
    "Save": "Save",
    "Cancel": "Cancel",
    "Save Record": "Save Record",
    "No completed historical months recorded yet. As months conclude, their closing balances appear here automatically.": "No completed historical months recorded yet. As months conclude, their closing balances appear here automatically.",
    "First Month Active": "First Month Active",
    "Fresh account • History activates after this month": "Fresh account • History activates after this month",
    "Monthly Balance History activates after your first month concludes": "Monthly Balance History activates after your first month concludes",
    "Monthly Balance History will be available after your first month concludes!": "Monthly Balance History will be available after your first month concludes!",
    "Welcome to Your First Month!": "Welcome to Your First Month!",
    "Your account is fresh. Monthly Balance History activates automatically after your first month completes, tracking your closing balances month-over-month.": "Your account is fresh. Monthly Balance History activates automatically after your first month completes, tracking your closing balances month-over-month.",

    // User Profile Modal
    "User Profile & Account Session": "User Profile & Account Session",
    "User Profile & Account": "User Profile & Account",
    "View & update your profile and balance history": "View & update your profile and balance history",
    "Display Name *": "Display Name *",
    "Full Name": "Full Name",
    "Email Address (Account ID)": "Email Address (Account ID)",
    "Registered Email": "Registered Email",
    "Phone Number": "Phone Number",
    "Bio / About User": "Bio / About User",
    "Add information about yourself...": "Add information about yourself...",
    "View and track historical completed months": "View and track historical completed months",
    "Open Records": "Open Records",
    "Report an Issue": "Report an Issue",
    "Facing a problem? Submit an issue report": "Facing a problem? Submit an issue report",
    "Report Issue": "Report Issue",
    "Language / மொழி": "Language / மொழி",
    "Account Session": "Account Session",
    "Sign out from this device securely": "Sign out from this device securely",
    "Log out": "Log out",
    "Save Profile": "Save Profile",

    // Report Issue Modal
    "Submit issue details or feedback to support": "Submit issue details or feedback to support",
    "Issue Category *": "Issue Category *",
    "Issue Summary / Subject *": "Issue Summary / Subject *",
    "Detailed Description *": "Detailed Description *",
    "Submit Report": "Submit Report",

    // Common Module Headers & Buttons
    "Finance Overview": "Finance Overview",
    "Total Income": "Total Income",
    "Net Savings": "Net Savings",
    "Export CSV": "Export CSV",
    "+ Income": "+ Income",
    "+ Expense": "+ Expense",
    "Add Transaction": "Add Transaction",
    "Add Bill": "Add Bill",
    "Add Task": "Add Task",
    "Add Goal": "Add Goal",
    "Add Note": "Add Note",
    "Add Contact": "Add Contact",
    "Add Appointment": "Add Appointment",
    "Add Asset": "Add Asset",
    "Add Document": "Add Document",
    "Add Password": "Add Password",
    "Status": "Status",
    "Action": "Action",
    "Actions": "Actions",
    "Category": "Category",
    "Amount": "Amount",
    "Date": "Date",
    "All": "All",
    "Filter": "Filter",
    "Close": "Close",

    // Footer
    "LifeLedger AI — Personal Life Intelligence Dashboard.": "LifeLedger AI — Personal Life Intelligence Dashboard."
  },

  ta: {
    // Navigation
    "Dashboard": "டாஷ்போர்டு",
    "Finance": "நிதி",
    "Bills": "கட்டணங்கள்",
    "Health & Wellness": "உடல்நலம்",
    "Productivity": "பணிகள்",
    "Tasks": "பணிகள்",
    "Documents": "ஆவணங்கள்",
    "Appointments": "சந்திப்புகள்",
    "Goals": "இலக்குகள்",
    "Assets": "சொத்துக்கள்",
    "Notes & Journal": "குறிப்புகள்",
    "Contacts": "தொடர்புகள்",
    "Password": "கடவுச்சொல்",
    "Balance Settings": "மாதாந்திர இருப்பு வரலாறு",

    // Top Bar & Quick Entry
    "Search across all modules...": "அனைத்து தொகுதிகளிலும் தேடுக...",
    "Search transactions, notes, goals...": "பரிவர்த்தனைகள், குறிப்புகள், இலக்குகளைத் தேடுக...",
    "Tell LifeLedger what happened — it sorts the rest...": "நடந்ததை LifeLedger-க்கு கூறுங்கள் — மீதியை இது கவனிக்கும்...",
    "e.g. “Spent ₹450 on food today” or “Finish the ML assignment tomorrow”": "எ.கா. “இன்று உணவுக்கு ₹450 செலவழித்தேன்” அல்லது “நாளை பணிகளை முடிக்கவும்”",
    "Add": "சேர்",
    "Try:": "முயற்சிக்க:",
    "I spent ₹450 on food today": "இன்று உணவுக்கு ₹450 செலவு செய்தேன்",
    "Paid electricity bill ₹1,200": "மின்கட்டணம் ₹1,200 செலுத்தினேன்",
    "Received salary ₹85,000": "சம்பளம் ₹85,000 பெறப்பட்டது",
    "Doctor appointment next Friday at 11am": "அடுத்த வெள்ளிக்கிழமை காலை 11 மணிக்கு மருத்துவர் சந்திப்பு",
    "Spent ₹450 on food today": "இன்று உணவுக்கு ₹450 செலவு செய்தேன்",
    "Click to view & edit profile": "சுயவிவரத்தைக் காண & திருத்த கிளிக் செய்க",
    "🔔 Urgent Alerts & Expiries": "🔔 அவசர எச்சரிக்கைகள் & காலாவதிகள்",
    "No active alerts at present.": "தற்போது எந்த எச்சரிக்கைகளும் இல்லை.",

    // Dashboard View
    "MONTHLY INCOME": "மாதாந்திர வருமானம்",
    "MONTHLY EXPENSES": "மாதாந்திர செலவுகள்",
    "NET BALANCE": "நிகரத் தொகை",
    "NET AMOUNT": "நிகரத் தொகை",
    "Net Amount": "நிகரத் தொகை",
    "Net Balance": "நிகரத் தொகை",
    "Remaining from income": "வருமானத்திலிருந்து மீதம்",
    "Deficit from income": "வருமானத்தில் பற்றாக்குறை",
    "Savings": "சேமிப்பு",
    "Spending by Category": "வகை வாரியாக செலவுகள்",
    "Total Expenses": "மொத்த செலவுகள்",
    "Income vs Expenses": "வருமானம் vs செலவுகள்",
    "Cashflow Comparison": "பணப்புழக்க ஒப்பீடு",
    "Income": "வருமானம்",
    "Expenses": "செலவுகள்",
    "Upcoming": "வரவிருப்பவை",
    "Bills and appointments scheduled": "திட்டமிடப்பட்ட கட்டணங்கள் மற்றும் சந்திப்புகள்",
    "items": "உருப்படிகள்",
    "AI Insights": "AI நுண்ணறிவுகள்",
    "Generated from your current data": "உங்கள் நடப்புத் தரவிலிருந்து உருவாக்கப்பட்டது",
    "Goals in Progress": "முன்னேற்றத்தில் உள்ள இலக்குகள்",
    "active goals": "செயலில் உள்ள இலக்குகள்",
    "Clean Slate!": "புதிய தொடக்கம்!",
    "Log your first expense, income, bill, or task above to generate personalized AI insights.": "தனிப்பயனாக்கப்பட்ட AI நுண்ணறிவுகளைப் பெற உங்கள் முதல் செலவு, வருமானம் அல்லது பணியைப் பதிவு செய்க.",
    "No upcoming items yet. Log a bill or appointment above!": "வரவிருக்கும் நிகழ்வுகள் எதுவும் இல்லை. மேலே உள்ள பெட்டியில் பில் அல்லது சந்திப்பைப் பதிவு செய்க!",
    "No goals created yet. Add one in the Goals tab!": "இன்னும் இலக்குகள் உருவாக்கப்படவில்லை. இலக்குகள் பகுதியில் ஒன்றைச் சேர்க்கவும்!",
    "goals active in your tracker": "இலக்குகள் உங்கள் கண்காணிப்பில் செயலில் உள்ளன",
    "Due": "கெடு தேதி",
    "Due Soon": "விரைவில் செலுத்த வேண்டும்",

    // Dedicated Monthly Balance History View
    "← Back to Dashboard": "← டாஷ்போர்டுக்குத் திரும்பு",
    "Monthly Balance History": "மாதாந்திர இருப்பு வரலாறு",
    "Current Active Month": "நடப்பு மாதம்",
    "(Current Active Month)": "(நடப்பு மாதம்)",
    "Actively tracking daily transactions. Finalizes into balance history after month ends.": "தினசரி பரிவர்த்தனைகள் கண்காணிக்கப்படுகின்றன. மாதம் முடிந்ததும் இருப்பு வரலாற்றில் சேர்க்கப்படும்.",
    "Dashboard Savings": "டாஷ்போர்டு சேமிப்பு",
    "Carried From Prev Month": "முந்தைய மாதத்திலிருந்து கொண்டுவரப்பட்டது",
    "Current Logged Income": "நடப்புப் பதிவான வருமானம்",
    "Current Logged Expenses": "நடப்புப் பதிவான செலவுகள்",
    "Current Month Net Flow": "நடப்பு மாத நிகர இருப்பு",
    "Completed Months' Balance History": "முடிவடைந்த மாதங்களின் இருப்பு வரலாறு",
    "+ Record Older Month Balance": "+ முந்தைய மாத இருப்பைப் பதிவு செய்க",
    "Record Balance for an Earlier Month": "முந்தைய மாத இருப்பைப் பதிவு செய்க",
    "Closing Balance": "இறுதி இருப்பு",
    "Edit Balance": "இருப்பைத் திருத்து",
    "Reset": "மீட்டமை",
    "Save": "சேமி",
    "Cancel": "ரத்து செய்",
    "Save Record": "இருப்பைச் சேமி",
    "No completed historical months recorded yet. As months conclude, their closing balances appear here automatically.": "முடிவடைந்த மாதங்களின் பதிவுகள் எதுவும் இல்லை. மாதங்கள் முடிவடைந்ததும், அவற்றின் இறுதி இருப்புகள் தானாகவே இங்கு தோன்றும்.",
    "First Month Active": "முதல் மாதம் செயலில்",
    "Fresh account • History activates after this month": "புதிய கணக்கு • இந்த மாதத்திற்குப் பிறகு இருப்பு வரலாறு தொடங்கும்",
    "Monthly Balance History activates after your first month concludes": "முதல் மாதம் முடிந்ததும் மாதாந்திர இருப்பு வரலாறு தொடங்கும்",
    "Monthly Balance History will be available after your first month concludes!": "உங்கள் முதல் மாதம் முடிந்த பிறகு மாதாந்திர இருப்பு வரலாறு கிடைக்கும்!",
    "Welcome to Your First Month!": "உங்கள் முதல் மாதத்திற்கு நல்வரவு!",
    "Your account is fresh. Monthly Balance History activates automatically after your first month completes, tracking your closing balances month-over-month.": "உங்கள் கணக்கு புதியது. முதல் மாதம் முடிந்ததும் முந்தைய மாத இருப்புகளின் அடிப்படையில் மாதாந்திர இருப்பு வரலாறு தானாகவே தொடங்கும்.",

    // User Profile Modal
    "User Profile & Account Session": "பயனர் சுயவிவரம் & கணக்கு அமர்வு",
    "User Profile & Account": "பயனர் சுயவிவரம் & கணக்கு",
    "View & update your profile and balance history": "உங்கள் சுயவிவரம் மற்றும் இருப்பு வரலாற்றைக் காண்க & புதுப்பிக்கவும்",
    "Display Name *": "காட்சிப் பெயர் *",
    "Full Name": "முழுப் பெயர்",
    "Email Address (Account ID)": "மின்னஞ்சல் முகவரி (கணக்கு ஐடி)",
    "Registered Email": "பதிவுசெய்த மின்னஞ்சல்",
    "Phone Number": "தொலைபேசி எண்",
    "Bio / About User": "பயனர் பற்றிய தகவல்",
    "Add information about yourself...": "உங்களைப் பற்றிய தகவலைச் சேர்க்கவும்...",
    "View and track historical completed months": "கடந்த கால முடிவடைந்த மாதங்களைக் காண்க & கண்காணிக்கவும்",
    "Open Records": "பதிவுகளைத் திற",
    "Report an Issue": "சிக்கலைப் புகாரளிக்கவும்",
    "Facing a problem? Submit an issue report": "சிக்கலை எதிர்கொள்கிறீர்களா? புகார் அறிக்கையைச் சமர்ப்பிக்கவும்",
    "Report Issue": "சிக்கலைப் புகாரளி",
    "Language / மொழி": "மொழி (Language)",
    "Account Session": "கணக்கு அமர்வு",
    "Sign out from this device securely": "இந்தச் சாதனத்திலிருந்து பாதுகாப்பாக வெளியேறவும்",
    "Log out": "வெளியேறு",
    "Save Profile": "சுயவிவரத்தைச் சேமி",

    // Report Issue Modal
    "Submit issue details or feedback to support": "சிக்கல் விவரங்கள் அல்லது பின்னூட்டத்தை ஆதரவுக் குழுவுக்கு அனுப்பவும்",
    "Issue Category *": "சிக்கல் வகை *",
    "Issue Summary / Subject *": "சிக்கல் சுருக்கம் / தலைப்பு *",
    "Detailed Description *": "விரிவான விளக்கம் *",
    "Submit Report": "அறிக்கையைச் சமர்ப்பி",

    // Common Module Headers & Buttons
    "Finance Overview": "நிதி மேலோட்டம்",
    "Total Income": "மொத்த வருமானம்",
    "Net Savings": "நிகர சேமிப்பு",
    "Export CSV": "CSV ஏற்றுமதி",
    "+ Income": "+ வருமானம்",
    "+ Expense": "+ செலவு",
    "Add Transaction": "பரிவர்த்தனை சேர்",
    "Add Bill": "பில் சேர்",
    "Add Task": "பணி சேர்",
    "Add Goal": "இலக்கு சேர்",
    "Add Note": "குறிப்பு சேர்",
    "Add Contact": "தொடர்பு சேர்",
    "Add Appointment": "சந்திப்பு சேர்",
    "Add Asset": "சொத்து சேர்",
    "Add Document": "ஆவணம் சேர்",
    "Add Password": "கடவுச்சொல் சேர்",
    "Status": "நிலை",
    "Action": "செயல்",
    "Actions": "செயல்கள்",
    "Category": "வகை",
    "Amount": "தொகை",
    "Date": "தேதி",
    "All": "அனைத்தும்",
    "Filter": "வடிகட்டு",
    "Close": "மூடு",

    // Footer
    "LifeLedger AI — Personal Life Intelligence Dashboard.": "LifeLedger AI — தனிநபர் வாழ்க்கை நுண்ணறிவு டாஷ்போர்டு."
  },

  hi: {
    // Navigation
    "Dashboard": "डैशबोर्ड",
    "Finance": "वित्त",
    "Bills": "बिल",
    "Health & Wellness": "स्वास्थ्य एवं कल्याण",
    "Productivity": "कार्य एवं उत्पादकता",
    "Tasks": "कार्य",
    "Documents": "दस्तावेज़",
    "Appointments": "नियुक्तियां",
    "Goals": "लक्ष्य",
    "Assets": "संपत्तियां",
    "Notes & Journal": "नोट्स व डायरी",
    "Contacts": "संपर्क",
    "Password": "पासवर्ड",
    "Balance Settings": "मासिक शेष इतिहास",

    // Top Bar & Quick Entry
    "Search across all modules...": "सभी मॉड्यूल में खोजें...",
    "Search transactions, notes, goals...": "लेनदेन, नोट्स, लक्ष्य खोजें...",
    "Tell LifeLedger what happened — it sorts the rest...": "LifeLedger को बताएं क्या हुआ — बाकी यह संभाल लेगा...",
    "e.g. “Spent ₹450 on food today” or “Finish the ML assignment tomorrow”": "उदा. “आज खाने पर ₹450 खर्च किए” या “कल असाइनमेंट पूरा करें”",
    "Add": "जोड़ें",
    "Try:": "आज़माएं:",
    "I spent ₹450 on food today": "मैंने आज भोजन पर ₹450 खर्च किए",
    "Paid electricity bill ₹1,200": "बिजली बिल ₹1,200 का भुगतान किया",
    "Received salary ₹85,000": "वेतन ₹85,000 प्राप्त हुआ",
    "Doctor appointment next Friday at 11am": "अगले शुक्रवार सुबह 11 बजे डॉक्टर की नियुक्ति",
    "Spent ₹450 on food today": "आज भोजन पर ₹450 खर्च किए",
    "Click to view & edit profile": "प्रोफ़ाइल देखने व संपादित करने के लिए क्लिक करें",
    "🔔 Urgent Alerts & Expiries": "🔔 आवश्यक अलर्ट और समाप्ति",
    "No active alerts at present.": "वर्तमान में कोई सक्रिय अलर्ट नहीं है।",

    // Dashboard View
    "MONTHLY INCOME": "मासिक आय",
    "MONTHLY EXPENSES": "मासिक व्यय",
    "NET BALANCE": "शुद्ध राशि",
    "NET AMOUNT": "शुद्ध राशि",
    "Net Amount": "शुद्ध राशि",
    "Net Balance": "शुद्ध राशि",
    "Remaining from income": "आय से शेष",
    "Deficit from income": "आय में घाटा",
    "Savings": "बचत",
    "Spending by Category": "श्रेणी अनुसार व्यय",
    "Total Expenses": "कुल व्यय",
    "Income vs Expenses": "आय बनाम व्यय",
    "Cashflow Comparison": "नकदी प्रवाह तुलना",
    "Income": "आय",
    "Expenses": "व्यय",
    "Upcoming": "आगामी",
    "Bills and appointments scheduled": "बिल और नियुक्तियां निर्धारित",
    "items": "मदें",
    "AI Insights": "AI अंतर्दृष्टि",
    "Generated from your current data": "आपके वर्तमान डेटा से उत्पन्न",
    "Goals in Progress": "प्रगति में लक्ष्य",
    "active goals": "सक्रिय लक्ष्य",
    "Clean Slate!": "नई शुरुआत!",
    "Log your first expense, income, bill, or task above to generate personalized AI insights.": "व्यक्तिगत AI अंतर्दृष्टि प्राप्त करने के लिए ऊपर अपना पहला खर्च, आय, बिल या कार्य दर्ज करें।",
    "No upcoming items yet. Log a bill or appointment above!": "कोई आगामी मद नहीं। ऊपर बिल या अपॉइंटमेंट दर्ज करें!",
    "No goals created yet. Add one in the Goals tab!": "अभी तक कोई लक्ष्य नहीं बनाया गया। लक्ष्य टैब में जोड़ें!",
    "goals active in your tracker": "लक्ष्य ट्रैकर में सक्रिय हैं",
    "Due": "देय",
    "Due Soon": "शीघ्र देय",

    // Dedicated Monthly Balance History View
    "← Back to Dashboard": "← डैशबोर्ड पर वापस जाएं",
    "Monthly Balance History": "मासिक शेष इतिहास",
    "Current Active Month": "वर्तमान सक्रिय माह",
    "(Current Active Month)": "(वर्तमान सक्रिय माह)",
    "Actively tracking daily transactions. Finalizes into balance history after month ends.": "दैनिक लेनदेन सक्रिय रूप से ट्रैक हो रहे हैं। माह समाप्त होने पर इतिहास में दर्ज होंगे।",
    "Dashboard Savings": "डैशबोर्ड बचत",
    "Carried From Prev Month": "पिछले महीने से लाया गया",
    "Current Logged Income": "वर्तमान दर्ज आय",
    "Current Logged Expenses": "वर्तमान दर्ज व्यय",
    "Current Month Net Flow": "वर्तमान माह का शुद्ध प्रवाह",
    "Completed Months' Balance History": "पूर्ण महीनों का शेष इतिहास",
    "+ Record Older Month Balance": "+ पुराने महीने का शेष दर्ज करें",
    "Record Balance for an Earlier Month": "पूर्व महीने का शेष दर्ज करें",
    "Closing Balance": "समापन शेष",
    "Edit Balance": "शेष संपादित करें",
    "Reset": "रीसेट",
    "Save": "सहेजें",
    "Cancel": "रद्द करें",
    "Save Record": "रिकॉर्ड सहेजें",
    "No completed historical months recorded yet. As months conclude, their closing balances appear here automatically.": "कोई पूर्व पूर्ण महीने दर्ज नहीं हैं। माह समाप्त होने पर समापन शेष स्वतः यहाँ दिखाई देगा।",
    "First Month Active": "पहला माह सक्रिय",
    "Fresh account • History activates after this month": "नया खाता • इस माह के बाद इतिहास सक्रिय होगा",
    "Monthly Balance History activates after your first month concludes": "पहला माह समाप्त होने के बाद मासिक शेष इतिहास सक्रिय होगा",
    "Monthly Balance History will be available after your first month concludes!": "आपका पहला माह समाप्त होने के बाद मासिक शेष इतिहास उपलब्ध होगा!",
    "Welcome to Your First Month!": "आपके पहले माह में स्वागत है!",
    "Your account is fresh. Monthly Balance History activates automatically after your first month completes, tracking your closing balances month-over-month.": "आपका खाता नया है। पहला महीना पूरा होने के बाद मासिक शेष इतिहास पिछले महीने के शेष के आधार पर स्वचालित रूप से शुरू हो जाएगा।",

    // User Profile Modal
    "User Profile & Account Session": "उपयोगकर्ता प्रोफ़ाइल और खाता सत्र",
    "User Profile & Account": "उपयोगकर्ता प्रोफ़ाइल और खाता",
    "View & update your profile and balance history": "अपनी प्रोफ़ाइल और शेष इतिहास देखें व अपडेट करें",
    "Display Name *": "प्रदर्शित नाम *",
    "Full Name": "पूरा नाम",
    "Email Address (Account ID)": "ईमेल पता (खाता आईडी)",
    "Registered Email": "पंजीकृत ईमेल",
    "Phone Number": "फ़ोन नंबर",
    "Bio / About User": "बायो / परिचय",
    "Add information about yourself...": "अपने बारे में जानकारी जोड़ें...",
    "View and track historical completed months": "ऐतिहासिक पूर्ण महीनों को देखें और ट्रैक करें",
    "Open Records": "रिकॉर्ड खोलें",
    "Report an Issue": "समस्या दर्ज करें",
    "Facing a problem? Submit an issue report": "कोई समस्या आ रही है? रिपोर्ट सबमिट करें",
    "Report Issue": "समस्या रिपोर्ट करें",
    "Language / மொழி": "भाषा / Language",
    "Account Session": "खाता सत्र",
    "Sign out from this device securely": "इस डिवाइस से सुरक्षित रूप से लॉग आउट करें",
    "Log out": "लॉग आउट",
    "Save Profile": "प्रोफ़ाइल सहेजें",

    // Report Issue Modal
    "Submit issue details or feedback to support": "समर्थन को समस्या विवरण या फ़ीडबैक सबमिट करें",
    "Issue Category *": "समस्या श्रेणी *",
    "Issue Summary / Subject *": "समस्या सारांश / विषय *",
    "Detailed Description *": "विस्तृत विवरण *",
    "Submit Report": "रिपोर्ट सबमिट करें",

    // Common Module Headers & Buttons
    "Finance Overview": "वित्त अवलोकन",
    "Total Income": "कुल आय",
    "Net Savings": "शुद्ध बचत",
    "Export CSV": "CSV निर्यात",
    "+ Income": "+ आय",
    "+ Expense": "+ व्यय",
    "Add Transaction": "लेनदेन जोड़ें",
    "Add Bill": "बिल जोड़ें",
    "Add Task": "कार्य जोड़ें",
    "Add Goal": "लक्ष्य जोड़ें",
    "Add Note": "नोट जोड़ें",
    "Add Contact": "संपर्क जोड़ें",
    "Add Appointment": "अपॉइंटमेंट जोड़ें",
    "Add Asset": "संपत्ति जोड़ें",
    "Add Document": "दस्तावेज़ जोड़ें",
    "Add Password": "पासवर्ड जोड़ें",
    "Status": "स्थिति",
    "Action": "कार्रवाई",
    "Actions": "कार्रवाइयां",
    "Category": "श्रेणी",
    "Amount": "राशि",
    "Date": "दिनांक",
    "All": "सभी",
    "Filter": "फ़िल्टर",
    "Close": "बंद करें",

    // Footer
    "LifeLedger AI — Personal Life Intelligence Dashboard.": "LifeLedger AI — व्यक्तिगत जीवन इंटेलिजेंस डैशबोर्ड।"
  },

  ml: {
    // Malayalam
    "Dashboard": "ഡാഷ്‌ബോർഡ്",
    "Finance": "ധനകാര്യം",
    "Bills": "ബില്ലുകൾ",
    "Health & Wellness": "ആരോഗ്യം",
    "Productivity": "ജോലികൾ",
    "Tasks": "ജോലികൾ",
    "Documents": "രേഖകൾ",
    "Appointments": "അപ്പോയിന്റ്മെന്റുകൾ",
    "Goals": "ലക്ഷ്യങ്ങൾ",
    "Assets": "ആസ്തികൾ",
    "Notes & Journal": "കുറിപ്പുകൾ",
    "Contacts": "കോൺടാക്റ്റുകൾ",
    "Password": "പാസ്‌വേഡ്",
    "Balance Settings": "പ്രതിമാസ ബാലൻസ് ചരിത്രം",

    "Search across all modules...": "എല്ലാ മൊഡ്യൂളുകളിലും തിരയുക...",
    "Search transactions, notes, goals...": "ഇടപാടുകൾ, കുറിപ്പുകൾ, ലക്ഷ്യങ്ങൾ തിരയുക...",
    "Tell LifeLedger what happened — it sorts the rest...": "എന്തു സംഭവിച്ചുവെന്ന് പറയൂ — ബാക്കി ഇത് കൈകാര്യം ചെയ്യും...",
    "e.g. “Spent ₹450 on food today” or “Finish the ML assignment tomorrow”": "ഉദാ: “ഇന്ന് ഭക്ഷണത്തിന് ₹450 ചെലവഴിച്ചു”",
    "Add": "ചേർക്കുക",
    "Try:": "ശ്രമിക്കുക:",
    "I spent ₹450 on food today": "ഇന്ന് ഭക്ഷണത്തിന് ₹450 ചെലവഴിച്ചു",
    "Paid electricity bill ₹1,200": "വൈദ്യുതി ബിൽ ₹1,200 അടച്ചു",
    "Received salary ₹85,000": "ശമ്പളം ₹85,000 ലഭിച്ചു",
    "Doctor appointment next Friday at 11am": "അടുത്ത വെള്ളിയാഴ്ച 11 മണിക്ക് ഡോക്ടർ സന്ദർശനം",
    "Spent ₹450 on food today": "ഇന്ന് ഭക്ഷണത്തിന് ₹450 ചെലവഴിച്ചു",
    "Click to view & edit profile": "പ്രൊഫൈൽ കാണാനും തിരുത്താനും ക്ലിക്ക് ചെയ്യുക",
    "🔔 Urgent Alerts & Expiries": "🔔 പ്രധാന അലേർട്ടുകൾ",
    "No active alerts at present.": "നിലവിൽ അലേർട്ടുകൾ ഒന്നുമില്ല.",

    "MONTHLY INCOME": "പ്രതിമാസ വരുമാനം",
    "MONTHLY EXPENSES": "പ്രതിമാസ ചെലവുകൾ",
    "NET BALANCE": "അറ്റ തുക",
    "NET AMOUNT": "അറ്റ തുക",
    "Net Amount": "അറ്റ തുക",
    "Net Balance": "അറ്റ തുക",
    "Remaining from income": "വരുമാനത്തിൽ നിന്നുള്ള ബാക്കി",
    "Deficit from income": "വരുമാനത്തിലെ കമ്മി",
    "Savings": "സമ്പാദ്യം",
    "Spending by Category": "വിഭാഗം തിരിച്ചുള്ള ചെലവ്",
    "Total Expenses": "ആകെ ചെലവുകൾ",
    "Income vs Expenses": "വരുമാനവും ചെലവും",
    "Cashflow Comparison": "ക്യാഷ്ഫ്ലോ താരതമ്യം",
    "Income": "വരുമാനം",
    "Expenses": "ചെലവുകൾ",
    "Upcoming": "വരാനിരിക്കുന്നവ",
    "Bills and appointments scheduled": "ബില്ലുകളും അപ്പോയിന്റ്മെന്റുകളും",
    "items": "ഇനങ്ങൾ",
    "AI Insights": "AI ഉൾക്കാഴ്ചകൾ",
    "Generated from your current data": "നിങ്ങളുടെ ഡാറ്റയിൽ നിന്ന് രൂപപ്പെടുത്തിയത്",
    "Goals in Progress": "പുരോഗതിയിലുള്ള ലക്ഷ്യങ്ങൾ",
    "active goals": "സജീവ ലക്ഷ്യങ്ങൾ",
    "Clean Slate!": "പുതിയ തുടക്കം!",
    "Log your first expense, income, bill, or task above to generate personalized AI insights.": "നിങ്ങളുടെ ആദ്യ ചെലവോ വരുമാനമോ മുകളിൽ രേഖപ്പെടുത്തുക.",
    "No upcoming items yet. Log a bill or appointment above!": "വരാനിരിക്കുന്ന ഇനങ്ങളൊന്നുമില്ല.",
    "No goals created yet. Add one in the Goals tab!": "ലക്ഷ്യങ്ങൾ ചേർത്തിട്ടില്ല.",
    "goals active in your tracker": "സജീവ ലക്ഷ്യങ്ങൾ",
    "Due": "അവസാന തീയതി",
    "Due Soon": "ഉടൻ നൽകണം",

    "← Back to Dashboard": "← ഡാഷ്‌ബോർഡിലേക്ക് മടങ്ങുക",
    "Monthly Balance History": "പ്രതിമാസ ബാലൻസ് ചരിത്രം",
    "Current Active Month": "നടപ്പ് മാസം",
    "(Current Active Month)": "(നടപ്പ് മാസം)",
    "Actively tracking daily transactions. Finalizes into balance history after month ends.": "മാസം അവസാനിച്ച ശേഷം ബാലൻസ് ചരിത്രത്തിൽ രേഖപ്പെടുത്തും.",
    "Dashboard Savings": "ഡാഷ്‌ബോർഡ് സമ്പാദ്യം",
    "Carried From Prev Month": "മുൻ മാസത്തിൽ നിന്ന്",
    "Current Logged Income": "നിലവിലെ വരുമാനം",
    "Current Logged Expenses": "നിലവിലെ ചെലവ്",
    "Current Month Net Flow": "ഈ മാസത്തെ അറ്റ ബാലൻസ്",
    "Completed Months' Balance History": "കഴിഞ്ഞ മാസങ്ങളുടെ ബാലൻസ് ചരിത്രം",
    "+ Record Older Month Balance": "+ പഴയ മാസത്തെ ബാലൻസ് ചേർക്കുക",
    "Record Balance for an Earlier Month": "മുൻ മാസത്തെ ബാലൻസ് ചേർക്കുക",
    "Closing Balance": "അവസാന ബാലൻസ്",
    "Edit Balance": "ബാലൻസ് മാറ്റുക",
    "Reset": "റീസെറ്റ്",
    "Save": "സംരക്ഷിക്കുക",
    "Cancel": "റദ്ദാക്കുക",
    "Save Record": "സൂക്ഷിക്കുക",
    "No completed historical months recorded yet. As months conclude, their closing balances appear here automatically.": "പൂർത്തിയായ മാസങ്ങളൊന്നും ഇതുവരെ രേഖപ്പെടുത്തിയിട്ടില്ല.",
    "First Month Active": "ആദ്യ മാസം സജീവം",
    "Fresh account • History activates after this month": "പുതിയ അക്കൗണ്ട് • ഈ മാസത്തിന് ശേഷം ചരിത്രം ആരംഭിക്കും",
    "Monthly Balance History activates after your first month concludes": "ആദ്യ മാസം കഴിഞ്ഞ ശേഷം പ്രതിമാസ ബാലൻസ് ചരിത്രം ലഭ്യമാകും",
    "Monthly Balance History will be available after your first month concludes!": "ആദ്യ മാസം പൂർത്തിയായ ശേഷം പ്രതിമാസ ബാലൻസ് ചരിത്രം ലഭ്യമാകും!",
    "Welcome to Your First Month!": "നിങ്ങളുടെ ആദ്യ മാസത്തിലേക്ക് സ്വാഗതം!",
    "Your account is fresh. Monthly Balance History activates automatically after your first month completes, tracking your closing balances month-over-month.": "നിങ്ങളുടെ അക്കൗണ്ട് പുതിയതാണ്. ആദ്യ മാസം പൂർത്തിയായ ശേഷം പ്രതിമാസ ബാലൻസ് ചരിത്രം സ്വയമേവ ആരംഭിക്കും.",

    "User Profile & Account Session": "ഉപയോക്തൃ പ്രൊഫൈൽ & സെഷൻ",
    "User Profile & Account": "ഉപയോക്തൃ പ്രൊഫൈൽ",
    "View & update your profile and balance history": "പ്രൊഫൈലും ബാലൻസും കാണുക",
    "Display Name *": "പേര് *",
    "Full Name": "പൂർണ്ണമായ പേര്",
    "Email Address (Account ID)": "ഇമെയിൽ വിലാസം",
    "Registered Email": "രജിസ്റ്റർ ചെയ്ത ഇമെയിൽ",
    "Phone Number": "ഫോൺ നമ്പർ",
    "Bio / About User": "വിവരണം",
    "Add information about yourself...": "വിവരങ്ങൾ ചേർക്കുക...",
    "View and track historical completed months": "മുൻകാല ചരിത്രം കാണുക",
    "Open Records": "തുറക്കുക",
    "Report an Issue": "പ്രശ്നം റിപ്പോർട്ട് ചെയ്യുക",
    "Facing a problem? Submit an issue report": "പ്രശ്നം റിപ്പോർട്ട് ചെയ്യുക",
    "Report Issue": "റിപ്പോർട്ട് ചെയ്യുക",
    "Language / மொழி": "ഭാഷ / Language",
    "Account Session": "അക്കൗണ്ട് സെഷൻ",
    "Sign out from this device securely": "സുരക്ഷിതമായി ലോഗ് ഔട്ട് ചെയ്യുക",
    "Log out": "ലോഗ് ഔട്ട്",
    "Save Profile": "പ്രൊഫൈൽ സംരക്ഷിക്കുക",

    "Submit issue details or feedback to support": "വിവരങ്ങൾ അയക്കുക",
    "Issue Category *": "വിഭാഗം *",
    "Issue Summary / Subject *": "വിഷയം *",
    "Detailed Description *": "വിശദീകരണം *",
    "Submit Report": "റിപ്പോർട്ട് അയക്കുക",

    "Finance Overview": "ധനകാര്യ അവലോകനം",
    "Total Income": "ആകെ വരുമാനം",
    "Net Savings": "അറ്റ സമ്പാദ്യം",
    "Export CSV": "CSV എക്‌സ്‌പോർട്ട്",
    "+ Income": "+ വരുമാനം",
    "+ Expense": "+ ചെലവ്",
    "Add Transaction": "ഇടപാട് ചേർക്കുക",
    "Add Bill": "ബിൽ ചേർക്കുക",
    "Add Task": "ജോലി ചേർക്കുക",
    "Add Goal": "ലക്ഷ്യം ചേർക്കുക",
    "Add Note": "കുറിപ്പ് ചേർക്കുക",
    "Add Contact": "കോൺടാക്റ്റ് ചേർക്കുക",
    "Add Appointment": "അപ്പോയിന്റ്മെന്റ് ചേർക്കുക",
    "Add Asset": "ആസ്തി ചേർക്കുക",
    "Add Document": "രേഖ ചേർക്കുക",
    "Add Password": "പാസ്‌വേഡ് ചേർക്കുക",
    "Status": "സ്ഥിതി",
    "Action": "നടപടി",
    "Actions": "നടപടികൾ",
    "Category": "വിഭാഗം",
    "Amount": "തുക",
    "Date": "തീയതി",
    "All": "എല്ലാം",
    "Filter": "ഫിൽട്ടർ",
    "Close": "അടയ്ക്കുക",

    "LifeLedger AI — Personal Life Intelligence Dashboard.": "LifeLedger AI — വ്യക്തിഗത ലൈഫ് ഇന്റലിജൻസ് ഡാഷ്‌ബോർഡ്."
  },

  te: {
    // Telugu
    "Dashboard": "డాష్‌బోర్డ్",
    "Finance": "ఆర్థికం",
    "Bills": "బిల్లులు",
    "Health & Wellness": "ఆరోగ్యం",
    "Productivity": "పనులు",
    "Tasks": "పనులు",
    "Documents": "పత్రాలు",
    "Appointments": "అపాయింట్‌మెంట్‌లు",
    "Goals": "లక్ష్యాలు",
    "Assets": "ఆస్తులు",
    "Notes & Journal": "గమనికలు",
    "Contacts": "పరిచయాలు",
    "Password": "పాస్‌వర్డ్",
    "Balance Settings": "నెలవారీ బ్యాలెన్స్ చరిత్ర",

    "Search across all modules...": "అన్ని మాడ్యూళ్ళలో శోధించండి...",
    "Search transactions, notes, goals...": "లావాదేవీలు, గమనికలు, లక్ష్యాలు శోధించండి...",
    "Tell LifeLedger what happened — it sorts the rest...": "ఏమి జరిగిందో చెప్పండి — మిగిలినది ఇది చూసుకుంటుంది...",
    "e.g. “Spent ₹450 on food today” or “Finish the ML assignment tomorrow”": "ఉదా. “ఈరోజు ఆహారానికి ₹450 ఖర్చు చేసాను”",
    "Add": "జోడించు",
    "Try:": "ప్రయత్నించండి:",
    "I spent ₹450 on food today": "ఈరోజు ఆహారానికి ₹450 ఖర్చు చేసాను",
    "Paid electricity bill ₹1,200": "విద్యుత్ బిల్లు ₹1,200 చెల్లించాను",
    "Received salary ₹85,000": "జీతం ₹85,000 అందింది",
    "Doctor appointment next Friday at 11am": "వచ్చే శుక్రవారం ఉదయం 11 గంటలకు డాక్టర్ అపాయింట్‌మెంట్",
    "Spent ₹450 on food today": "ఈరోజు ఆహారానికి ₹450 ఖర్చు చేసాను",
    "Click to view & edit profile": "ప్రొఫైల్ చూడటానికి మరియు సవరించడానికి క్లిక్ చేయండి",
    "🔔 Urgent Alerts & Expiries": "🔔 ముఖ్యమైన హెచ్చరికలు",
    "No active alerts at present.": "ప్రస్తుతం ఏ హెచ్చరికలు లేవు.",

    "MONTHLY INCOME": "నెలవారీ ఆదాయం",
    "MONTHLY EXPENSES": "నెలవారీ ఖర్చులు",
    "NET BALANCE": "నికర మొత్తం",
    "NET AMOUNT": "నికర మొత్తం",
    "Net Amount": "నికర మొత్తం",
    "Net Balance": "నికర మొత్తం",
    "Remaining from income": "ఆదాయం నుండి మిగిలినది",
    "Deficit from income": "ఆదాయంలో లోటు",
    "Savings": "పొదుపు",
    "Spending by Category": "వర్గం వారీగా ఖర్చులు",
    "Total Expenses": "మొత్తం ఖర్చులు",
    "Income vs Expenses": "ఆదాయం వర్సెస్ ఖర్చులు",
    "Cashflow Comparison": "నగదు ప్రవాహ పోలిక",
    "Income": "ఆదాయం",
    "Expenses": "ఖర్చులు",
    "Upcoming": "రాబోయేవి",
    "Bills and appointments scheduled": "షెడ్యూల్ చేసిన బిల్లులు మరియు అపాయింట్‌మెంట్‌లు",
    "items": "అంశాలు",
    "AI Insights": "AI అంతర్దృష్టులు",
    "Generated from your current data": "మీ ప్రస్తుత డేటా నుండి రూపొందించబడింది",
    "Goals in Progress": "పురోగతిలో ఉన్న లక్ష్యాలు",
    "active goals": "క్రియాశీల లక్ష్యాలు",
    "Clean Slate!": "కొత్త ప్రారంభం!",
    "Log your first expense, income, bill, or task above to generate personalized AI insights.": "వ్యక్తిగతీకరించిన AI అంతర్దృష్టులను పొందడానికి మీ మొదటి ఖర్చు లేదా ఆదాయాన్ని నమోదు చేయండి.",
    "No upcoming items yet. Log a bill or appointment above!": "రాబోయే అంశాలు ఏవీ లేవు.",
    "No goals created yet. Add one in the Goals tab!": "లక్ష్యాలు ఏవీ సృష్టించబడలేదు.",
    "goals active in your tracker": "లక్ష్యాలు క్రియాశీలంగా ఉన్నాయి",
    "Due": "గడువు",
    "Due Soon": "త్వరలో చెల్లించాలి",

    "← Back to Dashboard": "← డాష్‌బోర్డ్‌కు తిరిగి వెళ్ళు",
    "Monthly Balance History": "నెలవారీ బ్యాలెన్స్ చరిత్ర",
    "Current Active Month": "ప్రస్తుత నెల",
    "(Current Active Month)": "(ప్రస్తుత నెల)",
    "Actively tracking daily transactions. Finalizes into balance history after month ends.": "నెల ముగిసిన తర్వాత బ్యాలెన్స్ చరిత్రలో నమోదు చేయబడుతుంది.",
    "Dashboard Savings": "డాష్‌బోర్డ్ పొదుపు",
    "Carried From Prev Month": "గత నెల నుండి బ్యాలెన్స్",
    "Current Logged Income": "నమోదైన ఆదాయం",
    "Current Logged Expenses": "నమోదైన ఖర్చులు",
    "Current Month Net Flow": "ఈ నెల నికర బ్యాలెన్స్",
    "Completed Months' Balance History": "గత నెలల బ్యాలెన్స్ చరిత్ర",
    "+ Record Older Month Balance": "+ పాత నెల బ్యాలెన్స్ నమోదు చేయండి",
    "Record Balance for an Earlier Month": "మునుపటి నెల బ్యాలెన్స్ నమోదు చేయండి",
    "Closing Balance": "ముగింపు బ్యాలెన్స్",
    "Edit Balance": "బ్యాలెన్స్ సవరించండి",
    "Reset": "రీసెట్",
    "Save": "భద్రపరచు",
    "Cancel": "రద్దు చేయి",
    "Save Record": "రికార్డును సేవ్ చేయి",
    "No completed historical months recorded yet. As months conclude, their closing balances appear here automatically.": "పూర్తయిన నెలలేవీ ఇంకా నమోదు కాలేదు.",
    "First Month Active": "మొదటి నెల క్రియాశీలకం",
    "Fresh account • History activates after this month": "కొత్త ఖాతా • ఈ నెల తర్వాత చరిత్ర ప్రారంభమవుతుంది",
    "Monthly Balance History activates after your first month concludes": "మొదటి నెల ముగిసిన తర్వాత బ్యాలెన్స్ చరిత్ర ప్రారంభమవుతుంది",
    "Monthly Balance History will be available after your first month concludes!": "మీ మొదటి నెల ముగిసిన తర్వాత నెలవారీ బ్యాలెన్స్ చరిత్ర అందుబాటులో ఉంటుంది!",
    "Welcome to Your First Month!": "మీ మొదటి నెలకు స్వాగతం!",
    "Your account is fresh. Monthly Balance History activates automatically after your first month completes, tracking your closing balances month-over-month.": "మీ ఖాతా సరికొత్తది. మొదటి నెల ముగిసిన తర్వాత గత నెల బ్యాలెన్స్ ఆధారంగా చరిత్ర స్వయంచాలకంగా ప్రారంభమవుతుంది.",

    "User Profile & Account Session": "యూజర్ ప్రొఫైల్ మరియు సెషన్",
    "User Profile & Account": "యూజర్ ప్రొఫైల్",
    "View & update your profile and balance history": "ప్రొఫైల్ మరియు బ్యాలెన్స్ చూడండి",
    "Display Name *": "పేరు *",
    "Full Name": "పూర్తి పేరు",
    "Email Address (Account ID)": "ఈమెయిల్ చిరునామా",
    "Registered Email": "నమోదిత ఈమెయిల్",
    "Phone Number": "ఫోన్ నంబర్",
    "Bio / About User": "వివరాలు",
    "Add information about yourself...": "మీ గురించి వివరాలు రాయండి...",
    "View and track historical completed months": "గత నెలల చరిత్రను చూడండి",
    "Open Records": "తెరవండి",
    "Report an Issue": "సమస్యను నివేదించండి",
    "Facing a problem? Submit an issue report": "సమస్య ఉందా? నివేదికను పంపండి",
    "Report Issue": "సమస్యను నివేదించు",
    "Language / மொழி": "భాష / Language",
    "Account Session": "ఖాతా సెషన్",
    "Sign out from this device securely": "సురక్షితంగా లాగ్ అవుట్ అవ్వండి",
    "Log out": "లాగ్ అవుట్",
    "Save Profile": "ప్రొఫైల్ భద్రపరచు",

    "Submit issue details or feedback to support": "వివరాలు పంపండి",
    "Issue Category *": "వర్గం *",
    "Issue Summary / Subject *": "విషయం *",
    "Detailed Description *": "వివరణ *",
    "Submit Report": "నివేదిక పంపు",

    "Finance Overview": "ఆర్థిక సమీక్ష",
    "Total Income": "మొత్తం ఆదాయం",
    "Net Savings": "నికర పొదుపు",
    "Export CSV": "CSV ఎగుమతి",
    "+ Income": "+ ఆదాయం",
    "+ Expense": "+ ఖర్చు",
    "Add Transaction": "లావాదేవీని జోడించు",
    "Add Bill": "బిల్లును జోడించు",
    "Add Task": "పనిని జోడించు",
    "Add Goal": "లక్ష్యాన్ని జోడించు",
    "Add Note": "గమనికను జోడించు",
    "Add Contact": "పరిచయాన్ని జోడించు",
    "Add Appointment": "అపాయింట్‌మెంట్‌ను జోడించు",
    "Add Asset": "ఆస్తిని జోడించు",
    "Add Document": "పత్రాన్ని జోడించు",
    "Add Password": "పాస్‌వర్డ్‌ను జోడించు",
    "Status": "స్థితి",
    "Action": "చర్య",
    "Actions": "చర్యలు",
    "Category": "వర్గం",
    "Amount": "మొత్తం",
    "Date": "తేదీ",
    "All": "అన్నీ",
    "Filter": "ఫిల్టర్",
    "Close": "మూసివేయి",

    "LifeLedger AI — Personal Life Intelligence Dashboard.": "LifeLedger AI — వ్యక్తిగత లైఫ్ ఇంటెలిజెన్స్ డాష్‌బోర్డ్."
  },

  es: {
    // Spanish
    "Dashboard": "Panel",
    "Finance": "Finanzas",
    "Bills": "Facturas",
    "Health & Wellness": "Salud y Bienestar",
    "Productivity": "Productividad",
    "Tasks": "Tareas",
    "Documents": "Documentos",
    "Appointments": "Citas",
    "Goals": "Metas",
    "Assets": "Activos",
    "Notes & Journal": "Notas",
    "Contacts": "Contactos",
    "Password": "Contraseña",
    "Balance Settings": "Historial de Saldo",

    "Search across all modules...": "Buscar en todos los módulos...",
    "Search transactions, notes, goals...": "Buscar transacciones, notas, metas...",
    "Tell LifeLedger what happened — it sorts the rest...": "Dile a LifeLedger qué pasó — se encarga del resto...",
    "e.g. “Spent ₹450 on food today” or “Finish the ML assignment tomorrow”": "ej. “Gasté ₹450 en comida hoy”",
    "Add": "Añadir",
    "Try:": "Probar:",
    "I spent ₹450 on food today": "Gasté ₹450 en comida hoy",
    "Paid electricity bill ₹1,200": "Pagué factura de luz ₹1,200",
    "Received salary ₹85,000": "Salario recibido ₹85,000",
    "Doctor appointment next Friday at 11am": "Cita médica el próximo viernes a las 11am",
    "Spent ₹450 on food today": "Gasté ₹450 en comida hoy",
    "Click to view & edit profile": "Haz clic para ver y editar el perfil",
    "🔔 Urgent Alerts & Expiries": "🔔 Alertas urgentes",
    "No active alerts at present.": "No hay alertas activas en este momento.",

    "MONTHLY INCOME": "INGRESOS MENSUALES",
    "MONTHLY EXPENSES": "GASTOS MENSUALES",
    "NET BALANCE": "IMPORTE NETO",
    "NET AMOUNT": "IMPORTE NETO",
    "Net Amount": "Importe neto",
    "Net Balance": "Importe neto",
    "Remaining from income": "Restante de ingresos",
    "Deficit from income": "Déficit de ingresos",
    "Savings": "Ahorros",
    "Spending by Category": "Gastos por categoría",
    "Total Expenses": "Gastos totales",
    "Income vs Expenses": "Ingresos vs Gastos",
    "Cashflow Comparison": "Comparación de flujo de caja",
    "Income": "Ingresos",
    "Expenses": "Gastos",
    "Upcoming": "Próximos",
    "Bills and appointments scheduled": "Facturas y citas programadas",
    "items": "elementos",
    "AI Insights": "Perspectivas de IA",
    "Generated from your current data": "Generado a partir de tus datos",
    "Goals in Progress": "Metas en progreso",
    "active goals": "metas activas",
    "Clean Slate!": "¡Comienzo limpio!",
    "Log your first expense, income, bill, or task above to generate personalized AI insights.": "Registra tu primer gasto o ingreso arriba para generar información de IA.",
    "No upcoming items yet. Log a bill or appointment above!": "No hay eventos próximos.",
    "No goals created yet. Add one in the Goals tab!": "Aún no se han creado metas.",
    "goals active in your tracker": "metas activas",
    "Due": "Vence",
    "Due Soon": "Vence pronto",

    "← Back to Dashboard": "← Volver al Panel",
    "Monthly Balance History": "Historial de Saldo Mensual",
    "Current Active Month": "Mes activo actual",
    "(Current Active Month)": "(Mes activo actual)",
    "Actively tracking daily transactions. Finalizes into balance history after month ends.": "Se finalizará en el historial de saldo al terminar el mes.",
    "Dashboard Savings": "Ahorros del panel",
    "Carried From Prev Month": "Arrastrado del mes anterior",
    "Current Logged Income": "Ingresos registrados",
    "Current Logged Expenses": "Gastos registrados",
    "Current Month Net Flow": "Flujo neto del mes actual",
    "Completed Months' Balance History": "Historial de saldos de meses cerrados",
    "+ Record Older Month Balance": "+ Registrar saldo de mes anterior",
    "Record Balance for an Earlier Month": "Registrar saldo de mes anterior",
    "Closing Balance": "Saldo de cierre",
    "Edit Balance": "Editar saldo",
    "Reset": "Restablecer",
    "Save": "Guardar",
    "Cancel": "Cancelar",
    "Save Record": "Guardar registro",
    "No completed historical months recorded yet. As months conclude, their closing balances appear here automatically.": "Aún no hay meses históricos registrados.",
    "First Month Active": "Primer mes activo",
    "Fresh account • History activates after this month": "Cuenta nueva • El historial se activa después de este mes",
    "Monthly Balance History activates after your first month concludes": "El historial de saldo se activa tras finalizar el primer mes",
    "Monthly Balance History will be available after your first month concludes!": "¡El historial de saldo mensual estará disponible al terminar su primer mes!",
    "Welcome to Your First Month!": "¡Bienvenido a su primer mes!",
    "Your account is fresh. Monthly Balance History activates automatically after your first month completes, tracking your closing balances month-over-month.": "Su cuenta es nueva. El historial de saldo mensual se activará automáticamente al concluir su primer mes.",

    "User Profile & Account Session": "Perfil de usuario y sesión",
    "User Profile & Account": "Perfil y cuenta",
    "View & update your profile and balance history": "Ver y actualizar tu perfil e historial",
    "Display Name *": "Nombre para mostrar *",
    "Full Name": "Nombre completo",
    "Email Address (Account ID)": "Correo electrónico",
    "Registered Email": "Correo registrado",
    "Phone Number": "Número de teléfono",
    "Bio / About User": "Biografía / Acerca del usuario",
    "Add information about yourself...": "Añade información sobre ti...",
    "View and track historical completed months": "Ver y seguir meses completados",
    "Open Records": "Abrir registros",
    "Report an Issue": "Informar un problema",
    "Facing a problem? Submit an issue report": "¿Tienes un problema? Envía un reporte",
    "Report Issue": "Informar problema",
    "Language / மொழி": "Idioma (Language)",
    "Account Session": "Sesión de cuenta",
    "Sign out from this device securely": "Cerrar sesión de forma segura",
    "Log out": "Cerrar sesión",
    "Save Profile": "Guardar perfil",

    "Submit issue details or feedback to support": "Enviar detalles al soporte",
    "Issue Category *": "Categoría *",
    "Issue Summary / Subject *": "Asunto *",
    "Detailed Description *": "Descripción detallada *",
    "Submit Report": "Enviar reporte",

    "Finance Overview": "Resumen financiero",
    "Total Income": "Ingresos totales",
    "Net Savings": "Ahorros netos",
    "Export CSV": "Exportar CSV",
    "+ Income": "+ Ingreso",
    "+ Expense": "+ Gasto",
    "Add Transaction": "Añadir transacción",
    "Add Bill": "Añadir factura",
    "Add Task": "Añadir tarea",
    "Add Goal": "Añadir meta",
    "Add Note": "Añadir nota",
    "Add Contact": "Añadir contacto",
    "Add Appointment": "Añadir cita",
    "Add Asset": "Añadir activo",
    "Add Document": "Añadir documento",
    "Add Password": "Añadir contraseña",
    "Status": "Estado",
    "Action": "Acción",
    "Actions": "Acciones",
    "Category": "Categoría",
    "Amount": "Cantidad",
    "Date": "Fecha",
    "All": "Todo",
    "Filter": "Filtrar",
    "Close": "Cerrar",

    "LifeLedger AI — Personal Life Intelligence Dashboard.": "LifeLedger AI — Panel de inteligencia de vida personal."
  },

  fr: {
    // French
    "Dashboard": "Tableau de bord",
    "Finance": "Finances",
    "Bills": "Factures",
    "Health & Wellness": "Santé & Bien-être",
    "Productivity": "Productivité",
    "Tasks": "Tâches",
    "Documents": "Documents",
    "Appointments": "Rendez-vous",
    "Goals": "Objectifs",
    "Assets": "Actifs",
    "Notes & Journal": "Notes & Journal",
    "Contacts": "Contacts",
    "Password": "Mot de passe",
    "Balance Settings": "Historique du solde",

    "Search across all modules...": "Rechercher dans tous les modules...",
    "Search transactions, notes, goals...": "Rechercher transactions, notes, objectifs...",
    "Tell LifeLedger what happened — it sorts the rest...": "Dites à LifeLedger ce qui s'est passé — il s'occupe du reste...",
    "e.g. “Spent ₹450 on food today” or “Finish the ML assignment tomorrow”": "ex. “Dépensé ₹450 pour la nourriture aujourd'hui”",
    "Add": "Ajouter",
    "Try:": "Essayer :",
    "I spent ₹450 on food today": "J'ai dépensé ₹450 pour la nourriture aujourd'hui",
    "Paid electricity bill ₹1,200": "Facture d'électricité payée ₹1,200",
    "Received salary ₹85,000": "Salaire reçu ₹85,000",
    "Doctor appointment next Friday at 11am": "Rendez-vous chez le médecin vendredi prochain à 11h",
    "Spent ₹450 on food today": "Dépensé ₹450 pour la nourriture aujourd'hui",
    "Click to view & edit profile": "Cliquez pour voir et modifier le profil",
    "🔔 Urgent Alerts & Expiries": "🔔 Alertes urgentes",
    "No active alerts at present.": "Aucune alerte active actuellement.",

    "MONTHLY INCOME": "REVENU MENSUEL",
    "MONTHLY EXPENSES": "DÉPENSES MENSUELLES",
    "NET BALANCE": "MONTANT NET",
    "NET AMOUNT": "MONTANT NET",
    "Net Amount": "Montant net",
    "Net Balance": "Montant net",
    "Remaining from income": "Restant des revenus",
    "Deficit from income": "Déficit des revenus",
    "Savings": "Épargne",
    "Spending by Category": "Dépenses par catégorie",
    "Total Expenses": "Total des dépenses",
    "Income vs Expenses": "Revenus vs Dépenses",
    "Cashflow Comparison": "Comparaison des flux",
    "Income": "Revenus",
    "Expenses": "Dépenses",
    "Upcoming": "À venir",
    "Bills and appointments scheduled": "Factures et rendez-vous planifiés",
    "items": "éléments",
    "AI Insights": "Aperçus IA",
    "Generated from your current data": "Généré à partir de vos données actuelles",
    "Goals in Progress": "Objectifs en cours",
    "active goals": "objectifs actifs",
    "Clean Slate!": "Nouveau départ !",
    "Log your first expense, income, bill, or task above to generate personalized AI insights.": "Enregistrez votre première dépense ou revenu ci-dessus.",
    "No upcoming items yet. Log a bill or appointment above!": "Aucun élément à venir.",
    "No goals created yet. Add one in the Goals tab!": "Aucun objectif créé pour l'instant.",
    "goals active in your tracker": "objectifs actifs",
    "Due": "Échéance",
    "Due Soon": "Bientôt dû",

    "← Back to Dashboard": "← Retour au Tableau de bord",
    "Monthly Balance History": "Historique du solde mensuel",
    "Current Active Month": "Mois actif en cours",
    "(Current Active Month)": "(Mois actif en cours)",
    "Actively tracking daily transactions. Finalizes into balance history after month ends.": "Finalisé dans l'historique du solde à la fin du mois.",
    "Dashboard Savings": "Épargne du tableau de bord",
    "Carried From Prev Month": "Reporté du mois précédent",
    "Current Logged Income": "Revenus enregistrés",
    "Current Logged Expenses": "Dépenses enregistrées",
    "Current Month Net Flow": "Flux net du mois en cours",
    "Completed Months' Balance History": "Historique des soldes des mois clôturés",
    "+ Record Older Month Balance": "+ Enregistrer le solde d'un mois antérieur",
    "Record Balance for an Earlier Month": "Enregistrer le solde d'un mois antérieur",
    "Closing Balance": "Solde de clôture",
    "Edit Balance": "Modifier le solde",
    "Reset": "Réinitialiser",
    "Save": "Enregistrer",
    "Cancel": "Annuler",
    "Save Record": "Sauvegarder",
    "No completed historical months recorded yet. As months conclude, their closing balances appear here automatically.": "Aucun mois historique complété n'est encore enregistré.",
    "First Month Active": "Premier mois actif",
    "Fresh account • History activates after this month": "Nouveau compte • L'historique s'active après ce mois",
    "Monthly Balance History activates after your first month concludes": "L'historique du solde s'active à la fin du premier mois",
    "Monthly Balance History will be available after your first month concludes!": "L'historique du solde mensuel sera disponible à la fin de votre premier mois !",
    "Welcome to Your First Month!": "Bienvenue dans votre premier mois !",
    "Your account is fresh. Monthly Balance History activates automatically after your first month completes, tracking your closing balances month-over-month.": "Votre compte est nouveau. L'historique du solde mensuel s'activera automatiquement à la fin de votre premier mois.",

    "User Profile & Account Session": "Profil utilisateur & session",
    "User Profile & Account": "Profil & compte",
    "View & update your profile and balance history": "Voir et mettre à jour le profil et l'historique",
    "Display Name *": "Nom d'affichage *",
    "Full Name": "Nom complet",
    "Email Address (Account ID)": "Adresse e-mail",
    "Registered Email": "E-mail enregistré",
    "Phone Number": "Numéro de téléphone",
    "Bio / About User": "Biographie / À propos",
    "Add information about yourself...": "Ajoutez des informations sur vous...",
    "View and track historical completed months": "Consulter l'historique des mois clôturés",
    "Open Records": "Ouvrir les dossiers",
    "Report an Issue": "Signaler un problème",
    "Facing a problem? Submit an issue report": "Un problème ? Envoyez un rapport",
    "Report Issue": "Signaler un problème",
    "Language / மொழி": "Langue (Language)",
    "Account Session": "Session de compte",
    "Sign out from this device securely": "Se déconnecter en toute sécurité",
    "Log out": "Se déconnecter",
    "Save Profile": "Enregistrer le profil",

    "Submit issue details or feedback to support": "Envoyer les détails au support",
    "Issue Category *": "Catégorie *",
    "Issue Summary / Subject *": "Objet *",
    "Detailed Description *": "Description détaillée *",
    "Submit Report": "Envoyer le rapport",

    "Finance Overview": "Aperçu des finances",
    "Total Income": "Revenu total",
    "Net Savings": "Épargne nette",
    "Export CSV": "Exporter en CSV",
    "+ Income": "+ Revenu",
    "+ Expense": "+ Dépense",
    "Add Transaction": "Ajouter transaction",
    "Add Bill": "Ajouter facture",
    "Add Task": "Ajouter tâche",
    "Add Goal": "Ajouter objectif",
    "Add Note": "Ajouter note",
    "Add Contact": "Ajouter contact",
    "Add Appointment": "Ajouter rendez-vous",
    "Add Asset": "Ajouter actif",
    "Add Document": "Ajouter document",
    "Add Password": "Ajouter mot de passe",
    "Status": "Statut",
    "Action": "Action",
    "Actions": "Actions",
    "Category": "Catégorie",
    "Amount": "Montant",
    "Date": "Date",
    "All": "Tout",
    "Filter": "Filtrer",
    "Close": "Fermer",

    "LifeLedger AI — Personal Life Intelligence Dashboard.": "LifeLedger AI — Tableau de bord d'intelligence de vie personnelle."
  }
};

// Build comprehensive bidirectional lookup map
const PHRASE_TO_KEY = {};
Object.keys(TRANSLATIONS).forEach(lang => {
  const dict = TRANSLATIONS[lang];
  Object.keys(dict).forEach(k => {
    const val = dict[k];
    if (val) PHRASE_TO_KEY[val.trim()] = k;
    PHRASE_TO_KEY[k.trim()] = k;
  });
});

function t(key) {
  if (TRANSLATIONS[currentLanguage] && TRANSLATIONS[currentLanguage][key]) {
    return TRANSLATIONS[currentLanguage][key];
  }
  if (TRANSLATIONS.en && TRANSLATIONS.en[key]) {
    return TRANSLATIONS.en[key];
  }
  return key;
}

function translateDomTextNodes(root) {
  if (!root || typeof document === "undefined") return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while ((node = walker.nextNode())) {
    if (!node.nodeValue) continue;
    const trimmed = node.nodeValue.trim();
    if (!trimmed) continue;
    const key = PHRASE_TO_KEY[trimmed];
    if (key) {
      const translated = t(key);
      if (translated && translated !== trimmed) {
        node.nodeValue = node.nodeValue.replace(trimmed, translated);
      }
    }
  }
}

function applyPageTranslations() {
  if (typeof document === "undefined") return;

  // 1. Static element text & attributes with data-i18n
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (key && (TRANSLATIONS.en[key] || PHRASE_TO_KEY[key])) {
      const actualKey = PHRASE_TO_KEY[key] || key;
      el.textContent = t(actualKey);
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key && (TRANSLATIONS.en[key] || PHRASE_TO_KEY[key])) {
      const actualKey = PHRASE_TO_KEY[key] || key;
      el.placeholder = t(actualKey);
    }
  });

  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    const key = el.getAttribute("data-i18n-title");
    if (key && (TRANSLATIONS.en[key] || PHRASE_TO_KEY[key])) {
      const actualKey = PHRASE_TO_KEY[key] || key;
      el.title = t(actualKey);
    }
  });

  // 2. Chip buttons
  document.querySelectorAll(".chip-btn").forEach(btn => {
    const chipKey = btn.getAttribute("data-chip-key") || btn.dataset.text;
    if (chipKey) {
      const actualKey = PHRASE_TO_KEY[chipKey] || chipKey;
      const translated = t(actualKey);
      btn.textContent = (actualKey === "Spent ₹450 on food today")
        ? (currentLanguage === "ta" ? "இன்று உணவுக்கு ₹450 செலவழித்தேன்" : (currentLanguage === "en" ? "I spent ₹450 on food today" : translated))
        : translated;
      btn.dataset.text = translated;
    }
  });

  // 3. Quick entry input placeholder
  const nlInput = document.getElementById("nlInput");
  if (nlInput) {
    nlInput.placeholder = t('e.g. “Spent ₹450 on food today” or “Finish the ML assignment tomorrow”');
  }

  // 4. Update language select & currentLangLabel in profile modal
  const langSelect = document.getElementById("userLanguageSelect");
  if (langSelect) langSelect.value = currentLanguage || "en";
  const langLabel = document.getElementById("currentLangLabel");
  if (langLabel) {
    const names = {
      en: "English (Selected)",
      ta: "தமிழ் (தேர்ந்தெடுக்கப்பட்டது)",
      hi: "हिन्दी (चयनित)",
      ml: "മലയാളം (തിരഞ്ഞെടുത്തു)",
      te: "తెలుగు (ఎంపిక చేయబడింది)",
      es: "Español (Seleccionado)",
      fr: "Français (Sélectionné)"
    };
    langLabel.textContent = names[currentLanguage] || currentLanguage;
  }

  // 5. Walk DOM text nodes in #mainContent and modals for full-page coverage
  translateDomTextNodes(document.getElementById("mainContent"));
  translateDomTextNodes(document.getElementById("userProfileModal"));
  translateDomTextNodes(document.getElementById("reportIssueModal"));
}

function changeLanguage(lang) {
  currentLanguage = lang || "en";
  localStorage.setItem("lifeleader_lang", currentLanguage);
  applyPageTranslations();
  renderNav();
  renderMain();
  if (typeof updateLiveDate === "function") updateLiveDate();

  const toasts = {
    ta: "மொழி வெற்றிகரமாக மாற்றப்பட்டது!",
    hi: "भाषा सफलतापूर्वक बदली गई!",
    ml: "ഭാഷ വിജയകരമായി മാറ്റി!",
    te: "భాష విజయవంతంగా మార్చబడింది!",
    es: "¡Idioma actualizado con éxito!",
    fr: "Langue mise à jour avec succès!",
    en: "Language updated successfully!"
  };
  showToast(toasts[currentLanguage] || "Language updated successfully!");
}
window.changeLanguage = changeLanguage;

function renderNav() {
  const nav = document.getElementById("mainNav");
  const quickEntry = document.querySelector(".quickentry");
  if (!nav) return;

  // In Monthly Balance History, do not show mainNav and quickentry
  if (activeView === "Balance Settings" || activeView === "Settings") {
    nav.style.display = "none";
    if (quickEntry) quickEntry.style.display = "none";
    return;
  }
  nav.style.display = "";
  if (quickEntry) quickEntry.style.display = "";

  nav.innerHTML = views.map(v =>
    `<button data-view="${v}" class="${v === activeView ? 'active' : ''}">${NAV_ICONS[v] || ''}<span>${t(v)}</span></button>`
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

// Donut Chart Generator (Smooth SVG Vector Donut with Percentages)
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

  const PALETTE = ['#8b5cf6', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#ef4444', '#64748b'];

  const radius = 64;
  const circumference = 2 * Math.PI * radius; // ~402.12
  let currentOffset = 0;

  const isSingle = entries.length === 1;
  const svgSlices = entries.map(([category, amt], idx) => {
    const pct = amt / total;
    const strokeDash = pct * circumference;
    const strokeOffset = -currentOffset;
    currentOffset += strokeDash;
    const color = PALETTE[idx % PALETTE.length];

    return `
      <circle cx="100" cy="100" r="${radius}"
        class="donut-slice"
        data-index="${idx}"
        fill="transparent"
        stroke="${color}"
        stroke-width="22"
        stroke-dasharray="${isSingle ? circumference : strokeDash} ${circumference}"
        stroke-dashoffset="${strokeOffset}"
        stroke-linecap="${isSingle ? 'butt' : 'round'}"
        transform="rotate(-90 100 100)"
      />`;
  }).join("");

  const legendHtml = entries.map(([category, amt], idx) => {
    const pct = Math.round((amt / total) * 100);
    const color = PALETTE[idx % PALETTE.length];
    return `
      <div class="legend-row" style="display:flex; align-items:center; gap:8px; padding:4px 0;">
        <span class="legend-swatch" style="background:${color}; width:10px; height:10px; border-radius:3px; flex-shrink:0;"></span>
        <span class="legend-label" style="font-weight:500; color:#334155; font-size:13.5px; flex:1;">${category}</span>
        <span style="font-size:12px; font-weight:500; color:#64748b; background:#f1f5f9; padding:2px 7px; border-radius:6px;">${pct}%</span>
        <span class="legend-amt num" style="font-weight:600; color:#0f172a; font-size:13.5px;">${fmt(amt)}</span>
      </div>`;
  }).join("");

  const totalStr = fmt(total);

  return `
    <div class="donut-container" style="display:flex; align-items:center; gap:28px; flex-wrap:wrap; padding:8px 0;">
      <div class="donut-graphic-wrapper">
        <svg viewBox="0 0 200 200" width="180" height="180" style="overflow:visible;">
          <defs>
            <filter id="donutShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.08"/>
            </filter>
          </defs>
          <!-- Background Track -->
          <circle cx="100" cy="100" r="${radius}" fill="transparent" stroke="#f1f5f9" stroke-width="22" />
          <!-- Slices -->
          <g filter="url(#donutShadow)">
            ${svgSlices}
          </g>
        </svg>
        <div class="donut-hole">
          <div class="lbl" style="font-size:10px; font-weight:500; letter-spacing:0.04em; text-transform:uppercase; color:var(--text-muted, #64748b);">TOTAL</div>
          <div class="val num" style="font-size:16.5px; font-weight:600; color:#0f172a; margin-top:2px;">${totalStr}</div>
        </div>
      </div>
      <div class="donut-legend" style="flex:1; min-width:180px; display:flex; flex-direction:column; gap:6px;">
        ${legendHtml}
      </div>
    </div>`;
}

// Income vs Expenses Dual Bar Chart (Dynamic from User Data with Strict Mathematically Nice Steps)
function buildDualBarChart(monthKey) {
  const currentKey = monthKey || getCurrentFinanceMonthKey();
  const inc = totalIncomeForMonth ? totalIncomeForMonth(currentKey) : totalIncome();
  const exp = totalExpenseForMonth ? totalExpenseForMonth(currentKey) : totalExpense();

  if (inc === 0 && exp === 0 && (!state.expenses || state.expenses.length === 0)) {
    return `
      <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 36px; margin-bottom: 8px;">📊</div>
        <div style="font-weight: 700; color: #334155; margin-bottom: 4px; font-size: 15px;">No cashflow entries logged</div>
        <div style="font-size: 12.5px;">Add your income or expenses to render comparative financial bars.</div>
      </div>`;
  }

  // Calculate clean, mathematically rounded nice ticks (No duplicate 2k, no 813)
  const highestVal = Math.max(inc, exp, 100);
  function computeNiceScale(val) {
    if (val <= 0) val = 1000;
    const rough = val / 3;
    const p = Math.pow(10, Math.floor(Math.log10(rough)));
    const frac = rough / p;
    let factor = 1;
    if (frac > 1.2 && frac <= 2.5) factor = 2;
    else if (frac > 2.5 && frac <= 7) factor = 5;
    else if (frac > 7) factor = 10;
    const step = factor * p;
    const max = Math.ceil(val / step) * step;
    const ticks = [];
    for (let t = max; t >= 0; t -= step) {
      ticks.push(t);
    }
    return { max: Math.max(max, step), ticks };
  }

  const { max: maxVal, ticks: yTicks } = computeNiceScale(highestVal * 1.18);
  const chartH = 200, chartW = 540, padL = 60, padB = 40, padT = 32, padR = 25;
  const plotH = chartH - padB - padT;

  const gridLines = yTicks.map(val => {
    const y = padT + plotH * (1 - val / maxVal);
    const labelText = val === 0 ? "₹0" : (val >= 1000 ? (val % 1000 === 0 ? `₹${val/1000}k` : `₹${(val/1000).toFixed(1)}k`) : `₹${Math.round(val)}`);
    return `
      <g class="grid-line-group">
        <line x1="${padL}" y1="${y}" x2="${chartW - padR}" y2="${y}" stroke="#f1f5f9" stroke-width="1.2" stroke-dasharray="3,3" />
        <text x="${padL - 10}" y="${y + 3.5}" font-size="10.5" font-weight="600" fill="#94a3b8" text-anchor="end" font-family="var(--font-smooth-number)">${labelText}</text>
      </g>`;
  }).join("");

  // Position and heights of the bars
  const barW = 46;
  const centerX = (padL + (chartW - padR)) / 2;
  const xInc = centerX - barW - 14;
  const xExp = centerX + 14;

  const incH = inc > 0 ? Math.max((inc / maxVal) * plotH, 6) : 4;
  const expH = exp > 0 ? Math.max((exp / maxVal) * plotH, 6) : 4;
  const yInc = padT + plotH - incH;
  const yExp = padT + plotH - expH;

  const incOpacity = inc > 0 ? 1 : 0.45;
  const expOpacity = exp > 0 ? 1 : 0.45;

  const netDiff = inc - exp;
  const netBadge = netDiff >= 0 
    ? `<span style="display:inline-flex; align-items:center; gap:4px; color:#059669; font-weight:700; font-size:12px; background:#ecfdf5; border:1px solid #a7f3d0; padding:3px 10px; border-radius:12px; font-family:var(--font-smooth-number);"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"/></svg> Net Surplus: +${fmt(netDiff)}</span>`
    : `<span style="display:inline-flex; align-items:center; gap:4px; color:#dc2626; font-weight:700; font-size:12px; background:#fef2f2; border:1px solid #fecaca; padding:3px 10px; border-radius:12px; font-family:var(--font-smooth-number);"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg> Net Deficit: -${fmt(Math.abs(netDiff))}</span>`;

  return `
    <div style="margin-bottom: 8px; display:flex; justify-content:flex-end;">
      ${netBadge}
    </div>
    <div class="svg-bar-chart-wrap" style="position:relative;">
      <svg viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none" style="width:100%; height:100%;">
        <defs>
          <linearGradient id="incBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#10b981"/>
            <stop offset="100%" stop-color="#059669"/>
          </linearGradient>
          <linearGradient id="expBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f43f5e"/>
            <stop offset="100%" stop-color="#e11d48"/>
          </linearGradient>
          <filter id="barShadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.12"/>
          </filter>
        </defs>
        ${gridLines}

        <!-- Zero Baseline -->
        <line x1="${padL}" y1="${padT + plotH}" x2="${chartW - padR}" y2="${padT + plotH}" stroke="#cbd5e1" stroke-width="1.5" />

        <!-- Income Bar -->
        <g class="bar-group" style="cursor:default;">
          <rect x="${xInc}" y="${yInc}" width="${barW}" height="${incH}" rx="${inc > 0 ? 8 : 2}" fill="url(#incBarGrad)" opacity="${incOpacity}" filter="url(#barShadow)" />
          <!-- Floating Value Badge on Top -->
          <text x="${xInc + barW / 2}" y="${yInc - 7}" font-size="12" font-weight="700" fill="${inc > 0 ? '#059669' : '#94a3b8'}" text-anchor="middle" font-family="var(--font-smooth-number)">${fmt(inc)}</text>
          <!-- Bottom Category Label -->
          <text x="${xInc + barW / 2}" y="${chartH - 10}" font-size="12" font-weight="700" fill="#475569" text-anchor="middle">Income</text>
        </g>

        <!-- Expenses Bar -->
        <g class="bar-group" style="cursor:default;">
          <rect x="${xExp}" y="${yExp}" width="${barW}" height="${expH}" rx="${exp > 0 ? 8 : 2}" fill="url(#expBarGrad)" opacity="${expOpacity}" filter="url(#barShadow)" />
          <!-- Floating Value Badge on Top -->
          <text x="${xExp + barW / 2}" y="${yExp - 7}" font-size="12" font-weight="700" fill="${exp > 0 ? '#e11d48' : '#94a3b8'}" text-anchor="middle" font-family="var(--font-smooth-number)">${fmt(exp)}</text>
          <!-- Bottom Category Label -->
          <text x="${xExp + barW / 2}" y="${chartH - 10}" font-size="12" font-weight="700" fill="#475569" text-anchor="middle">Expenses</text>
        </g>
      </svg>
    </div>`;
}

// Daily Balance Trend Line Chart (Smooth Monotone Spline with Correct Calendar Dates and Positive/Negative Ranges)
function buildBalanceTrendChart(monthKey) {
  const currentKey = monthKey || getCurrentFinanceMonthKey();
  let incList = getFinanceIncomeForMonth ? getFinanceIncomeForMonth(currentKey) : (state.income || []);
  let expList = getFinanceExpensesForMonth ? getFinanceExpensesForMonth(currentKey) : (state.expenses || []);

  const totalInc = incList.reduce((s, i) => s + (i.amount || 0), 0);
  const totalExp = expList.reduce((s, e) => s + (e.amount || 0), 0);

  if (totalInc === 0 && expList.length === 0) {
    return `
      <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 36px; margin-bottom: 8px;">📈</div>
        <div style="font-weight: 700; color: #334155; margin-bottom: 4px; font-size: 15px;">No balance trend data</div>
        <div style="font-size: 12.5px;">Log income or expenses to plot your real-time balance curve.</div>
      </div>`;
  }

  // Parse month and days
  const [yearStr, monthStr] = currentKey.split("-");
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const monthAbbr = new Date(year, monthNum - 1, 1).toLocaleString("en-US", { month: "short" });

  // Starting carried balance from previous month
  const savingsData = typeof getMonthlySavingsData === "function" ? getMonthlySavingsData(currentKey) : { lastMonthBalance: 0 };
  const initialBalance = savingsData.lastMonthBalance || 0;

  // Map daily transactions
  const dailyNet = {};
  for (let d = 1; d <= daysInMonth; d++) {
    dailyNet[d] = 0;
  }

  incList.forEach(item => {
    if (item.date) {
      const parts = item.date.split("-");
      if (parts.length >= 3) {
        const d = parseInt(parts[2], 10);
        if (d >= 1 && d <= daysInMonth) dailyNet[d] += (item.amount || 0);
      }
    }
  });

  expList.forEach(item => {
    if (item.date) {
      const parts = item.date.split("-");
      if (parts.length >= 3) {
        const d = parseInt(parts[2], 10);
        if (d >= 1 && d <= daysInMonth) dailyNet[d] -= (item.amount || 0);
      }
    }
  });

  // Find max active day in this month
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === monthNum;
  const currentDay = isCurrentMonth ? today.getDate() : daysInMonth;

  let maxActiveDay = 1;
  for (let d = 1; d <= daysInMonth; d++) {
    if (dailyNet[d] !== 0) maxActiveDay = Math.max(maxActiveDay, d);
  }
  const timelineEndDay = isCurrentMonth ? Math.min(daysInMonth, Math.max(currentDay, maxActiveDay, 7)) : daysInMonth;

  // Build daily points
  const points = [];
  let running = initialBalance;
  for (let d = 1; d <= timelineEndDay; d++) {
    running += dailyNet[d];
    points.push({ day: d, balance: running, delta: dailyNet[d] });
  }

  if (points.length < 2) {
    points.push({ day: 2, balance: running, delta: 0 });
  }

  const balances = points.map(p => p.balance);
  let minB = Math.min(...balances);
  let maxB = Math.max(...balances);

  // If minB === maxB, expand margins
  if (minB === maxB) {
    if (minB >= 0) { maxB += 1000; minB = 0; }
    else { minB -= 1000; maxB = 0; }
  }

  // Always include 0 in the scale
  if (minB > 0) minB = 0;
  if (maxB < 0) maxB = 0;

  // Calculate clean, nice step scale
  const span = Math.max(maxB - minB, 500);
  const roughStep = span / 4;
  const power = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const frac = roughStep / power;
  let factor = 1;
  if (frac > 1.2 && frac <= 2.5) factor = 2;
  else if (frac > 2.5 && frac <= 7) factor = 5;
  else if (frac > 7) factor = 10;
  const step = factor * power;

  const niceMin = Math.floor(minB / step) * step;
  const niceMax = Math.ceil(maxB / step) * step;
  const totalSpan = niceMax - niceMin || 1;

  const yTicks = [];
  for (let v = niceMax; v >= niceMin; v -= step) {
    yTicks.push(v);
  }

  const chartW = 580, chartH = 220, padL = 60, padB = 34, padT = 20, padR = 25;
  const plotH = chartH - padB - padT;
  const plotW = chartW - padL - padR;

  const getY = v => padT + plotH * (1 - (v - niceMin) / totalSpan);
  const getX = (d, totalDays) => padL + ((d - 1) / Math.max(totalDays - 1, 1)) * plotW;

  const yZero = getY(0);

  // Y-axis grid lines and labels
  const gridLines = yTicks.map(val => {
    const y = getY(val);
    const isZero = Math.abs(val) < 0.001;
    const labelText = isZero 
      ? "₹0" 
      : (val > 0 
          ? (val >= 1000 ? (val % 1000 === 0 ? `+₹${val/1000}k` : `+₹${(val/1000).toFixed(1)}k`) : `+₹${val}`)
          : (Math.abs(val) >= 1000 ? (val % 1000 === 0 ? `-₹${Math.abs(val)/1000}k` : `-₹${(Math.abs(val)/1000).toFixed(1)}k`) : `-₹${Math.abs(val)}`));
    
    const strokeColor = isZero ? "#cbd5e1" : "#f1f5f9";
    const strokeWidth = isZero ? 1.5 : 1;
    const textColor = isZero ? "#64748b" : (val < 0 ? "#dc2626" : "#64748b");
    const strokeDash = isZero ? "none" : "3,3";

    return `
      <g class="grid-line-group">
        <line x1="${padL}" y1="${y}" x2="${chartW - padR}" y2="${y}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDash}" />
        <text x="${padL - 10}" y="${y + 3.5}" font-size="10.5" font-weight="${isZero ? 700 : 600}" fill="${textColor}" text-anchor="end" font-family="var(--font-smooth-number)">${labelText}</text>
      </g>`;
  }).join("");

  // Smooth Bezier Curve computation (Monotone/Catmull-Rom spline)
  const coords = points.map(p => ({ x: getX(p.day, timelineEndDay), y: getY(p.balance), val: p.balance, day: p.day }));
  
  let pathD = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(i - 1, 0)];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[Math.min(i + 2, coords.length - 1)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    pathD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  // Area path: fills cleanly down to yZero or chart bottom
  const lastCoord = coords[coords.length - 1];
  const firstCoord = coords[0];
  const baselineY = Math.min(Math.max(yZero, padT), padT + plotH);
  const areaD = `${pathD} L ${lastCoord.x.toFixed(1)} ${baselineY.toFixed(1)} L ${firstCoord.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;

  // X-axis date milestones
  const xMilestones = [];
  const stepDays = timelineEndDay <= 10 ? 2 : (timelineEndDay <= 20 ? 4 : 7);
  for (let d = 1; d <= timelineEndDay; d += stepDays) {
    xMilestones.push(d);
  }
  if (!xMilestones.includes(timelineEndDay)) xMilestones.push(timelineEndDay);

  const xDateLabels = xMilestones.map(d => {
    const x = getX(d, timelineEndDay);
    return `
      <g>
        <line x1="${x}" y1="${padT + plotH}" x2="${x}" y2="${padT + plotH + 4}" stroke="#cbd5e1" stroke-width="1.2" />
        <text x="${x}" y="${chartH - 8}" font-size="10" font-weight="600" fill="#64748b" text-anchor="middle" font-family="var(--font-smooth-number)">${monthAbbr} ${d}</text>
      </g>`;
  }).join("");

  // Last point & active day dots
  const lastPoint = coords[coords.length - 1];
  const isNetNegative = lastPoint.val < 0;
  const strokeColor = isNetNegative ? "#8b5cf6" : "#4f46e5";
  const gradStart = isNetNegative ? "#8b5cf6" : "#4f46e5";

  // Data dots for days with transactions
  const activeDots = coords.filter(c => {
    const pt = points.find(p => p.day === c.day);
    return pt && (pt.delta !== 0 || c.day === coords[0].day || c.day === lastPoint.day);
  }).map(c => {
    return `
      <g class="trend-dot-group">
        <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="5" fill="#ffffff" stroke="${strokeColor}" stroke-width="2.5" />
        <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="2.5" fill="${strokeColor}" />
      </g>`;
  }).join("");

  const latestBalFormatted = (lastPoint.val >= 0 ? "+" : "") + fmt(lastPoint.val);
  const statusColor = lastPoint.val >= 0 ? "#059669" : "#dc2626";
  const statusBg = lastPoint.val >= 0 ? "#ecfdf5" : "#fef2f2";
  const statusBorder = lastPoint.val >= 0 ? "#a7f3d0" : "#fecaca";

  return `
    <div style="margin-bottom: 8px; display:flex; justify-content:space-between; align-items:center;">
      <span style="font-size:12px; color:var(--text-muted); font-weight:500;">
        Carried: <b style="color:#0f172a; font-family:var(--font-smooth-number);">${fmt(initialBalance)}</b>
      </span>
      <span style="display:inline-flex; align-items:center; gap:4px; font-weight:700; font-size:12.5px; color:${statusColor}; background:${statusBg}; border:1px solid ${statusBorder}; padding:2px 10px; border-radius:12px; font-family:var(--font-smooth-number);">
        Current Balance: ${latestBalFormatted}
      </span>
    </div>
    <div class="svg-line-chart-wrap" style="height: 220px; position:relative;">
      <svg viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none" style="width:100%; height:100%;">
        <defs>
          <linearGradient id="balanceGradDynamic" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${gradStart}" stop-opacity="0.32"/>
            <stop offset="100%" stop-color="${gradStart}" stop-opacity="0.02"/>
          </linearGradient>
          <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${strokeColor}" flood-opacity="0.25"/>
          </filter>
        </defs>
        ${gridLines}
        ${xDateLabels}
        <path d="${areaD}" fill="url(#balanceGradDynamic)" />
        <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" filter="url(#lineGlow)" />
        ${activeDots}
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
  const nav = document.getElementById("mainNav");
  const quickEntry = document.querySelector(".quickentry");

  // In Monthly Balance History session, do not show the above session (mainNav and quickentry)
  if (activeView === "Balance Settings" || activeView === "Settings") {
    if (nav) nav.style.display = "none";
    if (quickEntry) quickEntry.style.display = "none";
  } else {
    if (nav) nav.style.display = "";
    if (quickEntry) quickEntry.style.display = "";
  }

  if (activeView === "Dashboard") main.innerHTML = viewDashboard();
  else if (activeView === "Finance") main.innerHTML = viewFinance();
  else if (activeView === "Bills") main.innerHTML = viewBills();
  else if (activeView === "Productivity" || activeView === "Tasks") main.innerHTML = viewProductivityTimetable();
  else if (activeView === "Documents") main.innerHTML = viewDocuments();
  else if (activeView === "Appointments") main.innerHTML = viewAppointments();
  else if (activeView === "Goals") main.innerHTML = viewGoals();
  else if (activeView === "Notes & Journal") main.innerHTML = viewNotesAndJournal();
  else if (activeView === "Contacts") main.innerHTML = viewContacts();
  else if (activeView === "Password") main.innerHTML = viewPassword();
  else if (activeView === "Balance Settings" || activeView === "Settings") main.innerHTML = viewBalanceSettings();
  else {
    activeView = "Dashboard";
    main.innerHTML = viewDashboard();
  }
  attachHandlers();
  checkAlerts();
  if (typeof applyPageTranslations === "function") {
    applyPageTranslations();
  }
}

/* ===== 1. DASHBOARD VIEW ===== */
function viewDashboard() {
  const currentMonth = getCurrentFinanceMonthKey();
  const mIncList = getFinanceIncomeForMonth(currentMonth);
  const mExpList = getFinanceExpensesForMonth(currentMonth);

  const inc = mIncList.reduce((s, i) => s + (i.amount || 0), 0);
  const exp = mExpList.reduce((s, e) => s + (e.amount || 0), 0);
  const incomeExp = totalIncomeExpenseForMonth(currentMonth);
  const savingsExp = totalSavingsExpenseForMonth(currentMonth);
  const netAmount = inc - incomeExp;
  const bal = netAmount;
  const cats = categoryTotalsForMonth(currentMonth);

  // Monthly savings with last month balance rollover
  const savingsData = getMonthlySavingsData(currentMonth);

  const activeGoals = (state.goals || []).filter(g => !g.completed);
  const totalSaved = (state.goals || []).reduce((s, g) => s + (g.current || 0), 0);
  const totalTarget = (state.goals || []).reduce((s, g) => s + (g.target || 0), 0);
  const targetPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  const insights = [];
  if (savingsData.lastMonthBalance > 0) {
    insights.push({
      kind: "good",
      title: `Last Month Surplus Saved (${fmt(savingsData.lastMonthBalance)})`,
      text: `Your remaining balance of ${fmt(savingsData.lastMonthBalance)} from ${savingsData.prevMonthLabel} was rolled into your savings for ${getMonthYearLabel(currentMonth)}.`
    });
  }
  if (incomeExp > 0 && inc > 0 && incomeExp > inc) {
    insights.push({ kind: "warn", title: "Expenses exceed income", text: `Your spending from income (${fmt(incomeExp)}) is higher than your logged income (${fmt(inc)}).` });
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
  <!-- Stat Cards -->
  <div class="stat-cards-row ${savingsData.isFirstMonth ? 'three-cards' : ''}">
    <div class="stat-block c-green">
      <div class="sb-top">
        <div class="sb-icon">↙</div>
        <div class="sb-delta">${inc > 0 ? 'Active' : '0%'}</div>
      </div>
      <div class="sb-label">${t('MONTHLY INCOME')}</div>
      <div class="sb-value num">${fmt(inc)}</div>
    </div>
    <div class="stat-block c-red">
      <div class="sb-top">
        <div class="sb-icon">↗</div>
        <div class="sb-delta">${inc > 0 ? Math.round((incomeExp / inc) * 100) + '%' : '0%'}</div>
      </div>
      <div class="sb-label">${t('MONTHLY EXPENSES')}</div>
      <div class="sb-value num">${fmt(incomeExp)}</div>
      ${!savingsData.isFirstMonth && savingsExp > 0 ? `<div style="font-size:10.5px; color:#4f46e5; font-weight:600; margin-top:2px;">+${fmt(savingsExp)} from savings</div>` : ''}
    </div>
    <div class="stat-block c-indigo">
      <div class="sb-top">
        <div class="sb-icon">💳</div>
        <div class="sb-delta">${inc > 0 ? Math.round((netAmount / inc) * 100) + '%' : '0%'}</div>
      </div>
      <div class="sb-label">${t('NET AMOUNT')}</div>
      <div class="sb-value num">${fmt(netAmount)}</div>
    </div>
    ${!savingsData.isFirstMonth ? `
    <div class="stat-block c-gold" style="cursor: pointer;" onclick="goToBalanceSettingsPage()" title="${t('Click to view & manage Monthly Balance History')}">
      <div class="sb-top">
        <div class="sb-icon">🏦</div>
        ${savingsData.allTimeSavingsExp > 0 ? 
          `<div class="sb-delta" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; font-weight: 700; padding: 2px 8px; border-radius: 12px; font-size: 11px;">-${fmt(savingsData.allTimeSavingsExp)} spent</div>` : 
          (savingsData.lastMonthBalance > 0 ? `<div class="sb-delta" style="font-size: 11px;">Active</div>` : '')}
      </div>
      <div class="sb-label">${t('Dashboard Savings')}</div>
      <div class="sb-value num">${fmt(savingsData.totalSavings)}</div>
      ${savingsData.allTimeSavingsExp > 0 ? `
        <div style="font-size: 11.5px; font-weight: 600; color: #92400e; margin-top: 4px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
          <span style="color: #dc2626; font-weight: 700;">-${fmt(savingsData.allTimeSavingsExp)}</span> spent • <span style="color: #059669; font-weight: 700;">${fmt(savingsData.totalSavings)}</span> balance
        </div>
      ` : (savingsData.lastMonthBalance > 0 ? `
        <div style="font-size: 11.5px; font-weight: 600; color: #92400e; margin-top: 4px;">
          +${fmt(savingsData.lastMonthBalance)} from prev month
        </div>
      ` : '')}
    </div>
    ` : ''}
  </div>

  <!-- Charts Row (2 Columns) -->
  <div class="grid-2" style="margin-bottom: 24px;">
    <div class="card">
      <div class="card-header">
        <div>
          <h2>${t('Spending by Category')}</h2>
          <div class="sub">${t('Total Expenses')}: ${fmt(exp)}</div>
        </div>
      </div>
      ${buildDonutChart(cats)}
    </div>

    <div class="card bar-chart-card">
      <div class="card-header">
        <div>
          <h2>${t('Income vs Expenses')}</h2>
          <div class="sub">${t('Cashflow Comparison')} (${getMonthYearLabel(currentMonth)})</div>
        </div>
        <div class="chart-legend">
          <span class="legend-item"><span class="legend-dot" style="background:#10b981"></span>${t('Income')}</span>
          <span class="legend-item"><span class="legend-dot" style="background:#f43f5e"></span>${t('Expenses')}</span>
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
          <h2>${t('Upcoming')}</h2>
          <div class="sub">${t('Bills and appointments scheduled')}</div>
        </div>
        <span class="status-badge upcoming-badge">${totalUpcoming} ${t('items')}</span>
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
            <h2>${t('AI Insights')}</h2>
            <div class="sub">${t('Generated from your current data')}</div>
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
            <h2>${t('Goals in Progress')}</h2>
            <div class="sub">${activeGoals.length} ${t('active goals')}</div>
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
            <span>${activeGoals.length} ${t('goals active in your tracker')}</span>
          </div>` : ''}
      </div>
    </div>
  </div>`;
}

/* ===== 2. FINANCE VIEW HELPERS ===== */
function renderTxTableRows(expList, incList, currentMonth) {
  const list = [];
  (expList || []).forEach(e => {
    list.push({
      type: 'expense',
      date: e.date || '',
      desc: e.desc || 'Expense',
      category: e.category || 'Other',
      catClass: (e.category || 'Other').split(' ')[0],
      amount: e.amount || 0,
      paidFrom: e.paidFrom || 'income',
      id: e.id
    });
  });

  (incList || []).forEach(i => {
    let rawDesc = i.source || '';
    if (!rawDesc || rawDesc === '₹,' || rawDesc === '₹' || rawDesc === ',') {
      rawDesc = i.category || 'Salary';
    }
    list.push({
      type: 'income',
      date: i.date || '',
      desc: rawDesc,
      category: i.category || 'Salary',
      catClass: (i.category || 'Salary').split(' ')[0],
      amount: i.amount || 0,
      id: i.id
    });
  });

  // Sort descending by date
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (list.length === 0) {
    const periodLabel = currentMonth ? getMonthYearLabel(currentMonth) : 'this period';
    return `
      <tr>
        <td colspan="6" style="text-align:center; padding: 28px; color:var(--text-muted);">
          No transactions found for <strong>${periodLabel}</strong>. Use <strong>+ Add Income</strong> or <strong>+ Add Expense</strong> to record entries!
        </td>
      </tr>
    `;
  }

  return list.map(item => {
    if (item.type === 'expense') {
      return `
        <tr>
          <td class="num">${item.date}</td>
          <td style="font-weight:600; color:#0f172a;">${item.desc}</td>
          <td><span class="cat-badge ${item.catClass}">${item.category}</span></td>
          <td>
            <span class="type-pill expense">Expense</span>
            ${item.paidFrom === 'savings' ? `<span class="type-pill" style="background:#eef2ff; color:#4f46e5; border:1px solid #c7d2fe; margin-left:4px; font-size:10.5px; font-weight:700;">🏦 Savings</span>` : ''}
          </td>
          <td style="text-align:right;" class="amt-neg">-${fmt(item.amount)}</td>
          <td style="text-align:center; white-space:nowrap;">
            <div class="action-btn-group" style="justify-content: center;">
              <button type="button" class="action-btn edit-btn" onclick="openEditExpenseModal('${item.id}')" title="Edit Expense">Edit</button>
              <button type="button" class="action-btn danger-btn" onclick="deleteExpense('${item.id}')" title="Delete Expense">Delete</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      return `
        <tr>
          <td class="num">${item.date}</td>
          <td style="font-weight:600; color:#0f172a;">${item.desc}</td>
          <td><span class="cat-badge ${item.catClass}">${item.category}</span></td>
          <td><span class="type-pill income">Income</span></td>
          <td style="text-align:right;" class="amt-pos">+${fmt(item.amount)}</td>
          <td style="text-align:center; white-space:nowrap;">
            <div class="action-btn-group" style="justify-content: center;">
              <button type="button" class="action-btn edit-btn" onclick="openEditIncomeModal('${item.id}')" title="Edit Income">Edit</button>
              <button type="button" class="action-btn danger-btn" onclick="deleteIncome('${item.id}')" title="Delete Income">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }
  }).join('');
}

function renderDashboardTxRows(expList, incList) {
  const list = [];
  (expList || []).forEach(e => {
    list.push({
      type: 'expense',
      date: e.date || '',
      desc: e.desc || 'Expense',
      category: e.category || 'Other',
      catClass: (e.category || 'Other').split(' ')[0],
      amount: e.amount || 0,
      paidFrom: e.paidFrom || 'income',
      id: e.id
    });
  });

  (incList || []).forEach(i => {
    let rawDesc = i.source || '';
    if (!rawDesc || rawDesc === '₹,' || rawDesc === '₹' || rawDesc === ',') {
      rawDesc = i.category || 'Salary';
    }
    list.push({
      type: 'income',
      date: i.date || '',
      desc: rawDesc,
      category: i.category || 'Salary',
      catClass: (i.category || 'Salary').split(' ')[0],
      amount: i.amount || 0,
      id: i.id
    });
  });

  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const recent = list.slice(0, 5);

  if (recent.length === 0) {
    return `
      <tr>
        <td colspan="6" style="text-align:center; padding: 24px; color:var(--text-muted); font-size:13px;">
          No transactions logged yet. Click <strong>+ Add Income</strong> or <strong>+ Add Expense</strong> above to record your first entry!
        </td>
      </tr>
    `;
  }

  return recent.map(item => {
    if (item.type === 'expense') {
      return `
        <tr>
          <td class="num">${item.date}</td>
          <td style="font-weight:600; color:#0f172a;">${item.desc}</td>
          <td><span class="cat-badge ${item.catClass}">${item.category}</span></td>
          <td>
            <span class="type-pill expense">Expense</span>
            ${item.paidFrom === 'savings' ? `<span class="type-pill" style="background:#eef2ff; color:#4f46e5; border:1px solid #c7d2fe; margin-left:4px; font-size:10.5px; font-weight:700;">🏦 Savings</span>` : ''}
          </td>
          <td style="text-align:right;" class="amt-neg">-${fmt(item.amount)}</td>
          <td style="text-align:center; white-space:nowrap;">
            <div class="action-btn-group" style="justify-content: center;">
              <button type="button" class="action-btn edit-btn" onclick="openEditExpenseModal('${item.id}')" title="Edit Expense">Edit</button>
              <button type="button" class="action-btn danger-btn" onclick="deleteExpense('${item.id}')" title="Delete Expense">Delete</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      return `
        <tr>
          <td class="num">${item.date}</td>
          <td style="font-weight:600; color:#0f172a;">${item.desc}</td>
          <td><span class="cat-badge ${item.catClass}">${item.category}</span></td>
          <td><span class="type-pill income">Income</span></td>
          <td style="text-align:right;" class="amt-pos">+${fmt(item.amount)}</td>
          <td style="text-align:center; white-space:nowrap;">
            <div class="action-btn-group" style="justify-content: center;">
              <button type="button" class="action-btn edit-btn" onclick="openEditIncomeModal('${item.id}')" title="Edit Income">Edit</button>
              <button type="button" class="action-btn danger-btn" onclick="deleteIncome('${item.id}')" title="Delete Income">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }
  }).join('');
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
  const incomeExp = totalIncomeExpenseForMonth(currentMonth);
  const savingsExp = totalSavingsExpenseForMonth(currentMonth);
  const netAmount = inc - incomeExp;
  const bal = netAmount;
  const cats = categoryTotalsForMonth(currentMonth);

  return `
  <!-- Top Header & Export -->
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; flex-wrap:wrap; gap:12px;">
    <div>
      <h2>Finance Overview</h2>
      <div class="sub" style="color:var(--text-muted);">Real-time breakdown of logged entries for <strong>${getMonthYearLabel(currentMonth)}</strong></div>
    </div>
    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
      <label style="font-size: 12px; font-weight: 700; color: var(--text-muted);">Period:</label>
      <select id="financeMonthFilter" onchange="changeFinanceMonthFilter(this.value)" style="padding: 6px 12px; border-radius: 8px; font-weight: 700; border: 1px solid var(--border-color); background: #fff; font-size: 12.5px;">
        ${availableMonths.map(m => `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${getMonthYearLabel(m)}</option>`).join('')}
      </select>
      <button id="exportCsvBtn" style="background:#ffffff; border:1px solid var(--border-color); padding:8px 16px; border-radius:10px; font-weight:600; cursor:pointer; font-size:13px;">Export CSV</button>
      <button type="button" id="financeAddIncomeBtn" onclick="openAddIncomeModal()" style="background:#059669; color:#ffffff; border:none; padding:8px 16px; border-radius:10px; font-weight:700; cursor:pointer; font-size:13px; display:inline-flex; align-items:center; gap:6px; box-shadow: 0 2px 6px rgba(5,150,105,0.25);">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> + Income
      </button>
      <button type="button" id="financeAddExpenseBtn" onclick="openAddExpenseModal()" style="background:var(--primary-brand); color:#ffffff; border:none; padding:8px 16px; border-radius:10px; font-weight:700; cursor:pointer; font-size:13px; display:inline-flex; align-items:center; gap:6px; box-shadow: 0 2px 6px rgba(79,70,229,0.25);">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> + Expense
      </button>
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
        <span class="ss-label">Expenses (Income)</span>
        <div class="ss-icon">↗</div>
      </div>
      <div class="ss-value num">${fmt(incomeExp)}</div>
      <div class="ss-sub">${mExpList.filter(e => (e.paidFrom || 'income') === 'income').length} operating records${savingsExp > 0 ? ` (+${fmt(savingsExp)} from savings)` : ''}</div>
    </div>

    <div class="soft-stat-block blue">
      <div class="ss-top">
        <span class="ss-label">${t('Net Amount')}</span>
        <div class="ss-icon">💳</div>
      </div>
      <div class="ss-value num">${fmt(netAmount)}</div>
      <div class="ss-sub">${netAmount >= 0 ? t('Remaining from income') : t('Deficit from income')}</div>
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
    <div class="card-header" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div>
        <h2>Transactions</h2>
        <div class="sub">${mExpList.length + mIncList.length} entries for ${getMonthYearLabel(currentMonth)}</div>
      </div>
      <div class="finance-tx-header-actions">
        <button type="button" id="txCardAddIncomeBtn" onclick="openAddIncomeModal()" style="background:var(--green-soft, #ecfdf5); color:var(--green-dark, #059669); border:1px solid var(--green-border, #a7f3d0); padding:6px 13px; border-radius:8px; font-weight:700; cursor:pointer; font-size:12.5px; display:inline-flex; align-items:center; gap:5px;">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Income
        </button>
        <button type="button" id="txCardAddExpenseBtn" onclick="openAddExpenseModal()" style="background:var(--indigo-soft, #eef2ff); color:var(--primary-brand, #4f46e5); border:1px solid var(--indigo-border, #c7d2fe); padding:6px 13px; border-radius:8px; font-weight:700; cursor:pointer; font-size:12.5px; display:inline-flex; align-items:center; gap:5px;">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Expense
        </button>
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

    <div class="table-responsive">
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
          ${renderTxTableRows(mExpList, mIncList, currentMonth)}
        </tbody>
      </table>
    </div>
  </div>`;
}

/* ==========================================================================
   3. DAILY TIMETABLE & PRODUCTIVITY SESSIONS (PERIODS)
   ========================================================================== */

function getActualTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

let selectedTimetableDate = getActualTodayKey();

function changeTimetableDate(dateStr) {
  if (dateStr) {
    selectedTimetableDate = dateStr;
    renderMain();
  }
}

function shiftTimetableDate(days) {
  const [y, m, d] = (selectedTimetableDate || getActualTodayKey()).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  selectedTimetableDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  renderMain();
}

function resetTimetableToToday() {
  selectedTimetableDate = getActualTodayKey();
  renderMain();
}

function formatTime12h(time24) {
  if (!time24) return "";
  if (time24.includes("AM") || time24.includes("PM")) return time24;
  if (!time24.includes(":")) return time24;
  const [h, m] = time24.split(":").map(Number);
  const ampm = (h >= 12) ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${String(m || 0).padStart(2, "0")} ${ampm}`;
}

function setTaskTimeAmPm(which, val) {
  const amBtn = document.getElementById(which === "start" ? "ttStartAmBtn" : "ttEndAmBtn");
  const pmBtn = document.getElementById(which === "start" ? "ttStartPmBtn" : "ttEndPmBtn");
  const hiddenInput = document.getElementById(which === "start" ? "ttStartAmPm" : "ttEndAmPm");

  if (hiddenInput) hiddenInput.value = val;
  if (amBtn) amBtn.classList.toggle("active", val === "AM");
  if (pmBtn) pmBtn.classList.toggle("active", val === "PM");
}
window.setTaskTimeAmPm = setTaskTimeAmPm;

function convert12to24(hourStr, minStr, ampm) {
  let h = parseInt(hourStr, 10);
  if (isNaN(h)) h = 9;
  const m = String(minStr || "00").padStart(2, "0");
  if (ampm === "AM") {
    if (h === 12) h = 0;
  } else if (ampm === "PM") {
    if (h !== 12) h += 12;
  }
  return `${String(h).padStart(2, "0")}:${m}`;
}

function convert24to12(time24) {
  if (!time24 || !time24.includes(":")) {
    return { hour: "9", min: "00", ampm: "AM" };
  }
  const [h24, m] = time24.split(":").map(Number);
  const ampm = (h24 >= 12) ? "PM" : "AM";
  const hour12 = h24 % 12 || 12;
  const snappedM = Math.min(55, Math.max(0, Math.round((m || 0) / 5) * 5));
  return {
    hour: String(hour12),
    min: String(snappedM).padStart(2, "0"),
    ampm
  };
}

function getPeriodDurationText(startTime, endTime) {
  if (!startTime || !endTime) return "";
  const [h1, m1] = startTime.split(":").map(Number);
  const [h2, m2] = endTime.split(":").map(Number);
  const totalMin = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (totalMin <= 0) return "";
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function isTaskLiveNow(task) {
  if (selectedTimetableDate !== getActualTodayKey()) return false;
  if (!task || !task.startTime || task.done) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [h1, m1] = task.startTime.split(":").map(Number);
  const endParts = (task.endTime || task.startTime).split(":").map(Number);
  const startMin = (h1 || 0) * 60 + (m1 || 0);
  const endMin = (endParts[0] || 0) * 60 + (endParts[1] || 0);
  return currentMinutes >= startMin && currentMinutes <= endMin;
}

function getTimetableTasksForDate(dateKey) {
  if (!state.timetableTasks || !Array.isArray(state.timetableTasks)) {
    state.timetableTasks = [];
  }
  const tasks = state.timetableTasks.filter(t => t.date === dateKey);
  // Sort chronologically by startTime, then endTime
  return tasks.sort((a, b) => {
    const tA = a.startTime || "99:99";
    const tB = b.startTime || "99:99";
    if (tA !== tB) return tA.localeCompare(tB);
    const endA = a.endTime || tA;
    const endB = b.endTime || tB;
    return endA.localeCompare(endB);
  });
}

function toggleTimetableTaskDone(taskId, isDone) {
  if (!state.timetableTasks) state.timetableTasks = [];
  const t = state.timetableTasks.find(item => item.id === taskId);
  if (t) {
    t.done = Boolean(isDone);
    t.completedAt = isDone ? new Date().toISOString() : null;
    saveSessionData();
    renderMain();
    showToast(isDone ? "Task finished! Great job! 🎉" : "Task marked pending");
  }
}

function deleteTimetableTask(taskId) {
  if (!state.timetableTasks) return;
  state.timetableTasks = state.timetableTasks.filter(t => t.id !== taskId);
  saveSessionData();
  renderMain();
  showToast("Task removed from timetable");
}

function copyTimetableFromYesterday() {
  const [y, m, d] = (selectedTimetableDate || getActualTodayKey()).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const yestKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

  const yestTasks = (state.timetableTasks || []).filter(t => t.date === yestKey);
  if (yestTasks.length === 0) {
    showToast("No timetable schedule found from yesterday to copy");
    return;
  }

  // Sort yesterday's tasks chronologically
  const sortedYest = [...yestTasks].sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

  let copiedCount = 0;
  sortedYest.forEach(t => {
    // Only copy if a slot with identical start and end times does not already exist on today's schedule
    const exists = (state.timetableTasks || []).some(cur =>
      cur.date === selectedTimetableDate &&
      cur.startTime === t.startTime &&
      cur.endTime === t.endTime
    );
    if (!exists) {
      state.timetableTasks.push({
        id: Date.now() + Math.floor(Math.random() * 100000) + copiedCount,
        title: "", // Blank task name as requested
        date: selectedTimetableDate,
        startTime: t.startTime || "09:00",
        endTime: t.endTime || "10:00",
        priority: t.priority || "medium",
        notes: "", // Blank notes as requested
        done: false,
        copiedFrom: yestKey,
        createdAt: new Date().toISOString()
      });
      copiedCount++;
    }
  });

  if (copiedCount === 0) {
    showToast("Yesterday's schedule is already set for this date");
    return;
  }

  saveSessionData();
  renderMain();
  showToast(`Copied ${copiedCount} time slots from yesterday! Click Edit to enter tasks.`);
}

const copyUnfinishedTasksFromYesterday = copyTimetableFromYesterday;

/* Add/Edit Task Modal Helpers */
function openAddTimetableTaskModal(defaultDate) {
  const modal = document.getElementById("timetableTaskModal");
  if (!modal) return;

  const targetDate = defaultDate || selectedTimetableDate || getActualTodayKey();
  const currentTasks = getTimetableTasksForDate(targetDate);

  let defStart24 = "09:00";
  let defEnd24 = "10:00";
  if (currentTasks.length > 0) {
    const lastTask = currentTasks[currentTasks.length - 1];
    if (lastTask.endTime && lastTask.endTime.includes(":")) {
      defStart24 = lastTask.endTime;
      const [h, m] = defStart24.split(":").map(Number);
      const nextH = Math.min(23, h + 1);
      defEnd24 = `${String(nextH).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
    }
  } else {
    const now = new Date();
    const curH = now.getHours();
    defStart24 = `${String(curH).padStart(2, "0")}:00`;
    defEnd24 = `${String(Math.min(23, curH + 1)).padStart(2, "0")}:00`;
  }

  const s12 = convert24to12(defStart24);
  const e12 = convert24to12(defEnd24);

  const idInput = document.getElementById("ttTaskId");
  const titleInput = document.getElementById("ttTaskTitleInput");
  const dateInput = document.getElementById("ttTaskDateInput");
  const startHour = document.getElementById("ttStartHour");
  const startMin = document.getElementById("ttStartMin");
  const endHour = document.getElementById("ttEndHour");
  const endMin = document.getElementById("ttEndMin");
  const prioSelect = document.getElementById("ttTaskPrioritySelect");
  const notesInput = document.getElementById("ttTaskNotesInput");
  const titleHeader = document.getElementById("ttTaskModalTitle");
  const subHeader = document.getElementById("ttTaskModalSubtitle");

  if (idInput) idInput.value = "";
  if (titleHeader) titleHeader.textContent = "Add Task to Timetable";
  if (subHeader) subHeader.textContent = "Set task details and scheduled time";
  if (titleInput) titleInput.value = "";
  if (dateInput) dateInput.value = targetDate;

  if (startHour) startHour.value = s12.hour;
  if (startMin) startMin.value = s12.min;
  setTaskTimeAmPm('start', s12.ampm);

  if (endHour) endHour.value = e12.hour;
  if (endMin) endMin.value = e12.min;
  setTaskTimeAmPm('end', e12.ampm);

  if (prioSelect) prioSelect.value = "medium";
  if (notesInput) notesInput.value = "";

  modal.style.display = "flex";
  if (titleInput) titleInput.focus();
}

function openEditTimetableTaskModal(taskId) {
  if (!state.timetableTasks) state.timetableTasks = [];
  const t = state.timetableTasks.find(item => item.id === taskId);
  if (!t) return;

  const modal = document.getElementById("timetableTaskModal");
  if (!modal) return;

  const s12 = convert24to12(t.startTime || "09:00");
  const e12 = convert24to12(t.endTime || t.startTime || "10:00");

  const idInput = document.getElementById("ttTaskId");
  const titleInput = document.getElementById("ttTaskTitleInput");
  const dateInput = document.getElementById("ttTaskDateInput");
  const startHour = document.getElementById("ttStartHour");
  const startMin = document.getElementById("ttStartMin");
  const endHour = document.getElementById("ttEndHour");
  const endMin = document.getElementById("ttEndMin");
  const prioSelect = document.getElementById("ttTaskPrioritySelect");
  const notesInput = document.getElementById("ttTaskNotesInput");
  const titleHeader = document.getElementById("ttTaskModalTitle");
  const subHeader = document.getElementById("ttTaskModalSubtitle");

  if (idInput) idInput.value = t.id;
  if (titleHeader) titleHeader.textContent = "Edit Timetable Task & Time";
  if (subHeader) subHeader.textContent = "Update task details or change scheduled time (AM/PM)";
  if (titleInput) titleInput.value = t.title || "";
  if (dateInput) dateInput.value = t.date || selectedTimetableDate || getActualTodayKey();

  if (startHour) startHour.value = s12.hour;
  if (startMin) startMin.value = s12.min;
  setTaskTimeAmPm('start', s12.ampm);

  if (endHour) endHour.value = e12.hour;
  if (endMin) endMin.value = e12.min;
  setTaskTimeAmPm('end', e12.ampm);

  if (prioSelect) prioSelect.value = t.priority || "medium";
  if (notesInput) notesInput.value = t.notes || "";

  modal.style.display = "flex";
}

function closeTimetableTaskModal() {
  const modal = document.getElementById("timetableTaskModal");
  if (modal) modal.style.display = "none";
}

function submitTimetableTask(e) {
  if (e && typeof e.preventDefault === "function") e.preventDefault();
  const idStr = String(document.getElementById("ttTaskId")?.value ?? "").trim();
  const title = String(document.getElementById("ttTaskTitleInput")?.value ?? "").trim();
  const date = String(document.getElementById("ttTaskDateInput")?.value ?? "").trim();

  // Read 12-hour values with AM/PM
  const sHour = document.getElementById("ttStartHour")?.value || "9";
  const sMin = document.getElementById("ttStartMin")?.value || "00";
  const sAmPm = document.getElementById("ttStartAmPm")?.value || "AM";
  const startTime = convert12to24(sHour, sMin, sAmPm);

  const eHour = document.getElementById("ttEndHour")?.value || sHour;
  const eMin = document.getElementById("ttEndMin")?.value || sMin;
  const eAmPm = document.getElementById("ttEndAmPm")?.value || sAmPm;
  const endTime = convert12to24(eHour, eMin, eAmPm);

  const priority = document.getElementById("ttTaskPrioritySelect")?.value || "medium";
  const notes = String(document.getElementById("ttTaskNotesInput")?.value ?? "").trim();

  if (!title || !date) {
    showToast("Please enter task title and date");
    return;
  }

  if (!state.timetableTasks) state.timetableTasks = [];

  if (idStr) {
    const existing = state.timetableTasks.find(t => String(t.id) === String(idStr));
    if (existing) {
      existing.title = title;
      existing.date = date;
      existing.startTime = startTime;
      existing.endTime = endTime;
      existing.priority = priority;
      existing.notes = notes;
      showToast("Timetable task updated!");
    }
  } else {
    state.timetableTasks.push({
      id: Date.now(),
      title,
      date,
      startTime,
      endTime,
      priority,
      notes,
      done: false,
      createdAt: new Date().toISOString()
    });
    showToast("Task added to timetable!");
  }

  saveSessionData();
  closeTimetableTaskModal();
  renderMain();
}


/* Main Timetable View */
function viewProductivityTimetable() {
  if (!state.timetableTasks) state.timetableTasks = [];

  const todayKey = getActualTodayKey();
  if (!selectedTimetableDate) selectedTimetableDate = todayKey;

  const dayTasks = getTimetableTasksForDate(selectedTimetableDate);
  const doneTasks = dayTasks.filter(t => t.done);
  const totalTasks = dayTasks.length;
  const pct = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;

  const [y, m, d] = selectedTimetableDate.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const isToday = selectedTimetableDate === todayKey;
  const isTomorrow = (() => {
    const tm = new Date();
    tm.setDate(tm.getDate() + 1);
    return selectedTimetableDate === `${tm.getFullYear()}-${String(tm.getMonth() + 1).padStart(2, "0")}-${String(tm.getDate()).padStart(2, "0")}`;
  })();
  const dayPrefix = isToday ? "Today" : isTomorrow ? "Tomorrow" : "";
  const dateFormatted = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });

  return `
  <!-- Timetable Header Bar -->
  <div class="timetable-header-card">
    <div class="timetable-top-bar">
      <div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0;">Daily Timetable</h2>
          ${dayPrefix ? `<span style="background: #e0e7ff; color: #4338ca; font-weight: 800; font-size: 11.5px; padding: 2px 10px; border-radius: 20px;">${dayPrefix}</span>` : ''}
        </div>
        <div style="font-size: 13.5px; color: var(--text-muted); margin-top: 4px;">${dateFormatted}</div>
      </div>

      <div class="timetable-date-controls">
        <button type="button" class="tt-nav-btn" onclick="shiftTimetableDate(-1)" title="Previous day">Prev Day</button>
        <button type="button" class="tt-nav-btn ${isToday ? 'primary' : ''}" onclick="resetTimetableToToday()" title="Jump to today">Today</button>
        <button type="button" class="tt-nav-btn" onclick="shiftTimetableDate(1)" title="Next day">Next Day</button>
        <input type="date" class="tt-date-picker-input" value="${selectedTimetableDate}" onchange="changeTimetableDate(this.value)" aria-label="Select date">
      </div>

      <div class="timetable-actions">
        <button type="button" class="tt-action-btn secondary" onclick="copyTimetableFromYesterday()" title="Copy yesterday's schedule without task names">
          Copy From Yesterday
        </button>
        <button type="button" class="tt-action-btn accent" onclick="openAddTimetableTaskModal()" title="Add new task with specific time">
          Add Task
        </button>
      </div>
    </div>

    <!-- Daily Progress Track -->
    <div class="timetable-progress-box">
      <div class="tt-progress-header">
        <div class="tt-progress-title">
          <span>Daily Completion Progress</span>
          <span style="font-size: 12px; font-weight: 600; color: #64748b;">(Refreshes daily for each date)</span>
        </div>
        <div class="tt-progress-stats">
          ${doneTasks.length} / ${totalTasks} Tasks Finished (${pct}%)
        </div>
      </div>
      <div class="tt-progress-track">
        <div class="tt-progress-fill" style="width: ${pct}%;"></div>
      </div>
    </div>
  </div>

  <!-- Timetable Schedule List (down with time) -->
  ${dayTasks.length === 0 ? `
    <div class="tt-empty-schedule-card">
      <div class="tt-empty-schedule-title">No tasks scheduled for ${isToday ? 'today' : dateFormatted}</div>
      <div class="tt-empty-schedule-sub">Click <b>Add Task</b> to schedule your tasks with specific start and end times in your timetable.</div>
      <button type="button" class="tt-action-btn accent" onclick="openAddTimetableTaskModal()" style="padding: 10px 22px; font-size: 14px;">
        Add Task to Timetable
      </button>
    </div>
  ` : `
    <div class="timetable-schedule-card">
      <div class="timetable-schedule-header">
        <div>Time Slot</div>
        <div>Task Details</div>
        <div>Priority</div>
        <div style="text-align: right;">Actions</div>
      </div>
      <div class="timetable-schedule-list">
        ${dayTasks.map(t => {
          const isLive = isTaskLiveNow(t);
          const timeText = t.startTime ? (t.endTime && t.endTime !== t.startTime ? `${formatTime12h(t.startTime)} – ${formatTime12h(t.endTime)}` : formatTime12h(t.startTime)) : 'Anytime';
          const duration = (t.startTime && t.endTime) ? getPeriodDurationText(t.startTime, t.endTime) : '';
          const hasTitle = Boolean(t.title && t.title.trim());
          const titleDisplay = hasTitle
            ? escapeHtml(t.title)
            : `<span class="tt-empty-title-placeholder" onclick="openEditTimetableTaskModal(${t.id})" title="Click Edit to enter task name">Tap Edit to enter task</span>`;
          return `
          <div class="timetable-schedule-row ${t.done ? 'is-done' : ''} ${isLive ? 'is-live' : ''}">
            <div class="tt-time-col">
              <div class="tt-time-slot">${timeText}</div>
              <div class="tt-time-meta">
                ${duration ? `<span class="tt-duration-badge">${duration}</span>` : ''}
                ${isLive ? `<span class="tt-live-pill">LIVE NOW</span>` : ''}
              </div>
            </div>
            <div class="tt-task-col">
              <div class="tt-task-heading ${!hasTitle ? 'is-empty' : ''}">${titleDisplay}</div>
              ${t.notes ? `<div class="tt-task-desc">${escapeHtml(t.notes)}</div>` : ''}
            </div>
            <div class="tt-priority-col">
              <span class="priority-pill ${t.priority || 'medium'}">${t.priority || 'medium'}</span>
            </div>
            <div class="tt-actions-cluster">
              <button type="button" class="tt-tick-btn ${t.done ? 'is-done' : ''}" onclick="toggleTimetableTaskDone(${t.id}, ${!t.done})" title="${t.done ? 'Finished (click to mark pending)' : 'Mark as finished'}" aria-label="${t.done ? 'Mark pending' : 'Mark finished'}">
                <span class="tt-tick-check">${t.done ? '✓' : ''}</span>
              </button>
              <button type="button" class="tt-btn-edit" onclick="openEditTimetableTaskModal(${t.id})" title="Edit task details & time">
                Edit
              </button>
              <button type="button" class="tt-btn-del" onclick="deleteTimetableTask(${t.id})" title="Delete task">
                ✕
              </button>
            </div>
          </div>
          `;
        }).join("")}
      </div>
    </div>
  `}
  `;
}

const viewTasks = viewProductivityTimetable;

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
  if (!monthYearKey || !monthYearKey.includes("-")) return (typeof t === "function" ? t("Current Month") : "Current Month");
  const [yyyy, mm] = monthYearKey.split("-");
  const date = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, 1);
  const localeMap = { en: 'en-US', ta: 'ta-IN', hi: 'hi-IN', ml: 'ml-IN', te: 'te-IN', es: 'es-ES', fr: 'fr-FR' };
  const loc = (typeof currentLanguage !== "undefined" && localeMap[currentLanguage]) ? localeMap[currentLanguage] : 'en-US';
  return date.toLocaleDateString(loc, { month: "long", year: "numeric" });
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
  if (file.size > 800 * 1024) {
    showToast("⚠️ Bill PDF exceeds 800 KB limit for cloud invoice sync. Please select a smaller PDF.");
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
  if (file.size > 800 * 1024) {
    showToast("⚠️ Bill PDF exceeds 800 KB limit for cloud invoice sync. Please select a smaller PDF.");
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

function onBillFundSourceChange(formPrefix, source) {
  const incomeRadio = document.getElementById(`${formPrefix}BillFundIncome`);
  const savingsRadio = document.getElementById(`${formPrefix}BillFundSavings`);
  const incomeLabel = document.getElementById(`${formPrefix}BillFundIncomeLabel`);
  const savingsLabel = document.getElementById(`${formPrefix}BillFundSavingsLabel`);

  if (source === "savings") {
    if (savingsRadio) savingsRadio.checked = true;
    if (savingsLabel) {
      savingsLabel.style.borderColor = "#6366f1";
      savingsLabel.style.background = "#eef2ff";
    }
    if (incomeLabel) {
      incomeLabel.style.borderColor = "var(--border-color)";
      incomeLabel.style.background = "#ffffff";
    }
  } else {
    if (incomeRadio) incomeRadio.checked = true;
    if (incomeLabel) {
      incomeLabel.style.borderColor = "#6366f1";
      incomeLabel.style.background = "#eef2ff";
    }
    if (savingsLabel) {
      savingsLabel.style.borderColor = "var(--border-color)";
      savingsLabel.style.background = "#ffffff";
    }
  }
}

function onTxFundSourceChange(source) {
  const incomeRadio = document.getElementById("txFundIncome");
  const savingsRadio = document.getElementById("txFundSavings");
  const incomeLabel = document.getElementById("txFundIncomeLabel");
  const savingsLabel = document.getElementById("txFundSavingsLabel");

  if (source === "savings") {
    if (savingsRadio) savingsRadio.checked = true;
    if (savingsLabel) {
      savingsLabel.classList.add("active-expense");
      savingsLabel.classList.remove("active-income");
    }
    if (incomeLabel) {
      incomeLabel.classList.remove("active-income");
      incomeLabel.classList.remove("active-expense");
    }
  } else {
    if (incomeRadio) incomeRadio.checked = true;
    if (incomeLabel) {
      incomeLabel.classList.add("active-income");
      incomeLabel.classList.remove("active-expense");
    }
    if (savingsLabel) {
      savingsLabel.classList.remove("active-income");
      savingsLabel.classList.remove("active-expense");
    }
  }
}

function openPaySourceModal({ title, billName, amount, incomeAvail, savingsAvail, prevMonthLabel, onConfirm }) {
  let modal = document.getElementById("paySourcePromptModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "paySourcePromptModal";
    modal.className = "doc-modal-overlay";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="doc-modal-container" style="max-width: 440px; padding: 24px; border-radius: 20px; text-align: left;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px;">💳</div>
          <div>
            <h3 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 0;">${title || 'Select Payment Source'}</h3>
            <div style="font-size: 12px; color: var(--text-muted);">${billName ? escapeHtml(billName) + ' • ' : ''}${fmt(amount)}</div>
          </div>
        </div>
        <button type="button" class="doc-modal-close" onclick="document.getElementById('paySourcePromptModal').style.display='none'">&times;</button>
      </div>

      <p style="font-size: 13px; color: #475569; margin: 0 0 16px;">
        Where would you like to deduct this bill amount from?
      </p>

      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
        <label id="promptFundIncomeLabel" style="border: 2px solid #6366f1; background: #eef2ff; border-radius: 12px; padding: 12px 14px; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: all 0.2s;">
          <input type="radio" name="promptFundRadio" value="income" checked style="accent-color: #4f46e5;" onchange="
            document.getElementById('promptFundIncomeLabel').style.borderColor='#6366f1';
            document.getElementById('promptFundIncomeLabel').style.background='#eef2ff';
            document.getElementById('promptFundSavingsLabel').style.borderColor='var(--border-color)';
            document.getElementById('promptFundSavingsLabel').style.background='#ffffff';
          ">
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 13.5px; color: #1e1b4b;">💵 Current Month Income</div>
            <div style="font-size: 11.5px; color: #4338ca;">Deduct from this month's earnings (${fmt(incomeAvail)} available)</div>
          </div>
        </label>

        <label id="promptFundSavingsLabel" style="border: 2px solid var(--border-color); background: #fff; border-radius: 12px; padding: 12px 14px; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: all 0.2s;">
          <input type="radio" name="promptFundRadio" value="savings" style="accent-color: #4f46e5;" onchange="
            document.getElementById('promptFundSavingsLabel').style.borderColor='#6366f1';
            document.getElementById('promptFundSavingsLabel').style.background='#eef2ff';
            document.getElementById('promptFundIncomeLabel').style.borderColor='var(--border-color)';
            document.getElementById('promptFundIncomeLabel').style.background='#ffffff';
          ">
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 13.5px; color: #0f172a;">🏦 Savings (Rollover)</div>
            <div style="font-size: 11.5px; color: var(--text-muted);">Deduct from previous month savings (${fmt(savingsAvail)} available)</div>
          </div>
        </label>
      </div>

      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button type="button" class="action-btn" onclick="document.getElementById('paySourcePromptModal').style.display='none'" style="padding: 9px 16px; border-radius: 8px;">Cancel</button>
        <button type="button" id="promptConfirmBtn" style="background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border: none; padding: 9px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
          Confirm & Pay
        </button>
      </div>
    </div>
  `;

  modal.style.display = "flex";
  document.getElementById("promptConfirmBtn").onclick = () => {
    const selected = document.querySelector('input[name="promptFundRadio"]:checked')?.value || "income";
    modal.style.display = "none";
    if (typeof onConfirm === "function") onConfirm(selected);
  };
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

  const currentMonth = selectedBillMonthYear || getCurrentFinanceMonthKey();
  const savingsData = getMonthlySavingsData(currentMonth);
  const isAfterOneMonth = hasPreviousMonthSavings(currentMonth);
  const fundWrap = document.getElementById("addBillFundSourceWrap");
  if (fundWrap) {
    if (isAfterOneMonth) {
      fundWrap.style.display = "block";
      const incAvail = document.getElementById("addBillIncomeAvail");
      const savAvail = document.getElementById("addBillSavingsAvail");
      if (incAvail) incAvail.textContent = `${fmt(savingsData.currentInc)} monthly income`;
      if (savAvail) savAvail.textContent = `${fmt(savingsData.lastMonthBalance)} from ${savingsData.prevMonthLabel}`;
      onBillFundSourceChange("add", "income");
    } else {
      fundWrap.style.display = "none";
    }
  }

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
  const fundRadio = document.querySelector('input[name="addBillFundSource"]:checked');
  const paidFrom = fundRadio ? fundRadio.value : "income";

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
    paidFrom,
    pdfData: pendingAddBillPdf ? pendingAddBillPdf.pdfData : null,
    pdfFileName: pendingAddBillPdf ? pendingAddBillPdf.pdfFileName : null
  }).then(res => {
    closeAddBillModal();
    renderMain();
    showToast(`Bill "${name}" added successfully (${paidFrom === 'savings' ? 'from Savings' : 'from Income'})!`);
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

  const currentMonth = getMonthYearKey(bill.due) || getCurrentFinanceMonthKey();
  const savingsData = getMonthlySavingsData(currentMonth);
  const isAfterOneMonth = hasPreviousMonthSavings(currentMonth);
  const fundWrap = document.getElementById("editBillFundSourceWrap");
  if (fundWrap) {
    if (isAfterOneMonth) {
      fundWrap.style.display = "block";
      const incAvail = document.getElementById("editBillIncomeAvail");
      const savAvail = document.getElementById("editBillSavingsAvail");
      if (incAvail) incAvail.textContent = `${fmt(savingsData.currentInc)} monthly income`;
      if (savAvail) savAvail.textContent = `${fmt(savingsData.lastMonthBalance)} from ${savingsData.prevMonthLabel}`;
      onBillFundSourceChange("edit", bill.paidFrom === "savings" ? "savings" : "income");
    } else {
      fundWrap.style.display = "none";
    }
  }

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
  const fundRadio = document.querySelector('input[name="editBillFundSource"]:checked');
  const paidFrom = fundRadio ? fundRadio.value : (state.bills.find(b=>b.id===id)?.paidFrom || "income");

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
    paidFrom,
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
  const bill = state.bills.find(b => b.id === id);
  if (!bill) return;

  const currentKey = getCurrentFinanceMonthKey();
  const savingsData = getMonthlySavingsData(currentKey);
  const isAfterOneMonth = hasPreviousMonthSavings(currentKey);
  const hasSavings = savingsData.totalSavings > 0 || isAfterOneMonth;

  if (hasSavings) {
    openPaySourceModal({
      title: "Bill Payment Source",
      billName: bill.name,
      amount: bill.amount,
      incomeAvail: savingsData.currentInc,
      savingsAvail: savingsData.totalSavings,
      prevMonthLabel: savingsData.prevMonthLabel,
      onConfirm: (source) => {
        bill.paidFrom = source;
        bill.paidDate = new Date().toISOString().split("T")[0];
        BillsAPI.patchBillStatus(id, "Paid").then(res => {
          renderMain();
          showToast(`Bill "${bill.name}" marked as Paid (funded from ${source === 'savings' ? 'Savings' : 'Income'})!`);
        });
      }
    });
  } else {
    bill.paidDate = new Date().toISOString().split("T")[0];
    BillsAPI.patchBillStatus(id, "Paid").then(res => {
      renderMain();
      showToast("Bill marked as Paid! Finance & Dashboard updated.");
    });
  }
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
      paidFrom: billData.paidFrom || "income",
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
  <!-- Bills Page Header & Period Selector -->
  <div class="card" style="margin-bottom: 24px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);">
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
      <div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);">🧾</div>
          <div>
            <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">Bills & Subscriptions</h1>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">Manage monthly bills, due dates, payment status, and PDF invoices.</div>
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 8px; align-items: center;">
        <label style="font-size: 12px; font-weight: 700; color: var(--text-muted);">Period:</label>
        <select id="billMonthSelect" onchange="changeBillMonthFilter(this.value)" style="padding: 6px 12px; border-radius: 8px; font-weight: 700; border: 1px solid var(--border-color); background: #fff; font-size: 12.5px; color: #0f172a; cursor: pointer; outline: none;">
          ${availableMonths.map(m => `<option value="${m}" ${m === selectedBillMonthYear ? 'selected' : ''}>${getMonthYearLabel(m)}</option>`).join('')}
        </select>
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
    <div class="bills-cards-grid">
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
                  ${b.paidFrom === 'savings' ? `<span class="cat-pill" style="background:#eef2ff; color:#4f46e5; border:1px solid #c7d2fe; font-size:11px; font-weight:700;">🏦 From Savings</span>` : ''}
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
                <button type="button" onclick="openBillPdfModal(${b.id})" class="pdf-pill-btn view">View</button>
                <a href="${b.pdfData}" download="${escapeHtml(b.pdfFileName || 'Bill_Invoice.pdf')}" class="pdf-pill-btn download">Download</a>
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
              <button type="button" onclick="openEditBillModal(${b.id})" class="bill-action-btn edit" title="Edit Bill">Edit</button>
              <button type="button" onclick="deleteBill(${b.id})" class="bill-action-btn delete" title="Delete Bill">Delete</button>
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
                    <button class="action-btn" onclick="openSubscriptionModal(${s.id})" title="Edit">Edit</button>
                    ${s.status !== 'Cancelled' ? `
                      <button class="action-btn warning-btn" onclick="togglePauseSubscription(${s.id})" title="${s.status === 'Paused' ? 'Resume' : 'Pause'}">
                        ${s.status === 'Paused' ? '▶ Resume' : '⏸ Pause'}
                      </button>
                      <button class="action-btn warning-btn" onclick="cancelSubscription(${s.id})" title="Cancel">🚫 Cancel</button>
                    ` : ''}
                    <button class="action-btn danger-btn" onclick="deleteSubscription(${s.id})" title="Delete">Delete</button>
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
let currentPreviewDoc = null;
let currentDocZoom = 1.0;
let currentDocRotate = 0;

function zoomDocImg(delta) {
  const img = document.getElementById("docPreviewImg");
  const label = document.getElementById("docZoomLabel");
  if (!img) return;
  if (delta === 1.0) {
    currentDocZoom = 1.0;
  } else {
    currentDocZoom = Math.min(3.5, Math.max(0.35, currentDocZoom * delta));
  }
  img.style.transform = `scale(${currentDocZoom}) rotate(${currentDocRotate}deg)`;
  if (label) label.textContent = `${Math.round(currentDocZoom * 100)}%`;
}

function resetDocImgZoom() {
  const img = document.getElementById("docPreviewImg");
  const label = document.getElementById("docZoomLabel");
  if (!img) return;
  currentDocZoom = 1.0;
  img.style.transform = `scale(1) rotate(${currentDocRotate}deg)`;
  if (label) label.textContent = "100%";
}

function rotateDocImg() {
  const img = document.getElementById("docPreviewImg");
  if (!img) return;
  currentDocRotate = (currentDocRotate + 90) % 360;
  img.style.transform = `scale(${currentDocZoom}) rotate(${currentDocRotate}deg)`;
}

function printPreviewedDocument() {
  if (!currentPreviewDoc || !currentPreviewDoc.fileData) {
    showToast("No printable document content available.");
    return;
  }
  const doc = currentPreviewDoc;
  const isImg = doc.fileType && doc.fileType.includes("image");
  const isPdf = doc.fileType && doc.fileType.includes("pdf");

  const printWin = window.open('', '_blank');
  if (!printWin) {
    showToast("Please allow popups to print documents.");
    return;
  }

  if (isImg) {
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escapeHtml(doc.name || 'Document')}</title>
        <style>
          @page { margin: 8mm; size: auto; }
          body { margin: 0; padding: 10px; display: flex; justify-content: center; align-items: flex-start; background: #fff; font-family: sans-serif; }
          img { max-width: 100%; height: auto; display: block; }
        </style>
      </head>
      <body>
        <img src="${doc.fileData}" onload="window.print(); window.close();" />
      </body>
      </html>
    `);
    printWin.document.close();
  } else if (isPdf) {
    printWin.location.href = doc.fileData;
  } else {
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escapeHtml(doc.name || 'Document')}</title>
        <style>
          @page { margin: 15mm; }
          body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; line-height: 1.8; color: #1e293b; padding: 30px; font-size: 15px; }
          h2 { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 16px; color: #0f172a; }
          .meta { font-size: 13px; color: #64748b; margin-bottom: 24px; }
          .content { font-family: inherit; white-space: pre-wrap; word-break: break-word; line-height: 1.9; }
        </style>
      </head>
      <body>
        <h2>${escapeHtml(doc.name || 'Document')}</h2>
        <div class="meta">Type: ${escapeHtml(doc.documentType || 'Document')} • Date: ${escapeHtml(doc.date || 'Today')}</div>
        <div class="content">${escapeHtml(doc.fileData || '')}</div>
        <script>window.print();<\/script>
      </body>
      </html>
    `);
    printWin.document.close();
  }
}

function openPreviewedDocInNewWindow(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  if (!currentPreviewDoc || !currentPreviewDoc.fileData) {
    showToast("No document file available to open in new tab.");
    return;
  }
  const doc = currentPreviewDoc;
  const isImg = doc.fileType && doc.fileType.includes("image");
  const win = window.open('', '_blank');
  if (!win) {
    showToast("Please allow popups to open full view.");
    return;
  }
  if (isImg) {
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escapeHtml(doc.name || 'Document View')}</title>
        <style>
          body { margin: 0; background: #0f172a; display: flex; justify-content: center; align-items: flex-start; padding: 20px; }
          img { max-width: 100%; height: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.6); border-radius: 6px; background: #fff; }
        </style>
      </head>
      <body>
        <img src="${doc.fileData}" alt="${escapeHtml(doc.name || 'Document')}" />
      </body>
      </html>
    `);
    win.document.close();
  } else {
    win.location.href = doc.fileData;
  }
}

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
      <div class="ss-top"><span class="ss-label">Attached Files</span><div class="ss-icon">📎</div></div>
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
      ${filteredDocs.map(d => {
        const isPdf = d.fileType && d.fileType.includes("pdf");
        const isImg = d.fileData && d.fileType && d.fileType.includes("image");

        let icon = '📁';
        let iconBg = '#eef2ff';
        let iconColor = '#4f46e5';
        if (isPdf) {
          icon = '📄';
          iconBg = '#fee2e2';
          iconColor = '#dc2626';
        } else if (isImg) {
          icon = '🖼️';
          iconBg = '#e0f2fe';
          iconColor = '#0284c7';
        }

        return `
        <div class="upcoming-row" style="padding: 16px 18px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; background: #ffffff;">
          <div class="ur-left" style="display: flex; align-items: center; gap: 14px; flex: 1; min-width: 240px;">
            <div class="ur-icon" style="background: ${iconBg}; color: ${iconColor}; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.06); border: 1px solid rgba(0,0,0,0.04);">
              ${icon}
            </div>
            <div>
              <div class="ur-title" style="font-weight: 800; color: #0f172a; font-size: 15px; letter-spacing: -0.2px;">${escapeHtml(d.name || d.documentTitle)}</div>
              <div class="ur-sub" style="font-size: 12px; color: var(--text-muted); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 4px;">
                <span>Type: <strong style="color: #0f172a; font-weight: 700;">${escapeHtml(d.documentType || d.type || 'Document')}</strong></span>
                <span style="background: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">${escapeHtml(d.category || 'Yours Document')}</span>
                ${isPdf ? `<span style="background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-size: 10.5px; font-weight: 700;">PDF</span>` : ''}
                ${isImg ? `<span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 10.5px; font-weight: 700;">IMAGE</span>` : ''}
                ${d.fileName ? `• <span style="color: #4f46e5; font-weight: 600;">📎 ${escapeHtml(d.fileName)}</span>` : ''}
              </div>
            </div>
          </div>

          <div class="ur-right" style="display: flex; flex-direction: row; align-items: center; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
            <div style="text-align: right; margin-right: 6px;">
              <div class="ur-amt num" style="font-size: 12.5px; font-weight: 700; color: #334155; white-space: nowrap;">Uploaded: ${escapeHtml(d.date || 'Today')}</div>
            </div>

            <div class="doc-btn-group" style="display: flex; flex-direction: row; align-items: center; gap: 8px; flex-wrap: nowrap;">
              <button type="button" onclick="previewDocument(${d.id})" class="pwd-card-btn" style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; padding: 7px 15px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; white-space: nowrap; box-shadow: 0 1px 3px rgba(79,70,229,0.1);" title="View Document Preview">
                View
              </button>

              ${d.fileData ? `
                <a href="${d.fileData}" download="${escapeHtml(d.fileName || d.name || d.documentTitle)}" class="pwd-card-btn" style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; padding: 7px 14px; border-radius: 8px; font-weight: 700; font-size: 12.5px; cursor: pointer; display: inline-flex; align-items: center; text-decoration: none; white-space: nowrap;" title="Download File">
                  Download
                </a>
              ` : ''}

              <button type="button" onclick="deleteDocument(${d.id})" class="pwd-btn-danger" style="background: #fef2f2; color: #dc2626; border: 1px solid #fee2e2; padding: 7px 14px; border-radius: 8px; font-weight: 700; font-size: 12.5px; cursor: pointer; white-space: nowrap;" title="Delete Document">
                Delete
              </button>
            </div>
          </div>
        </div>
      `;
      }).join("")}

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

        <input type="file" id="docFileInput" accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.svg,.bmp,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.rtf,.json,.md,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf" style="display: none;">
        <button type="button" id="docUploadTriggerBtn" style="background: #ffffff; border: 1px solid var(--border-color); padding: 9px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 600; cursor: pointer; color: #334155; display: flex; align-items: center; gap: 6px;">
          📎 <span id="docFileLabel">Choose Document (PDF, Images, Word, PPT, Excel, Text)...</span>
        </button>

        <button id="docAddBtn" style="background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(79,70,229,0.2);">
          💾 Save Document
        </button>
      </div>
    </div>
  </div>`;
}

// High-Definition Canvas PDF Rendering Engine (Mozilla PDF.js)
async function renderPdfDocumentToContainer(dataUri, container) {
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; color:#94a3b8; width:100%; min-height:360px;">
      <div style="width:38px; height:38px; border:3px solid #334155; border-top-color:#6366f1; border-radius:50%; animation:docSpin 0.8s linear infinite;"></div>
      <div style="margin-top:14px; font-weight:600; font-size:13.5px; color:#cbd5e1;">Rendering PDF pages in high definition...</div>
    </div>
  `;

  function dataUriToUint8Array(uri) {
    const base64Index = uri.indexOf(";base64,");
    const base64 = base64Index !== -1 ? uri.substring(base64Index + 8) : (uri.includes(",") ? uri.split(",")[1] : uri);
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  try {
    const bytes = dataUriToUint8Array(dataUri);
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const loadingTask = window.pdfjsLib.getDocument({ data: bytes });
      const pdf = await loadingTask.promise;

      container.innerHTML = `
        <div id="pdfCanvasList" style="width:100%; max-height:74vh; overflow-y:auto; overflow-x:hidden; background:#0f172a; padding:16px; border-radius:12px; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; gap:16px;"></div>
      `;
      const list = document.getElementById("pdfCanvasList");

      for (let num = 1; num <= pdf.numPages; num++) {
        const page = await pdf.getPage(num);
        const initialViewport = page.getViewport({ scale: 1.0 });
        const targetWidth = Math.min(window.innerWidth - 64, 820);
        const scale = Math.max(targetWidth / initialViewport.width, 1.25);
        const viewport = page.getViewport({ scale: scale });

        const pageWrap = document.createElement("div");
        pageWrap.style.cssText = "position:relative; width:100%; max-width:820px; background:#ffffff; border-radius:8px; box-shadow:0 8px 30px rgba(0,0,0,0.5); overflow:hidden;";

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.cssText = "width:100%; height:auto; display:block;";
        pageWrap.appendChild(canvas);

        const badge = document.createElement("div");
        badge.textContent = `Page ${num} / ${pdf.numPages}`;
        badge.style.cssText = "position:absolute; bottom:10px; right:12px; background:rgba(15,23,42,0.85); backdrop-filter:blur(4px); color:#ffffff; font-size:11px; font-weight:700; padding:3px 9px; border-radius:6px; pointer-events:none;";
        pageWrap.appendChild(badge);

        list.appendChild(pageWrap);

        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      }
    } else {
      container.innerHTML = `
        <iframe src="${dataUri}" style="width:100%; height:75vh; border:none; border-radius:12px; background:#525659;"></iframe>
      `;
    }
  } catch (err) {
    container.innerHTML = `
      <iframe src="${dataUri}" style="width:100%; height:75vh; border:none; border-radius:12px; background:#525659;"></iframe>
    `;
  }
}

function previewDocument(id) {
  if (!currentUser) return;
  const doc = (state.documents || []).find(d => d.id === id && (d.userId || currentUser) === currentUser);
  if (!doc) {
    showToast("Unauthorized or document not found.");
    return;
  }

  currentPreviewDoc = doc;
  currentDocZoom = 1.0;
  currentDocRotate = 0;

  const modal = document.getElementById("docPreviewModal");
  const modalTitle = document.getElementById("docModalTitle");
  const modalSub = document.getElementById("docModalSub");
  const modalBody = document.getElementById("docModalBody");
  const modalIcon = document.getElementById("docModalIcon");
  const dlBtn = document.getElementById("docModalDownloadBtn");
  const controls = document.getElementById("docViewerControls");
  const footerMeta = document.getElementById("docModalFooterMeta");

  if (!modal) return;

  const fileName = doc.fileName || doc.name || doc.documentTitle || "";
  const ext = fileName.split('.').pop().toLowerCase();
  const mime = (doc.fileType || "").toLowerCase();
  const dataPrefix = (doc.fileData || "").substring(0, 80).toLowerCase();

  const isPdf = mime.includes("pdf") || ext === "pdf" || dataPrefix.includes("application/pdf");
  const isImg = mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"].includes(ext) || dataPrefix.includes("image/");
  const isWord = ["doc", "docx"].includes(ext) || mime.includes("word") || mime.includes("officedocument.wordprocessingml");
  const isPpt = ["ppt", "pptx"].includes(ext) || mime.includes("presentation") || mime.includes("powerpoint");
  const isExcel = ["xls", "xlsx", "csv"].includes(ext) || mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv");
  const isText = ["txt", "md", "json", "rtf", "log"].includes(ext) || mime.includes("text/") || dataPrefix.includes("data:text");

  if (modalTitle) modalTitle.textContent = doc.name || doc.documentTitle;
  if (modalSub) {
    modalSub.textContent = `Category: ${doc.category || 'Yours Document'} • Type: ${doc.documentType || doc.type || 'Document'} • Uploaded: ${doc.date || 'Today'} ${fileName ? '• 📎 ' + fileName : ''}`;
  }
  if (modalIcon) {
    if (isPdf) {
      modalIcon.textContent = "📄";
      modalIcon.style.background = "#fee2e2";
      modalIcon.style.color = "#dc2626";
    } else if (isImg) {
      modalIcon.textContent = "🖼️";
      modalIcon.style.background = "#e0f2fe";
      modalIcon.style.color = "#0284c7";
    } else if (isWord) {
      modalIcon.textContent = "📝";
      modalIcon.style.background = "#dbeafe";
      modalIcon.style.color = "#1e40af";
    } else if (isPpt) {
      modalIcon.textContent = "📽️";
      modalIcon.style.background = "#ffedd5";
      modalIcon.style.color = "#c2410c";
    } else if (isExcel) {
      modalIcon.textContent = "📊";
      modalIcon.style.background = "#dcfce7";
      modalIcon.style.color = "#15803d";
    } else {
      modalIcon.textContent = "📁";
      modalIcon.style.background = "#eef2ff";
      modalIcon.style.color = "#4f46e5";
    }
  }

  const formatLabel = isPdf ? "PDF Document" : isImg ? "High-Res Image" : isWord ? "Microsoft Word" : isPpt ? "PowerPoint Presentation" : isExcel ? "Spreadsheet Data" : isText ? "Text Document" : "Vault File";

  if (footerMeta) {
    footerMeta.innerHTML = `<span style="color: #0f172a; font-weight: 700;">${escapeHtml(doc.documentType || 'Document')}</span> • ${formatLabel}`;
  }

  // Setup View Controls
  if (controls) {
    if (isImg) {
      controls.innerHTML = `
        <div style="display: flex; align-items: center; gap: 5px; background: #f8fafc; padding: 3px 8px; border-radius: 8px; border: 1px solid var(--border-color);">
          <button type="button" class="doc-zoom-btn" onclick="zoomDocImg(0.8)" title="Zoom Out">🔍 -</button>
          <span id="docZoomLabel" style="font-size: 12px; font-weight: 700; color: #1e293b; min-width: 44px; text-align: center;">100%</span>
          <button type="button" class="doc-zoom-btn" onclick="zoomDocImg(1.25)" title="Zoom In">🔍 +</button>
          <button type="button" class="doc-zoom-btn" onclick="resetDocImgZoom()" title="Reset to standard width">Fit</button>
          <button type="button" class="doc-zoom-btn" onclick="rotateDocImg()" title="Rotate 90 degrees">↺ 90°</button>
        </div>
      `;
    } else if (isPdf) {
      controls.innerHTML = `
        <span style="font-size: 11.5px; font-weight: 700; color: #4338ca; background: #eef2ff; border: 1px solid #c7d2fe; padding: 5px 10px; border-radius: 6px;">
          📄 PDF Document View
        </span>
      `;
    } else if (isWord || isPpt || isExcel) {
      controls.innerHTML = `
        <span style="font-size: 11.5px; font-weight: 700; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 5px 10px; border-radius: 6px;">
          ✓ Verified Vault Asset
        </span>
      `;
    } else {
      controls.innerHTML = "";
    }
  }

  // Download Button Setup
  if (dlBtn) {
    if (doc.fileData) {
      dlBtn.href = doc.fileData;
      dlBtn.download = doc.fileName || doc.name || doc.documentTitle;
      dlBtn.style.display = "inline-flex";
    } else {
      dlBtn.style.display = "none";
    }
  }

  // Inject High-Definition Viewer Content
  if (doc.fileData) {
    if (isImg) {
      modalBody.innerHTML = `
        <div id="docImgViewport" style="overflow: auto; max-height: 72vh; width: 100%; display: flex; align-items: flex-start; justify-content: center; background: #0f172a; padding: 24px; box-sizing: border-box; border-radius: 12px;">
          <img id="docPreviewImg" src="${doc.fileData}" alt="${escapeHtml(doc.name || doc.documentTitle)}" style="max-width: 100%; height: auto; transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); transform-origin: top center; box-shadow: 0 15px 40px rgba(0,0,0,0.6); border-radius: 6px; background: #ffffff;" />
        </div>
      `;
    } else if (isPdf) {
      // High-Definition Canvas PDF Rendering using PDF.js
      renderPdfDocumentToContainer(doc.fileData, modalBody);
    } else if (isWord || isPpt || isExcel) {
      const brandColor = isWord ? "#2b579a" : isPpt ? "#d24726" : "#217346";
      const brandIcon = isWord ? "📝" : isPpt ? "📽️" : "📊";
      const brandLabel = isWord ? "Microsoft Word Document" : isPpt ? "PowerPoint Presentation" : "Excel Spreadsheet";
      const brandExt = isWord ? "DOC / DOCX" : isPpt ? "PPT / PPTX" : "XLS / XLSX";

      modalBody.innerHTML = `
        <div style="width: 100%; background: #0f172a; padding: 36px 20px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 55vh; box-sizing: border-box;">
          <div style="background: #ffffff; border-radius: 20px; padding: 36px 28px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.4); box-sizing: border-box;">
            <div style="width: 72px; height: 72px; border-radius: 18px; background: ${brandColor}15; color: ${brandColor}; display: inline-flex; align-items: center; justify-content: center; font-size: 36px; margin-bottom: 16px; border: 2px solid ${brandColor}30;">
              ${brandIcon}
            </div>
            <div style="display: inline-block; font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${brandColor}; background: ${brandColor}12; padding: 3px 10px; border-radius: 12px; margin-bottom: 10px;">
              ${brandLabel}
            </div>
            <h3 style="font-size: 19px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; word-break: break-word;">
              ${escapeHtml(doc.fileName || doc.name || doc.documentTitle)}
            </h3>
            <div style="font-size: 13px; color: #64748b; margin-bottom: 20px;">
              Format: <b>${brandExt}</b> • Category: <b>${escapeHtml(doc.category || 'Yours Document')}</b> • Uploaded: <b>${escapeHtml(doc.date || 'Today')}</b>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 24px; font-size: 13px; color: #475569; text-align: left; line-height: 1.5;">
              🔒 <b>Encrypted Vault Asset:</b> This ${brandExt} document is encrypted and stored safely in your cloud vault. Ready to download and view or edit with Microsoft Office, Google Workspace, or any document reader.
            </div>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
              <a href="${doc.fileData}" download="${escapeHtml(doc.fileName || doc.name || 'document')}" class="doc-modal-dl-btn" style="background: linear-gradient(135deg, ${brandColor}, #0f172a); color: #fff; padding: 11px 24px; border-radius: 10px; font-weight: 700; font-size: 13.5px; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 14px ${brandColor}40;">
                ⬇️ Download & Open Document
              </a>
            </div>
          </div>
        </div>
      `;
    } else {
      let textContent = "";
      if (doc.fileData.startsWith("data:text") || doc.fileData.startsWith("data:application/octet-stream")) {
        try {
          const b64 = doc.fileData.split(",")[1];
          textContent = decodeURIComponent(escape(atob(b64)));
        } catch (e) {
          textContent = doc.fileData;
        }
      } else {
        textContent = doc.fileData;
      }

      modalBody.innerHTML = `
        <div style="width: 100%; max-height: 72vh; overflow-y: auto; background: #0f172a; padding: 24px; border-radius: 12px; box-sizing: border-box;">
          <div class="doc-text-paper">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; flex-wrap: wrap; gap: 10px;">
              <div>
                <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">${escapeHtml(doc.name || doc.documentTitle)}</h2>
                <div style="font-size: 13px; color: #64748b;">${escapeHtml(doc.documentType || 'Document')} • ${escapeHtml(doc.category || 'Yours Document')}</div>
              </div>
              <div style="font-size: 13px; font-weight: 700; color: #475569; text-align: right;">
                <div>Date: ${escapeHtml(doc.date || 'Today')}</div>
                ${doc.fileName ? `<div style="font-size: 11.5px; color: #64748b; font-weight: 500;">📎 ${escapeHtml(doc.fileName)}</div>` : ''}
              </div>
            </div>
            <div style="font-family: inherit; font-size: 14.5px; color: #1e293b; line-height: 1.8; white-space: pre-wrap; word-break: break-word;">
              ${escapeHtml(textContent)}
            </div>
          </div>
        </div>
      `;
    }
  } else {
    modalBody.innerHTML = `
      <div style="background: #ffffff; padding: 48px 36px; border-radius: 16px; text-align: center; max-width: 440px; box-shadow: 0 10px 30px rgba(0,0,0,0.25);">
        <div style="font-size: 52px; margin-bottom: 14px;">📁</div>
        <h4 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">${escapeHtml(doc.name || doc.documentTitle)}</h4>
        <p style="font-size: 13.5px; color: #64748b; line-height: 1.6; margin: 0 0 16px 0;">No file attachment was attached during creation. You can delete and re-upload this document with an image, PDF, Word, or presentation file.</p>
        <button type="button" class="pwd-card-btn" onclick="closeDocModal()" style="padding: 8px 18px; border-radius: 8px; font-weight: 700;">OK</button>
      </div>`;
  }

  modal.style.display = "flex";
}

function closeDocModal() {
  const modal = document.getElementById("docPreviewModal");
  if (modal) modal.style.display = "none";
  currentPreviewDoc = null;
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
              Edit
            </button>
            <button type="button" onclick="deleteAppointment(${a.id})" class="pwd-btn-danger" style="background: #fef2f2; color: #dc2626; border: 1px solid #fee2e2; padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 12.5px; cursor: pointer;" title="Delete Appointment">
              Delete
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
                  Edit
                </button>
                <button onclick="deleteGoal(${g.id})" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca; padding:6px 14px; border-radius:8px; font-weight:700; font-size:12.5px; cursor:pointer;" title="Delete Goal">
                  Delete
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

/* ==========================================================================
   FINANCE TRANSACTIONS & MODAL EVENT HANDLERS
   ========================================================================== */

/* ==========================================================================
   FINANCE TRANSACTIONS & MODAL EVENT HANDLERS
   ========================================================================== */

const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Business",
  "Investment",
  "Bonus",
  "Gift",
  "Income",
  "Other"
];

const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Housing & Rent",
  "Transport",
  "Utilities",
  "Electricity",
  "Water",
  "Internet",
  "Mobile",
  "Rent",
  "Credit Card",
  "Loan",
  "Insurance",
  "Entertainment",
  "Healthcare",
  "Shopping",
  "Subscriptions",
  "Education",
  "Other"
];

function populateTxCategories(type, selectedCat) {
  const catSelect = document.getElementById("txCategory");
  if (!catSelect) return;
  const baseCats = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const cats = [...baseCats];
  if (selectedCat && !cats.includes(selectedCat)) {
    cats.push(selectedCat);
  }
  catSelect.innerHTML = cats.map(c => `<option value="${c}" ${c === selectedCat ? 'selected' : ''}>${c}</option>`).join("");
  if (selectedCat) {
    catSelect.value = selectedCat;
  }
}

function updateTxFundSourceVisibility() {
  const typeRadio = document.querySelector('input[name="txTypeRadio"]:checked');
  const type = typeRadio ? typeRadio.value : "expense";
  const fundWrap = document.getElementById("txFundSourceWrap");
  if (!fundWrap) return;
  if (type !== "expense") {
    fundWrap.style.display = "none";
    return;
  }
  const dateInput = document.getElementById("txDate");
  const currentKey = getMonthYearKey(dateInput && dateInput.value ? dateInput.value : new Date().toISOString().split("T")[0]) || getCurrentFinanceMonthKey();
  const isAfterOneMonth = hasPreviousMonthSavings(currentKey);
  const savingsData = getMonthlySavingsData(currentKey);
  const hasSavings = savingsData.totalSavings > 0 || isAfterOneMonth || savingsData.lastMonthBalance > 0;

  if (hasSavings) {
    fundWrap.style.display = "block";
    const incAvail = document.getElementById("txFundIncomeAvail");
    const savAvail = document.getElementById("txFundSavingsAvail");
    if (incAvail) incAvail.textContent = `${fmt(savingsData.currentInc)} monthly income`;
    if (savAvail) savAvail.textContent = `${fmt(savingsData.totalSavings)} savings balance available`;
  } else {
    fundWrap.style.display = "none";
  }
}

function onTxTypeChange(type) {
  const incomeRadio = document.getElementById("txTypeIncome");
  const expenseRadio = document.getElementById("txTypeExpense");
  const incomeLabel = document.getElementById("txTypeIncomeLabel");
  const expenseLabel = document.getElementById("txTypeExpenseLabel");
  const submitBtn = document.getElementById("txSubmitBtn");
  const titleEl = document.getElementById("txModalTitle");
  const subEl = document.getElementById("txModalSub");
  const iconEl = document.getElementById("txModalIcon");
  const idEl = document.getElementById("txId");
  const id = idEl ? idEl.value : "";

  if (type === "income") {
    if (incomeRadio) incomeRadio.checked = true;
    if (incomeLabel) {
      incomeLabel.classList.add("active-income");
      incomeLabel.classList.remove("active-expense");
      incomeLabel.style.borderColor = "";
      incomeLabel.style.background = "";
      incomeLabel.style.color = "";
    }
    if (expenseLabel) {
      expenseLabel.classList.remove("active-expense");
      expenseLabel.classList.remove("active-income");
      expenseLabel.style.borderColor = "";
      expenseLabel.style.background = "";
      expenseLabel.style.color = "";
    }
    if (iconEl) {
      iconEl.textContent = "💰";
      iconEl.className = "tx-modal-icon income-icon";
    }
    if (submitBtn) {
      submitBtn.className = "tx-btn-submit income-btn";
      submitBtn.style.background = "";
      submitBtn.textContent = id ? "Update Income" : "Save Income";
    }
    if (titleEl && !id) titleEl.textContent = "Add New Income";
    if (subEl && !id) subEl.textContent = "Record earnings, salary, or incoming funds";
    populateTxCategories("income");
    const fundWrap = document.getElementById("txFundSourceWrap");
    if (fundWrap) fundWrap.style.display = "none";
  } else {
    if (expenseRadio) expenseRadio.checked = true;
    if (expenseLabel) {
      expenseLabel.classList.add("active-expense");
      expenseLabel.classList.remove("active-income");
      expenseLabel.style.borderColor = "";
      expenseLabel.style.background = "";
      expenseLabel.style.color = "";
    }
    if (incomeLabel) {
      incomeLabel.classList.remove("active-income");
      incomeLabel.classList.remove("active-expense");
      incomeLabel.style.borderColor = "";
      incomeLabel.style.background = "";
      incomeLabel.style.color = "";
    }
    if (iconEl) {
      iconEl.textContent = "💳";
      iconEl.className = "tx-modal-icon expense-icon";
    }
    if (submitBtn) {
      submitBtn.className = "tx-btn-submit expense-btn";
      submitBtn.style.background = "";
      submitBtn.textContent = id ? "Update Expense" : "Save Expense";
    }
    if (titleEl && !id) titleEl.textContent = "Add New Expense";
    if (subEl && !id) subEl.textContent = "Record money spent with category and date";
    populateTxCategories("expense");
    updateTxFundSourceVisibility();
  }
}

function openAddIncomeModal() {
  const modal = document.getElementById("txModal");
  if (!modal) return;
  const idEl = document.getElementById("txId");
  const descEl = document.getElementById("txDesc");
  const amtEl = document.getElementById("txAmount");
  const dateEl = document.getElementById("txDate");
  const titleEl = document.getElementById("txModalTitle");
  const subEl = document.getElementById("txModalSub");

  if (idEl) idEl.value = "";
  if (descEl) descEl.value = "";
  if (amtEl) amtEl.value = "";
  const todayIso = new Date().toISOString().split("T")[0];
  if (dateEl) dateEl.value = todayIso;
  if (titleEl) titleEl.textContent = "Add New Income";
  if (subEl) subEl.textContent = "Record earnings, salary, or incoming funds";

  onTxTypeChange("income");
  populateTxCategories("income", "Salary");
  modal.style.display = "flex";
  if (descEl) descEl.focus();
}

function openAddExpenseModal() {
  const modal = document.getElementById("txModal");
  if (!modal) return;
  const idEl = document.getElementById("txId");
  const descEl = document.getElementById("txDesc");
  const amtEl = document.getElementById("txAmount");
  const dateEl = document.getElementById("txDate");
  const titleEl = document.getElementById("txModalTitle");
  const subEl = document.getElementById("txModalSub");

  if (idEl) idEl.value = "";
  if (descEl) descEl.value = "";
  if (amtEl) amtEl.value = "";
  const todayIso = new Date().toISOString().split("T")[0];
  if (dateEl) dateEl.value = todayIso;
  if (titleEl) titleEl.textContent = "Add New Expense";
  if (subEl) subEl.textContent = "Record money spent with category and date";

  onTxTypeChange("expense");
  populateTxCategories("expense", "Food & Dining");
  onTxFundSourceChange("income");
  updateTxFundSourceVisibility();
  modal.style.display = "flex";
  if (descEl) descEl.focus();
}

function openEditExpenseModal(id) {
  const exp = (state.expenses || []).find(e => String(e.id) === String(id) || String(e.sourceId) === String(id));
  if (!exp) return;
  const modal = document.getElementById("txModal");
  if (!modal) return;

  const idEl = document.getElementById("txId");
  const descEl = document.getElementById("txDesc");
  const amtEl = document.getElementById("txAmount");
  const dateEl = document.getElementById("txDate");
  const titleEl = document.getElementById("txModalTitle");
  const subEl = document.getElementById("txModalSub");

  if (idEl) idEl.value = exp.id;
  if (descEl) descEl.value = exp.desc || "";
  if (amtEl) amtEl.value = exp.amount || "";
  if (dateEl) dateEl.value = exp.date || new Date().toISOString().split("T")[0];
  if (titleEl) titleEl.textContent = "Edit Expense";
  if (subEl) subEl.textContent = "Update expense details, amount, category, or date";

  onTxTypeChange("expense");
  populateTxCategories("expense", exp.category || "Food & Dining");
  onTxFundSourceChange(exp.paidFrom === "savings" ? "savings" : "income");
  updateTxFundSourceVisibility();
  modal.style.display = "flex";
  if (descEl) descEl.focus();
}

function openEditIncomeModal(id) {
  const inc = (state.income || []).find(i => String(i.id) === String(id));
  if (!inc) return;
  const modal = document.getElementById("txModal");
  if (!modal) return;

  const idEl = document.getElementById("txId");
  const descEl = document.getElementById("txDesc");
  const amtEl = document.getElementById("txAmount");
  const dateEl = document.getElementById("txDate");
  const titleEl = document.getElementById("txModalTitle");
  const subEl = document.getElementById("txModalSub");

  let cleanDesc = inc.source || "";
  if (!cleanDesc || cleanDesc === "₹," || cleanDesc === "₹" || cleanDesc === ",") {
    cleanDesc = inc.category || "Salary";
  }

  if (idEl) idEl.value = inc.id;
  if (descEl) descEl.value = cleanDesc;
  if (amtEl) amtEl.value = inc.amount || "";
  if (dateEl) dateEl.value = inc.date || new Date().toISOString().split("T")[0];
  if (titleEl) titleEl.textContent = "Edit Income";
  if (subEl) subEl.textContent = "Update income source, amount, category, or date";

  onTxTypeChange("income");
  populateTxCategories("income", inc.category || "Salary");
  modal.style.display = "flex";
  if (descEl) descEl.focus();
}

function closeTxModal() {
  const modal = document.getElementById("txModal");
  if (modal) modal.style.display = "none";
}

function saveTxForm(e) {
  if (e) e.preventDefault();
  const id = document.getElementById("txId").value;
  const date = document.getElementById("txDate").value;
  const desc = document.getElementById("txDesc").value.trim();
  const category = document.getElementById("txCategory").value;
  const amount = parseFloat(document.getElementById("txAmount").value);
  const typeRadio = document.querySelector('input[name="txTypeRadio"]:checked');
  const type = typeRadio ? typeRadio.value : "income";

  if (!date || !desc || isNaN(amount) || amount <= 0 || !category) {
    showToast("Please provide valid Date, Description, Category, and Amount.");
    return;
  }

  if (!Array.isArray(state.income)) state.income = [];
  if (!Array.isArray(state.expenses)) state.expenses = [];

  if (type === "income") {
    if (id) {
      // Check if was previously linked to a bill, delete bill so it doesn't regenerate
      const expItem = state.expenses.find(x => String(x.id) === String(id) || String(x.sourceId) === String(id));
      if (expItem && (expItem.sourceType === "bill" || expItem.source === "bill" || expItem.sourceId)) {
        const bId = expItem.sourceId || expItem.id;
        state.bills = (state.bills || []).filter(b => String(b.id) !== String(bId));
      }
      state.expenses = state.expenses.filter(x => String(x.id) !== String(id) && String(x.sourceId) !== String(id));

      const existingInc = state.income.find(x => String(x.id) === String(id));
      if (existingInc) {
        existingInc.date = date;
        existingInc.source = desc;
        existingInc.category = category;
        existingInc.amount = amount;
      } else {
        state.income.unshift({ id: Date.now(), date, source: desc, category, amount });
      }
      showToast(`Income of ₹${amount.toLocaleString('en-IN')} updated!`);
    } else {
      state.income.unshift({ id: Date.now(), date, source: desc, category, amount });
      showToast(`Income of ₹${amount.toLocaleString('en-IN')} added and synced!`);
    }
  } else {
    // Expense
    const fundRadio = document.querySelector('input[name="txFundSource"]:checked');
    const paidFrom = (fundRadio && fundRadio.value === "savings") ? "savings" : "income";

    if (id) {
      // If was previously in income, remove from income
      state.income = state.income.filter(x => String(x.id) !== String(id));

      let existingExp = state.expenses.find(x => String(x.id) === String(id) || String(x.sourceId) === String(id));
      if (existingExp) {
        existingExp.date = date;
        existingExp.desc = desc;
        existingExp.category = category;
        existingExp.amount = amount;
        existingExp.paidFrom = paidFrom;

        // If this expense is tied to a bill in state.bills, update the bill too so it doesn't get reverted!
        if (existingExp.sourceType === "bill" || existingExp.source === "bill" || existingExp.sourceId) {
          const bId = existingExp.sourceId || existingExp.id;
          const matchingBill = (state.bills || []).find(b => String(b.id) === String(bId));
          if (matchingBill) {
            matchingBill.amount = amount;
            matchingBill.due = date;
            matchingBill.dueDate = date;
            matchingBill.category = category;
            matchingBill.paidFrom = paidFrom;
            if (desc.startsWith("Bill: ")) {
              matchingBill.name = desc.substring(6).trim();
            } else {
              matchingBill.name = desc;
            }
          }
        }
      } else {
        state.expenses.unshift({ id: Date.now(), date, desc, category, amount, paidFrom });
      }
      showToast(`Expense of ₹${amount.toLocaleString('en-IN')} updated (${paidFrom === 'savings' ? 'from Savings' : 'from Income'})!`);
    } else {
      state.expenses.unshift({ id: Date.now(), date, desc, category, amount, paidFrom });
      showToast(`Expense of ₹${amount.toLocaleString('en-IN')} added (${paidFrom === 'savings' ? 'from Savings' : 'from Income'})!`);
    }
  }

  // Update selected month key to match the transaction date so user sees it right away
  const txMonthKey = getMonthYearKey(date);
  if (txMonthKey) {
    selectedFinanceMonthYear = txMonthKey;
  }

  saveSessionData();
  closeTxModal();
  renderMain();
}

function deleteExpense(id) {
  if (!confirm("Are you sure you want to delete this expense?")) return;
  const exp = (state.expenses || []).find(e => String(e.id) === String(id) || String(e.sourceId) === String(id));
  if (exp && (exp.source === "bill" || exp.sourceType === "bill" || exp.sourceId)) {
    const billId = exp.sourceId || exp.id;
    state.bills = (state.bills || []).filter(b => String(b.id) !== String(billId));
  }
  state.expenses = (state.expenses || []).filter(e => String(e.id) !== String(id) && String(e.sourceId) !== String(id));
  saveSessionData();
  renderMain();
  showToast("Expense deleted and database updated.");
}

function deleteIncome(id) {
  if (!confirm("Are you sure you want to delete this income entry?")) return;
  state.income = (state.income || []).filter(i => String(i.id) !== String(id));
  saveSessionData();
  renderMain();
  showToast("Income deleted and database updated.");
}

// Aliases for compatibility
function closeExpenseModal() { closeTxModal(); }
function closeIncomeModal() { closeTxModal(); }

// Expose on window for global inline event handlers
window.onTxTypeChange = onTxTypeChange;
window.openAddExpenseModal = openAddExpenseModal;
window.openEditExpenseModal = openEditExpenseModal;
window.closeExpenseModal = closeExpenseModal;
window.deleteExpense = deleteExpense;
window.openAddIncomeModal = openAddIncomeModal;
window.openEditIncomeModal = openEditIncomeModal;
window.closeIncomeModal = closeIncomeModal;
window.closeTxModal = closeTxModal;
window.saveTxForm = saveTxForm;
window.deleteIncome = deleteIncome;
window.previewDocument = previewDocument;
window.closeDocModal = closeDocModal;
window.deleteDocument = deleteDocument;
window.switchDocCategory = switchDocCategory;
window.zoomDocImg = zoomDocImg;
window.resetDocImgZoom = resetDocImgZoom;
window.rotateDocImg = rotateDocImg;
window.printPreviewedDocument = printPreviewedDocument;
window.openPreviewedDocInNewWindow = openPreviewedDocInNewWindow;

function attachHandlers() {
  const $ = id => document.getElementById(id);

  // Add Income and Add Expense Button Handlers
  if ($("financeAddIncomeBtn")) $("financeAddIncomeBtn").onclick = (e) => { e.preventDefault(); openAddIncomeModal(); };
  if ($("financeAddExpenseBtn")) $("financeAddExpenseBtn").onclick = (e) => { e.preventDefault(); openAddExpenseModal(); };
  if ($("txCardAddIncomeBtn")) $("txCardAddIncomeBtn").onclick = (e) => { e.preventDefault(); openAddIncomeModal(); };
  if ($("txCardAddExpenseBtn")) $("txCardAddExpenseBtn").onclick = (e) => { e.preventDefault(); openAddExpenseModal(); };

  // Close modal when clicking outside modal container or pressing Escape
  const txModalEl = $("txModal");
  if (txModalEl && (!txModalEl.dataset || !txModalEl.dataset.backdropBound)) {
    if (txModalEl.dataset) txModalEl.dataset.backdropBound = "true";
    txModalEl.addEventListener("click", (e) => {
      if (e.target === txModalEl) closeTxModal();
    });
  }
  if (!window._txModalEscBound) {
    window._txModalEscBound = true;
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const m = document.getElementById("txModal");
        if (m && m.style.display !== "none") closeTxModal();
      }
    });
  }

  // CSV Export
  if ($("exportCsvBtn")) {
    $("exportCsvBtn").addEventListener("click", () => {
      let csv = "Date,Description,Category,Type,Amount\n";
      const mExp = getFinanceExpensesForMonth(selectedFinanceMonthYear);
      const mInc = getFinanceIncomeForMonth(selectedFinanceMonthYear);
      mExp.forEach(e => csv += `"${e.date}","${e.desc}","${e.category}","Expense",-${e.amount}\n`);
      mInc.forEach(i => {
        let cleanDesc = i.source || '';
        if (!cleanDesc || cleanDesc === '₹,' || cleanDesc === '₹' || cleanDesc === ',') {
          cleanDesc = i.category || 'Salary';
        }
        csv += `"${i.date}","${cleanDesc}","${i.category || 'Salary'}","Income",${i.amount}\n`;
      });
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

      if (!state.profile) state.profile = {};
      state.profile.name = newName;
      state.profile.phone = newPhone;
      state.profile.bio = newBio;

      const initial = newName.split(" ").map(n => n[0]).join("").toUpperCase() || "U";
      if ($("profileAvatar")) $("profileAvatar").textContent = initial;
      if ($("profileName")) $("profileName").textContent = newName;

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
        if (file.size > 2.5 * 1024 * 1024) {
          showToast("⚠️ Document exceeds 2.5 MB limit. Please select a file smaller than 2.5 MB.");
          e.target.value = "";
          selectedDocFile = null;
          if ($("docFileLabel")) $("docFileLabel").textContent = "Choose File...";
          return;
        }
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

      const searchInput = $("txSearchInput");
      const q = searchInput ? searchInput.value.toLowerCase().trim() : "";
      if (q) {
        expList = expList.filter(x => (x.desc || "").toLowerCase().includes(q) || (x.category || "").toLowerCase().includes(q));
        incList = incList.filter(x => (x.source || "").toLowerCase().includes(q) || (x.category || "").toLowerCase().includes(q));
      }

      tbody.innerHTML = renderTxTableRows(expList, incList, selectedFinanceMonthYear);
    });
  });

  // Table Search Filter
  if ($("txSearchInput")) {
    $("txSearchInput").addEventListener("input", e => {
      const q = e.target.value.toLowerCase().trim();
      const tbody = $("txTableBody");
      if (!tbody) return;

      const mExp = getFinanceExpensesForMonth(selectedFinanceMonthYear);
      const mInc = getFinanceIncomeForMonth(selectedFinanceMonthYear);

      let expList = mExp.filter(x => (x.desc || "").toLowerCase().includes(q) || (x.category || "").toLowerCase().includes(q));
      let incList = mInc.filter(x => (x.source || "").toLowerCase().includes(q) || (x.category || "").toLowerCase().includes(q));

      const activePill = document.querySelector(".filter-pill.active");
      const filter = activePill ? activePill.dataset.filter : "all";
      if (filter === "income") expList = [];
      if (filter === "expense") incList = [];

      tbody.innerHTML = renderTxTableRows(expList, incList, selectedFinanceMonthYear);
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
const forgotPassForm = document.getElementById("forgotPassForm");
const resetPassForm = document.getElementById("resetPassForm");
const loginError = document.getElementById("loginError");
const signupError = document.getElementById("signupError");
const forgotError = document.getElementById("forgotError");
const resetError = document.getElementById("resetError");
const loginSuccess = document.getElementById("loginSuccess");
const forgotSuccess = document.getElementById("forgotSuccess");
const resetSuccess = document.getElementById("resetSuccess");
const forgotPassBtn = document.getElementById("forgotPassBtn");

function showAuthTab(which) {
  const isLogin = which === "login";
  const isSignup = which === "signup";
  const isForgot = which === "forgot";
  const isReset = which === "reset";

  const authTabs = document.getElementById("authTabs");
  if (authTabs) authTabs.style.display = (isForgot || isReset) ? "none" : "flex";

  if (tabLogin) tabLogin.classList.toggle("active", isLogin);
  if (tabSignup) tabSignup.classList.toggle("active", isSignup);
  
  if (loginForm) {
    loginForm.classList.toggle("active", isLogin);
    loginForm.style.display = isLogin ? "flex" : "none";
  }
  if (signupForm) {
    signupForm.classList.toggle("active", isSignup);
    signupForm.style.display = isSignup ? "flex" : "none";
  }
  if (forgotPassForm) {
    forgotPassForm.classList.toggle("active", isForgot);
    forgotPassForm.style.display = isForgot ? "flex" : "none";
  }
  if (resetPassForm) {
    resetPassForm.classList.toggle("active", isReset);
    resetPassForm.style.display = isReset ? "flex" : "none";
  }

  if (loginError) loginError.classList.remove("show");
  if (signupError) signupError.classList.remove("show");
  if (forgotError) forgotError.classList.remove("show");
  if (resetError) resetError.classList.remove("show");
  if (loginSuccess && !isLogin) loginSuccess.classList.remove("show");
  if (forgotSuccess && !isForgot) forgotSuccess.classList.remove("show");
  if (resetSuccess && !isReset) resetSuccess.classList.remove("show");
}

if (tabLogin) tabLogin.addEventListener("click", () => showAuthTab("login"));
if (tabSignup) tabSignup.addEventListener("click", () => showAuthTab("signup"));
if (forgotPassBtn) {
  forgotPassBtn.addEventListener("click", () => {
    const loginEmail = document.getElementById("loginEmail");
    const forgotEmail = document.getElementById("forgotEmail");
    if (loginEmail && forgotEmail && loginEmail.value.trim()) {
      forgotEmail.value = loginEmail.value.trim();
    }
    showAuthTab("forgot");
  });
}
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
        usersDB[normEmail].data = sanitizeUserState({ ...blankState(), ...cloudData }, normEmail);
        if (cloudData.profile) {
          if (cloudData.profile.name) usersDB[normEmail].name = cloudData.profile.name;
          if (cloudData.profile.phone) usersDB[normEmail].phone = cloudData.profile.phone;
          if (cloudData.profile.bio) usersDB[normEmail].bio = cloudData.profile.bio;
        }
        console.log("⚡ [Multi-Device Sync] Successfully restored cloud data from Firestore for:", normEmail);
      }
    } catch (e) {
      console.warn("Cloud fetch warning:", e);
    }
  }

  state = sanitizeUserState(usersDB[normEmail].data || blankState(), normEmail);
  usersDB[normEmail].data = state;
  if (!state.startMonth) {
    state.startMonth = getActualCurrentMonthKey();
  }
  if (!state.profile) {
    state.profile = {
      name: usersDB[normEmail].name || name || normEmail.split("@")[0],
      phone: usersDB[normEmail].phone || "",
      bio: usersDB[normEmail].bio || ""
    };
  }
  if (state.profile.name) usersDB[normEmail].name = state.profile.name;
  if (state.profile.phone) usersDB[normEmail].phone = state.profile.phone;
  if (state.profile.bio) usersDB[normEmail].bio = state.profile.bio;

  if (!state.passwords) state.passwords = [];

  // 2. Attach real-time subscription for live multi-device streaming from Firebase Firestore
  if (window.Firebase && typeof window.Firebase.subscribeToCloudData === "function") {
    window.Firebase.subscribeToCloudData(normEmail, cloudData => {
      if (cloudData && typeof cloudData === "object" && Object.keys(cloudData).length > 0) {
        state = sanitizeUserState({ ...blankState(), ...state, ...cloudData }, normEmail);
        
        // Ensure usersDB record exists safely
        if (!usersDB[normEmail]) {
          usersDB[normEmail] = {
            name: (cloudData.profile && cloudData.profile.name) || (state.profile && state.profile.name) || normEmail.split("@")[0],
            data: state
          };
        }
        if (usersDB[normEmail]) {
          if (cloudData.profile) {
            if (cloudData.profile.name) usersDB[normEmail].name = cloudData.profile.name;
            if (cloudData.profile.phone) usersDB[normEmail].phone = cloudData.profile.phone;
            if (cloudData.profile.bio) usersDB[normEmail].bio = cloudData.profile.bio;
          } else if (state.profile) {
            if (state.profile.name) usersDB[normEmail].name = state.profile.name;
            if (state.profile.phone) usersDB[normEmail].phone = state.profile.phone;
            if (state.profile.bio) usersDB[normEmail].bio = state.profile.bio;
          }
          usersDB[normEmail].data = state;
        }
        
        const displayName = (usersDB[normEmail] && usersDB[normEmail].name) || (state.profile && state.profile.name) || normEmail.split("@")[0];
        if (document.getElementById("profileName")) document.getElementById("profileName").textContent = displayName;
        if (document.getElementById("profileEmail")) document.getElementById("profileEmail").textContent = normEmail;
        if (document.getElementById("profileAvatar")) document.getElementById("profileAvatar").textContent = displayName.split(" ").map(n => n[0]).join("").toUpperCase() || "U";
        
        if (document.getElementById("userProfileModal") && document.getElementById("userProfileModal").style.display !== "none") {
          openUserProfileModal();
        }
        if (typeof renderMain === "function" && currentUser === normEmail) {
          renderMain();
        }
        if (typeof checkAlerts === "function") checkAlerts();
      }
    });
  }

  const displayName = usersDB[normEmail].name || (state.profile && state.profile.name) || "User";
  if (document.getElementById("profileName")) document.getElementById("profileName").textContent = displayName;
  if (document.getElementById("profileEmail")) document.getElementById("profileEmail").textContent = normEmail;
  if (document.getElementById("profileAvatar")) document.getElementById("profileAvatar").textContent = displayName.split(" ").map(n => n[0]).join("").toUpperCase() || "U";
  
  authScreen.style.display = "none";
  appShell.style.display = "flex";
  activeView = "Dashboard";
  applyPageTranslations();
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

  const displayName = user.name || (state.profile && state.profile.name) || currentUser.split("@")[0];
  const phone = user.phone || (state.profile && state.profile.phone) || "";
  const bio = user.bio || (state.profile && state.profile.bio) || "";

  if (editName) editName.value = displayName;
  if (editEmail) editEmail.value = currentUser;
  if (editPhone) editPhone.value = phone;
  if (editBio) editBio.value = bio;
  if (modalAvatar) modalAvatar.textContent = displayName.split(" ").map(n => n[0]).join("").toUpperCase() || "U";

  const langSelect = document.getElementById("userLanguageSelect");
  if (langSelect) langSelect.value = currentLanguage || "en";
  const langLabel = document.getElementById("currentLangLabel");
  if (langLabel) {
    const names = {
      en: "English (Selected)",
      ta: "தமிழ் (தேர்ந்தெடுக்கப்பட்டது)",
      hi: "हिन्दी (चयनित)",
      ml: "മലയാളം (തിരഞ്ഞെടുത്തു)",
      te: "తెలుగు (ఎంపిక చేయబడింది)",
      es: "Español (Seleccionado)",
      fr: "Français (Sélectionné)"
    };
    langLabel.textContent = names[currentLanguage] || currentLanguage;
  }

  const monthlyBalNav = document.getElementById("profileMonthlyBalanceItem");
  if (monthlyBalNav) {
    if (isUserFirstMonth()) {
      monthlyBalNav.style.display = "none";
    } else {
      monthlyBalNav.style.display = "flex";
    }
  }

  modal.style.display = "flex";
}

function goToBalanceSettingsPage() {
  if (isUserFirstMonth()) {
    showToast(t("Monthly Balance History will be available after your first month concludes!"));
    return;
  }
  closeUserProfileModal();
  activeView = "Balance Settings";
  renderNav();
  renderMain();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ===== DEDICATED MONTHLY BALANCE HISTORY VIEW ===== */
function viewBalanceSettings() {
  if (!currentUser) return '<div class="card"><p>Please log in to view balance settings.</p></div>';

  if (isUserFirstMonth()) {
    return `
    <div style="max-width: 640px; margin: 40px auto; padding: 32px 24px; background: #ffffff; border-radius: 16px; border: 1.5px solid #e2e8f0; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.04);">
      <div style="width: 56px; height: 56px; border-radius: 16px; background: #eff6ff; color: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 16px;">
        🌱
      </div>
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">${t('Welcome to Your First Month!')}</h2>
      <p style="color: #64748b; font-size: 13.5px; line-height: 1.6; margin-bottom: 22px;">
        ${t('Your account is fresh. Monthly Balance History activates automatically after your first month completes, tracking your closing balances month-over-month.')}
      </p>
      <button type="button" onclick="activeView='Dashboard';renderNav();renderMain();"
        style="background: #4f46e5; color: #ffffff; border: none; padding: 10px 22px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 8px rgba(79,70,229,0.25);">
        ${t('← Back to Dashboard')}
      </button>
    </div>
    `;
  }

  const currentMonth = getCurrentFinanceMonthKey();
  const completedMonths = getCompletedMonths();

  const savingsData = getMonthlySavingsData(currentMonth);
  const currentInc = savingsData.currentInc;
  const incomeExp = savingsData.incomeFundedExp;
  const savingsExp = savingsData.savingsFundedExp;
  const currentExp = savingsData.currentExp;
  const currentNet = savingsData.currentNet;

  return `
  <!-- Top Navigation & Header -->
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 14px;">
    <div>
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">
        <button type="button" onclick="activeView='Dashboard';renderNav();renderMain();"
          style="background: #eef2ff; color: #4f46e5; border: 1px solid #c7d2fe; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 12.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          ${t('← Back to Dashboard')}
        </button>
      </div>
      <h2 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0;">${t('Monthly Balance History')}</h2>
    </div>
  </div>

  <!-- 1. Current Month Status Card (Ongoing) -->
  <div class="card" style="margin-bottom: 24px; border: 1.5px solid #bfdbfe; background: linear-gradient(145deg, #ffffff 0%, #eff6ff 100%);">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; box-shadow: 0 4px 12px rgba(59,130,246,0.3);">
          ⏳
        </div>
        <div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <h3 style="font-size: 17px; font-weight: 800; color: #1e3a8a; margin: 0;">${getMonthYearLabel(currentMonth)} (${t('Current Active Month')})</h3>
          </div>
          <div style="font-size: 12.5px; color: #2563eb; margin-top: 2px;">
            ${t('Actively tracking daily transactions. Finalizes into balance history after month ends.')}
          </div>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; font-weight: 700; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">${t('Dashboard Savings')}</div>
        <div style="font-size: 24px; font-weight: 800; color: #1d4ed8; font-family: var(--font-smooth-number); font-variant-numeric: tabular-nums; letter-spacing: -0.02em;">
          ${fmt(savingsData.totalSavings)}
        </div>
        ${savingsData.allTimeSavingsExp > 0 ? `
          <div style="font-size: 11px; color: #dc2626; font-weight: 700; margin-top: 2px;">
            -${fmt(savingsData.allTimeSavingsExp)} spent from savings
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Live Stat Chips -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-top: 14px;">
      <div style="background: #ffffff; border: 1px solid #dbeafe; border-radius: 10px; padding: 12px 14px;">
        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">${t('Carried From Prev Month')}</div>
        <div style="font-size: 18px; font-weight: 800; color: #059669; font-family: var(--font-smooth-number); font-variant-numeric: tabular-nums; letter-spacing: -0.015em; margin-top: 2px;">+${fmt(savingsData.lastMonthBalance)}</div>
        <div style="font-size: 11px; color: ${savingsData.allTimeSavingsExp > 0 ? '#4f46e5' : 'var(--text-muted)'}; font-weight: 600; margin-top: 3px;">${savingsData.allTimeSavingsExp > 0 ? `${fmt(savingsData.totalSavings)} savings balance` : 'From previous month'}</div>
      </div>
      <div style="background: #ffffff; border: 1px solid #dbeafe; border-radius: 10px; padding: 12px 14px;">
        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">${t('Current Logged Income')}</div>
        <div style="font-size: 18px; font-weight: 800; color: #0f172a; font-family: var(--font-smooth-number); font-variant-numeric: tabular-nums; letter-spacing: -0.015em; margin-top: 2px;">${fmt(currentInc)}</div>
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 500; margin-top: 3px;">Monthly earnings</div>
      </div>
      <div style="background: #ffffff; border: 1px solid #dbeafe; border-radius: 10px; padding: 12px 14px;">
        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Current Logged Expenses</div>
        <div style="font-size: 18px; font-weight: 800; color: #dc2626; font-family: var(--font-smooth-number); font-variant-numeric: tabular-nums; letter-spacing: -0.015em; margin-top: 2px;">${fmt(incomeExp)}</div>
        <div style="font-size: 11px; color: #dc2626; font-weight: 500; margin-top: 3px;">Deducted from income</div>
      </div>
      <div style="background: #ffffff; border: 1px solid ${savingsData.allTimeSavingsExp > 0 ? '#c7d2fe' : '#dbeafe'}; border-radius: 10px; padding: 12px 14px;">
        <div style="font-size: 11px; font-weight: 700; color: ${savingsData.allTimeSavingsExp > 0 ? '#4338ca' : 'var(--text-muted)'}; text-transform: uppercase;">Spent From Savings</div>
        <div style="font-size: 18px; font-weight: 800; color: ${savingsData.allTimeSavingsExp > 0 ? '#4f46e5' : '#64748b'}; font-family: var(--font-smooth-number); font-variant-numeric: tabular-nums; letter-spacing: -0.015em; margin-top: 2px;">${fmt(savingsData.allTimeSavingsExp)}</div>
        <div style="font-size: 11px; color: ${savingsData.allTimeSavingsExp > 0 ? '#6366f1' : 'var(--text-muted)'}; font-weight: 500; margin-top: 3px;">${fmt(savingsData.totalSavings)} balance remaining</div>
      </div>
      <div style="background: #ffffff; border: 1px solid #dbeafe; border-radius: 10px; padding: 12px 14px;">
        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">${t('Current Month Net Flow')}</div>
        <div style="font-size: 18px; font-weight: 800; color: ${currentNet >= 0 ? '#059669' : '#dc2626'}; font-family: var(--font-smooth-number); font-variant-numeric: tabular-nums; letter-spacing: -0.015em; margin-top: 2px;">${currentNet >= 0 ? '+' : ''}${fmt(currentNet)}</div>
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 500; margin-top: 3px;">Income - Income Expenses</div>
      </div>
    </div>

    ${savingsData.allTimeSavingsExp > 0 ? `
    <!-- Informative Savings Breakdown Banner -->
    <div style="margin-top: 14px; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 10px; padding: 10px 14px; font-size: 12.5px; color: #3730a3; display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 16px;">🏦</span>
      <span><strong>Savings Protection Active:</strong> <strong>${fmt(savingsData.allTimeSavingsExp)}</strong> was paid directly from your Carried Savings (${savingsData.prevMonthLabel}: ${fmt(savingsData.lastMonthBalance)} → <strong>${fmt(savingsData.totalSavings)}</strong> remaining). As requested, this does <strong>not</strong> reduce your Current Month Net Flow (${fmt(currentNet)}).</span>
    </div>` : ''}

    <!-- Informational Note -->
    <div style="margin-top: 14px; background: rgba(255,255,255,0.7); border: 1px solid #bfdbfe; border-radius: 10px; padding: 10px 14px; font-size: 12px; color: #1e40af; display: flex; align-items: center; gap: 8px;">
      <span>ℹ️</span>
      <span><strong>Month-End Finalization:</strong> Once ${getMonthYearLabel(currentMonth)} concludes, its closing net balance automatically locks into your ${t("Completed Months' Balance History")} below and transfers into next month's savings.</span>
    </div>
  </div>

  <!-- 3. Completed Months' Balance History (Finalized After Month End) -->
  <div class="card" style="margin-bottom: 24px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 10px;">
      <div>
        <h3 style="font-size: 17px; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
          <span>Completed Months' Balance History</span>
        </h3>
      </div>
      <button type="button" onclick="toggleAddCustomMonthHistoryBox()"
        style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
        ${t('+ Record Older Month Balance')}
      </button>
    </div>

    <!-- Add Past Month Balance Collapsible Form -->
    <div id="addPastMonthBox" style="display: none; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 14px; margin-bottom: 16px;">
      <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">${t('Record Balance for an Earlier Month')}</div>
      <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
        <input type="month" id="newPastMonthInput" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px; background: #fff;">
        <input type="number" id="newPastAmountInput" placeholder="Closing balance (e.g. 2500)" step="any" style="flex: 1; min-width: 140px; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px; background: #fff;">
        <button type="button" onclick="submitCustomMonthHistory()" style="background: #10b981; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-size: 12.5px; font-weight: 700; cursor: pointer;">${t('Save Record')}</button>
        <button type="button" onclick="toggleAddCustomMonthHistoryBox()" style="background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 8px; font-size: 12.5px; font-weight: 600; cursor: pointer;">Cancel</button>
      </div>
    </div>

    <!-- Completed Months List -->
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${completedMonths.length === 0 ? `
        <div style="padding: 28px; text-align: center; color: var(--text-muted); font-size: 13px; background: #f8fafc; border-radius: 12px; border: 1px dashed var(--border-color);">
          ${t('No completed historical months recorded yet. As months conclude, their closing balances appear here automatically.')}
        </div>
      ` : completedMonths.map(m => {
        const isCustom = state.monthlyBalances && state.monthlyBalances[m] !== undefined && state.monthlyBalances[m] !== null;
        const currentBal = getMonthlyBalance(m);

        return `
          <div class="completed-month-card" id="historyRow_${m}" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: #ffffff; border: 1px solid var(--border-color); border-radius: 12px; gap: 14px; flex-wrap: wrap; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
            <div>
              <span style="font-weight: 800; font-size: 15px; color: #0f172a;">${getMonthYearLabel(m)}</span>
            </div>

            <div style="display: flex; align-items: center; gap: 12px;" id="historyActions_${m}">
              <div style="text-align: right;">
                <div style="font-size: 10.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">${t('Closing Balance')}</div>
                <div style="font-weight: 800; font-size: 18px; color: ${currentBal >= 0 ? '#059669' : '#dc2626'}; font-family: var(--font-smooth-number); font-variant-numeric: tabular-nums; letter-spacing: -0.015em;">
                  ${fmt(currentBal)}
                </div>
              </div>
              <button type="button" onclick="startEditCompletedBalance('${m}')"
                style="background: #f8fafc; border: 1px solid #cbd5e1; color: #334155; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 8px; cursor: pointer; transition: background 0.15s ease;">
                ${t('Edit Balance')}
              </button>
              ${isCustom ? `
              <button type="button" onclick="resetCompletedBalance('${m}')" title="Reset to auto-calculated income minus expenses"
                style="background: #fff1f2; border: 1px solid #fecaca; color: #e11d48; font-size: 12px; font-weight: 700; padding: 6px 10px; border-radius: 8px; cursor: pointer;">
                Reset
              </button>` : ''}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  </div>
  `;
}

function startEditCompletedBalance(monthKey) {
  const actionsDiv = document.getElementById("historyActions_" + monthKey);
  if (!actionsDiv) return;
  const currentBal = getMonthlyBalance(monthKey);
  actionsDiv.innerHTML = `
    <div style="display: flex; align-items: center; gap: 6px;">
      <span style="font-size: 14px; font-weight: 700; color: #475569;">₹</span>
      <input type="number" id="inputHist_${monthKey}" value="${currentBal}" step="any"
        style="width: 110px; padding: 6px 10px; border-radius: 8px; border: 1.5px solid #6366f1; font-weight: 700; font-size: 13px; font-family: var(--font-smooth-number); font-variant-numeric: tabular-nums; outline: none; background: #fff;">
      <button type="button" onclick="submitEditCompletedBalance('${monthKey}')"
        style="background: #10b981; color: #ffffff; border: none; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">
        Save
      </button>
      <button type="button" onclick="renderMain()"
        style="background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
        Cancel
      </button>
    </div>
  `;
  const inp = document.getElementById("inputHist_" + monthKey);
  if (inp) {
    inp.focus();
    inp.select();
    inp.onkeydown = (e) => {
      if (e.key === "Enter") { e.preventDefault(); submitEditCompletedBalance(monthKey); }
      else if (e.key === "Escape") { e.preventDefault(); renderMain(); }
    };
  }
}

function submitEditCompletedBalance(monthKey) {
  const inp = document.getElementById("inputHist_" + monthKey);
  if (!inp) return;
  const val = parseFloat(inp.value);
  if (isNaN(val)) {
    showToast("Please enter a valid balance amount.");
    return;
  }
  if (!state.monthlyBalances) state.monthlyBalances = {};
  state.monthlyBalances[monthKey] = val;
  saveSessionData();
  renderMain();
  showToast(`Updated ${getMonthYearLabel(monthKey)} balance to ${fmt(val)}!`);
}

function resetCompletedBalance(monthKey) {
  if (state.monthlyBalances && state.monthlyBalances[monthKey] !== undefined) {
    delete state.monthlyBalances[monthKey];
    saveSessionData();
    renderMain();
    showToast(`Reset ${getMonthYearLabel(monthKey)} balance to automatic calculation.`);
  }
}

function toggleAddCustomMonthHistoryBox() {
  const box = document.getElementById("addPastMonthBox");
  if (!box) return;
  box.style.display = (box.style.display === "none" || !box.style.display) ? "block" : "none";
}

function submitCustomMonthHistory() {
  const mInput = document.getElementById("newPastMonthInput");
  const aInput = document.getElementById("newPastAmountInput");
  if (!mInput || !aInput) return;
  const monthKey = mInput.value;
  const val = parseFloat(aInput.value);
  if (!monthKey) {
    showToast("Please select a month.");
    return;
  }
  if (isNaN(val)) {
    showToast("Please enter a valid balance amount.");
    return;
  }
  if (!state.monthlyBalances) state.monthlyBalances = {};
  state.monthlyBalances[monthKey] = val;
  saveSessionData();
  mInput.value = "";
  aInput.value = "";
  toggleAddCustomMonthHistoryBox();
  renderMain();
  showToast(`Recorded ${getMonthYearLabel(monthKey)} balance as ${fmt(val)}!`);
}

window.goToBalanceSettingsPage = goToBalanceSettingsPage;
window.startEditCompletedBalance = startEditCompletedBalance;
window.submitEditCompletedBalance = submitEditCompletedBalance;
window.resetCompletedBalance = resetCompletedBalance;
window.toggleAddCustomMonthHistoryBox = toggleAddCustomMonthHistoryBox;
window.submitCustomMonthHistory = submitCustomMonthHistory;
window.isUserFirstMonth = isUserFirstMonth;
window.getCompletedMonths = getCompletedMonths;

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
    console.warn("Signup notice:", err.message || err);
    if (signupError) {
      signupError.textContent = "Account creation notice: " + (err.message || err);
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

  if (!email && !pass) {
    if (loginError) {
      loginError.innerHTML = `<span style="color: #dc2626; font-size: 13px; font-weight: 700;">Please enter your email and password.</span>`;
      loginError.classList.add("show");
    }
    return;
  }
  if (!email) {
    if (loginError) {
      loginError.innerHTML = `<span style="color: #dc2626; font-size: 13px; font-weight: 700;">Wrong email. Please enter your email address.</span>`;
      loginError.classList.add("show");
    }
    return;
  }
  if (!pass) {
    if (loginError) {
      loginError.innerHTML = `<span style="color: #dc2626; font-size: 13px; font-weight: 700;">Please enter your password.</span>`;
      loginError.classList.add("show");
    }
    return;
  }
  if (!email.includes("@") || !email.includes(".")) {
    if (loginError) {
      loginError.innerHTML = `<span style="color: #dc2626; font-size: 13px; font-weight: 700;">Wrong email address. Please enter a valid email.</span>`;
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
          if (res.errorType === "not_signed_up" || res.code === "auth/user-not-found") {
            loginError.innerHTML = `
              <div style="color: #dc2626; font-size: 13px; font-weight: 700; margin-top: 6px; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
                <span>No account found. Please create an account.</span>
                <button type="button" onclick="switchToSignup('${escapeHtml(email)}')"
                  style="background: #dc2626; color: #ffffff; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer; white-space: nowrap;">
                  Create account →
                </button>
              </div>
            `;
            loginError.classList.add("show");
          } else if (res.errorType === "wrong_password" || res.code === "auth/wrong-password") {
            loginError.innerHTML = `<div style="color: #dc2626; font-size: 13px; font-weight: 700; margin-top: 6px;">Wrong Password</div>`;
            loginError.classList.add("show");
          } else if (res.errorType === "wrong_email" || res.code === "auth/invalid-email") {
            loginError.innerHTML = `
              <div style="color: #dc2626; font-size: 13px; font-weight: 700; margin-top: 6px;">
                Wrong email address. Please enter a valid email.
              </div>
            `;
            loginError.classList.add("show");
          } else if (res.errorType === "network_error" || res.code === "auth/network-request-failed" || (typeof navigator !== 'undefined' && !navigator.onLine)) {
            if (usersDB[email]) {
              const displayName = usersDB[email].name || (usersDB[email].data && usersDB[email].data.profile && usersDB[email].data.profile.name) || email.split("@")[0];
              enterApp(email, displayName);
              showToast(`Offline mode active. Welcome back, ${displayName}!`);
              return;
            }
            loginError.innerHTML = `
              <div style="color: #dc2626; font-size: 13px; font-weight: 700; margin-top: 6px;">
                Network connection offline or unreachable. Please check your internet connection.
              </div>
            `;
            loginError.classList.add("show");
          } else {
            loginError.innerHTML = `
              <div style="color: #dc2626; font-size: 13px; font-weight: 700; margin-top: 6px;">
                ${escapeHtml(res.message || "Invalid credentials. Please try again.")}
              </div>
            `;
            loginError.classList.add("show");
          }
        }
      }
    } else {
      // Local session fallback
      if (usersDB[email]) {
        if (usersDB[email].password === pass) {
          enterApp(email, usersDB[email].name);
        } else {
          loginError.innerHTML = `<div style="color: #dc2626; font-size: 13px; font-weight: 700; margin-top: 6px;">Wrong Password</div>`;
          loginError.classList.add("show");
        }
      } else {
        loginError.innerHTML = `
          <div style="color: #dc2626; font-size: 13px; font-weight: 700; margin-top: 6px; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
            <span>No account found. Please create an account.</span>
            <button type="button" onclick="switchToSignup('${escapeHtml(email)}')"
              style="background: #dc2626; color: #ffffff; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer; white-space: nowrap;">
              Create account →
            </button>
          </div>
        `;
        loginError.classList.add("show");
      }
    }
  } catch (err) {
    console.warn("Login notice:", err.message || err);
    if (loginError) {
      loginError.innerHTML = `<span style="color: #dc2626; font-size: 13px; font-weight: 700;">Sign in notice: ${escapeHtml(err.message || String(err))}</span>`;
      loginError.classList.add("show");
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Log in";
    }
  }
});

/* ===== FORGOT PASSWORD & RESET LINK HANDLERS ===== */
if (forgotPassForm) {
  forgotPassForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById("forgotEmail");
    const submitBtn = document.getElementById("sendResetBtn");
    const forgotSuccess = document.getElementById("forgotSuccess");
    const forgotError = document.getElementById("forgotError");

    const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
    if (!email) {
      if (forgotError) {
        forgotError.textContent = "Please enter your email address.";
        forgotError.classList.add("show");
      }
      return;
    }

    if (forgotError) forgotError.classList.remove("show");
    if (forgotSuccess) forgotSuccess.classList.remove("show");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending Reset Link...";
    }

    try {
      if (window.Firebase && typeof window.Firebase.sendPasswordReset === "function") {
        const res = await window.Firebase.sendPasswordReset(email);
        if (!res.success) {
          throw new Error(res.message || "Failed to send reset email.");
        }
      }

      if (forgotSuccess) {
        forgotSuccess.innerHTML = `
          <div style="line-height:1.5;">
            <div style="font-weight:700; color:#15803d; font-size:13.5px; margin-bottom:6px;">
              📩 Password Reset Link Sent to Inbox!
            </div>
            <div>We have sent a secure password reset link to <b style="color:#0f172a;">${escapeHtml(email)}</b>.</div>
            <div style="margin-top:8px; font-size:12px; color:#166534; line-height:1.5;">
              • Please open your email <b>Inbox</b> and click the reset link to change your password.<br>
              • If you do not see it within a minute, please check your <b>Spam / Junk</b> folder or Gmail <b>Promotions</b> tab.<br>
              • Sender: <code>noreply@lifeleader-c60e8.firebaseapp.com</code>
            </div>
          </div>
        `;
        forgotSuccess.classList.add("show");
      }
      showToast("Password reset link sent! Check your inbox or spam folder.");
      if (emailInput) emailInput.value = "";
    } catch (err) {
      console.warn("Forgot password notice:", err.message || err);
      if (forgotError) {
        forgotError.textContent = err.message || "Failed to send password reset link. Please verify your email.";
        forgotError.classList.add("show");
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "📩 Send Reset Link to Inbox";
      }
    }
  });
}

if (resetPassForm) {
  resetPassForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newPassInput = document.getElementById("newPass");
    const confirmPassInput = document.getElementById("confirmNewPass");
    const submitBtn = document.getElementById("updatePasswordBtn");
    const resetSuccess = document.getElementById("resetSuccess");
    const resetError = document.getElementById("resetError");

    const newPass = newPassInput ? newPassInput.value : "";
    const confirmPass = confirmPassInput ? confirmPassInput.value : "";

    if (!newPass || !confirmPass) {
      if (resetError) {
        resetError.textContent = "Please fill in both password fields.";
        resetError.classList.add("show");
      }
      return;
    }

    if (newPass.length < 6) {
      if (resetError) {
        resetError.textContent = "Password must be at least 6 characters long.";
        resetError.classList.add("show");
      }
      return;
    }

    if (newPass !== confirmPass) {
      if (resetError) {
        resetError.textContent = "Passwords do not match. Please re-enter.";
        resetError.classList.add("show");
      }
      return;
    }

    if (resetError) resetError.classList.remove("show");
    if (resetSuccess) resetSuccess.classList.remove("show");

    const urlParams = new URLSearchParams(window.location.search);
    const oobCode = urlParams.get("oobCode");

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Updating Password...";
    }

    try {
      let updatedEmail = "";
      if (window.Firebase && typeof window.Firebase.confirmPasswordReset === "function" && oobCode && !oobCode.startsWith("mock-") && !(window._localResetTokens && window._localResetTokens[oobCode])) {
        const res = await window.Firebase.confirmPasswordReset(oobCode, newPass);
        if (!res.success) {
          throw new Error(res.message || "Failed to update password.");
        }
        updatedEmail = res.email || "";
      } else if (window._localResetTokens && window._localResetTokens[oobCode]) {
        updatedEmail = window._localResetTokens[oobCode];
        delete window._localResetTokens[oobCode];
      }

      if (updatedEmail && usersDB[updatedEmail]) {
        usersDB[updatedEmail].password = newPass;
      }

      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {}

      showAuthTab("login");
      const loginEmailInput = document.getElementById("loginEmail");
      const loginPassInput = document.getElementById("loginPass");
      if (loginEmailInput && updatedEmail) {
        loginEmailInput.value = updatedEmail;
      }
      if (loginPassInput) {
        loginPassInput.value = "";
        loginPassInput.focus();
      }

      if (loginSuccess) {
        loginSuccess.innerHTML = `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 12px 14px; border-radius: 10px; font-size: 13px; line-height: 1.5; margin-bottom: 12px;">
            <strong>✅ Password Reset Complete!</strong><br>
            Your new password has been updated in the database.<br>
            Please log in using your <b>updated password</b>.
          </div>
        `;
        loginSuccess.classList.add("show");
      }
      showToast("Password updated successfully! Please log in.");
    } catch (err) {
      console.warn("Reset password notice:", err.message || err);
      if (resetError) {
        resetError.textContent = "Notice updating password: " + (err.message || err);
        resetError.classList.add("show");
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Update Password";
      }
    }
  });
}

function switchToSignup(prefillEmail) {
  showAuthTab('signup');
  const sEmail = document.getElementById("signupEmail");
  if (sEmail && prefillEmail) sEmail.value = prefillEmail;
  const sName = document.getElementById("signupName");
  if (sName) sName.focus();
}

function switchToForgot(prefillEmail) {
  const forgotBtn = document.getElementById("forgotPassBtn");
  if (forgotBtn) forgotBtn.click();
  const fEmail = document.getElementById("forgotEmail");
  if (fEmail && prefillEmail) fEmail.value = prefillEmail;
}

window.switchToSignup = switchToSignup;
window.switchToForgot = switchToForgot;

function checkResetPasswordUrl() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get("mode");
    const oobCode = urlParams.get("oobCode");
    if ((mode === "resetPassword" || mode === "reset") && oobCode) {
      if (authScreen) authScreen.style.display = "flex";
      if (appShell) appShell.style.display = "none";
      showAuthTab("reset");

      const resetEmailBadge = document.getElementById("resetEmailBadge");
      const resetError = document.getElementById("resetError");

      if (window.Firebase && typeof window.Firebase.verifyResetCode === "function" && !(window._localResetTokens && window._localResetTokens[oobCode])) {
        window.Firebase.verifyResetCode(oobCode).then(res => {
          if (res.success && res.email) {
            if (resetEmailBadge) {
              resetEmailBadge.textContent = "Account: " + res.email;
              resetEmailBadge.style.display = "inline-flex";
            }
          } else {
            if (resetError) {
              resetError.textContent = res.message || "This password reset link is invalid or has expired.";
              resetError.classList.add("show");
            }
          }
        });
      } else if (window._localResetTokens && window._localResetTokens[oobCode]) {
        const localEmail = window._localResetTokens[oobCode];
        if (resetEmailBadge) {
          resetEmailBadge.textContent = "Account: " + localEmail;
          resetEmailBadge.style.display = "inline-flex";
        }
      }
      return true;
    }
  } catch (e) {
    console.warn("Reset URL check error:", e);
  }
  return false;
}

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
              ${r.fileData ? `<button class="action-btn" onclick="openDocModalFromHealth('${escapeHtml(r.title)}', '${r.fileData}')">View File</button>` : ''}
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
            ${r.fileData ? `<button class="action-btn" onclick="openDocModalFromHealth('${escapeHtml(r.title)}', '${r.fileData}')">View Attachment</button>` : ''}
            <button class="action-btn danger-btn" onclick="deleteHealthRecord(${r.id})">Delete</button>
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
      <div class="responsive-form-grid">
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
        <input type="text" id="hrNotesInput" class="grid-col-full" placeholder="Notes (Optional)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="file" id="hrFileInput" class="grid-col-full" style="font-size: 12px;">
        <button id="hrAddBtn" class="grid-col-full" onclick="addHealthRecord()" style="padding: 10px; background: var(--primary-brand); color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">Save Health Record</button>
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
    if (file.size > 800 * 1024) {
      showToast("⚠️ Health attachment exceeds 800 KB limit for cloud sync. Please select a smaller file.");
      return;
    }
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
    body.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; padding:20px; width:100%;"><img src="${dataUrl}" style="max-width: 100%; max-height:70vh; border-radius: 8px; object-fit:contain;"></div>`;
  } else if (dataUrl.startsWith("data:application/pdf") || dataUrl.includes(";base64,JVBERi")) {
    renderPdfDocumentToContainer(dataUrl, body);
  } else {
    body.innerHTML = `<div style="padding: 40px 20px; text-align: center; color:#cbd5e1; font-size:14px;">Attachment available for download using the button below.</div>`;
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
        <div style="font-size: 32px; font-weight: 800; font-family: var(--font-smooth-number); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; color: #2563eb;">
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

    <div class="workout-form-grid">
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
          <button class="action-btn danger-btn" onclick="deleteWorkout(${w.id})">Delete</button>
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
            <button class="action-btn danger-btn" onclick="deleteMedication(${m.id})">Delete</button>
          </div>
        </div>
      `).join("")}
      ${meds.length === 0 ? `<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">No medication reminders set yet.</div>` : ''}
    </div>

    <div style="margin-top: 20px; background: #f8fafc; padding: 18px; border-radius: 12px; border: 1px solid var(--border-color);">
      <div style="font-weight: 700; font-size: 13.5px; margin-bottom: 10px; color: #0f172a;">➕ Add Medication Reminder</div>
      <div class="responsive-form-grid">
        <input type="text" id="medNameInput" placeholder="Medication Name (e.g. Paracetamol)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="text" id="medDosageInput" placeholder="Dosage (e.g. 500mg)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <select id="medFreqSelect" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
          <option value="Once Daily">Once Daily</option>
          <option value="Twice Daily">Twice Daily</option>
          <option value="Thrice Daily">Thrice Daily</option>
          <option value="As Needed">As Needed</option>
        </select>
        <input type="text" id="medTimeInput" placeholder="Reminder Time (e.g. 9:00 AM)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="text" id="medNotesInput" class="grid-col-full" placeholder="Notes (Optional)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <button class="grid-col-full action-btn pay-btn" onclick="addMedication()" style="padding: 10px;">Save Reminder</button>
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
          <button class="action-btn danger-btn" onclick="deleteAppointment(${v.id})">Delete</button>
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
              <button class="action-btn danger-btn" onclick="deleteNote(${n.id})">Delete</button>
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

    <div class="contacts-cards-grid">
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
            <button class="action-btn danger-btn" onclick="deleteContact(${c.id})">Delete</button>
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
      <div class="responsive-form-grid">
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
        <button class="grid-col-full action-btn pay-btn" onclick="saveContact()" style="padding: 10px;">Save Contact</button>
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

    <div class="vehicles-cards-grid">
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
              <button class="action-btn danger-btn" onclick="deleteVehicle(${v.id})">Delete</button>
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
      <div class="responsive-form-grid">
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
        <button class="grid-col-full action-btn pay-btn" onclick="saveVehicle()" style="padding: 10px;">Save Vehicle</button>
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

    <div class="warranties-cards-grid">
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
              <button class="action-btn danger-btn" onclick="deleteWarranty(${w.id})">Delete</button>
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
      <div class="responsive-form-grid">
        <input type="text" id="wProductInput" placeholder="Product Name (e.g. MacBook Air)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="text" id="wBrandInput" placeholder="Brand / Manufacturer" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="date" id="wPurchaseDateInput" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="date" id="wExpiryDateInput" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="number" id="wPriceInput" placeholder="Purchase Price (₹)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <input type="text" id="wSellerInput" placeholder="Store / Seller" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px;">
        <button class="grid-col-full action-btn pay-btn" onclick="saveWarranty()" style="padding: 10px;">Save Warranty</button>
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
    if (file.size > 800 * 1024) {
      showToast("⚠️ PDF exceeds 800 KB limit for cloud document sync. Please select a smaller PDF.");
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

    <div class="ids-cards-grid">
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
                    View
                  </button>
                  <a href="${idItem.documentFile || idItem.fileData}" download="${escapeHtml(idItem.fileName || docType + '.pdf')}" style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; text-decoration: none; padding: 5px 10px; font-weight: 700; font-size: 11.5px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                    Download
                  </a>
                ` : ''}
              </div>
              <button class="action-btn danger-btn" onclick="deleteImportantId(${idItem.id})" style="font-size: 11px; padding: 5px 10px;">Delete</button>
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

    <div style="margin-top: 24px; background: #f8fafc; padding: 18px; border-radius: 12px; border: 1px solid var(--border-color);">
      <div style="font-weight: 700; font-size: 13.5px; margin-bottom: 12px; color: #0f172a;">➕ Add Vehicle Document / ID Record</div>
      <div class="responsive-form-grid">
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

        <div class="grid-col-full" style="display: flex; flex-direction: column;">
          <label style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 3px;">Choose Vehicle Document (PDF Only)</label>
          <input type="file" id="idFileInput" accept=".pdf,application/pdf" style="display: none;" onchange="handleIdPdfSelect(this)">
          <button type="button" onclick="document.getElementById('idFileInput').click()" style="background: #ffffff; border: 1px solid var(--border-color); padding: 9px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 600; cursor: pointer; color: #334155; display: flex; align-items: center; gap: 6px; width: 100%;">
            📄 <span id="idFileLabel">${selectedIdPdfFile ? '📎 ' + selectedIdPdfFile.name : 'Choose PDF Document...'}</span>
          </button>
        </div>

        <button class="grid-col-full action-btn pay-btn" onclick="saveImportantId()" style="padding: 10px; font-weight: 700; font-size: 13.5px; margin-top: 4px;">
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

  (state.timetableTasks || []).forEach(t => {
    if ((t.title && t.title.toLowerCase().includes(q)) || (t.notes && t.notes.toLowerCase().includes(q))) {
      results.push({ category: "Timetable", title: t.title, date: t.date || "", status: t.done ? "Done" : "Pending", view: "Productivity" });
    }
  });

  (state.timetablePeriods || []).forEach(p => {
    if (p.name && p.name.toLowerCase().includes(q)) {
      results.push({ category: "Periods", title: p.name, date: `${p.startTime || ''} - ${p.endTime || ''}`, status: "Period", view: "Productivity" });
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

async function logoutUser() {
  if (typeof closeUserProfileModal === "function") {
    closeUserProfileModal();
  }
  if (typeof closeReportIssueModal === "function") {
    closeReportIssueModal();
  }
  if (window.Firebase && window.Firebase.auth) {
    try {
      const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
      await signOut(window.Firebase.auth);
    } catch (e) {
      console.warn("Firebase signOut warning:", e);
    }
  }
  if (window.Firebase && typeof window.Firebase.unsubscribeFromCloudData === "function") {
    try {
      window.Firebase.unsubscribeFromCloudData();
    } catch (e) {}
  }
  currentUser = null;
  usersDB = {};
  state = blankState();
  const authScreen = document.getElementById("authScreen");
  const appShell = document.getElementById("appShell");
  if (appShell) appShell.style.display = "none";
  if (authScreen) authScreen.style.display = "flex";

  const loginPass = document.getElementById("loginPass");
  if (loginPass) loginPass.value = "";
  const signupPass = document.getElementById("signupPass");
  if (signupPass) signupPass.value = "";

  showToast("Logged out successfully!");
}

function attachGlobalHeaderEvents() {
  const gSearch = document.getElementById("globalSearchInput");
  if (gSearch && (!gSearch.dataset || !gSearch.dataset.bound)) {
    if (gSearch.dataset) gSearch.dataset.bound = "true";
    gSearch.addEventListener("input", e => handleGlobalSearch(e.target.value));
  }
  const notifBtn = document.getElementById("notifBellBtn");
  if (notifBtn && (!notifBtn.dataset || !notifBtn.dataset.bound)) {
    if (notifBtn.dataset) notifBtn.dataset.bound = "true";
    notifBtn.addEventListener("click", toggleNotifDrawer);
  }
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn && (!logoutBtn.dataset || !logoutBtn.dataset.bound)) {
    if (logoutBtn.dataset) logoutBtn.dataset.bound = "true";
    logoutBtn.addEventListener("click", logoutUser);
  }
  const modalLogoutBtn = document.getElementById("modalLogoutBtn");
  if (modalLogoutBtn && (!modalLogoutBtn.dataset || !modalLogoutBtn.dataset.bound)) {
    if (modalLogoutBtn.dataset) modalLogoutBtn.dataset.bound = "true";
    modalLogoutBtn.addEventListener("click", logoutUser);
  }
}

// INITIAL STATE & LIVE DATE TIMER
(function initApp() {
  const isResetting = checkResetPasswordUrl();
  if (!isResetting) {
    const restoredUser = loadSessionData();
    if (restoredUser && usersDB[restoredUser]) {
      enterApp(restoredUser, usersDB[restoredUser].name);
    } else {
      authScreen.style.display = "flex";
      appShell.style.display = "none";
    }
  }
  attachGlobalHeaderEvents();
  if (typeof applyPageTranslations === "function") {
    applyPageTranslations();
  }
  setInterval(updateLiveDate, 1000);
  updateLiveDate();
})();

// Window exports for Timetable System
window.changeTimetableDate = changeTimetableDate;
window.shiftTimetableDate = shiftTimetableDate;
window.resetTimetableToToday = resetTimetableToToday;
window.toggleTimetableTaskDone = toggleTimetableTaskDone;
window.deleteTimetableTask = deleteTimetableTask;
window.copyUnfinishedTasksFromYesterday = copyUnfinishedTasksFromYesterday;
window.openAddTimetableTaskModal = openAddTimetableTaskModal;
window.openEditTimetableTaskModal = openEditTimetableTaskModal;
window.closeTimetableTaskModal = closeTimetableTaskModal;
window.submitTimetableTask = submitTimetableTask;
window.viewProductivityTimetable = viewProductivityTimetable;


