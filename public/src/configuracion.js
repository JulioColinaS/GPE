document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-empresa').addEventListener('click', () => {
        alert('Funcionalidad "Empresa" se implementará próximamente.');
    });

    document.getElementById('btn-moneda-precio').addEventListener('click', abrirModalMonedaPrecio);
    
    document.getElementById('btn-modalidades').addEventListener('click', abrirModalModalidades);

    document.getElementById('btn-periodo').addEventListener('click', () => {
        alert('Funcionalidad "Período" se implementará próximamente.');
    });

    const modalMonedaPrecio = document.getElementById('modal-moneda-precio');
    const closeMonedaPrecio = document.getElementById('close-moneda-precio');
    const cerrarMonedaPrecioBtn = document.getElementById('cerrar-moneda-precio-btn');
    
    closeMonedaPrecio.onclick = () => modalMonedaPrecio.style.display = 'none';
    cerrarMonedaPrecioBtn.onclick = () => modalMonedaPrecio.style.display = 'none';
    document.getElementById('guardar-moneda-precio').addEventListener('click', guardarConfigMonedaPrecio);

    const modalModalidades = document.getElementById('modal-modalidades');
    const closeModalidades = document.getElementById('close-modalidades');
    const cerrarModalidadesBtn = document.getElementById('cerrar-modalidades-btn');

    closeModalidades.onclick = () => modalModalidades.style.display = 'none';
    cerrarModalidadesBtn.onclick = () => modalModalidades.style.display = 'none';
    document.getElementById('guardar-modalidades').addEventListener('click', guardarConfigModalidades);
});

function abrirModalMonedaPrecio() {
    fetch('/api/configuracion/precios')
        .then(res => res.json())
        .then(config => {
            const modalBody = document.getElementById('body-moneda-precio');
            modalBody.innerHTML = `
                <div class="sub-form">
                    <h4>Moneda del Sistema</h4>
                    <p>Seleccione la Moneda del sistema para los cambios y precios.</p>
                    <div class="form-grid" style="grid-template-columns: 1fr 1fr; align-items: center;">
                        <div>
                            <label for="moneda_sistema">Moneda:</label>
                            <select id="moneda_sistema">
                                <option value="Bolívares (Bs)" ${config.moneda_sistema === 'Bolívares (Bs)' ? 'selected' : ''}>Bolívares (Bs)</option>
                                <option value="Dólares (USD)" ${config.moneda_sistema === 'Dólares (USD)' ? 'selected' : ''}>Dólares (USD)</option>
                            </select>
                        </div>
                        <div>
                            <label for="precio_sistema">Precio:</label>
                            <select id="precio_sistema">
                                <option value="Bolívares (Bs)" ${config.precio_sistema === 'Bolívares (Bs)' ? 'selected' : ''}>Bolívares (Bs)</option>
                                <option value="Dólares (USD)" ${config.precio_sistema === 'Dólares (USD)' ? 'selected' : ''}>Dólares (USD)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="sub-form">
                    <h4>Precios del Sistema</h4>
                    <p>Seleccione el Precio de la Matrícula y Mensualidades.</p>
                    <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
                        <div>
                           <label for="monto_matricula">Matrícula:</label>
                           <input type="text" id="monto_matricula" value="${formatNumber(config.monto_matricula)}" oninput="formatCurrency(this)">
                        </div>
                        <div>
                           <label for="monto_mensualidad">Mensualidad:</label>
                           <input type="text" id="monto_mensualidad" value="${formatNumber(config.monto_mensualidad)}" oninput="formatCurrency(this)">
                        </div>
                    </div>
                </div>

                <div class="sub-form">
                    <h4>Día de Pago</h4>
                    <p>Seleccione el Día de pagos para el ajuste del cobro mensual por el servicio.</p>
                    <div>
                        <label for="dia_cobro">Día:</label>
                        <select id="dia_cobro">
                            ${Array.from({length: 30}, (_, i) => `<option value="${i+1}" ${config.dia_cobro == (i+1) ? 'selected' : ''}>${i+1}</option>`).join('')}
                        </select>
                    </div>
                </div>
            `;
            document.getElementById('modal-moneda-precio').style.display = 'flex';
        });
}

function guardarConfigMonedaPrecio() {
    const newConfig = {
        moneda_sistema: document.getElementById('moneda_sistema').value,
        precio_sistema: document.getElementById('precio_sistema').value,
        monto_matricula: parseFormattedNumber(document.getElementById('monto_matricula').value),
        monto_mensualidad: parseFormattedNumber(document.getElementById('monto_mensualidad').value),
        dia_cobro: document.getElementById('dia_cobro').value,
    };

    fetch('/api/configuracion/precios', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(newConfig)
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        if (data.message.includes('éxito')) {
            document.getElementById('modal-moneda-precio').style.display = 'none';
        }
    });
}

function abrirModalModalidades() {
    fetch('/api/configuracion/modalidades')
        .then(res => res.json())
        .then(data => {
            const modalBody = document.getElementById('body-modalidades');
            modalBody.innerHTML = ''; 

            for (const modalidadNombre in data) {
                const modalidad = data[modalidadNombre];
                const seccionHTML = document.createElement('div');
                seccionHTML.className = 'sub-form';

                let cursosHTML = '<div class="cursos-container" style="display: ' + (modalidad.modalidad_activa ? 'block' : 'none') + ';">';
                modalidad.cursos.forEach(curso => {
                    cursosHTML += `
                        <div class="curso-config" data-id-curso="${curso.id}">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                                <strong>${curso.curso_nombre}</strong>
                                <label class="switch">
                                    <input type="checkbox" class="switch-curso" ${curso.curso_activo ? 'checked' : ''}>
                                    <span class="slider"></span>
                                </label>
                            </div>
                            <div class="seccion-config" style="display: ${curso.curso_activo ? 'block' : 'none'}; padding-left: 20px;">
                                <span>Secciones:</span>
                                <div style="display:flex; align-items:center; gap: 10px; margin-top: 5px;">
                                    <span>Única</span>
                                    <label class="switch">
                                        <input type="checkbox" class="switch-seccion-tipo" ${curso.seccion_tipo === 'varias' ? 'checked' : ''}>
                                        <span class="slider"></span>
                                    </label>
                                    <span>Varias</span>
                                </div>
                                <div class="seccion-detalle" style="display: ${curso.seccion_tipo === 'varias' ? 'flex' : 'none'}; gap:15px; align-items:center; margin-top:10px;">
                                    <label>Cantidad:</label>
                                    <input type="number" class="seccion-cantidad" value="${curso.seccion_cantidad}" min="1" style="width: 60px;">
                                    <label>Estilo:</label>
                                    <select class="seccion-estilo">
                                        <option value="Literales" ${curso.seccion_estilo === 'Literales' ? 'selected' : ''}>Literales</option>
                                        <option value="Numeros" ${curso.seccion_estilo === 'Numeros' ? 'selected' : ''}>Números</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    `;
                });
                cursosHTML += '</div>';

                seccionHTML.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4>${modalidadNombre}</h4>
                            <p style="margin:0;">Habilita la modalidad de ${modalidadNombre} en el Sistema</p>
                        </div>
                        <label class="switch">
                            <input type="checkbox" class="switch-modalidad" ${modalidad.modalidad_activa ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="cursos-wrapper" style="margin-top: 15px;">
                        ${cursosHTML}
                    </div>
                `;
                modalBody.appendChild(seccionHTML);
            }
            
            addModalidadesEventListeners();
            document.getElementById('modal-modalidades').style.display = 'flex';
        });
}

function addModalidadesEventListeners() {
    document.querySelectorAll('.switch-modalidad').forEach(sw => {
        sw.onchange = (e) => {
            const container = e.target.closest('.sub-form').querySelector('.cursos-container');
            container.style.display = e.target.checked ? 'block' : 'none';
        };
    });

    document.querySelectorAll('.switch-curso').forEach(sw => {
        sw.onchange = (e) => {
            const configContainer = e.target.closest('.curso-config').querySelector('.seccion-config');
            configContainer.style.display = e.target.checked ? 'block' : 'none';
        };
    });

    document.querySelectorAll('.switch-seccion-tipo').forEach(sw => {
        sw.onchange = (e) => {
            const detalleContainer = e.target.closest('.seccion-config').querySelector('.seccion-detalle');
            detalleContainer.style.display = e.target.checked ? 'flex' : 'none';
        };
    });
}

function guardarConfigModalidades() {
    const configsToSave = [];
    const modalidadForms = document.querySelectorAll('#body-modalidades .sub-form');

    modalidadForms.forEach(form => {
        const modalidadActiva = form.querySelector('.switch-modalidad').checked ? 1 : 0;
        
        form.querySelectorAll('.curso-config').forEach(cursoEl => {
            const config = {
                id: cursoEl.dataset.idCurso,
                modalidad_activa: modalidadActiva,
                curso_activo: cursoEl.querySelector('.switch-curso').checked ? 1 : 0,
                seccion_tipo: cursoEl.querySelector('.switch-seccion-tipo').checked ? 'varias' : 'única',
                seccion_cantidad: cursoEl.querySelector('.seccion-cantidad').value,
                seccion_estilo: cursoEl.querySelector('.seccion-estilo').value,
            };
            configsToSave.push(config);
        });
    });

    fetch('/api/configuracion/modalidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configsToSave)
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        if (data.message.includes('éxito')) {
            document.getElementById('modal-modalidades').style.display = 'none';
        }
    });
}

function formatCurrency(input) {
    let value = input.value.replace(/[^0-9,.]/g, '').replace('.', ',');
    input.value = value;
}

function formatNumber(num) {
    return (num || 0).toFixed(2).replace('.', ',');
}

function parseFormattedNumber(str) {
    return parseFloat(str.replace(',', '.')) || 0;
}