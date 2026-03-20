// EmailSenderService.ts
// Simple mock email sender for dev; replace with real email API in production

export class EmailSenderService {
  async sendVerificationEmail(email: string, token: string) {
    const link = `${window.location.origin}/?verify_email_token=${token}`;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Verification email to ${email}: ${link}`);
      alert(`Verification link for ${email}:\n${link}`);
    } else {
      // TODO: Integrate with real email provider
    }
  }

  async sendPasswordResetEmail(email: string, name: string, resetLink: string) {
    const subject = 'AT-ERP Password Reset';
    const body = `Hi ${name},\n\nYou requested a password reset link. Click below:\n${resetLink}\n\nIf you did not request this, ignore this message.\n\nThanks,\nAT-ERP team`;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Password reset email to ${email}: ${resetLink}`);
      alert(`Password reset link for ${email}:\n${resetLink}`);
      return true;
    }

    // Production: integrate with SendGrid/AWS SES/Mailgun/etc.
    // Placeholder for now.
    console.log(`[PROD] Send email to ${email} (subject: ${subject})`);
    return true;
  }
}

export const emailSenderService = new EmailSenderService();
