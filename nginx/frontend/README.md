# Frontend - Tier List App

## Structure des fichiers

```
nginx/frontend/
├── index.html              # Page d'accueil (liste des tier lists publiques)
├── login.html              # Page de connexion/inscription
├── profile.html            # Profil utilisateur (mes tier lists)
├── settings.html           # Paramètres du compte
├── tierlist.html           # Édition/consultation d'une tier list
└── assets/
    ├── css/
    │   └── style.css       # Styles globaux + responsive design
    └── js/
        ├── config.js       # Configuration et stockage local (localStorage)
        ├── api.js          # Client API et gestion des erreurs
        ├── ui.js           # Composants réutilisables (Toast, Modal, Navbar, etc.)
        └── pages/
            ├── index.js    # Logique page d'accueil
            ├── login.js    # Logique login/register
            ├── profile.js  # Logique profil utilisateur
            ├── settings.js # Logique paramètres compte
            └── tierlist.js # Logique édition tier list (complexe)
```

## Pages principales

### 1. **index.html** - Accueil
- Affiche les tier lists **publiques** uniquement
- Non authentifiés : affiche "Connectez-vous"
- Authentifiés : liste les tier lists publiques avec bouton "Voir"

### 2. **login.html** - Connexion/Inscription
- Deux onglets : Connexion | Inscription
- Stocke le token JWT dans localStorage
- Redirige vers profile.html après connexion
- Redirige vers profile.html si déjà connecté

### 3. **profile.html** - Mon Profil
- Protégée : redirige vers login si pas authentifié
- Affiche **MES tier lists** (créées par l'utilisateur)
- Boutons : Éditer | Dupliquer | Supprimer
- Bouton "+ Créer une Tier List" pour créer une nouvelle

### 4. **settings.html** - Paramètres
- Protégée : redirige vers login si pas authentifié
- Modifier pseudo, nom d'utilisateur, mot de passe
- **Zone de danger** : supprimer le compte (irréversible)
- Toutes les actions nécessitent le mot de passe de confirmation

### 5. **tierlist.html** - Éditeur/Visualiseur
- **Sans ID** (`tierlist.html`) : créer une nouvelle tier list
- **Avec ID** (`tierlist.html?id=123`) : éditer ou consulter
- **Mode Éditeur** (propriétaire seulement) :
  - Éditer titre, description, visibilité (public/privé)
  - Drag & drop des images entre les tiers
  - Upload d'images (rejet > 5 MB)
  - Bouton "Réinitialiser" : tout dans _blank
  - Bouton "Supprimer" : supprime la tier list
  - Bouton "Enregistrer" : sauvegarde les modifications
- **Mode Visualiseur** (tier list publique ou visiteur) :
  - Affichage en lecture seule
  - Bouton "Copier" : duplique la tier list (redirige vers édition de la copie)
  - Buttons "Se connecter" si pas d'id d'utilisateur

## Flux d'authentification

1. **Registration** : `POST /register` → crée compte
2. **Login** : `POST /login` → reçoit JWT token
3. **Token Storage** : localStorage avec clés :
   - `tierlist_token` : JWT
   - `tierlist_user` : User object (JSON)
   - `tierlist_expiration` : Date d'expiration

## API Client (`api.js`)

```javascript
// Authentification
await api.register(pseudo, username, password);
await api.login(username, password, jwtExpir);
await api.getMe();
await api.updateUser(password, newUsername, newPseudo, newPassword);
await api.deleteUser(password);

// Tier Lists
await api.getTierlists();
await api.getTierlist(id);
await api.createTierlist(userId, name, description, data, isPrivate);
await api.updateTierlist(id, name, description, data, isPrivate);
await api.deleteTierlist(id);
await api.duplicateTierlist(id, maintainOrder);

// Images
await api.uploadImage(file);
await api.deleteImage(hash);
api.getImageUrl(hash); // Returns URL
```

## Utilitaires UI (`ui.js`)

```javascript
// Notifications
Toast.success("Message");
Toast.error("Erreur");
Toast.warning("Attention");
Toast.info("Info");

// Modal de confirmation
Modal.confirm("Titre", "Message", () => { /* callback */ });

// Navbar
Navbar.render(isAuthenticated, user);

// Loader
Loading.show("Message");
Loading.hide();

// Validation
Validation.isValidUsername(str);
Validation.isValidPassword(str);
Validation.isValidPseudo(str);
```

## Spécificités tierlist.js

### Classe `TierlistApp`
Gère l'intégralité de la logique d'édition des tier lists.

**Propriétés principales** :
- `tierlistId` : ID de la tier list (null = création)
- `tierlist` : Objet tier list
- `isOwner` : Booléen (propriétaire ?)
- `unclassifiedImages` : Dictionnaire des images en _blank
- `draggedElement` : Élément en cours de drag
- `draggedFrom` : Source du drag (tier ou unclassified)

**Modes** :
- **Viewer** : Tier list publique en lecture seule
- **Editor** : Mode édition complète (propriétaire seulement)

**Fonctionnalités** :
- Drag & drop des images entre tiers
- Upload d'images avec validation
- Édition du titre, description, visibilité
- Réinitialisation (tout vers _blank)
- Suppression avec confirmation
- Copie pour utilisateurs non propriétaires
- Coloration des tiers avec contrast color auto

## Comportements clés

### Redirection automatique
- `login.html` : Si déjà connecté → profile.html
- `profile.html`, `settings.html` : Si pas connecté → login.html
- `tierlist.html?id=X` : Si tier list privée et non propriétaire → index.html

### Sauvegarde des données
- **Tier lists** : Sauvegardées dans la BD avec JSONB
- **Images** : Uploadées sur le serveur (WebP 256x256, crop carré centré)
- **Authentification** : Token JWT valide 24h par défaut

### Édition en temps réel
- Titre et description éditables directement
- Sélecteur de couleur pour les tiers (sauf _blank)
- Édition du nom des tiers (sauf _blank)
- Les modifications ne sont sauvegardées qu'en cliquant "Enregistrer"

## Design & Responsive

- **CSS** : Variables CSS pour les couleurs et espacements
- **Layout** : Flexbox/Grid
- **Mobile** : Responsive jusqu'à 320px
- **Animations** : Transitions fluides pour les interactions
- **Accessibilité** : Contraste de couleur calculé automatiquement

## Gestion des erreurs

- Toutes les erreurs API affichent un toast
- Les 401 (Unauthorized) redirectionnent vers login
- Les 404 redirectionnent vers index
- Validations frontend avant l'envoi

## Améliorations futures possibles

1. ✅ Drag & drop des images entre tiers
2. ⬜ Édition en ligne du nom des items
3. ⬜ Support du clavier (arrows pour déplacer)
4. ⬜ Undo/Redo
5. ⬜ Historique des modifications
6. ⬜ Partage par lien (tokens temporaires)
7. ⬜ Collaboration en temps réel (WebSocket)
8. ⬜ Templates de tier lists
9. ⬜ Dark mode
10. ⬜ Export (PNG, PDF)

## Notes de développement

- Pas de framework (Vanilla JS)
- localStorage pour la gestion simple de l'auth
- Fetch API pour les requêtes HTTP
- CSS moderne (variables, flexbox, grid)
- Aucune dépendance externe

## Test des endpoints

### Pour tester rapidement :
```bash
# Dans la console du navigateur

// Login
await api.login('testuser', 'password123');

// Créer une tier list
await api.createTierlist(1, 'Ma Tier', 'Description', {
  tiers: [
    { id: 1, name: 'S', color: '#FFD700', items: [] },
    { id: 0, name: '_blank', color: '#FFFFFF', items: [] }
  ],
  order: [1, 0]
}, false);

// Upload image
const file = new File(['...'], 'test.jpg', { type: 'image/jpeg' });
await api.uploadImage(file);
```
