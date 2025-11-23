document.getElementById('loginBtn').addEventListener('click', () => {
    const phone = document.getElementById('loginPhone').value.trim();
    const pass = document.getElementById('loginPassword').value.trim();

    let accounts = JSON.parse(localStorage.getItem('aviatorAccounts')) || {};
    if (!accounts[phone] || accounts[phone].password !== pass) {
        alert('Phone or Password incorrect');
        return;
    }

    localStorage.setItem('aviatorCurrentUser', phone);
    window.location.href = 'game.html';
});
