import Category from "../models/Category"
import Course from "../models/Course"
import ApiError from "../utils/ApiError"
import asyncHandler from "../utils/asyncHandler"
import { slugify } from "../utils/helpers"

export const getCategories = asyncHandler(async (_req, res) => {
  const [categories, counts] = await Promise.all([
    Category.find().sort("name").lean(),
    Course.aggregate([
      { $match: { status: "published" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
  ])
  const map = new Map<string, number>(counts.map((c) => [String(c._id), c.count]))
  res.json({
    categories: categories.map((c) => ({ ...c, coursesCount: map.get(String(c._id)) || 0 })),
  })
})

export const createCategory = asyncHandler(async (req, res) => {
  const { name, icon } = req.body
  if (!name) throw new ApiError(400, "Category name is required")
  const category = await Category.create({ name, icon, slug: slugify(name) })
  res.status(201).json({ category })
})

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id)
  if (!category) throw new ApiError(404, "Category not found")
  if (req.body.name) {
    category.name = req.body.name
    category.slug = slugify(req.body.name)
  }
  if (req.body.icon) category.icon = req.body.icon
  await category.save()
  res.json({ category })
})

export const deleteCategory = asyncHandler(async (req, res) => {
  if (await Course.exists({ category: req.params.id })) {
    throw new ApiError(400, "Cannot delete a category that has courses")
  }
  await Category.findByIdAndDelete(req.params.id)
  res.json({ message: "Category deleted" })
})