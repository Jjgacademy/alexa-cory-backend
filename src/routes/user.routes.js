import { Router } from "express";
import {
  getProfile,
  updateProfile,
  recoverPassword,
  resetPassword,
  recoverByUsername,
  resetByUsername,
} from "../controllers/user.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

// ===============================
// PERFIL
// ===============================
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);

// ===============================
// RECUPERAR CONTRASEÑA (POR CORREO)
// (LO QUE YA TENÍAS, NO SE TOCA)
// ===============================
router.post("/recover-password", recoverPassword);
router.post("/reset-password/:token", resetPassword);

// ===============================
// RECUPERAR CONTRASEÑA (POR USUARIO)
// (NUEVO)
// ===============================
router.post("/recover-by-username", recoverByUsername);
router.post("/reset-by-username", resetByUsername);

export default router;
