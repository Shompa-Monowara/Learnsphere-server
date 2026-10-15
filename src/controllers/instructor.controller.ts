import Course from "../models/Course"
import User from "../models/User"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"
import { escapeRegex } from "../utils/helpers"

export const getInstructors = asyncHandler(async (req, res) => {
  const stats = await Course.aggregate([
    { $match: { status: "published" } },
    {
      $group: {
        _id: "$instructor",
        coursesCount: { $sum: 1 },
        studentsCount: { $sum: "$studentsCount" },
        rating: { $avg: "$ratingAvg" },
      },
    },
  ])

  const filter: Record<string, any> = { _id: { $in: stats.map((s) => s._id) }, isBlocked: false }
  if (req.query.q) filter.name = { $regex: escapeRegex(String(req.query.q)), $options: "i" }

  const users = await User.find(filter).select("name avatar headline bio").lean()
  const map = new Map(stats.map((s) => [String(s._id), s]))

  res.json({
    instructors: users.map((u) => {
      const s = map.get(String(u._id))
      return {
        ...u,
        coursesCount: s.coursesCount,
        studentsCount: s.studentsCount,
        rating: Number(s.rating.toFixed(1)),
      }
    }),
  })
})

export const getInstructor = asyncHandler(async (req, res) => {
  const instructor = await User.findOne({ _id: req.params.id, role: "teacher", isBlocked: false }).select(
    "name avatar headline bio createdAt"
  )
  if (!instructor) throw new ApiError(404, "Instructor not found")

  const courses = await Course.find({ instructor: instructor._id, status: "published" })
    .select("-sections")
    .populate("category", "name")

  res.json({
    instructor,
    courses,
    stats: {
      courses: courses.length,
      students: courses.reduce((n, c) => n + c.studentsCount, 0),
    },
  })
})