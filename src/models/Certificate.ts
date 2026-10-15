import { Schema, model } from "mongoose"

const certificateSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    verificationId: { type: String, required: true, unique: true },
  },
  { timestamps: true }
)

certificateSchema.index({ student: 1, course: 1 }, { unique: true })

export default model("Certificate", certificateSchema)