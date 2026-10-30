import crypto from "crypto"
import { env } from "../config/env"
import Subscriber from "../models/Subscriber"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"
import { escapeRegex } from "../utils/helpers"
import { sendMail } from "../utils/mailer"

const STATUSES = ["active", "unsubscribed"] as const

/* Welcome email. Fail holeo subscribe fail hobe na, shudhu log hobe */
function sendWelcome(email: string, token: string) {
  const link = `${env.CLIENT_URL}/unsubscribe/${token}`
  const text = [
    "Welcome to the LearnSphere newsletter!",
    "",
    "You will get course ideas and teaching tips about twice a month. No spam, ever.",
    "",
    `Unsubscribe in one click: ${link}`,
  ].join("\n")
  sendMail(email, "Welcome to the LearnSphere newsletter", text).catch((err) =>
    console.error("[newsletter] welcome mail failed:", err instanceof Error ? err.message : err)
  )
}

/* Public: newsletter subscribe.
   Email age theke thakuk ba na thakuk, response ek-i: keu dekhe bujhte parbe na kon email registered. */
export const subscribe = asyncHandler(async (req, res) => {
  const { email } = req.body as { email: string }

  const existing = await Subscriber.findOne({ email })
  if (existing) {
    if (existing.status === "unsubscribed") {
      existing.status = "active"
      existing.unsubscribedAt = undefined
      await existing.save()
      sendWelcome(existing.email, existing.unsubscribeToken)
    }
  } else {
    try {
      const created = await Subscriber.create({
        email,
        unsubscribeToken: crypto.randomBytes(24).toString("hex"),
      })
      sendWelcome(created.email, created.unsubscribeToken)
    } catch (err) {
      /* Duplicate (2ta request ek shathe ashle) hole ignore, baki error throw */
      if ((err as { code?: number }).code !== 11000) throw err
    }
  }

  res.status(201).json({ message: "Thanks, you are subscribed." })
})

/* Public: email er link theke unsubscribe (token diye, idempotent) */
export const unsubscribe = asyncHandler(async (req, res) => {
  const token = String(req.params.token || "")
  if (!/^[a-f0-9]{48}$/.test(token)) throw new ApiError(400, "This unsubscribe link is not valid")

  const sub = await Subscriber.findOne({ unsubscribeToken: token })
  if (!sub) throw new ApiError(404, "This unsubscribe link is not valid")

  if (sub.status !== "unsubscribed") {
    sub.status = "unsubscribed"
    sub.unsubscribedAt = new Date()
    await sub.save()
  }

  res.json({ message: "You have been unsubscribed." })
})

/* Admin: subscriber list */
export const getSubscribers = asyncHandler(async (req, res) => {
  const { q, status } = req.query as Record<string, string | undefined>
  const page = Math.max(parseInt(req.query.page as string) || 1, 1)
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)

  const filter: Record<string, unknown> = {}
  if (q) filter.email = { $regex: escapeRegex(q), $options: "i" }
  if (status && (STATUSES as readonly string[]).includes(status)) filter.status = status

  const [subscribers, total, grouped] = await Promise.all([
    Subscriber.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("email status source createdAt unsubscribedAt")
      .lean(),
    Subscriber.countDocuments(filter),
    Subscriber.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ])

  const count = (s: string): number => grouped.find((g) => g._id === s)?.n ?? 0
  res.json({
    subscribers,
    total,
    page,
    pages: Math.max(Math.ceil(total / limit), 1),
    limit,
    summary: { total: count("active") + count("unsubscribed"), active: count("active"), unsubscribed: count("unsubscribed") },
  })
})