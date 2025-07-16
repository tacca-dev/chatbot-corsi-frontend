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
const uploadButton = document.getElementById('uploadButton');

// Elementi file input
const fileInput = document.getElementById('fileInput');
const folderInput = document.getElementById('folderInput');

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

// Elementi Modal Scelta Upload
const uploadTypeOverlay = document.getElementById('uploadTypeOverlay');
const uploadTypeClose = document.getElementById('uploadTypeClose');
const selectSingleFile = document.getElementById('selectSingleFile');
const selectFolder = document.getElementById('selectFolder');

// Variabili per gestione file
let selectedFiles = new Map();
let tempFolderFiles = [];

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

// ===== GESTIONE UPLOAD =====

// Click sul pulsante upload
uploadButton.addEventListener('click', () => {
    showUploadTypeModal();
});

// Mostra modal scelta tipo upload
function showUploadTypeModal() {
    uploadTypeOverlay.style.display = 'flex';
}

function closeUploadTypeModal() {
    uploadTypeOverlay.style.display = 'none';
}

// Gestione scelte nel modal
selectSingleFile.addEventListener('click', () => {
    closeUploadTypeModal();
    fileInput.click();
});

selectFolder.addEventListener('click', () => {
    closeUploadTypeModal();
    folderInput.click();
});

// Chiusura modal tipo upload
uploadTypeClose.addEventListener('click', closeUploadTypeModal);

uploadTypeOverlay.addEventListener('click', (e) => {
    if (e.target === uploadTypeOverlay) {
        closeUploadTypeModal();
    }
});

// ESC per chiudere modali
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (uploadTypeOverlay.style.display === 'flex') {
            closeUploadTypeModal();
        }
        if (folderSelectionOverlay.style.display === 'flex') {
            closeFolderSelectionPopup();
        }
    }
});

// Gestione selezione file
fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = ''; // Reset input
});

// Gestione selezione cartella
folderInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    const pdfFiles = files.filter(file => 
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );
    
    if (pdfFiles.length > 0) {
        // Crea nuovi File objects puliti per evitare problemi con webkitRelativePath
        tempFolderFiles = pdfFiles.map(originalFile => {
            // Crea un nuovo File object con solo il nome base del file
            const fileName = originalFile.name.split('/').pop() || originalFile.name;
            const cleanFile = new File([originalFile], fileName, {
                type: originalFile.type || 'application/pdf',
                lastModified: originalFile.lastModified
            });
            
            return {
                file: cleanFile,
                path: '',
                folderName: 'Cartella Selezionata'
            };
        });
        
        showFolderSelectionPopup(tempFolderFiles);
    } else {
        alert('Nessun file PDF trovato nella cartella selezionata.');
    }
    
    folderInput.value = ''; // Reset input
});

// Processa i file selezionati
function handleFiles(files) {
    selectedFiles.clear();
    
    Array.from(files).forEach(file => {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            addFile(file);
        }
    });
    
    if (selectedFiles.size > 0) {
        uploadFiles();
    } else {
        alert('Nessun file PDF selezionato.');
    }
}

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
    }
}

// Mostra popup selezione file da cartella
function showFolderSelectionPopup(folderFiles) {
    const folderName = folderFiles[0].folderName || 'Cartella';
    
    folderNameElement.textContent = `Cartella: ${folderName}`;
    fileCountElement.textContent = `${folderFiles.length} file PDF trovati`;
    
    modalFileList.innerHTML = '';
    
    folderFiles.forEach((fileInfo, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-checkbox-item';
        fileItem.dataset.index = index;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'file-checkbox';
        checkbox.id = `file-check-${index}`;
        checkbox.checked = true;
        
        const label = document.createElement('label');
        label.className = 'file-label';
        label.htmlFor = `file-check-${index}`;
        label.innerHTML = `
            ${fileInfo.file.name}
            <span class="file-label-size">${formatFileSize(fileInfo.file.size)}</span>
        `;
        
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
        
        updateItemVisualState(fileItem, true);
    });
    
    updateSelectedCount();
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
}

modalClose.addEventListener('click', closeFolderSelectionPopup);
modalCancel.addEventListener('click', closeFolderSelectionPopup);

folderSelectionOverlay.addEventListener('click', (e) => {
    if (e.target === folderSelectionOverlay) {
        closeFolderSelectionPopup();
    }
});

// Conferma selezione dal popup cartella
modalConfirm.addEventListener('click', () => {
    const checkboxes = modalFileList.querySelectorAll('.file-checkbox');
    selectedFiles.clear();
    
    checkboxes.forEach((checkbox, index) => {
        if (checkbox.checked && tempFolderFiles[index]) {
            const fileInfo = tempFolderFiles[index];
            addFile(fileInfo.file, fileInfo.path);
        }
    });
    
    closeFolderSelectionPopup();
    
    if (selectedFiles.size > 0) {
        uploadFiles();
    }
});

// Formatta dimensione file
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Upload dei file
async function uploadFiles() {
    if (selectedFiles.size === 0) return;
    
    const filesArray = Array.from(selectedFiles.values());
    let successCount = 0;
    let failCount = 0;
    
    addMessage('assistant', `📤 **Avvio elaborazione di ${filesArray.length} documento${filesArray.length > 1 ? 'i' : ''} PDF...**\n\nQuesto processo potrebbe richiedere alcuni minuti.`);
    
    for (let i = 0; i < filesArray.length; i++) {
        const fileInfo = filesArray[i];
        const file = fileInfo.file;
        
        const statusMsg = addStatusMessage(`📄 Elaborazione ${i + 1}/${filesArray.length}: ${file.name}`);
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch(`${API_URL}/upload-pdf`, {
                method: 'POST',
                body: formData,
                // Aggiungi timeout più lungo o rimuovilo
                signal: AbortSignal.timeout(900000) // 15 minuti
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Errore sconosciuto' }));
                throw new Error(errorData.detail || `Errore HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            statusMsg.remove();
            
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
        
        if (i < filesArray.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
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
    
    selectedFiles.clear();
}

// ===== FUNZIONI CHAT =====

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
        '💡 **Puoi caricare documenti PDF** usando il pulsante verde accanto all\'area di input! I documenti verranno elaborati e aggiunti al database per arricchire le mie risposte.\n\n' +
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