import type { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"
import { env } from "../config/env"
import User from "../models/User"
import type { Role } from "../models/User"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"

const getToken = (req: Request): string | null => {
  const header = req.headers.authorization
  return header?.startsWith("Bearer ") ? header.split(" ")[1] : null
}

export const protect = asyncHandler(async (req, _res, next) => {
  const token = getToken(req)
  if (!token) throw new ApiError(401, "Not authenticated")

  let decoded: { id: string }
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as { id: string }
  } catch {
    throw new ApiError(401, "Invalid or expired token")
  }

  const user = await User.findById(decoded.id)
  if (!user) throw new ApiError(401, "User no longer exists")
  if (user.isBlocked) throw new ApiError(403, "Your account has been blocked")
  req.user = user
  next()
})

export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = getToken(req)
  if (token) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string }
      const user = await User.findById(decoded.id)
      if (user && !user.isBlocked) req.user = user
    } catch {
      /* treat as guest */
    }
  }
  next()
})

export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) =>
    req.user && roles.includes(req.user.role)
      ? next()
      : next(new ApiError(403, "You do not have permission to perform this action"))