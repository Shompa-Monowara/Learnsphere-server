import { env } from "../config/env"
import LoginOtp from "../models/LoginOtp"
import User from "../models/User"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"
import { sendMail } from "../utils/mailer"
import {
  MAX_SENDS_PER_WINDOW,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
  SEND_WINDOW_MS,
  generateOtp,
  hashOtp,
  otpMatches,
} from "../utils/otp"
import { respond } from "./auth.controller"

/** seed.ts er demo account gulo. DEMO_SKIP_OTP=true hole shudhu eigulor OTP lage na */
const DEMO_EMAILS = new Set(["admin@learnsphere.com", "teacher@learnsphere.com", "student@learnsphere.com"])

const isDuplicateKey = (e: unknown) => (e as { code?: number })?.code === 11000
const tooSoon = () => new ApiError(429, "Please wait a minute before requesting another code")
const normEmail = (v: unknown) => String(v ?? "").trim().toLowerCase()

const sent = (resendAfterSeconds = RESEND_COOLDOWN_MS / 1000) => ({
  message: "Verification code sent",
  expiresInSeconds: OTP_TTL_MS / 1000,
  resendAfterSeconds,
})

/*
 * OTP toiri kore email pathay.
 * silentCooldown = true hole (login submit): cooldown cholle notun code pathai na,
 * age-er code-i valid thake, shudhu baki cooldown return kori.
 * false hole (resend button): cooldown cholle 429.
 */
async function issueOtp(email: string, name: string, silentCooldown: boolean): Promise<number> {
  const now = Date.now()
  const otp = generateOtp()
  const fresh = {
    otpHash: hashOtp(email, otp),
    attempts: 0,
    expiresAt: new Date(now + OTP_TTL_MS),
    lastSentAt: new Date(now),
  }
  const windowFields = { sendCount: 1, sendWindowStart: new Date(now), purgeAt: new Date(now + SEND_WINDOW_MS) }

  const existing = await LoginOtp.findOne({ email })
  if (!existing) {
    try {
      await LoginOtp.create({ email, ...fresh, ...windowFields })
    } catch (err) {
      if (isDuplicateKey(err)) throw tooSoon() // duita request ekshathe
      throw err
    }
  } else {
    const windowOver = now - existing.sendWindowStart.getTime() >= SEND_WINDOW_MS
    if (!windowOver && existing.sendCount >= MAX_SENDS_PER_WINDOW) {
      throw new ApiError(429, "Too many codes requested. Please try again later")
    }
    /* lastSentAt filter ta atomic cooldown: parallel request e ekta-i jite */
    const updated = await LoginOtp.findOneAndUpdate(
      { email, lastSentAt: { $lte: new Date(now - RESEND_COOLDOWN_MS) } },
      {
        $set: windowOver ? { ...fresh, ...windowFields } : fresh,
        ...(windowOver ? {} : { $inc: { sendCount: 1 } }),
      },
      { returnDocument: "after" }
    )
    if (!updated) {
      const stillValid = existing.expiresAt.getTime() > now && existing.attempts < OTP_MAX_ATTEMPTS
      if (silentCooldown && stillValid) {
        const left = existing.lastSentAt.getTime() + RESEND_COOLDOWN_MS - now
        return Math.max(1, Math.ceil(left / 1000))
      }
      throw tooSoon()
    }
  }

  await sendMail(
    email,
    "Your LearnSphere login code",
    `Hi ${name},\n\nYour login verification code is ${otp}. It expires in ${OTP_TTL_MS / 60000} minutes.\n\nIf you did not try to log in, please change your password.`
  )
  return RESEND_COOLDOWN_MS / 1000
}

/* POST /auth/login  (body: loginSchema)  -> password check kore OTP pathay, token dey na */
export const requestLoginOtp = asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email)
  const user = await User.findOne({ email }).select("+password")
  if (!user || !(await user.comparePassword(req.body.password))) throw new ApiError(401, "Invalid email or password")
  if (user.isBlocked) throw new ApiError(403, "Your account has been blocked")

  if (env.DEMO_SKIP_OTP && DEMO_EMAILS.has(email)) return respond(res, 200, user)

  const wait = await issueOtp(email, user.name, true)
  res.json(sent(wait))
})

/* POST /auth/login/resend-otp  (body: { email })  -> shudhu age login try korle-i resend hobe */
export const resendLoginOtp = asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email)
  if (!(await LoginOtp.exists({ email }))) throw new ApiError(400, "Session expired. Please login again")

  const user = await User.findOne({ email })
  if (!user || user.isBlocked) throw new ApiError(400, "Session expired. Please login again")

  await issueOtp(email, user.name, false)
  res.json(sent())
})

/* POST /auth/login/verify-otp  (body: { email, otp })  -> { token, user } */
export const verifyLoginOtp = asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email)
  const otp = String(req.body.otp ?? "")

  /* Fail hole sothik error message dewar jonno age record ta dekhe rakhi */
  const snapshot = await LoginOtp.findOne({ email }).lean()

  /* Attempt count atomic: parallel guess diye 5 er limit paar kora jabe na */
  const record = await LoginOtp.findOneAndUpdate(
    { email, attempts: { $lt: OTP_MAX_ATTEMPTS }, expiresAt: { $gt: new Date() } },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" }
  )

  if (!record) {
    if (!snapshot) throw new ApiError(400, "No active code found for this email. Please login again")
    if (snapshot.attempts >= OTP_MAX_ATTEMPTS) {
      throw new ApiError(400, "Too many incorrect attempts. Please request a new code")
    }
    throw new ApiError(400, "Code expired. Please request a new code")
  }

  if (!otpMatches(email, otp, record.otpHash)) {
    const left = OTP_MAX_ATTEMPTS - record.attempts
    throw new ApiError(400, left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left` : "Incorrect code. Please request a new one")
  }

  /* Code ekbar-i use hobe */
  const consumed = await LoginOtp.findOneAndDelete({ _id: record._id, otpHash: record.otpHash })
  if (!consumed) throw new ApiError(400, "Code is no longer valid. Please login again")

  const user = await User.findOne({ email })
  if (!user) throw new ApiError(400, "Account not found")
  if (user.isBlocked) throw new ApiError(403, "Your account has been blocked")

  respond(res, 200, user)
})