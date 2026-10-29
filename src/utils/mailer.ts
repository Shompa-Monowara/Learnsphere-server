import nodemailer from "nodemailer"
import { env } from "../config/env"

/* Brevo (HTTP API) thakle seta use hobe: hosting platform SMTP port block korleo kaj kore.
   Na thakle SMTP (local/dev), SMTP o na thakle dev e console e print. */
const BREVO_API_KEY = process.env.BREVO_API_KEY

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    })
  : null

/* MAIL_FROM: `LearnSphere <you@gmail.com>` ba shudhu `you@gmail.com` */
function parseSender(from: string): { name?: string; email: string } {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1].trim() || undefined, email: m[2].trim() }
  return { email: from.trim() }
}

async function sendViaBrevo(to: string, subject: string, text: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY as string,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: parseSender(env.MAIL_FROM),
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    console.error(`[mail:brevo] ${res.status} ${body}`)
    throw new Error("Could not send email. Please try again later")
  }
}

export async function sendMail(to: string, subject: string, text: string) {
  if (BREVO_API_KEY) return sendViaBrevo(to, subject, text)

  if (!transporter) {
    if (env.NODE_ENV === "production") throw new Error("Mail is not configured")
    console.log(`[mail:dev] to=${to} subject=${subject}\n${text}`)
    return
  }

  try {
    await transporter.sendMail({ from: env.MAIL_FROM, to, subject, text })
  } catch (err) {
    console.error("[mail:smtp] failed:", err)
    throw new Error("Could not send email. Please try again later")
  }
}