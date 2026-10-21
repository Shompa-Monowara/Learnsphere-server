import { Schema, model } from "mongoose"

export const ATTACHMENT_KINDS = ["image", "pdf"] as const

const attachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    name: { type: String, default: "file", maxlength: 200 },
    kind: { type: String, enum: ATTACHMENT_KINDS, required: true },
    size: { type: Number, default: 0 },
  },
  { _id: false }
)

const messageSchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /* Attachment thakle text faka hote pare */
    text: { type: String, trim: true, maxlength: 2000, default: "" },
    attachment: { type: attachmentSchema, default: undefined },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
)

messageSchema.pre("validate", function () {
  if (!this.text && !this.attachment) throw new Error("Message cannot be empty")
})

messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 })
messageSchema.index({ receiver: 1, read: 1 })

export default model("Message", messageSchema)