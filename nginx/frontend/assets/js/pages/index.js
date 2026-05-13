// index.js
document.addEventListener('DOMContentLoaded', async () => {
  // Render navbar
  const isAuth = Auth.isAuthenticated();
  const user = Auth.getUser();
  Navbar.render(isAuth, user);

  // Load tierlists
  await loadTierlists();
});

async function loadTierlists() {
  try {
    if (!Auth.isAuthenticated()) {
      // Si pas connecté, afficher un message
      document.getElementById('tierlists-container').innerHTML = '';
      document.getElementById('empty-state').innerHTML = `
        <div style="padding: 60px 20px;">
          <p style="font-size: 18px; margin-bottom: 20px;">
            Connectez-vous pour voir et créer des tier lists !
          </p>
          <a href="login.html" class="btn btn-primary" style="display: inline-block;">Se connecter</a>
        </div>
      `;
      document.getElementById('empty-state').style.display = 'block';
      return;
    }

    Loading.show('Chargement des tier lists...');
    const response = await api.getTierlists();
    Loading.hide();

    const tierlists = response.data || [];
    const publicTierlists = tierlists.filter(t => !t.is_private);

    if (publicTierlists.length === 0) {
      document.getElementById('empty-state').style.display = 'block';
      document.getElementById('empty-state').innerHTML = `
        <p style="font-size: 16px; margin-bottom: 20px;">Aucune tier list publique pour le moment.</p>
        <a href="profile.html" class="btn btn-primary" style="display: inline-block;">Créer la vôtre</a>
      `;
      document.getElementById('tierlists-container').innerHTML = '';
      return;
    }

    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('tierlists-container').innerHTML = publicTierlists
      .map(tierlist => createTierlistCard(tierlist))
      .join('');

    // Add event listeners
    publicTierlists.forEach(tierlist => {
      const card = document.querySelector(`[data-tierlist-id="${tierlist.id}"]`);
      if (card) {
        card.querySelector('.btn-view').addEventListener('click', () => {
          window.location.href = `tierlist.html?id=${tierlist.id}`;
        });
      }
    });
  } catch (error) {
    Loading.hide();
    console.error('Erreur lors du chargement:', error);
    Toast.error('Erreur lors du chargement des tier lists');
  }
}

function createTierlistCard(tierlist) {
  const user = tierlist.user_id ? `Créée par l'utilisateur #${tierlist.user_id}` : 'Utilisateur inconnu';
  const date = new Date(tierlist.created_at).toLocaleDateString('fr-FR');
  
  return `
    <div class="card" data-tierlist-id="${tierlist.id}">
      <div class="card-header">
        <div>
          <h3 class="card-title">${tierlist.name}</h3>
          <p style="color: var(--text-light); font-size: 13px; margin-top: 5px;">
            ${user} • ${date}
          </p>
        </div>
      </div>
      <div class="card-body">
        <p>${tierlist.description || 'Pas de description'}</p>
      </div>
      <div class="card-footer">
        <button class="btn btn-view btn-primary">Voir</button>
      </div>
    </div>
  `;
}
