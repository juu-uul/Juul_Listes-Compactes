========================================================================
                      JUUL_LISTES-COMPACTES
========================================================================
Version : v1.30.0
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
- Confidentialité totale : stockage local (LocalStorage), aucun compte requis.
- Indicateur de stockage en temps réel intégré au footer.
Fiche Technique :
- Technologies : HTML5, CSS3 (Variables), JavaScript natif (ES6).
- Librairie externe : SortableJS (via CDN).
- Limite de stockage : ~5 Mo (5120 Ko) max via LocalStorage.
------------------------------------------------------------------------
2. STRUCTURE DU PROJET (CONTENU DU DOSSIER)
------------------------------------------------------------------------
Le dossier de l'application doit impérativement contenir les fichiers suivants :

 ├── index.html       -> Interface utilisateur et styles CSS (variables & thèmes)
 ├── app.js           -> Logique applicative, gestion du stockage et des événements
 ├── sw.js            -> Service Worker gérant le cache et le mode hors ligne
 ├── manifest.json    -> Fichier de configuration PWA (icônes, couleurs, nom)
 └── README.txt       -> Le présent fichier d'information et mode d'emploi

------------------------------------------------------------------------
3. MODE D'EMPLOI & INSTALLATION
------------------------------------------------------------------------

A. INSTALLATION (PWA)
L'application ne nécessite aucun téléchargement sur un App Store.
- Sur Ordinateur (Chrome/Edge/Brave) : Cliquez sur l'icône d'installation 
  (petit écran avec une flèche) située à droite dans la barre d'adresse.
- Sur Android (Chrome) : Ouvrez le menu (3 points) et sélectionnez 
  "Ajouter à l'écran d'accueil".
- Sur iOS (Safari) : Cliquez sur "Partager" (carré avec flèche vers le haut),
  puis sur "Sur l'écran d'accueil".

B. GESTION DES LISTES
- Créer une liste : Ouvrez le menu "⚙️ Menu", saisissez le nom dans le champ 
  dédié et validez.
- Replier / Déplier : Cliquez sur la flèche (▶ ou ▼) à côté du titre.
Le bouton "↕️ Replier" en haut agit sur toutes les listes en même temps.
- Renommer : Double-cliquez sur le texte du titre d'une liste, modifiez-le, 
  puis appuyez sur Entrée ou cliquez à l'extérieur.
- Supprimer : Cliquez sur la croix rouge (✕) à droite du titre.
  Les notes sont automatiquement envoyées dans l'historique.

C. GESTION DES NOTES (TÂCHES MULTILIGNES)
- Ajouter une note : Saisissez votre texte dans le champ "Ajouter..." de la 
  liste concernée et validez. 
  * Sur Ordinateur : Appuyez sur Entrée pour valider directement. Utilisez Maj+Entrée 
    pour faire un saut de ligne.
  * Sur Mobile : Utilisez la touche Entrée classique de votre clavier tactile pour faire
    un ou plusieurs sauts de ligne, puis appuyez sur le bouton "+" pour ajouter.
- Hack de Priorité (Urgent) : Si votre texte commence par un point d'exclamation
  (ex: "!Rapport annuel"), la tâche se colore en rouge vif et se place 
  automatiquement au tout début (en haut) de sa liste.
- Hack d'Incertitude / Question (À vérifier) : Si votre texte commence par un 
  point d'interrogation (ex: "?Vérifier les chiffres"), la tâche se colore en 
  jaune et s'ajoute normalement en bas de sa liste.
- Modifier : Cliquez sur l'icône crayon (✏️) à côté de la note (idéal sur mobile)
  ou double-cliquez sur le texte de la note (sur ordinateur) pour passer en mode édition.
- Supprimer : Cliquez sur la croix grise (✕) à droite de la note pour l'envoyer 
  à la corbeille.

D. GLISSER-DÉPOSER (SORTABLEJS)
- Pour réorganiser les listes : Restez appuyé sur l'icône "☰" à gauche du titre 
  et déplacez le bloc verticalement.
- Pour déplacer les notes : Restez appuyé sur la tâche pour changer son ordre 
  dans sa liste ou la transférer vers une autre liste.

E. RECHERCHE ET FILTRAGE
- Tapez un mot dans la barre de recherche supérieure pour filtrer instantanément 
  le contenu. Si un mot correspond au titre d'une liste, toute la liste reste 
  visible.
- Cliquez sur le bouton "✕" de l'input pour vider la recherche.

F. HISTORIQUE & CORBEILLE
Située en bas de page, la section "🗑️ Historique" liste les éléments supprimés.
- Cliquez sur "Restaurer" pour renvoyer la tâche dans sa liste d'origine.
- Cliquez sur la croix rouge (✕) pour une suppression définitive.
- Cliquez sur "Vider" pour effacer tout l'historique d'un coup.

------------------------------------------------------------------------
4. OPTIONS SYSTÈME & SÉCURITÉ
------------------------------------------------------------------------
Accessibles depuis le panneau "⚙️ Menu" :
- Thème (🌓 Auto) : Permet de basculer entre le mode Clair, Sombre ou Auto 
  (qui calque les couleurs sur les préférences de votre système).
- Exporter (📤) : Utilise l'API File System Access pour forcer la boîte de dialogue 
  "Enregistrer sous". Permet de choisir l'emplacement exact de la sauvegarde `.json`.
- Importer (📥) : Permet de charger un fichier de sauvegarde ".json" pour 
  restaurer vos données sur un autre appareil ou après un nettoyage.
- Reset Global : Supprime définitivement toutes les données pour repartir à zéro.

------------------------------------------------------------------------
5. HISTORIQUE DES VERSIONS (CHANGELOG)
------------------------------------------------------------------------
v1.30.0 - Prise en charge complète des notes multilignes (sauts de ligne préservés).
          Changement des champs d'entrée en textareas dynamiques.
          Ajout d'un bouton d'édition (✏️) optimisé pour l'usage tactile sur mobile.
          Gestion différenciée de la touche Entrée (Validation sur PC, Saut de ligne sur mobile).
v1.29.0 - Renommage officiel de l'application en "Juul_Listes-Compactes".
          Documentation explicite du co-développement humain-IA.
          Mise à jour des manifestes et du système de cache.
v1.28.0 - Intégration de l'API File System Access (`showSaveFilePicker`) lors de l'export.
          Force l'apparition de l'explorateur système pour choisir le dossier d'enregistrement.
          Système de secours (fallback) conservé pour les navigateurs incompatibles.
v1.27.1 - Correctif accessibilité : Ajustement des couleurs de la catégorie 'Incertain' (?)
          en mode sombre. Le texte passe au jaune/or mat pour éviter la fatigue visuelle.
v1.27.0 - Ajout d'une catégorie "Incertain / À vérifier" via le préfixe '?'.
          Ces notes s'ajoutent en bas de liste et prennent une couleur jaune.
v1.26.0 - Modification comportementale : Les notes prioritaires (débutant par '!') 
          sont désormais ajoutées au sommet de la liste à la création.
v1.25.0 - Ajout du suivi de la taille du LocalStorage dans le footer avec ratio.
v1.24.0 - Intégration du système de rappel et d'alerte visuelle de sauvegarde.
v1.20.0 - Refonte graphique ultra-compacte et gestion native du mode sombre.
v1.10.0 - Intégration de SortableJS pour le Drag & Drop des notes et des listes.
v1.00.0 - Version initiale (Création de listes, notes et persistance locale).
========================================================================