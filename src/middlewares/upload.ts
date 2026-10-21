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