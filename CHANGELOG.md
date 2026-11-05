# Changelog

## 0.2.1 — 2026-11-05

- Dépôt GitHub renommé en `ha-planning-card`.
- Fichier HACS et package renommés en `ha-planning-card.js` et `ha-planning-card`.
- Liens de documentation et d'import du blueprint mis à jour.
- Ancien type de carte conservé comme alias ; procédure de migration HACS documentée.

## 0.2.0 — 2026-11-05

- Nouveau nom : Planning, avec un type de carte générique et compatibilité du type historique.
- Suppression de toutes les données et des groupes préremplis ; formulaires vierges.
- Gestion des groupes depuis l’éditeur visuel.
- Redimensionnement horizontal et vertical dans HA Sections.
- Mise en page selon la largeur du composant et calendrier qui utilise la hauteur attribuée.
- Tests des états vides et du redimensionnement.

## 0.1.0 — 2026-11-05

- Première carte installable depuis un dépôt personnalisé HACS.
- Mode démonstration sans accès aux calendriers ni aux appareils.
- Calendriers partagés : fermetures, reprises ponctuelles et séries hebdomadaires.
- Éditeur de carte avec choix des calendriers.
- Fuseau du site, refus des heures ambiguës et relecture avant modification.
- Blueprint de démarrage par groupe, en mode test par défaut.
- Blocage pendant les fermetures, remplacement dans le cycle dimanche-samedi,
  refus des lectures indisponibles et absence de rattrapage tardif.
- Tests unitaires, scénarios de blueprint et essais navigateur avec API simulée.
