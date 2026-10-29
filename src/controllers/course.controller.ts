import { isValidObjectId } from "mongoose"
import Assignment from "../models/Assignment"
import Course from "../models/Course"
import Enrollment from "../models/Enrollment"
import Quiz from "../models/Quiz"
import User from "../models/User"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"
import { countProgress, escapeRegex, isOwnerOrAdmin, issueCertificate, notifyAdmins, pick } from "../utils/helpers"

const FIELDS = [
  "title", "shortDescription", "description", "category", "level", "language",
  "price", "discountPrice", "thumbnail", "previewVideo", "requirements", "outcomes",
]

const SORTS: Record<string, string> = {
  newest: "-createdAt",
  popular: "-studentsCount",
  rating: "-ratingAvg",
  "price-low": "price",
  "price-high": "-price",
}

/* Effective price = discountPrice thakle (ar price er cheye kom hole) seta, nahole price */
const EFFECTIVE_PRICE = { $min: [{ $ifNull: ["$discountPrice", "$price"] }, "$price"] }

/* Price bucket -> MongoDB condition (frontend FilterSidebar er sathe mile thakte hobe) */
const PRICE_BUCKETS: Record<string, any> = {
  free: { $expr: { $eq: [EFFECTIVE_PRICE, 0] } },
  under20: { $expr: { $and: [{ $gt: [EFFECTIVE_PRICE, 0] }, { $lt: [EFFECTIVE_PRICE, 20] }] } },
  "20to50": { $expr: { $and: [{ $gte: [EFFECTIVE_PRICE, 20] }, { $lte: [EFFECTIVE_PRICE, 50] }] } },
  over50: { $expr: { $gt: [EFFECTIVE_PRICE, 50] } },
}

/* Duration bucket -> totalDuration (seconds) range */
const DURATION_BUCKETS: Record<string, any> = {
  short: { totalDuration: { $lt: 2 * 3600 } },
  medium: { totalDuration: { $gte: 2 * 3600, $lte: 5 * 3600 } },
  long: { totalDuration: { $gt: 5 * 3600 } },
}

const csv = (v: unknown): string[] =>
  typeof v === "string" ? v.split(",").map((x) => x.trim()).filter(Boolean) : []

export const getCourses = asyncHandler(async (req, res) => {
  const { q, minRating, instructor, sort = "newest" } = req.query as Record<string, string>
  const page = Math.max(parseInt(req.query.page as string) || 1, 1)
  const limit = Math.min(parseInt(req.query.limit as string) || 9, 50)

  const categories = csv(req.query.category).filter((id) => isValidObjectId(id))
  const levels = csv(req.query.level).map((l) => l.toLowerCase())
  const prices = csv(req.query.price).filter((p) => PRICE_BUCKETS[p])
  const durations = csv(req.query.duration).filter((d) => DURATION_BUCKETS[d])

  const filter: Record<string, any> = { status: "published" }
  const and: Record<string, any>[] = []

  if (q?.trim()) {
    const rx = new RegExp(escapeRegex(q.trim()), "i")
    /* title + short description + instructor name — sob jaygay search hobe */
    const teachers = await User.find({ role: "teacher", name: rx }).select("_id").limit(100).lean()
    and.push({ $or: [{ title: rx }, { shortDescription: rx }, { instructor: { $in: teachers.map((t) => t._id) } }] })
  }
  if (categories.length) filter.category = { $in: categories }
  if (levels.length) filter.level = { $in: levels }
  if (instructor && isValidObjectId(instructor)) filter.instructor = instructor
  if (minRating && Number(minRating) > 0) filter.ratingAvg = { $gte: Number(minRating) }
  if (prices.length) and.push({ $or: prices.map((p) => PRICE_BUCKETS[p]) })
  if (durations.length) and.push({ $or: durations.map((d) => DURATION_BUCKETS[d]) })
  if (and.length) filter.$and = and

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .select("-sections")
      .populate("instructor", "name avatar")
      .populate("category", "name slug")
      .sort(`${SORTS[sort] || SORTS.newest} _id`)
      .skip((page - 1) * limit)
      .limit(limit),
    Course.countDocuments(filter),
  ])

  res.json({ courses, total, page, pages: Math.max(1, Math.ceil(total / limit)) })
})

export const getCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id)
    .populate("instructor", "name avatar bio headline")
    .populate("category", "name slug")
  if (!course) throw new ApiError(404, "Course not found")

  const user = req.user
  const owner = !!user && isOwnerOrAdmin(course, user)
  if (course.status !== "published" && !owner) throw new ApiError(404, "Course not found")

  let enrolled = false
  if (user && !owner) enrolled = !!(await Enrollment.exists({ student: user._id, course: course._id }))

  const data: any = course.toObject()
  if (!owner && !enrolled) {
    data.sections.forEach((s: any) =>
      s.lessons.forEach((l: any) => {
        if (!l.isPreview) delete l.url
      })
    )
  }
  res.json({ course: data, enrolled })
})

export const getMyCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find({ instructor: req.user!._id })
    .select("-sections")
    .populate("category", "name")
    .sort("-createdAt")
  res.json({ courses })
})

export const createCourse = asyncHandler(async (req, res) => {
  if (!req.body.title) throw new ApiError(400, "Course title is required")
  const course = await Course.create({ ...pick(req.body, FIELDS), instructor: req.user!._id })
  res.status(201).json({ course })
})

/* Published course teacher edit korle abar admin review lagbe (admin nijer edit korle lagbe na) */
const sendBackToReview = (course: { status: string; rejectionReason?: string | null }, role: string) => {
  if (course.status !== "published" || role === "admin") return false
  course.status = "pending"
  course.rejectionReason = undefined
  return true
}

export const updateCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id)
  if (!course) throw new ApiError(404, "Course not found")
  if (!isOwnerOrAdmin(course, req.user!)) throw new ApiError(403, "Not your course")
  Object.assign(course, pick(req.body, FIELDS))
  const backToReview = sendBackToReview(course, req.user!.role)
  await course.save()
  if (backToReview) await notifyAdmins("Course awaiting review", `"${course.title}" was edited and needs to be approved again.`, "/admin/courses")
  res.json({ course, sentBackToReview: backToReview })
})

export const updateCurriculum = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id)
  if (!course) throw new ApiError(404, "Course not found")
  if (!isOwnerOrAdmin(course, req.user!)) throw new ApiError(403, "Not your course")
  if (!Array.isArray(req.body.sections)) throw new ApiError(400, "sections must be an array")
  course.set("sections", req.body.sections)
  const backToReview = sendBackToReview(course, req.user!.role)
  await course.save()
  if (backToReview) await notifyAdmins("Course awaiting review", `"${course.title}" curriculum was edited and needs to be approved again.`, "/admin/courses")

  // lesson delete/add hole enrolled student der progress abar hisab kore nao
  const enrollments = await Enrollment.find({ course: course._id })
  for (const e of enrollments) {
    const { ids, progress } = countProgress(course, e.completedLessons)
    const valid = e.completedLessons.filter((c) => ids.has(String(c.lesson)))
    if (valid.length === e.completedLessons.length && progress === e.progress) continue
    e.set("completedLessons", valid)
    e.progress = progress
    if (progress >= 100 && !e.completedAt) {
      e.completedAt = new Date()
      await issueCertificate(e.student, course)
    }
    await e.save()
  }

  res.json({ course, sentBackToReview: backToReview })
})

export const submitForReview = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id)
  if (!course) throw new ApiError(404, "Course not found")
  if (!isOwnerOrAdmin(course, req.user!)) throw new ApiError(403, "Not your course")
  if (!course.lessonsCount) throw new ApiError(400, "Add at least one lesson before publishing")
  course.status = "pending"
  course.rejectionReason = undefined
  await course.save()
  await notifyAdmins("Course awaiting review", `"${course.title}" was submitted for moderation.`, "/admin/courses")
  res.json({ course })
})

export const deleteCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id)
  if (!course) throw new ApiError(404, "Course not found")
  if (!isOwnerOrAdmin(course, req.user!)) throw new ApiError(403, "Not your course")
  if (await Enrollment.exists({ course: course._id })) {
    throw new ApiError(400, "This course has enrolled students. Unpublish it instead.")
  }
  await Promise.all([
    Quiz.deleteMany({ course: course._id }),
    Assignment.deleteMany({ course: course._id }),
    course.deleteOne(),
  ])
  res.json({ message: "Course deleted" })
})