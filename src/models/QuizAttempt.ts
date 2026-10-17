import { Schema, model } from "mongoose"

const writtenSchema = new Schema(
  {
    index: { type: Number, required: true }, 
    answer: { type: String, default: "" },
    marks: { type: Number, default: 1 }, 
    awarded: { type: Number, default: null }, 
    feedback: { type: String, default: "" },
  },
  { _id: false }
)

const attemptSchema = new Schema(
  {
    quiz: { type: Schema.Types.ObjectId, ref: "Quiz", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    answers: [Number],
    mcqScore: { type: Number, default: 0 },
    written: [writtenSchema],
    status: { type: String, enum: ["graded", "pending"], default: "graded" },
    score: Number,
    total: Number,
    percent: Number,
    passed: Boolean,
  },
  { timestamps: true }
)

export default model("QuizAttempt", attemptSchema)