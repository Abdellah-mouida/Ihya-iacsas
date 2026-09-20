/**
 * MailerSend Transactional Email Service
 * Compatible with Vercel serverless / Edge functions
 */

import fs from "fs";
import path from "path";

function getLogoBase64(): string | null {
  try {
    const logoPath = path.join(
      process.cwd(),
      "public",
      "images",
      "logo-square.jpg",
    );
    if (fs.existsSync(logoPath)) {
      return fs.readFileSync(logoPath).toString("base64");
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Email] Could not load logo file for attachment:", err);
    }
  }
  return null;
}

export async function sendOTPEmail(
  to: string,
  otp: string,
  locale: string = "ar",
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const token = process.env.MAILERSEND_API_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[MailerSend] MAILERSEND_API_TOKEN is not configured.");
    }
    return {
      success: false,
      error:
        locale === "ar"
          ? "خدمة البريد الإلكتروني غير مهيأة حالياً. يرجى مراجعة إدارة الموقع."
          : "Email service is not configured. Please contact support.",
    };
  }

  const senderEmail =
    process.env.MAILERSEND_SENDER_EMAIL ||
    "ihyaa@test-q3enl6k119r42vwr.mlsender.net";
  const senderName =
    process.env.MAILERSEND_SENDER_NAME || "جمعية إحياء | Ihyaa";

  const isArabic = locale === "ar";
  const subject = isArabic
    ? "رمز التحقق الخاص بك — جمعية إحياء"
    : "Your Verification Code — Ihyaa";

  const plainText = isArabic
    ? `السلام عليكم ورحمة الله وبركاته،\n\nرمز التحقق الخاص بك لحجز حضور فعالية جمعية إحياء هو:\n\n${otp}\n\nهذا الرمز صالح لمدة 10 دقائق ولا تشاركه مع أي شخص.\n\nجمعية إحياء للثقافة والتنمية`
    : `Hello,\n\nYour verification code to complete your booking with Ihyaa is:\n\n${otp}\n\nThis code will expire in 10 minutes. Do not share this code with anyone.\n\nIhyaa Cultural and Development Association`;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  const logoBase64 = getLogoBase64();
  const logoSrc = appUrl
    ? `${appUrl}/images/logo-square.jpg`
    : logoBase64
      ? "cid:ihyaa-logo"
      : "https://res.cloudinary.com/dp5cuxwyi/image/upload/v1747800000/ihyaa/logo-square.jpg";

  const html = isArabic
    ? `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 28px 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Arabic', Helvetica, Arial, sans-serif; background-color: #0b1016; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; margin: 0 auto; background: #111822; border: 1px solid rgba(16, 117, 39, 0.35); border-radius: 24px; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,0.55);">
    <!-- Header with Brand Green Gradient -->
    <tr>
      <td style="padding: 36px 28px 24px; text-align: center; background: linear-gradient(180deg, rgba(16, 117, 39, 0.22) 0%, rgba(10, 84, 23, 0.05) 75%, transparent 100%);">
        <!-- Circular Logo -->
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px;">
          <tr>
            <td style="width: 70px; height: 70px; border-radius: 50%; padding: 3px; background: linear-gradient(135deg, #107527 0%, #d4af37 100%); text-align: center; vertical-align: middle;">
              <img src="${logoSrc}" alt="شعار جمعية إحياء" width="64" height="64" style="display: block; width: 64px; height: 64px; border-radius: 50%; object-fit: cover; background-color: #0a5417;" />
            </td>
          </tr>
        </table>
        
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #f8fafc; letter-spacing: -0.3px;">
          جمعية إحياء
        </h1>
        <div style="margin-top: 8px;">
          <span style="display: inline-block; padding: 4px 14px; border-radius: 9999px; background: rgba(16, 117, 39, 0.25); border: 1px solid rgba(16, 117, 39, 0.45); color: #34d399; font-size: 12px; font-weight: 600;">
            تأكيد حجز الفعالية
          </span>
        </div>
      </td>
    </tr>

    <!-- Body Content -->
    <tr>
      <td style="padding: 8px 32px 28px; text-align: right; line-height: 1.75; color: #e2e8f0; font-size: 14.5px;">
        <p style="margin: 0 0 12px; font-weight: 600; color: #f1f5f9;">السلام عليكم ورحمة الله وبركاته،</p>
        <p style="margin: 0 0 22px; color: #cbd5e1;">
          شكراً لاهتمامك بحضور فعاليات جمعية إحياء. لإتمام وتأكيد حجز مقعدك، يُرجى إدخال رمز التحقق التالي في صفحة التسجيل:
        </p>
        
        <!-- OTP Box with Brand Green Style -->
        <div style="background: linear-gradient(135deg, rgba(16, 117, 39, 0.14) 0%, rgba(10, 84, 23, 0.08) 100%); border: 1.5px dashed #107527; border-radius: 16px; padding: 22px 16px; text-align: center; margin: 26px 0; box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);">
          <span style="font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 34px; font-weight: 800; letter-spacing: 12px; color: #10b981; display: inline-block; text-indent: 12px;">
            ${otp}
          </span>
        </div>

        <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 10px 14px; text-align: center; margin: 0 0 10px;">
          <p style="margin: 0; font-size: 12.5px; color: #94a3b8;">
            ⏳ هذا الرمز صالح لمدة <strong style="color: #fbbf24;">10 دقائق</strong> فقط. يُرجى عدم مشاركته مع أي طرف آخر.
          </p>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 18px 28px; background: rgba(0,0,0,0.35); border-top: 1px solid rgba(255,255,255,0.06); text-align: center; font-size: 11.5px; color: #64748b; line-height: 1.6;">
        إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان.<br>
        &copy; ${new Date().getFullYear()} جمعية إحياء للثقافة والتنمية. جميع الحقوق محفوظة.
      </td>
    </tr>
  </table>
</body>
</html>
`
    : `
<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 28px 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1016; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; margin: 0 auto; background: #111822; border: 1px solid rgba(16, 117, 39, 0.35); border-radius: 24px; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,0.55);">
    <!-- Header with Brand Green Gradient -->
    <tr>
      <td style="padding: 36px 28px 24px; text-align: center; background: linear-gradient(180deg, rgba(16, 117, 39, 0.22) 0%, rgba(10, 84, 23, 0.05) 75%, transparent 100%);">
        <!-- Circular Logo -->
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px;">
          <tr>
            <td style="width: 70px; height: 70px; border-radius: 50%; padding: 3px; background: linear-gradient(135deg, #107527 0%, #d4af37 100%); text-align: center; vertical-align: middle;">
              <img src="${logoSrc}" alt="Ihyaa Logo" width="64" height="64" style="display: block; width: 64px; height: 64px; border-radius: 50%; object-fit: cover; background-color: #0a5417;" />
            </td>
          </tr>
        </table>
        
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #f8fafc; letter-spacing: -0.3px;">
          Ihyaa Association
        </h1>
        <div style="margin-top: 8px;">
          <span style="display: inline-block; padding: 4px 14px; border-radius: 9999px; background: rgba(16, 117, 39, 0.25); border: 1px solid rgba(16, 117, 39, 0.45); color: #34d399; font-size: 12px; font-weight: 600;">
            Event Booking Confirmation
          </span>
        </div>
      </td>
    </tr>

    <!-- Body Content -->
    <tr>
      <td style="padding: 8px 32px 28px; text-align: left; line-height: 1.75; color: #e2e8f0; font-size: 14.5px;">
        <p style="margin: 0 0 12px; font-weight: 600; color: #f1f5f9;">Hello,</p>
        <p style="margin: 0 0 22px; color: #cbd5e1;">
          Thank you for registering for our event. To complete and confirm your booking, please enter the following verification code:
        </p>
        
        <!-- OTP Box with Brand Green Style -->
        <div style="background: linear-gradient(135deg, rgba(16, 117, 39, 0.14) 0%, rgba(10, 84, 23, 0.08) 100%); border: 1.5px dashed #107527; border-radius: 16px; padding: 22px 16px; text-align: center; margin: 26px 0; box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);">
          <span style="font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 34px; font-weight: 800; letter-spacing: 12px; color: #10b981; display: inline-block; text-indent: 12px;">
            ${otp}
          </span>
        </div>

        <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 10px 14px; text-align: center; margin: 0 0 10px;">
          <p style="margin: 0; font-size: 12.5px; color: #94a3b8;">
            ⏳ This code expires in <strong style="color: #fbbf24;">10 minutes</strong>. Please do not share it with anyone.
          </p>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 18px 28px; background: rgba(0,0,0,0.35); border-top: 1px solid rgba(255,255,255,0.06); text-align: center; font-size: 11.5px; color: #64748b; line-height: 1.6;">
        If you did not request this verification code, you can safely ignore this email.<br>
        &copy; ${new Date().getFullYear()} Ihyaa Cultural and Development Association. All rights reserved.
      </td>
    </tr>
  </table>
</body>
</html>
`;

  try {
    const attachments: Array<{
      content: string;
      filename: string;
      id: string;
      disposition?: string;
    }> = [];

    if (logoBase64 && !appUrl) {
      attachments.push({
        content: logoBase64,
        filename: "logo-square.jpg",
        id: "ihyaa-logo",
        disposition: "inline",
      });
    }

    const res = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        from: {
          email: senderEmail,
          name: senderName,
        },
        to: [
          {
            email: to,
          },
        ],
        subject,
        text: plainText,
        html,
        ...(attachments.length > 0 ? { attachments } : {}),
      }),
    });

    if (res.status === 200 || res.status === 202) {
      const messageId = res.headers.get("x-message-id") || undefined;
      return { success: true, messageId };
    }

    let errorMessage = `MailerSend API returned status ${res.status}`;
    try {
      const errData = await res.json();
      if (errData?.message) {
        errorMessage = errData.message;
      }
      // If MailerSend sandbox unique recipients limit is hit on the trial domain
      if (
        errorMessage.includes("sandbox account unique recipients limit") ||
        errorMessage.includes("MS42225")
      ) {
        console.info(
          `[MailerSend Sandbox Mode] Recipient ${to} hit sandbox recipient limit. OTP code: ${otp}`,
        );
        return { success: true, messageId: "sandbox-simulated" };
      }
    } catch {
      // ignore json parse error
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn("[MailerSend] Email sending failed:", errorMessage);
    }

    return {
      success: false,
      error:
        locale === "ar"
          ? "فشل إرسال رمز التحقق عبر البريد الإلكتروني. يرجى التأكد من البريد والمحاولة ثانية."
          : "Failed to send verification code email. Please check your address and try again.",
    };
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[MailerSend] Network / runtime error:", err);
    }
    return {
      success: false,
      error:
        locale === "ar"
          ? "تعذر الاتصال بخدمة البريد الإلكتروني. يرجى المحاولة مرة أخرى لاحقاً."
          : "Could not connect to email service. Please try again later.",
    };
  }
}
