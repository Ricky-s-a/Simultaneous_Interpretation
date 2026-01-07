# YiTalk - Simultaneous Interpretation App

A lightweight, web-based simultaneous interpretation application designed for Chinese (speech) to Japanese (text) translation.
Currently optimized for use with **DeepSeek API**, making it accessible and cost-effective, including usage within China.

![YiTalk Logo](logo.png)

## 🚀 Features

*   **Real-time Speech Recognition**: Converts spoken Chinese (Simplified) into text instantly using the Web Speech API.
*   **Pinyin Generation**: Automatically generates Pinyin with tone marks for every sentence to aid in pronunciation and learning.
*   **AI-Powered Translation**: Uses **DeepSeek V3** (OpenAI-compatible) to provide high-quality, natural Japanese translations.
*   **China-Friendly**: 
    *   Uses **DeepSeek** (accessible from China without VPN).
    *   Uses **jsDelivr** for CDN dependencies (pinyin-pro).
    *   No dependency on Google Fonts or blocking services.
*   **Mobile Optimized**: Responsive design that looks and works great on smartphones (iOS Safari recommended).

## 🛠 Usage

### Online (GitHub Pages)
Access the deployed version here:
**[https://Ricky-s-a.github.io/Simultaneous_Interpretation/](https://Ricky-s-a.github.io/Simultaneous_Interpretation/)**
*(Note: Requires HTTPS for microphone access)*

1.  Open the settings (gear icon) in the top right.
2.  Enter your **DeepSeek API Key** (`sk-...`).
    *   *You can get a key from the [DeepSeek Open Platform](https://platform.deepseek.com/).*
3.  Tap the **Microphone** button at the bottom.
4.  Speak Chinese. The app will transcribe, show Pinyin, and translate to Japanese.

### Local Development

Since this is a vanilla HTML/JS/CSS app, no complex build tools are required.

1.  Clone the repository.
2.  Run a local server (HTTPS is recommended for mic access, but localhost works).
    *   **Windows**: Double-click `start_server.bat`.
    *   **Python**: `python -m http.server 8000`
3.  Open `http://localhost:8000` in your browser.

## ⚙️ Configuration

*   **API Key**: Stored locally in your browser (LocalStorage). It is never sent anywhere except the DeepSeek API endpoint.
*   **Model**: Defaults to `deepseek-chat` (DeepSeek V3).

## 📱 Mobile Note
*   **iPhone (iOS)**: Works well in **Safari**.
*   **Android**: Chrome's speech recognition relies on Google services. In China, you may need a device with Google services enabled or use a different browser engine, though support varies.

## 📄 License
MIT
