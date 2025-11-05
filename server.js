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

// Variables globales disponibles en todas las vistas
app.use((req, res, next) => {
  res.locals.siteName = "PedidosHN";
  res.locals.currentYear = new Date().getFullYear();
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
// Ruta principal
// ===============================================
app.get("/", (req, res) => {
  res.render("home", { ...res.locals, restaurantes });
});

// ===============================================
// Página de restaurante individual
// ===============================================
app.get("/restaurantes/:slug", (req, res) => {
  const restaurante = restaurantes.find((r) => r.id === req.params.slug);
  if (!restaurante) {
    return res.status(404).render("error", {
      ...res.locals,
      mensaje: "Restaurante no encontrado",
    });
  }
  res.render("restaurantes", { ...res.locals, restaurante });
});

// ===============================================
// Página de checkout
// ===============================================
app.get("/checkout", (req, res) => {
  const { restaurante, plato, precio } = req.query;
  res.render("checkout", { ...res.locals, restaurante, plato, precio });
});

// ===============================================
// 🔥 Procesar pedido (POST /checkout)
// ===============================================
app.post("/checkout", async (req, res) => {
  try {
    const { nombre, direccion, restauranteId, pedido, scheduleDate, scheduleSlot } = req.body;

    // 1️⃣ Crear o buscar usuario
    const userResult = await pool.query(
      `INSERT INTO usuarios (nombre, email, direccion)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET direccion = EXCLUDED.direccion
       RETURNING id`,
      [nombre, `${nombre.toLowerCase()}@correo.com`, direccion]
    );

    const usuarioId = userResult.rows[0].id;

    // 2️⃣ Buscar ID del restaurante por slug
    const restResult = await pool.query(
      `SELECT id FROM restaurantes WHERE slug = $1`,
      [restauranteId]
    );

    const restaurante_id = restResult.rows.length > 0 ? restResult.rows[0].id : null;

    // 3️⃣ Insertar orden
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

    // 4️⃣ Buscar plato y agregar detalle de la orden
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

    // 5️⃣ Mostrar página de éxito
    res.render("success", {
      ...res.locals,
      nombre,
      direccion,
      pedido,
      scheduleDate,
      scheduleSlot,
      fecha: new Date().toISOString(),
    });

  } catch (err) {
    console.error("🔥 Error procesando pedido:", err);
    res.status(500).render("error", {
      ...res.locals,
      mensaje: "Error interno al procesar el pedido",
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
