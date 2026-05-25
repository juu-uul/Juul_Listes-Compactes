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
const btnReset = document.getElementById('btn-reset');
const btnTheme = document.getElementById('btn-theme');

// Initialisation de la base locale PouchDB
const localDB = new PouchDB('ma_pwa_compact_lists_db');
let remoteDB = null;
let syncHandler = null;

let appData = { _id: 'app_state', lists: [], trash: [], trashCollapsed: true, panelCollapsed: true, themeMode: 'auto', lastExport: null, lastImport: null };
let searchQuery = '';
let activeSortableInstances = [];

async function init() {
    await loadFromPouch();

    const panel = document.getElementById('control-panel');
    if (appData.panelCollapsed) {
        panel.classList.add('hidden');
    } else {
        panel.classList.remove('hidden');
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

    checkSavedSyncCredentials();
    renderAll();
}

async function loadFromPouch() {
    try {
        const doc = await localDB.get('app_state');
        appData = doc;
    } catch (err) {
        if (err.status === 404) {
            resetToDefault();
            await localDB.put(appData);
        } else {
            console.error("Erreur de lecture PouchDB :", err);
        }
    }
}

function resetToDefault() {
    const oldRev = appData._rev;
    appData = {
        _id: 'app_state',
        lists: [
            { id: 'l1', name: 'À faire', collapsed: false, notes: [{ id: 'n1', text: '!Tâche urgente exemple', createdStr: formatDate(new Date()) }, { id: 'n2', text: 'Tâche normale compacte', createdStr: formatDate(new Date()) }] },
            { id: 'l2', name: 'En cours', collapsed: false, notes: [] }
        ],
        trash: [],
        trashCollapsed: true,
        panelCollapsed: true,
        themeMode: 'auto',
        lastExport: null,
        lastImport: null
    };
    if (oldRev) appData._rev = oldRev;
}

async function saveToBrowser() {
    try {
        try {
            const currentDoc = await localDB.get('app_state');
            appData._rev = currentDoc._rev;
        } catch (e) {
            if (e.status !== 404) throw e;
        }
        await localDB.put(appData);
    } catch (err) {
        console.error("Échec de la sauvegarde locale dans PouchDB :", err);
    }
}

function applyThemeEngine() {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (appData.themeMode === 'dark' || (appData.themeMode === 'auto' && systemPrefersDark)) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    btnTheme.innerHTML = appData.themeMode === 'auto' ? '🌓 Auto' : appData.themeMode === 'dark' ? '🌙 Sombre' : '☀️ Clair';
}

window.toggleTheme = async () => {
    appData.themeMode = appData.themeMode === 'auto' ? 'light' : appData.themeMode === 'light' ? 'dark' : 'auto';
    await saveToBrowser();
    applyThemeEngine();
};

function checkSavedSyncCredentials() {
    const saved = localStorage.getItem('pwa_cloudant_sync_creds');
    if (saved) {
        try {
            const creds = JSON.parse(saved);
            startSyncEngine(creds.host, creds.user, creds.pass);
        } catch (e) {
            localStorage.removeItem('pwa_cloudant_sync_creds');
        }
    }
}

window.setupCloudSync = () => {
    const hostInput = document.getElementById('sync-url').value.trim();
    const userInput = document.getElementById('sync-user').value.trim();
    const passInput = document.getElementById('sync-pass').value.trim();
    const remember = document.getElementById('sync-remember').checked;

    if (!hostInput || !userInput || !passInput) {
        alert("Veuillez remplir tous les champs de connexion distant.");
        return;
    }

    const cleanHost = hostInput.replace('https://', '').replace('http://', '').split('/')[0];

    if (remember) {
        localStorage.setItem('pwa_cloudant_sync_creds', JSON.stringify({ host: cleanHost, user: userInput, pass: passInput }));
    }

    startSyncEngine(cleanHost, userInput, passInput);
};

function startSyncEngine(host, user, pass) {
    if (syncHandler) syncHandler.cancel();

    const dbName = "pwa_compact_lists"; 
    const remoteURL = `https://${user}:${pass}@${host}/${dbName}`;

    remoteDB = new PouchDB(remoteURL);

    syncHandler = localDB.sync(remoteDB, {
        live: true,
        retry: true
    }).on('change', async function (info) {
        if (info.direction === 'pull') {
            console.log('Synchronisation : Données distantes reçues, mise à jour UI...');
            await loadFromPouch();
            renderAll();
        }
    }).on('error', function (err) {
        console.error('Erreur de réplication critique :', err);
    });

    document.getElementById('sync-form').classList.add('hidden');
    document.getElementById('sync-status').classList.remove('hidden');
}

window.disconnectCloudSync = () => {
    if (syncHandler) syncHandler.cancel();
    localStorage.removeItem('pwa_cloudant_sync_creds');
    remoteDB = null;
    syncHandler = null;

    document.getElementById('sync-url').value = '';
    document.getElementById('sync-user').value = '';
    document.getElementById('sync-pass').value = '';
    document.getElementById('sync-remember').checked = false;

    document.getElementById('sync-form').classList.remove('hidden');
    document.getElementById('sync-status').classList.add('hidden');
    alert("Synchronisation déconnectée.");
};

function renderAll() {
    checkBackupReminder();
    backupTimestamps.innerHTML = `Export : <b>${formatDate(appData.lastExport)}</b> | Import : <b>${formatDate(appData.lastImport)}</b>`;

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
                <div class="list-title-zone" onclick="enableInlineEdit(event, '${list.id}')">
                    <span style="color: #adb5bd; font-size:10px; margin-right: 5px; cursor:move;">☰</span>
                    <span class="list-title-text">${escapeHTML(list.name)} (${list.notes.length})</span>
                </div>
                <div>
                    <button class="btn-toggle" style="background:none; border:none; color:inherit;" onclick="toggleList('${list.id}')">${list.collapsed ? '▶' : '▼'}</button>
                    <button class="delete-btn" style="background:none; border:none; color:var(--danger); padding:0 2px;" onclick="deleteList('${list.id}')">✕</button>
                </div>
            </div>
            <div class="list-content ${list.collapsed ? 'collapsed' : ''}">
                <form onsubmit="addNote(event, '${list.id}')" class="input-group">
                    <input type="text" placeholder="Ajouter... (! = urgent)" required autocomplete="off">
                    <button type="submit">+</button>
                </form>
                <ul class="notes-dropzone" data-list-id="${list.id}">
                    ${filteredNotes.map((note) => {
                        const parsed = getNoteDisplay(note.text);
                        return `
                            <li class="note-item ${parsed.isPriority ? 'priority-high' : ''}" data-id="${note.id}">
                                <div class="note-main" ondblclick="enableNoteEdit(event, '${list.id}', '${note.id}')">
                                    <span class="note-text-span">${escapeHTML(parsed.cleanText)}</span>
                                    <span class="note-date">le ${note.createdStr || 'N/A'}</span>
                                </div>
                                <button class="delete-btn" style="background:none; border:none; color:inherit; opacity:0.5; cursor:pointer;" onclick="moveToTrash('${list.id}', '${note.id}')">✕</button>
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
                    ${appData.trash.length > 0 ? `<button class="delete-btn" style="background:#6c757d; border:none; color:white; border-radius:2px; margin-right:5px; padding: 1px 4px; font-size:10px;" onclick="emptyTrash()">Vider</button>` : ''}
                    <button class="btn-toggle" style="background:none; border:none; color:inherit;" onclick="toggleTrash()">${appData.trashCollapsed ? '▶' : '▼'}</button>
                </div>
            </div>
            <div class="list-content ${appData.trashCollapsed ? 'collapsed' : ''}">
                <ul style="list-style:none; padding:0; margin:0;">
                    ${filteredTrash.length === 0 ? '<li style="color:#adb5bd; text-align:center; padding:3px; font-size:12px;">Aucun élément</li>' : ''}
                    ${filteredTrash.map((note) => {
                        const parsed = getNoteDisplay(note.text);
                        return `
                            <li class="note-item trash-item ${parsed.isPriority ? 'priority-high' : ''}">
                                <div class="note-main">
                                    <span>${escapeHTML(parsed.cleanText)}</span>
                                    <span class="note-date">Créé: ${note.createdStr || '?'} | <span style="color:var(--danger)">Supprimé le: ${note.deletedStr || 'N/A'}</span> (De: ${escapeHTML(note.originListName || 'Inconnu')})</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:4px;">
                                    <button class="btn-restore" style="font-size:10px; padding:1px 4px;" onclick="restoreFromTrash(${note.originalIndex})">Restaurer</button>
                                    <button class="delete-btn" style="background:none; border:none; color:var(--danger);" onclick="permanentDelete(${note.originalIndex})">✕</button>
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
        handle: '.list-header',
        ghostClass: 'ghost-list',
        delay: 150,
        delayOnTouchOnly: true,
        touchStartThreshold: 5,
        onEnd: async function () {
            const newOrderedLists = [];
            document.querySelectorAll('#lists-container .list-block').forEach(block => {
                const listId = block.dataset.id;
                const foundList = appData.lists.find(l => l.id === listId);
                if (foundList) newOrderedLists.push(foundList);
            });
            appData.lists = newOrderedLists;
            await saveToBrowser();
            syncDOMAttributes();
        }
    });
    activeSortableInstances.push(s1);

    document.querySelectorAll('.notes-dropzone').forEach(zone => {
        const s2 = Sortable.create(zone, {
            animation: 120,
            group: 'shared-notes-group',
            ghostClass: 'ghost-note',
            fallbackTolerance: 3,
            delay: 100,
            delayOnTouchOnly: true,
            onEnd: async function (evt) {
                const fromListId = evt.from.dataset.listId;
                const toListId = evt.to.dataset.listId;
                
                const fromList = appData.lists.find(l => l.id === fromListId);
                const toList = appData.lists.find(l => l.id === toListId);
                
                if (!fromList || !toList) return;

                const newNotesOrder = [];
                evt.to.querySelectorAll('.note-item').forEach(li => {
                    const noteId = li.dataset.id;
                    const foundNote = fromList.notes.find(n => n.id === noteId) || toList.notes.find(n => n.id === noteId);
                    if (foundNote) newNotesOrder.push(foundNote);
                });

                if (fromListId !== toListId) {
                    const noteIdMoved = evt.item.dataset.id;
                    fromList.notes = fromList.notes.filter(n => n.id !== noteIdMoved);
                }

                toList.notes = newNotesOrder;
                await saveToBrowser();
                syncDOMAttributes();
            }
        });
        activeSortableInstances.push(s2);
    });
}

function syncDOMAttributes() {
    document.querySelectorAll('.list-block').forEach((block) => {
        const listId = block.dataset.id;
        const listData = appData.lists.find(l => l.id === listId);
        if (!listData) return;

        const countSpan = block.querySelector('.list-title-text');
        if (countSpan) countSpan.textContent = `${listData.name} (${listData.notes.length})`;
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
    if (event.target.textContent === '☰') return;
    const titleZone = event.currentTarget;
    const textSpan = titleZone.querySelector('.list-title-text');
    if (titleZone.querySelector('input')) return;

    const listData = appData.lists.find(l => l.id === listId);
    if (!listData) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.style.padding = "2px 4px";
    input.value = listData.name;
    
    textSpan.style.display = 'none';
    titleZone.appendChild(input);
    input.focus();
    input.select();

    const saveRename = async () => {
        const newName = input.value.trim();
        if (newName && newName !== listData.name) {
            listData.name = newName;
            await saveToBrowser();
        }
        renderAll();
    };

    input.addEventListener('blur', saveRename);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') renderAll(); });
};

window.enableNoteEdit = (event, listId, noteId) => {
    const mainZone = event.currentTarget;
    if (mainZone.querySelector('input')) return;

    const listData = appData.lists.find(l => l.id === listId);
    if (!listData) return;
    const noteData = listData.notes.find(n => n.id === noteId);
    if (!noteData) return;

    const textSpan = mainZone.querySelector('.note-text-span');
    const dateSpan = mainZone.querySelector('.note-date');

    const input = document.createElement('input');
    input.type = 'text';
    input.style.padding = "2px 4px";
    input.value = noteData.text;

    textSpan.style.display = 'none';
    dateSpan.style.display = 'none';
    mainZone.insertBefore(input, dateSpan);
    input.focus();
    input.select();

    const saveNoteChange = async () => {
        const newText = input.value.trim();
        if (newText && newText !== noteData.text) {
            noteData.text = newText;
            await saveToBrowser();
        }
        renderAll();
    };

    input.addEventListener('blur', saveNoteChange);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveNoteChange(); if (e.key === 'Escape') renderAll(); });
};

formAddList.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = inputListName.value.trim();
    if (!name) return;
    appData.lists.push({ id: 'list_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), name: name, collapsed: false, notes: [] });
    inputListName.value = '';
    await saveToBrowser();
    renderAll();
});

window.addNote = async (e, listId) => {
    e.preventDefault();
    const input = e.target.querySelector('input[type="text"]');
    const text = input.value.trim();
    if (!text) return;

    const listData = appData.lists.find(l => l.id === listId);
    if (listData) {
        listData.notes.push({ 
            id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), 
            text: text,
            createdStr: formatDate(new Date())
        });
        await saveToBrowser();
    }
    input.value = '';
    renderAll();
};

window.toggleList = async (listId) => {
    const listData = appData.lists.find(l => l.id === listId);
    if (listData) { listData.collapsed = !listData.collapsed; await saveToBrowser(); }
    renderAll();
};

window.toggleAllLists = async () => {
    const auMoinsUneDeveloppee = appData.lists.some(list => !list.collapsed);
    appData.lists.forEach(list => {
        list.collapsed = auMoinsUneDeveloppee;
    });
    await saveToBrowser();
    renderAll();
};

window.deleteList = async (listId) => {
    const index = appData.lists.findIndex(l => l.id === listId);
    if (index !== -1) {
        const list = appData.lists[index];
        if (confirm(`Supprimer la liste "${list.name}" ?`)) {
            list.notes.forEach(note => {
                note.originListId = list.id;
                note.originListName = list.name;
                note.deletedStr = formatDate(new Date());
                appData.trash.unshift(note);
            });
            appData.lists.splice(index, 1);
            await saveToBrowser();
            renderAll();
        }
    }
};

window.moveToTrash = async (listId, noteId) => {
    const listData = appData.lists.find(l => l.id === listId);
    if (!listData) return;
    const noteIndex = listData.notes.findIndex(n => n.id === noteId);
    if (noteIndex !== -1) {
        const note = listData.notes.splice(noteIndex, 1)[0];
        note.originListId = listData.id;
        note.originListName = listData.name;
        note.deletedStr = formatDate(new Date());
        appData.trash.unshift(note);
        await saveToBrowser();
    }
    renderAll();
};

window.restoreFromTrash = async (trashIndex) => {
    const note = appData.trash.splice(trashIndex, 1)[0];
    let targetList = appData.lists.find(l => l.id === note.originListId);
    if (!targetList && appData.lists.length > 0) targetList = appData.lists[0];

    if (targetList) {
        targetList.notes.push({ id: note.id, text: note.text, createdStr: note.createdStr });
    } else {
        appData.trash.unshift(note);
    }
    await saveToBrowser();
    renderAll();
};

window.permanentDelete = async (trashIndex) => { appData.trash.splice(trashIndex, 1); await saveToBrowser(); renderAll(); };
window.emptyTrash = async () => { if (confirm("Vider définitivement la corbeille ?")) { appData.trash = []; await saveToBrowser(); renderAll(); } };
window.toggleTrash = async () => { appData.trashCollapsed = !appData.trashCollapsed; await saveToBrowser(); renderAll(); };

function checkBackupReminder() {
    alertContainer.innerHTML = '';
    const unSemaineMs = 7 * 24 * 60 * 60 * 1000;
    if (appData.lastExport === null || (Date.now() - appData.lastExport) > unSemaineMs) {
        const div = document.createElement('div');
        div.className = 'backup-alert';
        div.innerHTML = `<span>⚠️ Sauvegarde requise.</span> <button onclick="exportData()" style="padding:1px 4px; font-size:10px; background:#fff; border:1px solid #ffecb5; border-radius:2px;">Exporter</button>`;
        alertContainer.appendChild(div);
    }
}

window.triggerImport = () => { document.getElementById('import-file-input').click(); };

// FONCTION EXPORT MODIFIÉE AVEC TIMESTAMP PERSONNALISÉ
window.exportData = async () => {
    appData.lastExport = Date.now(); 
    await saveToBrowser();
    
    const cleanData = { ...appData };
    delete cleanData._id;
    delete cleanData._rev;

    // Construction de la date au format aaaammjj hhmmss
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    
    const timestamp = `${yyyy}${mm}${dd} ${hh}${min}${ss}`;

    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(JSON.stringify(cleanData, null, 2));
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `backup_listes_${timestamp}.json`);
    linkElement.click();
    renderAll();
};

window.importData = (event) => {
    const fileReader = new FileReader();
    const file = event.target.files[0];
    if (!file) return;
    fileReader.onload = async (e) => {
        try {
            const parsedData = JSON.parse(e.target.result);
            if (parsedData && Array.isArray(parsedData.lists)) {
                const currentRev = appData._rev;
                appData = parsedData;
                appData._id = 'app_state';
                if (currentRev) appData._rev = currentRev;
                if (!appData.trash) appData.trash = [];
                appData.lastImport = Date.now();
                
                await saveToBrowser(); 
                applyThemeEngine(); 
                renderAll();
                alert("Importation réussie !");
            }
        } catch (err) { alert("Erreur de fichier JSON."); }
    };
    fileReader.readAsText(file);
};

window.toggleControlPanel = async () => { 
    const panel = document.getElementById('control-panel'); 
    appData.panelCollapsed = panel.classList.toggle('hidden'); 
    await saveToBrowser(); 
};

btnReset.addEventListener('click', async () => { 
    if (confirm("Tout effacer ?")) { 
        await localDB.destroy(); 
        window.location.reload(); 
    } 
});

function formatDate(dateObj) { if (!dateObj) return 'jamais'; const d = new Date(dateObj); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function getNoteDisplay(text) { const isPriority = text.startsWith('!'); return { isPriority, cleanText: isPriority ? text.substring(1).trim() : text }; }
function escapeHTML(str) { return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)); }

init();