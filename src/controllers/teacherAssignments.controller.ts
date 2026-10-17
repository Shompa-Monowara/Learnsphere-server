import { NextFunction, Request, RequestHandler, Response } from "express";
import mongoose, { Model } from "mongoose";
import CourseModel from "../models/Course";
import AssignmentModel from "../models/Assignment";
import SubmissionModel from "../models/Submission";
import EnrollmentModel from "../models/Enrollment";

type Raw = Record<string, unknown>;
type Handler = (req: Request, res: Response) => Promise<void>;

/* Loose handles: field name er type-mismatch ei file e ar error dibe na */
const Course = CourseModel as unknown as Model<Raw>;
const Assignment = AssignmentModel as unknown as Model<Raw>;
const Submission = SubmissionModel as unknown as Model<Raw>;
const Enrollment = EnrollmentModel as unknown as Model<Raw>;

const wrap =
  (fn: Handler): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

interface AuthUser {
  _id?: unknown;
  id?: unknown;
  role?: string;
}

const fail = (res: Response, code: number, message: string) => {
  res.status(code).json({ success: false, message });
};

const who = (req: Request, res: Response): { id: string; admin: boolean } | null => {
  const u = (req as unknown as { user?: AuthUser }).user;
  const id = u?._id ?? u?.id;
  if (!id) {
    fail(res, 401, "Not authenticated");
    return null;
  }
  if (u?.role !== "teacher" && u?.role !== "admin") {
    fail(res, 403, "Teachers only");
    return null;
  }
  return { id: String(id), admin: u.role === "admin" };
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown, d = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : d;
const iso = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : typeof v === "string" && v ? v : null;
const idOf = (v: unknown): string => {
  if (v && typeof v === "object" && "_id" in (v as object)) {
    return String((v as { _id: unknown })._id);
  }
  return v == null ? "" : String(v);
};

const myCourses = async (id: string, admin: boolean): Promise<Raw[]> => {
  const filter = admin ? {} : { $or: [{ instructor: id }, { teacher: id }] };
  return (await Course.find(filter).select("title instructor teacher").lean()) as unknown as Raw[];
};

const ownsCourse = async (courseId: string, id: string, admin: boolean): Promise<boolean> => {
  if (!mongoose.isValidObjectId(courseId)) return false;
  const c = (await Course.findById(courseId).select("instructor teacher").lean()) as unknown as Raw | null;
  if (!c) return false;
  if (admin) return true;
  return idOf(c.instructor) === id || idOf(c.teacher) === id;
};

const fileOf = (s: Raw): { url: string; name: string } => {
  const f = (s.file ?? s.attachment) as Raw | undefined;
  const url = str(s.fileUrl) || str(s.url) || str(f?.url);
  const name =
    str(s.fileName) ||
    str(f?.name) ||
    (url ? decodeURIComponent(url.split("/").pop() ?? "") : "");
  return { url, name };
};

/* Graded kina: status thakle status dekhe, na thakle score dekhe */
const isGraded = (s: Raw): boolean => {
  const status = str(s.status).toLowerCase();
  if (status) return status === "graded" || status === "reviewed";
  return typeof s.score === "number";
};

/* Create + update er shared validation */
type Parsed =
  | {
      ok: true;
      title: string;
      instructions: string;
      deadline: Date;
      totalMarks: number;
      attachments: string[];
    }
  | { ok: false; message: string };

const parseAssignment = (b: Raw): Parsed => {
  const title = str(b.title).trim();
  const rawDeadline = str(b.deadline);
  const totalMarks = num(b.totalMarks, 100);

  if (title.length < 3) return { ok: false, message: "Title must be at least 3 characters" };

  /* "YYYY-MM-DD" hole oi diner shesh somoy (11:59 PM) dhora hoy */
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(rawDeadline)
    ? new Date(`${rawDeadline}T23:59:59`)
    : new Date(rawDeadline);
  if (!rawDeadline || Number.isNaN(deadline.getTime()))
    return { ok: false, message: "A valid deadline is required" };

  if (totalMarks < 1 || totalMarks > 1000)
    return { ok: false, message: "Total marks must be 1–1000" };

  /* Assignment schema te attachments = [String], tai shudhu URL */
  const attachments = (Array.isArray(b.attachments) ? b.attachments : [])
    .map((x) => str((x as Raw).url))
    .filter(Boolean);

  return {
    ok: true,
    title,
    instructions: str(b.instructions).trim(),
    deadline,
    totalMarks,
    attachments,
  };
};

/* GET /teacher/assignments */
export const listAssignments = wrap(async (req, res) => {
  const me = who(req, res);
  if (!me) return;

  const courses = await myCourses(me.id, me.admin);
  const courseIds = courses.map((c) => c._id);
  const titleOf = new Map(courses.map((c) => [idOf(c._id), str(c.title)]));

  const assignments = (await Assignment.find({ course: { $in: courseIds } })
    .sort({ createdAt: -1 })
    .lean()) as unknown as Raw[];

  const aIds = assignments.map((a) => a._id);
  const subStats = (await Submission.aggregate([
    { $match: { assignment: { $in: aIds } } },
    {
      $group: {
        _id: "$assignment",
        total: { $sum: 1 },
        graded: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $in: ["$status", ["graded", "reviewed"]] },
                  {
                    $and: [
                      { $eq: [{ $type: "$status" }, "missing"] },
                      { $eq: [{ $type: "$score" }, "number"] },
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ])) as { _id: unknown; total: number; graded: number }[];
  const stat = new Map(subStats.map((s) => [idOf(s._id), s]));

  const enr = (await Enrollment.aggregate([
    { $match: { course: { $in: courseIds } } },
    { $group: { _id: "$course", n: { $sum: 1 } } },
  ])) as { _id: unknown; n: number }[];
  const enrolled = new Map(enr.map((e) => [idOf(e._id), e.n]));

  const now = Date.now();
  res.json({
    success: true,
    courses: courses.map((c) => ({ id: idOf(c._id), title: str(c.title) })),
    assignments: assignments.map((a) => {
      const deadline = iso(a.deadline ?? a.dueDate);
      const cid = idOf(a.course);
      const s = stat.get(idOf(a._id));
      return {
        id: idOf(a._id),
        title: str(a.title),
        instructions: str(a.instructions),
        attachments: (Array.isArray(a.attachments) ? a.attachments : []).map(str).filter(Boolean),
        courseId: cid,
        courseTitle: titleOf.get(cid) ?? "",
        deadline,
        totalMarks: num(a.totalMarks, 100),
        total: s?.total ?? 0,
        graded: s?.graded ?? 0,
        enrolled: enrolled.get(cid) ?? 0,
        closed: deadline ? new Date(deadline).getTime() < now : false,
      };
    }),
  });
});

/* GET /teacher/submissions */
export const listSubmissions = wrap(async (req, res) => {
  const me = who(req, res);
  if (!me) return;

  const courses = await myCourses(me.id, me.admin);
  const assignments = (await Assignment.find({ course: { $in: courses.map((c) => c._id) } })
    .select("title totalMarks course")
    .lean()) as unknown as Raw[];
  const aMap = new Map(assignments.map((a) => [idOf(a._id), a]));

  const subs = (await Submission.find({ assignment: { $in: assignments.map((a) => a._id) } })
    .populate("student", "name email")
    .sort({ createdAt: -1 })
    .lean()) as unknown as Raw[];

  /* Student er course progress (Enrollment.progress) */
  const enrollments = (await Enrollment.find({
    student: { $in: subs.map((s) => idOf(s.student)).filter(Boolean) },
    course: { $in: courses.map((c) => c._id) },
  })
    .select("student course progress")
    .lean()) as unknown as Raw[];
  const progressOf = new Map(
    enrollments.map((e) => [`${idOf(e.student)}:${idOf(e.course)}`, num(e.progress, -1)]),
  );

  res.json({
    success: true,
    submissions: subs.map((s) => {
      const a = aMap.get(idOf(s.assignment));
      const st = (s.student ?? {}) as Raw;
      const f = fileOf(s);
      const graded = isGraded(s);
      const prog = progressOf.get(`${idOf(s.student)}:${idOf(a?.course)}`);
      return {
        id: idOf(s._id),
        assignmentId: idOf(s.assignment),
        assignmentTitle: str(a?.title),
        totalMarks: num(a?.totalMarks, 100),
        studentName: str(st.name) || "Student",
        studentEmail: str(st.email),
        fileName: f.name,
        fileUrl: f.url,
        text: str(s.text) || str(s.answer),
        submittedAt: iso(s.submittedAt ?? s.createdAt),
        score: graded && typeof s.score === "number" ? s.score : null,
        feedback: str(s.feedback),
        graded,
        progress: prog !== undefined && prog >= 0 ? Math.round(prog) : null,
      };
    }),
  });
});

/* POST /teacher/assignments */
export const createAssignment = wrap(async (req, res) => {
  const me = who(req, res);
  if (!me) return;

  const b = (req.body ?? {}) as Raw;
  const p = parseAssignment(b);
  if (!p.ok) return fail(res, 400, p.message);

  const courseId = str(b.courseId);
  if (!(await ownsCourse(courseId, me.id, me.admin))) return fail(res, 403, "Not your course");

  const created = await Assignment.create({
    course: courseId,
    title: p.title,
    instructions: p.instructions,
    deadline: p.deadline,
    dueDate: p.deadline,
    totalMarks: p.totalMarks,
    attachments: p.attachments,
  });

  res.status(201).json({ success: true, id: idOf(created) });
});

/* PUT /teacher/assignments/:id */
export const updateAssignment = wrap(async (req, res) => {
  const me = who(req, res);
  if (!me) return;

  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return fail(res, 400, "Invalid id");

  const asg = await Assignment.findById(id);
  if (!asg) return fail(res, 404, "Assignment not found");
  if (!(await ownsCourse(idOf((asg as unknown as Raw).course), me.id, me.admin)))
    return fail(res, 403, "Not your course");

  const p = parseAssignment((req.body ?? {}) as Raw);
  if (!p.ok) return fail(res, 400, p.message);

  /* Total marks komale, ager deya score er theke kom hote parbe na */
  const over = await Submission.countDocuments({ assignment: id, score: { $gt: p.totalMarks } });
  if (over > 0)
    return fail(res, 400, `${over} graded submission(s) already have a score above ${p.totalMarks}`);

  asg.set({
    title: p.title,
    instructions: p.instructions,
    deadline: p.deadline,
    dueDate: p.deadline,
    totalMarks: p.totalMarks,
    attachments: p.attachments,
  });
  await asg.save();

  res.json({ success: true });
});

/* DELETE /teacher/assignments/:id */
export const deleteAssignment = wrap(async (req, res) => {
  const me = who(req, res);
  if (!me) return;

  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return fail(res, 400, "Invalid id");

  const asg = (await Assignment.findById(id).select("course").lean()) as unknown as Raw | null;
  if (!asg) return fail(res, 404, "Assignment not found");
  if (!(await ownsCourse(idOf(asg.course), me.id, me.admin))) return fail(res, 403, "Not your course");

  await Submission.deleteMany({ assignment: id });
  await Assignment.findByIdAndDelete(id);

  res.json({ success: true });
});

/* PATCH /teacher/submissions/:id/grade */
export const gradeSubmission = wrap(async (req, res) => {
  const me = who(req, res);
  if (!me) return;

  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return fail(res, 400, "Invalid id");

  const sub = await Submission.findById(id);
  if (!sub) return fail(res, 404, "Submission not found");

  const a = (await Assignment.findById((sub as unknown as Raw).assignment)
    .select("course totalMarks")
    .lean()) as unknown as Raw | null;
  if (!a) return fail(res, 404, "Assignment not found");
  if (!(await ownsCourse(idOf(a.course), me.id, me.admin))) return fail(res, 403, "Not your course");

  const b = (req.body ?? {}) as Raw;
  const score = Number(b.score);
  const max = num(a.totalMarks, 100);
  if (!Number.isFinite(score) || score < 0 || score > max)
    return fail(res, 400, `Score must be between 0 and ${max}`);
  const feedback = str(b.feedback).trim().slice(0, 500);

  sub.set({ score, feedback, status: "graded", gradedAt: new Date() });
  await sub.save();

  res.json({ success: true, score, feedback });
});