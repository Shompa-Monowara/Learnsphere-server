import Course from "../models/Course"
import Enrollment from "../models/Enrollment"
import Transaction from "../models/Transaction"
import User from "../models/User"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"
import { escapeRegex, notify } from "../utils/helpers"

const sixMonthsAgo = (): Date => {
  const d = new Date()
  d.setMonth(d.getMonth() - 5, 1)
  d.setHours(0, 0, 0, 0)
  return d
}

const byMonth = (
  model: { aggregate: (...args: any[]) => any },
  extra: Record<string, any> = {},
  sum?: string
) =>
  model.aggregate([
    { $match: { createdAt: {$gte: sixMonthsAgo() }, ...extra } },
    {
      $group: {
        _id: { $dateToString: { format: "\%Y-\%m", date: "$createdAt" } },
        value: sum ? { $sum: sum } : { $sum: 1 },       },     },     {$sort: { _id: 1 } },
  ])

export const getStats = asyncHandler(async (_req, res) => {
  const [
    users,
    courses,
    enrollments,
    revenue,
    userGrowth,
    revenueTrend,
    enrollmentTrend,
    recentUsers,
    recentEnrollments,
    topCourses,
  ] = await Promise.all([
    User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
    Course.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Enrollment.countDocuments(),
    Transaction.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    byMonth(User),
    byMonth(Transaction, { status: "paid" }, "$amount"),
    byMonth(Enrollment),
    User.find().sort("-createdAt").limit(5).select("name role createdAt"),
    Enrollment.find()
      .sort("-createdAt")
      .limit(5)
      .populate("student", "name")
      .populate("course", "title"),
    Course.find({ status: "published" })
      .sort("-studentsCount")
      .limit(5)
      .select("title studentsCount ratingAvg"),
  ])

  const fmt = (arr: any[]) => arr.map((a) => ({ month: a._id, value: a.value }))

  res.json({
    stats: {
      users: users.reduce((n: number, u: any) => n + u.count, 0),
      usersByRole: Object.fromEntries(users.map((u: any) => [u._id, u.count])),
      courses: courses.reduce((n: number, c: any) => n + c.count, 0),
      coursesByStatus: Object.fromEntries(courses.map((c: any) => [c._id, c.count])),
      enrollments,
      revenue: revenue[0]?.total || 0,
    },
    userGrowth: fmt(userGrowth),
    revenueTrend: fmt(revenueTrend),
    enrollmentTrend: fmt(enrollmentTrend),
    topCourses,
    recentActivity: { users: recentUsers, enrollments: recentEnrollments },
  })
})

export const getUsers = asyncHandler(async (req, res) => {
  const { q, role, status } = req.query as Record<string, string>
  const page = Math.max(parseInt(req.query.page as string) || 1, 1)
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100)

  const filter: Record<string, any> = {}
  if (q) {
    const re = { $regex: escapeRegex(q),$options: "i" }
    filter.$or = [{ name: re }, { email: re }]
  }
  if (role) filter.role = role
  if (status === "blocked") filter.isBlocked = true
  if (status === "active") filter.isBlocked = false

  const [users, total] = await Promise.all([
    User.find(filter).sort("-createdAt").skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ])
  res.json({ users, total, page, pages: Math.ceil(total / limit) })
})

export const toggleBlock = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) throw new ApiError(404, "User not found")
  if (user.role === "admin") throw new ApiError(400, "Admin accounts cannot be blocked")
  user.isBlocked = !user.isBlocked
  await user.save()
  res.json({ user })
})

export const changeRole = asyncHandler(async (req, res) => {
  const { role } = req.body
  if (!["student", "teacher", "admin"].includes(role)) throw new ApiError(400, "Invalid role")
  if (String(req.params.id) === String(req.user!._id))
    throw new ApiError(400, "You cannot change your own role")
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true })
  if (!user) throw new ApiError(404, "User not found")
  res.json({ user })
})

export const getAdminCourses = asyncHandler(async (req, res) => {
  const filter: Record<string, any> = req.query.status ? { status: req.query.status } : {}
  const courses = await Course.find(filter)
    .select("-sections")
    .populate("instructor", "name email")
    .populate("category", "name")
    .sort("-updatedAt")
  res.json({ courses })
})

export const moderateCourse = asyncHandler(async (req, res) => {
  const { action, reason } = req.body
  const course = await Course.findById(req.params.id)
  if (!course) throw new ApiError(404, "Course not found")

  if (action === "approve") {
    course.status = "published"
    course.rejectionReason = undefined
  } else if (action === "reject") {
    if (!reason) throw new ApiError(400, "A rejection reason is required")
    course.status = "rejected"
    course.rejectionReason = reason
  } else if (action === "unpublish") {
    course.status = "unpublished"
  } else {
    throw new ApiError(400, "Action must be approve, reject, or unpublish")
  }
  await course.save()

  await notify(
    course.instructor,
    `Course ${course.status}`,
    `"${course.title}" is now ${course.status}.${reason ? ` Reason: ${reason}` : ""}`,
    "/teacher/courses"
  )
  res.json({ course })
})

export const getTransactions = asyncHandler(async (req, res) => {
  const status = req.query.status as string | undefined
  const filter: Record<string, any> = status ? { status } : {}

  const transactions = await Transaction.find(filter)
    .populate("user", "name email")
    .populate("course", "title")
    .sort("-createdAt")
    .limit(200)

  res.json({ transactions })
})