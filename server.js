// ===============================================
// 🚀 PedidosHN - Servidor Principal
// ===============================================

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import { pool } from "./db.js";
import fs from "fs";

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

// Variable global disponible en todas las vistas
app.use((req, res, next) => {
  res.locals.siteName = "PedidosHN"; // 👈 Nombre del sitio
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
// Rutas HTML (frontend con EJS)
// ===============================================
app.get("/", (req, res) => {
  res.render("home", { restaurantes });
});

app.get("/restaurantes/:slug", (req, res) => {
  const restaurante = restaurantes.find((r) => r.id === req.params.slug);
  if (!restaurante) {
    return res.status(404).render("error", { mensaje: "Restaurante no encontrado" });
  }
  res.render("restaurantes", { restaurante });
});

app.get("/checkout", (req, res) => {
  const { restaurante, plato, precio } = req.query;
  res.render("checkout", { restaurante, plato, precio });
});

app.post("/checkout", async (req, res) => {
  try {
    const { nombre, direccion, restauranteId, pedido, scheduleDate, scheduleSlot } = req.body;

    // Crear o buscar usuario
    const userResult = await pool.query(
      `INSERT INTO usuarios (nombre, email, direccion)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET direccion = EXCLUDED.direccion
       RETURNING id`,
      [nombre, `${nombre.toLowerCase()}@correo.com`, direccion]
    );

    const usuarioId = userResult.rows[0].id;

    // Buscar ID del restaurante
    const restResult = await pool.query(
      `SELECT id FROM restaurantes WHERE slug = $1`,
      [restauranteId]
    );

    const restaurante_id = restResult.rows.length > 0 ? restResult.rows[0].id : null;

    // Crear la orden
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
        scheduleSlot || "Inmediato"
      ]
    );

    const ordenId = orderResult.rows[0].id;

    // Buscar el plato
    const platoResult = await pool.query(
      `SELECT id, precio FROM platos WHERE nombre = $1 LIMIT 1`,
      [pedido]
    );

    if (platoResult.rows.length > 0) {
      const plato = platoResult.rows[0];
      await pool.query(
        `INSERT INTO detalles_orden (orden_id, plato_id, cantidad, subtotal)
         VALUES ($1,$2,$3,$4)`,
        [ordenId, plato.id, 1, plato.precio]
      );
    }

    // Render de éxito
    res.render("success", {
      nombre,
      direccion,
      pedido,
      scheduleDate,
      scheduleSlot,
      fecha: new Date().toISOString(),
      restaurante: restauranteId,
      restaurante_slug: restauranteId
    });

  } catch (err) {
    console.error("🔥 Error procesando pedido:", err);
    res.status(500).render("error", { mensaje: "Error interno al procesar el pedido" });
  }
});

// ===============================================
// 🌐 API REST - Endpoints para Postman / Fetch
// ===============================================

// Obtener lista de restaurantes
app.get("/api/restaurantes", (req, res) => {
  res.json(restaurantes);
});

// Crear una nueva orden (API REST)
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
        scheduleSlot || "Inmediato"
      ]
    );

    res.status(201).json({
      success: true,
      message: "Orden registrada exitosamente",
      orderId: orderResult.rows[0].id
    });
  } catch (err) {
    console.error("🔥 Error en API /api/ordenes:", err);
    res.status(500).json({
      success: false,
      error: "Error interno al procesar el pedido"
    });
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
