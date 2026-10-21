import crypto from "crypto"
import jwt from "jsonwebtoken"
import type { SignOptions } from "jsonwebtoken"
import type { Response } from "express"
import { env } from "../config/env"
import User from "../models/User"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"

export const sign = (id: unknown): string =>
  jwt.sign({ id }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] })

export const respond = (res: Response, status: number, user: InstanceType<typeof User>) => {
  const { password, resetToken, resetExpires, ...safe } = user.toObject()
  res.status(status).json({ token: sign(user._id), user: safe })
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body
  if (await User.findOne({ email })) throw new ApiError(409, "Email is already registered")

  const user = await User.create({ name, email, password, role: role === "teacher" ? "teacher" : "student" })
  respond(res, 201, user)
})

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  const user = await User.findOne({ email }).select("+password")
  if (!user || !(await user.comparePassword(password))) throw new ApiError(401, "Invalid email or password")
  if (user.isBlocked) throw new ApiError(403, "Your account has been blocked")
  respond(res, 200, user)
})

export const getMe = asyncHandler(async (req, res) => {
  res.json({ user: req.user })
})

export const updateMe = asyncHandler(async (req, res) => {
  const user = req.user!
  const { name, bio, headline, website, avatar } = req.body
  if (name !== undefined) user.name = name
  if (bio !== undefined) user.bio = bio
  if (headline !== undefined) user.headline = headline
  if (website !== undefined) user.website = String(website).trim().slice(0, 200)
  if (avatar !== undefined) user.avatar = avatar
  await user.save()
  res.json({ user })
})

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!newPassword || newPassword.length < 6) throw new ApiError(400, "New password must be at least 6 characters")
  const user = await User.findById(req.user!._id).select("+password")
  if (!user || !(await user.comparePassword(currentPassword || ""))) {
    throw new ApiError(400, "Current password is incorrect")
  }
  user.password = newPassword
  await user.save()
  res.json({ message: "Password updated" })
})

export const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").toLowerCase()
  const user = await User.findOne({ email })
  if (user) {
    const token = crypto.randomBytes(32).toString("hex")
    user.resetToken = crypto.createHash("sha256").update(token).digest("hex")
    user.resetExpires = new Date(Date.now() + 30 * 60 * 1000)
    await user.save()
    // TODO: send this link by email (Nodemailer / Resend). Logged for development.
    console.log(`Password reset link: ${env.CLIENT_URL}/reset-password/${token}`)
  }
  res.json({ message: "If the email exists, a reset link has been sent" })
})

export const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body
  if (!password || password.length < 6) throw new ApiError(400, "Password must be at least 6 characters")
  const hashed = crypto.createHash("sha256").update(String(req.params.token)).digest("hex")
  const user = await User.findOne({ resetToken: hashed, resetExpires: { $gt: new Date() } }).select(
    "+resetToken +resetExpires"
  )
  if (!user) throw new ApiError(400, "Reset link is invalid or has expired")
  user.password = password
  user.resetToken = undefined
  user.resetExpires = undefined
  await user.save()
  res.json({ message: "Password has been reset" })
})