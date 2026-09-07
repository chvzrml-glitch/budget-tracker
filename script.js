import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";


import {
    getFirestore,
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


import {
    getAuth,
    setPersistence,
    browserLocalPersistence,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
/* =========================================================
   FIREBASE
========================================================= */

const firebaseConfig = {
    apiKey: "AIzaSyC-Ye3G7g5fVu0-vq99y_EZOM3oBxLf2Hc",
    authDomain: "budget-tracker-86c5b.firebaseapp.com",
    projectId: "budget-tracker-86c5b",
    storageBucket: "budget-tracker-86c5b.firebasestorage.app",
    messagingSenderId: "253859931650",
    appId: "1:253859931650:web:96e803218deaffe863a91b"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

const auth = getAuth(app);

const googleProvider =
    new GoogleAuthProvider();

setPersistence(
    auth,
    browserLocalPersistence
).catch(
    (error) => {
        console.error(
            "Auth persistence error:",
            error
        );
    }
);

/*
    OLD SHARED DATA
    Keep this as migration backup.
*/
const legacyBudgetDoc =
    doc(
        db,
        "budgetTracker",
        "main"
    );


/*
    This becomes the currently active
    user's private budget document.
*/
let budgetDoc =
    null;

function getUserBudgetDoc(
    user
) {

    return doc(
        db,
        "users",
        user.uid,
        "budgetTracker",
        "main"
    );
}

const LEGACY_OWNER_UID = "YOUR_OWN_UID_HERE";

async function migrateLegacyBudgetIfNeeded(
    user
) {

    const userBudgetDoc =
        getUserBudgetDoc(
            user
        );


    const userSnapshot =
        await getDoc(
            userBudgetDoc
        );


    /*
        Existing user:
        just use their own data.
    */
    if (
        userSnapshot.exists()
    ) {

        console.log(
            "Personal budget already exists."
        );

        return userBudgetDoc;
    }


    /*
        IMPORTANT:
        Only YOUR account is allowed
        to receive the old shared data.
    */
    if (
        user.uid !==
        LEGACY_OWNER_UID
    ) {

        console.log(
            "New user detected — creating empty budget."
        );


        await setDoc(
            userBudgetDoc,
            {
                transactions: [],
                transfers: [],
                debts: [],
                allowanceEntries: [],
                dailyPlans: {},

                moneyPoolBase: {
                    Needs: 0,
                    Wants: 0,
                    Savings: 0
                },

                budgetPresets: [],
                savingsVaultEntries: []
            }
        );


        return userBudgetDoc;
    }


    /*
        Only Ray's account reaches here.
    */
    const legacySnapshot =
        await getDoc(
            legacyBudgetDoc
        );


    if (
        !legacySnapshot.exists()
    ) {

        return userBudgetDoc;
    }


    await setDoc(
        userBudgetDoc,
        legacySnapshot.data()
    );


    console.log(
        "Legacy budget copied to owner account."
    );


    return userBudgetDoc;
}


/* =========================================================
   DATA
========================================================= */

let transactions = [];
let transfers = [];
let debts = [];
let allowanceEntries = [];
let dailyPlans = {};
let savingsVaultEntries = [];

let moneyPoolBase = {
    Needs: 0,
    Wants: 0,
    Savings: 0
};

let selectedCategory = "Needs";

const $ = (id) => document.getElementById(id);


/* =========================================================
   HELPERS
========================================================= */

function money(value) {

    const number = Number(value) || 0;
    const sign = number < 0 ? "-" : "";

    return `${sign}₱${Math.abs(number).toLocaleString(
        "en-PH",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    )}`;
}


function signedMoney(value) {

    const number = Number(value) || 0;

    if (number > 0) {
        return `+${money(number)}`;
    }

    return money(number);
}


function getToday() {

    const date = new Date();

    const year = date.getFullYear();

    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function shiftDate(dateString, amount) {

    const [year, month, day] =
        dateString
            .split("-")
            .map(Number);

    const date =
        new Date(
            year,
            month - 1,
            day
        );

    date.setDate(
        date.getDate() + amount
    );

    return `${date.getFullYear()}-${String(
        date.getMonth() + 1
    ).padStart(2, "0")}-${String(
        date.getDate()
    ).padStart(2, "0")}`;
}


function safeArray(value) {
    return Array.isArray(value) ? value : [];
}


function uid() {

    return (
        Date.now() +
        Math.floor(
            Math.random() * 100000
        )
    );
}


function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   DAILY PLAN HELPERS
========================================================= */

function emptyAllocations() {

    return {
        Needs: 0,
        Wants: 0,
        Savings: 0
    };
}


function getPlanAllocations(date) {

    const plan = dailyPlans[date];

    if (
        !plan ||
        !plan.allocations ||
        typeof plan.allocations !== "object"
    ) {
        return emptyAllocations();
    }

    return {

        Needs:
            Number(
                plan.allocations.Needs
            ) || 0,

        Wants:
            Number(
                plan.allocations.Wants
            ) || 0,

        Savings:
            Number(
                plan.allocations.Savings
            ) || 0
    };
}


function getPlanBaseMoney(date) {

    const plan = dailyPlans[date];

    if (!plan) {
        return 0;
    }

    if (
        plan.allocations &&
        typeof plan.allocations === "object"
    ) {

        const allocation =
            getPlanAllocations(date);

        return (
            allocation.Needs +
            allocation.Wants +
            allocation.Savings
        );
    }

    return Number(plan.limit) || 0;
}


/* =========================================================
   MONEY DASHBOARD
========================================================= */

function categoryAllocated(
    category,
    ignoreDate = null
) {

    let total = 0;

    Object.keys(dailyPlans)
        .forEach((date) => {

            if (
                ignoreDate &&
                date === ignoreDate
            ) {
                return;
            }

            const allocation =
                getPlanAllocations(date);

            total +=
                Number(
                    allocation[category]
                ) || 0;
        });

    return total;
}


function categoryRemaining(category) {

    const original =
        Number(
            moneyPoolBase[category]
        ) || 0;

    const allocated =
        categoryAllocated(category);

    return original - allocated;
}


function categoryAvailableForDay(
    category,
    date
) {

    const original =
        Number(
            moneyPoolBase[category]
        ) || 0;

    const allocatedOtherDays =
        categoryAllocated(
            category,
            date
        );

    return (
        original -
        allocatedOtherDays
    );
}


/* =========================================================
   MONEY DASHBOARD BARS
========================================================= */

function setMoneyPoolBar(
    prefix,
    remaining,
    original
) {

    const safeOriginal =
        Number(original) || 0;

    const safeRemaining =
        Number(remaining) || 0;

    let percentage = 0;

    if (safeOriginal > 0) {

        percentage =
            (
                safeRemaining /
                safeOriginal
            ) * 100;
    }

    const clamped =
        Math.max(
            0,
            Math.min(
                100,
                percentage
            )
        );

    const progress =
        $(`${prefix}PoolProgress`);

    if (progress) {

        progress.style.width =
            `${clamped}%`;

        progress.classList.toggle(
            "negative",
            safeRemaining < 0
        );

        progress.classList.toggle(
            "empty",
            safeRemaining <= 0 &&
            safeOriginal > 0
        );
    }

    const fraction =
        $(`${prefix}PoolFraction`);

    if (fraction) {

        fraction.textContent =
            `${money(
                safeRemaining
            )} / ${money(
                safeOriginal
            )}`;
    }

    const percentText =
        $(`${prefix}PoolPercent`);

    if (percentText) {

        percentText.textContent =
            `${Math.max(
                0,
                Math.round(percentage)
            )}%`;
    }
}


function updateMoneyDashboard() {

    const needs =
        categoryRemaining(
            "Needs"
        );

    const wants =
        categoryRemaining(
            "Wants"
        );

    const savings =
        getSavingsVaultBalance();


    const totalRemaining =
        needs +
        wants;


    const totalOriginal =
        (
            Number(
                moneyPoolBase.Needs
            ) || 0
        ) +
        (
            Number(
                moneyPoolBase.Wants
            ) || 0
        );


    if ($("needsPool")) {

        $("needsPool").textContent =
            money(needs);
    }


    if ($("wantsPool")) {

        $("wantsPool").textContent =
            money(wants);
    }


    if ($("savingsPool")) {

        $("savingsPool").textContent =
            money(savings);
    }


    if ($("poolTotal")) {

        $("poolTotal").textContent =
            money(
                totalRemaining
            );
    }


    setMoneyPoolBar(
        "needs",
        needs,
        moneyPoolBase.Needs
    );


    setMoneyPoolBar(
        "wants",
        wants,
        moneyPoolBase.Wants
    );


    setMoneyPoolBar(
        "total",
        totalRemaining,
        totalOriginal
    );
}


/* =========================================================
   CASH / CARD / BEEP
========================================================= */

function calculateWalletBalances() {

    const balances = {
        Cash: 0,
        Card: 0,
        Beep: 0
    };


    /* MONEY ENTERING */

    allowanceEntries.forEach(
        (entry) => {

            if (
                balances[entry.account] !==
                undefined
            ) {

                balances[entry.account] +=
                    Number(
                        entry.amount
                    ) || 0;
            }
        }
    );


    /* TRANSACTIONS */

    transactions.forEach(
        (transaction) => {

            if (
                balances[
                    transaction.payment
                ] !== undefined
            ) {

                balances[
                    transaction.payment
                ] -=
                    Number(
                        transaction.amount
                    ) || 0;
            }
        }
    );


    /* TRANSFERS */

    transfers.forEach(
        (transfer) => {

            const amount =
                Number(
                    transfer.amount
                ) || 0;

            if (
                balances[
                    transfer.from
                ] !== undefined
            ) {

                balances[
                    transfer.from
                ] -= amount;
            }

            if (
                balances[
                    transfer.to
                ] !== undefined
            ) {

                balances[
                    transfer.to
                ] += amount;
            }
        }
        
    );

        /* SAVINGS VAULT */

    savingsVaultEntries.forEach(
        (entry) => {

            const amount =
                Number(
                    entry.amount
                ) || 0;


            if (
                entry.type ===
                "deposit"
            ) {

                if (
                    balances[
                        entry.account
                    ] !== undefined
                ) {

                    balances[
                        entry.account
                    ] -= amount;
                }
            }


            if (
                entry.type ===
                "withdraw"
            ) {

                if (
                    balances[
                        entry.account
                    ] !== undefined
                ) {

                    balances[
                        entry.account
                    ] += amount;
                }
            }
        }
    );

    return balances;
}


function updateWalletBalances() {

    const balances =
        calculateWalletBalances();

    if ($("cashBalance")) {
        $("cashBalance").textContent =
            money(balances.Cash);
    }

    if ($("cardBalance")) {
        $("cardBalance").textContent =
            money(balances.Card);
    }

    if ($("beepBalance")) {
        $("beepBalance").textContent =
            money(balances.Beep);
    }
}


/* =========================================================
   EDIT DAY AVAILABLE MONEY
========================================================= */

function updateDailyAllocationAvailable() {

    if (!$("dashboardDate")) {
        return;
    }

    const date =
        $("dashboardDate").value;

    const needs =
        categoryAvailableForDay(
            "Needs",
            date
        );

    const wants =
        categoryAvailableForDay(
            "Wants",
            date
        );

    const savings =
        categoryAvailableForDay(
            "Savings",
            date
        );

    if ($("dailyNeedsAvailable")) {

        $("dailyNeedsAvailable").textContent =
            `Available: ${money(needs)}`;
    }

    if ($("dailyWantsAvailable")) {

        $("dailyWantsAvailable").textContent =
            `Available: ${money(wants)}`;
    }

    if ($("dailySavingsAvailable")) {

        $("dailySavingsAvailable").textContent =
            `Available: ${money(savings)}`;
    }
}


/* =========================================================
   DAILY ALLOCATION TOTAL
========================================================= */

function updateDailyAllocationTotal() {

    const needs =
        Number(
            $("dailyNeedsInput")?.value
        ) || 0;

    const wants =
        Number(
            $("dailyWantsInput")?.value
        ) || 0;


    const total =
        needs +
        wants;


    if (
        $("dailyAllocationTotal")
    ) {

        $("dailyAllocationTotal")
            .textContent =
                money(total);
    }


    if (
        $("dailyLimit")
    ) {

        $("dailyLimit").value =
            total;
    }
}
/* =========================================================
   SPENDING
========================================================= */

function spendingForDate(date) {

    return transactions
        .filter(
            (transaction) =>
                transaction.date === date
        )
        .reduce(
            (total, transaction) =>
                total +
                (
                    Number(
                        transaction.amount
                    ) || 0
                ),
            0
        );
}


/* =========================================================
   RESERVE / DEFICIT
========================================================= */

function allBudgetDatesBefore(
    targetDate
) {

    const dates = new Set();

    Object.keys(dailyPlans)
        .forEach((date) => {

            if (date < targetDate) {
                dates.add(date);
            }
        });

    transactions.forEach(
        (transaction) => {

            if (
                transaction.date <
                targetDate
            ) {

                dates.add(
                    transaction.date
                );
            }
        }
    );

    return [...dates].sort();
}


function calculateCarryBefore(
    targetDate
) {

    let carry = 0;

    allBudgetDatesBefore(
        targetDate
    ).forEach(
        (date) => {

            const base =
                getPlanBaseMoney(date);

            const spent =
                spendingForDate(date);

            carry =
                carry +
                base -
                spent;
        }
    );

    return carry;
}


function calculateDailyBudgetState(date) {

    const plan =
        dailyPlans[date] || {
            event: ""
        };

    const base =
        getPlanBaseMoney(date);

    const carryBefore =
        calculateCarryBefore(date);

    const rawAvailable =
        base +
        carryBefore;

    const usableToday =
        Math.max(
            0,
            rawAvailable
        );

    const spentToday =
        spendingForDate(date);

    const remainingToday =
        rawAvailable -
        spentToday;

    return {

        event:
            plan.event || "",

        base,

        carryBefore,

        rawAvailable,

        usableToday,

        spentToday,

        remainingToday,

        allocations:
            getPlanAllocations(date)
    };
}


/* =========================================================
   DAILY PROGRESS
========================================================= */

function setProgress(
    element,
    spent,
    available
) {

    if (!element) {
        return;
    }

    const safeAvailable =
        Math.max(
            0,
            Number(available) || 0
        );

    const safeSpent =
        Number(spent) || 0;

    let percentage = 0;

    if (safeAvailable > 0) {

        percentage =
            (
                safeSpent /
                safeAvailable
            ) * 100;
    }

    percentage =
        Math.max(
            0,
            Math.min(
                100,
                percentage
            )
        );

    element.style.width =
        `${percentage}%`;

    element.classList.toggle(
        "over",
        safeSpent >
        safeAvailable &&
        safeSpent > 0
    );
}


/* =========================================================
   TODAY'S BUDGET DASHBOARD
========================================================= */

function updateDailyDashboard() {

    if (!$("dashboardDate")) {
        return;
    }

    const date =
        $("dashboardDate").value;

    const state =
        calculateDailyBudgetState(date);

    if ($("eventTitle")) {

        $("eventTitle").textContent =
            state.event ||
            "No event set";
    }

    if ($("dailyAvailableBig")) {

        $("dailyAvailableBig").textContent =
            money(
                state.usableToday
            );
    }

    if ($("dailyAvailableText")) {

        if (
            state.rawAvailable < 0
        ) {

            $("dailyAvailableText").textContent =
                `${money(
                    state.rawAvailable
                )} deficit before today's spending`;

        } else {

            $("dailyAvailableText").textContent =
                `${money(
                    Math.max(
                        0,
                        state.remainingToday
                    )
                )} usable remaining today`;
        }
    }

    if ($("carryLabel")) {

        $("carryLabel").textContent =
            state.carryBefore < 0
                ? "⚠️ Previous Deficit"
                : "💰 Outflow Reserve";
    }

    if ($("outflowReserve")) {

        $("outflowReserve").textContent =
            signedMoney(
                state.carryBefore
            );
    }

    if ($("baseAllowance")) {

        $("baseAllowance").textContent =
            money(state.base);
    }

    if ($("reserveBreakdown")) {

        $("reserveBreakdown").textContent =
            signedMoney(
                state.carryBefore
            );
    }

    if ($("spentToday")) {

        $("spentToday").textContent =
            state.spentToday > 0
                ? `-${money(
                    state.spentToday
                )}`
                : money(0);
    }

    if ($("remainingToday")) {

        $("remainingToday").textContent =
            money(
                state.remainingToday
            );
    }

    if ($("dailySpentLabel")) {

        $("dailySpentLabel").textContent =
            `Spent ${money(
                state.spentToday
            )}`;
    }

    let percentage = 0;

    if (
        state.usableToday > 0
    ) {

        percentage =
            Math.round(
                (
                    state.spentToday /
                    state.usableToday
                ) * 100
            );
    }

    if ($("dailyPercentLabel")) {

        $("dailyPercentLabel").textContent =
            `${percentage}%`;
    }

    setProgress(
        $("dailyProgress"),
        state.spentToday,
        state.usableToday
    );
}


/* =========================================================
   HISTORY
========================================================= */

function renderHistory() {

    if (!$("dashboardDate")) {
        return;
    }

    const date =
        $("dashboardDate").value;

    const state =
        calculateDailyBudgetState(date);

    if ($("historyEventName")) {

        $("historyEventName").textContent =
            state.event ||
            "No event";
    }

    if ($("historyBaseMoney")) {

        $("historyBaseMoney").textContent =
            money(state.base);
    }

    if ($("historyReserve")) {

        $("historyReserve").textContent =
            signedMoney(
                state.carryBefore
            );
    }

    const list =
        $("transactionList");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    const rows = [

        ...transactions
            .filter(
                (transaction) =>
                    transaction.date === date
            )
            .map(
                (item) => ({
                    type: "transaction",
                    time: item.id,
                    item
                })
            ),

        ...transfers
            .filter(
                (transfer) =>
                    transfer.date === date
            )
            .map(
                (item) => ({
                    type: "transfer",
                    time: item.id,
                    item
                })
            ),

        ...allowanceEntries
            .filter(
                (allowance) =>
                    allowance.date === date
            )
            .map(
                (item) => ({
                    type: "allowance",
                    time: item.id,
                    item
                })
            )

    ].sort(
        (a, b) =>
            b.time -
            a.time
    );

    if (rows.length === 0) {

        list.innerHTML = `
            <p class="empty">
                No transactions for this date.
            </p>
        `;
    }

    rows.forEach(
        (row) => {

            const wrapper =
                document.createElement(
                    "div"
                );

            wrapper.className =
                "transaction-item";

            const info =
                document.createElement(
                    "div"
                );

            info.className =
                "info";

            const actions =
                document.createElement(
                    "div"
                );

            actions.className =
                "item-actions";

            const amountText =
                document.createElement(
                    "strong"
                );

            const deleteButton =
                document.createElement(
                    "button"
                );

            deleteButton.className =
                "delete-btn";

            deleteButton.textContent =
                "Delete";


            if (
                row.type ===
                "transaction"
            ) {

                info.innerHTML = `
                    <strong>
                        ${escapeHtml(
                            row.item.description
                        )}
                    </strong>

                    <span>
                        ${escapeHtml(
                            row.item.category
                        )}

                        • ${escapeHtml(
                            row.item.payment
                        )}
                    </span>
                `;

                amountText.textContent =
                    money(
                        row.item.amount
                    );

                deleteButton.addEventListener(
                    "click",
                    () =>
                        deleteTransaction(
                            row.item.id
                        )
                );
            }


            if (
                row.type ===
                "transfer"
            ) {

                info.innerHTML = `
                    <strong>
                        🔄 Money Transfer
                    </strong>

                    <span>
                        ${escapeHtml(
                            row.item.from
                        )}
                        →
                        ${escapeHtml(
                            row.item.to
                        )}
                    </span>
                `;

                amountText.textContent =
                    money(
                        row.item.amount
                    );

                deleteButton.addEventListener(
                    "click",
                    () =>
                        deleteTransfer(
                            row.item.id
                        )
                );
            }


            if (
                row.type ===
                "allowance"
            ) {

                info.innerHTML = `
                    <strong>
                        💰 Allowance Added
                    </strong>

                    <span>
                        Added to
                        ${escapeHtml(
                            row.item.account
                        )}
                    </span>
                `;

                amountText.textContent =
                    `+${money(
                        row.item.amount
                    )}`;

                deleteButton.addEventListener(
                    "click",
                    () =>
                        deleteAllowance(
                            row.item.id
                        )
                );
            }

            actions.append(
                amountText,
                deleteButton
            );

            wrapper.append(
                info,
                actions
            );

            list.appendChild(
                wrapper
            );
        }
    );

    if ($("dailyTotal")) {

        $("dailyTotal").textContent =
            money(
                spendingForDate(date)
            );
    }
}


/* =========================================================
   GENERIC LIST
========================================================= */

function makeListItem(
    title,
    subtitle,
    amount,
    deleteHandler
) {

    const item =
        document.createElement(
            "div"
        );

    item.className =
        "list-item";

    const info =
        document.createElement(
            "div"
        );

    info.className =
        "info";

    info.innerHTML = `
        <strong>
            ${escapeHtml(title)}
        </strong>

        <span>
            ${escapeHtml(subtitle)}
        </span>
    `;

    const actions =
        document.createElement(
            "div"
        );

    actions.className =
        "item-actions";

    const value =
        document.createElement(
            "strong"
        );

    value.textContent =
        amount;

    const remove =
        document.createElement(
            "button"
        );

    remove.className =
        "delete-btn";

    remove.textContent =
        "Delete";

    remove.addEventListener(
        "click",
        deleteHandler
    );

    actions.append(
        value,
        remove
    );

    item.append(
        info,
        actions
    );

    return item;
}


/* =========================================================
   ALLOWANCE LIST
========================================================= */

function renderAllowanceList() {

    const list =
        $("allowanceList");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    const sorted =
        [...allowanceEntries]
            .sort(
                (a, b) =>
                    b.id -
                    a.id
            )
            .slice(0, 10);

    if (
        sorted.length === 0
    ) {

        list.innerHTML = `
            <p class="empty">
                No allowance entries yet.
            </p>
        `;

        return;
    }

    sorted.forEach(
        (entry) => {

            list.appendChild(
                makeListItem(

                    `Allowance → ${entry.account}`,

                    entry.date,

                    money(entry.amount),

                    () =>
                        deleteAllowance(
                            entry.id
                        )
                )
            );
        }
    );
}


/* =========================================================
   TRANSFER LIST
========================================================= */

function renderTransferList() {

    const list =
        $("transferList");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    const sorted =
        [...transfers]
            .sort(
                (a, b) =>
                    b.id -
                    a.id
            )
            .slice(0, 10);

    if (
        sorted.length === 0
    ) {

        list.innerHTML = `
            <p class="empty">
                No transfers yet.
            </p>
        `;

        return;
    }

    sorted.forEach(
        (entry) => {

            list.appendChild(
                makeListItem(

                    `${entry.from} → ${entry.to}`,

                    entry.date,

                    money(entry.amount),

                    () =>
                        deleteTransfer(
                            entry.id
                        )
                )
            );
        }
    );
}


/* =========================================================
   UTANG
========================================================= */

function renderDebts() {

    const list =
        $("debtList");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    const totalDebt =
        debts.reduce(
            (total, debt) =>
                total +
                (
                    Number(
                        debt.amount
                    ) || 0
                ),
            0
        );

    if ($("debtBalance")) {

        $("debtBalance").textContent =
            money(totalDebt);
    }

    if (
        debts.length === 0
    ) {

        list.innerHTML = `
            <p class="empty">
                No utang recorded.
            </p>
        `;

        return;
    }

    [...debts]
        .sort(
            (a, b) =>
                b.id -
                a.id
        )
        .forEach(
            (debt) => {

                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "list-item";

                const info =
                    document.createElement(
                        "div"
                    );

                info.className =
                    "info";

                info.innerHTML = `
                    <strong>
                        ${escapeHtml(
                            debt.name
                        )}
                    </strong>

                    <span>
                        Owes you
                    </span>
                `;

                const actions =
                    document.createElement(
                        "div"
                    );

                actions.className =
                    "item-actions";

                const value =
                    document.createElement(
                        "strong"
                    );

                value.textContent =
                    money(debt.amount);

                const editButton =
                    document.createElement(
                        "button"
                    );

                editButton.className =
                    "edit-btn";

                editButton.textContent =
                    "Edit";

                editButton.addEventListener(
                    "click",
                    () =>
                        editDebt(
                            debt.id
                        )
                );

                const deleteButton =
                    document.createElement(
                        "button"
                    );

                deleteButton.className =
                    "delete-btn";

                deleteButton.textContent =
                    "Delete";

                deleteButton.addEventListener(
                    "click",
                    () =>
                        deleteDebt(
                            debt.id
                        )
                );

                actions.append(
                    value,
                    editButton,
                    deleteButton
                );

                item.append(
                    info,
                    actions
                );

                list.appendChild(
                    item
                );
            }
        );
}


/* =========================================================
   SHARED DATE + QUICK PRESETS
========================================================= */

function syncDailyDate(date) {

    if (!date) {
        return;
    }

    if ($("dashboardDate")) {
        $("dashboardDate").value = date;
    }

    if ($("historySharedDate")) {

        const d =
            new Date(
                date + "T00:00:00"
            );

        $("historySharedDate").textContent =
            d.toLocaleDateString(
                "en-PH",
                {
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                }
            );
    }

    updateDailyAllocationAvailable();
    updateDailyDashboard();
    renderHistory();
}


function renderPresets() {

    const grid =
        $("presetGrid");

    if (!grid) {
        return;
    }

    grid.innerHTML = "";

    if (!budgetPresets.length) {

        grid.innerHTML = `
            <p class="empty">
                No presets yet. Add Eggs, Gym, School, etc.
            </p>
        `;

        return;
    }

    budgetPresets
    .filter(
        (preset) =>
            preset.category !==
            "Savings"
    )
    .forEach(
        (preset) => {

            const btn =
                document.createElement(
                    "button"
                );

            btn.type = "button";

            btn.className =
                "preset-chip";

            btn.dataset.presetId =
                preset.id;

            btn.innerHTML = `
                <span class="preset-dot"></span>

                <span>
                    ${escapeHtml(
                        preset.name
                    )}
                </span>

                <b>
                    ${money(
                        preset.amount
                    )}
                </b>
            `;

            btn.addEventListener(
                "click",
                () =>
                    togglePreset(
                        preset,
                        btn
                    )
            );

            grid.appendChild(btn);
        }
    );
}


function togglePreset(
    preset,
    button
) {

    const inputId =
        preset.category === "Needs"
            ? "dailyNeedsInput"
            : preset.category === "Wants"
                ? "dailyWantsInput"
                : "dailySavingsInput";

    const input =
        $(inputId);

    if (!input) {
        return;
    }

    const amount =
        Number(
            preset.amount
        ) || 0;

    const selected =
        button.classList.toggle(
            "selected"
        );

    input.value =
        Math.max(
            0,
            (Number(input.value) || 0) +
            (
                selected
                    ? amount
                    : -amount
            )
        );

    updateDailyAllocationTotal();
}


async function savePreset() {

    const name =
        $("presetName")
            ?.value
            .trim();

    const amount =
        Number(
            $("presetAmount")
                ?.value
        );

    const category =
        $("presetCategory")
            ?.value;

        if (
        category ===
        "Savings"
    ) {

        alert(
            "Use Savings Vault for savings."
        );

        return;
    }

    if (
        !name ||
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        alert(
            "Enter a preset name and valid amount."
        );

        return;
    }

    budgetPresets.push({
        id: uid(),
        name,
        amount,
        category
    });

    $("presetName").value = "";
    $("presetAmount").value = "";

    await saveData();

    renderPresets();
}


/* =========================================================
   ADD TRANSACTION
========================================================= */

async function addTransaction() {

    const date =
        $("dashboardDate").value;

    const description =
        $("description")
            .value
            .trim();

    const amount =
        Number(
            $("amount").value
        );

    const payment =
        $("paymentMethod").value;

    if (
        !date ||
        !description ||
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        alert(
            "Please complete the transaction details and enter a valid amount."
        );

        return;
    }


    const wallet =
        calculateWalletBalances();

    const walletConfigured =
        wallet.Cash !== 0 ||
        wallet.Card !== 0 ||
        wallet.Beep !== 0 ||
        allowanceEntries.length > 0;


    if (
        walletConfigured &&
        wallet[payment] !== undefined &&
        amount > wallet[payment]
    ) {

        const continueAnyway =
            confirm(
                `${payment} only has ${money(
                    wallet[payment]
                )} remaining.\n\nContinue anyway?`
            );

        if (!continueAnyway) {
            return;
        }
    }


    transactions.push({

        id: uid(),

        date,

        description,

        amount,

        category:
            selectedCategory,

        payment
    });


    $("description").value = "";

    $("amount").value = "";


    await saveData();

    refreshAll();
}


/* =========================================================
   SAVE MONEY SPLIT
========================================================= */

async function saveMoneyPool() {

    const needsRemaining =
        Number(
            $("needsMoneyInput").value
        );

    const wantsRemaining =
        Number(
            $("wantsMoneyInput").value
        );


    if (
        [
            needsRemaining,
            wantsRemaining
        ].some(
            (value) =>
                !Number.isFinite(value) ||
                value < 0
        )
    ) {

        alert(
            "Enter valid money amounts for Needs and Wants."
        );

        return;
    }


    /*
        Keep legacy Savings data untouched.
        New Savings is handled only by Savings Vault.
    */

    moneyPoolBase = {

        Needs:
            needsRemaining +
            categoryAllocated(
                "Needs"
            ),

        Wants:
            wantsRemaining +
            categoryAllocated(
                "Wants"
            ),

        Savings:
            Number(
                moneyPoolBase.Savings
            ) || 0
    };


    await saveData();

    closeModal();

    refreshAll();
}


/* =========================================================
   SAVE DAILY PLAN
========================================================= */

async function saveDailyPlan() {

    const date =
        $("dashboardDate").value;

    const event =
        $("eventName")
            .value
            .trim();

    const needs =
        Number(
            $("dailyNeedsInput").value
        ) || 0;

    const wants =
        Number(
            $("dailyWantsInput").value
        ) || 0;


    if (
        [
            needs,
            wants
        ].some(
            (amount) =>
                !Number.isFinite(amount) ||
                amount < 0
        )
    ) {

        alert(
            "Daily allocations cannot be negative."
        );

        return;
    }


    const availableNeeds =
        categoryAvailableForDay(
            "Needs",
            date
        );

    const availableWants =
        categoryAvailableForDay(
            "Wants",
            date
        );


    if (
        needs >
        availableNeeds
    ) {

        alert(
            `Not enough Needs money.\n\nAvailable: ${money(
                availableNeeds
            )}`
        );

        return;
    }


    if (
        wants >
        availableWants
    ) {

        alert(
            `Not enough Wants money.\n\nAvailable: ${money(
                availableWants
            )}`
        );

        return;
    }


    /*
        Preserve old Savings allocation for an existing day.
        New days get zero legacy Savings.
    */

    const oldSavings =
        Number(
            dailyPlans[
                date
            ]?.allocations?.Savings
        ) || 0;


    const total =
        needs +
        wants +
        oldSavings;


    dailyPlans[date] = {

        event,

        limit:
            total,

        allocations: {

            Needs:
                needs,

            Wants:
                wants,

            Savings:
                oldSavings
        }
    };


    await saveData();

    closeModal();

    refreshAll();
}


/* =========================================================
   ADD ALLOWANCE
========================================================= */

async function addAllowance() {

    const date =
        $("allowanceDate").value;

    const account =
        $("allowanceAccount").value;

    const amount =
        Number(
            $("allowanceAmount").value
        );

    if (
        !date ||
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        alert(
            "Enter a valid allowance amount."
        );

        return;
    }


    allowanceEntries.push({

        id: uid(),

        date,

        account,

        amount
    });


    $("allowanceAmount").value =
        "";


    await saveData();

    refreshAll();
}


/* =========================================================
   TRANSFER
========================================================= */

async function addTransfer() {

    const date =
        $("transferDate").value;

    const from =
        $("transferFrom").value;

    const to =
        $("transferTo").value;

    const amount =
        Number(
            $("transferAmount").value
        );

    if (
        !date ||
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        alert(
            "Enter a valid transfer amount."
        );

        return;
    }


    if (
        from === to
    ) {

        alert(
            "Choose two different accounts."
        );

        return;
    }


    const balances =
        calculateWalletBalances();


    if (
        amount >
        balances[from]
    ) {

        alert(
            `Not enough ${from} balance.\n\nAvailable: ${money(
                balances[from]
            )}`
        );

        return;
    }


    transfers.push({

        id: uid(),

        date,

        from,

        to,

        amount
    });


    $("transferAmount").value =
        "";


    await saveData();

    refreshAll();
}


/* =========================================================
   UTANG
========================================================= */

async function addDebt() {

    const name =
        $("debtName")
            .value
            .trim();

    const amount =
        Number(
            $("debtAmount").value
        );

    if (
        !name ||
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        alert(
            "Enter a name and valid amount."
        );

        return;
    }


    debts.push({

        id: uid(),

        name,

        amount
    });


    $("debtName").value = "";
    $("debtAmount").value = "";


    await saveData();

    renderDebts();

    renderPresets();

    if (
        $("historySharedDate") &&
        $("dashboardDate")
    ) {
        syncDailyDate(
            $("dashboardDate").value
        );
    }
}


async function editDebt(id) {

    const debt =
        debts.find(
            (item) =>
                item.id === id
        );
    if (!debt) {
        return;
    }

    const newName =
        prompt(
            "Name:",
            debt.name
        );

    if (newName === null) {
        return;
    }

    const newAmount =
        prompt(
            "Amount:",
            debt.amount
        );

    if (newAmount === null) {
        return;
    }

    const parsedAmount =
        Number(newAmount);

    if (
        !newName.trim() ||
        !Number.isFinite(parsedAmount) ||
        parsedAmount <= 0
    ) {

        alert(
            "Enter a valid name and amount."
        );

        return;
    }

    debt.name =
        newName.trim();

    debt.amount =
        parsedAmount;

    await saveData();

    renderDebts();
}


/* =========================================================
   DELETE FUNCTIONS
========================================================= */

async function deleteTransaction(id) {

    const confirmed =
        confirm(
            "Delete this transaction?"
        );

    if (!confirmed) {
        return;
    }

    transactions =
        transactions.filter(
            (item) =>
                item.id !== id
        );

    await saveData();

    refreshAll();
}


async function deleteTransfer(id) {

    const confirmed =
        confirm(
            "Delete this transfer?"
        );

    if (!confirmed) {
        return;
    }

    transfers =
        transfers.filter(
            (item) =>
                item.id !== id
        );

    await saveData();

    refreshAll();
}


async function deleteAllowance(id) {

    const confirmed =
        confirm(
            "Delete this allowance entry?"
        );

    if (!confirmed) {
        return;
    }

    allowanceEntries =
        allowanceEntries.filter(
            (item) =>
                item.id !== id
        );

    await saveData();

    refreshAll();
}


async function deleteDebt(id) {

    const confirmed =
        confirm(
            "Delete this utang?"
        );

    if (!confirmed) {
        return;
    }

    debts =
        debts.filter(
            (item) =>
                item.id !== id
        );

    await saveData();

    renderDebts();
}


/* =========================================================
   FIREBASE SAVE
========================================================= */

async function saveData() {

    const data = {

    transactions,

    transfers,

    debts,

    allowanceEntries,

    dailyPlans,

    moneyPoolBase,

    budgetPresets,

    savingsVaultEntries
};


    /* LOCAL BACKUP */

    try {

        const backupKey =
    auth.currentUser
        ? `budgetTrackerBackup_${auth.currentUser.uid}`
        : null;

if (backupKey) {

    localStorage.setItem(
        backupKey,
        JSON.stringify(data)
    );
}

    } catch (error) {

        console.warn(
            "Could not save local backup:",
            error
        );
    }


    /* FIREBASE */

    try {

        await setDoc(
            budgetDoc,
            data
        );

        if ($("syncStatus")) {

            $("syncStatus").textContent =
                "✓ Synced with Firebase";
        }

    } catch (error) {

        console.error(
            "Firebase save error:",
            error
        );

        if ($("syncStatus")) {

            $("syncStatus").textContent =
                "⚠ Local mode — Firebase unavailable";
        }
    }
}


/* =========================================================
   LOAD LOCAL BACKUP
========================================================= */

function loadLocalBackup() {

    try {

        const backupKey =
    auth.currentUser
        ? `budgetTrackerBackup_${auth.currentUser.uid}`
        : null;

if (!backupKey) {
    return false;
}

const stored =
    localStorage.getItem(
        backupKey
    );

        if (!stored) {
            return false;
        }

        const data =
            JSON.parse(stored);


        transactions =
            safeArray(
                data.transactions
            );


        transfers =
            safeArray(
                data.transfers
            );


        debts =
            safeArray(
                data.debts
            );


        allowanceEntries =
            safeArray(
                data.allowanceEntries
            );


        dailyPlans =
            data.dailyPlans &&
            typeof data.dailyPlans ===
                "object"

                ? data.dailyPlans

                : {};


        moneyPoolBase = {

            Needs:
                Number(
                    data.moneyPoolBase
                        ?.Needs
                ) || 0,

            Wants:
                Number(
                    data.moneyPoolBase
                        ?.Wants
                ) || 0,

            Savings:
                Number(
                    data.moneyPoolBase
                        ?.Savings
                ) || 0
        };


        budgetPresets =
            safeArray(
                data.budgetPresets
            );

                savingsVaultEntries =
            safeArray(
                data.savingsVaultEntries
            );


        return true;

    } catch (error) {

        console.error(
            "Local backup load error:",
            error
        );

        return false;
    }
}


/* =========================================================
   FIREBASE LOAD
========================================================= */

async function loadData() {

    let firebaseLoaded =
        false;


    try {

        if ($("syncStatus")) {

            $("syncStatus").textContent =
                "Connecting to Firebase...";
        }


        const snapshot =
            await getDoc(
                budgetDoc
            );


        if (
            snapshot.exists()
        ) {

            const data =
                snapshot.data();


            transactions =
                safeArray(
                    data.transactions
                );


            transfers =
                safeArray(
                    data.transfers
                );


            debts =
                safeArray(
                    data.debts
                );


            allowanceEntries =
                safeArray(
                    data.allowanceEntries
                );


            dailyPlans =
                data.dailyPlans &&
                typeof data.dailyPlans ===
                    "object"

                    ? data.dailyPlans

                    : {};


            moneyPoolBase = {

                Needs:
                    Number(
                        data.moneyPoolBase
                            ?.Needs
                    ) || 0,

                Wants:
                    Number(
                        data.moneyPoolBase
                            ?.Wants
                    ) || 0,

                Savings:
                    Number(
                        data.moneyPoolBase
                            ?.Savings
                    ) || 0
            };


            budgetPresets =
                safeArray(
                    data.budgetPresets
                );

            savingsVaultEntries =
                safeArray(
                    data.savingsVaultEntries
                );


            firebaseLoaded =
                true;


            if ($("syncStatus")) {

                $("syncStatus").textContent =
                    "✓ Synced with Firebase";
            }

        } else {

            if ($("syncStatus")) {

                $("syncStatus").textContent =
                    "✓ Firebase connected";
            }
        }

    } catch (error) {

        console.error(
            "Firebase load error:",
            error
        );

        if ($("syncStatus")) {

            $("syncStatus").textContent =
                "⚠ Firebase unavailable — checking local backup";
        }
    }


    if (!firebaseLoaded) {

        const localLoaded =
            loadLocalBackup();


        if (
            localLoaded &&
            $("syncStatus")
        ) {

            $("syncStatus").textContent =
                "⚠ Loaded local backup";
        }
    }


    refreshAll();
}


/* =========================================================
   REFRESH EVERYTHING
========================================================= */

function refreshAll() {

    updateMoneyDashboard();

    updateWalletBalances();

    updateDailyAllocationAvailable();

    updateDailyDashboard();

    renderHistory();

    renderAllowanceList();

    renderTransferList();

    renderDebts();

    renderPresets();

    updateHudMoney();
}


/* =========================================================
   HUD MONEY
========================================================= */

function updateHudMoney() {

    const balances =
        calculateWalletBalances();

    const needs =
        categoryRemaining("Needs");

    const wants =
        categoryRemaining("Wants");

    const savings =
    getSavingsVaultBalance();

const total =
    needs +
    wants;


    if ($("hudTotalMoney")) {

        $("hudTotalMoney").textContent =
            money(total);
    }


    if ($("hudCashBalance")) {

        $("hudCashBalance").textContent =
            money(balances.Cash);
    }


    if ($("hudCardBalance")) {

        $("hudCardBalance").textContent =
            money(balances.Card);
    }


    if ($("hudBeepBalance")) {

        $("hudBeepBalance").textContent =
            money(balances.Beep);
    }


    if ($("hudNeedsBalance")) {

        $("hudNeedsBalance").textContent =
            money(needs);
    }


    if ($("hudWantsBalance")) {

        $("hudWantsBalance").textContent =
            money(wants);
    }


    if ($("hudSavingsBalance")) {

        $("hudSavingsBalance").textContent =
            money(savings);
    }
}


/* =========================================================
   MODALS
========================================================= */

function closeModal() {

    const backdrop =
        $("modalBackdrop");

    if (!backdrop) {
        return;
    }


    backdrop.classList.add(
        "hidden"
    );


    document
        .querySelectorAll(
            "[data-modal-panel]"
        )
        .forEach(
            (panel) => {

                panel.classList.add(
                    "hidden"
                );
            }
        );
}


function openModal(panelId) {

    const backdrop =
        $("modalBackdrop");

    const panel =
        $(panelId);


    if (
        !backdrop ||
        !panel
    ) {
        return;
    }


    document
        .querySelectorAll(
            "[data-modal-panel]"
        )
        .forEach(
            (item) => {

                item.classList.add(
                    "hidden"
                );
            }
        );


    panel.classList.remove(
        "hidden"
    );


    backdrop.classList.remove(
        "hidden"
    );
}


/* =========================================================
   OPEN DAILY PLAN
========================================================= */

function openDailyPlan() {

    const date =
        $("dashboardDate").value;


    const plan =
        dailyPlans[date] || {};


    const allocations =
        getPlanAllocations(
            date
        );


    $("eventName").value =
        plan.event || "";


    $("dailyNeedsInput").value =
        allocations.Needs;


    $("dailyWantsInput").value =
        allocations.Wants;


    $("dailySavingsInput").value =
        allocations.Savings;


    document
        .querySelectorAll(
            ".preset-chip"
        )
        .forEach(
            (button) => {

                button.classList.remove(
                    "selected"
                );
            }
        );


    updateDailyAllocationAvailable();

    updateDailyAllocationTotal();

    openModal(
        "dailyPlanPanel"
    );
}


/* =========================================================
   OPEN MONEY SPLIT
========================================================= */

function openMoneyPool() {

    $("needsMoneyInput").value =
        Math.max(
            0,
            categoryRemaining(
                "Needs"
            )
        );


    $("wantsMoneyInput").value =
        Math.max(
            0,
            categoryRemaining(
                "Wants"
            )
        );


    $("savingsMoneyInput").value =
        Math.max(
            0,
            categoryRemaining(
                "Savings"
            )
        );


    openModal(
        "moneyPoolPanel"
    );
}


/* =========================================================
   MASTER DATE
========================================================= */

function changeMasterDate(
    amount
) {

    const current =
        $("dashboardDate").value ||
        getToday();


    const next =
        shiftDate(
            current,
            amount
        );


    syncDailyDate(
        next
    );
}


/* =========================================================
   CATEGORY BUTTONS
========================================================= */

function selectCategory(
    category
) {

    selectedCategory =
        category;


    document
        .querySelectorAll(
            ".choice"
        )
        .forEach(
            (button) => {

                button.classList.toggle(
                    "selected",
                    button.dataset.category ===
                        category
                );
            }
        );
}


/* =========================================================
   INITIAL DATES
========================================================= */

function setInitialDates() {

    const today =
        getToday();


    if ($("dashboardDate")) {

        $("dashboardDate").value =
            today;
    }


    if ($("allowanceDate")) {

        $("allowanceDate").value =
            today;
    }


    if ($("transferDate")) {

        $("transferDate").value =
            today;
    }


    syncDailyDate(
        today
    );
}

/* =========================================================
   QUICK BUDGET PRESET STORAGE
========================================================= */

/*
    Declared here because all functions above only USE this
    variable when the app actually starts running.
*/

let budgetPresets = [];


/* =========================================================
   OPEN PRESET / DAILY PLAN CORRECTLY
========================================================= */

function resetPresetSelections() {

    document
        .querySelectorAll(
            ".preset-chip"
        )
        .forEach(
            (button) => {

                button.classList.remove(
                    "selected"
                );
            }
        );
}


/* =========================================================
   HUD EXPAND / COLLAPSE
========================================================= */

function toggleHudMoney() {

    const card =
        $("hudMoneyCard");

    if (!card) {
        return;
    }


    const expanded =
        card.classList.toggle(
            "expanded"
        );


    card.setAttribute(
        "aria-expanded",
        String(expanded)
    );


    const helper =
        card.querySelector(
            "small"
        );

    if (helper) {

        helper.textContent =
            expanded
                ? "Tap to collapse"
                : "Tap to expand";
    }
}


/* =========================================================
   PRESET MANAGER
========================================================= */

function togglePresetManager() {

    const manager =
        $("presetManager");

    if (!manager) {
        return;
    }


    manager.classList.toggle(
        "hidden"
    );
}


/* =========================================================
   SIDEBAR MODAL BUTTONS
========================================================= */

function bindSidebarButtons() {

    document
        .querySelectorAll(
            ".nav-btn[data-panel]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        document
                            .querySelectorAll(
                                ".nav-btn"
                            )
                            .forEach(
                                (item) => {

                                    item.classList.remove(
                                        "active"
                                    );
                                }
                            );


                        button.classList.add(
                            "active"
                        );


                        const panelId =
                            button.dataset.panel;


                        if (
                            panelId ===
                            "moneyPoolPanel"
                        ) {

                            openMoneyPool();

                            return;
                        }


                        openModal(
                            panelId
                        );
                    }
                );
            }
        );
}


/* =========================================================
   CATEGORY BUTTONS
========================================================= */

function bindCategoryButtons() {

    document
        .querySelectorAll(
            ".choice[data-category]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        selectCategory(
                            button.dataset.category
                        );
                    }
                );
            }
        );
}


/* =========================================================
   MODAL EVENTS
========================================================= */

function bindModalEvents() {

    document
        .querySelectorAll(
            ".close-modal"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    closeModal
                );
            }
        );


    if ($("modalBackdrop")) {

        $("modalBackdrop")
            .addEventListener(
                "click",
                (event) => {

                    if (
                        event.target ===
                        $("modalBackdrop")
                    ) {

                        closeModal();
                    }
                }
            );
    }


    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key ===
                "Escape"
            ) {

                closeModal();
            }
        }
    );
}


/* =========================================================
   MASTER DATE EVENTS
========================================================= */

function bindMasterDateEvents() {

    if ($("dashboardDate")) {

        $("dashboardDate")
            .addEventListener(
                "change",
                () => {

                    syncDailyDate(
                        $("dashboardDate").value
                    );
                }
            );
    }


    if ($("dashboardPreviousDate")) {

        $("dashboardPreviousDate")
            .addEventListener(
                "click",
                () => {

                    changeMasterDate(
                        -1
                    );
                }
            );
    }


    if ($("dashboardNextDate")) {

        $("dashboardNextDate")
            .addEventListener(
                "click",
                () => {

                    changeMasterDate(
                        1
                    );
                }
            );
    }
}


/* =========================================================
   DAILY PLAN EVENTS
========================================================= */

function bindDailyPlanEvents() {

    if ($("editDailyPlanBtn")) {

        $("editDailyPlanBtn")
            .addEventListener(
                "click",
                openDailyPlan
            );
    }


    if ($("saveDailyPlanBtn")) {

        $("saveDailyPlanBtn")
            .addEventListener(
                "click",
                saveDailyPlan
            );
    }


    [
        "dailyNeedsInput",
        "dailyWantsInput",
        "dailySavingsInput"
    ].forEach(
        (id) => {

            const input =
                $(id);

            if (!input) {
                return;
            }


            input.addEventListener(
                "input",
                () => {

                    /*
                        Manual editing means preset buttons
                        may no longer exactly represent the
                        input amount, so remove selected state.
                    */

                    resetPresetSelections();

                    updateDailyAllocationTotal();
                }
            );
        }
    );


    if ($("togglePresetManagerBtn")) {

        $("togglePresetManagerBtn")
            .addEventListener(
                "click",
                togglePresetManager
            );
    }


    if ($("savePresetBtn")) {

        $("savePresetBtn")
            .addEventListener(
                "click",
                savePreset
            );
    }
}


/* =========================================================
   MONEY + TRANSACTION EVENTS
========================================================= */

function bindMoneyEvents() {

    if ($("hudMoneyCard")) {

        $("hudMoneyCard")
            .addEventListener(
                "click",
                toggleHudMoney
            );
    }


    if ($("saveMoneyPoolBtn")) {

        $("saveMoneyPoolBtn")
            .addEventListener(
                "click",
                saveMoneyPool
            );
    }


    if ($("addTransactionBtn")) {

        $("addTransactionBtn")
            .addEventListener(
                "click",
                addTransaction
            );
    }


    if ($("addAllowanceBtn")) {

        $("addAllowanceBtn")
            .addEventListener(
                "click",
                addAllowance
            );
    }


    if ($("transferMoneyBtn")) {

        $("transferMoneyBtn")
            .addEventListener(
                "click",
                addTransfer
            );
    }


    if ($("addDebtBtn")) {

        $("addDebtBtn")
            .addEventListener(
                "click",
                addDebt
            );
    }
}


/* =========================================================
   ENTER KEY QUALITY OF LIFE
========================================================= */

function bindEnterKeys() {

    if ($("description")) {

        $("description")
            .addEventListener(
                "keydown",
                (event) => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        $("amount")
                            ?.focus();
                    }
                }
            );
    }


    if ($("amount")) {

        $("amount")
            .addEventListener(
                "keydown",
                (event) => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        addTransaction();
                    }
                }
            );
    }


    if ($("presetName")) {

        $("presetName")
            .addEventListener(
                "keydown",
                (event) => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        $("presetAmount")
                            ?.focus();
                    }
                }
            );
    }


    if ($("presetAmount")) {

        $("presetAmount")
            .addEventListener(
                "keydown",
                (event) => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        savePreset();
                    }
                }
            );
    }
}


/* =========================================================
   BIND EVERYTHING
========================================================= */

function bindEvents() {

    bindSidebarButtons();

    bindCategoryButtons();

    bindModalEvents();

    bindMasterDateEvents();

    bindDailyPlanEvents();

    bindMoneyEvents();

    bindEnterKeys();
}


/* =========================================================
   DEFAULT PRESETS
========================================================= */

function createStarterPresetsIfNeeded() {

    if (
        budgetPresets.length >
        0
    ) {

        return;
    }


    /*
        Start EMPTY intentionally.

        This means the app will not force Eggs/Gym/etc.
        into the user's data.

        Presets are created manually through:
        + Manage Presets
    */
}


/* =========================================================
   APP INITIALIZATION
========================================================= */

async function startApp() {

    /*
        1. Set today's dates first so the interface
           never starts with an empty master date.
    */

    setInitialDates();


    /*
        2. Select Needs as the default transaction
           category.
    */

    selectCategory(
        "Needs"
    );


    /*
        3. Attach all button/input events.
    */

    bindEvents();


    /*
        4. Load Firebase data.
    */

    await loadData();


    /*
        5. Presets come from Firebase/local data.
    */

    createStarterPresetsIfNeeded();


    /*
        6. Make sure every part of the UI reflects
           the loaded data.
    */

    refreshAll();


    /*
        7. Re-sync the shared selected date after
           Firebase has finished loading.
    */

    syncDailyDate(
        $("dashboardDate")?.value ||
        getToday()
    );


    /*
        8. Final HUD refresh.
    */

    updateHudMoney();
}


/* =========================================================
   AUTH UI
========================================================= */

function createAuthScreen() {

    if (
        document.getElementById(
            "authScreen"
        )
    ) {
        return;
    }


    const authScreen =
        document.createElement(
            "div"
        );

    authScreen.id =
        "authScreen";


    authScreen.innerHTML = `
        <div class="auth-card">

            <div class="auth-logo">
                💰
            </div>

            <h1>
                Budget Tracker
            </h1>

            <p class="auth-subtitle">
                Sign in to access your personal budget.
            </p>


            <div class="auth-tabs">

                <button
                    type="button"
                    id="showLoginBtn"
                    class="auth-tab active"
                >
                    Login
                </button>

                <button
                    type="button"
                    id="showRegisterBtn"
                    class="auth-tab"
                >
                    Register
                </button>

            </div>


            <div
                id="registerNameWrap"
                style="display:none;"
            >
                <label>
                    Name
                </label>

                <input
                    type="text"
                    id="authName"
                    placeholder="Ray Romel"
                    autocomplete="name"
                >
            </div>


            <label>
                Email
            </label>

            <input
                type="email"
                id="authEmail"
                placeholder="you@example.com"
                autocomplete="email"
            >


            <label>
                Password
            </label>

            <input
                type="password"
                id="authPassword"
                placeholder="••••••••"
                autocomplete="current-password"
            >


            <button
                type="button"
                id="authMainBtn"
                class="auth-main-btn"
            >
                Login
            </button>


            <div class="auth-divider">
                <span>or</span>
            </div>


            <button
                type="button"
                id="googleLoginBtn"
                class="google-auth-btn"
            >
                <span class="google-g">
                    G
                </span>

                Continue with Google
            </button>


            <p
                id="authMessage"
                class="auth-message"
            ></p>

        </div>
    `;


    document.body.appendChild(
        authScreen
    );


    const style =
        document.createElement(
            "style"
        );

    style.id =
        "authScreenStyles";


    style.textContent = `
        #authScreen {
            position: fixed;
            inset: 0;
            z-index: 999999;

            display: flex;
            align-items: center;
            justify-content: center;

            padding: 24px;

            background:
                linear-gradient(
                    135deg,
                    #0f172a,
                    #111827
                );

            font-family:
                inherit;
        }


        .auth-card {
            width: 100%;
            max-width: 390px;

            padding: 34px;

            border-radius: 24px;

            background:
                rgba(
                    255,
                    255,
                    255,
                    0.97
                );

            box-shadow:
                0 25px 70px
                rgba(
                    0,
                    0,
                    0,
                    0.35
                );

            color: #111827;
        }


        .auth-logo {
            width: 58px;
            height: 58px;

            display: flex;
            align-items: center;
            justify-content: center;

            margin:
                0 auto
                14px;

            border-radius: 18px;

            font-size: 30px;

            background: #eef2ff;
        }


        .auth-card h1 {
            margin:
                0 0 8px;

            text-align: center;

            font-size: 26px;
        }


        .auth-subtitle {
            margin:
                0 0 24px;

            text-align: center;

            color: #6b7280;

            font-size: 14px;
        }


        .auth-tabs {
            display: grid;
            grid-template-columns:
                1fr 1fr;

            gap: 6px;

            margin-bottom: 20px;

            padding: 5px;

            border-radius: 14px;

            background: #f3f4f6;
        }


        .auth-tab {
            border: 0;

            padding:
                10px 12px;

            border-radius: 10px;

            background:
                transparent;

            cursor: pointer;

            font-weight: 700;

            color: #6b7280;
        }


        .auth-tab.active {
            background: white;

            color: #111827;

            box-shadow:
                0 2px 8px
                rgba(
                    0,
                    0,
                    0,
                    0.08
                );
        }


        .auth-card label {
            display: block;

            margin:
                14px 0 6px;

            font-size: 13px;

            font-weight: 700;
        }


        .auth-card input {
            width: 100%;

            box-sizing:
                border-box;

            padding:
                13px 14px;

            border:
                1px solid #d1d5db;

            border-radius:
                12px;

            outline: none;

            font: inherit;
        }


        .auth-card input:focus {
            border-color:
                #6366f1;

            box-shadow:
                0 0 0 3px
                rgba(
                    99,
                    102,
                    241,
                    0.12
                );
        }


        .auth-main-btn,
        .google-auth-btn {
            width: 100%;

            margin-top: 18px;

            padding:
                13px 16px;

            border:
                0;

            border-radius:
                12px;

            cursor: pointer;

            font: inherit;

            font-weight: 800;
        }


        .auth-main-btn {
            background:
                #111827;

            color: white;
        }


        .google-auth-btn {
            margin-top: 0;

            border:
                1px solid #d1d5db;

            background: white;

            color: #111827;
        }


        .google-g {
            margin-right: 8px;

            font-weight: 900;

            color: #4285f4;
        }


        .auth-divider {
            display: flex;
            align-items: center;

            gap: 12px;

            margin:
                18px 0;

            color: #9ca3af;

            font-size: 12px;
        }


        .auth-divider::before,
        .auth-divider::after {
            content: "";

            flex: 1;

            height: 1px;

            background: #e5e7eb;
        }


        .auth-message {
            min-height: 18px;

            margin:
                14px 0 0;

            text-align: center;

            font-size: 13px;

            color: #dc2626;
        }


        @media (
            max-width: 520px
        ) {

            #authScreen {
                padding: 14px;
            }


            .auth-card {
                padding:
                    26px 20px;

                border-radius:
                    20px;
            }
        }
    `;


    document.head.appendChild(
        style
    );
}


function setAuthMessage(
    message,
    success = false
) {

    const element =
        $("authMessage");

    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.style.color =
        success
            ? "#16a34a"
            : "#dc2626";
}


function setAuthMode(
    mode
) {

    const isRegister =
        mode ===
        "register";


    $("registerNameWrap").style.display =
        isRegister
            ? "block"
            : "none";


    $("authMainBtn").textContent =
        isRegister
            ? "Create Account"
            : "Login";


    $("showLoginBtn")
        .classList
        .toggle(
            "active",
            !isRegister
        );


    $("showRegisterBtn")
        .classList
        .toggle(
            "active",
            isRegister
        );


    $("authPassword").autocomplete =
        isRegister
            ? "new-password"
            : "current-password";


    $("authScreen").dataset.mode =
        mode;


    setAuthMessage("");
}


function firebaseAuthErrorMessage(
    error
) {

    const code =
        error?.code || "";


    const messages = {

        "auth/invalid-email":
            "Invalid email address.",

        "auth/missing-password":
            "Please enter your password.",

        "auth/weak-password":
            "Password must be at least 6 characters.",

        "auth/email-already-in-use":
            "That email already has an account.",

        "auth/invalid-credential":
            "Wrong email or password.",

        "auth/user-not-found":
            "Account not found.",

        "auth/wrong-password":
            "Wrong email or password.",

        "auth/popup-closed-by-user":
            "Google sign-in was cancelled.",

        "auth/popup-blocked":
            "Please allow pop-ups for Google sign-in.",

        "auth/network-request-failed":
            "Network error. Check your internet connection."

    };


    return (
        messages[code] ||
        error?.message ||
        "Authentication failed."
    );
}


async function handleEmailAuth() {

    const mode =
        $("authScreen")
            ?.dataset
            ?.mode ||
        "login";


    const email =
        $("authEmail")
            .value
            .trim();


    const password =
        $("authPassword")
            .value;


    const button =
        $("authMainBtn");


    if (
        !email ||
        !password
    ) {

        setAuthMessage(
            "Enter your email and password."
        );

        return;
    }


    button.disabled =
        true;


    button.textContent =
        mode === "register"
            ? "Creating..."
            : "Logging in...";


    try {

        if (
            mode ===
            "register"
        ) {

            const credential =
                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );


            const name =
                $("authName")
                    .value
                    .trim();


            if (name) {

                await updateProfile(
                    credential.user,
                    {
                        displayName:
                            name
                    }
                );
            }


        } else {

            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );
        }


    } catch (error) {

        console.error(
            "Authentication error:",
            error
        );


        setAuthMessage(
            firebaseAuthErrorMessage(
                error
            )
        );


        button.disabled =
            false;


        button.textContent =
            mode === "register"
                ? "Create Account"
                : "Login";
    }
}


async function handleGoogleLogin() {

    const button =
        $("googleLoginBtn");


    button.disabled =
        true;


    button.textContent =
        "Opening Google...";


    try {

        await signInWithPopup(
            auth,
            googleProvider
        );


    } catch (error) {

        console.error(
            "Google sign-in error:",
            error
        );


        setAuthMessage(
            firebaseAuthErrorMessage(
                error
            )
        );


        button.disabled =
            false;


        button.innerHTML = `
            <span class="google-g">
                G
            </span>
            Continue with Google
        `;
    }
}


function bindAuthEvents() {

    $("showLoginBtn")
        .addEventListener(
            "click",
            () => {
                setAuthMode(
                    "login"
                );
            }
        );


    $("showRegisterBtn")
        .addEventListener(
            "click",
            () => {
                setAuthMode(
                    "register"
                );
            }
        );


    $("authMainBtn")
        .addEventListener(
            "click",
            handleEmailAuth
        );


    $("googleLoginBtn")
        .addEventListener(
            "click",
            handleGoogleLogin
        );


    $("authPassword")
        .addEventListener(
            "keydown",
            (event) => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    handleEmailAuth();
                }
            }
        );
}

/* =========================================================
   HUD ACCOUNT
========================================================= */

function updateHudAccount(user) {

    const nameElement =
        $("hudAccountName");

    const emailElement =
        $("hudAccountEmail");

    const signOutButton =
        $("hudSignOutBtn");


    if (!user) {

        if (nameElement) {
            nameElement.textContent =
                "Account";
        }

        if (emailElement) {
            emailElement.textContent =
                "Not signed in";
        }

        return;
    }


    if (nameElement) {

        nameElement.textContent =
            user.displayName ||
            user.email?.split("@")[0] ||
            "Budget User";
    }


    if (emailElement) {

        emailElement.textContent =
            user.email ||
            "Signed in";
    }


    if (signOutButton) {

        signOutButton.onclick =
            async () => {

                try {

                    signOutButton.disabled =
                        true;

                    signOutButton.textContent =
                        "Signing out...";


                    await signOut(auth);


                } catch (error) {

                    console.error(
                        "Sign out error:",
                        error
                    );

                    alert(
                        "Could not sign out. Please try again."
                    );

                } finally {

                    signOutButton.disabled =
                        false;

                    signOutButton.textContent =
                        "Sign out";
                }
            };
    }
}

/* =========================================================
   AUTH START
========================================================= */

createAuthScreen();
bindAuthEvents();
setAuthMode(
    "login"
);


onAuthStateChanged(
    auth,

    async (
        user
    ) => {

        if (!user) {

    updateHudAccount(null);

    budgetDoc = null;

    $("authScreen")
        .style
        .display =
        "flex";

    return;
}


        $("authScreen")
            .style
            .display =
            "none";
            
updateHudAccount(user);

        try {

            /*
                First login:
                copy old shared budget to this
                user's private Firebase path.

                Later logins:
                it simply loads the existing
                personal budget.
            */
            budgetDoc =
                await migrateLegacyBudgetIfNeeded(
                    user
                );


            console.log(
                "Signed in as:",
                user.displayName ||
                user.email
            );


            console.log(
                "Using personal budget:",
                `users/${user.uid}/budgetTracker/main`
            );


            await startApp();


        } catch (error) {

            console.error(
                "Budget Tracker failed to start:",
                error
            );


            if (
                $("syncStatus")
            ) {

                $("syncStatus")
                    .textContent =
                    "⚠ App startup error";
            }
        }
    }
);

/* =========================================================
   MONTHLY REPORT
========================================================= */

function getCurrentMonthValue() {

    const selectedDate =
        $("dashboardDate")?.value ||
        getToday();

    return selectedDate.slice(
        0,
        7
    );
}


function monthNameFromValue(
    monthValue
) {

    if (!monthValue) {
        return "";
    }

    const [
        year,
        month
    ] =
        monthValue
            .split("-")
            .map(Number);


    return new Date(
        year,
        month - 1,
        1
    ).toLocaleDateString(
        "en-PH",
        {
            month: "long",
            year: "numeric"
        }
    );
}


/* =========================================================
   MONTH TRANSACTIONS
========================================================= */

function transactionsForMonth(
    monthValue
) {

    return transactions
        .filter(
            (transaction) =>
                String(
                    transaction.date || ""
                ).startsWith(
                    monthValue
                )
        )
        .sort(
            (a, b) => {

                if (
                    a.date ===
                    b.date
                ) {

                    return (
                        Number(a.id) -
                        Number(b.id)
                    );
                }

                return a.date
                    .localeCompare(
                        b.date
                    );
            }
        );
}


/* =========================================================
   MONTH CATEGORY TOTAL
========================================================= */

function monthCategorySpent(
    monthTransactions,
    category
) {

    return monthTransactions
        .filter(
            (transaction) =>
                transaction.category ===
                category
        )
        .reduce(
            (total, transaction) =>
                total +
                (
                    Number(
                        transaction.amount
                    ) || 0
                ),
            0
        );
}


/* =========================================================
   MONTH PAYMENT TOTAL
========================================================= */

function monthPaymentSpent(
    monthTransactions,
    payment
) {

    return monthTransactions
        .filter(
            (transaction) =>
                transaction.payment ===
                payment
        )
        .reduce(
            (total, transaction) =>
                total +
                (
                    Number(
                        transaction.amount
                    ) || 0
                ),
            0
        );
}


/* =========================================================
   MONTHLY REPORT DATA
========================================================= */
function savingsVaultForMonth(
    monthValue
) {

    const entries =
        savingsVaultEntries
            .filter(
                (entry) =>
                    String(
                        entry.date || ""
                    ).startsWith(
                        `${monthValue}-`
                    )
            );


    let deposited = 0;
    let withdrawn = 0;


    entries.forEach(
        (entry) => {

            const amount =
                Number(
                    entry.amount
                ) || 0;


            if (
                entry.type ===
                "deposit"
            ) {

                deposited += amount;
            }


            if (
                entry.type ===
                "withdraw"
            ) {

                withdrawn += amount;
            }
        }
    );


    return {

        deposited,

        withdrawn,

        net:
            deposited -
            withdrawn
    };
}

function getMonthlyReportData(
    monthValue
) {

    const monthTransactions =
        transactionsForMonth(
            monthValue
        );


    const totalSpent =
        monthTransactions
            .reduce(
                (
                    total,
                    transaction
                ) =>
                    total +
                    (
                        Number(
                            transaction.amount
                        ) || 0
                    ),
                0
            );


    const needsSpent =
        monthCategorySpent(
            monthTransactions,
            "Needs"
        );


    const wantsSpent =
        monthCategorySpent(
            monthTransactions,
            "Wants"
        );


    const savingsMonth =
        savingsVaultForMonth(
            monthValue
        );


    const savingsSaved =
        savingsMonth.net;


    const vaultBalance =
        getSavingsVaultBalance();


    const cashSpent =
        monthPaymentSpent(
            monthTransactions,
            "Cash"
        );


    const cardSpent =
        monthPaymentSpent(
            monthTransactions,
            "Card"
        );


    const beepSpent =
        monthPaymentSpent(
            monthTransactions,
            "Beep"
        );


    const totalRemaining =
        categoryRemaining(
            "Needs"
        ) +
        categoryRemaining(
            "Wants"
        );


    return {

        monthValue,

        monthName:
            monthNameFromValue(
                monthValue
            ),

        transactions:
            monthTransactions,

        totalSpent,

        totalRemaining,

        needsSpent,

        wantsSpent,

        savingsSaved,

        vaultBalance,

        cashSpent,

        cardSpent,

        beepSpent
    };
}


/* =========================================================
   GROUP MONTH TRANSACTIONS
========================================================= */

function groupTransactionsByDate(
    monthTransactions
) {

    const groups = {};


    monthTransactions.forEach(
        (transaction) => {

            const date =
                transaction.date;


            if (!groups[date]) {

                groups[date] =
                    [];
            }


            groups[date].push(
                transaction
            );
        }
    );


    return groups;
}


/* =========================================================
   FRIENDLY REPORT DATE
========================================================= */

function reportDateLabel(
    dateString
) {

    const date =
        new Date(
            `${dateString}T00:00:00`
        );


    return date
        .toLocaleDateString(
            "en-PH",
            {
                weekday:
                    "short",

                month:
                    "short",

                day:
                    "numeric"
            }
        );
}


/* =========================================================
   MONTHLY REPORT HTML
========================================================= */

function buildMonthlyReportHtml(
    monthValue
) {

    const report =
        getMonthlyReportData(
            monthValue
        );


    const grouped =
        groupTransactionsByDate(
            report.transactions
        );


    const dates =
        Object
            .keys(grouped)
            .sort();


    let historyHtml = "";


    if (
        dates.length ===
        0
    ) {

        historyHtml = `
            <div class="report-empty">
                No transactions recorded
                for this month.
            </div>
        `;

    } else {

        dates.forEach(
            (date) => {

                const dailyTransactions =
                    grouped[date];


                const dailyTotal =
                    dailyTransactions
                        .reduce(
                            (
                                total,
                                transaction
                            ) =>
                                total +
                                (
                                    Number(
                                        transaction.amount
                                    ) || 0
                                ),
                            0
                        );


                const rows =
                    dailyTransactions
                        .map(
                            (transaction) => `
                                <div class="report-transaction">

                                    <div class="report-transaction-info">

                                        <strong>
                                            ${escapeHtml(
                                                transaction.description
                                            )}
                                        </strong>

                                        <span>
                                            ${escapeHtml(
                                                transaction.category ||
                                                "Uncategorized"
                                            )}

                                            •

                                            ${escapeHtml(
                                                transaction.payment ||
                                                "Unknown"
                                            )}
                                        </span>

                                    </div>

                                    <strong>
                                        ${money(
                                            transaction.amount
                                        )}
                                    </strong>

                                </div>
                            `
                        )
                        .join(
                            ""
                        );


                historyHtml += `
                    <section class="report-day">

                        <div class="report-day-heading">

                            <strong>
                                ${reportDateLabel(
                                    date
                                )}
                            </strong>

                            <span>
                                ${money(
                                    dailyTotal
                                )}
                            </span>

                        </div>

                        ${rows}

                    </section>
                `;
            }
        );
    }


    return `
        <div class="monthly-report-content">

            <div class="report-title">

                <div>
                    <span class="report-eyebrow">
                        BUDGET TRACKER
                    </span>

                    <h1>
                        Monthly Report
                    </h1>

                    <p>
                        ${escapeHtml(
                            report.monthName
                        )}
                    </p>
                </div>

                <div class="report-logo">
                    ₱
                </div>

            </div>


            <div class="report-main-summary">

                <div class="report-big-stat">

                    <span>
                        OVERALL SPENT
                    </span>

                    <strong>
                        ${money(
                            report.totalSpent
                        )}
                    </strong>

                </div>


                <div class="report-big-stat">

                    <span>
                        OVERALL REMAINING
                    </span>

                    <strong>
                        ${money(
                            report.totalRemaining
                        )}
                    </strong>

                </div>

            </div>


            <div class="report-category-grid">

                <div>
                    <span>
                        🛒 Needs
                    </span>

                    <strong>
                        ${money(
                            report.needsSpent
                        )}
                    </strong>
                </div>


                <div>
                    <span>
                        🎮 Wants
                    </span>

                    <strong>
                        ${money(
                            report.wantsSpent
                        )}
                    </strong>
                </div>


                <div>
                    <span>
                        🏦 Savings
                    </span>

                    <strong>
                        ${money(
                            report.savingsSaved
                        )}
                    </strong>
                </div>

            </div>


            <div class="report-payment-section">

                <h2>
                    Payment Breakdown
                </h2>

                <div class="report-payment-grid">

                    <div>
                        <span>
                            💵 Cash
                        </span>

                        <strong>
                            ${money(
                                report.cashSpent
                            )}
                        </strong>
                    </div>


                    <div>
                        <span>
                            💳 Card
                        </span>

                        <strong>
                            ${money(
                                report.cardSpent
                            )}
                        </strong>
                    </div>


                    <div>
                        <span>
                            🚆 Beep
                        </span>

                        <strong>
                            ${money(
                                report.beepSpent
                            )}
                        </strong>
                    </div>

                </div>

            </div>


            <div class="report-history">

                <h2>
                    Transaction History
                </h2>

                ${historyHtml}

            </div>


            <div class="report-footer">

                Generated from Budget Tracker

            </div>

        </div>
    `;
}


/* =========================================================
   REPORT STYLES
========================================================= */

function getMonthlyReportStyles() {

    return `
        * {
            box-sizing:
                border-box;
        }


        body {

            margin:
                0;

            padding:
                40px;

            background:
                #f3f4f6;

            color:
                #16181d;

            font-family:
                Arial,
                Helvetica,
                sans-serif;
        }


        .monthly-report-content {

            width:
                min(
                    850px,
                    100%
                );

            margin:
                0 auto;

            padding:
                42px;

            background:
                white;

            border-radius:
                22px;

            box-shadow:
                0 15px 50px
                rgba(
                    0,
                    0,
                    0,
                    .08
                );
        }


        .report-title {

            display:
                flex;

            justify-content:
                space-between;

            align-items:
                center;

            gap:
                20px;

            padding-bottom:
                28px;

            border-bottom:
                1px solid
                #e4e6ea;
        }


        .report-title h1 {

            margin:
                4px 0;

            font-size:
                34px;
        }


        .report-title p {

            margin:
                0;

            color:
                #747b86;
        }


        .report-eyebrow {

            color:
                #9197a1;

            font-size:
                11px;

            font-weight:
                800;

            letter-spacing:
                .15em;
        }


        .report-logo {

            display:
                grid;

            place-items:
                center;

            width:
                58px;

            height:
                58px;

            border-radius:
                17px;

            background:
                #202329;

            color:
                white;

            font-size:
                30px;

            font-weight:
                900;
        }


        .report-main-summary {

            display:
                grid;

            grid-template-columns:
                repeat(
                    2,
                    1fr
                );

            gap:
                14px;

            margin-top:
                26px;
        }


        .report-big-stat {

            padding:
                22px;

            border:
                1px solid
                #dde0e5;

            border-radius:
                16px;

            background:
                #f8f9fa;
        }


        .report-big-stat span {

            display:
                block;

            margin-bottom:
                6px;

            color:
                #848b95;

            font-size:
                10px;

            font-weight:
                800;

            letter-spacing:
                .1em;
        }


        .report-big-stat strong {

            font-size:
                28px;
        }


        .report-category-grid,
        .report-payment-grid {

            display:
                grid;

            grid-template-columns:
                repeat(
                    3,
                    1fr
                );

            gap:
                12px;

            margin-top:
                14px;
        }


        .report-category-grid > div,
        .report-payment-grid > div {

            padding:
                16px;

            border:
                1px solid
                #e2e4e8;

            border-radius:
                14px;
        }


        .report-category-grid span,
        .report-payment-grid span {

            display:
                block;

            color:
                #777e88;

            font-size:
                12px;
        }


        .report-category-grid strong,
        .report-payment-grid strong {

            display:
                block;

            margin-top:
                6px;

            font-size:
                17px;
        }


        .report-payment-section,
        .report-history {

            margin-top:
                32px;
        }


        .report-payment-section h2,
        .report-history h2 {

            margin:
                0 0 12px;

            font-size:
                17px;
        }


        .report-day {

            overflow:
                hidden;

            margin-bottom:
                12px;

            border:
                1px solid
                #e2e4e8;

            border-radius:
                14px;
        }


        .report-day-heading {

            display:
                flex;

            justify-content:
                space-between;

            align-items:
                center;

            gap:
                12px;

            padding:
                11px 14px;

            background:
                #f2f3f5;

            font-size:
                12px;
        }


        .report-transaction {

            display:
                flex;

            justify-content:
                space-between;

            align-items:
                center;

            gap:
                18px;

            padding:
                12px 14px;

            border-top:
                1px solid
                #eeeeef;

            font-size:
                12px;
        }


        .report-transaction-info {

            min-width:
                0;
        }


        .report-transaction-info strong {

            display:
                block;
        }


        .report-transaction-info span {

            display:
                block;

            margin-top:
                3px;

            color:
                #858b94;

            font-size:
                10px;
        }


        .report-empty {

            padding:
                28px;

            border:
                1px dashed
                #d6d9de;

            border-radius:
                14px;

            text-align:
                center;

            color:
                #858b94;
        }


        .report-footer {

            margin-top:
                32px;

            padding-top:
                16px;

            border-top:
                1px solid
                #e5e7eb;

            text-align:
                center;

            color:
                #9a9fa8;

            font-size:
                9px;
        }


        @media print {

            body {

                padding:
                    0;

                background:
                    white;
            }


            .monthly-report-content {

                width:
                    100%;

                padding:
                    20px;

                box-shadow:
                    none;

                border-radius:
                    0;
            }


            .report-day {

                break-inside:
                    avoid;
            }
        }


        @media (
            max-width:
            600px
        ) {

            body {

                padding:
                    15px;
            }


            .monthly-report-content {

                padding:
                    22px;
            }


            .report-main-summary,
            .report-category-grid,
            .report-payment-grid {

                grid-template-columns:
                    1fr;
            }
        }
    `;
}


/* =========================================================
   OPEN REPORT
========================================================= */

function openMonthlyReport(
    monthValue
) {

    try {

        const reportHtml =
            buildMonthlyReportHtml(
                monthValue
            );


        const fullHtml = `
            <!DOCTYPE html>

            <html lang="en">

            <head>

                <meta charset="UTF-8">

                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1.0"
                >

                <title>
                    Budget Report -
                    ${escapeHtml(
                        monthNameFromValue(
                            monthValue
                        )
                    )}
                </title>

                <style>
                    ${getMonthlyReportStyles()}
                </style>

            </head>

            <body>

                ${reportHtml}

                <script>
                    function printReport() {
                        window.print();
                    }
                <\/script>

            </body>

            </html>
        `;


        const blob =
            new Blob(
                [fullHtml],
                {
                    type:
                        "text/html"
                }
            );


        const reportUrl =
            URL.createObjectURL(
                blob
            );


        const popup =
            window.open(
                reportUrl,
                "_blank"
            );


        if (!popup) {

            URL.revokeObjectURL(
                reportUrl
            );

            alert(
                "Please allow pop-ups so the monthly report can open."
            );

            return;
        }


        setTimeout(
            () => {

                URL.revokeObjectURL(
                    reportUrl
                );

            },
            60000
        );


    } catch (error) {

        console.error(
            "Monthly Report Error:",
            error
        );


        alert(
            "Monthly Report failed to generate.\n\n" +
            error.message
        );
    }
}

/* =========================================================
   MONTHLY REPORT MODAL
========================================================= */

function createMonthlyReportModal() {

    if (
        $("monthlyReportBackdrop")
    ) {

        return;
    }


    const backdrop =
        document.createElement(
            "div"
        );


    backdrop.id =
        "monthlyReportBackdrop";


    backdrop.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 999;
        display: none;
        place-items: center;
        padding: 18px;
        background: rgba(5,7,10,.78);
    `;


    backdrop.innerHTML = `
        <section
            style="
                width:min(470px,100%);
                padding:20px;
                border:1px solid #3a4049;
                border-radius:16px;
                background:#23272d;
                color:#f4f5f7;
                box-shadow:
                    0 24px 60px
                    rgba(0,0,0,.45);
            "
        >

            <div
                style="
                    display:flex;
                    justify-content:
                        space-between;
                    align-items:center;
                    gap:12px;
                    margin-bottom:16px;
                "
            >

                <div>

                    <div
                        style="
                            color:#7f8791;
                            font-size:10px;
                            font-weight:800;
                            letter-spacing:.1em;
                        "
                    >
                        REPORTS
                    </div>

                    <h3
                        style="
                            margin:
                                3px 0 0;
                        "
                    >
                        📊 Monthly Report
                    </h3>

                </div>


                <button
                    type="button"
                    id="closeMonthlyReportBtn"
                    style="
                        width:34px;
                        height:34px;
                        border:
                            1px solid
                            #3a4049;
                        border-radius:9px;
                        background:#353b44;
                        color:white;
                        cursor:pointer;
                    "
                >
                    ✕
                </button>

            </div>


            <label
                for="monthlyReportMonth"
                style="
                    display:block;
                    margin-bottom:6px;
                    color:#aab0b9;
                    font-size:12px;
                    font-weight:700;
                "
            >
                Choose Month
            </label>


            <input
                type="month"
                id="monthlyReportMonth"
                style="
                    width:100%;
                    padding:10px 12px;
                    border:
                        1px solid
                        #3a4049;
                    border-radius:10px;
                    background:#1d2025;
                    color:#f4f5f7;
                    color-scheme:dark;
                "
            >


            <div
                id="monthlyReportPreview"
                style="
                    display:grid;
                    grid-template-columns:
                        repeat(2,1fr);
                    gap:10px;
                    margin-top:14px;
                "
            >
            </div>


            <button
                type="button"
                id="generateMonthlyReportBtn"
                style="
                    width:100%;
                    margin-top:16px;
                    padding:11px 14px;
                    border:
                        1px solid
                        #3a4049;
                    border-radius:10px;
                    background:#353b44;
                    color:white;
                    font-weight:800;
                    cursor:pointer;
                "
            >
                📄 Open Report
            </button>


            <p
                style="
                    margin:
                        10px 0 0;
                    color:#7f8791;
                    font-size:10px;
                    line-height:1.5;
                "
            >
                The report opens in a clean
                printable page. Choose
                <b>Print → Save as PDF</b>
                to download it.
            </p>

        </section>
    `;


    document.body
        .appendChild(
            backdrop
        );


    backdrop.addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                backdrop
            ) {

                closeMonthlyReportModal();
            }
        }
    );


    $("closeMonthlyReportBtn")
        ?.addEventListener(
            "click",
            closeMonthlyReportModal
        );


    $("monthlyReportMonth")
        ?.addEventListener(
            "change",
            updateMonthlyReportPreview
        );


    $("generateMonthlyReportBtn")
        ?.addEventListener(
            "click",
            () => {

                const monthValue =
                    $("monthlyReportMonth")
                        ?.value;


                if (!monthValue) {

                    alert(
                        "Choose a month first."
                    );

                    return;
                }


                openMonthlyReport(
                    monthValue
                );
            }
        );
}


/* =========================================================
   REPORT PREVIEW
========================================================= */

function updateMonthlyReportPreview() {

    const preview =
        $("monthlyReportPreview");


    const monthValue =
        $("monthlyReportMonth")
            ?.value;


    if (
        !preview ||
        !monthValue
    ) {

        return;
    }


    const report =
        getMonthlyReportData(
            monthValue
        );


    preview.innerHTML = `

        <div
            style="
                padding:12px;
                border:
                    1px solid
                    #3a4049;
                border-radius:11px;
                background:#2d3239;
            "
        >

            <span
                style="
                    display:block;
                    color:#7f8791;
                    font-size:9px;
                    font-weight:800;
                "
            >
                SPENT
            </span>

            <strong
                style="
                    display:block;
                    margin-top:4px;
                    font-size:18px;
                "
            >
                ${money(
                    report.totalSpent
                )}
            </strong>

        </div>


        <div
            style="
                padding:12px;
                border:
                    1px solid
                    #3a4049;
                border-radius:11px;
                background:#2d3239;
            "
        >

            <span
                style="
                    display:block;
                    color:#7f8791;
                    font-size:9px;
                    font-weight:800;
                "
            >
                TRANSACTIONS
            </span>

            <strong
                style="
                    display:block;
                    margin-top:4px;
                    font-size:18px;
                "
            >
                ${
                    report.transactions
                        .length
                }
            </strong>

        </div>

    `;
}


/* =========================================================
   OPEN/CLOSE MONTH REPORT MODAL
========================================================= */

function showMonthlyReportModal() {

    createMonthlyReportModal();


    const backdrop =
        $("monthlyReportBackdrop");


    if (!backdrop) {
        return;
    }


    const monthInput =
        $("monthlyReportMonth");


    if (monthInput) {

        monthInput.value =
            getCurrentMonthValue();
    }


    updateMonthlyReportPreview();


    backdrop.style.display =
        "grid";
}


function closeMonthlyReportModal() {

    const backdrop =
        $("monthlyReportBackdrop");


    if (backdrop) {

        backdrop.style.display =
            "none";
    }
}


/* =========================================================
   INSTALL MONTHLY REPORT BUTTON
========================================================= */

function installMonthlyReportFeature() {

    const nav =
        document.querySelector(
            ".side-nav"
        );


    if (
        !nav ||
        $("monthlyReportNavBtn")
    ) {

        return;
    }


    const button =
        document.createElement(
            "button"
        );


    button.type =
        "button";


    button.id =
        "monthlyReportNavBtn";


    button.className =
        "nav-btn";


    button.innerHTML =
        "📊 <span>Monthly Report</span>";


    button.addEventListener(
        "click",
        showMonthlyReportModal
    );


    nav.appendChild(
        button
    );


    createMonthlyReportModal();
}


/* =========================================================
   START MONTHLY REPORT FEATURE
========================================================= */

installMonthlyReportFeature();

/* =========================================================
   SAVINGS VAULT
========================================================= */

function getSavingsVaultBalance() {

    return savingsVaultEntries
        .reduce(
            (
                total,
                entry
            ) => {

                const amount =
                    Number(
                        entry.amount
                    ) || 0;


                if (
                    entry.type ===
                    "deposit"
                ) {

                    return (
                        total +
                        amount
                    );
                }


                if (
                    entry.type ===
                    "withdraw"
                ) {

                    return (
                        total -
                        amount
                    );
                }


                return total;
            },
            0
        );
}


/* =========================================================
   SAVINGS LEVEL
========================================================= */

function getSavingsLevelData() {

    const balance =
        Math.max(
            0,
            getSavingsVaultBalance()
        );


    const step =
        1000;


    const level =
        Math.floor(
            balance /
            step
        );


    const currentFloor =
        level *
        step;


    const nextTarget =
        (
            level +
            1
        ) *
        step;


    const progressAmount =
        balance -
        currentFloor;


    const progress =
        Math.max(
            0,
            Math.min(
                100,
                (
                    progressAmount /
                    step
                ) * 100
            )
        );


    return {

        balance,

        level,

        nextLevel:
            level + 1,

        nextTarget,

        progress
    };
}


/* =========================================================
   VAULT DATE
========================================================= */

function savingsEntryDateLabel(
    date
) {

    if (!date) {
        return "";
    }


    return new Date(
        `${date}T00:00:00`
    ).toLocaleDateString(
        "en-PH",
        {
            month:
                "short",

            day:
                "numeric",

            year:
                "numeric"
        }
    );
}


/* =========================================================
   SAVINGS HISTORY
========================================================= */

function renderSavingsVaultHistory() {

    const list =
        $("savingsVaultHistory");


    if (!list) {
        return;
    }


    list.innerHTML =
        "";


    if (
        savingsVaultEntries.length ===
        0
    ) {

        list.innerHTML = `
            <div
                style="
                    padding:20px 4px;
                    text-align:center;
                    color:#7f8791;
                    font-size:11px;
                "
            >
                No savings activity yet.
            </div>
        `;

        return;
    }


    const sorted =
        [
            ...savingsVaultEntries
        ]
            .sort(
                (
                    a,
                    b
                ) =>
                    Number(b.id) -
                    Number(a.id)
            )
            .slice(
                0,
                15
            );


    sorted.forEach(
        (entry) => {

            const row =
                document.createElement(
                    "div"
                );


            row.style.cssText = `
                display:grid;
                grid-template-columns:
                    minmax(0,1fr)
                    auto;
                gap:12px;
                align-items:center;
                padding:11px 0;
                border-bottom:
                    1px solid
                    #353a42;
            `;


            const isDeposit =
                entry.type ===
                "deposit";


            row.innerHTML = `

                <div>

                    <strong
                        style="
                            display:block;
                            font-size:12px;
                        "
                    >
                        ${
                            isDeposit
                                ? "📥 Savings Deposit"
                                : "📤 Emergency Withdrawal"
                        }
                    </strong>

                    <span
                        style="
                            display:block;
                            margin-top:3px;
                            color:#7f8791;
                            font-size:9px;
                        "
                    >
                        ${
                            isDeposit
                                ? "From"
                                : "Returned to"
                        }

                        ${escapeHtml(
                            entry.account
                        )}

                        •

                        ${escapeHtml(
                            savingsEntryDateLabel(
                                entry.date
                            )
                        )}
                    </span>

                </div>


                <strong
                    style="
                        font-size:12px;
                    "
                >
                    ${
                        isDeposit
                            ? "+"
                            : "-"
                    }${money(
                        entry.amount
                    )}
                </strong>
            `;


            list.appendChild(
                row
            );
        }
    );
}


/* =========================================================
   UPDATE VAULT UI
========================================================= */

function updateSavingsVaultUI() {

    const data =
        getSavingsLevelData();


    if (
        $("savingsVaultBalance")
    ) {

        $("savingsVaultBalance")
            .textContent =
                money(
                    data.balance
                );
    }


    if (
        $("savingsVaultLevel")
    ) {

        $("savingsVaultLevel")
            .textContent =
                `Level ${data.level}`;
    }


    if (
        $("savingsVaultTarget")
    ) {

        $("savingsVaultTarget")
            .textContent =
                `${money(
                    data.balance
                )} / ${money(
                    data.nextTarget
                )}`;
    }


    if (
        $("savingsVaultProgress")
    ) {

        $("savingsVaultProgress")
            .style.width =
                `${data.progress}%`;
    }


    if (
        $("savingsVaultNextText")
    ) {

        const needed =
            Math.max(
                0,
                data.nextTarget -
                data.balance
            );


        $("savingsVaultNextText")
            .textContent =
                `${money(
                    needed
                )} until Level ${data.nextLevel}`;
    }


    const wallet =
        calculateWalletBalances();


    if (
        $("vaultCashAvailable")
    ) {

        $("vaultCashAvailable")
            .textContent =
                money(
                    wallet.Cash
                );
    }


    if (
        $("vaultCardAvailable")
    ) {

        $("vaultCardAvailable")
            .textContent =
                money(
                    wallet.Card
                );
    }


    renderSavingsVaultHistory();
}


/* =========================================================
   DEPOSIT
========================================================= */

async function depositToSavingsVault() {

    const amount =
        Number(
            $("savingsVaultAmount")
                ?.value
        );


    const account =
        $("savingsVaultAccount")
            ?.value;


    const date =
        $("dashboardDate")
            ?.value ||
        getToday();


    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        alert(
            "Enter a valid savings amount."
        );

        return;
    }


    const wallet =
        calculateWalletBalances();


    if (
        !account ||
        wallet[account] ===
            undefined
    ) {

        alert(
            "Choose Cash or Card."
        );

        return;
    }


    if (
        amount >
        wallet[account]
    ) {

        alert(
            `Not enough ${account} balance.\n\nAvailable: ${money(
                wallet[account]
            )}`
        );

        return;
    }


    savingsVaultEntries.push({

        id:
            uid(),

        date,

        type:
            "deposit",

        account,

        amount
    });


    if (
        $("savingsVaultAmount")
    ) {

        $("savingsVaultAmount")
            .value =
                "";
    }


    await saveData();


    refreshAll();

    updateSavingsVaultUI();
}


/* =========================================================
   WITHDRAW
========================================================= */

async function withdrawFromSavingsVault() {

    const amount =
        Number(
            $("savingsVaultAmount")
                ?.value
        );


    const account =
        $("savingsVaultAccount")
            ?.value;


    const date =
        $("dashboardDate")
            ?.value ||
        getToday();


    const vaultBalance =
        getSavingsVaultBalance();


    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        alert(
            "Enter a valid withdrawal amount."
        );

        return;
    }


    if (
        amount >
        vaultBalance
    ) {

        alert(
            `Not enough savings.\n\nVault balance: ${money(
                vaultBalance
            )}`
        );

        return;
    }


    const confirmed =
        confirm(
            `Withdraw ${money(
                amount
            )} from savings and return it to ${account}?`
        );


    if (!confirmed) {
        return;
    }


    savingsVaultEntries.push({

        id:
            uid(),

        date,

        type:
            "withdraw",

        account,

        amount
    });


    if (
        $("savingsVaultAmount")
    ) {

        $("savingsVaultAmount")
            .value =
                "";
    }


    await saveData();


    refreshAll();

    updateSavingsVaultUI();
}


/* =========================================================
   CREATE VAULT MODAL
========================================================= */

function createSavingsVaultModal() {

    if (
        $("savingsVaultBackdrop")
    ) {

        return;
    }


    const backdrop =
        document.createElement(
            "div"
        );


    backdrop.id =
        "savingsVaultBackdrop";


    backdrop.style.cssText = `
        position:fixed;
        inset:0;
        z-index:1000;
        display:none;
        place-items:center;
        padding:18px;
        background:
            rgba(5,7,10,.78);
    `;


    backdrop.innerHTML = `

        <section
            style="
                width:
                    min(
                        520px,
                        100%
                    );
                max-height:
                    90vh;
                overflow-y:auto;
                padding:20px;
                border:
                    1px solid
                    #3a4049;
                border-radius:18px;
                background:#23272d;
                color:#f4f5f7;
                box-shadow:
                    0 24px 60px
                    rgba(
                        0,
                        0,
                        0,
                        .45
                    );
            "
        >

            <div
                style="
                    display:flex;
                    justify-content:
                        space-between;
                    align-items:center;
                    gap:12px;
                "
            >

                <div>

                    <span
                        style="
                            color:#7f8791;
                            font-size:9px;
                            font-weight:900;
                            letter-spacing:.12em;
                        "
                    >
                        SAVINGS VAULT
                    </span>

                    <h3
                        style="
                            margin:4px 0 0;
                        "
                    >
                        🏦 My Savings
                    </h3>

                </div>


                <button
                    type="button"
                    id="closeSavingsVaultBtn"
                    style="
                        width:34px;
                        height:34px;
                        border:
                            1px solid
                            #3a4049;
                        border-radius:9px;
                        background:#353b44;
                        color:white;
                        cursor:pointer;
                    "
                >
                    ✕
                </button>

            </div>


            <div
                style="
                    margin-top:18px;
                    padding:18px;
                    border:
                        1px solid
                        #3a4049;
                    border-radius:15px;
                    background:#2d3239;
                "
            >

                <span
                    style="
                        display:block;
                        color:#aab0b9;
                        font-size:10px;
                    "
                >
                    SAVINGS BALANCE
                </span>


                <strong
                    id="savingsVaultBalance"
                    style="
                        display:block;
                        margin-top:5px;
                        font-size:30px;
                    "
                >
                    ₱0.00
                </strong>


                <div
                    style="
                        display:flex;
                        justify-content:
                            space-between;
                        gap:10px;
                        margin-top:12px;
                    "
                >

                    <strong
                        id="savingsVaultLevel"
                        style="
                            font-size:12px;
                        "
                    >
                        Level 0
                    </strong>

                    <span
                        id="savingsVaultTarget"
                        style="
                            color:#aab0b9;
                            font-size:10px;
                        "
                    >
                        ₱0 / ₱1,000
                    </span>

                </div>


                <div
                    style="
                        overflow:hidden;
                        width:100%;
                        height:12px;
                        margin-top:8px;
                        border:
                            1px solid
                            #414751;
                        border-radius:999px;
                        background:#171a1f;
                    "
                >

                    <div
                        id="savingsVaultProgress"
                        style="
                            width:0%;
                            height:100%;
                            border-radius:999px;
                            background:
                                linear-gradient(
                                    90deg,
                                    #9eaa9a,
                                    #e3e8df
                                );
                            transition:
                                width .35s ease;
                        "
                    >
                    </div>

                </div>


                <span
                    id="savingsVaultNextText"
                    style="
                        display:block;
                        margin-top:7px;
                        color:#7f8791;
                        font-size:9px;
                    "
                >
                    ₱1,000 until Level 1
                </span>

            </div>


            <div
                style="
                    display:grid;
                    grid-template-columns:
                        repeat(
                            2,
                            1fr
                        );
                    gap:10px;
                    margin-top:14px;
                "
            >

                <div
                    style="
                        padding:11px;
                        border:
                            1px solid
                            #3a4049;
                        border-radius:11px;
                    "
                >
                    <span
                        style="
                            color:#7f8791;
                            font-size:9px;
                        "
                    >
                        💵 CASH AVAILABLE
                    </span>

                    <strong
                        id="vaultCashAvailable"
                        style="
                            display:block;
                            margin-top:4px;
                            font-size:14px;
                        "
                    >
                        ₱0.00
                    </strong>
                </div>


                <div
                    style="
                        padding:11px;
                        border:
                            1px solid
                            #3a4049;
                        border-radius:11px;
                    "
                >
                    <span
                        style="
                            color:#7f8791;
                            font-size:9px;
                        "
                    >
                        💳 CARD AVAILABLE
                    </span>

                    <strong
                        id="vaultCardAvailable"
                        style="
                            display:block;
                            margin-top:4px;
                            font-size:14px;
                        "
                    >
                        ₱0.00
                    </strong>
                </div>

            </div>


            <div
                style="
                    display:grid;
                    grid-template-columns:
                        1fr 1fr;
                    gap:10px;
                    margin-top:15px;
                "
            >

                <div>

                    <label
                        style="
                            display:block;
                            margin-bottom:6px;
                            color:#aab0b9;
                            font-size:11px;
                        "
                    >
                        Amount
                    </label>

                    <input
                        type="number"
                        id="savingsVaultAmount"
                        min="0"
                        step="0.01"
                        placeholder="₱0.00"
                        style="
                            width:100%;
                            padding:10px 12px;
                            border:
                                1px solid
                                #3a4049;
                            border-radius:10px;
                            background:#1d2025;
                            color:#f4f5f7;
                        "
                    >

                </div>


                <div>

                    <label
                        style="
                            display:block;
                            margin-bottom:6px;
                            color:#aab0b9;
                            font-size:11px;
                        "
                    >
                        Cash / Card
                    </label>

                    <select
                        id="savingsVaultAccount"
                        style="
                            width:100%;
                            padding:10px 12px;
                            border:
                                1px solid
                                #3a4049;
                            border-radius:10px;
                            background:#1d2025;
                            color:#f4f5f7;
                        "
                    >

                        <option
                            value="Cash"
                        >
                            💵 Cash
                        </option>

                        <option
                            value="Card"
                        >
                            💳 Card
                        </option>

                    </select>

                </div>

            </div>


            <div
                style="
                    display:grid;
                    grid-template-columns:
                        1fr 1fr;
                    gap:9px;
                    margin-top:12px;
                "
            >

                <button
                    type="button"
                    id="depositSavingsVaultBtn"
                    style="
                        padding:11px;
                        border:
                            1px solid
                            #3a4049;
                        border-radius:10px;
                        background:#414852;
                        color:white;
                        font-weight:800;
                        cursor:pointer;
                    "
                >
                    + Deposit
                </button>


                <button
                    type="button"
                    id="withdrawSavingsVaultBtn"
                    style="
                        padding:11px;
                        border:
                            1px solid
                            #3a4049;
                        border-radius:10px;
                        background:#2d3239;
                        color:white;
                        font-weight:800;
                        cursor:pointer;
                    "
                >
                    Withdraw
                </button>

            </div>


            <div
                style="
                    margin-top:22px;
                "
            >

                <strong
                    style="
                        font-size:13px;
                    "
                >
                    Recent Activity
                </strong>

                <div
                    id="savingsVaultHistory"
                    style="
                        margin-top:8px;
                    "
                >
                </div>

            </div>

        </section>
    `;


    document.body
        .appendChild(
            backdrop
        );


    $("closeSavingsVaultBtn")
        ?.addEventListener(
            "click",
            hideSavingsVault
        );


    $("depositSavingsVaultBtn")
        ?.addEventListener(
            "click",
            depositToSavingsVault
        );


    $("withdrawSavingsVaultBtn")
        ?.addEventListener(
            "click",
            withdrawFromSavingsVault
        );


    backdrop.addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                backdrop
            ) {

                hideSavingsVault();
            }
        }
    );
}


/* =========================================================
   SHOW / HIDE
========================================================= */

function showSavingsVault() {

    createSavingsVaultModal();


    const backdrop =
        $("savingsVaultBackdrop");


    if (!backdrop) {
        return;
    }


    updateSavingsVaultUI();


    backdrop.style.display =
        "grid";
}


function hideSavingsVault() {

    const backdrop =
        $("savingsVaultBackdrop");


    if (backdrop) {

        backdrop.style.display =
            "none";
    }
}


/* =========================================================
   INSTALL VAULT BUTTON
========================================================= */

function installSavingsVaultFeature() {

    const nav =
        document.querySelector(
            ".side-nav"
        );


    if (
        !nav ||
        $("savingsVaultNavBtn")
    ) {

        return;
    }


    const button =
        document.createElement(
            "button"
        );


    button.type =
        "button";


    button.id =
        "savingsVaultNavBtn";


    button.className =
        "nav-btn";


    button.innerHTML =
        "🏦 <span>Savings Vault</span>";


    button.addEventListener(
        "click",
        showSavingsVault
    );


    const transferButton =
    nav.querySelector(
        '[data-panel="transferPanel"]'
    );


if (transferButton) {

    nav.insertBefore(
        button,
        transferButton
    );

} else {

    nav.appendChild(
        button
    );
};


    createSavingsVaultModal();
}


/* =========================================================
   START VAULT
========================================================= */

installSavingsVaultFeature();
