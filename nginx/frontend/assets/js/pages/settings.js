// settings.js
document.addEventListener('DOMContentLoaded', async () => {
  // Si pas connecté, rediriger
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  const user = Auth.getUser();
  Navbar.render(true, user);

  // Load user info
  await loadUserInfo();

  // Form submissions
  document.getElementById('update-pseudo-form').addEventListener('submit', handleUpdatePseudo);
  document.getElementById('update-username-form').addEventListener('submit', handleUpdateUsername);
  document.getElementById('update-password-form').addEventListener('submit', handleUpdatePassword);
  document.getElementById('delete-account-form').addEventListener('submit', handleDeleteAccount);
});

async function loadUserInfo() {
  try {
    Loading.show('Chargement des informations...');
    const response = await api.getMe();
    Loading.hide();

    const user = response.data;
    document.getElementById('user-info').innerHTML = `
      <div style="margin: 10px 0;">
        <strong>Pseudo:</strong> ${user.pseudo}
      </div>
      <div style="margin: 10px 0;">
        <strong>Nom d'utilisateur:</strong> ${user.username}
      </div>
      <div style="margin: 10px 0;">
        <strong>Compte créé le:</strong> ${new Date(user.created_at).toLocaleDateString('fr-FR')}
      </div>
      ${user.is_admin ? '<div style="margin: 10px 0;"><span class="badge badge-danger">Administrateur</span></div>' : ''}
    `;
  } catch (error) {
    Loading.hide();
    console.error('Erreur:', error);
    Toast.error('Erreur lors du chargement des informations');
  }
}

async function handleUpdatePseudo(e) {
  e.preventDefault();

  const newPseudo = document.getElementById('new-pseudo').value.trim();
  const password = document.getElementById('pseudo-password').value;

  if (!newPseudo) {
    Toast.error('Veuillez entrer un nouveau pseudo');
    return;
  }

  if (!password) {
    Toast.error('Veuillez entrer votre mot de passe');
    return;
  }

  try {
    Loading.show('Mise à jour en cours...');
    await api.updateUser(password, null, newPseudo, null);
    Loading.hide();

    Toast.success('Pseudo mis à jour avec succès !');
    
    // Update local user info
    const user = Auth.getUser();
    user.pseudo = newPseudo;
    Storage.setUser(user);
    Navbar.render(true, user);

    // Reset form
    document.getElementById('update-pseudo-form').reset();
    await loadUserInfo();
  } catch (error) {
    Loading.hide();
    console.error('Erreur:', error);
    Toast.error(error.message || 'Erreur lors de la mise à jour');
  }
}

async function handleUpdateUsername(e) {
  e.preventDefault();

  const newUsername = document.getElementById('new-username').value.trim();
  const password = document.getElementById('username-password').value;

  if (!newUsername) {
    Toast.error('Veuillez entrer un nouveau nom d\'utilisateur');
    return;
  }

  if (!password) {
    Toast.error('Veuillez entrer votre mot de passe');
    return;
  }

  try {
    Loading.show('Mise à jour en cours...');
    await api.updateUser(password, newUsername, null, null);
    Loading.hide();

    Toast.success('Nom d\'utilisateur mis à jour avec succès !');
    
    // Update local user info
    const user = Auth.getUser();
    user.username = newUsername;
    Storage.setUser(user);
    Navbar.render(true, user);

    // Reset form
    document.getElementById('update-username-form').reset();
    await loadUserInfo();
  } catch (error) {
    Loading.hide();
    console.error('Erreur:', error);
    Toast.error(error.message || 'Erreur lors de la mise à jour');
  }
}

async function handleUpdatePassword(e) {
  e.preventDefault();

  const oldPassword = document.getElementById('old-password').value;
  const newPassword = document.getElementById('new-password').value;

  if (!oldPassword || !newPassword) {
    Toast.error('Veuillez remplir tous les champs');
    return;
  }

  if (!Validation.isValidPassword(newPassword)) {
    Toast.error('Le mot de passe doit contenir au moins 3 caractères');
    return;
  }

  try {
    Loading.show('Mise à jour en cours...');
    await api.updateUser(oldPassword, null, null, newPassword);
    Loading.hide();

    Toast.success('Mot de passe mis à jour avec succès !');
    document.getElementById('update-password-form').reset();
  } catch (error) {
    Loading.hide();
    console.error('Erreur:', error);
    Toast.error(error.message || 'Erreur lors de la mise à jour');
  }
}

function handleDeleteAccount(e) {
  e.preventDefault();

  Modal.confirm(
    'Supprimer votre compte',
    'Êtes-vous sûr ? Cette action est irréversible et supprimera toutes vos données.',
    async () => {
      const password = document.getElementById('delete-password').value;

      if (!password) {
        Toast.error('Veuillez entrer votre mot de passe');
        return;
      }

      try {
        Loading.show('Suppression en cours...');
        await api.deleteUser(password);
        Loading.hide();

        Toast.success('Compte supprimé avec succès');
        setTimeout(() => {
          Auth.logout();
        }, 500);
      } catch (error) {
        Loading.hide();
        console.error('Erreur:', error);
        Toast.error(error.message || 'Erreur lors de la suppression');
      }
    }
  );
}
