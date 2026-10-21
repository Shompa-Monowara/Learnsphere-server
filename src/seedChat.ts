import mongoose from "mongoose"
import connectDB from "./config/db"
import Enrollment from "./models/Enrollment"
import Course from "./models/Course"
import Message from "./models/Message"
import User from "./models/User"

/*
  Usage:
    npx tsx src/seedChat.ts <email>            -> oi user er jonno demo chat banay
    npx tsx src/seedChat.ts <email> --reset    -> ager thread muchhe abar banay
*/

const MINUTE = 60 * 1000

async function findPartner(me: InstanceType<typeof User>) {
  if (me.role === "student") {
    const enrollments = await Enrollment.find({ student: me._id }).select("course")
    const courses = await Course.find({ _id: { $in: enrollments.map((e) => e.course) } }).select("instructor")
    const instructorId = courses[0]?.instructor
    if (instructorId) {
      const t = await User.findById(instructorId)
      if (t) return t
    }
    const anyTeacher = await User.findOne({ role: "teacher", _id: { $ne: me._id } })
    if (anyTeacher) return anyTeacher
  } else {
    const enrollments = await Enrollment.find({
      course: { $in: (await Course.find({ instructor: me._id }).select("_id")).map((c) => c._id) },
    }).select("student")
    if (enrollments[0]) {
      const s = await User.findById(enrollments[0].student)
      if (s) return s
    }
    const anyStudent = await User.findOne({ role: "student", _id: { $ne: me._id } })
    if (anyStudent) return anyStudent
  }

  // Keu na thakle demo user baniye nei
  const role = me.role === "student" ? "teacher" : "student"
  const email = `demo.${role}@learnsphere.com`
  const existing = await User.findOne({ email })
  if (existing) return existing
  return User.create({
    name: role === "teacher" ? "Demo Instructor" : "Demo Student",
    email,
    password: "Demo@12345",
    role,
  })
}

async function run() {
  const email = (process.argv[2] || "").trim().toLowerCase()
  const reset = process.argv.includes("--reset")

  if (!email) {
    console.error("Usage: npx tsx src/seedChat.ts <email> [--reset]")
    process.exit(1)
  }

  await connectDB()

  const me = await User.findOne({ email })
  if (!me) {
    console.error(`User not found: ${email}`)
    await mongoose.disconnect()
    process.exit(1)
  }

  const partner = await findPartner(me)
  const pair = [
    { sender: me._id, receiver: partner._id },
    { sender: partner._id, receiver: me._id },
  ]

  const already = await Message.countDocuments({ $or: pair })
  if (already > 0 && !reset) {
    console.log(`Already ${already} messages between ${me.email} and ${partner.email}. Use --reset to recreate.`)
    await mongoose.disconnect()
    return
  }
  if (reset) {
    const { deletedCount } = await Message.deleteMany({ $or: pair })
    console.log(`Deleted ${deletedCount} old messages`)
  }

  const now = Date.now()
  /* [kar message, text, koto minute age, read kina] */
  const script: [boolean, string, number, boolean][] = [
    [true, "Hello! I just enrolled in your course. Excited to get started.", 180, true],
    [false, "Welcome aboard! Let me know if you get stuck on any lesson.", 170, true],
    [true, "Quick question, where can I find the assignment instructions?", 120, true],
    [false, "Open the Assignments tab, every course assignment is listed there with its due date.", 110, true],
    [true, "Found it, thank you!", 100, true],
    [false, "Great. Also, I just added a new quiz to the course. Give it a try this week.", 30, false],
    [false, "Feel free to message me here if you have any feedback.", 25, false],
  ]

  await Message.insertMany(
    script.map(([fromMe, text, minsAgo, read]) => ({
      sender: fromMe ? me._id : partner._id,
      receiver: fromMe ? partner._id : me._id,
      text,
      read,
      createdAt: new Date(now - minsAgo * MINUTE),
      updatedAt: new Date(now - minsAgo * MINUTE),
    }))
  )

  console.log(`Seeded ${script.length} messages: ${me.email} <-> ${partner.email}`)
  await mongoose.disconnect()
}

run().catch(async (err) => {
  console.error(err)
  await mongoose.disconnect()
  process.exit(1)
})