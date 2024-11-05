const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use('/uploads', express.static('uploads')); // Servir archivos estáticos desde la carpeta 'uploads'

// Configurar la base de datos
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error("Error al conectar con la base de datos", err.message);
    } else {
        console.log("Conectado a la base de datos SQLite");

        // Crear tabla de usuarios si no existe
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        )`, (createErr) => {
            if (createErr) {
                console.error("Error al crear la tabla de usuarios:", createErr.message);
            } else {
                // Verificar si el usuario ya existe antes de insertarlo
                const hashedPassword = bcrypt.hashSync("admin123", 10);
                db.get(`SELECT * FROM users WHERE username = ?`, ["admin"], (err, row) => {
                    if (!row) {
                        db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, ["admin", hashedPassword], (insertErr) => {
                            if (insertErr) {
                                console.error("Error al insertar el usuario:", insertErr.message);
                            } else {
                                console.log("Usuario administrador creado exitosamente.");
                            }
                        });
                    } else {
                        console.log("Usuario administrador ya existe.");
                    }
                });
            }
        });
    }
});

// Configuración de multer para subir imágenes
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads'); // Carpeta donde se guardarán las imágenes
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); // Guardar con el nombre original del archivo
    }
});

const upload = multer({ storage: storage });

// Ruta de inicio de sesión
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err) {
            return res.status(500).json({ message: "Error de servidor" });
        }
        if (!user) {
            return res.status(400).json({ message: "Usuario no encontrado" });
        }

        // Verificar la contraseña
        const isPasswordValid = bcrypt.compareSync(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Contraseña incorrecta" });
        }

        res.json({ message: "Inicio de sesión correcto" });
    });
});

// Rutas para cambiar la contraseña
app.post('/change-password', (req, res) => {
    const { username, currentPassword, newPassword } = req.body;

    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err) {
            return res.status(500).json({ message: "Error de servidor" });
        }
        if (!user) {
            return res.status(400).json({ message: "Usuario no encontrado" });
        }

        // Verificar la contraseña actual
        const isPasswordValid = bcrypt.compareSync(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Contraseña actual incorrecta" });
        }

        // Actualizar la contraseña
        const hashedNewPassword = bcrypt.hashSync(newPassword, 10);
        db.run(`UPDATE users SET password = ? WHERE username = ?`, [hashedNewPassword, username], function(updateErr) {
            if (updateErr) {
                return res.status(500).json({ message: "Error al actualizar la contraseña" });
            }
            res.json({ message: "Contraseña cambiada correctamente" });
        });
    });
});

// Crear la tabla de productos si no existe
db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    serves INTEGER NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    image TEXT NOT NULL
)`);

// Ruta para agregar un producto (cargar imagen)
app.post('/add-product', upload.single('productImage'), (req, res) => {
    const { name, serves, description, price } = req.body;

    // Verifica si se ha subido un archivo
    if (!req.file) {
        return res.status(400).json({ message: 'No se ha subido ninguna imagen.' });
    }

    const image = req.file.filename; // Nombre del archivo subido
    const sql = 'INSERT INTO products (name, serves, description, price, image) VALUES (?, ?, ?, ?, ?)';

    db.run(sql, [name, serves, description, price, image], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Error al agregar el producto.', error: err.message });
        }
        res.status(201).json({ id: this.lastID, message: 'Producto agregado exitosamente.' });
    });
});

// Ruta para obtener todos los productos
app.get('/products', (req, res) => {
    db.all('SELECT * FROM products', [], (err, rows) => {
        if (err) {
            return res.status(400).json({ message: 'Error al obtener productos.' });
        }
        res.json(rows);
    });
});

// Ruta para editar un producto
app.put('/edit-product/:id', upload.single('productImage'), (req, res) => {
    const { id } = req.params;
    const { name, serves, description, price } = req.body;
    const image = req.file ? req.file.filename : null;

    // Construir el query dinámico
    let sql = 'UPDATE products SET name = ?, serves = ?, description = ?, price = ?';
    const params = [name, serves, description, price];

    if (image) {
        sql += ', image = ?';
        params.push(image);
    }

    sql += ' WHERE id = ?';
    params.push(id);

    db.run(sql, params, function(err) {
        if (err) {
            return res.status(500).json({ message: 'Error al actualizar el producto.', error: err.message });
        }
        res.json({ message: 'Producto actualizado exitosamente.' });
    });
});

// Ruta para eliminar un producto
app.delete('/delete-product/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM products WHERE id = ?';

    db.run(sql, [id], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Error al eliminar el producto.', error: err.message });
        }
        res.json({ message: 'Producto eliminado exitosamente.' });
    });
});

// Iniciar el servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
