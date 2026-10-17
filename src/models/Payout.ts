import { Schema, model } from "mongoose"

const payoutSchema = new Schema(
  {
    instructor: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reference: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: ["bank", "paypal"], default: "bank" },
    status: { type: String, enum: ["pending", "paid", "rejected"], default: "pending" },
  },
  { timestamps: true }
)

export default model("Payout", payoutSchema)