"""Xero integration routes: connect (OAuth), status, full sync, per-record sync."""

import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse

from lib import xero
from lib.auth import get_current_user, require_admin
from lib.common import find_one
from models.crm import Customer, Document, XeroConnectUrl, XeroStatus, XeroSyncResult

router = APIRouter()


def _settings_url(flag: str) -> str:
    return f"{os.environ.get('PUBLIC_APP_URL', '').rstrip('/')}/settings?tab=integrations&xero={flag}"


@router.get("/xero/status", response_model=XeroStatus, dependencies=[Depends(get_current_user)])
async def status():
    conn = await xero.connection() if xero.configured() else None
    return XeroStatus(configured=xero.configured(), connected=bool(conn), tenant_name=(conn or {}).get("tenant_name", ""),
                      connected_at=(conn or {}).get("connected_at"), redirect_uri=xero.redirect_uri(),
                      last_sync=(conn or {}).get("last_sync"))


@router.get("/xero/connect", response_model=XeroConnectUrl, dependencies=[Depends(require_admin)])
async def connect():
    return XeroConnectUrl(url=await xero.auth_url())


@router.get("/xero/callback")
async def callback(code: str = "", state: str = "", error: str = ""):
    if error or not code or not state:
        return RedirectResponse(_settings_url("error"))
    try:
        await xero.complete_auth(code, state)
    except HTTPException:
        return RedirectResponse(_settings_url("error"))
    return RedirectResponse(_settings_url("connected"))


@router.post("/xero/disconnect", dependencies=[Depends(require_admin)])
async def disconnect():
    await xero.disconnect()
    return {"ok": True}


@router.post("/xero/sync", response_model=XeroSyncResult, dependencies=[Depends(require_admin)])
async def sync_all():
    return await xero.sync_all()


@router.post("/xero/customers/{id}/sync", response_model=Customer, dependencies=[Depends(get_current_user)])
async def sync_customer(id: str):
    c = await find_one("customers", id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    await xero.push_customer(c)
    return await find_one("customers", id)


@router.post("/xero/invoices/{id}/sync", response_model=Document, dependencies=[Depends(get_current_user)])
async def sync_invoice(id: str):
    inv = await find_one("documents", id)
    if not inv or inv["kind"] != "invoice":
        raise HTTPException(status_code=404, detail="Invoice not found")
    await xero.push_invoice(inv)
    return await find_one("documents", id)
