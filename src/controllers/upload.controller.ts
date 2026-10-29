import fs from "fs"
import type { UploadApiResponse } from "cloudinary"
import cloudinary from "../config/cloudinary"
import { STUDENT_IMAGE_MIME, STUDENT_MAX_BYTES } from "../middlewares/upload"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"

/* Executable / script file kono role ei upload korte parbe na */
const BLOCKED_EXT = new Set(["exe", "msi", "bat", "cmd", "com", "scr", "sh", "js", "jar", "apk", "ps1", "vbs", "dll"])

/* Memory buffer theke (assignment, chat er chhoto file) */
export const uploadBuffer = (buffer: Buffer, folder: string): Promise<UploadApiResponse> =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `learnsphere/${folder}`, resource_type: "auto" },
      (error, result) => (error || !result ? reject(error) : resolve(result))
    )
    stream.end(buffer)
  })

/* Disk theke stream kore (boro file, video): pura file RAM e load hoy na */
const uploadFromPath = (filePath: string, folder: string): Promise<UploadApiResponse> =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `learnsphere/${folder}`, resource_type: "auto" },
      (error, result) => (error || !result ? reject(error) : resolve(result))
    )
    fs.createReadStream(filePath).on("error", reject).pipe(stream)
  })

export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No file uploaded")
  const tempPath = req.file.path

  try {
    const ext = (req.file.originalname.split(".").pop() || "").toLowerCase()
    if (BLOCKED_EXT.has(ext)) throw new ApiError(400, "This file type is not allowed")

    /* Student shudhu chhoto image (avatar) upload korte pare. Video/PDF/boro file shudhu teacher ar admin */
    if (req.user?.role === "student") {
      if (!STUDENT_IMAGE_MIME.has(req.file.mimetype)) throw new ApiError(403, "Students can only upload images")
      if (req.file.size > STUDENT_MAX_BYTES) throw new ApiError(400, "Images must be 5 MB or smaller")
    }

    const folder = ["thumbnails", "videos", "documents", "avatars"].includes(req.body.folder)
      ? req.body.folder
      : "misc"
    const result = await uploadFromPath(tempPath, folder)
    res.status(201).json({
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      duration: Math.round((result as any).duration || 0),
      bytes: result.bytes,
    })
  } finally {
    /* Success hok ba error, temp file shobshomoy muche felbo */
    fs.promises.unlink(tempPath).catch(() => {})
  }
})