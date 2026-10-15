import Enrollment from "../models/Enrollment"
import Quiz from "../models/Quiz"
import QuizAttempt from "../models/QuizAttempt"
import asyncHandler from "../utils/asyncHandler"

const DAY = 24 * 60 * 60 * 1000

export const getMyQuizzes = asyncHandler(async (req, res) => {
  const studentId = req.user!._id
  const enrollments = await Enrollment.find({ student: studentId }).select("course")
  const courseIds = enrollments.map((e) => e.course)

  const quizzes: any[] = await Quiz.find({ course: { $in: courseIds } })
    .populate("course", "title")
    .sort("-createdAt")
  const attempts: any[] = await QuizAttempt.find({
    student: studentId,
    quiz: { $in: quizzes.map((q) => q._id) },
  })

  const stats = new Map<string, { attempts: number; best: number; passed: boolean }>()
  for (const a of attempts) {
    const key = String(a.quiz)
    const cur = stats.get(key) || { attempts: 0, best: 0, passed: false }
    cur.attempts += 1
    cur.best = Math.max(cur.best, a.percent || 0)
    cur.passed = cur.passed || !!a.passed
    stats.set(key, cur)
  }

  res.json({
    quizzes: quizzes.map((q) => {
      const s = stats.get(String(q._id))
      return {
        _id: q._id,
        title: q.title,
        courseTitle: q.course?.title || "",
        questionsCount: q.questions.length,
        duration: q.duration,
        passingScore: q.passingScore,
        attempts: s?.attempts ?? 0,
        bestScore: s ? s.best : null,
        passed: s?.passed ?? false,
      }
    }),
  })
})

export const getProgress = asyncHandler(async (req, res) => {
  const studentId = req.user!._id

  const rows: any[] = await Enrollment.find({ student: studentId }).populate("course", "title sections lessonsCount")
  const enrollments = rows.filter((e) => e.course)

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 6)
  since.setUTCHours(0, 0, 0, 0)

  const dayMinutes = new Map<string, number>()
  const byType: Record<string, number> = { video: 0, pdf: 0, quiz: 0, assignment: 0 }
  let totalMinutes = 0

  const courseCompletion = enrollments.map((e) => {
    const lessonMap = new Map<string, any>()
    e.course.sections.forEach((s: any) => s.lessons.forEach((l: any) => lessonMap.set(String(l._id), l)))

    for (const done of e.completedLessons) {
      const lesson = lessonMap.get(String(done.lesson))
      if (!lesson) continue
      const mins = lesson.duration || 1 // duration মিনিটে ধরা হয়েছে
      totalMinutes += mins
      byType[lesson.type] = (byType[lesson.type] || 0) + mins
      if (done.completedAt >= since) {
        const key = new Date(done.completedAt).toISOString().slice(0, 10)
        dayMinutes.set(key, (dayMinutes.get(key) || 0) + mins)
      }
    }

    return {
      courseId: String(e.course._id),
      title: e.course.title,
      lessonsDone: e.completedLessons.length,
      lessonsTotal: e.course.lessonsCount || lessonMap.size,
      progress: e.progress,
    }
  })

  const timeByDay = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(since)
    d.setUTCDate(since.getUTCDate() + i)
    const key = d.toISOString().slice(0, 10)
    return { date: key, minutes: dayMinutes.get(key) || 0 }
  })

  const typeTotal = Object.values(byType).reduce((n, v) => n + v, 0) || 1
  const pct = (v: number) => Math.round((v / typeTotal) * 100)
  const timeBreakdown = [
    { label: "Video", percent: pct(byType.video) },
    { label: "Practice", percent: pct(byType.assignment) },
    { label: "Quizzes", percent: pct(byType.quiz) },
    { label: "Reading", percent: pct(byType.pdf) },
  ]

  /* Quiz trend: শেষ ৭ সপ্তাহ */
  const trendStart = new Date(Date.now() - 49 * DAY)
  const [recentAttempts, avgAgg] = await Promise.all([
    QuizAttempt.find({ student: studentId, createdAt: { $gte: trendStart } } as any).select("percent createdAt"),
    QuizAttempt.aggregate([
      { $match: { student: studentId } },
      { $group: { _id: null, avg: { $avg: "$percent" } } },
    ]),
  ])

  const buckets = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }))
  for (const a of recentAttempts as any[]) {
    const idx = Math.min(6, Math.floor((new Date(a.createdAt).getTime() - trendStart.getTime()) / (7 * DAY)))
    buckets[idx].sum += a.percent || 0
    buckets[idx].count += 1
  }
  const quizTrend = buckets.map((b, i) => ({
    label: `Wk ${i + 1}`,
    score: b.count ? Math.round(b.sum / b.count) : null,
  }))

  const avgCompletion = enrollments.length
    ? Math.round(enrollments.reduce((n, e) => n + e.progress, 0) / enrollments.length)
    : 0

  res.json({
    stats: {
      avgCompletion,
      timeSpentMinutes: totalMinutes,
      avgQuizScore: Math.round(avgAgg[0]?.avg || 0),
      coursesCompleted: enrollments.filter((e) => e.progress >= 100).length,
      enrolled: enrollments.length,
    },
    quizTrend,
    courseCompletion,
    timeByDay,
    timeBreakdown,
  })
})