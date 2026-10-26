import mongoose from "mongoose"
import connectDB from "./config/db"
import { env } from "./config/env"
import Assignment from "./models/Assignment"
import Category from "./models/Category"
import Course from "./models/Course"
import Enrollment from "./models/Enrollment"
import Quiz from "./models/Quiz"
import Submission from "./models/Submission"
import User from "./models/User"
import { slugify } from "./utils/helpers"

const DEMO_COURSE_TITLE = "Complete Web Development Bootcamp (Demo)"
/* Public sample media. Chaile nijer Cloudinary URL diye bodle nio */
const SAMPLE_VIDEO = "https://res.cloudinary.com/demo/video/upload/dog.mp4"
const SAMPLE_PDF = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
const SAMPLE_THUMB = "https://res.cloudinary.com/demo/image/upload/sample.jpg"
const DAY = 24 * 60 * 60 * 1000

async function ensureUser(
  name: string,
  email: string,
  password: string,
  role: "teacher" | "student",
  extra: { headline?: string; bio?: string } = {}
) {
  const found = await User.findOne({ email })
  if (found) return found
  const user = await User.create({ name, email, password, role, ...extra })
  console.log(`${role} created: ${email} / ${password}`)
  return user
}

async function createDemoCourse(teacherId: mongoose.Types.ObjectId, studentId: mongoose.Types.ObjectId) {
  const category = await Category.findOne({ slug: slugify("Web Development") })
  const courseId = new mongoose.Types.ObjectId()

  const quiz = await Quiz.create({
    course: courseId,
    title: "HTML & CSS Basics Quiz",
    duration: 10,
    passingScore: 60,
    isPublished: true,
    feedbackTiming: "immediate",
    questions: [
      {
        type: "mcq",
        text: "Which HTML tag is used for the largest heading?",
        options: ["<h6>", "<h1>", "<head>", "<header>"],
        correctIndex: 1,
        marks: 1,
        explanation: "<h1> is the top-level (largest) heading.",
      },
      {
        type: "mcq",
        text: "Which CSS property changes the text colour?",
        options: ["font-style", "text-align", "color", "background"],
        correctIndex: 2,
        marks: 1,
        explanation: "The color property sets the text colour.",
      },
      {
        type: "mcq",
        text: "What does CSS stand for?",
        options: ["Creative Style Sheets", "Cascading Style Sheets", "Computer Style Sheets", "Colorful Style Sheets"],
        correctIndex: 1,
        marks: 1,
        explanation: "CSS = Cascading Style Sheets.",
      },
      {
        type: "written",
        text: "In your own words, explain the difference between an HTML element and an attribute.",
        options: [],
        sampleAnswer: "An element is a building block of the page (like <p>); an attribute gives it extra information (like class or href).",
        marks: 5,
        explanation: "",
      },
    ],
  })

  const fileAssignment = await Assignment.create({
    course: courseId,
    title: "Build a personal profile page",
    instructions:
      "Create a one-page personal profile using HTML and CSS. Include a heading, a short bio, a photo, and a list of your skills. Zip your project folder and upload it.",
    dueDate: new Date(Date.now() + 30 * DAY),
    totalMarks: 100,
    submissionType: "file",
    allowedFileTypes: ["zip", "pdf"],
    maxFileSizeMB: 20,
    allowLate: true,
    allowResubmission: true,
    isPublished: true,
  })

  const writtenAssignment = await Assignment.create({
    course: courseId,
    title: "Reflection: what did you learn?",
    instructions: "Write 150–300 words about the most useful thing you learned in the first two sections and how you plan to use it.",
    dueDate: new Date(Date.now() + 14 * DAY),
    totalMarks: 20,
    submissionType: "text",
    allowLate: true,
    allowResubmission: true,
    isPublished: true,
  })

  await Course.create({
    _id: courseId,
    title: DEMO_COURSE_TITLE,
    shortDescription: "Learn HTML and CSS from scratch with videos, a quiz, and hands-on assignments.",
    description:
      "A short demo course that shows every LearnSphere feature: video and PDF lessons, an auto-graded quiz with a written question, file and written assignments, progress tracking, and a completion certificate.",
    category: category?._id,
    instructor: teacherId,
    level: "beginner",
    language: "English",
    price: 0,
    thumbnail: SAMPLE_THUMB,
    previewVideo: SAMPLE_VIDEO,
    requirements: ["A computer with internet access", "No prior coding experience needed"],
    outcomes: ["Build a simple web page with HTML and CSS", "Understand how the web works", "Complete a quiz and two assignments"],
    status: "published",
    sections: [
      {
        title: "Getting started",
        lessons: [
          { title: "Welcome to the course", type: "video", url: SAMPLE_VIDEO, duration: 5, isPreview: true },
          { title: "Course roadmap (PDF)", type: "pdf", url: SAMPLE_PDF, duration: 5 },
        ],
      },
      {
        title: "HTML & CSS basics",
        lessons: [
          { title: "Building your first page", type: "video", url: SAMPLE_VIDEO, duration: 12 },
          { title: "Styling with CSS", type: "video", url: SAMPLE_VIDEO, duration: 15 },
        ],
      },
      {
        title: "Practice & assessment",
        lessons: [
          { title: "HTML & CSS Basics Quiz", type: "quiz", quiz: quiz._id, duration: 10 },
          { title: "Build a personal profile page", type: "assignment", assignment: fileAssignment._id, duration: 30 },
          { title: "Reflection: what did you learn?", type: "assignment", assignment: writtenAssignment._id, duration: 15 },
        ],
      },
    ],
  })

  /* Teacher er grading queue khali na thakar jonno ekta sample written submission */
  await Submission.create({
    assignment: writtenAssignment._id,
    course: courseId,
    student: studentId,
    text:
      "The most useful thing I learned is how CSS separates design from structure. I used to think styling and content had to live together, but now I can change the whole look of a page without touching the HTML. I plan to use this to restyle my personal blog.",
    isLate: false,
    submittedAt: new Date(),
  })

  console.log(`Demo course created: ${DEMO_COURSE_TITLE}`)
  return courseId
}

async function seedDemo() {
  const teacher = await ensureUser("Demo Teacher", "teacher@learnsphere.com", "Teacher@123", "teacher", {
    headline: "Full-stack developer & instructor",
    bio: "I teach web development to beginners with short, practical lessons.",
  })
  const student = await ensureUser("Demo Student", "student@learnsphere.com", "Student@123", "student")

  const existing = await Course.findOne({ title: DEMO_COURSE_TITLE })
  const courseId = existing?._id ?? (await createDemoCourse(teacher._id, student._id))

  const res = await Enrollment.updateOne(
    { student: student._id, course: courseId },
    { $setOnInsert: { student: student._id, course: courseId } },
    { upsert: true }
  )
  if (res.upsertedCount > 0) await Course.updateOne({ _id: courseId }, { $inc: { studentsCount: 1 } })
}

async function seed() {
  await connectDB()

  if (!(await User.findOne({ email: "admin@learnsphere.com" }))) {
    await User.create({
      name: "Admin",
      email: "admin@learnsphere.com",
      password: "Admin@123",
      role: "admin",
    })
    console.log("Admin created: admin@learnsphere.com / Admin@123")
  }

  const names = ["Web Development", "Data Science", "UI/UX Design", "Business", "Marketing", "Language"]
  for (const name of names) {
    await Category.updateOne({ slug: slugify(name) }, { name, slug: slugify(name) }, { upsert: true })
  }

  if (env.NODE_ENV !== "production" || process.env.SEED_DEMO === "true") {
    await seedDemo()
  } else {
    console.log("Production mode: demo data skipped (set SEED_DEMO=true to include it)")
  }

  console.log("Seed complete")
  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})