import { Schema, model } from "mongoose"

export const SUBMISSION_TYPES = ["file", "text", "both"] as const

const assignmentSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true },
    instructions: { type: String, default: "" },
    dueDate: { type: Date, required: true },
    totalMarks: { type: Number, default: 100 },
    attachments: [String],

    /* file = shudhu file, text = shudhu written answer, both = duitoi lagbe */
    submissionType: { type: String, enum: SUBMISSION_TYPES, default: "file" },
    isPublished: { type: Boolean, default: true },
    allowLate: { type: Boolean, default: true },
    allowResubmission: { type: Boolean, default: true },
    /* khali thakle shob file type cholbe. extension, dot chhara (pdf, zip) */
    allowedFileTypes: { type: [String], default: [] },
    maxFileSizeMB: { type: Number, default: 50, min: 1, max: 100 },
  },
  { timestamps: true }
)

export default model("Assignment", assignmentSchema)