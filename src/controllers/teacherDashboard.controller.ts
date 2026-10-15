import Course from "../models/Course"
import Enrollment from "../models/Enrollment"
import Message from "../models/Message"
import Notification from "../models/Notification"
import Review from "../models/Review"
import Submission from "../models/Submission"
import asyncHandler from "../utils/asyncHandler"

const DAY = 24 * 60 * 60 * 1000

export const getTeacherDashboard = asyncHandler(async (req, res) => {
  const me = req.user!._id
  const now = new Date()
  const monthAgo = new Date(now.getTime() - 30 * DAY)

  const courses: any[] = await Course.find({ instructor: me }).select("studentsCount ratingAvg ratingCount createdAt")
  const courseIds = courses.map((c) => c._id)

  // শেষ ৭ মাস (বর্তমান মাস সহ), UTC ধরে
  const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1))

  const [pendingSubmissions, submissions, reviews, trendRaw, newStudents, unreadNotifications, unreadMessages] =
    await Promise.all([
      Submission.countDocuments({ course: { $in: courseIds }, status: "submitted" }),
      Submission.find({ course: { $in: courseIds } })
        .populate("student", "name avatar")
        .populate("assignment", "title")
        .populate("course", "title")
        .sort("-updatedAt")
        .limit(5),
      Review.find({ course: { $in: courseIds } })
        .populate("student", "name avatar")
        .populate("course", "title")
        .sort("-createdAt")
        .limit(3),
      Enrollment.aggregate([
        { $match: { course: { $in: courseIds }, createdAt: { $gte: trendStart } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            enrollments: { $sum: 1 },
          },
        },
      ]),
      Enrollment.countDocuments({ course: { $in: courseIds }, createdAt: { $gte: monthAgo } }),
      Notification.countDocuments({ user: me, read: false }),
      Message.countDocuments({ receiver: me, read: false }),
    ])

  const trendMap = new Map<string, number>(trendRaw.map((t: any) => [t._id, t.enrollments]))
  const enrollmentTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (6 - i), 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    return {
      label: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      enrollments: trendMap.get(key) || 0,
    }
  })

  const last = enrollmentTrend[6].enrollments
  const prev = enrollmentTrend[5].enrollments
  const growth = prev > 0 ? Math.round(((last - prev) / prev) * 1000) / 10 : null

  const rated = courses.filter((c) => c.ratingCount > 0)
  const subs: any[] = submissions
  const revs: any[] = reviews

  res.json({
    stats: {
      totalCourses: courses.length,
      totalStudents: courses.reduce((n, c) => n + (c.studentsCount || 0), 0),
      pendingSubmissions,
      averageRating: rated.length
        ? Number((rated.reduce((n, c) => n + c.ratingAvg, 0) / rated.length).toFixed(1))
        : 0,
    },
    trends: {
      courses: courses.filter((c) => new Date(c.createdAt) >= monthAgo).length,
      students: newStudents,
    },
    enrollmentTrend,
    growth,
    recentSubmissions: subs
      .filter((s) => s.student)
      .map((s) => ({
        _id: String(s._id),
        studentName: s.student.name,
        studentAvatar: s.student.avatar || "",
        courseTitle: s.course?.title || "",
        assignmentTitle: s.assignment?.title || "",
        status: s.status,
        submittedAt: s.updatedAt,
      })),
    recentReviews: revs
      .filter((r) => r.student)
      .map((r) => ({
        _id: String(r._id),
        studentName: r.student.name,
        studentAvatar: r.student.avatar || "",
        courseTitle: r.course?.title || "",
        rating: r.rating,
        comment: r.comment || "",
        reply: r.reply || "",
        createdAt: r.createdAt,
      })),
    badges: {
      assignments: pendingSubmissions,
      messages: unreadMessages,
      notifications: unreadNotifications,
    },
  })
})