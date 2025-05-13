// Basic Tab Switching Logic (no changes here)
const tabButtons = document.querySelectorAll('.tab-button');
const tabPanes = document.querySelectorAll('.tab-pane');
const totalBalanceAmount = document.querySelector(".js-total-balance-amount");

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabPanes.forEach(pane => pane.classList.remove('active'));
        button.classList.add('active');
        document.getElementById(button.dataset.tab).classList.add('active');
    });
});

totalBalanceAmount.addEventListener('click', () => {
    let walletAddress = prompt("What's your wallet address?");
    console.log("Wallet Address:", walletAddress);
});