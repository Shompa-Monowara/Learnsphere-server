import PendingVerification from "../models/PendingVerification"
import User from "../models/User"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"
import { notifyAdmins } from "../utils/helpers"
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

const isDuplicateKey = (e: unknown) => (e as { code?: number })?.code === 11000
const tooSoon = () => new ApiError(429, "Please wait a minute before requesting another code")
const normEmail = (v: unknown) => String(v ?? "").trim().toLowerCase()

async function issueOtp(email: string) {
  const now = Date.now()
  const otp = generateOtp()
  const fresh = {
    otpHash: hashOtp(email, otp),
    attempts: 0,
    expiresAt: new Date(now + OTP_TTL_MS),
    lastSentAt: new Date(now),
  }
  const windowFields = { sendCount: 1, sendWindowStart: new Date(now), purgeAt: new Date(now + SEND_WINDOW_MS) }

  const existing = await PendingVerification.findOne({ email })
  if (!existing) {
    try {
      await PendingVerification.create({ email, ...fresh, ...windowFields })
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
    const updated = await PendingVerification.findOneAndUpdate(
      { email, lastSentAt: { $lte: new Date(now - RESEND_COOLDOWN_MS) } },
      {
        $set: windowOver ? { ...fresh, ...windowFields } : fresh,
        ...(windowOver ? {} : { $inc: { sendCount: 1 } }),
      },
      { returnDocument: "after" }
    )
    if (!updated) throw tooSoon()
  }

  await sendMail(
    email,
    "Your LearnSphere verification code",
    `Your verification code is ${otp}. It expires in ${OTP_TTL_MS / 60000} minutes.\n\nIf you did not request this, you can ignore this email.`
  )
}

const ensureEmailFree = async (email: string) => {
  if (await User.exists({ email })) throw new ApiError(409, "Email is already registered")
}

const sent = { message: "Verification code sent", expiresInSeconds: OTP_TTL_MS / 1000, resendAfterSeconds: RESEND_COOLDOWN_MS / 1000 }

/* POST /auth/register/request-otp  (body: registerSchema) */
export const requestOtp = asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email)
  await ensureEmailFree(email)
  await issueOtp(email)
  res.json(sent)
})

/* POST /auth/register/resend-otp  (body: { email }) */
export const resendOtp = asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email)
  await ensureEmailFree(email)
  await issueOtp(email)
  res.json(sent)
})

/* POST /auth/register/complete  (body: registerSchema + otp) */
export const complete = asyncHandler(async (req, res) => {
  const { name, password, role, otp } = req.body
  const email = normEmail(req.body.email)

  /* Fail hole sothik error message dewar jonno age record ta dekhe rakhi */
  const snapshot = await PendingVerification.findOne({ email }).lean()

  /* Attempt count atomic: parallel guess diye 5 er limit paar kora jabe na */
  const pending = await PendingVerification.findOneAndUpdate(
    { email, attempts: { $lt: OTP_MAX_ATTEMPTS }, expiresAt: { $gt: new Date() } },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" }
  )

  if (!pending) {
    if (!snapshot) throw new ApiError(400, "No active code found for this email. Please request a new code")
    if (snapshot.attempts >= OTP_MAX_ATTEMPTS) {
      throw new ApiError(400, "Too many incorrect attempts. Please request a new code")
    }
    throw new ApiError(400, "Code expired. Please request a new code")
  }

  if (!otpMatches(email, otp, pending.otpHash)) {
    const left = OTP_MAX_ATTEMPTS - pending.attempts
    throw new ApiError(400, left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left` : "Incorrect code. Please request a new one")
  }

  /* Code ekbar-i use hobe */
  const consumed = await PendingVerification.findOneAndDelete({ _id: pending._id, otpHash: pending.otpHash })
  if (!consumed) throw new ApiError(400, "Code is no longer valid. Please request a new one")

  await ensureEmailFree(email)
  try {
    /* Existing pre("save") hook ei password hash kore, tai plain password-i dewa */
    const user = await User.create({ name, email, password, role: role === "teacher" ? "teacher" : "student" })
    if (user.role === "teacher") {
      await notifyAdmins("New teacher joined", `${user.name} registered as a teacher.`, "/admin/users")
    }
    respond(res, 201, user)
  } catch (err) {
    if (isDuplicateKey(err)) throw new ApiError(409, "Email is already registered")
    throw err
  }
})