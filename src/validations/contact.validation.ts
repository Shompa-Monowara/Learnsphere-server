import { z } from "zod"

export const CONTACT_SUBJECTS = [
  "General question",
  "Course or enrollment",
  "Instructor enquiry",
  "Become an instructor",
  "Billing & payments",
  "Team plans",
  "Report a problem",
] as const

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80, "Name is too long"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  subject: z.enum(CONTACT_SUBJECTS, { error: "Choose a topic" }),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(500, "Message must be 500 characters or less"),
  instructor: z.string().trim().max(80).optional(),
})