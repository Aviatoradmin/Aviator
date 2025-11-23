/* game.js
 Implements:
 - session login via sessionStorage 'aviatorCurrentUser'
 - deterministic time-seeded multipliers (Nairobi time)
 - rounds every 15s (10s flight + 5s wait)
 - pending bet / cancel logic
 - deduct on flight start, refund on cancel
 - live multiplier display & live winnings inside Bet box
 - withdraw split UI + POST to admin endpoint (configurable)
 - past 10 multipliers stored
 - admin logs saved in localStorage (and attempted POST)
*/

(()=>{
  // CONFIG
  const ROUND_TOTAL = 15; // seconds
  const FLIGHT = 10; // seconds
  const WAIT = 5; // seconds
  const MAX_BURST = 100; // cap for multiplier
  const ADMIN_FORM_ENDPOINT = '';

  // DOM
  const get = id => document.getElementById(id);
  const canvas = get('planeCanvas'); const ctx = canvas.getContext('2d');
  const multiplierDisplay = get('multiplierDisplay');
  const balancePill = get('balancePill');
  const stakeBox = get('stakeBox');
  const betBox = get('betBox');
  const withdrawBar = get('withdrawBar');
  const withdrawSplit = get('withdrawSplit');
  const withdrawAmount = get('withdrawAmount');
  const withdrawProceed = get('withdrawProceed');
  const withdrawStatus = get('withdrawStatus');
  const pastRow = get('pastRow');

  // state
  const user = sessionStorage.getItem('aviatorCurrentUser');
  if(!user){ window.location.href = 'index.html'; return; }
  const accounts = JSON.parse(localStorage.getItem('aviatorAccounts')||'{}');
  if(!accounts[user]){ alert('Account not found'); window.location.href='index.html'; return; }

  let balance = accounts[user].balance || 1000;
  let pendingBet = null; // {amount}
  let activeBet = null; // {amount,roundIndex}
  let roundInfo = null; // updated per tick
  let burstForRound = null; // numeric
  let pastMultipliers = JSON.parse(localStorage.getItem('aviator_past')||'[]');

  // util - Nairobi time
  function nowNairobi(){ const n = new Date(); const ms = n.getTime() + (3*60*60*1000); return new Date(ms); }
  function pad(n){return n<10? '0'+n : ''+n}

  // round indexing
  function computeRoundInfo(){
    const d = nowNairobi();
    const secondsOfDay = d.getHours()*3600 + d.getMinutes()*60 + d.getSeconds();
    const roundIndex = Math.floor(secondsOfDay / ROUND_TOTAL);
    const roundStartSec = roundIndex * ROUND_TOTAL;
    const roundStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(),0,0,0).getTime() + (roundStartSec*1000);
    const dateKey = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    return {d, secondsOfDay, roundIndex, roundStartSec, dateKey};
  }

  // deterministic hash -> 0..1
  function hashString(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h += (h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24); } return (h>>>0)/4294967295; }

  // seeded multiplier for a given roundKey
  function seededMultiplier(dateKey, roundIndex){
    const seed = `${dateKey}-${roundIndex}`;
    const r = hashString(seed);
    // transform r to heavy tail between 1 and MAX_BURST
    const alpha = 1.7;
    const min = 1;
    const max = MAX_BURST;
    const val = 1 + (Math.pow(1 - r, -1/alpha) - 1) * (max - 1) / (Math.pow(1 - 0.999999, -1/alpha) - 1);
    return Math.round(Math.max(1, Math.min(max,val)) * 100) / 100;
  }

  // UI updates
  function updateBalanceUI(){ balancePill.textContent = 'Balance: '+balance.toFixed(2); }
  function updatePastUI(){ pastRow.innerHTML = pastMultipliers.slice(-10).map(m=>' <span class="past">×'+m+'</span>').join(''); }
  updateBalanceUI(); updatePastUI();

  // Resize canvas
  function resize(){ canvas.width = canvas.clientWidth * devicePixelRatio; canvas.height = canvas.clientHeight * devicePixelRatio; ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); }
  window.addEventListener('resize', resize); resize();

  // compute & cache burst for current round
  function refreshRound(){ roundInfo = computeRoundInfo(); burstForRound = seededMultiplier(roundInfo.dateKey, roundInfo.roundIndex); }
  refreshRound();

  // graphics: plane path within box
  const box = {x:20,y:20,w: (canvas.clientWidth-40), h:(canvas.clientHeight-40)};

  function drawScene(progress, inFlight, exploded){
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // background
    ctx.fillStyle='#05060a'; ctx.fillRect(0,0,cw,ch);
    // plane box rect
    ctx.strokeStyle='#16313a'; ctx.lineWidth=2; ctx.strokeRect(10,10,cw-20,ch-20);

    // coordinates along diagonal
    const startX = 10 + (cw-20)*0.05; const startY = 10 + (ch-20)*0.90;
    const endX = 10 + (cw-20)*0.90; const endY = 10 + (ch-20)*0.10;

    // planeProgress: 0..1 along diagonal
    let planeProgress = inFlight ? Math.min(1, progress) : 0;
    // If progress passed 0.75 of diagonal, enable large wave
    const diagX = startX + (endX - startX) * planeProgress;
    const diagY = startY + (endY - startY) * planeProgress;

    // wave amplitude increases after 0.75 progress
    const waveStart = 0.75;
    let wave = 0;
    if(planeProgress > waveStart){
      const wp = (planeProgress - waveStart) / (1 - waveStart);
      const amplitude = Math.min((ch*0.2), 120) * wp; // large wave
      const freq = 2.5;
      wave = Math.sin(planeProgress * Math.PI * freq * 2) * amplitude;
    }

    const px = diagX;
    const py = diagY - wave;

    // draw simple red plane (triangle)
    ctx.save(); ctx.translate(px,py); ctx.scale(1+planeProgress*0.4,1+planeProgress*0.4);
    ctx.fillStyle='#ff3b3b'; ctx.beginPath(); ctx.moveTo(-16,8); ctx.lineTo(16,0); ctx.lineTo(-16,-8); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#cc2a2a'; ctx.fillRect(-22,-8,6,16);
    ctx.restore();

    // explosion
    if(exploded){ ctx.fillStyle='rgba(255,150,50,0.9)'; ctx.beginPath(); ctx.arc(px,py,40,0,Math.PI*2); ctx.fill(); }

    // HUD: burst number
    ctx.fillStyle='#ffffff'; ctx.font='14px sans-serif'; ctx.fillText('Burst target: ×'+burstForRound, 12, 20);
  }

  // compute live multiplier given flight progress (0..1)
  function liveMultiplierFromProgress(progress){
    const tb = Math.log(Math.max(1.0001, burstForRound));
    const val = Math.exp(progress * tb);
    return Math.max(1, Math.round(val*100)/100);
  }

  // state for animation loop
  let lastRoundIndex = -1;
  let inFlight = false;
  let flightStartTime = 0;
  let explodedThisRound = false;

  // main tick
  function tick(){
    refreshRound();
    const now = nowNairobi();
    const secs = roundInfo.secondsOfDay;
    const elapsed = secs - roundInfo.roundStartSec; // 0..14
    // phase
    if(elapsed < FLIGHT){ // flight
      if(!inFlight){ // just started flight -> convert pendingBet to activeBet
        inFlight = true; flightStartTime = Date.now(); explodedThisRound = false;
        if(pendingBet && !activeBet){
          // deduct now
          if(pendingBet.amount <= balance){
            balance -= pendingBet.amount; activeBet = {amount: pendingBet.amount, round: roundInfo.roundIndex};
            // persist
            accounts[user].balance = balance; localStorage.setItem('aviatorAccounts', JSON.stringify(accounts));
            // log
            const logs = JSON.parse(localStorage.getItem('aviator_logs')||'[]'); logs.push({type:'bet_deducted',phone:user,amount:pendingBet.amount,round:roundInfo.roundIndex,time:new Date().toISOString()}); localStorage.setItem('aviator_logs', JSON.stringify(logs));
          }
          pendingBet = null;
        }
      }
      // compute normalized progress for flight 0..1
      const prog = Math.max(0, Math.min(1, elapsed / FLIGHT));
      const live = liveMultiplierFromProgress(prog);
      multiplierDisplay.textContent = '×'+live.toFixed(2);
      // update bet box live winnings
      if(activeBet && !explodedThisRound){
        betBox.innerHTML = '<div class="bet-title">Cash out</div><div class="bet-value">'+(activeBet.amount * live).toFixed(2)+'</div>';
        betBox.classList.add('bet-active'); betBox.classList.remove('bet-wait');
      }
      // draw plane
      drawScene(prog, true, false);

      // check burst
      if(live >= burstForRound){
        // burst occurs
        explodedThisRound = true;
        // handle activeBet loss if not cashed out
        if(activeBet && !activeBet.resolved){
          // they already had stake deducted earlier; mark resolved lost
          activeBet.resolved = true; activeBet.won = false;
          const logs = JSON.parse(localStorage.getItem('aviator_logs')||'[]'); logs.push({type:'bet_lost',phone:user,amount:activeBet.amount,round:roundInfo.roundIndex,time:new Date().toISOString()}); localStorage.setItem('aviator_logs', JSON.stringify(logs));
        }
        // record past multiplier
        pastMultipliers.push(burstForRound.toFixed(2)); if(pastMultipliers.length>10) pastMultipliers.shift(); localStorage.setItem('aviator_past', JSON.stringify(pastMultipliers)); updatePastUI();
      }
    } else { // waiting phase
      if(inFlight){ inFlight = false; }
      const until = ROUND_TOTAL - elapsed; // remaining seconds in this round
      multiplierDisplay.textContent = 'Next '+Math.max(0,Math.ceil(until))+'s';
      // show pending bet as Cancel/waiting if placed
      if(pendingBet){ betBox.innerHTML = '<div class="bet-title bet-cancel">Cancel</div><div class="bet-value">Waiting for next round</div>'; betBox.classList.add('bet-wait'); betBox.classList.remove('bet-active'); }
      else { betBox.innerHTML = '<div class="bet-title">Bet</div><div class="bet-value">'+(stakeBox.dataset.amount || '')+'</div>'; betBox.classList.remove('bet-wait'); betBox.classList.remove('bet-active'); }
      // draw idle plane (not flying)
      drawScene(0,false,false);
    }

    updateBalanceUI();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // user interactions
  stakeBox.addEventListener('click', ()=>{
    const ask = prompt('Enter stake amount (≤ balance):', '100');
    const amount = Number(ask);
    if(!amount || amount<=0 || amount>balance){ alert('invalid stake'); return; }
    stakeBox.dataset.amount = amount;
    // show instantly in bet box (but it's not deducted until they press Bet during wait or active)
    betBox.innerHTML = '<div class="bet-title">Bet</div><div class="bet-value">'+amount.toFixed(2)+'</div>';
  });

  // betBox click: multiple behaviours
  betBox.addEventListener('click', ()=>{
    const amount = Number(stakeBox.dataset.amount || 0);
    if(!amount || amount<=0){ alert('enter stake first'); return; }

    // compute if we are in flight (cannot join current flight)
    const now = computeRoundInfo();
    const elapsed = now.secondsOfDay - now.roundStartSec;
    if(elapsed < FLIGHT){
      // current flight is active -> this means user intended to bet for next round
      // show Cancel / Waiting
      // place pending bet for next round
      pendingBet = { amount };
      betBox.innerHTML = '<div class="bet-title bet-cancel">Cancel</div><div class="bet-value">Waiting for next round</div>';
      betBox.classList.add('bet-wait');
      // user can cancel this pending bet by clicking betBox again while waiting
      return;
    }

    // else we are in waiting phase -> placing bet for next flight (which will start when wait ends)
    // put pending bet (so it will be deducted at flight start)
    pendingBet = { amount };
    betBox.innerHTML = '<div class="bet-title bet-cancel">Cancel</div><div class="bet-value">Waiting for next round</div>';
    betBox.classList.add('bet-wait');
  });

  // clicking betBox while pending bet exists will cancel it
  betBox.addEventListener('dblclick', ()=>{
    if(pendingBet){ pendingBet = null; betBox.innerHTML = '<div class="bet-title">Bet</div><div class="bet-value">'+(stakeBox.dataset.amount || '')+'</div>'; betBox.classList.remove('bet-wait'); }
  });

  // cash out: we enable clicking the betBox when activeBet exists and flight is in progress and not yet exploded
  betBox.addEventListener('contextmenu', (e)=>{ e.preventDefault(); });

  // Allow a tap on the bet box to cash out when activeBet exists and flight in progress & not exploded
  canvas.addEventListener('click', ()=>{});

  // We'll handle cash out globally: user taps the betBox while it shows "Cash out"
  betBox.addEventListener('click', ()=>{
    // if activeBet exists and flight in progress and not resolved -> cash out
    if(activeBet && !activeBet.resolved){
      // compute current live multiplier using current round progress
      const now = computeRoundInfo();
      const elapsed = now.secondsOfDay - now.roundStartSec;
      if(elapsed < FLIGHT){
        const prog = Math.max(0, Math.min(1, elapsed / FLIGHT));
        const live = liveMultiplierFromProgress(prog);
        // payout
        const win = Math.round(activeBet.amount * live * 100)/100;
        balance += win;
        activeBet.resolved = true; activeBet.won = true;
        // persist
        accounts[user].balance = balance; localStorage.setItem('aviatorAccounts', JSON.stringify(accounts));
        const logs = JSON.parse(localStorage.getItem('aviator_logs')||'[]'); logs.push({type:'cashed_out',phone:user,amount:activeBet.amount,win,round:now.roundIndex,time:new Date().toISOString()}); localStorage.setItem('aviator_logs', JSON.stringify(logs));
        // UI
        betBox.innerHTML = '<div class="bet-title">Bet</div><div class="bet-value"></div>';
        betBox.classList.remove('bet-active'); betBox.classList.remove('bet-wait');
        stakeBox.dataset.amount = '';
        updateBalanceUI();
      }
    }
  });

  // withdraw interactions
  withdrawBar.addEventListener('click', ()=>{ withdrawSplit.classList.toggle('hidden'); });
  withdrawProceed.addEventListener('click', ()=>{
    const amt = Number(withdrawAmount.value);
    if(!amt || amt<=0 || amt>balance){ withdrawStatus.textContent = 'Invalid amount'; withdrawStatus.style.color='red'; return; }
    // deduct and submit to admin endpoint and logs
    balance -= amt; updateBalanceUI(); withdrawStatus.textContent = 'SUBMITTED'; withdrawStatus.style.color='blue';
    // log
    const logs = JSON.parse(localStorage.getItem('aviator_logs')||'[]'); logs.push({type:'withdraw',phone:user,amount:amt,time:new Date().toISOString()}); localStorage.setItem('aviator_logs', JSON.stringify(logs));
    // attempt to POST to admin endpoint if configured
    if(ADMIN_FORM_ENDPOINT){
      fetch(ADMIN_FORM_ENDPOINT, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({type:'withdraw',phone:user,amount:amt,time:new Date().toISOString()})
      }).catch(()=>{});
    }
    // give UI feedback and hide after short time
    setTimeout(()=>{ withdrawSplit.classList.add('hidden'); withdrawStatus.textContent=''; withdrawAmount.value=''; }, 2000);
  });

})();
