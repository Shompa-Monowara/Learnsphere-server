import Course from "../models/Course"
import Quiz, { FEEDBACK_TIMINGS } from "../models/Quiz"
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

/** student-দের কাছ থেকে উত্তর ও নমুনা উত্তর লুকায় */
const hideAnswers = (quiz: any) => {
  const data = quiz.toObject()
  data.questions = data.questions.map(({ correctIndex, explanation, sampleAnswer, ...q }: any) => q)
  return data
}

const FIELDS = ["title", "duration", "passingScore", "questions", "isPublished", "feedbackTiming"]

/** প্রশ্নগুলো যাচাই করে পরিষ্কার আকারে ফেরত দেয় */
const cleanQuestions = (raw: unknown) => {
  if (!Array.isArray(raw) || raw.length === 0) throw new ApiError(400, "Add at least one question")

  return raw.map((item, i) => {
    const q = (item ?? {}) as Record<string, unknown>
    const type = q.type === "written" ? "written" : "mcq"
    const text = String(q.text ?? "").trim()
    if (!text) throw new ApiError(400, `Question ${i + 1} needs text`)
    const marks = Math.max(1, Number(q.marks) || 1)
    const explanation = String(q.explanation ?? "").trim()

    if (type === "written") {
      return { type, text, marks, explanation, options: [] as string[], sampleAnswer: String(q.sampleAnswer ?? "").trim() }
    }

    const options = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()) : []
    if (options.length < 2 || options.some((o) => !o)) {
      throw new ApiError(400, `Question ${i + 1} needs at least two non-empty options`)
    }
    const correctIndex = Number(q.correctIndex)
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      throw new ApiError(400, `Question ${i + 1} needs a valid correct answer`)
    }
    return { type, text, marks, explanation, options, correctIndex, sampleAnswer: "" }
  })
}

const buildPayload = (body: Record<string, unknown>) => {
  const data: Record<string, any> = { ...pick(body, FIELDS) }
  if (body.questions !== undefined) data.questions = cleanQuestions(body.questions)
  if (body.isPublished !== undefined) data.isPublished = Boolean(body.isPublished)
  if (body.feedbackTiming !== undefined && !(FEEDBACK_TIMINGS as readonly string[]).includes(String(body.feedbackTiming))) {
    delete data.feedbackTiming
  }
  return data
}

export const createQuiz = asyncHandler(async (req, res) => {
  await loadOwnedCourse(req.params.courseId, req.user!)
  if (!req.body.title) throw new ApiError(400, "Quiz title is required")
  const quiz = await Quiz.create({ ...buildPayload(req.body), course: req.params.courseId })
  res.status(201).json({ quiz })
})

export const getCourseQuizzes = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId)
  if (!course) throw new ApiError(404, "Course not found")
  const privileged = isOwnerOrAdmin(course, req.user!)
  if (!privileged) await ensureEnrolled(req.user!._id, course._id)

  const filter = privileged ? { course: course._id } : { course: course._id, isPublished: { $ne: false } }
  const quizzes = await Quiz.find(filter).sort("createdAt")
  res.json({ quizzes: privileged ? quizzes : quizzes.map(hideAnswers) })
})

export const getQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id)
  if (!quiz) throw new ApiError(404, "Quiz not found")
  const course = await Course.findById(quiz.course)
  if (course && isOwnerOrAdmin(course, req.user!)) return void res.json({ quiz })
  if (quiz.isPublished === false) throw new ApiError(404, "Quiz not found")
  await ensureEnrolled(req.user!._id, quiz.course)
  res.json({ quiz: hideAnswers(quiz) })
})

export const updateQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id)
  if (!quiz) throw new ApiError(404, "Quiz not found")
  await loadOwnedCourse(quiz.course, req.user!)
  Object.assign(quiz, buildPayload(req.body))
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

interface ReviewRow {
  type: "mcq" | "written"
  question: string
  options: string[]
  selected: number | null
  answer: string
  correctIndex: number | null
  isCorrect: boolean | null
  explanation: string
  marks: number
}

export const attemptQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id)
  if (!quiz || quiz.isPublished === false) throw new ApiError(404, "Quiz not found")
  await ensureEnrolled(req.user!._id, quiz.course)

  const answers: unknown[] = Array.isArray(req.body.answers) ? req.body.answers : []
  let mcqScore = 0
  let total = 0
  const written: { index: number; answer: string; marks: number; awarded: number | null; feedback: string }[] = []

  const rows: ReviewRow[] = quiz.questions.map((q, i) => {
    const marks = q.marks ?? 1
    total += marks

    if (q.type === "written") {
      const raw = answers[i]
      const answer = typeof raw === "string" ? raw.trim().slice(0, 5000) : ""
      
      written.push({ index: i, answer, marks, awarded: answer ? null : 0, feedback: "" })
      return {
        type: "written",
        question: q.text,
        options: [],
        selected: null,
        answer,
        correctIndex: null,
        isCorrect: null,
        explanation: q.explanation ?? "",
        marks,
      }
    }

    const raw = answers[i]
    const selected = typeof raw === "number" ? raw : null
    const isCorrect = selected === q.correctIndex
    if (isCorrect) mcqScore += marks
    return {
      type: "mcq",
      question: q.text,
      options: [...q.options],
      selected,
      answer: "",
      correctIndex: q.correctIndex ?? null,
      isCorrect,
      explanation: q.explanation ?? "",
      marks,
    }
  })

  const pending = written.filter((w) => w.awarded === null).length
  const status = pending > 0 ? "pending" : "graded"
  const score = mcqScore + written.reduce((n, w) => n + (w.awarded ?? 0), 0)
  const percent = total ? Math.round((score / total) * 100) : 0
  const passed = status === "graded" && percent >= (quiz.passingScore ?? 50)

  const attempt = await QuizAttempt.create({
    quiz: quiz._id,
    course: quiz.course,
    student: req.user!._id,
    answers: quiz.questions.map((_, i) => (typeof answers[i] === "number" ? answers[i] : -1)),
    mcqScore,
    written,
    status,
    score,
    total,
    percent,
    passed,
  })

  const timing = quiz.feedbackTiming ?? "immediate"
  const reveal = timing === "never" ? false : timing === "after_pass" ? passed : true
  const review = reveal ? rows : rows.map((r) => ({ ...r, correctIndex: null, isCorrect: null, explanation: "" }))

  res.status(201).json({
    result: {
      attemptId: attempt._id,
      score,
      total,
      percent,
      passed,
      status,
      pending,
      reveal,
      correct: rows.filter((r) => r.isCorrect === true).length,
      incorrect: rows.filter((r) => r.isCorrect === false).length,
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