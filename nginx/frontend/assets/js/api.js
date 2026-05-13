// Client API avec gestion des erreurs
class APIClient {
  constructor() {
    this.baseUrl = CONFIG.API_BASE;
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    const token = Storage.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  async request(method, endpoint, data = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: this.getHeaders(),
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const result = await response.json();

      if (!response.ok) {
        throw new APIError(result.detail || 'Une erreur est survenue', response.status, result);
      }

      return result;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(error.message || 'Erreur réseau', 0, null);
    }
  }

  // Authentification
  async register(pseudo, username, password) {
    return this.request('POST', '/register', {
      pseudo,
      username,
      password,
    });
  }

  async login(username, password, jwtExpir = 1440) {
    return this.request('POST', '/login', {
      username,
      password,
      jwt_expir: jwtExpir,
    });
  }

  async getMe() {
    return this.request('GET', '/user/me');
  }

  async updateUser(password, newUsername = null, newPseudo = null, newPassword = null) {
    return this.request('PUT', '/user/me', {
      password,
      new_username: newUsername,
      new_pseudo: newPseudo,
      new_password: newPassword,
    });
  }

  async deleteUser(password) {
    return this.request('DELETE', '/user/me', { password });
  }

  // Tier lists
  async getTierlists() {
    return this.request('GET', '/tierlist');
  }

  async getTierlist(id) {
    return this.request('GET', `/tierlist/${id}`);
  }

  async createTierlist(userId, name, description, data, isPrivate = false) {
    return this.request('POST', '/tierlist', {
      user_id: userId,
      name,
      description: description || '',
      data,
      is_private: isPrivate,
    });
  }

  async updateTierlist(id, name, description, data, isPrivate) {
    return this.request('PUT', `/tierlist/${id}`, {
      name,
      description: description || '',
      data,
      is_private: isPrivate,
    });
  }

  async deleteTierlist(id) {
    return this.request('DELETE', `/tierlist/${id}`);
  }

  async duplicateTierlist(id, maintainOrder = 1) {
    return this.request('POST', `/tierlist/duplicate/${id}?maintain_order=${maintainOrder}`);
  }

  // Images
  async uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const url = `${this.baseUrl}/upload`;
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Storage.getToken()}`,
      },
      body: formData,
    };

    try {
      const response = await fetch(url, options);
      const result = await response.json();

      if (!response.ok) {
        throw new APIError(result.detail || 'Erreur upload', response.status);
      }

      return result;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(error.message, 0);
    }
  }

  async deleteImage(hash) {
    return this.request('DELETE', `/image/${hash}`);
  }

  getImageUrl(hash) {
    return `${this.baseUrl}/image/${hash}`;
  }
}

class APIError extends Error {
  constructor(message, status, response = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.response = response;
  }
}

const api = new APIClient();
