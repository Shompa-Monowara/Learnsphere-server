import Plan from "../models/Plan"
import asyncHandler from "../utils/asyncHandler"

export const YEARLY_DISCOUNT_PERCENT = 20

/* Comparison table er row gulo (key = Plan.values er key) */
const COMPARISON = [
  {
    title: "Courses & content",
    rows: [
      { key: "courses", label: "Published courses" },
      { key: "video", label: "Video & PDF lessons" },
      { key: "downloads", label: "Downloadable resources" },
      { key: "quizzes", label: "Auto-graded quizzes" },
      { key: "drip", label: "Drip & scheduled release" },
    ],
  },
  {
    title: "Students & people",
    rows: [
      { key: "students", label: "Enrolled students" },
      { key: "teachers", label: "Teacher accounts" },
      { key: "cohorts", label: "Cohorts & bulk enrollment" },
      { key: "roles", label: "Admin, teacher & student roles" },
    ],
  },
  {
    title: "Grading & certificates",
    rows: [
      { key: "grading", label: "Assignment grading queue" },
      { key: "certificates", label: "Completion certificates" },
      { key: "analytics", label: "Progress analytics" },
      { key: "whitelabel", label: "White-label academy portal" },
    ],
  },
  {
    title: "Support & billing",
    rows: [
      { key: "support", label: "Support" },
      { key: "storage", label: "Video storage" },
      { key: "seats", label: "Team member seats" },
    ],
  },
]

const DEFAULT_PLANS = [
  {
    slug: "free",
    name: "Free",
    tagline: "For teachers just getting started.",
    monthlyPrice: 0,
    priceNote: "forever",
    cta: "Start for free",
    ctaTo: "/register",
    popular: false,
    order: 1,
    features: [
      "Up to 2 published courses",
      "50 enrolled students",
      "Video & PDF lessons",
      "Auto-graded quizzes",
      "Basic progress tracking",
      "Community support",
    ],
    values: {
      courses: "Up to 2",
      video: true,
      downloads: true,
      quizzes: true,
      drip: false,
      students: "50",
      teachers: "1",
      cohorts: false,
      roles: false,
      grading: false,
      certificates: "Basic",
      analytics: "Basic",
      whitelabel: false,
      support: "Community",
      storage: "2 GB",
      seats: "1",
    },
  },
  {
    slug: "pro",
    name: "Pro",
    tagline: "For solo instructors scaling up.",
    monthlyPrice: 19,
    priceNote: "/ month",
    cta: "Get started",
    ctaTo: "/register",
    popular: true,
    order: 2,
    features: [
      "Unlimited courses",
      "Up to 1,000 students",
      "Assignments & grading queue",
      "Custom PDF certificates",
      "Detailed analytics",
      "Priority email support",
    ],
    values: {
      courses: "Unlimited",
      video: true,
      downloads: true,
      quizzes: true,
      drip: true,
      students: "1,000",
      teachers: "1",
      cohorts: false,
      roles: false,
      grading: true,
      certificates: "Custom",
      analytics: "Detailed",
      whitelabel: false,
      support: "Priority email",
      storage: "50 GB",
      seats: "3",
    },
  },
  {
    slug: "academy",
    name: "Academy",
    tagline: "For schools and small academies.",
    monthlyPrice: 79,
    priceNote: "/ month",
    cta: "Talk to sales",
    ctaTo: "/contact",
    popular: false,
    order: 3,
    features: [
      "Everything in Pro",
      "Unlimited students & teachers",
      "Admin, teacher & student roles",
      "Cohorts & bulk enrollment",
      "Branded academy portal",
      "Dedicated success manager",
    ],
    values: {
      courses: "Unlimited",
      video: true,
      downloads: true,
      quizzes: true,
      drip: true,
      students: "Unlimited",
      teachers: "Unlimited",
      cohorts: true,
      roles: true,
      grading: true,
      certificates: "Fully branded",
      analytics: "Advanced",
      whitelabel: true,
      support: "Dedicated manager",
      storage: "Unlimited",
      seats: "Unlimited",
    },
  },
]

/* Public: login chhara-o shobai dekhte pabe */
export const getPricing = asyncHandler(async (_req, res) => {
  /* Prothom bar collection faka thakle default plan gulo bosiye dei */
  if ((await Plan.estimatedDocumentCount()) === 0) {
    await Plan.bulkWrite(
      DEFAULT_PLANS.map((p) => ({
        updateOne: { filter: { slug: p.slug }, update: { $setOnInsert: p }, upsert: true },
      }))
    )
  }

  const plans = await Plan.find().sort({ order: 1 }).select("-_id -__v -createdAt -updatedAt").lean()

  res.json({
    plans,
    comparison: COMPARISON,
    yearlyDiscountPercent: YEARLY_DISCOUNT_PERCENT,
  })
})