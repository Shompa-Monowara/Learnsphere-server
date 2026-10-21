import mongoose from "mongoose"
import connectDB from "./config/db"
import Notification from "./models/Notification"
import User from "./models/User"

/*
  Usage:
    npx tsx src/seedAdminNotifications.ts <admin-email>
  Admin dashboard er Notifications page er jonno 5 ta demo notification banay.
  Abar chalale ager demo gulo replace hoy, real notification gulo-te hat dey na.
*/

const MIN = 60 * 1000
const HOUR = 60 * MIN

const DEMO = [
  {
    title: "4 courses awaiting review",
    message: "New submissions need moderation before they go live.",
    link: "/admin/courses",
    ago: 42 * MIN,
    read: false,
  },
  {
    title: "1 course flagged",
    message: "Ethical Hacking Essentials reported for outdated content.",
    link: "/admin/courses",
    ago: 5 * HOUR,
    read: false,
  },
  {
    title: "New teacher pending",
    message: "Hiroshi Tanaka is awaiting profile verification.",
    link: "/admin/users",
    ago: 8 * MIN,
    read: false,
  },
  {
    title: "Monthly revenue target hit",
    message: "The platform reached $412,650 for October.",
    link: "/admin/payments",
    ago: 26 * HOUR,
    read: true,
  },
  {
    title: "Security scan passed",
    message: "No critical vulnerabilities across published courses.",
    link: "/admin/reports",
    ago: 28 * HOUR,
    read: true,
  },
]

async function run() {
  const email = (process.argv[2] || "").trim().toLowerCase()
  if (!email) {
    console.error("Usage: npx tsx src/seedAdminNotifications.ts <admin-email>")
    process.exit(1)
  }

  await connectDB()

  const admin = await User.findOne({ email })
  if (!admin) {
    console.error(`User not found: ${email}`)
    await mongoose.disconnect()
    process.exit(1)
  }

  await Notification.deleteMany({
    user: admin._id,
    $or: DEMO.map((d) => ({ title: d.title, message: d.message })),
  })

  const now = Date.now()
  await Notification.insertMany(
    DEMO.map((d) => ({
      user: admin._id,
      title: d.title,
      message: d.message,
      link: d.link,
      read: d.read,
      createdAt: new Date(now - d.ago),
      updatedAt: new Date(now - d.ago),
    }))
  )

  console.log(`Seeded ${DEMO.length} notifications for ${admin.email} (3 unread)`)
  await mongoose.disconnect()
}

run().catch(async (err) => {
  console.error(err)
  await mongoose.disconnect()
  process.exit(1)
})