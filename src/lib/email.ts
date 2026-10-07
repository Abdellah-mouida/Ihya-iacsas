/**
 * Brevo Transactional Email Service
 * Powered by Brevo HTTP REST API (v3)
 * Server-side only
 */

import fs from "fs";
import path from "path";

function getCircularLogoBase64(): string | null {
  try {
    const logoPath = path.join(
      process.cwd(),
      "public",
      "images",
      "logo-circle.png",
    );
    if (fs.existsSync(logoPath)) {
      return fs.readFileSync(logoPath).toString("base64");
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Email] Could not load circular logo file:", err);
    }
  }
  return null;
}

const SENDER_NAME = "Ihyaa Program";
const SENDER_EMAIL = "no-reply@ihyaa.is-cool.dev";

/**
 * Sends a transactional email through Brevo's v3 SMTP REST API.
 */
async function sendBrevoEmail(payload: {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Brevo] BREVO_API_KEY is not configured.");
    }
    return {
      success: false,
      error: "Email service is not configured. Please contact support.",
    };
  }

  let lastError = "Could not connect to email service.";

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        signal: AbortSignal.timeout(25000),
        headers: {
          accept: "application/json",
          "api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: SENDER_NAME,
            email: SENDER_EMAIL,
          },
          to: [
            {
              email: payload.to,
            },
          ],
          subject: payload.subject,
          htmlContent: payload.htmlContent,
          textContent: payload.textContent,
        }),
      });

      if (res.status === 201 || res.status === 200 || res.status === 202) {
        const data = await res.json().catch(() => ({}));
        return {
          success: true,
          messageId: (data as { messageId?: string }).messageId,
        };
      }

      let errorMessage = `Brevo API returned status ${res.status}`;
      try {
        const errData = await res.json();
        if (errData?.message) {
          errorMessage = errData.message;
        }
      } catch {
        // ignore
      }

      lastError = errorMessage;
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[Brevo] Email sending attempt ${attempt} failed:`, errorMessage);
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Could not connect to email service.";
      if (process.env.NODE_ENV !== "production") {
        console.error(`[Brevo] Network error on attempt ${attempt}:`, err);
      }
    }

    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    }
  }

  return {
    success: false,
    error: lastError,
  };
}

/**
 * Send OTP Verification Email
 */
export async function sendOTPEmail(
  to: string,
  otp: string,
  locale: string = "ar",
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const isArabic = locale === "ar";
  const subject = isArabic
    ? "رمز التحقق الخاص بك — برنامج إحياء"
    : "Your Verification Code — Ihyaa Program";

  const plainText = isArabic
    ? `السلام عليكم ورحمة الله وبركاته،\n\nرمز التحقق الخاص بك لتسجيل حضور فعالية برنامج إحياء هو:\n\n${otp}\n\nهذا الرمز صالح لمدة 10 دقائق ولا تشاركه مع أي شخص.\n\nبرنامج إحياء`
    : `Hello,\n\nYour verification code to complete your registration with Ihyaa Program is:\n\n${otp}\n\nThis code will expire in 10 minutes. Do not share this code with anyone.\n\nIhyaa Program`;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  const logoB64 = getCircularLogoBase64();
  const logoSrc = appUrl
    ? `${appUrl}/images/logo-circle.png`
    : logoB64
      ? `data:image/png;base64,${logoB64}`
      : "https://res.cloudinary.com/dp5cuxwyi/image/upload/v1747800000/ihyaa/logo-square.jpg";

  const html = isArabic
    ? `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${subject}</title>
  <style>
    @media only screen and (max-width: 480px) {
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 16px !important; }
      .header-cell { padding: 24px 16px 18px !important; }
      .content-cell { padding: 8px 16px 20px !important; }
      .otp-box { padding: 18px 8px !important; margin: 20px 0 !important; }
      .otp-text { font-size: 26px !important; letter-spacing: 6px !important; text-indent: 6px !important; }
      .footer-cell { padding: 14px 16px !important; }
    }
    @media only screen and (max-width: 360px) {
      body { padding: 10px 4px !important; }
      .header-cell { padding: 18px 10px 14px !important; }
      .content-cell { padding: 6px 10px 16px !important; font-size: 13.5px !important; }
      .otp-box { padding: 14px 4px !important; margin: 16px 0 !important; }
      .otp-text { font-size: 20px !important; letter-spacing: 4px !important; text-indent: 4px !important; }
      .footer-cell { padding: 10px 8px !important; font-size: 10.5px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 28px 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Arabic', Helvetica, Arial, sans-serif; background-color: #0b1016; color: #f1f5f9;">
  <table role="presentation" class="email-container" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; margin: 0 auto; background: #111822; border: 1px solid rgba(16, 117, 39, 0.35); border-radius: 24px; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,0.55);">
    <!-- Header with Brand Green Gradient -->
    <tr>
      <td class="header-cell" style="padding: 36px 28px 24px; text-align: center; background: linear-gradient(180deg, rgba(16, 117, 39, 0.25) 0%, rgba(10, 84, 23, 0.05) 75%, transparent 100%);">
        <!-- Circular Logo -->
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px;">
          <tr>
            <td style="width: 72px; height: 72px; text-align: center; vertical-align: middle;">
              <img src="${logoSrc}" alt="شعار برنامج إحياء" width="70" height="70" style="display: block; width: 70px; height: 70px; border-radius: 50%; object-fit: cover;" />
            </td>
          </tr>
        </table>
        
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #f8fafc; letter-spacing: -0.3px;">
          برنامج إحياء
        </h1>
        <div style="margin-top: 8px;">
          <span style="display: inline-block; padding: 4px 14px; border-radius: 9999px; background: rgba(16, 117, 39, 0.25); border: 1px solid rgba(16, 117, 39, 0.45); color: #34d399; font-size: 12px; font-weight: 600;">
            تأكيد التسجيل في الفعالية
          </span>
        </div>
      </td>
    </tr>

    <!-- Body Content -->
    <tr>
      <td class="content-cell" style="padding: 8px 32px 28px; text-align: right; line-height: 1.75; color: #e2e8f0; font-size: 14.5px;">
        <p style="margin: 0 0 12px; font-weight: 600; color: #f1f5f9;">السلام عليكم ورحمة الله وبركاته،</p>
        <p style="margin: 0 0 22px; color: #cbd5e1;">
          شكراً لاهتمامك بحضور فعاليات برنامج إحياء. لإتمام التحقق من بريدك الإلكتروني ومتابعة طلبك، يُرجى إدخال رمز التحقق التالي:
        </p>
        
        <!-- OTP Box with Brand Green Style -->
        <div class="otp-box" style="background: linear-gradient(135deg, rgba(16, 117, 39, 0.16) 0%, rgba(10, 84, 23, 0.08) 100%); border: 1.5px dashed #107527; border-radius: 16px; padding: 22px 16px; text-align: center; margin: 26px 0; box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);">
          <span class="otp-text" style="font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 34px; font-weight: 800; letter-spacing: 12px; color: #10b981; display: inline-block; text-indent: 12px;">
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
      <td class="footer-cell" style="padding: 18px 28px; background: rgba(0,0,0,0.35); border-top: 1px solid rgba(255,255,255,0.06); text-align: center; font-size: 11.5px; color: #64748b; line-height: 1.6;">
        إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان.<br>
        &copy; ${new Date().getFullYear()} برنامج إحياء. جميع الحقوق محفوظة.
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
  <meta name="x-apple-disable-message-reformatting">
  <title>${subject}</title>
  <style>
    @media only screen and (max-width: 480px) {
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 16px !important; }
      .header-cell { padding: 24px 16px 18px !important; }
      .content-cell { padding: 8px 16px 20px !important; }
      .otp-box { padding: 18px 8px !important; margin: 20px 0 !important; }
      .otp-text { font-size: 26px !important; letter-spacing: 6px !important; text-indent: 6px !important; }
      .footer-cell { padding: 14px 16px !important; }
    }
    @media only screen and (max-width: 360px) {
      body { padding: 10px 4px !important; }
      .header-cell { padding: 18px 10px 14px !important; }
      .content-cell { padding: 6px 10px 16px !important; font-size: 13.5px !important; }
      .otp-box { padding: 14px 4px !important; margin: 16px 0 !important; }
      .otp-text { font-size: 20px !important; letter-spacing: 4px !important; text-indent: 4px !important; }
      .footer-cell { padding: 10px 8px !important; font-size: 10.5px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 28px 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1016; color: #f1f5f9;">
  <table role="presentation" class="email-container" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; margin: 0 auto; background: #111822; border: 1px solid rgba(16, 117, 39, 0.35); border-radius: 24px; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,0.55);">
    <!-- Header with Brand Green Gradient -->
    <tr>
      <td class="header-cell" style="padding: 36px 28px 24px; text-align: center; background: linear-gradient(180deg, rgba(16, 117, 39, 0.25) 0%, rgba(10, 84, 23, 0.05) 75%, transparent 100%);">
        <!-- Circular Logo -->
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px;">
          <tr>
            <td style="width: 72px; height: 72px; text-align: center; vertical-align: middle;">
              <img src="${logoSrc}" alt="Ihyaa Program Logo" width="70" height="70" style="display: block; width: 70px; height: 70px; border-radius: 50%; object-fit: cover;" />
            </td>
          </tr>
        </table>
        
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #f8fafc; letter-spacing: -0.3px;">
          Ihyaa Program
        </h1>
        <div style="margin-top: 8px;">
          <span style="display: inline-block; padding: 4px 14px; border-radius: 9999px; background: rgba(16, 117, 39, 0.25); border: 1px solid rgba(16, 117, 39, 0.45); color: #34d399; font-size: 12px; font-weight: 600;">
            Event Registration Verification
          </span>
        </div>
      </td>
    </tr>

    <!-- Body Content -->
    <tr>
      <td class="content-cell" style="padding: 8px 32px 28px; text-align: left; line-height: 1.75; color: #e2e8f0; font-size: 14.5px;">
        <p style="margin: 0 0 12px; font-weight: 600; color: #f1f5f9;">Hello,</p>
        <p style="margin: 0 0 22px; color: #cbd5e1;">
          Thank you for registering for an Ihyaa Program event. To verify your email and complete your request, please enter the following verification code:
        </p>
        
        <!-- OTP Box with Brand Green Style -->
        <div class="otp-box" style="background: linear-gradient(135deg, rgba(16, 117, 39, 0.16) 0%, rgba(10, 84, 23, 0.08) 100%); border: 1.5px dashed #107527; border-radius: 16px; padding: 22px 16px; text-align: center; margin: 26px 0; box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);">
          <span class="otp-text" style="font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 34px; font-weight: 800; letter-spacing: 12px; color: #10b981; display: inline-block; text-indent: 12px;">
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
      <td class="footer-cell" style="padding: 18px 28px; background: rgba(0,0,0,0.35); border-top: 1px solid rgba(255,255,255,0.06); text-align: center; font-size: 11.5px; color: #64748b; line-height: 1.6;">
        If you did not request this verification code, you can safely ignore this email.<br>
        &copy; ${new Date().getFullYear()} Ihyaa Program. All rights reserved.
      </td>
    </tr>
  </table>
</body>
</html>
`;

  return sendBrevoEmail({
    to,
    subject,
    htmlContent: html,
    textContent: plainText,
  });
}

/**
 * Send Congratulations / Promotion Email to Waitlisted attendee
 */
export async function sendWaitlistPromotionEmail(
  to: string,
  eventDetails: {
    titleAr: string;
    titleEn: string;
    date: Date | string;
    time?: string;
    location: string;
  },
  locale: string = "ar",
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const isArabic = locale === "ar";
  const eventTitle = isArabic ? eventDetails.titleAr : eventDetails.titleEn;
  const formattedDate = new Date(eventDetails.date).toLocaleDateString(
    isArabic ? "ar-MA" : "en-US",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" },
  );

  const subject = isArabic
    ? `تهانينا! تم تأكيد مقعدك في فعالية: ${eventTitle} — برنامج إحياء`
    : `Congratulations! Your seat is confirmed for: ${eventTitle} — Ihyaa Program`;

  const plainText = isArabic
    ? `السلام عليكم ورحمة الله وبركاته،\n\nيسر إدارة برنامج إحياء إشعارك بأنه قد توفر مقعد لك وتمت ترقيتك وتأكيد حضورك رسمياً في الفعالية:\n${eventTitle}\n\nالموعد: ${formattedDate} (${eventDetails.time || ""})\nالمكان: ${eventDetails.location}\n\nنتطلع لحضورك ومشاركتك معنا!\n\nبرنامج إحياء`
    : `Hello,\n\nWe are pleased to inform you that a seat has become available and your registration has been officially confirmed for:\n${eventTitle}\n\nDate: ${formattedDate} (${eventDetails.time || ""})\nLocation: ${eventDetails.location}\n\nWe look forward to seeing you there!\n\nIhyaa Program`;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  const logoB64 = getCircularLogoBase64();
  const logoSrc = appUrl
    ? `${appUrl}/images/logo-circle.png`
    : logoB64
      ? `data:image/png;base64,${logoB64}`
      : "https://res.cloudinary.com/dp5cuxwyi/image/upload/v1747800000/ihyaa/logo-square.jpg";

  const html = isArabic
    ? `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${subject}</title>
  <style>
    @media only screen and (max-width: 480px) {
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 16px !important; }
      .header-cell { padding: 24px 16px 18px !important; }
      .content-cell { padding: 10px 16px 20px !important; }
      .event-card-box { padding: 14px !important; margin: 16px 0 !important; }
      .footer-cell { padding: 14px 16px !important; }
    }
    @media only screen and (max-width: 360px) {
      body { padding: 10px 4px !important; }
      .header-cell { padding: 18px 10px 14px !important; }
      .content-cell { padding: 6px 10px 16px !important; font-size: 13.5px !important; }
      .event-card-box { padding: 12px 10px !important; margin: 12px 0 !important; }
      .footer-cell { padding: 10px 8px !important; font-size: 10.5px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 28px 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Arabic', Helvetica, Arial, sans-serif; background-color: #0b1016; color: #f1f5f9;">
  <table role="presentation" class="email-container" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; margin: 0 auto; background: #111822; border: 1px solid rgba(16, 117, 39, 0.4); border-radius: 24px; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,0.55);">
    <tr>
      <td class="header-cell" style="padding: 36px 28px 24px; text-align: center; background: linear-gradient(180deg, rgba(16, 117, 39, 0.3) 0%, rgba(10, 84, 23, 0.08) 75%, transparent 100%);">
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px;">
          <tr>
            <td style="width: 72px; height: 72px; text-align: center; vertical-align: middle;">
              <img src="${logoSrc}" alt="شعار برنامج إحياء" width="70" height="70" style="display: block; width: 70px; height: 70px; border-radius: 50%; object-fit: cover;" />
            </td>
          </tr>
        </table>
        
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #f8fafc; letter-spacing: -0.3px;">
          برنامج إحياء
        </h1>
        <div style="margin-top: 10px;">
          <span style="display: inline-block; padding: 6px 18px; border-radius: 9999px; background: rgba(16, 117, 39, 0.3); border: 1px solid #10b981; color: #34d399; font-size: 13px; font-weight: 700;">
            🎉 مبارك! تم تأكيد مقعدك
          </span>
        </div>
      </td>
    </tr>

    <tr>
      <td class="content-cell" style="padding: 12px 32px 28px; text-align: right; line-height: 1.75; color: #e2e8f0; font-size: 14.5px;">
        <p style="margin: 0 0 14px; font-weight: 600; color: #f1f5f9;">السلام عليكم ورحمة الله وبركاته،</p>
        <p style="margin: 0 0 20px; color: #cbd5e1;">
          يسرنا إعلامك بأنه قد توفر مقعد لك في الفعالية وتمت ترقية طلبك من قائمة الانتظار إلى <strong style="color: #34d399;">الحجز المؤكد</strong>.
        </p>

        <!-- Event Summary Card -->
        <div class="event-card-box" style="background: rgba(16, 117, 39, 0.12); border: 1px solid rgba(16, 117, 39, 0.35); border-radius: 16px; padding: 20px; margin: 20px 0;">
          <h3 style="margin: 0 0 12px; font-size: 17px; color: #f8fafc; font-weight: 700;">
            ${eventTitle}
          </h3>
          <p style="margin: 6px 0; font-size: 13.5px; color: #94a3b8;">
            📅 <strong>الموعد:</strong> ${formattedDate} ${eventDetails.time ? `(${eventDetails.time})` : ""}
          </p>
          <p style="margin: 6px 0; font-size: 13.5px; color: #94a3b8;">
            📍 <strong>المكان:</strong> ${eventDetails.location}
          </p>
        </div>

        <p style="margin: 20px 0 0; color: #cbd5e1;">
          نتطلع لحضورك ومشاركتك القيّمة. في حال تعذر حضورك، يُرجى التواصل معنا لإتاحة الفرصة لغيرك.
        </p>
      </td>
    </tr>

    <tr>
      <td class="footer-cell" style="padding: 18px 28px; background: rgba(0,0,0,0.35); border-top: 1px solid rgba(255,255,255,0.06); text-align: center; font-size: 11.5px; color: #64748b; line-height: 1.6;">
        &copy; ${new Date().getFullYear()} برنامج إحياء. جميع الحقوق محفوظة.
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
  <meta name="x-apple-disable-message-reformatting">
  <title>${subject}</title>
  <style>
    @media only screen and (max-width: 480px) {
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 16px !important; }
      .header-cell { padding: 24px 16px 18px !important; }
      .content-cell { padding: 10px 16px 20px !important; }
      .event-card-box { padding: 14px !important; margin: 16px 0 !important; }
      .footer-cell { padding: 14px 16px !important; }
    }
    @media only screen and (max-width: 360px) {
      body { padding: 10px 4px !important; }
      .header-cell { padding: 18px 10px 14px !important; }
      .content-cell { padding: 6px 10px 16px !important; font-size: 13.5px !important; }
      .event-card-box { padding: 12px 10px !important; margin: 12px 0 !important; }
      .footer-cell { padding: 10px 8px !important; font-size: 10.5px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 28px 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1016; color: #f1f5f9;">
  <table role="presentation" class="email-container" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; margin: 0 auto; background: #111822; border: 1px solid rgba(16, 117, 39, 0.4); border-radius: 24px; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,0.55);">
    <tr>
      <td class="header-cell" style="padding: 36px 28px 24px; text-align: center; background: linear-gradient(180deg, rgba(16, 117, 39, 0.3) 0%, rgba(10, 84, 23, 0.08) 75%, transparent 100%);">
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px;">
          <tr>
            <td style="width: 72px; height: 72px; text-align: center; vertical-align: middle;">
              <img src="${logoSrc}" alt="Ihyaa Program Logo" width="70" height="70" style="display: block; width: 70px; height: 70px; border-radius: 50%; object-fit: cover;" />
            </td>
          </tr>
        </table>
        
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #f8fafc; letter-spacing: -0.3px;">
          Ihyaa Program
        </h1>
        <div style="margin-top: 10px;">
          <span style="display: inline-block; padding: 6px 18px; border-radius: 9999px; background: rgba(16, 117, 39, 0.3); border: 1px solid #10b981; color: #34d399; font-size: 13px; font-weight: 700;">
            🎉 Congratulations! Your Seat is Confirmed
          </span>
        </div>
      </td>
    </tr>

    <tr>
      <td class="content-cell" style="padding: 12px 32px 28px; text-align: left; line-height: 1.75; color: #e2e8f0; font-size: 14.5px;">
        <p style="margin: 0 0 14px; font-weight: 600; color: #f1f5f9;">Hello,</p>
        <p style="margin: 0 0 20px; color: #cbd5e1;">
          We are pleased to inform you that a seat has opened up and your registration has been upgraded from the waitlist to <strong style="color: #34d399;">Confirmed Booking</strong>.
        </p>

        <!-- Event Summary Card -->
        <div class="event-card-box" style="background: rgba(16, 117, 39, 0.12); border: 1px solid rgba(16, 117, 39, 0.35); border-radius: 16px; padding: 20px; margin: 20px 0;">
          <h3 style="margin: 0 0 12px; font-size: 17px; color: #f8fafc; font-weight: 700;">
            ${eventTitle}
          </h3>
          <p style="margin: 6px 0; font-size: 13.5px; color: #94a3b8;">
            📅 <strong>Date:</strong> ${formattedDate} ${eventDetails.time ? `(${eventDetails.time})` : ""}
          </p>
          <p style="margin: 6px 0; font-size: 13.5px; color: #94a3b8;">
            📍 <strong>Location:</strong> ${eventDetails.location}
          </p>
        </div>

        <p style="margin: 20px 0 0; color: #cbd5e1;">
          We look forward to welcoming you. If you can no longer attend, please let us know so we can offer your place to someone else.
        </p>
      </td>
    </tr>

    <tr>
      <td class="footer-cell" style="padding: 18px 28px; background: rgba(0,0,0,0.35); border-top: 1px solid rgba(255,255,255,0.06); text-align: center; font-size: 11.5px; color: #64748b; line-height: 1.6;">
        &copy; ${new Date().getFullYear()} Ihyaa Program. All rights reserved.
      </td>
    </tr>
  </table>
</body>
</html>
`;

  return sendBrevoEmail({
    to,
    subject,
    htmlContent: html,
    textContent: plainText,
  });
}
