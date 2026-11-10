# Conservation des exceptions — carte 0.10.0

Tout est géré par la carte JavaScript, dans le même Calendrier local. Aucun
complément, nouvelle intégration ou conteneur n’est nécessaire. Le blueprint
`planning-actions.yaml` v0.6.0 reste utilisable sans modification.

Lors d’une modification de **Toute la série** :

- les jours déplacés gardent leur date, leurs horaires et leurs actions propres ;
- les jours supprimés restent absents ;
- les autres occurrences suivent les nouveaux réglages ;
- retirer puis rétablir un jour habituel ne perd pas ses anciennes exceptions.

## Nouvelles séries

La carte suit automatiquement les séries créées avec cette version. Chaque
déplacement, modification individuelle et suppression est enregistré dans un
journal technique, au 3 janvier 2000 dans le même calendrier. Ce journal est
masqué dans la carte. Il est partagé entre utilisateurs et appareils ; aucun
stockage local du navigateur n’est nécessaire. Conserver les événements techniques
lors des sauvegardes/exportations du calendrier.

Les jours déplacés peuvent devenir des événements natifs indépendants. Le journal
maintient leur appartenance à la série : depuis l’un de ces jours, **Ce jour
uniquement**, **Toute la série** et la suppression de série restent disponibles.

## Reprendre une ancienne série

L’API calendrier ne donne pas les `EXDATE` des jours déjà supprimés. La carte refuse
donc de deviner un historique complet à partir du seul mois affiché.

Pour une série créée avant cette version, un administrateur effectue une reprise :

1. Récupérer le fichier **ICS complet de ce Calendrier local** dans le dossier
   `.storage` de la configuration Home Assistant. Utiliser une copie récente et
   conserver l’original comme sauvegarde. Un export limité aux événements visibles
   ne contient pas les suppressions et ne convient pas.
2. Dans la carte, cliquer sur une occurrence habituelle puis choisir **Toute la série**.
3. Utiliser **Importer les exceptions existantes** et sélectionner ce fichier `.ics`.
4. Vérifier la date de début, les jours et les horaires, puis **Enregistrer la série**.

### Télécharger le fichier avec File editor

Home Assistant stocke chaque Calendrier local dans
`/config/.storage/local_calendar.<clé>.ics`, par exemple
`/config/.storage/local_calendar.planning.ics`. Le nom exact dépend de la clé
enregistrée à la création du calendrier.

File editor masque `.storage` dans sa configuration par défaut :

1. Ouvrir la **Configuration** de File editor. Dans la liste `ignore_pattern`,
   retirer uniquement la ligne `.storage`, puis enregistrer et redémarrer File editor.
2. Ouvrir son interface et le dossier `.storage` à la racine des fichiers de
   configuration Home Assistant. Selon le contexte de l’éditeur, cette racine
   peut être affichée sous `/config` ou `/homeassistant`.
3. Repérer le fichier `local_calendar.*.ics` du calendrier utilisé par la carte
   et en **télécharger une copie**, sans modifier l’original.
4. Dans la carte : ouvrir une programmation → **Toute la série** →
   **Importer les exceptions existantes** → choisir la copie → enregistrer.

Le même fichier complet peut servir à reprendre les différentes anciennes séries
de ce calendrier, une série à la fois. Une copie récupérée via un autre accès aux
fichiers Home Assistant convient également ; File editor n’est pas nécessaire au
fonctionnement de la carte.

Sources : [emplacement officiel des fichiers du Calendrier local](https://github.com/home-assistant/core/blob/2026.10.4/homeassistant/components/local_calendar/const.py)
et [configuration par défaut de File editor](https://github.com/home-assistant/addons/blob/master/configurator/config.yaml).

Le fichier est lu dans le navigateur. Seule la série sélectionnée est reprise.
Les `EXDATE`, les occurrences déplacées et leurs descriptions sont conservés,
y compris avant/après le mois affiché. Les modifications déjà suivies par la carte
restent prioritaires sur un ancien export. La reprise est nécessaire une seule
fois par ancienne série ; les utilisateurs classiques peuvent ensuite tout gérer
depuis la carte, avec leurs droits habituels sur le calendrier.

L’import accepte les séries natives avec `DTSTART` et `DTEND`, les heures locales,
UTC et les paramètres `TZID`. Les fichiers incomplets, séries fractionnées,
`RDATE`, journées entières ou règles avec plusieurs heures par jour sont refusés.
Une exception `STATUS:CANCELLED` reste supprimée.

## Sauvegarde et interruption

La carte enregistre d’abord le journal et le plan de sauvegarde. Elle prépare une
nouvelle série inactive, rétablit les exclusions et prépare les jours déplacés,
puis active les événements définitifs. Les événements temporaires ne contiennent
pas de programmation exécutable ; les exécuteurs Planning les ignorent.

La modification utilise **plusieurs appels API**, sans transaction atomique côté
Home Assistant. Garder la carte ouverte jusqu’à la fin. En cas de coupure, le
journal permet de reprendre au prochain chargement de la carte. Pendant une
interruption, certains créneaux peuvent rester temporairement inactifs. Une reprise
tardive ne garantit pas l’exécution d’un horaire déjà passé.

Les créneaux avec une action de fin en cours sont protégés. Les exceptions à
convertir qui commencent très prochainement bloquent également le remplacement.
Les changements concurrents du journal sont contrôlés avant les écritures, mais
l’API ne fournit pas de verrou transactionnel : éviter de modifier simultanément
la même série sur plusieurs écrans. Après la reprise initiale, utiliser la carte
pour les exceptions ; les changements externes directs dans Calendrier local ne
sont pas ajoutés automatiquement au journal.

## Validation locale

Le moteur JavaScript est testé via les API natives simulées et la bibliothèque
réelle `ical 14.3.0` : import ICS, changement d’heure et de jours, relecture du
fichier ICS, suppression lointaine, déplacement d’une exception déjà conservée,
suppression complète et reprise après interruption. Les parcours du navigateur
utilisent le véritable composant. La publication GitHub ne modifie pas l’instance
Home Assistant et ne commande aucun appareil. Aucun essai en production n’est inclus.
