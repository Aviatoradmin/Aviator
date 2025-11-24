// --- GLOBAL VARIABLES ---
let balance = 1000.00;
let currentStake = 10;
let userLoggedIn = false;
let currentUserPhone = "";

// Game States
let isFlying = false;
let isBettingPhase = false; // The 5-second countdown
let hasBetForNextRound = false;
let hasJoinedCurrentRound = false;
let currentMultiplier = 1.00;
let crashPoint = 1.00;

// Canvas
const canvas = document.getElementById('aviatorCanvas');
const ctx = canvas.getContext('2d');
let animationId;
let planeX = 0, planeY = 0;

// --- SETUP ON LOAD ---
window.onload = function() {
    // Initialize EmailJS (You must replace 'YOUR_PUBLIC_KEY' later)
    // emailjs.init("YOUR_PUBLIC_KEY"); 
    
    resizeCanvas();
    // Check if user was logged in
    const savedUser = localStorage.getItem('aviatorUser');
    if(savedUser) {
        const p = JSON.parse(savedUser);
        currentUserPhone = p.phone;
        balance = parseFloat(p.balance);
        updateBalanceUI();
        showGame();
    }
};

window.onresize = resizeCanvas;
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}

// --- AUTHENTICATION ---
const loginForm = document.getElementById('login-form');
const regForm = document.getElementById('register-form');

document.getElementById('btn-show-login').onclick = () => {
    document.getElementById('btn-show-login').classList.add('active');
    document.getElementById('btn-show-register').classList.remove('active');
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
};

document.getElementById('btn-show-register').onclick = () => {
    document.getElementById('btn-show-register').classList.add('active');
    document.getElementById('btn-show-login').classList.remove('active');
    regForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
};

function togglePass(id) {
    const x = document.getElementById(id);
    x.type = (x.type === "password") ? "text" : "password";
}

// REGISTER
regForm.onsubmit = (e) => {
    e.preventDefault();
    const phone = document.getElementById('reg-phone').value;
    const pass = document.getElementById('reg-pass').value;
    const confirm = document.getElementById('reg-confirm').value;

    if(pass !== confirm) { alert("Passwords do not match"); return; }

    // Save to LocalStorage (Simulating Account Creation)
    const userData = { phone: phone, pass: pass, balance: 1000 };
    localStorage.setItem('user_' + phone, JSON.stringify(userData));
    
    alert("Account Created! Please Login.");
    document.getElementById('btn-show-login').click();
};

// LOGIN
loginForm.onsubmit = (e) => {
    e.preventDefault();
    const phone = document.getElementById('login-phone').value;
    const pass = document.getElementById('login-pass').value;

    const stored = localStorage.getItem('user_' + phone);
    if(stored) {
        const userData = JSON.parse(stored);
        if(userData.pass === pass) {
            userLoggedIn = true;
            currentUserPhone = phone;
            balance = userData.balance;
            
            // Save session
            localStorage.setItem('aviatorUser', JSON.stringify({phone: phone, balance: balance}));
            
            // Send Login data to Admin (Simulated via EmailJS)
            // sendEmailToAdmin("LOGIN", `User ${phone} logged in.`);

            showGame();
        } else {
            alert("Wrong Password");
        }
    } else {
        alert("User not found");
    }
};

function showGame() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('game-section').classList.remove('hidden');
    updateBalanceUI();
    startGameLoop(); // Start the game engine
}

// --- SESSION SECURITY ---
document.addEventListener("visibilitychange", () => {
    if (document.hidden && userLoggedIn) {
        // User left tab -> Force Logout
        localStorage.removeItem('aviatorUser');
        location.reload();
    }
});

// --- GAME LOGIC (THE ENGINE) ---

// We use current time to synchronize game for all players
function generateCrashPoint() {
    // Use current minute as seed (Simple version)
    // In production, you'd use a complex hash of the date
    const now = new Date();
    const seed = now.getMinutes() + now.getSeconds(); 
    // Random logic: 
    // Most crashes happen early (1.00 - 2.00), some go high.
    let r = Math.random(); // This should be seeded ideally
    
    // Logic: Exponential decay for crash point
    // E = 1 / (1 - r) ... simple crash curve
    let crash = Math.floor((100 / (Math.floor(Math.random() * 100) + 1)) * 100) / 100;
    if(crash < 1) crash = 1;
    if(crash > 10) crash = (Math.random() * 50).toFixed(2); // Occasional huge win
    
    return Math.max(1.00, crash);
}

// MAIN LOOP
function startGameLoop() {
    startCountdown();
}

function startCountdown() {
    isFlying = false;
    isBettingPhase = true;
    currentMultiplier = 1.00;
    planeX = 0; 
    planeY = canvas.height; // Start bottom left
    
    // UI Reset
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('live-counter').innerText = "WAITING...";
    document.getElementById('live-counter').style.color = "#fff";

    // Handle Bet Button State
    const btn = document.getElementById('bet-button');
    
    // If player bet for next round previously
    if(hasBetForNextRound) {
        hasJoinedCurrentRound = true;
        hasBetForNextRound = false;
        
        // Deduct Balance NOW
        balance -= currentStake;
        updateBalanceUI();

        // Change button to CANCEL
        btn.className = "bet-btn-red";
        btn.innerHTML = `<div class="btn-top">CANCEL</div><div class="btn-bottom">WAITING...</div>`;
    } else {
        hasJoinedCurrentRound = false;
        btn.className = "bet-btn-green";
        btn.innerHTML = `<div class="btn-top">BET</div><div class="btn-bottom">${currentStake} KES</div>`;
    }

    // 5 Second Countdown
    let count = 5;
    let timer = setInterval(() => {
        count--;
        document.getElementById('live-counter').innerText = `STARTS IN ${count}`;
        
        if(count <= 0) {
            clearInterval(timer);
            beginFlight();
        }
    }, 1000);
}

function beginFlight() {
    isBettingPhase = false;
    isFlying = true;
    crashPoint = generateCrashPoint(); // Determine where we stop
    console.log("Crash Point generated: " + crashPoint);

    // Update Button if Playing
    const btn = document.getElementById('bet-button');
    if(hasJoinedCurrentRound) {
        // Change to CASHOUT
        btn.className = "bet-btn-yellow";
        // Content updated in loop
    } else {
        // Change to "WAIT FOR NEXT ROUND"
        btn.className = "bet-btn-green"; // Keep green but inactive-ish
        btn.innerHTML = `<div class="btn-top">WAITING</div><div class="btn-bottom">NEXT ROUND</div>`;
    }

    animatePlane();
}

function animatePlane() {
    if(!isFlying) return;

    // Increment Multiplier
    currentMultiplier += 0.01 + (currentMultiplier * 0.0008); // Exponential speed up
    
    // DRAWING THE PLANE
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#e81d1d";
    ctx.lineWidth = 3;
    
    // Logic: Move Diagonal until 3/4 width, then Wave
    let limitX = canvas.width * 0.75;
    
    // Mapping multiplier to X position
    // We want X to move steadily across screen
    let progress = (currentMultiplier - 1.00) / 5; // Scale factor
    if(progress > 1) progress = 1; // Cap for visual
    
    let targetX = progress * canvas.width;
    
    // Smooth movement logic
    if(planeX < limitX) {
        planeX += 2; // Speed
        planeY = canvas.height - planeX; // Diagonal y = x (inverted coords)
    } else {
        // Wave motion phase
        planeX += 0.5; // Slow forward
        // Sine wave: Center Y +/- amplitude
        let centerY = canvas.height / 2;
        planeY = centerY + Math.sin(planeX * 0.05) * 50; 
    }

    // Draw Curve (Trail)
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    // Simple Quadratic curve for visual trail
    ctx.quadraticCurveTo(planeX/2, canvas.height, planeX, planeY);
    ctx.stroke();

    // Draw Plane (Circle representation)
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(planeX, planeY, 5, 0, Math.PI*2);
    ctx.fill();

    // Text updates
    document.getElementById('live-counter').innerText = currentMultiplier.toFixed(2) + "x";
    
    // Update Cashout Button Logic
    if(hasJoinedCurrentRound) {
        let winAmount = (currentStake * currentMultiplier).toFixed(2);
        document.getElementById('bet-button').innerHTML = 
            `<div class="btn-top">CASH OUT</div><div class="btn-bottom">${winAmount} KES</div>`;
    }

    // CHECK CRASH
    if(currentMultiplier >= crashPoint) {
        burst();
    } else {
        animationId = requestAnimationFrame(animatePlane);
    }
}

function burst() {
    isFlying = false;
    cancelAnimationFrame(animationId);
    
    document.getElementById('live-counter').innerText = "FLEW AWAY!";
    document.getElementById('live-counter').style.color = "#e81d1d"; // Red text
    
    // If player didn't cash out, they lose
    if(hasJoinedCurrentRound) {
        hasJoinedCurrentRound = false; // Reset
        // Balance was already deducted at start, so no action needed (User lost)
    }

    // Add to history
    const hist = document.getElementById('multiplier-history');
    const span = document.createElement('span');
    span.className = "hist-item";
    span.innerText = crashPoint.toFixed(2) + "x";
    if(crashPoint >= 2.00) span.style.color = "gold";
    hist.prepend(span);

    // Restart Loop after delay
    setTimeout(startCountdown, 3000);
}

// --- BETTING CONTROLS ---
document.getElementById('bet-button').onclick = () => {
    const btn = document.getElementById('bet-button');

    // 1. IF GAME IS FLYING AND USER IS IN THE GAME -> CASH OUT
    if(isFlying && hasJoinedCurrentRound) {
        // Success!
        let winnings = currentStake * currentMultiplier;
        balance += winnings;
        hasJoinedCurrentRound = false; // Exit round
        updateBalanceUI();
        
        btn.className = "bet-btn-green";
        btn.innerHTML = `<div class="btn-top">SUCCESS</div><div class="btn-bottom">Won ${winnings.toFixed(2)}</div>`;
        return;
    }

    // 2. IF COUNTDOWN PHASE
    if(isBettingPhase) {
        if(!hasJoinedCurrentRound) {
            // Place Bet
            if(balance < currentStake) { alert("Insufficient Balance"); return; }
            hasJoinedCurrentRound = true;
            balance -= currentStake;
            updateBalanceUI();
            
            btn.className = "bet-btn-red";
            btn.innerHTML = `<div class="btn-top">CANCEL</div><div class="btn-bottom">WAITING...</div>`;
        } else {
            // Cancel Bet
            hasJoinedCurrentRound = false;
            balance += currentStake; // Refund
            updateBalanceUI();
            
            btn.className = "bet-btn-green";
            btn.innerHTML = `<div class="btn-top">BET</div><div class="btn-bottom">${currentStake} KES</div>`;
        }
        return;
    }

    // 3. IF GAME IS FLYING BUT USER NOT IN -> BET NEXT ROUND
    if(isFlying && !hasJoinedCurrentRound) {
        if(!hasBetForNextRound) {
            hasBetForNextRound = true;
            btn.className = "bet-btn-red";
            btn.innerHTML = `<div class="btn-top">CANCEL</div><div class="btn-bottom">NEXT ROUND</div>`;
        } else {
            hasBetForNextRound = false;
            btn.className = "bet-btn-green";
            btn.innerHTML = `<div class="btn-top">BET</div><div class="btn-bottom">NEXT ROUND</div>`;
        }
    }
};

// Adjust Stake
function adjustStake(amount) {
    let newStake = currentStake + amount;
    if(newStake < 1) newStake = 1;
    currentStake = newStake;
    document.getElementById('stake-amount').value = currentStake;
    
    if(!isFlying && !hasJoinedCurrentRound && !hasBetForNextRound) {
        // Update button text live
        document.querySelector('#bet-button .btn-bottom').innerText = currentStake + " KES";
    }
}
document.getElementById('stake-amount').oninput = (e) => {
    currentStake = parseFloat(e.target.value) || 0;
};

// Update UI
function updateBalanceUI() {
    document.getElementById('user-balance').innerText = balance.toFixed(2);
    // Save to storage so refresh keeps balance
    if(currentUserPhone) {
        let u = JSON.parse(localStorage.getItem('user_'+currentUserPhone));
        u.balance = balance;
        localStorage.setItem('user_'+currentUserPhone, JSON.stringify(u));
        localStorage.setItem('aviatorUser', JSON.stringify({phone: currentUserPhone, balance: balance}));
    }
}

// --- WITHDRAWAL SYSTEM ---
const withdrawBtn = document.getElementById('withdraw-btn');
const modal = document.getElementById('withdraw-modal');

withdrawBtn.onclick = () => { modal.classList.remove('hidden'); };

function closeWithdraw() { modal.classList.add('hidden'); }

document.getElementById('btn-proceed-withdraw').onclick = () => {
    const amount = parseFloat(document.getElementById('withdraw-amount-input').value);
    const proceedBtn = document.getElementById('btn-proceed-withdraw');

    if(amount > balance) { alert("Insufficient Balance"); return; }

    // Deduct
    balance -= amount;
    updateBalanceUI();

    // Show Submitted State
    proceedBtn.style.background = "blue";
    proceedBtn.innerText = "SUBMITTED";

    // Send Email to Admin (Requires EmailJS setup)
    /*
    emailjs.send("YOUR_SERVICE_ID", "YOUR_TEMPLATE_ID", {
        phone: currentUserPhone,
        amount: amount,
        balance_left: balance
    });
    */

    setTimeout(() => {
        closeWithdraw();
        proceedBtn.style.background = "";
        proceedBtn.innerText = "PROCEED";
        document.getElementById('withdraw-amount-input').value = "";
    }, 2000);
};
