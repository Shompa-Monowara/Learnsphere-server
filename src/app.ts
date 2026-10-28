import cors from "cors"
import express from "express"
import helmet from "helmet"
import morgan from "morgan"
import { env } from "./config/env"
import { errorHandler, notFound } from "./middlewares/error"
import mentorRoutes from "./routes/mentor.routes"
import routes from "./routes"

const app = express()

app.use(helmet())
app.use(cors({ origin: env.CLIENT_URL, credentials: true }))
app.use(express.json({ limit: "2mb" }))
if (env.NODE_ENV !== "production") app.use(morgan("dev"))

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" })
})
app.use("/api/admin/mentors", mentorRoutes)
app.use("/api", routes)

app.use(notFound)
app.use(errorHandler)

export default app