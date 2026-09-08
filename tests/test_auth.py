"""Unit tests for JWT authentication, password hashing, and RBAC rules."""

from backend.auth.jwt import create_access_token, verify_token
from backend.auth.routes import hash_password, verify_password


def test_password_hashing_and_verification():
    """Verify bcrypt password hashing and verification."""
    raw_password = "SecurePassword123!"
    hashed = hash_password(raw_password)
    
    assert hashed != raw_password
    assert verify_password(raw_password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_jwt_token_generation_and_verification():
    """Verify JWT access token creation and decoding."""
    payload = {"sub": "user_uuid_12345", "role": "developer", "tenant_id": "openmind_tech"}
    token = create_access_token(payload)

    decoded = verify_token(token)
    assert decoded["sub"] == "user_uuid_12345"
    assert decoded["role"] == "developer"
    assert decoded["tenant_id"] == "openmind_tech"
    assert "exp" in decoded
