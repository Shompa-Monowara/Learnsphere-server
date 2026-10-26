import asyncHandler from "../utils/asyncHandler"

/* Features page er shob text content ekhane thake.
   Frontend shudhu render kore, tai copy change korte hole ekhane edit korlei hobe. */
const FEATURES_CONTENT = {
  hero: {
    badge: "Features",
    titleLead: "Everything you need to",
    titleAccent: "teach and learn",
    body: "Video lessons, auto-graded quizzes, assignment feedback, progress tracking and verifiable certificates — in one platform that reads clearly on every screen, in light and dark mode.",
    primaryCta: { label: "Get Started", to: "/register" },
    secondaryCta: { label: "View Pricing", to: "/pricing" },
    notes: ["No credit card to explore", "Set up in an afternoon"],
  },

  /* key = frontend e kon mockup dekhabe */
  sections: [
    {
      key: "video",
      eyebrow: "Video lessons",
      title: "Lessons that stream smoothly and remember where you stopped",
      body: "Upload once and LearnSphere handles transcoding, captions and adaptive streaming. Students resume on any device at the exact second they left, and instructors can replace a single lesson without re-publishing a course.",
      bullets: [
        "Adaptive streaming from 360p to 4K",
        "Auto-generated captions with an editable transcript",
        "Chapter markers and downloadable lesson notes",
      ],
    },
    {
      key: "quiz",
      eyebrow: "Auto-graded quizzes",
      title: "Instant scores, zero marking backlog",
      body: "Build multiple choice, multi-select and short answer questions once. Every submission is graded in under a second with per-answer explanations, so learners find out what they missed while the idea is still fresh.",
      bullets: [
        "Question banks with randomised order",
        "Per-answer feedback and explanations",
        "Pass thresholds that unlock the next module",
      ],
    },
    {
      key: "assignments",
      eyebrow: "Assignments",
      title: "Real feedback, in one review queue",
      body: "Students submit files, links or rich text directly in the course. Instructors get a single queue with rubrics, inline comments and reusable feedback snippets — then return a grade that rolls straight into the learner's progress.",
      bullets: [
        "Rubric scoring with weighted criteria",
        "Inline comments and reusable feedback snippets",
        "Plagiarism checks before the review queue",
      ],
    },
    {
      key: "progress",
      eyebrow: "Progress tracking",
      title: "Progress you can actually act on",
      body: "Completion, quiz scores and time on task are tracked automatically. Students see the next step, instructors see who is falling behind this week, and admins export the whole picture for reporting.",
      bullets: [
        "Weekly streaks and completion forecasts",
        "At-risk learner flags inside the teacher view",
        "CSV and API exports for team reporting",
      ],
    },
    {
      key: "certificates",
      eyebrow: "Verifiable certificates",
      title: "PDF certificates with a verification ID anyone can check",
      body: "Finish a course and LearnSphere issues a PDF certificate carrying a unique verification ID. Employers open the verification page, enter the ID and confirm the holder, the course and the completion date in seconds.",
      bullets: [
        "Unique ID on every issued certificate",
        "Public verification page — no login required",
        "Shareable to LinkedIn with one click",
      ],
    },
    {
      key: "dashboards",
      eyebrow: "Role-based dashboards",
      title: "A focused workspace for every role",
      body: "Admins manage people and courses, teachers build content and grade work, students see only their own lessons and results. Each dashboard exposes the tools that role needs, and nothing else.",
      bullets: [
        "Admin: enrollment, revenue and cohort reports",
        "Teacher: content, grading queue and analytics",
        "Student: lessons, deadlines and certificates",
      ],
    },
  ],

  bothSides: {
    badge: "Built for both sides",
    title: "One platform, two very different jobs",
    body: "Teachers need to build and grade efficiently. Students need a clear next step. Both get a purpose-built view of the same course.",
    audiences: [
      {
        id: "teachers",
        label: "For teachers",
        note: "Everything you need to run a course without a spreadsheet, a shared drive and three separate tools.",
        items: [
          "Drag-and-drop course builder with reusable modules",
          "Auto-graded quizzes and a single assignment queue",
          "Cohort analytics with at-risk learner flags",
          "Reusable rubrics and feedback snippets",
          "Co-instructors with granular permissions",
          "Payouts and enrollment reports in one place",
        ],
        stat: { value: "6 hrs", label: "Average admin time saved each week" },
      },
      {
        id: "students",
        label: "For students",
        note: "A calm, clear place to learn — pick up exactly where you left off on any device.",
        items: [
          "Resume every lesson at the exact second you stopped",
          "Instant quiz scores with explanations",
          "One calendar for every upcoming deadline",
          "Clear feedback on every assignment you submit",
          "Progress, streaks and next-step suggestions",
          "Verifiable certificates you can share",
        ],
        stat: { value: "3×", label: "More learners finish courses they start" },
      },
    ],
  },

  howItWorks: {
    badge: "How it works",
    title: "From empty workspace to first certificate",
    body: "Three steps, no implementation project and no consultant retainer.",
    steps: [
      {
        title: "Create your workspace",
        body: "Pick a role, invite your team and set branding in a few minutes. No implementation project, no consultant.",
      },
      {
        title: "Build or import a course",
        body: "Assemble video lessons, quizzes and assignments — or import an existing SCORM package and keep your content.",
      },
      {
        title: "Teach, track and certify",
        body: "Learners work through the path while you watch progress live. Finished courses issue verifiable certificates automatically.",
      },
    ],
  },

  details: {
    badge: "The details",
    title: "Small decisions that make it feel effortless",
    body: "The unglamorous work — accessibility, responsive layouts, sensible defaults — is what keeps a course running.",
    /* icon = frontend er icon map er key */
    items: [
      {
        icon: "shield",
        title: "Accessible by default",
        body: "WCAG AA contrast, keyboard navigation and visible focus states on every screen.",
      },
      {
        icon: "phone",
        title: "Responsive everywhere",
        body: "Lessons, quizzes and grading all work on a phone without a separate app.",
      },
      {
        icon: "moon",
        title: "Light and dark mode",
        body: "A preference that follows the learner across every page and device.",
      },
      {
        icon: "users",
        title: "Cohorts and teams",
        body: "Group learners into cohorts with shared deadlines, reports and certificates.",
      },
      {
        icon: "plug",
        title: "Integrations",
        body: "SSO, HRIS sync and webhooks for teams that already have a stack.",
      },
      {
        icon: "headset",
        title: "Human support",
        body: "A real person answers within one business day, for instructors and learners.",
      },
    ],
  },

  pricing: {
    badge: "Pricing",
    title: "Plans that scale from one learner to a whole team",
    body: "Start free. Upgrade when a certificate matters or when your team needs reporting.",
    plans: [
      {
        name: "Learner",
        tagline: "For individuals exploring a new field.",
        price: "$0",
        note: "/forever",
        features: ["Access free courses", "Progress tracking", "Community Q&A"],
        cta: "Choose Learner",
        to: "/register",
        popular: false,
      },
      {
        name: "Pro",
        tagline: "For serious learners collecting credentials.",
        price: "$29",
        note: "/per month",
        features: ["All 1,250 courses", "Verifiable certificates", "Assignment feedback", "Offline lesson downloads"],
        cta: "Start with Pro",
        to: "/register",
        popular: true,
      },
      {
        name: "Teams",
        tagline: "For training teams of 10 or more.",
        price: "$18",
        note: "/per seat / month",
        features: ["Private cohorts", "Admin and manager dashboards", "SSO and HRIS sync", "Progress exports"],
        cta: "Choose Teams",
        to: "/contact",
        popular: false,
      },
    ],
  },

  faq: {
    badge: "FAQ",
    title: "Questions, answered",
    body: "Still unsure about something? Send us a note — a real person replies within one business day.",
    cta: { label: "Ask us directly", to: "/contact" },
    items: [
      {
        q: "Can I switch between light and dark mode?",
        a: "Yes. Use the toggle in the navbar. Your choice is remembered on that device and applied to every page, including the dashboards.",
      },
      {
        q: "Do quizzes really grade themselves?",
        a: "Yes. Add questions with the correct answers and marks, and every submission is scored instantly with a per-answer breakdown and explanations.",
      },
      {
        q: "How do verifiable certificates work?",
        a: "When a learner completes a course they earn a PDF certificate with a unique verification ID. Anyone with that ID can confirm the holder, the course and the completion date.",
      },
      {
        q: "What can admins, teachers and students each see?",
        a: "Admins manage people, courses and reports. Teachers manage their own courses and grading. Students see only their own lessons, deadlines and results.",
      },
      {
        q: "Can we run internal training for our team?",
        a: "Yes. Team plans include private cohorts, manager dashboards and progress exports. Tell us your team size and we will help you set it up.",
      },
    ],
  },

  cta: {
    title: "Ready to teach or learn with confidence?",
    body: "Set up your first course, quiz and certificate in an afternoon. Invite your team when you are ready.",
    primary: { label: "Get Started", to: "/register" },
    secondary: { label: "Browse instructors", to: "/instructors" },
  },
}

/* Public: login chhara-o shobai dekhte pabe */
export const getFeatures = asyncHandler(async (_req, res) => {
  res.set("Cache-Control", "public, max-age=300")
  res.json(FEATURES_CONTENT)
})