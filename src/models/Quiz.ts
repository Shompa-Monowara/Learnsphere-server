import { Schema, model } from "mongoose"

const questionSchema = new Schema({
  text: { type: String, required: true },
  options: { type: [String], validate: (v: string[]) => v.length >= 2 },
  correctIndex: { type: Number, required: true },
  marks: { type: Number, default: 1 },
  explanation: { type: String, default: "" },
})

const quizSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true },
    duration: { type: Number, default: 10 },
    passingScore: { type: Number, default: 50 },
    questions: [questionSchema],
  },
  { timestamps: true }
)

export default model("Quiz", quizSchema)