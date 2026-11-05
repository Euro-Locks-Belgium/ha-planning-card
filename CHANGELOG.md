# Changelog

## 0.4.0 — 2026-11-05

- Menus heures/minutes avec pas de 10 minutes ; anciennes minutes conservées lors d'une modification.
- Couleur et libellé par programmation et par série.
- Plusieurs horaires hebdomadaires par calendrier/groupe, ajout toujours accessible.
- Catalogue d'appareils vide par défaut ; sélection indépendante par événement.
- Remplacement d'une série précise pour une semaine, sans remplacer les autres horaires.
- Nouveau blueprint Frech : appelle le script existant avec les seuls paramètres du catalogue local.
- Séquence en file, attente de 10 s et pause de 60 s par défaut, mode test sans appel de script.
- Relecture du calendrier entre machines ; arrêt des machines restantes en cas de changement ou d'exclusion.
- Les blueprints à groupe fixe refusent les événements portant une sélection d'appareils.
- Blueprints à importer séparément ; configuration des associations techniques dans leur catalogue.
- Éditeur de noms/identifiants d’appareils ; écran technique centralisé non inclus.
- 22 tests de logique, 42 scénarios de blueprint et essais navigateur avec services simulés.

## 0.3.0 — 2026-11-05

- Un seul calendrier pour les programmations et les exclusions.
- Choix du calendrier suffisant pour commencer ; groupes facultatifs.
- Nouveau blueprint `planning.yaml` avec filtre de groupe facultatif et mode test par défaut.
- Isolation des remplacements et doublons par groupe dans un calendrier partagé.
- Ancien mode multi-calendriers et blueprint historique conservés.
- Tests du parcours à un calendrier sans groupes et du blocage des exclusions typées.

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
