import { Types } from "mongoose"
import ContactMessage from "../models/ContactMessage"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"
import { escapeRegex, notifyAdmins } from "../utils/helpers"

const STATUSES = ["new", "read", "replied"] as const

/* Public: contact form submit */
export const createContactMessage = asyncHandler(async (req, res) => {
  const { name, email, subject, message, instructor } = req.body as {
    name: string
    email: string
    subject: string
    message: string
    instructor?: string
  }

  const saved = await ContactMessage.create({
    name,
    email,
    subject,
    message,
    instructor: instructor || "",
    user: req.user?._id,
  })

  const preview = message.length > 120 ? `${message.slice(0, 120)}…` : message
  await notifyAdmins(`New message: ${subject}`, `${name} (${email}): ${preview}`, "/admin/messages")

  res.status(201).json({
    message: "Thanks! A member of our team will reply within one business day.",
    id: saved._id,
  })
})

/* Contact page er shob text/details ekhane. Public endpoint. */
const CONTACT_INFO = {
  hero: {
    badge: "We reply in one business day",
    title: "Tell us how we can help",
    body: "Questions about a course, an instructor account or bringing your whole team onboard? Send a note and a real person from our team will get back to you — no ticket bots, no phone tree.",
  },
  email: { value: "hello@learnsphere.com", note: "General questions and instructor applications" },
  phone: { value: "+1 (415) 555-0142", note: "Mon–Fri, 9:00–18:00 Pacific" },
  address: { street: "214 Market Street, Suite 500", city: "San Francisco, CA 94105", note: "Tours by appointment" },
  hours: {
    timezone: "America/Los_Angeles",
    rows: [
      { label: "Monday – Friday", time: "9:00 – 18:00 PT", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], open: "09:00", close: "18:00" },
      { label: "Saturday", time: "10:00 – 14:00 PT", days: ["Sat"], open: "10:00", close: "14:00" },
      { label: "Sunday", time: "Closed", days: ["Sun"] },
    ],
  },
  response: { average: "2h 14m", note: "Email support is monitored 24/7." },
  help: {
    body: "Answers on enrollment, certificate verification, billing and instructor payouts — written and kept up to date by our support team.",
    links: ["How certificate verification works", "Moving a team onto LearnSphere", "Becoming an instructor"],
    to: "/faq",
  },
  teamBanner: {
    text: "Working on something bigger?",
    strong: "Team plans include onboarding and a named support contact.",
    cta: "See team plans",
    to: "/pricing",
  },
}

/* Public: contact page content */
export const getContactInfo = asyncHandler(async (_req, res) => {
  res.set("Cache-Control", "public, max-age=300")
  res.json(CONTACT_INFO)
})

/* Admin: inbox list */
export const getContactMessages = asyncHandler(async (req, res) => {
  const { q, status } = req.query as Record<string, string | undefined>
  const page = Math.max(parseInt(req.query.page as string) || 1, 1)
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50)

  const filter: Record<string, unknown> = {}
  if (q) {
    const re = { $regex: escapeRegex(q), $options: "i" }
    filter.$or = [{ name: re }, { email: re }, { subject: re }, { message: re }]
  }
  if (status && (STATUSES as readonly string[]).includes(status)) filter.status = status

  const [messages, total, grouped] = await Promise.all([
    ContactMessage.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ContactMessage.countDocuments(filter),
    ContactMessage.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ])

  const count = (s: string): number => grouped.find((g) => g._id === s)?.n ?? 0
  const summary = {
    total: count("new") + count("read") + count("replied"),
    new: count("new"),
    read: count("read"),
    replied: count("replied"),
  }

  res.json({
    messages,
    total,
    page,
    pages: Math.max(Math.ceil(total / limit), 1),
    limit,
    summary,
  })
})

/* Admin: status bodlano (new / read / replied) */
export const updateContactStatus = asyncHandler(async (req, res) => {
  const id = String(req.params.id)
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid message")

  const status = String(req.body.status || "")
  if (!(STATUSES as readonly string[]).includes(status)) throw new ApiError(400, "Invalid status")

  const message = await ContactMessage.findByIdAndUpdate(id, { status }, { new: true }).lean()
  if (!message) throw new ApiError(404, "Message not found")

  res.json({ message })
})

/* Admin: delete */
export const deleteContactMessage = asyncHandler(async (req, res) => {
  const id = String(req.params.id)
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid message")

  const message = await ContactMessage.findByIdAndDelete(id)
  if (!message) throw new ApiError(404, "Message not found")

  res.json({ message: "Message deleted" })
})