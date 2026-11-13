"""JARVIS Configuration"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b"
    ollama_vision_model: str = "llava:7b"

    # Whisper (speech-to-text)
    whisper_model_size: str = "base"  # tiny, base, small, medium, large
    whisper_device: str = "cuda"     # cuda or cpu
    whisper_compute_type: str = "float16"

    # Piper TTS
    piper_model: str = "en_US-lessac-medium"
    piper_speed: float = 1.0

    # Wake word
    wake_word: str = "jarvis"
    wake_word_sensitivity: float = 0.7

    # Hotkeys
    push_to_talk_key: str = "ctrl+shift+space"
    stop_key: str = "ctrl+shift+x"

    # Safety
    require_approval_for_sensitive: bool = True
    sensitive_actions: list = ["delete", "send_email", "install", "format", "rm", "shutdown"]

    # Database
    db_path: str = "jarvis.db"

    # Screenshots
    screenshot_interval: float = 2.0   # seconds between auto screenshots
    max_screenshot_history: int = 10

    # Logging
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        env_prefix = "JARVIS_"
        extra = "ignore"


settings = Settings()
