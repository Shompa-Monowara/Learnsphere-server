import crypto from "crypto"
import mongoose from "mongoose"
import connectDB from "./config/db"
import Course from "./models/Course"
import Enrollment from "./models/Enrollment"
import Transaction from "./models/Transaction"
import User from "./models/User"

/* Kotogulo student banabe */
const STUDENT_COUNT = 20

async function run() {
  await connectDB()

  const courses = await Course.find({ status: "published" })
  if (!courses.length) {
    console.log("Kono published course nai. Age course approve koro.")
    await mongoose.disconnect()
    return
  }

  let sales = 0
  for (let i = 1; i <= STUDENT_COUNT; i++) {
    const email = `student${i}@test.com`
    let student = await User.findOne({ email })
    if (!student) {
      student = await User.create({ name: `Test Student ${i}`, email, password: "Student@123", role: "student" })
    }

    for (const course of courses) {
      const res = await Enrollment.updateOne(
        { student: student._id, course: course._id },
        { $setOnInsert: { student: student._id, course: course._id } },
        { upsert: true }
      )
      if (res.upsertedCount === 0) continue // already enrolled, tai sale-o ageii hoyeche

      await Course.updateOne({ _id: course._id }, { $inc: { studentsCount: 1 } })

      if (course.price > 0) {
        await Transaction.create({
          transactionId: `TXN-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
          user: student._id,
          instructor: course.instructor,
          course: course._id,
          amount: course.price,
          method: "stripe",
          status: "paid",
        })
        sales++
      }
    }
  }

  console.log(`Done: ${STUDENT_COUNT} students, ${sales} paid sale(s) recorded across ${courses.length} course(s)`)
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})