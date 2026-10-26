import crypto from "crypto"
import Certificate from "../models/Certificate"
import Enrollment from "../models/Enrollment"
import Notification from "../models/Notification"
import User from "../models/User"
import ApiError from "./ApiError"

export const slugify = (text: string): string =>
  text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

export const escapeRegex = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export const pick = (obj: Record<string, any>, keys: string[]): Record<string, any> =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]))

export const notify = (user: any, title: string, message: string, link = "") =>
  Notification.create({ user, title, message, link }).catch(() => null)

/* Shob admin ke ekshathe notification pathay */
export const notifyAdmins = async (title: string, message: string, link = "") => {
  try {
    const admins = await User.find({ role: "admin" }).select("_id").lean()
    if (!admins.length) return
    await Notification.insertMany(admins.map((a) => ({ user: a._id, title, message, link })))
  } catch {
    /* notification fail holeo main kaj thambe na */
  }
}

export const isOwnerOrAdmin = (course: { instructor: any }, user: { _id: any; role: string }): boolean =>
  user.role === "admin" ||
  String(course.instructor?._id ?? course.instructor) === String(user._id)

export async function ensureEnrolled(studentId: any, courseId: any) {
  const enrollment = await Enrollment.findOne({ student: studentId, course: courseId })
  if (!enrollment) throw new ApiError(403, "You are not enrolled in this course")
  return enrollment
}

/** course-e ekhon je lesson gulo ache shudhu sheigulo gune progress ber kore */
export function countProgress(course: { sections: any[] }, completed: { lesson: any }[]) {
  const ids = new Set<string>(course.sections.flatMap((s: any) => s.lessons.map((l: any) => String(l._id))))
  const done = completed.filter((c) => ids.has(String(c.lesson))).length
  const progress = ids.size ? Math.min(100, Math.round((done / ids.size) * 100)) : 0
  return { ids, done, total: ids.size, progress }
}

export async function issueCertificate(studentId: any, course: { _id: any; title: string }) {
  const existing = await Certificate.findOne({ student: studentId, course: course._id })
  if (existing) return existing
  const certificate = await Certificate.create({
    student: studentId,
    course: course._id,
    verificationId: `LS-${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
  })
  await notify(studentId, "Certificate earned", `You completed "${course.title}".`, "/student/certificates")
  return certificate
}