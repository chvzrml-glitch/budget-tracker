import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

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

let transactions = [];
let transfers = [];
let debts = [];
let allowanceEntries = [];
let dailyPlans = {};

let categoryBudgets = {
    Needs: 0,
    Wants: 0,
    Savings: 0
};

let selectedCategory = "Needs";

const $ = (id) => document.getElementById(id);

function money(value) {
    return `₱${(Number(value) || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function getToday() {
    const now = new Date();

    return `${now.getFullYear()}-${String(
        now.getMonth() + 1
    ).padStart(2, "0")}-${String(
        now.getDate()
    ).padStart(2, "0")}`;
}

function shiftDate(dateString, amount) {
    const [year, month, day] = dateString.split("-").map(Number);

    const date = new Date(
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
    return Array.isArray(value)
        ? value
        : [];
}

function uid() {
    return Date.now() + Math.floor(
        Math.random() * 100000
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

/* =====================================================
   REAL WALLET
===================================================== */

function calculateBalances() {
    const balances = {
        Cash: 0,
        Card: 0,
        Beep: 0
    };

    allowanceEntries.forEach((entry) => {
        if (
            balances[entry.account] !== undefined
        ) {
            balances[entry.account] +=
                Number(entry.amount) || 0;
        }
    });

    transactions.forEach((transaction) => {
        if (
            balances[transaction.payment] !== undefined
        ) {
            balances[transaction.payment] -=
                Number(transaction.amount) || 0;
        }
    });

    transfers.forEach((transfer) => {
        const amount =
            Number(transfer.amount) || 0;

        if (
            balances[transfer.from] !== undefined
        ) {
            balances[transfer.from] -= amount;
        }

        if (
            balances[transfer.to] !== undefined
        ) {
            balances[transfer.to] += amount;
        }
    });

    return balances;
}

/* =====================================================
   SPENDING
===================================================== */

function spendingForDate(date) {
    return transactions
        .filter(
            (transaction) =>
                transaction.date === date
        )
        .reduce(
            (total, transaction) =>
                total +
                (Number(transaction.amount) || 0),
            0
        );
}

function categorySpent(category) {
    return transactions
        .filter(
            (transaction) =>
                transaction.category === category
        )
        .reduce(
            (total, transaction) =>
                total +
                (Number(transaction.amount) || 0),
            0
        );
}

/* =====================================================
   OUTFLOW RESERVE
===================================================== */

function getSortedPlanDatesBefore(targetDate) {
    return Object.keys(dailyPlans)
        .filter(
            (date) => date < targetDate
        )
        .sort();
}

function calculateOutflowReserveBefore(targetDate) {
    let reserve = 0;

    const dates =
        getSortedPlanDatesBefore(targetDate);

    dates.forEach((date) => {
        const baseAllowance =
            Number(
                dailyPlans[date]?.limit
            ) || 0;

        const spent =
            spendingForDate(date);

        const availableThatDay =
            baseAllowance + reserve;

        reserve = Math.max(
            0,
            availableThatDay - spent
        );
    });

    return reserve;
}

function calculateDailyBudgetState(date) {
    const plan =
        dailyPlans[date] || {
            event: "",
            limit: 0
        };

    const baseAllowance =
        Number(plan.limit) || 0;

    const reserveBeforeToday =
        calculateOutflowReserveBefore(date);

    const totalAvailable =
        baseAllowance +
        reserveBeforeToday;

    const spentToday =
        spendingForDate(date);

    const remainingToday =
        totalAvailable -
        spentToday;

    return {
        event:
            plan.event || "",

        baseAllowance,

        reserveBeforeToday,

        totalAvailable,

        spentToday,

        remainingToday
    };
}

/* =====================================================
   PROGRESS
===================================================== */

function percentage(spent, available) {
    available =
        Number(available) || 0;

    if (
        available <= 0
    ) {
        return 0;
    }

    return Math.min(
        100,
        Math.max(
            0,
            (spent / available) * 100
        )
    );
}

function setProgress(
    element,
    spent,
    available
) {
    const percent =
        percentage(
            spent,
            available
        );

    element.style.width =
        `${percent}%`;

    element.classList.toggle(
        "over",
        Number(available) > 0 &&
        Number(spent) >
        Number(available)
    );
}

/* =====================================================
   DASHBOARD
===================================================== */

function updateDashboard() {
    const balances =
        calculateBalances();

    const walletTotal =
        balances.Cash +
        balances.Card +
        balances.Beep;

    $("sidebarCash").textContent =
        money(balances.Cash);

    $("sidebarCard").textContent =
        money(balances.Card);

    $("sidebarBeep").textContent =
        money(balances.Beep);

    $("sidebarTotal").textContent =
        money(walletTotal);

    $("cashBalance").textContent =
        money(balances.Cash);

    $("cardBalance").textContent =
        money(balances.Card);

    $("beepBalance").textContent =
        money(balances.Beep);

    $("walletTotal").textContent =
        money(walletTotal);

    const date =
        $("dashboardDate").value;

    const state =
        calculateDailyBudgetState(date);

    $("eventTitle").textContent =
        state.event ||
        "No event set";

    $("dailyAvailableBig").textContent =
        money(
            state.totalAvailable
        );

    $("dailyAvailableText").textContent =
        `${money(
            state.remainingToday
        )} remaining after today's spending`;

    $("outflowReserve").textContent =
        `+${money(
            state.reserveBeforeToday
        )}`;

    $("baseAllowance").textContent =
        money(
            state.baseAllowance
        );

    $("reserveBreakdown").textContent =
        `+${money(
            state.reserveBeforeToday
        )}`;

    $("spentToday").textContent =
        `-${money(
            state.spentToday
        )}`;

    $("remainingToday").textContent =
        money(
            state.remainingToday
        );

    $("dailySpentLabel").textContent =
        `Spent ${money(
            state.spentToday
        )}`;

    $("dailyPercentLabel").textContent =
        state.totalAvailable > 0
            ? `${Math.round(
                (
                    state.spentToday /
                    state.totalAvailable
                ) *
                100
            )}%`
            : "0%";

    setProgress(
        $("dailyProgress"),
        state.spentToday,
        state.totalAvailable
    );

    updateCategoryCard(
        "Needs",
        "needs"
    );

    updateCategoryCard(
        "Wants",
        "wants"
    );

    updateCategoryCard(
        "Savings",
        "savings"
    );
}

function updateCategoryCard(
    category,
    prefix
) {
    const budget =
        Number(
            categoryBudgets[category]
        ) || 0;

    const spent =
        categorySpent(category);

    const remaining =
        budget - spent;

    $(`${prefix}Remaining`).textContent =
        money(remaining);

    $(`${prefix}BudgetLabel`).textContent =
        `${money(spent)} / ${money(budget)}`;

    setProgress(
        $(`${prefix}Progress`),
        spent,
        budget
    );
}

/* =====================================================
   HISTORY
===================================================== */

function renderHistory() {
    const date =
        $("historyDate").value;

    const transactionsToday =
        transactions.filter(
            (transaction) =>
                transaction.date === date
        );

    const transfersToday =
        transfers.filter(
            (transfer) =>
                transfer.date === date
        );

    const allowanceToday =
        allowanceEntries.filter(
            (allowance) =>
                allowance.date === date
        );

    const list =
        $("transactionList");

    list.innerHTML = "";

    const state =
        calculateDailyBudgetState(date);

    if (
        dailyPlans[date]
    ) {
        $("historyEvent").textContent =
            `${state.event || "No event"} • Base ${money(
                state.baseAllowance
            )} • Reserve +${money(
                state.reserveBeforeToday
            )}`;
    } else {
        $("historyEvent").textContent =
            "No event saved for this date.";
    }

    const rows = [
        ...transactionsToday.map(
            (item) => ({
                type: "transaction",
                time: item.id,
                item
            })
        ),

        ...transfersToday.map(
            (item) => ({
                type: "transfer",
                time: item.id,
                item
            })
        ),

        ...allowanceToday.map(
            (item) => ({
                type: "allowance",
                time: item.id,
                item
            })
        )
    ];

    rows.sort(
        (a, b) =>
            b.time - a.time
    );

    if (
        rows.length === 0
    ) {
        list.innerHTML = `
            <p class="empty">
                No transactions for this date.
            </p>
        `;
    }

    rows.forEach((row) => {
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

        const price =
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

            price.textContent =
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

            price.textContent =
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

            price.textContent =
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
            price,
            deleteButton
        );

        wrapper.append(
            info,
            actions
        );

        list.appendChild(
            wrapper
        );
    });

    $("dailyTotal").textContent =
        money(
            spendingForDate(date)
        );
}

/* =====================================================
   LIST ITEM
===================================================== */

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

/* =====================================================
   ALLOWANCE LIST
===================================================== */

function renderAllowanceList() {
    const list =
        $("allowanceList");

    list.innerHTML = "";

    const sorted =
        [...allowanceEntries]
            .sort(
                (a, b) =>
                    b.id - a.id
            )
            .slice(
                0,
                10
            );

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

    sorted.forEach((entry) => {
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
    });
}

/* =====================================================
   TRANSFER LIST
===================================================== */

function renderTransferList() {
    const list =
        $("transferList");

    list.innerHTML = "";

    const sorted =
        [...transfers]
            .sort(
                (a, b) =>
                    b.id - a.id
            )
            .slice(
                0,
                10
            );

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

    sorted.forEach((entry) => {
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
    });
}

/* =====================================================
   UTANG LIST
===================================================== */

function renderDebts() {
    const list =
        $("debtList");

    list.innerHTML = "";

    const total =
        debts.reduce(
            (sum, debt) =>
                sum +
                (
                    Number(
                        debt.amount
                    ) || 0
                ),
            0
        );

    $("debtBalance").textContent =
        money(total);

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
                b.id - a.id
        )
        .forEach((debt) => {
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

            const amount =
                document.createElement(
                    "strong"
                );

            amount.textContent =
                money(
                    debt.amount
                );

            const edit =
                document.createElement(
                    "button"
                );

            edit.className =
                "edit-btn";

            edit.textContent =
                "Edit";

            edit.addEventListener(
                "click",
                () =>
                    editDebt(
                        debt.id
                    )
            );

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
                () =>
                    deleteDebt(
                        debt.id
                    )
            );

            actions.append(
                amount,
                edit,
                remove
            );

            item.append(
                info,
                actions
            );

            list.appendChild(
                item
            );
        });
}

/* =====================================================
   ADD TRANSACTION
===================================================== */

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

    const balances =
        calculateBalances();

    if (
        amount >
        balances[payment]
    ) {
        alert(
            `Not enough ${payment} balance. Available: ${money(
                balances[payment]
            )}`
        );

        return;
    }

    if (
        selectedCategory ===
        "Savings"
    ) {
        const okay =
            confirm(
                "This transaction will use your Emergency Savings category. Continue?"
            );

        if (!okay) {
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

    $("historyDate").value =
        date;

    $("dashboardDate").value =
        date;

    await saveData();

    refreshAll();
}

/* =====================================================
   ADD ALLOWANCE
===================================================== */

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

/* =====================================================
   TRANSFER
===================================================== */

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
        calculateBalances();

    if (
        amount >
        balances[from]
    ) {
        alert(
            `Not enough ${from} balance. Available: ${money(
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

/* =====================================================
   UTANG
===================================================== */

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

    $("debtName").value =
        "";

    $("debtAmount").value =
        "";

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

    const newName =
        prompt(
            "Name:",
            debt.name
        );

    if (
        newName === null
    ) {
        return;
    }

    const newAmountRaw =
        prompt(
            "Amount:",
            debt.amount
        );

    if (
        newAmountRaw === null
    ) {
        return;
    }

    const newAmount =
        Number(
            newAmountRaw
        );

    if (
        !newName.trim() ||
        !Number.isFinite(
            newAmount
        ) ||
        newAmount <= 0
    ) {
        alert(
            "Invalid debt details."
        );

        return;
    }

    debt.name =
        newName.trim();

    debt.amount =
        newAmount;

    await saveData();

    renderDebts();
}

/* =====================================================
   DELETE
===================================================== */

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

    renderDebts();
}

/* =====================================================
   DAILY PLAN
===================================================== */

async function saveDailyPlan() {
    const date =
        $("dashboardDate").value;

    const event =
        $("eventName")
            .value
            .trim();

    const limit =
        Number(
            $("dailyLimit").value
        );

    if (
        !date ||
        !Number.isFinite(limit) ||
        limit < 0
    ) {
        alert(
            "Enter a valid base allowance."
        );

        return;
    }

    dailyPlans[date] = {
        event,
        limit
    };

    await saveData();

    closeModal();

    refreshAll();
}

/* =====================================================
   CATEGORY BUDGET
===================================================== */

async function saveBudgets() {
    const needs =
        Number(
            $("needsBudget").value
        );

    const wants =
        Number(
            $("wantsBudget").value
        );

    const savings =
        Number(
            $("savingsBudget").value
        );

    if (
        [needs, wants, savings]
            .some(
                (value) =>
                    !Number.isFinite(
                        value
                    ) ||
                    value < 0
            )
    ) {
        alert(
            "Enter valid category budgets."
        );

        return;
    }

    categoryBudgets = {
        Needs: needs,
        Wants: wants,
        Savings: savings
    };

    await saveData();

    closeModal();

    updateDashboard();
}

/* =====================================================
   MODALS
===================================================== */

function openModal(panelId) {
    $("modalBackdrop")
        .classList
        .remove("hidden");

    document
        .querySelectorAll(
            "[data-modal-panel]"
        )
        .forEach(
            (panel) =>
                panel
                    .classList
                    .add("hidden")
        );

    $(panelId)
        .classList
        .remove("hidden");

    if (
        panelId ===
        "dailyPlanPanel"
    ) {
        const plan =
            dailyPlans[
                $("dashboardDate").value
            ] || {
                event: "",
                limit: 0
            };

        $("eventName").value =
            plan.event || "";

        $("dailyLimit").value =
            Number(
                plan.limit
            ) || 0;
    }

    if (
        panelId ===
        "budgetPanel"
    ) {
        $("needsBudget").value =
            Number(
                categoryBudgets.Needs
            ) || 0;

        $("wantsBudget").value =
            Number(
                categoryBudgets.Wants
            ) || 0;

        $("savingsBudget").value =
            Number(
                categoryBudgets.Savings
            ) || 0;
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
            (panel) =>
                panel
                    .classList
                    .add("hidden")
        );
}

/* =====================================================
   SAVE / LOAD
===================================================== */

function getPayload() {
    return {
        version: 3,
        transactions,
        transfers,
        debts,
        allowanceEntries,
        dailyPlans,
        categoryBudgets
    };
}

async function saveData() {
    $("syncStatus").textContent =
        "Saving…";

    const payload =
        getPayload();

    localStorage.setItem(
        "budgetTrackerV3",
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

        $("syncStatus").textContent =
            "✓ Synced with Firebase";
    } catch (error) {
        console.error(
            "Firebase save error:",
            error
        );

        $("syncStatus").textContent =
            "Offline copy saved on this device";
    }
}

function loadLocal() {
    try {
        const raw =
            localStorage.getItem(
                "budgetTrackerV3"
            ) ||
            localStorage.getItem(
                "budgetTrackerV2"
            );

        return raw
            ? JSON.parse(raw)
            : null;
    } catch {
        return null;
    }
}

function migrateData(data) {
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

    if (
        Array.isArray(
            data.allowanceEntries
        )
    ) {
        allowanceEntries =
            data.allowanceEntries;
    } else if (
        data.startingBalances
    ) {
        allowanceEntries =
            Object.entries(
                data.startingBalances
            )
                .filter(
                    ([, amount]) =>
                        Number(amount) > 0
                )
                .map(
                    (
                        [account, amount],
                        index
                    ) => ({
                        id:
                            uid() + index,

                        date:
                            getToday(),

                        account,

                        amount:
                            Number(amount)
                    })
                );
    }

    if (
        data.dailyPlans &&
        typeof data.dailyPlans ===
        "object"
    ) {
        dailyPlans =
            data.dailyPlans;
    } else if (
        data.events &&
        typeof data.events ===
        "object"
    ) {
        dailyPlans = {};

        Object.entries(
            data.events
        )
            .forEach(
                ([date, value]) => {
                    dailyPlans[date] = {
                        event:
                            typeof value ===
                            "string"
                                ? value
                                : "",

                        limit: 0
                    };
                }
            );
    }

    if (
        data.categoryBudgets &&
        typeof data.categoryBudgets ===
        "object"
    ) {
        categoryBudgets = {
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
    }
}

async function loadData() {
    $("syncStatus").textContent =
        "Loading Firebase data…";

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
                "budgetTrackerV3",
                JSON.stringify(
                    getPayload()
                )
            );

            $("syncStatus").textContent =
                "✓ Synced with Firebase";
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

        $("syncStatus").textContent =
            "Offline mode • using device backup";
    }

    refreshAll();
}

/* =====================================================
   REFRESH
===================================================== */

function refreshAll() {
    updateDashboard();
    renderHistory();
    renderAllowanceList();
    renderTransferList();
    renderDebts();
}

/* =====================================================
   INIT
===================================================== */

function initializeDates() {
    const today =
        getToday();

    $("dashboardDate").value =
        today;

    $("transactionDate").value =
        today;

    $("historyDate").value =
        today;

    $("allowanceDate").value =
        today;

    $("transferDate").value =
        today;
}

function bindEvents() {
    document
        .querySelectorAll(
            ".choice[data-category]"
        )
        .forEach((button) => {
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
                            (otherButton) =>
                                otherButton
                                    .classList
                                    .remove(
                                        "selected"
                                    )
                        );

                    button
                        .classList
                        .add(
                            "selected"
                        );
                }
            );
        });

    document
        .querySelectorAll(
            ".nav-btn[data-panel]"
        )
        .forEach((button) => {
            button.addEventListener(
                "click",
                () => {
                    document
                        .querySelectorAll(
                            ".nav-btn"
                        )
                        .forEach(
                            (otherButton) =>
                                otherButton
                                    .classList
                                    .remove(
                                        "active"
                                    )
                        );

                    button
                        .classList
                        .add(
                            "active"
                        );

                    openModal(
                        button.dataset.panel
                    );
                }
            );
        });

    document
        .querySelectorAll(
            ".close-modal"
        )
        .forEach(
            (button) =>
                button.addEventListener(
                    "click",
                    closeModal
                )
        );

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

    $("editDailyPlanBtn")
        .addEventListener(
            "click",
            () =>
                openModal(
                    "dailyPlanPanel"
                )
        );

    $("editBudgetsBtn")
        .addEventListener(
            "click",
            () =>
                openModal(
                    "budgetPanel"
                )
        );

    $("addTransactionBtn")
        .addEventListener(
            "click",
            addTransaction
        );

    $("addAllowanceBtn")
        .addEventListener(
            "click",
            addAllowance
        );

    $("transferMoneyBtn")
        .addEventListener(
            "click",
            addTransfer
        );

    $("addDebtBtn")
        .addEventListener(
            "click",
            addDebt
        );

    $("saveDailyPlanBtn")
        .addEventListener(
            "click",
            saveDailyPlan
        );

    $("saveBudgetsBtn")
        .addEventListener(
            "click",
            saveBudgets
        );

    $("dashboardDate")
        .addEventListener(
            "change",
            () => {
                $("transactionDate").value =
                    $("dashboardDate").value;

                $("historyDate").value =
                    $("dashboardDate").value;

                refreshAll();
            }
        );

    $("historyDate")
        .addEventListener(
            "change",
            renderHistory
        );

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

initializeDates();
bindEvents();
loadData();
