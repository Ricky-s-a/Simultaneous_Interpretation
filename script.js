// Initial Setup
const { pinyin } = pinyinPro;

// DOM Elements: Controls
const quickModelSelect = document.getElementById('quickModelSelect');
const micBtnSource = document.getElementById('micBtnSource');
const micBtnTarget = document.getElementById('micBtnTarget');
const labelSource = document.getElementById('labelSource');
const labelTarget = document.getElementById('labelTarget');
const statusSource = micBtnSource.querySelector('.status-label');
const statusTarget = micBtnTarget.querySelector('.status-label');
const welcomeMessage = document.getElementById('welcomeMessage');

const outputContainer = document.getElementById('outputContainer');
const settingsBtn = document.getElementById('settingsBtn');
const settingsDialog = document.getElementById('settingsDialog');
const saveSettingsBtn = document.getElementById('saveSettings');

// Inputs in Settings
const deepseekKeyInput = document.getElementById('deepseekKey');
const geminiKeyInput = document.getElementById('geminiKey');
const googleKeyInput = document.getElementById('googleKey');
const translationModeSelect = document.getElementById('translationMode');
const sourceLangSelect = document.getElementById('sourceLang');
const targetLangSelect = document.getElementById('targetLang');

// State
let isRecording = false;
let currentRecordingSide = null; // 'source' or 'target'
let recognition = null;
let currentInterimCard = null;
let lastFinalTranscript = "";

// Settings
let settings = {
    deepseekKey: localStorage.getItem('yitalk_apikey_deepseek') || '',
    geminiKey: localStorage.getItem('yitalk_apikey_gemini') || '',
    googleKey: localStorage.getItem('yitalk_apikey_google') || '',
    mode: localStorage.getItem('yitalk_mode') || 'deepseek',
    sourceLang: localStorage.getItem('yitalk_source') || 'zh-CN',
    targetLang: localStorage.getItem('yitalk_target') || 'Japanese'
};

// Language Maps
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

// Initialize UI
function initUI() {
    // Settings inputs
    deepseekKeyInput.value = settings.deepseekKey;
    geminiKeyInput.value = settings.geminiKey;
    googleKeyInput.value = settings.googleKey;
    translationModeSelect.value = settings.mode;
    sourceLangSelect.value = settings.sourceLang;
    targetLangSelect.value = settings.targetLang;

    // Main UI
    quickModelSelect.value = settings.mode;
    updateLanguageLabels();
    updateWelcomeMessage();
}

function updateLanguageLabels() {
    const srcName = codeToName[settings.sourceLang] || settings.sourceLang;
    const tgtName = settings.targetLang; // already a name
    labelSource.textContent = srcName;
    labelTarget.textContent = tgtName;
}

function updateWelcomeMessage() {
    const srcName = codeToName[settings.sourceLang] || settings.sourceLang;
    const tgtName = settings.targetLang;

    // Simple localization check (if interface seems to be Japanese)
    // We'll stick to Japanese instruction as per user request style
    const msg = `下のボタンを押して、<b>${srcName}</b> または <b>${tgtName}</b> で話しかけてください。<br>設定からAPIキーを入力すると、高精度の翻訳が利用できます。`;

    const p = welcomeMessage.querySelector('p');
    if (p) {
        p.innerHTML = msg;
    }
}

initUI();

// Speech Recognition Engine
function startRecognition(side) {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Browser not supported.');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();

    // Determine Language
    // If side is 'source', usage settings.sourceLang (code)
    // If side is 'target', convert settings.targetLang (name) to code
    let langCode = '';
    if (side === 'source') {
        langCode = settings.sourceLang;
    } else {
        langCode = nameToCode[settings.targetLang] || 'en-US';
    }

    recognition.lang = langCode;
    recognition.continuous = true;
    recognition.interimResults = true;

    console.log(`Starting recognition for ${side} (${langCode})`);

    recognition.onstart = () => {
        isRecording = true;
        currentRecordingSide = side;
        updateMicUI(side, true);
    };

    recognition.onend = () => {
        if (isRecording) {
            console.log('Auto-restarting...');
            try {
                recognition.start();
            } catch (e) {
                // Ignore
            }
        } else {
            updateMicUI(side, false);
            currentRecordingSide = null;
        }
    };

    recognition.onerror = (event) => {
        console.error('Error', event.error);
        if (event.error === 'not-allowed') {
            alert('Microphone access denied.');
            stopRecognition();
        }
    };

    recognition.onresult = (event) => {
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
            if (finalTranscript === lastFinalTranscript) return;
            lastFinalTranscript = finalTranscript;
            if (currentInterimCard) {
                currentInterimCard.remove();
                currentInterimCard = null;
            }
            // Commit
            handleTranscript(finalTranscript, true, side);
        } else if (interimTranscript) {
            // Update
            if (!currentInterimCard) {
                currentInterimCard = createCard(interimTranscript, false, side);
            } else {
                updateCard(currentInterimCard, interimTranscript, side);
            }
        }
    };

    try {
        recognition.start();
    } catch (e) {
        console.error(e);
    }
}

function stopRecognition() {
    isRecording = false;
    if (recognition) {
        recognition.abort();
        recognition = null;
    }
    updateMicUI('source', false);
    updateMicUI('target', false);
    currentRecordingSide = null;
}

// UI Updates
function updateMicUI(side, active) {
    const btn = side === 'source' ? micBtnSource : micBtnTarget;
    const status = side === 'source' ? statusSource : statusTarget;
    const otherBtn = side === 'source' ? micBtnTarget : micBtnSource;
    const otherStatus = side === 'source' ? statusTarget : statusSource;

    if (active) {
        btn.classList.add('listening');
        status.textContent = 'Listening...';
        // Disable other button visually?
        otherBtn.style.opacity = '0.5';
        otherBtn.style.pointerEvents = 'none';
        quickModelSelect.disabled = true;
    } else {
        btn.classList.remove('listening');
        status.textContent = 'Tap to Speak';
        otherBtn.style.opacity = '1';
        otherBtn.style.pointerEvents = 'auto';
        quickModelSelect.disabled = false;
    }
}

// Message Cards
function handleTranscript(text, isFinal, side) {
    const card = createCard(text, isFinal, side);

    if (isFinal) {
        // Determine translation direction
        // If side is source: sourceLang -> targetLang
        // If side is target: targetLang -> sourceLang (name only map needed?)

        let fromLangName = '';
        let toLangName = '';

        if (side === 'source') {
            fromLangName = codeToName[settings.sourceLang];
            toLangName = settings.targetLang;
        } else {
            fromLangName = settings.targetLang;
            toLangName = codeToName[settings.sourceLang];
        }

        translateText(text, fromLangName, toLangName).then(translation => {
            const transDiv = card.querySelector('.trans-text');
            transDiv.textContent = translation;
        });
    }
}

function createCard(text, isFinal, side) {
    const card = document.createElement('div');
    card.className = 'message-card';
    if (!isFinal) card.style.opacity = '0.7';

    // Pinyin only if Main Source is Chinese AND side is source
    // OR if Target is Chinese AND side is target? 
    // Logic: if the SPOKEN language is Chinese, show Pinyin.

    let isChinese = false;
    if (side === 'source' && settings.sourceLang === 'zh-CN') isChinese = true;
    if (side === 'target' && settings.targetLang === 'Chinese') isChinese = true;

    let secondLine = '';
    if (isChinese) {
        const pinyinText = pinyin(text, { toneType: 'symbol' });
        secondLine = `<div class="pinyin-text">${pinyinText}</div>`;
    }

    // Align right if it's the target speaker? Optional style.
    // For now keeping standard left align.

    card.innerHTML = `
        <div class="cn-text" style="color: ${side === 'target' ? '#a5b4fc' : 'white'}">${text}</div>
        ${secondLine}
        <div class="jp-text trans-text">
            ${isFinal ? '<span class="loading-dots">...</span>' : ''}
        </div>
    `;

    outputContainer.appendChild(card);
    outputContainer.scrollTop = outputContainer.scrollHeight;
    return card;
}

function updateCard(card, text, side) {
    const mainText = card.querySelector('.cn-text');
    mainText.textContent = text;

    // Check if we need to update pinyin
    // Same logic as create
    let isChinese = false;
    if (side === 'source' && settings.sourceLang === 'zh-CN') isChinese = true;
    if (side === 'target' && settings.targetLang === 'Chinese') isChinese = true;

    if (isChinese) {
        const pinyinText = pinyin(text, { toneType: 'symbol' });
        const pDiv = card.querySelector('.pinyin-text');
        if (pDiv) pDiv.textContent = pinyinText;
    }

    outputContainer.scrollTop = outputContainer.scrollHeight;
}

// Translation
async function translateText(text, fromLang, toLang) {
    const mode = settings.mode;

    if (mode === 'manual') return "--- (Manual)";

    // Helpers
    const getCode = (name) => {
        const map = {
            'Japanese': 'ja', 'English': 'en', 'Chinese': 'zh',
            'Korean': 'ko', 'French': 'fr', 'German': 'de',
            'Spanish': 'es', 'Italian': 'it', 'Russian': 'ru',
            'Vietnamese': 'vi', 'Thai': 'th', 'Indonesian': 'id'
        };
        return map[name] || 'ja';
    };

    if (mode === 'free') {
        try {
            const src = getCode(fromLang);
            const tgt = getCode(toLang);
            const pair = `${src}|${tgt}`;
            const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`;
            const res = await fetch(url);
            const data = await res.json();
            return data.responseData.translatedText;
        } catch (e) { return "Error"; }
    }

    // Paid
    let key = '';
    if (mode === 'deepseek') key = settings.deepseekKey;
    if (mode === 'gemini') key = settings.geminiKey;
    if (mode === 'google') key = settings.googleKey;

    if (!key) return "No API Key";

    if (mode === 'gemini') {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
            const prompt = `Translate this ${fromLang} text into natural ${toLang}. Return ONLY the translation.\n\nText: ${text}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const data = await res.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Error";
        } catch (e) { return "Error"; }
    }

    if (mode === 'google') {
        try {
            const url = `https://translation.googleapis.com/language/translate/v2?key=${key}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    q: text,
                    target: getCode(toLang),
                    format: 'text'
                })
            });
            const data = await res.json();
            return data.data?.translations?.[0]?.translatedText || "Error";
        } catch (e) { return "Error"; }
    }

    if (mode === 'deepseek') {
        try {
            const prompt = `You are a professional interpreter. Translate the following ${fromLang} text into natural ${toLang}. Only output the translation.`;
            const res = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [
                        { "role": "system", "content": prompt },
                        { "role": "user", "content": text }
                    ],
                    max_tokens: 256
                })
            });
            const data = await res.json();
            return data.choices?.[0]?.message?.content.trim() || "Error";
        } catch (e) { return "Error"; }
    }
    return "Unknown";
}

// Event Listeners
micBtnSource.addEventListener('click', () => {
    if (isRecording) {
        if (currentRecordingSide === 'source') {
            stopRecognition();
        } else {
            // Switch side logic? Ideally stop first.
            stopRecognition();
            setTimeout(() => startRecognition('source'), 200);
        }
    } else {
        startRecognition('source');
    }
});

micBtnTarget.addEventListener('click', () => {
    if (isRecording) {
        if (currentRecordingSide === 'target') {
            stopRecognition();
        } else {
            stopRecognition();
            setTimeout(() => startRecognition('target'), 200);
        }
    } else {
        startRecognition('target');
    }
});

// Sync Quick Selector
quickModelSelect.addEventListener('change', () => {
    settings.mode = quickModelSelect.value;
    translationModeSelect.value = settings.mode;
    localStorage.setItem('yitalk_mode', settings.mode);
});

translationModeSelect.addEventListener('change', () => {
    settings.mode = translationModeSelect.value;
    quickModelSelect.value = settings.mode;
});

// Settings Dialog Listeners
settingsBtn.addEventListener('click', () => settingsDialog.showModal());

saveSettingsBtn.addEventListener('click', () => {
    settings.deepseekKey = deepseekKeyInput.value.trim();
    settings.geminiKey = geminiKeyInput.value.trim();
    settings.googleKey = googleKeyInput.value.trim();
    settings.mode = translationModeSelect.value;
    settings.sourceLang = sourceLangSelect.value;
    settings.targetLang = targetLangSelect.value;

    localStorage.setItem('yitalk_apikey_deepseek', settings.deepseekKey);
    localStorage.setItem('yitalk_apikey_gemini', settings.geminiKey);
    localStorage.setItem('yitalk_apikey_google', settings.googleKey);
    localStorage.setItem('yitalk_mode', settings.mode);
    localStorage.setItem('yitalk_source', settings.sourceLang);
    localStorage.setItem('yitalk_target', settings.targetLang);

    // Update UI
    quickModelSelect.value = settings.mode;
    updateLanguageLabels();
    updateWelcomeMessage();

    // Stop recording if active
    if (isRecording) stopRecognition();

    settingsDialog.close();
});

settingsDialog.addEventListener('click', (e) => {
    const rect = settingsDialog.getBoundingClientRect();
    if (e.clientY < rect.top || e.clientY > rect.bottom ||
        e.clientX < rect.left || e.clientX > rect.right) {
        settingsDialog.close();
    }
});
settingsDialog.querySelector('form').addEventListener('click', (e) => e.stopPropagation());
