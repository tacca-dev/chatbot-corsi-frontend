// ===== CONFIGURAZIONE =====
const API_URL = 'https://chatbot-corsi-1.onrender.com';
// Per sviluppo locale usa: const API_URL = 'http://localhost:8000';

// ===== INIZIALIZZAZIONE =====
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

// ===== ELEMENTI DOM =====
const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const timeElement = document.getElementById('time');
const uploadButton = document.getElementById('uploadButton');
const artifactContent = document.getElementById('artifactContent');
const copyArtifactBtn = document.getElementById('copyArtifactBtn');
const clearArtifactBtn = document.getElementById('clearArtifactBtn');
const closeArtifactBtn = document.getElementById('closeArtifactBtn');
const toggleArtifactBtn = document.getElementById('toggleArtifactBtn');
const artifactSection = document.getElementById('artifactSection');
const chatSection = document.getElementById('chatSection');
const snackbar = document.getElementById('snackbar');

// File upload elements
const fileInput = document.getElementById('fileInput');
const folderInput = document.getElementById('folderInput');
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
const uploadTypeOverlay = document.getElementById('uploadTypeOverlay');
const uploadTypeClose = document.getElementById('uploadTypeClose');
const selectSingleFile = document.getElementById('selectSingleFile');
const selectFolder = document.getElementById('selectFolder');

// ===== STATO APPLICAZIONE =====
let selectedFiles = new Map();
let tempFolderFiles = [];
let activeJobs = new Map();

let currentQuote = {
    session_id: null,
    fase: 'esplorazione',
    stato: 'in_compilazione',
    costo_totale: 0,
    valuta: 'GBP',
    aggiornato: null,
    dettagli: {},
    prossimi_passi: []
};

// ===== FUNZIONI UTILITY =====
function generateSessionId() {
    return 'session-' + Math.random().toString(36).substr(2, 9);
}

function showSnackbar(message, duration = 3000) {
    snackbar.textContent = message;
    snackbar.classList.add('show');
    setTimeout(() => snackbar.classList.remove('show'), duration);
}

function updateTime() {
    const now = new Date();
    timeElement.textContent = now.toLocaleTimeString('it-IT', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function formatPrice(price) {
    if (!price) return '';
    return `${currentQuote.valuta === 'EUR' ? '€' : '£'}${parseFloat(price).toLocaleString()}`;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ===== GESTIONE PANNELLO PREVENTIVO =====
toggleArtifactBtn.addEventListener('click', () => {
    artifactSection.classList.toggle('hidden');
    chatSection.classList.toggle('fullwidth');
    const message = artifactSection.classList.contains('hidden') ? 
        'Pannello preventivo nascosto' : 'Pannello preventivo visibile';
    showSnackbar(message);
});

closeArtifactBtn.addEventListener('click', () => {
    artifactSection.classList.add('hidden');
    chatSection.classList.add('fullwidth');
    showSnackbar('Pannello preventivo chiuso');
});

// ===== GESTIONE PREVENTIVO =====
function updateQuoteFromBackend(quoteInfo) {
    if (!quoteInfo) {
        renderEmptyQuote();
        return;
    }
    
    currentQuote = {
        session_id: quoteInfo.session_id || sessionId,
        fase: quoteInfo.fase || 'esplorazione',
        stato: quoteInfo.stato || 'in_compilazione',
        costo_totale: quoteInfo.costo_totale || 0,
        valuta: quoteInfo.valuta || 'GBP',
        aggiornato: quoteInfo.aggiornato,
        dettagli: { ...currentQuote.dettagli, ...quoteInfo.dettagli },
        prossimi_passi: quoteInfo.prossimi_passi || []
    };
    
    renderSimpleQuote();
}

function renderSimpleQuote() {
    if (!hasAnyInfo()) {
        renderEmptyQuote();
        return;
    }
    
    let html = '';
    
    // Informazioni base
    if (hasBaseInfo()) {
        html += '<div class="simple-section">';
        html += '<h3>📋 Ricerca</h3>';
        const d = currentQuote.dettagli;
        if (d.tipo_corso) html += `<div class="info-row">Corso: <strong>${d.tipo_corso}</strong></div>`;
        if (d.durata_settimane) html += `<div class="info-row">Durata: <strong>${d.durata_settimane} settimane</strong></div>`;
        if (d.destinazione) html += `<div class="info-row">Destinazione: <strong>${d.destinazione}</strong></div>`;
        if (d.budget_max) html += `<div class="info-row">Budget max: <strong>${formatPrice(d.budget_max)}</strong></div>`;
        html += '</div>';
    }
    
    // Scuola selezionata
    if (hasConfirmedSelection()) {
        html += '<div class="simple-section confirmed">';
        html += '<h3>✅ Scuola Selezionata</h3>';
        const d = currentQuote.dettagli;
        html += '<div class="school-card">';
        html += `<div class="school-name">${d.scuola}</div>`;
        if (d.corso_specifico) html += `<div class="course-name">${d.corso_specifico}</div>`;
        if (d.prezzo_base) {
            html += '<div class="base-price-display">';
            html += `<span class="price-value">${formatPrice(d.prezzo_base)}</span>`;
            html += '</div>';
        }
        html += '</div></div>';
    }
    
    // Costo totale
    if (currentQuote.costo_totale > 0) {
        html += '<div class="total-section">';
        html += '<h3>💰 Costo Totale</h3>';
        html += `<div class="total-display">${formatPrice(currentQuote.costo_totale)}</div>`;
        html += '</div>';
    }
    
    // Prossimi passi
    if (currentQuote.prossimi_passi?.length > 0) {
        html += '<div class="simple-section steps">';
        html += '<h3>📝 Prossimi Passi</h3>';
        currentQuote.prossimi_passi.forEach((step, i) => {
            html += `<div class="step-row">${i + 1}. ${step}</div>`;
        });
        html += '</div>';
    }
    
    artifactContent.innerHTML = html;
}

function renderEmptyQuote() {
    artifactContent.innerHTML = `
        <div class="quote-empty-simple">
            <div class="empty-content">
                <div class="empty-icon">💬</div>
                <p>Il preventivo apparirà qui mentre discutiamo delle tue esigenze.</p>
            </div>
        </div>
    `;
}

// Helper functions
function hasBaseInfo() {
    const d = currentQuote.dettagli;
    return d.tipo_corso || d.durata_settimane || d.budget_max || d.destinazione;
}

function hasConfirmedSelection() {
    const d = currentQuote.dettagli;
    return d.scuola && (d.corso_specifico || d.prezzo_base);
}

function hasAnyInfo() {
    return hasBaseInfo() || hasConfirmedSelection() || currentQuote.costo_totale > 0;
}

// ===== GESTIONE COPIA PREVENTIVO =====
copyArtifactBtn.addEventListener('click', async () => {
    if (!hasAnyInfo()) {
        showSnackbar('Nessun preventivo da copiare');
        return;
    }
    
    let text = '=== PREVENTIVO CORSO DI LINGUA ===\n\n';
    const d = currentQuote.dettagli;
    
    if (d.tipo_corso) text += `Corso: ${d.tipo_corso}\n`;
    if (d.durata_settimane) text += `Durata: ${d.durata_settimane} settimane\n`;
    if (d.scuola) text += `Scuola: ${d.scuola}\n`;
    if (currentQuote.costo_totale > 0) text += `\nTOTALE: ${formatPrice(currentQuote.costo_totale)}\n`;
    
    try {
        await navigator.clipboard.writeText(text);
        showSnackbar('Preventivo copiato!');
    } catch (err) {
        showSnackbar('Impossibile copiare');
    }
});

clearArtifactBtn.addEventListener('click', () => {
    if (confirm('Vuoi cancellare il preventivo?')) {
        currentQuote.dettagli = {};
        currentQuote.costo_totale = 0;
        currentQuote.prossimi_passi = [];
        renderSimpleQuote();
        showSnackbar('Preventivo cancellato');
    }
});

// ===== GESTIONE UPLOAD FILES =====
uploadButton.addEventListener('click', () => {
    uploadTypeOverlay.style.display = 'flex';
});

selectSingleFile.addEventListener('click', () => {
    uploadTypeOverlay.style.display = 'none';
    fileInput.click();
});

selectFolder.addEventListener('click', () => {
    uploadTypeOverlay.style.display = 'none';
    folderInput.click();
});

uploadTypeClose.addEventListener('click', () => {
    uploadTypeOverlay.style.display = 'none';
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = '';
});

folderInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    const pdfFiles = files.filter(file => 
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );
    
    if (pdfFiles.length > 0) {
        tempFolderFiles = pdfFiles.map(file => ({
            file: new File([file], file.name.split('/').pop() || file.name, {
                type: file.type || 'application/pdf',
                lastModified: file.lastModified
            }),
            path: '',
            folderName: 'Cartella Selezionata'
        }));
        showFolderSelectionPopup(tempFolderFiles);
    } else {
        alert('Nessun file PDF trovato nella cartella selezionata.');
    }
    folderInput.value = '';
});

function showFolderSelectionPopup(folderFiles) {
    folderNameElement.textContent = `Cartella: ${folderFiles[0].folderName}`;
    fileCountElement.textContent = `${folderFiles.length} file PDF trovati`;
    modalFileList.innerHTML = '';
    
    folderFiles.forEach((fileInfo, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-checkbox-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'file-checkbox';
        checkbox.id = `file-check-${index}`;
        checkbox.checked = true;
        
        const label = document.createElement('label');
        label.className = 'file-label';
        label.htmlFor = `file-check-${index}`;
        label.innerHTML = `${fileInfo.file.name}
            <span class="file-label-size">${formatFileSize(fileInfo.file.size)}</span>`;
        
        checkbox.addEventListener('change', updateSelectedCount);
        fileItem.appendChild(checkbox);
        fileItem.appendChild(label);
        modalFileList.appendChild(fileItem);
    });
    
    updateSelectedCount();
    folderSelectionOverlay.style.display = 'flex';
}

function updateSelectedCount() {
    const checkboxes = modalFileList.querySelectorAll('.file-checkbox');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    selectedCountElement.textContent = checkedCount;
    modalConfirm.disabled = checkedCount === 0;
}

selectAllBtn.addEventListener('click', () => {
    modalFileList.querySelectorAll('.file-checkbox').forEach(cb => cb.checked = true);
    updateSelectedCount();
});

deselectAllBtn.addEventListener('click', () => {
    modalFileList.querySelectorAll('.file-checkbox').forEach(cb => cb.checked = false);
    updateSelectedCount();
});

modalClose.addEventListener('click', () => {
    folderSelectionOverlay.style.display = 'none';
    tempFolderFiles = [];
});

modalCancel.addEventListener('click', () => {
    folderSelectionOverlay.style.display = 'none';
    tempFolderFiles = [];
});

modalConfirm.addEventListener('click', () => {
    const checkboxes = modalFileList.querySelectorAll('.file-checkbox');
    selectedFiles.clear();
    
    checkboxes.forEach((checkbox, index) => {
        if (checkbox.checked && tempFolderFiles[index]) {
            const fileInfo = tempFolderFiles[index];
            addFile(fileInfo.file);
        }
    });
    
    folderSelectionOverlay.style.display = 'none';
    if (selectedFiles.size > 0) uploadFiles();
});

function handleFiles(files) {
    selectedFiles.clear();
    Array.from(files).forEach(file => {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            addFile(file);
        }
    });
    if (selectedFiles.size > 0) uploadFiles();
}

function addFile(file) {
    const fileId = file.name;
    
    if (selectedFiles.size >= 5) {
        alert('Puoi caricare massimo 5 file alla volta.');
        return;
    }
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        alert(`Il file "${file.name}" è troppo grande. Dimensione massima: 10MB`);
        return;
    }
    
    if (!selectedFiles.has(fileId)) {
        selectedFiles.set(fileId, { file: file, id: fileId });
    }
}

async function uploadFiles() {
    if (selectedFiles.size === 0) return;
    
    const filesArray = Array.from(selectedFiles.values());
    addMessage('assistant', 
        `📤 **Avvio elaborazione di ${filesArray.length} documento${filesArray.length > 1 ? 'i' : ''} PDF**\n\n` +
        `I file verranno elaborati in background.`
    );
    
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    chatContainer.appendChild(progressContainer);
    
    for (const fileInfo of filesArray) {
        try {
            const formData = new FormData();
            formData.append('file', fileInfo.file);
            
            const response = await fetch(`${API_URL}/upload-pdf-async`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Errore HTTP ${response.status}`);
            }
            
            const result = await response.json();
            const jobId = result.job.job_id;
            
            const progressEl = createProgressElement(jobId, fileInfo.file.name);
            progressContainer.appendChild(progressEl);
            
            activeJobs.set(jobId, {
                filename: fileInfo.file.name,
                interval: setInterval(() => pollJobStatus(jobId), 2000)
            });
            
            pollJobStatus(jobId);
        } catch (error) {
            addMessage('assistant', `❌ **${fileInfo.file.name}** - Errore: ${error.message}`);
        }
    }
    
    selectedFiles.clear();
}

function createProgressElement(jobId, filename) {
    const progressDiv = document.createElement('div');
    progressDiv.className = 'upload-progress';
    progressDiv.id = `progress-${jobId}`;
    progressDiv.innerHTML = `
        <div class="progress-header">
            <span class="progress-filename">📄 ${filename}</span>
        </div>
        <div class="progress-status">Preparazione upload...</div>
        <div class="progress-bar-container">
            <div class="progress-bar" style="width: 0%"></div>
        </div>
    `;
    return progressDiv;
}

async function pollJobStatus(jobId) {
    try {
        const response = await fetch(`${API_URL}/job/${jobId}`);
        if (!response.ok) throw new Error(`Errore recupero stato`);
        
        const data = await response.json();
        const jobInfo = data.job;
        const progressEl = document.getElementById(`progress-${jobId}`);
        
        if (progressEl) {
            const statusEl = progressEl.querySelector('.progress-status');
            const barEl = progressEl.querySelector('.progress-bar');
            
            barEl.style.width = `${jobInfo.progress || 0}%`;
            
            if (jobInfo.status === 'completed') {
                statusEl.textContent = '✅ Completato!';
                progressEl.classList.add('completed');
                
                const job = activeJobs.get(jobId);
                if (job) {
                    clearInterval(job.interval);
                    activeJobs.delete(jobId);
                }
                
                setTimeout(() => {
                    progressEl.style.opacity = '0';
                    setTimeout(() => progressEl.remove(), 500);
                }, 5000);
            } else if (jobInfo.status === 'failed') {
                statusEl.textContent = '❌ Errore';
                progressEl.classList.add('failed');
                
                const job = activeJobs.get(jobId);
                if (job) {
                    clearInterval(job.interval);
                    activeJobs.delete(jobId);
                }
            } else {
                statusEl.textContent = '⚙️ Elaborazione...';
            }
        }
    } catch (error) {
        console.error(`Errore polling job ${jobId}:`, error);
    }
}

// ===== FUNZIONI CHAT =====
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
                contentDiv.innerHTML = content.replace(/\n/g, '<br>');
            }
        } else {
            contentDiv.innerHTML = content.replace(/\n/g, '<br>');
        }
    }
    
    messageDiv.appendChild(contentDiv);
    
    if (processInfo) {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'process-info';
        infoDiv.textContent = processInfo;
        contentDiv.appendChild(infoDiv);
    }
    
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addStatusMessage(content) {
    const statusDiv = document.createElement('div');
    statusDiv.className = 'status-message';
    statusDiv.innerHTML = content + '<span class="loading-dots"></span>';
    chatContainer.appendChild(statusDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return statusDiv;
}

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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                session_id: sessionId,
                use_history: true
            })
        });

        if (!response.ok) throw new Error(`Errore del server (${response.status})`);

        const data = await response.json();
        status1.remove();

        const totalChunks = data.total_chunks || 0;
        const status2 = addStatusMessage(`📚 Ho trovato ${totalChunks} documenti rilevanti`);
        await new Promise(resolve => setTimeout(resolve, 1200));
        status2.remove();

        const processInfo = `Ho utilizzato ${totalChunks} chunks dal database per questa risposta.`;
        addMessage('assistant', data.message, processInfo);

        if (data.quote_info) {
            updateQuoteFromBackend(data.quote_info);
            if (data.quote_updated) showSnackbar('💰 Preventivo aggiornato!', 2000);
        }

    } catch (error) {
        document.querySelectorAll('.status-message').forEach(el => el.remove());
        addMessage('assistant', `❌ **Errore:** ${error.message}`);
    } finally {
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    }
}

function clearChat() {
    chatContainer.innerHTML = '';
    sessionId = generateSessionId();
    localStorage.setItem('chatSessionId', sessionId);
    
    currentQuote = {
        session_id: sessionId,
        fase: 'esplorazione',
        stato: 'in_compilazione',
        costo_totale: 0,
        valuta: 'GBP',
        aggiornato: null,
        dettagli: {},
        prossimi_passi: []
    };
    
    renderSimpleQuote();
    addMessage('assistant', '✨ **Nuova conversazione iniziata.** Come posso aiutarti?');
    showSnackbar('Nuova sessione avviata');
}

// ===== EVENT LISTENERS =====
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (uploadTypeOverlay.style.display === 'flex') uploadTypeOverlay.style.display = 'none';
        if (folderSelectionOverlay.style.display === 'flex') folderSelectionOverlay.style.display = 'none';
    }
});

// ===== INIZIALIZZAZIONE =====
window.addEventListener('load', () => {
    currentQuote.session_id = sessionId;
    renderSimpleQuote();
    updateTime();
    setInterval(updateTime, 1000);
    
    addMessage('assistant', 
        '# Ciao!\n\n' +
        'Sono il tuo consulente personale per **corsi di lingua all\'estero**.\n\n' +
        '*Dimmi, cosa stai cercando?*'
    );
});

document.addEventListener('DOMContentLoaded', () => {
    messageInput.focus();
});

window.addEventListener('beforeunload', () => {
    activeJobs.forEach((job) => clearInterval(job.interval));
});