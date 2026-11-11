import time
from collections import defaultdict, deque
from fastapi import HTTPException, status


class LoginRateLimiter:
    """Limita intentos fallidos de login por clave (IP + usuario) en una ventana de tiempo."""

    def __init__(self, max_attempts: int = 5, window_seconds: int = 900):
        self.max_attempts = max_attempts
        self.window = window_seconds
        self._failures: dict[str, deque[float]] = defaultdict(deque)

    def _prune(self, key: str) -> deque[float]:
        attempts = self._failures[key]
        cutoff = time.monotonic() - self.window
        while attempts and attempts[0] < cutoff:
            attempts.popleft()
        if not attempts:
            self._failures.pop(key, None)
            return deque()
        return attempts

    def check(self, key: str) -> None:
        attempts = self._prune(key)
        if len(attempts) >= self.max_attempts:
            retry_after = int(self.window - (time.monotonic() - attempts[0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos fallidos. Intenta de nuevo más tarde.",
                headers={"Retry-After": str(retry_after)},
            )

    def register_failure(self, key: str) -> None:
        self._failures[key].append(time.monotonic())

    def reset(self, key: str) -> None:
        self._failures.pop(key, None)


login_limiter = LoginRateLimiter()
