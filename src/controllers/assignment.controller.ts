import Assignment from "../models/Assignment"
import Course from "../models/Course"
import Enrollment from "../models/Enrollment"
import Submission from "../models/Submission"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"
import { ensureEnrolled, isOwnerOrAdmin, notify, pick } from "../utils/helpers"
import { uploadBuffer } from "./upload.controller"

const FIELDS = ["title", "instructions", "dueDate", "totalMarks", "attachments"]

const loadOwnedCourse = async (courseId: any, user: any) => {
  const course = await Course.findById(courseId)
  if (!course) throw new ApiError(404, "Course not found")
  if (!isOwnerOrAdmin(course, user)) throw new ApiError(403, "Not your course")
  return course
}

export const createAssignment = asyncHandler(async (req, res) => {
  const course = await loadOwnedCourse(req.params.courseId, req.user)
  const { title, dueDate } = req.body
  if (!title || !dueDate) throw new ApiError(400, "Title and due date are required")

  const assignment = await Assignment.create({ ...pick(req.body, FIELDS), course: course._id })

  const students = await Enrollment.find({ course: course._id }).select("student")
  await Promise.all(
    students.map((s) =>
      notify(s.student, "New assignment", `${title} was added to "${course.title}".`, "/student/assignments")
    )
  )
  res.status(201).json({ assignment })
})

export const getCourseAssignments = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId)
  if (!course) throw new ApiError(404, "Course not found")
  if (!isOwnerOrAdmin(course, req.user!)) await ensureEnrolled(req.user!._id, course._id)
  const assignments = await Assignment.find({ course: course._id }).sort("dueDate")
  res.json({ assignments })
})

export const getMyAssignments = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ student: req.user!._id }).select("course")
  const assignments = await Assignment.find({ course: { $in: enrollments.map((e) => e.course) } })
    .populate("course", "title")
    .sort("dueDate")
  const submissions = await Submission.find({
    student: req.user!._id,
    assignment: { $in: assignments.map((a) => a._id) },
  })
  const map = new Map<string, any>(submissions.map((s) => [String(s.assignment), s]))

  res.json({
    assignments: assignments.map((a) => {
      const submission = map.get(String(a._id)) || null
      return { ...a.toObject(), submission, status: submission ? submission.status : "pending" }
    }),
  })
})

export const getAssignment = asyncHandler(async (req, res) => {
  const assignment: any = await Assignment.findById(req.params.id).populate("course", "title instructor")
  if (!assignment) throw new ApiError(404, "Assignment not found")
  if (!isOwnerOrAdmin(assignment.course, req.user!)) {
    await ensureEnrolled(req.user!._id, assignment.course._id)
  }
  const submission = await Submission.findOne({ assignment: assignment._id, student: req.user!._id })
  res.json({ assignment, submission })
})

export const updateAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id)
  if (!assignment) throw new ApiError(404, "Assignment not found")
  await loadOwnedCourse(assignment.course, req.user)
  Object.assign(assignment, pick(req.body, FIELDS))
  await assignment.save()
  res.json({ assignment })
})

export const deleteAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id)
  if (!assignment) throw new ApiError(404, "Assignment not found")
  await loadOwnedCourse(assignment.course, req.user)
  await Promise.all([assignment.deleteOne(), Submission.deleteMany({ assignment: assignment._id })])
  res.json({ message: "Assignment deleted" })
})

export const submitAssignment = asyncHandler(async (req, res) => {
  const user = req.user!
  const assignment = await Assignment.findById(req.params.id)
  if (!assignment) throw new ApiError(404, "Assignment not found")
  await ensureEnrolled(user._id, assignment.course)
  if (!req.file) throw new ApiError(400, "Please attach a file")

  const existing = await Submission.findOne({ assignment: assignment._id, student: user._id })
  if (existing?.status === "graded") throw new ApiError(400, "This submission has already been graded")

  const uploaded = await uploadBuffer(req.file.buffer, "submissions")
  const isLate = new Date() > assignment.dueDate

  let submission: any
  if (existing) {
    existing.history.push({ fileUrl: existing.fileUrl, submittedAt: (existing as any).updatedAt })
    existing.fileUrl = uploaded.secure_url
    existing.note = req.body.note || ""
    existing.isLate = isLate
    submission = await existing.save()
  } else {
    submission = await Submission.create({
      assignment: assignment._id,
      course: assignment.course,
      student: user._id,
      fileUrl: uploaded.secure_url,
      note: req.body.note || "",
      isLate,
    })
  }

  const course = await Course.findById(assignment.course)
  if (course) {
    await notify(course.instructor, "New submission", `${user.name} submitted "${assignment.title}".`, "/teacher/assignments")
  }
  res.status(201).json({ submission })
})

export const getSubmissions = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id)
  if (!assignment) throw new ApiError(404, "Assignment not found")
  await loadOwnedCourse(assignment.course, req.user)

  const filter: Record<string, any> = { assignment: assignment._id }
  if (req.query.status) filter.status = String(req.query.status)

  const submissions = await Submission.find(filter).populate("student", "name email avatar").sort("-updatedAt")
  res.json({ assignment, submissions })
})

export const gradeSubmission = asyncHandler(async (req, res) => {
  const submission: any = await Submission.findById(req.params.id).populate("assignment")
  if (!submission) throw new ApiError(404, "Submission not found")
  await loadOwnedCourse(submission.course, req.user)

  const score = Number(req.body.score)
  const max: number = submission.assignment.totalMarks
  if (Number.isNaN(score) || score < 0 || score > max) {
    throw new ApiError(400, `Score must be between 0 and ${max}`)
  }
  submission.score = score
  submission.feedback = req.body.feedback || ""
  submission.status = "graded"
  await submission.save()

  await notify(
    submission.student,
    "Assignment graded",
    `"${submission.assignment.title}": ${score}/${max}`,
    "/student/assignments"
  )
  res.json({ submission })
})