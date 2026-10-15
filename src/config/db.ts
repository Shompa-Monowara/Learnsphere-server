import mongoose from "mongoose"
import { env } from "./env"

export default async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URI)
    console.log("MongoDB connected")
  } catch (error) {
    console.error("MongoDB connection failed:", (error as Error).message)
    process.exit(1)
  }
}