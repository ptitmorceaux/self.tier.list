// profile.js
let userTierlists = []; // Stockage global pour la recherche

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  const user = Auth.getUser();
  Navbar.render(true, user);

  document.getElementById('new-tierlist-btn').addEventListener('click', createNewTierlist);
  document.getElementById('empty-new-btn').addEventListener('click', createNewTierlist);
  
  // NOUVEAU : Écouteur pour la barre de recherche
  document.getElementById('search-input')?.addEventListener('input', handleSearch);

  await loadUserTierlists();
});

// NOUVEAU : Fonction de normalisation
function normalizeString(str) {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// NOUVEAU : Filtrage instantané
function handleSearch(e) {
  const searchTerm = normalizeString(e.target.value);
  const filtered = userTierlists.filter(t => {
    const name = normalizeString(t.name);
    const desc = normalizeString(t.description);
    return name.includes(searchTerm) || desc.includes(searchTerm);
  });
  renderTierlists(filtered, searchTerm !== '');
}

async function loadUserTierlists() {
  try {
    Loading.show('Chargement de vos tier lists...');
    const response = await api.getTierlists();
    Loading.hide();

    const allTierlists = response.data || [];
    userTierlists = allTierlists.filter(t => t.user_id === Auth.getUser().id);
    
    renderTierlists(userTierlists, false);

  } catch (error) {
    Loading.hide();
    console.error('Erreur:', error);
    Toast.error('Erreur lors du chargement des tier lists');
  }
}

// Fonction séparée pour le rendu HTML
function renderTierlists(listsToRender, isSearchActive) {
  const container = document.getElementById('tierlists-container');
  const emptyState = document.getElementById('empty-state');

  if (listsToRender.length === 0) {
    emptyState.style.display = 'block';
    container.innerHTML = '';
    
    if (isSearchActive) {
      emptyState.querySelector('p:nth-of-type(1)').textContent = "Aucun résultat trouvé pour cette recherche.";
      emptyState.querySelector('p:nth-of-type(2)').style.display = "none";
      document.getElementById('empty-new-btn').style.display = "none";
    } else {
      emptyState.querySelector('p:nth-of-type(1)').textContent = "Vous n'avez pas encore de tier list";
      emptyState.querySelector('p:nth-of-type(2)').style.display = "block";
      document.getElementById('empty-new-btn').style.display = "inline-block";
    }
    return;
  }

  emptyState.style.display = 'none';
  container.innerHTML = listsToRender.map(tierlist => createTierlistCard(tierlist)).join('');

  // Ajout des events listeners sur les boutons
  listsToRender.forEach(tierlist => {
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