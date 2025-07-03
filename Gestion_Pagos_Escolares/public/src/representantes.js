let listaCompletaRepresentantes = [];
let alumnosTemporales = [];
let idRepresentanteEditando = null;
let estructuraEducativa = null;

document.addEventListener('DOMContentLoaded', () => {
    cargarEstadisticas();
    fetch('/api/representantes').then(res => res.json()).then(data => listaCompletaRepresentantes = data);
    fetch('/api/configuracion/planes-activos').then(res => res.json()).then(data => estructuraEducativa = data);
});

async function cargarEstadisticas() {
    try {
        const [resRepresentantes, resAlumnos] = await Promise.all([
            fetch('/api/representantes'),
            fetch('/api/alumnos/stats')
        ]);

        const representantes = await resRepresentantes.json();
        const statsAlumnos = await resAlumnos.json();
        const activosRep = representantes.filter(r => r.estado === 'Activo').length;
        document.getElementById('total-representantes').textContent = representantes.length;
        document.getElementById('activos-representantes').textContent = activosRep;
        document.getElementById('inactivos-representantes').textContent = representantes.length - activosRep;
        document.getElementById('total-alumnos').textContent = statsAlumnos.total || 0;
        document.getElementById('activos-alumnos').textContent = statsAlumnos.activos || 0;
        document.getElementById('inactivos-alumnos').textContent = statsAlumnos.inactivos || 0;
    } catch (error) {
        console.error("Error cargando estadísticas:", error);
    }
}

function cerrarModalPrincipal() {
    document.getElementById('gestion-modal').style.display = 'none';
    idRepresentanteEditando = null;
    alumnosTemporales = [];
    cargarEstadisticas();
    fetch('/api/representantes').then(res => res.json()).then(data => listaCompletaRepresentantes = data);
}

function cerrarModalSecundario() {
    document.getElementById('gestion-modal-secundario').style.display = 'none';
}

function abrirModalConContenido(titulo, contenidoHTML, esSecundario = false) {
    const modalId = esSecundario ? 'gestion-modal-secundario' : 'gestion-modal';
    const modalContent = document.getElementById(esSecundario ? 'gestion-modal-content-secundario' : 'gestion-modal-content');
    document.getElementById(esSecundario ? 'modal-title-secundario' : 'modal-title').innerText = titulo;
    document.getElementById(esSecundario ? 'modal-body-secundario' : 'modal-body').innerHTML = contenidoHTML;
    document.getElementById(modalId).style.display = 'flex';
}

async function abrirModal(modo, id = null) {
    switch (modo) {
        case 'agregar':
            abrirModalAgregarEditar();
            break;

        case 'modificar':
            abrirModalListado('modificar', 'Modificar Representante');
            break;

        case 'estado':
            abrirModalListado('estado', 'Cambiar Estado de Representante y Alumnos');
            break;

        case 'editar-form':
            await abrirModalAgregarEditar(id, true);
            break;

        case 'estado-alumno':
            await abrirModalEstadoAlumnos(id);
            break;
    }
}

function abrirModalListado(modo, titulo) {
    const contenido = `
        <div class="modal-search-bar">
            <input type="text" id="cedula-buscar" placeholder="Buscar por Cédula..." oninput="this.value = this.value.replace(/[^0-9]/g, '')">
            <button class="btn btn-small2 btn-blue" onclick="filtrarLista('${modo}')"><i class="fas fa-search"></i> Buscar</button>
            <button class="btn btn-small2 btn-orange" onclick="renderizarLista(listaCompletaRepresentantes, '${modo}')"><i class="fas fa-sync-alt"></i> Reiniciar</button>
        </div>
        <div class="list-container" id="lista-container"></div>
    `;
    abrirModalConContenido(titulo, contenido);
    renderizarLista(listaCompletaRepresentantes, modo);
}

function filtrarLista(modo) {
    const cedula = document.getElementById('cedula-buscar').value;
    const filtrados = listaCompletaRepresentantes.filter(r => r.cedula.includes(cedula));
    renderizarLista(filtrados, modo);
}

function renderizarLista(representantes, modo) {
    const container = document.getElementById('lista-container');
    container.innerHTML = representantes.length === 0 ? '<p>No se encontraron representantes.</p>' : '';

    representantes.forEach(rep => {
        const item = document.createElement('div');
        item.className = 'list-item';
        
        const nombreCompleto = `${rep.primer_nombre} ${rep.segundo_nombre || ''} ${rep.primer_apellido} ${rep.segundo_apellido || ''}`.replace(/\s+/g, ' ').trim();
        const estadoClass = rep.estado === 'Activo' ? 'status-activo' : 'status-inactivo';
        
        let actionButtonsHTML = '';
        if (modo === 'modificar') {
            actionButtonsHTML = `<button class="btn btn-small btn-orange" onclick="abrirModal('editar-form', ${rep.id_representante})"><i class="fas fa-edit"></i> EDITAR</button>`;
        } else { 
            const isChecked = rep.estado === 'Activo' ? 'checked' : '';
            actionButtonsHTML = `
                <button class="btn btn-small btn-blue" onclick="abrirModal('estado-alumno', ${rep.id_representante})" title="Gestionar Alumnos"><i class="fas fa-users"></i> GESTIONAR</button>
                <div class="switch-container">
                    <label class="switch">
                        <input type="checkbox" onchange="cambiarEstadoRepresentante(${rep.id_representante}, this.checked, '${rep.cedula}')" ${isChecked}>
                        <span class="slider"></span>
                    </label>
                </div>
            `;
        }

        item.innerHTML = `
            <div class="list-item-info">
                <strong>${nombreCompleto}</strong>
                <small>C.I: ${rep.cedula} | Alumnos: ${rep.num_alumnos} | Estado: <span id="estado-text-${rep.id_representante}" class="${estadoClass}">${rep.estado}</span></small>
            </div>
            <div class="list-item-actions">${actionButtonsHTML}</div>`;
        container.appendChild(item);
    });
}

async function abrirModalAgregarEditar(id = null, desdeListado = false) {
    idRepresentanteEditando = id;
    let titulo = 'Agregar Nuevo Representante';
    let repData = {};

    if (id) {
        titulo = 'Modificar Representante';
        const [resRep, resAlu] = await Promise.all([fetch(`/api/representantes/${id}`), fetch(`/api/representantes/${id}/alumnos`)]);
        repData = await resRep.json();
        alumnosTemporales = await resAlu.json();
    } else {
        alumnosTemporales = [];
    }
    
    const contenido = `
        <form id="form-representante" onsubmit="guardarRepresentante(event)">
            <h4>Datos del Representante</h4>
            <div class="form-grid-3-cols" oninput="validarFormularioRepresentante()">
                ${createFormField('Primer Nombre', 'primer_nombre', repData.primer_nombre, 'text', true, 'letters')}
                ${createFormField('Segundo Nombre', 'segundo_nombre', repData.segundo_nombre, 'text', false, 'letters')}
                ${createFormField('Primer Apellido', 'primer_apellido', repData.primer_apellido, 'text', true, 'letters')}
                ${createFormField('Segundo Apellido', 'segundo_apellido', repData.segundo_apellido, 'text', false, 'letters')}
                ${createFormField('Cédula de Identidad', 'cedula', repData.cedula, 'text', true, 'numbers')}
                ${createFormField('Género', 'genero', repData.genero, 'select', true, '', ['Masculino', 'Femenino'])}
                ${createFormField('Teléfono', 'telefono', repData.telefono, 'text', false, 'numbers')}
                ${createFormField('Correo Electrónico', 'email', repData.email, 'email', false, 'email')}
            </div>
            <div class="form-grid">${createFormField('Domicilio', 'domicilio', repData.domicilio, 'text')}</div>
            <hr>
            <h4>Alumnos Asociados</h4>
            <div id="lista-alumnos-temp" class="list-container" style="max-height: 20vh; background: #f9f9f9;"></div>
            <div id="sub-form-alumno-container" class="sub-form" style="display:none;"></div>
            <div style="text-align: left; margin-top: 15px;">
                <button type="button" id="btn-agregar-alumno" class="btn btn-small btn-blue btn-disabled" onclick="mostrarFormularioAlumno()">
                    <i class="fas fa-plus"></i> Agregar Alumno
                </button>
            </div>
            <div class="modal-footer">
                 <button type="submit" class="btn btn-green"><i class="fas fa-save"></i> ${id ? 'Guardar Cambios' : 'Guardar Representante'}</button>
            </div>
        </form>
    `; 
    abrirModalConContenido(titulo, contenido, desdeListado);
    actualizarListaAlumnosTemp();
    validarFormularioRepresentante();
}

function validarFormularioRepresentante() {
    const btn = document.getElementById('btn-agregar-alumno');
    const form = document.getElementById('form-representante');
    const requiredInputs = form.querySelectorAll('[required]');
    let allValid = true;
    requiredInputs.forEach(input => {
        if (!input.value) allValid = false;
    });
    btn.classList.toggle('btn-disabled', !allValid);
}

function mostrarFormularioAlumno(alumno = null, index = null) {
    const container = document.getElementById('sub-form-alumno-container');
    const esEdicion = alumno !== null;

    container.innerHTML = `
        <div id="alumno-form-container">
            <h5>${esEdicion ? 'Editando Alumno' : 'Datos del Nuevo Alumno'}</h5>
             <div class="form-grid-3-cols">
                ${createFormField('Primer Nombre', 'alumno-primer-nombre', alumno?.primer_nombre, 'text', true, 'letters')}
                ${createFormField('Segundo Nombre', 'alumno-segundo-nombre', alumno?.segundo_nombre, 'text', false, 'letters')}
                ${createFormField('Primer Apellido', 'alumno-primer-apellido', alumno?.primer_apellido, 'text', true, 'letters')}
                ${createFormField('Segundo Apellido', 'alumno-segundo-apellido', alumno?.segundo_apellido, 'text', false, 'letters')}
                ${createFormField('Cédula de Identidad', 'alumno-cedula', alumno?.cedula, 'text', false, 'numbers')}
                ${createFormField('Genero', 'alumno-genero', alumno?.genero, 'select', true, '', ['Masculino', 'Femenino'])}
            </div>
            <div class="form-grid-3-cols">
                ${createFormField('Fecha de Nacimiento', 'alumno-fecha-nacimiento', alumno?.fecha_nacimiento, 'date', true)}
                ${createFormField('Plan de Estudio', 'alumno-plan-estudio', alumno?.plan_estudio, 'select', true, '', Object.keys(estructuraEducativa))}
                ${createFormField('Curso', 'alumno-curso', alumno?.curso, 'select', true)}
            </div>
             <div class="form-grid-3-cols">
                 ${createFormField('Sección', 'alumno-seccion', alumno?.seccion, 'select', true)}
            </div>
            <div style="text-align: right; margin-top:15px; display:flex; gap:10px; justify-content:flex-end;">
                 <button type="button" class="btn btn-small btn-green" onclick="agregarOEditarAlumnoTemp(${esEdicion ? index : null})">${esEdicion ? 'Actualizar Alumno' : 'Añadir a la lista'}</button>
                 <button type="button" class="btn btn-small btn-red" onclick="cancelarFormularioAlumno()">Cancelar</button>
            </div>
        </div>
    `;
    container.style.display = 'block';

    const planSelect = document.getElementById('alumno-plan-estudio');
    const cursoSelect = document.getElementById('alumno-curso');
    
    planSelect.onchange = () => populateCursos(planSelect.value);
    cursoSelect.onchange = () => populateSecciones(planSelect.value, cursoSelect.value);

    if (esEdicion) {
        populateCursos(alumno.plan_estudio, alumno.curso);
        populateSecciones(alumno.plan_estudio, alumno.curso, alumno.seccion);
    }
}

function cancelarFormularioAlumno() {
    const container = document.getElementById('sub-form-alumno-container');
    container.innerHTML = '';
    container.style.display = 'none';
}

function agregarOEditarAlumnoTemp(index = null) {
    const alumno = {
        primer_nombre: document.getElementById('alumno-primer-nombre').value,
        segundo_nombre: document.getElementById('alumno-segundo-nombre').value,
        primer_apellido: document.getElementById('alumno-primer-apellido').value,
        segundo_apellido: document.getElementById('alumno-segundo-apellido').value,
        cedula: document.getElementById('alumno-cedula').value || null,
        genero: document.getElementById('alumno-genero').value,
        fecha_nacimiento: document.getElementById('alumno-fecha-nacimiento').value,
        plan_estudio: document.getElementById('alumno-plan-estudio').value,
        curso: document.getElementById('alumno-curso').value,
        seccion: document.getElementById('alumno-seccion').value
    };

    if (!alumno.primer_nombre || !alumno.primer_apellido || !alumno.fecha_nacimiento || !alumno.plan_estudio || !alumno.curso || !alumno.seccion) {
        alert("Todos los campos del alumno son requeridos, excepto segundo nombre, segundo apellido y cédula.");
        return;
    }
    
    if (index !== null) {
        alumnosTemporales[index] = { ...alumnosTemporales[index], ...alumno };
    } else {
        alumno.estatus = 'Activo'; 
        alumnosTemporales.push(alumno);
    }
    
    actualizarListaAlumnosTemp();
    cancelarFormularioAlumno();
}

function eliminarAlumnoTemp(index) {
    if (confirm(`¿Está seguro de que desea eliminar a este alumno de la lista?`)) {
        alumnosTemporales.splice(index, 1);
        actualizarListaAlumnosTemp();
    }
}

function actualizarListaAlumnosTemp() {
    const container = document.getElementById('lista-alumnos-temp');
    container.innerHTML = alumnosTemporales.length === 0 ? '<p>No hay alumnos asociados.</p>' : '';
    alumnosTemporales.forEach((alu, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        const nombreCompleto = `${alu.primer_nombre} ${alu.segundo_nombre || ''} ${alu.primer_apellido} ${alu.segundo_apellido || ''}`.replace(/\s+/g, ' ').trim();

        item.innerHTML = `
            <div class="list-item-info">
                <strong>${nombreCompleto}</strong>
                <small>Curso: ${alu.curso} - Sección: ${alu.seccion}</small>
            </div>
            <div class="list-item-actions">
                <button type="button" class="btn btn-small btn-orange" onclick='mostrarFormularioAlumno(${JSON.stringify(alu)}, ${index})'><i class="fas fa-pencil-alt"></i> EDITAR</button>
                <button type="button" class="btn btn-small btn-red" onclick="eliminarAlumnoTemp(${index})"><i class="fas fa-trash"></i> ELIMINAR</button>
            </div>
        `;
        container.appendChild(item);
    });
}

async function guardarRepresentante(event) {
    event.preventDefault();
    const user = JSON.parse(sessionStorage.getItem('loggedInUser'));
    if (!user) return alert("Error de sesión. Inicie sesión de nuevo.");

    const representanteData = {
        primer_nombre: document.getElementById('primer_nombre').value,
        segundo_nombre: document.getElementById('segundo_nombre').value,
        primer_apellido: document.getElementById('primer_apellido').value,
        segundo_apellido: document.getElementById('segundo_apellido').value,
        cedula: document.getElementById('cedula').value,
        genero: document.getElementById('genero').value,
        telefono: document.getElementById('telefono').value,
        email: document.getElementById('email').value,
        domicilio: document.getElementById('domicilio').value,
        user: user
    };

    let url, method, body;
    if (idRepresentanteEditando) { 
        method = 'PUT';
        url = `/api/representantes/${idRepresentanteEditando}`;
        body = {
            ...representanteData,
            alumnos: alumnosTemporales.filter(a => a.id_alumno), 
            alumnos_nuevos: alumnosTemporales.filter(a => !a.id_alumno) 
        };
    } else { 
        method = 'POST';
        url = '/api/representantes';
        body = { ...representanteData, alumnos: alumnosTemporales };
    }
    
    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Error del servidor');
        
        alert(result.message);
        cerrarModalSecundario();
        cerrarModalPrincipal();
        
    } catch (error) {
        alert(`Error al guardar: ${error.message}`);
    }
}

function cambiarEstadoRepresentante(id, esActivo, cedula) {
    const nuevoEstado = esActivo ? 'Activo' : 'Inactivo';
    const user = JSON.parse(sessionStorage.getItem('loggedInUser'));
    if (!user) return alert("Error de sesión.");

    fetch(`/api/representantes/${id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado, user, cedula })
    })
    .then(res => res.json())
    .then(data => {
        const repIndex = listaCompletaRepresentantes.findIndex(r => r.id_representante === id);
        if (repIndex > -1) listaCompletaRepresentantes[repIndex].estado = nuevoEstado;
        renderizarLista(listaCompletaRepresentantes, 'estado');
        cargarEstadisticas();
    });
}

async function abrirModalEstadoAlumnos(id_representante) {
    const [resRep, resAlu] = await Promise.all([fetch(`/api/representantes/${id_representante}`), fetch(`/api/representantes/${id_representante}/alumnos`)]);
    const repData = await resRep.json();
    const alumnos = await resAlu.json();
    const nombreCompletoRep = `${repData.primer_nombre} ${repData.primer_apellido}`.trim();

    let alumnosHTML = '<div class="list-container">';
    if (alumnos.length > 0) {
        alumnos.forEach(alu => {
            const isChecked = alu.estatus === 'Activo' ? 'checked' : '';
            const nombreCompletoAlu = `${alu.primer_nombre} ${alu.segundo_nombre || ''} ${alu.primer_apellido} ${alu.segundo_apellido || ''}`.trim();
            const estadoClass = alu.estatus === 'Activo' ? 'status-activo' : 'status-inactivo';
            alumnosHTML += `
                <div class="list-item">
                    <div class="list-item-info">
                        <strong>${nombreCompletoAlu}</strong>
                        <small>Curso: ${alu.curso} | Sección: ${alu.seccion} | Estado: <span id="estado-alu-text-${alu.id_alumno}" class="${estadoClass}">${alu.estatus}</span></small>
                    </div>
                    <div class="list-item-actions">
                         <div class="switch-container">
                            <label class="switch">
                                <input type="checkbox" onchange="cambiarEstadoAlumno(${alu.id_alumno}, this.checked, 'estado-alu-text-${alu.id_alumno}')" ${isChecked}>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                </div>`;
        });
    } else {
        alumnosHTML += '<p>Este representante no tiene alumnos registrados.</p>';
    }
    alumnosHTML += '</div>';

    const contenido = `
        <div class="sub-form">
            <h4>Información del Representante</h4>
            <p><strong>Nombre:</strong> ${nombreCompletoRep}</p>
            <p><strong>C.I:</strong> ${repData.cedula}</p>
        </div>
        <h4>Gestionar Estado de Alumnos</h4>
        ${alumnosHTML}`;
    abrirModalConContenido(`Gestionar Alumnos`, contenido, true);
}

function cambiarEstadoAlumno(id_alumno, esActivo, textElementId) {
    const nuevoEstado = esActivo ? 'Activo' : 'Inactivo';
    const user = JSON.parse(sessionStorage.getItem('loggedInUser'));
    if (!user) return alert("Error de sesión.");

    fetch(`/api/alumnos/${id_alumno}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estatus: nuevoEstado, user })
    })
    .then(res => res.ok ? res.json() : Promise.reject('Error al actualizar'))
    .then(data => {
        const textElement = document.getElementById(textElementId);
        textElement.textContent = nuevoEstado;
        textElement.className = nuevoEstado === 'Activo' ? 'status-activo' : 'status-inactivo';
        cargarEstadisticas(); 
    })
    .catch(err => {
        alert('Error al cambiar estado del alumno.');
        const checkbox = document.querySelector(`[onchange*="cambiarEstadoAlumno(${id_alumno}"]`);
        if(checkbox) checkbox.checked = !esActivo;
    });
}

function createFormField(label, id, value = '', type = 'text', required = false, validation = '', options = []) {
    const req = required ? 'required' : '';
    let validationAttrs = '';
    if (validation === 'numbers') validationAttrs = `oninput="this.value = this.value.replace(/[^0-9]/g, '')"`;
    if (validation === 'letters') validationAttrs = `oninput="this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\\s]/g, '')"`;

    let inputHTML = '';
    if (type === 'select') {
        inputHTML = `<select id="${id}" ${req}>
            <option value="">-- Seleccione --</option>
            ${options.map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`).join('')}
        </select>`;
    } else {
        const style = type === 'text' ? 'text-transform: uppercase;' : '';
        inputHTML = `<input type="${type}" id="${id}" value="${value || ''}" ${req} ${validationAttrs} style="${style}">`;
    }
    return `<div class="form-field"><label for="${id}">${label}${required ? ' *' : ''}:</label>${inputHTML}</div>`;
}

function populateCursos(plan, cursoSeleccionado = '') {
    const cursoSelect = document.getElementById('alumno-curso');
    cursoSelect.innerHTML = '<option value="">-- Seleccione un Curso --</option>';
    if (plan && estructuraEducativa[plan]) {
        estructuraEducativa[plan].forEach(curso => {
            cursoSelect.innerHTML += `<option value="${curso.curso_nombre}" ${curso.curso_nombre === cursoSeleccionado ? 'selected' : ''}>${curso.curso_nombre}</option>`;
        });
    }
    if(cursoSeleccionado) cursoSelect.dispatchEvent(new Event('change'));
}

function populateSecciones(plan, curso, seccionSeleccionada = '') {
    const seccionSelect = document.getElementById('alumno-seccion');
    seccionSelect.innerHTML = '<option value="">-- Seleccione Sección --</option>';

    if (!plan || !curso || !estructuraEducativa[plan]) return;
    
    const cursoConfig = estructuraEducativa[plan].find(c => c.curso_nombre === curso);
    if (!cursoConfig) return;

    if (cursoConfig.seccion_tipo === 'única') {
        seccionSelect.innerHTML += `<option value="única" selected>A</option>`;
    } else {
        const cantidad = cursoConfig.seccion_cantidad;
        if (cursoConfig.seccion_estilo === 'Literales') {
            const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
            for (let i = 0; i < cantidad && i < letras.length; i++) {
                seccionSelect.innerHTML += `<option value="${letras[i]}" ${letras[i] === seccionSeleccionada ? 'selected' : ''}>${letras[i]}</option>`;
            }
        } else {
             for (let i = 1; i <= cantidad; i++) {
                seccionSelect.innerHTML += `<option value="${i}" ${i == seccionSeleccionada ? 'selected' : ''}>${i}</option>`;
            }
        }
    }
}
