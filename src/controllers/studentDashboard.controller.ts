import Assignment from "../models/Assignment"
import Certificate from "../models/Certificate"
import Enrollment from "../models/Enrollment"
import Message from "../models/Message"
import Notification from "../models/Notification"
import Quiz from "../models/Quiz"
import QuizAttempt from "../models/QuizAttempt"
import Submission from "../models/Submission"
import asyncHandler from "../utils/asyncHandler"

const DAY = 24 * 60 * 60 * 1000

export const getStudentDashboard = asyncHandler(async (req, res) => {
  const studentId = req.user!._id
  const now = new Date()
  const monthAgo = new Date(now.getTime() - 30 * DAY)

  const rows: any[] = await Enrollment.find({ student: studentId })
    .populate({
      path: "course",
      select: "title thumbnail sections category instructor",
      populate: [
        { path: "instructor", select: "name" },
        { path: "category", select: "name" },
      ],
    })
    .sort("-updatedAt")

  const enrollments = rows.filter((e) => e.course)
  const courseIds = enrollments.map((e) => e.course._id)

  const [assignments, submissions, certificates, recentCertificates, unread, unreadMessages, courseQuizzes, passedQuizIds] =
    await Promise.all([
      Assignment.find({ course: { $in: courseIds } }).populate("course", "title").sort("dueDate"),
      Submission.find({ student: studentId }).select("assignment"),
      Certificate.countDocuments({ student: studentId }),
      Certificate.countDocuments({ student: studentId, createdAt: { $gte: monthAgo } } as any),
      Notification.countDocuments({ user: studentId, read: false }),
      Message.countDocuments({ receiver: studentId, read: false }),
      Quiz.find({ course: { $in: courseIds } }).select("_id"),
      QuizAttempt.distinct("quiz", { student: studentId, passed: true }),
    ])

  const submitted = new Set(submissions.map((s: any) => String(s.assignment)))
  const pending: any[] = assignments.filter((a: any) => !submitted.has(String(a._id)))
  const upcoming = pending.filter((a) => new Date(a.dueDate) > now)

  const passed = new Set(passedQuizIds.map((id: any) => String(id)))
  const pendingQuizzes = courseQuizzes.filter((q: any) => !passed.has(String(q._id))).length

  /* Weekly activity (UTC দিন ধরে, শেষ ৭ দিন) */
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 6)
  since.setUTCHours(0, 0, 0, 0)

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
    d.setUTCDate(since.getUTCDate() + i)
    const key = d.toISOString().slice(0, 10)
    return { date: key, lessons: activityMap.get(key) || 0 }
  })

  let streak = 0
  let idx = weeklyActivity.length - 1
  if (weeklyActivity[idx].lessons === 0) idx -= 1
  while (idx >= 0 && weeklyActivity[idx].lessons > 0) {
    streak += 1
    idx -= 1
  }

  const continueLearning = enrollments
    .filter((e) => e.progress < 100)
    .slice(0, 3)
    .map((e) => {
      const course = e.course
      const lessons: any[] = course.sections.flatMap((s: any) => s.lessons)
      const done = new Set(e.completedLessons.map((l: any) => String(l.lesson)))
      const remaining = lessons.filter((l) => !done.has(String(l._id)))
      return {
        enrollmentId: String(e._id),
        courseId: String(course._id),
        title: course.title,
        thumbnail: course.thumbnail || "",
        category: course.category?.name || "",
        instructor: course.instructor?.name || "",
        progress: e.progress,
        nextLesson: remaining[0]?.title || "",
        minutesLeft: remaining.reduce((n, l) => n + (l.duration || 0), 0),
      }
    })

  res.json({
    stats: {
      enrolledCourses: enrollments.length,
      completedLessons: enrollments.reduce((n, e) => n + e.completedLessons.length, 0),
      pendingAssignments: pending.length,
      certificates,
    },
    trends: {
      enrolledCourses: enrollments.filter((e) => new Date(e.createdAt) >= monthAgo).length,
      completedLessons: weeklyActivity.reduce((n, d) => n + d.lessons, 0),
      certificates: recentCertificates,
    },
    continueLearning,
    upcomingDeadlines: upcoming.slice(0, 4).map((a) => ({
      _id: String(a._id),
      title: a.title,
      courseTitle: a.course?.title || "",
      dueDate: a.dueDate,
    })),
    weeklyActivity,
    streak,
    badges: {
      assignments: pending.length,
      notifications: unread,
      quizzes: pendingQuizzes,
      messages: unreadMessages,
    },
  })
})