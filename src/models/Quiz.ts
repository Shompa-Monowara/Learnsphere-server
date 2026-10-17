import { Schema, model } from "mongoose"

export const QUESTION_TYPES = ["mcq", "written"] as const
export const FEEDBACK_TIMINGS = ["immediate", "after_pass", "never"] as const

const questionSchema = new Schema({
  type: { type: String, enum: QUESTION_TYPES, default: "mcq" },
  text: { type: String, required: true },
  options: {
    type: [String],
    validate: {
      validator: function (this: any, v: string[]) {
        return this.type === "written" || v.length >= 2
      },
      message: "A multiple-choice question needs at least two options",
    },
  },
  correctIndex: {
    type: Number,
    required: function (this: any) {
      return this.type !== "written"
    },
  },
  sampleAnswer: { type: String, default: "" },
  marks: { type: Number, default: 1 },
  explanation: { type: String, default: "" },
})

const quizSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true },
    duration: { type: Number, default: 10 },
    passingScore: { type: Number, default: 50 },
    isPublished: { type: Boolean, default: true },
    feedbackTiming: { type: String, enum: FEEDBACK_TIMINGS, default: "immediate" },
    questions: [questionSchema],
  },
  { timestamps: true }
)

export default model("Quiz", quizSchema)