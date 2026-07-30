// index.js
let allPublicTierlists = []; // Stockage global pour la recherche

document.addEventListener('DOMContentLoaded', async () => {
  const isAuth = Auth.isAuthenticated();
  const user = Auth.getUser();
  Navbar.render(isAuth, user);

  // NOUVEAU : Écouteur pour la barre de recherche
  document.getElementById('search-input')?.addEventListener('input', handleSearch);

  await loadTierlists();
});

// NOUVEAU : Fonction magique pour enlever les accents et passer en minuscules
function normalizeString(str) {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// NOUVEAU : Filtrage instantané
function handleSearch(e) {
  const searchTerm = normalizeString(e.target.value);
  const filtered = allPublicTierlists.filter(t => {
    const name = normalizeString(t.name);
    const desc = normalizeString(t.description);
    return name.includes(searchTerm) || desc.includes(searchTerm);
  });
  renderTierlists(filtered, searchTerm !== '');
}

async function loadTierlists() {
  try {
    if (!Auth.isAuthenticated()) {
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
      document.getElementById('search-input').style.display = 'none'; // Cache la recherche si non connecté
      return;
    }

    Loading.show('Chargement des tier lists...');
    const response = await api.getTierlists();
    Loading.hide();

    const tierlists = response.data || [];
    allPublicTierlists = tierlists.filter(t => !t.is_private);
    
    renderTierlists(allPublicTierlists, false);

  } catch (error) {
    Loading.hide();
    console.error('Erreur lors du chargement:', error);
    Toast.error('Erreur lors du chargement des tier lists');
  }
}

// L'affichage est maintenant une fonction séparée
function renderTierlists(listsToRender, isSearchActive) {
  const container = document.getElementById('tierlists-container');
  const emptyState = document.getElementById('empty-state');

  if (listsToRender.length === 0) {
    emptyState.style.display = 'block';
    container.innerHTML = '';
    
    if (isSearchActive) {
      emptyState.innerHTML = `<p style="font-size: 16px; margin-bottom: 20px;">Aucun résultat trouvé pour cette recherche.</p>`;
    } else {
      emptyState.innerHTML = `
        <p style="font-size: 16px; margin-bottom: 20px;">Aucune tier list publique pour le moment.</p>
        <a href="profile.html" class="btn btn-primary" style="display: inline-block;">Créer la vôtre</a>
      `;
    }
    return;
  }

  emptyState.style.display = 'none';
  container.innerHTML = listsToRender.map(tierlist => createTierlistCard(tierlist)).join('');

  // Ajout des events listeners sur les nouveaux boutons générés
  listsToRender.forEach(tierlist => {
    const card = document.querySelector(`[data-tierlist-id="${tierlist.id}"]`);
    if (card) {
      card.querySelector('.btn-view').addEventListener('click', () => {
        window.location.href = `tierlist.html?id=${tierlist.id}`;
      });
    }
  });
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