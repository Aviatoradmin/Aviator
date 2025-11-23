const signupBox = document.getElementById('signup-box');
const loginBox = document.getElementById('login-box');

document.getElementById('showSignup').addEventListener('click', () => {
    loginBox.style.display = 'none';
    signupBox.style.display = 'block';
});
document.getElementById('showLogin').addEventListener('click', () => {
    signupBox.style.display = 'none';
    loginBox.style.display = 'block';
});

document.getElementById('signupBtn').addEventListener('click', () => {
    const phone = document.getElementById('signupPhone').value.trim();
    const pass = document.getElementById('signupPassword').value.trim();
    const confirm = document.getElementById('signupConfirm').value.trim();

    if (!phone || !pass || !confirm) { alert('Fill all fields'); return; }
    if (pass !== confirm) { alert('Passwords do not match'); return; }

    let accounts = JSON.parse(localStorage.getItem('aviatorAccounts')) || {};
    if (accounts[phone]) { alert('Account already exists'); return; }

    accounts[phone] = { password: pass, balance: 1000 };
    localStorage.setItem('aviatorAccounts', JSON.stringify(accounts));
    alert('Account created! Please login.');
    signupBox.style.display = 'none';
    loginBox.style.display = 'block';
});
