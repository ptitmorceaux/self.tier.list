// index.js
let allPublicTierlists = [];

document.addEventListener('DOMContentLoaded', async () => {
  const isAuth = Auth.isAuthenticated();
  const user = Auth.getUser();
  Navbar.render(isAuth, user);

  // Écouteurs pour la recherche ET les filtres
  document.getElementById('search-input')?.addEventListener('input', applyFilters);
  document.getElementById('sort-date')?.addEventListener('change', applyFilters);
  document.getElementById('filter-date')?.addEventListener('change', applyFilters);
  document.getElementById('filter-author')?.addEventListener('input', applyFilters);

  await loadTierlists();
});

function normalizeString(str) {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Fonction globale qui cumule tous les filtres
function applyFilters() {
  const searchTerm = normalizeString(document.getElementById('search-input')?.value || '');
  const filterAuthor = normalizeString(document.getElementById('filter-author')?.value || '');
  const filterDate = document.getElementById('filter-date')?.value || ''; // Format: YYYY-MM-DD
  const sortOrder = document.getElementById('sort-date')?.value || 'desc';

  let filtered = allPublicTierlists.filter(t => {
    const name = normalizeString(t.name);
    const desc = normalizeString(t.description);
    const authorText = normalizeString(`utilisateur #${t.user_id}`); // Basé sur l'ID pour l'instant
    
    const matchSearch = name.includes(searchTerm) || desc.includes(searchTerm);
    const matchAuthor = filterAuthor === '' || authorText.includes(filterAuthor);
    
    let matchDate = true;
    if (filterDate !== '') {
      // Extrait juste le 'YYYY-MM-DD' de la date ISO du serveur
      const tDate = t.created_at.substring(0, 10);
      matchDate = tDate === filterDate;
    }

    return matchSearch && matchAuthor && matchDate;
  });

  // Tri par date de mise à jour (ou création si absent)
  filtered.sort((a, b) => {
    const dateA = new Date(a.updated_at || a.created_at).getTime();
    const dateB = new Date(b.updated_at || b.created_at).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const isSearchActive = searchTerm !== '' || filterDate !== '' || filterAuthor !== '';
  renderTierlists(filtered, isSearchActive);
}

async function loadTierlists() {
  try {
    if (!Auth.isAuthenticated()) {
      document.getElementById('tierlists-container').innerHTML = '';
      document.getElementById('empty-state').innerHTML = `
        <div style="padding: 60px 20px;">
          <p style="font-size: 18px; margin-bottom: 20px;">Connectez-vous pour voir et créer des tier lists !</p>
          <a href="login.html" class="btn btn-primary" style="display: inline-block;">Se connecter</a>
        </div>
      `;
      document.getElementById('empty-state').style.display = 'block';
      document.getElementById('search-input').parentElement.style.display = 'none';
      document.getElementById('filters-container').style.display = 'none';
      return;
    }

    Loading.show('Chargement des tier lists...');
    const response = await api.getTierlists();
    Loading.hide();

    const tierlists = response.data || [];
    allPublicTierlists = tierlists.filter(t => !t.is_private);
    
    applyFilters(); // Lance le rendu avec les filtres par défaut (tri décroissant)

  } catch (error) {
    Loading.hide();
    console.error('Erreur lors du chargement:', error);
    Toast.error('Erreur lors du chargement des tier lists');
  }
}

function renderTierlists(listsToRender, isSearchActive) {
  const container = document.getElementById('tierlists-container');
  const emptyState = document.getElementById('empty-state');

  if (listsToRender.length === 0) {
    emptyState.style.display = 'block';
    container.innerHTML = '';
    
    if (isSearchActive) {
      emptyState.innerHTML = `<p style="font-size: 16px; margin-bottom: 20px;">Aucun résultat trouvé pour ces filtres.</p>`;
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
  
  // Formatage des deux dates
  const dateCrea = new Date(tierlist.created_at).toLocaleDateString('fr-FR');
  const dateModif = tierlist.updated_at ? new Date(tierlist.updated_at).toLocaleDateString('fr-FR') : dateCrea;

  return `
    <div class="card" data-tierlist-id="${tierlist.id}">
      <div class="card-header">
        <div>
          <h3 class="card-title">${tierlist.name}</h3>
          <p style="color: var(--text-light); font-size: 12px; margin-top: 5px;">
            👤 ${user}<br>
            📅 Créée le ${dateCrea} • ✏️ Modifiée le ${dateModif}
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