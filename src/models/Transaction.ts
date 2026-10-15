import { Schema, model } from "mongoose"

const transactionSchema = new Schema(
  {
    transactionId: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    instructor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    amount: { type: Number, required: true },
    method: { type: String, default: "manual" },
    status: { type: String, enum: ["paid", "pending", "failed", "refunded"], default: "paid" },
  },
  { timestamps: true }
)

export default model("Transaction", transactionSchema)