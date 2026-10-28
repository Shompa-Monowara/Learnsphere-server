import { randomBytes } from "node:crypto"
import mongoose from "mongoose"
import connectDB from "./config/db"
import Category from "./models/Category"
import Course from "./models/Course"
import User from "./models/User"
import { slugify } from "./utils/helpers"

/* Demo mentor seed: Instructors page-e professional photo shoho instructor dekhanor jonno.
   Chalao:   npm run seed:instructors
   Muchhe felo: npm run seed:instructors -- --remove
   Ei account gulo-te login kora jay na (password random). Real instructor ra nijer dashboard theke photo upload korbe. */

const EMAIL_DOMAIN = "mentors.learnsphere.demo"
const SAMPLE_VIDEO = "https://res.cloudinary.com/demo/video/upload/dog.mp4"
const SAMPLE_THUMB = "https://res.cloudinary.com/demo/image/upload/sample.jpg"

const photo = (id: string) =>
  `https://images.unsplash.com/${id}?w=600&h=700&fit=crop&crop=faces&q=80`

const CATEGORIES = ["Web Development", "Graphic Design", "Digital Marketing"]

interface Mentor {
  name: string
  avatar: string
  headline: string
  bio: string
  category: string
  course: {
    title: string
    short: string
    description: string
    level: "beginner" | "intermediate" | "advanced"
    requirements: string[]
    outcomes: string[]
  }
}

/* Naam ar photo mile kina chokhe dekhe nio. Na mille ekhane bodle nio */
const MENTORS: Mentor[] = [
  {
    name: "Daniel Hart",
    avatar: photo("photo-1560250097-0b93528c311a"),
    headline: "Senior Full-Stack Developer",
    bio: "Teaches modern web development with small, practical projects that you can put in a portfolio.",
    category: "Web Development",
    course: {
      title: "Full-Stack Web Development with Node and React",
      short: "Build and deploy a complete web app from database to user interface.",
      description:
        "A hands-on course that walks through building a full-stack application: REST APIs with Node and Express, a MongoDB database, and a React front end, finishing with deployment.",
      level: "intermediate",
      requirements: ["Basic HTML, CSS and JavaScript", "A computer with internet access"],
      outcomes: ["Build a REST API with Node and Express", "Create a React front end", "Deploy a full-stack app"],
    },
  },
  {
    name: "Priya Nair",
    avatar: photo("photo-1573496359142-b8d87734a5a2"),
    headline: "Frontend Engineer & React Mentor",
    bio: "Helps beginners get comfortable with JavaScript and React through clear, step-by-step lessons.",
    category: "Web Development",
    course: {
      title: "React for Beginners: Build Real Interfaces",
      short: "Learn React from the ground up by building interfaces step by step.",
      description:
        "Start with components and props, then move on to state, effects and routing while building a small project along the way.",
      level: "beginner",
      requirements: ["Basic JavaScript knowledge"],
      outcomes: ["Build reusable React components", "Manage state and side effects", "Add client-side routing"],
    },
  },
  {
    name: "Sofia Marino",
    avatar: photo("photo-1494790108377-be9c29b29330"),
    headline: "Brand & Graphic Designer",
    bio: "Teaches the fundamentals of layout, colour and typography with real branding projects.",
    category: "Graphic Design",
    course: {
      title: "Graphic Design Fundamentals",
      short: "Learn layout, colour and typography and apply them in real projects.",
      description:
        "A practical introduction to graphic design covering composition, colour theory, typography and a complete brand identity project.",
      level: "beginner",
      requirements: ["No prior design experience", "Any design tool (Figma, Illustrator or Photoshop)"],
      outcomes: ["Apply colour and typography rules", "Design clean layouts", "Create a simple brand identity"],
    },
  },
  {
    name: "Marcus Lee",
    avatar: photo("photo-1500648767791-00dcc994a43e"),
    headline: "Art Director, Visual Identity",
    bio: "Focuses on visual identity and logo systems, from first sketch to final presentation.",
    category: "Graphic Design",
    course: {
      title: "Logo & Visual Identity Design",
      short: "Design logos and identity systems from sketch to client presentation.",
      description:
        "Learn how to research a brand, sketch concepts, refine a logo and present a complete identity system to a client.",
      level: "intermediate",
      requirements: ["Basic knowledge of a vector design tool"],
      outcomes: ["Develop logo concepts", "Build a consistent identity system", "Present work to clients"],
    },
  },
  {
    name: "Emily Carter",
    avatar: photo("photo-1438761681033-6461ffad8d80"),
    headline: "Digital Marketing Strategist",
    bio: "Teaches how to plan campaigns, grow an audience and measure what actually works.",
    category: "Digital Marketing",
    course: {
      title: "Digital Marketing Essentials",
      short: "Plan, run and measure campaigns across social, email and search.",
      description:
        "An overview of the digital marketing channels with hands-on exercises in audience research, content planning, campaigns and analytics.",
      level: "beginner",
      requirements: ["No prior marketing experience"],
      outcomes: ["Plan a multi-channel campaign", "Write effective content", "Read basic analytics reports"],
    },
  },
  {
    name: "Omar Khalid",
    avatar: photo("photo-1472099645785-5658abf4ff4e"),
    headline: "SEO & Performance Marketing Lead",
    bio: "Specialises in search and paid campaigns, with a focus on measurable results.",
    category: "Digital Marketing",
    course: {
      title: "SEO & Paid Advertising Masterclass",
      short: "Get found on search and run paid campaigns that you can measure.",
      description:
        "Covers keyword research, on-page SEO and link building, then moves to setting up and optimising paid search and social ad campaigns.",
      level: "intermediate",
      requirements: ["Basic understanding of websites"],
      outcomes: ["Do keyword research", "Optimise pages for search", "Set up and measure paid campaigns"],
    },
  },
]

async function seed() {
  for (const name of CATEGORIES) {
    await Category.updateOne({ slug: slugify(name) }, { name, slug: slugify(name) }, { upsert: true })
  }

  for (const m of MENTORS) {
    const email = `${slugify(m.name)}@${EMAIL_DOMAIN}`

    let user = await User.findOne({ email })
    if (!user) {
      user = await User.create({
        name: m.name,
        email,
        password: randomBytes(16).toString("hex"),
        role: "teacher",
        avatar: m.avatar,
        headline: m.headline,
        bio: m.bio,
      })
      console.log(`Mentor created: ${m.name}`)
    } else {
      await User.updateOne({ _id: user._id }, { avatar: m.avatar, headline: m.headline, bio: m.bio })
      console.log(`Mentor updated: ${m.name}`)
    }

    const category = await Category.findOne({ slug: slugify(m.category) })
    const exists = await Course.findOne({ title: m.course.title, instructor: user._id })
    if (exists) continue

    await Course.create({
      title: m.course.title,
      shortDescription: m.course.short,
      description: m.course.description,
      category: category?._id,
      instructor: user._id,
      level: m.course.level,
      language: "English",
      price: 0,
      thumbnail: SAMPLE_THUMB,
      previewVideo: SAMPLE_VIDEO,
      requirements: m.course.requirements,
      outcomes: m.course.outcomes,
      status: "published",
      sections: [
        {
          title: "Getting started",
          lessons: [{ title: "Welcome to the course", type: "video", url: SAMPLE_VIDEO, duration: 5, isPreview: true }],
        },
      ],
    })
    console.log(`Course created: ${m.course.title}`)
  }
}

async function remove() {
  const users = await User.find({ email: new RegExp(`@${EMAIL_DOMAIN.replace(/\./g, "\\.")}$`) }).select("_id")
  const ids = users.map((u) => u._id)
  const courses = await Course.deleteMany({ instructor: { $in: ids } })
  const removed = await User.deleteMany({ _id: { $in: ids } })
  console.log(`Removed ${removed.deletedCount} mentor(s) and ${courses.deletedCount} course(s)`)
}

async function run() {
  await connectDB()
  try {
    if (process.argv.includes("--remove")) await remove()
    else await seed()
    console.log("Done")
  } finally {
    await mongoose.disconnect()
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})