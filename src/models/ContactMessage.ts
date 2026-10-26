import { Schema, model } from "mongoose"

const contactMessageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    instructor: { type: String, default: "", trim: true },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["new", "read", "replied"], default: "new" },
  },
  { timestamps: true }
)

export default model("ContactMessage", contactMessageSchema)