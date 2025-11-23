// Aviator Demo script (localStorage only)
(() => {
  // --- Utilities ---
  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));

  // --- Storage helpers ---
  function loadUsers(){
    try{ return JSON.parse(localStorage.getItem('aviator_users')||'{}') }catch(e){return {}}
  }
  function saveUsers(u){ localStorage.setItem('aviator_users', JSON.stringify(u)) }

  // --- AUTH (signup/login pages) ---
  if(qs('#createBtn')){
    // Signup page
    const suPhone = qs('#suPhone'), suPass = qs('#suPass'), suPass2 = qs('#suPass2');
    qs('#toggleSu').addEventListener('click', ()=>{ suPass.type = suPass.type==='password' ? 'text':'password' });
    qs('#createBtn').addEventListener('click', ()=>{
      const phone = suPhone.value.trim(); const p1 = suPass.value; const p2 = suPass2.value;
      if(!phone || phone.length<6){ alert('Enter valid phone'); return }
      if(p1.length<4){ alert('Password too short'); return }
      if(p1!==p2){ alert('Passwords do not match'); return }
      const users = loadUsers();
      if(users[phone]){ alert('Account exists for this phone'); return }
      users[phone] = { password: p1, balance: 1000, created: Date.now() };
      saveUsers(users);
      alert('Account created — logging in');
      sessionStorage.setItem('aviator_session', phone);
      window.location.href = 'game.html';
    });
  }

  if(qs('#loginBtn')){
    // Login page
    const liPhone = qs('#liPhone'), liPass = qs('#liPass');
    qs('#toggleLi').addEventListener('click', ()=>{ liPass.type = liPass.type==='password' ? 'text':'password' });
    qs('#loginBtn').addEventListener('click', ()=>{
      const phone = liPhone.value.trim(); const pass = liPass.value;
      const users = loadUsers();
      if(!users[phone] || users[phone].password !== pass){ alert('Wrong phone or password'); return }
      sessionStorage.setItem('aviator_session', phone);
      window.location.href = 'game.html';
    });
  }

  // --- GAME PAGE ---
  if(qs('#planeCanvas')){
    // Ensure logged in
    const session = sessionStorage.getItem('aviator_session');
    if(!session){ window.location.href = 'login.html'; return }

    // DOM
    const canvas = qs('#planeCanvas'); const ctx = canvas.getContext('2d');
    const liveMultEl = qs('#liveMult'); const balanceEl = qs('#balanceDisplay');
    const stakeInput = qs('#stakeInput'); const betBtn = qs('#betBtn'); const cancelBtn = qs('#cancelBtn');
    const winningsDisplay = qs('#winningsDisplay'); const countdownEl = qs('#countdown');
    const pastRow = qs('#pastRow'); const msgs = qs('#msgs');

    // Withdraw modal
    const withdrawModal = qs('#withdrawModal'); const withdrawBtn = qs('#withdrawBtn');
    const proceedWithdraw = qs('#proceedWithdraw'); const closeWithdraw = qs('#closeWithdraw');
    const withdrawAmount = qs('#withdrawAmount');

    // Logout
    qs('#logoutBtn').addEventListener('click', ()=>{ sessionStorage.removeItem('aviator_session'); window.location.href='login.html' });

    // Load user
    const users = loadUsers();
    if(!users[session]){ alert('User not found'); sessionStorage.removeItem('aviator_session'); window.location.href='login.html'; return }
    let user = users[session];
    function saveUser(){ users[session]=user; saveUsers(users); balanceEl.textContent = user.balance.toFixed(2) }
    saveUser();

    // Game state
    let inRound = false; // true when multiplier running
    let stake = 0; let betActive = false; let betStake = 0; let hasCashed = false;
    let startTime = 0; let burstAt = 0; let lastFrame = 0; let elapsed = 0;
    let pastMultipliers = JSON.parse(localStorage.getItem('aviator_past')||'[]');

    function updatePast(){ pastRow.textContent = 'Past: ' + (pastMultipliers.slice(-10).reverse().map(m=>m.toFixed(2)+'x').join(' | ') || '—') }
    updatePast();

    // Round engine
    function newRound(){
      inRound = true; hasCashed = false; betActive = false; betStake = 0; stake = 0;
      startTime = performance.now();
      // burst between 1.2 and 10.0
      burstAt = 1.0 + Math.random()*9.0; // e.g. 1.0 -> 10.0
      lastFrame = startTime;
      msgs.textContent = '';
      cancelBtn.style.display = 'none';
      countdownEl.textContent = '--';
      requestAnimationFrame(loop);
    }

    // 5s intermission after burst
    function intermission(){ inRound=false; updatePast();
      let t=5; countdownEl.textContent = t;
      const iv = setInterval(()=>{ t--; countdownEl.textContent = t; if(t<=0){ clearInterval(iv); newRound() } },1000);
    }

    // Bet behavior
    betBtn.addEventListener('click', ()=>{
      if(!inRound){ alert('Round not started yet — wait for round'); return }
      if(!betActive){ // place bet
        const val = Number(stakeInput.value||0);
        if(!val || val<=0){ alert('Enter stake'); return }
        if(val > user.balance){ alert('Stake exceeds balance'); return }
        // Deduct immediately
        user.balance -= val; saveUser();
        betActive = true; betStake = val; hasCashed = false;
        betBtn.textContent = 'Cash Out'; betBtn.classList.add('yellow');
        cancelBtn.style.display = 'inline-block';
        msgs.textContent = 'Bet placed for current round';
      } else { // cash out
        if(hasCashed) return;
        // compute current multiplier
        const now = performance.now(); const secs = (now-startTime)/1000;
        const mult = calcMultiplier(secs);
        const winnings = betStake * mult;
        user.balance += winnings; saveUser();
        winningsDisplay.textContent = winnings.toFixed(2);
        msgs.textContent = 'Cashed out @' + mult.toFixed(2) + 'x';
        hasCashed = true; betActive = false; betBtn.textContent='Bet'; betBtn.classList.remove('yellow'); cancelBtn.style.display='none';
      }
    });

    cancelBtn.addEventListener('click', ()=>{
      // Cancel pending bet only if betActive and round not started? In this design bets during round allowed. Cancel acts to restore stake if not yet started.
      if(!betActive){ cancelBtn.style.display='none'; return }
      // For simplicity, allow cancel only if less than 1s elapsed
      const now = performance.now(); if((now-startTime)/1000>1){ alert('Too late to cancel'); return }
      user.balance += betStake; saveUser(); msgs.textContent = 'Bet cancelled'; betActive=false; betStake=0; cancelBtn.style.display='none'; betBtn.textContent='Bet';
    });

    // Withdraw modal
    withdrawBtn.addEventListener('click', ()=>{ withdrawModal.style.display='flex' });
    closeWithdraw.addEventListener('click', ()=>{ withdrawModal.style.display='none' });
    proceedWithdraw.addEventListener('click', ()=>{
      const v = Number(withdrawAmount.value||0);
      if(!v || v<=0){ alert('Enter amount'); return }
      if(v>user.balance){ alert('Insufficient balance'); return }
      user.balance -= v; saveUser(); withdrawModal.style.display='none'; withdrawAmount.value=''; msgs.textContent='Withdraw submitted (simulation)';
    });

    // Multiplier function (smooth growth making burst feel right)
    function calcMultiplier(t){
      // exponential-ish growth: 1 + a*(e^(b*t)-1)
      const a = 0.4, b = 0.7; // tune these for feel
      return Math.max(1, 1 + a*(Math.exp(b*t)-1));
    }

    // Animation: plane moves across canvas, then after 3/4 it moves up/down in wave
    function drawPlane(progress, mult){
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0,0,W,H);
      // background subtle grid
      ctx.fillStyle = '#041015'; ctx.fillRect(0,0,W,H);
      // compute x from 0 to 0.75*W then wave
      const maxX = W*0.9;
      const x = Math.min(maxX, progress * maxX);
      // y as wave after 3/4 of path; before that climb diagonal
      let y;
      if(progress < 0.75){
        y = H*0.75 - (progress/0.75)*(H*0.35); // move up slightly
      } else {
        const waveProgress = (progress-0.75)/0.25; // 0..1
        // wave amplitude
        const amp = H*0.12;
        y = H*0.75 - (H*0.35) + Math.sin((performance.now()/300) + progress*10)*amp*(1-waveProgress) ;
      }
      // Plane (simple triangle + tail)
      ctx.save(); ctx.translate(x,y);
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath(); ctx.moveTo(-18,8); ctx.lineTo(24,0); ctx.lineTo(-18,-8); ctx.closePath(); ctx.fill();
      // cockpit circle
      ctx.beginPath(); ctx.fillStyle='#8b0000'; ctx.arc(6,0,3,0,Math.PI*2); ctx.fill();
      ctx.restore();

      // Draw multiplier marker near plane
      ctx.font = '18px monospace'; ctx.fillStyle='#fff'; ctx.fillText('×' + mult.toFixed(2), Math.min(W-80, x+10), Math.max(20, y-20));
    }

    function loop(now){
      if(!inRound) return; const dt = now - lastFrame; lastFrame = now; elapsed = (now - startTime)/1000;
      const mult = calcMultiplier(elapsed);
      liveMultEl.textContent = mult.toFixed(2);
      winningsDisplay.textContent = betActive && !hasCashed ? (betStake*mult).toFixed(2) : '0.00';

      // progress between 0..1 based on multiplier and burstAt mapping
      const progress = Math.min(1, elapsed / (Math.log((burstAt-1)/0.4 +1)/0.7 + 0.1) );
      drawPlane(progress, mult);

      // check burst
      if(mult >= burstAt){
        // round ended
        msgs.textContent = 'Burst @' + burstAt.toFixed(2) + 'x';
        // if betActive and not cashed -> user loses (already deducted)
        if(betActive && !hasCashed){ msgs.textContent += ' — you lost'; }
        pastMultipliers.push(burstAt);
        localStorage.setItem('aviator_past', JSON.stringify(pastMultipliers.slice(-50)));
        // reset UI
        betActive = false; betStake = 0; hasCashed = false;
        betBtn.textContent='Bet'; betBtn.classList.remove('yellow'); cancelBtn.style.display='none';
        // 5s break
        intermission();
        return;
      }

      requestAnimationFrame(loop);
    }

    // Start first round after short delay
    setTimeout(newRound, 800);

    // Keep UI updated
    setInterval(()=>{ balanceEl.textContent = user.balance.toFixed(2); },500);
  }
})();
