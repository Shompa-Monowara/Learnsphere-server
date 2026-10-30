import { z } from "zod"

export const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(120, "Email is too long"),
})