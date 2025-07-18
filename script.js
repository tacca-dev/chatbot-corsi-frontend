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

// Storage per le risposte dell'artifact
let artifactResponses = [];

// Struttura per il preventivo
let preventiveData = {
    school: null,
    course: null,
    duration: null,
    startDate: null,
    accommodation: null,
    extras: [],
    totalPrice: 0,
    currency: 'GBP',
    reasoning: []
};

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
        'Pannello artifact nascosto' : 'Pannello artifact visibile';
    showSnackbar(message);
});

// Close artifact panel
closeArtifactBtn.addEventListener('click', () => {
    artifactSection.classList.add('hidden');
    chatSection.classList.add('fullwidth');
    showSnackbar('Pannello artifact chiuso');
});

// ===== FUNZIONI PREVENTIVO =====

// Estrai informazioni dal messaggio del chatbot
function extractCourseInfo(message) {
    const info = {
        prices: [],
        durations: [],
        courses: [],
        accommodations: [],
        schools: [],
        dates: []
    };
    
    // Pattern per prezzi (£, GBP, euro, €)
    const pricePatterns = [
        /£(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
        /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:GBP|pounds?|sterline)/gi,
        /€(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
        /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:EUR|euro)/gi
    ];
    
    pricePatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(message)) !== null) {
            const price = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(price)) {
                info.prices.push(price);
            }
        }
    });
    
    // Pattern per durate
    const durationPattern = /(\d+)\s*(?:week|settiman|sett\.)/gi;
    let match;
    while ((match = durationPattern.exec(message)) !== null) {
        info.durations.push(parseInt(match[1]));
    }
    
    // Pattern per corsi comuni
    const coursePatterns = [
        /IELTS/gi,
        /General English/gi,
        /Business English/gi,
        /Cambridge/gi,
        /Intensive/gi,
        /Standard/gi
    ];
    
    coursePatterns.forEach(pattern => {
        if (pattern.test(message)) {
            info.courses.push(pattern.source.replace(/\\/g, ''));
        }
    });
    
    // Pattern per alloggi
    const accommodationPatterns = [
        /homestay/gi,
        /residence/gi,
        /shared flat/gi,
        /student house/gi,
        /host family/gi
    ];
    
    accommodationPatterns.forEach(pattern => {
        if (pattern.test(message)) {
            info.accommodations.push(pattern.source.replace(/\\/g, ''));
        }
    });
    
    // Pattern per scuole
    const schoolPatterns = [
        /BELS/g,
        /CIAL/g,
        /KSOE/g,
        /Kings/g,
        /ELC/g
    ];
    
    schoolPatterns.forEach(pattern => {
        if (pattern.test(message)) {
            info.schools.push(pattern.source);
        }
    });
    
    return info;
}

// Aggiorna il preventivo basandosi sulle informazioni estratte
function updatePreventive(message, isUserMessage = false) {
    if (isUserMessage) {
        // Analizza richieste dell'utente
        if (/budget|economico|cheap|risparmio/i.test(message)) {
            preventiveData.reasoning.push("L'utente ha espresso interesse per opzioni economiche");
        }
        if (/intensiv|rapido|veloce/i.test(message)) {
            preventiveData.reasoning.push("L'utente preferisce un corso intensivo");
        }
        return;
    }
    
    // Estrai informazioni dalla risposta del bot
    const info = extractCourseInfo(message);
    
    // Aggiorna scuola
    if (info.schools.length > 0 && !preventiveData.school) {
        preventiveData.school = info.schools[0];
        preventiveData.reasoning.push(`Scuola selezionata: ${info.schools[0]}`);
    }
    
    // Aggiorna corso
    if (info.courses.length > 0 && !preventiveData.course) {
        preventiveData.course = info.courses[0];
        preventiveData.reasoning.push(`Tipo di corso: ${info.courses[0]}`);
    }
    
    // Aggiorna durata
    if (info.durations.length > 0 && !preventiveData.duration) {
        preventiveData.duration = Math.max(...info.durations);
        preventiveData.reasoning.push(`Durata corso: ${preventiveData.duration} settimane`);
    }
    
    // Aggiorna alloggio
    if (info.accommodations.length > 0 && !preventiveData.accommodation) {
        preventiveData.accommodation = info.accommodations[0];
        preventiveData.reasoning.push(`Alloggio: ${info.accommodations[0]}`);
    }
    
    // Aggiorna prezzo (prendi il più alto trovato come stima)
    if (info.prices.length > 0) {
        const maxPrice = Math.max(...info.prices);
        if (maxPrice > preventiveData.totalPrice) {
            preventiveData.totalPrice = maxPrice;
            preventiveData.reasoning.push(`Prezzo aggiornato: ${formatPrice(maxPrice)}`);
        }
    }
    
    // Renderizza il preventivo aggiornato
    renderPreventive();
}

// Formatta il prezzo
function formatPrice(price) {
    if (preventiveData.currency === 'EUR') {
        return `€${price.toFixed(2)}`;
    }
    return `£${price.toFixed(2)}`;
}

// Renderizza il preventivo nell'artifact
function renderPreventive() {
    const preventiveHTML = `
        <div class="preventive-container">
            <div class="preventive-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"></path>
                </svg>
                <h2>Preventivo Personalizzato</h2>
            </div>
            
            <div class="preventive-content">
                ${preventiveData.school || preventiveData.course ? `
                    <div class="preventive-section">
                        <h3>Dettagli Corso</h3>
                        ${preventiveData.school ? `<p><strong>Scuola:</strong> ${preventiveData.school}</p>` : ''}
                        ${preventiveData.course ? `<p><strong>Corso:</strong> ${preventiveData.course}</p>` : ''}
                        ${preventiveData.duration ? `<p><strong>Durata:</strong> ${preventiveData.duration} settimane</p>` : ''}
                        ${preventiveData.startDate ? `<p><strong>Data inizio:</strong> ${preventiveData.startDate}</p>` : ''}
                    </div>
                ` : ''}
                
                ${preventiveData.accommodation ? `
                    <div class="preventive-section">
                        <h3>Alloggio</h3>
                        <p><strong>Tipo:</strong> ${preventiveData.accommodation}</p>
                    </div>
                ` : ''}
                
                ${preventiveData.extras.length > 0 ? `
                    <div class="preventive-section">
                        <h3>Servizi Extra</h3>
                        <ul>
                            ${preventiveData.extras.map(extra => `<li>${extra}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${preventiveData.totalPrice > 0 ? `
                    <div class="preventive-total">
                        <h3>Totale Stimato</h3>
                        <p class="price">${formatPrice(preventiveData.totalPrice)}</p>
                    </div>
                ` : ''}
                
                ${preventiveData.reasoning.length > 0 ? `
                    <div class="preventive-reasoning">
                        <h3>Note e Ragionamento</h3>
                        <ul>
                            ${preventiveData.reasoning.slice(-5).map(reason => `<li>${reason}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
            
            ${!preventiveData.school && !preventiveData.course ? `
                <div class="preventive-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48" style="opacity: 0.3;">
                        <path d="M9 11H6a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2v-7a2 2 0 00-2-2h-3M9 11V4a2 2 0 012-2h2a2 2 0 012 2v7M9 11h6"></path>
                    </svg>
                    <p>Il preventivo verrà compilato man mano che discutiamo delle tue esigenze</p>
                </div>
            ` : ''}
        </div>
    `;
    
    artifactContent.innerHTML = preventiveHTML;
}

// ===== FUNZIONI ARTIFACT (MODIFICATE) =====

// Copia contenuto artifact
copyArtifactBtn.addEventListener('click', async () => {
    let textToCopy = '';
    
    if (preventiveData.school || preventiveData.course) {
        // Copia il preventivo in formato testo
        textToCopy = 'PREVENTIVO CORSO DI LINGUA\n\n';
        
        if (preventiveData.school) textToCopy += `Scuola: ${preventiveData.school}\n`;
        if (preventiveData.course) textToCopy += `Corso: ${preventiveData.course}\n`;
        if (preventiveData.duration) textToCopy += `Durata: ${preventiveData.duration} settimane\n`;
        if (preventiveData.accommodation) textToCopy += `Alloggio: ${preventiveData.accommodation}\n`;
        if (preventiveData.totalPrice > 0) textToCopy += `\nTotale stimato: ${formatPrice(preventiveData.totalPrice)}\n`;
        
        if (preventiveData.reasoning.length > 0) {
            textToCopy += '\nNote:\n';
            preventiveData.reasoning.forEach(reason => {
                textToCopy += `- ${reason}\n`;
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
clearArtifactBtn.addEventListener('click', () => {
    if (preventiveData.school || preventiveData.course || preventiveData.reasoning.length > 0) {
        if (confirm('Vuoi davvero cancellare il preventivo?')) {
            // Reset preventivo
            preventiveData = {
                school: null,
                course: null,
                duration: null,
                startDate: null,
                accommodation: null,
                extras: [],
                totalPrice: 0,
                currency: 'GBP',
                reasoning: []
            };
            
            renderPreventive();
            showSnackbar('Preventivo cancellato');
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
        // Aggiorna preventivo con input utente
        updatePreventive(content, true);
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
        
        // Se è un messaggio dell'assistente con informazioni sui corsi, aggiorna il preventivo
        if (!content.includes('📤') && !content.includes('✅') && !content.includes('❌')) {
            updatePreventive(content, false);
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
    
    // Reset anche il preventivo quando si pulisce la chat
    preventiveData = {
        school: null,
        course: null,
        duration: null,
        startDate: null,
        accommodation: null,
        extras: [],
        totalPrice: 0,
        currency: 'GBP',
        reasoning: []
    };
    renderPreventive();
    
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
    
    // Inizializza il preventivo vuoto
    renderPreventive();
    
    addMessage('assistant', 
        '# Ciao! 👋\n\n' +
        'Sono il chatbot per informazioni su **scuole di lingua**.\n\n' +
        'Posso aiutarti con:\n' +
        '• **Prezzi dei corsi**\n' +
        '• **Opzioni di alloggio**\n' +
        '• **Date e disponibilità**\n' +
        '• **Transfer aeroportuali**\n\n' +
        '💡 **Mentre parliamo, compilerò un preventivo personalizzato** che vedrai sulla destra!\n\n' +
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

// Pulisci job attivi quando si lascia la pagina
window.addEventListener('beforeunload', () => {
    activeJobs.forEach((job, jobId) => {
        clearInterval(job.interval);
    });
});