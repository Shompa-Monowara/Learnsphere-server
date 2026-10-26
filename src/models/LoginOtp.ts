import { Schema, model } from "mongoose"

const loginOtpSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  sendCount: { type: Number, default: 1 },
  sendWindowStart: { type: Date, default: Date.now },
  lastSentAt: { type: Date, default: Date.now },
  /* OTP kokhon expire: code-e check hoy (TTL monitor ~1 min deri kore) */
  expiresAt: { type: Date, required: true },
  /* Document kokhon delete hobe. Send window porjonto thake, jate OTP expire hole-i resend counter reset na hoy */
  purgeAt: { type: Date, required: true },
})

loginOtpSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 })

export default model("LoginOtp", loginOtpSchema)