import fs from "fs";
import path from "path";
import pool from "../config/db.js";

const migrationsDir = path.resolve("src/migrations");

const run = async () => {
  try {
    const files = fs
      .readdirSync(migrationsDir)
      .filter(f => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("No hay migraciones para ejecutar");
      process.exit(0);
    }

    for (const file of files) {
      const sql = fs.readFileSync(
        path.join(migrationsDir, file),
        "utf8"
      );
      await pool.query(sql);
      console.log(`✔ Ejecutada: ${file}`);
    }

    console.log("✅ Migraciones completadas");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error ejecutando migraciones");
    console.error(error.message);
    process.exit(1);
  }
};

run();
