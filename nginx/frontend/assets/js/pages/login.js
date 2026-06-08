// login.js
document.addEventListener('DOMContentLoaded', () => {
  // Si déjà connecté, rediriger
  if (Auth.isAuthenticated()) {
    window.location.href = 'profile.html';
    return;
  }

  // Render navbar
  Navbar.render(false);

  // Tab switching
  document.getElementById('tab-login').addEventListener('click', switchToLogin);
  document.getElementById('tab-register').addEventListener('click', switchToRegister);

  // Form submissions
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('register-form').addEventListener('submit', handleRegister);
});

function switchToLogin(e) {
  e.preventDefault();
  document.getElementById('tab-login').classList.add('active');
  document.getElementById('tab-register').classList.remove('active');
  document.getElementById('tab-login').style.color = 'var(--primary)';
  document.getElementById('tab-login').style.borderBottom = '3px solid var(--primary)';
  document.getElementById('tab-register').style.color = 'var(--text-light)';
  document.getElementById('tab-register').style.border = 'none';
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('register-form').style.display = 'none';
}

function switchToRegister(e) {
  e.preventDefault();
  document.getElementById('tab-login').classList.remove('active');
  document.getElementById('tab-register').classList.add('active');
  document.getElementById('tab-login').style.color = 'var(--text-light)';
  document.getElementById('tab-login').style.border = 'none';
  document.getElementById('tab-register').style.color = 'var(--primary)';
  document.getElementById('tab-register').style.borderBottom = '3px solid var(--primary)';
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'block';
}

async function handleLogin(e) {
  e.preventDefault();

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  if (!username || !password) {
    Toast.error('Veuillez remplir tous les champs');
    return;
  }

  try {
    Loading.show('Connexion en cours...');
    const response = await api.login(username, password);
    Loading.hide();

    const token = response.data.access_token;
    const user = response.data.user;

    // Calculer la date d'expiration
    const expirationDate = new Date();
    expirationDate.setMinutes(expirationDate.getMinutes() + 1440); // Par défaut 24h

    Storage.setToken(token);
    Storage.setUser(user);
    Storage.setExpiration(expirationDate);

    Toast.success('Connexion réussie !');
    setTimeout(() => {
      window.location.href = 'profile.html';
    }, 500);
  } catch (error) {
    Loading.hide();
    console.error('Erreur login:', error);
    Toast.error(error.message || 'Erreur de connexion');
  }
}

async function handleRegister(e) {
  e.preventDefault();

  const pseudo = document.getElementById('register-pseudo').value.trim();
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;

  // Validation
  if (!pseudo || !username || !password) {
    Toast.error('Veuillez remplir tous les champs');
    return;
  }

  if (!Validation.isValidUsername(username)) {
    Toast.error('Le nom d\'utilisateur doit contenir au moins 3 caractères');
    return;
  }

  if (!Validation.isValidPassword(password)) {
    Toast.error('Le mot de passe doit contenir au moins 3 caractères');
    return;
  }

  try {
    Loading.show('Inscription en cours...');
    await api.register(pseudo, username, password);
    Loading.hide();

    Toast.success('Inscription réussie ! Connectez-vous maintenant.');
    setTimeout(() => {
      switchToLogin({ preventDefault: () => {} });
      document.getElementById('login-username').value = username;
      document.getElementById('login-password').focus();
    }, 500);
  } catch (error) {
    Loading.hide();
    console.error('Erreur register:', error);
    
    let message = error.message;
    if (error.response?.detail) {
      if (error.response.detail.includes('already exists')) {
        message = 'Ce nom d\'utilisateur ou pseudo existe déjà';
      }
    }
    Toast.error(message || 'Erreur lors de l\'inscription');
  }
}
