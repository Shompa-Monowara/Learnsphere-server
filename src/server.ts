import app from "./app"
import connectDB from "./config/db"
import { env } from "./config/env"

connectDB().then(() => {
  app.listen(env.PORT, () => console.log(`Server running on port ${env.PORT}`))
})