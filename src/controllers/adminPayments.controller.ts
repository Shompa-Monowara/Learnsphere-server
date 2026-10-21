import Course from "../models/Course"
import Transaction from "../models/Transaction"
import User from "../models/User"
import asyncHandler from "../utils/asyncHandler"
import { escapeRegex } from "../utils/helpers"

const SORTS: Record<string, string> = {
  transaction: "transactionId",
  customer: "customer.name",
  course: "courseDoc.title",
  amount: "amount",
  method: "method",
  status: "status",
  date: "createdAt",
}

const STATUSES = ["paid", "pending", "failed", "refunded"]

export const getPayments = asyncHandler(async (req, res) => {
  const { q, status, sort, order } = req.query as Record<string, string>
  /* all=1 hole export er jonno paging charai (max 5000) shob row dei */
  const all = req.query.all === "1"
  const page = all ? 1 : Math.max(parseInt(req.query.page as string) || 1, 1)
  const limit = all ? 5000 : Math.min(parseInt(req.query.limit as string) || 10, 100)

  const filter: Record<string, any> = {}
  if (status && STATUSES.includes(status)) filter.status = status
  if (q) {
    const re = { $regex: escapeRegex(q.trim()), $options: "i" }
    filter.$or = [{ transactionId: re }, { "customer.name": re }, { "customer.email": re }, { "courseDoc.title": re }]
  }

  const sortField = SORTS[sort] ?? "createdAt"
  const dir = order === "asc" ? 1 : order === "desc" ? -1 : -1

  const join = (from: string, localField: string, as: string) => [
    { $lookup: { from, localField, foreignField: "_id", as } },
    { $addFields: { [as]: { $arrayElemAt: [`$${as}`, 0] } } },
  ]

  const [result, totals, methodRows] = await Promise.all([
    Transaction.aggregate([
      ...join(User.collection.name, "user", "customer"),
      ...join(User.collection.name, "instructor", "teacher"),
      ...join(Course.collection.name, "course", "courseDoc"),
      { $match: filter },
      { $sort: { [sortField]: dir, _id: 1 } },
      {
        $facet: {
          rows: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                transactionId: 1,
                amount: 1,
                method: 1,
                status: 1,
                createdAt: 1,
                customer: { name: "$customer.name", email: "$customer.email" },
                course: { title: "$courseDoc.title" },
                instructor: { name: "$teacher.name" },
              },
            },
          ],
          count: [{ $count: "n" }],
        },
      },
    ]).collation({ locale: "en", strength: 2 }),
    /* Summary shob transaction er upor, filter er upor na */
    Transaction.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0] } },
        },
      },
    ]),
    Transaction.aggregate([
      { $group: { _id: { $toLower: { $ifNull: ["$method", "manual"] } }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 4 },
    ]),
  ])

  const total = result[0]?.count[0]?.n ?? 0
  const all$ = totals[0]?.total ?? 0

  res.json({
    payments: result[0]?.rows ?? [],
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    summary: {
      revenue: totals[0]?.revenue ?? 0,
      transactions: all$,
      methods: methodRows.map((m) => ({
        method: m._id as string,
        count: m.count as number,
        percent: all$ ? Math.round((m.count / all$) * 100) : 0,
      })),
    },
  })
})