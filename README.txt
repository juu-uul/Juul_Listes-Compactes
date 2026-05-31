========================================================================
                      JUUL_LISTES-COMPACTES
========================================================================
Version : v2.7.0 (Optimisation du cache avec Stale-While-Revalidate)
Type    : Progressive Web App (PWA)
Licence : Libre / Open Source

------------------------------------------------------------------------
⚠️ AVIS DE DÉVELOPPEMENT
Ce projet et ses révisions de code associées (notamment le volet d'arbitrage 
et d'analyse fine des structures de listes locales/cloud v2.7) ont été 
co-développés et optimisés à l'aide d'une Intelligence Artificielle (IA).
------------------------------------------------------------------------

1. PRÉSENTATION DE L'APPLICATION
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
- Synchronisation cloud automatique via API Google Apps Script.
- Sécurité renforcée : Clés locales sans exposition externe.
- Gestion intelligente des conflits multi-appareils via doubles marqueurs temporels.
- Bulle de synchronisation avec remplissage complet Vert/Orange/Rouge.
- Paramétrage personnalisé de la temporisation (debounce) d'envoi automatique.
- Modale d'arbitrage de conflit haute précision (seconde, état récent, arborescence).
- Sauvegarde locale d'urgence par fichier JSON conservée.
Fiche Technique :
- Technologies : HTML5, CSS3, JavaScript natif (ES6).
- Librairie externe : SortableJS (via CDN).
- Limite de stockage local : ~5 Mo (5120 Ko) max via LocalStorage.
------------------------------------------------------------------------
2. STRUCTURE DU PROJET (CONTENU DU DOSSIER)
Le dossier de l'application doit impérativement contenir les fichiers suivants :

 ├── index.html       -> Interface utilisateur, styles CSS compacts, modale de conflit
 ├── app.js           -> Logique applicative, gestion du debounce et synchro API
 ├── sw.js            -> Service Worker gérant le cache v2.7.0 (Stale-While-Revalidate)
 ├── manifest.json    -> Fichier de configuration PWA (icônes, couleurs, nom)
 └── README.txt       -> Le présent fichier d'information et mode d'emploi

------------------------------------------------------------------------
3. LE SYSTÈME CLOUD & PROTOCOLE SÉCURITÉ SESSIONS (v2.7.0)
Pour activer la synchronisation automatique :
1. Ouvrez le volet "⚙️".
2. Renseignez obligatoirement le champ "Nom unique de cet appareil" (Ex: iPhone Juul, Mac Pro...).
-> Les champs de clé/URL cloud restent verrouillés tant que l'appareil n'a pas de nom.
3. Collez votre URL Google Apps Script et saisissez votre clé secrète.
4. Ajustez le champ "Délai d'inactivité avant envoi (en secondes)" si vous souhaitez 
   accélérer ou retarder le déclenchement de la mise à jour automatique (10s par défaut).
CODE COULEUR ET REMPLISSAGE DE LA BULLE FLOTTANTE :
La bulle de synchronisation se remplit désormais intégralement selon l'état actuel de l'application.
La lisibilité des textes et des icônes est préservée par un ajustement automatique des contrastes :
- 🟢 VERT : L'application est synchronisée et parfaitement à jour ("À jour").
- 🟠 ORANGE : Opération en cours, attente de fin de saisie ou déconnexion ("Connexion cloud...", "En attente...").
- 🔴 ROUGE : Erreur réseau, authentification défaillante ou interception de sécurité ("Conflit détecté", "Serveur inaccessible").
MOTEUR DE RÉSOLUTION DES CONFLITS (HAUTE GRANULARITÉ) :
À chaque initialisation, rafraîchissement ou appel manuel, si le dernier appareil ayant 
écrit sur le cloud est différent de l'appareil actuel ET qu'un écart temporel existe, 
l'interface modale comparative s'affiche.
- Ligne Date modif : Le minutage intègre la précision à la seconde (:ss) et injecte 
  un tag vert brillant "✨ (Plus récent)" sur l'élément le plus récent pour guider l'œil.
- Ligne Volume : Le résumé quantitatif affiche un listing dynamique complet de chaque 
  liste présente localement et sur le cloud, suivi de son nombre de notes.
L'arborescence est 
  calée par le haut pour une lecture fluide même en cas de structure dissymétrique.
------------------------------------------------------------------------
4. MODE D'EMPLOI CLASSIQUE

A. INSTALLATION (PWA)
- Sur Ordinateur : Cliquez sur l'icône d'installation dans la barre d'adresse.
- Sur Android : Menu Chrome (3 points) > "Ajouter à l'écran d'accueil".
- Sur iOS : Safari > "Partager" > "Sur l'écran d'accueil".
B. GESTION DES LISTES
- Créer une liste : Ouvrez "⚙️", saisissez le nom et validez.
- Replier / Déplier : Cliquez sur la flèche (▶ ou ▼) à côté du titre.
- Renommer : Double-cliquez sur le texte du titre d'une liste, modifiez-le, puis Entrée.
- Supprimer : Cliquez sur la croix rouge (✕) à droite du titre (historisé).
C. GESTION DES NOTES
- Ajouter une note : Saisissez votre texte dans le champ "Ajouter...". La zone s'agrandit seule.
* Sur Ordinateur : Entrée pour valider, Maj+Entrée pour un saut de ligne.
* Sur Mobile : Touche Entrée du clavier virtuel, bouton "+" large pour ajouter.
- Code d'Urgence (!) : Commencez par '!' (ex: "!Urgent") pour colorer en rouge et épingler en haut.
- Code d'Incertitude (?) : Commencez par '?' (ex: "?À vérifier") pour colorer en jaune en bas de liste.
- Modifier : Double-cliquez sur la note pour passer en édition instantanée.
- Supprimer : Cliquez sur la croix grise (✕) à droite pour envoyer à l'historique.
------------------------------------------------------------------------
5. HISTORIQUE DES VERSIONS (CHANGELOG)
v2.7.0 - Amélioration des performances et de la résilience hors ligne via la stratégie
         de cache "Stale-While-Revalidate" dans le Service Worker. Chargement instantané
         des ressources locales avec mise à jour transparente en arrière-plan, tout en 
         sécurisant les flux dynamiques de l'API Google Apps Script.
v2.6.0 - Refonte visuelle de la bulle flottante de synchronisation : passage à un
         remplissage complet (background-color) pour une meilleure visibilité,
         avec adaptation dynamique de la couleur du texte (clair/sombre) pour
         garantir une lisibilité optimale sans altérer les fonctionnalités.
v2.5.0 - Amélioration de l'écran de conflit : ajout des secondes dans le formatage, 
         mise en valeur automatique de l'élément le plus récent et déploiement 
         détaillé (sous forme de listes) du nom et du volume de notes de chaque conteneur.
v2.4.0 - Ajout d'un paramètre numérique de configuration dans le menu d'options 
         permettant de modifier à la volée le délai de debounce (attente d'inactivité) 
         avant exécution de la synchronisation cloud en arrière-plan.
v2.3.0 - Ajout d'un systeme de code couleur dynamique (Vert/Orange/Rouge) sur la bulle
         flottante de synchronisation en fonction des états du réseau et de traitement cloud.
v2.2.0 - Ajout du nom d'appareil unique obligatoire pour la synchronisation.
         Implémentation du pare-feu anti-conflit au lancement avec interface de 
         validation et tableau comparatif de granularité.
v2.0.6 - Ergonomie tactile : Doublement du padding horizontal des boutons d'en-tête (↕️ et ⚙️) 
         et élargissement de l'écart à 8px au sein de la zone d'action des listes.
v2.0.5 - Correction géométrique : Limitation de la course de la bulle de synchro aux frontières 
         de l'application (650px) sur PC et ajout d'un padding d'évitement sur le footer.
v2.0.4 - Amélioration structurelle : Déplacement du bloc de statut Cloud et du bouton de synchro 
         dans une bulle flottante fixe en bas à droite de l'écran.
========================================================================