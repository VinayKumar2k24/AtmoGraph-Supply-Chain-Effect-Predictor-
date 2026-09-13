"""
AtmoGraph - Authentication Service
Handles password hashing with bcrypt, JWT token lifecycle, and user session verification.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import bcrypt
import jwt
from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from backend.app.database.auth_db import (
    get_user_by_email,
    get_user_by_id,
    create_user,
    init_auth_db,
)

# JWT Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "atmograph-production-secret-token-key-2026-enterprise")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7
COOKIE_NAME = "atmograph_token"

security_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt with salt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT token with claims and expiration."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)

    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a signed JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None


def seed_demo_user() -> None:
    """Ensure a default enterprise demo user exists for seamless testing and demonstration."""
    init_auth_db()
    demo_email = "demo@atmograph.ai"
    existing = get_user_by_email(demo_email)
    if not existing:
        create_user(
            full_name="Enterprise Admin",
            email=demo_email,
            password_hash=hash_password("Password123!"),
            organization="Global Logistics Corp",
        )


def extract_token_from_request(
    request: Request,
    bearer_credentials: Optional[HTTPAuthorizationCredentials] = None,
) -> Optional[str]:
    """
    Extract JWT token with seamless dual fallback:
    1. Check HTTP-only cookie 'atmograph_token'
    2. Check Authorization header 'Bearer <token>'
    """
    # 1. Cookie check
    cookie_token = request.cookies.get(COOKIE_NAME)
    if cookie_token:
        return cookie_token

    # 2. Bearer header check
    if bearer_credentials and bearer_credentials.credentials:
        return bearer_credentials.credentials

    # 3. Direct Authorization header inspection
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1].strip()

    return None


async def get_current_user(
    request: Request,
    bearer: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
) -> Dict[str, Any]:
    """FastAPI dependency to require and return an authenticated user."""
    token = extract_token_from_request(request, bearer)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deactivated. Please contact support.",
        )

    # Return safe user dictionary (no password hash)
    return {
        "id": user["id"],
        "full_name": user["full_name"],
        "email": user["email"],
        "organization": user["organization"],
        "created_at": user["created_at"],
        "last_login": user.get("last_login"),
        "is_active": bool(user["is_active"]),
    }


async def get_optional_user(
    request: Request,
    bearer: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
) -> Optional[Dict[str, Any]]:
    """FastAPI dependency that returns the authenticated user if present, or None without throwing."""
    try:
        return await get_current_user(request, bearer)
    except HTTPException:
        return None
