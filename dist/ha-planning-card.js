/* Planning 0.9.1 | Euro-Locks Belgium */
(() => {
'use strict';
const VERSION = "0.9.1";
// French message IDs keep existing calendar data and model errors unchanged.
const PLANNING_LANGUAGES={fr:'Français',en:'English',nl:'Nederlands',it:'Italiano'};
function planningLanguage(setting='auto',hass={}){
  if(!['auto',...Object.keys(PLANNING_LANGUAGES)].includes(setting))throw new Error('Langue non prise en charge.');
  const value=setting==='auto'?(hass.language || hass.locale?.language || 'fr'):setting;
  const base=String(value).toLowerCase().split(/[-_]/)[0];return Object.hasOwn(PLANNING_LANGUAGES,base)?base:'en';
}
const PLANNING_LOCALES={fr:'fr-BE',en:'en-GB',nl:'nl-BE',it:'it-IT'};
const PLANNING_MESSAGES=[
  ['Portée de la modification','Edit scope','Bereik van de wijziging','Ambito della modifica'],['Ce jour uniquement','This occurrence only','Alleen deze datum','Solo questa occorrenza'],['Date de début de la série','Series start date','Begindatum van de reeks','Data di inizio della serie'],['Enregistrer la série','Save series','Reeks opslaan','Salva serie'],
  ['La série sera modifiée à partir de la date choisie. Les jours déjà déplacés ou supprimés sont conservés.','The series will be updated from the chosen date. Previously moved or deleted occurrences are preserved.','De reeks wordt gewijzigd vanaf de gekozen datum. Eerder verplaatste of verwijderde datums blijven behouden.','La serie verrà modificata dalla data scelta. Le occorrenze già spostate o eliminate vengono conservate.'],
  ['Ancienne série : importez une fois le fichier ICS du calendrier pour reprendre aussi les jours déjà supprimés.','Existing series: import the calendar ICS file once to include previously deleted occurrences.','Bestaande reeks: importeer het ICS-bestand van de kalender eenmalig om eerder verwijderde datums over te nemen.','Serie esistente: importa una volta il file ICS del calendario per recuperare anche le occorrenze già eliminate.'],
  ['Importer les exceptions existantes','Import existing exceptions','Bestaande uitzonderingen importeren','Importa le eccezioni esistenti'],
  ['Importez une fois le fichier ICS pour conserver toutes les exceptions de cette ancienne série.','Import the ICS file once to preserve all exceptions in this existing series.','Importeer het ICS-bestand eenmalig om alle uitzonderingen van deze bestaande reeks te behouden.','Importa una volta il file ICS per conservare tutte le eccezioni di questa serie esistente.'],
  ['Fichier ICS invalide ou trop volumineux.','Invalid or oversized ICS file.','Ongeldig of te groot ICS-bestand.','File ICS non valido o troppo grande.'],['Fichier ICS invalide.','Invalid ICS file.','Ongeldig ICS-bestand.','File ICS non valido.'],
  ['Seules les séries avec une heure sont prises en charge dans cet import.','This import supports timed series only.','Deze import ondersteunt alleen reeksen met een tijdstip.','Questa importazione supporta solo serie con un orario.'],
  ['Cette série ICS est absente, fractionnée ou incompatible.','This ICS series is missing, split or incompatible.','Deze ICS-reeks ontbreekt, is opgesplitst of is niet compatibel.','Questa serie ICS è assente, suddivisa o incompatibile.'],
  ['La série ICS doit préciser son début et sa fin.','The ICS series must specify its start and end.','De ICS-reeks moet een begin en een einde bevatten.','La serie ICS deve specificare inizio e fine.'],
  ['Le journal des exceptions est invalide. Aucune série modifiée.','The exception journal is invalid. No series was changed.','Het uitzonderingenlogboek is ongeldig. Er is geen reeks gewijzigd.','Il registro delle eccezioni non è valido. Nessuna serie modificata.'],
  ['Plusieurs journaux correspondent à cette série. Aucune modification effectuée.','Multiple journals match this series. No changes were made.','Meerdere logboeken horen bij deze reeks. Er is niets gewijzigd.','Più registri corrispondono a questa serie. Nessuna modifica effettuata.'],
  ['Le journal des exceptions n’a pas pu être enregistré.','The exception journal could not be saved.','Het uitzonderingenlogboek kon niet worden opgeslagen.','Impossibile salvare il registro delle eccezioni.'],
  ['Une sauvegarde de série doit d’abord être reprise. Actualisez le calendrier.','A series save must be resumed first. Refresh the calendar.','Hervat eerst het opslaan van de reeks. Vernieuw de kalender.','Prima occorre riprendere il salvataggio della serie. Aggiorna il calendario.'],
  ['Une exception commence bientôt. Réessayez après son exécution.','An exception starts soon. Try again after it runs.','Een uitzondering begint binnenkort. Probeer het na de uitvoering opnieuw.','Un’eccezione inizia a breve. Riprova dopo la sua esecuzione.'],
  ['Le nouvel événement n’a pas pu être retrouvé. Actualisez pour reprendre la sauvegarde.','The new event could not be found. Refresh to resume saving.','De nieuwe gebeurtenis is niet gevonden. Vernieuw om het opslaan te hervatten.','Impossibile trovare il nuovo evento. Aggiorna per riprendere il salvataggio.'],
  ['Opération de calendrier invalide.','Invalid calendar operation.','Ongeldige kalenderbewerking.','Operazione del calendario non valida.'],
  ['Ce calendrier est incompatible avec la modification de série préservant les exceptions.','This calendar does not support series edits that preserve exceptions.','Deze kalender ondersteunt geen reekswijzigingen met behoud van uitzonderingen.','Questo calendario non supporta modifiche della serie che conservano le eccezioni.'],
  ['Cette structure de série n’est pas prise en charge. Aucune modification effectuée.','This series structure is unsupported. No changes were made.','Deze reeksstructuur wordt niet ondersteund. Er is niets gewijzigd.','Questa struttura della serie non è supportata. Nessuna modifica effettuata.'],
  ['La série ou une de ses exceptions a changé. Fermez puis rouvrez la programmation.','The series or one of its exceptions has changed. Close and reopen the schedule.','De reeks of een uitzondering is gewijzigd. Sluit de planning en open deze opnieuw.','La serie o una delle sue eccezioni è cambiata. Chiudi e riapri la programmazione.'],
  ['Impossible de confirmer l’enregistrement de la série. Actualisez le calendrier avant de réessayer.','Unable to confirm the series was saved. Refresh the calendar before trying again.','Kan niet bevestigen dat de reeks is opgeslagen. Vernieuw de kalender voordat u het opnieuw probeert.','Impossibile confermare il salvataggio della serie. Aggiorna il calendario prima di riprovare.'],
  ['La série doit être relue avant sa modification.','The series must be read again before editing.','De reeks moet opnieuw worden gelezen voordat deze wordt gewijzigd.','La serie deve essere riletta prima di modificarla.'],
  ['Réponse de série invalide.','Invalid series response.','Ongeldig antwoord voor de reeks.','Risposta della serie non valida.'],['Impossible de modifier la série.','Unable to edit the series.','De reeks kan niet worden gewijzigd.','Impossibile modificare la serie.'],
  ['La série a été reprogrammée.','The series was rescheduled.','De reeks is opnieuw gepland.','La serie è stata riprogrammata.'],['Règle de répétition indisponible. Ouvrez une occurrence habituelle.','Recurrence rule unavailable. Open a regular occurrence.','Herhalingsregel niet beschikbaar. Open een gewone uitvoering.','Regola di ripetizione non disponibile. Apri un’occorrenza regolare.'],['Portée de modification invalide.','Invalid edit scope.','Ongeldig wijzigingsbereik.','Ambito di modifica non valido.'],
  ['Cliquez pour modifier. Glissez ⠿ pour déplacer un seul jour.','Click to edit. Drag ⠿ to move one occurrence.','Klik om te wijzigen. Sleep ⠿ om één datum te verplaatsen.','Fai clic per modificare. Trascina ⠿ per spostare una sola occorrenza.'],
  ['Mois','Month','Maand','Mese'],['Semaine','Week','Week','Settimana'],['Agenda','Agenda','Agenda','Agenda'],['Aujourd’hui','Today','Vandaag','Oggi'],
  ['Réglages','Settings','Instellingen','Impostazioni'],['⚙ Réglages','⚙ Settings','⚙ Instellingen','⚙ Impostazioni'],['+ Programmation','+ Schedule','+ Planning','+ Programmazione'],
  ['Période précédente','Previous period','Vorige periode','Periodo precedente'],['Période suivante','Next period','Volgende periode','Periodo successivo'],['Actualiser','Refresh','Vernieuwen','Aggiorna'],['Vue du calendrier','Calendar view','Kalenderweergave','Vista calendario'],
  ['Local','Local','Lokaal','Locale'],['Test','Test','Test','Test'],['Actif','Active','Actief','Attivo'],['Arrêté','Disabled','Uitgeschakeld','Disattivato'],['Partagé','Shared','Gedeeld','Condiviso'],['À configurer','Set up','Instellen','Da configurare'],
  ['Essai local · aucune commande envoyée','Local preview · no commands sent','Lokale test · geen opdrachten verzonden','Anteprima locale · nessun comando inviato'],
  ['Choisissez vos horaires, puis préparez l’exécution dans Réglages.','Choose your times, then set up execution in Settings.','Kies uw tijden en stel daarna de uitvoering in via Instellingen.','Scegli gli orari, poi configura l’esecuzione nelle Impostazioni.'],
  ['Programmations partagées · exécution gérée par Home Assistant','Shared schedules · execution managed by Home Assistant','Gedeelde planningen · uitvoering via Home Assistant','Programmazioni condivise · esecuzione gestita da Home Assistant'],
  ['Automatisation désactivée dans Home Assistant','Automation disabled in Home Assistant','Automatisering uitgeschakeld in Home Assistant','Automazione disattivata in Home Assistant'],
  ['Mode test · notifications uniquement','Test mode · notifications only','Testmodus · alleen meldingen','Modalità test · solo notifiche'],['Exécution Home Assistant active','Home Assistant execution active','Uitvoering via Home Assistant actief','Esecuzione Home Assistant attiva'],
  ['Cliquer pour modifier','Click to edit','Klik om te wijzigen','Fai clic per modificare'],['Déplacer','Move','Verplaatsen','Sposta'],['Glisser pour déplacer ce jour','Drag to move this occurrence','Sleep om alleen deze datum te verplaatsen','Trascina per spostare questa occorrenza'],['Choisir une date','Choose a date','Kies een datum','Scegli una data'],['Ajouter le','Add on','Toevoegen op','Aggiungi il'],
  ['Cliquez sur une programmation pour la modifier. Glissez la poignée ⠿ pour déplacer seulement ce jour. En vue Semaine, l’heure se règle par pas de 10 minutes. Vous pouvez aussi cliquer pour modifier la date et l’heure.','Click a schedule to edit it. Drag ⠿ to move only this occurrence. Week view snaps to 10 minutes. You can also edit the date and time in the form.','Klik op een planning om ze te wijzigen. Sleep ⠿ om alleen deze datum te verplaatsen. De weekweergave gebruikt stappen van 10 minuten. U kunt de datum en tijd ook in het formulier wijzigen.','Fai clic su una programmazione per modificarla. Trascina ⠿ per spostare solo questa occorrenza. La vista Settimana usa intervalli di 10 minuti. Puoi anche modificare data e ora nel modulo.'],
  ['Aucune programmation ce mois-ci.','No schedules this month.','Geen planningen deze maand.','Nessuna programmazione questo mese.'],
  ['Fermer','Close','Sluiten','Chiudi'],['Fermer le message','Dismiss message','Melding sluiten','Chiudi messaggio'],['Annuler','Cancel','Annuleren','Annulla'],['Enregistrer','Save','Opslaan','Salva'],['Enregistrement…','Saving…','Opslaan…','Salvataggio…'],['Modifier','Edit','Wijzigen','Modifica'],['Supprimer','Delete','Verwijderen','Elimina'],['Supprimer ce jour','Delete this occurrence','Alleen deze datum verwijderen','Elimina questa occorrenza'],['Conserver','Keep','Behouden','Mantieni'],
  ['Nouvelle programmation','New schedule','Nieuwe planning','Nuova programmazione'],['Modifier cette programmation','Edit schedule','Planning wijzigen','Modifica programmazione'],['Programmation','Schedule','Planning','Programmazione'],
  ['Nom','Name','Naam','Nome'],['Ex. Chauffe atelier ou ouverture barrière','e.g. Workshop heating or gate opening','Bijv. werkplaatsverwarming of poortopening','Es. riscaldamento officina o apertura cancello'],['Date de début','Start date','Begindatum','Data di inizio'],['Date de cette occurrence','Date of this occurrence','Datum van deze uitvoering','Data di questa occorrenza'],
  ['Répétition','Repeat','Herhaling','Ripetizione'],['Une seule fois','Once','Eenmalig','Una sola volta'],['Chaque semaine','Every week','Elke week','Ogni settimana'],['Jours habituels','Weekly days','Vaste dagen','Giorni abituali'],
  ['Créez autant de programmations que nécessaire pour des horaires différents.','Add more schedules for different times.','Voeg extra planningen toe voor andere tijden.','Aggiungi altre programmazioni per orari diversi.'],
  ['Au début','At the start','Bij het begin','All’inizio'],['À la fin','At the end','Aan het einde','Alla fine'],['Heure de début','Start time','Begintijd','Ora di inizio'],['Heure de fin','End time','Eindtijd','Ora di fine'],['Minute de début','Start minute','Beginminuut','Minuto di inizio'],['Minute de fin','End minute','Eindminuut','Minuto di fine'],
  ['Prévoir une heure et des actions de fin','Set an end time and end actions','Eindtijd en eindacties instellen','Imposta un orario e le azioni di fine'],
  ['Si l’heure de fin précède l’heure de début, le créneau se termine le lendemain.','If the end time is earlier than the start, the slot ends the next day.','Als de eindtijd vóór de begintijd ligt, eindigt het tijdvak de volgende dag.','Se l’ora di fine precede l’inizio, la fascia termina il giorno successivo.'],
  ['Action ponctuelle : adapté au démarrage des Frech, sans arrêt programmé.','One-time action: suitable for starting Frech machines, with no scheduled stop.','Eenmalige actie: geschikt om Frech-machines te starten zonder geplande stop.','Azione singola: adatta all’avvio delle Frech, senza arresto programmato.'],
  ['+ Ajouter une action','+ Add action','+ Actie toevoegen','+ Aggiungi azione'],['+ Ajouter une action à la fin','+ Add end action','+ Eindactie toevoegen','+ Aggiungi azione di fine'],['Choisir un appareil ou un script','Choose a device or script','Kies een apparaat of script','Scegli un dispositivo o uno script'],['indisponible','unavailable','niet beschikbaar','non disponibile'],
  ['Couleur','Colour','Kleur','Colore'],['Note facultative','Optional note','Optionele notitie','Nota facoltativa'],['Note','Note','Notitie','Nota'],['Description','Description','Beschrijving','Descrizione'],
  ['Seul ce jour sera modifié. Les autres occurrences gardent leur horaire et leurs actions.','Only this occurrence will change. Other occurrences keep their times and actions.','Alleen deze datum wijzigt. Andere uitvoeringen behouden hun tijden en acties.','Verrà modificata solo questa occorrenza. Le altre mantengono orari e azioni.'],['Seul ce jour sera modifié.','Only this occurrence will change.','Alleen deze datum wordt gewijzigd.','Verrà modificata solo questa occorrenza.'],
  ['L’horaire peut être modifié sans changer les actions existantes.','You can change the time without changing existing actions.','U kunt de tijd wijzigen zonder de bestaande acties te veranderen.','Puoi modificare l’orario senza cambiare le azioni esistenti.'],
  ['Pour déplacer, changez la date ou l’heure. Vous pouvez aussi glisser la programmation sur le calendrier.','Change the date or time to move this occurrence, or drag it on the calendar.','Wijzig de datum of tijd om deze uitvoering te verplaatsen, of sleep ze op de kalender.','Modifica data o ora per spostare questa occorrenza, oppure trascinala sul calendario.'],
  ['La durée de l’événement et ses associations existantes sont conservées.','The event duration and existing associations are kept.','De duur en bestaande koppelingen blijven behouden.','La durata dell’evento e le associazioni esistenti vengono mantenute.'],
  ['Ce calendrier ne fournit pas d’identifiant modifiable pour cet événement. Utilisez un calendrier local permettant sa modification.','This calendar does not provide an editable event ID. Use a local calendar that supports editing.','Deze kalender geeft geen bewerkbaar gebeurtenis-ID. Gebruik een lokale kalender die wijzigingen ondersteunt.','Questo calendario non fornisce un ID evento modificabile. Usa un calendario locale che supporti le modifiche.'],
  ['Actions et appareils','Actions and devices','Acties en apparaten','Azioni e dispositivi'],['Configurer les actions','Configure actions','Acties instellen','Configura le azioni'],
  ['Pour associer des appareils à cette programmation et utiliser les actions de début/fin de Planning :','To associate devices with this schedule and use Planning start/end actions:','Om apparaten aan deze planning te koppelen en begin- en eindacties te gebruiken:','Per associare dispositivi a questa programmazione e usare le azioni di inizio/fine:'],
  ['Toute la série','Entire series','Hele reeks','Intera serie'],['Supprimer toute la série','Delete entire series','Hele reeks verwijderen','Elimina l’intera serie'],['Confirmer la suppression','Confirm deletion','Verwijderen bevestigen','Conferma eliminazione'],['Supprimer toutes les occurrences de cette série ?','Delete every occurrence in this series?','Alle uitvoeringen van deze reeks verwijderen?','Eliminare tutte le occorrenze della serie?'],['Supprimer uniquement cette occurrence ?','Delete only this occurrence?','Alleen deze uitvoering verwijderen?','Eliminare solo questa occorrenza?'],['Supprimer toute la série ?','Delete the entire series?','De hele reeks verwijderen?','Eliminare l’intera serie?'],['Supprimer uniquement ce jour ?','Delete only this day?','Alleen deze datum verwijderen?','Eliminare solo questa data?'],
  ['La suppression de série retire toutes ses occurrences, y compris les jours déplacés.','Deleting the series removes all its occurrences, including moved dates.','De reeks verwijderen wist alle uitvoeringen, ook verplaatste datums.','Eliminando la serie vengono rimosse tutte le occorrenze, incluse quelle spostate.'],
  ['Le premier enregistrement préparera l’exécution du calendrier en mode test. Un administrateur est nécessaire.','The first save sets up calendar execution in test mode. An administrator is required.','Bij de eerste opslag wordt de uitvoering in testmodus ingesteld. Een beheerder is vereist.','Il primo salvataggio prepara l’esecuzione in modalità test. Serve un amministratore.'],
  ['Réglages du planning','Planning settings','Planninginstellingen','Impostazioni della pianificazione'],['Préparer l’exécution en mode test','Set up execution in test mode','Uitvoering in testmodus instellen','Prepara l’esecuzione in modalità test'],
  ['Appareils du planning','Planning devices','Apparaten van de planning','Dispositivi della pianificazione'],['Appareil du planning','Planning device','Apparaat van de planning','Dispositivo della pianificazione'],
  ['Ajoutez ici vos appareils une fois. Ils seront ensuite proposés dans chaque programmation.','Add your devices here once, then use them in schedules.','Voeg uw apparaten hier eenmalig toe en gebruik ze daarna in planningen.','Aggiungi qui i dispositivi una volta, poi usali nelle programmazioni.'],
  ['Aucun appareil enregistré pour le moment.','No devices saved yet.','Nog geen apparaten opgeslagen.','Nessun dispositivo ancora salvato.'],['+ Ajouter un appareil','+ Add device','+ Apparaat toevoegen','+ Aggiungi dispositivo'],['Ajouter un appareil','Add device','Apparaat toevoegen','Aggiungi dispositivo'],['Modifier un appareil','Edit device','Apparaat wijzigen','Modifica dispositivo'],
  ['Un administrateur ajoute les nouveaux appareils. Vous pouvez modifier les horaires et les actions des appareils disponibles.','An administrator adds new devices. You can edit times and actions for available devices.','Een beheerder voegt nieuwe apparaten toe. U kunt tijden en acties van beschikbare apparaten wijzigen.','Un amministratore aggiunge i nuovi dispositivi. Puoi modificare orari e azioni dei dispositivi disponibili.'],
  ['Nom affiché','Display name','Weergavenaam','Nome visualizzato'],['Nom de l’appareil','Device name','Apparaatnaam','Nome del dispositivo'],['Type','Type','Type','Tipo'],['Appareil / entité','Device / entity','Apparaat / entiteit','Dispositivo / entità'],['Choisir une entité','Choose an entity','Kies een entiteit','Scegli un’entità'],
  ['Relais de la Frech','Frech relay','Frech-relais','Relè della Frech'],['Entrée de contrôle','Control input','Controle-ingang','Ingresso di controllo'],['Script de démarrage existant','Existing start script','Bestaand startscript','Script di avvio esistente'],['Numéro de la Frech','Frech number','Frech-nummer','Numero della Frech'],['Disponible dans les programmations','Available in schedules','Beschikbaar in planningen','Disponibile nelle programmazioni'],['Enregistrer l’appareil','Save device','Apparaat opslaan','Salva dispositivo'],['Disponible','Available','Beschikbaar','Disponibile'],['Désactivé','Disabled','Uitgeschakeld','Disattivato'],
  ['Le script existant est conservé avec son relais, son entrée et son numéro. Le planning propose un démarrage seul.','The existing script keeps its relay, input and number. The schedule offers a start action only.','Het bestaande script behoudt zijn relais, ingang en nummer. De planning biedt een startactie zonder geplande stop.','Lo script esistente mantiene relè, ingresso e numero. La programmazione propone solo l’avvio.'],
  ['Pour choisir les appareils affichés sur cette carte : Modifier la carte → Appareils proposés dans les programmations. Pour les couleurs et la vue initiale : Personnalisation.','Choose devices in Edit card → Devices offered in schedules. Colours and initial view are under Appearance.','Kies apparaten via Kaart bewerken → Apparaten voor planningen. Kleuren en beginweergave staan onder Weergave.','Scegli i dispositivi in Modifica scheda → Dispositivi proposti nelle programmazioni. Colori e vista iniziale sono in Aspetto.'],
  ['Sélectionnez d’abord les appareils autorisés dans les paramètres de la carte.','First select allowed devices in the card settings.','Selecteer eerst de toegestane apparaten in de kaartinstellingen.','Seleziona prima i dispositivi autorizzati nelle impostazioni della scheda.'],
  ['Cette entité n’est pas autorisée dans les paramètres de la carte.','This entity is not allowed in the card settings.','Deze entiteit is niet toegestaan in de kaartinstellingen.','Questa entità non è autorizzata nelle impostazioni della scheda.'],
  ['Aucune entité autorisée pour ce type.','No entities allowed for this type.','Geen toegestane entiteiten voor dit type.','Nessuna entità autorizzata per questo tipo.'],['hors sélection de la carte','outside this card’s selection','buiten de selectie van deze kaart','fuori dalla selezione della scheda'],
  ['Interrupteur','Switch','Schakelaar','Interruttore'],['Éclairage','Light','Verlichting','Luce'],['Commande','Toggle','Schakeloptie','Comando'],['Barrière / volet','Gate / cover','Poort / rolluik','Cancello / tapparella'],['Script','Script','Script','Script'],['Scène','Scene','Scène','Scena'],['Bouton','Button','Knop','Pulsante'],['Frech','Frech','Frech','Frech'],
  ['Allumer','Turn on','Inschakelen','Accendi'],['Éteindre','Turn off','Uitschakelen','Spegni'],['Activer','Activate','Activeren','Attiva'],['Désactiver','Deactivate','Deactiveren','Disattiva'],['Ouvrir','Open','Openen','Apri'],['Fermer','Close','Sluiten','Chiudi'],['Arrêter','Stop','Stoppen','Arresta'],['Lancer le script','Run script','Script uitvoeren','Esegui script'],['Activer la scène','Activate scene','Scène activeren','Attiva scena'],['Appuyer','Press','Indrukken','Premi'],['Démarrer avec contrôle','Start with input check','Starten met ingangscontrole','Avvia con controllo ingresso'],
  ['Votre planning','Your planning','Uw planning','La tua pianificazione'],['Nom de la carte','Card name','Kaartnaam','Nome della scheda'],['Calendrier','Calendar','Kalender','Calendario'],['Choisir un calendrier local','Choose a local calendar','Kies een lokale kalender','Scegli un calendario locale'],['Langue','Language','Taal','Lingua'],['Automatique (Home Assistant)','Automatic (Home Assistant)','Automatisch (Home Assistant)','Automatica (Home Assistant)'],
  ['Un seul calendrier. Ajoutez ensuite vos créneaux et choisissez directement les actions à exécuter.','One calendar. Add time slots and choose their actions directly.','Eén kalender. Voeg tijdvakken toe en kies rechtstreeks de acties.','Un solo calendario. Aggiungi le fasce orarie e scegli direttamente le azioni.'],
  ['Essai local, sans enregistrement dans Home Assistant','Local preview, without saving to Home Assistant','Lokale test, zonder opslag in Home Assistant','Anteprima locale, senza salvare in Home Assistant'],['Les actions sont simulées.','Actions are simulated.','Acties worden gesimuleerd.','Le azioni sono simulate.'],
  ['L’exécution se prépare depuis le bouton Réglages de la carte. Le mode test est proposé en premier.','Set up execution using the card’s Settings button. Test mode is enabled first.','Stel de uitvoering in via de knop Instellingen. Eerst wordt de testmodus gebruikt.','Prepara l’esecuzione dal pulsante Impostazioni. All’inizio viene usata la modalità test.'],
  ['Appareils proposés dans les programmations','Devices offered in schedules','Apparaten voor planningen','Dispositivi proposti nelle programmazioni'],
  ['Cochez les entités autorisées. Sans sélection, aucun nouvel appareil n’est proposé. Pour une Frech, autorisez aussi son script et son entrée de contrôle.','Select allowed entities. An empty selection offers no new devices. For a Frech, also allow its script and control input.','Vink de toegestane entiteiten aan. Zonder selectie worden geen nieuwe apparaten aangeboden. Sta voor een Frech ook het script en de controle-ingang toe.','Seleziona le entità autorizzate. Senza selezione non vengono proposti nuovi dispositivi. Per una Frech, autorizza anche lo script e l’ingresso di controllo.'],
  ['Rechercher un appareil','Search devices','Apparaat zoeken','Cerca un dispositivo'],['Nom ou identifiant de l’entité','Entity name or ID','Naam of ID van de entiteit','Nome o ID dell’entità'],['Aucune entité compatible disponible.','No compatible entities available.','Geen compatibele entiteiten beschikbaar.','Nessuna entità compatibile disponibile.'],
  ['Exécution existante / migration','Existing execution / migration','Bestaande uitvoering / migratie','Esecuzione esistente / migrazione'],['Automatisation déjà utilisée','Existing automation','Bestaande automatisering','Automazione esistente'],['Détection automatique','Automatic detection','Automatische detectie','Rilevamento automatico'],
  ['Choisir votre ancienne automatisation Planning permet de retrouver ses appareils Frech et leurs associations. Les nouvelles installations se préparent dans Réglages.','Select your previous Planning automation to find its Frech devices and associations. New installations are set up in Settings.','Kies uw vorige Planning-automatisering om Frech-apparaten en koppelingen terug te vinden. Nieuwe installaties stelt u in via Instellingen.','Scegli la precedente automazione Planning per ritrovare dispositivi Frech e associazioni. Le nuove installazioni si preparano nelle Impostazioni.'],
  ['Personnalisation','Appearance','Weergave','Aspetto'],['Vue initiale','Initial view','Beginweergave','Vista iniziale'],['Premier jour','First day','Eerste dag','Primo giorno'],['Format des heures','Time format','Tijdnotatie','Formato orario'],['24 heures','24 hours','24 uur','24 ore'],['12 heures','12 hours','12 uur','12 ore'],['Densité','Density','Dichtheid','Densità'],['Confortable','Comfortable','Ruim','Comoda'],['Compacte','Compact','Compact','Compatta'],['Style des événements','Event style','Gebeurtenisstijl','Stile degli eventi'],['Fond coloré','Filled','Gekleurde achtergrond','Sfondo colorato'],['Contour','Outline','Omlijning','Contorno'],['Repère de couleur','Colour marker','Kleurmarkering','Indicatore colorato'],['Afficher les week-ends','Show weekends','Weekenden tonen','Mostra i fine settimana'],['Afficher les noms des appareils dans le calendrier','Show device names in the calendar','Apparaatnamen in de kalender tonen','Mostra i nomi dei dispositivi nel calendario'],['Couleur principale','Accent colour','Accentkleur','Colore principale'],
  ['Lundi','Monday','Maandag','Lunedì'],['Mardi','Tuesday','Dinsdag','Martedì'],['Mercredi','Wednesday','Woensdag','Mercoledì'],['Jeudi','Thursday','Donderdag','Giovedì'],['Vendredi','Friday','Vrijdag','Venerdì'],['Samedi','Saturday','Zaterdag','Sabato'],['Dimanche','Sunday','Zondag','Domenica'],
  ['Taille : utilisez l’onglet Disposition dans une vue Sections, ou une vue Panneau pour la pleine largeur.','Size: use the Layout tab in a Sections view, or a Panel view for full width.','Grootte: gebruik Indeling in een Secties-weergave, of een Paneel-weergave voor de volle breedte.','Dimensioni: usa la scheda Layout in una vista Sezioni, oppure una vista Pannello a tutta larghezza.'],
  ['Donnez un nom à la programmation.','Give the schedule a name.','Geef de planning een naam.','Assegna un nome alla programmazione.'],['Prévoyez au moins 20 minutes avant le début.','Allow at least 20 minutes before the start.','Plan minstens 20 minuten vóór het begin.','Prevedi almeno 20 minuti prima dell’inizio.'],
  ['Cette occurrence a été modifiée.','This occurrence was updated.','Deze uitvoering is gewijzigd.','Questa occorrenza è stata modificata.'],['Programmation enregistrée.','Schedule saved.','Planning opgeslagen.','Programmazione salvata.'],['Cette occurrence a été déplacée. Les autres jours et les actions restent inchangés.','This occurrence was moved. Other dates and actions are unchanged.','Deze uitvoering is verplaatst. Andere datums en acties blijven ongewijzigd.','Questa occorrenza è stata spostata. Le altre date e azioni restano invariate.'],
  ['Cette occurrence a été modifiée. Ses actions existantes sont conservées.','This occurrence was updated. Its existing actions were kept.','Deze uitvoering is gewijzigd. De bestaande acties zijn behouden.','Questa occorrenza è stata modificata. Le azioni esistenti sono state mantenute.'],['Série supprimée.','Series deleted.','Reeks verwijderd.','Serie eliminata.'],['Cette occurrence a été supprimée.','This occurrence was deleted.','Deze uitvoering is verwijderd.','Questa occorrenza è stata eliminata.'],['Exécution préparée en mode test.','Execution set up in test mode.','Uitvoering ingesteld in testmodus.','Esecuzione preparata in modalità test.'],
  ['Appareil enregistré.','Device saved.','Apparaat opgeslagen.','Dispositivo salvato.'],['Il est disponible dans les programmations.','It is available in schedules.','Het is beschikbaar in planningen.','È disponibile nelle programmazioni.'],
  ['Cet appareil est déjà présent. Utilisez Modifier dans la liste.','This device already exists. Use Edit in the list.','Dit apparaat bestaat al. Gebruik Wijzigen in de lijst.','Questo dispositivo esiste già. Usa Modifica nell’elenco.'],
  ['Une programmation avec cet identifiant existe déjà. Actualisez avant de recommencer.','A schedule with this ID already exists. Refresh before trying again.','Er bestaat al een planning met dit ID. Vernieuw voordat u het opnieuw probeert.','Esiste già una programmazione con questo ID. Aggiorna prima di riprovare.'],
  ['La première sauvegarde est déjà enregistrée. Ouvrez la programmation pour la modifier.','The first save was already completed. Open the schedule to edit it.','De eerste opslag was al voltooid. Open de planning om ze te wijzigen.','Il primo salvataggio è già stato completato. Apri la programmazione per modificarla.'],
  ['Cette occurrence a changé ou a été supprimée. Actualisez avant de recommencer.','This occurrence changed or was deleted. Refresh before trying again.','Deze uitvoering is gewijzigd of verwijderd. Vernieuw voordat u het opnieuw probeert.','Questa occorrenza è cambiata o è stata eliminata. Aggiorna prima di riprovare.'],
  ['Choisissez un calendrier local disponible dans la configuration de la carte.','Choose an available local calendar in the card configuration.','Kies een beschikbare lokale kalender in de kaartconfiguratie.','Scegli un calendario locale disponibile nella configurazione della scheda.'],['Ce calendrier ne permet pas toutes les modifications. Utilisez Calendrier local.','This calendar does not support all changes. Use Local Calendar.','Deze kalender ondersteunt niet alle wijzigingen. Gebruik Lokale kalender.','Questo calendario non supporta tutte le modifiche. Usa Calendario locale.'],['Réponse calendrier invalide.','Invalid calendar response.','Ongeldig kalenderantwoord.','Risposta del calendario non valida.'],
  ['Cet événement ne possède pas d’identifiant modifiable.','This event has no editable ID.','Deze gebeurtenis heeft geen bewerkbaar ID.','Questo evento non ha un ID modificabile.'],['Ce calendrier ne fournit pas l’identifiant de cette occurrence. La série n’a pas été modifiée.','This calendar does not provide the occurrence ID. The series was not changed.','Deze kalender geeft geen ID voor deze uitvoering. De reeks is niet gewijzigd.','Questo calendario non fornisce l’ID dell’occorrenza. La serie non è stata modificata.'],
  ['Ce créneau est en cours. Son action de fin est conservée ; modifiez une occurrence future.','This slot is running. Its end action is kept; edit a future occurrence.','Dit tijdvak is actief. De eindactie blijft behouden; wijzig een toekomstige uitvoering.','Questa fascia è in corso. L’azione finale viene mantenuta; modifica un’occorrenza futura.'],
  ['La fin doit être après le début.','The end must be after the start.','Het einde moet na het begin liggen.','La fine deve essere successiva all’inizio.'],['Ajoutez au moins une action au début.','Add at least one start action.','Voeg minstens één beginactie toe.','Aggiungi almeno un’azione iniziale.'],['Choisissez l’action à exécuter à la fin.','Choose an end action.','Kies een eindactie.','Scegli un’azione finale.'],['Choisissez une seule action par appareil à chaque étape (50 maximum).','Choose one action per device at each stage (maximum 50).','Kies per stap één actie per apparaat (maximaal 50).','Scegli una sola azione per dispositivo in ogni fase (massimo 50).'],['Une action est absente, désactivée ou incompatible. Vérifiez la sélection.','An action is missing, disabled or incompatible. Check the selection.','Een actie ontbreekt, is uitgeschakeld of is niet compatibel. Controleer de selectie.','Un’azione è mancante, disattivata o incompatibile. Controlla la selezione.'],['Choisissez au moins un jour de répétition.','Choose at least one repeat day.','Kies minstens één herhalingsdag.','Scegli almeno un giorno di ripetizione.'],['Choisissez une date de début future.','Choose a future start date.','Kies een toekomstige begindatum.','Scegli una data di inizio futura.'],
  ['Choisissez une entité compatible.','Choose a compatible entity.','Kies een compatibele entiteit.','Scegli un’entità compatibile.'],['Action autorisée invalide.','Invalid allowed action.','Ongeldige toegestane actie.','Azione autorizzata non valida.'],['Configuration du démarrage Frech incomplète.','Frech start configuration is incomplete.','De Frech-startconfiguratie is onvolledig.','La configurazione di avvio Frech è incompleta.'],['L’entité ne correspond pas au type d’action.','The entity does not match the action type.','De entiteit past niet bij het actietype.','L’entità non corrisponde al tipo di azione.'],['La sélection doit contenir au maximum 200 entités.','Select no more than 200 entities.','Selecteer maximaal 200 entiteiten.','Seleziona al massimo 200 entità.'],['Un appareil sélectionné est incompatible.','A selected device is incompatible.','Een geselecteerd apparaat is niet compatibel.','Un dispositivo selezionato non è compatibile.'],
  ['Date ou heure invalide.','Invalid date or time.','Ongeldige datum of tijd.','Data o ora non valida.'],['Cette heure n’existe pas dans le fuseau Home Assistant (changement d’heure).','This time does not exist in the Home Assistant time zone (daylight saving change).','Deze tijd bestaat niet in de Home Assistant-tijdzone door de zomertijdwisseling.','Quest’ora non esiste nel fuso orario di Home Assistant a causa del cambio d’ora.'],['Cette heure est ambiguë lors du changement d’heure. Choisissez une autre heure.','This time is ambiguous during the daylight saving change. Choose another time.','Deze tijd is dubbelzinnig door de zomertijdwisseling. Kies een andere tijd.','Quest’ora è ambigua durante il cambio d’ora. Scegli un altro orario.'],
  ['Un administrateur doit autoriser cette nouvelle entité une première fois.','An administrator must allow this new entity once.','Een beheerder moet deze nieuwe entiteit eenmalig toestaan.','Un amministratore deve autorizzare questa nuova entità una prima volta.'],['Une action est en cours. Attendez sa fin pour ajouter une nouvelle entité.','An action is running. Wait for it to finish before adding an entity.','Er wordt een actie uitgevoerd. Wacht tot ze klaar is voordat u een entiteit toevoegt.','Un’azione è in corso. Attendi la fine prima di aggiungere un’entità.'],
  ['Choisissez d’abord un calendrier local dans la configuration de la carte.','First choose a local calendar in the card configuration.','Kies eerst een lokale kalender in de kaartconfiguratie.','Scegli prima un calendario locale nella configurazione della scheda.'],['La préparation du planning nécessite un administrateur Home Assistant.','Setting up the planning requires a Home Assistant administrator.','Het instellen van de planning vereist een Home Assistant-beheerder.','La preparazione della pianificazione richiede un amministratore Home Assistant.'],
  ['Préparez d’abord l’exécution de ce calendrier dans les réglages de la carte.','First set up this calendar’s execution in the card settings.','Stel eerst de uitvoering van deze kalender in via de kaartinstellingen.','Prepara prima l’esecuzione di questo calendario nelle impostazioni della scheda.'],['Choisissez une action active et compatible.','Choose an enabled, compatible action.','Kies een actieve, compatibele actie.','Scegli un’azione attiva e compatibile.'],['Cette entité n’est plus disponible.','This entity is no longer available.','Deze entiteit is niet meer beschikbaar.','Questa entità non è più disponibile.'],['Cette action a changé depuis l’ouverture. Actualisez et recommencez.','This action changed after opening. Refresh and try again.','Deze actie is na het openen gewijzigd. Vernieuw en probeer opnieuw.','Questa azione è cambiata dopo l’apertura. Aggiorna e riprova.'],
  ['Les actions autorisées ont changé. Actualisez puis vérifiez votre programmation.','The allowed actions changed. Refresh and check your schedule.','De toegestane acties zijn gewijzigd. Vernieuw en controleer uw planning.','Le azioni autorizzate sono cambiate. Aggiorna e controlla la programmazione.'],['La sauvegarde des actions n’a pas pu être confirmée.','The action save could not be confirmed.','Het opslaan van de acties kon niet worden bevestigd.','Non è stato possibile confermare il salvataggio delle azioni.'],['La configuration du planning est indisponible.','The planning configuration is unavailable.','De planningconfiguratie is niet beschikbaar.','La configurazione della pianificazione non è disponibile.'],['Exécution du planning indisponible.','Planning execution is unavailable.','De uitvoering van de planning is niet beschikbaar.','L’esecuzione della pianificazione non è disponibile.'],
  ['Choisissez l’exécution Planning de ce calendrier.','Choose the Planning execution for this calendar.','Kies de Planning-uitvoering voor deze kalender.','Scegli l’esecuzione Planning di questo calendario.'],['La liste des actions autorisées est invalide.','The allowed action list is invalid.','De lijst met toegestane acties is ongeldig.','L’elenco delle azioni autorizzate non è valido.'],['Plusieurs exécutions sont associées à ce calendrier. Vérifiez la configuration.','Several executions are linked to this calendar. Check the configuration.','Er zijn meerdere uitvoeringen aan deze kalender gekoppeld. Controleer de configuratie.','Più esecuzioni sono associate a questo calendario. Controlla la configurazione.'],['Un administrateur doit actualiser la liste des actions autorisées.','An administrator must refresh the allowed action list.','Een beheerder moet de lijst met toegestane acties vernieuwen.','Un amministratore deve aggiornare l’elenco delle azioni autorizzate.'],
  ['Le blueprint téléchargé n’a pas été validé.','The downloaded blueprint did not pass validation.','De gedownloade blueprint is niet goedgekeurd.','Il blueprint scaricato non ha superato la validazione.'],['Un blueprint du même nom existe déjà. Vérifiez-le dans Home Assistant.','A blueprint with this name already exists. Check it in Home Assistant.','Er bestaat al een blueprint met deze naam. Controleer hem in Home Assistant.','Esiste già un blueprint con questo nome. Controllalo in Home Assistant.'],['Nom du blueprint inattendu.','Unexpected blueprint name.','Onverwachte blueprintnaam.','Nome del blueprint inatteso.'],['Identifiant d’action déjà utilisé.','Action ID already in use.','Actie-ID is al in gebruik.','ID azione già in uso.'],['L’automatisation est enregistrée. Actualisez la carte lorsque Home Assistant a terminé son chargement.','The automation is saved. Refresh the card when Home Assistant finishes loading.','De automatisering is opgeslagen. Vernieuw de kaart zodra Home Assistant klaar is met laden.','L’automazione è salvata. Aggiorna la scheda quando Home Assistant ha terminato il caricamento.'],
];
const planningMessageKey=value=>value.normalize('NFC').trim().replace(/\s+/g,' ');
const planningMessageIndex=new Map(PLANNING_MESSAGES.map(row=>[planningMessageKey(row[0]),row]));
function planningTranslate(language,value){
  if(typeof value!=='string' || !['en','nl','it'].includes(language))return value;
  const row=planningMessageIndex.get(planningMessageKey(value)),index={en:1,nl:2,it:3}[language];
  if(row && index)return value.replace(value.trim(),row[index]);
  // Compound messages and indexed accessible labels contain fixed UI fragments only.
  const parts=value.split(/(?<=\.)\s+(?=[A-ZÀ-Ý])/u);if(parts.length>1)return parts.map(p=>planningTranslate(language,p)).join(' ');
  const indexed=value.match(/^(Action|Appareil au début|Appareil à la fin|Retirer l’action) (\d+)$/);
  if(indexed){const labels={en:['Action','Start device','End device','Remove action'],nl:['Actie','Beginapparaat','Eindapparaat','Actie verwijderen'],it:['Azione','Dispositivo iniziale','Dispositivo finale','Rimuovi azione']};return `${labels[language][['Action','Appareil au début','Appareil à la fin','Retirer l’action'].indexOf(indexed[1])]} ${indexed[2]}`;}
  return value;
}
function localizePlanningRoot(root,language){
  root.host.lang=language;if(language==='fr')return;
  const skip=element=>!element || !!element.closest('[translate="no"],script,style,textarea');
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode()))if(!skip(node.parentElement))node.nodeValue=planningTranslate(language,node.nodeValue);
  for(const el of root.querySelectorAll('[title],[aria-label],[placeholder]'))if(!skip(el))for(const name of ['title','aria-label','placeholder'])if(el.hasAttribute(name))el.setAttribute(name,planningTranslate(language,el.getAttribute(name)));
}


const MIN_LEAD_MINUTES = 20;
const META_VERSION = 1;
function newEventId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const values = new Uint32Array(4);
  globalThis.crypto.getRandomValues(values);
  return `pc-${Array.from(values, n => n.toString(16).padStart(8, '0')).join('')}`;
}
const DEFAULT_GROUPS = [];
const DEFAULT_COLOR = '#3689e6';
function eventColor(value) { return /^#[0-9a-f]{6}$/i.test(value || '') ? value.toLowerCase() : DEFAULT_COLOR; }
function colorText(value) {
  const rgb = eventColor(value).slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > .179 ? '#111111' : '#ffffff';
}
function replacesWeekly(restart, weekly) {
  if (restart.meta?.replace_series) return restart.meta.replace_series === weekly.meta?.id;
  return restart.meta?.replace === true || (!Array.isArray(restart.meta?.devices) && restart.start === weekly.start);
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function parts(instant, zone) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
  return Object.fromEntries(p.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
}
function localMinute(instant, zone) {
  const p = parts(instant, zone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function dayOf(instant, zone) { return localMinute(instant, zone).slice(0, 10); }
function shiftDay(day, delta) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
function weekday(day) { return new Date(`${day}T12:00:00Z`).getUTCDay(); }
function cycleDay(day) { return shiftDay(day, -weekday(day)); }
function toInstant(local, zone) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error('Date ou heure invalide.');
  const target = Date.parse(`${local}:00Z`);
  if (!Number.isFinite(target)) throw new Error('Date ou heure invalide.');
  let candidate = target;
  for (let i = 0; i < 5; i++) {
    const wall = Date.parse(`${localMinute(candidate, zone)}:00Z`);
    if (wall === target) break;
    candidate += target - wall;
  }
  if (localMinute(candidate, zone) !== local) throw new Error('Cette heure n’existe pas dans le fuseau Home Assistant (changement d’heure).');
  if ([candidate - 3600000, candidate + 3600000].some(x => localMinute(x, zone) === local)) {
    throw new Error('Cette heure est ambiguë lors du changement d’heure. Choisissez une autre heure.');
  }
  return new Date(candidate).toISOString();
}
function eventTime(value, zone) {
  if (!value) throw new Error('Événement sans date.');
  if (typeof value === 'object') return eventTime(value.dateTime || value.date, zone);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return toInstant(`${value}T00:00`, zone);
  if (/[zZ]$|[+-]\d\d:\d\d$/.test(value)) {
    const n = Date.parse(value);
    if (!Number.isFinite(n)) throw new Error('Date de calendrier invalide.');
    return new Date(n).toISOString();
  }
  return toInstant(value.slice(0, 16), zone);
}
function metadata(description) {
  try {
    const value = JSON.parse(description || 'null');
    if (value?.devices !== undefined && (!Array.isArray(value.devices) || value.devices.some(id => typeof id !== 'string' || !/^[a-z0-9_]+$/.test(id)))) return null;
    return value && !Array.isArray(value) && value.planning_chauffe === META_VERSION && ['weekly', 'restart', 'closure'].includes(value.kind) ? value : null;
  } catch { return null; }
}
function normalizeEvent(raw, calendar, role, groupIndex, zone, groups = []) {
  let meta = metadata(raw.description);
  if (role === 'shared') {
    role = meta?.kind === 'closure' ? 'closure' : 'group';
    groupIndex = role === 'closure' ? null : groups.findIndex(g => g.id === (meta?.group || ''));
    if (role === 'group' && groupIndex < 0) meta = null;
  }
  if ((role === 'closure' && meta?.kind !== 'closure') || (role === 'group' && meta?.kind === 'closure')) meta = null;
  return { ...raw, calendar, role, groupIndex, start: eventTime(raw.start, zone), end: eventTime(raw.end, zone), meta, key: `${calendar}|${raw.uid || raw.summary}|${eventTime(raw.start, zone)}` };
}
function sameGroup(a, b) {
  return a.calendar === b.calendar && (a.group ?? a.meta?.group ?? '') === (b.group ?? b.meta?.group ?? '');
}
function isClosed(events, at) {
  const t = Date.parse(at);
  return events.some(e => e.role === 'closure' && Date.parse(e.start) <= t && t < Date.parse(e.end));
}
function eventStatus(event, events, zone) {
  if (event.role === 'closure') return 'closure';
  if (!event.meta || !['weekly', 'restart'].includes(event.meta.kind)) return 'external';
  if (isClosed(events, event.start)) return 'closed';
  if (event.meta.kind === 'weekly') {
    const cycle = cycleDay(dayOf(event.start, zone));
    const replaced = events.some(e => sameGroup(e, event) && e.meta?.kind === 'restart' && replacesWeekly(e, event) && cycleDay(dayOf(e.start, zone)) === cycle);
    if (replaced) return 'replaced';
  }
  return 'planned';
}
function validateConfig(input) {
  const config = { title: 'Planning', demo: !input.calendar, calendar: '', ...input };
  if (config.title === 'Planning de chauffe') config.title = 'Planning';
  config.groups = (input.groups || DEFAULT_GROUPS).map(g => ({ name: String(g.name || '').trim(), calendar: g.calendar || '' }));
  if (input.devices !== undefined && !Array.isArray(input.devices)) throw new Error('La liste des appareils est invalide.');
  config.devices = (input.devices || []).map(d => ({ ...d, id: String(d.id || '').trim(), name: String(d.name || '').trim() }));
  config.appearance = normalizeAppearance(input.appearance);
  if (config.execution_automation && (!/^automation\.[a-z0-9_]+$/.test(config.execution_automation) || !config.calendar)) throw new Error('Choisissez un calendrier unique et une automatisation de gestion des appareils.');
  if (config.devices.some(d => !/^[a-z0-9_]+$/.test(d.id) || !d.name)) throw new Error('Chaque appareil doit avoir un nom et un identifiant (lettres minuscules, chiffres, _).');
  if (new Set(config.devices.map(d => d.id)).size !== config.devices.length) throw new Error('Les identifiants des appareils doivent être distincts.');
  if (config.groups.length > 8) throw new Error('Configurez au maximum 8 groupes.');
  if (!config.demo) {
    const ids = (config.calendar ? [config.calendar] : [config.closure_calendar, ...config.groups.map(g => g.calendar)]).filter(Boolean);
    if (ids.some(x => typeof x !== 'string' || !/^calendar\.[a-z0-9_]+$/.test(x))) throw new Error('Choisissez des entités de type calendrier.');
    if (new Set(ids).size !== ids.length) throw new Error('Chaque groupe et les fermetures doivent utiliser des calendriers distincts.');
  }
  if (config.calendar) {
    const names = config.groups.map(g => g.name.trim()).filter(Boolean);
    if (new Set(names).size !== names.length) throw new Error('Les groupes doivent avoir des noms distincts.');
  }
  return config;
}
function resolveGroups(config, calendarLabel = '') {
  if (!config.calendar) return config.groups.map(g => ({ ...g, id: '' }));
  const named = config.groups.filter(g => g.name.trim());
  if (!named.length) return [{ name: calendarLabel || 'Calendrier', calendar: config.calendar, id: '' }];
  return named.map(g => ({ ...g, calendar: config.calendar, id: g.name }));
}
function validateDraft(draft, events, zone, now = Date.now(), demo = false, devices) {
  const start = Date.parse(draft.start), end = Date.parse(draft.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'La fin doit être après le début.';
  if (draft.kind === 'closure') return draft.summary?.trim() ? '' : 'Donnez un libellé à la période d’exclusion.';
  if (!demo && start < now + MIN_LEAD_MINUTES * 60000) return `Programmez le démarrage au moins ${MIN_LEAD_MINUTES} minutes à l’avance.`;
  if (isClosed(events, draft.start) && draft.kind === 'restart') return 'Cette programmation se trouve pendant une exclusion. Modifiez la date ou l’exclusion.';
  if (draft.color && !/^#[0-9a-f]{6}$/i.test(draft.color)) return 'Choisissez une couleur valide.';
  if (draft.devices !== undefined && (!Array.isArray(draft.devices) || !draft.devices.length || draft.devices.some(id => typeof id !== 'string' || !/^[a-z0-9_]+$/.test(id)) || new Set(draft.devices).size !== draft.devices.length)) return 'Sélectionnez au moins un appareil valide.';
  if (devices && draft.devices?.some(id => !devices.some(device => device.id === id && device.enabled !== false))) return 'Un appareil sélectionné est désactivé ou retiré. Modifiez la sélection.';
  const conflict = events.some(e => {
    if (e.uid === draft.uid || e.calendar !== draft.calendar || !e.meta || !['weekly', 'restart'].includes(e.meta.kind)) return false;
    const draftMeta = { id: draft.event_id, replace_series: draft.replace_series, replace: draft.replace, devices: draft.devices };
    if (sameGroup(e, draft) && (draft.kind === 'restart' && e.meta.kind === 'weekly' && replacesWeekly({start:draft.start, meta:draftMeta}, e)
        || draft.kind === 'weekly' && e.meta.kind === 'restart' && replacesWeekly(e, {start:draft.start, meta:draftMeta}))) return false;
    const sameSlot = draft.kind === 'weekly' && e.meta.kind === 'weekly'
      ? weekday(dayOf(e.start, zone)) === weekday(dayOf(draft.start, zone)) && localMinute(e.start, zone).slice(11) === localMinute(draft.start, zone).slice(11)
      : e.start === draft.start;
    return sameSlot && (Array.isArray(draft.devices) && Array.isArray(e.meta.devices) ? draft.devices.some(id => e.meta.devices.includes(id)) : sameGroup(e, draft));
  });
  if (conflict) return 'Une programmation existe déjà à cette heure pour ces appareils ou ce groupe.';
  return '';
}
function calendarPayload(draft) {
  const event = { dtstart: draft.start, dtend: draft.end, summary: draft.summary.trim(), description: JSON.stringify({ planning_chauffe: META_VERSION, kind: draft.kind, group: draft.kind === 'closure' ? undefined : draft.group, id: draft.event_id, color: draft.color ? eventColor(draft.color) : undefined, devices: draft.kind === 'closure' ? undefined : draft.devices, replace_series: draft.kind === 'restart' ? draft.replace_series || undefined : undefined, replace: draft.kind === 'restart' && draft.replace === true, note: draft.note || '' }) };
  if (draft.kind === 'weekly') event.rrule = draft.rrule;
  return { type: `calendar/event/${draft.uid ? 'update' : 'create'}`, entity_id: draft.calendar, ...(draft.uid ? { uid: draft.uid } : {}), event };
}
function deletionPayload(event) { return { type: 'calendar/event/delete', entity_id: event.calendar, uid: event.uid }; }
function nextWeekly(day, time, zone, now = Date.now()) {
  let date = dayOf(now + MIN_LEAD_MINUTES * 60000, zone);
  date = shiftDay(date, (Number(day) - weekday(date) + 7) % 7);
  let instant = toInstant(`${date}T${time}`, zone);
  if (Date.parse(instant) < now + MIN_LEAD_MINUTES * 60000) instant = toInstant(`${shiftDay(date, 7)}T${time}`, zone);
  return instant;
}
function viewRange(month, firstDay = 1) {
  const first = `${month}-01`, offset = (weekday(first) - firstDay + 7) % 7, start = shiftDay(first, -offset);
  const d = new Date(`${first}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const days = Math.round((Date.parse(d.toISOString().slice(0, 10)) - Date.parse(first)) / 86400000);
  const count = Math.ceil((offset + days) / 7) * 7;
  return { start, end: shiftDay(start, count), count, queryStart: shiftDay(start, -7), queryEnd: shiftDay(start, count + 7) };
}
function emptyLocalState(zone, now = Date.now()) {
  return { events: [], selected: dayOf(now, zone) };
}

const DEVICE_REGISTRY_START = '2000-01-01T00:00:00.000Z';
const DEVICE_REGISTRY_END = '2000-01-02T00:00:00.000Z';
const DEVICE_TYPES = { switch: 'Interrupteur / relais', script: 'Script Home Assistant', frech: 'Frech avec contrôle d’entrée' };
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function validateDevice(device) {
  if (!/^[a-z0-9_]+$/.test(device.id || '')) return 'Identifiant d’appareil invalide.';
  if (typeof device.name !== 'string' || !device.name.trim() || device.name.length > 120) return 'Donnez un nom à l’appareil (120 caractères maximum).';
  if (!Object.hasOwn(DEVICE_TYPES, device.type)) return 'Choisissez le type de démarrage.';
  if (typeof device.enabled !== 'boolean') return 'État d’activation invalide.';
  if (device.type !== 'script' && !/^switch\.[a-z0-9_]+$/.test(device.switch_entity || '')) return 'Choisissez un relais Home Assistant.';
  if (device.type !== 'switch' && !/^script\.[a-z0-9_]+$/.test(device.script_entity || '')) return 'Choisissez un script Home Assistant.';
  if (device.type === 'frech' && (!/^binary_sensor\.[a-z0-9_]+$/.test(device.input_entity || '') || !Number.isInteger(device.frech_number) || device.frech_number < 1 || device.frech_number > 21)) return 'Choisissez l’entrée de contrôle et un numéro Frech entre 1 et 21.';
  return '';
}
function deviceRecord(device) {
  const record = { name: device.name.trim(), type: device.type, enabled: device.enabled };
  if (device.type !== 'script') record.switch_entity = device.switch_entity;
  if (device.type !== 'switch') record.script_entity = device.script_entity;
  if (device.type === 'frech') { record.input_entity = device.input_entity; record.frech_number = device.frech_number; }
  return record;
}
function devicesFromAutomation(config, calendar) {
  if (!/(^|\/)planning-devices\.yaml$/.test(config?.use_blueprint?.path || '')) throw new Error('Choisissez une automatisation créée avec le blueprint Planning — appareils configurables.');
  const input = config.use_blueprint.input || {};
  if (input.planning_calendar !== calendar) throw new Error('La carte et l’automatisation doivent utiliser le même calendrier.');
  const catalog = input.machine_catalog || {};
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) throw new Error('Le catalogue de l’automatisation est invalide.');
  return Object.entries(catalog).map(([id, record]) => {
    const device = { ...record, id, name: String(record?.name || id), enabled: record?.enabled === undefined ? true : record.enabled };
    const issue = validateDevice(device);
    if (issue) throw new Error(`${device.name} : ${issue}`);
    return device;
  });
}
function publicDevices(devices) { return devices.map(d => ({ id: d.id, name: d.name, enabled: d.enabled, type: d.type })); }
function registryMetadata(row, automation) {
  try {
    const meta = JSON.parse(row.description || 'null');
    if (meta?.planning_devices !== 1 || meta.automation !== automation || !Array.isArray(meta.devices)) return null;
    if (meta.devices.some(d => !d || !/^[a-z0-9_]+$/.test(d.id || '') || typeof d.name !== 'string' || !d.name.trim() || typeof d.enabled !== 'boolean') || new Set(meta.devices.map(d => d.id)).size !== meta.devices.length) return null;
    return {planning_devices:1,automation,devices:publicDevices(meta.devices)};
  } catch { return null; }
}
function deviceRegistryPayload(calendar, automation, devices, uid) {
  return { type: `calendar/event/${uid ? 'update' : 'create'}`, entity_id: calendar, ...(uid ? { uid } : {}), event: {
    dtstart: DEVICE_REGISTRY_START, dtend: DEVICE_REGISTRY_END, summary: 'Planning — liste des appareils',
    description: JSON.stringify({ planning_devices: 1, automation, devices: publicDevices(devices) }),
  } };
}

// The automation configuration is the authoritative catalogue. HA restricts its
// GET/POST endpoints to administrators. The calendar stores labels only, so
// ordinary users can pick devices without access to technical configuration.
class PlanningDeviceStore {
  constructor(getHass, calendar, automation) { this.getHass = getHass; this.calendar = calendar; this.automation = automation; }
  async registryRows() {
    const query = new URLSearchParams({ start: DEVICE_REGISTRY_START, end: DEVICE_REGISTRY_END });
    const rows = await this.getHass().callApi('GET', `calendars/${this.calendar}?${query}`);
    if (!Array.isArray(rows)) throw new Error('Lecture de la liste des appareils impossible.');
    return rows.filter(row => registryMetadata(row, this.automation));
  }
  configPath() {
    const id = this.getHass().states[this.automation]?.attributes?.id;
    if (!id) throw new Error('Cette automatisation ne possède pas de configuration éditable.');
    return `config/automation/config/${encodeURIComponent(id)}`;
  }
  assertAdminIdle() {
    const hass = this.getHass();
    if (hass.user?.is_admin !== true) throw new Error('La configuration technique est réservée aux administrateurs Home Assistant.');
    const automation = hass.states[this.automation];
    if (!automation || !['on','off'].includes(automation.state)) throw new Error('Automatisation indisponible.');
    if (Number(automation.attributes.current || 0) > 0) throw new Error('Une séquence est en cours. Attendez sa fin pour modifier les appareils.');
  }
  async load() {
    if (this.getHass().user?.is_admin === true) {
      const [config, rows] = await Promise.all([this.getHass().callApi('GET', this.configPath()), this.registryRows()]);
      const devices = devicesFromAutomation(config, this.calendar);
      const expected = stableJson(publicDevices(devices));
      return { config, devices, fingerprint: stableJson(config), needsPublish: !rows.length || rows.some(row => stableJson(registryMetadata(row, this.automation).devices) !== expected) };
    }
    const rows = await this.registryRows();
    const lists = rows.map(row => registryMetadata(row, this.automation).devices);
    if (lists.some(list => stableJson(list) !== stableJson(lists[0]))) throw new Error('La liste partagée des appareils doit être republiée par un administrateur.');
    return { devices: lists[0] || [], needsPublish: !rows.length };
  }
  async publish(devices) {
    this.assertAdminIdle();
    const rows = await this.registryRows();
    const primary = rows[0];
    const expected = stableJson(publicDevices(devices));
    if (!primary || stableJson(registryMetadata(primary, this.automation).devices) !== expected) {
      try { await this.getHass().callWS(deviceRegistryPayload(this.calendar, this.automation, devices, primary?.uid)); }
      catch (error) {
        const fresh = await this.registryRows();
        if (!fresh.some(row => stableJson(registryMetadata(row, this.automation).devices) === expected)) throw error;
      }
    }
    // Repair duplicate display records after simultaneous publications. These
    // records never contain execution entities or parameters.
    for (const duplicate of rows.slice(1)) await this.getHass().callWS({type:'calendar/event/delete',entity_id:this.calendar,uid:duplicate.uid});
  }
  async save(snapshot, devices) {
    this.assertAdminIdle();
    for (const device of devices) { const issue = validateDevice(device); if (issue) throw new Error(issue); }
    if (new Set(devices.map(d => d.id)).size !== devices.length) throw new Error('Les identifiants doivent être distincts.');
    const current = await this.getHass().callApi('GET', this.configPath());
    devicesFromAutomation(current, this.calendar);
    if (stableJson(current) !== snapshot.fingerprint) throw new Error('La configuration a changé depuis son ouverture. Actualisez avant de recommencer.');
    const updated = JSON.parse(JSON.stringify(current));
    updated.use_blueprint.input.machine_catalog = Object.fromEntries(devices.map(device => [device.id, deviceRecord(device)]));
    this.assertAdminIdle();
    try { await this.getHass().callApi('POST', this.configPath(), updated); }
    catch (error) {
      const recovered = await this.getHass().callApi('GET', this.configPath());
      if (stableJson(recovered) !== stableJson(updated)) throw error;
    }
    const confirmed = await this.getHass().callApi('GET', this.configPath());
    if (stableJson(confirmed) !== stableJson(updated)) throw new Error('La sauvegarde de l’automatisation n’a pas pu être confirmée. Actualisez la carte.');
    const result = { config: confirmed, devices: devicesFromAutomation(confirmed, this.calendar), fingerprint: stableJson(confirmed), needsPublish: false };
    try { await this.publish(result.devices); }
    catch { result.needsPublish = true; }
    return result;
  }
}

const DEFAULT_APPEARANCE = { default_view: 'month', first_day: 1, time_format: '24', density: 'compact', event_style: 'filled', show_weekends: true, show_device_names: true, accent_color: '' };
function normalizeAppearance(input = {}) {
  const options = { ...DEFAULT_APPEARANCE, ...input };
  for (const [key, choices] of Object.entries({default_view:['month','week','agenda'],first_day:[0,1],time_format:['12','24'],density:['compact','comfortable'],event_style:['filled','outline','dot']})) {
    if (!choices.includes(options[key])) throw new Error(`Réglage d’affichage invalide : ${key}.`);
  }
  for (const key of ['show_weekends','show_device_names']) if (typeof options[key] !== 'boolean') throw new Error(`Réglage d’affichage invalide : ${key}.`);
  if (options.accent_color && !/^#[0-9a-f]{6}$/i.test(options.accent_color)) throw new Error('Couleur d’accent invalide.');
  return options;
}
function visibleWeekdays(firstDay = 1, weekends = true) {
  return Array.from({length:7}, (_, i) => (i + firstDay) % 7).filter(day => weekends || (day !== 0 && day !== 6));
}

const PlanningCalendarViews = {
  _calendarDisplayHtml() {
    const controls = `<div class="ha-calendar-views" aria-label="Affichage du calendrier">${Object.entries({month:'Mois',week:'Semaine',agenda:'Agenda'}).map(([id,label]) => `<button type="button" class="ha-textbutton" data-calendar-view="${id}" aria-pressed="${this._calendarView === id}">${label}</button>`).join('')}${this._button('Aujourd’hui','today',true)}</div>`;
    return controls + (this._calendarView === 'week' ? this._weekHtml() : this._calendarView === 'agenda' ? this._agendaHtml() : this._calendarHtml());
  },
  _viewNavigationHtml(title) {
    return `<div class="ha-monthbar"><h2>${esc(title)}</h2><div class="ha-monthnav"><button type="button" class="ha-iconbutton" data-action="refresh" aria-label="Actualiser">↻</button><button type="button" class="ha-iconbutton" data-action="prev-month" aria-label="Période précédente">‹</button><button type="button" class="ha-iconbutton" data-action="next-month" aria-label="Période suivante">›</button></div></div>`;
  },
  _eventViewHtml(event) {
    const status = this._status(event), day = dayOf(event.start,this._zone);
    return `<button type="button" class="ha-view-event ${status !== 'planned' ? 'cancelled' : ''}" data-day="${day}" ${this._colorStyle(event)} aria-label="${esc(`${this._name(event)}, ${this._timeLabel(event.start)}, ${this._statusText(event)}`)}"><span class="ha-view-time">${esc(this._timeLabel(event.start))}</span><strong>${esc(this._name(event))}</strong><span class="ha-secondary">${esc(this._statusText(event))}</span>${this._config.appearance.show_device_names && event.meta?.devices ? `<span>${esc(this._deviceNames(event.meta.devices))}</span>` : ''}</button>`;
  },
  _dayEvents(day) { return this._events.filter(e => e.role === 'group' && dayOf(e.start,this._zone) === day).sort((a,b) => a.start.localeCompare(b.start)); },
  _dayExcluded(day) {
    const from = toInstant(`${day}T00:00`,this._zone), to = toInstant(`${shiftDay(day,1)}T00:00`,this._zone);
    return this._events.some(e => e.role === 'closure' && e.start < to && e.end > from);
  },
  _weekHtml() {
    const first = shiftDay(this._selected,-((weekday(this._selected)-this._config.appearance.first_day+7)%7));
    const format = day => new Intl.DateTimeFormat('fr-BE',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${day}T12:00:00Z`));
    return this._viewNavigationHtml(`${format(first)} – ${format(shiftDay(first,6))}`) + `<div class="ha-weekgrid">${visibleWeekdays(this._config.appearance.first_day,this._config.appearance.show_weekends).map(w => {
      const day = shiftDay(first,(w-this._config.appearance.first_day+7)%7), events = this._dayEvents(day), excluded = this._dayExcluded(day);
      return `<section class="ha-weekday ${day === this._selected ? 'selected' : ''}"><button type="button" class="ha-weekday-label" data-day="${day}" aria-pressed="${day === this._selected}">${esc(this._dayLabel(day))}</button>${excluded ? '<span class="ha-badge cancelled">Exclusion</span>' : ''}${events.map(e => this._eventViewHtml(e)).join('')}${!events.length ? '<p class="ha-empty">Aucune programmation</p>' : ''}</section>`;
    }).join('')}</div>`;
  },
  _agendaHtml() {
    const title = new Intl.DateTimeFormat('fr-BE',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${this._month}-01T12:00:00Z`));
    const days = [...new Set(this._events.filter(e => e.role === 'group' && dayOf(e.start,this._zone).startsWith(this._month)).map(e => dayOf(e.start,this._zone)))].sort().filter(day => this._config.appearance.show_weekends || ![0,6].includes(weekday(day)));
    return this._viewNavigationHtml(title) + `<div class="ha-agenda">${!days.length ? '<p class="ha-empty">Aucune programmation sur cette période.</p>' : days.map(day => `<section class="ha-agenda-day"><h3>${esc(this._dayLabel(day))}</h3>${this._dayExcluded(day) ? '<span class="ha-badge cancelled">Exclusion</span>' : ''}${this._dayEvents(day).map(e => this._eventViewHtml(e)).join('')}</section>`).join('')}</div>`;
  },
};





const ACTION_TYPES = {
  switch: {label:'Interrupteur', operations:{on:'Allumer',off:'Éteindre'}},
  light: {label:'Éclairage', operations:{on:'Allumer',off:'Éteindre'}},
  input_boolean: {label:'Commande', operations:{on:'Activer',off:'Désactiver'}},
  cover: {label:'Barrière / volet', operations:{open:'Ouvrir',close:'Fermer',stop:'Arrêter'}},
  script: {label:'Script', operations:{run:'Lancer le script'}},
  scene: {label:'Scène', operations:{run:'Activer la scène'}},
  button: {label:'Bouton', operations:{press:'Appuyer'}},
  input_button: {label:'Bouton', operations:{press:'Appuyer'}},
  frech: {label:'Frech', operations:{start:'Démarrer avec contrôle',off:'Éteindre'}},
};
// UI fixes reuse the already published, unchanged execution blueprint.
const ACTION_BLUEPRINT_VERSION='0.6.0';
function selectedPlanningEntities(input=[]){
  if(!Array.isArray(input) || input.length>200)throw new Error('La sélection doit contenir au maximum 200 entités.');
  for(const entity of input)if(typeof entity!=='string' || !/^[a-z_]+\.[a-z0-9_]+$/.test(entity) || ![...Object.keys(ACTION_TYPES).filter(t=>t!=='frech'),'binary_sensor'].includes(entity.split('.')[0]))throw new Error('Un appareil sélectionné est incompatible.');
  return [...new Set(input)];
}
function targetEntity(record) { return record.entity_id || record.switch_entity || record.script_entity || ''; }
function operationsFor(record) { return ACTION_TYPES[record?.type]?.operations || {}; }
function defaultOperation(record) { return Object.keys(operationsFor(record))[0] || ''; }
function oppositeOperation(op) { return ({on:'off',off:'on',open:'close',close:'open',start:'off'})[op] || ''; }
function simpleActionRecord(entity, name) {
  const type=entity.split('.')[0];
  if (!Object.hasOwn(ACTION_TYPES,type) || type === 'frech' || !/^[a-z_]+\.[a-z0-9_]+$/.test(entity)) throw new Error('Choisissez une entité compatible.');
  return {id:`entity_${entity.replace('.','_')}`,name:name || entity,type,entity_id:entity,enabled:true};
}
function validateActionRecord(record) {
  if (!record || !/^[a-z0-9_]+$/.test(record.id || '') || typeof record.name !== 'string' || !record.name.trim() || record.name.length>120 || typeof record.enabled !== 'boolean' || !Object.hasOwn(ACTION_TYPES,record.type)) return 'Action autorisée invalide.';
  if (record.type === 'frech') {
    if (!/^switch\.[a-z0-9_]+$/.test(record.switch_entity || '') || !/^script\.[a-z0-9_]+$/.test(record.script_entity || '') || !/^binary_sensor\.[a-z0-9_]+$/.test(record.input_entity || '') || !Number.isInteger(record.frech_number) || record.frech_number<1 || record.frech_number>21) return 'Configuration du démarrage Frech incomplète.';
  } else if (!new RegExp(`^${record.type}\\.[a-z0-9_]+$`).test(targetEntity(record))) return 'L’entité ne correspond pas au type d’action.';
  return '';
}
function normalizePlanningConfig(input) {
  const config={title:'Planning',calendar:'',language:'auto',demo:!input.calendar,...input,entities:selectedPlanningEntities(input.entities),appearance:normalizeAppearance(input.appearance)};
  planningLanguage(config.language);
  if(config.calendar && !/^calendar\.[a-z0-9_]+$/.test(config.calendar)) throw new Error('Choisissez un calendrier Home Assistant.');
  if(config.execution_automation && !/^automation\.[a-z0-9_]+$/.test(config.execution_automation)) throw new Error('Automatisation invalide.');
  delete config.groups; delete config.closure_calendar; delete config.devices;
  return config;
}
function scheduleMetadata(description) {
  try {
    const m=JSON.parse(description || 'null');
    if(m?.planning !== 2 || m.kind !== 'schedule' || typeof m.id !== 'string' || typeof m.has_end !== 'boolean') return null;
    const valid=list=>Array.isArray(list) && list.length<=50 && new Set(list.map(a=>a?.target)).size===list.length && list.every(a=>a && /^[a-z0-9_]+$/.test(a.target || '') && ['on','off','open','close','stop','run','press','start'].includes(a.op));
    if(!valid(m.start_actions) || !m.start_actions.length || !valid(m.end_actions) || (m.has_end !== (m.end_actions.length>0))) return null;
    return m;
  } catch {return null;}
}
function normalizeSchedule(raw,calendar,zone) {
  const meta=scheduleMetadata(raw.description), legacy=meta ? null : metadata(raw.description);
  const start=eventTime(raw.start,zone),end=eventTime(raw.end,zone);
  return {...raw,calendar,start,end,meta,legacy,role:meta?'schedule':legacy?.kind==='closure'?'legacy-closure':legacy?'legacy':'external',key:`${calendar}|${raw.uid || raw.summary}|${raw.recurrence_id || start}`};
}
function recurring(event) {return !!(event.rrule || event.recurrence_id || event.series_id);}
function sameOccurrence(a,b) {return a.calendar===b.calendar && a.uid===b.uid && (a.recurrence_id || '')===(b.recurrence_id || '');}
function occurrenceSelector(event,scope='occurrence') {
  if(!['occurrence','series'].includes(scope))throw new Error('Portée de modification invalide.');
  if(!event.uid) throw new Error('Cet événement ne possède pas d’identifiant modifiable.');
  if(scope==='occurrence' && (event.rrule || event.recurrence_id)) {
    if(typeof event.recurrence_id !== 'string' || !event.recurrence_id) throw new Error('Ce calendrier ne fournit pas l’identifiant de cette occurrence. La série n’a pas été modifiée.');
    return {uid:event.uid,recurrence_id:event.recurrence_id};
  }
  return {uid:event.uid};
}
function schedulePayload(draft) {
  const event={dtstart:draft.start,dtend:draft.end,summary:draft.summary.trim(),description:JSON.stringify({planning:2,kind:'schedule',id:draft.event_id || newEventId(),color:eventColor(draft.color),has_end:!!draft.has_end,start_actions:draft.start_actions,end_actions:draft.has_end?draft.end_actions:[],note:draft.note || ''})};
  if(!draft.uid && draft.rrule)event.description=JSON.stringify({...JSON.parse(event.description),series_origin:{dtstart:draft.start,dtend:draft.end,rrule:draft.rrule}});
  if(draft.rrule && (!draft.uid || draft.scope==='series')) event.rrule=draft.rrule;
  if(draft.uid && draft.scope==='series')return preservingSeriesPayload(draft,event,draft.series_revision);
  return {type:`calendar/event/${draft.uid?'update':'create'}`,entity_id:draft.calendar,...(draft.uid?occurrenceSelector(draft,draft.scope):{}),event};
}
function preservingSeriesPayload(original,event,revision){if(!revision)throw new Error('La série doit être relue avant sa modification.');return {type:'planning-series-update',entity_id:original.calendar,...occurrenceSelector(original,'series'),expected_revision:revision,event};}
function occurrenceDeletePayload(event,scope='occurrence') {return {type:'calendar/event/delete',entity_id:event.calendar,...occurrenceSelector(event,scope)};}
function calendarEditPayload(original,changes,scope='occurrence'){
  const event={dtstart:changes.start,dtend:changes.end,summary:changes.summary ?? original.summary,description:changes.description ?? original.description ?? ''};
  if(typeof original.location==='string')event.location=original.location;
  if(scope==='series'){const rule=changes.rrule || original.rrule;if(!rule)throw new Error('Règle de répétition indisponible. Ouvrez une occurrence habituelle.');event.rrule=rule;}
  if(scope==='series')return preservingSeriesPayload(original,event,changes.series_revision);
  return {type:'calendar/event/update',entity_id:original.calendar,...occurrenceSelector(original,scope),event};
}
function seriesRule(event,events=[]){return event.series_rule || event.rrule || events.find(e=>e.calendar===event.calendar && e.uid===event.uid && e.rrule)?.rrule || '';}
function ruleDays(rule,fallback=1){const days=rule?.match(/(?:^|;)BYDAY=([^;]+)/i)?.[1];return days?days.split(',').map(value=>['SU','MO','TU','WE','TH','FR','SA'].indexOf(value.replace(/^[+-]?\d+/,''))).filter(value=>value>=0):[fallback];}
function editedWeeklyRule(rule,days){
  if(!/(?:^|;)FREQ=WEEKLY(?:;|$)/i.test(rule))return rule;
  if(!days.length)throw new Error('Choisissez au moins un jour de répétition.');
  const value=[...new Set(days)].sort((a,b)=>(a+6)%7-(b+6)%7).map(i=>['SU','MO','TU','WE','TH','FR','SA'][i]).join(',');
  return /(?:^|;)BYDAY=/i.test(rule)?rule.replace(/(^|;)BYDAY=[^;]+/i,`$1BYDAY=${value}`):`${rule};BYDAY=${value}`;
}
function wallDuration(event,zone) {return (Date.parse(`${localMinute(event.end,zone)}:00Z`)-Date.parse(`${localMinute(event.start,zone)}:00Z`))/60000;}
function shiftedOccurrence(event,date,minute,zone) {
  const startWall=`${date}T${minute===undefined?localMinute(event.start,zone).slice(11):`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`}`;
  const duration=wallDuration(event,zone),endWall=new Date(Date.parse(`${startWall}:00Z`)+duration*60000).toISOString().slice(0,16);
  return {start:toInstant(startWall,zone),end:toInstant(endWall,zone)};
}
function activeSlot(event,now=Date.now()) {return !!event.meta?.has_end && Date.parse(event.start)<=now && now<Date.parse(event.end);}
function mutationIssue(event,scope,events,now=Date.now()) {
  if((scope==='series'?events.filter(e=>e.uid===event.uid && e.calendar===event.calendar):[event]).some(e=>activeSlot(e,now))) return 'Ce créneau est en cours. Son action de fin est conservée ; modifiez une occurrence future.';
  return '';
}
function validateSchedule(draft,records,now=Date.now(),demo=false) {
  if(!Number.isFinite(Date.parse(draft.start)) || !Number.isFinite(Date.parse(draft.end)) || Date.parse(draft.end)<=Date.parse(draft.start)) return 'La fin doit être après le début.';
  if(!demo && Date.parse(draft.start)<now+MIN_LEAD_MINUTES*60000) return `Prévoyez au moins ${MIN_LEAD_MINUTES} minutes avant le début.`;
  if(!draft.start_actions?.length) return 'Ajoutez au moins une action au début.';
  if(draft.has_end && !draft.end_actions?.length) return 'Choisissez l’action à exécuter à la fin.';
  for(const list of [draft.start_actions,draft.has_end?draft.end_actions:[]])if(list.length>50 || new Set(list.map(a=>a.target)).size!==list.length)return 'Choisissez une seule action par appareil à chaque étape (50 maximum).';
  for(const list of [draft.start_actions,draft.has_end?draft.end_actions:[]]) for(const a of list) {
    const record=records.find(r=>r.id===a.target);
    if(!record || record.enabled===false || !Object.hasOwn(operationsFor(record),a.op)) return 'Une action est absente, désactivée ou incompatible. Vérifiez la sélection.';
  }
  return '';
}
function weeklyStart(date,time,days,zone,now=Date.now(),demo=false) {
  if(!days.length) throw new Error('Choisissez au moins un jour de répétition.');
  for(let offset=0;offset<14;offset++) {
    const day=shiftDay(date,offset);
    if(days.includes(weekday(day))) {const instant=toInstant(`${day}T${time}`,zone);if(demo || Date.parse(instant)>=now+MIN_LEAD_MINUTES*60000) return instant;}
  }
  throw new Error('Choisissez une date de début future.');
}
function scheduleFingerprint(event) {return JSON.stringify([event.summary,event.description || '',event.start,event.end,event.rrule || '',event.recurrence_id || '']);}
function matchesSavedSchedule(event,draft) {
  const payload=schedulePayload(draft).event;
  return event.uid===draft.uid && event.start===draft.start && event.end===draft.end && event.summary===payload.summary && JSON.stringify(scheduleMetadata(event.description))===JSON.stringify(scheduleMetadata(payload.description));
}
function packWeekEvents(events,zone,pixelsPerHour=48) {
  const placed=[];
  for(const event of [...events].sort((a,b)=>a.start.localeCompare(b.start))) {
    const time=localMinute(event.start,zone).slice(11),minute=Number(time.slice(0,2))*60+Number(time.slice(3));
    const end=Math.max(minute+35*60/pixelsPerHour,minute+(event.meta?.has_end?Math.max(5,wallDuration(event,zone)):5));
    let lane=0;while(placed.some(p=>p.lane===lane && p.minute<end && minute<p.visualEnd))lane++;
    placed.push({event,minute,visualEnd:Math.min(1440,end),lane});
  }
  const count=Math.max(1,...placed.map(p=>p.lane+1));return placed.map(p=>({...p,lanes:count}));
}




function actionCatalog(config,calendar) {
  if(!/(^|\/)planning-actions\.yaml$/.test(config?.use_blueprint?.path || '') || config.use_blueprint.input?.planning_calendar!==calendar) throw new Error('Choisissez l’exécution Planning de ce calendrier.');
  const raw=config.use_blueprint.input.action_catalog || {};
  if(typeof raw!=='object' || Array.isArray(raw)) throw new Error('La liste des actions autorisées est invalide.');
  return Object.entries(raw).map(([id,r])=>{const record={...r,id,name:r.name || id,enabled:r.enabled===undefined?true:r.enabled};const issue=validateActionRecord(record);if(issue)throw new Error(issue);return record;});
}
function publicActionCatalog(records) {return records.map(r=>({id:r.id,name:r.name,type:r.type,entity_id:targetEntity(r),enabled:r.enabled}));}
function importedActionCatalog(config,calendar){
  if(!/(^|\/)planning-(devices|frech)\.yaml$/.test(config?.use_blueprint?.path || '') || config.use_blueprint.input?.planning_calendar!==calendar)return [];
  return Object.entries(config.use_blueprint.input.machine_catalog || {}).map(([id,r])=>{
    const type=r.type || 'frech',record={...r,id,type,name:r.name || `Frech ${r.frech_number || id}`,enabled:r.enabled!==false};
    if(type==='switch')record.entity_id=r.switch_entity;if(type==='script')record.entity_id=r.script_entity;
    if(type==='frech' && !record.script_entity)record.script_entity=config.use_blueprint.input.startup_script;
    const issue=validateActionRecord(record);if(issue)throw new Error(issue);return record;
  });
}
function actionRegistry(row) {
  try {
    const m=JSON.parse(row.description || 'null');
    if(m?.planning_actions!==1 || !/^automation\.[a-z0-9_]+$/.test(m.automation || '') || !Array.isArray(m.actions))return null;
    if(m.actions.some(r=>!r || !/^[a-z0-9_]+$/.test(r.id || '') || typeof r.name!=='string' || typeof r.enabled!=='boolean' || !/^[a-z_]+\.[a-z0-9_]+$/.test(r.entity_id || '')))return null;
    return {automation:m.automation,test_mode:m.test_mode!==false,actions:publicActionCatalog(m.actions)};
  }catch{return null;}
}
class PlanningActionStore {
  constructor(getHass,calendar,automation='') {this.getHass=getHass;this.calendar=calendar;this.automation=automation;}
  async registryRows() {
    const q=new URLSearchParams({start:DEVICE_REGISTRY_START,end:DEVICE_REGISTRY_END});
    const rows=await this.getHass().callApi('GET',`calendars/${this.calendar}?${q}`);
    if(!Array.isArray(rows))throw new Error('La configuration du planning est indisponible.');
    return rows.filter(row=>actionRegistry(row));
  }
  configPath() {const id=this.getHass().states[this.automation]?.attributes?.id || (this._createdState?.entity_id===this.automation?this._createdState.attributes.id:null);if(!id)throw new Error('Exécution du planning indisponible.');return `config/automation/config/${encodeURIComponent(id)}`;}
  assertAdminIdle() {
    if(this.getHass().user?.is_admin!==true)throw new Error('Un administrateur doit autoriser cette nouvelle entité une première fois.');
    if(Number(this.getHass().states[this.automation]?.attributes?.current || 0)>0)throw new Error('Une action est en cours. Attendez sa fin pour ajouter une nouvelle entité.');
  }
  async load() {
    const rows=await this.registryRows(), links=[...new Set(rows.map(r=>actionRegistry(r).automation))];
    if(links.length>1)throw new Error('Plusieurs exécutions sont associées à ce calendrier. Vérifiez la configuration.');
    if(links.length)this.automation=links[0];
    if(!this.automation)return {ready:false,records:[],test_mode:true};
    if(this.getHass().user?.is_admin===true) {
      const config=await this.getHass().callApi('GET',this.configPath());
      try {const records=actionCatalog(config,this.calendar),test_mode=config.use_blueprint.input.test_mode!==false;const expected={automation:this.automation,test_mode,actions:publicActionCatalog(records)};return {ready:true,config,records,fingerprint:stableJson(config),test_mode,needsPublish:rows.length!==1 || stableJson(actionRegistry(rows[0]))!==stableJson(expected)};}
      catch(error){if(!links.length)return {ready:false,records:importedActionCatalog(config,this.calendar),test_mode:true,legacy_automation:this.automation};throw error;}
    }
    if(!rows.length)return {ready:false,records:[],test_mode:true};
    const meta=actionRegistry(rows[0]);
    if(rows.some(r=>stableJson(actionRegistry(r))!==stableJson(meta)))throw new Error('Un administrateur doit actualiser la liste des actions autorisées.');
    return {ready:true,records:meta.actions,test_mode:meta.test_mode};
  }
  async publish(snapshot) {
    this.assertAdminIdle();
    const rows=await this.registryRows(), same=rows.filter(r=>actionRegistry(r).automation===this.automation);
    const description=JSON.stringify({planning_actions:1,automation:this.automation,test_mode:snapshot.test_mode,actions:publicActionCatalog(snapshot.records)});
    const payload={type:`calendar/event/${same[0]?'update':'create'}`,entity_id:this.calendar,...(same[0]?{uid:same[0].uid}:{}),event:{dtstart:DEVICE_REGISTRY_START,dtend:DEVICE_REGISTRY_END,summary:'Planning — configuration',description}};
    if(!same[0] || same[0].description!==description) {
      try{await this.getHass().callWS(payload);}catch(error){const fresh=await this.registryRows();if(!fresh.some(r=>r.description===description))throw error;}
    }
    for(const duplicate of same.slice(1))await this.getHass().callWS({type:'calendar/event/delete',entity_id:this.calendar,uid:duplicate.uid});
  }
  async save(snapshot,records) {
    this.assertAdminIdle();for(const r of records){const issue=validateActionRecord(r);if(issue)throw new Error(issue);}
    const current=await this.getHass().callApi('GET',this.configPath());actionCatalog(current,this.calendar);
    if(stableJson(current)!==snapshot.fingerprint)throw new Error('Les actions autorisées ont changé. Actualisez puis vérifiez votre programmation.');
    const updated=JSON.parse(JSON.stringify(current));updated.use_blueprint.input.action_catalog=Object.fromEntries(records.map(({id,...r})=>[id,r]));
    this.assertAdminIdle();
    try{await this.getHass().callApi('POST',this.configPath(),updated);}catch(error){const recovered=await this.getHass().callApi('GET',this.configPath());if(stableJson(recovered)!==stableJson(updated))throw error;}
    const confirmed=await this.getHass().callApi('GET',this.configPath());if(stableJson(confirmed)!==stableJson(updated))throw new Error('La sauvegarde des actions n’a pas pu être confirmée.');
    const result={ready:true,config:confirmed,records:actionCatalog(confirmed,this.calendar),fingerprint:stableJson(confirmed),test_mode:confirmed.use_blueprint.input.test_mode!==false};
    try{await this.publish(result);}catch{result.needsPublish=true;}return result;
  }
  async prepare(snapshot,rows) {
    const fresh=await this.load();if(!fresh.ready)throw new Error('Préparez d’abord l’exécution de ce calendrier dans les réglages de la carte.');
    const records=[...fresh.records], resolved=[];let added=false;
    for(const row of rows) {
      let record=records.find(r=>r.id===row.target);
      if(!record && row.target?.startsWith('entity:')) {
        this.assertAdminIdle();const entity=row.target.slice(7), state=this.getHass().states[entity];if(!state)throw new Error('Cette entité n’est plus disponible.');
        record=records.find(r=>targetEntity(r)===entity);
        if(!record){record=simpleActionRecord(entity,state.attributes?.friendly_name || entity);if(records.some(r=>r.id===record.id))throw new Error('Identifiant d’action déjà utilisé.');records.push(record);added=true;}
      }
      if(!record || record.enabled===false || !Object.hasOwn(operationsFor(record),row.op))throw new Error('Choisissez une action active et compatible.');
      const old=snapshot?.records.find(r=>r.id===record.id);
      if(old && snapshot.config && stableJson(old)!==stableJson(record))throw new Error('Cette action a changé depuis l’ouverture. Actualisez et recommencez.');
      resolved.push({target:record.id,op:row.op});
    }
    const saved=added?await this.save(fresh,records):fresh;return {snapshot:saved,actions:resolved};
  }
  async setup(version,legacyAutomation='') {
    if(!/^calendar\.[a-z0-9_]+$/.test(this.calendar || ''))throw new Error('Choisissez d’abord un calendrier local dans la configuration de la carte.');
    if(this.getHass().user?.is_admin!==true)throw new Error('La préparation du planning nécessite un administrateur Home Assistant.');
    const installed=await this.getHass().callWS({type:'blueprint/list',domain:'automation'});
    let path=Object.keys(installed).find(p=>/(^|\/)planning-actions\.yaml$/.test(p) && installed[p].metadata?.source_url?.startsWith('https://github.com/Euro-Locks-Belgium/ha-planning-card/'));
    if(!path) {
      if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Version de développement : importer manuellement le blueprint planning-actions.yaml pour tester dans Home Assistant.');
      const url=`https://github.com/Euro-Locks-Belgium/ha-planning-card/blob/v${version}/blueprints/planning-actions.yaml`;
      const imported=await this.getHass().callWS({type:'blueprint/import',url});
      if(imported.validation_errors && Object.keys(imported.validation_errors).length)throw new Error('Le blueprint téléchargé n’a pas été validé.');
      if(imported.exists)throw new Error('Un blueprint du même nom existe déjà. Vérifiez-le dans Home Assistant.');
      if(!/^[a-zA-Z0-9/_-]+$/.test(imported.suggested_filename || '') || !imported.suggested_filename.endsWith('planning-actions'))throw new Error('Nom du blueprint inattendu.');
      path=`${imported.suggested_filename}.yaml`;
      await this.getHass().callWS({type:'blueprint/save',domain:'automation',path,yaml:imported.raw_data,source_url:url});
    }
    const id=`planning_actions_${this.calendar.slice(9)}`, endpoint=`config/automation/config/${id}`;
    let config;
    try{config=await this.getHass().callApi('GET',endpoint);actionCatalog(config,this.calendar);}
    catch(error){
      if(![error.status_code,error.status].includes(404))throw error;
      let catalog={};
      if(legacyAutomation && this.getHass().states[legacyAutomation]?.attributes?.id) {
        const old=await this.getHass().callApi('GET',`config/automation/config/${encodeURIComponent(this.getHass().states[legacyAutomation].attributes.id)}`);
        if(/(^|\/)planning-(devices|frech)\.yaml$/.test(old.use_blueprint?.path || '') && old.use_blueprint.input?.planning_calendar===this.calendar) {
          catalog=Object.fromEntries(importedActionCatalog(old,this.calendar).map(({id,...r})=>[id,r]));
        }
      }
      config={id,alias:`Planning — ${this.getHass().states[this.calendar]?.attributes?.friendly_name || this.calendar}`,use_blueprint:{path,input:{planning_calendar:this.calendar,action_catalog:catalog,test_mode:true}}};
      try{await this.getHass().callApi('POST',endpoint,config);}catch(error){const read=await this.getHass().callApi('GET',endpoint);if(stableJson(read)!==stableJson(config))throw error;}
    }
    for(let attempt=0;attempt<8;attempt++) {
      const states=await this.getHass().callWS({type:'get_states'}), state=states.find(s=>s.entity_id.startsWith('automation.') && s.attributes?.id===id);
      if(state){this.automation=state.entity_id;this._createdState=state;const snapshot={ready:true,config,records:actionCatalog(config,this.calendar),fingerprint:stableJson(config),test_mode:config.use_blueprint.input.test_mode!==false};await this.publish(snapshot);return snapshot;}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    throw new Error('L’automatisation est enregistrée. Actualisez la carte lorsque Home Assistant a terminé son chargement.');
  }
}



// RFC 5545 line folding and TEXT escaping. Import only the selected UID; no
// calendar content is uploaded anywhere or turned into arbitrary HA services.
function textValue(value){return value.replace(/\\([nN,;\\])/g,(_,c)=>c==='n'||c==='N'?'\n':c);}
function property(line){let quoted=false,index=-1;for(let i=0;i<line.length;i++){if(line[i]==='"')quoted=!quoted;if(line[i]===':'&&!quoted){index=i;break;}}if(index<0)throw new Error('Fichier ICS invalide.');const [name,...parameters]=line.slice(0,index).split(';'),params=Object.fromEntries(parameters.map(p=>{const at=p.indexOf('=');return [p.slice(0,at).toUpperCase(),p.slice(at+1).replace(/^"|"$/g,'')];}));return {name:name.toUpperCase(),params,value:line.slice(index+1)};}
function instant(value,params,zone){
  if(!/^\d{8}T\d{6}Z?$/.test(value))throw new Error('Seules les séries avec une heure sont prises en charge dans cet import.');
  const wall=`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T${value.slice(9,11)}:${value.slice(11,13)}`;
  if(value.endsWith('Z'))return new Date(wall+':'+value.slice(13,15)+'Z').toISOString();
  return new Date(Date.parse(toInstant(wall,params.TZID || zone))+Number(value.slice(13,15))*1000).toISOString();
}
function importSeriesIcs(source,uid,zone){
  if(typeof source!=='string' || source.length>10_000_000)throw new Error('Fichier ICS invalide ou trop volumineux.');
  const unfolded=source.replace(/^\uFEFF/,'').replace(/\r?\n[ \t]/g,'').trim(),lines=unfolded.split(/\r?\n/);
  if(lines[0]!=='BEGIN:VCALENDAR'||lines.at(-1)!=='END:VCALENDAR'||lines.filter(l=>l==='BEGIN:VCALENDAR').length!==1)throw new Error('Fichier ICS invalide.');
  const events=[];let fields=null,depth=0;
  for(const line of lines){
    if(line==='BEGIN:VEVENT'){if(fields)throw new Error('Fichier ICS invalide.');fields=[];depth=0;continue;}
    if(!fields)continue;
    if(line==='END:VEVENT'){if(depth)throw new Error('Fichier ICS invalide.');events.push(fields);fields=null;continue;}
    if(line.startsWith('BEGIN:')){depth++;continue;}if(line.startsWith('END:')){depth--;continue;}
    if(!depth && line)fields.push(property(line));
  }
  if(fields)throw new Error('Fichier ICS invalide.');
  const matching=events.filter(fields=>textValue(fields.find(p=>p.name==='UID')?.value || '')===uid),masters=matching.filter(fields=>fields.some(p=>p.name==='RRULE')&&!fields.some(p=>p.name==='RECURRENCE-ID'));
  if(masters.length!==1 || matching.some(f=>f.some(p=>p.name==='RDATE'||p.params.RANGE)))throw new Error('Cette série ICS est absente, fractionnée ou incompatible.');
  const master=masters[0],get=(fields,name)=>fields.find(p=>p.name===name),payload=fields=>{
    const start=get(fields,'DTSTART'),end=get(fields,'DTEND');if(!start||!end)throw new Error('La série ICS doit préciser son début et sa fin.');
    return {dtstart:instant(start.value,start.params,zone),dtend:instant(end.value,end.params,zone),summary:textValue(get(fields,'SUMMARY')?.value || ''),description:textValue(get(fields,'DESCRIPTION')?.value || ''),...(get(fields,'LOCATION')?{location:textValue(get(fields,'LOCATION').value)}:{})};
  };
  if(get(master,'STATUS')?.value==='CANCELLED' || /(?:BYHOUR|BYMINUTE|BYSECOND)=|FREQ=(?:HOURLY|MINUTELY|SECONDLY)/i.test(get(master,'RRULE').value))throw new Error('Cette série ICS est absente, fractionnée ou incompatible.');
  const exceptions={};for(const ex of master.filter(p=>p.name==='EXDATE'))for(const value of ex.value.split(','))exceptions[dayOf(instant(value,ex.params,zone),zone)]={deleted:true};
  for(const fields of matching.filter(f=>f!==master)){const recurrence=get(fields,'RECURRENCE-ID');if(!recurrence||get(fields,'RRULE'))throw new Error('Cette série ICS est absente, fractionnée ou incompatible.');const day=dayOf(instant(recurrence.value,recurrence.params,zone),zone);exceptions[day]=get(fields,'STATUS')?.value==='CANCELLED'?{deleted:true}:{event:payload(fields),uid,native:true,recurrence_id:recurrence.value};}
  return {model:{...payload(master),rrule:get(master,'RRULE').value},exceptions};
}




const SERIES_JOURNAL_START='2000-01-03T00:00:00Z',SERIES_JOURNAL_END='2000-01-04T00:00:00Z';
function seriesJournal(row){try{const data=JSON.parse(row.description || 'null');if(data?.planning_series_journal!==1)return null;if(typeof data.id!=='string'||typeof data.master_uid!=='string'||typeof data.model?.rrule!=='string'||(data.complete&&!data.model.rrule)||!data.exceptions||typeof data.exceptions!=='object'||Array.isArray(data.exceptions))throw 0;return {...data,_uid:row.uid,_raw:row.description};}catch{if(row.description?.includes('planning_series_journal'))throw new Error('Le journal des exceptions est invalide. Aucune série modifiée.');return null;}}
function seriesOwner(event,records){return records.find(r=>r.master_uid===event.uid || Object.values(r.exceptions).some(x=>x.uid===event.uid));}
function seriesDay(event,record,zone){const known=Object.entries(record.exceptions).find(([,x])=>x.uid===event.uid && !x.native)?.[0];if(known)return known;const rid=event.recurrence_id,utc=rid?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);if(utc)return dayOf(`${utc[1]}-${utc[2]}-${utc[3]}T${utc[4]}:${utc[5]}:${utc[6]}Z`,zone);return rid?.match(/^\d{8}T/)?`${rid.slice(0,4)}-${rid.slice(4,6)}-${rid.slice(6,8)}`:dayOf(event.start,zone);}
function annotateSeries(events,records){return events.map(event=>{const owner=seriesOwner(event,records);return owner?{...event,series_id:owner.id,series_master_uid:owner.master_uid,series_rule:owner.model.rrule}:event;});}
function sameSeriesEvent(saved,event){return !!saved && Date.parse(saved.start ?? saved.dtstart)===Date.parse(event.dtstart) && Date.parse(saved.end ?? saved.dtend)===Date.parse(event.dtend) && saved.summary===event.summary && (saved.description || '')===(event.description || '') && (!Object.hasOwn(event,'location') || saved.location===event.location);}
function pendingDescription(token,slot){return JSON.stringify({planning_series_pending:token,slot});}
function savedData(record){return Object.fromEntries(Object.entries(record).filter(([key])=>!key.startsWith('_')));}
function liveDescription(description,id){try{const m=JSON.parse(description);return m?.planning===2?JSON.stringify({...m,series_journal:id}):description;}catch{return description;}}

class PlanningSeriesStore {
  constructor(getHass,calendar,zone,getNow=()=>Date.now()){this.getHass=getHass;this.calendar=calendar;this.zone=zone;this.getNow=getNow;}
  async rows(start,end){const query=new URLSearchParams({start,end}),rows=await this.getHass().callApi('GET',`calendars/${this.calendar}?${query}`);if(!Array.isArray(rows))throw new Error('Réponse calendrier invalide.');return rows.map(row=>({...row,start:eventTime(row.start,this.zone),end:eventTime(row.end,this.zone)}));}
  async records(){const records=(await this.rows(SERIES_JOURNAL_START,SERIES_JOURNAL_END)).map(seriesJournal).filter(Boolean);if(new Set(records.map(r=>r.id)).size!==records.length || new Set(records.map(r=>r.master_uid)).size!==records.length)throw new Error('Plusieurs journaux correspondent à cette série. Aucune modification effectuée.');return records;}
  async read(event,events=[]){
    const records=await this.records(),known=seriesOwner(event,records);if(known)return known;
    const origin=event.meta?.series_origin,rule=event.rrule || event.series_rule || events.find(e=>e.uid===event.uid && e.rrule)?.rrule || origin?.rrule || '';
    if(!rule && !event.recurrence_id)throw new Error('Règle de répétition indisponible. Ouvrez une occurrence habituelle.');
    return {planning_series_journal:1,id:newEventId(),master_uid:event.uid,complete:!!origin && !event.meta?.series_journal,model:{dtstart:event.start,dtend:event.end,summary:event.summary,description:event.description || '',rrule:rule,...origin},exceptions:{},pending:null};
  }
  import(record,text){const imported=importSeriesIcs(text,record.master_uid,this.zone);return {...record,model:imported.model,exceptions:{...imported.exceptions,...record.exceptions},complete:true};}
  async assertCurrent(record){if(!record._uid)return;const current=(await this.records()).find(r=>r._uid===record._uid);if(!current || current._raw!==record._raw)throw new Error('La série ou une de ses exceptions a changé. Fermez puis rouvrez la programmation.');}
  async persist(record){
    await this.assertCurrent(record);const description=JSON.stringify(savedData(record));
    const payload={type:`calendar/event/${record._uid?'update':'create'}`,entity_id:this.calendar,...(record._uid?{uid:record._uid}:{}),event:{dtstart:SERIES_JOURNAL_START,dtend:SERIES_JOURNAL_END,summary:'Planning — exceptions',description}};
    let error;try{await this.getHass().callWS(payload);}catch(e){error=e;}
    const confirmed=(await this.records()).filter(r=>r.id===record.id && r._raw===description);if(confirmed.length!==1)throw error || new Error('Le journal des exceptions n’a pas pu être enregistré.');
    record._uid=confirmed[0]._uid;record._raw=description;return record;
  }
  async dayRows(day){return this.rows(toInstant(`${day}T00:00`,this.zone),toInstant(`${shiftDay(day,1)}T00:00`,this.zone));}
  async native(payload){
    if(!['calendar/event/create','calendar/event/update','calendar/event/delete'].includes(payload.type)||payload.entity_id!==this.calendar)throw new Error('Opération de calendrier invalide.');
    try{return await this.getHass().callWS(payload);}catch(error){
      if(payload.type.endsWith('/delete')){if(/no existing item/i.test(error?.message || ''))return;throw error;}
      const event=payload.event,day=dayOf(event.dtstart,this.zone),rows=await this.dayRows(day);
      if(rows.some(row=>(!payload.uid || row.uid===payload.uid) && (!payload.recurrence_id || row.recurrence_id===payload.recurrence_id) && sameSeriesEvent(row,event)))return;
      throw error;
    }
  }
  async guard(record){
    const today=dayOf(this.getNow(),this.zone),ids=new Set([record.master_uid,...Object.values(record.exceptions).map(e=>e.uid).filter(Boolean)]),now=this.getNow();
    for(const row of await this.rows(toInstant(`${shiftDay(today,-1)}T00:00`,this.zone),toInstant(`${shiftDay(today,2)}T00:00`,this.zone))){let m;try{m=JSON.parse(row.description);}catch{}if(ids.has(row.uid)&&m?.has_end&&Date.parse(row.start)<=now&&now<Date.parse(row.end))throw new Error('Ce créneau est en cours. Son action de fin est conservée ; modifiez une occurrence future.');}
  }
  async occurrence(original,payload){
    const record=await this.read(original),day=seriesDay(original,record,this.zone);if(record.pending)throw new Error('Une sauvegarde de série doit d’abord être reprise. Actualisez le calendrier.');
    const entry=payload.type.endsWith('/delete')?{deleted:true}:{event:{...payload.event},uid:original.uid,...(payload.recurrence_id?{native:true,recurrence_id:payload.recurrence_id}:{})};
    record.pending={kind:'occurrence',payload,day,actual_day:dayOf(original.start,this.zone),entry};await this.persist(record);await this.recover(record);return record;
  }
  async update(record,event){
    if(!record.complete)throw new Error('Importez une fois le fichier ICS pour conserver toutes les exceptions de cette ancienne série.');
    if(record.pending)throw new Error('Une sauvegarde de série doit d’abord être reprise. Actualisez le calendrier.');
    if(!Number.isFinite(Date.parse(event.dtstart)) || Date.parse(event.dtstart)<this.getNow()+20*60000)throw new Error('Prévoyez au moins 20 minutes avant le début.');
    await this.guard(record);
    for(const entry of Object.values(record.exceptions))if(entry.event && (!entry.uid || entry.uid===record.master_uid)){const start=Date.parse(entry.event.dtstart);if(start>=this.getNow()-90000 && start<this.getNow()+20*60000)throw new Error('Une exception commence bientôt. Réessayez après son exécution.');}
    const model={...event,description:liveDescription(event.description,record.id)},exceptions=structuredClone(record.exceptions);
    record.pending={kind:'series',token:newEventId(),model,exceptions,old_uid:record.master_uid,new_uid:'',phase:'prepare'};
    await this.persist(record);await this.recover(record);return record;
  }
  async createStaged(record,slot,event){
    const description=pendingDescription(record.pending.token,slot),staged={...event,description};let rows=await this.dayRows(dayOf(event.dtstart,this.zone)),same=rows.find(row=>sameSeriesEvent(row,staged));
    if(!same){await this.native({type:'calendar/event/create',entity_id:this.calendar,event:staged});rows=await this.dayRows(dayOf(event.dtstart,this.zone));same=rows.find(row=>sameSeriesEvent(row,staged));}
    if(!same?.uid)throw new Error('Le nouvel événement n’a pas pu être retrouvé. Actualisez pour reprendre la sauvegarde.');return same.uid;
  }
  async recover(record){
    const plan=record.pending;if(!plan)return record;await this.assertCurrent(record);
    if(!['occurrence','series','delete'].includes(plan.kind))throw new Error('Opération de calendrier invalide.');
    if(plan.kind==='occurrence'){
      const p=plan.payload;
      if(p.type.endsWith('/delete')){const rows=await this.dayRows(plan.actual_day);if(rows.some(row=>row.uid===p.uid && (!p.recurrence_id || row.recurrence_id===p.recurrence_id)))await this.native(p);}
      else await this.native(p);
      record.exceptions[plan.day]=plan.entry;record.pending=null;return this.persist(record);
    }
    if(plan.kind==='delete'){
      for(const uid of plan.uids){await this.assertCurrent(record);await this.native({type:'calendar/event/delete',entity_id:this.calendar,uid});}
      await this.native({type:'calendar/event/delete',entity_id:this.calendar,uid:record._uid});return record;
    }
    if(plan.phase==='prepare'){
      if(!plan.new_uid){plan.new_uid=await this.createStaged(record,'master',plan.model);await this.persist(record);}
      for(const [day,entry] of Object.entries(plan.exceptions))if(entry.event && (!entry.uid || entry.uid===plan.old_uid)){
        entry.uid=await this.createStaged(record,day,entry.event);delete entry.native;delete entry.recurrence_id;entry.staged=true;await this.persist(record);
      }
      for(const day of Object.keys(plan.exceptions)){
        await this.assertCurrent(record);for(const row of await this.dayRows(day))if(row.uid===plan.new_uid && row.recurrence_id)await this.native({type:'calendar/event/delete',entity_id:this.calendar,uid:row.uid,recurrence_id:row.recurrence_id});
      }
      plan.phase='activate';await this.persist(record);
    }
    if(plan.phase==='activate'){
      await this.assertCurrent(record);await this.native({type:'calendar/event/delete',entity_id:this.calendar,uid:plan.old_uid});
      // Only the master belongs to this UID. Its start/rule stay unchanged, so
      // Local Calendar retains the EXDATEs while this description is activated.
      await this.native({type:'calendar/event/update',entity_id:this.calendar,uid:plan.new_uid,event:plan.model});
      for(const entry of Object.values(plan.exceptions))if(entry.staged){await this.assertCurrent(record);await this.native({type:'calendar/event/update',entity_id:this.calendar,uid:entry.uid,event:entry.event});delete entry.staged;}
      record.master_uid=plan.new_uid;record.model=plan.model;record.exceptions=plan.exceptions;record.pending=null;await this.persist(record);
    }
    return record;
  }
  async deleteSeries(original){const record=await this.read(original);if(record.pending)throw new Error('Une sauvegarde de série doit d’abord être reprise. Actualisez le calendrier.');await this.guard(record);record.pending={kind:'delete',uids:[...new Set([record.master_uid,...Object.values(record.exceptions).map(x=>x.uid).filter(Boolean)])]};await this.persist(record);await this.recover(record);}
}




function expandDemoCalendar(rows,start,end,zone){
  const out=[],from=dayOf(start,zone),to=dayOf(end,zone);
  for(const row of rows){
    if(!row.rrule){if(Date.parse(row.start)<Date.parse(end)&&Date.parse(row.end)>Date.parse(start))out.push({...row});continue;}
    const first=dayOf(row.start,zone),names=['SU','MO','TU','WE','TH','FR','SA'],days=(row.rrule.match(/BYDAY=([^;]+)/)?.[1] || names[weekday(first)]).split(',').map(x=>names.indexOf(x)),count=Number(row.rrule.match(/COUNT=(\d+)/)?.[1] || Infinity),interval=Number(row.rrule.match(/INTERVAL=(\d+)/)?.[1] || 1);let seen=0;
    for(let day=first,index=0;day<to && index<50000;day=shiftDay(day,1),index++){
      const eligible=row.rrule.includes('FREQ=DAILY')?index%interval===0:days.includes(weekday(day))&&Math.floor((index+(weekday(first)+6)%7)/7)%interval===0;
      if(!eligible)continue;if(++seen>count)break;const shifted=shiftedOccurrence(row,day,undefined,zone),rid=localMinute(shifted.start,zone).replace(/[-:]/g,'')+'00';if(day<from||row.deleted?.includes(rid)||row.exceptions?.[rid])continue;out.push({...row,...shifted,recurrence_id:rid});
    }
    for(const [rid,event] of Object.entries(row.exceptions || {}))if(Date.parse(event.start)<Date.parse(end)&&Date.parse(event.end)>Date.parse(start))out.push({...row,...event,rrule:'',recurrence_id:rid});
  }
  return out;
}

const BASE_PLANNING_STYLE = `
:host{display:block;font-family:var(--paper-font-body1_-_font-family,Arial,sans-serif);color:var(--primary-text-color,#e7eaef)}*{box-sizing:border-box}ha-card{display:block;background:var(--ha-card-background,var(--card-background-color,#202226));border-radius:var(--ha-card-border-radius,16px);overflow:hidden}main{padding:20px;--accent:var(--primary-color,#31b8de)}h1{font-size:24px;margin:0}h2{font-size:18px;margin:0}h3{font-size:16px;margin:14px 0}p{line-height:1.5}.muted,small{color:var(--secondary-text-color,#aeb7c1)}small{font-size:12px}.toolbar,.row,.tabs,.buttons{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.toolbar{justify-content:space-between;margin-bottom:15px}.tabs{margin:15px 0}.tabs button[aria-pressed=true]{background:var(--accent);color:#071c25}.status{padding:10px 12px;background:var(--secondary-background-color,#292e34);border-radius:9px;font-size:13px;margin:12px 0}.error{border:1px solid #f38181;color:#ffb6b6}.notice{border-left:3px solid var(--accent)}button,input,select,textarea{font:inherit;color:inherit}button{cursor:pointer;border:1px solid var(--divider-color,#424850);background:transparent;border-radius:8px;padding:9px 12px}button:hover{background:var(--secondary-background-color,#30363d)}button.primary{background:var(--accent);color:#07222c;border-color:transparent;font-weight:600}button.danger{color:#ff8585}button:disabled{opacity:.45;cursor:default}input,select,textarea{width:100%;background:var(--secondary-background-color,#292e34);border:1px solid var(--divider-color,#444a52);border-radius:7px;padding:10px;min-width:0}option{background:var(--card-background-color,#202226);color:var(--primary-text-color,#e7eaef)}label{display:flex;flex-direction:column;gap:6px;font-size:14px;min-width:0}.field{margin:15px 0}.check{flex-direction:row;align-items:center}.check input{width:auto}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:15px}.time{display:flex;align-items:center;gap:5px}.time select{width:auto;min-width:68px}.weekdays{display:flex;flex-wrap:wrap;gap:6px}.weekdays label{padding:8px;border:1px solid var(--divider-color,#444);border-radius:7px}.weekdays input{width:auto}form,.panel{margin-top:18px;padding:18px;border:1px solid var(--divider-color,#41474e);border-radius:12px}.action-row{display:grid;grid-template-columns:minmax(130px,1fr) minmax(100px,.65fr) auto;gap:8px;margin:9px 0}.action-row button{padding:6px 10px}.calendar{display:grid;grid-template-columns:repeat(var(--columns,7),minmax(0,1fr));border-top:1px solid var(--divider-color,#3c4148);border-left:1px solid var(--divider-color,#3c4148)}.weekday{text-align:center;padding:9px 0;font-size:12px;font-weight:600}.day{min-height:108px;padding:5px;border-right:1px solid var(--divider-color,#3c4148);border-bottom:1px solid var(--divider-color,#3c4148);min-width:0}.day.outside{opacity:.6}.day.selected{background:color-mix(in srgb,var(--accent) 8%,transparent)}.date{padding:3px 6px;border:0;font-size:12px}.event{display:block;text-align:left;width:100%;padding:6px;margin:4px 0;border:0;border-left:3px solid var(--event);background:var(--event);color:var(--event-text);border-radius:5px;font-size:12px;overflow:hidden;overflow-wrap:anywhere;touch-action:pan-y}.event span,.event strong{display:block}.event[draggable=true]{cursor:grab}.event:active{cursor:grabbing}.event small{color:inherit;opacity:.85}.event.external{background:var(--secondary-background-color,#30343a);color:inherit;border:1px dashed #7f8995}.drop-over{outline:2px solid var(--accent);outline-offset:-2px;background:color-mix(in srgb,var(--accent) 15%,transparent)}.agenda{display:grid;gap:10px}.agenda-item{display:grid;grid-template-columns:130px 1fr;gap:10px;align-items:start}.week-scroll{overflow:auto;max-height:680px;border:1px solid var(--divider-color,#41474e);border-radius:8px}.week{display:grid;grid-template-columns:48px repeat(var(--columns,7),minmax(94px,1fr));min-width:700px}.week-head{position:sticky;top:0;z-index:3;padding:10px 4px;text-align:center;background:var(--card-background-color,#202226);font-size:12px;border-bottom:1px solid #444}.hours,.week-day{height:1152px;position:relative}.hours span{position:absolute;left:5px;font-size:10px;color:var(--secondary-text-color,#aaa)}.week-day{border-left:1px solid var(--divider-color,#41474e);background:repeating-linear-gradient(to bottom,transparent 0,transparent 47px,var(--divider-color,#41474e) 47px,var(--divider-color,#41474e) 48px)}.week-day .event{position:absolute;margin:0;min-height:32px;z-index:1}.week-day .event:hover{z-index:2}.day-list{margin-top:15px}.hint{font-size:12px;color:var(--secondary-text-color,#adb5bf)}[data-density=compact] .day{min-height:80px}[data-density=compact] .event{padding:4px}[data-event-style=outline] .event:not(.external){background:transparent;border:1px solid var(--event);border-left:4px solid var(--event);color:var(--primary-text-color,#eee)}[data-event-style=dot] .event:not(.external){background:transparent;color:var(--primary-text-color,#eee);border-left:5px solid var(--event)}details{margin-top:15px}summary{cursor:pointer}input[type=color]{width:70px;height:42px;padding:4px}.empty{text-align:center;padding:25px;color:var(--secondary-text-color,#aaa)}@media(max-width:600px){main{padding:12px}.toolbar{gap:8px}h1{font-size:21px}.calendar .day{min-height:80px;padding:2px}.event{font-size:10px;padding:4px}.grid2{grid-template-columns:1fr}.action-row{grid-template-columns:minmax(100px,1fr) minmax(90px,.7fr) auto;gap:5px}.action-row select{padding:8px 4px;font-size:12px}.agenda-item{grid-template-columns:85px 1fr}form,.panel{padding:12px}.date{padding:3px}.toolbar button{padding:7px 9px}}
`;
const COMPACT_PLANNING_STYLE=BASE_PLANNING_STYLE+`:host{height:100%;container-type:inline-size}ha-card{height:100%;overflow:auto}main{min-height:100%;display:flex;flex-direction:column;padding:14px}.calendar{flex:1;grid-template-rows:26px repeat(var(--weeks,5),minmax(80px,1fr))}.day{min-height:80px}.event{transition:filter .13s ease}.event:hover,.event:focus-within{filter:brightness(.78)}.calendar .event strong{overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.calendar .event span,.calendar .event small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.card-heading,.card-title,.heading-actions,.calendar-toolbar,.period-controls,.view-controls{display:flex;align-items:center;gap:6px;min-width:0}.card-heading{justify-content:space-between;margin-bottom:8px;flex-wrap:wrap}.card-title{gap:10px}.card-heading h1{font-size:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:40ch}.mode-pill{font-size:11px;padding:3px 7px;background:var(--secondary-background-color,#29323b);border-radius:20px;white-space:nowrap;color:var(--secondary-text-color,#b8c5d1)}.heading-actions button,.calendar-toolbar button{font-size:13px;min-height:30px;padding:5px 9px}.calendar-toolbar{justify-content:space-between;flex-wrap:wrap;row-gap:6px;margin-bottom:8px}.period-controls h2{font-size:15px;margin:0;white-space:nowrap;font-weight:600}.period-controls>button{font-size:20px;line-height:18px;padding:4px 9px}.view-controls{gap:3px;flex-wrap:wrap}.view-controls button[aria-pressed=true]{background:var(--accent);color:#08222b;border-color:transparent}.today-icon{display:none}main>.hint{font-size:11px;margin:8px 0 0}dialog .toolbar{margin-bottom:12px}@container(max-width:650px){.calendar-toolbar{justify-content:flex-start}.view-controls{margin-left:auto}.today-text{display:none}.today-icon{display:inline}.refresh-button{display:none}.card-heading h1{max-width:18ch}.heading-actions button{font-size:12px;padding:5px 7px}}@container(max-width:420px){.card-title{gap:5px}.card-heading h1{font-size:18px;max-width:14ch}.mode-pill{font-size:10px;padding:2px 5px}.period-controls h2{font-size:13px}.calendar-toolbar button{font-size:12px;padding:5px 6px}.period-controls>button{font-size:19px;padding:4px 6px}.view-controls{margin-left:0}.calendar-toolbar{column-gap:8px}}@media(max-width:600px){.calendar .event small{display:none}.calendar .event strong{-webkit-line-clamp:1}}`;

const PREVIOUS_PLANNING_STYLE=COMPACT_PLANNING_STYLE+`@container(max-width:650px){.settings-label{display:none}}@container(max-width:320px){.add-label{display:none}}@media(max-width:600px){.calendar .event{padding:4px 4px 18px;min-height:44px}.calendar .event-handle{top:auto;bottom:0;right:0;min-height:18px;height:18px;width:20px}}`;

const PLANNING_STYLE=PREVIOUS_PLANNING_STYLE+`ha-card{height:auto;max-height:100%}main{min-height:0;padding:12px;--planning-past-background:color-mix(in srgb,var(--ha-card-background,var(--card-background-color,#202226)) 84%,#000 16%)}.calendar{flex:0 0 auto;grid-template-rows:22px repeat(var(--weeks,5),minmax(68px,max-content))}.day{min-height:68px;padding:3px}.weekday{padding:4px 0}[data-density=compact] .calendar{grid-template-rows:22px repeat(var(--weeks,5),minmax(58px,max-content))}[data-density=compact] .day{min-height:58px;padding:2px}.day.is-past,.week-head.is-past,.agenda-item.is-past{background:var(--planning-past-background)}.day.is-past.selected{outline:1px solid var(--accent);outline-offset:-1px}.agenda-item.is-past{border-radius:6px}.event{margin:3px 0}.event.external:hover,.event.external:focus-within{background:var(--secondary-background-color,#30343a)}.hours,.week-day{height:calc(var(--planning-hour-height,40px)*24)}.week-day{background:repeating-linear-gradient(to bottom,transparent 0,transparent calc(var(--planning-hour-height,40px) - 1px),var(--divider-color,#41474e) calc(var(--planning-hour-height,40px) - 1px),var(--divider-color,#41474e) var(--planning-hour-height,40px))}.week-day.is-past{background-color:var(--planning-past-background)}.scope-field{padding:10px 12px;background:var(--secondary-background-color,#292e34);border-radius:8px} .calendar-help{margin:6px 0 0}`;

const PlanningInteractions={
  _installInteractions(){
    const root=this.shadowRoot;
    root.addEventListener('cancel',e=>{e.preventDefault();if(!this._busy)this._closeOverlay();},true);
    root.addEventListener('pointerdown',e=>this._pointerDown(e));
    root.addEventListener('pointermove',e=>this._pointerMove(e));
    root.addEventListener('pointerup',e=>this._pointerEnd(e));
    root.addEventListener('pointercancel',()=>this._clearPointer());
    root.addEventListener('lostpointercapture',e=>{const p=this._pointer;if(p?.active && e.target===p.source && !p.source.hasPointerCapture(p.id))this._clearPointer();});
    root.addEventListener('dragstart',e=>{
      if(this._pointer?.active){e.preventDefault();e.stopPropagation();return;}
      const el=e.target.closest('[data-event]'),item=this._events.find(x=>x.key===el?.dataset.event);
      if(!item?.uid || this._busy){e.preventDefault();return;}
      e.stopPropagation();this._dragKey=item.key;e.dataTransfer.setData('text/plain',item.key);e.dataTransfer.effectAllowed='move';
    });
    root.addEventListener('dragover',e=>{if(!this._dragKey)return;const drop=this._dropAt(e.clientX,e.clientY);if(drop){e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';this._highlightDrop(drop);}});
    root.addEventListener('dragend',()=>{this._dragKey=null;this._highlightDrop(null);});
    root.addEventListener('drop',e=>{if(!this._dragKey)return;e.preventDefault();e.stopPropagation();const item=this._events.find(x=>x.key===this._dragKey),drop=this._dropAt(e.clientX,e.clientY);this._dragKey=null;this._highlightDrop(null);if(item && drop)this._move(item,drop.day,drop.minute);});
  },
  _dropAt(x,y){
    if(this._draft || this._settings || this._deviceDraft)return null;
    const target=this.shadowRoot.elementFromPoint(x,y)?.closest('[data-drop]');if(!target)return null;
    // elementFromPoint can find an element behind its scroll container in some browsers.
    const clip=target.closest('.week-scroll') || this.shadowRoot.querySelector('ha-card'),bounds=clip.getBoundingClientRect();
    if(x<bounds.left || x>bounds.right || y<bounds.top || y>bounds.bottom)return null;
    let minute;if(target.classList.contains('week-day'))minute=Math.max(0,Math.min(1430,Math.round((y-target.getBoundingClientRect().top)/this._weekHourHeight*6)*10));
    return {element:target,day:target.dataset.drop,minute};
  },
  _highlightDrop(drop){this.shadowRoot.querySelectorAll('.drop-over').forEach(x=>x.classList.remove('drop-over'));drop?.element.classList.add('drop-over');},
  _pointerDown(e){
    this._suppressEventClickUntil=0;
    const el=e.target.closest('[data-event]');if(!el || this._busy || e.button!==0 || !e.isPrimary)return;
    const handle=!!e.target.closest('[data-move-handle]');if(e.pointerType!=='mouse' && !handle)return;
    const item=this._events.find(x=>x.key===el.dataset.event);if(!item?.uid)return;
    e.stopPropagation();if(handle)e.preventDefault();
    this._pointer={id:e.pointerId,key:item.key,item,source:el,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,active:false};
  },
  _pointerMove(e){
    const p=this._pointer;if(!p || p.id!==e.pointerId)return;p.lastX=e.clientX;p.lastY=e.clientY;
    if(!p.active && Math.hypot(e.clientX-p.x,e.clientY-p.y)<7)return;
    e.preventDefault();e.stopPropagation();
    if(!p.active){
      p.active=true;p.source.setPointerCapture(e.pointerId);p.source.classList.add('drag-source');
      const ghost=document.createElement('div');ghost.className='planning-drag-preview';ghost.textContent=p.item.summary;
      Object.assign(ghost.style,{position:'fixed',zIndex:'2147483647',pointerEvents:'none',padding:'10px 14px',borderRadius:'8px',background:'#172b3d',color:'#fff',boxShadow:'0 6px 30px #0008',font:'14px Arial,sans-serif',maxWidth:'280px'});document.body.append(ghost);p.ghost=ghost;
      p.abort=new AbortController();document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();this._clearPointer();}},{capture:true,signal:p.abort.signal});
      const tick=()=>{if(this._pointer!==p || !p.active)return;this._dragScroll(p);this._updatePointerDrop(p);p.frame=requestAnimationFrame(tick);};p.frame=requestAnimationFrame(tick);
    }
    this._updatePointerDrop(p);
  },
  _updatePointerDrop(p){
    p.drop=this._dropAt(p.lastX,p.lastY);this._highlightDrop(p.drop);
    if(p.ghost){p.ghost.style.left=`${Math.max(4,Math.min(innerWidth-285,p.lastX+14))}px`;p.ghost.style.top=`${Math.max(4,Math.min(innerHeight-70,p.lastY+14))}px`;p.ghost.textContent=`${p.item.summary} · ${p.drop?this._label(p.drop.day)+(p.drop.minute===undefined?'':` ${String(Math.floor(p.drop.minute/60)).padStart(2,'0')}:${String(p.drop.minute%60).padStart(2,'0')}`):this._t('Choisir une date')}`;}
  },
  _dragScroll(p){
    const near=this.shadowRoot.elementFromPoint(p.lastX,p.lastY),box=near?.closest('.week-scroll') || this.shadowRoot.querySelector('ha-card');
    if(!box)return;const r=box.getBoundingClientRect(),edge=38;
    if(p.lastX>=r.left && p.lastX<=r.right){if(p.lastY<Math.max(0,r.top)+edge)box.scrollTop-=9;else if(p.lastY>Math.min(innerHeight,r.bottom)-edge)box.scrollTop+=9;}
    if(box.classList.contains('week-scroll')){if(p.lastX<r.left+edge)box.scrollLeft-=9;else if(p.lastX>r.right-edge)box.scrollLeft+=9;}
  },
  _pointerEnd(e){
    const p=this._pointer;if(!p || e.pointerId!==p.id)return;
    if(!p.active){this._clearPointer();return;}
    e.preventDefault();e.stopPropagation();this._updatePointerDrop(p);const {item,drop}=p;this._suppressEventClickUntil=performance.now()+400;this._clearPointer();
    if(drop)this._move(item,drop.day,drop.minute);
  },
  _clearPointer(){
    const p=this._pointer;this._pointer=null;if(!p)return;cancelAnimationFrame(p.frame);p.abort?.abort();p.ghost?.remove();p.source.classList.remove('drag-source');
    if(p.source.hasPointerCapture?.(p.id))p.source.releasePointerCapture(p.id);this._highlightDrop(null);
  },
  _rememberDialog(){
    const dialog=this.shadowRoot.querySelector('dialog[open]'),active=this.shadowRoot.activeElement;
    if(!dialog)return null;let selector='';
    if(active?.name)selector=`[name="${CSS.escape(active.name)}"]`;
    else if(active?.dataset.deviceField)selector=`[data-device-field="${CSS.escape(active.dataset.deviceField)}"]`;
    else if(active?.closest('.action-row')){const row=active.closest('.action-row');selector=`[data-phase="${row.dataset.phase}"][data-index="${row.dataset.index}"] [${active.hasAttribute('data-target')?'data-target':'data-operation'}]`;}
    else if(active?.dataset.action)selector=`[data-action="${CSS.escape(active.dataset.action)}"]`;
    return {scroll:dialog.scrollTop,selector,start:active?.selectionStart,end:active?.selectionEnd};
  },
  _restoreDialog(state){
    const dialog=this.shadowRoot.querySelector('dialog');
    if(dialog && this.isConnected){
      dialog.showModal();dialog.addEventListener('click',e=>{if(e.target!==dialog || this._busy)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom)this._closeOverlay();});
      const focus=state?.selector?dialog.querySelector(state.selector):null;
      (focus || dialog.querySelector('h2'))?.focus({preventScroll:true});
      if(focus && typeof state.start==='number' && ['INPUT','TEXTAREA'].includes(focus.tagName)){try{focus.setSelectionRange(state.start,state.end);}catch{/* Select/date/color inputs have no text selection. */}}
      dialog.scrollTop=state?.scroll || 0;
    }
    if(!dialog && state)this.shadowRoot.querySelector('[data-action=new]')?.focus({preventScroll:true});
    this._showToast();
  },
  _closeOverlay(){if(this._busy)return;this._draft=null;this._settings=false;this._deviceDraft=null;this._error='';this._render();},
  _showToast(){
    const toast=this.shadowRoot.querySelector('.planning-toast');if(!toast)return;
    if(toast.showPopover)toast.showPopover();clearTimeout(this._toastTimer);
    this._toastTimer=setTimeout(()=>{if(this._error)return;toast.remove();},6000);
  },
};
const INTERACTION_STYLE=`
dialog.planning-dialog{position:fixed;inset:0;margin:auto;width:min(760px,calc(100vw - 32px));max-width:none;max-height:calc(100dvh - 32px);overflow:auto;padding:0;background:var(--ha-card-background,var(--card-background-color,#202226));color:var(--primary-text-color,#e7eaef);border:1px solid var(--divider-color,#41474e);border-radius:16px;box-shadow:0 24px 90px #0008;overscroll-behavior:contain;--accent:var(--primary-color,#31b8de)}dialog.planning-dialog::backdrop{background:#0009}dialog .dialog-body{padding:20px}dialog form,dialog .panel{margin:0;border:0;padding:0}dialog h2{outline:none}dialog .toolbar:first-child{position:sticky;top:-20px;background:var(--card-background-color,#202226);padding:12px 0;z-index:2}dialog .error{white-space:normal}.event{position:relative;padding-right:23px}.event-handle{position:absolute;right:1px;top:2px;width:22px;min-height:30px;padding:3px 0;border:0;border-radius:4px;background:transparent;color:inherit;touch-action:none;cursor:grab;user-select:none}.event-handle:hover{background:#ffffff35}.drag-source{opacity:.4}.planning-toast{position:fixed;inset:16px auto auto 50%;transform:translateX(-50%);margin:0;width:max-content;max-width:calc(100vw - 32px);padding:12px 40px 12px 15px;z-index:2147483647;border:1px solid var(--divider-color,#526271);border-radius:10px;background:var(--card-background-color,#202b36);color:var(--primary-text-color,#fff);box-shadow:0 5px 30px #0006;font-size:14px}.planning-toast.error{border-color:#e48a8a}.planning-toast button{position:absolute;right:5px;top:4px;border:0;padding:4px 7px}.planning-toast::backdrop{background:transparent}.event-main{display:block;width:100%;padding:0;border:0;text-align:left;background:transparent!important;color:inherit;font:inherit;cursor:pointer;overflow:hidden}.event[draggable=true]{user-select:none}@media(max-width:600px){dialog.planning-dialog{width:calc(100vw - 16px);max-height:calc(100dvh - 16px);border-radius:12px}dialog .dialog-body{padding:14px}.event-handle{width:21px}.event{padding-right:21px}dialog .toolbar:first-child{top:-14px}}`;




const PlanningDeviceSettings={
  _deviceSettingsHtml(){
    const admin=this._config.demo || this._hass.user?.is_admin===true;
    const allowed=this._allowedDeviceTypes().length>0;
    return `<h3>Appareils du planning</h3><p class="hint">Ajoutez ici vos appareils une fois. Ils seront ensuite proposés dans chaque programmation.</p>${this._snapshot.records.length?`<div class="device-list">${this._snapshot.records.map(r=>`<div class="device-item"><div><strong translate="no">${esc(r.name)}</strong><small>${esc(this._t(ACTION_TYPES[r.type]?.label || r.type))} · <span>${r.enabled===false?'Désactivé':'Disponible'}</span></small></div>${admin?this._button('Modifier','edit-device',`data-device-id="${r.id}"`):''}</div>`).join('')}</div>`:'<p>Aucun appareil enregistré pour le moment.</p>'}${admin?this._button('+ Ajouter un appareil','new-device',`class="primary" ${allowed?'':'disabled'}`):'<p class="hint">Un administrateur ajoute les nouveaux appareils. Vous pouvez modifier les horaires et les actions des appareils disponibles.</p>'}${admin && !allowed?'<p class="hint">Sélectionnez d’abord les appareils autorisés dans les paramètres de la carte.</p>':''}`;
  },
  _allowedDeviceTypes(){const entities=this._config.entities || [];return Object.keys(ACTION_TYPES).filter(type=>type==='frech'?['switch','script','binary_sensor'].every(domain=>entities.some(e=>e.startsWith(domain+'.'))):entities.some(e=>e.startsWith(type+'.')));},
  _entityOptions(domain,value=''){
    const allowed=this._config.entities || [],list=Object.values(this._hass.states || {}).filter(s=>allowed.includes(s.entity_id) && s.entity_id.startsWith(domain+'.')).sort((a,b)=>(a.attributes?.friendly_name || a.entity_id).localeCompare(b.attributes?.friendly_name || b.entity_id,this._locale));
    const old=this._deviceSnapshot?.records.find(r=>r.id===this._deviceDraft?.id),preserve=old && [old.entity_id,old.switch_entity,old.input_entity,old.script_entity].includes(value);
    return `<option value="">${this._t(list.length?'Choisir une entité':'Aucune entité autorisée pour ce type.')}</option>${list.map(s=>`<option translate="no" value="${s.entity_id}" ${s.entity_id===value?'selected':''}>${esc(s.attributes?.friendly_name || s.entity_id)} — ${s.entity_id}</option>`).join('')}${value && preserve && !list.some(s=>s.entity_id===value)?`<option translate="no" selected disabled value="${esc(value)}">${esc(value)} (${this._t('hors sélection de la carte')})</option>`:''}`;
  },
  _deviceFormHtml(){
    const d=this._deviceDraft;
    const types=new Set([...this._allowedDeviceTypes(),...(d.id?[d.type]:[])]);
    const entity=(label,field,domain)=>`<label class="field">${label}<select data-device-field="${field}">${this._entityOptions(domain,d[field])}</select></label>`;
    return `<form data-device-form><div class="toolbar"><h2 tabindex="-1">${d.id?'Modifier un appareil':'Ajouter un appareil'}</h2>${this._button('Fermer','device-cancel')}</div><label class="field">Nom affiché<input data-device-field="name" maxlength="120" value="${esc(d.name)}" placeholder="Nom de l’appareil"></label><label class="field">Type<select data-device-field="type">${Object.entries(ACTION_TYPES).filter(([key])=>types.has(key)).map(([key,r])=>`<option value="${key}" ${d.type===key?'selected':''}>${esc(r.label)}</option>`).join('')}</select></label>${d.type==='frech'?`${entity('Relais de la Frech','switch_entity','switch')}${entity('Entrée de contrôle','input_entity','binary_sensor')}${entity('Script de démarrage existant','script_entity','script')}<label class="field">Numéro de la Frech<input type="number" min="1" max="21" step="1" data-device-field="frech_number" value="${d.frech_number || ''}"></label><p class="hint">Le script existant est conservé avec son relais, son entrée et son numéro. Le planning propose un démarrage seul.</p>`:entity('Appareil / entité','entity_id',d.type)}<label class="check field"><input type="checkbox" data-device-field="enabled" ${d.enabled?'checked':''}>Disponible dans les programmations</label><div class="buttons"><button class="primary" type="submit" ${this._busy?'disabled':''}>Enregistrer l’appareil</button>${this._button('Annuler','device-cancel')}</div></form>`;
  },
  _openDevice(id=''){
    if(!this._config.demo && this._hass.user?.is_admin!==true)return;
    const record=this._snapshot.records.find(r=>r.id===id),types=this._allowedDeviceTypes();if(!record && !types.length){this._error='Sélectionnez d’abord les appareils autorisés dans les paramètres de la carte.';this._render();return;}this._deviceSnapshot=structuredClone(this._snapshot);this._deviceDraft=record?structuredClone(record):{name:'',type:types[0],entity_id:'',switch_entity:'',script_entity:'',input_entity:'',frech_number:1,enabled:true};this._error='';this._notice='';this._render();
  },
  _deviceChange(el){
    const d=this._deviceDraft;if(!d || !el.dataset.deviceField)return false;
    const field=el.dataset.deviceField;d[field]=el.type==='checkbox'?el.checked:field==='frech_number'?Number(el.value):el.value;
    if(field==='type'){if(d.type==='frech' && d.entity_id?.startsWith('switch.'))d.switch_entity=d.entity_id;this._render();}
    return true;
  },
  async _saveDevice(){
    if(this._busy || !this._deviceDraft)return;this._busy=true;this._error='';
    try{
      const d=this._deviceDraft,type=d.type,entity=type==='frech'?d.switch_entity:d.entity_id;
      const id=d.id || (type==='frech'?`frech_${(entity || '').replace('.','_')}`:simpleActionRecord(entity).id);
      const record={id,type,name:d.name.trim() || this._hass.states[entity]?.attributes?.friendly_name || entity,enabled:d.enabled,...(type==='frech'?{switch_entity:d.switch_entity,input_entity:d.input_entity,script_entity:d.script_entity,frech_number:Number(d.frech_number)}:{entity_id:entity})};
      const issue=validateActionRecord(record);if(issue)throw new Error(issue);
      const old=this._deviceSnapshot.records.find(r=>r.id===id);
      for(const field of type==='frech'?['switch_entity','input_entity','script_entity']:['entity_id'])if(!this._config.entities.includes(record[field]) && (!d.id || old?.[field]!==record[field]))throw new Error('Cette entité n’est pas autorisée dans les paramètres de la carte.');
      if(!d.id && this._deviceSnapshot.records.some(r=>r.id===id || targetEntity(r)===entity))throw new Error('Cet appareil est déjà présent. Utilisez Modifier dans la liste.');
      if(old && stableJson({...old,name:''})!==stableJson({...record,name:''})){const today=dayOf(Date.now(),this._zone),events=this._config.demo?this._events:await this._fetch(shiftDay(today,-1),shiftDay(today,2));for(const event of events){if([...event.meta?.start_actions || [],...event.meta?.end_actions || []].some(a=>a.target===id)){const active=mutationIssue(event,'occurrence',events);if(active)throw new Error(active);}}}
      if(this._config.demo){const records=this._snapshot.records.filter(r=>r.id!==id);records.push(record);this._snapshot={...this._snapshot,records};}
      else{if(!this._snapshot.ready){this._snapshot=await this._store.setup(ACTION_BLUEPRINT_VERSION,this._config.execution_automation);this._deviceSnapshot=this._snapshot;}const records=this._deviceSnapshot.records.filter(r=>r.id!==id);records.push(record);this._snapshot=await this._store.save(this._deviceSnapshot,records);}
      this._deviceDraft=null;this._settings=true;this._notice='Appareil enregistré.';if(this._config.entities?.length && !this._config.entities.includes(entity))this._notice+=' Pour le proposer sur cette carte, cochez-le dans Modifier la carte → Appareils proposés dans les programmations.';else this._notice+=' Il est disponible dans les programmations.';
    }catch(e){this._error=e.message;}finally{this._busy=false;this._render();}
  },
};
const DEVICE_SETTINGS_STYLE=`.device-list{display:grid;gap:8px;margin:14px 0}.device-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--divider-color,#41474e);border-radius:8px}.device-item small{display:block;margin-top:5px}.device-item strong{overflow-wrap:anywhere}`;


class PlanningChauffeEditor extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this.shadowRoot.addEventListener('change',e=>this._change(e));this.shadowRoot.addEventListener('input',e=>{if(e.target.hasAttribute('data-entity-search')){this._search=e.target.value;this._filterEntities();}});}
  set hass(value){this._hass=value;this._render();}
  setConfig(value){planningLanguage(value.language);this._config={...value,title:value.title || 'Planning',language:value.language || 'auto',entities:selectedPlanningEntities(value.entities),demo:value.demo ?? !value.calendar,appearance:normalizeAppearance(value.appearance)};delete this._config.groups;delete this._config.closure_calendar;delete this._config.devices;this._render();}
  get _language(){return planningLanguage(this._config?.language || 'auto',this._hass);}
  get _locale(){return PLANNING_LOCALES[this._language];}
  _emit(){this.dispatchEvent(new CustomEvent('config-changed',{bubbles:true,composed:true,detail:{config:{...this._config,entities:[...this._config.entities],appearance:{...this._config.appearance}}}}));}
  _filterEntities(){const term=(this._search || '').toLocaleLowerCase(this._locale);this.shadowRoot.querySelectorAll('[data-entity-row]').forEach(row=>{row.hidden=!row.textContent.toLocaleLowerCase(this._locale).includes(term);row.style.display=row.hidden?'none':'';});}
  _change(event){
    const el=event.target;
    if(el.dataset.planningEntity){const selected=new Set(this._config.entities);if(el.checked)selected.add(el.dataset.planningEntity);else selected.delete(el.dataset.planningEntity);this._config.entities=[...selected];this._emit();return;}
    if(!el.dataset.field)return;
    const field=el.dataset.field,value=el.type==='checkbox'?el.checked:el.value;
    if(el.dataset.appearance)this._config.appearance[field]=field==='first_day'?Number(value):value;
    else this._config[field]=value;
    if(field==='calendar' && value)this._config.demo=false;
    this._emit();
    if(['calendar','demo','language'].includes(field))this._render();
  }
  _render(){
    if(!this._config || !this._hass)return;
    const c=this._config,a=c.appearance;
    const select=(label,field,options)=>`<label>${label}<select data-field="${field}" data-appearance="true">${Object.entries(options).map(([value,name])=>`<option value="${value}" ${String(a[field])===value?'selected':''}>${name}</option>`).join('')}</select></label>`;
    const calendars=Object.values(this._hass.states || {}).filter(e=>e.entity_id.startsWith('calendar.'));
    const devices=Object.values(this._hass.states || {}).filter(e=>e.entity_id.startsWith('binary_sensor.') || Object.hasOwn(ACTION_TYPES,e.entity_id.split('.')[0])).sort((x,y)=>(x.attributes.friendly_name || x.entity_id).localeCompare(y.attributes.friendly_name || y.entity_id,this._locale));
    const automations=Object.values(this._hass.states || {}).filter(e=>e.entity_id.startsWith('automation.'));
    this.shadowRoot.innerHTML=`<style>:host{display:block;color:var(--primary-text-color);font-family:inherit}label{display:flex;flex-direction:column;gap:6px;margin:14px 0}input,select{font:inherit;color:var(--primary-text-color);background:var(--secondary-background-color);border:1px solid var(--divider-color);border-radius:8px;padding:11px;box-sizing:border-box;width:100%}.check{flex-direction:row;align-items:center}.check input{width:auto}p{color:var(--secondary-text-color);font-size:13px;line-height:1.5}details{padding:14px 0;border-top:1px solid var(--divider-color)}summary{font-weight:600}h3{margin:12px 0 4px}</style>
      <h3>Votre planning</h3>
      <label>Nom de la carte<input data-field="title" value="${esc(c.title)}"></label>
      <label>Langue<select data-field="language"><option value="auto" ${c.language==='auto'?'selected':''}>Automatique (Home Assistant)</option>${Object.entries(PLANNING_LANGUAGES).map(([key,name])=>`<option translate="no" value="${key}" ${c.language===key?'selected':''}>${name}</option>`).join('')}</select></label>
      <label>Calendrier<select data-field="calendar"><option value="">Choisir un calendrier local</option>${calendars.map(e=>`<option translate="no" value="${esc(e.entity_id)}" ${e.entity_id===c.calendar?'selected':''}>${esc(e.attributes.friendly_name || e.entity_id)}</option>`).join('')}</select></label>
      <p>Un seul calendrier. Ajoutez ensuite vos créneaux et choisissez directement les actions à exécuter.</p>
      <label class="check"><input type="checkbox" data-field="demo" ${c.demo?'checked':''}>Essai local, sans enregistrement dans Home Assistant</label>
      <p>${c.demo?'Les actions sont simulées.':'L’exécution se prépare depuis le bouton Réglages de la carte. Le mode test est proposé en premier.'}</p>
      <details open><summary>Appareils proposés dans les programmations</summary>
      <p>Cochez les entités autorisées. Sans sélection, aucun nouvel appareil n’est proposé. Pour une Frech, autorisez aussi son script et son entrée de contrôle.</p>
      <label>Rechercher un appareil<input type="search" data-entity-search value="${esc(this._search || '')}" placeholder="Nom ou identifiant de l’entité"></label>
      <div class="entity-options" style="max-height:280px;overflow:auto;border:1px solid var(--divider-color);padding:0 12px;border-radius:8px">${devices.map(e=>`<label class="check" data-entity-row><input type="checkbox" data-planning-entity="${e.entity_id}" ${c.entities.includes(e.entity_id)?'checked':''}><span translate="no">${esc(e.attributes.friendly_name || e.entity_id)}<small style="display:block">${e.entity_id}</small></span></label>`).join('') || '<p>Aucune entité compatible disponible.</p>'}</div></details>
      <details><summary>Exécution existante / migration</summary><label>Automatisation déjà utilisée<select data-field="execution_automation"><option value="">Détection automatique</option>${automations.map(e=>`<option translate="no" value="${e.entity_id}" ${c.execution_automation===e.entity_id?'selected':''}>${esc(e.attributes.friendly_name || e.entity_id)}</option>`).join('')}</select></label><p>Choisir votre ancienne automatisation Planning permet de retrouver ses appareils Frech et leurs associations. Les nouvelles installations se préparent dans Réglages.</p></details>
      <details><summary>Personnalisation</summary>
      ${select('Vue initiale','default_view',{month:'Mois',week:'Semaine',agenda:'Agenda'})}
      ${select('Premier jour','first_day',{'1':'Lundi','0':'Dimanche'})}
      ${select('Format des heures','time_format',{'24':'24 heures','12':'12 heures'})}
      ${select('Densité','density',{comfortable:'Confortable',compact:'Compacte'})}
      ${select('Style des événements','event_style',{filled:'Fond coloré',outline:'Contour',dot:'Repère de couleur'})}
      <label class="check"><input type="checkbox" data-field="show_weekends" data-appearance="true" ${a.show_weekends?'checked':''}>Afficher les week-ends</label>
      <label class="check"><input type="checkbox" data-field="show_device_names" data-appearance="true" ${a.show_device_names?'checked':''}>Afficher les noms des appareils dans le calendrier</label>
      <label>Couleur principale<input type="color" data-field="accent_color" data-appearance="true" value="${eventColor(a.accent_color || '#31b8de')}"></label>
      </details><p>Taille : utilisez l’onglet Disposition dans une vue Sections, ou une vue Panneau pour la pleine largeur.</p>`;
    localizePlanningRoot(this.shadowRoot,this._language);this._filterEntities();
  }
}
if(!customElements.get('ha-planning-card-editor'))customElements.define('ha-planning-card-editor',PlanningChauffeEditor);
if(!customElements.get('ha-planning-chauffe-card-editor'))customElements.define('ha-planning-chauffe-card-editor',class extends PlanningChauffeEditor{});












class PlanningCard extends HTMLElement {
  constructor(){
    super();this.attachShadow({mode:'open'});this._events=[];this._demoRows=[];this._snapshot={records:[],ready:false,test_mode:true};this._generation=0;
    this.shadowRoot.addEventListener('click',e=>this._click(e));
    this.shadowRoot.addEventListener('change',e=>this._change(e));
    this.shadowRoot.addEventListener('input',e=>{if(this._deviceChange(e.target))return;if(e.target.name && this._draft)this._draft[e.target.name]=e.target.value;});
    this.shadowRoot.addEventListener('submit',e=>{e.preventDefault();if(e.target.hasAttribute('data-device-form'))this._saveDevice();else this._save();});
    this._installInteractions();
  }
  static getConfigElement(){return document.createElement('ha-planning-card-editor');}
  static getStubConfig(){return {type:'custom:ha-planning-card',title:'Planning',demo:true};}
  getCardSize(){return 8;}
  getGridOptions(){return {columns:24,min_columns:6,rows:9,min_rows:6};}
  setConfig(config){this._config=normalizePlanningConfig(config);this._generation++;this._initialized=false;this._init();}
  set hass(value){const language=this._language;this._hass=value;const initialized=this._initialized;this._init();if(initialized && language!==this._language)this._render();}
  get _language(){return planningLanguage(this._config?.language || 'auto',this._hass);}
  get _locale(){return PLANNING_LOCALES[this._language];}
  _t(value){return planningTranslate(this._language,value);}
  _weekday(day){return new Intl.DateTimeFormat(this._locale,{weekday:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2026,10,1+day))).replace(/\.$/,'');}
  connectedCallback(){if(!this._timer)this._timer=setInterval(()=>{if(this.isConnected && !this._draft && !this._settings && !this._busy && !this._pointer?.active)this._load();},60000);this._init();}
  disconnectedCallback(){clearInterval(this._timer);clearTimeout(this._toastTimer);this._timer=null;this._clearPointer();}
  _init(){
    if(!this._config || !this._hass || this._initialized)return;
    this._clearPointer();this._deviceDraft=null;
    this._initialized=true;this._zone=this._hass.config?.time_zone || 'Europe/Brussels';this._selected=dayOf(Date.now(),this._zone);this._month=this._selected.slice(0,7);this._view=this._config.appearance.default_view;this._draft=null;this._settings=false;this._events=[];this._error='';this._loaded=!!this._config.demo;this._loading=false;this._snapshot={records:[],ready:false,test_mode:true};
    this._store=new PlanningActionStore(()=>this._hass,this._config.calendar,this._config.execution_automation);
    this._seriesRecords=[];this._seriesStore=new PlanningSeriesStore(()=>this._config.demo?{callApi:async(method,path)=>{const q=new URLSearchParams(path.split('?')[1]);return expandDemoCalendar(this._demoRows,q.get('start'),q.get('end'),this._zone);},callWS:async payload=>{this._demoWrite(payload);return null;}}:this._hass,this._config.calendar || 'calendar.demo',this._zone);
    this._render();this._load();
  }
  get _weekHourHeight(){return this._config.appearance.density==='compact'?40:44;}
  _range(){return viewRange(this._month,this._config.appearance.first_day);}
  _meta(event){
    if(event.meta)return event.meta;
    const old=event.legacy;
    if(!old || !['weekly','restart'].includes(old.kind) || !old.devices?.length)return null;
    const records=old.devices.map(id=>this._record(id));if(records.some(r=>!r))return null;
    return {planning:2,kind:'schedule',id:old.id || newEventId(),color:old.color,has_end:false,start_actions:records.map(r=>({target:r.id,op:defaultOperation(r)})),end_actions:[],note:old.note || ''};
  }
  _time(value){return new Intl.DateTimeFormat(this._locale,{timeZone:this._zone,hour:'2-digit',minute:'2-digit',hour12:this._config.appearance.time_format==='12'}).format(new Date(value));}
  _label(day){return new Intl.DateTimeFormat(this._locale,{timeZone:'UTC',weekday:'short',day:'numeric',month:'short'}).format(new Date(`${day}T12:00Z`));}
  _record(id){if(id?.startsWith('entity:')){const entity=id.slice(7);return simpleActionRecord(entity,this._hass.states[entity]?.attributes?.friendly_name);}return this._snapshot.records.find(r=>r.id===id);}
  _choices(){
    const selected=this._config.entities || [],current=new Set([...(this._draft?.start_actions || []),...(this._draft?.end_actions || [])].map(a=>a.target));
    const records=this._snapshot.records.filter(r=>r.enabled!==false && (selected.includes(targetEntity(r)) || current.has(r.id))).map(r=>({...r,value:r.id}));
    if(this._config.demo || this._hass.user?.is_admin)for(const [entity,state] of Object.entries(this._hass.states || {})){
      if(!ACTION_TYPES[entity.split('.')[0]] || !selected.includes(entity) || this._snapshot.records.some(r=>targetEntity(r)===entity || (r.type==='frech' && r.script_entity===entity)))continue;
      try{records.push({...simpleActionRecord(entity,state.attributes?.friendly_name),value:`entity:${entity}`});}catch{/* Unsupported entities remain outside the action picker. */}
    }
    return records.sort((a,b)=>a.name.localeCompare(b.name,this._locale));
  }
  async _fetch(start,end){
    const state=this._hass.states[this._config.calendar];
    if(!state || !['on','off'].includes(state.state))throw new Error('Choisissez un calendrier local disponible dans la configuration de la carte.');
    if((Number(state.attributes.supported_features)&7)!==7)throw new Error('Ce calendrier ne permet pas toutes les modifications. Utilisez Calendrier local.');
    const query=new URLSearchParams({start:toInstant(`${start}T00:00`,this._zone),end:toInstant(`${end}T00:00`,this._zone)});
    const rows=await this._hass.callApi('GET',`calendars/${this._config.calendar}?${query}`);
    if(!Array.isArray(rows))throw new Error('Réponse calendrier invalide.');
    return rows.filter(r=>!actionRegistry(r) && !r.description?.includes('"planning_devices"') && !r.description?.includes('"planning_series_journal"') && !r.description?.includes('"planning_series_pending"')).map(r=>normalizeSchedule(r,this._config.calendar,this._zone));
  }
  async _load(){
    if(!this._initialized || this._loading)return;
    if(!this._config.calendar && !this._config.demo)return;
    const generation=this._generation;this._loading=true;
    try{this._seriesRecords=await this._seriesStore.records();for(const record of this._seriesRecords)if(record.pending)await this._seriesStore.recover(record);this._seriesRecords=await this._seriesStore.records();if(this._config.demo){this._expandDemo();this._loaded=true;return;}const range=this._range();const [events,snapshot]=await Promise.all([this._fetch(range.queryStart,range.queryEnd),this._store.load()]);if(generation!==this._generation)return;if(snapshot.ready && snapshot.config && snapshot.needsPublish){try{await this._store.publish(snapshot);snapshot.needsPublish=false;}catch(e){snapshot.publishError=e.message;}}this._events=annotateSeries(events,this._seriesRecords);this._snapshot=snapshot;this._loaded=true;this._error=snapshot.publishError || '';}
    catch(e){if(generation===this._generation){this._error=e.message;this._loaded=false;}}
    finally{if(generation===this._generation){this._loading=false;this._render();}}
  }
  _expandDemo(){
    const range=this._range(),rows=expandDemoCalendar(this._demoRows,toInstant(`${range.queryStart}T00:00`,this._zone),toInstant(`${range.queryEnd}T00:00`,this._zone),this._zone);
    this._events=annotateSeries(rows.filter(r=>!r.description?.includes('"planning_series_journal"')&&!r.description?.includes('"planning_series_pending"')).map(row=>normalizeSchedule(row,this._config.calendar || 'calendar.demo',this._zone)),this._seriesRecords || []);
  }
  _button(label,action,extra=''){return `<button type="button" data-action="${action}" ${this._busy?'disabled':''} ${extra}>${label}</button>`;}
  _executionLabel(){if(this._config.demo)return 'Essai local · aucune commande envoyée';if(!this._snapshot.ready)return 'Choisissez vos horaires, puis préparez l’exécution dans Réglages.';if(!this._snapshot.config)return 'Programmations partagées · exécution gérée par Home Assistant';if(this._hass.states[this._store.automation]?.state==='off')return 'Automatisation désactivée dans Home Assistant';return this._snapshot.test_mode?'Mode test · notifications uniquement':'Exécution Home Assistant active';}
  _eventHtml(e,style=''){
    const meta=this._meta(e),owned=!!(e.meta || e.legacy),names=meta?.start_actions.map(a=>this._record(a.target)?.name || a.target).join(', ') || '';
    const past=dayOf(e.start,this._zone)<dayOf(Date.now(),this._zone) && !(meta?.has_end && Date.parse(e.start)<=Date.now() && Date.now()<Date.parse(e.end)),baseColor=eventColor(meta?.color || e.legacy?.color),color=past?'#'+baseColor.slice(1).match(/../g).map(value=>Math.round(parseInt(value,16)*.8).toString(16).padStart(2,'0')).join(''):baseColor;
    return `<div class="event ${owned?'':'external'} ${past?'is-past-event':''}" data-event="${esc(e.key)}" draggable="${!!e.uid && !this._busy}" style="--event:${color};--event-text:${colorText(color)};${style}"><button type="button" class="event-main" translate="no" data-event="${esc(e.key)}" title="${esc(`${e.summary} · ${this._time(e.start)} · ${this._t('Cliquer pour modifier')}`)}"><span>${this._time(e.start)}${meta?.has_end?' → '+this._time(e.end):''}${recurring(e)?' ↻':''}</span><strong translate="no">${esc(e.summary)}</strong>${this._config.appearance.show_device_names && names?`<small>${esc(names)}</small>`:''}</button>${e.uid?`<button type="button" class="event-handle" data-move-handle="${esc(e.key)}" title="Glisser pour déplacer ce jour" aria-label="${this._t('Déplacer')} ${esc(e.summary)}">⠿</button>`:''}</div>`;
  }
  _dayEvents(day){return this._events.filter(e=>dayOf(e.start,this._zone)===day && e.role!=='legacy-closure').sort((a,b)=>a.start.localeCompare(b.start));}
  _calendarHtml(){
    const a=this._config.appearance,days=visibleWeekdays(a.first_day,a.show_weekends),range=this._range(),today=dayOf(Date.now(),this._zone);
    if(this._view==='agenda')return `<div class="agenda">${this._events.filter(e=>e.role!=='legacy-closure' && dayOf(e.start,this._zone).startsWith(this._month)).sort((a,b)=>a.start.localeCompare(b.start)).map(e=>`<div class="agenda-item ${dayOf(e.start,this._zone)<today?'is-past':''}"><small>${this._label(dayOf(e.start,this._zone))}</small>${this._eventHtml(e)}</div>`).join('') || '<div class="empty">Aucune programmation ce mois-ci.</div>'}</div>`;
    if(this._view==='week'){
      const first=shiftDay(this._selected,-((weekday(this._selected)-a.first_day+7)%7)),week=Array.from({length:7},(_,i)=>shiftDay(first,i)).filter(d=>days.includes(weekday(d)));
      return `<div class="week-scroll"><div class="week" style="--columns:${days.length};--planning-hour-height:${this._weekHourHeight}px"><div class="week-head"></div>${week.map(d=>`<div class="week-head ${d<today?'is-past':''}">${this._label(d)}</div>`).join('')}<div class="hours">${Array.from({length:24},(_,i)=>`<span style="top:${i*this._weekHourHeight}px">${String(i).padStart(2,'0')}:00</span>`).join('')}</div>${week.map(d=>`<div class="week-day ${d<today?'is-past':''}" data-drop="${d}" aria-label="${this._label(d)}">${packWeekEvents(this._dayEvents(d),this._zone,this._weekHourHeight).map(p=>this._eventHtml(p.event,`top:${p.minute/60*this._weekHourHeight}px;height:${(p.visualEnd-p.minute)/60*this._weekHourHeight}px;left:${p.lane/p.lanes*100}%;width:${100/p.lanes}%`)).join('')}</div>`).join('')}</div></div>`;
    }
    let html=days.map(d=>`<div class="weekday">${this._weekday(d)}</div>`).join('');
    for(let i=0;i<range.count;i++){const day=shiftDay(range.start,i);if(!days.includes(weekday(day)))continue;html+=`<div class="day ${day.startsWith(this._month)?'':'outside'} ${day===this._selected?'selected':''} ${day<today?'is-past':''}" data-drop="${day}"><button class="date" type="button" data-day="${day}" aria-label="${this._t('Ajouter le')} ${esc(this._label(day))}">${Number(day.slice(8))}</button>${this._dayEvents(day).map(e=>this._eventHtml(e)).join('')}</div>`;}
    return `<div class="calendar" style="--columns:${days.length};--weeks:${range.count/7}">${html}</div>`;
  }
  _timeSelect(prefix,value){const [h,m]=value.split(':');return `<div class="time"><select name="${prefix}_hour" aria-label="Heure ${prefix==='start'?'de début':'de fin'}">${Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(x=>`<option ${x===h?'selected':''}>${x}</option>`).join('')}</select><span>:</span><select name="${prefix}_minute" aria-label="Minute ${prefix==='start'?'de début':'de fin'}">${[...new Set(['00','10','20','30','40','50',m])].sort().map(x=>`<option ${x===m?'selected':''}>${x}</option>`).join('')}</select></div>`;}
  _actionsHtml(phase){
    const choices=this._choices(),list=this._draft[phase];
    return list.map((row,index)=>{const record=this._record(row.target),ops=operationsFor(record);return `<div class="action-row" data-phase="${phase}" data-index="${index}"><select data-target aria-label="Appareil ${phase==='start_actions'?'au début':'à la fin'} ${index+1}"><option value="">Choisir un appareil ou un script</option>${choices.map(r=>`<option translate="no" value="${esc(r.value)}" ${r.value===row.target?'selected':''}>${esc(r.name)}</option>`).join('')}${row.target && !choices.some(r=>r.value===row.target)?`<option translate="no" selected value="${esc(row.target)}">${esc(row.target)} (${this._t('indisponible')})</option>`:''}</select><select data-operation aria-label="Action ${index+1}">${Object.entries(ops).map(([value,label])=>`<option value="${value}" ${row.op===value?'selected':''}>${label}</option>`).join('')}</select><button type="button" data-remove-action aria-label="Retirer l’action ${index+1}">×</button></div>`;}).join('');
  }
  _scopeHtml(d){return `<label class="field">Modifier<select name="scope" aria-label="Portée de la modification"><option value="occurrence" ${d.scope==='occurrence'?'selected':''}>Ce jour uniquement</option><option value="series" ${d.scope==='series'?'selected':''}>Toute la série</option></select></label>${d.scope==='series'?`<p class="status notice">La série sera modifiée à partir de la date choisie. Les jours déjà déplacés ou supprimés sont conservés.</p>${d.seriesSnapshot && !d.seriesSnapshot.complete?'<p class="status notice">Ancienne série : importez une fois le fichier ICS du calendrier pour reprendre aussi les jours déjà supprimés.</p><label class="field">Importer les exceptions existantes<input type="file" name="series_import" accept=".ics,text/calendar"></label>':''}${d.seriesError?`<p class="status error">${esc(d.seriesError.message)}</p>`:''}`:'<p class="status notice">Seul ce jour sera modifié. Les autres occurrences gardent leur horaire et leurs actions.</p>'}`;}
  _formHtml(){
    const d=this._draft,existing=!!d.uid,isRecurring=recurring(d);
    if(d.calendarOnly)return this._calendarOnlyFormHtml();
    if(d.readonly)return `<section class="panel"><h2 translate="no">${esc(d.summary)}</h2><p>Ce calendrier ne fournit pas d’identifiant modifiable pour cet événement. Utilisez un calendrier local permettant sa modification.</p>${this._button('Fermer','cancel')}</section>`;
    return `<form><div class="toolbar"><h2>${existing?'Modifier cette programmation':'Nouvelle programmation'}</h2>${this._button('Fermer','cancel')}</div>${existing && isRecurring?this._scopeHtml(d):''}<label class="field">Nom<input required name="summary" maxlength="120" value="${esc(d.summary)}" placeholder="Ex. Chauffe atelier ou ouverture barrière"></label><div class="grid2"><label>${existing && d.scope==='series'?'Date de début de la série':existing?'Date de cette occurrence':'Date de début'}<input required type="date" name="date" value="${d.date}"></label>${!existing?`<label>Répétition<select name="repeat"><option value="once" ${d.repeat==='once'?'selected':''}>Une seule fois</option><option value="weekly" ${d.repeat==='weekly'?'selected':''}>Chaque semaine</option></select></label>`:'<p class="hint">Pour déplacer, changez la date ou l’heure. Vous pouvez aussi glisser la programmation sur le calendrier.</p>'}</div>${((!existing && d.repeat==='weekly') || (existing && d.scope==='series' && /(?:^|;)FREQ=WEEKLY(?:;|$)/i.test(d.seriesRule)))?`<div class="field"><label>Jours habituels</label><div class="weekdays">${[1,2,3,4,5,6,0].map(i=>`<label class="check"><input type="checkbox" data-weekday="${i}" ${d.days.includes(i)?'checked':''}>${this._weekday(i)}</label>`).join('')}</div><p class="hint">Créez autant de programmations que nécessaire pour des horaires différents.</p></div>`:''}<h3>Au début</h3>${this._timeSelect('start',`${d.start_hour}:${d.start_minute}`)}${this._actionsHtml('start_actions')}${this._button('+ Ajouter une action','add-start')}<label class="check field"><input name="has_end" type="checkbox" ${d.has_end?'checked':''}>Prévoir une heure et des actions de fin</label>${d.has_end?`<h3>À la fin</h3>${this._timeSelect('end',`${d.end_hour}:${d.end_minute}`)}<p class="hint">Si l’heure de fin précède l’heure de début, le créneau se termine le lendemain.</p>${this._actionsHtml('end_actions')}${this._button('+ Ajouter une action à la fin','add-end')}`:'<p class="hint">Action ponctuelle : adapté au démarrage des Frech, sans arrêt programmé.</p>'}<div class="grid2 field"><label>Couleur<input type="color" name="color" value="${eventColor(d.color)}"></label><label>Note facultative<textarea name="note" rows="2">${esc(d.note)}</textarea></label></div>${!this._config.demo && !this._snapshot.ready?'<p class="status">Le premier enregistrement préparera l’exécution du calendrier en mode test. Un administrateur est nécessaire.</p>':''}<div class="buttons"><button class="primary" type="submit" ${this._busy?'disabled':''}>${this._busy?'Enregistrement…':d.scope==='series'?'Enregistrer la série':'Enregistrer'}</button>${this._button('Annuler','cancel')}${existing?this._button(isRecurring?'Supprimer ce jour':'Supprimer','delete','class="danger"'):''}</div>${existing && isRecurring?`<details><summary>Toute la série</summary><p class="hint">La suppression de série retire toutes ses occurrences, y compris les jours déplacés.</p>${this._button('Supprimer toute la série','delete-series','class="danger"')}</details>`:''}${d.deleteScope?`<div class="status"><p>${d.deleteScope==='series'?'Supprimer toutes les occurrences de cette série ?':'Supprimer uniquement cette occurrence ?'}</p>${this._button('Confirmer la suppression','confirm-delete','class="danger"')} ${this._button('Conserver','keep')}</div>`:''}</form>`;
  }
  _calendarOnlyFormHtml(){
    const d=this._draft;
    return `<form><div class="toolbar"><h2>Modifier cette programmation</h2>${this._button('Fermer','cancel')}</div><p class="status notice">L’horaire peut être modifié sans changer les actions existantes.</p>${recurring(d)?this._scopeHtml(d):''}<label class="field">Nom<input required name="summary" maxlength="120" value="${esc(d.summary)}"></label><label class="field">${d.scope==='series'?'Date de début de la série':'Date de cette occurrence'}<input type="date" required name="date" value="${d.date}"></label>${d.legacy?`<label class="field">Couleur<input type="color" name="color" value="${eventColor(d.color)}"></label>`:''}<h3>Heure de début</h3>${this._timeSelect('start',`${d.start_hour}:${d.start_minute}`)}<p class="hint">La durée de l’événement et ses associations existantes sont conservées.</p><label class="field">${d.legacy?'Note':'Description'}<textarea name="note" rows="3">${esc(d.note)}</textarea></label><div class="buttons"><button type="submit" class="primary" ${this._busy?'disabled':''}>${d.scope==='series'?'Enregistrer la série':'Enregistrer'}</button>${this._button('Annuler','cancel')}${this._button(recurring(d)?'Supprimer ce jour':'Supprimer','delete','class="danger"')}</div><details><summary>Actions et appareils</summary><p>Pour associer des appareils à cette programmation et utiliser les actions de début/fin de Planning :</p>${this._button('Configurer les actions','configure-actions')}</details>${recurring(d)?`<details><summary>Toute la série</summary>${this._button('Supprimer toute la série','delete-series','class="danger"')}</details>`:''}${d.deleteScope?`<div class="status"><p>${d.deleteScope==='series'?'Supprimer toute la série ?':'Supprimer uniquement ce jour ?'}</p>${this._button('Confirmer la suppression','confirm-delete','class="danger"')} ${this._button('Conserver','keep')}</div>`:''}</form>`;
  }
  _settingsHtml(){return `<section class="panel"><div class="toolbar"><h2>Réglages du planning</h2>${this._button('Fermer','settings')}</div><p class="status">${esc(this._executionLabel())}</p>${!this._config.demo && !this._snapshot.ready?this._button('Préparer l’exécution en mode test','setup','class="primary"'):''}${this._deviceSettingsHtml()}<p class="hint">Pour choisir les appareils affichés sur cette carte : Modifier la carte → Appareils proposés dans les programmations. Pour les couleurs et la vue initiale : Personnalisation.</p></section>`;}
  _render(){
    if(!this._initialized)return;
    const dialogState=this._rememberDialog();
    const a=this._config.appearance,title=new Intl.DateTimeFormat(this._locale,{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(`${this._month}-01T12:00Z`));
    this.shadowRoot.innerHTML=`<style>${PLANNING_STYLE}${INTERACTION_STYLE}${DEVICE_SETTINGS_STYLE}</style><ha-card><main data-density="${a.density}" data-event-style="${a.event_style}" ${a.accent_color?`style="--accent:${a.accent_color}"`:''}><header class="card-heading"><div class="card-title"><h1 translate="no">${esc(this._config.title)}</h1><span class="mode-pill" title="${esc(this._t(this._executionLabel()))}">${this._config.demo?'Local':!this._snapshot.ready?'À configurer':!this._snapshot.config?'Partagé':this._hass.states[this._store.automation]?.state==='off'?'Arrêté':this._snapshot.test_mode?'Test':'Actif'}</span></div><div class="heading-actions">${this._button('<span aria-hidden="true">+</span> <span class="add-label">Programmation</span>','new','class="primary" aria-label="+ Programmation" title="Nouvelle programmation" '+(!this._config.demo && !this._loaded?'disabled':''))}${this._button('<span aria-hidden="true">⚙</span> <span class="settings-label">Réglages</span>','settings','aria-label="⚙ Réglages" title="Réglages"')}</div></header>${this._error?`<div role="alert" class="status error">${esc(this._error)}</div>`:''}${this._notice?`<div role="status" class="status notice">${esc(this._notice)}</div>`:''}<nav class="calendar-toolbar" aria-label="Vue du calendrier"><div class="period-controls">${this._button('‹','previous','aria-label="Période précédente"')}<h2>${esc(title)}</h2>${this._button('›','next','aria-label="Période suivante"')}</div><div class="view-controls">${Object.entries({month:'Mois',week:'Semaine',agenda:'Agenda'}).map(([id,label])=>this._button(label,`view-${id}`,`aria-pressed="${id===this._view}"`)).join('')}${this._button('<span class="today-text">Aujourd’hui</span><span class="today-icon" aria-hidden="true">◎</span>','today','class="today-button" aria-label="Aujourd’hui" title="Aujourd’hui"')}${this._button('↻','refresh','class="refresh-button" aria-label="Actualiser"')}</div></nav>${this._calendarHtml()}<p class="hint">Cliquez pour modifier. Glissez ⠿ pour déplacer un seul jour.</p>${this._settings?this._settingsHtml():''}${this._draft?this._formHtml():''}</main></ha-card>`;
    const main=this.shadowRoot.querySelector('main'),panel=main.querySelector(':scope > form,:scope > .panel');
    if(this._draft || this._settings || this._deviceDraft){
      const dialog=document.createElement('dialog');dialog.className='planning-dialog';if(a.accent_color)dialog.style.setProperty('--accent',a.accent_color);dialog.setAttribute('aria-label',this._deviceDraft?'Appareil du planning':this._draft?'Programmation':'Réglages du planning');
      const body=document.createElement('div');body.className='dialog-body';
      if(this._deviceDraft){panel?.remove();body.innerHTML=this._deviceFormHtml();}else if(panel)body.append(panel);
      const feedback=main.querySelector('[role=alert]') || main.querySelector('[role=status]');if(feedback)body.prepend(feedback);
      body.querySelectorAll('h2').forEach(h=>h.tabIndex=-1);dialog.append(body);this.shadowRoot.append(dialog);
    }else if(this._error || this._notice){
      main.querySelector('[role=alert]')?.remove();main.querySelector('[role=status]')?.remove();
      const toast=document.createElement('div');toast.className='planning-toast'+(this._error?' error':'');toast.setAttribute('popover','manual');toast.setAttribute('role',this._error?'alert':'status');toast.innerHTML=esc(this._error || this._notice)+this._button('×','dismiss-toast','aria-label="Fermer le message"');this.shadowRoot.append(toast);
    }
    localizePlanningRoot(this.shadowRoot,this._language);
    this._restoreDialog(dialogState);
  }
  _open(event,date=this._selected){
    this._error='';this._notice='';this._settings=false;this._deviceDraft=null;
    const start=event?localMinute(event.start,this._zone):`${date}T06:00`,end=event?localMinute(event.end,this._zone):`${date}T07:00`,m=event?this._meta(event):null;
    this._draft={...(event || {}),original:event?{...event}:null,actionSnapshot:structuredClone(this._snapshot),readonly:!!event && !m,calendar:this._config.calendar || 'calendar.demo',event_id:m?.id || newEventId(),summary:event?.summary || '',date:start.slice(0,10),start_hour:start.slice(11,13),start_minute:start.slice(14,16),end_hour:end.slice(11,13),end_minute:end.slice(14,16),repeat:event?.rrule?'weekly':'once',days:[weekday(date)],has_end:m?.has_end || false,start_actions:m?structuredClone(m.start_actions):[{target:'',op:''}],end_actions:m?structuredClone(m.end_actions):[],color:m?.color || '#3689e6',note:m?.note || '',scope:'occurrence'};
    if(event){this._draft.seriesRule=seriesRule(event,this._events);this._draft.days=ruleDays(this._draft.seriesRule,weekday(start.slice(0,10)));this._draft.color=event.meta?.color || event.legacy?.color || '#3689e6';}
    this._draft.readonly=!!event && !event.uid;
    this._draft.calendarOnly=!!event?.uid && !event.meta;
    if(this._draft.calendarOnly)this._draft.note=event.legacy?.note || (event.legacy?'':event.description || '');
    this._render();
  }
  _change(event){
    const el=event.target;if(this._deviceChange(el))return;const d=this._draft;if(!d)return;
    if(el.name==='series_import'){this._importSeries(el.files?.[0],d);return;}
    const rowEl=el.closest('.action-row');
    if(rowEl){const row=d[rowEl.dataset.phase][Number(rowEl.dataset.index)];if(el.hasAttribute('data-target')){row.target=el.value;row.op=defaultOperation(this._record(row.target));this._render();}else if(el.hasAttribute('data-operation'))row.op=el.value;return;}
    if(el.dataset.weekday!==undefined){d.days=Array.from(this.shadowRoot.querySelectorAll('[data-weekday]:checked'),e=>Number(e.dataset.weekday));return;}
    if(!el.name)return;d[el.name]=el.type==='checkbox'?el.checked:el.value;
    if(el.name==='date' && !d.uid && d.repeat==='once' && /^\d{4}-\d{2}-\d{2}$/.test(d.date))d.days=[weekday(d.date)];
    if(el.name==='has_end' && d.has_end && !d.end_actions.length)d.end_actions=d.start_actions.filter(a=>a.target && oppositeOperation(a.op) && Object.hasOwn(operationsFor(this._record(a.target)),oppositeOperation(a.op))).map(a=>({target:a.target,op:oppositeOperation(a.op)}));
    if(el.name==='scope' && d.scope==='series')this._captureSeries(d);
    if(['repeat','has_end','scope'].includes(el.name))this._render();
  }
  _captureSeries(d){
    if(d.seriesSnapshot)return Promise.resolve(d.seriesSnapshot);
    if(d.seriesPending)return d.seriesPending;
    d.seriesPending=(async()=>{
      try{
        const snapshot=await this._seriesStore.read(d.original,this._events),row=this._config.demo?this._demoRows.find(row=>row.uid===snapshot.master_uid):null;
        if(row && !snapshot.complete){snapshot.complete=true;snapshot.model={dtstart:row.start,dtend:row.end,summary:row.summary,description:row.description,rrule:row.rrule};for(const rid of row.deleted || [])snapshot.exceptions[`${rid.slice(0,4)}-${rid.slice(4,6)}-${rid.slice(6,8)}`]={deleted:true};for(const [rid,item] of Object.entries(row.exceptions || {}))snapshot.exceptions[`${rid.slice(0,4)}-${rid.slice(4,6)}-${rid.slice(6,8)}`]={event:{dtstart:item.start,dtend:item.end,summary:item.summary,description:item.description},uid:row.uid,native:true,recurrence_id:rid};}
        d.seriesSnapshot=snapshot;d.series_revision=snapshot._raw || snapshot.id;
        if(!d.seriesRule){d.seriesRule=snapshot.model.rrule;d.days=ruleDays(d.seriesRule,weekday(d.date));}
        return snapshot;
      }catch(error){d.seriesError=error;return null;}
      finally{if(this._draft===d && d.scope==='series' && !this._busy)this._render();}
    })();return d.seriesPending;
  }
  async _importSeries(file,d){if(!file)return;try{const snapshot=await this._captureSeries(d);if(!snapshot)throw d.seriesError;d.seriesSnapshot=this._seriesStore.import(snapshot,await file.text());d.seriesRule=d.seriesSnapshot.model.rrule;d.days=ruleDays(d.seriesRule,weekday(d.date));d.seriesError=null;if(this._draft===d)this._error='';}catch(error){d.seriesError=error;}if(this._draft===d)this._render();}
  _draftDates(d){
    const time=`${d.start_hour}:${d.start_minute}`;
    if(d.calendarOnly){const first=d.scope==='series' && /(?:^|;)FREQ=WEEKLY(?:;|$)/i.test(d.seriesRule)?dayOf(weeklyStart(d.date,time,d.days,this._zone,Date.now(),true),this._zone):d.date;return shiftedOccurrence(d.original,first,Number(d.start_hour)*60+Number(d.start_minute),this._zone);}
    const start=((!d.uid && d.repeat==='weekly') || (d.scope==='series' && /(?:^|;)FREQ=WEEKLY(?:;|$)/i.test(d.seriesRule)))?weeklyStart(d.date,time,d.days,this._zone,Date.now(),this._config.demo || d.scope==='series'):toInstant(`${d.date}T${time}`,this._zone);
    let end=new Date(Date.parse(start)+60000).toISOString();
    if(d.has_end){let day=dayOf(start,this._zone),endTime=`${d.end_hour}:${d.end_minute}`;if(endTime<=time)day=shiftDay(day,1);end=toInstant(`${day}T${endTime}`,this._zone);}
    return {start,end};
  }
  async _freshFor(event,target,scope='occurrence'){
    const from=[dayOf(event.start,this._zone),target?dayOf(target.start,this._zone):'9999-12-31'].sort()[0],to=[dayOf(event.end,this._zone),target?dayOf(target.end,this._zone):'0000-01-01'].sort().at(-1);
    const rows=await this._fetch(shiftDay(from,-1),shiftDay(to,2)),same=rows.find(x=>x.uid===event.uid && (x.recurrence_id || '')===(event.recurrence_id || ''));
    if(!same || scheduleFingerprint(same)!==scheduleFingerprint(event))throw new Error('Cette occurrence a changé ou a été supprimée. Actualisez avant de recommencer.');
    if(scope==='series'){const today=dayOf(Date.now(),this._zone);rows.push(...await this._fetch(shiftDay(today,-1),shiftDay(today,2)));}const issue=mutationIssue(same,scope,rows);if(issue)throw new Error(issue);return rows;
  }
  async _freshForIfLive(event,target,scope='occurrence'){const issue=mutationIssue(event,scope,this._events);if(issue)throw new Error(issue);occurrenceSelector(event,scope);if(!this._config.demo)await this._freshFor(event,target,scope);}
  _demoWrite(payload){
    const row=this._demoRows.find(x=>x.uid===payload.uid);
    if(payload.type.endsWith('/delete')){if(payload.recurrence_id){row.deleted=[...(row.deleted || []),payload.recurrence_id];if(row.exceptions)delete row.exceptions[payload.recurrence_id];}else this._demoRows=this._demoRows.filter(x=>x.uid!==payload.uid);return;}
    const saved={...payload.event,start:payload.event.dtstart,end:payload.event.dtend,uid:payload.uid || newEventId()};
    if(payload.recurrence_id){row.exceptions={...row.exceptions,[payload.recurrence_id]:{...saved,rrule:''}};}else if(row){if(saved.rrule && (saved.start!==row.start || saved.rrule!==row.rrule)){row.exceptions={};row.deleted=[];}Object.assign(row,saved);}else this._demoRows.push(saved);
  }
  async _write(payload,draft){
    if(payload.type==='planning-series-update')return this._seriesStore.update(this._draft.seriesSnapshot,payload.event);
    const original=draft?.original || this._draft?.original || this._events.find(e=>e.uid===payload.uid && (!payload.recurrence_id || e.recurrence_id===payload.recurrence_id));
    if(payload.type.endsWith('/delete') && this._draft?.deleteScope==='series' && original)return this._seriesStore.deleteSeries(original);
    if(original && recurring(original) && (payload.type.endsWith('/update') || payload.type.endsWith('/delete')))return this._seriesStore.occurrence(original,payload);
    if(this._config.demo){this._demoWrite(payload);return;}
    try{await this._hass.callWS(payload);}catch(error){
      if(!draft)throw error;
      const rows=await this._fetch(shiftDay(dayOf(draft.start,this._zone),-1),shiftDay(dayOf(draft.end,this._zone),2));
      const found=rows.filter(e=>(payload.uid?e.uid===payload.uid:e.meta?.id===draft.event_id) && e.start===draft.start && e.end===draft.end && e.summary===draft.summary.trim() && (e.description || '')===payload.event.description && (!payload.recurrence_id || e.recurrence_id===payload.recurrence_id) && (!payload.event.rrule || e.rrule===payload.event.rrule));
      if(found.length!==1)throw error;
    }
  }
  async _save(){
    if(this._busy || !this._draft)return;this._busy=true;this._error='';const d=this._draft;
    try{
      if(!this._config.demo && d.pendingCreate){const pending=d.pendingCreate,rows=await this._fetch(shiftDay(dayOf(pending.start,this._zone),-1),shiftDay(dayOf(pending.end,this._zone),2));const found=rows.filter(e=>e.meta?.id===d.event_id);if(found.length){if(!found.some(e=>e.start===pending.start && e.end===pending.end && e.description===pending.description))throw new Error('Une programmation avec cet identifiant existe déjà. Actualisez avant de recommencer.');this._draft=null;this._notice='La première sauvegarde est déjà enregistrée. Ouvrez la programmation pour la modifier.';await this._load();return;}}
      if(!d.summary.trim())throw new Error('Donnez un nom à la programmation.');
      if(d.scope==='series'){if(!await this._captureSeries(d))throw d.seriesError;if(!d.seriesSnapshot.complete)throw new Error('Importez une fois le fichier ICS pour conserver toutes les exceptions de cette ancienne série.');if(!d.seriesRule)throw new Error('Règle de répétition indisponible. Ouvrez une occurrence habituelle.');d.rrule=editedWeeklyRule(d.seriesRule,d.days);}
      Object.assign(d,this._draftDates(d));
      if(d.calendarOnly){if(!this._config.demo && Date.parse(d.start)<Date.now()+20*60000)throw new Error('Prévoyez au moins 20 minutes avant le début.');await this._freshForIfLive(d.original,d,d.scope);const description=d.legacy?(d.note===(d.legacy.note || '') && eventColor(d.color)===eventColor(d.legacy.color)?d.original.description:JSON.stringify({...d.legacy,note:d.note,color:eventColor(d.color)})):d.note;await this._write(calendarEditPayload(d.original,{...d,description},d.scope),d);this._draft=null;this._notice=d.scope==='series'?'La série a été reprogrammée.':'Cette occurrence a été modifiée. Ses actions existantes sont conservées.';await this._load();return;}
      const initialIssue=validateSchedule(d,this._choices().map(r=>({...r,id:r.value})),Date.now(),this._config.demo);if(initialIssue)throw new Error(initialIssue);
      if(d.original)await this._freshForIfLive(d.original,d,d.scope);
      let actions=[...d.start_actions,...(d.has_end?d.end_actions:[])],resolved;
      if(this._config.demo){resolved=actions.map(a=>{if(a.target?.startsWith('entity:')){const r=this._record(a.target);if(!this._snapshot.records.some(x=>x.id===r.id))this._snapshot.records.push(r);return {...a,target:r.id};}return a;});}
      else{if(!this._snapshot.ready)this._snapshot=await this._store.setup(ACTION_BLUEPRINT_VERSION,this._config.execution_automation);const result=await this._store.prepare(d.actionSnapshot,actions);this._snapshot=result.snapshot;resolved=result.actions;}
      const draft={...d,start_actions:resolved.slice(0,d.start_actions.length),end_actions:d.has_end?resolved.slice(d.start_actions.length):[],rrule:!d.uid && d.repeat==='weekly'?`FREQ=WEEKLY;BYDAY=${[...d.days].sort((a,b)=>((a+6)%7)-((b+6)%7)).map(i=>['SU','MO','TU','WE','TH','FR','SA'][i]).join(',')}`:d.rrule};
      const issue=validateSchedule(draft,this._snapshot.records,Date.now(),this._config.demo);if(issue)throw new Error(issue);
      const payload=schedulePayload(draft);if(!this._config.demo){if(d.original)await this._freshFor(d.original,draft,d.scope);else d.pendingCreate={start:draft.start,end:draft.end,description:payload.event.description};}await this._write(payload,draft);this._draft=null;this._notice=d.scope==='series'?'La série a été reprogrammée.':d.uid?'Cette occurrence a été modifiée.':'Programmation enregistrée.';await this._load();
    }catch(e){this._error=e.message;}finally{this._busy=false;this._render();}
  }
  async _move(event,date,minute){
    if(this._busy || !event.uid)return;this._busy=true;this._error='';
    try{const dates=shiftedOccurrence(event,date,minute,this._zone);if(dates.start===event.start && dates.end===event.end)return;await this._freshForIfLive(event,dates);if(!this._config.demo && Date.parse(dates.start)<Date.now()+20*60000)throw new Error('Prévoyez au moins 20 minutes avant le début.');const draft={...event,...dates,event_id:event.meta?.id};await this._write(calendarEditPayload(event,dates),draft);this._draft=null;this._notice='Cette occurrence a été déplacée. Les autres jours et les actions restent inchangés.';await this._load();}catch(e){this._error=e.message;}finally{this._busy=false;this._render();}
  }
  async _delete(){
    if(this._busy || !this._draft?.original)return;this._busy=true;this._error='';const d=this._draft,event=d.original,scope=d.deleteScope;
    try{let rows=this._events;if(!this._config.demo){rows=await this._freshFor(event);if(scope==='series'){const today=dayOf(Date.now(),this._zone);rows.push(...await this._fetch(shiftDay(today,-1),shiftDay(today,2)));}}const issue=mutationIssue(event,scope,rows);if(issue)throw new Error(issue);const payload=occurrenceDeletePayload(event,scope);try{await this._write(payload);}catch(error){if(this._config.demo)throw error;const fresh=await this._fetch(shiftDay(dayOf(event.start,this._zone),-1),shiftDay(dayOf(event.end,this._zone),2));if(fresh.some(x=>x.uid===event.uid && (scope==='series' || (x.recurrence_id || '')===(event.recurrence_id || ''))))throw error;}this._draft=null;this._notice=scope==='series'?'Série supprimée.':'Cette occurrence a été supprimée.';await this._load();}catch(e){this._error=e.message;}finally{this._busy=false;this._render();}
  }
  async _click(event){
    const target=event.target.closest('button');if(!target || this._busy)return;
    if(target.dataset.event && performance.now()<(this._suppressEventClickUntil || 0))return;
    if(target.hasAttribute('data-move-handle')){const item=this._events.find(x=>x.key===target.dataset.moveHandle);if(item){this._open(item,dayOf(item.start,this._zone));this.shadowRoot.querySelector('[name=date]')?.focus({preventScroll:true});}return;}
    if(target.hasAttribute('data-remove-action')){const row=target.closest('.action-row');this._draft[row.dataset.phase].splice(Number(row.dataset.index),1);this._render();return;}
    if(target.dataset.event){const item=this._events.find(x=>x.key===target.dataset.event);if(item)this._open(item,dayOf(item.start,this._zone));return;}
    if(target.dataset.day){this._selected=target.dataset.day;this._open(null,this._selected);return;}
    const action=target.dataset.action;
    if(action?.startsWith('view-')){this._view=action.slice(5);this._render();return;}
    switch(action){
      case 'dismiss-toast':this._error='';this._notice='';this._render();break;
      case 'new':this._open(null);break;
      case 'cancel':this._draft=null;this._error='';this._render();break;
      case 'settings':this._settings=!this._settings;this._draft=null;this._render();break;
      case 'new-device':this._openDevice();break;
      case 'edit-device':this._openDevice(target.dataset.deviceId);break;
      case 'device-cancel':this._deviceDraft=null;this._settings=true;this._error='';this._render();break;
      case 'configure-actions':this._draft.calendarOnly=false;this._draft.readonly=false;this._error='';this._render();break;
      case 'add-start':case 'add-end':this._draft[action==='add-start'?'start_actions':'end_actions'].push({target:'',op:''});this._render();break;
      case 'delete':case 'delete-series':this._draft.deleteScope=action==='delete'?'occurrence':'series';this._render();break;
      case 'keep':delete this._draft.deleteScope;this._render();break;
      case 'confirm-delete':await this._delete();break;
      case 'setup':this._busy=true;try{this._snapshot=await this._store.setup(ACTION_BLUEPRINT_VERSION,this._config.execution_automation);this._notice='Exécution préparée en mode test.';this._error='';}catch(e){this._error=e.message;}finally{this._busy=false;this._render();}break;
      case 'refresh':await this._load();break;
      case 'today':this._selected=dayOf(Date.now(),this._zone);this._month=this._selected.slice(0,7);this._render();await this._load();break;
      case 'previous':case 'next':if(this._loading)return;if(this._view==='week'){this._selected=shiftDay(this._selected,action==='next'?7:-7);this._month=this._selected.slice(0,7);}else{const date=new Date(`${this._month}-01T12:00Z`);date.setUTCMonth(date.getUTCMonth()+(action==='next'?1:-1));this._month=date.toISOString().slice(0,7);this._selected=`${this._month}-01`;}this._render();await this._load();break;
    }
  }
}
Object.assign(PlanningCard.prototype,PlanningInteractions,PlanningDeviceSettings);
if(!customElements.get('ha-planning-card'))customElements.define('ha-planning-card',PlanningCard);
if(!customElements.get('ha-planning-chauffe-card'))customElements.define('ha-planning-chauffe-card',class extends PlanningCard{});
window.customCards=window.customCards || [];
if(!window.customCards.some(c=>c.type==='ha-planning-card'))window.customCards.push({type:'ha-planning-card',name:'Planning',description:'Calendrier avec actions ponctuelles ou créneaux de début et de fin.',preview:true,documentationURL:'https://github.com/Euro-Locks-Belgium/ha-planning-card'});

})();
