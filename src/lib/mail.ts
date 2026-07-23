import nodemailer from "nodemailer";

const globalForMailer = globalThis as unknown as { mailer?: nodemailer.Transporter };

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export const mailer = globalForMailer.mailer || createTransporter();

if (process.env.NODE_ENV !== "production") globalForMailer.mailer = mailer;

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}

export async function sendMail(options: SendMailOptions) {
  return mailer.sendMail({
    from: `"Smile Passport" <${process.env.SMTP_USER}>`,
    ...options,
  });
}
