"""Speech engine: openwakeword wake-word detection + faster-whisper STT + Piper/SAPI TTS"""
import asyncio
import threading
import time
import tempfile
import os
from typing import Optional, Callable
from pathlib import Path

try:
    import sounddevice as sd
    import numpy as np
    AUDIO_AVAILABLE = True
except ImportError:
    AUDIO_AVAILABLE = False

try:
    from faster_whisper import WhisperModel
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False

try:
    from openwakeword.model import Model as OWWModel
    OPENWAKEWORD_AVAILABLE = True
except ImportError:
    OPENWAKEWORD_AVAILABLE = False

from config import settings
from database import log_activity


WAKE_WORD_MODEL = "hey_jarvis"   # Built-in openwakeword model
SAMPLE_RATE     = 16000
OWW_CHUNK       = 1280           # 80 ms — required by openwakeword
WAKE_THRESHOLD  = 0.5


class SpeechEngine:
    """Manages wake-word detection, microphone input, STT, and TTS."""

    def __init__(self):
        self.whisper_model: Optional[object] = None
        self._oww_model: Optional[object] = None
        self._initialized = False
        self._oww_initialized = False

        self.is_listening = False
        self.is_recording = False
        self._audio_buffer = []
        self._stop_recording = threading.Event()

        # Wake word loop control
        self._wake_loop_thread: Optional[threading.Thread] = None
        self._wake_loop_running = False
        self._on_wake_callback: Optional[Callable] = None   # async callable
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    # -------------------------------------------------------------------------
    # Initialisation
    # -------------------------------------------------------------------------
    def initialize(self):
        """Load Whisper model (call once at startup — runs in background thread)."""
        if self._initialized:
            return
        if WHISPER_AVAILABLE:
            try:
                log_activity("system", "Loading Whisper model...", {"model": settings.whisper_model_size})
                self.whisper_model = WhisperModel(
                    settings.whisper_model_size,
                    device=settings.whisper_device,
                    compute_type=settings.whisper_compute_type
                )
                log_activity("system", "Whisper model loaded ✓", {})
                self._initialized = True
            except Exception as e:
                log_activity("error", f"Failed to load Whisper: {e}", {})
        else:
            log_activity("warning", "faster-whisper not installed — STT disabled", {})

    def initialize_wake_word(self):
        """Load openwakeword 'hey_jarvis' model."""
        if self._oww_initialized:
            return
        if not OPENWAKEWORD_AVAILABLE:
            log_activity("warning", "openwakeword not installed — wake word disabled", {})
            return
        try:
            log_activity("system", "Loading openwakeword hey_jarvis model...", {})
            # Downloads the model on first run (~2 MB)
            self._oww_model = OWWModel(
                wakeword_models=[WAKE_WORD_MODEL],
                inference_framework="onnx"
            )
            log_activity("system", "Wake word model loaded ✓", {})
            self._oww_initialized = True
        except Exception as e:
            log_activity("error", f"Failed to load wake word model: {e}", {})

    # -------------------------------------------------------------------------
    # Wake word detection loop
    # -------------------------------------------------------------------------
    def start_wake_word_loop(self, async_callback: Callable, loop: asyncio.AbstractEventLoop):
        """
        Start continuous background wake-word detection.
        When 'hey jarvis' is heard, async_callback() is scheduled on `loop`.
        """
        if not AUDIO_AVAILABLE or not self._oww_initialized:
            log_activity("warning", "Wake word loop not started (audio or model unavailable)", {})
            return

        self._on_wake_callback = async_callback
        self._loop = loop
        self._wake_loop_running = True
        self._wake_loop_thread = threading.Thread(
            target=self._wake_loop_sync,
            daemon=True,
            name="jarvis-wake-word"
        )
        self._wake_loop_thread.start()
        log_activity("system", f"Wake word loop started — say '{WAKE_WORD_MODEL.replace('_', ' ')}'", {})

    def stop_wake_word_loop(self):
        self._wake_loop_running = False

    def _wake_loop_sync(self):
        """Blocking mic loop — runs in its own thread."""
        if not AUDIO_AVAILABLE:
            return

        cooldown_until = 0.0   # prevent double-triggers

        try:
            with sd.InputStream(
                samplerate=SAMPLE_RATE,
                channels=1,
                dtype="int16",
                blocksize=OWW_CHUNK
            ) as stream:
                log_activity("system", "Microphone open for wake word detection", {})
                while self._wake_loop_running:
                    chunk, _ = stream.read(OWW_CHUNK)
                    audio_int16 = chunk.flatten()

                    prediction = self._oww_model.predict(audio_int16)
                    score = prediction.get(WAKE_WORD_MODEL, 0.0)

                    if score >= WAKE_THRESHOLD and time.time() > cooldown_until:
                        cooldown_until = time.time() + 3.0   # 3-second cooldown
                        log_activity("voice", f"Wake word detected! (score={score:.2f})", {})
                        # Schedule the async callback on the event loop
                        if self._loop and self._on_wake_callback:
                            asyncio.run_coroutine_threadsafe(
                                self._on_wake_callback(), self._loop
                            )
        except Exception as e:
            log_activity("error", f"Wake word loop crashed: {e}", {})

    # -------------------------------------------------------------------------
    # STT helpers
    # -------------------------------------------------------------------------
    async def record_until_silence(
        self,
        silence_threshold: float = 0.01,
        silence_duration: float = 1.5,
        max_duration: float = 30.0
    ) -> Optional["np.ndarray"]:
        """Record audio until silence is detected. Returns numpy array."""
        if not AUDIO_AVAILABLE:
            return None

        self.is_recording = True
        self._stop_recording.clear()
        loop = asyncio.get_event_loop()
        audio_data = await loop.run_in_executor(
            None, self._record_audio_sync, silence_threshold, silence_duration, max_duration
        )
        self.is_recording = False
        return audio_data

    def _record_audio_sync(self, silence_threshold, silence_duration, max_duration):
        if not AUDIO_AVAILABLE:
            return None

        audio_chunks = []
        silent_chunks = 0
        chunks_per_second = 10
        chunk_size = SAMPLE_RATE // chunks_per_second
        silence_chunks_needed = int(silence_duration * chunks_per_second)
        max_chunks = int(max_duration * chunks_per_second)
        started_speaking = False

        with sd.InputStream(
            samplerate=SAMPLE_RATE, channels=1,
            dtype="float32", blocksize=chunk_size
        ) as stream:
            for _ in range(max_chunks):
                if self._stop_recording.is_set():
                    break
                chunk, _ = stream.read(chunk_size)
                audio_chunks.append(chunk)
                rms = float(np.sqrt(np.mean(chunk ** 2)))

                if rms > silence_threshold:
                    started_speaking = True
                    silent_chunks = 0
                elif started_speaking:
                    silent_chunks += 1
                    if silent_chunks >= silence_chunks_needed:
                        break

        if not audio_chunks:
            return None
        return np.concatenate(audio_chunks, axis=0).flatten()

    async def transcribe(self, audio: "np.ndarray") -> Optional[str]:
        if not WHISPER_AVAILABLE or self.whisper_model is None:
            return None
        if audio is None or len(audio) == 0:
            return None
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._transcribe_sync, audio)

    def _transcribe_sync(self, audio: "np.ndarray") -> Optional[str]:
        try:
            segments, _ = self.whisper_model.transcribe(audio, beam_size=5, language="en")
            text = " ".join(seg.text for seg in segments).strip()
            return text if text else None
        except Exception as e:
            log_activity("error", f"Transcription failed: {e}", {})
            return None

    # -------------------------------------------------------------------------
    # TTS helpers
    # -------------------------------------------------------------------------
    async def speak(self, text: str) -> bool:
        """Speak text via Piper TTS or Windows SAPI fallback."""
        if not text:
            return False
        try:
            piper_exe = Path("piper") / "piper.exe"
            model_path = Path("piper") / f"{settings.piper_model}.onnx"
            if piper_exe.exists() and model_path.exists():
                return await self._speak_piper(text, piper_exe, model_path)
            else:
                return await self._speak_sapi(text)
        except Exception as e:
            log_activity("error", f"TTS failed: {e}", {})
            return False

    async def _speak_piper(self, text: str, piper_exe: Path, model: Path) -> bool:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            wav_path = f.name
        try:
            proc = await asyncio.create_subprocess_exec(
                str(piper_exe), "--model", str(model), "--output_file", wav_path,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await proc.communicate(input=text.encode())
            import soundfile as sf
            data, rate = sf.read(wav_path)
            sd.play(data, rate)
            sd.wait()
            return True
        finally:
            try:
                os.unlink(wav_path)
            except Exception:
                pass

    async def _speak_sapi(self, text: str) -> bool:
        """Windows SAPI TTS via PowerShell (no extra dependencies)."""
        safe = text.replace('"', '').replace("'", "").replace('\n', ' ')
        script = (
            'Add-Type -AssemblyName System.Speech; '
            '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; '
            f'$s.Rate = 1; $s.Speak("{safe}")'
        )
        proc = await asyncio.create_subprocess_exec(
            "powershell", "-Command", script,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL
        )
        await proc.wait()
        return True

    async def stop_listening(self):
        self._stop_recording.set()
        self.is_listening = False


# Singleton
_speech = SpeechEngine()


def get_speech() -> SpeechEngine:
    return _speech
