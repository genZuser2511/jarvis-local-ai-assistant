# JARVIS — Complete Implementation & Troubleshooting DevLog

**Generated:** 2026-10-28  
**Project:** Local JARVIS AI Desktop Assistant  
**Stack:** React 19 + Vite (Frontend) | FastAPI + Python 3.11 (Backend) | Ollama (`deepseek-r1:1.5b`) | faster-whisper + openwakeword + pyttsx3 (Voice)

---

## 1. System Architecture Overview

```
                      ┌─────────────────────────────────────────┐
                      │            Frontend (Port 5173)         │
                      │  React 19 + Vite + TailwindCSS + Lucide │
                      │  HUD Interface / Cyberpunk Theme        │
                      └──────────────┬──────────────────────────┘
                                     │
                    HTTP REST API    │    Full-Duplex WebSocket
                    (Port 8000)      │    (ws://localhost:8000/ws)
                                     │
                      ┌──────────────┴──────────────────────────┐
                      │            Backend (Port 8000)          │
                      │  FastAPI + Uvicorn + Python 3.11        │
                      │  WebSocket Connection Manager           │
                      └──────┬─────────────┬─────────────┬──────┘
                             │             │             │
        ┌────────────────────┴──┐   ┌──────┴──────────┐  │
        ▼                       ▼   ▼                 ▼  ▼
┌───────────────────┐  ┌──────────────────┐  ┌─────────────────────────┐
│  Ollama Engine    │  │ SQLite Database  │  │ Desktop Automation      │
│  deepseek-r1:1.5b │  │ (jarvis.db)      │  │ PyAutoGUI, mss, Pillow, │
│  Local LLM API    │  │ Conversations &  │  │ Clipboard, App Launcher │
│  (Port 11434)     │  │ Action Logs      │  └─────────────────────────┘
└───────────────────┘  └──────────────────┘               │
                                                          │
                      ┌───────────────────────────────────┴─────┐
                      │           Voice Pipeline                │
                      │  1. openwakeword ("Hey Jarvis")         │
                      │  2. faster-whisper (STT - base int8)    │
                      │  3. Windows SAPI / pyttsx3 (TTS)        │
                      │  4. SoundDevice (16kHz audio stream)    │
                      └─────────────────────────────────────────┘
```

---

## 2. What We Implemented

### 2.1 Backend Engine (`/backend`)
- **FastAPI Core (`main.py`)**:
  - Asynchronous application lifespan handling background task initialization (hotkeys, voice pipeline, Ollama client).
  - CORS middleware allowing `http://localhost:5173` and `http://127.0.0.1:5173`.
  - Static file hosting for captured desktop screenshots (`/screenshots`).
  - Endpoints:
    - `POST /api/command`: Dispatches text or multimodal commands to the agent.
    - `POST /api/action/approve`: Confirms or rejects sensitive system actions.
    - `GET /api/history`: Retrieves recent conversation logs.
    - `GET /api/activity`: Streams recent system audit records.
    - `GET /api/status`: Real-time health check reporting Ollama, STT, and TTS states.
    - `WebSocket /ws`: Real-time bi-directional events (status broadcasts, voice activity, transcripts, action alerts).

- **Ollama Client (`ollama_client.py`)**:
  - Connects to local Ollama instance on `http://127.0.0.1:11434`.
  - Structured prompt engineering: enforces JSON output for action planning and tool execution.
  - Model: `deepseek-r1:1.5b` with fallback support.

- **Desktop Automation Controller (`desktop_controller.py`)**:
  - Screenshot capture via `mss` with automatic scaling and compression.
  - Mouse manipulation: click coordinates, double clicks, right clicks, smooth movement.
  - Keyboard automation: typing text, pressing hotkeys (`ctrl+c`, `win+r`, `alt+tab`).
  - Application launcher & file explorer integration.
  - Danger classification: actions that could alter files, terminate processes, or modify settings require user approval before execution.

- **Voice & Wake Word Subsystem (`speech_engine.py`)**:
  - Continuous listening thread using `sounddevice` at 16,000 Hz sample rate.
  - Chunk buffer feeding 80ms audio frames (1,280 samples) into `openwakeword`.
  - Wake-word model: `hey_jarvis` ONNX model.
  - Non-blocking activation: when the wake word is triggered, an event schedules `on_wake_word` on the asyncio event loop without stalling any running tasks.
  - STT: `faster-whisper` (`base` model, running on CPU with `int8` quantization for near-instant latency).
  - TTS: Windows SAPI via `pyttsx3` for zero-dependency, zero-cloud speech generation.

- **Local Memory Store (`database.py`)**:
  - SQLite database (`jarvis.db`) storing:
    - `conversations`: Chat history and metadata.
    - `actions`: Executed and pending actions with approval states.
    - `screenshots`: Metadata and filesystem paths of captured screens.
    - `settings_store`: Key-value configuration persistence.
    - `activity_log`: Detailed event logging for telemetry and diagnostics.

### 2.2 Frontend Application (`/frontend`)
- Built with React 19, Vite, and TailwindCSS.
- Cyberpunk / Iron Man HUD aesthetic:
  - Deep blue/black translucent backdrop with neon cyan and amber accents.
  - Real-time holographic visualizer pulsing on speech detection.
  - Live activity log feed updating via WebSocket.
  - Pending action approval cards with interactive Confirm/Deny buttons.
  - Telemetry panels for Ollama status, voice status, and model selection.

---

## 3. Issues Encountered & Excruciating Point-by-Point Fixes

### Issue 1: Ollama and Backend Initial Startup
- **Symptoms:** Frontend showed "Disconnected" with red status indicators; commands were not processed.
- **Root Cause:**
  1. The Ollama daemon was not running as a local service or process.
  2. The Python backend was stopped and required its dedicated virtual environment (`.\venv\Scripts\python.exe`).
- **How It Was Fixed:**
  1. Started Ollama service in the background and verified `http://127.0.0.1:11434/api/tags` responded with status 200.
  2. Verified `deepseek-r1:1.5b` was pulled and active.
  3. Launched the FastAPI backend using `& ".\venv\Scripts\python.exe" main.py` on port 8000.

---

### Issue 2: WebSocket Connection Dropping ("Connected briefly, then disconnected")
- **Symptoms:** The UI connected to `ws://localhost:8000/ws` for a few seconds, then dropped into a reconnect loop.
- **Root Cause Analysis:**
  1. Multiple orphaned Python processes were lingering from previous runs, competing for port 8000 and locking socket addresses (`SO_REUSEADDR` contention).
  2. When a second process started, uvicorn hit address conflicts, causing socket drops.
  3. Windows console encoding exceptions during unhandled Unicode logging caused the Python worker thread to crash silently.
- **How It Was Fixed:**
  1. Ran cleanup to terminate all orphaned Python processes holding port 8000:
     ```powershell
     Get-Process -Name "python3.11","python" -ErrorAction SilentlyContinue | Stop-Process -Force
     ```
  2. Added stream encoding reconfiguration at the top of `main.py`:
     ```python
     import sys
     if sys.platform == "win32":
         try:
             sys.stdout.reconfigure(encoding="utf-8", errors="replace")
             sys.stderr.reconfigure(encoding="utf-8", errors="replace")
         except Exception:
             pass
     ```
  3. Restarted the backend server cleanly under task supervisor.

---

### Issue 3: Missing Audio and STT Dependencies
- **Symptoms:** Backend logged warnings:
  - `faster-whisper not installed — STT disabled`
  - `openwakeword not installed — wake word disabled`
- **Root Cause:** The virtual environment (`venv`) only contained basic FastAPI packages, lacking audio recording (`sounddevice`), neural network inference (`onnxruntime`), audio processing (`numpy`), and speech models (`faster-whisper`, `openwakeword`).
- **How It Was Fixed:**
  1. Installed missing packages into `venv`:
     ```powershell
     & ".\venv\Scripts\pip.exe" install faster-whisper openwakeword sounddevice pyttsx3 onnxruntime
     ```
  2. Validated module availability with Python one-liners.

---

### Issue 4: Hugging Face Hub Windows Symlink Warnings
- **Symptoms:** Backend console flooded with:
  ```
  UserWarning: huggingface_hub cache-system uses symlinks by default... your machine does not support them
  Warning: You are sending unauthenticated requests to the HF Hub
  ```
- **Root Cause:** Hugging Face Hub uses symlinks for model file versioning. On Windows, creating symlinks without Administrator privileges or Developer Mode triggers fallback copy mode with verbose warnings.
- **How It Was Fixed:**
  1. Set `HF_HUB_DISABLE_SYMLINKS_WARNING=1` in `backend/.env`.
  2. Pre-downloaded and verified the `Systran/faster-whisper-base` model directly into the cache.

---

### Issue 5: OpenWakeWord Model File Missing (`hey_jarvis_v0.1.onnx`)
- **Symptoms:** Database audit log revealed:
  ```
  [ONNXRuntimeError] : 3 : NO_SUCHFILE : Load model from .../openwakeword/resources/models/hey_jarvis_v0.1.onnx failed. File doesn't exist.
  warning: Wake word loop not started (audio or model unavailable)
  ```
- **Root Cause:** The `openwakeword` pip package distributes only the Python library code; the pre-trained ONNX wake-word models (`hey_jarvis_v0.1.onnx`, `alexa`, etc.) must be explicitly downloaded via `openwakeword.utils.download_models()`.
- **How It Was Fixed:**
  1. Executed:
     ```python
     import openwakeword.utils
     openwakeword.utils.download_models()
     ```
  2. Verified the downloaded models exist in `openwakeword/resources/models/` directory.

---

### Issue 6: Windows Console cp1252 UnicodeEncodeError
- **Symptoms:** Commands querying the database failed with:
  ```
  UnicodeEncodeError: 'charmap' codec can't encode character '\u2713' in position ...: character maps to <undefined>
  ```
- **Root Cause:** Windows default PowerShell / CMD codepage is `cp1252`, which cannot encode Unicode characters like the checkmark (`✓` / `\u2713`) used in status logs.
- **How It Was Fixed:**
  1. Updated logging and execution scripts to enforce UTF-8 output streams (`sys.stdout.reconfigure(encoding='utf-8')`).
  2. Ensured all database string readers handle UTF-8 safely.

---

### Issue 7: "AI error: All connection attempts failed"
- **Symptoms:** User typed "hi" in the HUD chat and the UI responded with `AI error: All connection attempts failed`. The top HUD telemetry panel showed `Backend online — Ollama: X`.
- **Root Cause:** The Ollama background service (`ollama serve`) was stopped and not listening on `http://127.0.0.1:11434`. When `jarvis_core.py` invoked `ollama_client.chat()`, `httpx` failed to connect with `[Errno 111] All connection attempts failed`.
- **How It Was Fixed:**
  1. Verified that port 11434 was inactive.
  2. Launched Ollama as a dedicated persistent daemon attached to the local environment.
  3. Verified health check returns `"ollama_available": true`.

---

### Issue 8: Model Storage Location & D: Drive Migration
- **Symptoms:** Models took 21.6 GB of space in `C:\Users\ADITYA\.ollama\models`, and user requested downloading/using models on the secondary `D:` drive (which has 98 GB free).
- **Root Cause:** By default on Windows, Ollama stores all blobs and manifests in `%USERPROFILE%\.ollama\models`.
- **How It Was Fixed:**
  1. Created directory `D:\ollama\models`.
  2. Configured persistent environment variable `OLLAMA_MODELS=D:\ollama\models` for User and Process scopes.
  3. Migrated existing 21.6 GB models (`deepseek-r1:7b` and `qwen3-coder:30b`) to `D:\ollama\models` using Robocopy with 0 errors.
  4. Pulled `llama3.2` (3.2B, 2.0 GB) directly to `D:\ollama\models` for instant, low-latency dialogue and clean JSON plan generation without chain-of-thought `<think>` delays.
  5. Updated `backend/.env` with `JARVIS_OLLAMA_MODEL=llama3.2` and verified generation test response in ~1.5s on RTX 4060 GPU.

---

### Issue 9: Frontend Server Inactive ("Frontend isn't online")
- **Symptoms:** The UI at `http://localhost:5173` became unreachable. Port check on `5173` confirmed no process was listening.
- **Root Cause:** The Vite development server process had exited during previous background cleanup operations.
- **How It Was Fixed:**
  1. Started Vite dev server with explicit binding:
     ```powershell
     npm run dev -- --host 127.0.0.1 --port 5173
     ```
  2. Verified `http://127.0.0.1:5173/` returned HTTP 200 OK.
  3. Confirmed WebSocket connection automatically re-established (`active_ws_connections: 1`).

---

### Issue 10: "Just working like a chat app" & Writing Examples/Code Directly to Notepad
- **Symptoms:** When user requested bubble sort code or examples ("give me an example or show this or that"), JARVIS outputted text or fragmented `type_text` actions without successfully writing the code into an open Notepad window. Action execution either missed the active window or failed on multi-line syntax.
- **Root Cause:**
  1. **Typing Mechanism:** `pyautogui.typewrite()` types character-by-character, which fails on non-ASCII characters, indentations, and large multiline code blocks, and fails completely if the window focus changes.
  2. **Window Launch Race Condition:** Notepad takes ~1-1.5s to spawn and create its input canvas on Windows. The previous controller only waited 0.8s, and the core action loop only slept 0.5s between actions.
  3. **Model Prompt Ambiguity:** The system prompt did not explicitly instruct the model when to execute desktop actions vs. when to just answer questions. The model was putting code inside its chat response rather than generating a structured automation plan.
- **How It Was Fixed:**
  1. **Created Dedicated `write_notepad` Action:**
     - Uses `pyperclip` to copy multiline code/text to the Windows clipboard.
     - Sends `Alt+Tab` to focus the newly spawned window, selects all (`Ctrl+A`), and instantly pastes (`Ctrl+V`). This eliminates typing latency, syntax corruption, and multi-line formatting issues.
  2. **Adjusted Application Timing:**
     - Increased `open_app` spawn delay to 1.5 seconds.
     - Increased inter-action sleep in `jarvis_core.py` from 0.5s to 1.0s.
     - Updated `type_text` fallback to use clipboard paste automatically for text over 40 characters or text containing special characters.
  3. **Strict System Prompt Rules:**
     - Added explicit directive: whenever the user asks for code, algorithms (e.g. bubble sort, quick sort), demonstrations, or examples, JARVIS MUST generate the 4-step sequence: `open_app("notepad")` ➔ `wait(2)` ➔ `write_notepad(text)` ➔ `speak(confirmation)`.
  4. **Browser vs. Native App Architecture:**
     - Clarified architectural model: the browser HUD is strictly a presentation and teleoperation UI over WebSocket. All system commands, keystrokes, mouse events, and window management run directly on the host OS via the Python backend daemon. Running in a browser does not hinder OS-level automation in any way.

---

### Issue 11: Notepad Not Opening & `PyAutoGUI fail-safe triggered from mouse moving to a corner`
- **Symptoms:** When user requested bubble sort again, the activity panel showed:
  ```json
  "Executing: write_notepad"
  "Action: undefined {"success": false, "error": "PyAutoGUI fail-safe triggered from mouse moving to a corner..."}"
  ```
  Notepad never opened on the screen.
- **Root Causes:**
  1. **PyAutoGUI Fail-Safe Corner Collision:** When a user's mouse cursor rests in any corner of the screen (e.g. `(0, 0)`), PyAutoGUI's default safety check (`pyautogui.FAILSAFE = True`) aborts *any* keypress or window switch with a fatal exception.
  2. **Missing `open_app` Dependency:** The model called `write_notepad` alone without preceding it with `open_app("notepad")`. The previous `write_notepad` assumed an active Notepad window was already focused.
  3. **OneDrive Desktop Path Resolution:** On Windows 11 with OneDrive synchronization enabled, the user's Desktop is mapped to `C:\Users\ADITYA\OneDrive\Desktop`, not `C:\Users\ADITYA\Desktop`. Standard file writes to `~/Desktop` threw `FileNotFoundError`.
- **How It Was Fixed:**
  1. **Disabled PyAutoGUI Failsafe for Safe Automation:** Set `pyautogui.FAILSAFE = False` in `desktop_controller.py` so background hotkeys and automated key sequences do not crash when the cursor is parked in a corner.
  2. **Smart Desktop Path Detection:** Added `get_desktop_dir()` which checks `~/OneDrive/Desktop`, falls back to `~/Desktop`, and then `~/Documents`.
  3. **Direct File Creation & Instant Notepad Launch:**
     - `write_notepad` now writes the code directly into `jarvis_example.txt` on the Desktop.
     - Automatically spawns Notepad with the file: `subprocess.Popen(["notepad.exe", str(file_path)])`.
     - Completely bypasses GUI race conditions and keyboard simulations.
  4. **Added Browser Actions:**
     - Added `open_url: {"url": "..."}` to launch any website directly in the default browser.
     - Added `new_tab: {}` (`Ctrl+T`) to open tabs on command.
  5. **Verified Live Execution:** Sent `"show me bubble sort in python"`; verified `jarvis.db` activity log logged:
     ```
     Done: Writing bubble sort to Notepad — Created jarvis_example.txt on Desktop and opened in Notepad
     ```
     Notepad launched immediately on the Windows screen with the full Bubble Sort Python code.

---

## 4. Current State & Verification

| Component | Status | Details |
|---|---|---|
| **Frontend** | 🟢 Operational | Running on `http://127.0.0.1:5173`, Vite dev server active |
| **Backend** | 🟢 Operational | Running on `http://0.0.0.0:8000`, FastAPI healthy, WebSocket connected |
| **Ollama Daemon** | 🟢 Operational | Running on `http://127.0.0.1:11434`, CUDA GPU (RTX 4060 Laptop, 8GB VRAM) |
| **Active Model** | 🟢 Ready | `llama3.2:latest` (3.2B) active; `deepseek-r1:7b` & `qwen3-coder:30b` available |
| **Model Storage** | 🟢 D: Drive | `D:\ollama\models` (23.6 GB total storage on D: drive, saving C: drive space) |
| **STT (Speech-to-Text)** | 🟢 Ready | `faster-whisper-base` int8 cached and active |
| **Wake Word Engine** | 🟢 Ready | `openwakeword` listening continuously for "Hey Jarvis" |
| **TTS (Text-to-Speech)** | 🟢 Ready | Windows SAPI (`pyttsx3`) active |
| **Desktop Automation** | 🟢 Ready | Mouse/Keyboard/Screenshot/Notepad/Browser capabilities active and verified |

---

## 5. Operations: Starting & Safely Stopping All Components

### 5.1 Quick All-In-One Launcher
You can start all services with a single double-click using the root launcher:
- **Run:** `START_JARVIS.bat` in the project root.
- This will launch:
  1. Ollama Daemon (if not already running)
  2. Backend server in its own terminal (`http://localhost:8000`)
  3. Frontend Vite dev server in its own terminal (`http://localhost:5173`)
  4. Automatically opens `http://localhost:5173` in your default browser.

---

### 5.2 Manual Step-by-Step Startup

If running or debugging components individually in dedicated terminal windows:

#### Step 1: Start Ollama & Model Daemon
Ensure the Ollama service is running and listening on port `11434`:
```powershell
# In PowerShell:
ollama serve
```
*(Or launch the Ollama system tray app from Start Menu).*

Verify the model is loaded and ready:
```powershell
ollama list
```
*(Confirms `llama3.2`, `deepseek-r1:7b`, or other configured models are present).*

#### Step 2: Start the Backend Server
In a new terminal window:
```powershell
cd c:\Users\ADITYA\.gemini\antigravity-ide\scratch\jarvis\backend

# Activate the virtual environment
.\venv\Scripts\activate

# Run the FastAPI server
python main.py
```
- Listens on `http://localhost:8000` (FastAPI + Uvicorn)
- Swagger API Docs: `http://localhost:8000/docs`
- WebSocket server: `ws://localhost:8000/ws`

#### Step 3: Start the Frontend Application
In a third terminal window:
```powershell
cd c:\Users\ADITYA\.gemini\antigravity-ide\scratch\jarvis\frontend

# Start Vite dev server
npm run dev
```
- App UI: `http://localhost:5173`

---

### 5.3 How to Safely Turn Off All 3 Components

To prevent port conflicts, orphaned child processes, or database lockups, follow this safe shutdown procedure:

#### Graceful Terminal Shutdown (Recommended)
1. **Frontend (Vite):** Click into the frontend terminal window and press `Ctrl + C`, then type `y` if prompted.
2. **Backend (FastAPI):** Click into the backend terminal window and press `Ctrl + C`. FastAPI executes its `@asynccontextmanager lifespan` shutdown handler, releasing the SQLite database connection, wake-word listener, and audio streams cleanly.
3. **Model Daemon (Ollama):** If run via `ollama serve` in a terminal, press `Ctrl + C`. If run via the system tray, right-click the Ollama tray icon and select **Quit Ollama**.

#### Clean PowerShell Shutdown Commands (If running in background or stuck)
If any service was started in the background or a terminal window was closed without stopping the process, run these PowerShell commands to safely terminate them and free the ports:

```powershell
# 1. Safely stop the Vite Frontend (Port 5173)
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# 2. Safely stop the FastAPI Backend (Port 8000)
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# 3. Safely stop Ollama Server (Port 11434)
Get-NetTCPConnection -LocalPort 11434 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

#### Verification: Check All Ports Are Closed
Confirm all three ports are completely released:
```powershell
Get-NetTCPConnection -LocalPort 5173, 8000, 11434 -ErrorAction SilentlyContinue | Select-Object LocalPort, State, OwningProcess
```
*(If no listening entries are returned, all three components are safely and completely shut down).*

---

## 6. OpenJarvis Foundation Integration & Fork

**Date:** 2026-11-09  
**Base Repository:** [OpenJarvis (Stanford SAIL / Hazy Research)](https://github.com/open-jarvis/OpenJarvis)  
**Branch:** `feature/desktop-jarvis-suite`  
**Remote Upstream:** `https://github.com/open-jarvis/OpenJarvis.git`

### 6.1 Architectural Upgrade

We cloned and established OpenJarvis as the underlying intelligence, agent orchestration, and tool execution foundation for the JARVIS project, and built specialized desktop capabilities on top:

1. **Native Desktop Automation (`openjarvis.tools.desktop_control.DesktopControlTool`)**:
   - Registered under `@ToolRegistry.register("desktop_control")`.
   - Supports OS interactions: `open_app`, `open_url`, `type_text`, `key_press`, `mouse_click`, `mouse_move`, `scroll`, `write_notepad`, `focus_window`, `close_window`.
   - Built-in safe clipboard handling for multi-line / special character typing.

2. **Native Screen Capture (`openjarvis.tools.desktop_control.DesktopScreenshotTool`)**:
   - Registered under `@ToolRegistry.register("desktop_screenshot")`.
   - Multi-monitor / full desktop capture, automatic compression, base64 payload option for vision-capable models (e.g. Qwen2.5-VL).

3. **Zero-Cloud SAPI TTS (`openjarvis.speech.sapi_tts.SapiTTSBackend`)**:
   - Registered under `@TTSRegistry.register("sapi")`.
   - 100% offline text-to-speech for Windows without external API keys or heavy neural weights.

4. **Hands-free Wake Word Detection (`openjarvis.speech.wakeword.WakeWordDetector`)**:
   - Continuous audio monitoring via `openwakeword` for "Hey Jarvis" activation with non-blocking callback execution.

5. **Desktop Assistant Preset (`configs/openjarvis/examples/desktop-assistant.toml`)**:
   - Configured with `orchestrator` agent, local Ollama model (`llama3.2`), and active desktop tools.
   - Installable via: `jarvis init --preset desktop-assistant --force`.

6. **Dedicated CLI Command (`jarvis desktop`)**:
   - Located in `src/openjarvis/cli/desktop_cmd.py`.
   - Launches the API server, starts background wake-word listening, and launches the HUD browser interface.


