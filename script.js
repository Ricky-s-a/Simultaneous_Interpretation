// Initial Setup
let pinyin = (text) => text; // Fallback
try {
    if (window.pinyinPro) {
        pinyin = window.pinyinPro.pinyin;
    }
} catch (e) {
    console.error("Pinyin library failed to load", e);
}

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
const cancelSettingsBtn = document.getElementById('cancelSettings');

// Inputs in Settings
const uiLangSelect = document.getElementById('uiLang');
const deepseekKeyInput = document.getElementById('deepseekKey');
const deeplKeyInput = document.getElementById('deeplKey');
// const translationModeSelect (Removed)
const silenceDelayInput = document.getElementById('silenceDelay');
const silenceDelayVal = document.getElementById('silenceDelayVal');
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
    uiLang: localStorage.getItem('yitalk_ui_lang') || 'ja',
    deepseekKey: localStorage.getItem('yitalk_apikey_deepseek') || '',
    deeplKey: localStorage.getItem('yitalk_apikey_deepl') || '',
    mode: localStorage.getItem('yitalk_mode') || 'deepseek',
    sourceLang: localStorage.getItem('yitalk_source') || 'zh-CN',
    targetLang: localStorage.getItem('yitalk_target') || 'Japanese',
    delay: parseInt(localStorage.getItem('yitalk_delay')) || 1200
};

// Translations
const translations = {
    ja: {
        settings_title: "設定",
        ui_language: "表示言語",
        api_hint: "使用する翻訳モード（キー）を以下で選択してください。",
        label_left_btn: "左ボタンの言語",
        label_right_btn: "右ボタンの言語",
        label_mode: "翻訳モード",
        label_delay: "認識待機時間 (ms)",
        btn_cancel: "キャンセル",
        btn_save: "保存",
        tap_to_speak: "タップして話す",
        listening: "聞いています...",
        welcome_template: "<b>{src}</b> または <b>{tgt}</b> で話しかけてください。<br>設定からAPIキーを入力すると、高精度の翻訳が利用できます。",
        alert_browser_unsupported: "このブラウザは音声認識をサポートしていません。Google ChromeまたはSafariを使用してください。",
        alert_mic_denied: "マイクの使用が許可されていません。",
        alert_save: "設定を保存しました。",
        error_no_key: "※設定からAPIキーを入力してください"
    },
    en: {
        settings_title: "Settings",
        ui_language: "UI Language",
        api_hint: "Select the mode below to choose which key to use.",
        label_left_btn: "Left Button Language",
        label_right_btn: "Right Button Language",
        label_mode: "Mode",
        label_delay: "Silence Detection (ms)",
        btn_cancel: "Cancel",
        btn_save: "Save",
        tap_to_speak: "Tap to Speak",
        listening: "Listening...",
        welcome_template: "Speak in <b>{src}</b> or <b>{tgt}</b> using the buttons below.<br>Enter an API Key in settings for high-quality translation.",
        alert_browser_unsupported: "Browser not supported. Please use Chrome or Safari.",
        alert_mic_denied: "Microphone access denied.",
        alert_save: "Settings saved.",
        error_no_key: "* Please enter API Key in settings"
    },
    zh: {
        settings_title: "设置",
        ui_language: "界面语言",
        api_hint: "请在下方选择要使用的翻译模式（API密钥）。",
        label_left_btn: "左侧按钮语言",
        label_right_btn: "右侧按钮语言",
        label_mode: "模式",
        label_delay: "识别等待时间 (ms)",
        btn_cancel: "取消",
        btn_save: "保存",
        tap_to_speak: "点击说话",
        listening: "正在聆听...",
        welcome_template: "请按下方按钮使用 <b>{src}</b> 或 <b>{tgt}</b> 说话。<br>在设置中输入API密钥可获得高质量翻译。",
        alert_browser_unsupported: "您的浏览器不支持语音识别，请使用 Chrome 或 Safari。",
        alert_mic_denied: "无法访问麦克风。",
        alert_save: "设置已保存。",
        error_no_key: "* 请在设置中输入 API 密钥"
    }
};

// Language Maps
const codeToName = {
    'zh-CN': 'Chinese', 'en-US': 'English', 'ja-JP': 'Japanese',
    'ko-KR': 'Korean', 'fr-FR': 'French', 'de-DE': 'German',
    'es-ES': 'Spanish', 'it-IT': 'Italian', 'ru-RU': 'Russian',
    'vi-VN': 'Vietnamese', 'th-TH': 'Thai', 'id-ID': 'Indonesian',
    'ar-SA': 'Arabic', 'pt-PT': 'Portuguese'
};

const nameToCode = {
    'Chinese': 'zh-CN', 'English': 'en-US', 'Japanese': 'ja-JP',
    'Korean': 'ko-KR', 'French': 'fr-FR', 'German': 'de-DE',
    'Spanish': 'es-ES', 'Italian': 'it-IT', 'Russian': 'ru-RU',
    'Vietnamese': 'vi-VN', 'Thai': 'th-TH', 'Indonesian': 'id-ID',
    'Arabic': 'ar-SA', 'Portuguese': 'pt-PT'
};

// Initialize UI
function initUI() {
    // Settings inputs
    uiLangSelect.value = settings.uiLang;
    deepseekKeyInput.value = settings.deepseekKey;
    deeplKeyInput.value = settings.deeplKey;
    silenceDelayInput.value = settings.delay;
    silenceDelayVal.textContent = settings.delay + " ms";

    sourceLangSelect.value = settings.sourceLang;
    targetLangSelect.value = settings.targetLang;

    // Main UI
    quickModelSelect.value = settings.mode;

    updateTexts();
}

function updateTexts() {
    const lang = settings.uiLang;
    const t = translations[lang] || translations.ja;

    // Update static elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });

    // Update dynamic elements
    updateLanguageLabels();
    updateWelcomeMessage();

    // Update button status labels (if not recording)
    if (!isRecording) {
        statusSource.textContent = t.tap_to_speak;
        statusTarget.textContent = t.tap_to_speak;
    }
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

    const lang = settings.uiLang;
    const t = translations[lang] || translations.ja;

    let msg = t.welcome_template
        .replace('{src}', srcName)
        .replace('{tgt}', tgtName);

    const p = welcomeMessage.querySelector('p');
    if (p) {
        p.innerHTML = msg;
    }
}

initUI();

// Add listener for silenceDelayInput to update its value display
silenceDelayInput.addEventListener('input', () => {
    silenceDelayVal.textContent = silenceDelayInput.value + " ms";
});

// Buffering State
let messageBuffer = "";
let commitTimer = null;
// const COMMIT_DELAY = 1200; // Wait 1.2s for more speech before translating

// Speech Recognition Engine
function startRecognition(side) {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        const t = translations[settings.uiLang] || translations.ja;
        alert(t.alert_browser_unsupported);
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();

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

    let processedIndex = 0;

    recognition.onstart = () => {
        isRecording = true;
        currentRecordingSide = side;
        updateMicUI(side, true);
        messageBuffer = ""; // Reset buffer
        processedIndex = 0; // Reset index tracking
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
            // Force commit any remaining buffer
            if (messageBuffer.trim()) {
                handleTranscript(messageBuffer, true, side);
                messageBuffer = "";
            }
            updateMicUI(side, false);
            currentRecordingSide = null;
        }
    };

    recognition.onerror = (event) => {
        console.error('Error', event.error);
        if (event.error === 'not-allowed') {
            const t = translations[settings.uiLang] || translations.ja;
            alert(t.alert_mic_denied);
            stopRecognition();
        }
    };

    recognition.onresult = (event) => {
        let finalChunk = '';
        let interimChunk = '';

        // Process results starting from the index the browser claims is new, 
        // OR from our own tracked index if we suspect overlap.
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            // Skip if we already processed this index as final
            if (i < processedIndex) continue;

            if (event.results[i].isFinal) {
                finalChunk += event.results[i][0].transcript;
                processedIndex = i + 1; // Advance our tracker
            } else {
                interimChunk += event.results[i][0].transcript;
            }
        }

        // Handle Final Chunk (Buffer it)
        if (finalChunk) {
            // Trim to avoid whitespace buildup
            finalChunk = finalChunk.trim();
            if (!finalChunk) return;

            // Add to buffer
            if (messageBuffer) {
                messageBuffer += " " + finalChunk;
            } else {
                messageBuffer = finalChunk;
            }

            // Update UI with buffered text
            if (!currentInterimCard) {
                currentInterimCard = createCard(messageBuffer, false, side);
            } else {
                updateCard(currentInterimCard, messageBuffer, side);
            }

            // Reset Timer
            if (commitTimer) clearTimeout(commitTimer);

            // If buffer is very long, force commit
            if (messageBuffer.length > 200) {
                commitBuffer(side);
            } else {
                // Wait for more speech
                commitTimer = setTimeout(() => {
                    commitBuffer(side);
                }, settings.delay);
            }
        }
        // Handle Interim
        else if (interimChunk) {
            const fullVisual = messageBuffer ? (messageBuffer + " " + interimChunk) : interimChunk;

            if (commitTimer) clearTimeout(commitTimer);

            if (!currentInterimCard) {
                currentInterimCard = createCard(fullVisual, false, side);
            } else {
                updateCard(currentInterimCard, fullVisual, side);
            }
        }
    };

    try {
        recognition.start();
    } catch (e) {
        console.error(e);
    }
}

function commitBuffer(side) {
    if (commitTimer) clearTimeout(commitTimer);
    commitTimer = null;

    if (!messageBuffer.trim()) return;

    // Finalize
    if (currentInterimCard) {
        currentInterimCard.remove();
        currentInterimCard = null;
    }

    const textToTranslate = messageBuffer.trim();
    messageBuffer = ""; // Clear

    handleTranscript(textToTranslate, true, side);
}

function stopRecognition() {
    // Force commit if anything is pending
    if (messageBuffer.trim() && currentRecordingSide) {
        commitBuffer(currentRecordingSide);
    }

    isRecording = false;
    if (recognition) {
        recognition.abort();
        recognition = null;
    }
    updateMicUI('source', false);
    updateMicUI('target', false);
    currentRecordingSide = null;

    if (commitTimer) clearTimeout(commitTimer);
    messageBuffer = "";
}

// UI Updates
function updateMicUI(side, active) {
    const btn = side === 'source' ? micBtnSource : micBtnTarget;
    const status = side === 'source' ? statusSource : statusTarget;
    const otherBtn = side === 'source' ? micBtnTarget : micBtnSource;
    const otherStatus = side === 'source' ? statusTarget : statusSource;

    const t = translations[settings.uiLang] || translations.ja;

    if (active) {
        btn.classList.add('listening');
        status.textContent = t.listening;
        // Disable other button visually?
        otherBtn.style.opacity = '0.5';
        otherBtn.style.pointerEvents = 'none';
        quickModelSelect.disabled = true;
    } else {
        btn.classList.remove('listening');
        status.textContent = t.tap_to_speak;
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
            'Japanese': 'ja', 'English': 'en', 'Chinese': 'zh-CN',
            'Korean': 'ko', 'French': 'fr', 'German': 'de',
            'Spanish': 'es', 'Italian': 'it', 'Russian': 'ru',
            'Vietnamese': 'vi', 'Thai': 'th', 'Indonesian': 'id',
            'Arabic': 'ar', 'Portuguese': 'pt'
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

            if (data.responseStatus !== 200) {
                return `Error: ${data.responseDetails || "MyMemory Limit"}`;
            }
            return data.responseData.translatedText;
        } catch (e) { return `Error: ${e.message}`; }
    }

    // Paid
    let key = '';
    if (mode === 'deepseek') key = settings.deepseekKey;
    if (mode === 'deepl') key = settings.deeplKey;

    if (!key) {
        const t = translations[settings.uiLang] || translations.ja;
        return t.error_no_key;
    }

    if (mode === 'deepl') {
        try {
            // Determine API Endpoint (Free vs Pro)
            // Free keys usually end with ':fx'
            const isFree = key.endsWith(':fx');
            const baseUrl = isFree ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';

            // Map languages to DeepL supported codes (upper case)
            // JA -> JA, ZH -> ZH, EN -> EN-US (preference)
            // Code map helper
            const getDeepLCode = (name) => {
                const map = {
                    'Japanese': 'JA', 'English': 'EN-US', 'Chinese': 'ZH',
                    'Korean': 'KO', 'French': 'FR', 'German': 'DE',
                    'Spanish': 'ES', 'Italian': 'IT', 'Russian': 'RU',
                    'Vietnamese': 'ID', /* DeepL might not support VI/TH/ID fully in free tier or codes differ? 
                       Actually DeepL supports ID (Indonesian) on free.
                       Thai/Vietnamese not supported yet in standard DeepL.
                    */
                    'Indonesian': 'ID',
                    'Arabic': 'AR',
                    'Portuguese': 'PT-PT' // or PT-BR
                };
                // Fallback for unsupported langs in DeepL?
                return map[name] || null;
            };

            const targetCode = getDeepLCode(toLang);
            if (!targetCode) return `DeepL doesn't support ${toLang}`;

            // Use direct URL (Proxy might be blocked or causing Forbidden)
            const url = baseUrl;

            const params = new URLSearchParams();
            params.append('auth_key', key);
            params.append('text', text);
            params.append('target_lang', targetCode);

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                return `DeepL Error: ${err.message || res.status}`;
            }

            const data = await res.json();
            return data.translations?.[0]?.text || "Error";

        } catch (e) { return `Error: ${e.message}`; }
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
    localStorage.setItem('yitalk_mode', settings.mode);
});

// Slider Value Update
silenceDelayInput.addEventListener('input', () => {
    silenceDelayVal.textContent = silenceDelayInput.value + " ms";
});

// Settings Dialog Listeners
settingsBtn.addEventListener('click', () => settingsDialog.showModal());

saveSettingsBtn.addEventListener('click', () => {
    settings.uiLang = uiLangSelect.value;
    settings.deepseekKey = deepseekKeyInput.value.trim();
    settings.deeplKey = deeplKeyInput.value.trim();
    settings.delay = parseInt(silenceDelayInput.value);

    // Mode is managed by home screen (quickModelSelect) primarily now, 
    // but ensure we persist whatever is current.
    // settings.mode is already up to date via quickModelSelect listener.

    settings.sourceLang = sourceLangSelect.value;
    settings.targetLang = targetLangSelect.value;

    localStorage.setItem('yitalk_ui_lang', settings.uiLang);
    localStorage.setItem('yitalk_apikey_deepseek', settings.deepseekKey);
    localStorage.setItem('yitalk_apikey_deepl', settings.deeplKey);
    localStorage.setItem('yitalk_delay', settings.delay);
    localStorage.setItem('yitalk_mode', settings.mode);
    localStorage.setItem('yitalk_source', settings.sourceLang);
    localStorage.setItem('yitalk_target', settings.targetLang);

    // Update UI
    updateTexts(); // Apply new language immediately
    // quickModelSelect.value = settings.mode; // Already synced

    // Stop recording if active
    if (isRecording) stopRecognition();

    const t = translations[settings.uiLang] || translations.ja;
    alert(t.alert_save);
    settingsDialog.close();
});

if (cancelSettingsBtn) {
    cancelSettingsBtn.addEventListener('click', () => {
        settingsDialog.close();
    });
}

settingsDialog.addEventListener('click', (e) => {
    const rect = settingsDialog.getBoundingClientRect();
    if (e.clientY < rect.top || e.clientY > rect.bottom ||
        e.clientX < rect.left || e.clientX > rect.right) {
        settingsDialog.close();
    }
});
settingsDialog.querySelector('form').addEventListener('click', (e) => e.stopPropagation());
