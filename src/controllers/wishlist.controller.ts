import Course from "../models/Course"
import User from "../models/User"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"

export const getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!._id).populate({
    path: "wishlist",
    select: "-sections",
    populate: [
      { path: "instructor", select: "name avatar" },
      { path: "category", select: "name" },
    ],
  })
  res.json({ courses: user?.wishlist ?? [] })
})

export const addToWishlist = asyncHandler(async (req, res) => {
  if (!(await Course.exists({ _id: req.params.courseId }))) throw new ApiError(404, "Course not found")
  await User.findByIdAndUpdate(req.user!._id, { $addToSet: { wishlist: req.params.courseId } })
  res.status(201).json({ message: "Added to wishlist" })
})

export const removeFromWishlist = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user!._id, { $pull: { wishlist: req.params.courseId } })
  res.json({ message: "Removed from wishlist" })
})