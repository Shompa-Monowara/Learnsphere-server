import { Schema, model } from "mongoose"

/* Admin je instructor profile banay (login chhara). Publish korle Instructors page-e dekhay */
export interface IMentor {
  name: string
  avatar: string
  headline: string
  bio: string
  category: string
  skills: string[]
  isPublished: boolean
}

const mentorSchema = new Schema<IMentor>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    avatar: { type: String, default: "" },
    headline: { type: String, default: "", trim: true, maxlength: 120 },
    bio: { type: String, default: "", trim: true, maxlength: 1000 },
    category: { type: String, default: "", trim: true, maxlength: 60 },
    skills: { type: [String], default: [] },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
)

export default model<IMentor>("Mentor", mentorSchema)