import {
  apiJson,
  authRequired,
  clearSession,
  countItems,
  createDefaultTierlistData,
  ensureLoggedOutLinks,
  escapeHtml,
  fetchCurrentUser,
  formatDateTime,
  getImageUrl,
  getPreferredApiBase,
  nextTierId,
  normalizeTierlistData,
  partitionTierlists,
  showMessage,
} from "./app.js";

const dashboardUser = document.querySelector("[data-dashboard-user]");
const dashboardSummary = document.querySelector("[data-dashboard-summary]");
const countOwned = document.querySelector("[data-count-owned]");
const countPublic = document.querySelector("[data-count-public]");
const apiBaseNode = document.querySelector("[data-api-base]");
const createButton = document.querySelector("[data-create-tierlist]");
const refreshButton = document.querySelector("[data-refresh-tierlists]");
const searchInput = document.querySelector("[data-tierlist-search]");
const grid = document.querySelector("[data-tierlist-grid]");
const emptyState = document.querySelector("[data-empty-tierlists]");
const editorTitle = document.querySelector("[data-editor-title]");
const editorBody = document.querySelector("[data-editor-body]");
const duplicateButton = document.querySelector("[data-duplicate-tierlist]");
const deleteButton = document.querySelector("[data-delete-tierlist]");
const saveButton = document.querySelector("[data-save-tierlist]");
const messageBox = document.querySelector("[data-dashboard-message]");

const state = {
  user: null,
  tierlists: [],
  filteredTierlists: [],
  activeTierlist: null,
  draft: null,
  search: "",
};

function setMessage(message, type = "info") {
  showMessage(messageBox, message, type);
}

function requireTierlistSelection() {
  if (!state.activeTierlist) {
    setMessage("Sélectionne d’abord une tier list dans le catalogue.", "error");
    return false;
  }

  return true;
}

function getOrderedTiers(data) {
  const normalized = normalizeTierlistData(data);
  return normalized.tiers.slice().sort((left, right) => normalized.order.indexOf(left.id) - normalized.order.indexOf(right.id));
}

function renderDashboardHeader() {
  if (!state.user) {
    return;
  }

  dashboardUser.textContent = state.user.pseudo;
  dashboardSummary.textContent = `Connecté en tant que ${state.user.username} depuis ${formatDateTime(state.user.created_at)}.`;
  const split = partitionTierlists(state.tierlists, state.user.id);
  countOwned.textContent = String(split.mine.length);
  countPublic.textContent = String(split.publicLists.length);
  apiBaseNode.textContent = getPreferredApiBase() || "auto";
}

function renderTierlistCards() {
  const query = state.search.trim().toLowerCase();
  const rows = state.tierlists.filter((tierlist) => {
    if (!query) {
      return true;
    }

    return [tierlist.name, tierlist.description, String(tierlist.id)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  state.filteredTierlists = rows;
  grid.innerHTML = rows
    .map((tierlist) => {
      const owned = Number(tierlist.user_id) === Number(state.user?.id);
      const tiers = getOrderedTiers(tierlist.data);
      const itemTotal = countItems(tierlist.data);
      return `
        <article class="tierlist-card">
          <div class="card-row">
            <div>
              <h3>${escapeHtml(tierlist.name)}</h3>
              <p class="lead">${escapeHtml(tierlist.description || "Aucune description")}</p>
            </div>
            <span class="status-pill ${owned ? "is-own" : "is-public"}">${owned ? "À moi" : "Public"}</span>
          </div>
          <div class="card-row">
            <span class="status-pill ${tierlist.is_private ? "is-private" : "is-public"}">${tierlist.is_private ? "Privée" : "Publique"}</span>
            <span class="status-pill">${tiers.length} tiers · ${itemTotal} items</span>
          </div>
          <div class="card-row">
            <small>Mis à jour ${escapeHtml(formatDateTime(tierlist.updated_at))}</small>
          </div>
          <div class="inline-actions">
            <button class="ghost-button" type="button" data-open-tierlist="${tierlist.id}">Ouvrir</button>
            <button class="ghost-button" type="button" data-duplicate-row="${tierlist.id}">Dupliquer</button>
            ${owned ? `<button class="ghost-button" type="button" data-remove-row="${tierlist.id}">Supprimer</button>` : ""}
          </div>
        </article>
      `;
    })
    .join("");

  emptyState.classList.toggle("hidden", rows.length > 0);
}

function renderEditor() {
  if (!state.draft) {
    editorTitle.textContent = "Sélectionne une tier list";
    editorBody.innerHTML = '<div class="empty-state">Ouvre une tier list pour modifier son JSONB, ses items et ses images.</div>';
    duplicateButton.disabled = true;
    deleteButton.disabled = true;
    saveButton.disabled = true;
    return;
  }

  duplicateButton.disabled = false;
  deleteButton.disabled = false;
  saveButton.disabled = false;
  editorTitle.textContent = `${state.draft.name} · #${state.draft.id || "nouveau"}`;

  const tiers = getOrderedTiers(state.draft.data);
  const rows = tiers
    .map((tier) => {
      const itemCards = (tier.items || [])
        .map((item, index) => {
          const preview = item.image_hash
            ? `<img class="item-thumb" src="${escapeHtml(getImageUrl(item.image_hash))}" alt="${escapeHtml(item.name || item.image_hash)}">`
            : `<div class="item-thumb is-empty">No img</div>`;
          return `
            <article class="item-card">
              <div class="item-preview">
                ${preview}
                <div class="item-meta">
                  <input class="editor-input" data-action="edit-item" data-tier-id="${tier.id}" data-item-index="${index}" data-field="name" value="${escapeHtml(item.name || "")}" placeholder="Nom de l’item">
                  <small>Hash image: ${escapeHtml(item.image_hash || "-")}</small>
                </div>
              </div>
              <div class="item-card-footer">
                <input class="editor-input" data-action="edit-item" data-tier-id="${tier.id}" data-item-index="${index}" data-field="image_hash" value="${escapeHtml(item.image_hash || "")}" placeholder="SHA256 de l’image">
                <div class="item-toolbar">
                  <select class="editor-select" data-action="move-item" data-tier-id="${tier.id}" data-item-index="${index}">
                    ${tiers.map((candidate) => `<option value="${candidate.id}" ${candidate.id === tier.id ? "selected" : ""}>${escapeHtml(candidate.name)}</option>`).join("")}
                  </select>
                  <button class="ghost-button" type="button" data-action="remove-item" data-tier-id="${tier.id}" data-item-index="${index}">Retirer</button>
                </div>
              </div>
            </article>
          `;
        })
        .join("");

      return `
        <section class="tier-card" data-tier-id="${tier.id}">
          <div class="tier-card-header">
            <div class="card-row">
              <span class="tier-swatch" style="background:${escapeHtml(tier.color)}"></span>
              <h3>${escapeHtml(tier.name)}</h3>
            </div>
            <div class="tier-controls">
              <button class="ghost-button" type="button" data-action="move-tier-up" data-tier-id="${tier.id}">Monter</button>
              <button class="ghost-button" type="button" data-action="move-tier-down" data-tier-id="${tier.id}">Descendre</button>
              <button class="ghost-button" type="button" data-action="remove-tier" data-tier-id="${tier.id}" ${tier.id === 0 ? "disabled" : ""}>Supprimer</button>
            </div>
          </div>

          <div class="editor-form-grid">
            <label>
              <span>Nom</span>
              <input class="editor-input" data-action="edit-tier" data-tier-id="${tier.id}" data-field="name" value="${escapeHtml(tier.name)}">
            </label>
            <label>
              <span>Couleur</span>
              <input class="editor-input" type="color" data-action="edit-tier" data-tier-id="${tier.id}" data-field="color" value="${escapeHtml(tier.color)}">
            </label>
          </div>

          <div class="item-grid">
            ${itemCards || '<div class="empty-state">Aucun item dans ce tier.</div>'}
          </div>

          <div class="item-card">
            <strong>Ajouter un item dans ${escapeHtml(tier.name)}</strong>
            <div class="editor-form-grid">
              <input class="editor-input wide" data-new-item-name="${tier.id}" placeholder="Nom de l’item">
              <input class="editor-input wide" data-new-item-hash="${tier.id}" placeholder="Hash image SHA256">
            </div>
            <div class="item-toolbar">
              <button class="button button-primary" type="button" data-action="add-item" data-tier-id="${tier.id}">Ajouter l’item</button>
            </div>
          </div>
        </section>
      `;
    })
    .join("");

  editorBody.innerHTML = `
    <section class="card item-card">
      <div class="editor-form-grid">
        <label class="wide">
          <span>Nom de la tier list</span>
          <input class="editor-input" data-action="edit-root" data-field="name" value="${escapeHtml(state.draft.name)}">
        </label>
        <label class="wide">
          <span>Description</span>
          <textarea class="editor-textarea" data-action="edit-root" data-field="description">${escapeHtml(state.draft.description || "")}</textarea>
        </label>
        <label>
          <span>Visibilité</span>
          <select class="editor-select" data-action="edit-root" data-field="is_private">
            <option value="false" ${state.draft.is_private ? "" : "selected"}>Publique</option>
            <option value="true" ${state.draft.is_private ? "selected" : ""}>Privée</option>
          </select>
        </label>
        <label>
          <span>Ajouter un tier</span>
          <input class="editor-input" data-new-tier-name placeholder="Nom du nouveau tier">
        </label>
        <label class="wide">
          <span>Couleur du nouveau tier</span>
          <input class="editor-input" type="color" value="#53d2c1" data-new-tier-color>
        </label>
      </div>
      <div class="inline-actions">
        <button class="button button-primary" type="button" data-action="add-tier">Ajouter un tier</button>
        <label class="ghost-button" style="cursor:pointer;">
          Uploader une image
          <input type="file" accept="image/*" hidden data-upload-image>
        </label>
        <input class="editor-input" placeholder="Ou coller un hash d’image pour l’utiliser" data-copy-image-hash>
        <button class="ghost-button" type="button" data-action="copy-image-hash">Appliquer le hash</button>
      </div>
    </section>
    ${rows}
  `;
}

function applyTierMove(tierId, direction) {
  const data = state.draft.data;
  const currentOrder = data.order.slice();
  const index = currentOrder.indexOf(tierId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (index <= 0 && direction === "up") {
    return;
  }

  if (index < 0 || targetIndex < 0 || targetIndex >= currentOrder.length) {
    return;
  }

  [currentOrder[index], currentOrder[targetIndex]] = [currentOrder[targetIndex], currentOrder[index]];
  data.order = currentOrder;
  renderEditor();
}

function editTierField(tierId, field, value) {
  const tier = state.draft.data.tiers.find((candidate) => Number(candidate.id) === Number(tierId));
  if (!tier) {
    return;
  }

  tier[field] = value;
}

function editRootField(field, value) {
  if (field === "is_private") {
    state.draft[field] = value === "true";
    return;
  }

  state.draft[field] = value;
}

function addTier() {
  const nameField = document.querySelector("[data-new-tier-name]");
  const colorField = document.querySelector("[data-new-tier-color]");
  const name = String(nameField?.value || "").trim() || "Nouveau tier";
  const color = String(colorField?.value || "#53d2c1");
  const id = nextTierId(state.draft.data.tiers);

  state.draft.data.tiers.push({ id, name, color, items: [] });
  state.draft.data.order.splice(state.draft.data.order.length - 1, 0, id);
  renderEditor();
}

function addItem(tierId) {
  const nameField = document.querySelector(`[data-new-item-name="${tierId}"]`);
  const hashField = document.querySelector(`[data-new-item-hash="${tierId}"]`);
  const tier = state.draft.data.tiers.find((candidate) => Number(candidate.id) === Number(tierId));
  if (!tier) {
    return;
  }

  tier.items.push({ name: String(nameField?.value || "").trim(), image_hash: String(hashField?.value || "").trim() });
  renderEditor();
}

function removeTier(tierId) {
  if (Number(tierId) === 0) {
    return;
  }

  const data = state.draft.data;
  const blank = data.tiers.find((tier) => Number(tier.id) === 0);
  const tierIndex = data.tiers.findIndex((tier) => Number(tier.id) === Number(tierId));
  if (tierIndex < 0 || !blank) {
    return;
  }

  const [removed] = data.tiers.splice(tierIndex, 1);
  blank.items.push(...(removed?.items || []));
  data.order = data.order.filter((value) => Number(value) !== Number(tierId));
  renderEditor();
}

function removeItem(tierId, itemIndex) {
  const tier = state.draft.data.tiers.find((candidate) => Number(candidate.id) === Number(tierId));
  if (!tier) {
    return;
  }

  tier.items.splice(Number(itemIndex), 1);
  renderEditor();
}

function moveItem(tierId, itemIndex, destinationTierId) {
  const source = state.draft.data.tiers.find((candidate) => Number(candidate.id) === Number(tierId));
  const destination = state.draft.data.tiers.find((candidate) => Number(candidate.id) === Number(destinationTierId));
  if (!source || !destination || source === destination) {
    return;
  }

  const [item] = source.items.splice(Number(itemIndex), 1);
  if (item) {
    destination.items.push(item);
  }

  renderEditor();
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  return apiJson("/upload", {
    method: "POST",
    body: formData,
  });
}

async function handleUpload(input) {
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  try {
    const result = await uploadImage(file);
    const hashField = document.querySelector("[data-copy-image-hash]");
    if (hashField) {
      hashField.value = result.hash;
    }
    setMessage(`Image prête: ${result.hash}`, "success");
  } catch (error) {
    setMessage(error.message || "Upload impossible.", "error");
  }
}

function applyImageHash() {
  const hash = document.querySelector("[data-copy-image-hash]")?.value.trim();
  if (!hash) {
    return;
  }

  const blank = state.draft.data.tiers.find((tier) => Number(tier.id) === 0);
  if (!blank) {
    return;
  }

  blank.items.push({ name: hash, image_hash: hash });
  renderEditor();
}

async function saveTierlist() {
  if (!requireTierlistSelection()) {
    return;
  }

  try {
    const payload = {
      name: state.draft.name,
      description: state.draft.description || null,
      is_private: Boolean(state.draft.is_private),
      data: normalizeTierlistData(state.draft.data),
    };

    const result = await apiJson(`/tierlist/${state.activeTierlist.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    state.activeTierlist = result;
    state.draft = {
      ...result,
      data: normalizeTierlistData(result.data),
    };
    await loadTierlists();
    renderEditor();
    setMessage("Tier list sauvegardée.", "success");
  } catch (error) {
    setMessage(error.message || "Sauvegarde impossible.", "error");
  }
}

async function duplicateTierlist() {
  if (!requireTierlistSelection()) {
    return;
  }

  try {
    const result = await apiJson(`/tierlist/duplicate/${state.activeTierlist.id}?maintain_order=1`, {
      method: "POST",
    });

    setMessage("Tier list dupliquée.", "success");
    await loadTierlists();
    openTierlist(result.id);
  } catch (error) {
    setMessage(error.message || "Duplication impossible.", "error");
  }
}

async function deleteTierlist() {
  if (!requireTierlistSelection()) {
    return;
  }

  if (!window.confirm("Supprimer cette tier list ?")) {
    return;
  }

  try {
    await apiJson(`/tierlist/${state.activeTierlist.id}`, {
      method: "DELETE",
    });

    state.activeTierlist = null;
    state.draft = null;
    await loadTierlists();
    renderEditor();
    setMessage("Tier list supprimée.", "success");
  } catch (error) {
    setMessage(error.message || "Suppression impossible.", "error");
  }
}

function openTierlist(tierlistId) {
  const tierlist = state.tierlists.find((row) => Number(row.id) === Number(tierlistId));
  if (!tierlist) {
    return;
  }

  state.activeTierlist = tierlist;
  state.draft = {
    ...tierlist,
    data: normalizeTierlistData(tierlist.data),
  };

  renderEditor();
  const url = new URL(window.location.href);
  url.searchParams.set("id", String(tierlist.id));
  window.history.replaceState({}, "", url);
}

async function createTierlist() {
  if (!state.user) {
    return;
  }

  try {
    const result = await apiJson("/tierlist", {
      method: "POST",
      body: JSON.stringify({
        user_id: state.user.id,
        name: "Nouvelle tier list",
        description: "",
        is_private: true,
        data: createDefaultTierlistData(),
      }),
    });

    await loadTierlists();
    openTierlist(result.id);
    setMessage("Tier list créée.", "success");
  } catch (error) {
    setMessage(error.message || "Création impossible.", "error");
  }
}

async function loadTierlists() {
  const rows = await apiJson("/tierlist");
  state.tierlists = Array.isArray(rows) ? rows : [];
  renderDashboardHeader();
  renderTierlistCards();
}

async function boot() {
  if (!authRequired()) {
    return;
  }

  ensureLoggedOutLinks();

  try {
    state.user = await fetchCurrentUser();
    renderDashboardHeader();
    await loadTierlists();

    const requestedId = Number(new URLSearchParams(window.location.search).get("id"));
    if (requestedId) {
      openTierlist(requestedId);
    }
  } catch (error) {
    if ((error?.status || 0) === 401) {
      clearSession();
      window.location.href = "/login.html";
      return;
    }

    setMessage(error.message || "Impossible de charger le dashboard.", "error");
  }
}

grid.addEventListener("click", async (event) => {
  const target = event.target.closest("button[data-open-tierlist],button[data-duplicate-row],button[data-remove-row]");
  if (!target) {
    return;
  }

  const tierlistId = Number(target.dataset.openTierlist || target.dataset.duplicateRow || target.dataset.removeRow);
  if (target.dataset.openTierlist) {
    openTierlist(tierlistId);
    return;
  }

  if (target.dataset.duplicateRow) {
    state.activeTierlist = state.tierlists.find((row) => Number(row.id) === tierlistId) || null;
    state.draft = state.activeTierlist
      ? { ...state.activeTierlist, data: normalizeTierlistData(state.activeTierlist.data) }
      : null;
    await duplicateTierlist();
    return;
  }

  if (target.dataset.removeRow) {
    state.activeTierlist = state.tierlists.find((row) => Number(row.id) === tierlistId) || null;
    state.draft = state.activeTierlist
      ? { ...state.activeTierlist, data: normalizeTierlistData(state.activeTierlist.data) }
      : null;
    await deleteTierlist();
  }
});

editorBody.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  if (!action || !state.draft) {
    return;
  }

  if (action === "edit-root") {
    editRootField(target.dataset.field, target.value);
    return;
  }

  if (action === "edit-tier") {
    editTierField(target.dataset.tierId, target.dataset.field, target.value);
    return;
  }

  if (action === "edit-item") {
    const tier = state.draft.data.tiers.find((candidate) => Number(candidate.id) === Number(target.dataset.tierId));
    if (!tier) {
      return;
    }

    const item = tier.items[Number(target.dataset.itemIndex)];
    if (!item) {
      return;
    }

    item[target.dataset.field] = target.value;
  }
});

editorBody.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !state.draft) {
    return;
  }

  if (target.matches("[data-action='move-item']")) {
    moveItem(target.dataset.tierId, target.dataset.itemIndex, target.value);
    return;
  }

  if (target.matches("[data-action='edit-root']")) {
    editRootField(target.dataset.field, target.value);
    renderEditor();
    return;
  }

  if (target.matches("[data-action='edit-tier']")) {
    editTierField(target.dataset.tierId, target.dataset.field, target.value);
    renderEditor();
    return;
  }

  if (target.matches("[data-upload-image]")) {
    handleUpload(target);
  }
});

editorBody.addEventListener("click", (event) => {
  const target = event.target.closest("button[data-action]");
  if (!target || !state.draft) {
    return;
  }

  const { action, tierId, itemIndex } = target.dataset;
  if (action === "move-tier-up") {
    applyTierMove(Number(tierId), "up");
    return;
  }

  if (action === "move-tier-down") {
    applyTierMove(Number(tierId), "down");
    return;
  }

  if (action === "remove-tier") {
    removeTier(Number(tierId));
    return;
  }

  if (action === "add-tier") {
    addTier();
    return;
  }

  if (action === "add-item") {
    addItem(Number(tierId));
    return;
  }

  if (action === "remove-item") {
    removeItem(Number(tierId), Number(itemIndex));
    return;
  }

  if (action === "copy-image-hash") {
    applyImageHash();
  }
});

refreshButton.addEventListener("click", async () => {
  await loadTierlists();
  if (state.activeTierlist) {
    openTierlist(state.activeTierlist.id);
  }
});

createButton.addEventListener("click", createTierlist);
duplicateButton.addEventListener("click", duplicateTierlist);
deleteButton.addEventListener("click", deleteTierlist);
saveButton.addEventListener("click", saveTierlist);
searchInput.addEventListener("input", (event) => {
  state.search = event.target.value || "";
  renderTierlistCards();
});

boot();