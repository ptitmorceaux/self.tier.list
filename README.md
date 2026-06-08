# Contexte projet : Tier List auto-hébergeable

Le projet est un outil web permettant de créer, modifier, dupliquer et partager des tier lists. L’objectif est de gérer plusieurs utilisateurs avec des comptes sécurisés, un stockage optimisé des images et la persistance des données dans une base PostgreSQL. Le système est conçu pour être auto-hébergeable sur un serveur léger, avec une architecture basée sur Docker.

---

## Utilisateurs

* Chaque utilisateur dispose d’un compte unique identifié avec son `username`.
* Les mots de passe sont stockés sous forme de hash sécurisé.
* Les utilisateurs ont un champ `is_admin` boolean (default false) pour permettre des droits administratifs futurs.
* Les endpoints sensibles (tier lists, images) utilisent JWT pour vérifier l’identité et les droits de l’utilisateur.
* L’utilisateur connecté peut mettre à jour ou supprimer son compte.

### Table `user`

| Colonne    | Type                  | Description                |
| ---------- | --------------------- | -------------------------- |
| id         | INT PRIMARY KEY       | Identifiant unique         |
| pseudo     | VARCHAR UNIQUE        | Pseudo de l'utilisateur    |
| username   | VARCHAR UNIQUE        | Nom d’utilisateur          |
| password   | CHAR                  | Hash du mot de passe       |
| is_admin   | BOOLEAN DEFAULT FALSE | Droit d’administrateur     |
| created_at | TIMESTAMP             | Date de création du compte |

---

## Tier lists

* Une tier list contient plusieurs tiers et plusieurs items par tier.
* Chaque tier a un **ID entier unique**, avec `0` pour le tier `_blank` (items non classés).
* Les items contiennent un `name` et `image_hash` pour référencer les images stockées.
* Le JSONB stocké dans PostgreSQL contient :

  * `tiers`: tableau d’objets tiers
  * `order`: tableau d’IDs pour définir l’ordre des tiers
* Les tiers non classés sont automatiquement placés dans `_blank`.
* Chaque tier list a un champ `user_id` pour le propriétaire et `is_private` boolean pour la visibilité.

### Exemple JSON d’une tier list

```json
{
  "tiers": [
    {
      "id": 1,
      "name": "S",
      "color": "#FFD700",
      "items": [
        {"name": "Pikachu", "image_hash": "a1b2c3d4"},
        {"name": "Charizard", "image_hash": "e5f6g7h8"}
      ]
    },
    {
      "id": 2,
      "name": "A",
      "color": "#C0C0C0",
      "items": [
        {"name": "Bulbasaur", "image_hash": "i9j0k1l2"}
      ]
    },
    {
      "id": 0,
      "name": "_blank",
      "color": "#FFFFFF",
      "items": []
    }
  ],
  "order": [1, 2, 0]
}
```

### Table `tierlist`

| Colonne     | Type                  | Description                    |
| ----------- | --------------------- | ------------------------------ |
| id          | INT PRIMARY KEY       | Identifiant unique             |
| user_id     | INT                   | Référence à `user.id`          |
| name        | VARCHAR               | Nom de la tier list            |
| description | TEXT                  | Description                    |
| data        | JSONB                 | Contient tiers, items et ordre |
| is_private  | BOOLEAN DEFAULT FALSE | Visibilité : true = privé      |
| created_at  | TIMESTAMP             | Date de création               |
| updated_at  | TIMESTAMP             | Date de dernière modification  |

---

## Images

* Les images sont stockées sur le serveur avec un nom basé sur leur **hash SHA256**, ce qui évite les doublons.
* Endpoint upload: l'API reçoit une image, rejette les fichiers au-dessus de **5 MB**, la recadre en carré centré, la normalise en **WebP 256x256**, puis calcule son hash SHA256 à partir des pixels normalisés.
* Ce hash devient l'identifiant unique de l'image (ID logique).
* Une table `image` contient `hash`, `path`, `created_at`.
* Une table `image_tierlist` gère la relation n↔n entre images et tier lists. Cela permet de savoir si une image est utilisée avant suppression.

### Exemple tables `image` et `image_tierlist`

```json
[
  {"hash": "a1b2c3d4", "path": "/uploads/a1b2c3d4.webp", "created_at": "2026-03-30T10:00:00Z"},
  {"hash": "e5f6g7h8", "path": "/uploads/e5f6g7h8.webp", "created_at": "2026-03-30T10:01:00Z"},
  {"hash": "i9j0k1l2", "path": "/uploads/i9j0k1l2.webp", "created_at": "2026-03-30T10:02:00Z"}
]
```

```json
[
  {"image_hash": "a1b2c3d4", "tierlist_id": 12},
  {"image_hash": "e5f6g7h8", "tierlist_id": 12},
  {"image_hash": "i9j0k1l2", "tierlist_id": 12}
]
```

---

## Backend / API

* Développé en Python avec FastAPI.
* Authentification via JWT.
* Contrôle d’accès basé sur le `user_id` de la tier list ou `is_admin = true`.
* Endpoints principaux :

### Auth / Utilisateurs

| Endpoint    | Méthode | Description                   |
| ----------- | ------- | ----------------------------- |
| `/register` | POST    | Crée un compte                |
| `/login`    | POST    | Authentifie un utilisateur    |
| `/user/me`  | GET     | Récupère le compte connecté   |
| `/user/me`  | PUT     | Met à jour le compte connecté |
| `/user/me`  | DELETE  | Supprime le compte connecté   |

### Tier lists

| Endpoint                   | Méthode | Description                                                                                                              |                                                                           |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `/tierlist`                | POST    | Crée une tier list (JWT requis)                                                                                          |                                                                           |
| `/tierlist`                | GET     | Récupère toutes les tier lists de l’utilisateur connecté et les tier lists publiques (vérifie `is_private` et `user_id`) |                                                                           |
| `/tierlist/{id}`           | GET     | Récupère une tier list spécifique (vérifie `is_private` et `user_id`)                                                    |                                                                           |
| `/tierlist/{id}`           | PUT     | Met à jour une tier list (JWT requis, propriétaire ou admin)                                                             |                                                                           |
| `/tierlist/{id}`           | DELETE  | Supprime une tier list (JWT requis, propriétaire ou admin)                                                               |                                                                           |
| `/tierlist/duplicate/{id}` | POST    | Duplique une tier list (JWT requis). Option `?maintain_order=0                                                           | 1`: 0 → toutes les images dans`_blank`, 1 → conserve l’ordre et les tiers |

### Images

| Endpoint        | Méthode | Description                                   |
| --------------- | ------- | --------------------------------------------- |
| `/upload`       | POST    | Upload d’une image (JWT requis)               |
| `/image/{hash}` | GET     | Récupère une image                            |
| `/image/{hash}` | DELETE  | Supprime une image si inutilisée (JWT requis) |

Comportement recommandé pour `POST /upload`:

* Si l'image normalisée (WebP 256x256) n'existe pas encore: créer l'entrée et répondre `201 Created` avec le `hash`.
* Si l'image existe déjà (même hash): ne rien recréer et répondre `200 OK` avec le même `hash`.
* Si le fichier dépasse la limite serveur: répondre `413 Payload Too Large` avec un message explicite.

Exemples de réponses:

```json
{
  "hash": "a1b2c3d4e5f6...",
  "created": true
}
```

```json
{
  "hash": "a1b2c3d4e5f6...",
  "created": false
}
```

---

## Items

* Les items ne disposent pas de CRUD séparé.
* Toutes les modifications des items se font via PUT sur la tier list, en mettant à jour le JSONB (`data`).

---

## Architecture technique

* Docker Compose : PostgreSQL, Backend FastAPI, Frontend React (ou équivalent), volume `/uploads` pour images.
* JSONB pour stocker les tier lists et éviter des fichiers `.json` externes.
* Images hashées pour éviter duplication.
* Limites de taille et nombre d’images pour éviter de saturer le serveur.

---

## Objectif global

Permettre un usage **multi-utilisateur sécurisé et évolutif** d’un outil de tier lists avec :

* persistance complète dans la base de données
* stockage optimisé et vérification rapide des images
* duplication, partage et suppression sécurisée
* architecture auto-hébergeable, légère et maintenable
