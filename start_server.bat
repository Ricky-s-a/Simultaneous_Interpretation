@echo off
echo Starting YiTalk Server...
echo.
echo For Local Use: Open http://localhost:8000
echo.
echo NOTE: For usage on other devices (like smartphones) on the same WiFi:
echo Microphone access usually requires HTTPS.
echo You may need to use 'localhost' on the device itself or set up HTTPS/Tunneling (like ngrok).
echo.
start "" "http://localhost:8000"
python -m http.server 8000
