import Course from "../models/Course"
import Enrollment from "../models/Enrollment"
import Transaction from "../models/Transaction"
import asyncHandler from "../utils/asyncHandler"

const RANGES = [3, 6, 12]
const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`

/* Notun value ager period er theke koto % beshi/kom. Ager period e 0 thakle null (frontend "New" dekhay) */
const change = (cur: number, prev: number): number | null =>
  prev === 0 ? (cur > 0 ? null : 0) : Number((((cur - prev) / prev) * 100).toFixed(1))

const round1 = (n: number) => Number(n.toFixed(1))

export const getReports = asyncHandler(async (req, res) => {
  const asked = parseInt(req.query.range as string)
  const range = RANGES.includes(asked) ? asked : 6

  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (range - 1), 1))
  const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (range * 2 - 1), 1))

  const months = Array.from({ length: range }, (_, i) =>
    monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (range - 1 - i), 1)))
  )

  const period = (field: string) => ({ $cond: [{ $gte: [`$${field}`, start] }, "cur", "prev"] })
  const monthOf = (field: string) => ({ $dateToString: { format: "%Y-%m", date: `$${field}` } })

  const [
    enrolTotals,
    completionTotals,
    activeCur,
    activePrev,
    enrolByMonth,
    completionsByMonth,
    activeByMonth,
    topRaw,
    revenueRaw,
  ] = await Promise.all([
    /* Notun enrollment + shey gulor modhye koto ta complete hoyeche */
    Enrollment.aggregate([
      { $match: { createdAt: { $gte: prevStart } } },
      {
        $group: {
          _id: period("createdAt"),
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $ifNull: ["$completedAt", false] }, 1, 0] } },
        },
      },
    ]),
    Enrollment.aggregate([
      { $match: { completedAt: { $gte: prevStart } } },
      { $group: { _id: period("completedAt"), total: { $sum: 1 } } },
    ]),
    /* Active user = je student er enrollment e ei period e kono kaj hoyeche */
    Enrollment.aggregate([
      { $match: { updatedAt: { $gte: start } } },
      { $group: { _id: "$student" } },
      { $count: "n" },
    ]),
    Enrollment.aggregate([
      { $match: { updatedAt: { $gte: prevStart, $lt: start } } },
      { $group: { _id: "$student" } },
      { $count: "n" },
    ]),
    Enrollment.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: monthOf("createdAt"), n: { $sum: 1 } } },
    ]),
    Enrollment.aggregate([
      { $match: { completedAt: { $gte: start } } },
      { $group: { _id: monthOf("completedAt"), n: { $sum: 1 } } },
    ]),
    Enrollment.aggregate([
      { $match: { updatedAt: { $gte: start } } },
      { $group: { _id: { m: monthOf("updatedAt"), s: "$student" } } },
      { $group: { _id: "$_id.m", n: { $sum: 1 } } },
    ]),
    Enrollment.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: "$course",
          enrollments: { $sum: 1 },
          done: { $sum: { $cond: [{ $ifNull: ["$completedAt", false] }, 1, 0] } },
        },
      },
      { $sort: { enrollments: -1 } },
      { $limit: 5 },
    ]),
    Transaction.aggregate([
      { $match: { status: "paid", createdAt: { $gte: start } } },
      { $group: { _id: "$course", revenue: { $sum: "$amount" } } },
    ]),
  ])

  const pick = (rows: any[], key: string, field = "total") => rows.find((r) => r._id === key)?.[field] ?? 0
  const series = (rows: any[]) => months.map((m) => rows.find((r) => r._id === m)?.n ?? 0)

  const enrolCur = pick(enrolTotals, "cur")
  const enrolPrev = pick(enrolTotals, "prev")
  const doneCur = pick(completionTotals, "cur")
  const donePrev = pick(completionTotals, "prev")
  const usersCur = activeCur[0]?.n ?? 0
  const usersPrev = activePrev[0]?.n ?? 0

  const rate = (done: number, total: number) => (total ? round1((done / total) * 100) : 0)
  const rateCur = rate(pick(enrolTotals, "cur", "done"), enrolCur)
  const ratePrev = rate(pick(enrolTotals, "prev", "done"), enrolPrev)

  const courses = await Course.find({ _id: { $in: topRaw.map((t) => t._id) } })
    .select("title instructor")
    .populate("instructor", "name")
    .lean()
  const courseMap = new Map(courses.map((c: any) => [String(c._id), c]))
  const revenueMap = new Map<string, number>(revenueRaw.map((r) => [String(r._id), r.revenue]))

  res.json({
    range,
    months,
    kpis: {
      enrollments: { value: enrolCur, change: change(enrolCur, enrolPrev) },
      completions: { value: doneCur, change: change(doneCur, donePrev) },
      activeUsers: { value: usersCur, change: change(usersCur, usersPrev) },
      /* completion rate er change percentage point e (68% theke 70% hole +2.0) */
      completionRate: { value: rateCur, change: round1(rateCur - ratePrev) },
    },
    series: {
      enrollments: series(enrolByMonth),
      completions: series(completionsByMonth),
      activeUsers: series(activeByMonth),
    },
    topCourses: topRaw
      .map((t) => {
        const c: any = courseMap.get(String(t._id))
        return c
          ? {
              _id: String(t._id),
              title: c.title,
              instructor: c.instructor?.name ?? "Unknown",
              enrollments: t.enrollments,
              completionRate: rate(t.done, t.enrollments),
              revenue: revenueMap.get(String(t._id)) ?? 0,
            }
          : null
      })
      .filter(Boolean),
  })
})