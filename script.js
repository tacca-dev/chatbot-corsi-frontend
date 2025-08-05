// ===== CONFIGURAZIONE IMPORTANTE =====
// CAMBIA QUESTO CON L'URL DEL TUO BACKEND PYTHON!
const API_URL = 'https://chatbot-corsi-1.onrender.com';
// Per sviluppo locale usa: const API_URL = 'http://localhost:8000';

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

// Elementi Artifact
const artifactContent = document.getElementById('artifactContent');
const copyArtifactBtn = document.getElementById('copyArtifactBtn');
const clearArtifactBtn = document.getElementById('clearArtifactBtn');
const closeArtifactBtn = document.getElementById('closeArtifactBtn');
const toggleArtifactBtn = document.getElementById('toggleArtifactBtn');
const artifactSection = document.getElementById('artifactSection');
const chatSection = document.getElementById('chatSection');

// Snackbar
const snackbar = document.getElementById('snackbar');

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

let activeJobs = new Map();

// NUOVO: Variabile per il preventivo dal backend
let currentQuote = null;

// ===== FUNZIONI MATERIAL DESIGN =====

// Crea effetto ripple
function createRipple(event) {
    const button = event.currentTarget;
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple');
    
    button.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
}

document.addEventListener('DOMContentLoaded', () => {
    // Controlla se Material Icons è caricato
    const testIcon = document.createElement('span');
    testIcon.className = 'material-icons';
    testIcon.textContent = 'check';
    document.body.appendChild(testIcon);
    
    const isLoaded = window.getComputedStyle(testIcon).fontFamily.includes('Material Icons');
    document.body.removeChild(testIcon);
    
    if (!isLoaded) {
        // Sostituisci con emoji/simboli
        const iconMap = {
            'view_sidebar': '☰',
            'send': '➤',
            'upload_file': '📤',
            'cleaning_services': '🧹',
            'article': '📄',
            'content_copy': '📋',
            'delete_outline': '🗑️',
            'close': '✕',
            'done_all': '✓✓',
            'remove_done': '✗',
            'description': '📄',
            'folder_open': '📁',
            'auto_stories': '📚'
        };
        
        document.querySelectorAll('.material-icons').forEach(icon => {
            const text = icon.textContent.trim();
            if (iconMap[text]) {
                icon.textContent = iconMap[text];
                icon.style.fontFamily = 'Arial, sans-serif';
            }
        });
    }
});

// Mostra snackbar
function showSnackbar(message, duration = 3000) {
    snackbar.textContent = message;
    snackbar.classList.add('show');
    
    setTimeout(() => {
        snackbar.classList.remove('show');
    }, duration);
}

// ===== RESIZE FUNCTIONALITY =====

// Toggle artifact panel
toggleArtifactBtn.addEventListener('click', () => {
    artifactSection.classList.toggle('hidden');
    chatSection.classList.toggle('fullwidth');
    
    const message = artifactSection.classList.contains('hidden') ? 
        'Pannello preventivo nascosto' : 'Pannello preventivo visibile';
    showSnackbar(message);
});

// Close artifact panel
closeArtifactBtn.addEventListener('click', () => {
    artifactSection.classList.add('hidden');
    chatSection.classList.add('fullwidth');
    showSnackbar('Pannello preventivo chiuso');
});

// ===== NUOVE FUNZIONI PREVENTIVO =====

// Aggiorna il preventivo con i dati dal backend
function updateQuoteFromBackend(quoteInfo) {
    if (!quoteInfo) {
        currentQuote = null;
        renderEmptyQuote();
        return;
    }
    
    currentQuote = quoteInfo;
    renderQuoteFromBackend();
    
    console.log('💰 Preventivo aggiornato:', {
        fase: quoteInfo.fase,
        costo: quoteInfo.costo_totale,
        dettagli: Object.keys(quoteInfo.dettagli).length
    });
}

// Renderizza il preventivo basandosi sui dati del backend
function renderQuoteFromBackend() {
    if (!currentQuote) {
        renderEmptyQuote();
        return;
    }
    
    const quote = currentQuote;
    const dettagli = quote.dettagli || {};
    
    // Mappa delle fasi in italiano
    const phaseNames = {
        'esplorazione': 'Raccolta Informazioni',
        'selezione': 'Selezione Corso',
        'personalizzazione': 'Personalizzazione',
        'completato': 'Preventivo Completo'
    };
    
    const quoteHTML = `
        <div class="preventive-container">
            <div class="preventive-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"></path>
                </svg>
                <div>
                    <h2>Preventivo Personalizzato</h2>
                    <p class="quote-phase">Fase: ${phaseNames[quote.fase] || quote.fase}</p>
                </div>
            </div>
            
            <div class="preventive-content">
                ${renderQuoteDetails(dettagli)}
                
                ${quote.costo_totale > 0 ? `
                    <div class="preventive-total">
                        <h3>Totale Stimato</h3>
                        <p class="price">${formatPrice(quote.costo_totale, quote.valuta)}</p>
                        <p class="price-note">*Preventivo indicativo</p>
                    </div>
                ` : ''}
                
                ${quote.prossimi_passi && quote.prossimi_passi.length > 0 ? `
                    <div class="preventive-next-steps">
                        <h3>Prossimi Passi</h3>
                        <ul>
                            ${quote.prossimi_passi.map(step => `<li>${step}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <div class="quote-meta">
                    <small>Aggiornato: ${formatDateTime(quote.aggiornato)}</small>
                </div>
            </div>
        </div>
    `;
    
    artifactContent.innerHTML = quoteHTML;
}

// Renderizza i dettagli del preventivo
function renderQuoteDetails(dettagli) {
    let sectionsHTML = '';
    
    // Sezione corso
    if (dettagli.tipo_corso || dettagli.durata_settimane || dettagli.destinazione) {
        sectionsHTML += `
            <div class="preventive-section">
                <h3>Dettagli Corso</h3>
                ${dettagli.tipo_corso ? `<p><strong>Tipo:</strong> ${dettagli.tipo_corso}</p>` : ''}
                ${dettagli.durata_settimane ? `<p><strong>Durata:</strong> ${dettagli.durata_settimane} settimane</p>` : ''}
                ${dettagli.destinazione ? `<p><strong>Destinazione:</strong> ${dettagli.destinazione}</p>` : ''}
                ${dettagli.budget_max ? `<p><strong>Budget max:</strong> ${formatPrice(dettagli.budget_max, currentQuote.valuta)}</p>` : ''}
            </div>
        `;
    }
    
    // Sezione scuola confermata
    if (dettagli.scuola) {
        sectionsHTML += `
            <div class="preventive-section confirmed">
                <h3>Scuola Selezionata</h3>
                <p><strong>Scuola:</strong> ${dettagli.scuola}</p>
                ${dettagli.corso_specifico ? `<p><strong>Corso:</strong> ${dettagli.corso_specifico}</p>` : ''}
                ${dettagli.prezzo_base ? `<p><strong>Prezzo base:</strong> ${formatPrice(dettagli.prezzo_base, currentQuote.valuta)}</p>` : ''}
            </div>
        `;
    }
    
    // Sezione opzioni specifiche
    if (dettagli.opzioni && Object.keys(dettagli.opzioni).length > 0) {
        sectionsHTML += `
            <div class="preventive-section">
                <h3>Opzioni Aggiuntive</h3>
                ${renderQuoteOptions(dettagli.opzioni)}
            </div>
        `;
    }
    
    return sectionsHTML;
}

// Renderizza le opzioni del preventivo
function renderQuoteOptions(opzioni) {
    let optionsHTML = '<ul>';
    
    for (const [key, value] of Object.entries(opzioni)) {
        if (typeof value === 'object' && value !== null) {
            if (value.selezionato) {
                optionsHTML += `<li class="selected-option">✓ ${key}: ${formatPrice(value.prezzo, currentQuote.valuta)}</li>`;
            } else {
                optionsHTML += `<li class="available-option">○ ${key}: ${formatPrice(value.prezzo, currentQuote.valuta)}</li>`;
            }
        } else {
            optionsHTML += `<li>${key}: ${value}</li>`;
        }
    }
    
    optionsHTML += '</ul>';
    return optionsHTML;
}

// Renderizza preventivo vuoto
function renderEmptyQuote() {
    const emptyHTML = `
        <div class="preventive-container">
            <div class="preventive-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"></path>
                </svg>
                <h2>Preventivo Personalizzato</h2>
            </div>
            
            <div class="preventive-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48" style="opacity: 0.3;">
                    <path d="M9 11H6a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2v-7a2 2 0 00-2-2h-3M9 11V4a2 2 0 012-2h2a2 2 0 012 2v7M9 11h6"></path>
                </svg>
                <p>Il preventivo verrà compilato automaticamente mentre discutiamo delle tue esigenze per il corso di lingua</p>
                <div class="quote-tips">
                    <h4>💡 Suggerimenti:</h4>
                    <ul>
                        <li>Dimmi che tipo di corso ti interessa</li>
                        <li>Specifica per quanto tempo vuoi studiare</li>
                        <li>Indica la tua destinazione preferita</li>
                        <li>Fammi sapere il tuo budget orientativo</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    
    artifactContent.innerHTML = emptyHTML;
}

// Formatta il prezzo
function formatPrice(price, currency = 'GBP') {
    if (!price || price === 0) return 'N/A';
    
    const formatted = parseFloat(price).toFixed(2);
    if (currency === 'EUR') {
        return `€${formatted}`;
    }
    return `£${formatted}`;
}

// Formatta data e ora
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

// ===== FUNZIONI ARTIFACT AGGIORNATE =====

// Copia contenuto artifact
copyArtifactBtn.addEventListener('click', async () => {
    let textToCopy = '';
    
    if (currentQuote && (currentQuote.dettagli.scuola || currentQuote.dettagli.tipo_corso)) {
        // Copia il preventivo in formato testo
        textToCopy = 'PREVENTIVO CORSO DI LINGUA\n\n';
        
        const dettagli = currentQuote.dettagli;
        
        if (dettagli.scuola) textToCopy += `Scuola: ${dettagli.scuola}\n`;
        if (dettagli.tipo_corso) textToCopy += `Corso: ${dettagli.tipo_corso}\n`;
        if (dettagli.durata_settimane) textToCopy += `Durata: ${dettagli.durata_settimane} settimane\n`;
        if (dettagli.destinazione) textToCopy += `Destinazione: ${dettagli.destinazione}\n`;
        if (currentQuote.costo_totale > 0) textToCopy += `\nTotale stimato: ${formatPrice(currentQuote.costo_totale, currentQuote.valuta)}\n`;
        
        textToCopy += `\nFase: ${currentQuote.fase}\n`;
        textToCopy += `Aggiornato: ${formatDateTime(currentQuote.aggiornato)}\n`;
        
        if (currentQuote.prossimi_passi && currentQuote.prossimi_passi.length > 0) {
            textToCopy += '\nProssimi passi:\n';
            currentQuote.prossimi_passi.forEach(step => {
                textToCopy += `- ${step}\n`;
            });
        }
    } else {
        showSnackbar('Nessun preventivo da copiare');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(textToCopy);
        
        // Feedback con Font Awesome
        const icon = copyArtifactBtn.querySelector('i');
        const originalClass = icon.className;
        icon.className = 'fas fa-check';
        copyArtifactBtn.style.color = 'var(--success)';
        
        showSnackbar('Preventivo copiato negli appunti!');
        
        setTimeout(() => {
            icon.className = originalClass;
            copyArtifactBtn.style.color = '';
        }, 2000);
    } catch (err) {
        console.error('Errore nella copia:', err);
        showSnackbar('Impossibile copiare il contenuto');
    }
});

// Pulisci artifact
clearArtifactBtn.addEventListener('click', async () => {
    if (currentQuote && (currentQuote.dettagli.scuola || currentQuote.dettagli.tipo_corso || currentQuote.costo_totale > 0)) {
        if (confirm('Vuoi davvero cancellare il preventivo?')) {
            try {
                // Chiama API per cancellare preventivo
                const response = await fetch(`${API_URL}/quote/${sessionId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    currentQuote = null;
                    renderEmptyQuote();
                    showSnackbar('Preventivo cancellato');
                } else {
                    throw new Error('Errore nella cancellazione');
                }
            } catch (error) {
                console.error('Errore cancellazione preventivo:', error);
                showSnackbar('Errore nella cancellazione del preventivo');
            }
        }
    }
});

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

// Crea elemento di progresso per l'upload
function createProgressElement(jobId, filename) {
    const progressDiv = document.createElement('div');
    progressDiv.className = 'upload-progress';
    progressDiv.id = `progress-${jobId}`;
    progressDiv.innerHTML = `
        <div class="progress-header">
            <span class="progress-filename">📄 ${filename}</span>
            <button class="progress-cancel" onclick="cancelJob('${jobId}')" title="Annulla">×</button>
        </div>
        <div class="progress-status">Preparazione upload...</div>
        <div class="progress-bar-container">
            <div class="progress-bar" style="width: 0%"></div>
        </div>
        <div class="progress-details"></div>
    `;
    return progressDiv;
}

// Funzione per aggiornare il progresso
function updateProgress(jobId, jobInfo) {
    const progressEl = document.getElementById(`progress-${jobId}`);
    if (!progressEl) return;
    
    const statusEl = progressEl.querySelector('.progress-status');
    const barEl = progressEl.querySelector('.progress-bar');
    const detailsEl = progressEl.querySelector('.progress-details');
    
    // Aggiorna barra progresso
    barEl.style.width = `${jobInfo.progress || 0}%`;
    
    // Aggiorna stato
    switch (jobInfo.status) {
        case 'queued':
            statusEl.textContent = '⏳ In coda...';
            break;
        case 'processing':
            const stepText = {
                'pdf_to_json': '📖 Lettura PDF con OCR...',
                'chunking': '✂️ Divisione in chunks...',
                'vectorization': '🧮 Creazione embeddings...',
                'storing': '💾 Salvataggio nel database...'
            };
            statusEl.textContent = stepText[jobInfo.current_step] || '⚙️ Elaborazione...';
            break;
        case 'completed':
            statusEl.textContent = '✅ Completato!';
            progressEl.classList.add('completed');
            break;
        case 'failed':
            statusEl.textContent = '❌ Errore';
            progressEl.classList.add('failed');
            break;
    }
    
    // Aggiorna dettagli
    if (jobInfo.step_details) {
        detailsEl.textContent = jobInfo.step_details;
    } else if (jobInfo.total_pages) {
        detailsEl.textContent = `${jobInfo.total_pages} pagine`;
    }
}

// Funzione asincrona per upload con polling
async function uploadFilesAsync() {
    if (selectedFiles.size === 0) return;
    
    const filesArray = Array.from(selectedFiles.values());
    
    addMessage('assistant', 
        `📤 **Avvio elaborazione di ${filesArray.length} documento${filesArray.length > 1 ? 'i' : ''} PDF**\n\n` +
        `I file verranno elaborati in background. Puoi continuare a usare il chatbot mentre aspetti!`
    );
    
    // Container per i progressi
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    chatContainer.appendChild(progressContainer);
    
    // Avvia upload per ogni file
    for (const fileInfo of filesArray) {
        const file = fileInfo.file;
        
        try {
            // 1. Invia file al server
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch(`${API_URL}/upload-pdf-async`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Errore sconosciuto' }));
                throw new Error(errorData.detail || `Errore HTTP ${response.status}`);
            }
            
            const result = await response.json();
            const jobId = result.job.job_id;
            
            // 2. Crea elemento progresso
            const progressEl = createProgressElement(jobId, file.name);
            progressContainer.appendChild(progressEl);
            
            // 3. Inizia polling
            activeJobs.set(jobId, {
                filename: file.name,
                interval: setInterval(() => pollJobStatus(jobId), 2000)
            });
            
            // Prima chiamata immediata
            pollJobStatus(jobId);
            
        } catch (error) {
            console.error('Errore upload:', error);
            addMessage('assistant', 
                `❌ **${file.name}** - Errore durante l'upload\n\n${error.message}`
            );
        }
    }
    
    selectedFiles.clear();
}

// Funzione per il polling dello stato
async function pollJobStatus(jobId) {
    try {
        const response = await fetch(`${API_URL}/job/${jobId}`);
        
        if (!response.ok) {
            throw new Error(`Errore recupero stato: ${response.status}`);
        }
        
        const data = await response.json();
        const jobInfo = data.job;
        
        // Aggiorna UI
        updateProgress(jobId, jobInfo);
        
        // Se completato o fallito, ferma il polling
        if (jobInfo.status === 'completed' || jobInfo.status === 'failed') {
            const job = activeJobs.get(jobId);
            if (job) {
                clearInterval(job.interval);
                activeJobs.delete(jobId);
                
                // Mostra messaggio finale
                if (jobInfo.status === 'completed') {
                    const result = jobInfo.result;
                    addMessage('assistant', 
                        `✅ **${jobInfo.filename}** elaborato con successo!\n\n` +
                        `• Tempo totale: ${result.processing_time.toFixed(1)}s\n` +
                        `• Chunks creati: ${result.chunks_created}\n` +
                        `• Chunks salvati: ${result.chunks_stored}\n\n` +
                        `Il documento è ora disponibile nel database!`
                    );
                    
                    // Rimuovi progress dopo 5 secondi
                    setTimeout(() => {
                        const progressEl = document.getElementById(`progress-${jobId}`);
                        if (progressEl) {
                            progressEl.style.opacity = '0';
                            setTimeout(() => progressEl.remove(), 500);
                        }
                    }, 5000);
                    
                } else {
                    addMessage('assistant', 
                        `❌ **${jobInfo.filename}** - Elaborazione fallita\n\n` +
                        `Errore: ${jobInfo.error || 'Errore sconosciuto'}`
                    );
                }
            }
        }
        
    } catch (error) {
        console.error(`Errore polling job ${jobId}:`, error);
        
        // Dopo troppi errori, ferma il polling
        const job = activeJobs.get(jobId);
        if (job) {
            job.errorCount = (job.errorCount || 0) + 1;
            if (job.errorCount > 5) {
                clearInterval(job.interval);
                activeJobs.delete(jobId);
                
                addMessage('assistant', 
                    `⚠️ Impossibile verificare lo stato dell'elaborazione per ${job.filename}. ` +
                    `Il file potrebbe essere ancora in elaborazione sul server.`
                );
            }
        }
    }
}

// Funzione per cancellare un job
window.cancelJob = async function(jobId) {
    try {
        const response = await fetch(`${API_URL}/job/${jobId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Ferma polling
            const job = activeJobs.get(jobId);
            if (job) {
                clearInterval(job.interval);
                activeJobs.delete(jobId);
            }
            
            // Aggiorna UI
            const progressEl = document.getElementById(`progress-${jobId}`);
            if (progressEl) {
                progressEl.querySelector('.progress-status').textContent = '🚫 Annullato';
                progressEl.classList.add('cancelled');
            }
        }
    } catch (error) {
        console.error('Errore cancellazione job:', error);
    }
}

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
    await uploadFilesAsync();
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

// FUNZIONE PRINCIPALE AGGIORNATA
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
        
        // CHIAMATA API AGGIORNATA
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

        // NUOVO: Aggiorna preventivo se presente
        if (data.quote_info) {
            updateQuoteFromBackend(data.quote_info);
            
            // Se il preventivo è stato aggiornato, mostra una notifica discreta
            if (data.quote_updated) {
                showSnackbar('💰 Preventivo aggiornato!', 2000);
            }
        }

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
async function clearChat() {
    chatContainer.innerHTML = '';
    sessionId = generateSessionId();
    localStorage.setItem('chatSessionId', sessionId);
    
    // NUOVO: Reset anche del preventivo via API
    try {
        await fetch(`${API_URL}/quote/${sessionId}`, { method: 'DELETE' });
    } catch (error) {
        console.log('Nessun preventivo da cancellare');
    }
    
    currentQuote = null;
    renderEmptyQuote();
    
    addMessage('assistant', '✨ **Nuova conversazione iniziata.** Come posso aiutarti con i corsi di lingua?');
}

// Event listeners
sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// MESSAGGIO DI BENVENUTO AGGIORNATO
window.addEventListener('load', () => {
    if (typeof marked === 'undefined') {
        console.warn('⚠️ marked.js non è caricato. Il rendering del markdown non sarà disponibile.');
    }
    
    // Inizializza il preventivo vuoto
    renderEmptyQuote();
    
    addMessage('assistant', 
        '# Ciao! 👋\n\n' +
        'Sono il chatbot per informazioni su **scuole di lingua**.\n\n' +
        'Posso aiutarti con:\n' +
        '• **Prezzi dei corsi**\n' +
        '• **Opzioni di alloggio**\n' +
        '• **Date e disponibilità**\n' +
        '• **Transfer aeroportuali**\n\n' +
        '💡 **Mentre parliamo, compilerò automaticamente un preventivo personalizzato** che vedrai sulla destra!\n\n' +
        '*Dimmi: che tipo di corso ti interessa?*'
    );
    
    if (API_URL === 'http://localhost:8000') {
        console.warn('⚠️ Stai usando localhost. Ricorda di cambiare API_URL per la produzione!');
    }
});

// Gestione focus automatico
document.addEventListener('DOMContentLoaded', () => {
    messageInput.focus();
});

// Pulisci job attivi quando si lascia la pagina
window.addEventListener('beforeunload', () => {
    activeJobs.forEach((job, jobId) => {
        clearInterval(job.interval);
    });
});