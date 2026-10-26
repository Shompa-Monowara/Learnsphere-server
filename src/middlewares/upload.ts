import multer from "multer"
import ApiError from "../utils/ApiError"

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
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
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    CHAT_MIME_TYPES[file.mimetype]
      ? cb(null, true)
      : cb(new ApiError(400, "Only images (JPG, PNG, WEBP, GIF) and PDF files are allowed")),
})

/* Assignment submission: shudhu document / archive / image, max 25 MB */
export const ASSIGNMENT_MAX_MB = 25

const ASSIGNMENT_FILE_TYPES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  zip: ["application/zip", "application/x-zip-compressed", "application/octet-stream"],
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
  limits: { fileSize: ASSIGNMENT_MAX_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname.split(".").pop() || "").toLowerCase()
    const mimes = ASSIGNMENT_FILE_TYPES[ext]
    if (mimes && mimes.includes(file.mimetype)) return cb(null, true)
    cb(new ApiError(400, "Allowed files: PDF, ZIP, DOC/DOCX, PPT/PPTX, XLS/XLSX, TXT and images (max 25 MB)"))
  },
})