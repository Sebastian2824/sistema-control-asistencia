// ==============================================
// CONTROLLER: GestionUsuariosController
// Responsabilidad: Gestionar el CRUD de usuarios
// Depende de: AuthService, UsuarioService
// ==============================================

const OPTIMIZACION_USUARIO = {
    REGISTROS_POR_PAGINA: 10 // Aumentado para la nueva tabla
};

class GestionUsuariosController {

    constructor(authService, usuarioService, config) {
        this.auth = authService;
        this.usuarioService = usuarioService;
        this.config = config || {};

        this._cachePasswords = {};

        this.usuarioActual = null;
        this.usuarios = [];
        this.usuariosEliminados = [];
        this.usuarioAEliminar = null;
        this.usuarioARestaurar = null;

        // Paginación (Principal)
        this.paginaActual = 1;
        this.registrosPorPagina = OPTIMIZACION_USUARIO.REGISTROS_POR_PAGINA;
        this.totalPaginas = 1;

        // Paginación (eliminados)
        this.paginaEliminadosActual = 1;
        this.eliminadosPorPagina = 5;
        this.totalPaginasEliminados = 1;

        // Filtros y búsqueda
        this.filtroRolActual = 'todos';
        this.terminoBusqueda = '';

        this._cachearDOM();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    _cachearDOM() {
        // Header
        this.userNameDisplay = document.getElementById('displayUserName');
        this.userRoleDisplay = document.getElementById('displayUserRole');
        this.dropdownUserName = document.getElementById('dropdownUserName');
        this.dropdownUserEmail = document.getElementById('dropdownUserEmail');
        this.dropdownUserRole = document.getElementById('dropdownUserRole');
        this.userMenu = document.getElementById('userMenu');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.menuBtn = document.getElementById('menuBtn');
        this.perfilBtn = document.getElementById('perfilBtn');
        this.logoArea = document.getElementById('logoArea');

        // Tabla y botones
        this.tablaBody = document.getElementById('tablaUsuariosBody');
        this.btnAgregar = document.getElementById('btnAgregar');
        this.btnVerEliminados = document.getElementById('btnVerEliminados');

        // Filtros
        this.filtroRol = document.getElementById('filtroRol');
        this.buscadorUsuarios = document.getElementById('buscadorUsuarios');
        this.btnLimpiarBusqueda = document.getElementById('btnLimpiarBusqueda');

        // Modales
        this.modalRegistro = document.getElementById('modalRegistro');
        this.modalEditar = document.getElementById('modalEditar');
        this.modalConfirmar = document.getElementById('modalConfirmar');
        this.modalEliminados = document.getElementById('modalEliminados');
        this.modalRestaurar = document.getElementById('modalRestaurar');
        this.modalDetalles = document.getElementById('modalDetalles');
        this.modalCarga = document.getElementById('modalCarga');

        // Formularios y sus botones
        this.registroForm = document.getElementById('registroForm');
        this.editarForm = document.getElementById('editarForm');
    }

    async init() {
        if (!this.auth || !this.auth.verificarSesion()) {
            window.location.replace(this.config.ROUTES.LOGIN);
            return;
        }
        this.usuarioActual = this.auth.getUsuarioLogueado();
        const rol = String(this.usuarioActual.rol || this.usuarioActual.Rol || '').toUpperCase();
        if (rol !== 'ADMINISTRADOR' && rol !== 'SUPERADMIN') {
            this.mostrarMensaje('Acceso denegado.', 'error');
            setTimeout(() => window.location.href = this.config.ROUTES.MENU, 1500);
            return;
        }

        this.actualizarHeader();
        this.configurarEventos();
        this.crearControlesPaginacion();

        this.mostrarCarga('Cargando usuarios...', 'Consultando servidor...', 20);

        // 🔥 NUEVO: Cargar catálogos primero (para que Detalles funcione siempre)
        try {
            const [sucursales, areas] = await Promise.all([
                this.usuarioService.getSucursales(),
                this.usuarioService.getAreas()
            ]);
            this._cacheSucursales = sucursales.data || [];
            this._cacheAreas = areas.data || [];
        } catch (e) {
            console.warn('⚠️ Error al precargar catálogos:', e);
        }

        await this.cargarUsuarios();
        this.ocultarCarga();
        this.auth.prevenirNavegacionAtras();
    }

    actualizarHeader() {
        const u = this.usuarioActual;
        const nombreCompleto = `${u.nombres || ''} ${u.apellidos || ''}`.trim();
        if (this.userNameDisplay) this.userNameDisplay.textContent = nombreCompleto;
        if (this.dropdownUserName) this.dropdownUserName.textContent = nombreCompleto;
        if (this.dropdownUserEmail) this.dropdownUserEmail.textContent = u.correo || '';
        if (this.userRoleDisplay) this.userRoleDisplay.textContent = u.rol || 'Usuario';
        if (this.dropdownUserRole) this.dropdownUserRole.textContent = u.rol || 'Usuario';
    }

    configurarEventos() {
        // Header
        if (this.userMenu) this.userMenu.addEventListener('click', (e) => { e.stopPropagation(); this.userMenu.classList.toggle('active'); });
        document.addEventListener('click', () => { if (this.userMenu) this.userMenu.classList.remove('active'); });
        if (this.logoutBtn) this.logoutBtn.addEventListener('click', () => this.cerrarSesion());
        if (this.menuBtn) this.menuBtn.addEventListener('click', () => window.location.href = this.config.ROUTES.MENU);
        if (this.perfilBtn) this.perfilBtn.addEventListener('click', () => window.location.href = this.config.ROUTES.PERFIL);
        if (this.logoArea) this.logoArea.addEventListener('click', () => window.location.href = this.config.ROUTES.MENU);

        // Botones principales
        if (this.btnAgregar) this.btnAgregar.addEventListener('click', () => this.abrirModalAgregar());
        if (this.btnVerEliminados) this.btnVerEliminados.addEventListener('click', () => this.abrirModalEliminados());

        // Filtros
        if (this.filtroRol) this.filtroRol.addEventListener('change', (e) => { this.filtroRolActual = e.target.value; this.aplicarFiltrosYRenderizar(); });
        if (this.buscadorUsuarios) this.buscadorUsuarios.addEventListener('input', (e) => { this.terminoBusqueda = e.target.value.trim(); this.aplicarFiltrosYRenderizar(); });
        if (this.btnLimpiarBusqueda) this.btnLimpiarBusqueda.addEventListener('click', () => { this.buscadorUsuarios.value = ''; this.terminoBusqueda = ''; this.aplicarFiltrosYRenderizar(); });

        // Formularios
        if (this.registroForm) this.registroForm.addEventListener('submit', (e) => this.guardarRegistro(e));
        if (this.editarForm) this.editarForm.addEventListener('submit', (e) => this.guardarEdicion(e));

        // Cierres de modales
        document.querySelectorAll('.close-modal, .btn-secondary[id^="btnCancelar"], #btnCerrarDetalles').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal.active').forEach(modal => modal.classList.remove('active'));
            });
        });

        // Confirmaciones
        document.getElementById('btnConfirmarEliminar').addEventListener('click', () => this.confirmarEliminar());
        document.getElementById('btnConfirmarRestaurar').addEventListener('click', () => this.confirmarRestaurar());

        // Toggle passwords
        // ============================================
        // TOGGLE DE CONTRASEÑA (inputs en modales) — igual que login/perfil
        // ============================================
        document.querySelectorAll('.toggle-password').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const targetId = btn.dataset.target;
                if (!targetId) return;

                const input = document.getElementById(targetId);
                const icon = btn.querySelector('i');
                if (!input || !icon) return;

                const esPassword = input.type === 'password';
                input.type = esPassword ? 'text' : 'password';
                icon.classList.toggle('fa-eye', !esPassword);
                icon.classList.toggle('fa-eye-slash', esPassword);
                btn.setAttribute('aria-label', esPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
            });
        });

        // ============================================
        // TOGGLE DE CONTRASEÑA (tabla) — DELEGACIÓN DE EVENTOS
        // Se usa delegación porque las filas se re-renderizan
        // ============================================
        if (!this._toggleTablaBound) {
            this._toggleTablaBound = true;
            this.tablaBody?.addEventListener('click', async (e) => {
                const btn = e.target.closest('.toggle-table-password');
                if (!btn) return;

                e.preventDefault();
                e.stopPropagation();

                const userId = btn.dataset.id;
                const span = document.querySelector(`.password-text[data-id="${userId}"]`);
                const icon = btn.querySelector('i');
                if (!span || !icon) return;

                // Si ya está visible, ocultar
                if (span.textContent !== '••••••') {
                    span.textContent = '••••••';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                    btn.setAttribute('aria-label', 'Mostrar contraseña');
                    btn.setAttribute('title', 'Mostrar contraseña');
                    return;
                }

                // Mostrar → llamar al backend (con caché en memoria)
                btn.disabled = true;
                const originalHTML = icon.outerHTML;

                try {
                    // Verificar caché en memoria
                    this._cachePasswords = this._cachePasswords || {};
                    let password = this._cachePasswords[userId];

                    if (password === undefined) {
                        const adminId = this.usuarioActual?.IdUsuario;
                        if (!adminId) {
                            this.mostrarMensaje('Sesión no válida. Recargue la página.', 'error');
                            return;
                        }

                        const r = await this.usuarioService.getPasswordDesencriptada(userId, adminId);

                        if (!r.success) {
                            // Manejar errores específicos
                            if (r.codigo === 'ROL_NO_AUTORIZADO' || r.errorType === 'FORBIDDEN') {
                                this.mostrarMensaje('No tiene permisos de administrador para ver contraseñas.', 'error');
                            } else if (r.codigo === 'NO_AUTENTICADO' || r.errorType === 'UNAUTHORIZED') {
                                this.mostrarMensaje('Sesión inválida. Recargue la página.', 'error');
                            } else {
                                this.mostrarMensaje(`${r.error || 'No se pudo obtener la contraseña'}`, 'error');
                            }
                            return;
                        }

                        if (!r.tienePassword || !r.password) {
                            this.mostrarMensaje('Este usuario no tiene contraseña configurada.', 'warning');
                            return;
                        }

                        password = r.password;
                        // Caché en memoria (se borra al recargar la página)
                        this._cachePasswords[userId] = password;
                    }

                    span.textContent = password;
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                    btn.setAttribute('aria-label', 'Ocultar contraseña');
                    btn.setAttribute('title', 'Ocultar contraseña');

                } catch (err) {
                    console.error('❌ Error obteniendo contraseña:', err);
                    this.mostrarMensaje('Error de conexión al obtener la contraseña.', 'error');
                } finally {
                    btn.disabled = false;
                    if (icon) icon.outerHTML = originalHTML;
                }
            });
        }

        const regNombres = document.getElementById('reg_nombres');
        const regApellidos = document.getElementById('reg_apellidos');
        const regLogin = document.getElementById('reg_login');

        const generarLogin = () => {
            const nombre = regNombres?.value.trim() || '';
            const apellido = regApellidos?.value.trim() || '';

            if (nombre && apellido) {
                const primerLetraNombre = nombre.charAt(0);
                const cuatroLetrasApellido = apellido.substring(0, 4);

                // Limpiar espacios o caracteres especiales y convertir a MAYÚSCULAS
                const loginGenerado = `${primerLetraNombre}${cuatroLetrasApellido}`
                    .replace(/\s+/g, '')
                    .toUpperCase(); // 🔥 Aquí forzamos mayúsculas

                if (regLogin) regLogin.value = loginGenerado;
            } else {
                if (regLogin) regLogin.value = '';
            }
        };

        if (regNombres) regNombres.addEventListener('input', generarLogin);
        if (regApellidos) regApellidos.addEventListener('input', generarLogin);

        // ============================================
        // PAGINACIÓN DE ELIMINADOS
        // ============================================
        const btnPrimeraElim = document.getElementById('btnPrimeraEliminados');
        const btnAnteriorElim = document.getElementById('btnAnteriorEliminados');
        const btnSiguienteElim = document.getElementById('btnSiguienteEliminados');
        const btnUltimaElim = document.getElementById('btnUltimaEliminados');

        if (btnPrimeraElim) btnPrimeraElim.addEventListener('click', () => this.irPrimeraEliminados());
        if (btnAnteriorElim) btnAnteriorElim.addEventListener('click', () => this.irAnteriorEliminados());
        if (btnSiguienteElim) btnSiguienteElim.addEventListener('click', () => this.irSiguienteEliminados());
        if (btnUltimaElim) btnUltimaElim.addEventListener('click', () => this.irUltimaEliminados());

    }

    async cargarUsuarios() {
        const r = await this.usuarioService.getAll();
        if (r.success) {
            this.usuarios = r.data.filter(u => u.IdEstado === 1);
            this.usuariosEliminados = r.data.filter(u => u.IdEstado === 2); // En tu backend, 2 es ELIMINADO
            this.aplicarFiltrosYRenderizar();
        } else {
            this.mostrarMensaje(`Error al cargar usuarios: ${r.error}`, 'error');
        }
    }

    aplicarFiltrosYRenderizar() {
        let lista = [...this.usuarios];

        // Filtrar por rol
        if (this.filtroRolActual !== 'todos') {
            lista = lista.filter(u => u.Rol === this.filtroRolActual);
        }

        // Filtrar por búsqueda
        if (this.terminoBusqueda) {
            const termino = this.normalizarTexto(this.terminoBusqueda);
            lista = lista.filter(u =>
                this.normalizarTexto(u.Nombres).includes(termino) ||
                this.normalizarTexto(u.Apellidos).includes(termino) ||
                this.normalizarTexto(u.NombreUsuario).includes(termino) ||
                this.normalizarTexto(u.Correo).includes(termino)
            );
        }

        // Ordenar
        lista.sort((a, b) => {
            if (a.IdUsuario === this.usuarioActual.IdUsuario) return -1;
            if (b.IdUsuario === this.usuarioActual.IdUsuario) return 1;
            return b.IdUsuario - a.IdUsuario;
        });

        // Paginar
        this.totalPaginas = Math.ceil(lista.length / this.registrosPorPagina) || 1;
        this.paginaActual = Math.min(this.paginaActual, this.totalPaginas);

        const inicio = (this.paginaActual - 1) * this.registrosPorPagina;
        const pagina = lista.slice(inicio, inicio + this.registrosPorPagina);

        this.renderizarTabla(pagina);
        this.actualizarControlesPaginacion();
    }

    renderizarTabla(usuarios) {
        if (!this.tablaBody) return;

        if (usuarios.length === 0) {
            let mensajeVacio = 'No hay usuarios registrados';
            if (this.terminoBusqueda) {
                mensajeVacio = `<i class="fas fa-search"></i> No se encontraron usuarios que coincidan con "<strong>${this._escape(this.terminoBusqueda)}</strong>"`;
            } else if (this.filtroRolActual && this.filtroRolActual !== 'todos') {
                mensajeVacio = `<i class="fas fa-filter"></i> No hay usuarios con el rol "<strong>${this._escape(this.filtroRolActual)}</strong>"`;
            }
            this.tablaBody.innerHTML = `<tr><td colspan="8" class="loading">${mensajeVacio}</td></tr>`;
            return;
        }

        this.tablaBody.innerHTML = '';

        usuarios.forEach(u => {
            const row = document.createElement('tr');
            const esUsuarioActual = u.IdUsuario === this.usuarioActual.IdUsuario;
            const rolClass = ['ADMINISTRADOR', 'SUPERADMIN'].includes(u.Rol)
                ? 'badge-administrador'
                : 'badge-counter';

            // SIN comentarios HTML internos
            row.innerHTML = `
            <td>${u.IdUsuario}</td>
            <td>${this._escape(u.Nombres)}</td>
            <td>${this._escape(u.Apellidos)}</td>
            <td>${this._escape(u.NombreUsuario)}</td>
            <td><span class="badge ${rolClass}">${this._escape(u.Rol)}</span></td>
            <td>${this._escape(u.Correo)}</td>
            <td class="password-cell">
                <div class="password-wrapper-table">
                    <span class="password-text" data-id="${u.IdUsuario}">••••••</span>
                    <button type="button"
                            class="toggle-table-password"
                            data-id="${u.IdUsuario}"
                            aria-label="Mostrar contraseña"
                            title="Mostrar contraseña">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </td>
            <td class="action-buttons">
    <button class="btn-action btn-details" data-id="${u.IdUsuario}" title="Ver detalles">
        <i class="fas fa-eye"></i>
    </button>
    <button class="btn-action btn-edit" data-id="${u.IdUsuario}" title="Editar">
        <i class="fas fa-edit"></i> Editar
    </button>
    <button class="btn-action btn-send-credentials" data-id="${u.IdUsuario}" title="Enviar credenciales por correo">
        <i class="fas fa-paper-plane"></i>
    </button>
    ${!esUsuarioActual
                    ? `<button class="btn-action btn-delete" data-id="${u.IdUsuario}" title="Eliminar">
              <i class="fas fa-trash"></i> Desactivar
           </button>`
                    : ''}
</td>
        `;
            this.tablaBody.appendChild(row);
        });

        this.reasignarEventosBotones();
    }

    reasignarEventosBotones() {
        document.querySelectorAll('.btn-edit').forEach(b => b.onclick = () => this.abrirModalEditar(parseInt(b.dataset.id)));
        document.querySelectorAll('.btn-delete').forEach(b => b.onclick = () => this.abrirModalEliminar(parseInt(b.dataset.id)));
        document.querySelectorAll('.btn-details').forEach(b => b.onclick = () => this.abrirModalDetalles(parseInt(b.dataset.id)));
        document.querySelectorAll('.btn-send-credentials').forEach(b => b.onclick = () => this.enviarCredencialesUsuario(parseInt(b.dataset.id)));
    }

    // --- Modales CRUD ---
    async abrirModalAgregar() {
        this.registroForm.reset();
        document.getElementById('reg_login').value = '';
        await this.cargarSelectsRegistro();
        this.modalRegistro.classList.add('active');
    }

    async guardarRegistro(e) {
        e.preventDefault();
        const btn = document.getElementById('btnGuardarRegistro');
        const originalText = btn.innerHTML;

        const getVal = (elemId) => {
            const el = document.getElementById(elemId);
            return el ? el.value : '';
        };

        // Validaciones básicas
        const nombre = getVal('reg_nombres').trim();
        const apellidos = getVal('reg_apellidos').trim();
        const login = getVal('reg_login').trim();
        const email = getVal('reg_email').trim();
        const telefonoCorp = getVal('reg_telefono_corp').trim();
        const password = getVal('reg_password');
        const idSucursal = getVal('reg_sucursal');
        const idArea = getVal('reg_area');
        const idRol = getVal('reg_rol');

        if (!nombre || !apellidos || !login || !email || !password || !idSucursal || !idArea || !idRol) {
            this.mostrarMensaje('Complete todos los campos obligatorios (*)', 'warning');
            return;
        }

        if (password.length < 6) {
            this.mostrarMensaje('La contraseña debe tener al menos 6 caracteres', 'warning');
            return;
        }

        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(email)) {
            this.mostrarMensaje('Ingrese un correo electrónico válido', 'warning');
            return;
        }

        // ============================================
        // VALIDACIÓN DE DUPLICADOS EN TIEMPO REAL
        // ============================================
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando duplicados...';

        try {
            // Consultamos duplicados al backend (Nombre, Correo, Login)
            let url = `/usuarios/duplicados?nombre=${encodeURIComponent(nombre)}&apellido=${encodeURIComponent(apellidos)}&correo=${encodeURIComponent(email)}&login=${encodeURIComponent(login)}`;

            const dupResponse = await this.usuarioService.api.get(url);

            if (dupResponse.success && dupResponse.raw) {
                const d = dupResponse.raw;
                if (d.duplicadoNombreApellido) {
                    this.mostrarMensaje(`Ya existe un usuario con el nombre "${nombre} ${apellidos}".`, 'error');
                    return;
                }
                if (d.duplicadoCorreo) {
                    this.mostrarMensaje(`El correo "${email}" ya está registrado.`, 'error');
                    return;
                }
                if (d.duplicadoLogin) {
                    this.mostrarMensaje(`El nombre de usuario "${login}" ya está en uso. Intente con otro.`, 'error');
                    return;
                }
            }

            // Nota: El backend actual NO valida el teléfono corporativo como único. 
            // Si quieres validarlo, tendrías que agregarlo en el endpoint `verificarDuplicados`.
            // Por ahora dejamos que el backend decida si hay un error de SQL UNIQUE.

        } catch (err) {
            console.warn('⚠️ No se pudo verificar duplicados en tiempo real:', err);
            // Continuamos por si el backend lo rechaza al final
        }

        // ============================================
        // REGISTRO
        // ============================================
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';

        const datos = {
            Nombre: nombre,
            Apellidos: apellidos,
            Login: login,
            Email: email,
            Pass: password,
            IdSucursal: idSucursal,
            IdRol: idRol,
            IdArea: idArea,
            EmailPersonal: getVal('reg_email_personal').trim() || null,
            TelefonoCorporativo: telefonoCorp || null,
            TelefonoPersonal: getVal('reg_telefono_pers').trim() || null,
            DireccionGeneral: getVal('reg_direccion_general').trim() || null,
            DireccionEspecifica: getVal('reg_direccion_especifica').trim() || null,
            IdEstado: 1 // Forzado a Activo
        };

        const r = await this.usuarioService.create(datos);

        if (r.success) {
            this.mostrarMensaje('Usuario registrado correctamente', 'success');
            this.modalRegistro.classList.remove('active');
            await this.cargarUsuarios();
        } else {
            this.mostrarMensaje(`${r.error || 'No se pudo registrar'}`, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = originalText;
    }

    async abrirModalEditar(id) {
        const usuario = this.usuarios.find(u => u.IdUsuario === id);
        const inputLogin = document.getElementById('edit_nombreUsuario');
        const selectEstado = document.getElementById('edit_estado');

        if (!usuario) {
            this.mostrarMensaje('Usuario no encontrado', 'error');
            return;
        }

        await this.cargarSelectsEdicion();

        // Helper seguro
        const setVal = (elemId, value) => {
            const el = document.getElementById(elemId);
            if (el) el.value = value ?? '';
        };

        // Campos de texto
        setVal('edit_usuarioId', usuario.IdUsuario);
        setVal('edit_nombres', usuario.Nombres || '');
        setVal('edit_apellidos', usuario.Apellidos || '');
        setVal('edit_nombreUsuario', usuario.NombreUsuario || '');
        setVal('edit_correo', usuario.Correo || '');
        setVal('edit_email_personal', usuario.EmailPersonal || '');
        setVal('edit_telefono_corp', usuario.TelefonoCorporativo || '');
        setVal('edit_telefono_pers', usuario.TelefonoPersonal || '');
        setVal('edit_direccion_general', usuario.DireccionGeneral || '');
        setVal('edit_direccion_especifica', usuario.DireccionEspecifica || '');

        // Contraseña vacía
        setVal('edit_contraseña', '');

        // Selects
        setVal('edit_sucursal', usuario.IdSucursal || '');
        setVal('edit_area', usuario.IdArea || '');
        setVal('edit_rol', usuario.Rol || '');
        setVal('edit_estado', usuario.IdEstado || 1);

        if (inputLogin) {
            inputLogin.disabled = true;
            inputLogin.style.background = '#f5f5f5';
            inputLogin.style.cursor = 'not-allowed';
        }

        if (selectEstado) {
            selectEstado.disabled = true;
            selectEstado.style.background = '#f5f5f5';
            selectEstado.style.cursor = 'not-allowed';
        }

        this.modalEditar.classList.add('active');
    }

    async guardarEdicion(e) {
        e.preventDefault();

        const id = parseInt(document.getElementById('edit_usuarioId')?.value);
        if (!id) {
            this.mostrarMensaje('ID de usuario inválido', 'error');
            return;
        }

        const btn = document.getElementById('btnGuardarEditar');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        const getVal = (elemId) => {
            const el = document.getElementById(elemId);
            return el ? el.value : '';
        };

        const datos = {
            Nombres: getVal('edit_nombres').trim(),
            Apellidos: getVal('edit_apellidos').trim(),
            NombreUsuario: getVal('edit_nombreUsuario').trim(),
            Correo: getVal('edit_correo').trim(),
            EmailPersonal: getVal('edit_email_personal').trim() || null,
            TelefonoCorporativo: getVal('edit_telefono_corp').trim() || null,
            TelefonoPersonal: getVal('edit_telefono_pers').trim() || null,
            DireccionGeneral: getVal('edit_direccion_general').trim() || null,
            DireccionEspecifica: getVal('edit_direccion_especifica').trim() || null,
            Rol: getVal('edit_rol'),
            IdSucursal: getVal('edit_sucursal'),
            IdArea: getVal('edit_area'),
            IdEstado: parseInt(getVal('edit_estado')) || 1,
            Contraseña: getVal('edit_contraseña').trim() || null
        };

        if (!datos.Nombres || !datos.Apellidos || !datos.NombreUsuario || !datos.Correo) {
            this.mostrarMensaje('Complete todos los campos requeridos', 'error');
            btn.disabled = false;
            btn.innerHTML = originalText;
            return;
        }

        const r = await this.usuarioService.update(id, datos);
        if (r.success) {
            this.mostrarMensaje('Usuario actualizado correctamente', 'success');
            this.modalEditar.classList.remove('active');
            await this.cargarUsuarios();
        } else {
            this.mostrarMensaje(`${r.error || 'No se pudo actualizar'}`, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = originalText;
    }

    // ============================================
    // ENVIAR CREDENCIALES POR CORREO
    // ============================================
    async enviarCredencialesUsuario(id) {
        const usuario = this.usuarios.find(u => u.IdUsuario === id);
        if (!usuario) {
            this.mostrarMensaje('Usuario no encontrado', 'error');
            return;
        }

        const email = usuario.Correo || usuario.EmailPersonal;
        if (!email) {
            this.mostrarMensaje('El usuario no tiene correo registrado', 'warning');
            return;
        }

        const nombreCompleto = `${usuario.Nombres} ${usuario.Apellidos}`.trim();
        const confirmar = confirm(
            `¿Enviar credenciales de acceso a:\n\n` +
            `Usuario: ${nombreCompleto}\n` +
            `Correo: ${email}\n\n` +
            `Se enviará el nombre de usuario y la contraseña real.`
        );
        if (!confirmar) return;

        // Feedback visual en el botón
        const btn = document.querySelector(`.btn-send-credentials[data-id="${id}"]`);
        const iconoOriginal = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        try {
            const r = await this.usuarioService.enviarCredenciales(id, this.usuarioActual.IdUsuario);

            if (r.success) {
                this.mostrarMensaje(`${r.message || 'Credenciales enviadas correctamente'}`, 'success');
            } else {
                // Mensajes específicos según el código de error
                let msg = r.error || 'No se pudo enviar el correo';
                if (r.codigo === 'SIN_EMAIL') {
                    msg = 'El usuario no tiene correo registrado';
                } else if (r.codigo === 'SIN_PASSWORD') {
                    msg = 'El usuario no tiene contraseña configurada';
                } else if (r.codigo === 'PASSWORD_LEGACY') {
                    msg = 'La contraseña está en formato antiguo (no se puede recuperar). Actualízala primero.';
                } else if (r.codigo === 'USUARIO_INACTIVO') {
                    msg = 'El usuario está eliminado o inactivo';
                } else if (r.codigo === 'EMAIL_FALLIDO') {
                    msg = 'No se pudo enviar el correo. Verifique la configuración de email.';
                } else if (r.codigo === 'ROL_NO_AUTORIZADO' || r.errorType === 'FORBIDDEN') {
                    msg = 'No tiene permisos de administrador';
                } else if (r.codigo === 'NO_AUTENTICADO' || r.errorType === 'UNAUTHORIZED') {
                    msg = 'Sesión inválida. Recargue la página.';
                }
                this.mostrarMensaje(`${msg}`, 'error');
            }
        } catch (error) {
            console.error('❌ Error enviando credenciales:', error);
            this.mostrarMensaje(`Error de conexión: ${error.message}`, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = iconoOriginal;
            }
        }
    }

    abrirModalEliminar(id) {
        const usuario = this.usuarios.find(u => u.IdUsuario === id);
        if (!usuario) return;
        this.usuarioAEliminar = usuario;
        document.getElementById('confirmarMensajeUsuario').innerHTML = `¿Estas seguro en desactivar al usuario <strong>${usuario.Nombres} ${usuario.Apellidos}</strong>?`;
        this.modalConfirmar.classList.add('active');
    }

    async confirmarEliminar() {
        if (!this.usuarioAEliminar) return;
        const btn = document.getElementById('btnConfirmarEliminar');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';

        const r = await this.usuarioService.deleteCascada(this.usuarioAEliminar.IdUsuario, this.usuarioActual.IdUsuario);
        if (r.success) {
            this.mostrarMensaje('Usuario eliminado', 'success');
            this.modalConfirmar.classList.remove('active');
            await this.cargarUsuarios();
        } else {
            this.mostrarMensaje(`${r.error}`, 'error');
        }
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-user-slash"></i> Desactivar';
    }

    // --- Restaurar ---
    async abrirModalEliminados() {
        this.paginaEliminadosActual = 1;
        this.renderizarTablaEliminados();
        this.modalEliminados.classList.add('active');
    }

    renderizarTablaEliminados() {
        const tbody = document.getElementById('tablaEliminadosBody');
        if (!tbody) return;

        // Contenedor de paginación de eliminados
        const paginacionContainer = document.getElementById('paginacionEliminadosContainer');

        // Sin eliminados
        if (this.usuariosEliminados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="loading">No hay usuarios desactivados</td></tr>';
            if (paginacionContainer) paginacionContainer.style.display = 'none';
            return;
        }

        // Calcular paginación
        this.totalPaginasEliminados = Math.ceil(this.usuariosEliminados.length / this.eliminadosPorPagina) || 1;
        if (this.paginaEliminadosActual > this.totalPaginasEliminados) {
            this.paginaEliminadosActual = this.totalPaginasEliminados;
        }
        if (this.paginaEliminadosActual < 1) {
            this.paginaEliminadosActual = 1;
        }

        const inicio = (this.paginaEliminadosActual - 1) * this.eliminadosPorPagina;
        const fin = inicio + this.eliminadosPorPagina;
        const pagina = this.usuariosEliminados.slice(inicio, fin);

        // Renderizar filas de la página actual
        tbody.innerHTML = '';
        pagina.forEach(u => {
            const row = document.createElement('tr');
            row.innerHTML = `
            <td>${u.IdUsuario}</td>
            <td>${this._escape(u.Nombres)}</td>
            <td>${this._escape(u.Apellidos)}</td>
            <td>${this._escape(u.NombreUsuario)}</td>
            <td>${this._escape(u.Correo)}</td>
            <td>
                <button class="btn-restore" data-id="${u.IdUsuario}">
                    <i class="fas fa-undo"></i> Activar
                </button>
            </td>
        `;
            tbody.appendChild(row);
        });

        // Reasignar eventos
        document.querySelectorAll('#tablaEliminadosBody .btn-restore').forEach(btn => {
            btn.onclick = () => this.abrirModalRestaurar(parseInt(btn.dataset.id));
        });

        // Mostrar y actualizar controles de paginación
        if (paginacionContainer) paginacionContainer.style.display = 'flex';
        this._actualizarControlesPaginacionEliminados();
    }

    abrirModalRestaurar(id) {
        this.usuarioARestaurar = this.usuariosEliminados.find(u => u.IdUsuario === id);
        if (!this.usuarioARestaurar) return;
        this.modalEliminados.classList.remove('active');
        document.getElementById('restaurarMensajeUsuario').innerHTML = `¿Estas seguro activar al usuario <strong>${this.usuarioARestaurar.Nombres} ${this.usuarioARestaurar.Apellidos}</strong>?`;
        this.modalRestaurar.classList.add('active');
    }

    async confirmarRestaurar() {
        if (!this.usuarioARestaurar) return;
        const btn = document.getElementById('btnConfirmarRestaurar');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Activando...';

        const r = await this.usuarioService.restaurarCascada(this.usuarioARestaurar.IdUsuario, this.usuarioActual.IdUsuario);
        if (r.success) {
            this.mostrarMensaje('Usuario activado', 'success');
            this.modalRestaurar.classList.remove('active');
            await this.cargarUsuarios();
        } else {
            this.mostrarMensaje(`${r.error}`, 'error');
        }
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-undo"></i> Restaurar';
    }

    // --- Detalles ---
    async abrirModalDetalles(id) {
        const usuario = [...this.usuarios, ...this.usuariosEliminados].find(u => u.IdUsuario === id);
        if (!usuario) {
            this.mostrarMensaje('Usuario no encontrado', 'error');
            return;
        }

        // 🔥 FALLBACK: Si los catálogos no están en caché, los cargamos ahora
        if (!this._cacheSucursales || !this._cacheAreas) {
            try {
                const [sucursales, areas] = await Promise.all([
                    this.usuarioService.getSucursales(),
                    this.usuarioService.getAreas()
                ]);
                this._cacheSucursales = sucursales.data || [];
                this._cacheAreas = areas.data || [];
            } catch (e) {
                console.warn('⚠️ Error al cargar catálogos en Detalles:', e);
            }
        }

        const setText = (elemId, value, fallback = 'No registrado') => {
            const el = document.getElementById(elemId);
            if (el) el.textContent = (value === null || value === undefined || value === '') ? fallback : value;
        };

        // Datos personales
        setText('detalleNombres', usuario.Nombres);
        setText('detalleApellidos', usuario.Apellidos);
        setText('detalleUsuario', usuario.NombreUsuario);
        setText('detalleCorreo', usuario.Correo);
        setText('detalleEmailPersonal', usuario.EmailPersonal);
        setText('detalleRol', usuario.Rol);

        // 🔥 IMPORTANTE: Asegurar que los IDs se comparen como números
        const idSucursalUsuario = parseInt(usuario.IdSucursal);
        const idAreaUsuario = parseInt(usuario.IdArea);

        const sucursal = (this._cacheSucursales || []).find(s => parseInt(s.IdSucursal) === idSucursalUsuario);
        const area = (this._cacheAreas || []).find(a => parseInt(a.IdArea) === idAreaUsuario);

        setText('detalleSucursal', sucursal ? sucursal.NombreSucursal : '-');
        setText('detalleArea', area ? area.Nombre : '-');

        // Teléfonos y Estado
        setText('detalleTelefonoCorp', usuario.TelefonoCorporativo);
        setText('detalleTelefonoPers', usuario.TelefonoPersonal);
        setText('detalleEstado', usuario.IdEstado === 2 ? 'Eliminado' : 'Activo');

        // Ubicación
        setText('detalleDireccionGeneral', usuario.DireccionGeneral);
        setText('detalleDireccionEspecifica', usuario.DireccionEspecifica);

        this.modalDetalles.classList.add('active');
    }
    // --- Catálogos ---
    async cargarSelectsEdicion() {
        const [sucursales, areas, roles] = await Promise.all([
            this.usuarioService.getSucursales(),
            this.usuarioService.getAreas(),
            this.usuarioService.getRoles()
        ]);

        // Cachear para detalles
        this._cacheSucursales = sucursales.data || [];
        this._cacheAreas = areas.data || [];
        this._cacheRoles = roles.data || [];

        this._poblarSelect('edit_sucursal', this._cacheSucursales, 'IdSucursal', 'NombreSucursal');
        this._poblarSelect('edit_area', this._cacheAreas, 'IdArea', 'Nombre');
        this._poblarSelect('edit_rol', this._cacheRoles, 'Descripcion', 'Descripcion', true);
    }

    async cargarSelectsRegistro() {
        const [sucursales, areas, roles] = await Promise.all([
            this.usuarioService.getSucursales(),
            this.usuarioService.getAreas(),
            this.usuarioService.getRoles()
        ]);

        this._cacheSucursales = sucursales.data || [];
        this._cacheAreas = areas.data || [];
        this._cacheRoles = roles.data || [];

        this._poblarSelect('reg_sucursal', this._cacheSucursales, 'IdSucursal', 'NombreSucursal');
        this._poblarSelect('reg_area', this._cacheAreas, 'IdArea', 'Nombre');
        this._poblarSelect('reg_rol', this._cacheRoles, 'Descripcion', 'Descripcion', true);
    }

    _poblarSelect(elementId, data, valueKey, textKey, usarTextoComoValue = false) {
        const select = document.getElementById(elementId);
        if (!select) return;
        select.innerHTML = '<option value="">Seleccione</option>';
        (data || []).forEach(item => {
            const opt = document.createElement('option');
            opt.value = usarTextoComoValue ? item[textKey] : item[valueKey];
            opt.textContent = item[textKey];
            select.appendChild(opt);
        });
    }

    // --- Helpers ---
    crearControlesPaginacion() {
        const tableContainer = document.querySelector('.table-container');
        if (!tableContainer || document.getElementById('paginacionContainer')) return;

        const div = document.createElement('div');
        div.id = 'paginacionContainer';
        div.className = 'paginacion-container';
        div.innerHTML = `
        <div class="paginacion-info">
            Mostrando <span id="inicioRegistro">0</span> - <span id="finRegistro">0</span>
            de <span id="totalRegistros">0</span> registros
        </div>
        <div class="paginacion-buttons">
            <button class="btn-paginacion" id="btnPrimeraPagina" disabled>⏮ Primera</button>
            <button class="btn-paginacion" id="btnPaginaAnterior" disabled>◀ Anterior</button>
            <span class="paginacion-pagina" id="paginaActualInfo">Página 1 de 1</span>
            <button class="btn-paginacion" id="btnPaginaSiguiente" disabled>Siguiente ▶</button>
            <button class="btn-paginacion" id="btnUltimaPagina" disabled>Última ⏭</button>
        </div>
    `;
        tableContainer.parentNode.insertBefore(div, tableContainer.nextSibling);

        this.paginacionContainer = document.getElementById('paginacionContainer');
        this.btnPrimeraPagina = document.getElementById('btnPrimeraPagina');
        this.btnPaginaAnterior = document.getElementById('btnPaginaAnterior');
        this.btnPaginaSiguiente = document.getElementById('btnPaginaSiguiente');
        this.btnUltimaPagina = document.getElementById('btnUltimaPagina');
        this.paginaActualInfo = document.getElementById('paginaActualInfo');
        this.inicioRegistro = document.getElementById('inicioRegistro');
        this.finRegistro = document.getElementById('finRegistro');
        this.totalRegistrosSpan = document.getElementById('totalRegistros');

        if (this.btnPrimeraPagina) this.btnPrimeraPagina.addEventListener('click', () => this.irPrimeraPagina());
        if (this.btnPaginaAnterior) this.btnPaginaAnterior.addEventListener('click', () => this.irPaginaAnterior());
        if (this.btnPaginaSiguiente) this.btnPaginaSiguiente.addEventListener('click', () => this.irPaginaSiguiente());
        if (this.btnUltimaPagina) this.btnUltimaPagina.addEventListener('click', () => this.irUltimaPagina());
    }

    irPrimeraPagina() { if (this.paginaActual > 1) { this.paginaActual = 1; this.aplicarFiltrosYRenderizar(); } }
    irPaginaAnterior() { if (this.paginaActual > 1) { this.paginaActual--; this.aplicarFiltrosYRenderizar(); } }
    irPaginaSiguiente() { if (this.paginaActual < this.totalPaginas) { this.paginaActual++; this.aplicarFiltrosYRenderizar(); } }
    irUltimaPagina() { if (this.paginaActual < this.totalPaginas) { this.paginaActual = this.totalPaginas; this.aplicarFiltrosYRenderizar(); } }

    actualizarControlesPaginacion() {
        const total = this.totalPaginas || 1;

        if (this.btnPrimeraPagina) this.btnPrimeraPagina.disabled = this.paginaActual === 1;
        if (this.btnPaginaAnterior) this.btnPaginaAnterior.disabled = this.paginaActual === 1;
        if (this.btnPaginaSiguiente) this.btnPaginaSiguiente.disabled = this.paginaActual === total;
        if (this.btnUltimaPagina) this.btnUltimaPagina.disabled = this.paginaActual === total;
        if (this.paginaActualInfo) this.paginaActualInfo.textContent = `Página ${this.paginaActual} de ${total}`;

        const totalReg = (this.usuarios && this.usuarios.length) || 0;
        const inicio = totalReg > 0 ? (this.paginaActual - 1) * this.registrosPorPagina + 1 : 0;
        const fin = Math.min(inicio + this.registrosPorPagina - 1, totalReg);

        if (this.inicioRegistro) this.inicioRegistro.textContent = inicio;
        if (this.finRegistro) this.finRegistro.textContent = fin;
        if (this.totalRegistrosSpan) this.totalRegistrosSpan.textContent = totalReg;
    }

    // ============================================
    // PAGINACIÓN DE ELIMINADOS
    // ============================================
    _actualizarControlesPaginacionEliminados() {
        const total = this.totalPaginasEliminados || 1;
        const totalReg = this.usuariosEliminados.length;
        const inicio = totalReg > 0 ? (this.paginaEliminadosActual - 1) * this.eliminadosPorPagina + 1 : 0;
        const fin = Math.min(inicio + this.eliminadosPorPagina - 1, totalReg);

        const inicioEl = document.getElementById('inicioEliminados');
        const finEl = document.getElementById('finEliminados');
        const totalEl = document.getElementById('totalEliminados');
        const paginaInfo = document.getElementById('paginaActualEliminados');

        if (inicioEl) inicioEl.textContent = inicio;
        if (finEl) finEl.textContent = fin;
        if (totalEl) totalEl.textContent = totalReg;
        if (paginaInfo) paginaInfo.textContent = `Página ${this.paginaEliminadosActual} de ${total}`;

        const btnPrimera = document.getElementById('btnPrimeraEliminados');
        const btnAnterior = document.getElementById('btnAnteriorEliminados');
        const btnSiguiente = document.getElementById('btnSiguienteEliminados');
        const btnUltima = document.getElementById('btnUltimaEliminados');

        if (btnPrimera) btnPrimera.disabled = this.paginaEliminadosActual === 1;
        if (btnAnterior) btnAnterior.disabled = this.paginaEliminadosActual === 1;
        if (btnSiguiente) btnSiguiente.disabled = this.paginaEliminadosActual === total;
        if (btnUltima) btnUltima.disabled = this.paginaEliminadosActual === total;
    }

    irPrimeraEliminados() {
        if (this.paginaEliminadosActual > 1) {
            this.paginaEliminadosActual = 1;
            this.renderizarTablaEliminados();
        }
    }

    irAnteriorEliminados() {
        if (this.paginaEliminadosActual > 1) {
            this.paginaEliminadosActual--;
            this.renderizarTablaEliminados();
        }
    }

    irSiguienteEliminados() {
        if (this.paginaEliminadosActual < this.totalPaginasEliminados) {
            this.paginaEliminadosActual++;
            this.renderizarTablaEliminados();
        }
    }

    irUltimaEliminados() {
        if (this.paginaEliminadosActual < this.totalPaginasEliminados) {
            this.paginaEliminadosActual = this.totalPaginasEliminados;
            this.renderizarTablaEliminados();
        }
    }

    mostrarCarga(mensaje = 'Cargando...', detalle = '', progreso = 0) {
        const modal = document.getElementById('modalCarga');
        if (!modal) return;

        const msgEl = document.getElementById('cargaMensaje');
        const detEl = document.getElementById('cargaDetalle');
        const progEl = document.getElementById('cargaProgreso');

        if (msgEl) msgEl.textContent = mensaje;
        if (detEl) detEl.textContent = detalle;
        if (progEl) {
            progEl.style.width = `${progreso}%`;
            progEl.style.background = progreso >= 100
                ? 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)'
                : 'linear-gradient(135deg, #CC0000 0%, #8B0000 100%)';
        }

        modal.classList.add('active');
        document.body.classList.add('modal-carga-active');
    }

    ocultarCarga() {
        const modal = document.getElementById('modalCarga');
        if (modal) modal.classList.remove('active');
        document.body.classList.remove('modal-carga-active');
    }

    mostrarMensaje(mensaje, tipo = 'info') {
        let box = document.querySelector('.message-box');
        if (!box) {
            box = document.createElement('div');
            box.className = 'message-box';
            document.body.appendChild(box);
        }

        const iconos = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };
        const icono = iconos[tipo] || iconos.info;

        box.innerHTML = `<i class="fas ${icono}"></i> <span>${mensaje}</span>`;
        box.className = `message-box show ${tipo}`;

        clearTimeout(this._msgTimeout);
        this._msgTimeout = setTimeout(() => box.classList.remove('show'), 4000);
    }

    normalizarTexto(texto) { return texto ? texto.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : ''; }
    _escape(s) {
        if (s === undefined || s === null) return '';
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }
    cerrarSesion() { this.auth.cerrarSesion(); }

}

if (typeof window !== 'undefined') {
    window.GestionUsuariosController = GestionUsuariosController;
}