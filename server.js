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
import methodOverride from 'method-override';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const PgSession = pgSession(session);

// ===============================================
// Configuración del servidor
// ===============================================
app.use(methodOverride('_method'));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

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

app.use((req, res, next) => {
  res.locals.siteName = "PedidosHN";
  res.locals.currentYear = new Date().getFullYear();
  res.locals.user = req.session.user || null;
  next();
});

// Middleware administrador
function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.es_admin) {
    return next();
  }
  return res.status(403).json({ success: false, error: "Solo administradores" });
}

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
    return res.status(404).render("error", { mensaje: "Restaurante no encontrado" });
  res.render("restaurantes", { restaurante });
});

// Ruta checkout
app.get("/checkout", (req, res) => {
  const { restaurante, plato, precio } = req.query;
  res.render("checkout", { restaurante, plato, precio });
});

// Ruta confirma el pedido
app.post("/checkout", async (req, res) => {
  try {
    const { nombre, direccion, restauranteId, pedido, scheduleDate, scheduleSlot, precio } = req.body;

    // 1. Validaciones básicas de formulario
    if (!nombre || !direccion || !pedido || !restauranteId || !scheduleDate || !scheduleSlot) {
      return res.status(400).render("checkout", {
        restaurante: restauranteId,
        plato: pedido,
        precio: precio || "0",
        error: "Todos los campos son obligatorios",
      });
    }

    // 2. Determinar usuario_id
    let usuarioId = null;
    if (req.session.user) {
      usuarioId = req.session.user.id;
    } else {
      const userResult = await pool.query(
        `INSERT INTO usuarios (nombre, email, direccion)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET direccion = EXCLUDED.direccion
         RETURNING id`,
        [nombre, `${nombre.toLowerCase()}@correo.com`, direccion]
      );
      usuarioId = userResult.rows[0].id;
    }

    // 3. Buscar restaurante por slug
    const restResult = await pool.query(
      `SELECT id FROM restaurantes WHERE slug = $1`,
      [restauranteId]
    );
    const restaurante_id = restResult.rows.length > 0 ? restResult.rows[0].id : null;

    // 4. Insertar la orden
    await pool.query(
      `INSERT INTO ordenes 
   (usuario_id, nombre, direccion, restaurante_id, restaurante_slug, pedido, fecha, schedule_date, schedule_slot, estado)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'borrador')`,
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

    // 5. Mostrar a mis pedidos
    res.redirect("/pedidos");
  } catch (error) {
    console.error("Error al procesar el pedido:", error);
    res.status(500).render("checkout", {
      restaurante: req.body.restauranteId,
      plato: req.body.pedido,
      precio: req.body.precio || "0",
      error: "Error al procesar el pedido",
    });
  }
});

app.get('/admin/usuarios', requireAdmin, async (req, res) => {
  const resultado = await pool.query('SELECT id, nombre, email, direccion, es_admin FROM usuarios');
  res.render('admin_usuarios', { users: resultado.rows });
});

app.get("/prueba", (req, res) => {
  res.render("admin_pedidos", { pedidos: [] });
});

// ===============================================
// API: REGISTRO / LOGIN / LOGOUT
// ===============================================

// Registro
app.post("/api/register", async (req, res) => {
  try {
    const { nombre, email, password, direccion } = req.body;
    if (!nombre || !email || !password)
      return res.status(400).render("register", { error: "Faltan campos obligatorios" });
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO usuarios (nombre, email, password, direccion, es_admin)
       VALUES ($1, $2, $3, $4, FALSE)
       ON CONFLICT (email) DO NOTHING`,
      [nombre, email, hashedPassword, direccion || ""]
    );
    res.redirect("/login");
  } catch (err) {
    console.error("⚠️ Error en /api/register:", err);
    res.status(500).render("register", { error: "Error registrando usuario" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);
    const user = result.rows[0];
    if (!user)
      return res.status(401).render("login", { error: "Usuario no encontrado" });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(401).render("login", { error: "Contraseña incorrecta" });
    req.session.user = {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      es_admin: user.es_admin === true || user.es_admin === 't' 
    };
    console.log('Usuario en sesión:', req.session.user);
    res.redirect("/");
  } catch (err) {
    console.error("🔥 Error en /api/login:", err);
    res.status(500).render("login", { error: "Error iniciando sesión" });
  }
});

// Logout GET y POST
app.get("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ success: false, error: "Error cerrando sesión" });
    res.redirect("/login");
  });
});
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ success: false, error: "Error cerrando sesión" });
    res.redirect("/login");
  });
});

// ===============================================
// API DE USUARIOS (SOLO PARA ADMIN)
// ===============================================
app.get('/api/usuarios', requireAdmin, async (req, res) => {
  const result = await pool.query('SELECT id, nombre, email, direccion, es_admin FROM usuarios');
  res.json({ success: true, users: result.rows });
});
app.get('/api/usuarios/:id', requireAdmin, async (req, res) => {
  const result = await pool.query('SELECT id, nombre, email, direccion, es_admin FROM usuarios WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
  res.json({ success: true, user: result.rows[0] });
});
app.put('/api/usuarios/:id', requireAdmin, async (req, res) => {
  const { nombre, direccion } = req.body;
  await pool.query('UPDATE usuarios SET nombre = $1, direccion = $2 WHERE id = $3', [nombre, direccion, req.params.id]);
  res.json({ success: true, message: 'Usuario actualizado' });
});
app.delete('/api/usuarios/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM usuarios WHERE id = $1', [req.params.id]);
  res.redirect('/admin/usuarios');
});
app.put('/api/usuarios/:id/password', requireAdmin, async (req, res) => {
  const { password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  await pool.query('UPDATE usuarios SET password = $1 WHERE id = $2', [hashedPassword, req.params.id]);
  res.json({ success: true, message: 'Contraseña actualizada' });
});

// ===============================================
// RUTAS DE PEDIDOS ADMIN
// ===============================================
app.get("/admin/pedidos", requireAdmin, async (req, res) => {
  const result = await pool.query(`
    SELECT 
      o.id,
      o.nombre,
      o.direccion,
      o.pedido,
      o.fecha,
      o.schedule_date,
      o.schedule_slot,
      o.estado,
      r.nombre AS restaurante
    FROM ordenes o
    LEFT JOIN restaurantes r ON o.restaurante_id = r.id
    ORDER BY o.fecha DESC
  `);

  res.render("admin_pedidos", { pedidos: result.rows });
});


app.post("/admin/pedidos/:id/delete", requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM ordenes WHERE id = $1", [req.params.id]);
  res.redirect("/admin/pedidos");
});

// ===============================================
// RUTAS DE PEDIDOS (USUARIO)
// ===============================================
app.get("/pedidos", async (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const pedidosResult = await pool.query(
    `SELECT 
       o.id,
       o.nombre,
       o.direccion,
       o.fecha,
       o.schedule_date,
       o.schedule_slot,
       o.estado,
       r.nombre AS restaurante_nombre
     FROM ordenes o
     LEFT JOIN restaurantes r ON o.restaurante_id = r.id
     WHERE o.usuario_id = $1
     ORDER BY o.fecha DESC`,
    [req.session.user.id]
  );
  const pedidos = pedidosResult.rows;

  let detallesPorPedido = {};
  let totalesPorPedido = {};

  if (pedidos.length > 0) {
    const ids = pedidos.map(p => p.id);

    const detallesResult = await pool.query(
      `SELECT 
         d.id,
         d.orden_id,
         d.cantidad,
         p.nombre,
         p.precio
       FROM detalles_orden d
       JOIN platos p ON p.id = d.plato_id
       WHERE d.orden_id = ANY($1::int[])`,
      [ids]
    );

    detallesPorPedido = {};
    totalesPorPedido = {};

    for (const d of detallesResult.rows) {
      if (!detallesPorPedido[d.orden_id]) {
        detallesPorPedido[d.orden_id] = [];
        totalesPorPedido[d.orden_id] = 0;
      }
      detallesPorPedido[d.orden_id].push(d);
      totalesPorPedido[d.orden_id] += Number(d.precio) * Number(d.cantidad);
    }
  }

  const platosResult = await pool.query(
    `SELECT id, nombre FROM platos ORDER BY nombre`
  );

  res.render("pedidos", {
    pedidos,
    platos: platosResult.rows,
    detallesPorPedido,
    totalesPorPedido
  });
});


// añadir plato
app.post('/pedidos/:id/agregar', async (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const { platoId, cantidad } = req.body;
  const pedidoId = req.params.id;

  const pedido = await pool.query(
    "SELECT * FROM ordenes WHERE id = $1 AND usuario_id = $2 AND estado = 'borrador'",
    [pedidoId, req.session.user.id]
  );

  if (pedido.rows.length === 0) {
    return res.status(403).send("No puedes editar este pedido");
  }

  await pool.query(
    `INSERT INTO detalles_orden (orden_id, plato_id, cantidad)
     VALUES ($1, $2, $3)`,
    [pedidoId, platoId, cantidad]
  );

  res.redirect("/pedidos");
});

// eliminar plato
app.post('/pedidos/:pedidoId/detalles/:detalleId/eliminar', async (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const { pedidoId, detalleId } = req.params;

  await pool.query(
    `DELETE FROM detalles_orden
     WHERE id = $1
       AND orden_id = $2`,
    [detalleId, pedidoId]
  );

  res.redirect("/pedidos");
});

// confirmar pedido
app.post('/pedidos/:id/confirmar', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const { id } = req.params;

  await pool.query(
    `UPDATE ordenes
     SET estado = 'confirmado'
     WHERE id = $1 AND usuario_id = $2`,
    [id, req.session.user.id]
  )

  res.redirect('/');
});



// ===============================================
// API DE RESTAURANTES Y ÓRDENES
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
// API DE CONTACTOS
// ===============================================
// Crear mensaje de contacto (público)
app.post('/api/contactos', async (req, res) => {
  const { nombre, email, telefono, mensaje } = req.body;
  await pool.query(
    'INSERT INTO contactos (nombre, email, telefono, mensaje) VALUES ($1, $2, $3, $4)',
    [nombre, email, telefono, mensaje]
  );
  res.render('gracias');
});

// Listar todos los mensajes (solo admin)
app.get('/api/contactos', requireAdmin, async (req, res) => {
  const resultado = await pool.query('SELECT * FROM contactos ORDER BY fecha DESC');
  res.json({ success: true, contactos: resultado.rows });
});

// Ver mensaje individual (solo admin)
app.get('/api/contactos/:id', requireAdmin, async (req, res) => {
  const resultado = await pool.query('SELECT * FROM contactos WHERE id = $1', [req.params.id]);
  if (resultado.rows.length === 0)
    return res.status(404).json({ success: false, error: 'No encontrado' });
  res.json({ success: true, contacto: resultado.rows[0] });
});

// Eliminar mensaje (solo admin)
app.delete('/api/contactos/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM contactos WHERE id = $1', [req.params.id]);
  res.redirect('/admin/contactos');
});

app.get('/contacto', (req, res) => {
  res.render('contacto');
});

// Vista de administradores
app.get('/admin/contactos', requireAdmin, async (req, res) => {
  const resultado = await pool.query('SELECT * FROM contactos ORDER BY fecha DESC');
  res.render('admin_contactos', { contactos: resultado.rows });
});

// ===============================================
// Servidor corriendo
// ===============================================
app.listen(PORT, "0.0.0.0", () => {
  console.log("===================================================");
  console.log(`🚀 PedidosHN corriendo en: http://0.0.0.0:${PORT}`);
  console.log("===================================================");
});
