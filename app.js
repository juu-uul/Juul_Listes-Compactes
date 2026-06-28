/**
 * Juul_Listes-Compactes
 * Version: 3.1.0
 * Description: Application PWA pour la gestion de listes, synchronisation cloud, et résolution de conflits par horodatage (Last-Writer-Wins).
 */

const APP_VERSION = '3.1.0';

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('PWA : Service Worker enregistré !', reg.scope))
            .catch(err => console.error('PWA : Échec SW :', err));
    });
}

const formAddList = document.getElementById('form-add-list');
const inputListName = document.getElementById('input-list-name');
const inputSearch = document.getElementById('input-search');
const btnClearSearch = document.getElementById('btn-clear-search');
const listsContainer = document.getElementById('lists-container');
const trashContainer = document.getElementById('trash-container');
const alertContainer = document.getElementById('alert-container');
const backupTimestamps = document.getElementById('backup-timestamps');
const storageInfo = document.getElementById('storage-info');
const btnReset = document.getElementById('btn-reset');
const btnTheme = document.getElementById('btn-theme');
const btnToggleAll = document.getElementById('btn-toggle-all');

const STORAGE_KEY = 'ma_pwa_compact_lists_data';
const STORAGE_CLOUD_URL_KEY = 'juul_lists_cloud_url';
const STORAGE_CLOUD_SECRET_KEY = 'juul_lists_cloud_secret';
const STORAGE_DEVICE_NAME_KEY = 'juul_lists_device_name';
const STORAGE_CLOUD_DEBOUNCE_KEY = 'juul_lists_cloud_debounce';

let appData = { 
    lists: [], 
    trash: [], 
    trashCollapsed: true, 
    panelCollapsed: true, 
    themeMode: 'auto', 
    lastExport: null, 
    lastImport: null,
    lastLocalChange: null,
    lastCloudSync: null,
    lastDevice: null
};

let searchQuery = '';
let activeSortableInstances = [];
let cloudSyncTimer = null;
let currentCloudPayload = null;

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
            if (appData.lastLocalChange === undefined) appData.lastLocalChange = null;
            if (appData.lastCloudSync === undefined) appData.lastCloudSync = null;
            if (appData.lastDevice === undefined) appData.lastDevice = null;
            
            // Migration silencieuse V3.0.0+ : Ajout des timestamps
            appData.lists.forEach(l => {
                if (!l.id) l.id = 'list_' + Math.random().toString(36).substr(2, 9);
                if (!l.lastModified) l.lastModified = Date.now();
                l.notes.forEach(n => {
                    if (!n.id) n.id = 'note_' + Math.random().toString(36).substr(2, 9);
                    if (!n.lastModified) n.lastModified = Date.now();
                });
            });
            appData.trash.forEach(t => {
                if (!t.lastModified) t.lastModified = Date.now();
                if (!t.deletedTs) t.deletedTs = Date.now();
            });
        } catch (e) {
            resetToDefault();
        }
    } else {
        resetToDefault();
    }

    const panel = document.getElementById('control-panel');
    if (panel) {
        if (appData.panelCollapsed) {
            panel.classList.add('hidden');
        } else {
            panel.classList.remove('hidden');
        }
    }

    applyThemeEngine();

    inputSearch.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        if (e.target.value.length > 0) {
            btnClearSearch.classList.remove('hidden');
        } else {
            btnClearSearch.classList.add('hidden');
        }
        renderAll();
    });

    renderAll();
    setupCloudEngine();
}

function resetToDefault() {
    const now = Date.now();
    appData = {
        lists: [
            { id: 'l1', name: 'À faire', collapsed: false, lastModified: now, notes: [{ id: 'n1', text: '!Tâche urgente exemple', createdStr: formatDate(new Date()), lastModified: now }, { id: 'n2', text: 'Tâche normale compacte', createdStr: formatDate(new Date()), lastModified: now }] },
            { id: 'l2', name: 'En cours', collapsed: false, lastModified: now, notes: [] }
        ],
        trash: [],
        trashCollapsed: true,
        panelCollapsed: true,
        themeMode: 'auto',
        lastExport: null,
        lastImport: null,
        lastLocalChange: now,
        lastCloudSync: null,
        lastDevice: null
    };
}

function saveToBrowser() {
    appData.lastLocalChange = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    planifierSyncCloud();
}

function applyThemeEngine() {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (appData.themeMode === 'dark' || (appData.themeMode === 'auto' && systemPrefersDark)) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    if (btnTheme) {
        btnTheme.innerHTML = appData.themeMode === 'auto' ? '🌓 Auto' : appData.themeMode === 'dark' ? '🌙 Sombre' : '☀️ Clair';
    }
}

window.toggleTheme = () => {
    appData.themeMode = appData.themeMode === 'auto' ? 'light' : appData.themeMode === 'light' ? 'dark' : 'auto';
    saveToBrowser();
    applyThemeEngine();
};

window.toggleAllLists = () => {
    const anyExpanded = appData.lists.some(l => !l.collapsed);
    appData.lists.forEach(l => l.collapsed = anyExpanded);
    saveToBrowser();
    renderAll();
};

function updateStorageMetric() {
    if (!storageInfo) return;
    
    let totalChars = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            totalChars += localStorage[key].length + key.length;
        }
    }
    
    const sizeKB = (totalChars / 1024).toFixed(1);
    const maxKB = 5120;
    const ratio = ((sizeKB / maxKB) * 100).toFixed(1);
    
    storageInfo.innerHTML = `Stockage : <b>${sizeKB} Ko</b> / ${maxKB} Ko (${ratio}%)`;
}

window.handleNoteSubmitKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !window.matchMedia('(max-width: 768px)').matches) {
        e.preventDefault();
        e.target.form.requestSubmit();
    }
};

function renderAll() {
    checkBackupReminder();
    if (backupTimestamps) {
        backupTimestamps.innerHTML = `Export : <b>${formatDate(appData.lastExport)}</b> | Modif : <b>${formatDate(appData.lastLocalChange)}</b>`;
    }
    
    updateStorageMetric();

    activeSortableInstances.forEach(instance => { if (instance && instance.destroy) instance.destroy(); });
    activeSortableInstances = [];

    listsContainer.innerHTML = '';
    appData.lists.forEach((list) => {
        const matchesListTitle = list.name.toLowerCase().includes(searchQuery);
        const filteredNotes = list.notes.filter(note => note.text.toLowerCase().includes(searchQuery) || matchesListTitle);

        if (searchQuery !== '' && !matchesListTitle && filteredNotes.length === 0) return;

        const listBlock = document.createElement('div');
        listBlock.className = 'list-block';
        listBlock.dataset.id = list.id;

        listBlock.innerHTML = `
            <div class="list-header">
                <div class="list-title-zone" ondblclick="enableInlineEdit(event, '${list.id}')">
                    <span class="list-drag-handle" style="color: #adb5bd; font-size:14px; margin-right: 4px; padding: 6px 10px; cursor:move; user-select:none; -webkit-user-select:none;">☰</span>
                    <div class="list-title-text">
                        <span class="list-name-truncate">${escapeHTML(list.name)}</span>
                        <span class="list-count">&nbsp;(${list.notes.length})</span>
                    </div>
                </div>
                <div class="list-actions-zone">
                    <button class="btn-toggle" style="background:none; border:none; color:inherit; padding: 6px 10px; cursor: pointer;" onclick="toggleList('${list.id}')">${list.collapsed ? '▶' : '▼'}</button>
                    <button class="delete-btn" style="background:none; border:none; color:var(--danger); padding:6px 10px; cursor: pointer;" onclick="deleteList('${list.id}')">✕</button>
                </div>
            </div>
            <div class="list-content ${list.collapsed ? 'collapsed' : ''}">
                <form onsubmit="addNote(event, '${list.id}')" class="input-group">
                    <textarea placeholder="Ajouter... (! = urgent, ? = incertain)" required autocomplete="off" rows="1" onkeydown="handleNoteSubmitKey(event)" oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px';"></textarea>
                    <button type="submit">+</button>
                </form>
                <ul class="notes-dropzone" data-list-id="${list.id}">
                    ${filteredNotes.map((note) => {
                        const parsed = getNoteDisplay(note.text);
                        let noteClass = '';
                        if (parsed.isPriority) noteClass = 'priority-high';
                        else if (parsed.isQuestion) noteClass = 'note-question';

                        return `
                            <li class="note-item ${noteClass}" data-id="${note.id}">
                                <div class="note-main" ondblclick="enableNoteEdit(event, '${list.id}', '${note.id}')">
                                    <span class="note-text-span">${escapeHTML(parsed.cleanText)}</span>
                                    <span class="note-date">le ${note.createdStr || 'N/A'}</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <button class="delete-btn" style="background:none; border:none; color:inherit; opacity:0.5; cursor:pointer; padding:6px 8px;" onclick="moveToTrash('${list.id}', '${note.id}')" title="Supprimer">✕</button>
                                </div>
                            </li>
                        `;
                    }).join('')}
                </ul>
            </div>
        `;
        listsContainer.appendChild(listBlock);
    });

    const filteredTrash = appData.trash.map((note, originalIndex) => ({ ...note, originalIndex }))
        .filter(note => searchQuery === '' || note.text.toLowerCase().includes(searchQuery));

    trashContainer.innerHTML = `
        <div class="list-block trash-block">
            <div class="list-header trash-header">
                <div class="list-title-zone" style="cursor: default;">
                    <span>🗑️ Historique (${appData.trash.length})</span>
                </div>
                <div>
                    ${appData.trash.length > 0 ? `<button class="delete-btn" style="background:#6c757d; border:none; color:white; border-radius:2px; margin-right:5px; padding: 4px 8px; font-size:11px; cursor: pointer;" onclick="emptyTrash()">Vider</button>` : ''}
                    <button class="btn-toggle" style="background:none; border:none; color:inherit; padding: 6px 10px; cursor: pointer;" onclick="toggleTrash()">${appData.trashCollapsed ? '▶' : '▼'}</button>
                </div>
            </div>
            <div class="list-content ${appData.trashCollapsed ? 'collapsed' : ''}">
                <ul style="list-style:none; padding:0; margin:0;">
                    ${filteredTrash.length === 0 ? '<li style="color:#adb5bd; text-align:center; padding:3px; font-size:12px;">Aucun élément</li>' : ''}
                    ${filteredTrash.map((note) => {
                        const parsed = getNoteDisplay(note.text);
                        let noteClass = '';
                        if (parsed.isPriority) noteClass = 'priority-high';
                        else if (parsed.isQuestion) noteClass = 'note-question';

                        return `
                            <li class="note-item trash-item ${noteClass}">
                                <div class="note-main">
                                    <span>${escapeHTML(parsed.cleanText)}</span>
                                    <span class="note-date">Créé: ${note.createdStr || '?'} | <span style="color:var(--danger)">Supprimé le: ${note.deletedStr || 'N/A'}</span> (De: ${escapeHTML(note.originListName || 'Inconnu')})</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:4px;">
                                    <button class="btn-restore" style="font-size:11px; padding:4px 8px; cursor: pointer;" onclick="restoreFromTrash(${note.originalIndex})">Restaurer</button>
                                    <button class="delete-btn" style="background:none; border:none; color:var(--danger); padding:6px 8px; cursor: pointer;" onclick="permanentDelete(${note.originalIndex})">✕</button>
                                </div>
                            </li>
                        `;
                    }).join('')}
                </ul>
            </div>
        </div>
    `;

    if (searchQuery === '') initSortableEngine();
}

function initSortableEngine() {
    const s1 = Sortable.create(listsContainer, {
        animation: 120,
        handle: '.list-drag-handle',
        ghostClass: 'ghost-list',
        onEnd: function () {
            const newOrderedLists = [];
            document.querySelectorAll('#lists-container .list-block').forEach(block => {
                const listId = block.dataset.id;
                const foundList = appData.lists.find(l => l.id === listId);
                if (foundList) newOrderedLists.push(foundList);
            });
            appData.lists = newOrderedLists;
            saveToBrowser();
            setTimeout(renderAll, 0);
        }
    });
    activeSortableInstances.push(s1);

    document.querySelectorAll('.notes-dropzone').forEach(zone => {
        const s2 = Sortable.create(zone, {
            animation: 120,
            group: 'shared-notes-group',
            ghostClass: 'ghost-note',
            fallbackTolerance: 3,
            delay: 150,
            delayOnTouchOnly: true,
            onEnd: function (evt) {
                const fromListId = evt.from.dataset.listId;
                const toListId = evt.to.dataset.listId;
                
                const fromList = appData.lists.find(l => l.id === fromListId);
                const toList = appData.lists.find(l => l.id === toListId);
                
                if (!fromList || !toList) return;

                const noteIdMoved = evt.item.dataset.id;

                if (fromListId !== toListId) {
                    const noteIndex = fromList.notes.findIndex(n => n.id === noteIdMoved);
                    if (noteIndex !== -1) {
                        const [movedNote] = fromList.notes.splice(noteIndex, 1);
                        movedNote.lastModified = Date.now();
                        toList.notes.push(movedNote);
                    }
                    fromList.lastModified = Date.now();
                    toList.lastModified = Date.now();
                } else {
                    toList.lastModified = Date.now();
                }

                const newNotesOrder = [];
                evt.to.querySelectorAll('.note-item').forEach(li => {
                    const id = li.dataset.id;
                    const foundNote = toList.notes.find(n => n.id === id);
                    if (foundNote) newNotesOrder.push(foundNote);
                });

                toList.notes = newNotesOrder;
                saveToBrowser();
                setTimeout(renderAll, 0);
            }
        });
        activeSortableInstances.push(s2);
    });
}

window.clearSearch = () => {
    inputSearch.value = '';
    searchQuery = '';
    btnClearSearch.classList.add('hidden');
    inputSearch.focus();
    renderAll();
};

window.enableInlineEdit = (event, listId) => {
    if (event.target.classList.contains('list-drag-handle') || event.target.textContent === '☰') return;
    const titleZone = event.currentTarget;
    const textSpan = titleZone.querySelector('.list-title-text');
    if (titleZone.querySelector('input')) return;

    const listData = appData.lists.find(l => l.id === listId);
    if (!listData) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.style.padding = "4px 6px";
    input.style.flexGrow = "1";
    input.style.minWidth = "0"; 
    input.value = listData.name;
    
    textSpan.style.display = 'none';
    titleZone.appendChild(input);
    input.focus();
    input.select();

    const saveRename = () => {
        const newName = input.value.trim();
        if (newName && newName !== listData.name) {
            listData.name = newName;
            listData.lastModified = Date.now();
            saveToBrowser();
        }
        renderAll();
    };

    input.addEventListener('blur', saveRename);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') renderAll(); });
};

window.enableNoteEdit = (event, listId, noteId) => {
    let mainZone = event.currentTarget;
    if (mainZone.querySelector('textarea')) return;

    const listData = appData.lists.find(l => l.id === listId);
    if (!listData) return;
    const noteData = listData.notes.find(n => n.id === noteId);
    if (!noteData) return;

    const textSpan = mainZone.querySelector('.note-text-span');
    const dateSpan = mainZone.querySelector('.note-date');

    const textarea = document.createElement('textarea');
    textarea.value = noteData.text;
    textarea.style.fontFamily = "inherit";
    textarea.style.fontSize = "inherit";
    textarea.style.width = "100%";
    textarea.style.boxSizing = "border-box";
    textarea.style.padding = "4px 6px";
    textarea.style.background = "var(--surface)";
    textarea.style.color = "var(--text)";
    textarea.style.border = "1px solid var(--border)";
    textarea.style.borderRadius = "3px";
    textarea.style.resize = "none";
    textarea.style.overflowY = "hidden";

    textSpan.style.display = 'none';
    dateSpan.style.display = 'none';
    mainZone.insertBefore(textarea, dateSpan);

    const autoResize = () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    };
    textarea.addEventListener('input', autoResize);
    autoResize();

    textarea.focus();
    textarea.select();

    let isSaved = false;
    const saveNoteChange = () => {
        if (isSaved) return;
        isSaved = true;
        const newText = textarea.value.trim();
        if (newText && newText !== noteData.text) {
            noteData.text = newText;
            noteData.lastModified = Date.now();
            saveToBrowser();
        }
        renderAll();
    };

    textarea.addEventListener('blur', saveNoteChange);
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            textarea.removeEventListener('blur', saveNoteChange);
            renderAll();
        }
        if (e.key === 'Enter' && !e.shiftKey && !window.matchMedia('(max-width: 768px)').matches) {
            e.preventDefault();
            saveNoteChange();
        }
    });
};

formAddList.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = inputListName.value.trim();
    if (!name) return;
    appData.lists.push({ 
        id: 'list_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), 
        name: name, 
        collapsed: false, 
        notes: [],
        lastModified: Date.now()
    });
    inputListName.value = '';
    saveToBrowser();
    renderAll();
});

window.addNote = (e, listId) => {
    e.preventDefault();
    const input = e.target.querySelector('textarea');
    const text = input.value.trim();
    if (!text) return;

    const listData = appData.lists.find(l => l.id === listId);
    if (listData) {
        const parsed = getNoteDisplay(text);
        const newNoteObj = { 
            id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), 
            text: text,
            createdStr: formatDate(new Date()),
            lastModified: Date.now()
        };

        if (parsed.isPriority) {
            listData.notes.unshift(newNoteObj);
        } else {
            listData.notes.push(newNoteObj);
        }
        listData.lastModified = Date.now();
        saveToBrowser();
    }
    input.value = '';
    input.style.height = 'auto';
    renderAll();
};

window.toggleList = (listId) => {
    const listData = appData.lists.find(l => l.id === listId);
    if (listData) { listData.collapsed = !listData.collapsed; saveToBrowser(); }
    renderAll();
};

window.deleteList = (listId) => {
    const index = appData.lists.findIndex(l => l.id === listId);
    if (index !== -1) {
        const list = appData.lists[index];
        if (confirm(`Supprimer la liste "${list.name}" ?`)) {
            const now = Date.now();
            list.notes.forEach(note => {
                note.originListId = list.id;
                note.originListName = list.name;
                note.deletedStr = formatDate(new Date(now));
                note.deletedTs = now;
                note.lastModified = now;
                appData.trash.unshift(note);
            });
            appData.lists.splice(index, 1);
            saveToBrowser();
            renderAll();
        }
    }
};

window.moveToTrash = (listId, noteId) => {
    const listData = appData.lists.find(l => l.id === listId);
    if (!listData) return;
    const noteIndex = listData.notes.findIndex(n => n.id === noteId);
    if (noteIndex !== -1) {
        const now = Date.now();
        const note = listData.notes.splice(noteIndex, 1)[0];
        note.originListId = listData.id;
        note.originListName = listData.name;
        note.deletedStr = formatDate(new Date(now));
        note.deletedTs = now;
        note.lastModified = now;
        appData.trash.unshift(note);
        listData.lastModified = now;
        saveToBrowser();
    }
    renderAll();
};

window.restoreFromTrash = (trashIndex) => {
    const note = appData.trash.splice(trashIndex, 1)[0];
    let targetList = appData.lists.find(l => l.id === note.originListId);
    if (!targetList && appData.lists.length > 0) targetList = appData.lists[0];

    if (targetList) {
        const parsed = getNoteDisplay(note.text);
        note.lastModified = Date.now();
        delete note.deletedTs; // Suppression de la marque de suppression
        
        if (parsed.isPriority) {
            targetList.notes.unshift({ id: note.id, text: note.text, createdStr: note.createdStr, lastModified: note.lastModified });
        } else {
            targetList.notes.push({ id: note.id, text: note.text, createdStr: note.createdStr, lastModified: note.lastModified });
        }
        targetList.lastModified = Date.now();
    } else {
        appData.trash.unshift(note);
    }
    saveToBrowser();
    renderAll();
};

window.permanentDelete = (trashIndex) => { appData.trash.splice(trashIndex, 1); saveToBrowser(); renderAll(); };
window.emptyTrash = () => { if (confirm("Vider définitivement la corbeille ?")) { appData.trash = []; saveToBrowser(); renderAll(); } };
window.toggleTrash = () => { appData.trashCollapsed = !appData.trashCollapsed; saveToBrowser(); renderAll(); };

function checkBackupReminder() {
    alertContainer.innerHTML = '';
    const unSemaineMs = 7 * 24 * 60 * 60 * 1000;
    if (appData.lastExport === null || (Date.now() - appData.lastExport) > unSemaineMs) {
        const div = document.createElement('div');
        div.className = 'backup-alert';
        div.innerHTML = `<span>⚠️ Sauvegarde requise.</span> <button onclick="exportData()" style="padding:4px 8px; font-size:11px; background:#fff; border:1px solid #ffecb5; border-radius:2px; cursor:pointer;">Exporter</button>`;
        alertContainer.appendChild(div);
    }
}

window.triggerImport = () => { document.getElementById('import-file-input').click(); };

window.exportData = async () => {
    appData.lastExport = Date.now(); 
    saveToBrowser();
    
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const fileName = `backup_listes_${yyyy}${mm}${dd}_${hh}${min}${ss}.json`;

    const jsonString = JSON.stringify(appData, null, 2);

    if ('showSaveFilePicker' in window) {
        try {
            const options = {
                suggestedName: fileName,
                types: [{
                    description: 'Fichier de sauvegarde JSON',
                    accept: { 'application/json': ['.json'] }
                }]
            };
            const handle = await window.showSaveFilePicker(options);
            const writable = await handle.createWritable();
            await writable.write(jsonString);
            await writable.close();
            
            renderAll();
            return;
        } catch (err) {
            if (err.name === 'AbortError') {
                renderAll();
                return;
            }
            console.warn("showSaveFilePicker a échoué, repli sur la méthode classique.", err);
        }
    }

    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(jsonString);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', fileName);
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
                saveToBrowser(); applyThemeEngine(); renderAll();
                alert("Importation réussie !");
            }
        } catch (err) { alert("Erreur de fichier JSON."); }
    };
    fileReader.readAsText(file);
};

window.toggleControlPanel = () => { const panel = document.getElementById('control-panel'); appData.panelCollapsed = panel.classList.toggle('hidden'); saveToBrowser(); };
if (btnReset) {
    btnReset.addEventListener('click', () => { if (confirm("Tout effacer ?")) { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(STORAGE_CLOUD_URL_KEY); localStorage.removeItem(STORAGE_CLOUD_SECRET_KEY); localStorage.removeItem(STORAGE_DEVICE_NAME_KEY); localStorage.removeItem(STORAGE_CLOUD_DEBOUNCE_KEY); init(); } });
}

function formatDate(dateObj) { 
    if (!dateObj) return 'jamais'; 
    const d = new Date(dateObj); 
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`; 
}

function getNoteDisplay(text) { 
    const isPriority = text.startsWith('!'); 
    const isQuestion = text.startsWith('?');
    let cleanText = text;
    if (isPriority || isQuestion) {
        cleanText = text.substring(1).trim();
    }
    return { isPriority, isQuestion, cleanText }; 
}

function escapeHTML(str) { return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)); }

// ========================================================================
// MOTEUR DE SYNCHRONISATION CLOUD ET DE CONFLITS MULTI-APPAREILS
// ========================================================================

function updateCloudStatus(msg, type) {
    const el = document.getElementById('cloud-status');
    if (el) el.innerHTML = msg;

    const bubble = document.querySelector('.cloud-floating-bubble');
    if (bubble) {
        bubble.classList.remove('bubble-success', 'bubble-warning', 'bubble-danger');
        if (type) {
            bubble.classList.add('bubble-' + type);
        }
    }
}

function setupCloudEngine() {
    const urlInput = document.getElementById('input-cloud-url');
    const secretInput = document.getElementById('input-cloud-secret');
    const deviceInput = document.getElementById('input-cloud-device');
    const debounceInput = document.getElementById('input-cloud-debounce');
    const cloudFieldsContainer = document.getElementById('cloud-fields-container');
    const deviceStatusMsg = document.getElementById('device-status-msg');

    if (deviceInput) {
        deviceInput.value = localStorage.getItem(STORAGE_DEVICE_NAME_KEY) || '';
        
        const handleDeviceToggle = (val) => {
            if (val.trim().length > 0) {
                cloudFieldsContainer.style.opacity = '1';
                cloudFieldsContainer.style.pointerEvents = 'auto';
                deviceStatusMsg.style.color = 'var(--text-muted)';
                deviceStatusMsg.textContent = '✅ Appareil identifié avec succès.';
            } else {
                cloudFieldsContainer.style.opacity = '0.4';
                cloudFieldsContainer.style.pointerEvents = 'none';
                deviceStatusMsg.style.color = 'var(--danger)';
                deviceStatusMsg.textContent = '⚠️ Un nom d\'appareil est obligatoire pour activer la synchronisation.';
            }
        };

        handleDeviceToggle(deviceInput.value);

        deviceInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            localStorage.setItem(STORAGE_DEVICE_NAME_KEY, val);
            handleDeviceToggle(val);
            initialiserSynchroCloud();
        });
    }

    if (urlInput && secretInput) {
        urlInput.value = localStorage.getItem(STORAGE_CLOUD_URL_KEY) || '';
        secretInput.value = localStorage.getItem(STORAGE_CLOUD_SECRET_KEY) || '';

        urlInput.addEventListener('input', (e) => {
            localStorage.setItem(STORAGE_CLOUD_URL_KEY, e.target.value.trim());
            initialiserSynchroCloud();
        });
        secretInput.addEventListener('input', (e) => {
            localStorage.setItem(STORAGE_CLOUD_SECRET_KEY, e.target.value.trim());
            initialiserSynchroCloud();
        });
    }

    if (debounceInput) {
        debounceInput.value = localStorage.getItem(STORAGE_CLOUD_DEBOUNCE_KEY) || '10';
        debounceInput.addEventListener('input', (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val) || val < 1) val = 1; 
            localStorage.setItem(STORAGE_CLOUD_DEBOUNCE_KEY, val.toString());
        });
    }

    const btnAcceptCloud = document.getElementById('btn-resolve-accept-cloud');
    const btnForceLocal = document.getElementById('btn-resolve-force-local');
    const btnMerge = document.getElementById('btn-resolve-merge');
    
    if (btnAcceptCloud && btnForceLocal && btnMerge) {
        btnAcceptCloud.onclick = resoudreConflitViaCloud;
        btnForceLocal.onclick = resoudreConflitViaLocal;
        btnMerge.onclick = resoudreConflitViaFusion;
    }

    initialiserSynchroCloud();
}

async function initialiserSynchroCloud() {
    const url = localStorage.getItem(STORAGE_CLOUD_URL_KEY);
    const secret = localStorage.getItem(STORAGE_CLOUD_SECRET_KEY);
    const localDevice = localStorage.getItem(STORAGE_DEVICE_NAME_KEY);

    if (!localDevice || localDevice.trim() === '') {
        updateCloudStatus("⚠️ Config incomplète (Nom requis)", "warning");
        return;
    }
    if (!url || !secret) {
        updateCloudStatus("☁️ Cloud déconnecté", "warning");
        return;
    }

    updateCloudStatus("⏳ Connexion cloud...", "warning");
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({ action: 'get', secret: secret })
        });
        const res = await response.json();
        
        if (res.success) {
            const cloudData = res.data;
            
            if (!cloudData) {
                updateCloudStatus("⏳ Premier envoi au cloud...", "warning");
                await executerSyncCloudDirecte();
                return;
            }

            const cloudChange = cloudData.lastLocalChange || 0;
            const localChange = appData.lastLocalChange || 0;
            const lastCloudDevice = cloudData.lastDevice || 'Appareil Inconnu';

            if (lastCloudDevice !== localDevice && cloudChange !== localChange) {
                ouvrirModaleConflit(localDevice, localChange, lastCloudDevice, cloudChange, cloudData);
                updateCloudStatus("⚠️ Conflit multi-appareils détecté", "danger");
            } else {
                if (cloudChange > localChange) {
                    appData = cloudData;
                    appData.lastCloudSync = Date.now();
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
                    applyThemeEngine();
                    renderAll();
                    updateCloudStatus("☁️ Synchronisé (Cloud importé)", "success");
                } else if (localChange > cloudChange) {
                    updateCloudStatus("⏳ Envoi des modifications locales...", "warning");
                    await executerSyncCloudDirecte();
                } else {
                    updateCloudStatus("☁️ À jour", "success");
                }
            }
        } else {
            updateCloudStatus(`❌ Erreur Auth : ${res.error}`, "danger");
        }
    } catch (err) {
        updateCloudStatus("❌ Serveur Cloud inaccessible", "danger");
    }
}

function planifierSyncCloud() {
    const url = localStorage.getItem(STORAGE_CLOUD_URL_KEY);
    const secret = localStorage.getItem(STORAGE_CLOUD_SECRET_KEY);
    const localDevice = localStorage.getItem(STORAGE_DEVICE_NAME_KEY);
    if (!url || !secret || !localDevice || localDevice.trim() === '') return;

    const debounceSec = parseInt(localStorage.getItem(STORAGE_CLOUD_DEBOUNCE_KEY)) || 10;
    updateCloudStatus(`⏳ En attente d'inactivité (${debounceSec}s)...`, "warning");
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(executerSyncCloudDirecte, debounceSec * 1000);
}

async function executerSyncCloudDirecte() {
    const url = localStorage.getItem(STORAGE_CLOUD_URL_KEY);
    const secret = localStorage.getItem(STORAGE_CLOUD_SECRET_KEY);
    const localDevice = localStorage.getItem(STORAGE_DEVICE_NAME_KEY);
    
    if (!localDevice || localDevice.trim() === '') return;
    if (!url || !secret) return;

    updateCloudStatus("⏳ Sauvegarde cloud...", "warning");
    
    appData.lastDevice = localDevice;

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({ action: 'set', secret: secret, data: appData })
        });
        const res = await response.json();
        if (res.success) {
            appData.lastCloudSync = Date.now();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
            updateCloudStatus("☁️ À jour", "success");
        } else {
            updateCloudStatus(`❌ Erreur : ${res.error}`, "danger");
        }
    } catch (err) {
        updateCloudStatus("❌ Erreur réseau (Sauvegarde différée)", "danger");
    }
}

// Fonction utilitaire pour générer le visuel comparatif des volumes V3.1.0
function genererDiffVolume(localLists, cloudLists) {
    if ((!localLists || localLists.length === 0) && (!cloudLists || cloudLists.length === 0)) {
        return ['<span style="color: var(--text-muted); font-style: italic;">Aucune liste</span>', '<span style="color: var(--text-muted); font-style: italic;">Aucune liste</span>'];
    }

    const allListIds = Array.from(new Set([...(localLists||[]).map(l=>l.id), ...(cloudLists||[]).map(l=>l.id)]));
    
    let localHtml = `<ul style="margin: 0; padding-left: 14px; list-style-type: square; font-size: 11px; line-height: 1.4; max-height: 150px; overflow-y: auto;">`;
    let cloudHtml = `<ul style="margin: 0; padding-left: 14px; list-style-type: square; font-size: 11px; line-height: 1.4; max-height: 150px; overflow-y: auto;">`;

    allListIds.forEach(id => {
        const lList = localLists.find(l => l.id === id);
        const cList = cloudLists.find(l => l.id === id);

        const lName = escapeHTML(lList ? lList.name : cList.name);
        const cName = escapeHTML(cList ? cList.name : lList.name);

        const lCount = lList ? lList.notes.length : 0;
        const cCount = cList ? cList.notes.length : 0;

        let lStyle = ''; let cStyle = '';
        let lDiff = ''; let cDiff = '';

        if (!lList) {
            lStyle = 'color: var(--danger); opacity: 0.6; text-decoration: line-through;';
            cStyle = 'color: var(--sync-success); font-weight: bold;';
            lDiff = ' <span style="font-size: 9px;">(Manquante)</span>';
            cDiff = ' <span style="font-size: 9px;">(Nouvelle)</span>';
        } else if (!cList) {
            lStyle = 'color: var(--sync-success); font-weight: bold;';
            cStyle = 'color: var(--danger); opacity: 0.6; text-decoration: line-through;';
            lDiff = ' <span style="font-size: 9px;">(Nouvelle)</span>';
            cDiff = ' <span style="font-size: 9px;">(Manquante)</span>';
        } else if (lCount > cCount) {
            lStyle = 'color: var(--sync-success); font-weight: bold;';
            cStyle = 'color: var(--danger);';
            lDiff = ` <span style="font-size: 9px;">(+${lCount - cCount})</span>`;
        } else if (cCount > lCount) {
            lStyle = 'color: var(--danger);';
            cStyle = 'color: var(--sync-success); font-weight: bold;';
            cDiff = ` <span style="font-size: 9px;">(+${cCount - lCount})</span>`;
        } else {
            lStyle = 'color: var(--text-muted);';
            cStyle = 'color: var(--text-muted);';
        }

        localHtml += `<li style="margin-bottom: 2px;"><span style="${lStyle}">${lName} : <b>${lCount}</b>${lDiff}</span></li>`;
        cloudHtml += `<li style="margin-bottom: 2px;"><span style="${cStyle}">${cName} : <b>${cCount}</b>${cDiff}</span></li>`;
    });

    localHtml += `</ul>`;
    cloudHtml += `</ul>`;

    return [localHtml, cloudHtml];
}

function ouvrirModaleConflit(localDevice, localTs, cloudDevice, cloudTs, cloudData) {
    currentCloudPayload = cloudData;

    document.getElementById('conflict-local-device').textContent = localDevice;
    document.getElementById('conflict-cloud-device').textContent = cloudDevice;
    
    const localDateEl = document.getElementById('conflict-local-date');
    const cloudDateEl = document.getElementById('conflict-cloud-date');
    
    localDateEl.innerHTML = formatDate(localTs);
    cloudDateEl.innerHTML = formatDate(cloudTs);
    
    if (localTs > cloudTs) {
        localDateEl.innerHTML += ' <span style="color: var(--sync-success); font-weight: bold; white-space: nowrap;">✨ (Plus récent)</span>';
        localDateEl.style.fontWeight = 'bold';
    } else if (cloudTs > localTs) {
        cloudDateEl.innerHTML += ' <span style="color: var(--sync-success); font-weight: bold; white-space: nowrap;">✨ (Plus récent)</span>';
        cloudDateEl.style.fontWeight = 'bold';
    }
    
    const [localVolHtml, cloudVolHtml] = genererDiffVolume(appData.lists, cloudData.lists);

    document.getElementById('conflict-local-volume').innerHTML = localVolHtml;
    document.getElementById('conflict-cloud-volume').innerHTML = cloudVolHtml;

    document.getElementById('conflict-modal').style.display = 'flex';
}

function fermerModaleConflit() {
    document.getElementById('conflict-modal').style.display = 'none';
    currentCloudPayload = null;
    document.getElementById('conflict-local-date').style.fontWeight = 'normal';
    document.getElementById('conflict-cloud-date').style.fontWeight = 'normal';
}

function resoudreConflitViaCloud() {
    if (!currentCloudPayload) return;
    appData = currentCloudPayload;
    appData.lastCloudSync = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    applyThemeEngine();
    renderAll();
    updateCloudStatus("☁️ À jour (Cloud conservé)", "success");
    fermerModaleConflit();
}

async function resoudreConflitViaLocal() {
    fermerModaleConflit();
    updateCloudStatus("⏳ Forçage de la version locale...", "warning");
    await executerSyncCloudDirecte();
}

// Fonction de fusion V3.0.0+ (Last-Writer-Wins granulaire)
async function resoudreConflitViaFusion() {
    if (!currentCloudPayload) return;
    
    const cloudData = currentCloudPayload;
    const localData = appData;

    // 1. Unification de la Corbeille (Pour repérer les éléments supprimés récemment - Tombstones)
    const unifiedTrashMap = new Map();
    [...localData.trash, ...(cloudData.trash || [])].forEach(item => {
        if (!unifiedTrashMap.has(item.id) || item.lastModified > unifiedTrashMap.get(item.id).lastModified) {
            unifiedTrashMap.set(item.id, item);
        }
    });

    const mergedLists = [];
    const allListIds = new Set([...localData.lists.map(l => l.id), ...cloudData.lists.map(l => l.id)]);

    allListIds.forEach(listId => {
        const localList = localData.lists.find(l => l.id === listId);
        const cloudList = cloudData.lists.find(l => l.id === listId);
        
        let mergedList = null;

        // Résolution de la liste (Nom, Propriétés)
        if (localList && cloudList) {
            mergedList = localList.lastModified >= cloudList.lastModified ? { ...localList } : { ...cloudList };
            mergedList.notes = []; 
        } else if (localList) {
            mergedList = { ...localList, notes: [] };
        } else if (cloudList) {
            mergedList = { ...cloudList, notes: [] };
        }

        if (mergedList) {
            const localNotes = localList ? localList.notes : [];
            const cloudNotes = cloudList ? cloudList.notes : [];
            const allNoteIds = new Set([...localNotes.map(n => n.id), ...cloudNotes.map(n => n.id)]);
            const mergedNotes = [];

            allNoteIds.forEach(noteId => {
                const lNote = localNotes.find(n => n.id === noteId);
                const cNote = cloudNotes.find(n => n.id === noteId);
                
                // On vérifie si la note existe dans notre corbeille unifiée
                const trashItem = unifiedTrashMap.get(noteId);
                
                let winningNote = null;
                if (lNote && cNote) {
                    winningNote = lNote.lastModified >= cNote.lastModified ? { ...lNote } : { ...cNote };
                } else if (lNote) {
                    winningNote = { ...lNote };
                } else if (cNote) {
                    winningNote = { ...cNote };
                }

                // Vérification cruciale du "Tombstone" : La note a-t-elle été supprimée plus récemment que sa dernière modif ?
                if (winningNote && trashItem && trashItem.deletedTs > winningNote.lastModified) {
                    // On ne l'ajoute pas, elle reste dans la corbeille.
                } else if (winningNote) {
                    mergedNotes.push(winningNote);
                    unifiedTrashMap.delete(noteId); // Elle vit, on la retire de la corbeille unifiée
                }
            });

            // Ordre des notes : On s'appuie sur l'ordre de l'appareil qui a l'historique le plus récent pour la liste.
            const orderSourceNotes = localList && cloudList 
                ? (localList.lastModified >= cloudList.lastModified ? localNotes : cloudNotes)
                : (localList ? localNotes : cloudNotes);
            
            mergedNotes.sort((a, b) => {
                const indexA = orderSourceNotes.findIndex(n => n.id === a.id);
                const indexB = orderSourceNotes.findIndex(n => n.id === b.id);
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return b.lastModified - a.lastModified;
            });

            mergedList.notes = mergedNotes;
            mergedLists.push(mergedList);
        }
    });

    // Ordre des listes globales
    const masterListOrder = localData.lastLocalChange >= cloudData.lastLocalChange 
        ? localData.lists.map(l => l.id) 
        : cloudData.lists.map(l => l.id);
    
    mergedLists.sort((a, b) => {
        const idxA = masterListOrder.indexOf(a.id);
        const idxB = masterListOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return b.lastModified - a.lastModified;
    });

    appData.lists = mergedLists;
    appData.trash = Array.from(unifiedTrashMap.values());
    appData.trash.sort((a, b) => (b.deletedTs || 0) - (a.deletedTs || 0)); 

    fermerModaleConflit();
    updateCloudStatus("⏳ Fusion en cours...", "warning");
    
    appData.lastLocalChange = Date.now();
    saveToBrowser();
    applyThemeEngine();
    renderAll();
    
    await executerSyncCloudDirecte();
    updateCloudStatus("☁️ Fusionné et à jour", "success");
}

window.addEventListener('beforeunload', () => {
    if (cloudSyncTimer) {
        const url = localStorage.getItem(STORAGE_CLOUD_URL_KEY);
        const secret = localStorage.getItem(STORAGE_CLOUD_SECRET_KEY);
        const localDevice = localStorage.getItem(STORAGE_DEVICE_NAME_KEY);
        if (url && secret && localDevice && localDevice.trim() !== '') {
            appData.lastDevice = localDevice;
            fetch(url, {
                method: 'POST',
                keepalive: true,
                body: JSON.stringify({ action: 'set', secret: secret, data: appData })
            });
        }
    }
});

window.lancerSynchroManuel = initialiserSynchroCloud;

init();