import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
    getFirestore,
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


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
const budgetDoc = doc(db, "budgetTracker", "main");


/* =========================================================
   DATA
========================================================= */

let transactions = [];
let transfers = [];
let debts = [];
let allowanceEntries = [];
let dailyPlans = {};

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
        categoryRemaining("Needs");

    const wants =
        categoryRemaining("Wants");

    const savings =
        categoryRemaining("Savings");

    const totalRemaining =
        needs +
        wants +
        savings;

    const totalOriginal =
        (Number(moneyPoolBase.Needs) || 0) +
        (Number(moneyPoolBase.Wants) || 0) +
        (Number(moneyPoolBase.Savings) || 0);

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
            money(totalRemaining);
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
        "savings",
        savings,
        moneyPoolBase.Savings
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

    const savings =
        Number(
            $("dailySavingsInput")?.value
        ) || 0;

    const total =
        needs +
        wants +
        savings;

    if ($("dailyAllocationTotal")) {

        $("dailyAllocationTotal").textContent =
            money(total);
    }

    if ($("dailyLimit")) {

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

    if (!$("historyDate")) {
        return;
    }

    const date =
        $("historyDate").value;

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

                        ${
                            row.item.subcategory
                                ? ` • ${escapeHtml(
                                    row.item.subcategory
                                )}`
                                : ""
                        }

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
   ADD TRANSACTION
========================================================= */

async function addTransaction() {

    const date =
        $("transactionDate").value;

    const description =
        $("description")
            .value
            .trim();

    const amount =
        Number(
            $("amount").value
        );

    const subcategory =
        $("subcategory")
            .value
            .trim();

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

        subcategory,

        payment
    });


    $("description").value = "";
    $("amount").value = "";
    $("subcategory").value = "";

    /*
        Transaction History follows
        the transaction you just added.

        Today's Budget remains independent.
    */

    $("historyDate").value =
        date;


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

    const savingsRemaining =
        Number(
            $("savingsMoneyInput").value
        );

    if (
        [
            needsRemaining,
            wantsRemaining,
            savingsRemaining
        ].some(
            (value) =>
                !Number.isFinite(value) ||
                value < 0
        )
    ) {

        alert(
            "Enter valid money amounts for Needs, Wants, and Savings."
        );

        return;
    }

    moneyPoolBase = {

        Needs:
            needsRemaining +
            categoryAllocated("Needs"),

        Wants:
            wantsRemaining +
            categoryAllocated("Wants"),

        Savings:
            savingsRemaining +
            categoryAllocated("Savings")
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

    const savings =
        Number(
            $("dailySavingsInput").value
        ) || 0;

    if (
        [
            needs,
            wants,
            savings
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

    const availableSavings =
        categoryAvailableForDay(
            "Savings",
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


    if (
        savings >
        availableSavings
    ) {

        alert(
            `Not enough Savings money.\n\nAvailable: ${money(
                availableSavings
            )}`
        );

        return;
    }


    const total =
        needs +
        wants +
        savings;


    dailyPlans[date] = {

        event,

        limit: total,

        allocations: {

            Needs: needs,
            Wants: wants,
            Savings: savings
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


    const name =
        prompt(
            "Name:",
            debt.name
        );

    if (name === null) {
        return;
    }


    const rawAmount =
        prompt(
            "Amount:",
            debt.amount
        );

    if (
        rawAmount === null
    ) {
        return;
    }


    const amount =
        Number(rawAmount);


    if (
        !name.trim() ||
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        alert(
            "Invalid debt details."
        );

        return;
    }


    debt.name =
        name.trim();

    debt.amount =
        amount;


    await saveData();

    renderDebts();
}


/* =========================================================
   DELETE FUNCTIONS
========================================================= */

async function deleteTransaction(id) {

    if (
        !confirm(
            "Delete this transaction?"
        )
    ) {
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

    if (
        !confirm(
            "Delete this transfer?"
        )
    ) {
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

    if (
        !confirm(
            "Delete this allowance entry?"
        )
    ) {
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

    if (
        !confirm(
            "Delete this utang?"
        )
    ) {
        return;
    }

    debts =
        debts.filter(
            (item) =>
                item.id !== id
        );

    await saveData();

    refreshAll();
}


/* =========================================================
   MONEY DASHBOARD SLIDE
========================================================= */

function openMoneyDashboard() {

    $("moneyDashboard")
        .classList
        .remove("closed");

    $("toggleDashboardBtn").textContent =
        "☰ Hide Money Dashboard";
}


function closeMoneyDashboard() {

    $("moneyDashboard")
        .classList
        .add("closed");

    $("toggleDashboardBtn").textContent =
        "☰ Open Money Dashboard";
}


function toggleMoneyDashboard() {

    if (
        $("moneyDashboard")
            .classList
            .contains("closed")
    ) {

        openMoneyDashboard();

    } else {

        closeMoneyDashboard();
    }
}


/* =========================================================
   MODALS
========================================================= */

function openModal(panelId) {

    $("modalBackdrop")
        .classList
        .remove("hidden");


    document
        .querySelectorAll(
            "[data-modal-panel]"
        )
        .forEach(
            (panel) => {

                panel
                    .classList
                    .add("hidden");
            }
        );


    $(panelId)
        .classList
        .remove("hidden");


    /* EDIT DAY */

    if (
        panelId ===
        "dailyPlanPanel"
    ) {

        const date =
            $("dashboardDate").value;

        const plan =
            dailyPlans[date] || {
                event: ""
            };

        const allocations =
            getPlanAllocations(date);


        $("eventName").value =
            plan.event || "";

        $("dailyNeedsInput").value =
            allocations.Needs;

        $("dailyWantsInput").value =
            allocations.Wants;

        $("dailySavingsInput").value =
            allocations.Savings;


        updateDailyAllocationAvailable();

        updateDailyAllocationTotal();
    }


    /* EDIT MONEY */

    if (
        panelId ===
        "moneyPoolPanel"
    ) {

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
    }


    if (
        panelId ===
        "allowancePanel"
    ) {
        renderAllowanceList();
    }


    if (
        panelId ===
        "transferPanel"
    ) {
        renderTransferList();
    }


    if (
        panelId ===
        "debtPanel"
    ) {
        renderDebts();
    }
}


function closeModal() {

    $("modalBackdrop")
        .classList
        .add("hidden");

    document
        .querySelectorAll(
            "[data-modal-panel]"
        )
        .forEach(
            (panel) => {

                panel
                    .classList
                    .add("hidden");
            }
        );
}


/* =========================================================
   FIREBASE PAYLOAD
========================================================= */

function getPayload() {

    return {

        version: 9,

        transactions,

        transfers,

        debts,

        allowanceEntries,

        dailyPlans,

        moneyPoolBase
    };
}


/* =========================================================
   SAVE
========================================================= */

async function saveData() {

    if ($("syncStatus")) {

        $("syncStatus").textContent =
            "Saving…";
    }


    const payload =
        getPayload();


    localStorage.setItem(
        "budgetTrackerV9",
        JSON.stringify(payload)
    );


    try {

        await setDoc(
            budgetDoc,
            payload,
            {
                merge: true
            }
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
                "Offline copy saved on this device";
        }
    }
}


/* =========================================================
   LOCAL BACKUP
========================================================= */

function loadLocal() {

    try {

        const raw =
            localStorage.getItem(
                "budgetTrackerV9"
            ) ||

            localStorage.getItem(
                "budgetTrackerV8"
            ) ||

            localStorage.getItem(
                "budgetTrackerV7"
            ) ||

            localStorage.getItem(
                "budgetTrackerV6"
            ) ||

            localStorage.getItem(
                "budgetTrackerV5"
            ) ||

            localStorage.getItem(
                "budgetTrackerV4"
            ) ||

            localStorage.getItem(
                "budgetTrackerV3"
            ) ||

            localStorage.getItem(
                "budgetTrackerV2"
            );


        return raw
            ? JSON.parse(raw)
            : null;

    } catch (error) {

        console.error(
            "Local backup error:",
            error
        );

        return null;
    }
}


/* =========================================================
   MIGRATION
========================================================= */

function migrateData(data = {}) {

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


    /*
        RESTORE OLD CASH / CARD / BEEP
    */

    if (
        allowanceEntries.length === 0 &&
        data.startingBalances &&
        typeof data.startingBalances ===
        "object"
    ) {

        const migrationDate =
            getToday();

        [
            "Cash",
            "Card",
            "Beep"
        ].forEach(
            (account) => {

                const amount =
                    Number(
                        data.startingBalances[
                            account
                        ]
                    ) || 0;

                if (
                    amount > 0
                ) {

                    allowanceEntries.push({

                        id: uid(),

                        date:
                            migrationDate,

                        account,

                        amount,

                        migrated:
                            true
                    });
                }
            }
        );
    }


    if (
        data.dailyPlans &&
        typeof data.dailyPlans ===
        "object" &&
        !Array.isArray(
            data.dailyPlans
        )
    ) {

        dailyPlans =
            data.dailyPlans;

    } else {

        dailyPlans = {};
    }


    if (
        data.moneyPoolBase &&
        typeof data.moneyPoolBase ===
        "object"
    ) {

        moneyPoolBase = {

            Needs:
                Number(
                    data.moneyPoolBase.Needs
                ) || 0,

            Wants:
                Number(
                    data.moneyPoolBase.Wants
                ) || 0,

            Savings:
                Number(
                    data.moneyPoolBase.Savings
                ) || 0
        };

    } else if (
        data.categoryBudgets &&
        typeof data.categoryBudgets ===
        "object"
    ) {

        moneyPoolBase = {

            Needs:
                Number(
                    data.categoryBudgets.Needs
                ) || 0,

            Wants:
                Number(
                    data.categoryBudgets.Wants
                ) || 0,

            Savings:
                Number(
                    data.categoryBudgets.Savings
                ) || 0
        };

    } else {

        moneyPoolBase = {
            Needs: 0,
            Wants: 0,
            Savings: 0
        };
    }
}


/* =========================================================
   LOAD
========================================================= */

async function loadData() {

    if ($("syncStatus")) {

        $("syncStatus").textContent =
            "Loading Firebase data…";
    }


    try {

        const snapshot =
            await getDoc(
                budgetDoc
            );


        if (
            snapshot.exists()
        ) {

            migrateData(
                snapshot.data()
            );


            localStorage.setItem(
                "budgetTrackerV9",
                JSON.stringify(
                    getPayload()
                )
            );


            if ($("syncStatus")) {

                $("syncStatus").textContent =
                    "✓ Synced with Firebase";
            }

        } else {

            const local =
                loadLocal();

            if (local) {

                migrateData(local);
            }

            await saveData();
        }

    } catch (error) {

        console.error(
            "Firebase load error:",
            error
        );


        const local =
            loadLocal();

        if (local) {

            migrateData(local);
        }


        if ($("syncStatus")) {

            $("syncStatus").textContent =
                "Offline mode • using device backup";
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
}


/* =========================================================
   INITIAL DATES
========================================================= */

function initializeDates() {

    const today =
        getToday();


    if ($("dashboardDate")) {
        $("dashboardDate").value =
            today;
    }

    if ($("transactionDate")) {
        $("transactionDate").value =
            today;
    }

    if ($("historyDate")) {
        $("historyDate").value =
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
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

function bindEvents() {


    /* TRANSACTION CATEGORY */

    document
        .querySelectorAll(
            ".choice[data-category]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        selectedCategory =
                            button.dataset.category;

                        document
                            .querySelectorAll(
                                ".choice[data-category]"
                            )
                            .forEach(
                                (item) => {

                                    item.classList.remove(
                                        "selected"
                                    );
                                }
                            );

                        button.classList.add(
                            "selected"
                        );
                    }
                );
            }
        );


    /* SIDEBAR */

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

                        openModal(
                            button.dataset.panel
                        );
                    }
                );
            }
        );


    /* CLOSE MODAL */

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


    /* MONEY DASHBOARD */

    if ($("toggleDashboardBtn")) {

        $("toggleDashboardBtn")
            .addEventListener(
                "click",
                toggleMoneyDashboard
            );
    }


    if ($("closeDashboardBtn")) {

        $("closeDashboardBtn")
            .addEventListener(
                "click",
                closeMoneyDashboard
            );
    }


    if ($("editMoneyPoolBtn")) {

        $("editMoneyPoolBtn")
            .addEventListener(
                "click",
                () =>
                    openModal(
                        "moneyPoolPanel"
                    )
            );
    }


    if ($("saveMoneyPoolBtn")) {

        $("saveMoneyPoolBtn")
            .addEventListener(
                "click",
                saveMoneyPool
            );
    }


    /* EDIT DAY */

    if ($("editDailyPlanBtn")) {

        $("editDailyPlanBtn")
            .addEventListener(
                "click",
                () =>
                    openModal(
                        "dailyPlanPanel"
                    )
            );
    }


    if ($("saveDailyPlanBtn")) {

        $("saveDailyPlanBtn")
            .addEventListener(
                "click",
                saveDailyPlan
            );
    }


    /* DAILY INPUT LIVE TOTAL */

    [
        "dailyNeedsInput",
        "dailyWantsInput",
        "dailySavingsInput"
    ].forEach(
        (id) => {

            const input = $(id);

            if (input) {

                input.addEventListener(
                    "input",
                    updateDailyAllocationTotal
                );
            }
        }
    );


    /* ADD TRANSACTION */

    if ($("addTransactionBtn")) {

        $("addTransactionBtn")
            .addEventListener(
                "click",
                addTransaction
            );
    }


    /* ALLOWANCE */

    if ($("addAllowanceBtn")) {

        $("addAllowanceBtn")
            .addEventListener(
                "click",
                addAllowance
            );
    }


    /* TRANSFER */

    if ($("transferMoneyBtn")) {

        $("transferMoneyBtn")
            .addEventListener(
                "click",
                addTransfer
            );
    }


    /* UTANG */

    if ($("addDebtBtn")) {

        $("addDebtBtn")
            .addEventListener(
                "click",
                addDebt
            );
    }


    /* =====================================================
       TODAY'S BUDGET DATE PICKER

       IMPORTANT:
       Does NOT change Transaction History date.
    ===================================================== */

    if ($("dashboardDate")) {

        $("dashboardDate")
            .addEventListener(
                "change",
                () => {

                    updateDailyAllocationAvailable();

                    updateDailyDashboard();
                }
            );
    }


    /* =====================================================
       TODAY'S BUDGET PREVIOUS DAY <
    ===================================================== */

    if ($("dashboardPreviousDate")) {

        $("dashboardPreviousDate")
            .addEventListener(
                "click",
                () => {

                    $("dashboardDate").value =
                        shiftDate(
                            $("dashboardDate").value,
                            -1
                        );

                    updateDailyAllocationAvailable();

                    updateDailyDashboard();
                }
            );
    }


    /* =====================================================
       TODAY'S BUDGET NEXT DAY >
    ===================================================== */

    if ($("dashboardNextDate")) {

        $("dashboardNextDate")
            .addEventListener(
                "click",
                () => {

                    $("dashboardDate").value =
                        shiftDate(
                            $("dashboardDate").value,
                            1
                        );

                    updateDailyAllocationAvailable();

                    updateDailyDashboard();
                }
            );
    }


    /* TRANSACTION HISTORY DATE */

    if ($("historyDate")) {

        $("historyDate")
            .addEventListener(
                "change",
                renderHistory
            );
    }


    /* HISTORY PREVIOUS */

    if ($("previousDate")) {

        $("previousDate")
            .addEventListener(
                "click",
                () => {

                    $("historyDate").value =
                        shiftDate(
                            $("historyDate").value,
                            -1
                        );

                    renderHistory();
                }
            );
    }


    /* HISTORY NEXT */

    if ($("nextDate")) {

        $("nextDate")
            .addEventListener(
                "click",
                () => {

                    $("historyDate").value =
                        shiftDate(
                            $("historyDate").value,
                            1
                        );

                    renderHistory();
                }
            );
    }
}


/* =========================================================
   START APP
========================================================= */

initializeDates();

bindEvents();

loadData();
