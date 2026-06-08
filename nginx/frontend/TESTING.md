# CHECKLIST & TESTING

## ✅ Vérifications pré-déploiement

### Infrastructure
- [ ] Docker compose fonctionne : `docker compose up`
- [ ] API accessible sur `/api`
- [ ] Frontend accessible sur `/`
- [ ] Base de données PostgreSQL connectée
- [ ] Port 80 forwarding vers nginx

### Pages principales
- [ ] `index.html` se charge correctement
- [ ] `login.html` se charge correctement
- [ ] `profile.html` se charge correctement
- [ ] `settings.html` se charge correctement
- [ ] `tierlist.html` se charge correctement

### Authentification
- [ ] Inscription fonctionne
- [ ] Connexion fonctionne
- [ ] Token JWT stocké dans localStorage
- [ ] Déconnexion efface le token
- [ ] Pages protégées redirigent vers login
- [ ] Redirection automatique si déjà connecté (login → profile)

### Profil & Paramètres
- [ ] Affichage des infos utilisateur
- [ ] Modification du pseudo
- [ ] Modification du nom d'utilisateur
- [ ] Modification du mot de passe
- [ ] Suppression de compte (avec confirmation)
- [ ] Toast notifications fonctionnent

### Tier Lists
- [ ] Création d'une nouvelle tier list
- [ ] Modification d'une tier list existante
- [ ] Suppression d'une tier list
- [ ] Duplication d'une tier list
- [ ] Visibilité (public/privé) fonctionne
- [ ] Titre et description éditables
- [ ] Réinitialisation (tout dans _blank)

### Images & Drag & Drop
- [ ] Upload d'images fonctionne
- [ ] Validation du format image
- [ ] Validation de la taille (max 5MB)
- [ ] Drag & drop entre les tiers
- [ ] Drag & drop vers zone unclassified
- [ ] Suppression d'images
- [ ] Affichage en 50x50 WebP

### Visualisation
- [ ] Tier lists publiques visibles dans index
- [ ] Consultation d'une tier list publique
- [ ] Copie d'une tier list publique
- [ ] Accès refusé aux tier lists privées (non propriétaire)
- [ ] Affichage du créateur et date

### Responsive & Design
- [ ] Desktop (1920px)
- [ ] Tablet (768px)
- [ ] Mobile (375px)
- [ ] Navbar réactive
- [ ] Buttons et forms responsive
- [ ] Images bien dimensionnées

### Erreurs & Edge Cases
- [ ] Suppression de compte non autorisée (mauvais pwd)
- [ ] Upload d'un fichier trop volumineux
- [ ] Upload d'un fichier non-image
- [ ] Accès à une tier list inexistante (404)
- [ ] Token expiré → redirection login
- [ ] Rafraîchir la page maintient l'authentification
- [ ] Double-clic sur submit ne crée pas 2 entrées

## 🧪 Scénarios de test

### Scénario 1 : Utilisateur non-authentifié
1. Charger index.html
2. Voir le message "Connectez-vous"
3. Cliquer sur "Se connecter"
4. Aller sur login.html ✓

### Scénario 2 : Création de compte et connexion
1. login.html → Tab Inscription
2. Remplir pseudo, username, password
3. Submit → "Inscription réussie !"
4. Tab Connexion s'active auto
5. Login → Redirection profile.html ✓

### Scénario 3 : Créer une tier list
1. profile.html → Bouton "+ Créer"
2. tierlist.html (pas d'id) s'ouvre
3. Entrer titre et description
4. Upload 3 images
5. Drag image 1 vers tier S
6. Drag image 2 vers tier A
7. Image 3 reste dans _blank
8. Cliquer "Enregistrer"
9. Redirection tierlist.html?id=X ✓
10. Vérifier les images à leur place

### Scénario 4 : Partager une tier list
1. Éditer la tier list créée
2. Visibilité → "Publique"
3. "Enregistrer"
4. Aller sur index.html
5. Voir la tier list dans la liste publique ✓
6. Se déconnecter
7. Cliquer sur la tier list
8. Voir le bouton "Copier (se connecter)"
9. Cliquer → redirection login.html ✓

### Scénario 5 : Copier une tier list
1. Consulter une tier list publique (non propriétaire)
2. Bouton "Copier cette tier list"
3. Redirection automatique vers la copie
4. Vérifier que title a " (copy)"
5. Vérifier que is_private = true
6. Vérifier que les images sont présentes ✓

### Scénario 6 : Gestion du compte
1. settings.html → Modifier pseudo
2. Entrer nouveau pseudo + password
3. "Mettre à jour" → Toast "Succès"
4. Vérifier navbar affiche nouveau pseudo ✓
5. Modifier mot de passe
6. Vérifier login avec ancien pwd échoue
7. Vérifier login avec nouveau pwd réussit

### Scénario 7 : Réinitialiser une tier list
1. Éditer une tier list avec images classées
2. Bouton "Réinitialiser"
3. Modal de confirmation
4. Confirmer
5. Vérifier toutes les images dans _blank
6. Vérifier autres tiers vides ✓

## 🔍 Vérifications de l'API

```bash
# Test en ligne de commande (curl)

# 1. Register
curl -X POST http://localhost:80/api/register \
  -H "Content-Type: application/json" \
  -d '{"pseudo":"TestUser","username":"testuser","password":"test123"}'

# 2. Login
curl -X POST http://localhost:80/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123","jwt_expir":1440}'

# 3. Get user (remplacer TOKEN par le token reçu)
curl -X GET http://localhost:80/api/user/me \
  -H "Authorization: Bearer TOKEN"

# 4. Create tierlist
curl -X POST http://localhost:80/api/tierlist \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "user_id":1,
    "name":"Test Tier",
    "description":"Test",
    "data":{"tiers":[],"order":[]},
    "is_private":false
  }'

# 5. Upload image
curl -X POST http://localhost:80/api/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@/path/to/image.jpg"

# 6. Get image
curl -X GET http://localhost:80/api/image/HASH -o image.webp

# 7. Delete tierlist
curl -X DELETE http://localhost:80/api/tierlist/1 \
  -H "Authorization: Bearer TOKEN"
```

## 📊 Performance

- [ ] Chargement des tier lists < 1s
- [ ] Upload d'image < 2s
- [ ] Drag & drop fluide (60 fps)
- [ ] Pas de fuites mémoire (DevTools)

## 🐛 Bugs connus & ToDo

### Haute priorité
- [ ] Gérer les erreurs réseau (timeout, offline)
- [ ] Ajouter validation client côté API (min/max length)
- [ ] Gérer l'expiration du token automatiquement

### Moyenne priorité
- [ ] Loading state pendant le drag & drop
- [ ] Confirmation avant de quitter si modifications non sauvegardées
- [ ] Copier l'URL d'une tier list (shortlink)
- [ ] Bulk upload d'images

### Basse priorité
- [ ] Dark mode
- [ ] Historique des modifications
- [ ] Export en PNG
- [ ] Collaboration en temps réel
- [ ] Animations d'entrée plus fluides

## ✨ Améliorations faites

✅ Design moderne et propre
✅ Mode sombre préparé (variables CSS)
✅ Drag & drop des images
✅ Responsive mobile-first
✅ Gestion complète de l'authentification
✅ Toast notifications élégantes
✅ Modales de confirmation
✅ Validation des inputs
✅ Gestion des erreurs API
✅ LocalStorage pour la persistence
✅ Colorisation automatique du contraste

## 📝 Notes

- Frontend 100% Vanilla JS (pas de dépendances)
- CSS moderne avec variables et flexbox
- API fully RESTful et documentée
- Code structuré et maintenable
- Comments en français pour l'équipe
