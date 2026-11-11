"""
Centralized logging setup.
Each domain gets its own file under LOG_DIR with daily rotation (30-day retention).
Files are named {domain}.log and rotate to {domain}.log.YYYY-MM-DD at midnight.

Usage:
    from app.core.logging_config import get_logger
    logger = get_logger("sales")
    logger.info("[SALE_CREATED] sale=%s total=%s", sale_number, total)
"""
import logging
import logging.handlers
from pathlib import Path


_initialized: set[str] = set()

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(funcName)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def setup_logging(log_dir: str = "logs") -> None:
    """Call once at app startup to configure the root logger and create the log directory."""
    Path(log_dir).mkdir(exist_ok=True)

    root = logging.getLogger()
    if root.handlers:
        return

    root.setLevel(logging.INFO)
    console = logging.StreamHandler()
    console.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
    root.addHandler(console)


def get_logger(name: str, log_dir: str = "logs") -> logging.Logger:
    """
    Returns a logger named `app.{name}` backed by logs/{name}.log.
    Rotates at midnight UTC, retains 30 daily files.
    Also writes to console so `docker logs` shows app events.
    """
    full_name = f"app.{name}"
    logger = logging.getLogger(full_name)

    if name in _initialized:
        return logger

    _initialized.add(name)
    logger.setLevel(logging.DEBUG)
    logger.propagate = False  # prevent double-printing via root

    formatter = logging.Formatter(LOG_FORMAT, DATE_FORMAT)
    log_path = Path(log_dir)
    log_path.mkdir(exist_ok=True)

    # --- Daily rotating file ---
    fh = logging.handlers.TimedRotatingFileHandler(
        filename=log_path / f"{name}.log",
        when="midnight",
        interval=1,
        backupCount=30,
        encoding="utf-8",
        utc=True,
    )
    fh.suffix = "%Y-%m-%d"
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(formatter)
    logger.addHandler(fh)

    # --- Console (visible in `docker logs`) ---
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    ch.setFormatter(formatter)
    logger.addHandler(ch)

    return logger
