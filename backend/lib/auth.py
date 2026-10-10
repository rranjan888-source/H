"""Cookie-based JWT auth."""

import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request
from passlib.context import CryptContext

from lib.db import db

COOKIE = "gc_session"
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
_SECRET = os.environ["JWT_SECRET"]


def hash_password(pw: str) -> str:
    return _pwd.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return _pwd.verify(pw, hashed)
    except Exception:
        return False


def make_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=7)
    return jwt.encode({"sub": user_id, "exp": exp}, _SECRET, algorithm="HS256")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, _SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user
