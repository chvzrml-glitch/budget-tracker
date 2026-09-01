// ======================================================
// FIREBASE
// ======================================================

import { initializeApp } from
"https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
    getFirestore,
    doc,
    getDoc,
    setDoc
} from
"https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


// ======================================================
// FIREBASE CONFIG
// ======================================================

const firebaseConfig = {
    apiKey: "AIzaSyC-Ye3G7g5fVu0-vq99y_EZOM3oBxLf2Hc",
    authDomain: "budget-tracker-86c5b.firebaseapp.com",
    projectId: "budget-tracker-86c5b",
    storageBucket: "budget-tracker-86c5b.firebasestorage.app",
    messagingSenderId: "253859931650",
    appId: "1:253859931650:web:96e803218deaffe863a91b"
};


// ======================================================
// FIREBASE INITIALIZE
// ======================================================

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const budgetDoc = doc(db, "budgetTracker", "main");


// ======================================================
// DATA
// ======================================================

let transactions = [];
let debts = [];
let transfers = [];
let events = {};

let startingBalances = {
    Cash: 0,
    Card: 0,
    Beep: 0
};

let selectedCategory = "";
let selectedPayment = "";


// ======================================================
// DATE FUNCTIONS
// ======================================================

function getToday() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// ======================================================
// AUTOMATICALLY UPGRADE YOUR OLD HTML
// ======================================================

function upgradeInterface() {

    // --------------------------------------------------
    // STARTING MONEY
    // --------------------------------------------------

    const startingMoneyContainer =
        document.querySelector(".starting-money");

    if (startingMoneyContainer) {

        startingMoneyContainer.innerHTML = `
            <div class="starting-balance-field">
                <label for="startingCash">💵 Cash</label>
                <input
                    type="number"
                    id="startingCash"
                    placeholder="₱0.00"
                    min="0"
                    step="0.01"
                >
            </div>

            <div class="starting-balance-field">
                <label for="startingCard">💳 Card</label>
                <input
                    type="number"
                    id="startingCard"
                    placeholder="₱0.00"
                    min="0"
                    step="0.01"
                >
            </div>

            <div class="starting-balance-field">
                <label for="startingBeep">🚆 Beep</label>
                <input
                    type="number"
                    id="startingBeep"
                    placeholder="₱0.00"
                    min="0"
                    step="0.01"
                >
            </div>

            <button id="setMoneyBtn">
                Save Starting Money
            </button>
        `;
    }


    // --------------------------------------------------
    // ADD BEEP PAYMENT METHOD
    // --------------------------------------------------

    const cardPaymentButton =
        document.querySelector('[data-payment="Card"]');

    if (
        cardPaymentButton &&
        !document.querySelector('[data-payment="Beep"]')
    ) {

        const beepButton = document.createElement("button");

        beepButton.className = "choice";
        beepButton.dataset.payment = "Beep";
        beepButton.innerHTML = "🚆 Beep";

        cardPaymentButton.parentElement.appendChild(beepButton);
    }


    // --------------------------------------------------
    // TRANSFER MONEY
    // --------------------------------------------------

    const addTransactionButton =
        document.getElementById("addTransactionBtn");

    if (
        addTransactionButton &&
        !document.getElementById("transferBox")
    ) {

        const transferBox = document.createElement("div");

        transferBox.id = "transferBox";
        transferBox.className = "transfer-box";

        transferBox.innerHTML = `
            <h3>🔄 Transfer Money</h3>

            <div class="transfer-grid">

                <div>
                    <label for="transferDate">Date</label>

                    <input
                        type="date"
                        id="transferDate"
                    >
                </div>

                <div>
                    <label for="transferFrom">From</label>

                    <select id="transferFrom">
                        <option value="Cash">💵 Cash</option>
                        <option value="Card">💳 Card</option>
                        <option value="Beep">🚆 Beep</option>
                    </select>
                </div>

                <div>
                    <label for="transferTo">To</label>

                    <select id="transferTo">
                        <option value="Card">💳 Card</option>
                        <option value="Cash">💵 Cash</option>
                        <option value="Beep">🚆 Beep</option>
                    </select>
                </div>

                <div>
                    <label for="transferAmount">Amount</label>

                    <input
                        type="number"
                        id="transferAmount"
                        placeholder="₱0.00"
                        min="0"
                        step="0.01"
                    >
                </div>

            </div>

            <button
                id="transferMoneyBtn"
                class="secondary-btn transfer-btn"
            >
                Transfer Money
            </button>
        `;

        addTransactionButton.insertAdjacentElement(
            "afterend",
            transferBox
        );
    }


    // --------------------------------------------------
    // EVENT FOR SELECTED DATE
    // --------------------------------------------------

    const dateNavigation =
        document.querySelector(".date-navigation");

    if (
        dateNavigation &&
        !document.getElementById("eventBox")
    ) {

        const eventBox = document.createElement("div");

        eventBox.id = "eventBox";
        eventBox.className = "event-box";

        eventBox.innerHTML = `
            <label for="eventInput">
                📅 Event / Note for this day
            </label>

            <div class="event-input-row">

                <input
                    type="text"
                    id="eventInput"
                    placeholder="e.g. School, Gym, Birthday..."
                >

                <button
                    id="saveEventBtn"
                    class="secondary-btn"
                >
                    Save
                </button>

            </div>

            <div
                id="eventDisplay"
                class="event-display"
            ></div>
        `;

        dateNavigation.insertAdjacentElement(
            "afterend",
            eventBox
        );
    }


    // --------------------------------------------------
    // SUMMARY REDESIGN
    // --------------------------------------------------

    const summary =
        document.querySelector(".summary");

    if (summary) {

        const summaryBoxes =
            summary.querySelectorAll(".summary-box");

        if (summaryBoxes.length >= 2) {

            summaryBoxes[0].innerHTML = `
                <h3>💰 Money Breakdown</h3>

                <div class="summary-row">
                    <span>💵 Cash</span>
                    <strong id="cashSpent">
                        ₱0.00
                    </strong>
                </div>

                <div class="summary-row">
                    <span>💳 Card</span>
                    <strong id="cardSpent">
                        ₱0.00
                    </strong>
                </div>

                <div class="summary-row">
                    <span>🚆 Beep</span>
                    <strong id="beepSpent">
                        ₱0.00
                    </strong>
                </div>

                <div class="summary-row remaining">
                    <span>Total Spent</span>
                    <strong id="totalSpent">
                        ₱0.00
                    </strong>
                </div>
            `;


            summaryBoxes[1].innerHTML = `
                <h3>💵 Remaining</h3>

                <div class="summary-row">
                    <span>💵 Cash</span>
                    <strong id="cashRemaining">
                        ₱0.00
                    </strong>
                </div>

                <div class="summary-row">
                    <span>💳 Card</span>
                    <strong id="cardRemaining">
                        ₱0.00
                    </strong>
                </div>

                <div class="summary-row">
                    <span>🚆 Beep</span>
                    <strong id="beepRemaining">
                        ₱0.00
                    </strong>
                </div>

                <div class="summary-row remaining">
                    <span>Total Remaining</span>
                    <strong id="totalRemaining">
                        ₱0.00
                    </strong>
                </div>
            `;
        }


        if (summaryBoxes.length >= 3) {

            const debtBox = summaryBoxes[2];

            const debtHeading =
                debtBox.querySelector("h3");

            if (debtHeading) {
                debtHeading.textContent = "🧾 Utang";
            }


            const existingDebtSummary =
                document.getElementById(
                    "allDebtSummary"
                );

            if (!existingDebtSummary) {

                const debtRow =
                    document.createElement("div");

                debtRow.id = "allDebtSummary";
                debtRow.className = "summary-row";

                debtRow.innerHTML = `
                    <span>All Utang</span>

                    <strong id="debtBalance">
                        ₱0.00
                    </strong>
                `;

                const addDebtBtn =
                    debtBox.querySelector(
                        "#addDebtBtn"
                    );

                if (addDebtBtn) {
                    debtBox.insertBefore(
                        debtRow,
                        addDebtBtn
                    );
                }
            }
        }
    }


    // --------------------------------------------------
    // ADD EXTRA CSS
    // --------------------------------------------------

    const style = document.createElement("style");

    style.textContent = `

        .starting-money {
            align-items: end;
        }

        .starting-balance-field {
            flex: 1;
        }

        .starting-balance-field label {
            display: block;
            margin-bottom: 7px;
        }

        .transfer-box {
            margin-top: 25px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
        }

        .transfer-box h3 {
            margin-bottom: 15px;
        }

        .transfer-grid {
            display: grid;
            grid-template-columns:
                repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 12px;
        }

        .transfer-grid > div {
            display: flex;
            flex-direction: column;
        }

        .transfer-grid select {
            width: 100%;
            padding: 12px;
            border: 1px solid #ccc;
            border-radius: 8px;
            background: white;
            font-size: 15px;
        }

        .transfer-btn {
            width: 100%;
        }

        .event-box {
            padding: 12px;
            margin-bottom: 15px;
            background: #f7f7f7;
            border-radius: 10px;
        }

        .event-input-row {
            display: flex;
            gap: 8px;
        }

        .event-input-row input {
            flex: 1;
        }

        .event-display {
            margin-top: 10px;
            font-size: 14px;
            font-weight: bold;
        }

        .transfer-history {
            background: #fafafa;
        }

        @media (max-width: 768px) {

            .starting-money {
                align-items: stretch;
            }

            .transfer-grid {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .transfer-grid select {
                padding: 8px;
                font-size: 12px;
            }

            .transfer-box {
                margin-top: 15px;
                padding-top: 12px;
            }

            .transfer-box h3 {
                font-size: 13px;
                margin-bottom: 8px;
            }

            .event-box {
                padding: 8px;
                margin-bottom: 10px;
            }

            .event-input-row {
                flex-direction: column;
                gap: 5px;
            }

            .event-display {
                font-size: 10px;
            }
        }
    `;

    document.head.appendChild(style);
}


upgradeInterface();


// ======================================================
// ELEMENTS
// ======================================================

const startingCashInput =
    document.getElementById("startingCash");

const startingCardInput =
    document.getElementById("startingCard");

const startingBeepInput =
    document.getElementById("startingBeep");

const setMoneyBtn =
    document.getElementById("setMoneyBtn");


const dateInput =
    document.getElementById("date");

const descriptionInput =
    document.getElementById("description");

const amountInput =
    document.getElementById("amount");

const addTransactionBtn =
    document.getElementById("addTransactionBtn");


const historyDate =
    document.getElementById("historyDate");

const transactionList =
    document.getElementById("transactionList");

const dailyTotal =
    document.getElementById("dailyTotal");

const previousDateBtn =
    document.getElementById("previousDate");

const nextDateBtn =
    document.getElementById("nextDate");


const transferDate =
    document.getElementById("transferDate");

const transferFrom =
    document.getElementById("transferFrom");

const transferTo =
    document.getElementById("transferTo");

const transferAmount =
    document.getElementById("transferAmount");

const transferMoneyBtn =
    document.getElementById("transferMoneyBtn");


const eventInput =
    document.getElementById("eventInput");

const eventDisplay =
    document.getElementById("eventDisplay");

const saveEventBtn =
    document.getElementById("saveEventBtn");


const addDebtBtn =
    document.getElementById("addDebtBtn");


// ======================================================
// START DATES
// ======================================================

const today = getToday();

dateInput.value = today;
historyDate.value = today;

if (transferDate) {
    transferDate.value = today;
}


// ======================================================
// STARTING MONEY
// ======================================================

setMoneyBtn.addEventListener(
    "click",
    async function () {

        const cash =
            Number(startingCashInput.value);

        const card =
            Number(startingCardInput.value);

        const beep =
            Number(startingBeepInput.value);


        if (
            isNaN(cash) ||
            isNaN(card) ||
            isNaN(beep) ||
            cash < 0 ||
            card < 0 ||
            beep < 0
        ) {

            alert(
                "Please enter valid starting balances."
            );

            return;
        }


        startingBalances = {
            Cash: cash,
            Card: card,
            Beep: beep
        };


        updateSummary();

        await saveData();

        alert(
            "Starting balances saved!"
        );
    }
);


// ======================================================
// CATEGORY BUTTONS
// ======================================================

document
    .querySelectorAll("[data-category]")
    .forEach(function (button) {

        button.addEventListener(
            "click",
            function () {

                selectedCategory =
                    button.dataset.category;


                document
                    .querySelectorAll(
                        "[data-category]"
                    )
                    .forEach(function (btn) {

                        btn.classList.remove(
                            "selected"
                        );
                    });


                button.classList.add(
                    "selected"
                );
            }
        );
    });


// ======================================================
// PAYMENT BUTTONS
// ======================================================

document
    .querySelectorAll("[data-payment]")
    .forEach(function (button) {

        button.addEventListener(
            "click",
            function () {

                selectedPayment =
                    button.dataset.payment;


                document
                    .querySelectorAll(
                        "[data-payment]"
                    )
                    .forEach(function (btn) {

                        btn.classList.remove(
                            "selected"
                        );
                    });


                button.classList.add(
                    "selected"
                );
            }
        );
    });


// ======================================================
// ADD TRANSACTION
// ======================================================

addTransactionBtn.addEventListener(
    "click",
    async function () {

        const date =
            dateInput.value;

        const description =
            descriptionInput.value.trim();

        const amount =
            Number(amountInput.value);


        if (date === "") {
            alert("Please select a date.");
            return;
        }


        if (description === "") {
            alert(
                "Please enter what you spent on."
            );
            return;
        }


        if (
            isNaN(amount) ||
            amount <= 0
        ) {

            alert(
                "Please enter a valid amount."
            );

            return;
        }


        if (selectedCategory === "") {

            alert(
                "Please select a category."
            );

            return;
        }


        if (selectedPayment === "") {

            alert(
                "Please select a payment method."
            );

            return;
        }


        const transaction = {
            id: Date.now(),
            date: date,
            description: description,
            amount: amount,
            category: selectedCategory,
            payment: selectedPayment
        };


        transactions.push(transaction);


        historyDate.value = date;

        displayTransactions();
        updateSummary();

        await saveData();


        descriptionInput.value = "";
        amountInput.value = "";

        selectedCategory = "";
        selectedPayment = "";


        document
            .querySelectorAll(".choice")
            .forEach(function (button) {

                button.classList.remove(
                    "selected"
                );
            });


        alert("Transaction added!");
    }
);


// ======================================================
// TRANSFER MONEY
// ======================================================

transferMoneyBtn.addEventListener(
    "click",
    async function () {

        const from =
            transferFrom.value;

        const to =
            transferTo.value;

        const amount =
            Number(transferAmount.value);

        const date =
            transferDate.value;


        if (!date) {

            alert(
                "Please select a transfer date."
            );

            return;
        }


        if (from === to) {

            alert(
                "Please choose two different accounts."
            );

            return;
        }


        if (
            isNaN(amount) ||
            amount <= 0
        ) {

            alert(
                "Please enter a valid transfer amount."
            );

            return;
        }


        const balances =
            calculateCurrentBalances();


        if (amount > balances[from]) {

            alert(
                `Not enough ${from} balance.

Available: ₱${balances[from].toFixed(2)}`
            );

            return;
        }


        transfers.push({
            id: Date.now(),
            date: date,
            from: from,
            to: to,
            amount: amount
        });


        transferAmount.value = "";

        historyDate.value = date;

        displayTransactions();
        updateSummary();

        await saveData();


        alert(
            `₱${amount.toFixed(2)} transferred from ${from} to ${to}.`
        );
    }
);


// ======================================================
// CURRENT BALANCES
// ======================================================

function calculateCurrentBalances() {

    const balances = {
        Cash:
            Number(startingBalances.Cash) || 0,

        Card:
            Number(startingBalances.Card) || 0,

        Beep:
            Number(startingBalances.Beep) || 0
    };


    // Subtract spending
    transactions.forEach(
        function (transaction) {

            const amount =
                Number(transaction.amount) || 0;

            const payment =
                transaction.payment;


            if (
                Object.prototype.hasOwnProperty.call(
                    balances,
                    payment
                )
            ) {

                balances[payment] -= amount;
            }
        }
    );


    // Apply transfers
    transfers.forEach(
        function (transfer) {

            const amount =
                Number(transfer.amount) || 0;


            if (
                Object.prototype.hasOwnProperty.call(
                    balances,
                    transfer.from
                )
            ) {

                balances[transfer.from] -=
                    amount;
            }


            if (
                Object.prototype.hasOwnProperty.call(
                    balances,
                    transfer.to
                )
            ) {

                balances[transfer.to] +=
                    amount;
            }
        }
    );


    return balances;
}


// ======================================================
// TRANSACTION HISTORY
// ======================================================

function displayTransactions() {

    const selectedDate =
        historyDate.value;


    const filteredTransactions =
        transactions.filter(
            function (transaction) {

                return (
                    transaction.date ===
                    selectedDate
                );
            }
        );


    const filteredTransfers =
        transfers.filter(
            function (transfer) {

                return (
                    transfer.date ===
                    selectedDate
                );
            }
        );


    transactionList.innerHTML = "";


    if (
        filteredTransactions.length === 0 &&
        filteredTransfers.length === 0
    ) {

        transactionList.innerHTML = `
            <p class="empty">
                No transactions for this date.
            </p>
        `;

        dailyTotal.textContent =
            "₱0.00";

        displayEvent();

        return;
    }


    let total = 0;


    // --------------------------------------------------
    // NORMAL TRANSACTIONS
    // --------------------------------------------------

    filteredTransactions.forEach(
        function (transaction) {

            const amount =
                Number(transaction.amount) || 0;

            total += amount;


            const item =
                document.createElement("div");

            item.className =
                "transaction";


            const info =
                document.createElement("div");

            info.className =
                "transaction-info";


            const description =
                document.createElement("strong");

            description.textContent =
                transaction.description;


            const details =
                document.createElement("span");

            details.textContent =
                `${transaction.category} • ${transaction.payment}`;


            info.appendChild(description);
            info.appendChild(details);


            const right =
                document.createElement("div");

            right.className =
                "transaction-right";


            const price =
                document.createElement("strong");

            price.textContent =
                `₱${amount.toFixed(2)}`;


            const deleteButton =
                document.createElement("button");

            deleteButton.className =
                "delete-btn";

            deleteButton.textContent =
                "🗑️";


            deleteButton.addEventListener(
                "click",
                function () {

                    deleteTransaction(
                        transaction.id
                    );
                }
            );


            right.appendChild(price);
            right.appendChild(
                deleteButton
            );


            item.appendChild(info);
            item.appendChild(right);


            transactionList.appendChild(
                item
            );
        }
    );


    // --------------------------------------------------
    // TRANSFER HISTORY
    // --------------------------------------------------

    filteredTransfers.forEach(
        function (transfer) {

            const amount =
                Number(transfer.amount) || 0;


            const item =
                document.createElement("div");

            item.className =
                "transaction transfer-history";


            const info =
                document.createElement("div");

            info.className =
                "transaction-info";


            const title =
                document.createElement("strong");

            title.textContent =
                "🔄 Money Transfer";


            const details =
                document.createElement("span");

            details.textContent =
                `${transfer.from} → ${transfer.to}`;


            info.appendChild(title);
            info.appendChild(details);


            const right =
                document.createElement("div");

            right.className =
                "transaction-right";


            const price =
                document.createElement("strong");

            price.textContent =
                `₱${amount.toFixed(2)}`;


            const deleteButton =
                document.createElement("button");

            deleteButton.className =
                "delete-btn";

            deleteButton.textContent =
                "🗑️";


            deleteButton.addEventListener(
                "click",
                function () {

                    deleteTransfer(
                        transfer.id
                    );
                }
            );


            right.appendChild(price);
            right.appendChild(
                deleteButton
            );


            item.appendChild(info);
            item.appendChild(right);


            transactionList.appendChild(
                item
            );
        }
    );


    // Transfers are NOT included here
    dailyTotal.textContent =
        `₱${total.toFixed(2)}`;


    displayEvent();
}


// ======================================================
// DELETE TRANSACTION
// ======================================================

async function deleteTransaction(id) {

    const confirmed = confirm(
        "Delete this transaction?"
    );


    if (!confirmed) {
        return;
    }


    transactions =
        transactions.filter(
            function (transaction) {

                return (
                    transaction.id !== id
                );
            }
        );


    displayTransactions();
    updateSummary();

    await saveData();
}


// ======================================================
// DELETE TRANSFER
// ======================================================

async function deleteTransfer(id) {

    const confirmed = confirm(
        "Delete this transfer?"
    );


    if (!confirmed) {
        return;
    }


    transfers =
        transfers.filter(
            function (transfer) {

                return (
                    transfer.id !== id
                );
            }
        );


    displayTransactions();
    updateSummary();

    await saveData();
}


// ======================================================
// DATE NAVIGATION
// ======================================================

previousDateBtn.addEventListener(
    "click",
    function () {

        const currentDate =
            new Date(
                historyDate.value +
                "T00:00:00"
            );


        currentDate.setDate(
            currentDate.getDate() - 1
        );


        historyDate.value =
            formatDate(currentDate);


        displayTransactions();
    }
);


nextDateBtn.addEventListener(
    "click",
    function () {

        const currentDate =
            new Date(
                historyDate.value +
                "T00:00:00"
            );


        currentDate.setDate(
            currentDate.getDate() + 1
        );


        historyDate.value =
            formatDate(currentDate);


        displayTransactions();
    }
);


historyDate.addEventListener(
    "change",
    function () {

        displayTransactions();
    }
);


// ======================================================
// EVENT / NOTE
// ======================================================

saveEventBtn.addEventListener(
    "click",
    async function () {

        const selectedDate =
            historyDate.value;

        const text =
            eventInput.value.trim();


        if (!selectedDate) {

            alert(
                "Please select a date."
            );

            return;
        }


        if (text === "") {

            delete events[selectedDate];

        } else {

            events[selectedDate] =
                text;
        }


        displayEvent();

        await saveData();


        alert(
            text === ""
                ? "Event removed!"
                : "Event saved!"
        );
    }
);


function displayEvent() {

    const selectedDate =
        historyDate.value;


    const text =
        events[selectedDate] || "";


    eventInput.value = text;


    if (text === "") {

        eventDisplay.textContent =
            "No event saved for this date.";

    } else {

        eventDisplay.textContent =
            `📌 ${text}`;
    }
}


// ======================================================
// ADD UTANG
// ======================================================

addDebtBtn.addEventListener(
    "click",
    async function () {

        const person = prompt(
            "Name of the person:"
        );


        if (
            person === null ||
            person.trim() === ""
        ) {

            return;
        }


        const amountText = prompt(
            "How much do they owe you?"
        );


        if (amountText === null) {
            return;
        }


        const amount =
            Number(amountText);


        if (
            isNaN(amount) ||
            amount <= 0
        ) {

            alert(
                "Please enter a valid amount."
            );

            return;
        }


        const debt = {
            id: Date.now(),
            person: person.trim(),
            amount: amount
        };


        debts.push(debt);


        displayDebts();
        updateSummary();

        await saveData();


        alert(
            `${person.trim()} added!\nThey owe you ₱${amount.toFixed(2)}`
        );
    }
);


// ======================================================
// DISPLAY UTANG
// ======================================================

function displayDebts() {

    const debtList =
        document.getElementById(
            "debtList"
        );


    debtList.innerHTML = "";


    if (debts.length === 0) {

        debtList.innerHTML = `
            <p class="empty">
                No utang recorded.
            </p>
        `;

        return;
    }


    debts.forEach(
        function (debt) {

            const item =
                document.createElement("div");

            item.className =
                "debt-item";


            const info =
                document.createElement("div");


            const person =
                document.createElement("strong");

            person.textContent =
                debt.person;


            const lineBreak =
                document.createElement("br");


            const amount =
                document.createElement("span");

            amount.textContent =
                `₱${Number(
                    debt.amount
                ).toFixed(2)}`;


            info.appendChild(person);
            info.appendChild(lineBreak);
            info.appendChild(amount);


            const buttons =
                document.createElement("div");


            const editButton =
                document.createElement("button");

            editButton.className =
                "delete-btn edit-debt-btn";

            editButton.textContent =
                "✏️";


            editButton.addEventListener(
                "click",
                function () {

                    editDebt(
                        debt.id
                    );
                }
            );


            const deleteButton =
                document.createElement("button");

            deleteButton.className =
                "delete-btn delete-debt-btn";

            deleteButton.textContent =
                "🗑️";


            deleteButton.addEventListener(
                "click",
                function () {

                    deleteDebt(
                        debt.id
                    );
                }
            );


            buttons.appendChild(
                editButton
            );

            buttons.appendChild(
                deleteButton
            );


            item.appendChild(info);
            item.appendChild(buttons);


            debtList.appendChild(
                item
            );
        }
    );
}


// ======================================================
// EDIT UTANG
// ======================================================

async function editDebt(id) {

    const debt =
        debts.find(
            function (debt) {

                return (
                    debt.id === id
                );
            }
        );


    if (!debt) {
        return;
    }


    const newPerson = prompt(
        "Name of the person:",
        debt.person
    );


    if (
        newPerson === null ||
        newPerson.trim() === ""
    ) {

        return;
    }


    const newAmountText = prompt(
        "How much do they owe you?",
        debt.amount
    );


    if (newAmountText === null) {
        return;
    }


    const newAmount =
        Number(newAmountText);


    if (
        isNaN(newAmount) ||
        newAmount <= 0
    ) {

        alert(
            "Please enter a valid amount."
        );

        return;
    }


    debt.person =
        newPerson.trim();

    debt.amount =
        newAmount;


    displayDebts();
    updateSummary();

    await saveData();


    alert("Utang updated!");
}


// ======================================================
// DELETE UTANG
// ======================================================

async function deleteDebt(id) {

    const confirmed = confirm(
        "Delete this utang?"
    );


    if (!confirmed) {
        return;
    }


    debts =
        debts.filter(
            function (debt) {

                return (
                    debt.id !== id
                );
            }
        );


    displayDebts();
    updateSummary();

    await saveData();
}


// ======================================================
// SUMMARY
// ======================================================

function updateSummary() {

    let cashSpent = 0;
    let cardSpent = 0;
    let beepSpent = 0;

    let totalDebt = 0;


    transactions.forEach(
        function (transaction) {

            const amount =
                Number(
                    transaction.amount
                ) || 0;


            if (
                transaction.payment ===
                "Cash"
            ) {

                cashSpent += amount;
            }


            if (
                transaction.payment ===
                "Card"
            ) {

                cardSpent += amount;
            }


            if (
                transaction.payment ===
                "Beep"
            ) {

                beepSpent += amount;
            }
        }
    );


    debts.forEach(
        function (debt) {

            totalDebt +=
                Number(debt.amount) || 0;
        }
    );


    const totalSpent =
        cashSpent +
        cardSpent +
        beepSpent;


    const balances =
        calculateCurrentBalances();


    const totalRemaining =
        balances.Cash +
        balances.Card +
        balances.Beep;


    document
        .getElementById(
            "cashSpent"
        )
        .textContent =
            `₱${cashSpent.toFixed(2)}`;


    document
        .getElementById(
            "cardSpent"
        )
        .textContent =
            `₱${cardSpent.toFixed(2)}`;


    document
        .getElementById(
            "beepSpent"
        )
        .textContent =
            `₱${beepSpent.toFixed(2)}`;


    document
        .getElementById(
            "totalSpent"
        )
        .textContent =
            `₱${totalSpent.toFixed(2)}`;


    document
        .getElementById(
            "cashRemaining"
        )
        .textContent =
            `₱${balances.Cash.toFixed(2)}`;


    document
        .getElementById(
            "cardRemaining"
        )
        .textContent =
            `₱${balances.Card.toFixed(2)}`;


    document
        .getElementById(
            "beepRemaining"
        )
        .textContent =
            `₱${balances.Beep.toFixed(2)}`;


    document
        .getElementById(
            "totalRemaining"
        )
        .textContent =
            `₱${totalRemaining.toFixed(2)}`;


    const debtBalance =
        document.getElementById(
            "debtBalance"
        );


    if (debtBalance) {

        debtBalance.textContent =
            `₱${totalDebt.toFixed(2)}`;
    }
}


// ======================================================
// LOCAL STORAGE BACKUP
// ======================================================

function saveLocalBackup() {

    localStorage.setItem(
        "budgetTransactions",
        JSON.stringify(
            transactions
        )
    );


    localStorage.setItem(
        "budgetDebts",
        JSON.stringify(
            debts
        )
    );


    localStorage.setItem(
        "budgetTransfers",
        JSON.stringify(
            transfers
        )
    );


    localStorage.setItem(
        "budgetEvents",
        JSON.stringify(
            events
        )
    );


    localStorage.setItem(
        "budgetStartingBalances",
        JSON.stringify(
            startingBalances
        )
    );
}


// ======================================================
// LOAD LOCAL BACKUP
// ======================================================

function loadLocalBackup() {

    try {

        const savedTransactions =
            localStorage.getItem(
                "budgetTransactions"
            );

        const savedDebts =
            localStorage.getItem(
                "budgetDebts"
            );

        const savedTransfers =
            localStorage.getItem(
                "budgetTransfers"
            );

        const savedEvents =
            localStorage.getItem(
                "budgetEvents"
            );

        const savedBalances =
            localStorage.getItem(
                "budgetStartingBalances"
            );


        if (savedTransactions) {

            transactions =
                JSON.parse(
                    savedTransactions
                );
        }


        if (savedDebts) {

            debts =
                JSON.parse(
                    savedDebts
                );
        }


        if (savedTransfers) {

            transfers =
                JSON.parse(
                    savedTransfers
                );
        }


        if (savedEvents) {

            events =
                JSON.parse(
                    savedEvents
                );
        }


        if (savedBalances) {

            const balances =
                JSON.parse(
                    savedBalances
                );


            startingBalances = {
                Cash:
                    Number(
                        balances.Cash
                    ) || 0,

                Card:
                    Number(
                        balances.Card
                    ) || 0,

                Beep:
                    Number(
                        balances.Beep
                    ) || 0
            };

        } else {

            // OLD VERSION MIGRATION
            const oldStartingMoney =
                localStorage.getItem(
                    "budgetStartingMoney"
                );


            if (
                oldStartingMoney !== null
            ) {

                startingBalances.Cash =
                    Number(
                        oldStartingMoney
                    ) || 0;
            }
        }

    } catch (error) {

        console.error(
            "Local backup error:",
            error
        );
    }
}


// ======================================================
// FILL STARTING INPUTS
// ======================================================

function fillStartingInputs() {

    startingCashInput.value =
        Number(
            startingBalances.Cash
        ) || 0;


    startingCardInput.value =
        Number(
            startingBalances.Card
        ) || 0;


    startingBeepInput.value =
        Number(
            startingBalances.Beep
        ) || 0;
}


// ======================================================
// SAVE FIREBASE
// ======================================================

async function saveData() {

    saveLocalBackup();


    try {

        await setDoc(
            budgetDoc,
            {
                transactions:
                    transactions,

                debts:
                    debts,

                transfers:
                    transfers,

                events:
                    events,

                startingBalances:
                    startingBalances
            }
        );


        console.log(
            "Budget saved to Firestore."
        );


        return true;

    } catch (error) {

        console.error(
            "Firebase save error:",
            error
        );


        console.log(
            "Cloud save failed. Local backup is still saved."
        );


        return false;
    }
}


// ======================================================
// LOAD FIREBASE
// ======================================================

async function loadData() {

    try {

        const cloudSnapshot =
            await getDoc(
                budgetDoc
            );


        if (
            cloudSnapshot.exists()
        ) {

            const data =
                cloudSnapshot.data();


            transactions =
                Array.isArray(
                    data.transactions
                )
                    ? data.transactions
                    : [];


            debts =
                Array.isArray(
                    data.debts
                )
                    ? data.debts
                    : [];


            transfers =
                Array.isArray(
                    data.transfers
                )
                    ? data.transfers
                    : [];


            events =
                (
                    data.events &&
                    typeof data.events ===
                    "object"
                )
                    ? data.events
                    : {};


            // NEW VERSION
            if (
                data.startingBalances &&
                typeof data.startingBalances ===
                "object"
            ) {

                startingBalances = {
                    Cash:
                        Number(
                            data
                                .startingBalances
                                .Cash
                        ) || 0,

                    Card:
                        Number(
                            data
                                .startingBalances
                                .Card
                        ) || 0,

                    Beep:
                        Number(
                            data
                                .startingBalances
                                .Beep
                        ) || 0
                };

            }

            // OLD VERSION MIGRATION
            else if (
                data.startingMoney !==
                undefined
            ) {

                startingBalances = {
                    Cash:
                        Number(
                            data.startingMoney
                        ) || 0,

                    Card: 0,
                    Beep: 0
                };
            }


            saveLocalBackup();


            console.log(
                "Budget loaded from Firestore."
            );

        } else {

            loadLocalBackup();

            await saveData();


            console.log(
                "Local data uploaded to Firestore."
            );
        }

    } catch (error) {

        console.error(
            "Firebase load error:",
            error
        );


        loadLocalBackup();
    }


    fillStartingInputs();

    updateSummary();
    displayTransactions();
    displayDebts();
    displayEvent();
}


// ======================================================
// START PROGRAM
// ======================================================

loadData();
