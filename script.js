// script.js

// ===== CONFIGURAZIONE IMPORTANTE =====
// CAMBIA QUESTO CON L'URL DEL TUO BACKEND PYTHON!
const API_URL = 'https://chatbot-corsi.onrender.com';  // Esempi:
// const API_URL = 'https://my-chatbot-api.onrender.com';
// const API_URL = 'https://chatbot-backend.herokuapp.com';
// const API_URL = 'https://chatbot-api.up.railway.app';

// ===== FINE CONFIGURAZIONE =====

// Gestione sessione
let sessionId = localStorage.getItem('chatSessionId') || generateSessionId();
localStorage.setItem('chatSessionId', sessionId);

// Elementi DOM
const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const timeElement = document.getElementById('time');

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

// Aggiungi messaggio alla chat
function addMessage(role, content, processInfo = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Converti newline in <br>
    const formattedContent = content.replace(/\n/g, '<br>');
    contentDiv.innerHTML = formattedContent;
    
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);

    // Aggiungi info processo se presente
    if (processInfo) {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'process-info';
        infoDiv.textContent = processInfo;
        contentDiv.appendChild(infoDiv);
    }

    // Scroll automatico in basso
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

    // Disabilita input durante l'invio
    messageInput.value = '';
    messageInput.disabled = true;
    sendButton.disabled = true;

    // Aggiungi messaggio utente alla chat
    addMessage('user', message);

    // Mostra stato ricerca
    const status1 = addStatusMessage('🔍 Sto cercando informazioni rilevanti nel database');

    try {
        // Attendi un attimo per effetto visivo
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Chiama il backend Python
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

        // Rimuovi messaggio di stato
        status1.remove();

        // Mostra quanti documenti sono stati trovati
        const chunksCount = data.sources ? data.sources.length : 0;
        const totalChunks = data.total_chunks || chunksCount;
        const status2 = addStatusMessage(`📚 Ho trovato ${totalChunks} documenti rilevanti. Sto analizzando`);

        // Simula elaborazione
        await new Promise(resolve => setTimeout(resolve, 1200));

        // Aggiorna stato
        status2.innerHTML = `💭 Sto generando la risposta basata sui documenti trovati<span class="loading-dots"></span>`;
        await new Promise(resolve => setTimeout(resolve, 800));

        // Rimuovi stato finale
        status2.remove();

        // Aggiungi risposta del chatbot
        const processInfo = `Ho utilizzato ${totalChunks} chunks dal database per questa risposta.`;
        addMessage('assistant', data.message, processInfo);

    } catch (error) {
        console.error('Errore:', error);
        
        // Rimuovi tutti i messaggi di stato
        document.querySelectorAll('.status-message').forEach(el => el.remove());
        
        // Mostra messaggio di errore user-friendly
        let errorMessage = '❌ Si è verificato un errore.\n\n';
        
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage += 'Non riesco a connettermi al server. Verifica che:\n';
            errorMessage += '• Il backend Python sia in esecuzione\n';
            errorMessage += '• L\'URL del backend sia corretto (attuale: ' + API_URL + ')\n';
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
        // Riabilita input
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
    addMessage('assistant', 'Nuova conversazione iniziata. Come posso aiutarti?');
}

// Event listeners
sendButton.addEventListener('click', sendMessage);

// Permetti invio con Enter
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Messaggio di benvenuto all'avvio
window.addEventListener('load', () => {
    addMessage('assistant', 
        'Ciao! 👋 Sono il chatbot per informazioni su scuole di lingua.\n\n' +
        'Posso aiutarti con:\n' +
        '• Prezzi dei corsi\n' +
        '• Opzioni di alloggio\n' +
        '• Date e disponibilità\n' +
        '• Transfer aeroportuali\n\n' +
        'Cosa vorresti sapere?'
    );
    
    // Check configurazione
    if (API_URL === 'http://localhost:8000') {
        console.warn('⚠️ Stai usando localhost. Ricorda di cambiare API_URL per la produzione!');
    }
});

// Gestione focus automatico
document.addEventListener('DOMContentLoaded', () => {
    messageInput.focus();
});