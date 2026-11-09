# Changelog

## 0.9.0 — 2026-11-09

- Modification de série conservant les jours déjà déplacés et supprimés, sans limite au mois affiché.
- Conservation entièrement dans la carte, avec un journal partagé dans le même calendrier et uniquement les API natives Home Assistant.
- Les exceptions conservent leurs dates, horaires et actions ; les autres occurrences suivent les nouveaux réglages.
- Conservation après plusieurs modifications, changement des jours habituels et relecture du fichier ICS.
- Nouvelles séries suivies automatiquement ; import ICS dans le formulaire pour reprendre les exceptions anciennes que l’API ne fournit pas.
- Sauvegarde préparée avant remplacement, événements temporaires inactifs et reprise persistante après interruption.
- Glisser-déposer toujours limité à une occurrence ; aperçu local et traductions adaptés.
- Aucun complément, intégration ou conteneur à installer ; blueprint d’exécution inchangé.

## 0.8.0 — 2026-11-09

- Choix explicite entre « Ce jour uniquement » et « Toute la série » dans le formulaire de modification.
- Modification des horaires, actions, couleurs et jours habituels d’une série hebdomadaire.
- Date de départ et avertissement avant le remplacement natif d’une série : les exceptions déplacées ou supprimées sont réinitialisées.
- Glisser-déposer toujours limité à l’occurrence déplacée, indépendamment du choix dans le formulaire.
- Couleurs des anciennes programmations visibles avant le survol ; survol limité à un assombrissement.
- Calendrier plus compact par défaut : cases moins hautes, hauteur naturelle et échelle horaire réduite en vue Semaine.
- Vérification des deux portées avec le calendrier natif et dans le navigateur.

## 0.7.0 — 2026-11-09

- En-tête compact : statut réduit à un badge ; mois/année, navigation, vues et Aujourd’hui regroupés sur une barre.
- Adaptation à la largeur réelle de la carte ; boutons de réglages et Aujourd’hui réduits à une icône sur les petites cartes.
- Interface en français, anglais, néerlandais et italien ; choix automatique selon Home Assistant ou choix manuel dans l’éditeur.
- Dates, jours, formulaires, messages et libellés accessibles traduits ; noms, notes et données des programmations conservés.
- Survol et focus des événements : assombrissement de leur couleur.
- Ajout d’appareils limité aux entités cochées dans les paramètres de la carte, y compris script et entrée d’un profil Frech.
- Une sélection vide ne propose plus de nouveaux appareils ; les anciens profils et programmations restent conservés.
- Langue dans les paramètres de la carte ; l’aperçu utilise le même éditeur Home Assistant, avec Enregistrer et Annuler.
- Tests de disposition, de traduction et de filtrage.

## 0.6.1 — 2026-11-09

- Formulaires et réglages dans une fenêtre native centrée au-dessus du tableau de bord, avec défilement interne, fermeture Échap et focus conservé.
- Messages de sauvegarde ou de refus visibles à l’écran.
- Déplacement à la souris et au tactile avec poignée, aperçu de destination et défilement automatique.
- Modification et déplacement des anciens événements sans conversion imposée : description, associations et autres occurrences conservées.
- Un déplacement d’horaire ne nécessite plus de préparer l’exécution ou de revalider le catalogue d’appareils.
- Réglages → Appareils du planning : ajout/modification d’entités simples et de profils Frech avec script/entrée/numéro.
- Éditeur de carte : sélection recherchable des appareils proposés et accès à l’automatisation existante pour la migration.
- Tests dans des composants imbriqués avec transformation et découpage, ainsi qu’avec de vrais événements tactiles du navigateur.

## 0.6.0 — 2026-11-09

- Formulaire centré sur le créneau : actions ponctuelles ou actions distinctes de début et de fin.
- Sélection directe d’entités, autorisation initiale administrateur et réutilisation par les utilisateurs classiques.
- Déplacement par glisser-déposer en mois/semaine, limité à une occurrence native avec `recurrence_id`.
- Suppression d’un seul jour ; suppression de série distincte et confirmée.
- Groupes et exclusions retirés de l’interface ; éditeur de carte simplifié et personnalisation conservée.
- Plusieurs séries hebdomadaires et jours par série, couleurs par programmation, minutes par pas de 10.
- Nouveau blueprint `planning-actions.yaml` : début/fin indépendants, test par défaut, catalogue protégé et relecture avant chaque commande.
- Import des profils Frech/appareils existants ; conversion explicite d’une occurrence associée lors de son édition.
- Conservation des actions de fin des créneaux en cours et refus des modifications concurrentes.
- Vérification avec la bibliothèque réelle de Calendrier local, scénarios HA simulés et parcours navigateur.
- 57 tests de logique, 65 scénarios de blueprint, 4 tests du calendrier natif et parcours navigateur réussis.
- Préparation de l’exécution depuis la carte : import du blueprint de la release et mode test par défaut.
- Publication GitHub/HACS sans modification automatique d’une instance Home Assistant.

## 0.5.0 — 2026-11-05

- Onglet Appareils : ajout, modification, désactivation et suppression depuis la carte.
- Relais simple, script sans paramètre et Frech avec contrôle d’entrée/script existant.
- Nouveau blueprint `planning-devices.yaml` et catalogue protégé dans l’automatisation HA.
- Gestion technique administrateur ; liste de noms/identifiants partagée dans le même calendrier.
- Sauvegarde vérifiée, conservation des autres réglages, détection des modifications concurrentes.
- Blocage des programmations contenant un appareil désactivé ou retiré.
- Vues mois, semaine et agenda, navigation et bouton Aujourd’hui.
- Personnalisation inspirée de Daylight : densité, format des heures, premier jour, week-ends, styles et accent.
- Construction JavaScript indépendante des fins de ligne Windows.
- 38 tests de logique, 52 scénarios de blueprint et deux parcours navigateur avec services simulés.
- Blueprints historiques conservés ; le nouveau parcours se configure séparément.

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
