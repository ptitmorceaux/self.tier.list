// Configuration de l'application
const CONFIG = {
  API_BASE: '/api',
  TOKEN_KEY: 'tierlist_token',
  USER_KEY: 'tierlist_user',
  EXPIRATION_KEY: 'tierlist_expiration'
};

// Utilitaires pour le stockage
const Storage = {
  setToken: (token) => {
    localStorage.setItem(CONFIG.TOKEN_KEY, token);
  },
  getToken: () => {
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    const expiration = localStorage.getItem(CONFIG.EXPIRATION_KEY);
    if (expiration && new Date() > new Date(expiration)) {
      Storage.clear();
      return null;
    }
    return token;
  },
  setUser: (user) => {
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
  },
  getUser: () => {
    const user = localStorage.getItem(CONFIG.USER_KEY);
    return user ? JSON.parse(user) : null;
  },
  setExpiration: (expirationDate) => {
    localStorage.setItem(CONFIG.EXPIRATION_KEY, expirationDate.toISOString());
  },
  clear: () => {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
    localStorage.removeItem(CONFIG.EXPIRATION_KEY);
  }
};

// Utilitaires d'authentification
const Auth = {
  isAuthenticated: () => {
    return Storage.getToken() !== null;
  },
  getUser: () => {
    return Storage.getUser();
  },
  logout: () => {
    Storage.clear();
    window.location.href = '/login.html';
  }
};
