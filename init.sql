-- ============================================================
-- 🚀 PedidosHN - Inicialización de Base de Datos
-- Autor: Victor Escobar
-- Fecha: 2025-11-05
-- ============================================================

DROP TABLE IF EXISTS detalles_orden CASCADE;
DROP TABLE IF EXISTS ordenes CASCADE;
DROP TABLE IF EXISTS platos CASCADE;
DROP TABLE IF EXISTS restaurantes CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    direccion TEXT
);

CREATE TABLE restaurantes (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    categoria VARCHAR(100),
    rating DECIMAL(2,1),
    tiempo VARCHAR(50),
    imagen VARCHAR(255)
);

INSERT INTO restaurantes (slug, nombre, categoria, rating, tiempo, imagen) VALUES
('hacienda-real', 'Hacienda Real Honduras', 'Parrilladas / Gourmet', 4.8, '30-45 min', '/imgs/haciendareal.jpg'),
('la-cumbre', 'La Cumbre', 'Gourmet / Vista panorámica', 4.7, '40-55 min', '/imgs/cumbre.jpg'),
('the-market', 'The Market (Tegucigalpa)', 'Internacional / Italiana', 4.6, '25-40 min', '/imgs/market.jpg');

CREATE TABLE platos (
    id SERIAL PRIMARY KEY,
    restaurante_id INT REFERENCES restaurantes(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL,
    imagen VARCHAR(255)
);

INSERT INTO platos (restaurante_id, nombre, descripcion, precio, imagen) VALUES
(1, 'Parrillada Mixta', 'Selección de res, pollo y chorizo servidos con frijoles, plátano frito y tortillas calientes.', 480, '/imgs/parrilla.jpg'),
(1, 'Filete Jalapeño', 'Corte de res con salsa cremosa de jalapeño, acompañado de puré y ensalada fresca.', 420, '/imgs/filete.jpg'),
(1, 'Tacos Real', 'Taco de carne de res servida con su encurtido, limón y cebolla.', 380, '/imgs/tacos.jpg'),
(2, 'Filete en salsa de vino tinto', 'Corte de res con reducción de vino tinto, puré y vegetales.', 450, '/imgs/filete-vino.jpg'),
(2, 'Camarones al coco', 'Camarones empanizados en coco con salsa de piña y arroz jazmín.', 390, '/imgs/camarones-coco.jpg'),
(3, 'Pizza Margarita', 'Pizza italiana con mozzarella fresca, tomate y albahaca.', 290, '/imgs/pizza-margarita.jpg'),
(3, 'Pasta Carbonara', 'Espaguetis con salsa cremosa de huevo, queso parmesano y tocino.', 310, '/imgs/pasta-carbonara.jpg');

CREATE TABLE ordenes (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES usuarios(id),
    nombre VARCHAR(100) NOT NULL,
    direccion TEXT NOT NULL,
    restaurante_id INT REFERENCES restaurantes(id),
    restaurante_slug VARCHAR(50),
    pedido TEXT NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    schedule_date VARCHAR(50),
    schedule_slot VARCHAR(50)
);

CREATE TABLE detalles_orden (
    id SERIAL PRIMARY KEY,
    orden_id INT REFERENCES ordenes(id) ON DELETE CASCADE,
    plato_id INT REFERENCES platos(id) ON DELETE CASCADE,
    cantidad INT DEFAULT 1,
    subtotal DECIMAL(10,2)
);

CREATE VIEW vista_pedidos AS
SELECT
  o.id AS id_orden,
  o.nombre AS cliente,
  o.direccion,
  r.nombre AS restaurante,
  o.pedido,
  o.fecha
FROM ordenes o
LEFT JOIN restaurantes r ON o.restaurante_slug = r.slug;

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================

