const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use('/uploads', express.static('uploads')); // Servir archivos estáticos desde la carpeta 'uploads'

// Configuración de la base de datos MySQL en Hostinger
const db = mysql.createConnection({
    host: 'srv1526.hstgr.io',  // Reemplaza con tu host remoto
    user: 'u498125654_adminflow',  // Reemplaza con el usuario de tu base de datos
    password: '@ttom2121S',  // Reemplaza con la contraseña de tu base de datos
    database: 'u498125654_adminflow'  // Reemplaza con el nombre de tu base de datos
});

// Conexión a la base de datos
db.connect((err) => {
    if (err) {
        console.error("Error al conectar con la base de datos:", err.message);
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
                    if (result.length === 0) {
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
    db.query(`SELECT * FROM users WHERE username = ?`, [username], (err, results) => {
        if (err) return res.status(500).json({ message: "Error de servidor" });
        if (results.length === 0) return res.status(400).json({ message: "Usuario no encontrado" });

        const user = results[0];
        const isPasswordValid = bcrypt.compareSync(password, user.password);
        if (!isPasswordValid) return res.status(400).json({ message: "Contraseña incorrecta" });

        res.json({ message: "Inicio de sesión correcto" });
    });
});

// Ruta para cambiar la contraseña
app.post('/change-password', (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    db.query(`SELECT * FROM users WHERE username = ?`, [username], (err, results) => {
        if (err) return res.status(500).json({ message: "Error de servidor" });
        if (results.length === 0) return res.status(400).json({ message: "Usuario no encontrado" });

        const user = results[0];
        const isPasswordValid = bcrypt.compareSync(currentPassword, user.password);
        if (!isPasswordValid) return res.status(400).json({ message: "Contraseña actual incorrecta" });

        const hashedNewPassword = bcrypt.hashSync(newPassword, 10);
        db.query(`UPDATE users SET password = ? WHERE username = ?`, [hashedNewPassword, username], (updateErr) => {
            if (updateErr) return res.status(500).json({ message: "Error al actualizar la contraseña" });
            res.json({ message: "Contraseña cambiada correctamente" });
        });
    });
});

// Crear la tabla de productos si no existe
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
});

// Ruta para agregar un producto (subida de imagen)
app.post('/add-product', upload.single('productImage'), (req, res) => {
    const { name, serves, description, price } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No se ha subido ninguna imagen.' });

    const image = req.file.filename;
    const sql = 'INSERT INTO products (name, serves, description, price, image) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [name, serves, description, price, image], (err, result) => {
        if (err) return res.status(500).json({ message: 'Error al agregar el producto.', error: err.message });
        res.status(201).json({ id: result.insertId, message: 'Producto agregado exitosamente.' });
    });
});

// Ruta para obtener todos los productos
app.get('/products', (req, res) => {
    db.query('SELECT * FROM products', (err, rows) => {
        if (err) return res.status(400).json({ message: 'Error al obtener productos.' });
        res.json(rows);
    });
});

// Ruta para editar un producto
app.put('/edit-product/:id', upload.single('productImage'), (req, res) => {
    const { id } = req.params;
    const { name, serves, description, price } = req.body;
    const image = req.file ? req.file.filename : null;

    let sql = 'UPDATE products SET name = ?, serves = ?, description = ?, price = ?';
    const params = [name, serves, description, price];

    if (image) {
        sql += ', image = ?';
        params.push(image);
    }

    sql += ' WHERE id = ?';
    params.push(id);

    db.query(sql, params, (err) => {
        if (err) return res.status(500).json({ message: 'Error al actualizar el producto.', error: err.message });
        res.json({ message: 'Producto actualizado exitosamente.' });
    });
});

// Ruta para eliminar un producto
app.delete('/delete-product/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM products WHERE id = ?';
    db.query(sql, [id], (err) => {
        if (err) return res.status(500).json({ message: 'Error al eliminar el producto.', error: err.message });
        res.json({ message: 'Producto eliminado exitosamente.' });
    });
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
