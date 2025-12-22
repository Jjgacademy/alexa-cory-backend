import express from "express";
import { chatTributario } from "../controllers/chat.controller.js";

const router = express.Router();

router.post("/chat", chatTributario);

export default router;
