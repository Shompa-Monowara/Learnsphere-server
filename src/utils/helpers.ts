import crypto from "crypto"
import Certificate from "../models/Certificate"
import Enrollment from "../models/Enrollment"
import Notification from "../models/Notification"
import ApiError from "./ApiError"

export const slugify = (text: string): string =>
  text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

export const escapeRegex = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export const pick = (obj: Record<string, any>, keys: string[]): Record<string, any> =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]))

export const notify = (user: any, title: string, message: string, link = "") =>
  Notification.create({ user, title, message, link }).catch(() => null)

export const isOwnerOrAdmin = (course: { instructor: any }, user: { _id: any; role: string }): boolean =>
  user.role === "admin" ||
  String(course.instructor?._id ?? course.instructor) === String(user._id)

export async function ensureEnrolled(studentId: any, courseId: any) {
  const enrollment = await Enrollment.findOne({ student: studentId, course: courseId })
  if (!enrollment) throw new ApiError(403, "You are not enrolled in this course")
  return enrollment
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