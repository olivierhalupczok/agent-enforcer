"""Gateway keys: random secrets given to callers of /a/<agent id>. Only their hash is stored."""

import hashlib
import secrets

KEY_PREFIX = "gk_"


def new_key() -> str:
    return KEY_PREFIX + secrets.token_urlsafe(32)


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()
