"""Emergent managed email (Resend) — server-side templates only."""

import ipaddress
import logging
import os
import re
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ["EMERGENT_EMAIL_KEY"]
EMAIL_FROM_NAME = os.environ["EMAIL_FROM_NAME"]
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        try:
            code = e.response.json().get("code", "")
        except ValueError:
            code = ""
        if code in ("insufficient_credits", "integration_disabled", "daily_limit_reached"):
            logger.warning(f"Email paused: {code} ({e.response.status_code})")
            raise HTTPException(status_code=503, detail="Email is temporarily unavailable")
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="Failed to send email")
    except Exception as e:
        logger.error(f"Email send error: {e}")
        raise HTTPException(status_code=500, detail="Failed to send email")


def document_email_html(*, greeting_name: str, heading: str, intro: str, rows: list[tuple[str, str]],
                        total: str, link: str | None, link_label: str) -> str:
    rows_html = "".join(
        f'<tr><td style="padding:6px 0;color:#334155">{escape(a)}</td>'
        f'<td style="padding:6px 0;text-align:right;color:#0f172a">{escape(b)}</td></tr>'
        for a, b in rows
    )
    button = (
        f'<p style="margin:24px 0"><a href="{escape(link)}" style="background:#EA580C;color:#ffffff;'
        f'padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">{escape(link_label)}</a></p>'
        if link else ""
    )
    return (
        '<table role="presentation" width="100%" style="background:#F8FAFC"><tr><td style="padding:24px">'
        '<table role="presentation" width="560" style="background:#ffffff;border:1px solid #E2E8F0;'
        'border-radius:12px;font-family:Arial,sans-serif"><tr><td style="background:#0F1A2C;color:#ffffff;'
        f'padding:20px 24px;font-size:20px;font-weight:bold;border-radius:12px 12px 0 0">{escape(EMAIL_FROM_NAME)}</td></tr>'
        f'<tr><td style="padding:24px"><h2 style="margin:0 0 12px;color:#0f172a">{escape(heading)}</h2>'
        f'<p style="color:#334155">Hi {escape(greeting_name)},</p><p style="color:#334155">{escape(intro)}</p>'
        f'<table role="presentation" width="100%" style="border-top:1px solid #E2E8F0;margin-top:12px">{rows_html}'
        f'<tr><td style="padding:10px 0;font-weight:bold;border-top:1px solid #E2E8F0">Total (NZD)</td>'
        f'<td style="padding:10px 0;text-align:right;font-weight:bold;border-top:1px solid #E2E8F0">{escape(total)}</td></tr></table>'
        f'{button}<p style="font-size:12px;color:#94A3B8">Sent by {escape(EMAIL_FROM_NAME)}. '
        'We never ask for your password or card details by email.</p></td></tr></table></td></tr></table>'
    )
