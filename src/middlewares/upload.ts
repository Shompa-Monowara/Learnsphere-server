import crypto from "crypto"
import os from "os"
import multer from "multer"
import ApiError from "../utils/ApiError"

const MB = 1024 * 1024

/* Student shudhu chhoto image (avatar) upload korte pare */
export const STUDENT_MAX_BYTES = 5 * MB
export const STUDENT_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

/* General upload: teacher er video 100 MB porjonto.
   diskStorage: file RAM e na rekhe temp folder e jay, tai onek upload ekshathe holeo memory shesh hoy na */
export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, _file, cb) => cb(null, `ls-upload-${crypto.randomUUID()}`),
  }),
  limits: { fileSize: 100 * MB },
  fileFilter: (req, file, cb) => {
    if (req.user?.role === "student") {
      if (!STUDENT_IMAGE_MIME.has(file.mimetype)) return cb(new ApiError(403, "Students can only upload images"))
      /* Content-Length diye boro file ke shuru-tei aatkai (multipart overhead er jonno 100 KB extra) */
      const declared = Number(req.headers["content-length"] || 0)
      if (declared > STUDENT_MAX_BYTES + 100 * 1024) return cb(new ApiError(400, "Images must be 5 MB or smaller"))
    }
    cb(null, true)
  },
})

/* Chat attachment: shudhu image (jpg/png/webp/gif) ar PDF, max 10 MB */
export const CHAT_MIME_TYPES: Record<string, "image" | "pdf"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "application/pdf": "pdf",
}

export const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * MB },
  fileFilter: (_req, file, cb) =>
    CHAT_MIME_TYPES[file.mimetype]
      ? cb(null, true)
      : cb(new ApiError(400, "Only images (JPG, PNG, WEBP, GIF) and PDF files are allowed")),
})

/* Assignment submission: shudhu document / archive / image, max 25 MB */
export const ASSIGNMENT_MAX_MB = 25

/* Fix 5: "application/octet-stream" shoriye dilam, zip er jonno shudhu real zip MIME */
const ASSIGNMENT_FILE_TYPES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  zip: ["application/zip", "application/x-zip-compressed"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  txt: ["text/plain"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  gif: ["image/gif"],
}

export const assignmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ASSIGNMENT_MAX_MB * MB },
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname.split(".").pop() || "").toLowerCase()
    const mimes = ASSIGNMENT_FILE_TYPES[ext]
    if (mimes && mimes.includes(file.mimetype)) return cb(null, true)
    cb(new ApiError(400, "Allowed files: PDF, ZIP, DOC/DOCX, PPT/PPTX, XLS/XLSX, TXT and images (max 25 MB)"))
  },
})