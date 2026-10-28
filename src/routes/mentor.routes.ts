import { Router } from "express"
import { authorize, protect } from "../middlewares/auth"
import * as mentor from "../controllers/mentor.controller"

const router = Router()

/* Shob route shudhu admin er jonno */
router.use(protect, authorize("admin"))

router.get("/", mentor.listMentors)
router.post("/", mentor.createMentor)
router.put("/:id", mentor.updateMentor)
router.patch("/:id/publish", mentor.setPublished)
router.delete("/:id", mentor.deleteMentor)

export default router