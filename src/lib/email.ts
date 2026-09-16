import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendOtpEmail({
  email,
  otp,
  locale = "ar",
}: {
  email: string;
  otp: string;
  locale?: string;
}) {
  if (!resend) {
    console.warn("RESEND_API_KEY is not configured. OTP:", otp);
    return { success: true, simulated: true };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const isArabic = locale === "ar";
  const subject = isArabic
    ? `رمز التحقق الخاص بك لحجز إحياء: ${otp}`
    : `Your Ihyaa Event Booking Verification Code: ${otp}`;

  const html = isArabic
    ? `
      <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #0b5c46; text-align: center;">إحياء - التحقق من البريد الإلكتروني</h2>
        <p>السلام عليكم ورحمة الله وبركاته،</p>
        <p>شكراً لاهتمامك بحضور فعاليتنا. لإكمال حجزك، يرجى استخدام رمز التحقق التالي:</p>
        <div style="background-color: #f4f8f6; padding: 15px; text-align: center; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0b5c46; margin: 25px 0;">
          ${otp}
        </div>
        <p style="font-size: 14px; color: #666;">تنتهي صلاحية هذا الرمز بعد 10 دقائق. إذا لم تكن قد قمت بهذا الطلب، يمكنك تجاهل هذا البريد بأمان.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #999; text-align: center;">جمعية إحياء للثقافة والتنمية</p>
      </div>
    `
    : `
      <div dir="ltr" style="font-family: Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #0b5c46; text-align: center;">Ihyaa - Email Verification</h2>
        <p>Hello,</p>
        <p>Thank you for your interest in attending our event. To complete your booking, please enter the following verification code:</p>
        <div style="background-color: #f4f8f6; padding: 15px; text-align: center; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0b5c46; margin: 25px 0;">
          ${otp}
        </div>
        <p style="font-size: 14px; color: #666;">This code will expire in 10 minutes. If you did not initiate this request, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #999; text-align: center;">Ihyaa Cultural and Development Association</p>
      </div>
    `;

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject,
      html,
    });

    if (error) {
      console.warn("Resend API warning/error:", error.message);
      // If Resend test domain restriction is hit, allow dev flow to proceed while logging code
      if (error.message && error.message.includes("testing emails to your own email address")) {
        console.info(`[Resend Test Mode] OTP for ${email}: ${otp}`);
        return { success: true, simulated: true };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error("Failed to send email via Resend:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send email",
    };
  }
}