import { Schema, model } from "mongoose"

const completedLessonSchema = new Schema(
  {
    lesson: { type: Schema.Types.ObjectId, required: true },
    completedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const enrollmentSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    completedLessons: [completedLessonSchema],
    progress: { type: Number, default: 0 },
    completedAt: Date,
  },
  { timestamps: true }
)

enrollmentSchema.index({ student: 1, course: 1 }, { unique: true })

export default model("Enrollment", enrollmentSchema)