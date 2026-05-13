import { apiJson, authRequired, clearSession, ensureLoggedOutLinks, fetchCurrentUser, formatDateTime, showMessage } from "./app.js";

const title = document.querySelector("[data-profile-title]");
const subtitle = document.querySelector("[data-profile-subtitle]");
const pseudo = document.querySelector("[data-user-pseudo]");
const username = document.querySelector("[data-user-username]");
const admin = document.querySelector("[data-user-admin]");
const created = document.querySelector("[data-user-created]");
const messageBox = document.querySelector("[data-profile-message]");
const updateForm = document.querySelector('[data-profile-form="update"]');
const deleteForm = document.querySelector('[data-profile-form="delete"]');

async function loadProfile() {
  if (!authRequired()) {
    return;
  }

  ensureLoggedOutLinks();

  try {
    const user = await fetchCurrentUser();
    title.textContent = user.pseudo;
    subtitle.textContent = `Compte ${user.username}`;
    pseudo.textContent = user.pseudo;
    username.textContent = user.username;
    admin.textContent = user.is_admin ? "Oui" : "Non";
    created.textContent = formatDateTime(user.created_at);
  } catch (error) {
    showMessage(messageBox, error.message || "Impossible de charger le profil.", "error");
  }
}

async function handleUpdate(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries());

  try {
    const user = await apiJson("/user/me", {
      method: "PUT",
      body: JSON.stringify({
        password: payload.password,
        new_pseudo: payload.new_pseudo || undefined,
        new_username: payload.new_username || undefined,
        new_password: payload.new_password || undefined,
      }),
    });

    showMessage(messageBox, "Profil mis à jour.", "success");
    title.textContent = user.pseudo;
    subtitle.textContent = `Compte ${user.username}`;
    pseudo.textContent = user.pseudo;
    username.textContent = user.username;
    admin.textContent = user.is_admin ? "Oui" : "Non";
    created.textContent = formatDateTime(user.created_at);
    event.currentTarget.reset();
  } catch (error) {
    showMessage(messageBox, error.message || "Mise à jour impossible.", "error");
  }
}

async function handleDelete(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries());

  if (!window.confirm("Supprimer définitivement ce compte ?")) {
    return;
  }

  try {
    await apiJson("/user/me", {
      method: "DELETE",
      body: JSON.stringify({ password: payload.password }),
    });

    clearSession();
    window.location.href = "/";
  } catch (error) {
    showMessage(messageBox, error.message || "Suppression impossible.", "error");
  }
}

loadProfile();
updateForm?.addEventListener("submit", handleUpdate);
deleteForm?.addEventListener("submit", handleDelete);