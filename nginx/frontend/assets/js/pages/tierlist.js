// tierlist.js - Gestion complète de la tier list

let tierlistApp = null;

class TierlistApp {
  constructor() {
    this.tierlistId = this.getTierlistId();
    this.tierlist = null;
    this.isOwner = false;
    this.draggedElement = null;
  }

  getTierlistId() {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    return idParam ? parseInt(idParam, 10) : null;
  }

  async init() {
    try {
      const isAuth = Auth.isAuthenticated();
      
      // Si on est en mode création (pas d'ID) et non connecté, on redirige vers le login
      if (!this.tierlistId && !isAuth) {
        window.location.href = 'login.html';
        return;
      }

      const user = isAuth ? Auth.getUser() : null;
      Navbar.render(isAuth, user);
      
      this.setupEventListeners();

      if (this.tierlistId && !isNaN(this.tierlistId)) {
        await this.loadTierlist();
      } else {
        this.createNewTierlist();
      }
    } catch (error) {
      console.error('Erreur init détaillée :', error);
      Toast.error(error.message || 'Erreur lors du chargement de la page');
    }
  }

  createNewTierlist() {
    const user = Auth.getUser();
    this.tierlist = {
      id: null,
      name: '',
      description: '',
      user_id: user ? user.id : null,
      is_private: true,
      data: {
        tiers: [
          { id: 1, name: 'S', color: '#FF7F7F', textColor: '#000000', items: [] },
          { id: 2, name: 'A', color: '#FFBF7F', textColor: '#000000', items: [] },
          { id: 3, name: 'B', color: '#FFDF7F', textColor: '#000000', items: [] },
          { id: 4, name: 'C', color: '#FFFF7F', textColor: '#000000', items: [] },
          { id: 5, name: 'D', color: '#BFFF7F', textColor: '#000000', items: [] },
          { id: 0, name: '_blank', color: '#FFFFFF', textColor: '#000000', items: [] },
        ],
        order: [1, 2, 3, 4, 5, 0],
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
      const currentUser = Auth.getUser();
      this.isOwner = currentUser && (this.tierlist.user_id === currentUser.id);

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

    if (titleInput) titleInput.value = this.tierlist.name || '';
    if (descInput) descInput.value = this.tierlist.description || '';

    if (this.tierlist && this.tierlist.id) {
      if (metaTitle) metaTitle.textContent = "⚙️ Titre et Description";
      if (saveMetaBtn) saveMetaBtn.textContent = "Mettre à jour titre & description";
      if (contentSections) contentSections.style.display = 'block';

      const privacySelect = document.getElementById('privacy-select');
      if (privacySelect) privacySelect.value = this.tierlist.is_private.toString();

      this.setupFileUpload();
      this.renderEditorTierlist();
      this.renderUnclassifiedImages();
    } else {
      if (metaTitle) metaTitle.textContent = "Créer une nouvelle Tier List";
      if (saveMetaBtn) saveMetaBtn.textContent = "Créer la Tier List";
      if (contentSections) contentSections.style.display = 'none';
    }
  }

  async saveOrUpdateMeta() {
    const titleInput = document.getElementById('title-input');
    const descInput = document.getElementById('description-input');
    
    const title = titleInput ? titleInput.value.trim() : '';
    const description = descInput ? descInput.value.trim() : '';

    if (!title) {
      Toast.error('Veuillez entrer un titre');
      if (titleInput) titleInput.focus();
      return;
    }

    this.tierlist.name = title;
    this.tierlist.description = description;

    try {
      if (!this.tierlist.id) {
        Loading.show('Création de la tier list...');
        const user = Auth.getUser();
        const res = await api.createTierlist(
          user.id,
          title,
          description,
          this.tierlist.data,
          this.tierlist.is_private
        );
        Loading.hide();
        
        if (!res || !res.data || !res.data.id) {
          throw new Error("Réponse API invalide");
        }
        
        this.tierlistId = res.data.id;
        this.tierlist.id = res.data.id;
        
        window.history.replaceState({}, '', `tierlist.html?id=${this.tierlistId}`);
        Toast.success('Tier list créée ! Vous pouvez désormais ajouter des images.');
        this.showEditorMode();
      } else {
        await this.saveTierlist(true);
        Toast.success('Titre et description mis à jour');
      }
    } catch (error) {
      Loading.hide();
      console.error('Erreur saveOrUpdateMeta:', error);
      Toast.error(`Erreur : ${error.message || 'Impossible de sauvegarder'}`);
    }
  }

  setupEventListeners() {
    const saveMetaBtn = document.getElementById('save-meta-btn');
    if (saveMetaBtn) saveMetaBtn.onclick = () => this.saveOrUpdateMeta();

    document.getElementById('privacy-select')?.addEventListener('change', (e) => {
      if (this.tierlist) {
        this.tierlist.is_private = e.target.value === 'true';
        this.saveTierlist(true);
      }
    });

    document.getElementById('reset-btn')?.addEventListener('click', () => this.resetTierlist());
    document.getElementById('delete-btn')?.addEventListener('click', () => this.deleteTierlist());
  }

  /* --- UPLOAD & IMAGES --- */
  setupFileUpload() {
    const uploadZone = document.getElementById('image-upload-zone');
    const fileInput = document.getElementById('image-input');
    
    if (!uploadZone || !fileInput) return;
    if (uploadZone.dataset.setup) return;
    
    uploadZone.dataset.setup = 'true';

    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragging');
    });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragging'));
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragging');
      this.handleFileSelect(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));
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
      
      const blankTier = this.tierlist.data.tiers.find(t => t.id === 0);
      if(blankTier) {
        blankTier.items.push({ name: imageName, image_hash: hash });
      }

      await this.saveTierlist(true);
      Loading.hide();
      this.renderUnclassifiedImages();
      Toast.success(`${file.name} ajoutée aux images en attente`);
    } catch (error) {
      Loading.hide();
      Toast.error(`Erreur upload: ${error.message}`);
    }
  }

  async removeImageAndSync(hash) {
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
    if (!container) return;
    container.innerHTML = '';
    
    const tiers = this.tierlist.data.tiers;
    const order = this.tierlist.data.order || [];

    order.forEach(tierId => {
      if (tierId === 0) return;
      const tier = tiers.find(t => t.id === tierId);
      if (!tier) return;

      const tierColumn = document.createElement('div');
      tierColumn.className = 'tier-column';
      tierColumn.dataset.tierId = tier.id;

      // 1. Label à gauche (Nom de la section)
      const tierLabel = document.createElement('div');
      tierLabel.className = 'tier-label';
      tierLabel.style.backgroundColor = tier.color;
      
      const currentTextColor = tier.textColor || this.getContrastColor(tier.color);
      tierLabel.style.color = currentTextColor;

      // On utilise un DIV éditable au lieu d'un input !
      tierLabel.innerHTML = `
        <div contenteditable="true" class="tier-name" data-tier-id="${tier.id}" spellcheck="false">${tier.name}</div>
      `;
      
      const nameEl = tierLabel.querySelector('.tier-name');
      
      // Auto-save à la perte du focus (quand on clique ailleurs)
      nameEl.addEventListener('blur', (e) => {
        tier.name = e.target.innerText.trim();
        this.saveTierlist(true);
      });

      // Valider avec la touche "Entrée" (pour éviter de sauter 15 lignes par accident)
      nameEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          nameEl.blur(); // Retire le curseur et déclenche la sauvegarde
        }
      });

      // Fonction magique : Réduit la taille du texte s'il est trop long
      const adjustSize = () => {
        nameEl.style.fontSize = '18px'; // On remet à la taille max
        let size = 18;
        // Tant que le texte déborde de la case (ex: > 90px de haut), on rétrécit la police
        while (nameEl.scrollHeight > 90 && size > 10) {
          size--;
          nameEl.style.fontSize = size + 'px';
        }
      };
      
      // Applique le rétrécissement dès qu'on tape au clavier
      nameEl.addEventListener('input', adjustSize);
      // Applique le rétrécissement au chargement initial de la page
      setTimeout(adjustSize, 0); 

      tierColumn.appendChild(tierLabel);

      // 2. Zone des items au milieu
      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'tier-items';
      itemsContainer.dataset.tierId = tier.id;
      
      itemsContainer.addEventListener('dragover', (e) => this.handleDragOver(e, itemsContainer));
      itemsContainer.addEventListener('drop', (e) => this.handleDrop(e));

      tier.items.forEach(item => {
        const itemDiv = this.createItemElement(item, tier.id);
        itemsContainer.appendChild(itemDiv);
      });
      tierColumn.appendChild(itemsContainer);

      // 3. Boutons et Couleurs à droite
      const tierControls = document.createElement('div');
      tierControls.className = 'tier-controls';
      // On élargit à 80px pour faire tenir 2 boutons côte à côte
      tierControls.style.width = '80px'; 
      
      // On regroupe les boutons avec des div en display: flex
      tierControls.innerHTML = `
        <div style="display: flex; gap: 4px; margin-bottom: 2px;">
          <input type="color" class="tier-bg-color" value="${tier.color}" title="Couleur de fond" style="flex:1; height: 20px; padding: 0; border: none; cursor: pointer; border-radius: 4px;">
          <input type="color" class="tier-text-color" value="${currentTextColor}" title="Couleur du texte" style="flex:1; height: 20px; padding: 0; border: none; cursor: pointer; border-radius: 4px;">
        </div>
        
        <div style="display: flex; gap: 4px;">
          <button class="btn-tier-control" style="flex: 1;" title="Monter" onclick="tierlistApp.moveTierUp(${tier.id})">▲</button>
          <button class="btn-tier-control" style="flex: 1;" title="Descendre" onclick="tierlistApp.moveTierDown(${tier.id})">▼</button>
        </div>
        
        <div style="display: flex; gap: 4px;">
          <button class="btn-tier-control" style="flex: 1;" title="Ajouter au-dessus" onclick="tierlistApp.addTierAt(${tier.id}, 0)">+▲</button>
          <button class="btn-tier-control" style="flex: 1;" title="Ajouter en-dessous" onclick="tierlistApp.addTierAt(${tier.id}, 1)">+▼</button>
        </div>
        
        <button class="btn-tier-control" title="Supprimer" style="width: 100%; color:#ff4444;" onclick="tierlistApp.deleteTier(${tier.id})">✖</button>
      `;

      // Gestion des changements de couleur
      tierControls.querySelector('.tier-bg-color').addEventListener('change', (e) => {
        tier.color = e.target.value;
        tierLabel.style.backgroundColor = e.target.value;
        this.saveTierlist(true);
      });
      
      tierControls.querySelector('.tier-text-color').addEventListener('change', (e) => {
        tier.textColor = e.target.value;
        tierLabel.style.color = e.target.value;
        this.saveTierlist(true);
      });

      tierColumn.appendChild(tierControls);
      
      container.appendChild(tierColumn);
    });
  }

  renderUnclassifiedImages() {
    const grid = document.getElementById('images-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    grid.dataset.tierId = "0";
    grid.addEventListener('dragover', (e) => this.handleDragOver(e, grid));
    grid.addEventListener('drop', (e) => this.handleDrop(e));

    const blankTier = this.tierlist.data.tiers.find(t => t.id === 0);
    if(blankTier && blankTier.items) {
      blankTier.items.forEach(item => {
        const itemDiv = this.createItemElement(item, 0);
        grid.appendChild(itemDiv);
      });
    }
  }

  createItemElement(item, tierId) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'tier-item';
    itemDiv.draggable = true;
    itemDiv.dataset.hash = item.image_hash;
    itemDiv.innerHTML = `
      <img src="${api.getImageUrl(item.image_hash)}" alt="${item.name}" title="${item.name}">
      <button class="remove-btn" data-hash="${item.image_hash}">✖</button>
    `;
    
    itemDiv.addEventListener('dragstart', (e) => this.handleDragStart(e));
    itemDiv.querySelector('.remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeImageAndSync(item.image_hash);
    });
    
    return itemDiv;
  }

  handleDragStart(e) {
    this.draggedElement = e.target.closest('[data-hash]');
    if (this.draggedElement) {
      this.draggedElement.classList.add('dragging');
      if(e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; }
    }
  }

  handleDragOver(e, container) {
    e.preventDefault();
    if (!this.draggedElement) return;
    
    const afterElement = this.getDragAfterElement(container, e.clientX, e.clientY);
    if (afterElement == null) {
      container.appendChild(this.draggedElement);
    } else {
      container.insertBefore(this.draggedElement, afterElement);
    }
  }

  getDragAfterElement(container, x, y) {
    const draggableElements = [...container.querySelectorAll('.tier-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      if (y >= box.top && y <= box.bottom) {
        const offset = x - box.left - box.width / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        }
      }
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  async handleDrop(e) {
    e.preventDefault();
    if (!this.draggedElement) return;

    this.draggedElement.classList.remove('dragging');
    this.draggedElement = null;
    
    this.rebuildTiersFromDOM();
    await this.saveTierlist(true);
  }

  rebuildTiersFromDOM() {
    this.tierlist.data.tiers.forEach(tier => {
      let container = tier.id === 0 
        ? document.getElementById('images-grid') 
        : document.querySelector(`.tier-items[data-tier-id="${tier.id}"]`);
      
      if (container) {
        const elements = container.querySelectorAll('.tier-item');
        const newItems = [];
        elements.forEach(el => {
          const hash = el.dataset.hash;
          const imgEl = el.querySelector('img');
          const name = imgEl ? imgEl.alt : `Image ${hash}`;
          newItems.push({ image_hash: hash, name: name });
        });
        tier.items = newItems;
      }
    });
  }

  async saveTierlist(isAutoSave = false) {
    if (!this.tierlistId) return;
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

  /* --- CONTRÔLES TIERMAKER --- */
  moveTierUp(tierId) {
    const visibleOrder = this.tierlist.data.order.filter(id => id !== 0);
    const index = visibleOrder.indexOf(tierId);
    if (index > 0) {
      const temp = visibleOrder[index];
      visibleOrder[index] = visibleOrder[index - 1];
      visibleOrder[index - 1] = temp;
      this.tierlist.data.order = [...visibleOrder, 0];
      this.renderEditorTierlist();
      this.saveTierlist(true);
    }
  }

  moveTierDown(tierId) {
    const visibleOrder = this.tierlist.data.order.filter(id => id !== 0);
    const index = visibleOrder.indexOf(tierId);
    if (index < visibleOrder.length - 1) {
      const temp = visibleOrder[index];
      visibleOrder[index] = visibleOrder[index + 1];
      visibleOrder[index + 1] = temp;
      this.tierlist.data.order = [...visibleOrder, 0];
      this.renderEditorTierlist();
      this.saveTierlist(true);
    }
  }

  addTierAt(targetTierId, offset) {
    const visibleOrder = this.tierlist.data.order.filter(id => id !== 0);
    const index = visibleOrder.indexOf(targetTierId);
    
    const newId = Math.max(...this.tierlist.data.tiers.map(t => t.id), 0) + 1;
    const newTier = { id: newId, name: 'Nouveau', color: '#CCCCCC', textColor: '#000000', items: [] };
    
    this.tierlist.data.tiers.push(newTier);
    visibleOrder.splice(index + offset, 0, newId);
    this.tierlist.data.order = [...visibleOrder, 0];
    
    this.renderEditorTierlist();
    this.saveTierlist(true);
  }

  deleteTier(tierId) {
    // 🛠️ VÉRIFICATION : Il faut laisser au moins 1 rang !
    const visibleTiers = this.tierlist.data.tiers.filter(t => t.id !== 0);
    if (visibleTiers.length <= 1) {
      Toast.warning("Impossible ! Il doit rester au moins une section.");
      return;
    }

    Modal.confirm('Supprimer', 'Voulez-vous supprimer ce rang ? Les images retourneront dans la zone d\'attente.', async () => {
      const tier = this.tierlist.data.tiers.find(t => t.id === tierId);
      const blankTier = this.tierlist.data.tiers.find(t => t.id === 0);
      
      if (tier && blankTier) {
        blankTier.items.push(...tier.items);
      }
      
      this.tierlist.data.tiers = this.tierlist.data.tiers.filter(t => t.id !== tierId);
      this.tierlist.data.order = this.tierlist.data.order.filter(id => id !== tierId);
      
      this.renderEditorTierlist();
      this.renderUnclassifiedImages();
      await this.saveTierlist(true);
    });
  }

  /* --- MODE VISUALISEUR & UTILITAIRES --- */
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
      setTimeout(() => window.location.href = `tierlist.html?id=${newId}`, 500);
    } catch (error) {
      Loading.hide();
      Toast.error('Erreur lors de la duplication');
    }
  }

  renderViewerTierlist() {
    const container = document.getElementById('viewer-tierlist');
    if (!container) return;
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
      
      const currentTextColor = tier.textColor || this.getContrastColor(tier.color);
      tierLabel.style.color = currentTextColor;
      
      // Ici pas de contenteditable="true" car le visiteur ne peut pas éditer
      tierLabel.innerHTML = `<div class="tier-name">${tier.name}</div>`;
      
      // Auto-réduction de la taille du texte au chargement
      setTimeout(() => {
        const nameEl = tierLabel.querySelector('.tier-name');
        if (nameEl) {
          nameEl.style.fontSize = '18px';
          let size = 18;
          while (nameEl.scrollHeight > 90 && size > 10) {
            size--;
            nameEl.style.fontSize = size + 'px';
          }
        }
      }, 0);

      tierColumn.appendChild(tierLabel);

      // 🛠️ LA PARTIE MANQUANTE : On remet les images dans les rangs pour les visiteurs !
      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'tier-items';
      
      tier.items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'tier-item';
        itemDiv.innerHTML = `<img src="${api.getImageUrl(item.image_hash)}" alt="${item.name}" title="${item.name}">`;
        itemsContainer.appendChild(itemDiv);
      });
      
      tierColumn.appendChild(itemsContainer);
      // --------------------------------------------------------------------------

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
        const blankTier = this.tierlist.data.tiers.find(t => t.id === 0);
        this.tierlist.data.tiers.forEach(tier => {
          if (tier.id !== 0) {
            blankTier.items.push(...tier.items);
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

  // Conservé par sécurité pour la rétrocompatibilité
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