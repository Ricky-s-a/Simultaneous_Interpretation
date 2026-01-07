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
const sourceLangSelect = document.getElementById('sourceLang');
const targetLangSelect = document.getElementById('targetLang');
const swapLangBtn = document.getElementById('swapLangBtn'); // New Button

// State
let isRecordingActive = false; // User's intent (ON/OFF)
let recognition = null;
let currentInterimCard = null;
let lastFinalTranscript = ""; // To prevent duplicates

// Settings
let settings = {
    apiKey: localStorage.getItem('yitalk_apikey') || '',
    mode: localStorage.getItem('yitalk_mode') || 'deepseek',
    sourceLang: localStorage.getItem('yitalk_source') || 'zh-CN',
    targetLang: localStorage.getItem('yitalk_target') || 'Japanese'
};

// Initialize Settings UI
apiKeyInput.value = settings.apiKey;
translationModeSelect.value = settings.mode;
sourceLangSelect.value = settings.sourceLang;
targetLangSelect.value = settings.targetLang;

// Helper maps for swapping
const codeToName = {
    'zh-CN': 'Chinese', 'en-US': 'English', 'ja-JP': 'Japanese',
    'ko-KR': 'Korean', 'fr-FR': 'French', 'de-DE': 'German',
    'es-ES': 'Spanish', 'it-IT': 'Italian', 'ru-RU': 'Russian',
    'vi-VN': 'Vietnamese', 'th-TH': 'Thai', 'id-ID': 'Indonesian'
};

const nameToCode = {
    'Chinese': 'zh-CN', 'English': 'en-US', 'Japanese': 'ja-JP',
    'Korean': 'ko-KR', 'French': 'fr-FR', 'German': 'de-DE',
    'Spanish': 'es-ES', 'Italian': 'it-IT', 'Russian': 'ru-RU',
    'Vietnamese': 'vi-VN', 'Thai': 'th-TH', 'Indonesian': 'id-ID'
};

// Speech Recognition Engine
function initSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('このブラウザは音声認識をサポートしていません。Google ChromeまたはSafariを使用してください。\nSpeech Recognition API not supported.');
        return null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();

    // Explicitly set language from current settings
    rec.lang = settings.sourceLang;
    rec.continuous = true;
    rec.interimResults = true;

    console.log(`Initialized Speech Recognition with language: ${rec.lang}`);

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
                // Force verify language again on restart
                if (rec.lang !== settings.sourceLang) {
                    console.log("Language mismatch on restart, recreating...");
                    recognition = initSpeechRecognition();
                    if (recognition) recognition.start();
                    return;
                }
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
            // Prevent duplicates (common issue with Android Chrome / Network lag)
            if (finalTranscript === lastFinalTranscript) {
                return;
            }
            lastFinalTranscript = finalTranscript;

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
        // Dynamic generic label
        const langCode = settings.sourceLang.split('-')[0].toUpperCase();
        let statusText = 'Listening';
        if (langCode === 'ZH') statusText = 'Listening';
        else if (langCode === 'JA') statusText = '聞いています';

        micStatus.textContent = `${langCode} (${statusText})`;
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

    // Generate Pinyin only if source is Chinese (Simplified)
    let secondLine = '';
    if (settings.sourceLang === 'zh-CN') {
        const pinyinText = pinyin(text, { toneType: 'symbol' });
        secondLine = `<div class="pinyin-text">${pinyinText}</div>`;
    }

    card.innerHTML = `
        <div class="cn-text">${text}</div>
        ${secondLine}
        <div class="jp-text">
            ${isFinal ? '<span class="loading-dots">Wait...</span>' : '...'}
        </div>
    `;

    outputContainer.appendChild(card);
    outputContainer.scrollTop = outputContainer.scrollHeight;

    if (isFinal) {
        translateText(text).then(translation => {
            const jpDiv = card.querySelector('.jp-text');
            jpDiv.textContent = translation;
        });
    }

    return card;
}

function updateCard(card, text) {
    card.querySelector('.cn-text').textContent = text;
    if (settings.sourceLang === 'zh-CN') {
        const pinyinText = pinyin(text, { toneType: 'symbol' });
        const pDiv = card.querySelector('.pinyin-text');
        if (pDiv) pDiv.textContent = pinyinText;
    }
    outputContainer.scrollTop = outputContainer.scrollHeight;
}

// Translation Logic
async function translateText(text) {
    const mode = settings.mode;

    if (mode === 'manual') {
        return "--- (Manual Mode)";
    }

    // Free Mode (MyMemory)
    if (mode === 'free') {
        try {
            console.log("Requesting Free translation...", text);
            // Construct pair: "source|target"
            const map = {
                'Japanese': 'ja', 'English': 'en', 'Chinese': 'zh',
                'Korean': 'ko', 'French': 'fr', 'German': 'de',
                'Spanish': 'es', 'Italian': 'it', 'Russian': 'ru',
                'Vietnamese': 'vi', 'Thai': 'th', 'Indonesian': 'id'
            };
            const src = settings.sourceLang.split('-')[0];
            const tgt = map[settings.targetLang] || 'ja';

            const pair = `${src}|${tgt}`;
            const encodedText = encodeURIComponent(text);
            const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${pair}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.responseStatus !== 200) {
                console.warn("MyMemory Error:", data);
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

        // Dynamic Prompt based on language settings
        const prompt = `You are a professional simultaneous interpreter. Translate the following ${settings.sourceLang} text into natural ${settings.targetLang}. Do not add any explanations, only the translation.`;

        // DeepSeek API Endpoint
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
                        "content": prompt
                    },
                    {
                        "role": "user",
                        "content": text
                    }
                ],
                max_tokens: 256
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            return `API Error: ${response.status} ${errData.error?.message || ''}`;
        }

        const data = await response.json();
        if (data.error) {
            return `Error: ${data.error.message}`;
        }

        return data.choices[0].message.content.trim();

    } catch (e) {
        console.error('Translation failed', e);
        return `通信エラー: ${e.message}`;
    }
}

// Event Listeners
micBtn.addEventListener('click', () => {
    // FORCE RESET: Always create a fresh instance on Start to ensure settings matching
    if (isRecordingActive) {
        // User wants to stop
        isRecordingActive = false;
        if (recognition) {
            recognition.abort(); // Hard stop
            recognition = null; // Destroy
        }
        updateMicUI(false);
    } else {
        // User wants to start
        // Always creating new instance to be safe
        recognition = initSpeechRecognition();

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

// Swap Language Event
swapLangBtn.addEventListener('click', () => {
    // Current settings
    const currentSource = settings.sourceLang; // e.g. "zh-CN"
    const currentTarget = settings.targetLang; // e.g. "Japanese"

    // Find counterparts
    const newSource = nameToCode[currentTarget]; // "Japanese" -> "ja-JP"
    const newTarget = codeToName[currentSource]; // "zh-CN" -> "Chinese"

    if (!newSource || !newTarget) {
        alert('この言語の組み合わせはスワップできません。\nCannot swap this language pair.');
        return;
    }

    // Apply new settings
    settings.sourceLang = newSource;
    settings.targetLang = newTarget;

    // Update UI selects to match (so settings dialog is correct)
    sourceLangSelect.value = settings.sourceLang;
    targetLangSelect.value = settings.targetLang;

    // Save
    localStorage.setItem('yitalk_source', settings.sourceLang);
    localStorage.setItem('yitalk_target', settings.targetLang);

    // Toast/Feedback
    const srcCode = settings.sourceLang.split('-')[0].toUpperCase();
    const tgtCode = nameToCode[settings.targetLang].split('-')[0].toUpperCase();
    alert(`Swapped: ${srcCode} ↔ ${tgtCode}`);

    // Restart Mic if active
    if (isRecordingActive) {
        if (recognition) {
            recognition.abort();
            recognition = null;
        }
        isRecordingActive = false;
        updateMicUI(false);
        // User can manually restart
    }
});

// Settings Dialog
settingsBtn.addEventListener('click', () => {
    settingsDialog.showModal();
});

saveSettingsBtn.addEventListener('click', (e) => {
    // Save standard settings
    settings.apiKey = apiKeyInput.value.trim();
    settings.mode = translationModeSelect.value;
    settings.sourceLang = sourceLangSelect.value;
    settings.targetLang = targetLangSelect.value;

    localStorage.setItem('yitalk_apikey', settings.apiKey);
    localStorage.setItem('yitalk_mode', settings.mode);
    localStorage.setItem('yitalk_source', settings.sourceLang);
    localStorage.setItem('yitalk_target', settings.targetLang);

    // Auto-stop if recording, to force restart for new settings
    if (isRecordingActive) {
        if (recognition) recognition.abort();
        recognition = null;
        isRecordingActive = false;
        updateMicUI(false);
        alert("設定を保存しました。マイクボタンを押して再開してください。\nSettings saved. Please press Start.");
    }
});

// Prevent dialog from closing if clicking inside
settingsDialog.addEventListener('click', (e) => {
    const rect = settingsDialog.getBoundingClientRect();
    if (e.clientY < rect.top || e.clientY > rect.bottom ||
        e.clientX < rect.left || e.clientX > rect.right) {
        settingsDialog.close();
    }
});
settingsDialog.querySelector('form').addEventListener('click', (e) => e.stopPropagation());
