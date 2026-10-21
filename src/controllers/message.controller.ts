import { Types } from "mongoose"
import Course from "../models/Course"
import Enrollment from "../models/Enrollment"
import Message from "../models/Message"
import User from "../models/User"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"
import { CHAT_MIME_TYPES } from "../middlewares/upload"
import { uploadBuffer } from "./upload.controller"

/* Conversation list e last message preview: text na thakle attachment er naam */
const previewOf = (m: any): string =>
  m?.text || (m?.attachment ? (m.attachment.kind === "image" ? "📷 Photo" : `📄 ${m.attachment.name}`) : "")

interface Contact {
  _id: string
  name: string
  avatar: string
  role: string
  subtitle: string
}

export const getConversations = asyncHandler(async (req, res) => {
  const me = req.user!
  const contacts = new Map<string, Contact>()

  
  if (me.role === "student") {
    const enrollments: any[] = await Enrollment.find({ student: me._id }).populate({
      path: "course",
      select: "title instructor",
      populate: { path: "instructor", select: "name avatar role" },
    })
    for (const e of enrollments) {
      const ins = e.course?.instructor
      if (ins && !contacts.has(String(ins._id))) {
        contacts.set(String(ins._id), {
          _id: String(ins._id),
          name: ins.name,
          avatar: ins.avatar || "",
          role: ins.role,
          subtitle: `Instructor · ${e.course.title}`,
        })
      }
    }
  } else if (me.role === "teacher") {
    const courses = await Course.find({ instructor: me._id }).select("_id")
    const enrollments: any[] = await Enrollment.find({ course: { $in: courses.map((c) => c._id) } })
      .populate("student", "name avatar role")
      .populate("course", "title")
    for (const e of enrollments) {
      const st = e.student
      if (st && !contacts.has(String(st._id))) {
        contacts.set(String(st._id), {
          _id: String(st._id),
          name: st.name,
          avatar: st.avatar || "",
          role: st.role,
          subtitle: `Student · ${e.course?.title ?? ""}`,
        })
      }
    }
  }

  const messages: any[] = await Message.find({ $or: [{ sender: me._id }, { receiver: me._id }] })
    .sort("-createdAt")
    .populate("sender receiver", "name avatar role")

  const last = new Map<string, any>()
  const unread = new Map<string, number>()
  for (const m of messages) {
    if (!m.sender || !m.receiver) continue
    const mine = String(m.sender._id) === String(me._id)
    const other = mine ? m.receiver : m.sender
    const key = String(other._id)
    if (!last.has(key)) last.set(key, m)
    if (!contacts.has(key)) {
      contacts.set(key, {
        _id: key,
        name: other.name,
        avatar: other.avatar || "",
        role: other.role,
        subtitle: other.role,
      })
    }
    if (!mine && !m.read) unread.set(key, (unread.get(key) || 0) + 1)
  }

  const conversations = [...contacts.values()]
    .map((c) => ({
      user: { _id: c._id, name: c.name, avatar: c.avatar, role: c.role },
      subtitle: c.subtitle,
      lastMessage: previewOf(last.get(c._id)),
      lastAt: last.get(c._id)?.createdAt || null,
      unread: unread.get(c._id) || 0,
    }))
    .sort((a, b) => (b.lastAt ? new Date(b.lastAt).getTime() : 0) - (a.lastAt ? new Date(a.lastAt).getTime() : 0))

  res.json({ conversations })
})

export const getThread = asyncHandler(async (req, res) => {
  const me = req.user!._id
  const other = String(req.params.userId)
  if (!Types.ObjectId.isValid(other)) throw new ApiError(400, "Invalid user")

  const partner = await User.findById(other).select("name avatar role")
  if (!partner) throw new ApiError(404, "User not found")

  const messages = await Message.find({
    $or: [
      { sender: me, receiver: other },
      { sender: other, receiver: me },
    ],
  })
    .sort("createdAt")
    .limit(200)

  await Message.updateMany({ sender: other, receiver: me, read: false }, { read: true })
  res.json({ partner, messages })
})

export const sendMessage = asyncHandler(async (req, res) => {
  const me = req.user!
  const other = String(req.params.userId)
  if (!Types.ObjectId.isValid(other)) throw new ApiError(400, "Invalid user")
  if (other === String(me._id)) throw new ApiError(400, "You cannot message yourself")

  const text = String(req.body.text || "").trim()
  if (text.length > 2000) throw new ApiError(400, "Message is too long")
  if (!text && !req.file) throw new ApiError(400, "Message cannot be empty")
  if (!(await User.exists({ _id: other }))) throw new ApiError(404, "User not found")

  let attachment: { url: string; name: string; kind: "image" | "pdf"; size: number } | undefined
  if (req.file) {
    const kind = CHAT_MIME_TYPES[req.file.mimetype]
    if (!kind) throw new ApiError(400, "Only images and PDF files are allowed")
    const result = await uploadBuffer(req.file.buffer, "chat")
    attachment = {
      url: result.secure_url,
      /* multer filename latin1 e pore, tai utf8 e convert (Bangla naam er jonno) */
      name: Buffer.from(req.file.originalname, "latin1").toString("utf8").slice(0, 120),
      kind,
      size: req.file.size,
    }
  }

  const message = await Message.create({ sender: me._id, receiver: other, text, attachment })
  res.status(201).json({ message })
})