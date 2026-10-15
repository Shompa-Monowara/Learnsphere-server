import { Types } from "mongoose"
import Course from "../models/Course"
import Review from "../models/Review"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"
import { ensureEnrolled, isOwnerOrAdmin, notify } from "../utils/helpers"

const recalc = async (courseId: Types.ObjectId) => {
  const [s] = await Review.aggregate([
    { $match: { course: courseId } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ])
  await Course.findByIdAndUpdate(courseId, {
    ratingAvg: s ? Number(s.avg.toFixed(1)) : 0,
    ratingCount: s ? s.count : 0,
  })
}

export const getCourseReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ course: req.params.courseId })
    .populate("student", "name avatar")
    .sort("-createdAt")
  const breakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }))
  res.json({ reviews, breakdown })
})

export const upsertReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body
  if (!rating || rating < 1 || rating > 5) throw new ApiError(400, "Rating must be between 1 and 5")
  const course = await Course.findById(req.params.courseId)
  if (!course) throw new ApiError(404, "Course not found")
  await ensureEnrolled(req.user!._id, course._id)

  const review = await Review.findOneAndUpdate(
    { course: course._id, student: req.user!._id },
    { rating, comment },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
  await recalc(course._id)
  await notify(course.instructor, "New review", `${req.user!.name} rated "${course.title}" ${rating}/5.`, "/teacher/reviews")
  res.status(201).json({ review })
})

export const replyToReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id)
  if (!review) throw new ApiError(404, "Review not found")
  const course = await Course.findById(review.course)
  if (!course || !isOwnerOrAdmin(course, req.user!)) throw new ApiError(403, "Not your course")
  review.reply = req.body.reply || ""
  await review.save()
  res.json({ review })
})

export const getTeacherReviews = asyncHandler(async (req, res) => {
  const courses = await Course.find({ instructor: req.user!._id }).select("_id")
  const reviews = await Review.find({ course: { $in: courses.map((c) => c._id) } })
    .populate("student", "name avatar")
    .populate("course", "title")
    .sort("-createdAt")
  res.json({ reviews })
})