import { z } from "zod"
import SiteSettings from "../models/SiteSettings"
import asyncHandler from "../utils/asyncHandler"

const text = (max: number) => z.string().trim().max(max)
const email = z.union([z.literal(""), z.email("Enter a valid email address")])

const schema = z.object({
  general: z
    .object({
      siteName: text(80).min(2, "Site name must be at least 2 characters"),
      supportEmail: z.email("Enter a valid support email"),
      defaultLanguage: text(40).min(1),
      defaultCurrency: z.enum(["USD", "EUR", "GBP", "BDT", "INR"]),
      description: text(500),
    })
    .partial(),
  email: z
    .object({
      fromName: text(80),
      fromEmail: email,
      replyTo: email,
      welcomeEmail: z.boolean(),
      enrollmentEmail: z.boolean(),
      certificateEmail: z.boolean(),
    })
    .partial(),
  payments: z
    .object({
      paymentsEnabled: z.boolean(),
      platformFeePercent: z.number().min(0).max(100),
      taxPercent: z.number().min(0).max(100),
      minPayout: z.number().min(0),
      refundWindowDays: z.number().int().min(0).max(365),
    })
    .partial(),
  appearance: z
    .object({
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Primary color must be a hex value like #0d9488"),
      defaultTheme: z.enum(["light", "dark", "system"]),
      logoUrl: text(500),
      footerText: text(200),
    })
    .partial(),
  integrations: z
    .object({
      googleAnalyticsId: text(40),
      googleLogin: z.boolean(),
      githubLogin: z.boolean(),
      maintenanceMode: z.boolean(),
    })
    .partial(),
})

/* { a: { b: 1 } } -> { "a.b": 1 } jate shudhu pathano field-i update hoy */
function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  return Object.entries(obj).reduce<Record<string, unknown>>((acc, [k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(acc, flatten(v as Record<string, unknown>, path))
    else if (v !== undefined) acc[path] = v
    return acc
  }, {})
}

const SECTIONS = ["general", "email", "payments", "appearance", "integrations"] as const

const load = async () => {
  const doc = await SiteSettings.findOneAndUpdate(
    { key: "site" },
    { $setOnInsert: { key: "site" } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean()
  const settings: Record<string, unknown> = {}
  for (const s of SECTIONS) settings[s] = (doc as Record<string, unknown>)[s]
  return { settings, updatedAt: (doc as { updatedAt?: Date }).updatedAt }
}

export const getSiteSettings = asyncHandler(async (_req, res) => {
  res.json(await load())
})

/* Public: login chhara-o shobai pabe. Shudhu appearance, onno kichu na. */
export const getPublicAppearance = asyncHandler(async (_req, res) => {
  const { settings } = await load()
  const a = settings.appearance as {
    primaryColor: string
    defaultTheme: "light" | "dark" | "system"
    logoUrl: string
    footerText: string
  }
  res.json({
    appearance: {
      primaryColor: a.primaryColor,
      defaultTheme: a.defaultTheme,
      logoUrl: a.logoUrl,
      footerText: a.footerText,
    },
  })
})

export const updateSiteSettings = asyncHandler(async (req, res) => {
  const result = schema.partial().safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ message: result.error.issues.map((i) => i.message).join(", ") })
    return
  }
  await SiteSettings.findOneAndUpdate(
    { key: "site" },
    { $set: flatten(result.data) },
    { upsert: true, setDefaultsOnInsert: true }
  )
  res.json(await load())
})