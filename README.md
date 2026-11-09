# Planning — Home Assistant

Une carte de calendrier pour choisir **quand** et **quoi faire** : démarrer des
Frech, ouvrir une barrière, allumer une chauffe puis l’éteindre.

**Version 0.6.1** : fenêtres centrées à l’écran, déplacement souris/tactile et
sélection des appareils corrigés. Actions ponctuelles ou créneaux avec début/fin,
déplacement et suppression d’une seule occurrence. Le planning commence sans programmation.

## Un créneau, ses actions

- **Action ponctuelle** : un jour et une heure, puis une ou plusieurs actions.
  Exemple : Frech 1 et Frech 3 → démarrer à 06:00, sans arrêt programmé.
- **Début et fin** : cocher « Prévoir une heure et des actions de fin ».
  Exemple : chauffe → allumer à 06:00 et éteindre à 18:00, ou barrière → ouvrir
  puis fermer. Les actions de fin peuvent être différentes de celles du début.
- **Chaque semaine** : cocher les jours souhaités. Ajouter d’autres programmations
  pour des horaires différents. Aucune limite à un seul horaire habituel.
- Les menus de minutes avancent par **10 minutes**. Une ancienne minute différente
  reste sélectionnable lors d’une modification. Chaque programmation a sa couleur.

Choisir directement l’appareil, la scène, le bouton ou le script dans le formulaire.
Pour un interrupteur de barrière, choisir Allumer/Éteindre ; pour une entité `cover`,
Ouvrir/Fermer/Arrêter. Un script est appelé sans paramètre ; pour les Frech déjà
configurés, le profil conserve le script et ses paramètres de contrôle d’entrée.

Un seul calendrier local suffit. Il n’y a plus de groupes, de formulaire d’exclusion
ou de passage obligatoire par un onglet Appareils.

## Déplacer ou supprimer un jour dans une série

Glisser une programmation vers une date en vue **Mois** conserve son heure et sa
durée. En vue **Semaine**, la position verticale choisit l’heure par pas de 10 minutes.
Le déplacement modifie **uniquement cette occurrence**, même dans une série.
Cliquer puis modifier la date/l’heure permet la même opération au clavier ou sur mobile.
Le formulaire s’ouvre au centre de l’écran, avec son propre défilement. Sur un écran
tactile, glisser la poignée **⠿** de l’événement ; toucher son libellé ouvre la modification.

Cliquer sur une programmation puis **Supprimer ce jour** retire une seule occurrence.
**Toute la série → Supprimer toute la série** est une action distincte avec confirmation.
Pour changer tous les horaires d’une série, créer le nouvel horaire puis supprimer
l’ancienne série.

Les anciens événements et ceux créés directement dans le calendrier peuvent changer
de date, d’heure, de nom ou de note sans changer leurs actions existantes. Leur durée
est conservée. Le formulaire **Actions et appareils → Configurer les actions** permet
de leur associer explicitement les nouvelles actions Planning. Un événement sans
identifiant modifiable reste en lecture seule.

Le calendrier doit fournir `uid` et `recurrence_id` pour modifier une occurrence.
En leur absence, la carte refuse l’opération plutôt que de toucher à toute la série.
Elle utilise les opérations natives de Calendrier local, sans événement de remplacement
ni calendrier d’exclusions. Les créneaux en cours possédant une action de fin ne
peuvent pas être déplacés ou supprimés, afin de conserver leur extinction/fermeture.

## Ajouter la carte

Pour la version publiée : HACS → Dépôts personnalisés →
`https://github.com/Euro-Locks-Belgium/ha-planning-card`, catégorie Dashboard.
Mettre à jour **Planning** vers **v0.6.1**, puis recharger complètement le navigateur
ou l’application Home Assistant.
La ressource est `/hacsfiles/ha-planning-card/ha-planning-card.js`, type Module JavaScript.
Le type historique `custom:ha-planning-chauffe-card` reste disponible.

```yaml
type: custom:ha-planning-card
title: Planning
calendar: calendar.mon_planning
```

Dans l’éditeur visuel, sélectionner le calendrier puis enregistrer. L’option **Essai
local** permet de manipuler la carte sans écrire dans HA. Ce mode est vide au départ,
n’exécute aucune commande et se réinitialise au rechargement.

```yaml
type: custom:ha-planning-card
demo: true
```

## Préparer l’exécution une seule fois

L’exécution reste dans Home Assistant et fonctionne lorsque la carte est fermée.
Un administrateur clique **Réglages → Préparer l’exécution en mode test** ou
enregistre la première programmation. La carte prépare le blueprint
`blueprints/planning-actions.yaml`, une automatisation pour ce calendrier et sa
liste d’actions autorisées. Aucun jeton à saisir : la session HA est utilisée.

Cette correction d’interface conserve le blueprint d’exécution de la v0.6.0.
Une installation déjà préparée n’a pas besoin de réimporter le blueprint.
La carte importe ce blueprint lors de la préparation d’une nouvelle installation. Il est
aussi disponible pour un import manuel :
[Planning — actions au début et à la fin](https://github.com/Euro-Locks-Belgium/ha-planning-card/blob/v0.6.0/blueprints/planning-actions.yaml).
HACS met à jour la carte ; il ne modifie pas vos automatisations existantes.

Le **mode test est actif par défaut** : les horaires produisent des notifications
sans commander les appareils. Après vérification, un administrateur peut désactiver
ce mode dans les entrées de l’automatisation créée. Actualiser ensuite la carte.

Un administrateur autorise une nouvelle entité lors de sa première sélection dans
un créneau. Les utilisateurs classiques choisissent ensuite parmi ces entités et
modifient les horaires/actions avec les droits du calendrier. Les paramètres techniques
restent dans l’automatisation administrateur ; les événements ne contiennent que des
identifiants et des opérations prédéfinies.

### Choisir et configurer les appareils

- **Modifier la carte → Appareils proposés dans les programmations** : rechercher et
  cocher les entités à proposer sur cette carte. Sans sélection, tous les appareils
  compatibles sont proposés à un administrateur. Cette sélection ne donne pas de
  droits supplémentaires aux utilisateurs classiques.
- **Réglages → Appareils du planning → Ajouter un appareil** : enregistrer un appareil
  partagé, son nom et son entité. Le type **Frech** permet de choisir son relais,
  son entrée de contrôle, son script existant et son numéro. **Modifier** permet
  ensuite de changer ce profil sans changer son identifiant dans les programmations.
- Si une sélection d’appareils est active dans l’éditeur de carte, y cocher aussi
  le nouvel appareil pour le proposer sur cette carte.
- **Modifier la carte → Exécution existante / migration** : choisir une ancienne
  automatisation Planning pour retrouver son catalogue et ses profils Frech.

Les fenêtres s’ouvrent à l’écran et se ferment avec **Fermer**, **Annuler** ou Échap.
Une modification de profil qui affecterait une action de fin en cours est refusée.

La carte publie la liste des noms dans un événement technique daté du 1er janvier 2000,
dans le même calendrier. Ce n’est pas une programmation d’appareil. Une configuration
ne se modifie pas pendant qu’une séquence est en cours. Les changements concurrents
et les réponses de sauvegarde perdues sont vérifiés avant de poursuivre.

## Migration et Frech existants

Les anciens blueprints et événements sont conservés ; aucune donnée HA n’est
supprimée automatiquement. Garder l’option `execution_automation` de la carte
existante pour que la préparation retrouve son catalogue Frech/appareils.

Les profils de `planning-devices.yaml` et `planning-frech.yaml` sont repris avec
leurs identifiants, relais, retours, numéros et scripts. Les anciennes programmations
peuvent être déplacées ou modifiées pour leur horaire en conservant leur format
et leurs associations. Pour changer leurs actions, ouvrir **Configurer les actions**
et choisir les appareils : seule l’occurrence sélectionnée passe au nouveau format.
Les autres occurrences restent gérées par l’ancienne automatisation.
Une ancienne carte utilisant plusieurs calendriers doit être
reconfigurée avec un calendrier unique ; ses autres calendriers restent intacts.

Le nouvel exécuteur ignore les événements de l’ancien format et les anciens
exécuteurs ignorent le nouveau. Ne pas désactiver une ancienne automatisation
tant qu’elle gère encore des événements. Les anciennes exclusions restent liées
aux anciens exécuteurs jusqu’à leur retrait manuel ; elles ne s’appliquent pas
aux nouveaux créneaux.

## Affichage et taille

L’éditeur de carte regroupe le nom, le calendrier et **Personnalisation** :
mois/semaine/agenda, premier jour, format 12/24 h, densité, week-ends, noms des appareils,
style des événements et couleur principale. Les couleurs individuelles se règlent
dans chaque programmation. Ces options sont inspirées de
[Daylight Calendar Card](https://github.com/superdingo101/daylight-calendar-card) ;
voir [les références](THIRD_PARTY_NOTICES.md).

Dans une vue **Sections**, Modifier la carte → **Disposition** règle la largeur et
la hauteur. Élargir la section si nécessaire, ou utiliser une vue **Panneau** pour
une carte sur toute la page. Sur mobile, la grille Semaine défile horizontalement.

## Comportement d’exécution

- HA 2026.10 minimum et Calendrier local avec création/modification/suppression.
- Chaque début et chaque fin déclenche une exécution indépendante. Une séquence
  Frech longue ne met pas une fermeture de barrière en attente dans la même file.
- Les démarrages Frech d’un même créneau sont séquentiels : script existant,
  `wait_time: 10`, pause de 60 s entre actions après un démarrage Frech.
  Un script déjà occupé bloque sa nouvelle invocation ; regrouper les Frech à lancer
  ensemble dans le même créneau ou espacer les programmations.
- Chaque commande relit l’occurrence exacte. Une occurrence supprimée, déplacée ou
  modifiée n’exécute pas son ancien déclenchement mis en cache.
- Créer/modifier au moins 20 minutes avant le début, pour laisser HA charger le calendrier.
  Les heures locales ambiguës ou inexistantes au changement d’heure sont refusées.
- Une fin est une action à son heure prévue, pas une temporisation dans le navigateur.
  Une panne de HA ou d’un appareil à cette heure peut empêcher la commande ; le blueprint
  n’effectue pas de rattrapage automatique au redémarrage. Les commandes indisponibles
  sont refusées et les traces de l’automatisation permettent le diagnostic.

## Développement et vérification

```sh
node scripts/build.mjs
node --check dist/ha-planning-card.js
node scripts/preview.mjs
node --test test/*.test.mjs
python -m pip install -r test/requirements.txt
python -m unittest discover -s test -p '*blueprint_test.py'
python -m unittest discover -s test -p 'native_calendar_test.py'
node test/browser.mjs
node test/interaction-browser.mjs
```

Le parcours navigateur utilise Playwright/Chromium ; `PLANNING_NODE_MODULES` permet
de choisir son installation et `PLANNING_BROWSER` un exécutable Chromium/Edge.
Les tests de récurrence utilisent **ical 14.3.0**, comme Calendrier local HA 2026.10,
et appliquent les messages réellement produits par le modèle JavaScript.
Les autres tests simulent les services HA : ils ne pilotent aucun appareil.
`node scripts/preview.mjs` crée `local/planning-simple-preview.html`, un aperçu
autonome à ouvrir dans un navigateur, avec appareils fictifs et aucun appel réseau.
