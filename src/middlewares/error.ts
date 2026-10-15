import type { ErrorRequestHandler, RequestHandler } from "express"

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` })
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status: number = err.status || 500
  let message: string = err.message || "Server error"

  if (err.name === "CastError") {
    status = 400
    message = "Invalid ID"
  } else if (err.code === 11000) {
    status = 409
    message = `${Object.keys(err.keyValue || {})[0] || "Value"} already exists`
  } else if (err.name === "ValidationError") {
    status = 400
    message = Object.values(err.errors as Record<string, { message: string }>)
      .map((e) => e.message)
      .join(", ")
  } else if (err.name === "MulterError") {
    status = 400
  }

  if (status === 500) console.error(err)
  res.status(status).json({ message })
}