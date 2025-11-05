// ======================================================
// 🧠 PedidosHN - Servidor Express + EJS
// Descripción: Backend principal de pedidos o entregas para restaurantes
// Puerto: 3000
// ======================================================

import express from "express";
import path from "path";
import fs from "fs-extra";
import { fileURLToPath } from "url";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ======================================================
// 📁 RUTAS DE ARCHIVOS
// ======================================================
const DATA_PATH = path.join(__dirname, "data");
const REST_PATH = path.join(DATA_PATH, "restaurantes.json");
const ORD_PATH = path.join(DATA_PATH, "ordenes.json");

// ======================================================
// ⚙️ CONFIGURACIÓN BASE
// ======================================================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// --- Middleware Base ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan("dev"));

// ⚙️ Helmet configurado correctamente (sin bloquear CSS o imágenes locales)
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
// 🔧 FUNCIONES AUXILIARES
// ======================================================
const loadJSON = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error(`❌ Error leyendo ${filePath}:`, err.message);
    return [];
  }
};

const saveJSON = async (filePath, data) => {
  try {
    await fs.writeJson(filePath, data, { spaces: 2 });
  } catch (err) {
    console.error(`❌ Error guardando ${filePath}:`, err.message);
  }
};

// ======================================================
// 🌐 RUTAS PRINCIPALES
// ======================================================

// 🏠 Página principal
app.get("/", (req, res) => {
  const restaurantes = loadJSON(REST_PATH);
  res.render("home", { restaurantes });
});

// 🍴 Lista de restaurantes
app.get("/restaurantes", (req, res) => {
  const restaurantes = loadJSON(REST_PATH);
  res.render("restaurantes", { restaurantes });
});

// 📋 Carta individual
app.get("/restaurantes/:id", (req, res) => {
  try {
    const restaurantes = loadJSON(REST_PATH);
    const restaurante = restaurantes.find(r => String(r.id) === req.params.id);

    if (!restaurante) {
      return res.status(404).render("error", {
        title: "Restaurante no encontrado",
        message: "El restaurante que buscas no existe o fue eliminado.",
      });
    }

    // Asegurar compatibilidad: si usas "platos" en el JSON
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


// ✅ Procesar pedido
app.post("/checkout", async (req, res) => {
  try {
    const { nombre, direccion, restauranteId, pedido, scheduleDate, scheduleSlot } = req.body;

    if (!nombre || !direccion || !restauranteId || !pedido) {
      return res.status(400).render("error", {
        title: "Error en el pedido",
        message: "Faltan campos obligatorios. Por favor, completa todos los datos.",
      });
    }

    const ordenes = loadJSON(ORD_PATH);
    const nuevaOrden = {
      id: `ORD-${Date.now()}`,
      nombre: nombre.trim(),
      direccion: direccion.trim(),
      restauranteId,
      pedido,
      fecha: new Date().toLocaleString("es-HN"),
      scheduleDate: scheduleDate || "Hoy",
      scheduleSlot: scheduleSlot || "Inmediato",
    };

    ordenes.push(nuevaOrden);
    await saveJSON(ORD_PATH, ordenes);

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
app.get("/api/restaurantes", (req, res) => res.json(loadJSON(REST_PATH)));
app.get("/api/ordenes", (req, res) => res.json(loadJSON(ORD_PATH)));

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
