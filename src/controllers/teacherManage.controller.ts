import Course from "../models/Course"
import Enrollment from "../models/Enrollment"
import Transaction from "../models/Transaction"
import asyncHandler from "../utils/asyncHandler"

const WEEK = 7 * 24 * 60 * 60 * 1000

/* GET /teacher/courses : My Courses টেবিল (revenue সহ) */
export const getCoursesPage = asyncHandler(async (req, res) => {
  const me = req.user!._id

  const [courses, revenue] = await Promise.all([
    Course.find({ instructor: me }).select("-sections").populate("category", "name").sort("-createdAt"),
    Transaction.aggregate([
      { $match: { instructor: me, status: "paid" } },
      { $group: { _id: "$course", revenue: { $sum: "$amount" } } },
    ]),
  ])

  const rev = new Map<string, number>(revenue.map((r: any) => [String(r._id), r.revenue]))
  const list: any[] = courses

  res.json({
    courses: list.map((c) => ({
      _id: String(c._id),
      title: c.title,
      thumbnail: c.thumbnail || "",
      status: c.status,
      rejectionReason: c.rejectionReason || "",
      category: c.category?.name || "Uncategorized",
      lessonsCount: c.lessonsCount || 0,
      studentsCount: c.studentsCount || 0,
      ratingAvg: c.ratingAvg || 0,
      ratingCount: c.ratingCount || 0,
      revenue: rev.get(String(c._id)) || 0,
      createdAt: c.createdAt,
    })),
  })
})

/* GET /teacher/students : student অনুযায়ী গ্রুপ করা তালিকা */
export const getStudentsPage = asyncHandler(async (req, res) => {
  const courses = await Course.find({ instructor: req.user!._id }).select("_id")

  const rows: any[] = await Enrollment.find({ course: { $in: courses.map((c) => c._id) } })
    .populate("student", "name email avatar")
    .populate("course", "title")
    .select("student course progress updatedAt createdAt")

  const map = new Map<string, any>()
  for (const e of rows) {
    if (!e.student) continue
    const key = String(e.student._id)
    const cur = map.get(key) ?? {
      _id: key,
      name: e.student.name,
      email: e.student.email,
      avatar: e.student.avatar || "",
      courseTitles: [] as string[],
      progressSum: 0,
      lastActive: e.updatedAt,
      joined: e.createdAt,
      allDone: true,
    }
    cur.courseTitles.push(e.course?.title || "Deleted course")
    cur.progressSum += e.progress || 0
    if (e.updatedAt > cur.lastActive) cur.lastActive = e.updatedAt
    if (e.createdAt < cur.joined) cur.joined = e.createdAt
    if ((e.progress || 0) < 100) cur.allDone = false
    map.set(key, cur)
  }

  const now = Date.now()
  const students = Array.from(map.values())
    .map((s) => {
      const n = s.courseTitles.length
      const progress = Math.round(s.progressSum / n)
      const idle = now - new Date(s.lastActive).getTime()
      const status = s.allDone ? "completed" : idle > WEEK && progress < 50 ? "at-risk" : "active"
      return {
        _id: s._id,
        name: s.name,
        email: s.email,
        avatar: s.avatar,
        courses: n,
        courseTitles: s.courseTitles,
        progress,
        lastActive: s.lastActive,
        joined: s.joined,
        status,
      }
    })
    .sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime())

  res.json({ students })
})