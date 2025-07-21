const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const path = require("path");
const PDFDocument = require("pdfkit-table");

const db = new sqlite3.Database("BD_GPE.db");
const app = express();

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));


db.serialize(() => {
    // Tabla usuario y actividad
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS actividades_usuarios (
        id_actividad INTEGER PRIMARY KEY AUTOINCREMENT,
        id_usuario INTEGER,
        username TEXT,
        tipo_actividad TEXT,
        descripcion TEXT,
        fecha_actividad DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
    )`);

    // Tabla representantes 
    db.run(`CREATE TABLE IF NOT EXISTS representantes (
        id_representante INTEGER PRIMARY KEY,
        primer_nombre TEXT, segundo_nombre TEXT, primer_apellido TEXT, segundo_apellido TEXT,
        cedula TEXT UNIQUE, genero TEXT, telefono TEXT, email TEXT, domicilio TEXT,
        estado TEXT DEFAULT 'Activo',
        cuenta TEXT DEFAULT 'Deuda',
        saldo_abonado REAL DEFAULT 0.00
    )`);
    // Tabla alumnos
    db.run(`CREATE TABLE IF NOT EXISTS alumnos (
        id_alumno INTEGER PRIMARY KEY,
        id_representante INTEGER,
        primer_nombre TEXT, segundo_nombre TEXT, primer_apellido TEXT, segundo_apellido TEXT,
        cedula TEXT, genero TEXT, fecha_nacimiento TEXT,
        plan_estudio TEXT, curso TEXT, seccion TEXT,
        estatus TEXT DEFAULT 'Activo',
        FOREIGN KEY (id_representante) REFERENCES representantes(id_representante)
    )`);
    
    // Tabla configuracion
    db.run(`CREATE TABLE IF NOT EXISTS configuracion (
        id INTEGER PRIMARY KEY,
        moneda_sistema TEXT DEFAULT 'Dólares (USD)',
        precio_sistema TEXT DEFAULT 'Dólares (USD)',
        monto_matricula REAL DEFAULT 0.00,
        monto_mensualidad REAL DEFAULT 0.00,
        dia_cobro INTEGER DEFAULT 1
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS modalidades_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        modalidad_nombre TEXT, modalidad_activa INTEGER DEFAULT 0,
        curso_nombre TEXT, curso_activo INTEGER DEFAULT 0,
        seccion_tipo TEXT DEFAULT 'única', seccion_cantidad INTEGER DEFAULT 1, seccion_estilo TEXT DEFAULT 'Literales'
    )`);

    // Tabla operaciones (facturacion y pago)
    db.run(`CREATE TABLE IF NOT EXISTS operaciones (
        id_operacion INTEGER PRIMARY KEY AUTOINCREMENT,
        serial_operacion TEXT UNIQUE, tipo_operacion TEXT,
        id_representante INTEGER, id_usuario INTEGER,
        total_operacion REAL, moneda_operacion TEXT,
        fecha_operacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_representante) REFERENCES representantes(id_representante),
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
    )`);
    
    // Tabla conceptos pagados
    db.run(`CREATE TABLE IF NOT EXISTS pagos_conceptos (
        id_pago_concepto INTEGER PRIMARY KEY AUTOINCREMENT,
        id_operacion_factura INTEGER,
        id_representante INTEGER,
        concepto TEXT, -- "MATRICULA", "MENSUALIDAD SEPTIEMBRE", etc.
        monto_pagado REAL,
        fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabla metodos de pago (registrar)
    db.run(`CREATE TABLE IF NOT EXISTS pagos_detalle (
        id_pago_detalle INTEGER PRIMARY KEY AUTOINCREMENT,
        id_operacion INTEGER,
        metodo TEXT, moneda TEXT, tasa REAL, monto REAL,
        fecha TEXT, banco TEXT, referencia TEXT, telefono TEXT,
        FOREIGN KEY (id_operacion) REFERENCES operaciones(id_operacion)
    )`);

    // Datos inicializados
    db.get(`SELECT count(*) as count FROM configuracion`, (err, row) => {
        if (row.count === 0) {
            db.run(`INSERT INTO configuracion (id) VALUES (1)`);
        }
    });
    db.get(`SELECT count(*) as count FROM modalidades_config`, (err, row) => {
        if (row.count === 0) {
            const modalidades = {
                "Educación Inicial": ["Sala 3 Años", "Sala 4 Años", "Sala 5 Años"],
                "Educación Primaria": ["1° Grado", "2° Grado", "3° Grado", "4° Grado", "5° Grado", "6° Grado"],
                "Educación Media General": ["1° Año", "2° Año", "3° Año", "4° Año", "5° Año"]
            };
            const stmt = db.prepare(`INSERT INTO modalidades_config (modalidad_nombre, curso_nombre) VALUES (?, ?)`);
            for (const modalidad in modalidades) {
                for (const curso of modalidades[modalidad]) {
                    stmt.run(modalidad, curso);
                }
            }
            stmt.finalize();
        }
    });
});

// actividad de login 
function logActividad(id_usuario, username, tipo_actividad, descripcion) {
    db.run(`INSERT INTO actividades_usuarios (id_usuario, username, tipo_actividad, descripcion) VALUES (?, ?, ?, ?)`,
        [id_usuario, username, tipo_actividad, descripcion]);
}

const toUpper = (str) => (str ? String(str).toUpperCase() : null);

// serial de operaciones (prototipo)
async function generarSerial(tipo) {
    const letra = tipo === 'Abono' ? 'A' : 'F';
    return new Promise((resolve, reject) => {
        db.get(`SELECT serial_operacion FROM operaciones WHERE serial_operacion LIKE '%${letra}-%' ORDER BY id_operacion DESC LIMIT 1`, (err, row) => {
            if (err) return reject(err);

            let lote = 1;
            let numero = 1;

            if (row) {
                const partes = row.serial_operacion.split(letra + '-');
                lote = parseInt(partes[0], 10);
                numero = parseInt(partes[1], 10);

                if (numero >= 999999) {
                    numero = 1;
                    lote++;
                } else {
                    numero++;
                }
            }
            const serial = `${String(lote).padStart(2, '0')}${letra}-${String(numero).padStart(6, '0')}`;
            resolve(serial);
        });
    });
}

// API: usuarios
app.post("/register", (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    const stmt = db.prepare(`INSERT INTO usuarios (username, password) VALUES (?, ?)`);
    stmt.run(username, hashedPassword, function(err) {
        if (err) return res.status(400).json({ message: "El nombre de usuario ya existe." });
        
        const desc = `Cuenta de Usuario [ ${username} ] => Nueva Cuenta Registrada`;
        logActividad(this.lastID, username, 'Registro de Cuenta', desc);
        res.status(200).json({ message: "Registro completado con éxito." });
    });
    stmt.finalize();
});

app.post("/login", (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM usuarios WHERE username = ?`, [username], (err, row) => {
        if (err || !row) {
            return res.status(400).json({ message: "Usuario o contraseña incorrectos." });
        }
        if (bcrypt.compareSync(password, row.password)) {
            const user = { id: row.id, username: row.username };
            res.status(200).json({ message: "Login exitoso", user: user });
        } else {
            res.status(400).json({ message: "Usuario o contraseña incorrectos." });
        }
    });
});

app.post("/logout", (req, res) => {
    const { userId, username } = req.body;
    const desc = `Cuenta de usuario [ ${username} ] => Cierre de Sesión`;
    logActividad(userId, username, 'Cierre de Sesión', desc);
    res.sendStatus(200);
});

app.get('/api/usuarios/list', (req, res) => {
    db.all("SELECT id, username FROM usuarios ORDER BY username", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// API: configuracion
app.get('/api/configuracion/precios', (req, res) => {
    db.get("SELECT * FROM configuracion WHERE id = 1", (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

app.post('/api/configuracion/precios', (req, res) => {
    const { moneda_sistema, precio_sistema, monto_matricula, monto_mensualidad, dia_cobro } = req.body;
    db.run("UPDATE configuracion SET moneda_sistema = ?, precio_sistema = ?, monto_matricula = ?, monto_mensualidad = ?, dia_cobro = ? WHERE id = 1",
        [moneda_sistema, precio_sistema, monto_matricula, monto_mensualidad, dia_cobro],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Configuración de precios y moneda guardada con éxito." });
        }
    );
});

app.get('/api/configuracion/modalidades', (req, res) => {
    db.all("SELECT * FROM modalidades_config ORDER BY id", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const grouped = {};
        rows.forEach(row => {
            if (!grouped[row.modalidad_nombre]) {
                grouped[row.modalidad_nombre] = {
                    modalidad_activa: rows.find(r => r.modalidad_nombre === row.modalidad_nombre && r.modalidad_activa === 1) ? 1 : 0,
                    cursos: []
                };
            }
            grouped[row.modalidad_nombre].cursos.push(row);
        });
        res.json(grouped);
    });
});

app.post('/api/configuracion/modalidades', (req, res) => {
    const configs = req.body;
    db.serialize(() => {
        db.run("BEGIN TRANSACTION;");
        const stmt = db.prepare(`UPDATE modalidades_config SET modalidad_activa = ?, curso_activo = ?, seccion_tipo = ?, seccion_cantidad = ?, seccion_estilo = ? WHERE id = ?`);
        configs.forEach(config => {
            stmt.run(config.modalidad_activa, config.curso_activo, config.seccion_tipo, config.seccion_cantidad, config.seccion_estilo, config.id);
        });
        stmt.finalize((err) => {
            if (err) {
                db.run("ROLLBACK;");
                return res.status(500).json({ error: "Error al actualizar las modalidades." });
            }
            db.run("COMMIT;", (commitErr) => {
                 if (commitErr) return res.status(500).json({ error: "Error al finalizar la transacción." });
                 res.json({ message: 'Configuración de modalidades guardada con éxito.' });
            });
        });
    });
});

app.get('/api/configuracion/planes-activos', (req, res) => {
    const sql = `SELECT id, modalidad_nombre, curso_nombre, seccion_tipo, seccion_cantidad, seccion_estilo FROM modalidades_config WHERE modalidad_activa = 1 AND curso_activo = 1 ORDER BY id`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const planes = {};
        rows.forEach(row => {
            if (!planes[row.modalidad_nombre]) planes[row.modalidad_nombre] = [];
            planes[row.modalidad_nombre].push(row);
        });
        res.json(planes);
    });
});

// API: representantes - alumnos
app.get('/api/alumnos/stats', (req, res) => {
    const sql = `
        SELECT 
            COUNT(*) as total, 
            SUM(CASE WHEN estatus = 'Activo' THEN 1 ELSE 0 END) as activos,
            SUM(CASE WHEN estatus = 'Inactivo' THEN 1 ELSE 0 END) as inactivos
        FROM alumnos
    `;
    db.get(sql, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

app.post('/api/representantes', (req, res) => {
    const { primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, cedula, genero, telefono, email, domicilio, alumnos, user } = req.body;
    
    db.run("BEGIN TRANSACTION;");
    const stmtRep = db.prepare(`INSERT INTO representantes (primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, cedula, genero, telefono, email, domicilio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmtRep.run(toUpper(primer_nombre), toUpper(segundo_nombre), toUpper(primer_apellido), toUpper(segundo_apellido), cedula, genero, telefono, email ? email.toLowerCase() : null, toUpper(domicilio), function(err) {
        if (err) {
            db.run("ROLLBACK;");
            return res.status(400).json({ error: "La cédula del representante ya existe." });
        }
        const idRepresentante = this.lastID;
        const desc = `Usuario [${user.username}] registró al Rep. [C.I: ${cedula}] con [${alumnos.length}] alumno(s).`;
        logActividad(user.id, user.username, 'Registro de Representante', desc);

        if (alumnos && alumnos.length > 0) {
            const stmtAlu = db.prepare(`INSERT INTO alumnos (id_representante, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, cedula, genero, fecha_nacimiento, plan_estudio, curso, seccion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            alumnos.forEach(a => stmtAlu.run(idRepresentante, toUpper(a.primer_nombre), toUpper(a.segundo_nombre), toUpper(a.primer_apellido), toUpper(a.segundo_apellido), a.cedula, a.genero, a.fecha_nacimiento, a.plan_estudio, a.curso, a.seccion));
            stmtAlu.finalize();
        }

        db.run("COMMIT;", (commitErr) => {
            if (commitErr) return res.status(500).json({ error: "Error al finalizar la transacción." });
            res.status(201).json({ message: 'Representante y alumnos guardados con éxito.' });
        });
    });
    stmtRep.finalize();
});

app.get('/api/representantes', (req, res) => {
    const sql = `SELECT r.*, (SELECT COUNT(*) FROM alumnos WHERE id_representante = r.id_representante) as num_alumnos FROM representantes r ORDER BY r.primer_apellido, r.primer_nombre;`;
    db.all(sql, [], (err, rows) => res.status(err ? 500 : 200).json(err ? { error: err.message } : rows));
});

app.get('/api/representantes/:id', (req, res) => {
    db.get("SELECT * FROM representantes WHERE id_representante = ?", [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ message: "Representante no encontrado." });
        res.json(row);
    });
});

app.get('/api/representantes/:id/alumnos', (req, res) => {
    db.all("SELECT * FROM alumnos WHERE id_representante = ?", [req.params.id], (err, rows) => res.status(err ? 500 : 200).json(err ? { error: err.message } : rows));
});


app.put('/api/representantes/:id', (req, res) => {
    const { id } = req.params;
    const { primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, cedula, genero, telefono, email, domicilio, alumnos, alumnos_nuevos, user } = req.body;

    db.run("BEGIN TRANSACTION;");

    try {
        const sqlRep = `UPDATE representantes SET primer_nombre = ?, segundo_nombre = ?, primer_apellido = ?, segundo_apellido = ?, cedula = ?, genero = ?, telefono = ?, email = ?, domicilio = ? WHERE id_representante = ?`;
        db.run(sqlRep, [toUpper(primer_nombre), toUpper(segundo_nombre), toUpper(primer_apellido), toUpper(segundo_apellido), cedula, genero, telefono, email ? email.toLowerCase() : null, toUpper(domicilio), id]);
        if (alumnos && alumnos.length > 0) {
            const stmtUpdateAlu = db.prepare(`UPDATE alumnos SET primer_nombre = ?, segundo_nombre = ?, primer_apellido = ?, segundo_apellido = ?, cedula = ?, genero = ?, fecha_nacimiento = ?, plan_estudio = ?, curso = ?, seccion = ? WHERE id_alumno = ?`);
            alumnos.forEach(a => stmtUpdateAlu.run(toUpper(a.primer_nombre), toUpper(a.segundo_nombre), toUpper(a.primer_apellido), toUpper(a.segundo_apellido), a.cedula, a.genero, a.fecha_nacimiento, a.plan_estudio, a.curso, a.seccion, a.id_alumno));
            stmtUpdateAlu.finalize();
        }
        if (alumnos_nuevos && alumnos_nuevos.length > 0) {
            const stmtInsertAlu = db.prepare(`INSERT INTO alumnos (id_representante, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, cedula, genero, fecha_nacimiento, plan_estudio, curso, seccion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            alumnos_nuevos.forEach(a => stmtInsertAlu.run(id, toUpper(a.primer_nombre), toUpper(a.segundo_nombre), toUpper(a.primer_apellido), toUpper(a.segundo_apellido), a.cedula, a.genero, a.fecha_nacimiento, a.plan_estudio, a.curso, a.seccion));
            stmtInsertAlu.finalize();
        }

        const desc = `Usuario [${user.username}] modificó datos del Rep. [C.I: ${cedula}].`;
        logActividad(user.id, user.username, 'Modificación de Representante', desc);
        
        db.run("COMMIT;", (commitErr) => {
            if (commitErr) {
                db.run("ROLLBACK;");
                return res.status(500).json({ error: "Error al confirmar la transacción." });
            }
            res.json({ message: 'Representante actualizado con éxito.' });
        });

    } catch (err) {
        db.run("ROLLBACK;");
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/representantes/:id/estado', (req, res) => {
    const { id } = req.params;
    const { estado, user, cedula } = req.body;
    db.run('BEGIN TRANSACTION');
    db.run('UPDATE representantes SET estado = ? WHERE id_representante = ?', [estado, id], function(err){
        if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
        db.run('UPDATE alumnos SET estatus = ? WHERE id_representante = ?', [estado, id], (err) => {
             if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: err.message }); }
            const desc = `Usuario [${user.username}] cambió estado a [${estado}] al Rep. [C.I: ${cedula}] y alumnos asociados.`;
            logActividad(user.id, user.username, 'Cambio de Estado Representante', desc);
            db.run('COMMIT');
            res.json({ message: 'Estado del representante y sus alumnos actualizado.' });
        });
    });
});

app.put('/api/alumnos/:id/estado', (req, res) => {
    const { id } = req.params;
    const { estatus, user } = req.body;

    if (!estatus || !user || !user.id) return res.status(400).json({ error: "Datos incompletos." });
    db.get('SELECT primer_nombre, primer_apellido FROM alumnos WHERE id_alumno = ?', [id], (err, alumno) => {
        if(err || !alumno) return res.status(404).json({message: "Alumno no encontrado."})
        
        db.run('UPDATE alumnos SET estatus = ? WHERE id_alumno = ?', [estatus, id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            const desc = `Usuario [${user.username}] cambió estado a [${estatus}] al Alumno [${toUpper(alumno.primer_nombre)} ${toUpper(alumno.primer_apellido)}].`;
            logActividad(user.id, user.username, 'Modificación de Estado Alumno', desc);
            res.json({ message: 'Estado del alumno actualizado con éxito.' });
        });
    });
});

// API: pagos (prototipo)
app.get('/api/representantes/:id/estado-cuenta', async (req, res) => {
    const idRepresentante = req.params.id;
    try {
        const [config, representante, alumnos, conceptosPagados] = await Promise.all([
            new Promise((resolve, reject) => db.get("SELECT * FROM configuracion WHERE id = 1", (e, r) => e ? reject(e) : resolve(r))),
            new Promise((resolve, reject) => db.get("SELECT * FROM representantes WHERE id_representante = ?", [idRepresentante], (e, r) => e ? reject(e) : resolve(r))),
            new Promise((resolve, reject) => db.all("SELECT * FROM alumnos WHERE id_representante = ? AND estatus = 'Activo'", [idRepresentante], (e, r) => e ? reject(e) : resolve(r))),
            new Promise((resolve, reject) => db.all("SELECT concepto FROM pagos_conceptos WHERE id_representante = ?", [idRepresentante], (e, r) => e ? reject(e) : resolve(r.map(p => p.concepto))))
        ]);
        if (!representante) return res.status(404).json({ error: 'Representante no encontrado' });

        // calcular deuda (prototipo)
        let montoACancelar = 0;
        const meses = ["SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE", "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO"];
        
        // deuda matricula (prototipo)
        if (!conceptosPagados.includes('MATRICULA')) {
            montoACancelar += config.monto_matricula * alumnos.length;
        }

        // deuda mensualidades (prototipo)
        const mesActual = new Date().getMonth(); // 0-11
        const anioActual = new Date().getFullYear();
        
        // control meses escolares - ciclo escolar hasta Julio (prototipo)
        const mesesDelCiclo = meses.slice(0, 11); 
        mesesDelCiclo.forEach((mes, index) => {
            if (!conceptosPagados.includes(`MENSUALIDAD ${mes}`)) {
                montoACancelar += config.monto_mensualidad * alumnos.length;
            }
        });

        // estado de pago y factura (prototipo)
        let estadoPago = 'Solvente';
        if (montoACancelar > 0) {
            estadoPago = 'Deuda'; // Poner Deuda o Pendiente
        }

        let estadoFactura = 'En espera';
        if (representante.saldo_abonado >= montoACancelar && montoACancelar > 0) {
            estadoFactura = 'Disponible';
        }

        // detalles de deuda por alumno (prototipo)
        const alumnosConDeuda = alumnos.map(alumno => {
            const deudaAlumno = {
                matricula: !conceptosPagados.includes('MATRICULA') ? 'Deuda' : 'Solvente',
                mensualidades: {}
            };
            mesesDelCiclo.forEach(mes => {
                deudaAlumno.mensualidades[mes] = !conceptosPagados.includes(`MENSUALIDAD ${mes}`) ? 'Deuda' : 'Solvente';
            });
            return { ...alumno, ...deudaAlumno };
        });
        const estadoCuenta = {
            informacion_representante: representante,
            estado_pago: estadoPago,
            monto_a_cancelar: montoACancelar,
            saldo_abonado: representante.saldo_abonado,
            factura: estadoFactura,
            alumnos_asociados: alumnosConDeuda,
            config_moneda: config.precio_sistema
        };

        res.json(estadoCuenta);

    } catch (error) {
        res.status(500).json({ error: "Error al calcular estado de cuenta: " + error.message });
    }
});

app.post('/api/pagos/abono', async (req, res) => {
    const { id_representante, user, metodos_pago } = req.body;

    if (!id_representante || !metodos_pago || metodos_pago.length === 0) {
        return res.status(400).json({ error: "Faltan datos para procesar el abono." });
    }

    try {
        const config = await new Promise((resolve, reject) => db.get("SELECT precio_sistema FROM configuracion WHERE id = 1", (e, r) => e ? reject(e) : resolve(r)));
        const representante = await new Promise((resolve, reject) => db.get("SELECT saldo_abonado, cedula FROM representantes WHERE id_representante = ?", [id_representante], (e, r) => e ? reject(e) : resolve(r)));

        let totalAbono = 0;
        metodos_pago.forEach(pago => {
            let montoConvertido = pago.monto;
            if (pago.moneda !== config.precio_sistema) {
                if (config.precio_sistema === 'Dólares (USD)') { 
                    montoConvertido = pago.monto / pago.tasa; // conversion Bs a USD
                } else { 
                    montoConvertido = pago.monto * pago.tasa; // conversion USD a Bs
                }
            }
            totalAbono += montoConvertido;
        });

        const serial = await generarSerial('Abono');

        db.serialize(() => {
            db.run("BEGIN TRANSACTION;");

            const stmtOp = db.prepare(`INSERT INTO operaciones (serial_operacion, tipo_operacion, id_representante, total_operacion, moneda_operacion, id_usuario) VALUES (?, 'Abono', ?, ?, ?, ?)`);
            stmtOp.run(serial, id_representante, totalAbono, config.precio_sistema, user.id, function (err) {
                if (err) { db.run("ROLLBACK;"); return res.status(500).json({ error: "Error al crear operación." }); }
                const idOperacion = this.lastID;

                const stmtDetalle = db.prepare(`INSERT INTO pagos_detalle (id_operacion, metodo, moneda, tasa, monto, fecha, banco, referencia, telefono) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                metodos_pago.forEach(pago => {
                    stmtDetalle.run(idOperacion, pago.metodo, pago.moneda, pago.tasa, pago.monto, pago.fecha, pago.banco, pago.referencia, pago.telefono);
                });
                stmtDetalle.finalize();

                const nuevoSaldo = representante.saldo_abonado + totalAbono;
                db.run('UPDATE representantes SET saldo_abonado = ? WHERE id_representante = ?', [nuevoSaldo, id_representante]);
                
                const desc = `Cuenta de usuario [ ${user.username} ] => Registro Abono nuevo | Monto [ ${totalAbono.toFixed(2)} ${config.precio_sistema} ]\nRepresentante [ ${representante.cedula} ] – Saldo [ ${nuevoSaldo.toFixed(2)} ${config.precio_sistema} ]`;
                logActividad(user.id, user.username, 'Abono de Saldo', desc);

                db.run("COMMIT;", (err) => {
                    if (err) { db.run("ROLLBACK;"); return res.status(500).json({ error: "Error al finalizar transacción." }); }
                    res.status(201).json({ message: "Abono procesado con éxito." });
                });
            });
            stmtOp.finalize();
        });
    } catch (error) {
        res.status(500).json({ error: 'Error del servidor: ' + error.message });
    }
});

// API: reportes 
app.get('/api/operaciones/:id/detalles', (req, res) => {
    db.all("SELECT * FROM pagos_detalle WHERE id_operacion = ?", [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/reportes/operaciones', (req, res) => {
    let { tipo, fechaInicio, fechaCierre } = req.query;
    let sql = `SELECT o.*, r.primer_nombre || ' ' || r.primer_apellido as representante, r.cedula, u.username as usuario
        FROM operaciones o JOIN representantes r ON o.id_representante = r.id_representante JOIN usuarios u ON o.id_usuario = u.id WHERE 1=1`;
    const params = [];

    if (tipo && tipo !== 'Todos') { sql += " AND o.tipo_operacion = ?"; params.push(tipo); }
    if (fechaInicio) { sql += " AND date(o.fecha_operacion) >= ?"; params.push(fechaInicio); }
    if (fechaCierre) { sql += " AND date(o.fecha_operacion) <= ?"; params.push(fechaCierre); }
    sql += " ORDER BY o.fecha_operacion DESC";
    
    db.all(sql, params, (err, rows) => res.status(err ? 500 : 200).json(err ? { error: err.message } : rows));
});

app.get('/api/reportes/actividad', (req, res) => {
    let { userId, fechaInicio, fechaCierre } = req.query;
    let sql = "SELECT * FROM actividades_usuarios WHERE 1=1";
    const params = [];
    if (userId) { sql += " AND id_usuario = ?"; params.push(userId); }
    if (fechaInicio) { sql += " AND date(fecha_actividad) >= ?"; params.push(fechaInicio); }
    if (fechaCierre) { sql += " AND date(fecha_actividad) <= ?"; params.push(fechaCierre); }
    sql += " ORDER BY fecha_actividad DESC";
    
    db.all(sql, params, (err, rows) => res.status(err ? 500 : 200).json(err ? { error: err.message } : rows));
});

app.get('/api/reportes/representantes', (req, res) => {
    const { estado } = req.query;
    
    let sql = `
        SELECT
            cedula,
            primer_nombre || ' ' || IFNULL(segundo_nombre, '') as nombre_completo,
            primer_apellido || ' ' || IFNULL(segundo_apellido, '') as apellido_completo,
            telefono,
            email,
            estado,
            (SELECT COUNT(*) FROM alumnos a WHERE a.id_representante = r.id_representante) as num_alumnos
        FROM representantes r
    `;
    const params = [];

    if (estado && (estado === 'Activo' || estado === 'Inactivo')) {
        sql += " WHERE r.estado = ?";
        params.push(estado);
    }

    sql += " ORDER BY apellido_completo, nombre_completo";
    
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/reportes/alumnos', (req, res) => {
    const { plan, curso, seccion, estatus } = req.query;

    let sql = `
        SELECT
            a.cedula as cedula_alumno,
            a.primer_nombre || ' ' || IFNULL(a.segundo_nombre, '') as nombre_completo_alumno,
            a.primer_apellido || ' ' || IFNULL(a.segundo_apellido, '') as apellido_completo_alumno,
            a.plan_estudio,
            a.curso,
            a.seccion,
            a.fecha_nacimiento,
            a.estatus
        FROM alumnos a
        WHERE 1=1
    `;
    const params = [];

    if (plan) { 
        sql += " AND a.plan_estudio = ?"; params.push(plan); 
    }
    if (curso) { 
        sql += " AND a.curso = ?"; params.push(curso); 
    }
    if (seccion) { 
        sql += " AND a.seccion = ?"; params.push(seccion); 
    }
    if (estatus) { 
        sql += " AND a.estatus = ?"; params.push(estatus); 
    }

    sql += " ORDER BY apellido_completo_alumno, nombre_completo_alumno";

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});


// API: exportacion pdf
app.post('/export/pdf/operaciones', (req, res) => {
    const { data } = req.body;
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte_operaciones.pdf');
    doc.pipe(res);
    doc.fontSize(18).font('Helvetica-Bold').text('REPORTE DE OPERACIONES', { align: 'center' }).moveDown(2);
    
    const table = {
        headers: ["Fecha", "Serial", "Representante", "Tipo", "Monto", "Usuario"],
        rows: data.map(item => [
            new Date(item.fecha_operacion).toLocaleString(), item.serial_operacion,
            item.representante, item.tipo_operacion,
            `${item.total_operacion.toFixed(2)} ${item.moneda_operacion}`, item.usuario
        ])
    };
    doc.table(table, { prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10), prepareRow: () => doc.font('Helvetica').fontSize(9) });
    doc.end();
});

app.post('/export/pdf/actividad', (req, res) => {
    const { data } = req.body;
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte_usuarios.pdf');
    doc.pipe(res);
    doc.fontSize(18).font('Helvetica-Bold').text('REPORTE DE ACTIVIDAD DE USUARIOS', { align: 'center' }).moveDown(2);
    
    const table = {
        headers: ["Fecha y Hora", "Usuario", "Tipo de Actividad", "Descripción"],
        rows: data.map(item => [
            new Date(item.fecha_actividad).toLocaleString(), item.username, item.tipo_actividad, item.descripcion
        ])
    };
    doc.table(table, {
        prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10),
        prepareRow: (row, i) => doc.font('Helvetica').fontSize(9)
    });
    doc.end();
});

app.post('/export/pdf/representantes', (req, res) => {
    const { data } = req.body;
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);
    doc.fontSize(16).font('Helvetica-Bold').text('REPORTE DE REPRESENTANTES REGISTRADOS', { align: 'center' }).moveDown(1.5);
    const table = {
        title: " ",
        headers: ["Cédula","Nombres", "Apellidos", "Teléfono", "Email", "N° Alumnos", "Estado"],
        rows: data.map(item => [item.cedula, item.nombre_completo, item.apellido_completo, item.telefono || 'N/A', item.email || 'N/A', item.num_alumnos, item.estado])
    };
    doc.table(table, { prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10), prepareRow: () => doc.font('Helvetica').fontSize(9) });
    doc.end();
});

app.post('/export/pdf/alumnos', (req, res) => {
    const { data } = req.body;
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);
    doc.fontSize(16).font('Helvetica-Bold').text('REPORTE DE ALUMNOS REGISTRADOS', { align: 'center' }).moveDown(1.5);
    const table = {
        title: " ",
        headers: ["Cédula", "Nombres", "Apellidos", "Curso", "Sección", "F. Nacimiento", "Estado"],
        rows: data.map(item => [item.cedula_alumno || 'N/A', item.nombre_completo_alumno, item.apellido_completo_alumno, item.curso, item.seccion, item.fecha_nacimiento, item.estatus])
    };
    doc.table(table, { prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10), prepareRow: () => doc.font('Helvetica').fontSize(9) });
    doc.end();
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '/public/pag/index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '/public/pag/dashboard.html')));
app.get('/representantes', (req, res) => res.sendFile(path.join(__dirname, '/public/pag/gestion_representantes.html')));
app.get('/pagos', (req, res) => res.sendFile(path.join(__dirname, '/public/pag/gestion_pago.html')));
app.get('/reportes', (req, res) => res.sendFile(path.join(__dirname, '/public/pag/reportes.html')));
app.get('/configuracion', (req, res) => res.sendFile(path.join(__dirname, '/public/pag/configuracion.html')));


const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
