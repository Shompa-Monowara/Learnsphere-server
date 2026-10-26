import crypto from "crypto"
import Stripe from "stripe"
import { env } from "../config/env"
import Course from "../models/Course"
import Enrollment from "../models/Enrollment"
import Transaction from "../models/Transaction"
import User from "../models/User"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"
import { notify } from "../utils/helpers"

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null

const requireStripe = () => {
  if (!stripe) throw new ApiError(503, "Payments are not configured yet")
  return stripe
}

const isDuplicateKey = (e: unknown) => (e as { code?: number })?.code === 11000

/* POST /payments/checkout/:courseId  ->  { url }  (Stripe hosted checkout page) */
export const createCheckoutSession = asyncHandler(async (req, res) => {
  const user = req.user!
  const course = await Course.findById(req.params.courseId)
  if (!course || course.status !== "published") throw new ApiError(404, "Course not found")
  if (String(course.instructor) === String(user._id)) throw new ApiError(400, "You cannot enroll in your own course")
  if (await Enrollment.exists({ student: user._id, course: course._id })) {
    throw new ApiError(409, "Already enrolled in this course")
  }

  const amount = course.discountPrice ?? course.price
  if (!(amount > 0)) throw new ApiError(400, "This course is free. Use the normal enroll option.")

  const session = await requireStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: course.title,
            ...(course.thumbnail && /^https?:\/\//.test(course.thumbnail) ? { images: [course.thumbnail] } : {}),
          },
        },
      },
    ],
    metadata: { courseId: String(course._id), userId: String(user._id) },
    success_url: `${env.CLIENT_URL}/student/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.CLIENT_URL}/courses/${course._id}?payment=cancelled`,
  })

  res.json({ url: session.url })
})

/* POST /payments/confirm  (body: { sessionId })
   Success page theke call hoy. Stripe ke jiggesh kore payment verify kore, tarpor enroll kore.
   Idempotent: ekta session e jotobar call hok, ekbar-i enrollment/transaction hobe */
export const confirmPayment = asyncHandler(async (req, res) => {
  const user = req.user!
  const sessionId = String(req.body.sessionId || "")
  if (!sessionId.startsWith("cs_")) throw new ApiError(400, "Invalid payment session")

  const session = await requireStripe().checkout.sessions.retrieve(sessionId)
  if (session.metadata?.userId !== String(user._id)) throw new ApiError(403, "This payment does not belong to you")
  if (session.payment_status !== "paid") throw new ApiError(402, "Payment has not been completed")

  const course = await Course.findById(session.metadata.courseId)
  if (!course) throw new ApiError(404, "Course not found")

  try {
    await Transaction.create({
      transactionId: `TXN-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
      user: user._id,
      instructor: course.instructor,
      course: course._id,
      amount: (session.amount_total ?? 0) / 100,
      method: "stripe",
      status: "paid",
      stripeSessionId: session.id,
    })
  } catch (err) {
    if (!isDuplicateKey(err)) throw err // already recorded
  }

  try {
    await Enrollment.create({ student: user._id, course: course._id })
    await Course.findByIdAndUpdate(course._id, { $inc: { studentsCount: 1 } })
    await notify(course.instructor, "New enrollment", `${user.name} enrolled in "${course.title}".`, "/teacher/students")
  } catch (err) {
    if (!isDuplicateKey(err)) throw err // already enrolled
  }

  /* Wishlist e thakle ber kore dei */
  await User.updateOne({ _id: user._id }, { $pull: { wishlist: course._id } })

  res.json({ enrolled: true, courseId: String(course._id), courseTitle: course.title })
})