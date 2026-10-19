import { Schema, model } from "mongoose"

const reviewSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "" },
    reply: { type: String, default: "" },
    helpful: { type: Number, default: 0, min: 0 },
    /* kon kon student helpful mark korechhe: ek jon ek bar-i. Default e query te ashe na */
    helpfulBy: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [], select: false },
  },
  { timestamps: true }
)

reviewSchema.index({ course: 1, student: 1 }, { unique: true })

export default model("Review", reviewSchema)