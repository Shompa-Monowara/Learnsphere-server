import { Schema, model } from "mongoose"

const quizStartSchema = new Schema({
  quiz: { type: Schema.Types.ObjectId, ref: "Quiz", required: true },
  student: { type: Schema.Types.ObjectId, ref: "User", required: true },
  startedAt: { type: Date, default: Date.now },
})

quizStartSchema.index({ quiz: 1, student: 1 }, { unique: true })
// abandoned sessions auto-delete after 1 day
quizStartSchema.index({ startedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 })

export default model("QuizStart", quizStartSchema)