import { Schema, model } from "mongoose"

const attemptSchema = new Schema(
  {
    quiz: { type: Schema.Types.ObjectId, ref: "Quiz", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    answers: [Number],
    score: Number,
    total: Number,
    percent: Number,
    passed: Boolean,
  },
  { timestamps: true }
)

export default model("QuizAttempt", attemptSchema)