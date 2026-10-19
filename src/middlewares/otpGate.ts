import type { RequestHandler } from "express"
import { env } from "../config/env"
import ApiError from "../utils/ApiError"

/* Purono /auth/register bypass bondho korar jonno. Frontend ready hole REQUIRE_EMAIL_OTP=true koro */
export const blockDirectRegister: RequestHandler = (_req, _res, next) =>
  env.REQUIRE_EMAIL_OTP
    ? next(new ApiError(403, "Email verification is required. Please use the OTP sign-up flow."))
    : next()