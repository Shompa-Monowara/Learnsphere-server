import { Router } from "express"
import rateLimit from "express-rate-limit"
import { authorize, optionalAuth, protect } from "../middlewares/auth"
import { assignmentUpload, chatUpload, upload } from "../middlewares/upload"
import { validate } from "../middlewares/validate"
import {
  completeRegisterSchema,
  loginSchema,
  registerSchema,
  resendOtpSchema,
  verifyLoginOtpSchema,
} from "../validations/auth.validation"
import { contactSchema } from "../validations/contact.validation"
import { subscribeSchema } from "../validations/newsletter.validation"
import { blockDirectRegister } from "../middlewares/otpGate"

import * as admin from "../controllers/admin.controller"
import { getPayments } from "../controllers/adminPayments.controller"
import { getReports } from "../controllers/adminReports.controller"
import * as assignment from "../controllers/assignment.controller"
import * as auth from "../controllers/auth.controller"
import * as category from "../controllers/category.controller"
import * as certificate from "../controllers/certificate.controller"
import * as contact from "../controllers/contact.controller"
import * as course from "../controllers/course.controller"
import * as dashboard from "../controllers/dashboard.controller"
import * as enrollment from "../controllers/enrollment.controller"
import * as instructor from "../controllers/instructor.controller"
import * as message from "../controllers/message.controller"
import * as newsletter from "../controllers/newsletter.controller"
import * as notification from "../controllers/notification.controller"
import * as oauth from "../controllers/oauth.controller"
import * as quiz from "../controllers/quiz.controller"
import * as loginOtp from "../controllers/loginOtp.controller"
import * as registerOtp from "../controllers/registerOtp.controller"
import * as review from "../controllers/review.controller"
import * as uploadCtrl from "../controllers/upload.controller"
import * as wishlist from "../controllers/wishlist.controller"
import { getStudentDashboard } from "../controllers/studentDashboard.controller"
import * as portal from "../controllers/studentPortal.controller"
import { getTeacherDashboard } from "../controllers/teacherDashboard.controller"
import teacherRoutes from "./teacher.routes"
import { getFeatures } from "../controllers/features.controller"
import {
  getPublicAppearance,
  getSiteSettings,
  updateSiteSettings,
} from "../controllers/siteSettings.controller"
import { getPricing } from "../controllers/pricing.controller"
import { getPublicStats } from "../controllers/publicStats.controller"
import { getAbout } from "../controllers/about.controller"
import * as payment from "../controllers/payment.controller"
import * as subscription from "../controllers/subscription.controller"

const router = Router()
const teacher = [protect, authorize("teacher", "admin")]
const student = [protect, authorize("student")]
const adminOnly = [protect, authorize("admin")]
const teacherOnly = [protect, authorize("teacher")]

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { message: "Too many attempts. Please try again later." },
})

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: { message: "Too many messages. Please try again later." },
})

const newsletterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: { message: "Too many attempts. Please try again later." },
})

/* Auth */
router.post("/auth/register", authLimiter, blockDirectRegister, validate(registerSchema), auth.register)
router.post("/auth/register/request-otp", authLimiter, validate(registerSchema), registerOtp.requestOtp)
router.post("/auth/register/resend-otp", authLimiter, validate(resendOtpSchema), registerOtp.resendOtp)
router.post("/auth/register/complete", authLimiter, validate(completeRegisterSchema), registerOtp.complete)
router.post("/auth/login", authLimiter, validate(loginSchema), loginOtp.requestLoginOtp)
router.post("/auth/login/resend-otp", authLimiter, validate(resendOtpSchema), loginOtp.resendLoginOtp)
router.post("/auth/login/verify-otp", authLimiter, validate(verifyLoginOtpSchema), loginOtp.verifyLoginOtp)
router.post("/auth/forgot-password", authLimiter, validate(resendOtpSchema), auth.forgotPassword)
router.post("/auth/reset-password/:token", authLimiter, auth.resetPassword)
router.get("/auth/me", protect, auth.getMe)
router.put("/auth/me", protect, auth.updateMe)
router.put("/auth/password", protect, auth.changePassword)

/* OAuth Routes */
router.get("/auth/google", authLimiter, oauth.googleStart)
router.get("/auth/google/callback", authLimiter, oauth.googleCallback)
router.get("/auth/github", authLimiter, oauth.githubStart)
router.get("/auth/github/callback", authLimiter, oauth.githubCallback)
router.post("/auth/oauth/exchange", authLimiter, oauth.exchangeCode)

/* Site settings (public: login chhara-o pawa jabe, shudhu appearance) */
router.get("/site-settings/public", getPublicAppearance)

/* Pricing (public) */
router.get("/pricing", getPricing)
/* Features page content (public) */
router.get("/features", getFeatures)
/* About page content (public) */
router.get("/about", getAbout)

/* Home page stats (public, real counts) */
router.get("/stats/public", getPublicStats)

/* Newsletter (public) */
router.post("/newsletter/subscribe", newsletterLimiter, validate(subscribeSchema), newsletter.subscribe)
router.post("/newsletter/unsubscribe/:token", newsletterLimiter, newsletter.unsubscribe)

/* Contact (public) */
router.get("/contact/info", contact.getContactInfo)
router.post("/contact", contactLimiter, optionalAuth, validate(contactSchema), contact.createContactMessage)

/* Categories */
router.get("/categories", category.getCategories)
router.post("/categories", adminOnly, category.createCategory)
router.put("/categories/:id", adminOnly, category.updateCategory)
router.delete("/categories/:id", adminOnly, category.deleteCategory)

/* Instructors */
router.get("/instructors", instructor.getInstructors)
router.get("/instructors/:id", instructor.getInstructor)

/* Courses */
router.get("/courses", course.getCourses)
router.get("/courses/mine/list", teacher, course.getMyCourses)
router.get("/courses/:id", optionalAuth, course.getCourse)
router.post("/courses", teacher, course.createCourse)
router.put("/courses/:id", teacher, course.updateCourse)
router.put("/courses/:id/curriculum", teacher, course.updateCurriculum)
router.patch("/courses/:id/submit", teacher, course.submitForReview)
router.delete("/courses/:id", teacher, course.deleteCourse)

/* Reviews */
router.get("/courses/:courseId/reviews", optionalAuth, review.getCourseReviews)
router.post("/courses/:courseId/reviews", student, review.upsertReview)
router.get("/reviews/mine", teacher, review.getTeacherReviews)
router.patch("/reviews/:id/reply", teacher, review.replyToReview)
router.post("/reviews/:id/helpful", student, review.toggleHelpful)

/* Enrollments and learning */
router.post("/enrollments/:courseId", student, enrollment.enroll)
router.get("/enrollments/mine", protect, enrollment.getMyEnrollments)
router.get("/enrollments/students", teacher, enrollment.getMyStudents)
router.get("/enrollments/:courseId/learn", protect, enrollment.getLearningData)
router.get("/enrollments/:courseId/students", teacher, enrollment.getCourseStudents)
router.patch("/enrollments/:courseId/lessons/:lessonId/complete", student, enrollment.completeLesson)

/* Quizzes */
router.get("/quizzes/mine", student, portal.getMyQuizzes)
router.get("/quizzes/attempts/mine", student, quiz.getAllMyAttempts)
router.get("/courses/:courseId/quizzes", protect, quiz.getCourseQuizzes)
router.post("/courses/:courseId/quizzes", teacher, quiz.createQuiz)
router.get("/quizzes/:id", protect, quiz.getQuiz)
router.put("/quizzes/:id", teacher, quiz.updateQuiz)
router.delete("/quizzes/:id", teacher, quiz.deleteQuiz)
router.post("/quizzes/:id/start", student, quiz.startQuiz)
router.post("/quizzes/:id/attempt", student, quiz.attemptQuiz)
router.get("/quizzes/:id/attempts/me", student, quiz.getMyAttempts)
router.get("/quizzes/:id/attempts", teacher, quiz.getQuizAttempts)
router.patch("/quizzes/attempts/:attemptId/grade", teacher, quiz.gradeAttempt)
router.post("/payments/checkout/:courseId", student, payment.createCheckoutSession)
router.post("/payments/confirm", student, payment.confirmPayment)

/* Teacher plan subscription (Stripe) */
router.post("/subscriptions/checkout", teacherOnly, subscription.createCheckoutSession)
router.post("/subscriptions/confirm", teacherOnly, subscription.confirmSubscription)
router.get("/subscriptions/me", teacherOnly, subscription.getMySubscription)
router.post("/subscriptions/cancel", teacherOnly, subscription.cancelSubscription)

/* Assignments (student side).
   Teacher side: /teacher/assignments ar /teacher/submissions (teacher.routes.ts) */
router.get("/assignments/mine", student, assignment.getMyAssignments)
router.get("/courses/:courseId/assignments", protect, assignment.getCourseAssignments)
router.get("/assignments/:id", protect, assignment.getAssignment)
router.post("/assignments/:id/submit", student, assignmentUpload.single("file"), assignment.submitAssignment)

/* Wishlist */
router.get("/wishlist", protect, wishlist.getWishlist)
router.post("/wishlist/:courseId", protect, wishlist.addToWishlist)
router.delete("/wishlist/:courseId", protect, wishlist.removeFromWishlist)

/* Certificates */
router.get("/certificates/verify/:verificationId", certificate.verifyCertificate)
router.get("/certificates/mine", student, certificate.getMyCertificates)
router.get("/certificates/:id/download", protect, certificate.downloadCertificate)

/* Notifications */
router.get("/notifications", protect, notification.getNotifications)
router.patch("/notifications/read-all", protect, notification.markAllRead)
router.patch("/notifications/:id/read", protect, notification.markRead)

/* Messages */
router.get("/messages/conversations", protect, message.getConversations)
router.get("/messages/:userId", protect, message.getThread)
router.post("/messages/:userId", protect, chatUpload.single("file"), message.sendMessage)

/* Uploads */
router.post("/upload", protect, upload.single("file"), uploadCtrl.uploadFile)

/* Dashboards */
router.get("/dashboard/student", student, getStudentDashboard)
router.get("/dashboard/student/progress", student, portal.getProgress)
router.get("/dashboard/teacher", teacher, getTeacherDashboard)
router.get("/dashboard/teacher/earnings", teacher, dashboard.teacherEarnings)

/* Teacher portal (reviews page, earnings, payouts) */
router.use("/teacher", teacherRoutes)

/* Admin */
router.get("/admin/stats", adminOnly, admin.getStats)
router.get("/admin/users", adminOnly, admin.getUsers)
router.patch("/admin/users/:id/block", adminOnly, admin.toggleBlock)
router.patch("/admin/users/:id/role", adminOnly, admin.changeRole)
router.delete("/admin/users/:id", adminOnly, admin.deleteUser)
router.get("/admin/categories", adminOnly, category.getAdminCategories)
router.get("/admin/courses", adminOnly, admin.getAdminCourses)
router.patch("/admin/courses/:id/moderate", adminOnly, admin.moderateCourse)
router.get("/admin/transactions", adminOnly, admin.getTransactions)
router.get("/admin/payments", adminOnly, getPayments)
router.get("/admin/reports", adminOnly, getReports)
router.get("/admin/site-settings", adminOnly, getSiteSettings)
router.put("/admin/site-settings", adminOnly, updateSiteSettings)
router.get("/admin/newsletter/subscribers", adminOnly, newsletter.getSubscribers)
router.get("/admin/contact-messages", adminOnly, contact.getContactMessages)
router.patch("/admin/contact-messages/:id/status", adminOnly, contact.updateContactStatus)
router.delete("/admin/contact-messages/:id", adminOnly, contact.deleteContactMessage)

export default router