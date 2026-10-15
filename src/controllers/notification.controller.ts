import Notification from "../models/Notification"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"

export const getNotifications = asyncHandler(async (req, res) => {
  const [notifications, unread] = await Promise.all([
    Notification.find({ user: req.user!._id }).sort("-createdAt").limit(50),
    Notification.countDocuments({ user: req.user!._id, read: false }),
  ])
  res.json({ notifications, unread })
})

export const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user!._id },
    { read: true },
    { new: true }
  )
  if (!notification) throw new ApiError(404, "Notification not found")
  res.json({ notification })
})

export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user!._id, read: false }, { read: true })
  res.json({ message: "All notifications marked as read" })
})