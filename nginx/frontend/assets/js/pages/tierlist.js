// tierlist.js - Gestion complète de la tier list

let tierlistApp = null;

class TierlistApp {
  constructor() {
    this.tierlistId = this.getTierlistId();
    this.tierlist = null;
    this.isOwner = false;
    this.unclassifiedImages = {};
    this.uploadedHashes = new Set();
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

      Navbar.render(true, Auth.getUser());

      if (this.tierlistId) {
        // Mode consultation/édition
        await this.loadTierlist();
      } else {
        // Mode création
        this.createNewTierlist();
      }
    } catch (error) {
      console.error('Erreur init:', error);
      Toast.error('Erreur lors du chargement');
    }
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

  showViewerMode() {
    document.getElementById('viewer-mode').style.display = 'block';
    document.getElementById('editor-mode').style.display = 'none';

    document.getElementById('viewer-title').textContent = this.tierlist.name;
    document.getElementById('viewer-description').textContent = this.tierlist.description || 'Pas de description';
    document.getElementById('viewer-creator').textContent = `Créée le ${new Date(this.tierlist.created_at).toLocaleDateString('fr-FR')}`;

    // Actions pour les visiteurs
    const actionsContainer = document.getElementById('viewer-actions');
    actionsContainer.innerHTML = '';

    if (Auth.isAuthenticated()) {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn btn-primary';
      copyBtn.textContent = '📋 Copier cette tier list';
      copyBtn.addEventListener('click', () => this.copyTierlist());
      actionsContainer.appendChild(copyBtn);
    } else {
      const loginBtn = document.createElement('button');
      loginBtn.className = 'btn btn-primary';
      loginBtn.textContent = '📋 Copier (se connecter)';
      loginBtn.addEventListener('click', () => {
        window.location.href = 'login.html';
      });
      actionsContainer.appendChild(loginBtn);
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
      const tier = tiers.find(t => t.id === tierId);
      if (!tier) return;

      const tierColumn = document.createElement('div');
      tierColumn.className = 'tier-column';

      // Tier label
      const tierLabel = document.createElement('div');
      tierLabel.className = 'tier-label';
      tierLabel.style.backgroundColor = tier.color;
      tierLabel.style.color = this.getContrastColor(tier.color);
      tierLabel.textContent = tier.name;
      tierColumn.appendChild(tierLabel);

      // Items
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
  }

  showEditorMode() {
    document.getElementById('viewer-mode').style.display = 'none';
    document.getElementById('editor-mode').style.display = 'block';

    document.getElementById('title-input').value = this.tierlist.name;
    document.getElementById('description-input').value = this.tierlist.description || '';
    document.getElementById('privacy-select').value = this.tierlist.is_private.toString();

    // Charger les images non classées (tier 0)
    const blankTier = this.tierlist.data.tiers.find(t => t.id === 0);
    if (blankTier && blankTier.items) {
      blankTier.items.forEach(item => {
        this.unclassifiedImages[item.image_hash] = {
          hash: item.image_hash,
          name: item.name,
        };
      });
    }

    this.setupFileUpload();
    this.setupEventListeners();
    this.renderEditorTierlist();
    this.renderUnclassifiedImages();
  }

  setupFileUpload() {
    const uploadZone = document.getElementById('image-upload-zone');
    const fileInput = document.getElementById('image-input');

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
      const files = e.dataTransfer.files;
      this.handleFileSelect(files);
    });

    fileInput.addEventListener('change', (e) => {
      this.handleFileSelect(e.target.files);
    });
  }

  async handleFileSelect(files) {
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        Toast.warning(`${file.name} n'est pas une image`);
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        Toast.warning(`${file.name} est trop volumineux (max 5 MB)`);
        continue;
      }

      await this.uploadImage(file);
    }
  }

  async uploadImage(file) {
    try {
      Loading.show(`Upload de ${file.name}...`);
      const response = await api.uploadImage(file);
      Loading.hide();

      const hash = response.data.hash;
      this.uploadedHashes.add(hash);
      this.unclassifiedImages[hash] = {
        hash,
        name: file.name.replace(/\.[^.]+$/, ''),
      };

      this.renderUnclassifiedImages();
      Toast.success(`${file.name} uploadée`);
    } catch (error) {
      Loading.hide();
      Toast.error(`Erreur upload: ${error.message}`);
    }
  }

  renderUnclassifiedImages() {
    const grid = document.getElementById('images-grid');
    grid.innerHTML = '';

    // Ajouter une zone de drop
    const dropZone = document.createElement('div');
    dropZone.style.cssText = 'flex: 1; min-width: 100%; min-height: 60px; border: 2px dashed var(--border); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--text-light); font-size: 12px;';
    dropZone.textContent = 'Déposer ici pour ajouter à la zone de repos';
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
        delete this.unclassifiedImages[img.hash];
        this.renderUnclassifiedImages();
      });

      grid.appendChild(imgDiv);
    });
  }

  handleDropOnUnclassified(e) {
    e.preventDefault();

    if (!this.draggedElement) return;

    const hash = this.draggedElement.dataset.hash;
    const name = this.draggedElement.title || `Image ${hash}`;

    // Retirer de la source (un tier)
    if (this.draggedFrom.source === 'tier') {
      this.removeItemFromTier(this.draggedFrom.tierId, hash);
    }

    // Ajouter aux non classées
    if (!this.unclassifiedImages[hash]) {
      this.unclassifiedImages[hash] = { hash, name };
    }

    this.draggedElement.classList.remove('dragging');
    this.draggedElement = null;

    this.renderEditorTierlist();
    this.renderUnclassifiedImages();
  }

  renderEditorTierlist() {
    const container = document.getElementById('tierlist-editor-container');
    container.innerHTML = '';

    const tiers = this.tierlist.data.tiers;
    const order = this.tierlist.data.order || [];

    order.forEach(tierId => {
      const tier = tiers.find(t => t.id === tierId);
      if (!tier) return;

      const tierColumn = document.createElement('div');
      tierColumn.className = 'tier-column';
      tierColumn.dataset.tierId = tier.id;

      // Tier label avec édition
      const tierLabel = document.createElement('div');
      tierLabel.className = 'tier-label';
      tierLabel.style.backgroundColor = tier.color;
      tierLabel.style.color = this.getContrastColor(tier.color);

      if (tier.id === 0) {
        // _blank tier
        tierLabel.innerHTML = `<span class="tier-name">_blank</span>`;
      } else {
        tierLabel.innerHTML = `
          <input type="text" class="tier-name" value="${tier.name}" data-tier-id="${tier.id}">
          <input type="color" class="tier-color-picker" value="${tier.color}" data-tier-id="${tier.id}">
        `;
        tierLabel.querySelector('.tier-name').addEventListener('change', (e) => {
          tier.name = e.target.value;
        });
        tierLabel.querySelector('.tier-color-picker').addEventListener('change', (e) => {
          tier.color = e.target.value;
          tierLabel.style.backgroundColor = e.target.value;
        });
      }

      tierColumn.appendChild(tierLabel);

      // Items container
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

  handleDrop(e, targetTierId) {
    e.preventDefault();

    if (!this.draggedElement) return;

    const hash = this.draggedElement.dataset.hash;
    const name = this.draggedElement.title || `Image ${hash}`;

    // Retirer de la source
    if (this.draggedFrom.source === 'tier') {
      this.removeItemFromTier(this.draggedFrom.tierId, hash);
    } else if (this.draggedFrom.source === 'unclassified') {
      // Retirer des images non classées
      delete this.unclassifiedImages[hash];
    }

    // Ajouter à la cible
    const targetTier = this.tierlist.data.tiers.find(t => t.id === targetTierId);
    if (targetTier && !targetTier.items.find(i => i.image_hash === hash)) {
      targetTier.items.push({ name, image_hash: hash });
    }

    this.draggedElement.classList.remove('dragging');
    this.draggedElement = null;

    this.renderEditorTierlist();
    this.renderUnclassifiedImages();
  }

  removeItemFromTier(tierId, hash) {
    const tier = this.tierlist.data.tiers.find(t => t.id === tierId);
    if (tier) {
      tier.items = tier.items.filter(i => i.image_hash !== hash);
      this.renderEditorTierlist();
    }
  }

  setupEventListeners() {
    document.getElementById('save-btn').addEventListener('click', () => this.saveTierlist());
    document.getElementById('reset-btn').addEventListener('click', () => this.resetTierlist());
    document.getElementById('delete-btn').addEventListener('click', () => this.deleteTierlist());
  }

  async saveTierlist() {
    const name = document.getElementById('title-input').value.trim();
    const description = document.getElementById('description-input').value.trim();
    const isPrivate = document.getElementById('privacy-select').value === 'true';

    if (!name) {
      Toast.error('Veuillez entrer un titre');
      return;
    }

    // Nettoyer les images non classées du data
    const blankTier = this.tierlist.data.tiers.find(t => t.id === 0);
    if (blankTier) {
      blankTier.items = Object.values(this.unclassifiedImages).map(img => ({
        name: img.name,
        image_hash: img.hash,
      }));
    }

    try {
      Loading.show('Enregistrement...');

      if (this.tierlist.id) {
        await api.updateTierlist(this.tierlist.id, name, description, this.tierlist.data, isPrivate);
      } else {
        const response = await api.createTierlist(Auth.getUser().id, name, description, this.tierlist.data, isPrivate);
        this.tierlist.id = response.data.id;
      }

      Loading.hide();
      Toast.success('Tier list enregistrée !');
      setTimeout(() => {
        window.location.href = `tierlist.html?id=${this.tierlist.id}`;
      }, 500);
    } catch (error) {
      Loading.hide();
      Toast.error('Erreur lors de l\'enregistrement');
    }
  }

  resetTierlist() {
    Modal.confirm(
      'Réinitialiser la tier list',
      'Toutes les images seront déplacées dans la zone de repos (_blank). Continuer ?',
      () => {
        this.tierlist.data.tiers.forEach(tier => {
          if (tier.id !== 0) {
            tier.items = [];
          }
        });
        this.renderEditorTierlist();
      }
    );
  }

  deleteTierlist() {
    if (!this.tierlist.id) {
      Toast.warning('Créez d\'abord la tier list');
      return;
    }

    Modal.confirm(
      'Supprimer cette tier list',
      'Cette action est irréversible.',
      async () => {
        try {
          Loading.show('Suppression...');
          await api.deleteTierlist(this.tierlist.id);
          Loading.hide();
          Toast.success('Tier list supprimée');
          setTimeout(() => window.location.href = 'profile.html', 500);
        } catch (error) {
          Loading.hide();
          Toast.error('Erreur');
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
