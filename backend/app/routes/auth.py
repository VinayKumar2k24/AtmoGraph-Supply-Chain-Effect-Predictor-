"""
AtmoGraph - Authentication Routes
Endpoints for user registration, authentication, session validation, and logout.
"""

import re
from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Response, HTTPException, status, Depends
from pydantic import BaseModel, Field

from backend.app.database.auth_db import (
    get_user_by_email,
    create_user,
    update_last_login,
)
from backend.app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    COOKIE_NAME,
)

router = APIRouter()

EMAIL_REGEX = re.compile(r"^[^@]+@[^@]+\.[^@]+$")


class SignupRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, description="Full Name")
    email: str = Field(..., description="Corporate or Personal Email")
    password: str = Field(..., min_length=8, description="Password (at least 8 characters)")
    organization: Optional[str] = Field(default="Enterprise Logistics", max_length=150)


class LoginRequest(BaseModel):
    email: str = Field(..., description="Registered Email")
    password: str = Field(..., description="Account Password")
    remember_me: Optional[bool] = Field(default=False, description="Extend session duration")


def validate_password_strength(password: str) -> None:
    """Ensure password meets enterprise complexity rules."""
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long.",
        )
    if not any(char.isdigit() for char in password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one numeric digit (0-9).",
        )
    if not any(char.isalpha() for char in password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one letter.",
        )


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, response: Response):
    """Register a new enterprise user account and issue an authenticated session."""
    clean_email = payload.email.strip().lower()
    if not EMAIL_REGEX.match(clean_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid email address.",
        )

    validate_password_strength(payload.password)

    # Check for existing user
    existing = get_user_by_email(clean_email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists. Please sign in instead.",
        )

    # Hash and persist
    pw_hash = hash_password(payload.password)
    new_user = create_user(
        full_name=payload.full_name,
        email=clean_email,
        password_hash=pw_hash,
        organization=payload.organization,
    )

    # Issue JWT Token
    token = create_access_token({
        "sub": new_user["id"],
        "email": new_user["email"],
        "name": new_user["full_name"],
    })

    # Set secure HTTP-only cookie
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        max_age=7 * 24 * 3600,
        samesite="lax",
        path="/",
    )

    return {
        "success": True,
        "message": "Account created successfully.",
        "user": new_user,
        "access_token": token,
        "token_type": "bearer",
    }


@router.post("/login")
async def login(payload: LoginRequest, response: Response):
    """Authenticate an existing user and issue a secure session."""
    clean_email = payload.email.strip().lower()
    user = get_user_by_email(clean_email)

    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify your credentials.",
        )

    if not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Please contact your system administrator.",
        )

    # Update login timestamp
    update_last_login(user["id"])

    # Duration
    expire_delta = timedelta(days=30 if payload.remember_me else 7)
    token = create_access_token(
        {
            "sub": user["id"],
            "email": user["email"],
            "name": user["full_name"],
        },
        expires_delta=expire_delta,
    )

    # Set secure HTTP-only cookie
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        max_age=int(expire_delta.total_seconds()),
        samesite="lax",
        path="/",
    )

    safe_user = {
        "id": user["id"],
        "full_name": user["full_name"],
        "email": user["email"],
        "organization": user["organization"],
        "created_at": user["created_at"],
        "is_active": bool(user["is_active"]),
    }

    return {
        "success": True,
        "message": "Authentication successful.",
        "user": safe_user,
        "access_token": token,
        "token_type": "bearer",
    }


@router.post("/logout")
async def logout(response: Response):
    """Invalidate session and clear authentication cookie."""
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        samesite="lax",
    )
    return {
        "success": True,
        "message": "Signed out successfully.",
    }


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Retrieve profile and session status for the authenticated user."""
    return {
        "authenticated": True,
        "user": current_user,
    }
