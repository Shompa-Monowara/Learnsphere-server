import { Schema, model } from "mongoose"

export const PROVIDERS = ["google", "github"] as const

const authIdentitySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, enum: PROVIDERS, required: true },
    /* Google "sub" / GitHub numeric id. Email ba username na, karon oigulo bodlate pare */
    providerId: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
  },
  { timestamps: true }
)

authIdentitySchema.index({ provider: 1, providerId: 1 }, { unique: true })
authIdentitySchema.index({ user: 1, provider: 1 }, { unique: true })

export default model("AuthIdentity", authIdentitySchema)