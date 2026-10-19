import crypto from "crypto"
import jwt from "jsonwebtoken"
import type { CookieOptions, Request, Response } from "express"
import { env } from "../config/env"

const COOKIE = "oauth_state"

export interface OAuthIntent {
  provider: "google" | "github"
  mode: "login" | "register"
  role: "student" | "teacher"
  nonce: string
  verifier?: string
}

/* Path "/api/auth" karon routes "/api" er niche mount kora */
const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth",
}

export function startState(
  res: Response,
  intent: Omit<OAuthIntent, "nonce" | "verifier">,
  withPkce = false
) {
  const nonce = crypto.randomBytes(24).toString("base64url")
  const verifier = withPkce ? crypto.randomBytes(32).toString("base64url") : undefined
  const token = jwt.sign({ ...intent, nonce, verifier }, env.OTP_SECRET, { expiresIn: "10m" })
  res.cookie(COOKIE, token, { ...cookieOptions, maxAge: 10 * 60 * 1000 })
  const challenge = verifier
    ? crypto.createHash("sha256").update(verifier).digest("base64url")
    : undefined
  return { state: nonce, challenge }
}

export function readState(
  req: Request,
  res: Response,
  provider: OAuthIntent["provider"],
  state: string
): OAuthIntent | null {
  const raw = req.headers.cookie
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1)
  res.clearCookie(COOKIE, cookieOptions) // ek-bar-i use
  if (!raw || !state) return null
  try {
    const payload = jwt.verify(raw, env.OTP_SECRET) as OAuthIntent
    const a = Buffer.from(payload.nonce)
    const b = Buffer.from(state)
    if (payload.provider !== provider || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    return payload
  } catch {
    return null
  }
}