import crypto from "crypto"
import { env } from "../config/env"

export const OTP_TTL_MS = 10 * 60 * 1000
export const OTP_MAX_ATTEMPTS = 5
export const RESEND_COOLDOWN_MS = 60 * 1000
export const MAX_SENDS_PER_WINDOW = 5
export const SEND_WINDOW_MS = 60 * 60 * 1000

export const generateOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0")

/* 6 digit er space chhoto, tai plain hash na, server secret diye HMAC */
export const hashOtp = (email: string, otp: string) =>
  crypto.createHmac("sha256", env.OTP_SECRET).update(`${email}:${otp}`).digest("hex")

export const otpMatches = (email: string, otp: string, storedHash: string) => {
  const a = Buffer.from(hashOtp(email, otp), "hex")
  const b = Buffer.from(storedHash, "hex")
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}