/**
 * Module purpose: Shares one Nodemailer transporter between system messages, scheduled reminders, and Super Admin manual emails; SMTP errors are normalized.
 */
import nodemailer, { Transporter } from 'nodemailer';
import { env, isSmtpConfigured } from '../config/env';
import { EmailContent } from '../utils/emailTemplates';
import { logger } from '../utils/logger';

let transporter: Transporter | null = null;

/**
 * Lazily initializes one Nodemailer transport. Real SMTP uses TLS; the JSON development transport is not an actual delivery.
 */
function getTransporter(): Transporter {
  if (transporter) return transporter;
  transporter = isSmtpConfigured
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        // Port 587 must negotiate TLS; never silently downgrade to plaintext.
        requireTLS: !env.SMTP_SECURE,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
      })
    : // Preserve existing development fallback for automated/system emails.
      nodemailer.createTransport({ jsonTransport: true });
  return transporter;
}

export interface SendResult {
  sent: boolean;
  code?: 'SMTP_NOT_CONFIGURED' | 'SMTP_REJECTED' | 'SMTP_ERROR';
}

/**
 * Service methods coordinate domain rules, persistence, messaging, or audit records. Callers should use this layer instead of duplicating database logic.
 */
export const emailService = {
  /**
   * Use the same transporter for automated and manual mail. Manual sends must
   * use real configured SMTP; the JSON development transport is not delivery.
   */
  async sendDetailed(to: string, content: EmailContent, requireSmtp = false): Promise<SendResult> {
    if (requireSmtp && (!isSmtpConfigured || !env.SMTP_USER || !env.SMTP_PASSWORD)) {
      return { sent: false, code: 'SMTP_NOT_CONFIGURED' };
    }
    try {
      const info = await getTransporter().sendMail({
        from: env.SMTP_FROM,
        to,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
      if (!isSmtpConfigured) {
        logger.info(`[email:dev] to=${to} subject="${content.subject}"\n${content.text}`);
        return { sent: !requireSmtp };
      }
      const accepted = (info.accepted as string[] | undefined) ?? [];
      if (!accepted.some((address) => address.toLowerCase() === to.toLowerCase())) {
        logger.warn(`SMTP did not accept recipient ${to}`);
        return { sent: false, code: 'SMTP_REJECTED' };
      }
      return { sent: true };
    } catch (err) {
      // Do not send raw SMTP errors to the UI, history, or logs (could contain secrets).
      logger.error(`SMTP delivery failed for ${to}: ${err instanceof Error ? err.name : 'Unknown error'}`);
      return { sent: false, code: 'SMTP_ERROR' };
    }
  },

  /** Existing interface for automatic reminders and transactional emails. */
  async send(to: string, content: EmailContent): Promise<boolean> {
    return (await this.sendDetailed(to, content)).sent;
  },
};
