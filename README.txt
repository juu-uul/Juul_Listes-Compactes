========================================================================
                      JUUL_LISTES-COMPACTES
========================================================================
Version : v4.0.0 (Refonte technique et modularisation)
Type    : Progressive Web App (PWA)
Licence : Libre / Open Source

------------------------------------------------------------------------
⚠️ AVIS DE DÉVELOPPEMENT
Ce projet et ses révisions de code associées ont été co-développés et 
optimisés à l'aide d'une Intelligence Artificielle (IA).
------------------------------------------------------------------------

1. PRÉSENTATION DE L'APPLICATION
Juul_Listes-Compactes est un gestionnaire de tâches et de listes épuré,
conçu pour offrir une productivité maximale sans fioritures[cite: 5].
L'interface a été densifiée au maximum pour éliminer le défilement inutile et 
permettre une vision globale d'un seul coup d'œil[cite: 5].

Caractéristiques principales :
- Refonte structurelle du code pour une maintenabilité accrue.
- Interface ultra-compacte et minimaliste[cite: 5].
- Fonctionnement 100% hors ligne (grâce au Service Worker)[cite: 5].
- Installation native sur PC, Mac, Android et iOS (PWA)[cite: 5].
- Organisation dynamique par Glisser-Déposer (SortableJS)[cite: 5].
- Système visuel d'urgence et de statut (Code couleur Rouge/Jaune)[cite: 5].
- Recherche et filtrage instantanés[cite: 5].
- Synchronisation cloud automatique via API Google Apps Script[cite: 5].
- Sécurité renforcée : Clés locales sans exposition externe[cite: 5].
- Gestion intelligente des conflits avec option de fusion non-destructive[cite: 5].
- Bulle de synchronisation avec remplissage complet Vert/Orange/Rouge[cite: 5].
- Paramétrage personnalisé de la temporisation (debounce) d'envoi automatique[cite: 5].

Fiche Technique :
- Technologies : HTML5, CSS3, JavaScript natif (ES6)[cite: 5].
- Librairie externe : SortableJS (via CDN)[cite: 5].
- Limite de stockage local : ~5 Mo (5120 Ko) max via LocalStorage[cite: 5].

------------------------------------------------------------------------
2. STRUCTURE DU PROJET (CONTENU DU DOSSIER)
Le dossier de l'application doit impérativement contenir les fichiers suivants :

 ├── index.html       -> Interface utilisateur, styles CSS, modale de conflit[cite: 5]
 ├── app.js           -> Logique applicative, séparation des modules et synchro API[cite: 5]
 ├── sw.js            -> Service Worker gérant le cache[cite: 5]
 ├── manifest.json    -> Fichier de configuration PWA (icônes, couleurs, nom)[cite: 5]
 └── README.txt       -> Le présent fichier d'information et mode d'emploi[cite: 5]

------------------------------------------------------------------------
3. LE SYSTÈME CLOUD & PROTOCOLE SÉCURITÉ SESSIONS
Pour activer la synchronisation automatique :
1. Ouvrez le volet "⚙️"[cite: 5].
2. Renseignez obligatoirement le champ "Nom unique de cet appareil"[cite: 5].
3. Collez votre URL Google Apps Script et saisissez votre clé secrète[cite: 5].
4. Ajustez le champ "Délai d'inactivité avant envoi (en secondes)"[cite: 5].

CODE COULEUR ET REMPLISSAGE DE LA BULLE FLOTTANTE :
- 🟢 VERT : L'application est synchronisée et parfaitement à jour[cite: 5].
- 🟠 ORANGE : Opération en cours, attente de fin de saisie ou déconnexion[cite: 5].
- 🔴 ROUGE : Erreur réseau, authentification défaillante ou conflit[cite: 5].

MOTEUR DE RÉSOLUTION DES CONFLITS (FUSION NON-DESTRUCTIVE) :
Si un conflit survient, l'interface propose 3 options :
- 🔵 FUSION (Recommandé) : Additionne les listes et notes locales et Cloud[cite: 5].
- 🟢 TÉLÉCHARGER LE CLOUD : Écrase vos données locales[cite: 5].
- 🟠 FORCER LE LOCAL : Écrase les données distantes[cite: 5].

------------------------------------------------------------------------
4. MODE D'EMPLOI CLASSIQUE

A. INSTALLATION (PWA)
- Sur Ordinateur : Cliquez sur l'icône d'installation dans la barre d'adresse[cite: 5].
- Sur Android : Menu Chrome (3 points) > "Ajouter à l'écran d'accueil"[cite: 5].
- Sur iOS : Safari > "Partager" > "Sur l'écran d'accueil"[cite: 5].

B. GESTION DES LISTES
- Créer une liste : Ouvrez "⚙️", saisissez le nom et validez[cite: 5].
- Replier / Déplier : Cliquez sur la flèche (▶ ou ▼)[cite: 5].
- Renommer : Double-cliquez sur le titre de la liste[cite: 5].
- Supprimer : Cliquez sur la croix rouge (✕) à droite du titre[cite: 5].

C. GESTION DES NOTES
- Ajouter : Saisissez votre texte dans le champ "Ajouter..."[cite: 5].
- Code d'Urgence (!) : Commencez par '!' pour colorer en rouge[cite: 5].
- Code d'Incertitude (?) : Commencez par '?' pour colorer en jaune[cite: 5].
- Modifier : Double-cliquez sur la note pour édition instantanée[cite: 5].
- Supprimer : Cliquez sur la croix grise (✕) à droite[cite: 5].

------------------------------------------------------------------------
5. HISTORIQUE DES VERSIONS (CHANGELOG)
v4.0.0 - Refonte majeure : Séparation CSS/JS, modularisation, mode strict.
v3.3.0 - Ajout animation de la bulle lors d'un sync.
v3.2.0 - Ajout sync-on-focus.
v3.1.0 - Nouvelle fenêtre de gestion de conflits.
v3.0.0 - Ajout de la stratégie de conflit "Last Write Wins".
v2.10.0 - Optimisation ergonomique : boutons et champs de saisie agrandis[cite: 5].
v2.9.0 - Mise à jour de maintenance[cite: 5].
v2.8.0 - Ajout d'une option de fusion (merge) non-destructive[cite: 5].
v2.7.0 - Amélioration des performances et de la résilience[cite: 5].
v2.6.0 - Refonte visuelle de la bulle flottante[cite: 5].
v2.5.0 - Amélioration de l'écran de conflit[cite: 5].
v2.4.0 - Ajout du paramètre numérique pour le délai de debounce[cite: 5].
v2.3.0 - Ajout du système de code couleur dynamique[cite: 5].
v2.2.0 - Ajout du nom d'appareil unique obligatoire[cite: 5].
========================================================================