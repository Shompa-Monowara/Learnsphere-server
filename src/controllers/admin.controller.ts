import { Types } from "mongoose"
import AuthIdentity from "../models/AuthIdentity"
import Certificate from "../models/Certificate"
import Course from "../models/Course"
import Enrollment from "../models/Enrollment"
import Message from "../models/Message"
import Notification from "../models/Notification"
import OAuthCode from "../models/OAuthCode"
import Payout from "../models/Payout"
import QuizAttempt from "../models/QuizAttempt"
import Review from "../models/Review"
import Submission from "../models/Submission"
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
    { $match: { createdAt: { $gte: sixMonthsAgo() }, ...extra } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        value: sum ? { $sum: sum } : { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
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
    payouts,
    payoutTrend,
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
    Payout.aggregate([
      { $match: { status: { $in: ["pending", "paid"] } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    byMonth(Payout, { status: { $in: ["pending", "paid"] } }, "$amount"),
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
      payouts: payouts[0]?.total || 0,
    },
    userGrowth: fmt(userGrowth),
    revenueTrend: fmt(revenueTrend),
    enrollmentTrend: fmt(enrollmentTrend),
    payoutTrend: fmt(payoutTrend),
    topCourses,
    recentActivity: { users: recentUsers, enrollments: recentEnrollments },
  })
})

const USER_SORTS: Record<string, string> = {
  name: "name",
  role: "role",
  status: "isBlocked",
  courses: "coursesCount",
  joined: "createdAt",
}

export const getUsers = asyncHandler(async (req, res) => {
  const { q, role, status, sort, order } = req.query as Record<string, string>
  const page = Math.max(parseInt(req.query.page as string) || 1, 1)
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100)

  const filter: Record<string, any> = {}
  if (q) {
    const re = { $regex: escapeRegex(q), $options: "i" }
    filter.$or = [{ name: re }, { email: re }]
  }
  if (role && ["student", "teacher", "admin"].includes(role)) filter.role = role
  if (status === "blocked" || status === "suspended") filter.isBlocked = true
  if (status === "active") filter.isBlocked = { $ne: true }

  const sortField = USER_SORTS[sort] ?? "createdAt"
  const dir = order === "asc" ? 1 : order === "desc" ? -1 : USER_SORTS[sort] ? 1 : -1

  /* Teacher hole nijer banano course, student hole enrolled course gune dei */
  const countFrom = (from: string, field: string, as: string) => ({
    $lookup: {
      from,
      let: { uid: "$_id" },
      pipeline: [{ $match: { $expr: { $eq: [`$${field}`, "$$uid"] } } }, { $count: "n" }],
      as,
    },
  })

  const [users, total, grouped] = await Promise.all([
    User.aggregate([
      { $match: filter },
      countFrom(Course.collection.name, "instructor", "authored"),
      countFrom(Enrollment.collection.name, "student", "enrolled"),
      {
        $addFields: {
          coursesCount: {
            $switch: {
              branches: [
                { case: { $eq: ["$role", "teacher"] }, then: { $ifNull: [{ $arrayElemAt: ["$authored.n", 0] }, 0] } },
                { case: { $eq: ["$role", "student"] }, then: { $ifNull: [{ $arrayElemAt: ["$enrolled.n", 0] }, 0] } },
              ],
              default: 0,
            },
          },
        },
      },
      { $sort: { [sortField]: dir, _id: 1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $project: {
          name: 1,
          email: 1,
          role: 1,
          avatar: 1,
          headline: 1,
          bio: 1,
          isBlocked: 1,
          createdAt: 1,
          coursesCount: 1,
        },
      },
    ]).collation({ locale: "en", strength: 2 }),
    User.countDocuments(filter),
    User.aggregate([{ $group: { _id: { role: "$role", blocked: "$isBlocked" }, n: { $sum: 1 } } }]),
  ])

  const sum = (pred: (g: any) => boolean) =>
    grouped.filter(pred).reduce((n: number, g: any) => n + g.n, 0)

  res.json({
    users,
    total,
    page,
    pages: Math.ceil(total / limit),
    summary: {
      total: sum(() => true),
      students: sum((g) => g._id.role === "student"),
      teachers: sum((g) => g._id.role === "teacher"),
      admins: sum((g) => g._id.role === "admin"),
      suspended: sum((g) => g._id.blocked === true),
    },
  })
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

export const deleteUser = asyncHandler(async (req, res) => {
  const id = String(req.params.id)
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid user")
  if (id === String(req.user!._id)) throw new ApiError(400, "You cannot delete your own account")

  const user = await User.findById(id)
  if (!user) throw new ApiError(404, "User not found")
  if (user.role === "admin") throw new ApiError(400, "Admin accounts cannot be deleted")

  /* Teacher er course thakle delete kora jabe na, course gulo ekhane orphan hoye jabe */
  if (user.role === "teacher") {
    const owned = await Course.countDocuments({ instructor: user._id })
    if (owned > 0) {
      throw new ApiError(
        409,
        `This teacher has ${owned} course${owned === 1 ? "" : "s"}. Suspend the account instead, or remove their courses first.`
      )
    }
  }

  /* Course er student count ar rating thik rakhar jonno age kon course gulo affected ta mone rakhi */
  const [enrollments, reviews] = await Promise.all([
    Enrollment.find({ student: user._id }).select("course"),
    Review.find({ student: user._id }).select("course"),
  ])

  await Promise.all([
    Enrollment.deleteMany({ student: user._id }),
    Review.deleteMany({ student: user._id }),
    QuizAttempt.deleteMany({ student: user._id }),
    Submission.deleteMany({ student: user._id }),
    Certificate.deleteMany({ student: user._id }),
    Notification.deleteMany({ user: user._id }),
    Message.deleteMany({ $or: [{ sender: user._id }, { receiver: user._id }] }),
    AuthIdentity.deleteMany({ user: user._id }),
    OAuthCode.deleteMany({ user: user._id }),
    /* onno student er review e ei user "helpful" dile seta fire nei */
    Review.updateMany({ helpfulBy: user._id }, { $pull: { helpfulBy: user._id }, $inc: { helpful: -1 } }),
  ])

  const enrolledCourseIds = enrollments.map((e) => e.course)
  if (enrolledCourseIds.length > 0) {
    await Course.updateMany({ _id: { $in: enrolledCourseIds }, studentsCount: { $gt: 0 } }, { $inc: { studentsCount: -1 } })
  }

  for (const courseId of new Set(reviews.map((r) => String(r.course)))) {
    const [s] = await Review.aggregate([
      { $match: { course: new Types.ObjectId(courseId) } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ])
    await Course.findByIdAndUpdate(courseId, {
      ratingAvg: s ? Number(s.avg.toFixed(1)) : 0,
      ratingCount: s ? s.count : 0,
    })
  }

  /* Payment record gulo hishab er jonno rekhe dei */
  await user.deleteOne()
  res.json({ message: "User deleted" })
})

export const getAdminCourses = asyncHandler(async (req, res) => {
  /* Draft course admin er kaj e lage na, tai status na dile draft bad dei */
  const filter: Record<string, any> = req.query.status
    ? { status: req.query.status }
    : { status: { $ne: "draft" } }

  const [courses, grouped] = await Promise.all([
    Course.find(filter)
      .select("-sections")
      .populate("instructor", "name email avatar")
      .populate("category", "name")
      .sort("-updatedAt"),
    Course.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ])

  const counts = Object.fromEntries(grouped.map((g: any) => [g._id, g.count]))
  res.json({ courses, counts })
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