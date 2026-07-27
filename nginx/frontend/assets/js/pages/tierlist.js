// tierlist.js - Gestion complète de la tier list

let tierlistApp = null;

class TierlistApp {
  constructor() {
    this.tierlistId = this.getTierlistId();
    this.tierlist = null;
    this.isOwner = false;
    this.unclassifiedImages = {};
    this.draggedElement = null;
    this.draggedFrom = null;
    this.isCreatingNew = false;
  }

  getTierlistId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') ? parseInt(params.get('id')) : null;
  }

  async init() {
    try {
      if (!Auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
      }

      Navbar.render(true, Auth.getUser());
      this.setupEventListeners();

      if (this.tierlistId) {
        // Mode consultation/édition
        await this.loadTierlist();
      } else {
        // Mode création : on demande le titre via la pop-up
        this.startCreationFlow();
      }
    } catch (error) {
      console.error('Erreur init:', error);
      Toast.error('Erreur lors du chargement');
    }
  }

  startCreationFlow() {
    this.isCreatingNew = true;
    this.tierlist = {
      id: null,
      name: '',
      description: '',
      user_id: Auth.getUser().id,
      is_private: true,
      data: {
        tiers: [
          { id: 1, name: 'S', color: '#FFD700', items: [] },
          { id: 2, name: 'A', color: '#C0C0C0', items: [] },
          { id: 3, name: 'B', color: '#CD7F32', items: [] },
          { id: 0, name: '_blank', color: '#FFFFFF', items: [] },
        ],
        order: [1, 2, 3, 0],
      },
    };
    this.isOwner = true;
    this.openMetaModal(true);
  }

  async loadTierlist() {
    try {
      Loading.show('Chargement de la tier list...');
      const response = await api.getTierlist(this.tierlistId);
      Loading.hide();

      this.tierlist = response.data;
      this.isOwner = this.tierlist.user_id === Auth.getUser().id;

      if (this.tierlist.is_private && !this.isOwner) {
        window.location.href = 'index.html';
        return;
      }

      if (this.isOwner) {
        this.showEditorMode();
      } else {
        this.showViewerMode();
      }
    } catch (error) {
      Loading.hide();
      console.error('Erreur load:', error);
      if (error.status === 403) {
        window.location.href = 'index.html';
      } else {
        Toast.error('Tier list non trouvée');
        setTimeout(() => window.location.href = 'index.html', 1000);
      }
    }
  }

  showViewerMode() {
    document.getElementById('viewer-mode').style.display = 'block';
    document.getElementById('editor-mode').style.display = 'none';

    document.getElementById('viewer-title').textContent = this.tierlist.name;
    document.getElementById('viewer-description').textContent = this.tierlist.description || 'Pas de description';
    document.getElementById('viewer-creator').textContent = `Créée le ${new Date(this.tierlist.created_at).toLocaleDateString('fr-FR')}`;

    const actionsContainer = document.getElementById('viewer-actions');
    actionsContainer.innerHTML = '';

    if (Auth.isAuthenticated()) {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn btn-primary';
      copyBtn.textContent = '📋 Copier cette tier list';
      copyBtn.addEventListener('click', () => this.copyTierlist());
      actionsContainer.appendChild(copyBtn);
    }

    this.renderViewerTierlist();
  }

  async copyTierlist() {
    try {
      Loading.show('Duplication en cours...');
      const response = await api.duplicateTierlist(this.tierlistId, 1);
      Loading.hide();

      const newId = response.data.id;
      Toast.success('Tier list dupliquée !');
      setTimeout(() => {
        window.location.href = `tierlist.html?id=${newId}`;
      }, 500);
    } catch (error) {
      Loading.hide();
      Toast.error('Erreur lors de la duplication');
    }
  }

  renderViewerTierlist() {
    const container = document.getElementById('viewer-tierlist');
    container.innerHTML = '';

    const tiers = this.tierlist.data.tiers;
    const order = this.tierlist.data.order || [];

    // 1. Vrais rangs dans la grille
    order.forEach(tierId => {
      if (tierId === 0) return; // Ignorer _blank dans la grille

      const tier = tiers.find(t => t.id === tierId);
      if (!tier) return;

      const tierColumn = document.createElement('div');
      tierColumn.className = 'tier-column';

      const tierLabel = document.createElement('div');
      tierLabel.className = 'tier-label';
      tierLabel.style.backgroundColor = tier.color;
      tierLabel.style.color = this.getContrastColor(tier.color);
      tierLabel.textContent = tier.name;
      tierColumn.appendChild(tierLabel);

      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'tier-items';
      tier.items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'tier-item';
        itemDiv.innerHTML = `<img src="${api.getImageUrl(item.image_hash)}" alt="${item.name}" title="${item.name}">`;
        itemsContainer.appendChild(itemDiv);
      });

      tierColumn.appendChild(itemsContainer);
      container.appendChild(tierColumn);
    });

    // 2. Images en attente en bas
    const blankTier = tiers.find(t => t.id === 0);
    const existingPool = document.getElementById('viewer-unclassified-section');
    if (existingPool) existingPool.remove();

    if (blankTier && blankTier.items && blankTier.items.length > 0) {
      const unclassifiedSection = document.createElement('div');
      unclassifiedSection.id = 'viewer-unclassified-section';
      unclassifiedSection.className = 'images-pool';
      unclassifiedSection.innerHTML = `
        <h4>📦 Images en attente de classement</h4>
        <div class="images-grid">
          ${blankTier.items.map(item => `
            <div class="upload-preview" style="cursor: default;">
              <img src="${api.getImageUrl(item.image_hash)}" alt="${item.name}" title="${item.name}">
            </div>
          `).join('')}
        </div>
      `;
      document.getElementById('viewer-mode').appendChild(unclassifiedSection);
    }
  }

  showEditorMode() {
    document.getElementById('viewer-mode').style.display = 'none';
    document.getElementById('editor-mode').style.display = 'block';

    this.updateHeaderDOM();
    document.getElementById('privacy-select').value = this.tierlist.is_private.toString();

    // Charger les images du tier _blank
    const blankTier = this.tierlist.data.tiers.find(t => t.id === 0);
    this.unclassifiedImages = {};
    if (blankTier && blankTier.items) {
      blankTier.items.forEach(item => {
        this.unclassifiedImages[item.image_hash] = {
          hash: item.image_hash,
          name: item.name,
        };
      });
    }

    this.setupFileUpload();
    this.renderEditorTierlist();
    this.renderUnclassifiedImages();
  }

  updateHeaderDOM() {
    document.getElementById('editor-title').textContent = this.tierlist.name;
    document.getElementById('editor-description').textContent = this.tierlist.description || 'Pas de description';
  }

  /* --- MODAL POP-UP (TITRE / DESCRIPTION) --- */

  openMetaModal(isCreation = false) {
    const modal = document.getElementById('meta-modal');
    const modalTitle = document.getElementById('meta-modal-title');
    const titleInput = document.getElementById('modal-title-input');
    const descInput = document.getElementById('modal-desc-input');

    modalTitle.textContent = isCreation ? 'Créer une nouvelle Tier List' : 'Modifier le Titre et la Description';
    titleInput.value = isCreation ? '' : this.tierlist.name;
    descInput.value = isCreation ? '' : (this.tierlist.description || '');

    modal.style.display = 'flex';
    setTimeout(() => titleInput.focus(), 100);
  }

  closeMetaModal() {
    document.getElementById('meta-modal').style.display = 'none';
  }

  async submitMetaModal() {
    const titleInput = document.getElementById('modal-title-input');
    const descInput = document.getElementById('modal-desc-input');
    const title = titleInput.value.trim();
    const description = descInput.value.trim();

    if (!title) {
      Toast.error('Veuillez entrer un titre pour votre tier list');
      titleInput.focus();
      return;
    }

    this.tierlist.name = title;
    this.tierlist.description = description;

    try {
      if (this.isCreatingNew || !this.tierlist.id) {
        // Enregistrement initial en BDD
        Loading.show('Création de la tier list...');
        const res = await api.createTierlist(
          Auth.getUser().id,
          title,
          description,
          this.tierlist.data,
          this.tierlist.is_private
        );
        Loading.hide();

        this.tierlistId = res.data.id;
        this.tierlist.id = res.data.id;
        this.isCreatingNew = false;

        // Mise à jour de l'URL sans recharger la page
        window.history.replaceState({}, '', `tierlist.html?id=${this.tierlistId}`);
        Toast.success('Tier list créée ! Vous pouvez ajouter vos images.');
      } else {
        // Mise à jour titre/description
        await this.saveTierlist(true);
        Toast.success('Informations mises à jour');
      }

      this.closeMetaModal();
      this.showEditorMode();
    } catch (error) {
      Loading.hide();
      Toast.error(`Erreur : ${error.message}`);
    }
  }

  /* --- UPLOAD & GESTION DES IMAGES --- */

  setupFileUpload() {
    const uploadZone = document.getElementById('image-upload-zone');
    const fileInput = document.getElementById('image-input');

    // Éviter d'attacher plusieurs fois les listeners
    if (uploadZone.dataset.setup) return;
    uploadZone.dataset.setup = 'true';

    uploadZone.addEventListener('click', () => fileInput.click());

    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragging');
    });

    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('dragging');
    });

    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragging');
      this.handleFileSelect(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
      this.handleFileSelect(e.target.files);
    });
  }

  async handleFileSelect(files) {
    if (!this.tierlistId) {
      Toast.error("La tier list n'est pas encore créée.");
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 5 * 1024 * 1024) {
        Toast.warning(`${file.name} dépasse la taille max de 5 Mo`);
        continue;
      }
      await this.uploadAndSyncImage(file);
    }
  }

  async uploadAndSyncImage(file) {
    try {
      Loading.show(`Upload de ${file.name}...`);
      
      // 1. Upload binaire
      const response = await api.uploadImage(file);
      const hash = response.data.hash;
      const imageName = file.name.replace(/\.[^.]+$/, '');

      // 2. Mettre dans les images non classées
      this.unclassifiedImages[hash] = {
        hash: hash,
        name: imageName,
      };

      // 3. Auto-save en BDD
      await this.saveTierlist(true);

      Loading.hide();
      this.renderEditorTierlist();
      this.renderUnclassifiedImages();
      Toast.success(`${file.name} ajoutée aux images en attente`);
    } catch (error) {
      Loading.hide();
      Toast.error(`Erreur upload: ${error.message}`);
    }
  }

  renderUnclassifiedImages() {
    const grid = document.getElementById('images-grid');
    grid.innerHTML = '';

    // Zone de drop
    const dropZone = document.createElement('div');
    dropZone.style.cssText = 'flex: 1; min-width: 100%; min-height: 60px; border: 2px dashed var(--border); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--text-light); font-size: 12px;';
    dropZone.textContent = 'Déposer ici pour remettre dans les images en attente';
    dropZone.addEventListener('dragover', (e) => e.preventDefault());
    dropZone.addEventListener('drop', (e) => this.handleDropOnUnclassified(e));
    grid.appendChild(dropZone);

    Object.values(this.unclassifiedImages).forEach(img => {
      const imgDiv = document.createElement('div');
      imgDiv.className = 'upload-preview';
      imgDiv.draggable = true;
      imgDiv.dataset.hash = img.hash;
      imgDiv.innerHTML = `
        <img src="${api.getImageUrl(img.hash)}" alt="${img.name}" title="${img.name}">
        <button class="remove-btn" data-hash="${img.hash}">×</button>
      `;

      imgDiv.addEventListener('dragstart', (e) => this.handleDragStart(e, 'unclassified'));
      imgDiv.querySelector('.remove-btn').addEventListener('click', () => {
        this.removeImageAndSync(img.hash);
      });

      grid.appendChild(imgDiv);
    });
  }

  async removeImageAndSync(hash) {
    delete this.unclassifiedImages[hash];
    this.tierlist.data.tiers.forEach(tier => {
      tier.items = tier.items.filter(item => item.image_hash !== hash);
    });

    try {
      Loading.show('Suppression...');
      await this.saveTierlist(true);
      Loading.hide();
      this.renderEditorTierlist();
      this.renderUnclassifiedImages();
      Toast.info('Image retirée');
    } catch (error) {
      Loading.hide();
      Toast.error(`Erreur : ${error.message}`);
    }
  }

  /* --- RENDER EDITOR & DRAG AND DROP --- */

  renderEditorTierlist() {
    const container = document.getElementById('tierlist-editor-container');
    container.innerHTML = '';

    const tiers = this.tierlist.data.tiers;
    const order = this.tierlist.data.order || [];

    order.forEach(tierId => {
      if (tierId === 0) return; // Ne jamais afficher le tier 0 sous forme de colonne

      const tier = tiers.find(t => t.id === tierId);
      if (!tier) return;

      const tierColumn = document.createElement('div');
      tierColumn.className = 'tier-column';
      tierColumn.dataset.tierId = tier.id;

      const tierLabel = document.createElement('div');
      tierLabel.className = 'tier-label';
      tierLabel.style.backgroundColor = tier.color;
      tierLabel.style.color = this.getContrastColor(tier.color);

      tierLabel.innerHTML = `
        <input type="text" class="tier-name" value="${tier.name}" data-tier-id="${tier.id}">
        <input type="color" class="tier-color-picker" value="${tier.color}" data-tier-id="${tier.id}">
      `;
      tierLabel.querySelector('.tier-name').addEventListener('change', (e) => {
        tier.name = e.target.value;
        this.saveTierlist(true);
      });
      tierLabel.querySelector('.tier-color-picker').addEventListener('change', (e) => {
        tier.color = e.target.value;
        tierLabel.style.backgroundColor = e.target.value;
        this.saveTierlist(true);
      });

      tierColumn.appendChild(tierLabel);

      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'tier-items';
      itemsContainer.dataset.tierId = tier.id;
      itemsContainer.addEventListener('dragover', (e) => e.preventDefault());
      itemsContainer.addEventListener('drop', (e) => this.handleDrop(e, tier.id));

      tier.items.forEach(item => {
        const itemDiv = this.createItemElement(item, tier.id);
        itemsContainer.appendChild(itemDiv);
      });

      tierColumn.appendChild(itemsContainer);
      container.appendChild(tierColumn);
    });
  }

  createItemElement(item, tierId) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'tier-item';
    itemDiv.draggable = true;
    itemDiv.dataset.hash = item.image_hash;
    itemDiv.dataset.tierId = tierId;
    itemDiv.innerHTML = `
      <img src="${api.getImageUrl(item.image_hash)}" alt="${item.name}" title="${item.name}">
      <button class="remove-btn" data-hash="${item.image_hash}" data-tier-id="${tierId}">×</button>
    `;

    itemDiv.addEventListener('dragstart', (e) => this.handleDragStart(e, 'tier', tierId));
    itemDiv.querySelector('.remove-btn').addEventListener('click', () => {
      this.removeItemFromTier(tierId, item.image_hash);
    });

    return itemDiv;
  }

  handleDragStart(e, source, tierId = null) {
    this.draggedElement = e.target.closest('[data-hash]');
    this.draggedFrom = { source, tierId };
    this.draggedElement.classList.add('dragging');
  }

  async handleDrop(e, targetTierId) {
    e.preventDefault();
    if (!this.draggedElement) return;

    const hash = this.draggedElement.dataset.hash;
    const name = this.draggedElement.title || `Image ${hash}`;

    if (this.draggedFrom.source === 'tier') {
      this.removeItemFromTier(this.draggedFrom.tierId, hash);
    } else if (this.draggedFrom.source === 'unclassified') {
      delete this.unclassifiedImages[hash];
    }

    const targetTier = this.tierlist.data.tiers.find(t => t.id === targetTierId);
    if (targetTier && !targetTier.items.find(i => i.image_hash === hash)) {
      targetTier.items.push({ name, image_hash: hash });
    }

    this.draggedElement.classList.remove('dragging');
    this.draggedElement = null;

    this.renderEditorTierlist();
    this.renderUnclassifiedImages();
    await this.saveTierlist(true);
  }

  async handleDropOnUnclassified(e) {
    e.preventDefault();
    if (!this.draggedElement) return;

    const hash = this.draggedElement.dataset.hash;
    const name = this.draggedElement.title || `Image ${hash}`;

    if (this.draggedFrom.source === 'tier') {
      this.removeItemFromTier(this.draggedFrom.tierId, hash);
    }

    if (!this.unclassifiedImages[hash]) {
      this.unclassifiedImages[hash] = { hash, name };
    }

    this.draggedElement.classList.remove('dragging');
    this.draggedElement = null;

    this.renderEditorTierlist();
    this.renderUnclassifiedImages();
    await this.saveTierlist(true);
  }

  removeItemFromTier(tierId, hash) {
    const tier = this.tierlist.data.tiers.find(t => t.id === tierId);
    if (tier) {
      tier.items = tier.items.filter(i => i.image_hash !== hash);
      this.renderEditorTierlist();
    }
  }

  /* --- EVENT LISTENERS & SAVE --- */

  setupEventListeners() {
    // Bouton modifier titre/description
    document.getElementById('edit-meta-btn')?.addEventListener('click', () => this.openMetaModal(false));

    // Listeners Modal Pop-up
    document.getElementById('meta-modal-submit')?.addEventListener('click', () => this.submitMetaModal());
    document.getElementById('meta-modal-close')?.addEventListener('click', () => {
      if (this.isCreatingNew) window.location.href = 'profile.html';
      else this.closeMetaModal();
    });
    document.getElementById('meta-modal-cancel')?.addEventListener('click', () => {
      if (this.isCreatingNew) window.location.href = 'profile.html';
      else this.closeMetaModal();
    });

    // Visibilité
    document.getElementById('privacy-select')?.addEventListener('change', (e) => {
      this.tierlist.is_private = e.target.value === 'true';
      this.saveTierlist(true);
    });

    // Actions principales
    document.getElementById('reset-btn')?.addEventListener('click', () => this.resetTierlist());
    document.getElementById('delete-btn')?.addEventListener('click', () => this.deleteTierlist());
  }

  async saveTierlist(isAutoSave = false) {
    if (!this.tierlistId) return;

    // Injecter les images non classées dans id: 0 (_blank)
    const blankTier = this.tierlist.data.tiers.find(t => t.id === 0);
    if (blankTier) {
      blankTier.items = Object.values(this.unclassifiedImages).map(img => ({
        name: img.name,
        image_hash: img.hash,
      }));
    }

    try {
      if (!isAutoSave) Loading.show('Enregistrement...');

      await api.updateTierlist(
        this.tierlistId,
        this.tierlist.name,
        this.tierlist.description,
        this.tierlist.data,
        this.tierlist.is_private
      );

      this.updateHeaderDOM();

      if (!isAutoSave) {
        Loading.hide();
        Toast.success('Tier list enregistrée !');
      }
    } catch (error) {
      if (!isAutoSave) Loading.hide();
      console.error('Erreur save:', error);
      Toast.error("Échec de l'enregistrement");
    }
  }

  resetTierlist() {
    Modal.confirm(
      'Réinitialiser la tier list',
      'Toutes les images seront replacées dans la zone d\'attente. Continuer ?',
      async () => {
        this.tierlist.data.tiers.forEach(tier => {
          if (tier.id !== 0) {
            tier.items.forEach(item => {
              this.unclassifiedImages[item.image_hash] = {
                hash: item.image_hash,
                name: item.name,
              };
            });
            tier.items = [];
          }
        });

        this.renderEditorTierlist();
        this.renderUnclassifiedImages();
        await this.saveTierlist(true);
      }
    );
  }

  deleteTierlist() {
    if (!this.tierlistId) return;

    Modal.confirm(
      'Supprimer cette tier list',
      'Cette action est irréversible.',
      async () => {
        try {
          Loading.show('Suppression...');
          await api.deleteTierlist(this.tierlistId);
          Loading.hide();
          Toast.success('Tier list supprimée');
          setTimeout(() => window.location.href = 'profile.html', 500);
        } catch (error) {
          Loading.hide();
          Toast.error('Erreur lors de la suppression');
        }
      }
    );
  }

  getContrastColor(hexColor) {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#FFFFFF';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  tierlistApp = new TierlistApp();
  await tierlistApp.init();
});