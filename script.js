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
let isRecordingActive = false; // User's intent (ON/OFF)
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
        updateMicUI(true);
    };

    rec.onend = () => {
        // If user still wants it active, restart it immediately
        if (isRecordingActive) {
            console.log('Auto-restarting speech recognition...');
            try {
                rec.start();
            } catch (e) {
                console.warn('Restart failed, retrying in 1s...', e);
                setTimeout(() => {
                    if (isRecordingActive) rec.start();
                }, 1000);
            }
        } else {
            updateMicUI(false);
        }
    };

    rec.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
            alert('マイクの使用が許可されていません。\nPlease allow microphone access.');
            isRecordingActive = false; // User explicitly stopped or denied
            updateMicUI(false);
        }
        // Improve resilience: Ignore no-speech or network hiccups and let onend handle restart
        if (event.error === 'no-speech') {
            // Just ignore, it will trigger onend and we restart
        }
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
    // Mode defaults: if key exists -> deepseek, else -> free (if user hasn't explicitly set manual)
    const mode = settings.mode;

    if (mode === 'manual') {
        return "--- (Manual Mode)";
    }

    // Free Mode (MyMemory)
    if (mode === 'free') {
        try {
            console.log("Requesting Free translation...", text);
            const encodedText = encodeURIComponent(text);
            const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=zh-CN|ja`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.responseStatus !== 200) {
                console.warn("MyMemory Error:", data);
                // Fallback or error
                return `Limit/Error: ${data.responseDetails}`;
            }

            return data.responseData.translatedText;
        } catch (e) {
            console.error(e);
            return "Translation Error";
        }
    }

    // DeepSeek Mode
    if (!settings.apiKey) {
        return "※設定からAPIキーを入力するか、Freeモードを選択してください";
    }

    try {
        console.log("Requesting translation...", text);
        // DeepSeek API Endpoint
        // Note: Using /chat/completions directly based on docs, but if fails, might need /v1/chat/completions
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
                max_tokens: 200 // Increased slightly
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error('API Error Response:', response.status, errData);
            return `API Error: ${response.status} ${errData.error?.message || ''}`;
        }

        const data = await response.json();
        if (data.error) {
            console.error('API Data Error:', data.error);
            return `Error: ${data.error.message}`;
        }

        const result = data.choices[0].message.content.trim();
        console.log("Translation received:", result);
        return result;

    } catch (e) {
        console.error('Translation failed', e);
        return `通信エラー: ${e.message}`;
    }
}

// Event Listeners
micBtn.addEventListener('click', () => {
    if (!recognition) {
        recognition = initSpeechRecognition();
    }

    if (isRecordingActive) {
        // User wants to stop
        isRecordingActive = false;
        recognition.stop();
        updateMicUI(false);
    } else {
        // User wants to start
        isRecordingActive = true;
        updateMicUI(true); // Immediate feedback
        try {
            recognition.start();
        } catch (e) {
            console.error(e);
            isRecordingActive = false;
            updateMicUI(false);
        }
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

