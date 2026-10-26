import Stripe from "stripe"
import { env } from "../config/env"
import Plan from "../models/Plan"
import Subscription from "../models/Subscription"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"
import { notify } from "../utils/helpers"
import { YEARLY_DISCOUNT_PERCENT } from "./pricing.controller"

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null

const requireStripe = () => {
  if (!stripe) throw new ApiError(503, "Payments are not configured yet")
  return stripe
}

/* Prothom bar je plan nibe tar jonno free trial (din). Lagbe na hole { } faka rakho */
const TRIAL_DAYS: Record<string, number> = { pro: 14 }

const LIVE_STATUSES = ["trialing", "active", "past_due"]

type SubDoc = InstanceType<typeof Subscription>

const isLive = (s: { status: string; currentPeriodEnd?: Date | null }) =>
  LIVE_STATUSES.includes(s.status) && (!s.currentPeriodEnd || s.currentPeriodEnd > new Date())

/* Stripe er notun version e period end subscription item e thake */
const periodEnd = (sub: Stripe.Subscription) => {
  const ts = sub.items.data[0]?.current_period_end
  return ts ? new Date(ts * 1000) : undefined
}

const applyStripe = (record: SubDoc, sub: Stripe.Subscription) => {
  record.status = sub.status
  record.cancelAtPeriodEnd = sub.cancel_at_period_end
  record.currentPeriodEnd = periodEnd(sub)
}

const toDto = (record: SubDoc | null) => {
  if (!record) return { plan: "free", subscription: null }
  const live = isLive(record)
  return {
    plan: live ? record.plan : "free",
    subscription: {
      plan: record.plan,
      interval: record.interval,
      status: record.status,
      amount: record.amount,
      currentPeriodEnd: record.currentPeriodEnd,
      cancelAtPeriodEnd: record.cancelAtPeriodEnd,
      active: live,
    },
  }
}

/* POST /subscriptions/checkout  (body: { plan, interval })  ->  { url } */
export const createCheckoutSession = asyncHandler(async (req, res) => {
  const user = req.user!
  const slug = String(req.body.plan || "")
  const interval = req.body.interval === "year" ? "year" : "month"

  /* Dam shobshomoy DB-r Plan theke, client er pathano dam trust kori na */
  const plan = await Plan.findOne({ slug }).lean()
  if (!plan) throw new ApiError(404, "Plan not found")
  if (!(plan.monthlyPrice > 0)) throw new ApiError(400, "The Free plan does not need a payment")

  const existing = await Subscription.findOne({ user: user._id })
  if (existing && isLive(existing)) {
    throw new ApiError(409, "You already have an active subscription. Cancel it before choosing another plan.")
  }

  /* Pricing page e jeta dekhay (per-month rounded) tar x12 = yearly charge */
  const amount =
    interval === "year"
      ? Math.round(plan.monthlyPrice * (1 - YEARLY_DISCOUNT_PERCENT / 100)) * 12
      : plan.monthlyPrice

  /* Ager subscription thakle (cancel howa) abar trial dei na */
  const trialDays = existing ? 0 : TRIAL_DAYS[plan.slug] ?? 0

  const session = await requireStripe().checkout.sessions.create({
    mode: "subscription",
    ...(existing?.stripeCustomerId ? { customer: existing.stripeCustomerId } : { customer_email: user.email }),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(amount * 100),
          recurring: { interval },
          product_data: {
            name: `LearnSphere ${plan.name}`,
            description: plan.tagline || undefined,
          },
        },
      },
    ],
    subscription_data: {
      metadata: { userId: String(user._id), plan: plan.slug },
      ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
    },
    metadata: { userId: String(user._id), plan: plan.slug, interval, amount: String(amount) },
    success_url: `${env.CLIENT_URL}/teacher/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.CLIENT_URL}/pricing?payment=cancelled`,
  })

  res.json({ url: session.url })
})

/* POST /subscriptions/confirm  (body: { sessionId })
   Success page theke call hoy. Stripe ke jiggesh kore verify kore subscription save kore.
   Idempotent: ekta session e jotobar call hok, ekta-i record thake */
export const confirmSubscription = asyncHandler(async (req, res) => {
  const user = req.user!
  const sessionId = String(req.body.sessionId || "")
  if (!sessionId.startsWith("cs_")) throw new ApiError(400, "Invalid payment session")

  const session = await requireStripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription"] })
  if (session.metadata?.userId !== String(user._id)) throw new ApiError(403, "This payment does not belong to you")
  if (session.mode !== "subscription" || session.status !== "complete" || session.payment_status === "unpaid") {
    throw new ApiError(402, "Payment has not been completed")
  }

  const sub = session.subscription
  if (!sub || typeof sub === "string") throw new ApiError(502, "Subscription was not found on Stripe")

  const planSlug = session.metadata.plan
  const plan = await Plan.findOne({ slug: planSlug }).lean()
  if (!plan) throw new ApiError(404, "Plan not found")

  const alreadySaved = await Subscription.exists({ stripeSubscriptionId: sub.id })

  const record = await Subscription.findOneAndUpdate(
    { user: user._id },
    {
      user: user._id,
      plan: plan.slug,
      interval: session.metadata.interval === "year" ? "year" : "month",
      status: sub.status,
      amount: Number(session.metadata.amount) || plan.monthlyPrice,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? "",
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: periodEnd(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  if (!alreadySaved) {
    await notify(user._id, "Subscription active", `You are now on the ${plan.name} plan.`, "/pricing")
  }

  res.json({ ...toDto(record), planName: plan.name })
})

/* GET /subscriptions/me  ->  { plan, subscription }
   Stripe theke fresh status ene nei, tai cancel / expire hole eikhane dhora pore */
export const getMySubscription = asyncHandler(async (req, res) => {
  const record = await Subscription.findOne({ user: req.user!._id })
  if (!record) return res.json(toDto(null))

  if (stripe && record.stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(record.stripeSubscriptionId)
      applyStripe(record, sub)
      await record.save()
    } catch {
      /* Stripe e na pele last saved status-i dekhai */
    }
  }

  res.json(toDto(record))
})

/* POST /subscriptions/cancel  ->  billing period shesh hole bondho hobe, tar age porjonto plan cholbe */
export const cancelSubscription = asyncHandler(async (req, res) => {
  const record = await Subscription.findOne({ user: req.user!._id })
  if (!record || !record.stripeSubscriptionId || !isLive(record)) {
    throw new ApiError(404, "You have no active subscription")
  }

  const sub = await requireStripe().subscriptions.update(record.stripeSubscriptionId, {
    cancel_at_period_end: true,
  })
  applyStripe(record, sub)
  await record.save()

  res.json(toDto(record))
})