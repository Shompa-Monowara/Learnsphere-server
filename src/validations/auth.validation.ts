import { z } from "zod"

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["student", "teacher"]).optional(),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

export const completeRegisterSchema = registerSchema.extend({
  otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
})

export const resendOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
})

export const verifyLoginOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
})