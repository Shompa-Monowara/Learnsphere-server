import type { RequestHandler } from "express"
import type { ZodType } from "zod"

export const validate =
  (schema: ZodType): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join(", ")
      res.status(400).json({ message })
      return
    }
    req.body = result.data
    next()
  }