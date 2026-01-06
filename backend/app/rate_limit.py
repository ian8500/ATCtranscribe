from collections import defaultdict
from time import time
from fastapi import HTTPException, status
from .settings import get_settings


settings = get_settings()


class RateLimiter:
    def __init__(self) -> None:
        self.attempts: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> None:
        now = time()
        window = settings.rate_limit_window_seconds
        attempts = [t for t in self.attempts[key] if now - t < window]
        self.attempts[key] = attempts
        if len(attempts) >= settings.rate_limit_max_attempts:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many attempts")
        attempts.append(now)


rate_limiter = RateLimiter()
