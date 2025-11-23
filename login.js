// login.js
(() => {
  const get = id => document.getElementById(id);
  const loginBtn = get('loginBtn');
  const toggleLoginPass = get('toggleLoginPass');
  const rememberMe = get('rememberMe');

  function loadAccounts(){ return JSON.parse(localStorage.getItem('aviatorAccounts')||'{}'); }

  toggleLoginPass.addEventListener('click', ()=>{
    const el = get('loginPass'); el.type = el.type === 'password' ? 'text' : 'password';
  });

  loginBtn.addEventListener('click', ()=>{
    const phone = get('loginPhone').value.trim();
    const pass = get('loginPass').value;
    if(!phone || !pass){ alert('fill phone and password'); return; }
    const accounts = loadAccounts();
    if(!accounts[phone] || accounts[phone].password !== pass){ alert('invalid credentials'); return; }
    // optionally save password
    if(rememberMe.checked) localStorage.setItem('aviator_saved_'+phone, pass);
    // set session (use sessionStorage so leaving the tab clears it)
    sessionStorage.setItem('aviatorCurrentUser', phone);
    // record login
    const logs = JSON.parse(localStorage.getItem('aviator_logs')||'[]');
    logs.push({type:'login',phone, time:new Date().toISOString()});
    localStorage.setItem('aviator_logs', JSON.stringify(logs));
    // go to game
    window.location.href = 'game.html';
  });

  // if user navigates away (visibilitychange) we will clear session to require login again
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden){ sessionStorage.removeItem('aviatorCurrentUser'); }
  });
})();
