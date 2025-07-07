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
const browseButton = document.getElementById('browseButton');
const filesPreview = document.getElementById('filesPreview');
const filesList = document.getElementById('filesList');
const clearFilesBtn = document.getElementById('clearFilesBtn');
const uploadBtn = document.getElementById('uploadBtn');
const toggleUploadBtn = document.getElementById('toggleUploadBtn');
const uploadToggleButton = document.getElementById('uploadToggleButton');

// Variabili per gestione file
let selectedFiles = new Map(); // Map per evitare duplicati

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
    const files = dt.files;
    handleFiles(files);
}

// Click sul pulsante sfoglia
browseButton.addEventListener('click', () => {
    fileInput.click();
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

// Aggiungi file alla lista
function addFile(file) {
    const fileId = file.name;
    
    if (!selectedFiles.has(fileId)) {
        selectedFiles.set(fileId, {
            file: file,
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
    
    // Aggiorna testo del pulsante
    const fileCount = selectedFiles.size;
    const btnText = uploadBtn.querySelector('.upload-btn-text');
    btnText.textContent = `Elabora ${fileCount} ${fileCount === 1 ? 'Documento' : 'Documenti'}`;
}

// Crea elemento file
function createFileItem(fileInfo) {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.dataset.fileId = fileInfo.id;
    
    const fileSize = formatFileSize(fileInfo.file.size);
    const fileName = fileInfo.file.name;
    
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
});

// Gestione pulsante upload
uploadBtn.addEventListener('click', async () => {
    if (selectedFiles.size === 0) return;
    
    // Disabilita pulsante e mostra loader
    uploadBtn.disabled = true;
    uploadBtn.querySelector('.upload-btn-text').style.display = 'none';
    uploadBtn.querySelector('.upload-btn-loader').style.display = 'inline-flex';
    
    // Simula elaborazione (per ora solo estetico)
    addMessage('assistant', `📤 **Preparazione per l'elaborazione di ${selectedFiles.size} documenti PDF...**\n\nQuesta funzionalità sarà presto disponibile!`);
    
    // Dopo 3 secondi, resetta
    setTimeout(() => {
        uploadBtn.disabled = false;
        uploadBtn.querySelector('.upload-btn-text').style.display = 'inline';
        uploadBtn.querySelector('.upload-btn-loader').style.display = 'none';
        
        // Nascondi area upload
        uploadSection.classList.add('collapsed');
        
        // Pulisci file
        selectedFiles.clear();
        updateFilesList();
        hideFilesPreview();
    }, 3000);
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
        '💡 **Novità**: Puoi caricare documenti PDF usando l\'area in alto!\n\n' +
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