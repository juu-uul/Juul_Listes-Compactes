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
let appData = { lists: [], trash: [], trashCollapsed: true, panelCollapsed: true, themeMode: 'auto', lastExport: null, lastImport: null };
let searchQuery = '';
let activeSortableInstances = [];

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
            
            appData.lists.forEach(l => {
                if (!l.id) l.id = 'list_' + Math.random().toString(36).substr(2, 9);
                l.notes.forEach(n => {
                    if (!n.id) n.id = 'note_' + Math.random().toString(36).substr(2, 9);
                });
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
}

function resetToDefault() {
    appData = {
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
}

function saveToBrowser() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
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
    const maxKB = 5120; // 5 Mo standard théorique global
    const ratio = ((sizeKB / maxKB) * 100).toFixed(1);
    
    storageInfo.innerHTML = `Stockage : <b>${sizeKB} Ko</b> / ${maxKB} Ko (${ratio}%)`;
}

window.handleNoteSubmitKey = (e) => {
    // Sur desktop (écran > 768px), Entrée sans Maj valide le formulaire directement
    if (e.key === 'Enter' && !e.shiftKey && !window.matchMedia('(max-width: 768px)').matches) {
        e.preventDefault();
        e.target.form.requestSubmit();
    }
};

function renderAll() {
    checkBackupReminder();
    if (backupTimestamps) {
        backupTimestamps.innerHTML = `Export : <b>${formatDate(appData.lastExport)}</b> | Import : <b>${formatDate(appData.lastImport)}</b>`;
    }
    
    updateStorageMetric();

    if (btnToggleAll) {
        const anyExpanded = appData.lists.some(l => !l.collapsed);
        btnToggleAll.innerHTML = anyExpanded ? '↕️ Replier' : '↕️ Déplier';
    }

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
                    <span class="list-drag-handle" style="color: #adb5bd; font-size:14px; margin-right: 4px; padding: 4px 10px; cursor:move; user-select:none; -webkit-user-select:none;">☰</span>
                    <span class="list-title-text">${escapeHTML(list.name)} (${list.notes.length})</span>
                </div>
                <div>
                    <button class="btn-toggle" style="background:none; border:none; color:inherit;" onclick="toggleList('${list.id}')">${list.collapsed ? '▶' : '▼'}</button>
                    <button class="delete-btn" style="background:none; border:none; color:var(--danger); padding:0 2px;" onclick="deleteList('${list.id}')">✕</button>
                </div>
            </div>
            <div class="list-content ${list.collapsed ? 'collapsed' : ''}">
                <form onsubmit="addNote(event, '${list.id}')" class="input-group">
                    <textarea placeholder="Ajouter... (! = urgent, ? = incertain)" required autocomplete="off" rows="1" onkeydown="handleNoteSubmitKey(event)"></textarea>
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
                                    <button class="edit-btn" style="background:none; border:none; color:inherit; opacity:0.4; cursor:pointer; padding:0 2px; font-size:12px;" onclick="enableNoteEdit(event, '${list.id}', '${note.id}')" title="Modifier">✏️</button>
                                    <button class="delete-btn" style="background:none; border:none; color:inherit; opacity:0.5; cursor:pointer; padding:0 2px;" onclick="moveToTrash('${list.id}', '${note.id}')" title="Supprimer">✕</button>
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
                    ${appData.trash.length > 0 ? `<button class="delete-btn" style="background:#6c757d; border:none; color:white; border-radius:2px; margin-right:5px; padding: 1px 4px; font-size:10px;" onclick="emptyTrash()">Vider</button>` : ''}
                    <button class="btn-toggle" style="background:none; border:none; color:inherit;" onclick="toggleTrash()">${appData.trashCollapsed ? '▶' : '▼'}</button>
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
                        toList.notes.push(movedNote);
                    }
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
    input.style.padding = "2px 4px";
    input.value = listData.name;
    
    textSpan.style.display = 'none';
    titleZone.appendChild(input);
    input.focus();
    input.select();

    const saveRename = () => {
        const newName = input.value.trim();
        if (newName && newName !== listData.name) {
            listData.name = newName;
            saveToBrowser();
        }
        renderAll();
    };

    input.addEventListener('blur', saveRename);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') renderAll(); });
};

window.enableNoteEdit = (event, listId, noteId) => {
    let mainZone = event.currentTarget;
    // Si l'édition est déclenchée par le bouton crayon ✏️ plutôt que par dblclick
    if (!mainZone.classList.contains('note-main')) {
        const noteItem = mainZone.closest('.note-item');
        mainZone = noteItem.querySelector('.note-main');
    }
    if (mainZone.querySelector('textarea')) return;

    const listData = appData.lists.find(l => l.id === listId);
    if (!listData) return;
    const noteData = listData.notes.find(n => n.id === noteId);
    if (!noteData) return;

    const textSpan = mainZone.querySelector('.note-text-span');
    const dateSpan = mainZone.querySelector('.note-date');

    const textarea = document.createElement('textarea');
    textarea.value = noteData.text;
    textarea.rows = noteData.text.split('\n').length || 2;
    textarea.style.fontFamily = "inherit";
    textarea.style.fontSize = "inherit";
    textarea.style.width = "100%";
    textarea.style.boxSizing = "border-box";
    textarea.style.padding = "2px 4px";
    textarea.style.background = "var(--surface)";
    textarea.style.color = "var(--text)";
    textarea.style.border = "1px solid var(--border)";
    textarea.style.borderRadius = "3px";
    textarea.style.resize = "vertical";

    textSpan.style.display = 'none';
    dateSpan.style.display = 'none';
    mainZone.insertBefore(textarea, dateSpan);
    textarea.focus();
    textarea.select();

    let isSaved = false;
    const saveNoteChange = () => {
        if (isSaved) return;
        isSaved = true;
        const newText = textarea.value.trim();
        if (newText && newText !== noteData.text) {
            noteData.text = newText;
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
        // Sur bureau, Entrée sans Maj valide les modifications
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
    appData.lists.push({ id: 'list_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), name: name, collapsed: false, notes: [] });
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
            createdStr: formatDate(new Date())
        };

        if (parsed.isPriority) {
            listData.notes.unshift(newNoteObj);
        } else {
            listData.notes.push(newNoteObj);
        }
        saveToBrowser();
    }
    input.value = '';
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
    }
};

window.moveToTrash = (listId, noteId) => {
    const listData = appData.lists.find(l => l.id === listId);
    if (!listData) return;
    const noteIndex = listData.notes.findIndex(n => n.id === noteId);
    if (noteIndex !== -1) {
        const note = listData.notes.splice(noteIndex, 1)[0];
        note.originListId = listData.id;
        note.originListName = listData.name;
        note.deletedStr = formatDate(new Date());
        appData.trash.unshift(note);
        saveToBrowser();
    }
    renderAll();
};

window.restoreFromTrash = (trashIndex) => {
    const note = appData.trash.splice(trashIndex, 1)[0];
    let targetList = appData.lists.find(l => l.id === note.originListId);
    if (!targetList && appData.lists.length > 0) targetList = appData.lists[0];

    if (targetList) {
        targetList.notes.push({ id: note.id, text: note.text, createdStr: note.createdStr });
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
        div.innerHTML = `<span>⚠️ Sauvegarde requise.</span> <button onclick="exportData()" style="padding:1px 4px; font-size:10px; background:#fff; border:1px solid #ffecb5; border-radius:2px;">Exporter</button>`;
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
    btnReset.addEventListener('click', () => { if (confirm("Tout effacer ?")) { localStorage.removeItem(STORAGE_KEY); init(); } });
}

function formatDate(dateObj) { if (!dateObj) return 'jamais'; const d = new Date(dateObj); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }

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

init();