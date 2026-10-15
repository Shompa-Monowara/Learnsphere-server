import { Schema, model } from "mongoose"

const reviewSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "" },
    reply: { type: String, default: "" },
  },
  { timestamps: true }
)

reviewSchema.index({ course: 1, student: 1 }, { unique: true })

export default model("Review", reviewSchema)