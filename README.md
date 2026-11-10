# Planning — Home Assistant

Une carte de calendrier pour choisir **quand** et **quoi faire** : démarrer des
Frech, ouvrir une barrière, allumer une chauffe puis l’éteindre.

**Version 0.10.0** : événements compacts, configuration en onglets et menus stables.
Les jours déplacés et supprimés
sont conservés directement par la carte, avec un [journal partagé dans le calendrier](docs/planning-series.md).
Aucun complément à installer. Un import ICS unique permet de reprendre les exceptions
des anciennes séries ; les nouvelles sont suivies automatiquement.

L’heure et le nom des événements partagent une ligne. La configuration garde les
champs et menus en place pendant les mises à jour Home Assistant.

Fenêtres centrées à l’écran, déplacement souris/tactile, actions ponctuelles ou créneaux avec début/fin,
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

## Modifier, déplacer ou supprimer une programmation

Cliquer sur une programmation récurrente puis
choisir **Modifier → Ce jour uniquement** ou **Toute la série**. Le premier choix
est sélectionné par défaut. Le second permet de changer les horaires, actions,
couleurs et, pour une programmation hebdomadaire Planning, les jours habituels.

**Toute la série** remplace la série à partir de la **Date de début de la série**
affichée dans le formulaire. Vérifier cette date avant **Enregistrer la série**.
Les jours déjà déplacés conservent leurs dates,
heures et actions particulières ; les jours supprimés restent absents. Les autres
occurrences suivent les nouveaux réglages. La carte mémorise les exceptions dans
le même calendrier. Les nouvelles séries sont suivies automatiquement. Pour une
ancienne série, le formulaire propose un **import ICS unique** afin de récupérer
aussi les suppressions que l’API ne montre plus. Sans cet historique complet,
la carte refuse de remplacer la série. Une sauvegarde interrompue est reprise
au rechargement. [Fonctionnement et reprise de l’existant](docs/planning-series.md).

Les limites existantes de répétition
(`COUNT` ou `UNTIL`) restent dans la règle ; les occurrences sont recalculées depuis
la date de départ choisie.

Glisser une programmation vers une date en vue **Mois** conserve son heure et sa
durée. En vue **Semaine**, la position verticale choisit l’heure par pas de 10 minutes.
Le déplacement modifie **uniquement cette occurrence**, même dans une série.
Cliquer puis modifier la date/l’heure permet la même opération au clavier ou sur mobile.
Le formulaire s’ouvre au centre de l’écran, avec son propre défilement. Sur un écran
tactile, glisser la poignée **⠿** de l’événement ; toucher son libellé ouvre la modification.

Cliquer sur une programmation puis **Supprimer ce jour** retire une seule occurrence.
**Toute la série → Supprimer toute la série** est une action distincte avec confirmation.

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
Mettre à jour **Planning** vers **v0.10.0**, puis recharger complètement le navigateur
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

- **Modifier la carte → Appareils** : rechercher et
  cocher les entités autorisées sur cette carte. **Sans sélection, aucun nouvel
  appareil n’est proposé.** Cette sélection ne donne pas de
  droits supplémentaires aux utilisateurs classiques.
- **Réglages → Appareils du planning → Ajouter un appareil** : enregistrer un appareil
  partagé, son nom et son entité. Le type **Frech** permet de choisir son relais,
  son entrée de contrôle, son script existant et son numéro. **Modifier** permet
  ensuite de changer ce profil sans changer son identifiant dans les programmations.
- Pour un profil Frech, cocher son relais, son script et son entrée de contrôle.
  Les entrées `binary_sensor` servent uniquement au contrôle ; elles ne deviennent
  jamais des actions de programmation. Les sélecteurs d’ajout proposent uniquement
  les entités cochées. Un ancien profil reste conservé lorsqu’il sort de la sélection.
- **Modifier la carte → Avancé → Exécution existante / migration** : choisir une ancienne
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

L’en-tête occupe deux lignes : titre/actions/statut, puis mois et année avec la
navigation et les vues. Sur les petites cartes, Réglages et Aujourd’hui deviennent
des icônes ; les commandes passent sur une ligne supplémentaire si nécessaire.
Le survol assombrit les événements en conservant leur couleur.

**Depuis la v0.9.1** : les journées précédant aujourd’hui
ont un fond plus sombre dans les vues Mois, Semaine et Agenda. Les couleurs des
programmations passées sont atténuées en gardant un texte contrasté. La date
utilisée est celle du fuseau Home Assistant ; un créneau encore en cours garde
sa couleur habituelle, même s’il a commencé la veille.

Le calendrier utilise la densité **Compacte** par défaut, réduit la
hauteur des cases et l’échelle horaire de la vue Semaine. Les lignes du mois
s’agrandissent quand elles contiennent plusieurs événements. Le style **Rempli**
affiche la couleur en fond avant le survol ; **Contour** et **Point** conservent
leur présentation respective.

**Langue** dans l’éditeur choisit Français, English, Nederlands ou Italiano.
**Automatique (Home Assistant)** utilise la langue de l’utilisateur. Les jours,
mois et libellés suivent ce choix. Les noms d’appareils, titres saisis, notes,
identifiants et commandes enregistrées ne sont pas traduits. Le choix de langue
de chaque carte ne change pas les programmations partagées ni les notifications
du blueprint d’exécution.

L’éditeur de carte regroupe le nom, le calendrier et **Personnalisation** :
mois/semaine/agenda, premier jour, format 12/24 h, densité, week-ends, noms des appareils,
style des événements et couleur principale. Les couleurs individuelles se règlent
dans chaque programmation. Ces options sont inspirées de
[Daylight Calendar Card](https://github.com/superdingo101/daylight-calendar-card) ;
voir [les références](THIRD_PARTY_NOTICES.md).

Depuis la **v0.10.0**, les sections repliables sont
remplacées par les onglets **Général**, **Appareils**, **Affichage** et **Avancé**.
La langue, le nom et le calendrier sont dans Général ; les autorisations d’entités
dans Appareils ; la personnalisation dans Affichage ; la migration dans Avancé.
Les mises à jour HA conservent les menus ouverts, l’onglet, la saisie et la recherche.
Les listes réellement modifiées sont actualisées après la fin d’une sélection.
Dans le calendrier, l’heure et le nom partagent une ligne ; le titre complet et
les heures de début/fin restent dans l’infobulle et le formulaire de modification.

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
node test/locales-browser.mjs
```

Le parcours navigateur utilise Playwright/Chromium ; `PLANNING_NODE_MODULES` permet
de choisir son installation et `PLANNING_BROWSER` un exécutable Chromium/Edge.
Les tests de récurrence utilisent **ical 14.3.0**, comme Calendrier local HA 2026.10,
et appliquent les messages réellement produits par le modèle JavaScript.
Les autres tests simulent les services HA : ils ne pilotent aucun appareil.
`node scripts/preview.mjs` crée `local/planning-simple-preview.html`, un aperçu
autonome à ouvrir dans un navigateur, avec appareils fictifs et aucun appel réseau.
Dans cet aperçu, ouvrir **Paramètres de la carte → Général → Langue**, choisir la langue puis
**Enregistrer**. Le même éditeur est utilisé que dans Home Assistant ; les
programmations de la session locale sont conservées. Le choix Annuler ne modifie rien.
