const chatLog = document.getElementById('chat-log');
const statusDiv = document.getElementById('status');
const GEMINI_API_KEY = window.electronAPI.getGeminiApiKey();

let history = [{ role: 'model', parts: [{ text: 'Hello! How can I help you?' }] }];
let inactivityTimer;

// --- Speech Recognition (STT) ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = 'en-US';
recognition.interimResults = false;
recognition.continuous = false;

recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    addMessage(transcript, 'user');
    processUserMessage(transcript);
};

recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    statusDiv.textContent = `Error: ${event.error}`;
    setTimeout(closeWindow, 3000);
};

recognition.onend = () => {
    // This will be handled by the conversation flow
};

// --- Text-to-Speech (TTS) ---
function speak(text) {
    statusDiv.textContent = 'Speaking...';
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => {
        // After speaking, wait a few seconds then close the window
        statusDiv.textContent = 'Finished.';
        resetInactivityTimer();
    };
    speechSynthesis.speak(utterance);
}

// --- UI & Chat Logic ---
function addMessage(text, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);
    messageElement.textContent = text;
    chatLog.appendChild(messageElement);
    chatLog.scrollTop = chatLog.scrollHeight; // Auto-scroll
}

function processUserMessage(text) {
    clearTimeout(inactivityTimer);
    statusDiv.textContent = 'Thinking...';
    history.push({ role: 'user', parts: [{ text }] });
    callGeminiAPI();
}

async function callGeminiAPI() {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const requestBody = {
      contents: history.map(item => ({ role: item.role, parts: item.parts })),
      generationConfig: { temperature: 0.8, maxOutputTokens: 256 }
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        
        const data = await response.json();
        const modelResponse = data.candidates[0].content.parts[0].text;
        
        history.push({ role: 'model', parts: [{ text: modelResponse }] });
        addMessage(modelResponse, 'model');
        speak(modelResponse);

    } catch (error) {
        console.error('Gemini API error:', error);
        const errorMessage = "I'm sorry, I encountered an error. Please try again later.";
        addMessage(errorMessage, 'model');
        speak(errorMessage);
    }
}

// --- Window Management ---
function closeWindow() {
    window.electronAPI.closeOverlay();
}

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(closeWindow, 7000); // 7 seconds of inactivity
}

// --- Initial Load ---
window.onload = () => {
    addMessage(history[0].parts[0].text, 'model');
    recognition.start();
    resetInactivityTimer();
};