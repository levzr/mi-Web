// ===============================================
// 🚀 PedidosHN - Servidor Principal
// ===============================================

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import { pool } from "./db.js";
import fs from "fs";
import bcrypt from "bcrypt";
import session from "express-session";
import pgSession from "connect-pg-simple";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================================
// Configuración del servidor
// ===============================================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ===============================================
// Configurar sesiones (guardadas en PostgreSQL)
// ===============================================
const PgSession = pgSession(session);
app.use(
  session({
    store: new PgSession({
      pool: pool,
      tableName: "session",
    }),
    secret: "super-secreto-pedidoshn",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 días
  })
);

// ===============================================
// Variables globales disponibles en las vistas
// ===============================================
app.use((req, res, next) => {
  res.locals.siteName = "PedidosHN";
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
// 🌐 Rutas Web (EJS)
// ===============================================

// Página principal
app.get("/", (req, res) => {
  res.render("home", { restaurantes });
});

// Página de restaurante individual
app.get("/restaurantes/:slug", (req, res) => {
  const restaurante = restaurantes.find((r) => r.id === req.params.slug);
  if (!restaurante) {
    return res
      .status(404)
      .render("error", { mensaje: "Restaurante no encontrado" });
  }
  res.render("restaurantes", { restaurante });
});

// Página de checkout
app.get("/checkout", (req, res) => {
  const { restaurante, plato, precio } = req.query;
  res.render("checkout", { restaurante, plato, precio });
});

// ✅ Vistas de login y registro
app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

// Procesar pedido desde formulario (EJS)
app.post("/checkout", async (req, res) => {
  try {
    const { nombre, direccion, restauranteId, pedido, scheduleDate, scheduleSlot } = req.body;

    const userResult = await pool.query(
      `INSERT INTO usuarios (nombre, email, direccion, password)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET direccion = EXCLUDED.direccion
       RETURNING id`,
      [nombre, `${nombre.toLowerCase()}@correo.com`, direccion, "autogen"]
    );

    const usuarioId = userResult.rows[0].id;

    const restResult = await pool.query(
      `SELECT id FROM restaurantes WHERE slug = $1`,
      [restauranteId]
    );

    const restaurante_id = restResult.rows.length > 0 ? restResult.rows[0].id : null;

    await pool.query(
      `INSERT INTO ordenes (usuario_id, nombre, direccion, restaurante_id, restaurante_slug, pedido, fecha, schedule_date, schedule_slot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
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

    res.render("success", {
      nombre,
      direccion,
      pedido,
      scheduleDate,
      scheduleSlot,
      fecha: new Date().toISOString(),
    });
  } catch (err) {
    console.error("🔥 Error procesando pedido:", err);
    res.status(500).render("error", { mensaje: "Error interno al procesar el pedido" });
  }
});

// ===============================================
// 🧑‍💻 Rutas de Autenticación (API)
// ===============================================

// Registro
app.post("/api/register", async (req, res) => {
  try {
    const { nombre, email, password, direccion } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO usuarios (nombre, email, password, direccion)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [nombre, email, hashedPassword, direccion || ""]
    );

    res.json({ success: true, message: "Usuario registrado correctamente" });
  } catch (err) {
    console.error("Error en /api/register:", err.message);
    res.status(500).json({ success: false, error: "Error registrando usuario" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ success: false, message: "Usuario no encontrado" });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(401).json({ success: false, message: "Contraseña incorrecta" });

    req.session.user = { id: user.id, nombre: user.nombre, email: user.email };
    res.json({ success: true, message: "Inicio de sesión exitoso", user: req.session.user });
  } catch (err) {
    console.error("Error en /api/login:", err.message);
    res.status(500).json({ success: false, error: "Error en el inicio de sesión" });
  }
});

// Logout
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true, message: "Sesión cerrada" }));
});

// Middleware de autenticación
function verificarSesion(req, res, next) {
  if (!req.session.user) return res.status(403).json({ message: "Debes iniciar sesión" });
  next();
}

// ===============================================
// 🌐 API REST - Pedidos y Restaurantes
// ===============================================

// Lista de restaurantes
app.get("/api/restaurantes", (req, res) => res.json(restaurantes));

// Crear una orden
app.post("/api/ordenes", async (req, res) => {
  try {
    const { nombre, direccion, restauranteId, pedido, scheduleDate, scheduleSlot } = req.body;

    if (!nombre || !direccion || !restauranteId || !pedido)
      return res.status(400).json({ success: false, message: "Faltan datos obligatorios" });

    const userResult = await pool.query(
      `INSERT INTO usuarios (nombre, email, direccion, password)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET direccion = EXCLUDED.direccion
       RETURNING id`,
      [nombre, `${nombre.toLowerCase().replace(/\s+/g, "")}@correo.com`, direccion, "autogen"]
    );

    const usuarioId = userResult.rows[0].id;
    const restResult = await pool.query(`SELECT id FROM restaurantes WHERE slug = $1`, [restauranteId]);
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

    res.status(201).json({ success: true, message: "Orden registrada", orderId: orderResult.rows[0].id });
  } catch (err) {
    console.error("🔥 Error en /api/ordenes:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ver todas las órdenes
app.get("/api/ordenes", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.id, o.nombre, o.direccion, o.pedido, o.fecha,
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


