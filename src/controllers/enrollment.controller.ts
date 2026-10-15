import crypto from "crypto"
import { Types } from "mongoose"
import Course from "../models/Course"
import Enrollment from "../models/Enrollment"
import Transaction from "../models/Transaction"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"
import { isOwnerOrAdmin, issueCertificate, notify } from "../utils/helpers"

export const enroll = asyncHandler(async (req, res) => {
  const user = req.user!
  const course = await Course.findById(req.params.courseId)
  if (!course || course.status !== "published") throw new ApiError(404, "Course not found")
  if (String(course.instructor) === String(user._id)) throw new ApiError(400, "You cannot enroll in your own course")
  if (await Enrollment.exists({ student: user._id, course: course._id })) {
    throw new ApiError(409, "Already enrolled in this course")
  }

  const amount = course.discountPrice ?? course.price
  if (amount > 0) {
    // Payment gateway (Stripe / SSLCommerz) should be verified here before continuing.
    await Transaction.create({
      transactionId: `TXN-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
      user: user._id,
      instructor: course.instructor,
      course: course._id,
      amount,
    })
  }

  const enrollment = await Enrollment.create({ student: user._id, course: course._id })
  await Course.findByIdAndUpdate(course._id, { $inc: { studentsCount: 1 } })
  await notify(course.instructor, "New enrollment", `${user.name} enrolled in "${course.title}".`, "/teacher/students")
  res.status(201).json({ enrollment })
})

export const getMyEnrollments = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ student: req.user!._id })
    .populate({
      path: "course",
      select: "title thumbnail lessonsCount totalDuration instructor category",
      populate: [
        { path: "instructor", select: "name avatar" },
        { path: "category", select: "name" },
      ],
    })
    .sort("-updatedAt")

  res.json({
    enrollments: enrollments.map((e) => ({
      ...e.toObject(),
      status: e.progress >= 100 ? "completed" : e.progress > 0 ? "in-progress" : "not-started",
    })),
  })
})

export const getLearningData = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId).populate("instructor", "name avatar")
  if (!course) throw new ApiError(404, "Course not found")
  const privileged = isOwnerOrAdmin(course, req.user!)
  const enrollment = await Enrollment.findOne({ student: req.user!._id, course: course._id })
  if (!enrollment && !privileged) throw new ApiError(403, "You are not enrolled in this course")
  res.json({ course, enrollment })
})

export const completeLesson = asyncHandler(async (req, res) => {
  const { courseId, lessonId } = req.params
  const user = req.user!
  const course = await Course.findById(courseId)
  if (!course) throw new ApiError(404, "Course not found")
  const enrollment = await Enrollment.findOne({ student: user._id, course: courseId })
  if (!enrollment) throw new ApiError(403, "You are not enrolled in this course")

  const exists = course.sections.some((s) => (s.lessons as any).id(lessonId))
  if (!exists) throw new ApiError(404, "Lesson not found")

  if (!enrollment.completedLessons.some((l) => String(l.lesson) === lessonId)) {
    enrollment.completedLessons.push({ lesson: new Types.ObjectId(lessonId), completedAt: new Date() })
  }
  const total = course.lessonsCount || 1
  enrollment.progress = Math.min(100, Math.round((enrollment.completedLessons.length / total) * 100))

  let certificate = null
  if (enrollment.progress >= 100 && !enrollment.completedAt) {
    enrollment.completedAt = new Date()
    certificate = await issueCertificate(user._id, course)
  }
  await enrollment.save()
  res.json({ enrollment, certificate })
})

export const getCourseStudents = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId)
  if (!course) throw new ApiError(404, "Course not found")
  if (!isOwnerOrAdmin(course, req.user!)) throw new ApiError(403, "Not your course")
  const students = await Enrollment.find({ course: course._id })
    .populate("student", "name email avatar")
    .select("student progress completedAt updatedAt createdAt")
    .sort("-createdAt")
  res.json({ students })
})

export const getMyStudents = asyncHandler(async (req, res) => {
  const courses = await Course.find({ instructor: req.user!._id }).select("_id")
  const q = String(req.query.q || "").toLowerCase()
  let students = await Enrollment.find({ course: { $in: courses.map((c) => c._id) } })
    .populate("student", "name email avatar")
    .populate("course", "title")
    .sort("-createdAt")
  if (q) students = students.filter((e: any) => e.student?.name.toLowerCase().includes(q))
  res.json({ students })
})