"""Auth (login/logout/me) and team/user management."""

from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import COOKIE, get_current_user, hash_password, make_token, require_admin, verify_password
from lib.db import db
from models.crm import LoginIn, User, UserIn

router = APIRouter()


@router.post("/auth/login", response_model=User)
async def login(body: LoginIn, response: Response):
    doc = await db.users.find_one({"email": body.email.lower().strip()}, {"_id": 0})
    if not doc or not verify_password(body.password, doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    response.set_cookie(COOKIE, make_token(doc["id"]), httponly=True, secure=True, samesite="lax",
                        max_age=7 * 86400, path="/")
    return User(**doc)


@router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.get("/auth/me", response_model=User)
async def me(user: dict = Depends(get_current_user)):
    return User(**user)


@router.get("/users", response_model=list[User], dependencies=[Depends(get_current_user)])
async def list_users():
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("name", 1).to_list(500)


@router.post("/users", response_model=User, dependencies=[Depends(require_admin)])
async def create_user(body: UserIn):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already in use")
    if not body.password:
        raise HTTPException(status_code=400, detail="Password is required")
    user = User(**body.model_dump(exclude={"password", "email"}), email=email)
    await db.users.insert_one({**user.model_dump(), "password_hash": hash_password(body.password)})
    return user


@router.put("/users/{id}", response_model=User, dependencies=[Depends(require_admin)])
async def update_user(id: str, body: UserIn):
    doc = await db.users.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    upd = body.model_dump(exclude={"password"})
    upd["email"] = upd["email"].lower().strip()
    if body.password:
        upd["password_hash"] = hash_password(body.password)
    await db.users.update_one({"id": id}, {"$set": upd})
    return User(**{**doc, **upd})


@router.delete("/users/{id}")
async def delete_user(id: str, admin: dict = Depends(require_admin)):
    if id == admin["id"]:
        raise HTTPException(status_code=400, detail="You cannot delete yourself")
    res = await db.users.delete_one({"id": id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}
