function showModal(type) {
    const modal = document.getElementById("modal");
    const modalContent = document.getElementById("modal-content");
    const modalTitle = document.getElementById("modal-title");
    const modalForm = document.getElementById("modal-form");

    modalTitle.innerText = type === "register" ? "Registrarse" : "Iniciar Sesión";
    modalForm.action = type === "register" ? "/register" : "/login";
    modal.style.display = "flex";
    
    setTimeout(() => {
        modalContent.classList.add("animate");
    }, 10);
}

function hideModal() {
    const modal = document.getElementById("modal");
    const modalContent = document.getElementById("modal-content");
    modalContent.classList.remove("animate");

    setTimeout(() => {
        modal.style.display = "none";
    }, 500);
}
 
async function registrarActividad(tipoActividad, descripcion) {
    const user = JSON.parse(sessionStorage.getItem('loggedInUser'));
    if (!user) return; 

    try {
        await fetch('/api/actividad/registrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.userId,
                username: user.username,
                tipo_actividad: tipoActividad,
                descripcion: descripcion
            })
        });
    } catch (error) {
        console.error('Error al registrar actividad:', error);
    }
}

document.getElementById('modal-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const form = event.target;
    const action = form.action;
    const username = form.username.value;
    const password = form.password.value;

    fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(response => {
        return response.json().then(data => ({
            status: response.status,
            body: data
        }));
    })
    .then(async result => { 
        alert(result.body.message);

        if (result.status === 200) {
            if (result.body.message === 'Login exitoso') {
                sessionStorage.setItem('loggedInUser', JSON.stringify(result.body.user));
                await registrarActividad(
                    'Inicio de Sesión', 
                    `El usuario [${result.body.user.username}] ha iniciado sesión.`
                );

                window.location.href = '/dashboard';
            } else {
                hideModal();
            }
        }
    })
    .catch(err => {
        console.error('Error de red o de parseo:', err);
        alert('Ocurrió un error de conexión.');
    });
});

async function logout() {
    await registrarActividad(
        'Cierre de Sesión',
        `El usuario ha finalizado la sesión.`
    );

    sessionStorage.clear();
    window.location.href = '/';
}
