let datosReporteActual = [];
let tipoReporteActual = '';

function cerrarModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) modal.style.display = 'none';
}

function cerrarModalReporte() {
    cerrarModal('reporte-modal');
    datosReporteActual = [];
    tipoReporteActual = '';
}

async function abrirModalReporte(tipo) {
    tipoReporteActual = tipo;
    const modal = document.getElementById('reporte-modal');
    const title = document.getElementById('reporte-modal-title');
    const body = document.getElementById('reporte-modal-body');

    let filtrosHTML = '<p>No hay filtros disponibles para este reporte.</p>';
    let tituloReporte = '';

    switch (tipo){
        case 'operaciones': 
            tituloReporte = 'REPORTE DE OPERACIONES REGISTRADAS';
            tieneFiltros = true;
            filtrosHTML = `
                <div class="form-filter-row" style="display: flex; flex-wrap: wrap; justify-content: flex-start; align-items: center; gap: 1rem;">
                    <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
                        <label>TIPO: </label>
                        <select id="filtro-tipo-op">
                        <option value="Todos">Todos</option><option value="Abono">Abonos</option><option value="Factura">Facturas</option></select>
                    </div>
                    <div class="form-group" style="display: flex; align-items: center; gap: 2.0rem;"><label> || </label></div>
                    <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
                        <label>DESDE: </label><input type="date" id="filtro-fecha-inicio">
                    </div>
                    <div class="form-group" style="display: flex; align-items: center; gap: 2.0rem;"><label> - </label></div>
                    <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
                        <label>HASTE: </label>
                        <input type="date" id="filtro-fecha-cierre">
                    </div>
                </div>
            `;
            break;
        
        case 'actividad':
            tituloReporte = 'REPORTE DE ACTIVIDADES DE USUARIOS';
            tieneFiltros = true;
            try {
                const res = await fetch('/api/usuarios/list');
                const usuarios = await res.json();
                const opcionesUsuarios = usuarios.map(u => `<option value="${u.id}">${u.username}</option>`).join('');

                filtrosHTML = `
                    <div class="form-filter-row" style="display: flex; flex-wrap: wrap; justify-content: flex-start; align-items: center; gap: 1rem;">
                        <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
                            <label>USUARIO: </label>
                            <select id="filtro-usuario"><option value="">Todos</option>${opcionesUsuarios}</select>
                        </div>
                        <div class="form-group" style="display: flex; align-items: center; gap: 2.0rem;"><label> || </label></div>
                        <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
                            <label>DESDE: </label>
                            <input type="date" id="filtro-fecha-inicio">
                        </div>
                        <div class="form-group" style="display: flex; align-items: center; gap: 2.0rem;"><label> - </label></div>
                        <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
                            <label>HASTA: </label>
                            <input type="date" id="filtro-fecha-cierre">
                        </div>
                    </div>`;
            } catch (error) {
                console.error("Error cargando lista de usuarios:", error);
                filtrosHTML = `<p class="error">No se pudo cargar la lista de usuarios.</p>`;
            }
            break;
            
        case 'representantes':
            tituloReporte = 'REPORTE DE REPRESENTANTES REGISTRADOS';

            filtrosHTML = `
                <div class="form-grid-1-col" style="max-width: 300px;">
                    <div>
                        <label>ESTATUS: </label>
                        <select id="filtro-rep-estado">
                            <option value="Todos">Todos</option>
                            <option value="Activo">Activo</option>
                            <option value="Inactivo">Inactivo</option>
                        </select>
                    </div>
                </div>`;
            break;

        case 'alumnos':
            tituloReporte = 'REPORTE DE ALUMNOS REGISTRADOS';
            try {
                const res = await fetch('/api/configuracion/planes-activos');
                configPlanesActivos = await res.json();
                const opcionesPlanes = Object.keys(configPlanesActivos).map(plan => `<option value="${plan}">${plan}</option>`).join('');

                filtrosHTML = `
                    <div class="form-filter-row" style="display: flex; flex-wrap: wrap; justify-content: flex-start; align-items: center; gap: 1rem;">
                        <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
                            <label for="filtro-alu-estatus">ESTATUS: </label>
                            <select id="filtro-alu-estatus"><option value="">Todos</option><option value="Activo">Activo</option><option value="Inactivo">Inactivo</option></select>
                        </div>
                        <div class="form-group" style="display: flex; align-items: center; gap: 2.0rem;"><label> || </label></div>
                        <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
                            <label for="filtro-alu-plan">MODALIDAD: </label>
                            <select id="filtro-alu-plan" onchange="actualizarCursos()"><option value="">Todos</option>${opcionesPlanes}</select>
                        </div>
                        <div class="form-group" style="display: flex; align-items: center; gap: 2.0rem;"><label> - </label></div>
                        <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
                            <label for="filtro-alu-curso">CURSO: </label>
                            <select id="filtro-alu-curso" onchange="actualizarSecciones()"><option value="">Todos</option></select>
                        </div>
                        <div class="form-group" style="display: flex; align-items: center; gap: 2.0rem;"><label> - </label></div>
                        <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
                            <label for="filtro-alu-seccion">SECCIÓN: </label>
                            <select id="filtro-alu-seccion"><option value="">Todas</option></select>
                        </div>
                    </div>`;
            } catch (error) {
                console.error("Error cargando configuración para filtros de alumnos:", error);
                filtrosHTML = `<p class="error">No se pudo cargar la configuración para los filtros.</p>`;
            }
            break;
    }

    title.textContent = tituloReporte;
    body.innerHTML = `
        ${tieneFiltros ? `
        <div class="sub-form">
            <h3>Opciones de Filtrado:</h3>
            ${filtrosHTML}
            <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
                <button class="btn btn-small2 btn-blue" onclick="aplicarFiltros()">Aplicar</button>
                <button class="btn btn-small2 btn-orange" onclick="reiniciarFiltros()">Reiniciar</button>
            </div>
        </div>
        <hr>` : ''}
        <div id="reporte-acciones" style="text-align: right; margin-bottom: 15px;"></div>
        <div class="table-responsive" style="max-height: 55vh;">
            <table id="tabla-reporte" class="tabla-reporte">
                <thead id="tabla-reporte-head"></thead>
                <tbody id="tabla-reporte-body"></tbody>
            </table>
        </div>
    `;

    modal.style.display = 'flex';
    aplicarFiltros(); 
}

function reiniciarFiltros() {
    switch (tipoReporteActual) {
        case 'operaciones':
            document.getElementById('filtro-tipo-op').value = 'Todos';
            document.getElementById('filtro-fecha-inicio').value = '';
            document.getElementById('filtro-fecha-cierre').value = '';
            break;

        case 'actividad':
            document.getElementById('filtro-usuario').value = '';
            document.getElementById('filtro-fecha-inicio').value = '';
            document.getElementById('filtro-fecha-cierre').value = '';
            break;

        case 'representantes':
            document.getElementById('filtro-rep-estado').value = 'Todos';
            break;

        case 'alumnos':
            document.getElementById('filtro-alu-plan').value = '';
            document.getElementById('filtro-alu-estatus').value = '';
            actualizarCursos(); 
            break;
    }
    aplicarFiltros();
}

async function aplicarFiltros() {
    const headEl = document.getElementById('tabla-reporte-head');
    const bodyEl = document.getElementById('tabla-reporte-body');
    const accionesEl = document.getElementById('reporte-acciones');
    
    const colspan = (headEl.querySelector('tr')?.cells.length || 7);
    bodyEl.innerHTML = `<tr><td colspan="${colspan}">Cargando datos...</td></tr>`;
    headEl.innerHTML = '';
    accionesEl.innerHTML = '';

    let params = {};
    let endpoint = `/api/reportes/${tipoReporteActual}`;

    switch (tipoReporteActual) {
        case 'operaciones':
            params = {
                tipo: document.getElementById('filtro-tipo-op').value,
                fechaInicio: document.getElementById('filtro-fecha-inicio').value,
                fechaCierre: document.getElementById('filtro-fecha-cierre').value,
            };
            break;

        case 'actividad':
            params = {
                userId: document.getElementById('filtro-usuario').value,
                fechaInicio: document.getElementById('filtro-fecha-inicio').value,
                fechaCierre: document.getElementById('filtro-fecha-cierre').value,
            };
            break;
        
        case 'representantes':
            const estado = document.getElementById('filtro-rep-estado').value;
            params = { 
                estado: estado === 'Todos' ? '' : estado 
            };
            break;

        case 'alumnos':
            params = {
                plan: document.getElementById('filtro-alu-plan').value,
                curso: document.getElementById('filtro-alu-curso').value,
                seccion: document.getElementById('filtro-alu-seccion').value,
                estatus: document.getElementById('filtro-alu-estatus').value,
            };
            break;
    }
    
    const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([_, v]) => v != null && v !== ''))).toString();

    try {
        const res = await fetch(`${endpoint}?${query}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        datosReporteActual = data;
        let headers = [];
        let rowsHTML = '';

        switch(tipoReporteActual) {
            case 'operaciones':
                headers = ["Fecha", "Serial", "Tipo", "Representante", "Monto", "Usuario", "Acciones"];
                rowsHTML = data.map(item => `
                    <tr>
                        <td>${new Date(item.fecha_operacion).toLocaleString()}</td>
                        <td>${item.serial_operacion}</td>
                        <td>${item.tipo_operacion}</td>
                        <td>${item.representante} (C.I: ${item.cedula})</td>
                        <td>${formatNumber(item.total_operacion)} ${item.moneda_operacion}</td>
                        <td>${item.usuario}</td>
                        <td><button class="btn btn-small btn-blue" onclick="verDetalleOperacion(${item.id_operacion})">Detalles</button></td>
                    </tr>
                `).join('');
                break;

            case 'actividad':
                headers = ["Fecha", "Usuario", "Tipo de Actividad", "Descripción"];
                rowsHTML = data.map(item => `
                    <tr>
                        <td>${new Date(item.fecha_actividad).toLocaleString()}</td>
                        <td>${item.username}</td>
                        <td>${item.tipo_actividad}</td>
                        <td style="white-space: pre-wrap; word-break: break-word;">${item.descripcion}</td>
                    </tr>
                `).join('');
                break;
            
            case 'representantes':
                headers = ["Cédula", "Nombres", "Apellidos", "Teléfono", "Email", "N° Alumnos", "Estatus"];
                rowsHTML = data.map(item => `
                    <tr>
                        <td>${item.cedula}</td>
                        <td>${item.nombre_completo}</td>
                        <td>${item.apellido_completo}</td>
                        <td>${item.telefono || 'N/A'}</td>
                        <td>${item.email || 'N/A'}</td>
                        <td style="text-align: center;">${item.num_alumnos}</td>
                        <td><span class="${item.estado.toLowerCase()}">${item.estado}</span></td>
                    </tr>
                `).join('');
                break;

            case 'alumnos':
                headers = ["Cédula", "Nombres", "Apellidos", "Plan de Estudio", "Curso", "Sección", "Fecha de Nacimiento", "Estatus"];
                rowsHTML = data.map(item => `
                    <tr>
                        <td>${item.cedula_alumno || 'N/A'}</td>
                        <td>${item.nombre_completo_alumno}</td>
                        <td>${item.apellido_completo_alumno}</td>
                        <td>${item.plan_estudio}</td>
                        <td>${item.curso}</td>
                        <td>${item.seccion}</td>
                        <td>${new Date(item.fecha_nacimiento + 'T00:00:00').toLocaleDateString('es-ES')}</td>
                        <td><span class="${item.estatus.toLowerCase()}">${item.estatus}</span></td>
                    </tr>`).join('');
                break;
        }

        headEl.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
        bodyEl.innerHTML = rowsHTML || `<tr><td colspan="${headers.length}">No hay datos para mostrar.</td></tr>`;

        if (data.length > 0) {
            accionesEl.innerHTML = `<button class="btn btn-small btn-green"  onclick="exportarPDF()"><i class="fas fa-file-pdf"></i> Descargar PDF</button>`;
        }

    } catch (error) {
        console.error(`Error al aplicar filtros para ${tipoReporteActual}:`, error);
        bodyEl.innerHTML = `<tr><td colspan="${headEl.querySelectorAll('th').length || 7}">Error al cargar el reporte. ${error.message}</td></tr>`;
    }
}

function actualizarCursos() {
    const planSeleccionado = document.getElementById('filtro-alu-plan').value;
    const selectCurso = document.getElementById('filtro-alu-curso');
    
    selectCurso.innerHTML = '<option value="">Todos</option>';
    
    if (planSeleccionado && configPlanesActivos[planSeleccionado]) {
        const cursos = configPlanesActivos[planSeleccionado];
        const opcionesCursos = cursos.map(c => `<option value="${c.curso_nombre}">${c.curso_nombre}</option>`).join('');
        selectCurso.innerHTML += opcionesCursos;
    }
    actualizarSecciones();
}

function actualizarSecciones() {
    const planSeleccionado = document.getElementById('filtro-alu-plan').value;
    const cursoSeleccionado = document.getElementById('filtro-alu-curso').value;
    const selectSeccion = document.getElementById('filtro-alu-seccion');
    
    selectSeccion.innerHTML = '<option value="">Todas</option>';

    if (planSeleccionado && cursoSeleccionado && configPlanesActivos[planSeleccionado]) {
        const cursoConfig = configPlanesActivos[planSeleccionado].find(c => c.curso_nombre === cursoSeleccionado);
        if (cursoConfig) {
            let secciones = [];
            const cantidad = cursoConfig.seccion_cantidad || 1;
            const estilo = cursoConfig.seccion_estilo || 'Literales';
            if (cursoConfig.seccion_tipo === 'única') {
                secciones.push('A'); 
            } else if (cursoConfig.seccion_tipo === 'múltiple') {
                 for (let i = 0; i < cantidad; i++) {
                    secciones.push(estilo === 'Literales' ? String.fromCharCode(65 + i) : `${i + 1}`);
                }
            }
           
            const opcionesSecciones = secciones.map(s => `<option value="${s}">${s}</option>`).join('');
            selectSeccion.innerHTML += opcionesSecciones;
        }
    }
}

async function verDetalleOperacion(idOperacion) {
    const modal = document.getElementById('detalle-operacion-modal');
    const body = document.getElementById('detalle-operacion-body');
    body.innerHTML = '<p>Cargando detalles...</p>';
    modal.style.display = 'flex';

    try {
        const res = await fetch(`/api/operaciones/${idOperacion}/detalles`);
        if (!res.ok) throw new Error('No se pudo obtener la información.');

        const detalles = await res.json();
        let html = '<div class="list-container">';

        if (detalles.length > 0) {
            detalles.forEach(d => {
                html += `
                    <div class="list-item">
                        <div class="list-item-info">
                            <strong>${d.metodo} - ${formatNumber(d.monto)} ${d.moneda}</strong>
                            <small>
                                Tasa: ${formatNumber(d.tasa)} |
                                Ref: ${d.referencia || 'N/A'} |
                                Banco: ${d.banco || 'N/A'} |
                                Tel: ${d.telefono || 'N/A'}
                            </small>
                        </div>
                    </div>
                `;
            });
        } else {
            html += '<p>No se encontraron detalles para esta operación.</p>';
        }
        html += '</div>';
        body.innerHTML = html;

    } catch (error) {
        console.error("Error al ver detalles de operación:", error);
        body.innerHTML = `<p class="error">No se pudo cargar el detalle. ${error.message}</p>`;
    }
}

async function exportarPDF() {
    if (datosReporteActual.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }
    const endpoint = `/export/pdf/${tipoReporteActual}`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: datosReporteActual }),
        });

        if (!response.ok) {
            throw new Error('Error al generar el PDF en el servidor.');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_${tipoReporteActual}_${new Date().toISOString().slice(0,10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Error al exportar PDF:", error);
        alert("No se pudo generar el archivo PDF.");
    }
}

function formatNumber(num) {
    return (num || 0).toFixed(2).replace('.', ',');
}