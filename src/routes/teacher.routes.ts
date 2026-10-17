import { Router } from "express"
import { authorize, protect } from "../middlewares/auth"
import * as manage from "../controllers/teacherManage.controller"
import * as portal from "../controllers/teacherPortal.controller"
import teacherAssignments from "./teacherAssignments.routes"

const router = Router()

router.use(protect, authorize("teacher", "admin"))

router.get("/reviews", portal.getReviewsPage)
router.get("/earnings", portal.getEarningsPage)
router.post("/payouts", portal.requestPayout)

router.get("/courses", manage.getCoursesPage)
router.get("/students", manage.getStudentsPage)

router.use(teacherAssignments)

export default router