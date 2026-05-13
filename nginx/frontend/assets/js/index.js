import { fetchCurrentUser, formatDateTime, getPreferredApiBase, getStoredUser } from "./app.js";

async function boot() {
  const title = document.querySelector(".hero-copy h1");
  const lead = document.querySelector(".lead");
  const footer = document.createElement("div");

  footer.className = "form-message";
  footer.style.marginTop = "18px";
  footer.textContent = `Base API préférée: ${getPreferredApiBase() || "auto"}`;
  document.querySelector(".shell-home")?.appendChild(footer);

  const user = getStoredUser();
  if (!user || !title || !lead) {
    return;
  }

  try {
    const currentUser = await fetchCurrentUser();
    title.textContent = `Bienvenue ${currentUser.pseudo}, tes tier lists sont prêtes.`;
    lead.textContent = `Dernière connexion enregistrée pour ${currentUser.username} le ${formatDateTime(currentUser.created_at)}.`;
  } catch {
    title.textContent = `Bienvenue sur Self Tier List.`;
  }
}

boot();