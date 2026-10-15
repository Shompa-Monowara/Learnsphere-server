import Course from "../models/Course"
import Quiz from "../models/Quiz"
import QuizAttempt from "../models/QuizAttempt"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"
import { ensureEnrolled, isOwnerOrAdmin, pick } from "../utils/helpers"

const loadOwnedCourse = async (courseId: unknown, user: { _id: unknown; role: string }) => {
  const course = await Course.findById(courseId)
  if (!course) throw new ApiError(404, "Course not found")
  if (!isOwnerOrAdmin(course, user as any)) throw new ApiError(403, "Not your course")
  return course
}

const hideAnswers = (quiz: any) => {
  const data = quiz.toObject()
  data.questions = data.questions.map(({ correctIndex, explanation, ...q }: any) => q)
  return data
}

const FIELDS = ["title", "duration", "passingScore", "questions"]

export const createQuiz = asyncHandler(async (req, res) => {
  await loadOwnedCourse(req.params.courseId, req.user!)
  if (!req.body.title) throw new ApiError(400, "Quiz title is required")
  const quiz = await Quiz.create({ ...pick(req.body, FIELDS), course: req.params.courseId })
  res.status(201).json({ quiz })
})

export const getCourseQuizzes = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId)
  if (!course) throw new ApiError(404, "Course not found")
  const privileged = isOwnerOrAdmin(course, req.user!)
  if (!privileged) await ensureEnrolled(req.user!._id, course._id)

  const quizzes = await Quiz.find({ course: course._id }).sort("createdAt")
  res.json({ quizzes: privileged ? quizzes : quizzes.map(hideAnswers) })
})

export const getQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id)
  if (!quiz) throw new ApiError(404, "Quiz not found")
  const course = await Course.findById(quiz.course)
  if (course && isOwnerOrAdmin(course, req.user!)) return void res.json({ quiz })
  await ensureEnrolled(req.user!._id, quiz.course)
  res.json({ quiz: hideAnswers(quiz) })
})

export const updateQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id)
  if (!quiz) throw new ApiError(404, "Quiz not found")
  await loadOwnedCourse(quiz.course, req.user!)
  Object.assign(quiz, pick(req.body, FIELDS))
  await quiz.save()
  res.json({ quiz })
})

export const deleteQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id)
  if (!quiz) throw new ApiError(404, "Quiz not found")
  await loadOwnedCourse(quiz.course, req.user!)
  await Promise.all([quiz.deleteOne(), QuizAttempt.deleteMany({ quiz: quiz._id })])
  res.json({ message: "Quiz deleted" })
})

export const attemptQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id)
  if (!quiz) throw new ApiError(404, "Quiz not found")
  await ensureEnrolled(req.user!._id, quiz.course)

  const answers: Array<number | null> = Array.isArray(req.body.answers) ? req.body.answers : []
  let score = 0
  let total = 0
  const review = quiz.questions.map((q, i) => {
    const marks = q.marks ?? 1
    total += marks
    const isCorrect = answers[i] === q.correctIndex
    if (isCorrect) score += marks
    return {
      question: q.text,
      options: q.options,
      selected: answers[i] ?? null,
      correctIndex: q.correctIndex,
      isCorrect,
      explanation: q.explanation,
    }
  })

  const percent = total ? Math.round((score / total) * 100) : 0
  const passed = percent >= (quiz.passingScore ?? 50)
  const attempt = await QuizAttempt.create({
    quiz: quiz._id,
    course: quiz.course,
    student: req.user!._id,
    answers: quiz.questions.map((_, i) => answers[i] ?? -1),
    score,
    total,
    percent,
    passed,
  })

  res.status(201).json({
    result: {
      attemptId: attempt._id,
      score,
      total,
      percent,
      passed,
      correct: review.filter((r) => r.isCorrect).length,
      incorrect: review.filter((r) => !r.isCorrect).length,
      review,
    },
  })
})

export const getMyAttempts = asyncHandler(async (req, res) => {
  const attempts = await QuizAttempt.find({ quiz: req.params.id, student: req.user!._id }).sort("-createdAt")
  res.json({ attempts })
})

export const getAllMyAttempts = asyncHandler(async (req, res) => {
  const attempts = await QuizAttempt.find({ student: req.user!._id })
    .populate("quiz", "title")
    .populate("course", "title")
    .sort("-createdAt")
  res.json({ attempts })
})