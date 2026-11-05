# Planning — Home Assistant

Une carte de planning pour des programmations ponctuelles, des horaires récurrents
et des périodes d'exclusion. Elle n'est pas limitée à la chauffe.

**Le planning démarre entièrement vide** : aucun groupe, aucun horaire, aucune
exclusion et aucun événement de démonstration. Les formulaires n'imposent aucune
date ou heure préremplie. Le mode local ne crée rien dans Home Assistant.

![Planning vide](docs/preview.png)

## Installer ou mettre à jour avec HACS

1. Dans **HACS → ⋮ → Dépôts personnalisés**, ajouter
   `https://github.com/Euro-Locks-Belgium/ha-planning-card`, type **Dashboard**.
2. Télécharger ou mettre à jour **Planning** vers **v0.2.1**.
3. Recharger complètement le navigateur ou l'application Home Assistant.
4. Ajouter la carte **Planning**, ou une carte manuelle :

```yaml
type: custom:ha-planning-card
title: Planning
demo: true
groups: []
```

`demo: true` active un espace local vide pour essayer la carte. Les modifications
locales sont réinitialisées au rechargement. Aucun exemple n'est ajouté.

Le dépôt et le fichier utilisent désormais le nom **ha-planning-card**. L'ancien
type `custom:ha-planning-chauffe-card` reste compatible pour les cartes existantes.
Si votre carte a un titre personnalisé, vous pouvez le modifier dans son éditeur.

### Migration depuis la version 0.2.0 ou précédente

- Utiliser la nouvelle adresse du dépôt dans HACS, puis télécharger **v0.2.1**.
- GitHub redirige l'ancienne adresse et conserve l'historique du dépôt.
- Vérifier la ressource JavaScript ci-dessous : si HA référence toujours l'ancien
  dossier ou l'ancien fichier, remplacer cette entrée par le nouveau chemin.
- Recharger complètement le navigateur. Les calendriers, événements et groupes
  configurés ne sont pas supprimés par le renommage.

Si la carte n'apparaît pas, vérifier cette ressource, de type **Module JavaScript**,
dans **Paramètres → Tableaux de bord → ⋮ → Ressources** :

```text
/hacsfiles/ha-planning-card/ha-planning-card.js
```

## Configurer vos groupes

Dans l'éditeur de carte, cliquer sur **Ajouter un groupe**. La ligne ajoutée est
vide : saisir son nom. On peut ajouter ou retirer jusqu'à 8 groupes depuis cet
éditeur, sans écrire de YAML. Aucun groupe n'est créé automatiquement.

Pour utiliser des calendriers partagés :

1. Créer des **calendriers locaux dédiés** depuis **Paramètres → Appareils et
   services → Ajouter une intégration → Calendrier local** : un calendrier par
   groupe, plus un calendrier commun pour les exclusions.
2. Dans l'éditeur de carte, désactiver **Mode local**.
3. Choisir le calendrier des exclusions et celui de chaque groupe.

La carte reste vide et n'effectue aucune requête calendrier tant que cette
configuration n'est pas complète. Retirer un groupe de la carte ne supprime pas
son calendrier ou ses événements. Une mise à jour de la carte n'efface aucun
calendrier existant.

Les événements sont enregistrés dans Home Assistant et partagés entre les
utilisateurs. Aucun jeton n'est à saisir dans la carte. Un utilisateur standard
doit disposer du droit de contrôle sur les calendriers sélectionnés.

## Agrandir ou redimensionner la carte

### Dans une vue Sections

1. Mettre le tableau de bord en mode édition.
2. Modifier la carte **Planning**.
3. Ouvrir **Disposition / Layout**.
4. Ajuster les **colonnes et les lignes**, ou activer **Carte pleine largeur**.
5. Enregistrer.

La carte accepte le redimensionnement horizontal et vertical : 14 lignes par
défaut, 8 lignes minimum. Le calendrier grandit avec la hauteur attribuée. Sa mise
en page utilise la largeur réelle de la carte, même sur un grand écran contenant
plusieurs petites cartes. Les panneaux se placent sous le calendrier si la carte
est étroite.

La pleine largeur d'une carte est celle de sa **section**. Pour disposer de plus
de place sur ordinateur, élargir aussi la section. Exemple de vue Sections :

```yaml
views:
  - title: Planning
    type: sections
    max_columns: 2
    sections:
      - type: grid
        column_span: 2
        cards:
          - type: custom:ha-planning-card
            demo: true
            groups: []
            grid_options:
              columns: full
              rows: 14
```

### Pour une page entière

Une vue **Panneau / Panel** accueille une seule carte sur toute sa largeur :

```yaml
views:
  - title: Planning
    type: panel
    cards:
      - type: custom:ha-planning-card
        demo: true
        groups: []
```

Les vues Maçonnerie / Masonry n'offrent pas les mêmes réglages de taille. Passer à
Sections ou Panneau pour un grand planning. L'onglet Disposition n'est pas proposé
si la carte est imbriquée dans une pile ou une carte grille.

[Documentation officielle du redimensionnement](https://www.home-assistant.io/dashboards/cards/#resizing-a-card).

## Programmations et exclusions

- **Programmation ponctuelle** : choisir un groupe, une date et une heure.
- **Horaire habituel** : une série hebdomadaire par groupe, avec choix du jour et
  de l'heure. Modifier ou supprimer cette série affecte toute la série.
- **Remplacement facultatif** : cocher la case pour remplacer l'horaire habituel
  du groupe pour le même cycle (dimanche 00:00 au dimanche suivant 00:00).
- **Exclusion prioritaire** : pendant une période d'exclusion, les activations
  sont bloquées. Le début est inclus et la fin est exclue. La fin d'une exclusion
  ne déclenche aucune action.
- Les heures sont celles du fuseau configuré dans Home Assistant, même si le
  navigateur utilise un autre fuseau. Les heures ambiguës ou inexistantes lors
  d'un changement d'heure sont refusées.
- En mode connecté, programmer au moins **20 minutes à l'avance** : les
  déclencheurs calendrier peuvent nécessiter environ 15 minutes d'actualisation.

## Exécuter des actions côté Home Assistant

La carte enregistre des événements. **Le blueprint s'importe séparément** ; HACS
ne crée pas automatiquement de calendrier ni d'automatisation.

Le blueprint fourni permet l'activation d'un groupe d'appareils `switch` (prises,
relais, éclairage, etc.). Il utilise exclusivement `switch.turn_on`. Pour d'autres
types d'actions, une automatisation adaptée est nécessaire ; la carte seule
n'exécute aucune commande.

1. Ouvrir **Paramètres → Automatisations et scènes → Blueprints → Importer**.
2. Importer :

   `https://github.com/Euro-Locks-Belgium/ha-planning-card/blob/v0.2.1/blueprints/planning-chauffe.yaml`

3. Créer une automatisation par groupe. Renseigner son nom et ses calendriers.
4. Conserver **Mode test = activé**. La sélection d'appareils peut rester vide.
5. Programmer un événement à plus de 20 minutes, hors exclusion.
6. Vérifier la notification **TEST** et la trace de l'automatisation à l'heure prévue.

Le blueprint fonctionne sur le serveur même si le tableau de bord est fermé. Il
relit le calendrier avant toute commande : un événement annulé ou modifié ne doit
pas être exécuté depuis un ancien déclencheur. Une lecture indisponible bloque
l'action. Il ne rattrape pas les déclenchements retardés de 90 secondes ou plus.
La fin d'un événement n'éteint aucun appareil.

Pour passer en mode réel, sélectionner les appareils du groupe et désactiver le
mode test dans l'automatisation. Si un appareil est indisponible, le groupe est
bloqué. Après la commande, un retour `on` est attendu pendant 20 secondes maximum,
puis une notification indique le résultat. Ce retour confirme l'état des
appareils, pas le résultat physique d'un procédé.

Les autres programmations Home Assistant ou les horaires propres aux appareils
restent indépendants. Les désactiver ou les remplacer lors d'une bascule vers ce
planning, pour éviter qu'ils contournent les exclusions.

## Compatibilité et limites

- Home Assistant **2026.10.0 minimum** ; capacités de l'installation cible
  vérifiées en lecture seule sur 2026.10.4.
- Calendriers locaux permettant création, modification et suppression.
- De 0 à 8 groupes ; configuration initiale vide.
- Un horaire hebdomadaire par groupe ; pas de modification d'une seule occurrence
  depuis la carte. Utiliser une programmation ponctuelle avec remplacement.
- Relecture avant modification pour détecter un changement concurrent ; il ne
  s'agit pas d'un verrou transactionnel entre clients.
- Les événements sans les métadonnées de la carte sont affichés « non piloté » et
  ignorés par le blueprint. Tout événement du calendrier des exclusions bloque
  cependant les activations, même s'il a été créé ailleurs.
- Aucun test sur des appareils réels ni modification de l'installation Home
  Assistant n'est effectué lors de la publication GitHub.

## Développement

Aucune dépendance JavaScript à l'exécution. Le fichier livré est autonome.

```sh
node scripts/build.mjs
node --test test/*.test.mjs
node --check dist/ha-planning-card.js
python -m pip install -r test/requirements.txt
python test/blueprint_test.py
```

Essais navigateur facultatifs : installer Playwright 1.62.1 et Chromium, puis
exécuter `node test/browser.mjs`. `PLANNING_BROWSER` peut désigner un Chromium
système et `PLANNING_NODE_MODULES` un dossier de modules fourni. Les captures sont
écrites dans `test-results/` et ignorées par Git.

Les essais couvrent le démarrage vide, les champs vierges, l'éditeur de groupes,
les opérations calendrier, les exclusions, le fuseau du site, les échecs réseau,
les modifications concurrentes et le redimensionnement. Ils utilisent une API
Home Assistant simulée. Les tests de blueprint vérifient ses templates et ses
branches avec des services simulés, pas l'ensemble du moteur Home Assistant.
