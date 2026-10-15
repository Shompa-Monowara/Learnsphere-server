import PDFDocument from "pdfkit"
import Certificate from "../models/Certificate"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"

export const getMyCertificates = asyncHandler(async (req, res) => {
  const certificates = await Certificate.find({ student: req.user!._id })
    .populate({
      path: "course",
      select: "title totalDuration instructor",
      populate: { path: "instructor", select: "name" },
    })
    .populate("student", "name")
    .sort("-createdAt")
  res.json({ certificates })
})

export const verifyCertificate = asyncHandler(async (req, res) => {
  const certificate = await Certificate.findOne({ verificationId: req.params.verificationId })
    .populate("course", "title")
    .populate("student", "name")
  if (!certificate) throw new ApiError(404, "Certificate not found")
  res.json({ valid: true, certificate })
})

export const downloadCertificate = asyncHandler(async (req, res) => {
  const certificate = await Certificate.findById(req.params.id)
    .populate<{ course: { title: string } }>("course", "title")
    .populate<{ student: { _id: unknown; name: string } }>("student", "name")
  if (!certificate) throw new ApiError(404, "Certificate not found")
  if (String(certificate.student._id) !== String(req.user!._id) && req.user!.role !== "admin") {
    throw new ApiError(403, "Not your certificate")
  }

  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 50 })
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `attachment; filename=certificate-${certificate.verificationId}.pdf`)
  doc.pipe(res)

  const { width, height } = doc.page
  doc.rect(24, 24, width - 48, height - 48).lineWidth(4).stroke("#0D9488")
  doc.rect(34, 34, width - 68, height - 68).lineWidth(1).stroke("#D4AF37")

  doc.fillColor("#0F766E").fontSize(16).text("LEARNSPHERE", 0, 80, { align: "center", characterSpacing: 4 })
  doc.fillColor("#0F172A").fontSize(38).text("Certificate of Completion", 0, 120, { align: "center" })
  doc.fillColor("#64748B").fontSize(14).text("This certifies that", 0, 190, { align: "center" })
  doc.fillColor("#0D9488").fontSize(34).text(certificate.student.name, 0, 215, { align: "center" })
  doc.fillColor("#64748B").fontSize(14).text("has successfully completed the course", 0, 275, { align: "center" })
  doc.fillColor("#0F172A").fontSize(24).text(certificate.course.title, 80, 305, { align: "center", width: width - 160 })

  const date = (certificate as any).createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  doc.fillColor("#64748B").fontSize(12).text(`Issued on ${date}`, 0, height - 130, { align: "center" })
  doc.fontSize(11).text(`Verification ID: ${certificate.verificationId}`, 0, height - 105, { align: "center" })
  doc.end()
})