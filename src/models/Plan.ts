import { Schema, model } from "mongoose"

/* Pricing page er ekta plan (Free / Pro / Academy) */
const planSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    tagline: { type: String, default: "" },
    monthlyPrice: { type: Number, default: 0, min: 0 },
    priceNote: { type: String, default: "/ month" },
    cta: { type: String, required: true },
    ctaTo: { type: String, default: "/register" },
    popular: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    /* Card er bullet list */
    features: { type: [String], default: [] },
    /* Comparison table er cell: { courses: "Up to 2", video: true, drip: false, ... } */
    values: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false }
)

export default model("Plan", planSchema)