import { Schema, model } from "mongoose"

/* Teacher er plan subscription. Ek user er ekta-i record (unique) */
const subscriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    plan: { type: String, required: true }, // Plan.slug (pro / academy)
    interval: { type: String, enum: ["month", "year"], default: "month" },
    /* Stripe status: trialing | active | past_due | canceled | unpaid ... */
    status: { type: String, default: "active" },
    amount: { type: Number, default: 0 }, // per billing interval, USD
    stripeCustomerId: { type: String, default: "" },
    stripeSubscriptionId: { type: String, unique: true, sparse: true },
    currentPeriodEnd: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { timestamps: true }
)

export default model("Subscription", subscriptionSchema)