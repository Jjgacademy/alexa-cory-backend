import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import pool from "./config/db.js"; // 👈 NUEVO

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import planRoutes from "./routes/plan.routes.js";
import tuRutaProtegida from "./routes/tuRutaProtegida.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js"; 
import reminderRoutes from "./routes/reminder.routes.js";
import "./services/reminder.service.js";
import uploadRoutes from "./routes/upload.routes.js";

const app = express();
app.use(cors());
app.use(express.json());

// 👇 PROBAR CONEXIÓN A POSTGRES
pool.query("SELECT NOW()")
  .then(() => console.log("📌 PostgreSQL conectado"))
  .catch(err => console.error("❌ Error PostgreSQL", err));

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/plan", planRoutes);
app.use("/api/protegido", tuRutaProtegida);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/upload", uploadRoutes);

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
});
