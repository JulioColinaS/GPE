let representanteSeleccionado = null;
let configuracionSistema = null;
let metodosDePagoTemporales = [];
let estadoCuentaActual = null;
let todosLosRepresentantes = [];

document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/configuracion/precios').then(res => {
            if (!res.ok) throw new Error('Error de red al cargar configuración');
            return res.json();
        })
        .then(config => {
            configuracionSistema = config;
        })
        .catch(err => {
            console.error("Error fatal: No se pudo cargar la configuración del sistema.", err);
            alert("Error fatal: No se pudo cargar la configuración del sistema. El módulo de pagos no funcionará.");
        });
    fetch('/api/representantes').then(res => res.json()).then(data => {
        todosLosRepresentantes = data.filter(r => r.estado === 'Activo');
    });
});

function abrirModalPagos(modo) {
    if (!configuracionSistema) {
        alert("La configuración del sistema no se ha cargado. No se puede continuar.");
        return;
    }
    if (modo === 'facturacion') {
        alert('La funcionalidad "Facturación" se implementará próximamente.');
        return;
    }

    const modal = document.getElementById('pago-modal-busqueda');
    const title = document.getElementById('pago-modal-busqueda-title');
    const buscarBtn = document.getElementById('pago-buscar-btn');

    document.getElementById('pago-cedula-buscar').value = '';
    document.getElementById('pago-modal-busqueda-body').innerHTML = `
        <p>Ingrese la cédula del representante para continuar.</p>
        <div class="modal-search-bar">
            <input type="text" id="pago-cedula-buscar" placeholder="Buscar por Cédula..." oninput="this.value = this.value.replace(/[^0-9]/g, '')">
            <button class="btn btn-small btn-blue" id="pago-buscar-btn"><i class="fas fa-cash-register"></i>Buscar</button>
            <button class="btn btn-small btn-orange" onclick="reiniciarBusquedaPagos()"><i class="fas fa-cash-register"></i>Reiniciar</button>
        </div>
        <div id="pago-resultado-busqueda" class="list-container" style="margin-top: 15px;"></div>
    `;

    if (modo === 'consultar') {
        title.textContent = 'Consultar Estado de Cuenta';
        buscarBtn.onclick = () => buscarRepresentante('consultar');
    } else if (modo === 'abonar') {
        title.textContent = 'Abonar Saldo a Cuenta';
        buscarBtn.onclick = () => buscarRepresentante('abonar');
    }

    modal.style.display = 'flex';
}

function cerrarModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
    if (modalId === 'pago-modal-abono') {
        metodosDePagoTemporales = [];
    }
}

async function buscarRepresentante(accionFinal) {
    const cedula = document.getElementById('pago-cedula-buscar').value;
    if (!cedula) {
        alert("Por favor, ingrese una cédula.");
        return;
    }
    const filtrados = todosLosRepresentantes.filter(r => r.cedula.includes(cedula));
    renderizarListaPagos(filtrados, accionFinal);
}

function reiniciarBusquedaPagos() {
    document.getElementById('pago-cedula-buscar').value = '';
    const resultadoDiv = document.getElementById('pago-resultado-busqueda');
    resultadoDiv.innerHTML = '<p>Ingrese una cédula para buscar.</p>';
}

function renderizarListaPagos(lista, accionFinal) {
    const resultadoDiv = document.getElementById('pago-resultado-busqueda');
    if (lista.length > 0) {
        resultadoDiv.innerHTML = lista.map(encontrado => {
            const nombreCompleto = `${encontrado.primer_nombre} ${encontrado.segundo_nombre || ''} ${encontrado.primer_apellido} ${encontrado.segundo_apellido || ''}`.trim();
            return `
                <div class="list-item">
                    <div class="list-item-info">
                        <strong>${nombreCompleto}</strong>
                        <small>C.I: ${encontrado.cedula}</small>
                    </div>
                    <div class="list-item-actions">
                        <button class="btn btn-small btn-blue" onclick="seleccionarRepresentanteParaPago(${encontrado.id_representante}, '${accionFinal}')">Seleccionar</button>
                    </div>
                </div>`;
        }).join('');
    } else {
        resultadoDiv.innerHTML = `<p class="error">No se encontró ningún representante activo con ese criterio.</p>`;
    }
}

function seleccionarRepresentanteParaPago(id, accionFinal) {
    representanteSeleccionado = todosLosRepresentantes.find(r => r.id_representante === id);
    continuarAccion(accionFinal);
}

function continuarAccion(accion) {
    cerrarModal('pago-modal-busqueda');
    abrirModalConsulta();
}

async function abrirModalConsulta() {
    const modal = document.getElementById('pago-modal-consulta');
    const title = document.getElementById('pago-modal-consulta-title');
    const body = document.getElementById('pago-modal-consulta-body');
    const footer = document.getElementById('pago-modal-consulta-footer');
    body.innerHTML = '<p>Cargando estado de cuenta...</p>';
    footer.innerHTML = '';
    title.textContent = `Estado de Cuenta`;
    modal.style.display = 'flex';

    try {
        const res = await fetch(`/api/representantes/${representanteSeleccionado.id_representante}/estado-cuenta`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        estadoCuentaActual = data;
        const rep = data.informacion_representante;
        const nombreCompleto = `${rep.primer_nombre} ${rep.segundo_nombre || ''} ${rep.primer_apellido} ${rep.segundo_apellido || ''}`.trim();
        const moneda = data.config_moneda;
        title.textContent = `Estado de Cuenta de: ${nombreCompleto}`;

        let html = `
            <h4>Resumen Financiero</h4>
            <div class="info-section summary-grid">
                <div><p>Estado de Pago:</p> <span class="status ${data.estado_pago.toLowerCase()}">${data.estado_pago}</span></div>
                <div><p>Monto a Cancelar:</p> <span class="amount">${formatNumber(data.monto_a_cancelar)} ${moneda}</span></div>
                <div><p>Saldo Abonado:</p> <span class="amount-green">${formatNumber(data.saldo_abonado)} ${moneda}</span></div>
                <div><p>Factura:</p> <span class="status ${data.factura.toLowerCase().replace(' ', '-')}">${data.factura}</span></div>
            </div>
            <h4>Detalle por Alumno(s) Activo(s)</h4>
        `;

        data.alumnos_asociados.forEach(alu => {
            const nombreAlu = `${alu.primer_nombre} ${alu.segundo_nombre || ''} ${alu.primer_apellido} ${alu.segundo_apellido || ''}`.trim();
            html += `
                <div class="sub-form">
                    <strong>${nombreAlu}</strong> (Curso: ${alu.curso} - Sección: ${alu.seccion})
                    <div class="detalle-pagos">
                        <div class="pago-item">Matrícula: <span class="${alu.matricula.toLowerCase()}">${alu.matricula}</span></div>
                        ${Object.entries(alu.mensualidades).map(([mes, estado]) => `
                            <div class="pago-item">${mes.charAt(0) + mes.slice(1).toLowerCase()}: <span class="${estado.toLowerCase()}">${estado}</span></div>
                        `).join('')}
                    </div>
                </div>
            `;
        });
        body.innerHTML = html;

        footer.innerHTML = `
            <button class="btn btn-blue" onclick="abrirModalAbono()">Abonar</button>
            <button class="btn btn-red" onclick="cerrarModal('pago-modal-consulta')">Cerrar</button>
        `;

    } catch (error) {
        console.error("Error al cargar estado de cuenta:", error);
        body.innerHTML = `<p class="error">No se pudo cargar el estado de cuenta. ${error.message}</p>`;
    }
}

function abrirModalAbono() {
    cerrarModal('pago-modal-consulta'); 
    const modal = document.getElementById('pago-modal-abono');
    const body = document.getElementById('pago-modal-abono-body');
    const rep = representanteSeleccionado;
    const nombreCompleto = `${rep.primer_nombre} ${rep.segundo_nombre || ''} ${rep.primer_apellido} ${rep.segundo_apellido || ''}`.trim();

    body.innerHTML = `
        <div class="info-section">
            <p><strong>Abonando a la cuenta de:</strong> ${nombreCompleto} (C.I: ${rep.cedula})</p>
        </div>

        <div id="form-add-pago" class="sub-form">
            <h5>Añadir Método de Pago</h5>
            <div class="form-grid" style="grid-template-columns: repeat(4, 1fr); align-items: end;">
                <div><label>Método de Pago:</label><select id="abono-metodo" onchange="toggleAbonoFields()"><option value="">--Seleccione--</option><option>Efectivo</option><option>Transferencia</option><option>Pago Móvil</option><option>Punto de Venta</option></select></div>
                <div><label>Moneda:</label><select id="abono-moneda" onchange="toggleAbonoFields()"><option value="Bolívares (Bs)">Bolívares (Bs)</option><option value="Dólares (USD)">Dólares (USD)</option></select></div>
                <div><label>Tasa de Cambio:</label><input type="text" id="abono-tasa" placeholder="Tasa del día" oninput="formatCurrency(this)" disabled></div>
                <div><label>Monto:</label><input type="text" id="abono-monto" placeholder="0,00" oninput="formatCurrency(this)"></div>
                <div><label>Fecha:</label><input type="date" id="abono-fecha" value="${new Date().toISOString().split('T')[0]}"></div>
                <div><label>Banco:</label><input type="text" id="abono-banco" disabled></div>
                <div><label>Referencia:</label><input type="text" id="abono-referencia" disabled></div>
                <div><label>Teléfono (Pago Móvil):</label><input type="text" id="abono-telefono" oninput="this.value=this.value.replace(/[^0-9]/g,'')" disabled></div>
            </div>
            <div style="text-align: right; margin-top: 15px;">
                <button class="btn btn-small btn-green" onclick="agregarMetodoDePago()">Añadir a la lista</button>
            </div>
        </div>

        <hr>
        <h5>Pagos a Procesar</h5>
        <div id="lista-pagos-temp" class="list-container" style="max-height: 20vh;">
            <p>No hay pagos añadidos.</p>
        </div>
        <div id="resumen-abono" style="text-align: right; margin-top: 15px; font-size: 1.2em;">
            <strong>Total a Abonar: <span id="total-abono-display">0,00 ${configuracionSistema.precio_sistema}</span></strong>
        </div>
        <div class="modal-footer">
            <button class="btn btn-blue" onclick="procesarAbono()">Confirmar Abono</button>
            <button class="btn btn-red" onclick="cerrarModal('pago-modal-abono')">Cancelar</button>
        </div>
    `;

    toggleAbonoFields(); 
    modal.style.display = 'flex';
}


function toggleAbonoFields() {
    const metodo = document.getElementById('abono-metodo').value;
    const moneda = document.getElementById('abono-moneda').value;
    const tasa = document.getElementById('abono-tasa');
    const banco = document.getElementById('abono-banco');
    const referencia = document.getElementById('abono-referencia');
    const telefono = document.getElementById('abono-telefono');

    tasa.disabled = (moneda === configuracionSistema.precio_sistema);
    banco.disabled = !['Transferencia', 'Punto de Venta'].includes(metodo);
    referencia.disabled = !['Transferencia', 'Punto de Venta', 'Pago Móvil'].includes(metodo);
    telefono.disabled = metodo !== 'Pago Móvil';
}

function agregarMetodoDePago() {
    const pago = {
        metodo: document.getElementById('abono-metodo').value,
        moneda: document.getElementById('abono-moneda').value,
        tasa: parseFormattedNumber(document.getElementById('abono-tasa').value),
        monto: parseFormattedNumber(document.getElementById('abono-monto').value),
        fecha: document.getElementById('abono-fecha').value,
        banco: document.getElementById('abono-banco').value.toUpperCase(),
        referencia: document.getElementById('abono-referencia').value.toUpperCase(),
        telefono: document.getElementById('abono-telefono').value,
    };

    if (!pago.metodo || !pago.monto || !pago.fecha) {
        alert("Los campos Método, Monto y Fecha son obligatorios.");
        return;
    }
    if (pago.moneda !== configuracionSistema.precio_sistema && pago.tasa <= 0) {
        alert("Debe ingresar una tasa de cambio válida si la moneda es diferente a la del sistema.");
        return;
    }

    metodosDePagoTemporales.push(pago);
    actualizarListaPagosTemp();
    document.getElementById('abono-metodo').value = "";
    document.getElementById('abono-monto').value = "";
    document.getElementById('abono-tasa').value = "";
    document.getElementById('abono-banco').value = "";
    document.getElementById('abono-referencia').value = "";
    document.getElementById('abono-telefono').value = "";
    toggleAbonoFields();
}

function actualizarListaPagosTemp() {
    const container = document.getElementById('lista-pagos-temp');
    if (metodosDePagoTemporales.length === 0) {
        container.innerHTML = '<p>No hay pagos añadidos.</p>';
    } else {
        container.innerHTML = metodosDePagoTemporales.map((p, index) => `
            <div class="list-item">
                <div class="list-item-info">
                    <strong>${p.metodo} - ${formatNumber(p.monto)} ${p.moneda}</strong>
                    <small>Ref: ${p.referencia || 'N/A'} | Fecha: ${p.fecha}</small>
                </div>
                <div class="list-item-actions">
                    <button class="btn btn-small btn-red" onclick="eliminarMetodoDePago(${index})">Eliminar</button>
                </div>
            </div>
        `).join('');
    }
    actualizarTotalAbono();
}

function eliminarMetodoDePago(index) {
    metodosDePagoTemporales.splice(index, 1);
    actualizarListaPagosTemp();
}

function actualizarTotalAbono() {
    let total = 0;
    metodosDePagoTemporales.forEach(p => {
        let montoConvertido = p.monto;
        if (p.moneda !== configuracionSistema.precio_sistema) {
            if (configuracionSistema.precio_sistema === 'Dólares (USD)') { // Convertir Bs a USD
                montoConvertido = p.monto / p.tasa;
            } else { // Convertir USD a Bs
                montoConvertido = p.monto * p.tasa;
            }
        }
        total += montoConvertido;
    });
    document.getElementById('total-abono-display').textContent = `${formatNumber(total)} ${configuracionSistema.precio_sistema}`;
}

async function procesarAbono() {
    if (metodosDePagoTemporales.length === 0) {
        alert("Debe añadir al menos un método de pago para abonar.");
        return;
    }
    if (!confirm("¿Está seguro de que desea procesar este abono? Esta acción no se puede deshacer.")) return;

    const user = JSON.parse(sessionStorage.getItem('loggedInUser'));
    const abonoData = {
        id_representante: representanteSeleccionado.id_representante,
        user: { userId: user.userId, username: user.username },
        metodos_pago: metodosDePagoTemporales
    };

    try {
        const response = await fetch('/api/pagos/abono', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(abonoData)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        alert(result.message);
        cerrarModal('pago-modal-abono');
    } catch (error) {
        console.error("Error al procesar abono:", error);
        alert(`Ocurrió un error: ${error.message}`);
    }
}

function formatNumber(num) {
    return (num || 0).toFixed(2).replace('.', ',');
}
function parseFormattedNumber(str) {
    if (!str) return 0;
    return parseFloat(String(str).replace(',', '.')) || 0;
}
function formatCurrency(input) {
    let value = input.value.replace(/[^0-9,]/g, '');
    let parts = value.split(',');
    if (parts.length > 2) {
        value = parts[0] + ',' + parts.slice(1).join('');
    }
    input.value = value;
}