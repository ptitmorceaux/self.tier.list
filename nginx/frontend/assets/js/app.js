const STORAGE_KEYS = {
  token: "selftier.token",
  user: "selftier.user",
  apiBase: "selftier.apiBase",
};

const DEFAULT_BASES = ["/api"];
// const DEFAULT_BASES = ["https://tierlist.ptitgourmand.uk/api"];

export class ApiError extends Error {
  constructor(status, message, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function normalizeBase(base) {
  if (!base) {
    return "";
  }

  return String(base).trim().replace(/\/+$/, "");
}

export function getConfiguredApiBases() {
  const originBase = window.location.origin.startsWith("http") ? `${window.location.origin}/api` : null;
  const candidates = [
    window.__SELF_TIERLIST_API_BASE__,
    localStorage.getItem(STORAGE_KEYS.apiBase),
    originBase,
    ...DEFAULT_BASES,
  ]
    .map(normalizeBase)
    .filter(Boolean);

  return [...new Set(candidates)];
}

export function getPreferredApiBase() {
  const saved = normalizeBase(localStorage.getItem(STORAGE_KEYS.apiBase));
  if (saved) {
    return saved;
  }

  return getConfiguredApiBases()[0] || "";
}

export function setPreferredApiBase(base) {
  const normalized = normalizeBase(base);
  if (normalized) {
    localStorage.setItem(STORAGE_KEYS.apiBase, normalized);
  }
}

export function getToken() {
  return localStorage.getItem(STORAGE_KEYS.token) || "";
}

export function getStoredUser() {
  const value = localStorage.getItem(STORAGE_KEYS.user);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  localStorage.setItem(STORAGE_KEYS.token, token);
  if (user) {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  }
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
}

function joinBase(base, path) {
  const normalizedBase = normalizeBase(base);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function tryParseJson(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function unwrapEnvelope(payload) {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data;
  }

  return payload;
}

function extractMessage(payload, fallback = "Requête API échouée") {
  if (!payload) {
    return fallback;
  }

  if (typeof payload === "string") {
    return payload;
  }

  return payload.detail || payload.message || payload.error || fallback;
}

export async function apiRequest(path, options = {}) {
  const bases = getConfiguredApiBases();
  let lastError = null;

  for (let index = 0; index < bases.length; index += 1) {
    const base = bases[index];

    try {
      const headers = new Headers(options.headers || {});
      if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
      }

      if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      const token = getToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      const response = await fetch(joinBase(base, path), {
        ...options,
        headers,
      });

      if (response.status === 404 && index < bases.length - 1) {
        lastError = response;
        continue;
      }

      if (response.ok) {
        setPreferredApiBase(base);
      }

      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("API unreachable");
}

export async function apiJson(path, options = {}) {
  const response = await apiRequest(path, options);
  const payload = tryParseJson(await response.text());

  if (!response.ok) {
    throw new ApiError(response.status, extractMessage(payload, `HTTP ${response.status}`), payload);
  }

  return unwrapEnvelope(payload);
}

export function getImageUrl(imageHash) {
  return joinBase(getPreferredApiBase(), `/image/${encodeURIComponent(imageHash)}`);
}

export function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function showMessage(target, message, type = "info") {
  if (!target) {
    return;
  }

  target.textContent = message || "";
  target.classList.remove("is-error", "is-success");
  if (type === "error") {
    target.classList.add("is-error");
  } else if (type === "success") {
    target.classList.add("is-success");
  }
}

export function authRequired() {
  const token = getToken();
  if (!token) {
    window.location.href = "/login.html";
    return false;
  }

  return true;
}

export async function fetchCurrentUser() {
  const user = await apiJson("/user/me");
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  return user;
}

export function ensureLoggedOutLinks() {
  const buttons = document.querySelectorAll("[data-logout]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      clearSession();
      window.location.href = "/login.html";
    });
  });
}

export function createDefaultTierlistData() {
  return {
    tiers: [
      { id: 1, name: "S", color: "#f5c16c", items: [] },
      { id: 2, name: "A", color: "#53d2c1", items: [] },
      { id: 3, name: "B", color: "#5b8def", items: [] },
      { id: 4, name: "C", color: "#8f7bff", items: [] },
      { id: 5, name: "D", color: "#ff8c66", items: [] },
      { id: 0, name: "_blank", color: "#ffffff", items: [] },
    ],
    order: [1, 2, 3, 4, 5, 0],
  };
}

export function normalizeTierlistData(input) {
  const data = input && typeof input === "object" ? JSON.parse(JSON.stringify(input)) : createDefaultTierlistData();
  const tiers = Array.isArray(data.tiers) ? data.tiers : [];
  const order = Array.isArray(data.order) ? data.order : [];

  const normalizedTiers = tiers
    .filter((tier) => tier && typeof tier === "object")
    .map((tier) => ({
      id: Number.isFinite(Number(tier.id)) ? Number(tier.id) : 0,
      name: String(tier.name || "").trim() || (Number(tier.id) === 0 ? "_blank" : "Nouveau tier"),
      color: String(tier.color || "#ffffff"),
      items: Array.isArray(tier.items)
        ? tier.items.map((item) => ({
            name: String(item?.name || "").trim(),
            image_hash: String(item?.image_hash || "").trim(),
          }))
        : [],
    }));

  if (!normalizedTiers.some((tier) => tier.id === 0)) {
    normalizedTiers.push({ id: 0, name: "_blank", color: "#ffffff", items: [] });
  }

  const tierIds = normalizedTiers.map((tier) => tier.id);
  const normalizedOrder = order
    .map((value) => Number(value))
    .filter((value) => tierIds.includes(value));

  for (const tierId of tierIds) {
    if (!normalizedOrder.includes(tierId)) {
      normalizedOrder.push(tierId);
    }
  }

  normalizedTiers.sort((left, right) => normalizedOrder.indexOf(left.id) - normalizedOrder.indexOf(right.id));

  return {
    tiers: normalizedTiers,
    order: normalizedOrder,
  };
}

export function nextTierId(tiers) {
  return tiers.reduce((max, tier) => Math.max(max, Number(tier.id) || 0), 0) + 1;
}

export function countItems(tierlist) {
  return (tierlist?.tiers || []).reduce((sum, tier) => sum + (tier.items?.length || 0), 0);
}

export function partitionTierlists(rows, userId) {
  const mine = [];
  const publicLists = [];

  for (const row of rows || []) {
    if (Number(row.user_id) === Number(userId)) {
      mine.push(row);
    } else {
      publicLists.push(row);
    }
  }

  return { mine, publicLists };
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}