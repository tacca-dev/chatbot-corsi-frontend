// script.js

// ===== CONFIGURAZIONE IMPORTANTE =====
// CAMBIA QUESTO CON L'URL DEL TUO BACKEND PYTHON!
const API_URL = 'https://chatbot-corsi.onrender.com';

// ===== FINE CONFIGURAZIONE =====

// Configura marked.js per il rendering del markdown
if (typeof marked !== 'undefined') {
    marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: false,
        mangle: false
    });
}

// Gestione sessione
let sessionId = localStorage.getItem('chatSessionId') || generateSessionId();
localStorage.setItem('chatSessionId', sessionId);

// Elementi DOM
const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const timeElement = document.getElementById('time');

// Elementi Upload
const uploadSection = document.getElementById('uploadSection');
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const folderInput = document.getElementById('folderInput');
const browseButton = document.getElementById('browseButton');
const filesPreview = document.getElementById('filesPreview');
const filesList = document.getElementById('filesList');
const clearFilesBtn = document.getElementById('clearFilesBtn');
const uploadBtn = document.getElementById('uploadBtn');
const toggleUploadBtn = document.getElementById('toggleUploadBtn');
const uploadToggleButton = document.getElementById('uploadToggleButton');

// Elementi Popup Selezione Cartella
const folderSelectionOverlay = document.getElementById('folderSelectionOverlay');
const modalClose = document.getElementById('modalClose');
const modalCancel = document.getElementById('modalCancel');
const modalConfirm = document.getElementById('modalConfirm');
const selectAllBtn = document.getElementById('selectAllBtn');
const deselectAllBtn = document.getElementById('deselectAllBtn');
const modalFileList = document.getElementById('modalFileList');
const folderNameElement = document.getElementById('folderName');
const fileCountElement = document.getElementById('fileCount');
const selectedCountElement = document.getElementById('selectedCount');

// Variabili per gestione file
let selectedFiles = new Map(); // Map per evitare duplicati
let tempFolderFiles = []; // Array temporaneo per file da cartella
let isProcessingFolder = false; // Flag per evitare aperture multiple

// Aggiorna ora ogni secondo
function updateTime() {
    const now = new Date();
    timeElement.textContent = now.toLocaleTimeString('it-IT', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}
updateTime();
setInterval(updateTime, 1000);

// Genera ID sessione univoco
function generateSessionId() {
    return 'session-' + Math.random().toString(36).substr(2, 9);
}

// ===== GESTIONE DRAG & DROP =====

// Previeni comportamento default del browser per drag & drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Highlight dell'area durante il drag
['dragenter', 'dragover'].forEach(eventName => {
    uploadArea.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, unhighlight, false);
});

function highlight(e) {
    uploadArea.classList.add('drag-over');
}

function unhighlight(e) {
    uploadArea.classList.remove('drag-over');
}

// Gestione drop dei file
uploadArea.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const items = dt.items;
    
    // Reset array temporaneo
    tempFolderFiles = [];
    isProcessingFolder = false;
    
    if (items) {
        // Array per promesse di lettura file
        const promises = [];
        
        // Usa DataTransferItemList per supportare cartelle
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                    if (entry.isDirectory) {
                        isProcessingFolder = true;
                    }
                    promises.push(traverseFileTree(entry));
                }
            }
        }
        
        // Aspetta che tutti i file siano letti
        Promise.all(promises).then(() => {
            if (isProcessingFolder && tempFolderFiles.length > 0) {
                // Mostra popup per selezione
                showFolderSelectionPopup(tempFolderFiles);
            } else if (tempFolderFiles.length > 0) {
                // Aggiungi file singoli direttamente
                tempFolderFiles.forEach(fileInfo => {
                    addFile(fileInfo.file, fileInfo.path);
                });
            }
        });
    } else {
        // Fallback per browser che non supportano entries
        const files = dt.files;
        handleFiles(files);
    }
}

// Attraversa ricorsivamente le cartelle (solo primo livello)
function traverseFileTree(item, path = "") {
    return new Promise((resolve) => {
        if (item.isFile) {
            item.file(file => {
                if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                    tempFolderFiles.push({
                        file: file,
                        path: path,
                        folderName: path || 'Root'
                    });
                }
                resolve();
            });
        } else if (item.isDirectory) {
            // Leggi solo il primo livello della cartella
            const dirReader = item.createReader();
            dirReader.readEntries(entries => {
                const promises = [];
                for (let i = 0; i < entries.length; i++) {
                    // Solo file, ignora sottocartelle
                    if (entries[i].isFile) {
                        promises.push(traverseFileTree(entries[i], item.name));
                    }
                }
                Promise.all(promises).then(resolve);
            });
        } else {
            resolve();
        }
    });
}

// Mostra popup selezione file da cartella
function showFolderSelectionPopup(folderFiles) {
    // Raggruppa per cartella (nel caso di drop multipli)
    const folderName = folderFiles[0].folderName || 'Cartella';
    
    // Aggiorna info header
    folderNameElement.textContent = `Cartella: ${folderName}`;
    fileCountElement.textContent = `${folderFiles.length} file PDF trovati`;
    
    // Pulisci lista precedente
    modalFileList.innerHTML = '';
    
    // Crea checkbox per ogni file
    folderFiles.forEach((fileInfo, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-checkbox-item';
        fileItem.dataset.index = index;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'file-checkbox';
        checkbox.id = `file-check-${index}`;
        checkbox.checked = true; // Selezionato di default
        
        const label = document.createElement('label');
        label.className = 'file-label';
        label.htmlFor = `file-check-${index}`;
        label.innerHTML = `
            ${fileInfo.file.name}
            <span class="file-label-size">${formatFileSize(fileInfo.file.size)}</span>
        `;
        
        // Click su item per toggle checkbox
        fileItem.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
                updateSelectedCount();
                updateItemVisualState(fileItem, checkbox.checked);
            }
        });
        
        checkbox.addEventListener('change', () => {
            updateSelectedCount();
            updateItemVisualState(fileItem, checkbox.checked);
        });
        
        fileItem.appendChild(checkbox);
        fileItem.appendChild(label);
        modalFileList.appendChild(fileItem);
        
        // Stato visuale iniziale
        updateItemVisualState(fileItem, true);
    });
    
    // Aggiorna contatore iniziale
    updateSelectedCount();
    
    // Mostra popup
    folderSelectionOverlay.style.display = 'flex';
}

// Aggiorna stato visuale item
function updateItemVisualState(item, isSelected) {
    if (isSelected) {
        item.classList.add('selected');
    } else {
        item.classList.remove('selected');
    }
}

// Aggiorna contatore file selezionati
function updateSelectedCount() {
    const checkboxes = modalFileList.querySelectorAll('.file-checkbox');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    selectedCountElement.textContent = checkedCount;
    
    // Disabilita conferma se nessun file selezionato
    modalConfirm.disabled = checkedCount === 0;
}

// Gestione pulsanti popup
selectAllBtn.addEventListener('click', () => {
    const checkboxes = modalFileList.querySelectorAll('.file-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = true;
        const item = cb.closest('.file-checkbox-item');
        updateItemVisualState(item, true);
    });
    updateSelectedCount();
});

deselectAllBtn.addEventListener('click', () => {
    const checkboxes = modalFileList.querySelectorAll('.file-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = false;
        const item = cb.closest('.file-checkbox-item');
        updateItemVisualState(item, false);
    });
    updateSelectedCount();
});

// Chiusura popup
function closeFolderSelectionPopup() {
    folderSelectionOverlay.style.display = 'none';
    tempFolderFiles = [];
    isProcessingFolder = false;
}

modalClose.addEventListener('click', closeFolderSelectionPopup);
modalCancel.addEventListener('click', closeFolderSelectionPopup);

// Click fuori dal modal per chiudere
folderSelectionOverlay.addEventListener('click', (e) => {
    if (e.target === folderSelectionOverlay) {
        closeFolderSelectionPopup();
    }
});

// ESC per chiudere
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && folderSelectionOverlay.style.display === 'flex') {
        closeFolderSelectionPopup();
    }
});

// Click sul pulsante sfoglia
browseButton.addEventListener('click', () => {
    // Chiedi se vuole selezionare file o cartella
    if (confirm('Vuoi selezionare una cartella?\n\nOK = Cartella\nAnnulla = File singoli')) {
        folderInput.click();
    } else {
        fileInput.click();
    }
});

// Conferma selezione dal popup
modalConfirm.addEventListener('click', () => {
    const checkboxes = modalFileList.querySelectorAll('.file-checkbox');
    
    checkboxes.forEach((checkbox, index) => {
        if (checkbox.checked && tempFolderFiles[index]) {
            const fileInfo = tempFolderFiles[index];
            addFile(fileInfo.file, fileInfo.path);
        }
    });
    
    closeFolderSelectionPopup();
});

// Click sull'area di upload
uploadArea.addEventListener('click', (e) => {
    if (e.target === browseButton) return;
    browseButton.click();
});

// Gestione selezione file
fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

// Processa i file selezionati
function handleFiles(files) {
    Array.from(files).forEach(file => {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            addFile(file);
        }
    });
}

// Gestione selezione cartella
folderInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    const pdfFiles = files.filter(file => 
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );
    
    if (pdfFiles.length > 0) {
        // Prepara array per popup
        tempFolderFiles = pdfFiles.map(file => ({
            file: file,
            path: '',
            folderName: 'Cartella Selezionata'
        }));
        
        // Mostra popup selezione
        showFolderSelectionPopup(tempFolderFiles);
    } else {
        alert('Nessun file PDF trovato nella cartella selezionata.');
    }
    
    // Reset input
    folderInput.value = '';
});

// Aggiungi file alla lista
function addFile(file, path = '') {
    const fileId = (path ? path + '/' : '') + file.name;
    
    // Limita a 5 file per volta
    if (selectedFiles.size >= 5) {
        alert('Puoi caricare massimo 5 file alla volta.');
        return;
    }
    
    // Limita dimensione file a 10MB
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        alert(`Il file "${file.name}" è troppo grande. Dimensione massima: 10MB`);
        return;
    }
    
    if (!selectedFiles.has(fileId)) {
        selectedFiles.set(fileId, {
            file: file,
            path: path,
            id: fileId
        });
        
        updateFilesList();
        showFilesPreview();
    }
}

// Aggiorna visualizzazione lista file
function updateFilesList() {
    filesList.innerHTML = '';
    
    selectedFiles.forEach((fileInfo, fileId) => {
        const fileItem = createFileItem(fileInfo);
        filesList.appendChild(fileItem);
    });
    
    // Calcola dimensione totale
    let totalSize = 0;
    selectedFiles.forEach(fileInfo => {
        totalSize += fileInfo.file.size;
    });
    
    // Aggiorna testo del pulsante con dimensione totale
    const fileCount = selectedFiles.size;
    const btnText = uploadBtn.querySelector('.upload-btn-text');
    if (fileCount > 0) {
        btnText.textContent = `Elabora ${fileCount} ${fileCount === 1 ? 'Documento' : 'Documenti'} (${formatFileSize(totalSize)})`;
    } else {
        btnText.textContent = 'Elabora Documenti';
    }
}

// Crea elemento file
function createFileItem(fileInfo) {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.dataset.fileId = fileInfo.id;
    
    const fileSize = formatFileSize(fileInfo.file.size);
    const fileName = fileInfo.path ? `${fileInfo.path}/${fileInfo.file.name}` : fileInfo.file.name;
    
    div.innerHTML = `
        <svg class="file-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
        </svg>
        <div class="file-info">
            <div class="file-name">${fileName}</div>
            <div class="file-size">${fileSize}</div>
        </div>
        <button class="file-remove" onclick="removeFile('${fileInfo.id}')" title="Rimuovi file">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
            </svg>
        </button>
    `;
    
    return div;
}

// Formatta dimensione file
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Rimuovi file dalla lista
function removeFile(fileId) {
    selectedFiles.delete(fileId);
    updateFilesList();
    
    if (selectedFiles.size === 0) {
        hideFilesPreview();
    }
}

// Mostra preview file
function showFilesPreview() {
    filesPreview.style.display = 'block';
}

// Nascondi preview file
function hideFilesPreview() {
    filesPreview.style.display = 'none';
}

// Pulisci tutti i file
clearFilesBtn.addEventListener('click', () => {
    selectedFiles.clear();
    updateFilesList();
    hideFilesPreview();
    fileInput.value = '';
    folderInput.value = '';
});

// Gestione pulsante upload
uploadBtn.addEventListener('click', async () => {
    if (selectedFiles.size === 0) return;
    
    // Disabilita pulsante e mostra loader
    uploadBtn.disabled = true;
    uploadBtn.querySelector('.upload-btn-text').style.display = 'none';
    uploadBtn.querySelector('.upload-btn-loader').style.display = 'inline-flex';
    
    // Converti Map in array per iterazione
    const filesArray = Array.from(selectedFiles.values());
    let successCount = 0;
    let failCount = 0;
    
    // Aggiungi messaggio iniziale
    addMessage('assistant', `📤 **Avvio elaborazione di ${filesArray.length} documento${filesArray.length > 1 ? 'i' : ''} PDF...**\n\nQuesto processo potrebbe richiedere alcuni minuti.`);
    
    // Processa ogni file
    for (let i = 0; i < filesArray.length; i++) {
        const fileInfo = filesArray[i];
        const file = fileInfo.file;
        
        // Mostra stato per questo file
        const statusMsg = addStatusMessage(`📄 Elaborazione ${i + 1}/${filesArray.length}: ${file.name}`);
        
        try {
            // Crea FormData per l'upload
            const formData = new FormData();
            formData.append('file', file);
            
            // Invia file al backend
            const response = await fetch(`${API_URL}/upload-pdf`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Errore sconosciuto' }));
                throw new Error(errorData.detail || `Errore HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            // Rimuovi messaggio di stato
            statusMsg.remove();
            
            // Mostra risultato
            if (result.status === 'success') {
                successCount++;
                addMessage('assistant', 
                    `✅ **${file.name}** elaborato con successo!\n\n` +
                    `• Tempo totale: ${result.processing_time.toFixed(1)}s\n` +
                    `• Chunks creati: ${result.chunks_created}\n` +
                    `• Chunks salvati: ${result.chunks_stored}`
                );
            } else {
                failCount++;
                addMessage('assistant', 
                    `❌ **${file.name}** - Elaborazione fallita\n\n` +
                    `Errore: ${result.message || 'Errore sconosciuto'}`
                );
            }
            
        } catch (error) {
            // Rimuovi messaggio di stato se ancora presente
            if (statusMsg.parentNode) {
                statusMsg.remove();
            }
            
            failCount++;
            console.error('Errore upload:', error);
            
            addMessage('assistant', 
                `❌ **${file.name}** - Errore durante l'upload\n\n` +
                `${error.message}`
            );
        }
        
        // Piccola pausa tra file se ce ne sono altri
        if (i < filesArray.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // Messaggio finale di riepilogo
    const totalFiles = filesArray.length;
    if (successCount === totalFiles) {
        addMessage('assistant', 
            `🎉 **Elaborazione completata!**\n\n` +
            `Tutti i ${totalFiles} documenti sono stati elaborati con successo e aggiunti al database.\n\n` +
            `Ora puoi farmi domande sui contenuti dei documenti caricati!`
        );
    } else if (successCount > 0) {
        addMessage('assistant', 
            `⚠️ **Elaborazione parzialmente completata**\n\n` +
            `• Successo: ${successCount}/${totalFiles}\n` +
            `• Falliti: ${failCount}/${totalFiles}\n\n` +
            `Puoi comunque farmi domande sui documenti elaborati con successo.`
        );
    } else {
        addMessage('assistant', 
            `❌ **Elaborazione fallita**\n\n` +
            `Nessun documento è stato elaborato con successo.\n` +
            `Per favore controlla i messaggi di errore e riprova.`
        );
    }
    
    // Reset UI
    uploadBtn.disabled = false;
    uploadBtn.querySelector('.upload-btn-text').style.display = 'inline';
    uploadBtn.querySelector('.upload-btn-loader').style.display = 'none';
    
    // Se almeno un file è stato elaborato, nascondi area upload
    if (successCount > 0) {
        uploadSection.classList.add('collapsed');
    }
    
    // Pulisci file selezionati
    selectedFiles.clear();
    updateFilesList();
    hideFilesPreview();
    fileInput.value = '';
    folderInput.value = '';
});

// Toggle area upload
toggleUploadBtn.addEventListener('click', () => {
    uploadSection.classList.toggle('collapsed');
});

uploadToggleButton.addEventListener('click', () => {
    uploadSection.classList.toggle('collapsed');
});

// ===== FUNZIONI CHAT ORIGINALI =====

// Aggiungi messaggio alla chat
function addMessage(role, content, processInfo = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (role === 'user') {
        contentDiv.textContent = content;
    } else {
        if (typeof marked !== 'undefined') {
            try {
                contentDiv.innerHTML = marked.parse(content);
            } catch (e) {
                console.error('Errore nel parsing del markdown:', e);
                contentDiv.innerHTML = content.replace(/\n/g, '<br>');
            }
        } else {
            contentDiv.innerHTML = content.replace(/\n/g, '<br>');
        }
    }
    
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);

    if (processInfo) {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'process-info';
        infoDiv.textContent = processInfo;
        contentDiv.appendChild(infoDiv);
    }

    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Aggiungi messaggio di stato temporaneo
function addStatusMessage(content) {
    const statusDiv = document.createElement('div');
    statusDiv.className = 'status-message';
    statusDiv.innerHTML = content + '<span class="loading-dots"></span>';
    chatContainer.appendChild(statusDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return statusDiv;
}

// Funzione principale per inviare messaggi
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    messageInput.value = '';
    messageInput.disabled = true;
    sendButton.disabled = true;

    addMessage('user', message);

    const status1 = addStatusMessage('🔍 Sto cercando informazioni rilevanti nel database');

    try {
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                session_id: sessionId,
                use_history: true
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Errore risposta:', response.status, errorText);
            throw new Error(`Errore del server (${response.status})`);
        }

        const data = await response.json();

        status1.remove();

        const chunksCount = data.sources ? data.sources.length : 0;
        const totalChunks = data.total_chunks || chunksCount;
        const status2 = addStatusMessage(`📚 Ho trovato ${totalChunks} documenti rilevanti. Sto analizzando`);

        await new Promise(resolve => setTimeout(resolve, 1200));

        status2.innerHTML = `💭 Sto generando la risposta basata sui documenti trovati<span class="loading-dots"></span>`;
        await new Promise(resolve => setTimeout(resolve, 800));

        status2.remove();

        const processInfo = `Ho utilizzato ${totalChunks} chunks dal database per questa risposta.`;
        addMessage('assistant', data.message, processInfo);

    } catch (error) {
        console.error('Errore:', error);
        
        document.querySelectorAll('.status-message').forEach(el => el.remove());
        
        let errorMessage = '❌ **Si è verificato un errore.**\n\n';
        
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage += 'Non riesco a connettermi al server. Verifica che:\n';
            errorMessage += '• Il backend Python sia in esecuzione\n';
            errorMessage += '• L\'URL del backend sia corretto (attuale: `' + API_URL + '`)\n';
            errorMessage += '• Non ci siano problemi di rete o firewall';
        } else if (error.message.includes('404')) {
            errorMessage += 'Endpoint non trovato. Verifica che il backend sia configurato correttamente.';
        } else if (error.message.includes('500')) {
            errorMessage += 'Errore interno del server. Controlla i log del backend Python.';
        } else {
            errorMessage += error.message;
        }
        
        addMessage('assistant', errorMessage);
    } finally {
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    }
}

// Pulisci chat e inizia nuova conversazione
function clearChat() {
    chatContainer.innerHTML = '';
    sessionId = generateSessionId();
    localStorage.setItem('chatSessionId', sessionId);
    addMessage('assistant', '✨ **Nuova conversazione iniziata.** Come posso aiutarti?');
}

// Event listeners
sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Messaggio di benvenuto all'avvio
window.addEventListener('load', () => {
    if (typeof marked === 'undefined') {
        console.warn('⚠️ marked.js non è caricato. Il rendering del markdown non sarà disponibile.');
    }
    
    addMessage('assistant', 
        '# Ciao! 👋\n\n' +
        'Sono il chatbot per informazioni su **scuole di lingua**.\n\n' +
        'Posso aiutarti con:\n' +
        '• **Prezzi dei corsi**\n' +
        '• **Opzioni di alloggio**\n' +
        '• **Date e disponibilità**\n' +
        '• **Transfer aeroportuali**\n\n' +
        '💡 **Novità**: Puoi caricare documenti PDF usando l\'area in alto! I documenti verranno elaborati e aggiunti al database per arricchire le mie risposte.\n\n' +
        '*Cosa vorresti sapere?*'
    );
    
    if (API_URL === 'http://localhost:8000') {
        console.warn('⚠️ Stai usando localhost. Ricorda di cambiare API_URL per la produzione!');
    }
});

// Gestione focus automatico
document.addEventListener('DOMContentLoaded', () => {
    messageInput.focus();
});