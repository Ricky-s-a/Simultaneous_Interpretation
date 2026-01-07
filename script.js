// Initial Setup
const { pinyin } = pinyinPro;

// DOM Elements
const micBtn = document.getElementById('micBtn');
const micStatus = micBtn.querySelector('.mic-status');
const outputContainer = document.getElementById('outputContainer');
const settingsBtn = document.getElementById('settingsBtn');
const settingsDialog = document.getElementById('settingsDialog');
const saveSettingsBtn = document.getElementById('saveSettings');
const apiKeyInput = document.getElementById('apiKey');
const translationModeSelect = document.getElementById('translationMode');

// State
let isListening = false;
let recognition = null;
let currentInterimCard = null;

// Settings
let settings = {
    apiKey: localStorage.getItem('yitalk_apikey') || '',
    mode: localStorage.getItem('yitalk_mode') || 'deepseek'
};

// Initialize Settings UI
apiKeyInput.value = settings.apiKey;
translationModeSelect.value = settings.mode;

// Speech Recognition Engine
function initSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('このブラウザは音声認識をサポートしていません。Google ChromeまたはSafariを使用してください。\nSpeech Recognition API not supported.');
        return null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();

    rec.lang = 'zh-CN'; // Chinese (Simplified)
    rec.continuous = true;
    rec.interimResults = true;

    rec.onstart = () => {
        isListening = true;
        updateMicUI(true);
    };

    rec.onend = () => {
        isListening = false;
        updateMicUI(false);
        // Auto-restart if it stopped unexpectedly but was supposed to be running (common mobile behavior)
        // However, for explicit stop, we handle it in toggleListening.
    };

    rec.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
            alert('マイクの使用が許可されていません。\nPlease allow microphone access.');
        }
        isListening = false;
        updateMicUI(false);
    };

    rec.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        if (finalTranscript) {
            // Commit final card
            if (currentInterimCard) {
                currentInterimCard.remove();
                currentInterimCard = null;
            }
            createCard(finalTranscript, true);
        } else if (interimTranscript) {
            // Update interim card
            if (!currentInterimCard) {
                currentInterimCard = createCard(interimTranscript, false);
            } else {
                updateCard(currentInterimCard, interimTranscript);
            }
        }
    };

    return rec;
}

// UI Functions
function updateMicUI(listening) {
    if (listening) {
        micBtn.classList.add('listening');
        micStatus.textContent = 'LISTENING...';
        micBtn.querySelector('.mic-icon').innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M320-320v-320h320v320H320Zm-80 80h480v-480H240v480Z"/></svg>'; // Stop icon
    } else {
        micBtn.classList.remove('listening');
        micStatus.textContent = 'START';
        micBtn.querySelector('.mic-icon').innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="32" viewBox="0 -960 960 960" width="32" fill="currentColor"><path d="M480-400q-50 0-85-35t-35-85v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q0 50-35 85t-85 35Z"/><path d="M440-160v-123q-106-15-173-94.5T200-560h80q0 83 58.5 141.5T480-360q83 0 141.5-58.5T680-560h80q0 102-67 182.5T520-283v123h-80Z"/></svg>'; // Mic icon
    }
}

function createCard(text, isFinal) {
    const card = document.createElement('div');
    card.className = 'message-card';
    if (!isFinal) card.style.opacity = '0.7';

    // Generate Pinyin
    // Use toneType: 'none' for cleaner look or default for tones. Tones are helpful. w default.
    const pinyinText = pinyin(text, { toneType: 'symbol' }); // e.g. "hǎo"

    card.innerHTML = `
        <div class="cn-text">${text}</div>
        <div class="pinyin-text">${pinyinText}</div>
        <div class="jp-text">
            ${isFinal ? '<span class="loading-dots">翻訳中...</span>' : '...'}
        </div>
    `;

    outputContainer.appendChild(card);
    outputContainer.scrollTop = outputContainer.scrollHeight;

    if (isFinal) {
        translateText(text).then(translation => {
            const jpDiv = card.querySelector('.jp-text');
            jpDiv.textContent = translation;
            // Optionally playing TTS here if requested
        });
    }

    return card;
}

function updateCard(card, text) {
    const pinyinText = pinyin(text, { toneType: 'symbol' });
    card.querySelector('.cn-text').textContent = text;
    card.querySelector('.pinyin-text').textContent = pinyinText;
    outputContainer.scrollTop = outputContainer.scrollHeight;
}

// Translation Logic
async function translateText(text) {
    if (settings.mode !== 'deepseek' || !settings.apiKey) {
        if (!settings.apiKey && settings.mode === 'deepseek') {
            return "※設定からAPIキーを入力してください (Please set API Key)";
        }
        return "---"; // Manual mode
    }

    try {
        // DeepSeek API Endpoint (OpenAI Compatible)
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    {
                        "role": "system",
                        "content": "You are a professional Chinese to Japanese simultaneous interpreter. Translate the input text into natural, spoken Japanese. Do not add any explanations, only the translation."
                    },
                    {
                        "role": "user",
                        "content": text
                    }
                ],
                max_tokens: 100
            })
        });

        const data = await response.json();
        if (data.error) {
            console.error('API Error:', data.error);
            return `Error: ${data.error.message}`;
        }
        return data.choices[0].message.content.trim();
    } catch (e) {
        console.error('Translation failed', e);
        return "通信エラー (Connection Error)";
    }
}

// Event Listeners
micBtn.addEventListener('click', () => {
    if (!recognition) {
        recognition = initSpeechRecognition();
    }

    if (isListening) {
        recognition.stop();
    } else {
        recognition.start();
    }
});

// Settings Dialog
settingsBtn.addEventListener('click', () => {
    settingsDialog.showModal();
});

saveSettingsBtn.addEventListener('click', (e) => {
    // e.preventDefault(); // Usually handled by dialog form method="dialog" but explicit is okay
    settings.apiKey = apiKeyInput.value.trim();
    settings.mode = translationModeSelect.value;

    localStorage.setItem('yitalk_apikey', settings.apiKey);
    localStorage.setItem('yitalk_mode', settings.mode);

    // Dialog closes automatically due to form method="dialog" or we can close it
    // settingsDialog.close(); 
});

// Prevent dialog from closing if clicking inside (backdrop click closes is optional, but form handles close)
settingsDialog.addEventListener('click', (e) => {
    const rect = settingsDialog.getBoundingClientRect();
    if (e.clientY < rect.top || e.clientY > rect.bottom ||
        e.clientX < rect.left || e.clientX > rect.right) {
        settingsDialog.close();
    }
});
settingsDialog.querySelector('form').addEventListener('click', (e) => e.stopPropagation());

