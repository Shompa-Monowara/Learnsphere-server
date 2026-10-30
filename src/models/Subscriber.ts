import { Schema, model } from "mongoose"

const subscriberSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    status: { type: String, enum: ["active", "unsubscribed"], default: "active" },
    /* Email er unsubscribe link e ei token jabe (guess kora jay na) */
    unsubscribeToken: { type: String, required: true, unique: true },
    source: { type: String, default: "home", trim: true },
    unsubscribedAt: Date,
  },
  { timestamps: true }
)

export default model("Subscriber", subscriberSchema)