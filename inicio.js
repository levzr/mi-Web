import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index", {
    title: "Carnitas Del Anillo",
    dishes: [
      {
        name: "Carne de Cerdo con Pollo",
        desc: "Acompañado de ensalada, encurtido, queso, frijoles y 3 tortillas.",
        price: 178,
        oldPrice: null,
        stars: 4.6,
        discount: null,
        img: "https://i.imgur.com/hzZZLZN.png"
      },
      {
        name: "Carne de Cerdo Doble con Chorizo",
        desc: "Acompañado de ensalada, encurtido, queso, frijoles y 3 tortillas.",
        price: 190,
        oldPrice: 238,
        stars: 4.6,
        discount: "20% OFF",
        img: "https://i.imgur.com/b4Vb8vG.png"
      },
      {
        name: "Carne de Cerdo con Costilla",
        desc: "Acompañado de ensalada, encurtido, queso, frijoles y 3 tortillas.",
        price: 178,
        oldPrice: null,
        stars: 4.6,
        discount: null,
        img: "https://i.imgur.com/AfLkY7h.png"
      },
      {
        name: "Carne de Cerdo con Chuleta",
        desc: "Acompañado de ensalada, encurtido, queso, frijoles y 3 tortillas.",
        price: 175,
        oldPrice: 219,
        stars: 4.6,
        discount: "20% OFF",
        img: "https://i.imgur.com/b4Vb8vG.png"
      }
    ]
  });
});

app.listen(PORT, () =>
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`)
);
