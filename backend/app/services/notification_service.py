"""
Sends low-stock alerts via email (Gmail SMTP) and WhatsApp (CallMeBot).
Both channels are fire-and-forget: failures are logged but never propagate to the sale.
Every attempt (success, failed, skipped) is persisted to notification_logs.
"""
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from urllib.parse import quote
import aiosmtplib
import httpx
from app.config import settings
from app.core.logging_config import get_logger

logger = get_logger("notifications", settings.LOG_DIR)


async def _log(
    channel: str,
    status: str,
    recipient: str,
    message: str,
    error: str | None = None,
) -> None:
    try:
        from app.database import AsyncSessionLocal
        from app.models.notification_log import NotificationLog
        async with AsyncSessionLocal() as db:
            db.add(NotificationLog(
                channel=channel,
                status=status,
                recipient=recipient,
                message=message,
                error=error,
            ))
            await db.commit()
    except Exception as exc:
        logger.error("Failed to write notification log: %s", exc)


async def _send_email(
    recipients: list[str],
    subject: str,
    body_html: str,
    log_message: str,
) -> None:
    recipient_str = ", ".join(recipients)

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("[EMAIL_SKIPPED] recipients=%s reason=smtp_not_configured", recipient_str)
        await _log("email", "skipped", recipient_str, log_message, "SMTP_USER o SMTP_PASSWORD no configurados en .env")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_USER
    msg["To"] = recipient_str
    msg.attach(MIMEText(body_html, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info("[EMAIL_SENT] recipients=%s", recipient_str)
        await _log("email", "success", recipient_str, log_message)
    except Exception as exc:
        logger.error("[EMAIL_FAILED] recipients=%s error=%s", recipient_str, exc)
        await _log("email", "failed", recipient_str, log_message, str(exc))


async def _send_whatsapp_callmebot(
    phones: list[str],
    message: str,
    log_message: str,
) -> None:
    if not settings.CALLMEBOT_APIKEY:
        logger.warning("[WPP_SKIPPED] phones=%s reason=apikey_not_configured", phones)
        for phone in phones:
            await _log("whatsapp", "skipped", phone.strip(), log_message, "CALLMEBOT_APIKEY no configurado en .env")
        return

    encoded = quote(message)
    async with httpx.AsyncClient(timeout=10) as client:
        for phone in phones:
            clean_phone = phone.strip().replace(" ", "")
            url = (
                f"https://api.callmebot.com/whatsapp.php"
                f"?phone={clean_phone}&text={encoded}&apikey={settings.CALLMEBOT_APIKEY}"
            )
            try:
                resp = await client.get(url)
                if resp.status_code == 200:
                    logger.info("[WPP_SENT] phone=%s", clean_phone)
                    await _log("whatsapp", "success", clean_phone, log_message)
                else:
                    err = f"CallMeBot respondió HTTP {resp.status_code}: {resp.text[:200]}"
                    logger.warning("[WPP_FAILED] phone=%s http=%s", clean_phone, resp.status_code)
                    await _log("whatsapp", "failed", clean_phone, log_message, err)
            except Exception as exc:
                logger.error("[WPP_FAILED] phone=%s error=%s", clean_phone, exc)
                await _log("whatsapp", "failed", clean_phone, log_message, str(exc))


async def send_low_stock_alerts(
    products: list[dict],  # [{"name": str, "sku": str, "quantity": int, "threshold": int}]
    business_name: str,
    notify_email: str | None,
    notify_whatsapp: str | None,
    email_enabled: bool,
    whatsapp_enabled: bool,
) -> None:
    if not products:
        return

    lines = "\n".join(
        f"• {p['name']} (SKU: {p['sku']}) — Stock: {p['quantity']} (mínimo: {p['threshold']})"
        for p in products
    )
    log_message = (
        f"{len(products)} producto(s) con stock bajo: "
        + ", ".join(f"{p['name']} (SKU: {p['sku']}, stock: {p['quantity']})" for p in products)
    )

    wpp_message = (
        f"⚠️ *{business_name}* — Alerta de stock bajo\n\n"
        f"Los siguientes productos necesitan reposición:\n\n"
        f"{lines}\n\n"
        f"Por favor realice el pedido a sus proveedores."
    )

    email_html = f"""
    <html><body style="font-family:Arial,sans-serif;color:#333">
    <h2 style="color:#1e3a5f">⚠️ Alerta de Stock Bajo — {business_name}</h2>
    <p>Los siguientes productos han alcanzado el umbral mínimo de stock:</p>
    <table style="border-collapse:collapse;width:100%;max-width:600px">
      <tr style="background:#1e3a5f;color:white">
        <th style="padding:8px 12px;text-align:left">Producto</th>
        <th style="padding:8px 12px;text-align:left">SKU</th>
        <th style="padding:8px 12px;text-align:center">Stock Actual</th>
        <th style="padding:8px 12px;text-align:center">Mínimo</th>
      </tr>
      {''.join(
        f'<tr style="background:{"#fff8f0" if i%2==0 else "white"}">'
        f'<td style="padding:8px 12px">{p["name"]}</td>'
        f'<td style="padding:8px 12px;font-family:monospace">{p["sku"]}</td>'
        f'<td style="padding:8px 12px;text-align:center;color:{"#dc2626" if p["quantity"]==0 else "#d97706"};font-weight:bold">{p["quantity"]}</td>'
        f'<td style="padding:8px 12px;text-align:center">{p["threshold"]}</td>'
        f'</tr>'
        for i, p in enumerate(products)
      )}
    </table>
    <p style="color:#666;font-size:13px;margin-top:20px">
      Este mensaje fue generado automáticamente por el Sistema de Facturación.
    </p>
    </body></html>
    """

    tasks = []

    if email_enabled and notify_email:
        recipients = [e.strip() for e in notify_email.split(",") if e.strip()]
        if recipients:
            tasks.append(_send_email(
                recipients,
                subject=f"⚠️ Stock bajo en {business_name} — {len(products)} producto(s)",
                body_html=email_html,
                log_message=log_message,
            ))

    if whatsapp_enabled and notify_whatsapp:
        phones = [p.strip() for p in notify_whatsapp.split(",") if p.strip()]
        if phones:
            tasks.append(_send_whatsapp_callmebot(phones, wpp_message, log_message))

    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)
