// ======================================================
// FIREBASE
// ======================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
    getFirestore,
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


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
let startingMoney = 0;

let selectedCategory = "";
let selectedPayment = "";


// ======================================================
// ELEMENTS
// ======================================================

const startingMoneyInput = document.getElementById("startingMoney");
const setMoneyBtn = document.getElementById("setMoneyBtn");

const dateInput = document.getElementById("date");
const descriptionInput = document.getElementById("description");
const amountInput = document.getElementById("amount");

const addTransactionBtn = document.getElementById("addTransactionBtn");

const historyDate = document.getElementById("historyDate");
const transactionList = document.getElementById("transactionList");
const dailyTotal = document.getElementById("dailyTotal");

const previousDateBtn = document.getElementById("previousDate");
const nextDateBtn = document.getElementById("nextDate");

const addDebtBtn = document.getElementById("addDebtBtn");


// ======================================================
// DATE
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
// DATE NAVIGATION
// ======================================================

previousDateBtn.addEventListener("click", function () {
    const currentDate = new Date(
        historyDate.value + "T00:00:00"
    );

    currentDate.setDate(
        currentDate.getDate() - 1
    );

    historyDate.value = formatDate(currentDate);

    displayTransactions();
});


nextDateBtn.addEventListener("click", function () {
    const currentDate = new Date(
        historyDate.value + "T00:00:00"
    );

    currentDate.setDate(
        currentDate.getDate() + 1
    );

    historyDate.value = formatDate(currentDate);

    displayTransactions();
});


historyDate.addEventListener("change", function () {
    displayTransactions();
});


// ======================================================
// STARTING MONEY
// ======================================================

setMoneyBtn.addEventListener("click", async function () {
    const value = Number(startingMoneyInput.value);

    if (
        startingMoneyInput.value === "" ||
        isNaN(value) ||
        value < 0
    ) {
        alert("Please enter a valid amount.");
        return;
    }

    startingMoney = value;

    updateSummary();

    await saveData();

    alert("Starting money saved!");
});


// ======================================================
// CATEGORY BUTTONS
// ======================================================

document
    .querySelectorAll("[data-category]")
    .forEach(function (button) {

        button.addEventListener("click", function () {

            selectedCategory = button.dataset.category;

            document
                .querySelectorAll("[data-category]")
                .forEach(function (btn) {
                    btn.classList.remove("selected");
                });

            button.classList.add("selected");
        });
    });


// ======================================================
// PAYMENT BUTTONS
// ======================================================

document
    .querySelectorAll("[data-payment]")
    .forEach(function (button) {

        button.addEventListener("click", function () {

            selectedPayment = button.dataset.payment;

            document
                .querySelectorAll("[data-payment]")
                .forEach(function (btn) {
                    btn.classList.remove("selected");
                });

            button.classList.add("selected");
        });
    });


// ======================================================
// ADD TRANSACTION
// ======================================================

addTransactionBtn.addEventListener("click", async function () {
    const date = dateInput.value;
    const description = descriptionInput.value.trim();
    const amount = Number(amountInput.value);

    if (date === "") {
        alert("Please select a date.");
        return;
    }

    if (description === "") {
        alert("Please enter what you spent on.");
        return;
    }

    if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount.");
        return;
    }

    if (selectedCategory === "") {
        alert("Please select a category.");
        return;
    }

    if (selectedPayment === "") {
        alert("Please select a payment method.");
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

    updateSummary();

    historyDate.value = date;

    displayTransactions();

    await saveData();

    descriptionInput.value = "";
    amountInput.value = "";

    selectedCategory = "";
    selectedPayment = "";

    document
        .querySelectorAll(".choice")
        .forEach(function (button) {
            button.classList.remove("selected");
        });

    alert("Transaction added!");
});


// ======================================================
// DISPLAY TRANSACTIONS
// ======================================================

function displayTransactions() {
    const selectedDate = historyDate.value;

    const filteredTransactions = transactions.filter(
        function (transaction) {
            return transaction.date === selectedDate;
        }
    );

    transactionList.innerHTML = "";

    if (filteredTransactions.length === 0) {
        transactionList.innerHTML = `
            <p class="empty">
                No transactions for this date.
            </p>
        `;

        dailyTotal.textContent = "₱0.00";

        return;
    }

    let total = 0;

    filteredTransactions.forEach(function (transaction) {
        const amount = Number(transaction.amount) || 0;

        total += amount;

        const item = document.createElement("div");

        item.className = "transaction";


        const info = document.createElement("div");

        info.className = "transaction-info";


        const description = document.createElement("strong");

        description.textContent = transaction.description;


        const details = document.createElement("span");

        details.textContent =
            `${transaction.category} • ${transaction.payment}`;


        info.appendChild(description);
        info.appendChild(details);


        const right = document.createElement("div");

        right.className = "transaction-right";


        const price = document.createElement("strong");

        price.textContent =
            `₱${amount.toFixed(2)}`;


        const deleteButton = document.createElement("button");

        deleteButton.className = "delete-btn";
        deleteButton.textContent = "🗑️";


        deleteButton.addEventListener("click", function () {
            deleteTransaction(transaction.id);
        });


        right.appendChild(price);
        right.appendChild(deleteButton);


        item.appendChild(info);
        item.appendChild(right);


        transactionList.appendChild(item);
    });


    dailyTotal.textContent =
        `₱${total.toFixed(2)}`;
}


// ======================================================
// DELETE TRANSACTION
// ======================================================

async function deleteTransaction(id) {
    transactions = transactions.filter(
        function (transaction) {
            return transaction.id !== id;
        }
    );

    displayTransactions();

    updateSummary();

    await saveData();
}


// ======================================================
// ADD UTANG
// ======================================================

addDebtBtn.addEventListener("click", async function () {
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


    const amount = Number(amountText);


    if (
        isNaN(amount) ||
        amount <= 0
    ) {
        alert("Please enter a valid amount.");
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
});


// ======================================================
// DISPLAY UTANG
// ======================================================

function displayDebts() {
    const debtList = document.getElementById("debtList");

    debtList.innerHTML = "";


    debts.forEach(function (debt) {
        const item = document.createElement("div");

        item.className = "debt-item";


        const info = document.createElement("div");


        const person = document.createElement("strong");

        person.textContent = debt.person;


        const lineBreak = document.createElement("br");


        const amount = document.createElement("span");

        amount.textContent =
            `₱${Number(debt.amount).toFixed(2)}`;


        info.appendChild(person);
        info.appendChild(lineBreak);
        info.appendChild(amount);


        const buttons = document.createElement("div");


        const editButton = document.createElement("button");

        editButton.className =
            "delete-btn edit-debt-btn";

        editButton.textContent = "✏️";


        editButton.addEventListener("click", function () {
            editDebt(debt.id);
        });


        const deleteButton = document.createElement("button");

        deleteButton.className =
            "delete-btn delete-debt-btn";

        deleteButton.textContent = "🗑️";


        deleteButton.addEventListener("click", function () {
            deleteDebt(debt.id);
        });


        buttons.appendChild(editButton);
        buttons.appendChild(deleteButton);


        item.appendChild(info);
        item.appendChild(buttons);


        debtList.appendChild(item);
    });
}


// ======================================================
// EDIT UTANG
// ======================================================

async function editDebt(id) {
    const debt = debts.find(
        function (debt) {
            return debt.id === id;
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


    const newAmount = Number(newAmountText);


    if (
        isNaN(newAmount) ||
        newAmount <= 0
    ) {
        alert("Please enter a valid amount.");
        return;
    }


    debt.person = newPerson.trim();
    debt.amount = newAmount;


    displayDebts();

    updateSummary();

    await saveData();


    alert("Utang updated!");
}


// ======================================================
// DELETE UTANG
// ======================================================

async function deleteDebt(id) {
    debts = debts.filter(
        function (debt) {
            return debt.id !== id;
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
    let totalSpent = 0;
    let cashSpent = 0;
    let cardSpent = 0;
    let totalDebt = 0;


    transactions.forEach(function (transaction) {
        const amount =
            Number(transaction.amount) || 0;


        totalSpent += amount;


        if (transaction.payment === "Cash") {
            cashSpent += amount;
        }


        if (transaction.payment === "Card") {
            cardSpent += amount;
        }
    });


    debts.forEach(function (debt) {
        totalDebt +=
            Number(debt.amount) || 0;
    });


    const remaining =
        startingMoney - totalSpent;


    document.getElementById("totalSpent").textContent =
        `₱${totalSpent.toFixed(2)}`;


    document.getElementById("cashBalance").textContent =
        `₱${cashSpent.toFixed(2)}`;


    document.getElementById("cardBalance").textContent =
        `₱${cardSpent.toFixed(2)}`;


    document.getElementById("debtBalance").textContent =
        `₱${totalDebt.toFixed(2)}`;


    document.getElementById("remainingBalance").textContent =
        `₱${remaining.toFixed(2)}`;
}


// ======================================================
// LOCAL STORAGE BACKUP
// ======================================================

function saveLocalBackup() {
    localStorage.setItem(
        "budgetTransactions",
        JSON.stringify(transactions)
    );


    localStorage.setItem(
        "budgetDebts",
        JSON.stringify(debts)
    );


    localStorage.setItem(
        "budgetStartingMoney",
        String(startingMoney)
    );
}


function loadLocalBackup() {
    const savedTransactions =
        localStorage.getItem(
            "budgetTransactions"
        );


    const savedDebts =
        localStorage.getItem(
            "budgetDebts"
        );


    const savedStartingMoney =
        localStorage.getItem(
            "budgetStartingMoney"
        );


    if (savedTransactions) {
        try {
            transactions =
                JSON.parse(savedTransactions);
        }

        catch (error) {
            transactions = [];
        }
    }


    if (savedDebts) {
        try {
            debts =
                JSON.parse(savedDebts);
        }

        catch (error) {
            debts = [];
        }
    }


    if (savedStartingMoney !== null) {
        startingMoney =
            Number(savedStartingMoney) || 0;
    }


    startingMoneyInput.value =
        startingMoney;
}


// ======================================================
// SAVE DATA TO FIREBASE
// ======================================================

async function saveData() {
    saveLocalBackup();


    try {
        await setDoc(
            budgetDoc,
            {
                transactions: transactions,
                debts: debts,
                startingMoney: startingMoney
            }
        );


        console.log(
            "Budget saved to Firestore."
        );


        return true;
    }


    catch (error) {
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
// LOAD DATA
// ======================================================

async function loadData() {
    try {
        const cloudSnapshot =
            await getDoc(budgetDoc);


        if (cloudSnapshot.exists()) {
            const data =
                cloudSnapshot.data();


            transactions =
                Array.isArray(data.transactions)
                    ? data.transactions
                    : [];


            debts =
                Array.isArray(data.debts)
                    ? data.debts
                    : [];


            startingMoney =
                Number(data.startingMoney) || 0;


            startingMoneyInput.value =
                startingMoney;


            saveLocalBackup();


            console.log(
                "Budget loaded from Firestore."
            );
        }


        else {
            loadLocalBackup();


            await saveData();


            console.log(
                "Local data uploaded to Firestore."
            );
        }
    }


    catch (error) {
        console.error(
            "Firebase load error:",
            error
        );


        loadLocalBackup();
    }


    updateSummary();

    displayTransactions();

    displayDebts();
}


// ======================================================
// START PROGRAM
// ======================================================

const today = getToday();


dateInput.value = today;

historyDate.value = today;


loadData();