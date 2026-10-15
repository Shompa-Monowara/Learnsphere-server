import mongoose from "mongoose"
import connectDB from "./config/db"
import Category from "./models/Category"
import User from "./models/User"
import { slugify } from "./utils/helpers"

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

  console.log("Seed complete")
  await mongoose.disconnect()
}

seed()