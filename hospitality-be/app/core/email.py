import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.core.setting import settings

logger = logging.getLogger("email_service")


def _build_invite_html(first_name: str, role: str, invite_link: str, inviter_name: str) -> str:
    """Builds the HTML body for the staff invite email."""
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>You're invited to Hospitality Elite</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#151515;padding:32px 40px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">
                ⚡ Hospitality Elite
              </p>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.5);font-size:13px;">
                Enterprise Operations Platform
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#14130f;">
                You've been invited!
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#6b6860;line-height:1.6;">
                Hi <strong style="color:#14130f;">{first_name}</strong>, <strong style="color:#14130f;">{inviter_name}</strong> has invited you to join
                <strong style="color:#14130f;">Hospitality Elite</strong> as a <strong style="color:#14130f;">{role}</strong>.
              </p>

              <p style="margin:0 0 24px;font-size:14px;color:#6b6860;line-height:1.6;">
                Click the button below to set your password and access your dashboard.
                This link expires in <strong style="color:#14130f;">24 hours</strong>.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#151515;border-radius:8px;">
                    <a href="{invite_link}"
                       style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.2px;">
                      Set Your Password →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0;font-size:12px;color:#a09d96;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="{invite_link}" style="color:#151515;word-break:break-all;">{invite_link}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f5f4f0;padding:20px 40px;border-top:1px solid #ece9e2;">
              <p style="margin:0;font-size:12px;color:#a09d96;text-align:center;">
                You received this email because an admin added you to the Hospitality Elite platform.<br/>
                If this was unexpected, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def send_invite_email(
    to_email: str,
    first_name: str,
    role: str,
    invite_link: str,
    inviter_name: str = "An administrator"
) -> bool:
    """
    Sends a staff invitation email with a password-set link.
    Returns True if sent successfully, False otherwise.
    If SMTP is not configured, logs the invite link to console (dev mode).
    """
    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    from_name = settings.SMTP_FROM_NAME

    # --- Dev mode: log to console if SMTP is not configured ---
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("⚠️  SMTP not configured — printing invite link to console (dev mode).")
        logger.info("=" * 70)
        logger.info(f"📧  INVITE EMAIL (dev mode)")
        logger.info(f"    To      : {to_email}")
        logger.info(f"    Name    : {first_name}")
        logger.info(f"    Role    : {role}")
        logger.info(f"    Link    : {invite_link}")
        logger.info("=" * 70)
        return True

    # --- Production: send via SMTP ---
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"You're invited to join Hospitality Elite as {role}"
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = to_email

        html_body = _build_invite_html(first_name, role, invite_link, inviter_name)
        plain_body = (
            f"Hi {first_name},\n\n"
            f"{inviter_name} has invited you to join Hospitality Elite as {role}.\n\n"
            f"Set your password here:\n{invite_link}\n\n"
            f"This link expires in 24 hours.\n\n"
            f"— Hospitality Elite"
        )

        msg.attach(MIMEText(plain_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(from_email, to_email, msg.as_string())

        logger.info(f"✅ Invite email sent to {to_email}")
        return True

    except Exception as e:
        logger.error(f"❌ Failed to send invite email to {to_email}: {e}", exc_info=True)
        return False
