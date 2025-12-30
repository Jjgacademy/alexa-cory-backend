import cron from "node-cron";
import pool from "../config/db.js";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Ejecuta cada día a las 8am
cron.schedule("0 8 * * *", async () => {
  console.log("⏰ Revisando recordatorios...");

  const result = await pool.query(`
    SELECT r.*, u.email
    FROM reminders r
    JOIN users u ON r.user_id = u.id
    WHERE r.enviado = FALSE
    AND r.fecha_vencimiento <= NOW() + INTERVAL '3 days'
  `);

  for (const r of result.rows) {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: r.email,
      subject: `Recordatorio Fiscal: ${r.titulo}`,
      text: `
Hola,
Este es un recordatorio de tu app fiscal.

Título: ${r.titulo}
Descripción: ${r.descripcion}
Fecha límite: ${r.fecha_vencimiento}

No olvides cumplir con esta obligación.
      `
    });

    await pool.query(
      "UPDATE reminders SET enviado = TRUE WHERE id = $1",
      [r.id]
    );

    console.log(`📧 Recordatorio enviado a ${r.email}`);
  }
});
