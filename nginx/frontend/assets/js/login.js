import { apiJson, clearSession, getPreferredApiBase, setPreferredApiBase, setSession, showMessage } from "./app.js";

const messageBox = document.querySelector("[data-auth-message]");
const apiHint = document.querySelector("[data-api-hint]");
const tabs = document.querySelectorAll("[data-auth-tab]");
const forms = document.querySelectorAll("[data-auth-form]");

function setActiveTab(name) {
  tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.authTab === name));
  forms.forEach((form) => form.classList.toggle("hidden", form.dataset.authForm !== name));
  showMessage(messageBox, "", "info");
}

function bindConfigHint() {
  const base = getPreferredApiBase();
  if (apiHint) {
    apiHint.textContent = `API cible: ${base || "auto"}`;
  }

  if (!localStorage.getItem("selftier.apiBase")) {
    setPreferredApiBase(base);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const result = await apiJson("/login", {
      method: "POST",
      body: JSON.stringify({
        username: payload.username,
        password: payload.password,
        jwt_expir: Number(payload.jwt_expir || 1440),
      }),
    });

    setSession(result.access_token, result.user);
    showMessage(messageBox, "Connexion réussie. Redirection...", "success");
    window.location.href = "/tierlist.html";
  } catch (error) {
    showMessage(messageBox, error.message || "Connexion impossible.", "error");
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    await apiJson("/register", {
      method: "POST",
      body: JSON.stringify({
        pseudo: payload.pseudo,
        username: payload.username,
        password: payload.password,
      }),
    });

    showMessage(messageBox, "Compte créé. Tu peux maintenant te connecter.", "success");
    setActiveTab("login");
    form.reset();
  } catch (error) {
    showMessage(messageBox, error.message || "Inscription impossible.", "error");
  }
}

clearSession();
bindConfigHint();
setActiveTab("login");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.authTab));
});

forms.forEach((form) => {
  form.addEventListener("submit", form.dataset.authForm === "login" ? handleLogin : handleRegister);
});