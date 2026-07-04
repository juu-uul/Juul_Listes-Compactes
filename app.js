/**
 * Juul_Listes-Compactes
 * Version: 4.3.0
 * Description: Application PWA pour la gestion de listes, synchronisation cloud, et fusion non-destructive.
 */
"use strict";

const APP_VERSION = '4.3.0';

// --- Sélecteurs DOM Centralisés ---
const DOM = {
    formAddList: document.getElementById('form-add-list'),
    inputListName: document.getElementById('input-list-name'),
    inputSearch: document.getElementById('input-search'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    btnFilterFocus: document.getElementById('btn-filter-focus'),
    btnToggleAll: document.getElementById('btn-toggle-all'),
    btnTogglePanel: document.getElementById('btn-toggle-panel'),
    listsContainer: document.getElementById('lists-container'),
    trashContainer: document.getElementById('trash-container'),
    alertContainer: document.getElementById('alert-container'),
    backupTimestamps: document.getElementById('backup-timestamps'),
    storageInfo: document.getElementById('storage-info'),
    btnReset: document.getElementById('btn-reset'),
    btnTheme: document.getElementById('btn-theme'),
    btnImport: document.getElementById('btn-import'),
    btnExport: document.getElementById('btn-export'),
    inputFileImport: document.getElementById('import-file-input'),
    panel: document.getElementById('control-panel'),
    cloud: {
        status: document.getElementById('cloud-status'),
        bubble: document.querySelector('.cloud-floating-bubble'),
        inputUrl: document.getElementById('input-cloud-url'),
        inputSecret: document.getElementById('input-cloud-secret'),
        inputDevice: document.getElementById('input-cloud-device'),
        inputDebounce: document.getElementById('input-cloud-debounce'),
        fieldsContainer: document.getElementById('cloud-fields-container'),
        deviceMsg: document.getElementById('device-status-msg'),
        btnSyncManual: document.getElementById('btn-sync-manual')
    },
    conflict: {
        modal: document.getElementById('conflict-modal'),
        localDevice: document.getElementById('conflict-local-device'),
        cloudDevice: document.getElementById('conflict-cloud-device'),
        localDate: document.getElementById('conflict-local-date'),
        cloudDate: document.getElementById('conflict-cloud-date'),
        localVolume: document.getElementById('conflict-local-volume'),
        cloudVolume: document.getElementById('conflict-cloud-volume'),
        btnAcceptCloud: document.getElementById('btn-resolve-accept-cloud'),
        btnForceLocal: document.getElementById('btn-resolve-force-local'),
        btnMerge: document.getElementById('btn-resolve-merge')
    }
};

// --- Constantes ---
const STORAGE_KEY = 'ma_pwa_compact_lists_data';
const STORAGE_CLOUD_URL_KEY = 'juul_lists_cloud_url';
const STORAGE_CLOUD_SECRET_KEY = 'juul_lists_cloud_secret';
const STORAGE_DEVICE_NAME_KEY = 'juul_lists_device_name';
const STORAGE_CLOUD_DEBOUNCE_KEY = 'juul_lists_cloud_debounce';

// --- État Global ---
let appData = { 
    lists: [], trash: [], trashCollapsed: true, panelCollapsed: true, 
    themeMode: 'auto', lastExport: null, lastImport: null,
    lastLocalChange: null, lastCloudSync: null, lastDevice: null
};

let searchQuery = '';
let isFocusFilterActive = false;
let activeSortableInstances = [];
let cloudSyncTimer = null;
let currentCloudPayload = null;

// --- Initialisation ---
function init() {
    initData();
    initServiceWorker();
    initEventListeners();
    applyThemeEngine();
    renderAll();
    setupCloudEngine();
}

function initData() {
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
            
            appData.lists.forEach(l => {
                if (!l.id) l.id = 'list_' + Math.random().toString(36).substr(2, 9);
                if (!l.lastModified) l.lastModified = Date.now();
                l.notes.forEach(n => {
                    if (!n.id) n.id = 'note_' + Math.random().toString(36).substr(2, 9);
                    if (!n.lastModified) n.lastModified = Date.now();
                    if (n.focusDate === undefined) n.focusDate = null;
                });
            });
            appData.trash.forEach(t => {
                if (!t.lastModified) t.lastModified = Date.now();
                if (!t.deletedTs) t.deletedTs = Date.now();
                if (t.focusDate === undefined) t.focusDate = null;
            });
        } catch (e) {
            resetToDefault();
        }
    } else {
        resetToDefault();
    }

    cleanExpiredFocus();

    if (DOM.panel) {
        if (appData.panelCollapsed) DOM.panel.classList.add('hidden');
        else DOM.panel.classList.remove('hidden');
    }
}

function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('PWA : Service Worker enregistré ! V4.3.0', reg.scope))
                .catch(err => console.error('PWA : Échec SW :', err));
        });
    }
}

// --- Logique Métier (Fonctions Pures / Utilitaires) ---
function resetToDefault() {
    const now = Date.now();
    appData = {
        lists: [
            { id: 'l1', name: 'À faire', collapsed: false, lastModified: now, notes: [{ id: 'n1', text: '!Tâche urgente exemple', createdStr: formatDate(new Date()), lastModified: now, focusDate: null }, { id: 'n2', text: 'Tâche normale compacte', createdStr: formatDate(new Date()), lastModified: now, focusDate: null }] },
            { id: 'l2', name: 'En cours', collapsed: false, lastModified: now, notes: [] }
        ],
        trash: [], trashCollapsed: true, panelCollapsed: true, themeMode: 'auto',
        lastExport: null, lastImport: null, lastLocalChange: now, lastCloudSync: null, lastDevice: null
    };
}

function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function cleanExpiredFocus() {
    const today = getTodayStr();
    let hasChanges = false;
    
    appData.lists.forEach(list => {
        list.notes.forEach(note => {
            if (note.focusDate && note.focusDate !== today) {
                note.focusDate = null;
                note.lastModified = Date.now();
                hasChanges = true;
            }
        });
    });

    appData.trash.forEach(note => {
        if (note.focusDate && note.focusDate !== today) {
            note.focusDate = null;
            note.lastModified = Date.now();
            hasChanges = true;
        }
    });

    if (hasChanges) saveToBrowser();
}

function saveToBrowser() {
    appData.lastLocalChange = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    planifierSyncCloud();
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
    if (isPriority || isQuestion) cleanText = text.substring(1).trim();
    return { isPriority, isQuestion, cleanText }; 
}

function escapeHTML(str) { 
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)); 
}

function genererDiffVolume(localLists, cloudLists) {
    if ((!localLists || localLists.length === 0) && (!cloudLists || cloudLists.length === 0)) {
        return ['<span class="text-muted-italic">Aucune liste</span>', '<span class="text-muted-italic">Aucune liste</span>'];
    }

    const allListIds = Array.from(new Set([...(localLists||[]).map(l=>l.id), ...(cloudLists||[]).map(l=>l.id)]));
    
    let localHtml = `<ul class="diff-list">`;
    let cloudHtml = `<ul class="diff-list">`;

    allListIds.forEach(id => {
        const lList = localLists.find(l => l.id === id);
        const cList = cloudLists.find(l => l.id === id);
        const lName = escapeHTML(lList ? lList.name : cList.name);
        const cName = escapeHTML(cList ? cList.name : lList.name);
        const lCount = lList ? lList.notes.length : 0;
        const cCount = cList ? cList.notes.length : 0;

        let lClass = '', cClass = '', lDiff = '', cDiff = '';

        if (!lList) {
            lClass = 'diff-item-missing'; cClass = 'diff-item-new';
            lDiff = ' <span class="diff-label">(Manquante)</span>';
            cDiff = ' <span class="diff-label">(Nouvelle)</span>';
        } else if (!cList) {
            lClass = 'diff-item-new'; cClass = 'diff-item-missing';
            lDiff = ' <span class="diff-label">(Nouvelle)</span>';
            cDiff = ' <span class="diff-label">(Manquante)</span>';
        } else if (lCount > cCount) {
            lClass = 'diff-item-more'; cClass = 'diff-item-less';
            lDiff = ` <span class="diff-label">(+${lCount - cCount})</span>`;
        } else if (cCount > lCount) {
            lClass = 'diff-item-less'; cClass = 'diff-item-more';
            cDiff = ` <span class="diff-label">(+${cCount - lCount})</span>`;
        } else {
            lClass = 'diff-item-neutral'; cClass = 'diff-item-neutral';
        }

        localHtml += `<li><span class="${lClass}">${lName} : <b>${lCount}</b>${lDiff}</span></li>`;
        cloudHtml += `<li><span class="${cClass}">${cName} : <b>${cCount}</b>${cDiff}</span></li>`;
    });

    return [localHtml + `</ul>`, cloudHtml + `</ul>`];
}

// --- Interface Globale (AppActions) ---
window.AppActions = {
    toggleTheme: () => {
        appData.themeMode = appData.themeMode === 'auto' ? 'light' : appData.themeMode === 'light' ? 'dark' : 'auto';
        saveToBrowser(); applyThemeEngine();
    },
    toggleFocusFilter: () => {
        isFocusFilterActive = !isFocusFilterActive;
        if (isFocusFilterActive) {
            DOM.btnFilterFocus.classList.add('active-filter');
        } else {
            DOM.btnFilterFocus.classList.remove('active-filter');
        }
        renderAll();
    },
    toggleNoteFocus: (listId, noteId) => {
        const listData = appData.lists.find(l => l.id === listId);
        if (!listData) return;
        const noteData = listData.notes.find(n => n.id === noteId);
        if (!noteData) return;

        const today = getTodayStr();
        if (noteData.focusDate === today) {
            noteData.focusDate = null;
        } else {
            noteData.focusDate = today;
        }
        noteData.lastModified = Date.now();
        listData.lastModified = Date.now();
        saveToBrowser(); renderAll();
    },
    toggleAllLists: () => {
        const anyExpanded = appData.lists.some(l => !l.collapsed);
        appData.lists.forEach(l => l.collapsed = anyExpanded);
        saveToBrowser(); renderAll();
    },
    clearSearch: () => {
        DOM.inputSearch.value = ''; searchQuery = '';
        DOM.btnClearSearch.classList.add('hidden');
        DOM.inputSearch.focus(); renderAll();
    },
    toggleControlPanel: () => {
        appData.panelCollapsed = DOM.panel.classList.toggle('hidden');
        saveToBrowser();
    },
    triggerImport: () => { DOM.inputFileImport.click(); },
    exportData: async () => {
        appData.lastExport = Date.now(); saveToBrowser();
        const now = new Date();
        const yyyy = now.getFullYear(); const mm = String(now.getMonth() + 1).padStart(2, '0'); const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0'); const min = String(now.getMinutes()).padStart(2, '0'); const ss = String(now.getSeconds()).padStart(2, '0');
        const fileName = `backup_listes_${yyyy}${mm}${dd}_${hh}${min}${ss}.json`;
        const jsonString = JSON.stringify(appData, null, 2);

        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'Fichier de sauvegarde JSON', accept: { 'application/json': ['.json'] } }] });
                const writable = await handle.createWritable();
                await writable.write(jsonString); await writable.close();
                renderAll(); return;
            } catch (err) { if (err.name !== 'AbortError') console.warn("Erreur showSaveFilePicker", err); }
        }

        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(jsonString);
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri); linkElement.setAttribute('download', fileName); linkElement.click();
        renderAll();
    },
    toggleList: (listId) => {
        const listData = appData.lists.find(l => l.id === listId);
        if (listData) { listData.collapsed = !listData.collapsed; saveToBrowser(); renderAll(); }
    },
    deleteList: (listId) => {
        const index = appData.lists.findIndex(l => l.id === listId);
        if (index !== -1) {
            const list = appData.lists[index];
            if (confirm(`Supprimer la liste "${list.name}" ?`)) {
                const now = Date.now();
                list.notes.forEach(note => {
                    note.originListId = list.id; note.originListName = list.name;
                    note.deletedStr = formatDate(new Date(now)); note.deletedTs = now; note.lastModified = now;
                    appData.trash.unshift(note);
                });
                appData.lists.splice(index, 1);
                saveToBrowser(); renderAll();
            }
        }
    },
    addNote: (e, listId) => {
        e.preventDefault();
        const input = e.target.querySelector('textarea');
        const text = input.value.trim();
        if (!text) return;
        const listData = appData.lists.find(l => l.id === listId);
        if (listData) {
            const parsed = getNoteDisplay(text);
            const newNoteObj = { id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), text: text, createdStr: formatDate(new Date()), lastModified: Date.now(), focusDate: null };
            if (parsed.isPriority) listData.notes.unshift(newNoteObj); else listData.notes.push(newNoteObj);
            listData.lastModified = Date.now(); saveToBrowser();
        }
        input.value = ''; input.style.height = 'auto'; renderAll();
    },
    moveToTrash: (listId, noteId) => {
        const listData = appData.lists.find(l => l.id === listId);
        if (!listData) return;
        const noteIndex = listData.notes.findIndex(n => n.id === noteId);
        if (noteIndex !== -1) {
            const now = Date.now();
            const note = listData.notes.splice(noteIndex, 1)[0];
            note.originListId = listData.id; note.originListName = listData.name;
            note.deletedStr = formatDate(new Date(now)); note.deletedTs = now; note.lastModified = now;
            appData.trash.unshift(note); listData.lastModified = now; saveToBrowser(); renderAll();
        }
    },
    restoreFromTrash: (trashIndex) => {
        const note = appData.trash.splice(trashIndex, 1)[0];
        let targetList = appData.lists.find(l => l.id === note.originListId);
        if (!targetList && appData.lists.length > 0) targetList = appData.lists[0];
        if (targetList) {
            const parsed = getNoteDisplay(note.text);
            note.lastModified = Date.now(); delete note.deletedTs; 
            if (note.focusDate && note.focusDate !== getTodayStr()) note.focusDate = null;
            const newObj = { id: note.id, text: note.text, createdStr: note.createdStr, lastModified: note.lastModified, focusDate: note.focusDate };
            if (parsed.isPriority) targetList.notes.unshift(newObj); else targetList.notes.push(newObj);
            targetList.lastModified = Date.now();
        } else {
            appData.trash.unshift(note);
        }
        saveToBrowser(); renderAll();
    },
    permanentDelete: (trashIndex) => { appData.trash.splice(trashIndex, 1); saveToBrowser(); renderAll(); },
    emptyTrash: () => { if (confirm("Vider définitivement la corbeille ?")) { appData.trash = []; saveToBrowser(); renderAll(); } },
    toggleTrash: () => { appData.trashCollapsed = !appData.trashCollapsed; saveToBrowser(); renderAll(); },
    handleNoteSubmitKey: (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !window.matchMedia('(max-width: 768px)').matches) {
            e.preventDefault(); e.target.form.requestSubmit();
        }
    },
    enableInlineEdit: (event, listId) => {
        if (event.target.classList.contains('list-drag-handle') || event.target.textContent === '☰') return;
        const titleZone = event.currentTarget;
        const textSpan = titleZone.querySelector('.list-title-text');
        if (titleZone.querySelector('input')) return;

        const listData = appData.lists.find(l => l.id === listId);
        if (!listData) return;

        const input = document.createElement('input');
        input.type = 'text'; input.className = 'inline-edit-input'; input.value = listData.name;
        
        textSpan.classList.add('hidden'); titleZone.appendChild(input); input.focus(); input.select();

        const saveRename = () => {
            const newName = input.value.trim();
            if (newName && newName !== listData.name) { listData.name = newName; listData.lastModified = Date.now(); saveToBrowser(); }
            renderAll();
        };

        input.addEventListener('blur', saveRename);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') renderAll(); });
    },
    enableNoteEdit: (event, listId, noteId) => {
        let mainZone = event.currentTarget;
        if (mainZone.querySelector('textarea')) return;

        const listData = appData.lists.find(l => l.id === listId);
        if (!listData) return;
        const noteData = listData.notes.find(n => n.id === noteId);
        if (!noteData) return;

        const textSpan = mainZone.querySelector('.note-text-span');
        const dateSpan = mainZone.querySelector('.note-date');

        const textarea = document.createElement('textarea');
        textarea.value = noteData.text; textarea.className = 'inline-edit-textarea';

        textSpan.classList.add('hidden'); dateSpan.classList.add('hidden');
        mainZone.insertBefore(textarea, dateSpan);

        const autoResize = () => { textarea.style.height = 'auto'; textarea.style.height = textarea.scrollHeight + 'px'; };
        textarea.addEventListener('input', autoResize); autoResize();
        textarea.focus(); textarea.select();

        let isSaved = false;
        const saveNoteChange = () => {
            if (isSaved) return;
            isSaved = true; const newText = textarea.value.trim();
            if (newText && newText !== noteData.text) { noteData.text = newText; noteData.lastModified = Date.now(); saveToBrowser(); }
            renderAll();
        };

        textarea.addEventListener('blur', saveNoteChange);
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { textarea.removeEventListener('blur', saveNoteChange); renderAll(); }
            if (e.key === 'Enter' && !e.shiftKey && !window.matchMedia('(max-width: 768px)').matches) { e.preventDefault(); saveNoteChange(); }
        });
    }
};

// --- Gestion du DOM & Rendu ---
function applyThemeEngine() {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (appData.themeMode === 'dark' || (appData.themeMode === 'auto' && systemPrefersDark)) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    if (DOM.btnTheme) {
        DOM.btnTheme.innerHTML = appData.themeMode === 'auto' ? '🌓 Auto' : appData.themeMode === 'dark' ? '🌙 Sombre' : '☀️ Clair';
    }
}

function updateStorageMetric() {
    if (!DOM.storageInfo) return;
    let totalChars = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) totalChars += localStorage[key].length + key.length;
    }
    const sizeKB = (totalChars / 1024).toFixed(1);
    const maxKB = 5120;
    const ratio = ((sizeKB / maxKB) * 100).toFixed(1);
    DOM.storageInfo.innerHTML = `Stockage : <span class="font-bold">${sizeKB} Ko</span> / ${maxKB} Ko (${ratio}%)`;
}

function checkBackupReminder() {
    DOM.alertContainer.innerHTML = '';
    const unSemaineMs = 7 * 24 * 60 * 60 * 1000;
    if (appData.lastExport === null || (Date.now() - appData.lastExport) > unSemaineMs) {
        const div = document.createElement('div');
        div.className = 'backup-alert';
        div.innerHTML = `<span>⚠️ Sauvegarde requise.</span> <button onclick="AppActions.exportData()" class="btn-backup-export">Exporter</button>`;
        DOM.alertContainer.appendChild(div);
    }
}

function renderAll() {
    checkBackupReminder();
    if (DOM.backupTimestamps) DOM.backupTimestamps.innerHTML = `Export : <span class="font-bold">${formatDate(appData.lastExport)}</span> | Modif : <span class="font-bold">${formatDate(appData.lastLocalChange)}</span>`;
    
    updateStorageMetric();

    activeSortableInstances.forEach(instance => { if (instance && instance.destroy) instance.destroy(); });
    activeSortableInstances = [];

    const today = getTodayStr();

    DOM.listsContainer.innerHTML = '';
    appData.lists.forEach((list) => {
        const matchesListTitle = list.name.toLowerCase().includes(searchQuery);
        let filteredNotes = list.notes.filter(note => note.text.toLowerCase().includes(searchQuery) || matchesListTitle);

        if (isFocusFilterActive) {
            filteredNotes = filteredNotes.filter(note => note.focusDate === today);
        }

        if ((searchQuery !== '' || isFocusFilterActive) && !matchesListTitle && filteredNotes.length === 0) return;

        const listBlock = document.createElement('div');
        listBlock.className = 'list-block';
        listBlock.dataset.id = list.id;

        listBlock.innerHTML = `
            <div class="list-header">
                <div class="list-title-zone" ondblclick="AppActions.enableInlineEdit(event, '${list.id}')">
                    <span class="list-drag-handle">☰</span>
                    <div class="list-title-text">
                        <span class="list-name-truncate">${escapeHTML(list.name)}</span>
                        <span class="list-count">&nbsp;(${list.notes.length})</span>
                    </div>
                </div>
                <div class="list-actions-zone">
                    <button class="btn-icon" onclick="AppActions.toggleList('${list.id}')">${list.collapsed ? '▶' : '▼'}</button>
                    <button class="btn-icon-danger" onclick="AppActions.deleteList('${list.id}')">✕</button>
                </div>
            </div>
            <div class="list-content ${list.collapsed ? 'collapsed' : ''}">
                <form onsubmit="AppActions.addNote(event, '${list.id}')" class="input-group ${isFocusFilterActive ? 'hidden' : ''}">
                    <textarea placeholder="Ajouter... (! = urgent, ? = incertain)" required autocomplete="off" rows="1" onkeydown="AppActions.handleNoteSubmitKey(event)" oninput="this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px';"></textarea>
                    <button type="submit">+</button>
                </form>
                <ul class="notes-dropzone" data-list-id="${list.id}">
                    ${filteredNotes.map((note) => {
                        const parsed = getNoteDisplay(note.text);
                        const isFocus = note.focusDate === today;
                        let noteClass = parsed.isPriority ? 'priority-high' : parsed.isQuestion ? 'note-question' : '';
                        if (isFocus) noteClass += ' note-focus-active';

                        const btnFocusStyle = isFocus ? 'opacity: 1; filter: grayscale(0%);' : 'opacity: 0.2; filter: grayscale(100%);';

                        return `
                            <li class="note-item ${noteClass}" data-id="${note.id}">
                                <div class="note-main" ondblclick="AppActions.enableNoteEdit(event, '${list.id}', '${note.id}')">
                                    <span class="note-text-span">${escapeHTML(parsed.cleanText)}</span>
                                    <span class="note-date">le ${note.createdStr || 'N/A'}</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:4px;">
                                    <button class="btn-icon-muted" style="${btnFocusStyle}" onclick="AppActions.toggleNoteFocus('${list.id}', '${note.id}')" title="Focus pour la journée">🎯</button>
                                    <button class="btn-icon-muted" onclick="AppActions.moveToTrash('${list.id}', '${note.id}')" title="Supprimer">✕</button>
                                </div>
                            </li>
                        `;
                    }).join('')}
                </ul>
            </div>
        `;
        DOM.listsContainer.appendChild(listBlock);
    });

    const filteredTrash = appData.trash.map((note, originalIndex) => ({ ...note, originalIndex })).filter(note => searchQuery === '' || note.text.toLowerCase().includes(searchQuery));

    DOM.trashContainer.innerHTML = `
        <div class="list-block trash-block ${isFocusFilterActive ? 'hidden' : ''}">
            <div class="list-header trash-header">
                <div class="list-title-zone trash-header-cursor">
                    <span>🗑️ Historique (${appData.trash.length})</span>
                </div>
                <div>
                    ${appData.trash.length > 0 ? `<button class="btn-empty-trash" onclick="AppActions.emptyTrash()">Vider</button>` : ''}
                    <button class="btn-icon" onclick="AppActions.toggleTrash()">${appData.trashCollapsed ? '▶' : '▼'}</button>
                </div>
            </div>
            <div class="list-content ${appData.trashCollapsed ? 'collapsed' : ''}">
                <ul style="list-style:none; padding:0; margin:0;">
                    ${filteredTrash.length === 0 ? '<li class="trash-empty-msg">Aucun élément</li>' : ''}
                    ${filteredTrash.map((note) => {
                        const parsed = getNoteDisplay(note.text);
                        let noteClass = parsed.isPriority ? 'priority-high' : parsed.isQuestion ? 'note-question' : '';
                        return `
                            <li class="note-item trash-item ${noteClass}">
                                <div class="note-main">
                                    <span>${escapeHTML(parsed.cleanText)}</span>
                                    <span class="note-date">Créé: ${note.createdStr || '?'} | <span class="text-danger">Supprimé le: ${note.deletedStr || 'N/A'}</span> (De: ${escapeHTML(note.originListName || 'Inconnu')})</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:4px;">
                                    <button class="btn-restore" onclick="AppActions.restoreFromTrash(${note.originalIndex})">Restaurer</button>
                                    <button class="btn-icon-danger" style="padding:6px 8px;" onclick="AppActions.permanentDelete(${note.originalIndex})">✕</button>
                                </div>
                            </li>
                        `;
                    }).join('')}
                </ul>
            </div>
        </div>
    `;

    if (searchQuery === '' && !isFocusFilterActive) initSortableEngine();
}

function initSortableEngine() {
    const s1 = Sortable.create(DOM.listsContainer, {
        animation: 120, handle: '.list-drag-handle', ghostClass: 'ghost-list',
        onEnd: function () {
            const newOrderedLists = [];
            document.querySelectorAll('#lists-container .list-block').forEach(block => {
                const foundList = appData.lists.find(l => l.id === block.dataset.id);
                if (foundList) newOrderedLists.push(foundList);
            });
            appData.lists = newOrderedLists; saveToBrowser(); setTimeout(renderAll, 0);
        }
    });
    activeSortableInstances.push(s1);

    document.querySelectorAll('.notes-dropzone').forEach(zone => {
        const s2 = Sortable.create(zone, {
            animation: 120, group: 'shared-notes-group', ghostClass: 'ghost-note',
            fallbackTolerance: 3, delay: 150, delayOnTouchOnly: true,
            onEnd: function (evt) {
                const fromListId = evt.from.dataset.listId; const toListId = evt.to.dataset.listId;
                const fromList = appData.lists.find(l => l.id === fromListId); const toList = appData.lists.find(l => l.id === toListId);
                if (!fromList || !toList) return;

                const noteIdMoved = evt.item.dataset.id;
                if (fromListId !== toListId) {
                    const noteIndex = fromList.notes.findIndex(n => n.id === noteIdMoved);
                    if (noteIndex !== -1) {
                        const [movedNote] = fromList.notes.splice(noteIndex, 1);
                        movedNote.lastModified = Date.now(); toList.notes.push(movedNote);
                    }
                }
                fromList.lastModified = Date.now(); toList.lastModified = Date.now();

                const newNotesOrder = [];
                evt.to.querySelectorAll('.note-item').forEach(li => {
                    const foundNote = toList.notes.find(n => n.id === li.dataset.id);
                    if (foundNote) newNotesOrder.push(foundNote);
                });
                toList.notes = newNotesOrder; saveToBrowser(); setTimeout(renderAll, 0);
            }
        });
        activeSortableInstances.push(s2);
    });
}

// --- Écouteurs d'Événements (Event Listeners Centralisés) ---
function initEventListeners() {
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            console.log("V4.3.0 : Retour au premier plan, synchro auto...");
            cleanExpiredFocus();
            renderAll();
            initialiserSynchroCloud();
        }
    });

    window.addEventListener('beforeunload', () => {
        if (cloudSyncTimer) {
            const url = localStorage.getItem(STORAGE_CLOUD_URL_KEY);
            const secret = localStorage.getItem(STORAGE_CLOUD_SECRET_KEY);
            const localDevice = localStorage.getItem(STORAGE_DEVICE_NAME_KEY);
            if (url && secret && localDevice && localDevice.trim() !== '') {
                appData.lastDevice = localDevice;
                fetch(url, { method: 'POST', keepalive: true, body: JSON.stringify({ action: 'set', secret: secret, data: appData }) });
            }
        }
    });

    // Auto-scroll mobile : évite le masquage des champs par le clavier virtuel
    DOM.listsContainer.addEventListener('focusin', (e) => {
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
            setTimeout(() => {
                e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    });

    DOM.formAddList.addEventListener('submit', (e) => {
        e.preventDefault(); const name = DOM.inputListName.value.trim();
        if (!name) return;
        appData.lists.push({ id: 'list_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), name: name, collapsed: false, notes: [], lastModified: Date.now() });
        DOM.inputListName.value = ''; saveToBrowser(); renderAll();
    });

    DOM.inputSearch.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        if (e.target.value.length > 0) DOM.btnClearSearch.classList.remove('hidden');
        else DOM.btnClearSearch.classList.add('hidden');
        renderAll();
    });

    DOM.btnClearSearch.addEventListener('click', AppActions.clearSearch);
    DOM.btnFilterFocus.addEventListener('click', AppActions.toggleFocusFilter);
    DOM.btnToggleAll.addEventListener('click', AppActions.toggleAllLists);
    DOM.btnTogglePanel.addEventListener('click', AppActions.toggleControlPanel);
    DOM.btnTheme.addEventListener('click', AppActions.toggleTheme);
    DOM.btnImport.addEventListener('click', AppActions.triggerImport);
    DOM.btnExport.addEventListener('click', AppActions.exportData);
    
    if (DOM.btnReset) {
        DOM.btnReset.addEventListener('click', () => { 
            if (confirm("Tout effacer ?")) { 
                localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(STORAGE_CLOUD_URL_KEY); localStorage.removeItem(STORAGE_CLOUD_SECRET_KEY); localStorage.removeItem(STORAGE_DEVICE_NAME_KEY); localStorage.removeItem(STORAGE_CLOUD_DEBOUNCE_KEY); initData(); renderAll(); 
            } 
        });
    }

    DOM.inputFileImport.addEventListener('change', (event) => {
        const fileReader = new FileReader(); const file = event.target.files[0];
        if (!file) return;
        fileReader.onload = (e) => {
            try {
                const parsedData = JSON.parse(e.target.result);
                if (parsedData && Array.isArray(parsedData.lists)) {
                    appData = parsedData; if (!appData.trash) appData.trash = [];
                    appData.lastImport = Date.now(); saveToBrowser(); applyThemeEngine(); renderAll(); alert("Importation réussie !");
                }
            } catch (err) { alert("Erreur de fichier JSON."); }
        };
        fileReader.readAsText(file);
    });

    // Écouteur pour forcer la synchro depuis l'ensemble de la bulle
    DOM.cloud.btnSyncManual.addEventListener('click', initialiserSynchroCloud);
}

// --- Moteur de Synchronisation Cloud ---
function updateCloudStatus(msg, type) {
    if (DOM.cloud.status) DOM.cloud.status.innerHTML = msg;
    if (DOM.cloud.bubble) {
        DOM.cloud.bubble.classList.remove('bubble-success', 'bubble-warning', 'bubble-danger', 'sync-pulsing');
        if (type) {
            DOM.cloud.bubble.classList.add('bubble-' + type);
            if (type === 'warning') DOM.cloud.bubble.classList.add('sync-pulsing');
        }
    }
}

function setupCloudEngine() {
    if (DOM.cloud.inputDevice) {
        DOM.cloud.inputDevice.value = localStorage.getItem(STORAGE_DEVICE_NAME_KEY) || '';
        const handleDeviceToggle = (val) => {
            if (val.trim().length > 0) {
                DOM.cloud.fieldsContainer.classList.remove('cloud-fields-disabled');
                DOM.cloud.fieldsContainer.classList.add('cloud-fields-active');
                DOM.cloud.deviceMsg.className = 'device-status-msg text-muted-italic';
                DOM.cloud.deviceMsg.textContent = '✅ Appareil identifié avec succès.';
            } else {
                DOM.cloud.fieldsContainer.classList.remove('cloud-fields-active');
                DOM.cloud.fieldsContainer.classList.add('cloud-fields-disabled');
                DOM.cloud.deviceMsg.className = 'device-status-msg text-danger';
                DOM.cloud.deviceMsg.textContent = '⚠️ Un nom d\'appareil est obligatoire pour activer la synchronisation.';
            }
        };

        handleDeviceToggle(DOM.cloud.inputDevice.value);
        DOM.cloud.inputDevice.addEventListener('input', (e) => {
            const val = e.target.value.trim(); localStorage.setItem(STORAGE_DEVICE_NAME_KEY, val);
            handleDeviceToggle(val); initialiserSynchroCloud();
        });
    }

    if (DOM.cloud.inputUrl && DOM.cloud.inputSecret) {
        DOM.cloud.inputUrl.value = localStorage.getItem(STORAGE_CLOUD_URL_KEY) || '';
        DOM.cloud.inputSecret.value = localStorage.getItem(STORAGE_CLOUD_SECRET_KEY) || '';
        DOM.cloud.inputUrl.addEventListener('input', (e) => { localStorage.setItem(STORAGE_CLOUD_URL_KEY, e.target.value.trim()); initialiserSynchroCloud(); });
        DOM.cloud.inputSecret.addEventListener('input', (e) => { localStorage.setItem(STORAGE_CLOUD_SECRET_KEY, e.target.value.trim()); initialiserSynchroCloud(); });
    }

    if (DOM.cloud.inputDebounce) {
        DOM.cloud.inputDebounce.value = localStorage.getItem(STORAGE_CLOUD_DEBOUNCE_KEY) || '10';
        DOM.cloud.inputDebounce.addEventListener('input', (e) => {
            let val = parseInt(e.target.value); if (isNaN(val) || val < 1) val = 1; 
            localStorage.setItem(STORAGE_CLOUD_DEBOUNCE_KEY, val.toString());
        });
    }

    if (DOM.conflict.btnAcceptCloud && DOM.conflict.btnForceLocal && DOM.conflict.btnMerge) {
        DOM.conflict.btnAcceptCloud.addEventListener('click', resoudreConflitViaCloud);
        DOM.conflict.btnForceLocal.addEventListener('click', resoudreConflitViaLocal);
        DOM.conflict.btnMerge.addEventListener('click', resoudreConflitViaFusion);
    }

    initialiserSynchroCloud();
}

async function initialiserSynchroCloud() {
    const url = localStorage.getItem(STORAGE_CLOUD_URL_KEY);
    const secret = localStorage.getItem(STORAGE_CLOUD_SECRET_KEY);
    const localDevice = localStorage.getItem(STORAGE_DEVICE_NAME_KEY);

    if (!localDevice || localDevice.trim() === '') { updateCloudStatus("⚠️ Config incomplète (Nom requis)", "warning"); return; }
    if (!url || !secret) { updateCloudStatus("☁️ Cloud déconnecté", "warning"); return; }

    updateCloudStatus("⏳ Connexion cloud...", "warning");
    try {
        const response = await fetch(url, { method: 'POST', body: JSON.stringify({ action: 'get', secret: secret }) });
        const res = await response.json();
        
        if (res.success) {
            const cloudData = res.data;
            if (!cloudData) { updateCloudStatus("⏳ Premier envoi au cloud...", "warning"); await executerSyncCloudDirecte(); return; }

            const cloudChange = cloudData.lastLocalChange || 0;
            const localChange = appData.lastLocalChange || 0;
            const lastCloudDevice = cloudData.lastDevice || 'Appareil Inconnu';

            if (lastCloudDevice !== localDevice && cloudChange !== localChange) {
                ouvrirModaleConflit(localDevice, localChange, lastCloudDevice, cloudChange, cloudData);
                updateCloudStatus("⚠️ Conflit multi-appareils détecté", "danger");
            } else {
                if (cloudChange > localChange) {
                    appData = cloudData; appData.lastCloudSync = Date.now(); localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
                    applyThemeEngine(); renderAll(); updateCloudStatus("☁️ Synchronisé (Cloud importé)", "success");
                } else if (localChange > cloudChange) {
                    updateCloudStatus("⏳ Envoi des modifications locales...", "warning"); await executerSyncCloudDirecte();
                } else {
                    updateCloudStatus("☁️ À jour", "success");
                }
            }
        } else {
            updateCloudStatus(`❌ Erreur Auth : ${res.error}`, "danger");
        }
    } catch (err) { updateCloudStatus("❌ Serveur Cloud inaccessible", "danger"); }
}

function planifierSyncCloud() {
    const url = localStorage.getItem(STORAGE_CLOUD_URL_KEY);
    const secret = localStorage.getItem(STORAGE_CLOUD_SECRET_KEY);
    const localDevice = localStorage.getItem(STORAGE_DEVICE_NAME_KEY);
    if (!url || !secret || !localDevice || localDevice.trim() === '') return;

    const debounceSec = parseInt(localStorage.getItem(STORAGE_CLOUD_DEBOUNCE_KEY)) || 10;
    updateCloudStatus(`⏳ En attente d'inactivité (${debounceSec}s)...`, "warning");
    clearTimeout(cloudSyncTimer); cloudSyncTimer = setTimeout(executerSyncCloudDirecte, debounceSec * 1000);
}

async function executerSyncCloudDirecte() {
    const url = localStorage.getItem(STORAGE_CLOUD_URL_KEY);
    const secret = localStorage.getItem(STORAGE_CLOUD_SECRET_KEY);
    const localDevice = localStorage.getItem(STORAGE_DEVICE_NAME_KEY);
    if (!localDevice || localDevice.trim() === '' || !url || !secret) return;

    updateCloudStatus("⏳ Sauvegarde cloud...", "warning");
    appData.lastDevice = localDevice;

    try {
        const response = await fetch(url, { method: 'POST', body: JSON.stringify({ action: 'set', secret: secret, data: appData }) });
        const res = await response.json();
        if (res.success) {
            appData.lastCloudSync = Date.now(); localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
            updateCloudStatus("☁️ À jour", "success");
        } else {
            updateCloudStatus(`❌ Erreur : ${res.error}`, "danger");
        }
    } catch (err) { updateCloudStatus("❌ Erreur réseau (Sauvegarde différée)", "danger"); }
}

function ouvrirModaleConflit(localDevice, localTs, cloudDevice, cloudTs, cloudData) {
    currentCloudPayload = cloudData;
    DOM.conflict.localDevice.textContent = localDevice;
    DOM.conflict.cloudDevice.textContent = cloudDevice;
    DOM.conflict.localDate.innerHTML = formatDate(localTs);
    DOM.conflict.cloudDate.innerHTML = formatDate(cloudTs);
    
    if (localTs > cloudTs) {
        DOM.conflict.localDate.innerHTML += ' <span class="text-success-bold whitespace-nowrap">✨ (Plus récent)</span>';
        DOM.conflict.localDate.classList.add('font-bold');
    } else if (cloudTs > localTs) {
        DOM.conflict.cloudDate.innerHTML += ' <span class="text-success-bold whitespace-nowrap">✨ (Plus récent)</span>';
        DOM.conflict.cloudDate.classList.add('font-bold');
    }
    
    const [localVolHtml, cloudVolHtml] = genererDiffVolume(appData.lists, cloudData.lists);
    DOM.conflict.localVolume.innerHTML = localVolHtml;
    DOM.conflict.cloudVolume.innerHTML = cloudVolHtml;
    DOM.conflict.modal.classList.remove('hidden');
}

function fermerModaleConflit() {
    DOM.conflict.modal.classList.add('hidden');
    currentCloudPayload = null;
    DOM.conflict.localDate.classList.remove('font-bold');
    DOM.conflict.cloudDate.classList.remove('font-bold');
}

function resoudreConflitViaCloud() {
    if (!currentCloudPayload) return;
    appData = currentCloudPayload; appData.lastCloudSync = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    applyThemeEngine(); renderAll(); updateCloudStatus("☁️ À jour (Cloud conservé)", "success");
    fermerModaleConflit();
}

async function resoudreConflitViaLocal() {
    fermerModaleConflit(); updateCloudStatus("⏳ Forçage de la version locale...", "warning");
    await executerSyncCloudDirecte();
}

async function resoudreConflitViaFusion() {
    if (!currentCloudPayload) return;
    const cloudData = currentCloudPayload; const localData = appData;

    const unifiedTrashMap = new Map();
    [...localData.trash, ...(cloudData.trash || [])].forEach(item => {
        if (!unifiedTrashMap.has(item.id) || item.lastModified > unifiedTrashMap.get(item.id).lastModified) { unifiedTrashMap.set(item.id, item); }
    });

    const mergedLists = [];
    const allListIds = new Set([...localData.lists.map(l => l.id), ...cloudData.lists.map(l => l.id)]);

    allListIds.forEach(listId => {
        const localList = localData.lists.find(l => l.id === listId);
        const cloudList = cloudData.lists.find(l => l.id === listId);
        let mergedList = null;

        if (localList && cloudList) mergedList = localList.lastModified >= cloudList.lastModified ? { ...localList } : { ...cloudList };
        else if (localList) mergedList = { ...localList };
        else if (cloudList) mergedList = { ...cloudList };

        if (mergedList) {
            mergedList.notes = [];
            const localNotes = localList ? localList.notes : []; const cloudNotes = cloudList ? cloudList.notes : [];
            const allNoteIds = new Set([...localNotes.map(n => n.id), ...cloudNotes.map(n => n.id)]);
            const mergedNotes = [];

            allNoteIds.forEach(noteId => {
                const lNote = localNotes.find(n => n.id === noteId); const cNote = cloudNotes.find(n => n.id === noteId);
                const trashItem = unifiedTrashMap.get(noteId);
                let winningNote = null;
                if (lNote && cNote) winningNote = lNote.lastModified >= cNote.lastModified ? { ...lNote } : { ...cNote };
                else if (lNote) winningNote = { ...lNote };
                else if (cNote) winningNote = { ...cNote };

                if (winningNote && trashItem && trashItem.deletedTs > winningNote.lastModified) { /* Skip, reste dans la corbeille */ } 
                else if (winningNote) { mergedNotes.push(winningNote); unifiedTrashMap.delete(noteId); }
            });

            const orderSourceNotes = localList && cloudList ? (localList.lastModified >= cloudList.lastModified ? localNotes : cloudNotes) : (localList ? localNotes : cloudNotes);
            mergedNotes.sort((a, b) => {
                const indexA = orderSourceNotes.findIndex(n => n.id === a.id); const indexB = orderSourceNotes.findIndex(n => n.id === b.id);
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1; if (indexB !== -1) return 1;
                return b.lastModified - a.lastModified;
            });
            mergedList.notes = mergedNotes; mergedLists.push(mergedList);
        }
    });

    const masterListOrder = localData.lastLocalChange >= cloudData.lastLocalChange ? localData.lists.map(l => l.id) : cloudData.lists.map(l => l.id);
    mergedLists.sort((a, b) => {
        const idxA = masterListOrder.indexOf(a.id); const idxB = masterListOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1; if (idxB !== -1) return 1;
        return b.lastModified - a.lastModified;
    });

    appData.lists = mergedLists;
    appData.trash = Array.from(unifiedTrashMap.values()); appData.trash.sort((a, b) => (b.deletedTs || 0) - (a.deletedTs || 0)); 

    fermerModaleConflit(); updateCloudStatus("⏳ Fusion en cours...", "warning");
    appData.lastLocalChange = Date.now(); saveToBrowser(); applyThemeEngine(); renderAll();
    
    await executerSyncCloudDirecte(); updateCloudStatus("☁️ Fusionné et à jour", "success");
}

// Lancement au chargement du script
init();