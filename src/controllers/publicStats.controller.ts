import Certificate from "../models/Certificate"
import Course from "../models/Course"
import User from "../models/User"
import asyncHandler from "../utils/asyncHandler"

interface PublicStats {
  students: number
  courses: number
  instructors: number
  certificates: number
}

/* Home page er numbers real DB theke. Public endpoint, tai 5 min memory cache diye DB load kombano */
const TTL_MS = 5 * 60 * 1000
let cache: { at: number; data: PublicStats } | null = null

async function computeStats(): Promise<PublicStats> {
  const [students, courses, certificates, instructorIds] = await Promise.all([
    User.countDocuments({ role: "student", isBlocked: false }),
    Course.countDocuments({ status: "published" }),
    Certificate.countDocuments(),
    Course.distinct("instructor", { status: "published" }),
  ])

  /* Instructor = published course ache emon active teacher (/instructors page er moto) */
  const instructors = await User.countDocuments({
    _id: { $in: instructorIds },
    role: "teacher",
    isBlocked: false,
  })

  return { students, courses, instructors, certificates }
}

export const getPublicStats = asyncHandler(async (_req, res) => {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    cache = { at: Date.now(), data: await computeStats() }
  }
  res.set("Cache-Control", "public, max-age=300")
  res.json(cache.data)
})