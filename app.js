// Importar dependencias
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config(); // Cargar variables de entorno desde un archivo .env

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración de CORS
const allowedOrigins = ['https://admintechflow.com/']; // Reemplaza con tu dominio frontend
app.use(cors({
    origin: allowedOrigins,
    optionsSuccessStatus: 200
}));

// Servir archivos estáticos desde la carpeta 'uploads'
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuración de multer para subir imágenes
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads'); // Carpeta donde se guardarán las imágenes
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname)); // Guardar con un nombre único
    }
});
const upload = multer({ storage: storage });

// Configuración de la base de datos MySQL en Hostinger
const db = mysql.createConnection({
    host: process.env.DB_HOST, // 'srv1526.hstgr.io'
    user: process.env.DB_USER, // 'u498125654_adminflow'
    password: process.env.DB_PASSWORD, // '@ttom2121S'
    database: process.env.DB_NAME, // 'u498125654_adminflow'
    port: process.env.DB_PORT || 3306
});

// Conexión a la base de datos
db.connect((err) => {
    if (err) {
        console.error("Error al conectar con la base de datos:", err.message);
        process.exit(1); // Terminar el proceso si no se puede conectar
    } else {
        console.log("Conectado a la base de datos MySQL en Hostinger");

        // Crear tabla de usuarios si no existe
        const usersTable = `CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL
        )`;
        db.query(usersTable, (createErr) => {
            if (createErr) {
                console.error("Error al crear la tabla de usuarios:", createErr.message);
            } else {
                // Verificar si el usuario "admin" ya existe antes de insertarlo
                const hashedPassword = bcrypt.hashSync("admin123", 10);
                db.query(`SELECT * FROM users WHERE username = ?`, ["admin"], (err, result) => {
                    if (err) {
                        console.error("Error al verificar el usuario administrador:", err.message);
                    } else if (result.length === 0) {
                        db.query(`INSERT INTO users (username, password) VALUES (?, ?)`, ["admin", hashedPassword], (insertErr) => {
                            if (insertErr) {
                                console.error("Error al insertar el usuario administrador:", insertErr.message);
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

        // Crear tabla de productos si no existe
        const productsTable = `CREATE TABLE IF NOT EXISTS products (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            serves INT NOT NULL,
            description TEXT NOT NULL,
            price DECIMAL(10, 2) NOT NULL,
            image VARCHAR(255) NOT NULL
        )`;
        db.query(productsTable, (err) => {
            if (err) console.error("Error al crear la tabla de productos:", err.message);
            else console.log("Tabla de productos verificada/creada.");
        });
    }
});

// Ruta de inicio de sesión
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Validar que se hayan recibido ambos campos
    if (!username || !password) {
        return res.status(400).json({ message: "Faltan campos de usuario o contraseña." });
    }

    // Consulta para obtener el usuario
    db.query(`SELECT * FROM users WHERE username = ?`, [username], (err, results) => {
        if (err) {
            console.error("Error en la consulta SQL:", err);
            return res.status(500).json({ message: "Error de servidor", error: err.message });
        }

        if (results.length === 0) {
            return res.status(400).json({ message: "Usuario no encontrado" });
        }

        const user = results[0];

        // Verificar la contraseña
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error("Error al comparar contraseñas:", err);
                return res.status(500).json({ message: "Error de servidor", error: err.message });
            }

            if (!isMatch) {
                return res.status(400).json({ message: "Contraseña incorrecta" });
            }

            // Opcional: Generar un token JWT para manejar sesiones
            // Aquí solo respondemos con un mensaje de éxito
            res.json({ message: "Inicio de sesión correcto" });
        });
    });
});

// Ruta para cambiar la contraseña
app.post('/change-password', (req, res) => {
    const { username, currentPassword, newPassword } = req.body;

    // Validar que se hayan recibido todos los campos
    if (!username || !currentPassword || !newPassword) {
        return res.status(400).json({ message: "Faltan campos necesarios para cambiar la contraseña." });
    }

    // Obtener el usuario
    db.query(`SELECT * FROM users WHERE username = ?`, [username], (err, results) => {
        if (err) {
            console.error("Error en la consulta SQL:", err);
            return res.status(500).json({ message: "Error de servidor", error: err.message });
        }

        if (results.length === 0) {
            return res.status(400).json({ message: "Usuario no encontrado" });
        }

        const user = results[0];

        // Verificar la contraseña actual
        bcrypt.compare(currentPassword, user.password, (err, isMatch) => {
            if (err) {
                console.error("Error al comparar contraseñas:", err);
                return res.status(500).json({ message: "Error de servidor", error: err.message });
            }

            if (!isMatch) {
                return res.status(400).json({ message: "Contraseña actual incorrecta" });
            }

            // Encriptar la nueva contraseña
            bcrypt.hash(newPassword, 10, (err, hashedNewPassword) => {
                if (err) {
                    console.error("Error al encriptar la nueva contraseña:", err);
                    return res.status(500).json({ message: "Error de servidor", error: err.message });
                }

                // Actualizar la contraseña en la base de datos
                db.query(`UPDATE users SET password = ? WHERE username = ?`, [hashedNewPassword, username], (updateErr) => {
                    if (updateErr) {
                        console.error("Error al actualizar la contraseña:", updateErr);
                        return res.status(500).json({ message: "Error al actualizar la contraseña", error: updateErr.message });
                    }

                    res.json({ message: "Contraseña cambiada correctamente" });
                });
            });
        });
    });
});

// Ruta para agregar un producto (subida de imagen)
app.post('/add-product', upload.single('productImage'), (req, res) => {
    const { name, serves, description, price } = req.body;

    // Validar que se hayan recibido todos los campos
    if (!name || !serves || !description || !price || !req.file) {
        return res.status(400).json({ message: 'Faltan campos para agregar el producto.' });
    }

    const image = req.file.filename;
    const sql = 'INSERT INTO products (name, serves, description, price, image) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [name, serves, description, price, image], (err, result) => {
        if (err) {
            console.error("Error al agregar el producto:", err);
            return res.status(500).json({ message: 'Error al agregar el producto.', error: err.message });
        }
        res.status(201).json({ id: result.insertId, message: 'Producto agregado exitosamente.' });
    });
});

// Ruta para obtener todos los productos
app.get('/products', (req, res) => {
    db.query('SELECT * FROM products', (err, rows) => {
        if (err) {
            console.error("Error al obtener productos:", err);
            return res.status(500).json({ message: 'Error al obtener productos.', error: err.message });
        }
        res.json(rows);
    });
});

// Ruta para editar un producto
app.put('/edit-product/:id', upload.single('productImage'), (req, res) => {
    const { id } = req.params;
    const { name, serves, description, price } = req.body;
    const image = req.file ? req.file.filename : null;

    // Validar que se hayan recibido los campos necesarios
    if (!name || !serves || !description || !price) {
        return res.status(400).json({ message: 'Faltan campos para editar el producto.' });
    }

    let sql = 'UPDATE products SET name = ?, serves = ?, description = ?, price = ?';
    const params = [name, serves, description, price];

    if (image) {
        sql += ', image = ?';
        params.push(image);
    }

    sql += ' WHERE id = ?';
    params.push(id);

    db.query(sql, params, (err) => {
        if (err) {
            console.error("Error al actualizar el producto:", err);
            return res.status(500).json({ message: 'Error al actualizar el producto.', error: err.message });
        }
        res.json({ message: 'Producto actualizado exitosamente.' });
    });
});

// Ruta para eliminar un producto
app.delete('/delete-product/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM products WHERE id = ?';
    db.query(sql, [id], (err) => {
        if (err) {
            console.error("Error al eliminar el producto:", err);
            return res.status(500).json({ message: 'Error al eliminar el producto.', error: err.message });
        }
        res.json({ message: 'Producto eliminado exitosamente.' });
    });
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
