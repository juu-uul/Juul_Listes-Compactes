========================================================================
                      JUUL_LISTES-COMPACTES
========================================================================
Version : v2.0.0 (Mise à jour Cloud Majeure)
Type    : Progressive Web App (PWA)
Licence : Libre / Open Source
Note    : Cette application est fièrement co-développée avec l'aide 
          d'une Intelligence Artificielle (IA).
========================================================================

------------------------------------------------------------------------
1. PRÉSENTATION DE L'APPLICATION
------------------------------------------------------------------------
Juul_Listes-Compactes est un gestionnaire de tâches et de listes épuré,
conçu pour offrir une productivité maximale sans fioritures.
L'interface a été densifiée au maximum pour éliminer le défilement inutile et 
permettre une vision globale d'un seul coup d'œil.

Caractéristiques principales :
- Co-développement assisté par IA pour un code agile et optimisé.
- Interface ultra-compacte et minimaliste.
- Fonctionnement 100% hors ligne (grâce au Service Worker).
- Installation native sur PC, Mac, Android et iOS (PWA).
- Organisation dynamique par Glisser-Déposer (SortableJS).
- Système visuel d'urgence et de statut (Code couleur Rouge/Jaune).
- Recherche et filtrage instantanés.
- NOUVEAU V2.0.0 : Synchronisation cloud automatique via API Google Apps Script.
- Sécurité renforcée : Vos clés cloud restent locales, rien n'est exposé sur GitHub.
- Gestion intelligente des conflits multi-appareils via doubles marqueurs temporels.
- Sauvegarde locale d'urgence par fichier JSON conservée.

Fiche Technique :
- Technologies : HTML5, CSS3, JavaScript natif (ES6).
- Librairie externe : SortableJS (via CDN).
- Limite de stockage local : ~5 Mo (5120 Ko) max via LocalStorage.

------------------------------------------------------------------------
2. STRUCTURE DU PROJET (CONTENU DU DOSSIER)
------------------------------------------------------------------------
Le dossier de l'application doit impérativement contenir les fichiers suivants :

 ├── index.html       -> Interface utilisateur, styles CSS compacts et panneau Cloud
 ├── app.js           -> Logique applicative, moteur de debounce (10s) et synchro API
 ├── sw.js            -> Service Worker gérant le cache v2.0.0 et le mode dégradé
 ├── manifest.json    -> Fichier de configuration PWA (icônes, couleurs, nom)
 └── README.txt       -> Le présent fichier d'information et mode d'emploi

------------------------------------------------------------------------
3. LE NOUVEAU SYSTÈME CLOUD (V2.0.0)
------------------------------------------------------------------------
Pour activer la synchronisation automatique :
1. Ouvrez le volet "⚙️ Menu".
2. Dans la section "☁️ Synchronisation Cloud", collez votre URL Google Apps Script.
3. Saisissez votre clé secrète.
4. L'application vérifie l'état et affiche un indicateur dans le footer.

Fonctionnement de l'automatisation :
- Anti-Rebond (Debounce 10s) : Les données sont écrites immédiatement en local, 
  mais l'envoi cloud attend 10 secondes d'inactivité complète pour préserver les quotas.
- Sauvegarde à la fermeture : Si vous fermez l'onglet pendant le décompte des 10s, 
  un système d'urgence transmet les données de manière synchrone via l'API Keepalive.
- Résolution des conflits : Au démarrage, l'application compare les timestamps 
  de modification locale et cloud. La version la plus récente l'emporte automatiquement.

------------------------------------------------------------------------
4. MODE D'EMPLOI CLASSIQUE
------------------------------------------------------------------------

A. INSTALLATION (PWA)
- Sur Ordinateur : Cliquez sur l'icône d'installation dans la barre d'adresse.
- Sur Android : Menu Chrome (3 points) > "Ajouter à l'écran d'accueil".
- Sur iOS : Safari > "Partager" > "Sur l'écran d'accueil".

B. GESTION DES LISTES
- Créer une liste : Ouvrez "⚙️ Menu", saisissez le nom et validez.
- Replier / Déplier : Cliquez sur la flèche (▶ ou ▼) à côté du titre.
- Renommer : Double-cliquez sur le texte du titre d'une liste, modifiez-le, puis Entrée.
- Supprimer : Cliquez sur la croix rouge (✕) à droite du titre (historisé).

C. GESTION DES NOTES
- Ajouter une note : Saisissez votre texte dans le champ "Ajouter...". La zone s'agrandit seule.
  * Sur Ordinateur : Entrée pour valider, Maj+Entrée pour un saut de ligne.
  * Sur Mobile : Touche Entrée du clavier virtuel pour sauter une ligne, bouton "+" pour ajouter.
- Code d'Urgence (!) : Commencez par '!' (ex: "!Urgent") pour colorer en rouge et épingler en haut.
- Code d'Incertitude (?) : Commencez par '?' (ex: "?À vérifier") pour colorer en jaune en bas de liste.
- Modifier : Double-cliquez sur la note (PC et Mobile) pour passer en édition instantanée.
- Supprimer : Cliquez sur la croix grise (✕) à droite pour envoyer à l'historique.

------------------------------------------------------------------------
5. HISTORIQUE DES VERSIONS (CHANGELOG)
------------------------------------------------------------------------
v2.0.0 - Refonte majeure. Intégration de la synchronisation cloud automatique. 
         Mise en place d'un debounce d'inactivité fixé à 10 secondes. 
         Gestion des architectures multi-appareils (lastLocalChange et lastCloudSync). 
         Création de l'interface de configuration sécurisée et masquée.
v1.34.1 - Amélioration restauration : Les notes prioritaires ('!') sont réinsérées au sommet.
v1.34.0 - Correctif flex-shrink pour empêcher le débordement des boutons de titre longs.
v1.33.0 - Troncature dynamique CSS (text-overflow) sur les titres de listes volumineux.
v1.32.0 - Hauteur dynamique automatique des textareas à la saisie et à la modification.
v1.31.0 - Uniformisation tactile : Suppression du bouton crayon, édition par double-clic partout.
v1.30.0 - Support complet des notes multilignes avec comportement d'Entrée différencié PC/Mobile.
v1.29.0 - Renommage officiel de l'application en "Juul_Listes-Compactes" et mention IA.
v1.28.0 - Intégration optionnelle de l'API File System Access (showSaveFilePicker) pour l'export.
========================================================================