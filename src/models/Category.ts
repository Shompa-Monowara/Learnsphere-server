import { Schema, model } from "mongoose"

const categorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true },
    icon: { type: String, default: "book-open" },
  },
  { timestamps: true }
)

export default model("Category", categorySchema)