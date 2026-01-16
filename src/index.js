import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

/* =========================
   CARGA FORZADA DEL .env
   ========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

// 🔎 Verificación (puedes borrar luego)
console.log("ENV CHECK:", {
  PORT: process.env.PORT,
  DB_USER: process.env.DB_USER,
  DB_NAME: process.env.DB_NAME,
  JWT_SECRET: process.env.JWT_SECRET,
});

/* =========================
   IMPORTS
   ========================= */
import express from "express";
import cors from "cors";

import pool from "./config/db.js";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import planRoutes from "./routes/plan.routes.js";
import tuRutaProtegida from "./routes/tuRutaProtegida.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import reminderRoutes from "./routes/reminder.routes.js";
import uploadRoutes from "./routes/upload.routes.js";

import "./services/reminder.service.js";

/* =========================
   APP
   ========================= */
const app = express();

/* =========================
   CORS CORRECTO (SIN app.options)
   ========================= */
app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

/* =========================
   MIDDLEWARES
   ========================= */
app.use(express.json());

/* =========================
   DB CHECK
   ========================= */
pool.query("SELECT NOW()")
  .then(() => console.log("📌 PostgreSQL conectado"))
  .catch(err => console.error("❌ Error PostgreSQL", err));

/* =========================
   ROUTES
   ========================= */
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/plan", planRoutes);
app.use("/api/protegido", tuRutaProtegida);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/upload", uploadRoutes);

/* =========================
   HEALTH CHECK
   ========================= */
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

/* =========================
   SERVER
   ========================= */
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
});
