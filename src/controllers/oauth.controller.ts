import crypto from "crypto"
import { Types } from "mongoose"
import type { Request, Response } from "express"
import { OAuth2Client } from "google-auth-library"
import { env } from "../config/env"
import AuthIdentity from "../models/AuthIdentity"
import OAuthCode from "../models/OAuthCode"
import User from "../models/User"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"
import { readState, startState } from "../utils/oauthState"
import type { OAuthIntent } from "../utils/oauthState"
import { respond } from "./auth.controller"

type Provider = OAuthIntent["provider"]
type Mode = OAuthIntent["mode"]

interface Profile {
  provider: Provider
  providerId: string
  email: string
  name: string
  avatar: string
}

class OAuthFailure extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

const CODE_TTL_MS = 60 * 1000
const sha = (v: string) => crypto.createHash("sha256").update(v).digest("hex")
const isDuplicateKey = (e: unknown) => (e as { code?: number })?.code === 11000
const callbackUrl = (p: Provider) => `${env.API_URL}/auth/${p}/callback`

const fail = (res: Response, error: string, mode: Mode = "login") =>
  res.redirect(`${env.CLIENT_URL}/${mode === "register" ? "register" : "login"}?error=${error}`)

const handleFailure = (res: Response, err: unknown, mode: Mode) => {
  if (err instanceof OAuthFailure) {
    /* Account nai: register page e pathai, jate user role bachte pare */
    return fail(res, err.code, err.code === "no_account" ? "register" : mode)
  }
  console.error("OAuth error:", err)
  return fail(res, "oauth_failed", mode)
}

const parseIntent = (req: Request) => ({
  mode: (req.query.mode === "register" ? "register" : "login") as Mode,
  role: (req.query.role === "teacher" ? "teacher" : "student") as "student" | "teacher",
})

/* ---------------- Google ---------------- */

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID)

export const googleStart = (req: Request, res: Response) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return fail(res, "not_configured")
  const { state, challenge } = startState(res, { provider: "google", ...parseIntent(req) }, true)
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl("google"),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge!,
    code_challenge_method: "S256",
    prompt: "select_account",
  })
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}

async function googleProfile(code: string, verifier: string): Promise<Profile> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl("google"),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  })
  const data = (await r.json()) as { id_token?: string }
  if (!r.ok || !data.id_token) throw new OAuthFailure("oauth_failed")

  /* signature, iss, aud, exp sob verify kore */
  const ticket = await googleClient.verifyIdToken({ idToken: data.id_token, audience: env.GOOGLE_CLIENT_ID })
  const p = ticket.getPayload()
  if (!p?.sub || !p.email) throw new OAuthFailure("no_email")
  if (p.email_verified !== true) throw new OAuthFailure("email_unverified")
  return {
    provider: "google",
    providerId: p.sub,
    email: p.email.toLowerCase(),
    name: p.name || p.email.split("@")[0],
    avatar: p.picture || "",
  }
}

export const googleCallback = async (req: Request, res: Response) => {
  const intent = readState(req, res, "google", String(req.query.state || ""))
  if (!intent) return fail(res, "invalid_state")
  if (req.query.error || typeof req.query.code !== "string") return fail(res, "cancelled", intent.mode)
  try {
    const profile = await googleProfile(req.query.code, intent.verifier ?? "")
    await finish(res, profile, intent)
  } catch (err) {
    handleFailure(res, err, intent.mode)
  }
}

/* ---------------- GitHub ---------------- */

export const githubStart = (req: Request, res: Response) => {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return fail(res, "not_configured")
  const { state } = startState(res, { provider: "github", ...parseIntent(req) })
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: callbackUrl("github"),
    scope: "read:user user:email",
    state,
  })
  res.redirect(`https://github.com/login/oauth/authorize?${params}`)
}

async function githubProfile(code: string): Promise<Profile> {
  const t = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl("github"),
    }),
  })
  const tok = (await t.json()) as { access_token?: string }
  if (!tok.access_token) throw new OAuthFailure("oauth_failed")

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "LearnSphere",
    Authorization: `Bearer ${tok.access_token}`,
  }
  const [u, e] = await Promise.all([
    fetch("https://api.github.com/user", { headers }),
    fetch("https://api.github.com/user/emails", { headers }),
  ])
  if (!u.ok || !e.ok) throw new OAuthFailure("oauth_failed")

  const gh = (await u.json()) as { id: number; login: string; name: string | null; avatar_url: string }
  const emails = (await e.json()) as { email: string; primary: boolean; verified: boolean }[]
  if (!emails.length) throw new OAuthFailure("no_email")
  /* Profile er email private hote pare, tai /user/emails theke primary + verified */
  const primary = emails.find((x) => x.primary && x.verified)
  if (!primary) throw new OAuthFailure("email_unverified")

  return {
    provider: "github",
    providerId: String(gh.id),
    email: primary.email.toLowerCase(),
    name: gh.name || gh.login,
    avatar: gh.avatar_url || "",
  }
}

export const githubCallback = async (req: Request, res: Response) => {
  const intent = readState(req, res, "github", String(req.query.state || ""))
  if (!intent) return fail(res, "invalid_state")
  if (req.query.error || typeof req.query.code !== "string") return fail(res, "cancelled", intent.mode)
  try {
    await finish(res, await githubProfile(req.query.code), intent)
  } catch (err) {
    handleFailure(res, err, intent.mode)
  }
}

/* ---------------- Shared: find / link / create ---------------- */

async function linkIdentity(userId: Types.ObjectId, p: Profile) {
  try {
    await AuthIdentity.create({ user: userId, provider: p.provider, providerId: p.providerId, email: p.email })
  } catch (err) {
    if (isDuplicateKey(err)) throw new OAuthFailure("already_linked")
    throw err
  }
}

async function createUser(p: Profile, role: "student" | "teacher") {
  try {
    /* Random password: existing pre("save") hook hash kore, tai User schema bodlate hoy na.
       User eta jane na, tai password diye login hobe na. */
    const user = await User.create({
      name: p.name,
      email: p.email,
      password: crypto.randomBytes(32).toString("hex"),
      role,
      avatar: p.avatar,
    })
    await linkIdentity(user._id, p)
    return user
  } catch (err) {
    if (isDuplicateKey(err)) {
      const existing = await User.findOne({ email: p.email })
      if (existing) {
        await linkIdentity(existing._id, p)
        return existing
      }
    }
    throw err
  }
}

async function resolveUser(profile: Profile, intent: OAuthIntent) {
  const { provider, providerId, email } = profile

  const identity = await AuthIdentity.findOne({ provider, providerId })
  if (identity) {
    const linked = await User.findById(identity.user)
    if (linked) return linked
    await identity.deleteOne() // user delete hoye gele stale identity
  }

  const existing = await User.findOne({ email })
  if (existing) {
    /* Email-e auto-link tokhon-i nirapod jokhon users e shudhu OTP-verified email thake */
    if (!env.REQUIRE_EMAIL_OTP) throw new OAuthFailure("account_exists")
    await linkIdentity(existing._id, profile)
    return existing
  }

  if (intent.mode !== "register") throw new OAuthFailure("no_account")
  return createUser(profile, intent.role)
}

async function finish(res: Response, profile: Profile, intent: OAuthIntent) {
  const user = await resolveUser(profile, intent)
  if (user.isBlocked) throw new OAuthFailure("blocked")

  const code = crypto.randomBytes(32).toString("base64url")
  await OAuthCode.create({
    codeHash: sha(code),
    user: user._id,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  })
  res.redirect(`${env.CLIENT_URL}/auth/callback?code=${code}`)
}

/* POST /auth/oauth/exchange  { code } -> { token, user }  (login er moto same shape) */
export const exchangeCode = asyncHandler(async (req, res) => {
  const code = String(req.body?.code || "")
  if (!code) throw new ApiError(400, "Missing code")

  /* findOneAndDelete atomic, tai code ek-bar-i kaj kore */
  const record = await OAuthCode.findOneAndDelete({ codeHash: sha(code), expiresAt: { $gt: new Date() } })
  if (!record) throw new ApiError(400, "Sign-in link expired. Please try again")

  const user = await User.findById(record.user)
  if (!user) throw new ApiError(401, "User no longer exists")
  if (user.isBlocked) throw new ApiError(403, "Your account has been blocked")
  respond(res, 200, user)
})