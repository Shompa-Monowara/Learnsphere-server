import Assignment from "../models/Assignment"
import Course from "../models/Course"
import Enrollment from "../models/Enrollment"
import Quiz from "../models/Quiz"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"
import { escapeRegex, isOwnerOrAdmin, notifyAdmins, pick } from "../utils/helpers"

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

export const getCourses = asyncHandler(async (req, res) => {
  const { q, category, level, price, minRating, instructor, sort = "newest" } = req.query as Record<string, string>
  const page = Math.max(parseInt(req.query.page as string) || 1, 1)
  const limit = Math.min(parseInt(req.query.limit as string) || 9, 50)

  const filter: Record<string, any> = { status: "published" }
  if (q) filter.title = { $regex: escapeRegex(q), $options: "i" }
  if (category) filter.category = category
  if (level) filter.level = level
  if (instructor) filter.instructor = instructor
  if (minRating) filter.ratingAvg = { $gte: Number(minRating) }
  if (price === "free") filter.price = 0
  if (price === "paid") filter.price = { $gt: 0 }

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .select("-sections")
      .populate("instructor", "name avatar")
      .populate("category", "name slug")
      .sort(SORTS[sort] || SORTS.newest)
      .skip((page - 1) * limit)
      .limit(limit),
    Course.countDocuments(filter),
  ])

  res.json({ courses, total, page, pages: Math.ceil(total / limit) })
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

export const updateCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id)
  if (!course) throw new ApiError(404, "Course not found")
  if (!isOwnerOrAdmin(course, req.user!)) throw new ApiError(403, "Not your course")
  Object.assign(course, pick(req.body, FIELDS))
  await course.save()
  res.json({ course })
})

export const updateCurriculum = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id)
  if (!course) throw new ApiError(404, "Course not found")
  if (!isOwnerOrAdmin(course, req.user!)) throw new ApiError(403, "Not your course")
  if (!Array.isArray(req.body.sections)) throw new ApiError(400, "sections must be an array")
  course.set("sections", req.body.sections)
  await course.save()
  res.json({ course })
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