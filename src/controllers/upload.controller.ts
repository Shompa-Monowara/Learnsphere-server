import type { UploadApiResponse } from "cloudinary"
import cloudinary from "../config/cloudinary"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"

export const uploadBuffer = (buffer: Buffer, folder: string): Promise<UploadApiResponse> =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `learnsphere/${folder}`, resource_type: "auto" },
      (error, result) => (error || !result ? reject(error) : resolve(result))
    )
    stream.end(buffer)
  })

export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No file uploaded")
  const folder = ["thumbnails", "videos", "documents", "avatars"].includes(req.body.folder)
    ? req.body.folder
    : "misc"
  const result = await uploadBuffer(req.file.buffer, folder)
  res.status(201).json({
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    duration: Math.round((result as any).duration || 0),
    bytes: result.bytes,
  })
})