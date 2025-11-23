const plane = document.getElementById('plane');
const liveMultiplier = document.getElementById('liveMultiplier');
const balanceBar = document.getElementById('balanceBar');
const stakeBox = document.getElementById('stakeBox');
const betBox = document.getElementById('betBox');

let currentUser = localStorage.getItem('aviatorCurrentUser');
if (!currentUser) window.location.href = 'index.html';

let accounts = JSON.parse(localStorage.getItem('aviatorAccounts')) || {};
let balance = accounts[currentUser].balance || 1000;
balanceBar.innerText = `Balance: ${balance}`;

let stakeAmount = 0;
let betActive = false;
let currentMultiplier = 1;
let targetMultiplier = generateRandomMultiplier();

stakeBox.addEventListener('click', () => {
    let amt = prompt('Enter stake amount (≤ balance):', '100');
    amt = parseFloat(amt);
    if (isNaN(amt) || amt > balance || amt <= 0) { alert('Invalid amount'); return; }
    stakeAmount = amt;
    betBox.innerText = `Bet: ${stakeAmount}`;
    betBox.style.background = 'yellow';
    betActive = true;
});

betBox.addEventListener('click', () => {
    if (!betActive) return;
    balance -= stakeAmount;
    updateBalance();
    startRound();
});

function updateBalance() {
    balanceBar.innerText = `Balance: ${balance.toFixed(2)}`;
    accounts[currentUser].balance = balance;
    localStorage.setItem('aviatorAccounts', JSON.stringify(accounts));
}

function startRound() {
    let multiplier = 1;
    const interval = setInterval(() => {
        multiplier += 0.1;
        liveMultiplier.innerText = `×${multiplier.toFixed(2)}`;
        if (multiplier >= targetMultiplier) {
            clearInterval(interval);
            liveMultiplier.innerText = `×${targetMultiplier.toFixed(2)} BURST!`;
            betActive = false;
            stakeAmount = 0;
            betBox.innerText = 'Bet';
            betBox.style.background = 'green';
            targetMultiplier = generateRandomMultiplier();
        }
    }, 500);
}

function generateRandomMultiplier() {
    return Math.random() * 20 + 1; // random ×1 to ×21
}

// Plane animation
let planeX = 0, planeY = 80;
function animatePlane() {
    planeX += 2;
    planeY = 80 + 20 * Math.sin(planeX / 20);
    plane.style.transform = `translate(${planeX}px, ${planeY}px) rotate(10deg)`;
    if (planeX > window.innerWidth - 100) planeX = 0;
    requestAnimationFrame(animatePlane);
}
animatePlane();
