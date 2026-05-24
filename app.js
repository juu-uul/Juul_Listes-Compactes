// ==========================================
// 0. ENREGISTREMENT DU SERVICE WORKER (PWA)
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('PWA : Service Worker enregistré ! Scope :', reg.scope))
            .catch(err => console.error('PWA : Échec de l\'enregistrement du Service Worker :', err));
    });
}

// ==========================================
// 1. VARIABLES GLOBALES & SÉLECTEURS
// ==========================================
const formAddList = document.getElementById('form-add-list');
const inputListName = document.getElementById('input-list-name');
const inputSearch = document.getElementById('input-search');
const listsContainer = document.getElementById('lists-container');
const trashContainer = document.getElementById('trash-container');
const alertContainer = document.getElementById('alert-container');
const backupTimestamps = document.getElementById('backup-timestamps');
const btnReset = document.getElementById('btn-reset');
const btnTheme = document.getElementById('btn-theme');

const STORAGE_KEY = 'ma_pwa_compact_lists_data';
let appData = { lists: [], trash: [], trashCollapsed: true, panelCollapsed: true, themeMode: 'auto', lastExport: null, lastImport: null };
let searchQuery = '';

// ==========================================
// 2. INIATLISATION & PERSISTANCE
// ==========================================
function init() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
        try {
            appData = JSON.parse(savedData);
            if (!appData.trash) appData.trash = [];
            if (appData.lastExport === undefined) appData.lastExport = null;
            if (appData.lastImport === undefined) appData.lastImport = null;
            if (appData.panelCollapsed === undefined) appData.panelCollapsed = true;
            if (appData.themeMode === undefined) appData.themeMode = 'auto';
        } catch (e) {
            resetToDefault();
        }
    } else {
        resetToDefault();
    }

    // Appliquer directement l'état plié/déplié du panneau au démarrage
    const panel = document.getElementById('control-panel');
    if (appData.panelCollapsed) {
        panel.classList.add('hidden');
    } else {
        panel.classList.remove('hidden');
    }

    // Appliquer les styles graphiques du thème configuré
    applyThemeEngine();

    // Écouteur pour le filtrage en temps réel
    inputSearch.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderAll();
    });

    renderAll();
}

function resetToDefault() {
    appData = {
        lists: [
            { id: 'l1', name: 'À faire', collapsed: false, notes: [{ id: 1, text: '!Tâche urgente exemple', createdStr: formatDate(new Date()) }, { id: 2, text: 'Tâche normale compacte', createdStr: formatDate(new Date()) }] },
            { id: 'l2', name: 'En cours', collapsed: false, notes: [] }
        ],
        trash: [],
        trashCollapsed: true,
        panelCollapsed: true,
        themeMode: 'auto',
        lastExport: null,
        lastImport: null
    };
}

function saveToBrowser() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

// ==========================================
// 3. GESTION DU THÈME DYNAMIQUE
// ==========================================
function applyThemeEngine() {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (appData.themeMode === 'dark' || (appData.themeMode === 'auto' && systemPrefersDark)) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    
    if (appData.themeMode === 'auto') {
        btnTheme.innerHTML = '🌓 Auto';
    } else if (appData.themeMode === 'dark') {
        btnTheme.innerHTML = '🌙 Sombre';
    } else {
        btnTheme.innerHTML = '☀️ Clair';
    }
}

window.toggleTheme = () => {
    if (appData.themeMode === 'auto') {
        appData.themeMode = 'light';
    } else if (appData.themeMode === 'light') {
        appData.themeMode = 'dark';
    } else {
        appData.themeMode = 'auto';
    }
    
    saveToBrowser();
    applyThemeEngine();
};

// ==========================================
// 4. MOTEUR DE RENDU (DOM & RENDU)
// ==========================================
function renderAll() {
    checkBackupReminder();

    backupTimestamps.innerHTML = `Dernier export : <b>${formatDate(appData.lastExport)}</b> | Dernier import : <b>${formatDate(appData.lastImport)}</b>`;

    // --- RENDU DES LISTES ACTIVES ---
    listsContainer.innerHTML = '';
    appData.lists.forEach((list, listIndex) => {
        const matchesListTitle = list.name.toLowerCase().includes(searchQuery);
        const filteredNotes = list.notes.map((note, originalIndex) => ({ ...note, originalIndex }))
            .filter(note => note.text.toLowerCase().includes(searchQuery) || matchesListTitle);

        if (searchQuery !== '' && !matchesListTitle && filteredNotes.length === 0) {
            return;
        }

        const listBlock = document.createElement('div');
        listBlock.className = 'list-block';
        listBlock.dataset.id = list.id;

        listBlock.innerHTML = `
            <div class="list-header">
                <div class="list-title-zone" onclick="enableInlineEdit(event, ${listIndex})">
                    <span style="color: #adb5bd; font-size:10px;">☰</span>
                    <span class="list-title-text">${escapeHTML(list.name)} (${list.notes.length})</span>
                </div>
                <div>
                    <button class="btn-toggle" onclick="toggleList(${listIndex})">${list.collapsed ? '▶' : '▼'}</button>
                    <button class="delete-btn" style="background:none; color:var(--danger); padding:2px;" onclick="deleteList(${listIndex})">✕</button>
                </div>
            </div>
            <div class="list-content ${list.collapsed ? 'collapsed' : ''}">
                <form onsubmit="addNote(event, ${listIndex})" class="input-group">
                    <input type="text" placeholder="Ajouter... (! pour urgent)" required autocomplete="off">
                    <button type="submit">+</button>
                </form>
                <ul class="notes-dropzone" data-list-index="${listIndex}">
                    ${filteredNotes.map((note) => {
                        const parsed = getNoteDisplay(note.text);
                        return `
                            <li class="note-item ${parsed.isPriority ? 'priority-high' : ''}" data-id="${note.id}">
                                <div class="note-main" ondblclick="enableNoteEdit(event, ${listIndex}, ${note.originalIndex})">
                                    <span class="note-text-span">${escapeHTML(parsed.cleanText)}</span>
                                    <span class="note-date">Créé le ${note.createdStr || 'N/A'}</span>
                                </div>
                                <button class="delete-btn" onclick="moveToTrash(${listIndex}, ${note.originalIndex})">✕</button>
                            </li>
                        `;
                    }).join('')}
                </ul>
            </div>
        `;
        listsContainer.appendChild(listBlock);
    });

    // --- RENDU DE LA CORBEILLE ---
    const filteredTrash = appData.trash.map((note, originalIndex) => ({ ...note, originalIndex }))
        .filter(note => searchQuery === '' || note.text.toLowerCase().includes(searchQuery) || (note.originListName && note.originListName.toLowerCase().includes(searchQuery)));

    trashContainer.innerHTML = `
        <div class="list-block trash-block">
            <div class="list-header trash-header">
                <div class="list-title-zone" style="cursor: default;">
                    <span>🗑️ Historique (${appData.trash.length})</span>
                </div>
                <div>
                    ${appData.trash.length > 0 ? `<button class="delete-btn" style="background:#6c757d; margin-right:5px; padding: 2px 5px;" onclick="emptyTrash()">Vider</button>` : ''}
                    <button class="btn-toggle" onclick="toggleTrash()">${appData.trashCollapsed ? '▶' : '▼'}</button>
                </div>
            </div>
            <div class="list-content ${appData.trashCollapsed ? 'collapsed' : ''}">
                <ul style="list-style:none; padding:0; margin:0;">
                    ${filteredTrash.length === 0 ? '<li style="color:#adb5bd; text-align:center; padding:5px;">Aucun élément</li>' : ''}
                    ${filteredTrash.map((note) => {
                        const parsed = getNoteDisplay(note.text);
                        return `
                            <li class="note-item trash-item">
                                <div class="note-main">
                                    <span>${parsed.isPriority ? '⚠️ ' : ''}${escapeHTML(parsed.cleanText)}</span>
                                    <span class="note-date">
                                        Hist: ${escapeHTML(note.originListName || 'Inconnu')} | 
                                        Créé: ${note.createdStr || '?'} | 
                                        Suppr: ${note.deletedStr || '?'}
                                    </span>
                                </div>
                                <div>
                                    <button class="btn-restore" onclick="restoreFromTrash(${note.originalIndex})">Restaurer</button>
                                    <button class="delete-btn" onclick="permanentDelete(${note.originalIndex})">✕</button>
                                </div>
                            </li>
                        `;
                    }).join('')}
                </ul>
            </div>
        </div>
    `;

    // Sortable est débrayé uniquement pendant la recherche textuelle
    if (searchQuery === '') {
        initSortableEngine();
    }
}

// ==========================================
// 5. DRAG & DROP ENGINE (SORTABLE)
// ==========================================
function initSortableEngine() {
    Sortable.create(listsContainer, {
        animation: 120,
        handle: '.list-header',
        ghostClass: 'ghost-list',
        onEnd: function (evt) {
            const movedList = appData.lists.splice(evt.oldIndex, 1)[0];
            appData.lists.splice(evt.newIndex, 0, movedList);
            saveToBrowser();
            renderAll();
        }
    });

    const dropzones = document.querySelectorAll('.notes-dropzone');
    dropzones.forEach(zone => {
        Sortable.create(zone, {
            animation: 120,
            group: 'shared-notes-group',
            ghostClass: 'ghost-note',
            onEnd: function (evt) {
                const fromListIndex = parseInt(evt.from.dataset.listIndex);
                const toListIndex = parseInt(evt.to.dataset.listIndex);
                
                const movedNote = appData.lists[fromListIndex].notes.splice(evt.oldIndex, 1)[0];
                appData.lists[toListIndex].notes.splice(evt.newIndex, 0, movedNote);
                
                saveToBrowser();
                renderAll();
            }
        });
    });
}

// ==========================================
// 6. ACTIONS : ÉDITIONS ET LISTES/NOTES
// ==========================================
window.enableInlineEdit = (event, listIndex) => {
    if (event.target.textContent === '☰') return;
    const titleZone = event.currentTarget;
    const textSpan = titleZone.querySelector('.list-title-text');
    if (titleZone.querySelector('input')) return;

    const currentName = appData.lists[listIndex].name;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'list-title-input';
    input.value = currentName;
    
    textSpan.style.display = 'none';
    titleZone.appendChild(input);
    input.focus();
    input.select();

    const saveRename = () => {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            appData.lists[listIndex].name = newName;
            saveToBrowser();
        }
        renderAll();
    };

    input.addEventListener('blur', saveRename);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveRename();
        if (e.key === 'Escape') renderAll();
    });
};

window.enableNoteEdit = (event, listIndex, noteIndex) => {
    const mainZone = event.currentTarget;
    if (mainZone.querySelector('input')) return;

    const textSpan = mainZone.querySelector('.note-text-span');
    const dateSpan = mainZone.querySelector('.note-date');
    const currentFullText = appData.lists[listIndex].notes[noteIndex].text;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'note-title-input';
    input.value = currentFullText;

    textSpan.style.display = 'none';
    dateSpan.style.display = 'none';
    mainZone.insertBefore(input, dateSpan);
    input.focus();
    input.select();

    const saveNoteChange = () => {
        const newText = input.value.trim();
        if (newText && newText !== currentFullText) {
            appData.lists[listIndex].notes[noteIndex].text = newText;
            saveToBrowser();
        }
        renderAll();
    };

    input.addEventListener('blur', saveNoteChange);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveNoteChange();
        if (e.key === 'Escape') renderAll();
    });
};

formAddList.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = inputListName.value.trim();
    if (!name) return;
    appData.lists.push({ id: 'list_' + Date.now(), name: name, collapsed: false, notes: [] });
    inputListName.value = '';
    saveToBrowser();
    renderAll();
});

window.addNote = (e, listIndex) => {
    e.preventDefault();
    const input = e.target.querySelector('input[type="text"]');
    const text = input.value.trim();
    if (!text) return;

    appData.lists[listIndex].notes.push({ 
        id: Date.now(), 
        text: text,
        createdStr: formatDate(new Date())
    });

    input.value = '';
    saveToBrowser();
    renderAll();
};

window.toggleList = (index) => {
    appData.lists[index].collapsed = !appData.lists[index].collapsed;
    saveToBrowser();
    renderAll();
};

window.deleteList = (index) => {
    const list = appData.lists[index];
    if (confirm(`Supprimer la liste "${list.name}" ?`)) {
        list.notes.forEach(note => {
            note.originListId = list.id;
            note.originListName = list.name;
            note.deletedStr = formatDate(new Date());
            appData.trash.unshift(note);
        });
        appData.lists.splice(index, 1);
        saveToBrowser();
        renderAll();
    }
};

// ==========================================
// 7. GESTION DE LA CORBEILLE HISTORIQUE
// ==========================================
window.moveToTrash = (listIndex, noteIndex) => {
    const note = appData.lists[listIndex].notes.splice(noteIndex, 1)[0];
    note.originListId = appData.lists[listIndex].id;
    note.originListName = appData.lists[listIndex].name;
    note.deletedStr = formatDate(new Date());

    appData.trash.unshift(note);
    saveToBrowser();
    renderAll();
};

window.restoreFromTrash = (trashIndex) => {
    const note = appData.trash.splice(trashIndex, 1)[0];
    let targetList = appData.lists.find(l => l.id === note.originListId);
    
    if (!targetList && appData.lists.length > 0) targetList = appData.lists[0];

    if (targetList) {
        targetList.notes.push({ id: note.id, text: note.text, createdStr: note.createdStr });
    } else {
        alert("Aucune liste disponible pour la restauration.");
        appData.trash.unshift(note);
    }
    saveToBrowser();
    renderAll();
};

window.permanentDelete = (trashIndex) => {
    appData.trash.splice(trashIndex, 1);
    saveToBrowser();
    renderAll();
};

window.emptyTrash = () => {
    if (confirm("Vider définitivement la corbeille ?")) {
        appData.trash = [];
        saveToBrowser();
        renderAll();
    }
};

window.toggleTrash = () => {
    appData.trashCollapsed = !appData.trashCollapsed;
    saveToBrowser();
    renderAll();
};

// ==========================================
// 8. IMPORT, EXPORT ET ALERTES SECURITE
// ==========================================
function checkBackupReminder() {
    alertContainer.innerHTML = '';
    const unSemaineMs = 7 * 24 * 60 * 60 * 1000;
    const maintenant = Date.now();
    const derniereSauvegarde = Math.max(appData.lastExport || 0, appData.lastImport || 0);

    if (derniereSauvegarde === 0 || (maintenant - derniereSauvegarde) > unSemaineMs) {
        const div = document.createElement('div');
        div.className = 'backup-alert';
        div.innerHTML = `
            <span>⚠️ Aucune sauvegarde récente (plus de 7 jours).</span>
            <button onclick="exportData()" class="btn-secondary" style="padding: 2px 6px; font-size:11px;">Exporter</button>
        `;
        alertContainer.appendChild(div);
    }
}

window.triggerImport = () => {
    document.getElementById('import-file-input').click();
};

window.exportData = () => {
    appData.lastExport = Date.now();
    saveToBrowser();

    const dataStr = JSON.stringify(appData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const exportFileDefaultName = `backup_listes_${day}-${month}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    renderAll();
};

window.importData = (event) => {
    const fileReader = new FileReader();
    const file = event.target.files[0];
    if (!file) return;

    fileReader.onload = (e) => {
        try {
            const parsedData = JSON.parse(e.target.result);
            if (parsedData && Array.isArray(parsedData.lists)) {
                appData = parsedData;
                if (!appData.trash) appData.trash = [];
                appData.lastImport = Date.now();
                
                saveToBrowser();
                applyThemeEngine();
                renderAll();
                alert("Importation réussie !");
            } else {
                alert("Format de fichier invalide.");
            }
        } catch (err) {
            alert("Erreur lors de la lecture du fichier JSON.");
        }
        event.target.value = '';
    };
    fileReader.readAsText(file);
};

window.toggleControlPanel = () => {
    const panel = document.getElementById('control-panel');
    const isHidden = panel.classList.toggle('hidden');
    appData.panelCollapsed = isHidden;
    saveToBrowser();
};

btnReset.addEventListener('click', () => {
    if (confirm("Tout effacer et remettre l'application à zéro ?")) {
        localStorage.removeItem(STORAGE_KEY);
        init();
    }
});

// ==========================================
// 9. FONCTIONS OUTILS / HELPERS
// ==========================================
function formatDate(dateObj) {
    if (!dateObj) return 'jamais';
    const d = new Date(dateObj);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${hours}:${minutes}`;
}

function getNoteDisplay(text) {
    const isPriority = text.startsWith('!');
    const cleanText = isPriority ? text.substring(1).trim() : text;
    return { isPriority, cleanText };
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

// Écouteur pour adapter dynamiquement l'interface au changement de thème de l'OS si mode "Auto" actif
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (appData.themeMode === 'auto') {
        applyThemeEngine();
    }
});

// Lancement global
init();