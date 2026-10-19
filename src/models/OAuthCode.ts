import { Schema, model } from "mongoose"

/* Callback er por frontend ke JWT na diye ei ek-bar-er code dewa hoy */
const oauthCodeSchema = new Schema({
  codeHash: { type: String, required: true, unique: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, required: true },
})

oauthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default model("OAuthCode", oauthCodeSchema)