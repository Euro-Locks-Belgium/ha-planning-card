# Planning de chauffe — Home Assistant

Une carte de tableau de bord pour programmer les remises en chauffe par groupe de
machines, gérer les fermetures et conserver une semaine habituelle.

**Version 0.1.0 : version de test.** La carte démarre en démonstration. Le blueprint
fourni démarre en mode test (notifications, sans commande de relais). Rien n'est
installé ni activé sur votre Home Assistant par l'ajout du dépôt GitHub.

![Aperçu de la carte en mode démonstration](docs/preview.png)

## 1. Installer la carte avec HACS

1. Ouvrir **HACS → menu ⋮ → Dépôts personnalisés**.
2. Ajouter `https://github.com/Euro-Locks-Belgium/ha-planning-chauffe-card` avec le
   type **Dashboard** (ou **Tableau de bord** selon la traduction).
3. Rechercher **Planning de chauffe**, puis télécharger la version **v0.1.0**.
4. Recharger complètement le navigateur ou l'application Home Assistant.
5. Ajouter une carte au tableau de bord : **Planning de chauffe**, ou une carte
   manuelle avec cette configuration :

```yaml
type: custom:ha-planning-chauffe-card
title: Planning de chauffe
demo: true
```

La démonstration permet de tester les fermetures, les reprises, les modifications
et les suppressions **sans créer d'événement Home Assistant et sans toucher aux
relais**. Ses données sont fictives et sont réinitialisées au rechargement.

Si la carte n'apparaît pas, vérifier dans **Paramètres → Tableaux de bord → ⋮ →
Ressources** la présence de cette ressource, de type **Module JavaScript** :

```text
/hacsfiles/ha-planning-chauffe-card/ha-planning-chauffe-card.js
```

Installation manuelle possible : copier le fichier de `dist/` dans le dossier
`www/` de configuration, puis enregistrer `/local/ha-planning-chauffe-card.js`
comme module JavaScript.

## 2. Utiliser des calendriers partagés

Cette étape enregistre de vrais événements dans Home Assistant. Elle ne configure
pas à elle seule l'exécution des relais.

Un administrateur crée **quatre calendriers locaux dédiés** depuis **Paramètres →
Appareils et services → Ajouter une intégration → Calendrier local** :

- Planning chauffe — Fermetures
- Planning chauffe — Frech
- Planning chauffe — Grand Bain
- Planning chauffe — Frech 20

Dans l'éditeur de la carte, désactiver **Démonstration** puis choisir ces
calendriers dans les listes. Le calendrier des fermetures est commun ; chaque
groupe a son propre calendrier. La carte accepte de 1 à 8 groupes via YAML.

Exemple (adapter les identifiants réellement créés chez vous) :

```yaml
type: custom:ha-planning-chauffe-card
title: Planning moulage
demo: false
closure_calendar: calendar.planning_chauffe_fermetures
groups:
  - name: Frech
    calendar: calendar.planning_chauffe_frech
  - name: Grand Bain
    calendar: calendar.planning_chauffe_grand_bain
  - name: Frech 20
    calendar: calendar.planning_chauffe_frech_20
```

Les calendriers doivent supporter création, modification et suppression
d'événements (Calendrier local le permet). La carte utilise la session Home
Assistant de l'utilisateur : aucun jeton à coller dans la carte. Un compte
standard doit disposer du droit de contrôle sur ces calendriers. La création des
intégrations et des automatisations reste une opération administrateur.

## 3. Tester l'exécution côté Home Assistant

HACS installe la carte JavaScript. **Le blueprint s'importe séparément** ; la
carte seule n'exécute aucun démarrage.

1. Ouvrir **Paramètres → Automatisations et scènes → Blueprints → Importer**.
2. Utiliser cette adresse :

   `https://github.com/Euro-Locks-Belgium/ha-planning-chauffe-card/blob/v0.1.0/blueprints/planning-chauffe.yaml`

3. Créer **une automatisation par groupe** avec ce blueprint.
4. Choisir le calendrier du groupe et le calendrier commun des fermetures.
5. Conserver **Mode test = activé**. Les relais peuvent rester non sélectionnés.
6. Dans la carte connectée, programmer un démarrage **au moins 20 minutes à
   l'avance**, en dehors d'une fermeture.
7. À l'heure prévue, consulter la notification Home Assistant **TEST — nom du
   groupe** et la trace de l'automatisation.

L'automatisation tourne sur le serveur Home Assistant, même si tous les tableaux
de bord sont fermés. Les événements sont conservés dans les calendriers du serveur.

### Passage ultérieur à de vraies commandes

Sélectionner les relais `switch` du groupe dans l'automatisation, puis désactiver
le mode test après avoir validé leur correspondance. La commande est exclusivement
`switch.turn_on` : aucun `toggle`, aucun arrêt à la fin d'un événement.

**Les programmations existantes restent indépendantes.** Pendant les essais,
elles continuent à fonctionner. Lors de la bascule, un administrateur doit
désactiver ou remplacer les anciens déclenchements Home Assistant / Shelly ; les
fermetures de ce nouveau planning ne peuvent pas bloquer un autre programme.

## Règles de fonctionnement

- **Fermeture prioritaire** : tout événement du calendrier des fermetures bloque
  les démarrages entre son début inclus et sa fin exclue. Une fermeture peut
  couvrir plusieurs semaines. Sa fin ne commande aucun appareil.
- **Horaire habituel** : une série hebdomadaire par groupe, créée dans l'onglet
  « Horaires habituels ». Une modification ou suppression concerne toute la série.
- **Reprise ponctuelle** : date et heure propres à un groupe. Cocher « Remplacer
  le démarrage habituel » pour remplacer l'horaire de ce groupe dans le même cycle
  de production, du **dimanche 00:00 au dimanche suivant 00:00**, heure du site.
  Sans cette case, le démarrage est ajouté. Une reprise pendant une fermeture
  est refusée par la carte et bloquée par le blueprint.
- **Pas de rattrapage automatique** : seuls les débuts d'événements déclenchent
  le blueprint. Un déclenchement retardé de 90 secondes ou plus est ignoré. Après
  une panne, prévoir une nouvelle reprise plutôt que démarrer tardivement.
- **Annulation vérifiée côté serveur** : avant une commande, le blueprint relit
  le calendrier du groupe et vérifie que l'événement déclencheur existe toujours.
- **Calendrier illisible ou relais indisponible** : aucun démarrage du groupe.
  Un échec de lecture ne vaut jamais autorisation de chauffe.
- **Retour de commande** : en mode réel, attente de 20 secondes maximum pour le
  retour `on` des relais, puis notification « relais activés » ou « retour
  incomplet ». Ce retour ne mesure pas la température des machines.
- **Fuseau horaire** : celui de Home Assistant, même si le navigateur utilise un
  autre fuseau. Les heures locales inexistantes ou ambiguës lors des changements
  d'heure sont refusées ; choisir une autre heure.
- **Délai de programmation** : 20 minutes minimum pour un nouveau démarrage, car
  les déclencheurs calendrier peuvent mettre environ 15 minutes à être actualisés.
- **Modification concurrente** : relecture avant enregistrement. Si l'événement a
  changé depuis l'ouverture du formulaire, la carte refuse de l'écraser. Cela
  n'est pas un verrou transactionnel entre plusieurs clients.
- **Événements externes** : les événements de chauffe sans les métadonnées de la
  carte sont affichés « non piloté » et ignorés par le blueprint. Ne pas modifier
  les descriptions techniques des événements depuis un autre éditeur.

## Limites de cette première version

- Carte et blueprint distincts : l'installation HACS n'ajoute pas automatiquement
  les calendriers ou les automatisations.
- Une série hebdomadaire par groupe ; pas d'édition d'une seule occurrence de
  série. Utiliser une reprise ponctuelle et son option de remplacement.
- Calendriers locaux recommandés ; les calendriers en lecture seule ne conviennent pas.
- Le contrôle utilisateur standard et les API ont été testés avec une session HA
  simulée. La version et les capacités de l'installation cible ont été vérifiées
  en lecture seule sur **Home Assistant 2026.10.4**. **Aucune commande sur les
  relais réels n'a été effectuée pour cette publication.** Le blueprint n'a pas
  été importé dans cette installation pendant le développement.

## Développement et vérification

Aucune dépendance JavaScript à l'exécution. Le fichier livré est autonome.

```sh
node scripts/build.mjs
node --test test/*.test.mjs
node --check dist/ha-planning-chauffe-card.js
```

Vérification des décisions du blueprint avec services simulés :

```sh
python -m pip install -r test/requirements.txt
python test/blueprint_test.py
```

Essais navigateur facultatifs (Chromium / Playwright) :

```sh
npm install --no-save playwright@1.62.1
npx playwright install chromium
node test/browser.mjs
```

Un navigateur Chromium système peut être choisi via `PLANNING_BROWSER`. Un
dossier de modules déjà fourni peut être choisi via `PLANNING_NODE_MODULES`.
Les captures de vérification sont écrites dans `test-results/`, ignoré par Git.

Les tests couvrent le mode démo isolé, les opérations calendrier d'un compte
standard simulé, le fuseau du site, les fermetures, les remplacements, les refus
d'accès, les reprises après réponse réseau perdue, les modifications concurrentes,
l'affichage des textes non fiables et les petits écrans. Les tests du blueprint
exécutent ses templates et ses branches avec des services simulés ; ils ne
remplacent pas la validation complète par le moteur Home Assistant.

## Documentation de référence

- [Cartes personnalisées Home Assistant](https://contributors.home-assistant.io/frontend/custom-ui/card/)
- [Calendrier local](https://www.home-assistant.io/integrations/local_calendar/)
- [Déclencheurs calendrier](https://www.home-assistant.io/integrations/calendar/)
- [Structure d'un dépôt de carte HACS](https://www.hacs.xyz/docs/publish/plugin/)

Le code publié ne contient aucune configuration de production ni aucun identifiant
secret. Les associations de relais restent dans votre Home Assistant.
