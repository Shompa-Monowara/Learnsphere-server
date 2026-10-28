import Mentor from "../models/Mentor"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"

const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max)

/* Skills comma diye lekha string ba array, dutoi cholbe */
const toSkills = (v: unknown): string[] => {
  const list = Array.isArray(v) ? v : String(v ?? "").split(",")
  return list
    .map((s) => text(s, 40))
    .filter(Boolean)
    .slice(0, 8)
}

const readFields = (body: Record<string, unknown>) => {
  const name = text(body.name, 80)
  if (name.length < 2) throw new ApiError(400, "Name must be at least 2 characters")

  const avatar = text(body.avatar, 500)
  if (avatar && !/^https:\/\//i.test(avatar)) throw new ApiError(400, "Photo must be an https image URL")

  return {
    name,
    avatar,
    headline: text(body.headline, 120),
    bio: text(body.bio, 1000),
    category: text(body.category, 60),
    skills: toSkills(body.skills),
    isPublished: body.isPublished === true,
  }
}

export const listMentors = asyncHandler(async (_req, res) => {
  const mentors = await Mentor.find().sort({ createdAt: -1 }).lean()
  res.json({ mentors })
})

export const createMentor = asyncHandler(async (req, res) => {
  const mentor = await Mentor.create(readFields(req.body))
  res.status(201).json({ mentor })
})

export const updateMentor = asyncHandler(async (req, res) => {
  const mentor = await Mentor.findById(req.params.id)
  if (!mentor) throw new ApiError(404, "Instructor not found")
  mentor.set(readFields(req.body))
  await mentor.save()
  res.json({ mentor })
})

export const setPublished = asyncHandler(async (req, res) => {
  const mentor = await Mentor.findById(req.params.id)
  if (!mentor) throw new ApiError(404, "Instructor not found")
  mentor.isPublished = req.body.isPublished === true
  await mentor.save()
  res.json({ mentor })
})

export const deleteMentor = asyncHandler(async (req, res) => {
  const mentor = await Mentor.findByIdAndDelete(req.params.id)
  if (!mentor) throw new ApiError(404, "Instructor not found")
  res.json({ message: "Instructor deleted" })
})