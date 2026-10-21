import mongoose from "mongoose"
import connectDB from "./config/db"
import Notification from "./models/Notification"
import User from "./models/User"

/*
  Usage:
    npx tsx src/seedTeacherNotifications.ts <teacher-email>
  Teacher dashboard er Notifications page er jonno 5 ta demo notification banay.
  Abar chalale ager demo gulo replace hoy, tomar real notification gulo-te hat dey na.
*/

const MIN = 60 * 1000
const HOUR = 60 * MIN

const DEMO = [
  {
    title: "3 new submissions to grade",
    message: "Build a responsive dashboard layout — 3 students submitted work.",
    link: "/teacher/assignments",
    ago: 20 * MIN,
    read: false,
  },
  {
    title: "New 5-star review",
    message: "Grace Lindqvist rated Modern React & TypeScript 5 stars.",
    link: "/teacher/reviews",
    ago: 2 * HOUR,
    read: false,
  },
  {
    title: "14 new enrollments",
    message: "Your courses gained 14 new students this week.",
    link: "/teacher/students",
    ago: 6 * HOUR,
    read: false,
  },
  {
    title: "Payout completed",
    message: "$9,860.00 was transferred to your bank account.",
    link: "/teacher/earnings",
    ago: 26 * HOUR,
    read: true,
  },
  {
    title: "New student question",
    message: "A student asked about lesson 5 formatting.",
    link: "/teacher/messages",
    ago: 50 * HOUR,
    read: true,
  },
]

async function run() {
  const email = (process.argv[2] || "").trim().toLowerCase()
  if (!email) {
    console.error("Usage: npx tsx src/seedTeacherNotifications.ts <teacher-email>")
    process.exit(1)
  }

  await connectDB()

  const teacher = await User.findOne({ email })
  if (!teacher) {
    console.error(`User not found: ${email}`)
    await mongoose.disconnect()
    process.exit(1)
  }

  /* Ager demo gulo shoriye dei (exact title + message mile gele), real gulo thake */
  await Notification.deleteMany({
    user: teacher._id,
    $or: DEMO.map((d) => ({ title: d.title, message: d.message })),
  })

  const now = Date.now()
  await Notification.insertMany(
    DEMO.map((d) => ({
      user: teacher._id,
      title: d.title,
      message: d.message,
      link: d.link,
      read: d.read,
      createdAt: new Date(now - d.ago),
      updatedAt: new Date(now - d.ago),
    }))
  )

  console.log(`Seeded ${DEMO.length} notifications for ${teacher.email} (3 unread)`)
  await mongoose.disconnect()
}

run().catch(async (err) => {
  console.error(err)
  await mongoose.disconnect()
  process.exit(1)
})