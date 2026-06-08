// profile.js
document.addEventListener('DOMContentLoaded', async () => {
  // Si pas connecté, rediriger
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  const user = Auth.getUser();
  Navbar.render(true, user);

  // Event listeners
  document.getElementById('new-tierlist-btn').addEventListener('click', createNewTierlist);
  document.getElementById('empty-new-btn').addEventListener('click', createNewTierlist);

  // Load user tier lists
  await loadUserTierlists();
});

async function loadUserTierlists() {
  try {
    Loading.show('Chargement de vos tier lists...');
    const response = await api.getTierlists();
    Loading.hide();

    const allTierlists = response.data || [];
    const userTierlists = allTierlists.filter(t => t.user_id === Auth.getUser().id);

    if (userTierlists.length === 0) {
      document.getElementById('empty-state').style.display = 'block';
      document.getElementById('tierlists-container').innerHTML = '';
      return;
    }

    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('tierlists-container').innerHTML = userTierlists
      .map(tierlist => createTierlistCard(tierlist))
      .join('');

    // Add event listeners
    userTierlists.forEach(tierlist => {
      const card = document.querySelector(`[data-tierlist-id="${tierlist.id}"]`);
      if (card) {
        card.querySelector('.btn-view').addEventListener('click', () => {
          window.location.href = `tierlist.html?id=${tierlist.id}`;
        });
        
        card.querySelector('.btn-duplicate').addEventListener('click', () => {
          duplicateTierlist(tierlist.id);
        });

        card.querySelector('.btn-delete').addEventListener('click', () => {
          deleteTierlist(tierlist.id);
        });
      }
    });
  } catch (error) {
    Loading.hide();
    console.error('Erreur:', error);
    Toast.error('Erreur lors du chargement des tier lists');
  }
}

function createTierlistCard(tierlist) {
  const date = new Date(tierlist.created_at).toLocaleDateString('fr-FR');
  const visibility = tierlist.is_private ? 'Privée' : 'Publique';
  
  return `
    <div class="card" data-tierlist-id="${tierlist.id}">
      <div class="card-header">
        <div>
          <h3 class="card-title">${tierlist.name}</h3>
          <p style="color: var(--text-light); font-size: 13px; margin-top: 5px;">
            ${date} • <span class="badge badge-${tierlist.is_private ? 'danger' : 'success'}">${visibility}</span>
          </p>
        </div>
      </div>
      <div class="card-body">
        <p>${tierlist.description || 'Pas de description'}</p>
      </div>
      <div class="card-footer">
        <button class="btn btn-view btn-primary">Éditer</button>
        <button class="btn btn-duplicate btn-secondary btn-sm">Dupliquer</button>
        <button class="btn btn-delete btn-danger btn-sm">Supprimer</button>
      </div>
    </div>
  `;
}

function createNewTierlist() {
  window.location.href = 'tierlist.html';
}

async function duplicateTierlist(id) {
  try {
    Loading.show('Duplication en cours...');
    const response = await api.duplicateTierlist(id, 1);
    Loading.hide();

    const newId = response.data.id;
    Toast.success('Tier list dupliquée !');
    setTimeout(() => {
      window.location.href = `tierlist.html?id=${newId}`;
    }, 500);
  } catch (error) {
    Loading.hide();
    console.error('Erreur:', error);
    Toast.error('Erreur lors de la duplication');
  }
}

function deleteTierlist(id) {
  Modal.confirm(
    'Supprimer cette Tier List',
    'Êtes-vous sûr ? Cette action est irréversible.',
    async () => {
      try {
        Loading.show('Suppression en cours...');
        await api.deleteTierlist(id);
        Loading.hide();

        Toast.success('Tier list supprimée');
        await loadUserTierlists();
      } catch (error) {
        Loading.hide();
        console.error('Erreur:', error);
        Toast.error('Erreur lors de la suppression');
      }
    }
  );
}
