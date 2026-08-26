import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  addToHistory,
  getUserHistory,
  login,
  register,
} from "../controllers/user.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

// Slows credential stuffing on the auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later" },
});

router.route("/login").post(authLimiter, login);
router.route("/register").post(authLimiter, register);
router.route("/add_to_activity").post(requireAuth, addToHistory);
router.route("/get_all_activity").get(requireAuth, getUserHistory);

export default router;