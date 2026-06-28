========================================================================
                      JUUL_LISTES-COMPACTES
========================================================================
Version : v4.1.0 (Mode Focus Journalier)
Type    : Progressive Web App (PWA)
Licence : Libre / Open Source

------------------------------------------------------------------------
⚠️ AVIS DE DÉVELOPPEMENT
Ce projet et ses révisions de code associées ont été co-développés et 
optimisés à l'aide d'une Intelligence Artificielle (IA).
------------------------------------------------------------------------

1. PRÉSENTATION DE L'APPLICATION
Juul_Listes-Compactes est un gestionnaire de tâches et de listes épuré,
conçu pour offrir une productivité maximale sans fioritures.
L'interface a été densifiée au maximum pour éliminer le défilement inutile et 
permettre une vision globale d'un seul coup d'œil.

Caractéristiques principales :
- Refonte structurelle du code pour une maintenabilité accrue.
- Interface ultra-compacte et minimaliste.
- Fonctionnement 100% hors ligne (grâce au Service Worker).
- Installation native sur PC, Mac, Android et iOS (PWA).
- Organisation dynamique par Glisser-Déposer (SortableJS).
- Mode "Focus" temporel avec reset quotidien à minuit.
- Système visuel d'urgence et de statut (Code couleur Rouge/Jaune/Bleu).
- Recherche et filtrage instantanés.
- Synchronisation cloud automatique via API Google Apps Script.
- Sécurité renforcée : Clés locales sans exposition externe.
- Gestion intelligente des conflits avec option de fusion non-destructive.
- Bulle de synchronisation avec remplissage complet Vert/Orange/Rouge.
- Paramétrage personnalisé de la temporisation (debounce) d'envoi automatique.

Fiche Technique :
- Technologies : HTML5, CSS3, JavaScript natif (ES6).
- Librairie externe : SortableJS (via CDN).
- Limite de stockage local : ~5 Mo (5120 Ko) max via LocalStorage.

------------------------------------------------------------------------
2. STRUCTURE DU PROJET (CONTENU DU DOSSIER)
Le dossier de l'application doit impérativement contenir les fichiers suivants :

 ├── index.html       -> Interface utilisateur, styles CSS, modale de conflit
 ├── app.js           -> Logique applicative, séparation des modules et synchro API
 ├── sw.js            -> Service Worker gérant le cache
 ├── manifest.json    -> Fichier de configuration PWA (icônes, couleurs, nom)
 └── README.txt       -> Le présent fichier d'information et mode d'emploi

------------------------------------------------------------------------
3. LE SYSTÈME CLOUD & PROTOCOLE SÉCURITÉ SESSIONS
Pour activer la synchronisation automatique :
1. Ouvrez le volet "⚙️".
2. Renseignez obligatoirement le champ "Nom unique de cet appareil".
3. Collez votre URL Google Apps Script et saisissez votre clé secrète.
4. Ajustez le champ "Délai d'inactivité avant envoi (en secondes)".

CODE COULEUR ET REMPLISSAGE DE LA BULLE FLOTTANTE :
- 🟢 VERT : L'application est synchronisée et parfaitement à jour.
- 🟠 ORANGE : Opération en cours, attente de fin de saisie ou déconnexion.
- 🔴 ROUGE : Erreur réseau, authentification défaillante ou conflit.

MOTEUR DE RÉSOLUTION DES CONFLITS (FUSION NON-DESTRUCTIVE) :
Si un conflit survient, l'interface propose 3 options :
- 🔵 FUSION (Recommandé) : Additionne les listes et notes locales et Cloud.
- 🟢 TÉLÉCHARGER LE CLOUD : Écrase vos données locales.
- 🟠 FORCER LE LOCAL : Écrase les données distantes.

------------------------------------------------------------------------
4. MODE D'EMPLOI CLASSIQUE

A. INSTALLATION (PWA)
- Sur Ordinateur : Cliquez sur l'icône d'installation dans la barre d'adresse.
- Sur Android : Menu Chrome (3 points) > "Ajouter à l'écran d'accueil".
- Sur iOS : Safari > "Partager" > "Sur l'écran d'accueil".

B. GESTION DES LISTES
- Créer une liste : Ouvrez "⚙️", saisissez le nom et validez.
- Replier / Déplier : Cliquez sur la flèche (▶ ou ▼).
- Renommer : Double-cliquez sur le titre de la liste.
- Supprimer : Cliquez sur la croix rouge (✕) à droite du titre.

C. GESTION DES NOTES
- Ajouter : Saisissez votre texte dans le champ "Ajouter...".
- Mode Focus (🎯) : Cliquez sur la cible pour mettre une tâche en focus
  pour la journée. Un bord bleu apparaît. Appuyez sur la cible dans la 
  barre de recherche pour ne voir que vos priorités de la journée.
- Code d'Urgence (!) : Commencez par '!' pour colorer en rouge.
- Code d'Incertitude (?) : Commencez par '?' pour colorer en jaune.
- Modifier : Double-cliquez sur la note pour édition instantanée.
- Supprimer : Cliquez sur la croix grise (✕) à droite.

------------------------------------------------------------------------
5. HISTORIQUE DES VERSIONS (CHANGELOG)
v4.1.0 - Ajout du mode "Focus" journalier (reset à minuit) avec bouton 
          de filtrage et marqueur visuel sur la bordure gauche.
v4.0.0 - Refonte majeure : Séparation CSS/JS, modularisation, mode strict.
v3.3.0 - Ajout animation de la bulle lors d'un sync.
v3.2.0 - Ajout sync-on-focus.
v3.1.0 - Nouvelle fenêtre de gestion de conflits.
v3.0.0 - Ajout de la stratégie de conflit "Last Write Wins".
v2.10.0 - Optimisation ergonomique : boutons et champs de saisie agrandis.
v2.9.0 - Mise à jour de maintenance.
v2.8.0 - Ajout d'une option de fusion (merge) non-destructive.
v2.7.0 - Amélioration des performances et de la résilience.
v2.6.0 - Refonte visuelle de la bulle flottante.
v2.5.0 - Amélioration de l'écran de conflit.
v2.4.0 - Ajout du paramètre numérique pour le délai de debounce.
v2.3.0 - Ajout du système de code couleur dynamique.
v2.2.0 - Ajout du nom d'appareil unique obligatoire.
========================================================================