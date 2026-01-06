import smtplib
from email.message import EmailMessage
from pathlib import Path
from .settings import get_settings


settings = get_settings()


def send_email(subject: str, body: str, to_addresses: list[str], attachment_path: str | None = None) -> None:
    if settings.dev_email_console or not settings.smtp_host:
        print("--- Email (dev mode) ---")
        print("To:", ", ".join(to_addresses))
        print("Subject:", subject)
        print(body)
        if attachment_path:
            print(f"Attachment: {attachment_path}")
        print("--- end ---")
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = ", ".join(to_addresses)
    msg.set_content(body)

    if attachment_path:
        data = Path(attachment_path).read_bytes()
        msg.add_attachment(data, maintype="application", subtype="vnd.openxmlformats-officedocument.wordprocessingml.document", filename=Path(attachment_path).name)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        if settings.smtp_user and settings.smtp_password:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
