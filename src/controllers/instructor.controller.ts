import Category from "../models/Category"
import Course from "../models/Course"
import Mentor from "../models/Mentor"
import User from "../models/User"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"

const LIMIT = 8

/* Public instructors page: search, category, min rating, sort, pagination */
export const getInstructors = asyncHandler(async (req, res) => {
  const stats = await Course.aggregate([
    { $match: { status: "published" } },
    {
      $group: {
        _id: "$instructor",
        coursesCount: { $sum: 1 },
        studentsCount: { $sum: "$studentsCount" },
        rating: { $avg: "$ratingAvg" },
        categoryIds: { $push: "$category" },
        titles: { $push: "$title" },
      },
    },
  ])

  const catDocs = await Category.find().select("name").lean()
  const catName = new Map<string, string>(catDocs.map((c: any) => [String(c._id), c.name]))
  const statMap = new Map(stats.map((s) => [String(s._id), s]))

  const users = await User.find({
    _id: { $in: stats.map((s) => s._id) },
    role: "teacher",
    isBlocked: false,
  })
    .select("name avatar headline bio")
    .lean()

  const realInstructors = users.map((u) => {
    const s = statMap.get(String(u._id))
    const counts = new Map<string, number>()
    for (const id of s.categoryIds) {
      const n = catName.get(String(id))
      if (n) counts.set(n, (counts.get(n) ?? 0) + 1)
    }
    const categories = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n)
    return {
      _id: u._id,
      name: u.name,
      avatar: u.avatar,
      headline: u.headline,
      bio: u.bio,
      coursesCount: s.coursesCount as number,
      studentsCount: s.studentsCount as number,
      rating: Number((s.rating || 0).toFixed(1)),
      category: categories[0] ?? "",
      categories,
      skills: (s.titles as string[]).slice(0, 3),
      profileOnly: false,
    }
  })

  /* Admin je profile gulo publish korechhe (course na thakleo dekhabe) */
  const mentors = await Mentor.find({ isPublished: true }).lean()
  const profiles = mentors.map((m) => ({
    _id: m._id,
    name: m.name,
    avatar: m.avatar,
    headline: m.headline,
    bio: m.bio,
    coursesCount: 0,
    studentsCount: 0,
    rating: 0,
    category: m.category,
    categories: m.category ? [m.category] : [],
    skills: m.skills ?? [],
    profileOnly: true,
  }))

  const all = [...realInstructors, ...profiles]

  /* Hero stats + category chips (filter er upor depend kore na) */
  const catCount = new Map<string, number>()
  all.forEach((i) => i.categories.forEach((c) => catCount.set(c, (catCount.get(c) ?? 0) + 1)))
  const summary = {
    instructors: all.length,
    students: all.reduce((n, i) => n + i.studentsCount, 0),
    avgRating: realInstructors.length
      ? Number((realInstructors.reduce((n, i) => n + i.rating, 0) / realInstructors.length).toFixed(1))
      : 0,
    disciplines: catCount.size,
  }
  const categories = [...catCount.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }))

  /* Filters */
  const q = String(req.query.q ?? "").trim().toLowerCase()
  const category = String(req.query.category ?? "")
  const minRating = Number(req.query.minRating) || 0

  let list = all.filter((i) => {
    if (q && !`${i.name} ${i.headline} ${i.skills.join(" ")}`.toLowerCase().includes(q)) return false
    if (category && !i.categories.includes(category)) return false
    if (minRating && i.rating < minRating) return false
    return true
  })

  const sorters: Record<string, (a: (typeof all)[number], b: (typeof all)[number]) => number> = {
    top: (a, b) => b.rating - a.rating || b.studentsCount - a.studentsCount,
    students: (a, b) => b.studentsCount - a.studentsCount,
    courses: (a, b) => b.coursesCount - a.coursesCount,
    name: (a, b) => a.name.localeCompare(b.name),
  }
  list = list.sort(sorters[String(req.query.sort)] ?? sorters.top)

  /* Pagination */
  const total = list.length
  const pages = Math.max(1, Math.ceil(total / LIMIT))
  const page = Math.min(Math.max(Number(req.query.page) || 1, 1), pages)

  res.json({
    instructors: list.slice((page - 1) * LIMIT, page * LIMIT),
    total,
    page,
    pages,
    limit: LIMIT,
    summary,
    categories,
  })
})

export const getInstructor = asyncHandler(async (req, res) => {
  const instructor = await User.findOne({ _id: req.params.id, role: "teacher", isBlocked: false }).select(
    "name avatar headline bio createdAt"
  )
  if (!instructor) {
    const profile = await Mentor.findOne({ _id: req.params.id, isPublished: true }).select(
      "name avatar headline bio createdAt"
    )
    if (!profile) throw new ApiError(404, "Instructor not found")
    res.json({ instructor: profile, courses: [], stats: { courses: 0, students: 0 } })
    return
  }

  const courses = await Course.find({ instructor: instructor._id, status: "published" })
    .select("-sections")
    .populate("category", "name")

  res.json({
    instructor,
    courses,
    stats: {
      courses: courses.length,
      students: courses.reduce((n, c) => n + c.studentsCount, 0),
    },
  })
})