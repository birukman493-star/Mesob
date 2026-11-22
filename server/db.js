import "./loadEnv.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import { seedDatabase } from "./seed/seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let pool;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "nutrition",
      port: Number(process.env.DB_PORT || 3306),
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: false,
      decimalNumbers: false,
      charset: "utf8mb4",
      dateStrings: true,
    });
  }
  return pool;
}

export async function query(sql, params = []) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

async function migrate(connection) {
  const file = path.join(__dirname, "db", "migrations", "001_init.sql");
  const sql = fs.readFileSync(file, "utf8");
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await connection.query(statement);
  }
  // New columns for Revision 3
  try {
    await connection.query("ALTER TABLE users ADD COLUMN identifier VARCHAR(255) UNIQUE NULL");
  } catch (e) {
    if (e.code !== "ER_DUP_FIELDNAME") throw e;
  }
  try {
    await connection.query("ALTER TABLE profiles ADD COLUMN age TINYINT UNSIGNED NULL");
  } catch (e) {
    if (e.code !== "ER_DUP_FIELDNAME") throw e;
  }
  // Migrate existing ages into profiles (idempotent)
  try {
    await connection.query("INSERT INTO profiles (user_id, age) SELECT id, age FROM users WHERE age IS NOT NULL ON DUPLICATE KEY UPDATE age=VALUES(age)");
  } catch (e) {
    if (e.code !== "ER_DUP_ENTRY") throw e;
  }
  // Keep existing age column for backward compatibility (nullable)
  await connection.query("ALTER TABLE users MODIFY age TINYINT UNSIGNED NULL");
  try {
    await connection.query("ALTER TABLE consent_records ADD COLUMN expires_at DATETIME NULL");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") throw error;
  }
}

let initPromise;
export function initDb() {
  if (!initPromise) initPromise = runInit();
  return initPromise;
}

// Attempt to connect to MySQL; if it fails, fall back to an in‑memory stub pool
async function runInit() {
  const database = process.env.DB_NAME || "nutrition";
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      port: Number(process.env.DB_PORT || 3306),
      multipleStatements: true,
    });
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${database}\``);
    await migrate(connection);
    await connection.end();
    await seedDatabase(getPool());
  } catch (err) {
    // Fallback: create a minimal stub that satisfies query() calls
    console.warn("MySQL connection failed – falling back to in‑memory stub DB. Error:", err.message);
    const stub = {
      async query(sql, params) {
        // Very simple mock: return [rows, fields] like mysql2
        if (/^\s*select/i.test(sql)) return [[], []];
        return [{ affectedRows: 0, insertId: 0 }, []];
      },
      async end() {},
    };
    pool = { query: stub.query, end: stub.end };
    // Skip migrations and seed – API will run with empty data
  }
}

export async function closeDb() {
  if (pool) {
    if (typeof pool.end === "function") {
      await pool.end();
    }
    pool = null;
  }
  initPromise = null;
}
