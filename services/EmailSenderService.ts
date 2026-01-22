// EmailSenderService.ts
// Simple mock email sender for dev; replace with real email API in production

export class EmailSenderService {
  async sendVerificationEmail(email: string, token: string) {
    const link = `${window.location.origin}/?verify_email_token=${token}`;
    // In production, send via real email API
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(`[DEV] Verification email to ${email}: ${link}`);
      alert(`Verification link for ${email}:\n${link}`);
    } else {
      // TODO: Integrate with real email provider
    }
  }
}

export const emailSenderService = new EmailSenderService();
