// Utilitaires UI
class Toast {
  static show(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Animation d'entrée
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Suppression après délai
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  static success(message) {
    this.show(message, 'success');
  }

  static error(message) {
    this.show(message, 'error', 5000);
  }

  static warning(message) {
    this.show(message, 'warning');
  }

  static info(message) {
    this.show(message, 'info');
  }
}

class Modal {
  static confirm(title, message, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>${title}</h2>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <p>${message}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-cancel">Annuler</button>
          <button class="btn btn-danger modal-confirm">Confirmer</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const close = () => {
      modal.classList.add('closing');
      setTimeout(() => modal.remove(), 300);
    };
    
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('.modal-cancel').addEventListener('click', close);
    modal.querySelector('.modal-confirm').addEventListener('click', () => {
      onConfirm();
      close();
    });
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
  }
}

class Navbar {
  static render(isAuthenticated, user = null) {
    const navbar = document.querySelector('nav.navbar');
    if (!navbar) return;

    let html = `
      <div class="navbar-container">
        <a href="index.html" class="navbar-brand">Tier List</a>
        <div class="navbar-menu">
    `;

    if (isAuthenticated && user) {
      html += `
        <span class="navbar-user">Bienvenue, <strong>${user.pseudo}</strong></span>
        <a href="tierlist.html" class="btn btn-primary btn-sm">+ Nouvelle Tier List</a>
        <a href="profile.html" class="btn btn-secondary btn-sm">Profil</a>
        <a href="settings.html" class="btn btn-secondary btn-sm">Paramètres</a>
        <button id="logoutBtn" class="btn btn-danger btn-sm">Déconnexion</button>
      `;
    } else {
      html += `
        <a href="login.html" class="btn btn-primary">Connexion</a>
      `;
    }

    html += `
        </div>
      </div>
    `;

    navbar.innerHTML = html;

    if (isAuthenticated) {
      document.getElementById('logoutBtn')?.addEventListener('click', () => {
        Auth.logout();
      });
    }
  }
}

// Gestion du chargement
class Loading {
  static show(message = 'Chargement...') {
    const loader = document.createElement('div');
    loader.id = 'loader';
    loader.className = 'loader';
    loader.innerHTML = `
      <div class="spinner"></div>
      <p>${message}</p>
    `;
    document.body.appendChild(loader);
  }

  static hide() {
    document.getElementById('loader')?.remove();
  }
}

// Utilitaires de validation
const Validation = {
  isValidUsername: (username) => /^[a-zA-Z0-9_]{3,}$/.test(username),
  isValidPassword: (password) => password.length >= 3,
  isValidPseudo: (pseudo) => pseudo.length >= 1,
  isValidEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
};
