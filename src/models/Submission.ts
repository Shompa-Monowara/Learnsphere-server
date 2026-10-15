import { Schema, model } from "mongoose"

const historySchema = new Schema(
  {
    fileUrl: String,
    submittedAt: Date,
  },
  { _id: false }
)

const submissionSchema = new Schema(
  {
    assignment: { type: Schema.Types.ObjectId, ref: "Assignment", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fileUrl: { type: String, required: true },
    note: { type: String, default: "" },
    isLate: { type: Boolean, default: false },
    status: { type: String, enum: ["submitted", "graded"], default: "submitted" },
    score: Number,
    feedback: String,
    history: [historySchema],
  },
  { timestamps: true }
)

submissionSchema.index({ assignment: 1, student: 1 }, { unique: true })

export default model("Submission", submissionSchema)