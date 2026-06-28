/**
 * Juul_Listes-Compactes
 * Version: 3.3.1
 * Description: Application PWA pour la gestion de listes, synchronisation cloud, et monitoring de veille paramétrable.
 */

const APP_VERSION = '3.3.1';

// Clés d'accès LocalStorage
const STORAGE_KEY = 'ma_pwa_compact_lists_data';
const STORAGE_CLOUD_URL_KEY = 'juul_lists_cloud_url';
const STORAGE_CLOUD_SECRET_KEY = 'juul_lists_cloud_secret';
const STORAGE_DEVICE_NAME_KEY = 'juul_lists_device_name';
const STORAGE_SYNC_INTERVAL_KEY = 'juul_lists_sync_interval';

// Variables d'état global
let appData = {
    lists: [],
    trash: [],
    lastLocalChange: Date.now(),
    lastDevice: ''
};
let syncReminderInterval = null;
let lastSyncTimestamp = Date.now();
let cloudSyncTimer = null; // Debounce timer pour saisie fluide

// Caches des éléments DOM
const inputCloudUrl = document.getElementById('input-cloud-url');
const inputCloudSecret = document.getElementById('input-cloud-secret');
const inputCloudDevice = document.getElementById('input-cloud-device');
const inputSyncInterval = document.getElementById('input-sync-interval');
const btnSync = document.getElementById('btn-sync');
const syncStatusText = document.getElementById('sync-status-text');

// --- Gestion Optimisée de la Veille et du Monitoring Énergétique ---
function startSyncMonitoring() {
    if (syncReminderInterval) return;
    
    syncReminderInterval = setInterval(() => {
        const minutesSinceLastSync = (Date.now() - lastSyncTimestamp) / 60000;
        
        // Récupération de la valeur utilisateur ou valeur par défaut (30 min)
        const userDefinedInterval = parseInt(localStorage.getItem(STORAGE_SYNC_INTERVAL_KEY)) || 30;
        
        if (minutesSinceLastSync > userDefinedInterval && btnSync) {
            btnSync.classList.add('sync-warning');
        }
    }, 60000); // Exécution de contrôle une fois par minute
}

function stopSyncMonitoring() {
    clearInterval(syncReminderInterval);
    syncReminderInterval = null;
}

// Écouteur de focus et d'état système de l'application
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        console.log(`V${APP_VERSION} : App active - Lancement de la synchronisation de contexte.`);
        lancerSynchroManuel();
        startSyncMonitoring();
    } else {
        console.log(`V${APP_VERSION} : App en tâche de fond - Coupure des processus de monitoring.`);
        stopSyncMonitoring();
    }
});

function onSyncSuccess() {
    lastSyncTimestamp = Date.now();
    if (btnSync) btnSync.classList.remove('sync-warning');
}

// --- Initialisation des Paramètres Configuration de base ---
function initConfigurationPanel() {
    inputCloudUrl.value = localStorage.getItem(STORAGE_CLOUD_URL_KEY) || '';
    inputCloudSecret.value = localStorage.getItem(STORAGE_CLOUD_SECRET_KEY) || '';
    inputCloudDevice.value = localStorage.getItem(STORAGE_DEVICE_NAME_KEY) || '';
    
    // Réglage initial par défaut (30)
    if (!localStorage.getItem(STORAGE_SYNC_INTERVAL_KEY)) {
        localStorage.setItem(STORAGE_SYNC_INTERVAL_KEY, '30');
    }
    inputSyncInterval.value = localStorage.getItem(STORAGE_SYNC_INTERVAL_KEY);

    // Écouteurs de sauvegarde à la volée
    [inputCloudUrl, inputCloudSecret, inputCloudDevice].forEach(element => {
        element.addEventListener('input', () => {
            localStorage.setItem(STORAGE_CLOUD_URL_KEY, inputCloudUrl.value.trim());
            localStorage.setItem(STORAGE_CLOUD_SECRET_KEY, inputCloudSecret.value);
            localStorage.setItem(STORAGE_DEVICE_NAME_KEY, inputCloudDevice.value.trim());
        });
    });

    // Écouteur dédié au paramètre d'intervalle de monitoring
    inputSyncInterval.addEventListener('input', () => {
        let value = parseInt(inputSyncInterval.value);
        if (isNaN(value) || value < 1) value = 1;
        localStorage.setItem(STORAGE_SYNC_INTERVAL_KEY, value.toString());
        
        // Réinitialisation dynamique du monitoring pour appliquer le nouveau délai
        if (btnSync) btnSync.classList.remove('sync-warning');
        stopSyncMonitoring();
        if (document.visibilityState === "visible") startSyncMonitoring();
    });
}

function updateCloudStatus(text, statusClass = '') {
    if (!syncStatusText) return;
    syncStatusText.textContent = text;
    syncStatusText.className = ''; 
    if (statusClass) syncStatusText.classList.add(statusClass);
}

// Appel d'amorçage manuel global
function lancerSynchroManuel() {
    const url = localStorage.getItem(STORAGE_CLOUD_URL_KEY);
    if (url && url.startsWith('http')) {
        initialiserSynchroCloud();
    }
}

async function initialiserSynchroCloud() {
    const url = localStorage.getItem(STORAGE_CLOUD_URL_KEY);
    const secret = localStorage.getItem(STORAGE_CLOUD_SECRET_KEY);
    const device = localStorage.getItem(STORAGE_DEVICE_NAME_KEY);

    if (!url || !secret || !device) {
        updateCloudStatus("⚠️ Config incomplète", "sync-danger");
        return;
    }

    updateCloudStatus("⏳ Vérification...", "sync-warning");
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({ action: 'get', secret: secret })
        });
        const result = await response.json();

        if (result.status === 'success') {
            const cloudData = result.data;
            onSyncSuccess();
            
            if (!cloudData || !cloudData.lastLocalChange) {
                // Le cloud est vierge, on envoie nos données locales
                await executerSyncCloudDirecte();
                return;
            }

            // Comparaison des versions temporelles
            if (appData.lastLocalChange === cloudData.lastLocalChange) {
                updateCloudStatus("☁️ À jour", "sync-success");
            } else if (appData.lastLocalChange > cloudData.lastLocalChange) {
                await executerSyncCloudDirecte();
            } else {
                // Détection d'un cas complexe ou conflit potentiel
                ouvrirModaleConflit(cloudData);
            }
        } else {
            updateCloudStatus("❌ Erreur d'authentification", "sync-danger");
        }
    } catch (e) {
        updateCloudStatus("🔌 Mode Hors-ligne", "sync-warning");
    }
}

async function executerSyncCloudDirecte() {
    const url = localStorage.getItem(STORAGE_CLOUD_URL_KEY);
    const secret = localStorage.getItem(STORAGE_CLOUD_SECRET_KEY);
    const device = localStorage.getItem(STORAGE_DEVICE_NAME_KEY);

    appData.lastDevice = device;
    try {
        updateCloudStatus("⏳ Envoi Cloud...", "sync-warning");
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({ action: 'set', secret: secret, data: appData })
        });
        const res = await response.json();
        if (res.status === 'success') {
            updateCloudStatus("☁️ À jour", "sync-success");
            onSyncSuccess();
        } else {
            updateCloudStatus("❌ Échec envoi", "sync-danger");
        }
    } catch (err) {
        updateCloudStatus("🔌 Échec synchro (Réseau)", "sync-warning");
    }
}

function ouvrirModaleConflit(cloudData) {
    document.getElementById('conflict-local-device').textContent = localStorage.getItem(STORAGE_DEVICE_NAME_KEY) || 'Cet appareil';
    document.getElementById('conflict-cloud-device').textContent = cloudData.lastDevice || 'Inconnu';
    document.getElementById('conflict-local-date').textContent = new Date(appData.lastLocalChange).toLocaleTimeString();
    document.getElementById('conflict-cloud-date').textContent = new Date(cloudData.lastLocalChange).toLocaleTimeString();
    
    document.getElementById('conflict-local-volume').textContent = JSON.stringify(appData).length + " octets";
    document.getElementById('conflict-cloud-volume').textContent = JSON.stringify(cloudData).length + " octets";

    const modal = document.getElementById('modal-conflit');
    modal.classList.remove('hidden');

    // Branchement unique des résolutions
    document.getElementById('btn-resolve-merge').onclick = () => resoudreConflitFusion(cloudData);
    document.getElementById('btn-resolve-accept-cloud').onclick = () => {
        appData = cloudData;
        saveToBrowser();
        location.reload();
    };
    document.getElementById('btn-resolve-force-local').onclick = () => {
        appData.lastLocalChange = Date.now();
        saveToBrowser();
        document.getElementById('modal-conflit').classList.add('hidden');
        executerSyncCloudDirecte();
    };
}

function resoudreConflitFusion(cloudData) {
    // Exemple d'algorithme de fusion non destructif structurellement
    cloudData.lists.forEach(cloudList => {
        const localList = appData.lists.find(l => l.id === cloudList.id);
        if (!localList) {
            appData.lists.push(cloudList);
        } else {
            cloudList.items.forEach(cItem => {
                if (!localList.items.some(lItem => lItem.id === cItem.id)) {
                    localList.items.push(cItem);
                }
            });
        }
    });
    appData.lastLocalChange = Date.now();
    saveToBrowser();
    document.getElementById('modal-conflit').classList.add('hidden');
    executerSyncCloudDirecte();
}

function saveToBrowser() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function loadFromBrowser() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        try { appData = JSON.parse(data); } catch(e) { console.error("Data corrompue"); }
    }
}

// Initialisation globale de l'application au chargement
window.addEventListener('DOMContentLoaded', () => {
    initConfigurationPanel();
    loadFromBrowser();
    if (document.visibilityState === "visible") {
        startSyncMonitoring();
        lancerSynchroManuel();
    }
    if (btnSync) btnSync.onclick = lancerSynchroManuel;
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('PWA SW : Connecté.'))
            .catch(err => console.error('PWA SW : Erreur', err));
    });
}