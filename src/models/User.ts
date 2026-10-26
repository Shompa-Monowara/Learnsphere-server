import bcrypt from "bcryptjs"
import { Schema, model } from "mongoose"
import type { Model, Types } from "mongoose"

export const ROLES = ["student", "teacher", "admin"] as const
export type Role = (typeof ROLES)[number]

export interface IUser {
  name: string
  email: string
  password: string
  role: Role
  avatar: string
  headline: string
  website: string
  bio: string
  isBlocked: boolean
  wishlist: Types.ObjectId[]
  resetToken?: string
  resetExpires?: Date
  passwordChangedAt?: Date
}

export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>
}

type UserModel = Model<IUser, {}, IUserMethods>

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ROLES, default: "student" },
    avatar: { type: String, default: "" },
    headline: { type: String, default: "" },
    website: { type: String, default: "", trim: true, maxlength: 200 },
    bio: { type: String, default: "" },
    isBlocked: { type: Boolean, default: false },
    wishlist: [{ type: Schema.Types.ObjectId, ref: "Course" }],
    resetToken: { type: String, select: false },
    resetExpires: { type: Date, select: false },
    /* Password reset hole set hoy. Er age issue howa shob JWT invalid */
    passwordChangedAt: { type: Date },
  },
  { timestamps: true }
)

userSchema.pre("save", async function () {
  if (this.isModified("password")) this.password = await bcrypt.hash(this.password, 12)
})

userSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.password)
}

export default model<IUser, UserModel>("User", userSchema)