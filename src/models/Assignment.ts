import { Schema, model } from "mongoose"

const assignmentSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true },
    instructions: { type: String, default: "" },
    dueDate: { type: Date, required: true },
    totalMarks: { type: Number, default: 100 },
    attachments: [String],
  },
  { timestamps: true }
)

export default model("Assignment", assignmentSchema)