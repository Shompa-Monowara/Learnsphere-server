import { Router } from "express";
import {
  createAssignment,
  deleteAssignment,
  gradeSubmission,
  listAssignments,
  listSubmissions,
  updateAssignment,
} from "../controllers/teacherAssignments.controller";

const router = Router();

router.get("/assignments", listAssignments);
router.post("/assignments", createAssignment);
router.put("/assignments/:id", updateAssignment);
router.delete("/assignments/:id", deleteAssignment);
router.get("/submissions", listSubmissions);
router.patch("/submissions/:id/grade", gradeSubmission);

export default router;