import Assignment from "../models/Assignment"
import Certificate from "../models/Certificate"
import Course from "../models/Course"
import Enrollment from "../models/Enrollment"
import Review from "../models/Review"
import Submission from "../models/Submission"
import Transaction from "../models/Transaction"
import asyncHandler from "../utils/asyncHandler"

const monthsBack = (n: number): Date => {
  const d = new Date()
  d.setMonth(d.getMonth() - (n - 1), 1)
  d.setHours(0, 0, 0, 0)
  return d
}

export const studentDashboard = asyncHandler(async (req, res) => {
  const studentId = req.user!._id
  const enrollments = await Enrollment.find({ student: studentId }).populate(
    "course",
    "title thumbnail lessonsCount"
  )
  const courseIds = enrollments.map((e) => (e.course as any)?._id)

  const [assignments, submissions, certificates] = await Promise.all([
    Assignment.find({ course: { $in: courseIds } }).populate("course", "title").sort("dueDate"),
    Submission.find({ student: studentId }).select("assignment"),
    Certificate.countDocuments({ student: studentId }),
  ])
  const submitted = new Set(submissions.map((s) => String(s.assignment)))
  const pending = assignments.filter((a) => !submitted.has(String(a._id)))

  const since = new Date()
  since.setDate(since.getDate() - 6)
  since.setHours(0, 0, 0, 0)
  const activityRaw = await Enrollment.aggregate([
    { $match: { student: studentId } },
    { $unwind: "$completedLessons" },
    { $match: { "completedLessons.completedAt": { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$completedLessons.completedAt" } },
        lessons: { $sum: 1 },
      },
    },
  ])
  const activityMap = new Map<string, number>(activityRaw.map((a) => [a._id, a.lessons]))
  const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(since)
    d.setDate(since.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    return { date: key, lessons: activityMap.get(key) || 0 }
  })

  res.json({
    stats: {
      enrolledCourses: enrollments.length,
      completedLessons: enrollments.reduce((n, e) => n + e.completedLessons.length, 0),
      pendingAssignments: pending.length,
      certificates,
    },
    continueLearning: enrollments
      .filter((e) => e.progress < 100)
      .sort((a: any, b: any) => b.updatedAt - a.updatedAt)
      .slice(0, 3),
    upcomingDeadlines: pending.filter((a) => a.dueDate > new Date()).slice(0, 5),
    weeklyActivity,
  })
})

export const teacherDashboard = asyncHandler(async (req, res) => {
  const courses = await Course.find({ instructor: req.user!._id }).select("title studentsCount ratingAvg ratingCount")
  const courseIds = courses.map((c) => c._id)

  const [pendingSubmissions, recentSubmissions, recentReviews, trend, revenue] = await Promise.all([
    Submission.countDocuments({ course: { $in: courseIds }, status: "submitted" }),
    Submission.find({ course: { $in: courseIds }, status: "submitted" })
      .populate("student", "name avatar")
      .populate("assignment", "title")
      .sort("-updatedAt")
      .limit(5),
    Review.find({ course: { $in: courseIds } })
      .populate("student", "name avatar")
      .populate("course", "title")
      .sort("-createdAt")
      .limit(5),
    Enrollment.aggregate([
      { $match: { course: { $in: courseIds }, createdAt: { $gte: monthsBack(6) } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, enrollments: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Transaction.aggregate([
      { $match: { instructor: req.user!._id, status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ])

  const rated = courses.filter((c) => c.ratingCount > 0)
  res.json({
    stats: {
      totalCourses: courses.length,
      totalStudents: courses.reduce((n, c) => n + c.studentsCount, 0),
      pendingSubmissions,
      averageRating: rated.length
        ? Number((rated.reduce((n, c) => n + c.ratingAvg, 0) / rated.length).toFixed(1))
        : 0,
      totalEarnings: revenue[0]?.total || 0,
    },
    enrollmentTrend: trend.map((t) => ({ month: t._id, enrollments: t.enrollments })),
    recentSubmissions,
    recentReviews,
  })
})

export const teacherEarnings = asyncHandler(async (req, res) => {
  const transactions = await Transaction.find({ instructor: req.user!._id })
    .populate("user", "name")
    .populate("course", "title")
    .sort("-createdAt")
  const total = transactions.filter((t) => t.status === "paid").reduce((n, t) => n + t.amount, 0)
  res.json({ total, transactions })
})