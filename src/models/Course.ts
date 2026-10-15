import { Schema, model } from "mongoose"

const lessonSchema = new Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ["video", "pdf", "quiz", "assignment"], default: "video" },
  url: String,
  duration: { type: Number, default: 0 },
  isPreview: { type: Boolean, default: false },
  quiz: { type: Schema.Types.ObjectId, ref: "Quiz" },
  assignment: { type: Schema.Types.ObjectId, ref: "Assignment" },
})

const sectionSchema = new Schema({
  title: { type: String, required: true },
  lessons: [lessonSchema],
})

const courseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    shortDescription: { type: String, default: "" },
    description: { type: String, default: "" },
    category: { type: Schema.Types.ObjectId, ref: "Category" },
    instructor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    level: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "beginner" },
    language: { type: String, default: "English" },
    price: { type: Number, default: 0, min: 0 },
    discountPrice: { type: Number, min: 0 },
    thumbnail: { type: String, default: "" },
    previewVideo: { type: String, default: "" },
    requirements: [String],
    outcomes: [String],
    sections: [sectionSchema],
    status: {
      type: String,
      enum: ["draft", "pending", "published", "rejected", "unpublished"],
      default: "draft",
    },
    rejectionReason: String,
    lessonsCount: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 },
    studentsCount: { type: Number, default: 0 },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
)

courseSchema.pre("save", function () {
  const lessons = this.sections.flatMap((s) => s.lessons)
  this.lessonsCount = lessons.length
  this.totalDuration = lessons.reduce((sum, l) => sum + (l.duration || 0), 0)
})

courseSchema.index({ title: "text", shortDescription: "text" })

export default model("Course", courseSchema)