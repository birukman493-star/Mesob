import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { asyncHandler } from "../middleware/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import {
  categorySchema,
  chatSchema,
  speakSchema,
  checkoutSchema,
  consentSchema,
  consultSchema,
  consultUpdateSchema,
  foodWriteSchema,
  growthSchema,
  languageSchema,
  logSchema,
  loginSchema,
  planSchema,
  profileSchema,
  ramadanSchema,
  recipeSchema,
  registerSchema,
  rulesSchema,
  subscriptionPatchSchema,
  validate,
  waterSchema,
  weightSchema,
} from "../middleware/validate.js";
import { login, register } from "../Controllers/authController.js";
import { getTargets, me, updateCategory, updateLanguage, updateProfile } from "../Controllers/profileController.js";
import { analyze, currentPlan, generatePlan, replaceItem } from "../Controllers/planController.js";
import { foodPopup, searchFoods } from "../Controllers/foodController.js";
import { addGrowth, addLog, addWater, addWeight, getLogs } from "../Controllers/logController.js";
import { scanFood } from "../Controllers/scanController.js";
import { chat, clearHistory, history } from "../Controllers/chatController.js";
import { speakReply } from "../Controllers/voiceSpeakController.js";
import { guidelines, healthPdf, weekly } from "../Controllers/reportController.js";
import { suggest } from "../Controllers/recipeController.js";
import {
  dietitianRequests,
  listDietitians,
  myRequests,
  readSharedUser,
  requestConsult,
  updateConsent,
  updateRequest,
} from "../Controllers/consultController.js";
import {
  createFood,
  deleteFood,
  getRamadan,
  getRules,
  listFoods,
  listUsers,
  putRamadan,
  putRules,
  updateFood,
  updateUserSubscription,
} from "../Controllers/adminController.js";
import { checkout } from "../Controllers/subscriptionController.js";

const router = Router();
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMIT", message: "Too many attempts. Try again in a minute." } },
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (Number(process.env.UPLOAD_MAX_MB) || 5) * 1024 * 1024 },
});
router.get("/health", (req, res) => res.json({ ok: true, service: "mesob" }));

router.post("/auth/register", authLimiter, validate(registerSchema), asyncHandler(register));
router.post("/auth/login", authLimiter, validate(loginSchema), asyncHandler(login));

router.get("/me", requireAuth, asyncHandler(me));
router.put("/me/category", requireAuth, validate(categorySchema), asyncHandler(updateCategory));
router.put("/me/profile", requireAuth, validate(profileSchema), asyncHandler(updateProfile));
router.put("/me/language", requireAuth, validate(languageSchema), asyncHandler(updateLanguage));
router.get("/targets", requireAuth, asyncHandler(getTargets));

router.post("/plans/generate", requireAuth, validate(planSchema), asyncHandler(generatePlan));
router.get("/plans/current", requireAuth, asyncHandler(currentPlan));
router.put("/plans/items/:id", requireAuth, asyncHandler(replaceItem));
router.post("/plans/analysis", requireAuth, asyncHandler(analyze));

router.get("/foods", requireAuth, asyncHandler(searchFoods));
router.get("/foods/:id/popup", requireAuth, asyncHandler(foodPopup));

router.post("/logs", requireAuth, validate(logSchema), asyncHandler(addLog));
router.get("/logs", requireAuth, asyncHandler(getLogs));
router.post("/water", requireAuth, validate(waterSchema), asyncHandler(addWater));
router.post("/weight", requireAuth, validate(weightSchema), asyncHandler(addWeight));
router.post("/growth", requireAuth, validate(growthSchema), asyncHandler(addGrowth));

router.post("/scan", requireAuth, upload.single("image"), asyncHandler(scanFood));
router.post("/chat", requireAuth, validate(chatSchema), asyncHandler(chat));
router.get("/chat", requireAuth, asyncHandler(history));
router.delete("/chat", requireAuth, asyncHandler(clearHistory));
router.post("/voice/speak", requireAuth, validate(speakSchema), asyncHandler(speakReply));
router.post("/recipes/suggest", requireAuth, validate(recipeSchema), asyncHandler(suggest));

router.get("/reports/weekly", requireAuth, asyncHandler(weekly));
router.get("/reports/health-summary.pdf", requireAuth, asyncHandler(healthPdf));
router.get("/guidelines", requireAuth, asyncHandler(guidelines));

router.get("/consult/dietitians", requireAuth, asyncHandler(listDietitians));
router.get("/consult/mine", requireAuth, asyncHandler(myRequests));
router.post("/consult/request", requireAuth, validate(consultSchema), asyncHandler(requestConsult));
router.put("/consent", requireAuth, validate(consentSchema), asyncHandler(updateConsent));

router.get("/dietitian/requests", requireAuth, requireRole("dietitian"), asyncHandler(dietitianRequests));
router.put("/dietitian/requests/:id", requireAuth, requireRole("dietitian"), validate(consultUpdateSchema), asyncHandler(updateRequest));
router.get("/dietitian/users/:id", requireAuth, requireRole("dietitian"), asyncHandler(readSharedUser));

router.get("/admin/foods", requireAuth, requireRole("admin"), asyncHandler(listFoods));
router.post("/admin/foods", requireAuth, requireRole("admin"), validate(foodWriteSchema), asyncHandler(createFood));
router.put("/admin/foods/:id", requireAuth, requireRole("admin"), validate(foodWriteSchema), asyncHandler(updateFood));
router.delete("/admin/foods/:id", requireAuth, requireRole("admin"), asyncHandler(deleteFood));
router.get("/admin/rules", requireAuth, requireRole("admin"), getRules);
router.put("/admin/rules", requireAuth, requireRole("admin"), validate(rulesSchema), putRules);
router.get("/admin/ramadan", requireAuth, requireRole("admin"), asyncHandler(getRamadan));
router.put("/admin/ramadan", requireAuth, requireRole("admin"), validate(ramadanSchema), asyncHandler(putRamadan));
router.get("/admin/users", requireAuth, requireRole("admin"), asyncHandler(listUsers));
router.put("/admin/users/:id", requireAuth, requireRole("admin"), validate(subscriptionPatchSchema), asyncHandler(updateUserSubscription));

router.post("/subscription/checkout", requireAuth, validate(checkoutSchema), asyncHandler(checkout));

export default router;
