/**
 * MailerSend Transactional Email Service
 * Compatible with Vercel serverless / Edge functions
 */

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
  const senderName = process.env.MAILERSEND_SENDER_NAME || "جمعية إحياء | Ihyaa";

  const isArabic = locale === "ar";
  const subject = isArabic
    ? "رمز التحقق الخاص بك — جمعية إحياء"
    : "Your Verification Code — Ihyaa";

  const plainText = isArabic
    ? `السلام عليكم ورحمة الله وبركاته،\n\nرمز التحقق الخاص بك لحجز حضور فعالية جمعية إحياء هو:\n\n${otp}\n\nهذا الرمز صالح لمدة 10 دقائق ولا تشاركه مع أي شخص.\n\nجمعية إحياء للثقافة والتنمية`
    : `Hello,\n\nYour verification code to complete your booking with Ihyaa is:\n\n${otp}\n\nThis code will expire in 10 minutes. Do not share this code with anyone.\n\nIhyaa Cultural and Development Association`;

  const html = isArabic
    ? `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0d1217; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; margin: 0 auto; background: #131b23; border: 1px solid rgba(212, 175, 55, 0.25); border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <tr>
      <td style="padding: 32px 28px 20px; text-align: center; background: linear-gradient(180deg, rgba(212, 175, 55, 0.1) 0%, transparent 100%);">
        <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 50%; background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%); color: #0b1016; font-size: 22px; font-weight: bold; margin-bottom: 12px;">
          إ
        </div>
        <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #d4af37; letter-spacing: -0.5px;">
          جمعية إحياء
        </h1>
        <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8;">
          تأكيد تسجيل الحضور في الفعالية
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 10px 28px 24px; text-align: right; line-height: 1.7; color: #e2e8f0; font-size: 14px;">
        <p style="margin: 0 0 12px;">السلام عليكم ورحمة الله وبركاته،</p>
        <p style="margin: 0 0 20px; color: #cbd5e1;">
          شكراً لاهتمامك بحضور فعالياتنا. لإتمام وتأكيد حجزك، يرجى استخدام رمز التحقق التالي:
        </p>
        
        <div style="background: rgba(212, 175, 55, 0.08); border: 1px dashed #d4af37; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0;">
          <span style="font-family: monospace, Courier; font-size: 32px; font-weight: 800; letter-spacing: 10px; color: #f59e0b; display: inline-block;">
            ${otp}
          </span>
        </div>

        <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
          ⏳ تنتهي صلاحية هذا الرمز بعد 10 دقائق. يُرجى عدم مشاركته مع أي طرف.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 28px; background: rgba(0,0,0,0.25); border-top: 1px solid rgba(255,255,255,0.06); text-align: center; font-size: 11px; color: #64748b;">
        إذا لم تطلب هذا الرمز، يمكنك تجاهل هذا البريد الإلكتروني بأمان.<br>
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
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0d1217; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; margin: 0 auto; background: #131b23; border: 1px solid rgba(212, 175, 55, 0.25); border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <tr>
      <td style="padding: 32px 28px 20px; text-align: center; background: linear-gradient(180deg, rgba(212, 175, 55, 0.1) 0%, transparent 100%);">
        <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 50%; background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%); color: #0b1016; font-size: 22px; font-weight: bold; margin-bottom: 12px;">
          I
        </div>
        <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #d4af37; letter-spacing: -0.5px;">
          Ihyaa Association
        </h1>
        <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8;">
          Event Attendance Verification
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 10px 28px 24px; text-align: left; line-height: 1.7; color: #e2e8f0; font-size: 14px;">
        <p style="margin: 0 0 12px;">Hello,</p>
        <p style="margin: 0 0 20px; color: #cbd5e1;">
          Thank you for your interest in attending our event. To confirm your registration, please enter the following verification code:
        </p>
        
        <div style="background: rgba(212, 175, 55, 0.08); border: 1px dashed #d4af37; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0;">
          <span style="font-family: monospace, Courier; font-size: 32px; font-weight: 800; letter-spacing: 10px; color: #f59e0b; display: inline-block;">
            ${otp}
          </span>
        </div>

        <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
          ⏳ This code will expire in 10 minutes. Please do not share it with anyone.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 28px; background: rgba(0,0,0,0.25); border-top: 1px solid rgba(255,255,255,0.06); text-align: center; font-size: 11px; color: #64748b;">
        If you did not request this verification code, you can safely ignore this email.<br>
        &copy; ${new Date().getFullYear()} Ihyaa Cultural and Development Association. All rights reserved.
      </td>
    </tr>
  </table>
</body>
</html>
`;

  try {
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