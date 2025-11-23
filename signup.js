// signup.js
(() => {
  const get = id => document.getElementById(id);
  const showSignup = get('showSignup');
  const showLogin = get('showLogin');
  const signupSection = get('signupSection');
  const loginSection = get('loginSection');
  const createBtn = get('createBtn');
  const toggleSignupPass = get('toggleSignupPass');
  const toggleSignupConfirm = get('toggleSignupConfirm');

  showSignup.addEventListener('click', ()=>{ loginSection.classList.add('hidden'); signupSection.classList.remove('hidden'); });
  showLogin.addEventListener('click', ()=>{ signupSection.classList.add('hidden'); loginSection.classList.remove('hidden'); });

  function saveAccounts(accounts){ localStorage.setItem('aviatorAccounts', JSON.stringify(accounts)); }
  function loadAccounts(){ return JSON.parse(localStorage.getItem('aviatorAccounts')||'{}'); }

  // toggle
  toggleSignupPass.addEventListener('click', ()=>{
    const el = get('signupPass'); el.type = el.type === 'password' ? 'text' : 'password';
  });
  toggleSignupConfirm.addEventListener('click', ()=>{
    const el = get('signupConfirm'); el.type = el.type === 'password' ? 'text' : 'password';
  });

  createBtn.addEventListener('click', ()=>{
    const phone = get('signupPhone').value.trim();
    const pass = get('signupPass').value;
    const confirm = get('signupConfirm').value;
    if(!phone || !pass || !confirm){ alert('Fill all fields'); return; }
    if(pass !== confirm){ alert('Passwords do not match'); return; }
    const accounts = loadAccounts();
    if(accounts[phone]){ alert('Account exists'); return; }
    accounts[phone] = { password: pass, balance: 1000 };
    saveAccounts(accounts);
    // log to admin logs
    const logs = JSON.parse(localStorage.getItem('aviator_logs')||'[]');
    logs.push({type:'signup',phone, time:new Date().toISOString()});
    localStorage.setItem('aviator_logs', JSON.stringify(logs));

    alert('Account created. Please login.');
    signupSection.classList.add('hidden'); loginSection.classList.remove('hidden');
  });
})();
