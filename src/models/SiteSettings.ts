import { Schema, model } from "mongoose"

/* Puro platform er jonno ekta-i document thake (key = "site") */
const siteSettingsSchema = new Schema(
  {
    key: { type: String, default: "site", unique: true },
    general: {
      siteName: { type: String, default: "LearnSphere", trim: true },
      supportEmail: { type: String, default: "support@learnsphere.com", trim: true },
      defaultLanguage: { type: String, default: "English" },
      defaultCurrency: { type: String, default: "USD" },
      description: {
        type: String,
        default:
          "LearnSphere is the all-in-one learning platform where academies and teachers share lessons, run quizzes, and issue certificates.",
      },
    },
    email: {
      fromName: { type: String, default: "LearnSphere" },
      fromEmail: { type: String, default: "no-reply@learnsphere.com" },
      replyTo: { type: String, default: "" },
      welcomeEmail: { type: Boolean, default: true },
      enrollmentEmail: { type: Boolean, default: true },
      certificateEmail: { type: Boolean, default: true },
    },
    payments: {
      paymentsEnabled: { type: Boolean, default: true },
      platformFeePercent: { type: Number, default: 20 },
      taxPercent: { type: Number, default: 0 },
      minPayout: { type: Number, default: 50 },
      refundWindowDays: { type: Number, default: 7 },
    },
    appearance: {
      primaryColor: { type: String, default: "#0d9488" },
      defaultTheme: { type: String, enum: ["light", "dark", "system"], default: "light" },
      logoUrl: { type: String, default: "" },
      footerText: { type: String, default: "" },
    },
    integrations: {
      googleAnalyticsId: { type: String, default: "" },
      googleLogin: { type: Boolean, default: true },
      githubLogin: { type: Boolean, default: true },
      maintenanceMode: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
)

export default model("SiteSettings", siteSettingsSchema)