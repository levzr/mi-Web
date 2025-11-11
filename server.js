// ===============================================
// 🚀 PedidosHN - Servidor Principal
// ===============================================

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import session from "express-session";
import pgSession from "connect-pg-simple";
import bcrypt from "bcrypt";
import { pool } from "./db.js";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const PgSession = pgSession(session);

// ===============================================
// Configuración del servidor
// ===============================================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Sesiones
app.use(
  session({
    store: new PgSession({
      pool: pool,
      tableName: "session",
    }),
    secret: "mi_super_secreto_seguro",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 }, // 1 hora
  })
);

// Variables globales
app.use((req, res, next) => {
  res.locals.siteName = "PedidosHN";
  res.locals.currentYear = new Date().getFullYear();
  res.locals.user = req.session.user || null;
  next();
});

// ===============================================
// Cargar datos JSON locales
// ===============================================
const dataPath = path.join(__dirname, "data", "restaurantes.json");
let restaurantes = [];

try {
  const rawData = fs.readFileSync(dataPath, "utf-8");
  restaurantes = JSON.parse(rawData);
  console.log("📦 Restaurantes cargados:", restaurantes.length);
} catch (err) {
  console.error("❌ Error cargando restaurantes.json:", err);
}

// ===============================================
// 🌐 RUTAS WEB (EJS)
// ===============================================
app.get("/", (req, res) => res.render("home", { restaurantes }));

app.get("/login", (req, res) => res.render("login"));
app.get("/register", (req, res) => res.render("register"));

app.get("/restaurantes/:slug", (req, res) => {
  const restaurante = restaurantes.find((r) => r.id === req.params.slug);
  if (!restaurante)
    return res
      .status(404)
      .render("error", { mensaje: "Restaurante no encontrado" });
  res.render("restaurantes", { restaurante });
});

app.get("/checkout", (req, res) => {
  const { restaurante, plato, precio } = req.query;
  res.render("checkout", { restaurante, plato, precio });
});

// ===============================================
// API: REGISTRO / LOGIN / LOGOUT
// ===============================================

// Registro
app.post("/api/register", async (req, res) => {
  try {
    const { nombre, email, password, direccion } = req.body;

    if (!nombre || !email || !password)
      return res
        .status(400)
        .json({ success: false, error: "Faltan campos obligatorios" });

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO usuarios (nombre, email, password, direccion)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [nombre, email, hashedPassword, direccion || ""]
    );

    res.redirect("/login");
  } catch (err) {
    console.error("⚠️ Error en /api/register:", err);
    res
      .status(500)
      .render("register", { error: "Error registrando usuario" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query("SELECT * FROM usuarios WHERE email = $1", [
      email,
    ]);
    const user = result.rows[0];

    if (!user)
      return res
        .status(401)
        .json({ success: false, error: "Usuario no encontrado" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res
        .status(401)
        .json({ success: false, error: "Contraseña incorrecta" });

    req.session.user = { id: user.id, nombre: user.nombre, email: user.email };

    res.redirect("/"); 
  } catch (err) {
    console.error("🔥 Error en /api/login:", err);
    res
      .status(500)
      .render("login", { error: "Error iniciando sesión" });
  }
});

// Logout
app.get("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ success: false, error: "Error cerrando sesión" });
    res.redirect("/") ({ success: true, message: "Sesión cerrada correctamente" });
  });
});

// ===============================================
// 🌐 API DE RESTAURANTES Y ÓRDENES
// ===============================================
app.get("/api/restaurantes", (req, res) => res.json(restaurantes));

app.post("/api/ordenes", async (req, res) => {
  try {
    const { nombre, direccion, restauranteId, pedido, scheduleDate, scheduleSlot } = req.body;

    const userResult = await pool.query(
      `INSERT INTO usuarios (nombre, email, direccion)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET direccion = EXCLUDED.direccion
       RETURNING id`,
      [nombre, `${nombre.toLowerCase()}@correo.com`, direccion]
    );

    const usuarioId = userResult.rows[0].id;

    const restResult = await pool.query(
      `SELECT id FROM restaurantes WHERE slug = $1`,
      [restauranteId]
    );

    const restaurante_id = restResult.rows.length > 0 ? restResult.rows[0].id : null;

    const orderResult = await pool.query(
      `INSERT INTO ordenes (usuario_id, nombre, direccion, restaurante_id, restaurante_slug, pedido, fecha, schedule_date, schedule_slot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        usuarioId,
        nombre,
        direccion,
        restaurante_id,
        restauranteId,
        pedido,
        new Date(),
        scheduleDate || "Hoy",
        scheduleSlot || "Inmediato",
      ]
    );

    res.status(201).json({
      success: true,
      message: "Orden registrada exitosamente",
      orderId: orderResult.rows[0].id,
    });
  } catch (err) {
    console.error("🔥 Error en /api/ordenes:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/ordenes", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        o.id, o.nombre, o.direccion, o.pedido, o.fecha, 
        o.schedule_date, o.schedule_slot, r.nombre AS restaurante
      FROM ordenes o
      LEFT JOIN restaurantes r ON o.restaurante_id = r.id
      ORDER BY o.fecha DESC
    `);

    res.json({ success: true, total: result.rows.length, data: result.rows });
  } catch (err) {
    console.error("🔥 Error al obtener órdenes:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===============================================
// Servidor corriendo
// ===============================================
app.listen(PORT, "0.0.0.0", () => {
  console.log("===================================================");
  console.log(`🚀 PedidosHN corriendo en: http://0.0.0.0:${PORT}`);
  console.log("===================================================");
});

