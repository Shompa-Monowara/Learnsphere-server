import Course from "../models/Course"
import Payout from "../models/Payout"
import Review from "../models/Review"
import Transaction from "../models/Transaction"
import asyncHandler from "../utils/asyncHandler"

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
const pct = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 1000) / 10 : null)

async function totals(me: unknown) {
  const [life, reserved] = await Promise.all([
    Transaction.aggregate([
      { $match: { instructor: me, status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Payout.aggregate([
      { $match: { instructor: me, status: { $in: ["pending", "paid"] } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ])
  const lifetime: number = life[0]?.total || 0
  const taken: number = reserved[0]?.total || 0
  return { lifetime, available: Math.max(lifetime - taken, 0) }
}

/* GET /teacher/reviews */
export const getReviewsPage = asyncHandler(async (req, res) => {
  const courses = await Course.find({ instructor: req.user!._id }).select("_id")
  const ids = courses.map((c) => c._id)

  const [dist, list] = await Promise.all([
    Review.aggregate([
      { $match: { course: { $in: ids } } },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
    ]),
    Review.find({ course: { $in: ids } })
      .populate("student", "name avatar")
      .populate("course", "title")
      .sort("-createdAt")
      .limit(200),
  ])

  const counts = new Map<number, number>(dist.map((d: any) => [d._id, d.count]))
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0)
  const sum = Array.from(counts.entries()).reduce((a, [star, n]) => a + star * n, 0)

  const reviews: any[] = list
  res.json({
    summary: {
      average: total ? Number((sum / total).toFixed(1)) : 0,
      total,
      distribution: [5, 4, 3, 2, 1].map((star) => ({
        star,
        count: counts.get(star) || 0,
        percent: total ? Math.round(((counts.get(star) || 0) / total) * 100) : 0,
      })),
    },
    reviews: reviews
      .filter((r) => r.student)
      .map((r) => ({
        _id: String(r._id),
        studentName: r.student.name,
        studentAvatar: r.student.avatar || "",
        courseTitle: r.course?.title || "",
        rating: r.rating,
        comment: r.comment || "",
        reply: r.reply || "",
        helpful: r.helpful || 0,
        createdAt: r.createdAt,
      })),
  })
})

/* GET /teacher/earnings */
export const getEarningsPage = asyncHandler(async (req, res) => {
  const me = req.user!._id
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const seriesStart = new Date(Date.UTC(y, m - 6, 1))

  const [monthly, perCourse, payouts, sums] = await Promise.all([
    Transaction.aggregate([
      { $match: { instructor: me, status: "paid", createdAt: { $gte: seriesStart } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          revenue: { $sum: "$amount" },
        },
      },
    ]),
    Transaction.aggregate([
      { $match: { instructor: me, status: "paid" } },
      { $group: { _id: "$course", revenue: { $sum: "$amount" }, sales: { $sum: 1 } } },
      { $sort: { revenue: -1 } },
      { $limit: 4 },
    ]),
    Payout.find({ instructor: me }).sort("-createdAt").limit(20),
    totals(me),
  ])

  const map = new Map<string, number>(monthly.map((x: any) => [x._id, x.revenue]))
  const series = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - (6 - i), 1))
    return {
      label: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      revenue: map.get(monthKey(d)) || 0,
    }
  })

  const titles = await Course.find({ _id: { $in: perCourse.map((c: any) => c._id) } }).select("title")
  const titleOf = new Map<string, string>(titles.map((c: any) => [String(c._id), c.title]))

  res.json({
    cards: {
      thisMonth: series[6].revenue,
      lastMonth: series[5].revenue,
      lifetime: sums.lifetime,
      available: sums.available,
      thisMonthChange: pct(series[6].revenue, series[5].revenue),
      lastMonthChange: pct(series[5].revenue, series[4].revenue),
    },
    series,
    topCourses: perCourse.map((c: any) => ({
      _id: String(c._id),
      title: titleOf.get(String(c._id)) || "Deleted course",
      revenue: c.revenue,
      sales: c.sales,
    })),
    payouts,
  })
})

/* POST /teacher/payouts  body: { amount, method } */
export const requestPayout = asyncHandler(async (req, res) => {
  const me = req.user!._id
  const amount = Number(req.body.amount)
  const method = req.body.method === "paypal" ? "paypal" : "bank"
  const { available } = await totals(me)

  if (!Number.isFinite(amount) || amount < 10) {
    res.status(400).json({ message: "Minimum payout is $10." })
    return
  }
  if (amount > available) {
    res.status(400).json({ message: `You can request up to $${available.toFixed(2)}.` })
    return
  }

  const payout = await Payout.create({
    instructor: me,
    amount,
    method,
    reference: `PO-${new Date().getUTCFullYear()}-${Date.now().toString().slice(-6)}`,
  })
  res.status(201).json(payout)
})