import "server-only";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || "HumanFlow <onboarding@resend.dev>";

function baseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Without a RESEND_API_KEY, emails are logged to the server console instead
 * of sent — lets auth flows work end-to-end in local dev with no account.
 */
async function send(to: string, subject: string, html: string, plainLink: string): Promise<void> {
  if (!resend) {
    console.log(`\n[email:mock] To: ${to}\nSubject: ${subject}\nLink: ${plainLink}\n`);
    return;
  }
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) throw new Error(`Resend send failed: ${error.message}`);
}

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  const link = `${baseUrl()}/verify-email?token=${token}`;
  await send(
    to,
    "Verify your HumanFlow email",
    `<p>Hi ${name},</p><p>Confirm your email to finish setting up HumanFlow:</p><p><a href="${link}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
    link,
  );
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const link = `${baseUrl()}/reset-password?token=${token}`;
  await send(
    to,
    "Reset your HumanFlow password",
    `<p>Hi ${name},</p><p>Reset your password:</p><p><a href="${link}">Reset password</a></p><p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
    link,
  );
}

export async function sendQuotaNudgeEmail(
  to: string,
  name: string,
  wordsUsed: number,
  limit: number,
): Promise<void> {
  const pct = Math.round((wordsUsed / limit) * 100);
  const link = `${baseUrl()}/dashboard`;
  await send(
    to,
    `You've used ${pct}% of your monthly words`,
    `<p>Hi ${name},</p><p>You've used ${wordsUsed.toLocaleString()} of ${limit.toLocaleString()} words this cycle (${pct}%). When you hit the limit, humanizing pauses until your window resets.</p><p>Upgrade to keep going without interruption:</p><p><a href="${link}">View plans</a></p>`,
    link,
  );
}
