import asyncHandler from "../utils/asyncHandler"

/* About page er shob text content ekhane thake.
   Frontend shudhu render kore, tai copy change korte hole ekhane edit korlei hobe. */
const ABOUT_CONTENT = {
  hero: {
    badge: "About LearnSphere",
    titleLead: "Learning software that",
    titleAccent: "stays out of the way",
    body: "We build one clean, accessible platform where expert instructors teach, students make visible progress, and every finished course ends with a certificate someone can actually verify.",
    primaryCta: { label: "Explore courses", to: "/courses" },
    secondaryCta: { label: "Meet our team", to: "/instructors" },
    meta: [
      { icon: "pin", label: "San Francisco, CA" },
      { icon: "calendar", label: "Founded 2019" },
      { icon: "users", label: "42 people, 9 time zones" },
    ],
    image: {
      src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&auto=format&fit=crop&q=80",
      alt: "The LearnSphere team working together around a laptop",
    },
    floatingBadge: "Verifiable certificates",
    rating: { value: "4.9 / 5", label: "Average course rating" },
  },

  mission: {
    title: "Our mission",
    body: "Make high-quality teaching easy to run and easy to finish. That means fast video, honest progress, feedback worth reading and a credential that holds up outside the platform.",
  },
  vision: {
    title: "Our vision",
    body: "A world where switching careers does not depend on which school you could afford. Calm software, expert practitioners and proof of what you learned — available to anyone with a connection.",
  },

  story: {
    badge: "Our story",
    title: "Seven years of removing friction",
    body: "We started with a frustrated training team and kept building for the people doing the teaching. Here is how that went.",
    quote: {
      text: "We never wanted to be the platform people log into once a quarter. We wanted the one they open on a Tuesday because the next lesson is clear and it takes twenty minutes.",
      author: "Elena Fischer",
      role: "Head of Learning",
    },
    timeline: [
      {
        year: "2019",
        title: "One classroom, one spreadsheet",
        body: "LearnSphere starts as an internal tool for a 40-person training team that was tired of chasing completion data across three systems.",
      },
      {
        year: "2020",
        title: "The first public course",
        body: "A frontend architecture course opens to outside learners. Auto-graded quizzes cut the instructor's weekly marking time by six hours.",
      },
      {
        year: "2021",
        title: "An instructor marketplace",
        body: "Vetted practitioners join across six in-demand fields, and learners can compare ratings, student counts and teaching style before enrolling.",
      },
      {
        year: "2022",
        title: "Certificates people can verify",
        body: "Verifiable PDF certificates launch with a unique verification ID, so employers can confirm a credential in seconds without an account.",
      },
      {
        year: "2024",
        title: "Role-based dashboards",
        body: "Admin, teacher and student workspaces ship separately. Each role sees only the tools it needs, and training teams start running private cohorts.",
      },
      {
        year: "2026",
        title: "48,200 learners and counting",
        body: "The platform passes 1,250 published courses with a 4.9 average rating, and every screen is rebuilt for accessible contrast in light and dark mode.",
      },
    ],
  },
}

/* Public: login chhara-o shobai dekhte pabe */
export const getAbout = asyncHandler(async (_req, res) => {
  res.set("Cache-Control", "public, max-age=300")
  res.json(ABOUT_CONTENT)
})