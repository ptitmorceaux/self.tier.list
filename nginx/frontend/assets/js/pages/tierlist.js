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

      const user = Auth.getUser();
      if (!user || !user.id) {
        Toast.error("Session invalide. Veuillez vous reconnecter.");
        Auth.logout();
        return;
      }

      Navbar.render(true, user);
      this.setupEventListeners();

      if (this.tierlistId) {
        // Mode consultation / édition d'une tierlist existante
        await this.loadTierlist();
      } else {
        // Mode création d'une nouvelle tierlist
        this.createNewTierlist();
      }
    } catch (error) {
      console.error('Erreur init :', error);
      Toast.error('Erreur lors du chargement de la page');
    }
  }

  createNewTierlist() {
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
    this.showEditorMode();
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
      Toast.error('Tier list introuvable');
      setTimeout(() => window.location.href = 'index.html', 1000);
    }
  }

  showEditorMode() {
    document.getElementById('viewer-mode').style.display = 'none';
    document.getElementById('editor-mode').style.display = 'block';

    const titleInput = document.getElementById('title-input');
    const descInput = document.getElementById('description-input');
    const saveMetaBtn = document.getElementById('save-meta-btn');
    const contentSections = document.getElementById('tierlist-content-sections');
    const metaTitle = document.getElementById('meta-section-title');

    titleInput.value = this.tierlist.name || '';
    descInput.value = this.tierlist.description || '';

    if (this.tierlist.id) {
      // --- TIERLIST DÉJÀ CRÉÉE EN BDD ---
      metaTitle.textContent = "📝 Titre et Description";
      saveMetaBtn.textContent = "Mettre à jour titre & description";
      contentSections.style.display = 'block';

      document.getElementById('privacy-select').value = this.tierlist.is_private.toString();

      // Extraire les images non classées
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
    } else {
      // --- NOUVELLE TIERLIST (NON CRÉÉE) ---
      metaTitle.textContent = "🆕 Créer une nouvelle Tier List";
      saveMetaBtn.textContent = "Créer la Tier List";
      contentSections.style.display = 'none';
    }
  }

  async saveOrUpdateMeta(e) {
    if (e) e.preventDefault();

    const titleInput = document.getElementById('title-input');
    const descInput = document.getElementById('description-input');

    if (!titleInput) {
      Toast.error("Champ titre introuvable dans la page");
      return;
    }

    const title = titleInput.value.trim();
    const description = descInput ? descInput.value.trim() : '';

    // Si le titre est vide, avertir l'utilisateur
    if (!title) {
      Toast.warning('Veuillez d\'abord saisir un titre pour votre tier list');
      titleInput.focus();
      return;
    }

    this.tierlist.name = title;
    this.tierlist.description = description;

    try {
      if (!this.tierlist.id) {
        // --- CRÉATION EN BDD ---
        Loading.show('Création de la tier list...');
        const res = await api.createTierlist(
          Auth.getUser().id,
          title,
          description,
          this.tierlist.data,
          this.tierlist.is_private
        );
        Loading.hide();

        if (!res || !res.data || !res.data.id) {
          throw new Error("Réponse de l'API invalide lors de la création");
        }

        this.tierlistId = res.data.id;
        this.tierlist.id = res.data.id;

        // Mise à jour de l'URL sans recharger la page
        window.history.replaceState({}, '', `tierlist.html?id=${this.tierlistId}`);
        Toast.success('Tier list créée ! Vous pouvez désormais ajouter des images.');

        // Révéler le reste des sections (upload, grille, visibilité)
        this.showEditorMode();
      } else {
        // --- MISE À JOUR DE LA META ---
        await this.saveTierlist(true);
        Toast.success('Titre et description mis à jour');
      }
    } catch (error) {
      Loading.hide();
      console.error('Erreur saveOrUpdateMeta :', error);
      Toast.error(`Erreur : ${error.message || 'Impossible de créer la tier list'}`);
    }
  }

  /* --- UPLOAD & IMAGES --- */

  setupFileUpload() {
    const uploadZone = document.getElementById('image-upload-zone');
    const fileInput = document.getElementById('image-input');

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
      
      const response = await api.uploadImage(file);
      const hash = response.data.hash;
      const imageName = file.name.replace(/\.[^.]+$/, '');

      this.unclassifiedImages[hash] = {
        hash: hash,
        name: imageName,
      };

      // Auto-save immédiat en BDD
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

  /* --- RENDER GRILLE & DRAG AND DROP --- */

  renderEditorTierlist() {
    const container = document.getElementById('tierlist-editor-container');
    container.innerHTML = '';

    const tiers = this.tierlist.data.tiers;
    const order = this.tierlist.data.order || [];

    order.forEach(tierId => {
      if (tierId === 0) return; // Ignorer le tier 0 (_blank) dans les colonnes

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

  /* --- EVENT LISTENERS & AUTOSAVE --- */

  setupEventListeners() {
    const saveMetaBtn = document.getElementById('save-meta-btn');
    if (saveMetaBtn) {
      saveMetaBtn.onclick = (e) => this.saveOrUpdateMeta(e);
    } else {
      console.error("Bouton #save-meta-btn introuvable dans le DOM");
    }

    // Changement de visibilité avec Auto-Save
    document.getElementById('privacy-select')?.addEventListener('change', (e) => {
      this.tierlist.is_private = e.target.value === 'true';
      this.saveTierlist(true);
    });

    // Actions
    document.getElementById('reset-btn')?.addEventListener('click', () => this.resetTierlist());
    document.getElementById('delete-btn')?.addEventListener('click', () => this.deleteTierlist());
  }

  async saveTierlist(isAutoSave = false) {
    // Auto-save disponible uniquement si la Tier List est créée en BDD
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

      if (!isAutoSave) {
        Loading.hide();
        Toast.success('Tier list enregistrée !');
      }
    } catch (error) {
      if (!isAutoSave) Loading.hide();
      console.error('Erreur auto-save:', error);
      Toast.error("Échec de la sauvegarde automatique");
    }
  }

  /* --- MODE VISUALISEUR --- */

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

    order.forEach(tierId => {
      if (tierId === 0) return;

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