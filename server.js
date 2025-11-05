// ======================================================
// 🧠 PedidosHN - Servidor Express + EJS + PostgreSQL
// Descripción: Backend principal de pedidos o entregas para restaurantes
// Puerto: 3000
// ======================================================

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";
import { pool } from "./db.js"; // <-- Conexión a PostgreSQL

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ======================================================
// 📁 RUTAS DE ARCHIVOS
// ======================================================
const DATA_PATH = path.join(__dirname, "data");
const REST_PATH = path.join(DATA_PATH, "restaurantes.json");

// ======================================================
// ⚙️ CONFIGURACIÓN BASE
// ======================================================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// --- Middleware Base ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan("dev"));

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(compression());

// 🔧 Archivos estáticos (CSS, JS, imágenes)
app.use(express.static(path.join(__dirname, "public")));

// Variables globales accesibles desde EJS
app.use((req, res, next) => {
  res.locals.siteName = "PedidosHN";
  res.locals.currentYear = new Date().getFullYear();
  next();
});

// ======================================================
// 🌐 RUTAS PRINCIPALES
// ======================================================

// 🏠 Página principal
app.get("/", async (req, res) => {
  // Por ahora restaurantes desde JSON
  const restaurantes = JSON.parse(await import(REST_PATH, { assert: { type: "json" } }).then(m => m.default));
  res.render("home", { restaurantes });
});

// 🍴 Lista de restaurantes
app.get("/restaurantes", async (req, res) => {
  const restaurantes = JSON.parse(await import(REST_PATH, { assert: { type: "json" } }).then(m => m.default));
  res.render("restaurantes", { restaurantes });
});

// 📋 Carta individual
app.get("/restaurantes/:id", async (req, res) => {
  try {
    const restaurantes = JSON.parse(await import(REST_PATH, { assert: { type: "json" } }).then(m => m.default));
    const restaurante = restaurantes.find(r => String(r.id) === req.params.id);

    if (!restaurante) {
      return res.status(404).render("error", {
        title: "Restaurante no encontrado",
        message: "El restaurante que buscas no existe o fue eliminado.",
      });
    }

    restaurante.menu = restaurante.platos || [];

    res.render("carta", { restaurante });
  } catch (error) {
    console.error("🔥 Error al cargar restaurante:", error);
    res.status(500).render("error", {
      title: "Error del servidor",
      message: "Ocurrió un error inesperado. Intenta más tarde.",
    });
  }
});

// 🧾 Formulario de checkout
app.get("/checkout", (req, res) => {
  const { restaurante, plato, precio } = req.query;
  res.render("checkout", { restaurante, plato, precio });
});

// ✅ Procesar pedido usando PostgreSQL
app.post("/checkout", async (req, res) => {
  try {
    const { nombre, direccion, restauranteId, pedido, scheduleDate, scheduleSlot } = req.body;

    if (!nombre || !direccion || !restauranteId || !pedido) {
      return res.status(400).render("error", {
        title: "Error en el pedido",
        message: "Faltan campos obligatorios. Por favor, completa todos los datos.",
      });
    }

    const query = `
      INSERT INTO ordenes(nombre, direccion, restaurante_id, pedido, fecha, schedule_date, schedule_slot)
      VALUES($1,$2,$3,$4,$5,$6,$7)
      RETURNING *;
    `;

    const values = [
      nombre.trim(),
      direccion.trim(),
      restauranteId,
      pedido,
      new Date(),
      scheduleDate || "Hoy",
      scheduleSlot || "Inmediato"
    ];

    const result = await pool.query(query, values);
    const nuevaOrden = result.rows[0];

    res.render("success", { orden: nuevaOrden });

  } catch (error) {
    console.error("🔥 Error procesando pedido:", error);
    res.status(500).render("error", {
      title: "Error del servidor",
      message: "Ocurrió un error al procesar tu pedido.",
    });
  }
});

// ======================================================
// 📡 API REST
// ======================================================
app.get("/api/restaurantes", async (req, res) => {
  try {
    const restaurantes = JSON.parse(await import(REST_PATH, { assert: { type: "json" } }).then(m => m.default));
    res.json(restaurantes);
  } catch (err) {
    console.error("🔥 Error obteniendo restaurantes:", err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get("/api/ordenes", async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ordenes ORDER BY fecha DESC;');
    res.json(result.rows);
  } catch (err) {
    console.error("🔥 Error obteniendo ordenes:", err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ======================================================
// ❌ MANEJO DE ERRORES
// ======================================================
app.use((req, res) => {
  res.status(404).render("error", {
    title: "404 - Página no encontrada",
    message: "La página que intentas visitar no existe.",
  });
});

app.use((err, req, res, next) => {
  console.error("🔥 Error interno:", err);
  res.status(500).render("error", {
    title: "Error del servidor",
    message: "Ocurrió un error inesperado. Intenta más tarde.",
  });
});

// ======================================================
// 🚀 INICIO DEL SERVIDOR
// ======================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log("===================================================");
  console.log(`🚀 PedidosHN corriendo en: http://0.0.0.0:${PORT}`);
  console.log("===================================================");
});
