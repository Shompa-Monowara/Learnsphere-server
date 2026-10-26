import mongoose from "mongoose"
import connectDB from "./config/db"
import Course from "./models/Course"
import User from "./models/User"

const PORTRAITS = Array.from({ length: 8 }, (_, i) => `/instructors/portrait-${i + 1}.jpg`)

async function run() {
  await connectDB()
  const force = process.argv.includes("--force")

  const ids = await Course.distinct("instructor", { status: "published" })
  const filter: Record<string, unknown> = { _id: { $in: ids }, role: "teacher", isBlocked: false }
  if (!force) filter.avatar = ""

  const teachers = await User.find(filter).sort({ createdAt: 1 }).select("name")

  for (const [i, t] of teachers.entries()) {
    const avatar = PORTRAITS[i % PORTRAITS.length]
    await User.updateOne({ _id: t._id }, { avatar })
    console.log(`${t.name} -> ${avatar}`)
  }

  console.log(`Done: ${teachers.length} instructor(s) updated`)
  await mongoose.disconnect()
}

run()