# JARVIS — Local AI Desktop Assistant

> A fully offline, local AI assistant that understands your voice, sees your screen, controls Windows, and interacts through a futuristic interface. Built on top of the open-source **[OpenJarvis](https://github.com/open-jarvis/OpenJarvis)** framework (Stanford SAIL / Hazy Research).

## What it can do

- 🎙️ **Voice commands** — Push-to-talk or wake word ("Hey Jarvis") with offline STT/TTS
- 🤖 **OpenJarvis Multi-Agent Engine** — Orchestrator, ReAct, Deep Research, CodeAct & proactive monitors
- 🛠️ **Modular Tool Registry** — Code execution, web search, desktop control, and MCP integration
- 🖥️ **Desktop automation** — Launch apps, click, type, press hotkeys, manage windows
- 📷 **Screen vision** — Screenshot capture + multimodal vision analysis
- ⚡ **Live activity** — Real-time telemetry feed of what JARVIS is doing
- 🔒 **Safety approvals** — Built-in proactive approval queue for sensitive actions
- 🧠 **Local AI** — Ollama (`llama3.2`, `deepseek-r1`, `qwen2.5`) with zero cloud lock-in

---

## Prerequisites

| Requirement | Download |
|---|---|
| Python 3.10+ | https://python.org |
| Node.js 18+ | https://nodejs.org |
| Ollama | https://ollama.ai/download |

---

## Quick Start

### 1. Configure Model Storage & Pull Models

By default, Ollama stores models in `%USERPROFILE%\.ollama\models`. To store models on a secondary drive (e.g. `D:\ollama\models`):

```powershell
# Set persistent storage path for Ollama models
[System.Environment]::SetEnvironmentVariable('OLLAMA_MODELS', 'D:\ollama\models', 'User')
$env:OLLAMA_MODELS = "D:\ollama\models"
```

Start the Ollama daemon and pull the models:

```bash
# Start Ollama
ollama serve

# Fast, low-latency assistant model (default)
ollama pull llama3.2

# Reasoning & deep analysis model (optional)
ollama pull deepseek-r1:7b
```

### 2. Launch JARVIS

**Option A — One-click launcher:**
```
Double-click: START_JARVIS.bat
```

**Option B — Manual (two terminals):**

Terminal 1 — Backend:
```bash
cd backend
start_backend.bat
```

Terminal 2 — Frontend:
```bash
cd frontend
start_frontend.bat
```

### 3. Open your browser
Go to: **http://localhost:5173**

---

## Project Structure

```
jarvis/
├── START_JARVIS.bat          # One-click launcher
├── README.md
│
├── backend/
│   ├── main.py               # FastAPI server + REST + WebSocket
│   ├── jarvis_core.py        # Central orchestrator
│   ├── ollama_client.py      # AI brain (Ollama)
│   ├── desktop_controller.py # Windows control (PyAutoGUI)
│   ├── speech_engine.py      # STT (Whisper) + TTS (Piper/SAPI)
│   ├── ws_manager.py         # WebSocket broadcast manager
│   ├── database.py           # SQLite local memory
│   ├── config.py             # Settings
│   ├── requirements.txt
│   └── start_backend.bat
│
└── frontend/
    ├── src/
    │   ├── App.tsx            # Main layout
    │   ├── store/
    │   │   └── useJarvisStore.ts   # Zustand state
    │   ├── hooks/
    │   │   └── useWebSocket.ts     # WS connection
    │   └── components/
    │       ├── Header.tsx          # Top bar
    │       ├── JarvisOrb.tsx       # Animated status orb
    │       ├── ChatPanel.tsx       # Chat interface
    │       ├── VoiceControlPanel.tsx
    │       ├── ActivityPanel.tsx   # Live activity feed
    │       ├── ScreenPreviewPanel.tsx
    │       ├── ApprovalPanel.tsx   # Action approval
    │       └── SettingsPanel.tsx
    └── start_frontend.bat
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Animations | Framer Motion |
| Backend | Python + FastAPI |
| Local AI | Ollama (`llama3.2` default, `deepseek-r1:7b` reasoning) |
| Wake Word | openwakeword ("Hey Jarvis" detection) |
| Speech STT | faster-whisper (CPU, int8) |
| Speech TTS | Windows SAPI (`pyttsx3`) / Piper TTS |
| Desktop control | PyAutoGUI + pywinauto |
| Live updates | WebSockets |
| Memory | SQLite (`jarvis.db`) |

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Backend status & connected services |
| `/command` | POST | Send text command to JARVIS |
| `/listen` | POST | Start push-to-talk |
| `/stop` | POST | Stop current action |
| `/screenshot` | POST | Take + analyze screenshot |
| `/approve` | POST | Approve/deny action |
| `/history` | GET | Conversation history |
| `/activity` | GET | Activity log |
| `/approvals` | GET | Pending approvals |
| `/settings` | GET/POST | Read/write settings |
| `/models` | GET | Available Ollama models |
| `/ws` | WS | Real-time WebSocket event bus |

---

## Voice Setup & Wake Word

- **Wake Word**: Continuous background detection using `openwakeword`. Say **"Hey Jarvis"** to wake JARVIS up.
- **STT**: `faster-whisper` (`base` model, int8 quantization on CPU for low latency).
- **TTS**: Windows SAPI (`pyttsx3`) built-in fallback. Optionally place [Piper](https://github.com/rhasspy/piper/releases) in `backend/piper/` for neural TTS.

---

## Hotkeys (global, even when browser isn't focused)

| Key | Action |
|---|---|
| `Ctrl+Shift+Space` | Push-to-talk |
| `Ctrl+Shift+X` | Stop / cancel |

Configure in Settings panel or `backend/config.py`.

---

---

## Browser vs. Native Desktop App FAQ

**Does JARVIS need to be a native desktop app to work effectively?**
**No.** Here is how the architecture operates:
- **Presentation Layer (Frontend):** Runs in your browser (React 19 + Vite at `http://localhost:5173`) providing the HUD, visual waveforms, telemetry, chat logs, and approval buttons.
- **Control & Automation Engine (Backend):** Runs as a native Python process (`FastAPI`) directly on your Windows host. It uses `pyautogui`, `pyperclip`, `Pillow`, `subprocess`, and Windows Win32 APIs.
- Because the backend is running directly on Windows with full user privileges, it has complete access to your desktop: clicking anywhere, reading the screen, launching software, switching windows, and typing text. Running the UI in Chrome or Edge does not restrict backend desktop control in any way.
*(Optional: If you ever prefer a borderless window, system tray icon, or always-on-top HUD, the frontend can be packaged with Electron or Tauri, but functionality remains identical).*

---

## Desktop Automation & Notepad Integration

Whenever you ask JARVIS to:
- Show an example or algorithm (e.g., *"give me an example of bubble sort"* or *"show me quick sort"*),
- Write code, scripts, or templates,
- Demonstrate a program,

JARVIS automatically:
1. Spawns a clean instance of **Notepad** (`open_app("notepad")`).
2. Pauses to allow Windows to initialize the editor canvas.
3. Injects the complete formatted code directly into Notepad using clipboard pasting (`write_notepad`).
4. Confirms completion with voice output.

---

## Hardware Recommendations

| Component | Minimum | Recommended |
|---|---|---|
| CPU | Any x64 | Ryzen 7+ |
| RAM | 16GB | 32GB |
| GPU | Any | RTX 4060+ (8GB VRAM) |
| GPU VRAM | — | 8GB for 7B models |
| Storage | 20GB | 50GB+ (for models) |

---

## Troubleshooting

**"AI error: All connection attempts failed" or "Backend online — Ollama: X":**
- Ollama is stopped. Start it via `ollama serve`.
- Ensure the port `11434` is active.

**Frontend isn't online (Port 5173 unreachable):**
- Start the Vite development server:
  ```bash
  cd frontend
  npm run dev -- --host 127.0.0.1 --port 5173
  ```

**Moving Ollama Models to D: Drive:**
- Set user environment variable:
  ```powershell
  [System.Environment]::SetEnvironmentVariable('OLLAMA_MODELS', 'D:\ollama\models', 'User')
  ```
- Copy existing models over to `D:\ollama\models`.

**OpenWakeWord Model Not Found (`hey_jarvis_v0.1.onnx`):**
- Download missing official models into virtual environment:
  ```powershell
  & ".\venv\Scripts\python.exe" -c "import openwakeword.utils; openwakeword.utils.download_models()"
  ```

**HuggingFace Symlink Warning on Windows:**
- Set `HF_HUB_DISABLE_SYMLINKS_WARNING=1` in `backend/.env`.
- Ensure `config.py` Pydantic Settings includes `extra = "ignore"`.
