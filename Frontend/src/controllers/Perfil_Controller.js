// ==============================================
// CONTROLLER: PerfilController
// Módulo "Mi Perfil"
// Depende de: AuthService, UsuarioService
//
// ==============================================

class PerfilController {

    constructor(authService, perfilService, config) {
        this.auth = authService;
        this.perfilService = perfilService;
        this.config = config || {};

        // Estado
        this.usuarioActual = null;
        this.perfil = null;
        this.datosOriginales = {};
        this.tieneCambios = false;
        this.guardando = false;
        this.cargando = false;

        // DOM — header
        this.userMenu = null;
        this.userNameDisplay = null;
        this.userRoleDisplay = null;
        this.dropdownUserName = null;
        this.dropdownUserEmail = null;
        this.dropdownUserRole = null;
        this.logoutBtn = null;
        this.menuBtn = null;
        this.logoArea = null;

        // DOM — formulario
        this.form = null;
        this.nombresInput = null;
        this.apellidosInput = null;
        this.loginInput = null;                 // 🔒 bloqueado
        this.emailCorpInput = null;             // 🔒 bloqueado
        this.emailPersonalInput = null;
        this.telefonoCorpInput = null;
        this.telefonoPersonalInput = null;
        this.direccionGeneralInput = null;
        this.direccionEspecificaInput = null;
        this.rolInput = null;                   // 🔒 bloqueado
        this.sucursalInput = null;              // 🔒 bloqueado
        this.areaInput = null;                  // 🔒 bloqueado
        this.nuevaPasswordInput = null;
        this.confirmarPasswordInput = null;
        this.guardarBtn = null;
        this.cancelarBtn = null;
        this.unsavedAlert = null;

        // DOM — info empresa
        this.infoSucursal = null;
        this.infoArea = null;
        this.infoRol = null;

        // DOM — modal carga
        this.modalCarga = null;
        this.cargaMensaje = null;
        this.cargaProgreso = null;
        this.cargaDetalle = null;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    // ==========================================
    // INIT
    // ==========================================
    async init() {
        console.log('🔧 Inicializando PerfilController...');

        // 1) Verificar sesión
        if (!this.auth || !this.auth.verificarSesion()) {
            console.warn('No hay sesión. Redirigiendo al login...');
            this.redirigirALogin();
            return;
        }

        this.usuarioActual = this.auth.getUsuarioLogueado();
        if (!this.usuarioActual?.IdUsuario) {
            console.warn('Usuario no válido en sesión. Redirigiendo...');
            this.redirigirALogin();
            return;
        }

        // 2) Cachear DOM
        this._cachearDOM();

        // 3) Header rápido con datos de sesión
        this.actualizarHeaderConSesion();

        // 4) Eventos
        this.configurarEventos();

        // 5) Cargar perfil completo del backend
        await this.cargarPerfil();

        console.log('✅ PerfilController inicializado');
    }

    _cachearDOM() {
        // Header
        this.userMenu          = document.getElementById('userMenu');
        this.userNameDisplay   = document.getElementById('displayUserName');
        this.userRoleDisplay   = document.getElementById('displayUserRole');
        this.dropdownUserName  = document.getElementById('dropdownUserName');
        this.dropdownUserEmail = document.getElementById('dropdownUserEmail');
        this.dropdownUserRole  = document.getElementById('dropdownUserRole');
        this.logoutBtn         = document.getElementById('logoutBtn');
        this.menuBtn           = document.getElementById('menuBtn');
        this.logoArea          = document.getElementById('logoArea');

        // Formulario
        this.form                     = document.getElementById('perfilForm');
        this.nombresInput             = document.getElementById('nombres');
        this.apellidosInput           = document.getElementById('apellidos');
        this.loginInput               = document.getElementById('nombreUsuario');       // 🔒
        this.emailCorpInput           = document.getElementById('correo');              // 🔒
        this.emailPersonalInput       = document.getElementById('emailPersonal');
        this.telefonoCorpInput        = document.getElementById('telefonoCorporativo');
        this.telefonoPersonalInput    = document.getElementById('telefonoPersonal');
        this.direccionGeneralInput    = document.getElementById('direccionGeneral');
        this.direccionEspecificaInput = document.getElementById('direccionEspecifica');
        this.rolInput                 = document.getElementById('rol');                 // 🔒
        this.sucursalInput            = document.getElementById('sucursal');            // 🔒
        this.areaInput                = document.getElementById('area');                // 🔒
        this.nuevaPasswordInput       = document.getElementById('nuevaContraseña');
        this.confirmarPasswordInput   = document.getElementById('confirmarContraseña');
        this.guardarBtn               = document.getElementById('guardarBtn');
        this.cancelarBtn              = document.getElementById('cancelarBtn');
        this.unsavedAlert             = document.getElementById('unsavedAlert');

        // Info empresa
        this.infoSucursal = document.getElementById('infoSucursal');
        this.infoArea     = document.getElementById('infoArea');
        this.infoRol      = document.getElementById('infoRol');

        // Modal carga
        this.modalCarga    = document.getElementById('modalCargaPerfil');
        this.cargaMensaje  = document.getElementById('cargaPerfilMensaje');
        this.cargaProgreso = document.getElementById('cargaPerfilProgreso');
        this.cargaDetalle  = document.getElementById('cargaPerfilDetalle');
    }

    // ==========================================
    // HEADER
    // ==========================================
    actualizarHeaderConSesion() {
        const u = this.usuarioActual || {};
        const nombreCompleto = `${u.nombres || u.Nombres || ''} ${u.apellidos || u.Apellidos || ''}`.trim() || 'Usuario';
        const email = u.correo || u.Correo || '';
        const rol = u.rol || u.Rol || 'Usuario';

        if (this.userNameDisplay)   this.userNameDisplay.textContent = nombreCompleto;
        if (this.userRoleDisplay)   this.userRoleDisplay.textContent = rol;
        if (this.dropdownUserName)  this.dropdownUserName.textContent = nombreCompleto;
        if (this.dropdownUserEmail) this.dropdownUserEmail.textContent = email;
        if (this.dropdownUserRole)  this.dropdownUserRole.textContent = rol;
    }

    actualizarHeaderConPerfil(perfil) {
        const nombreCompleto = `${perfil.Nombre || ''} ${perfil.Apellidos || ''}`.trim() || 'Usuario';
        const email = perfil.Email || '';
        const rol = perfil.Rol || 'Usuario';

        if (this.userNameDisplay)   this.userNameDisplay.textContent = nombreCompleto;
        if (this.userRoleDisplay)   this.userRoleDisplay.textContent = rol;
        if (this.dropdownUserName)  this.dropdownUserName.textContent = nombreCompleto;
        if (this.dropdownUserEmail) this.dropdownUserEmail.textContent = email;
        if (this.dropdownUserRole)  this.dropdownUserRole.textContent = rol;
    }

    // ==========================================
    // CARGAR PERFIL
    // ==========================================
    async cargarPerfil() {
        if (this.cargando) return;
        this.cargando = true;

        try {
            this.mostrarCarga('Cargando perfil...', 'Consultando servidor...', 20);

            const idUsuario = this.usuarioActual.IdUsuario;
            const r = await this.perfilService.getPerfil(idUsuario);

            if (!r.success || !r.data) {
                this.ocultarCarga();
                this.mostrarModalBloqueo(
                    'No se pudo cargar el perfil',
                    r.error || 'No se pudo obtener la información del usuario.'
                );
                return;
            }

            this.perfil = r.data;
            console.log('📌 Perfil obtenido:', this.perfil);

            this.actualizarCarga('Cargando formulario...', 'Actualizando campos...', 60);

            this._poblarFormulario(this.perfil);
            this.actualizarHeaderConPerfil(this.perfil);
            this._actualizarInfoEmpresa(this.perfil);

            this.guardarDatosOriginales();
            this.verificarCambios();

            this.actualizarCarga('¡Listo!', 'Perfil cargado correctamente', 100);
            await new Promise(res => setTimeout(res, 300));
            this.ocultarCarga();

            this._sincronizarSesion(this.perfil);

        } catch (error) {
            console.error('❌ Error en cargarPerfil:', error);
            this.ocultarCarga();
            this.mostrarModalBloqueo(
                '⚠️ Error al cargar el perfil',
                error.message || 'Ocurrió un error inesperado.'
            );
        } finally {
            this.cargando = false;
        }
    }

    _poblarFormulario(perfil) {
        // --- Editables ---
        if (this.nombresInput)             this.nombresInput.value = perfil.Nombre || '';
        if (this.apellidosInput)           this.apellidosInput.value = perfil.Apellidos || '';
        if (this.emailPersonalInput)       this.emailPersonalInput.value = perfil.EmailPersonal || '';
        if (this.telefonoCorpInput)        this.telefonoCorpInput.value = perfil.TelefonoCorporativo || '';
        if (this.telefonoPersonalInput)    this.telefonoPersonalInput.value = perfil.TelefonoPersonal || '';
        if (this.direccionGeneralInput)    this.direccionGeneralInput.value = perfil.DireccionGeneral || '';
        if (this.direccionEspecificaInput) this.direccionEspecificaInput.value = perfil.DireccionEspecifica || '';

        // --- Bloqueados por política (solo lectura) ---
        if (this.loginInput)     this.loginInput.value = perfil.Login || '';
        if (this.emailCorpInput) this.emailCorpInput.value = perfil.Email || '';
        if (this.rolInput)       this.rolInput.value = perfil.Rol || '';
        if (this.sucursalInput)  this.sucursalInput.value = perfil.Sucursal || '';
        if (this.areaInput) {
            this.areaInput.value = perfil.AreaSiglas
                ? `${perfil.AreaSiglas} - ${perfil.AreaNombre || ''}`
                : (perfil.AreaNombre || '');
        }

        // Aplicar bloqueo (disabled + readOnly + tooltip)
        this._aplicarBloqueos();

        // Botón guardar deshabilitado hasta que haya cambios
        if (this.guardarBtn) this.guardarBtn.disabled = true;
    }

    // ==========================================
    // APLICAR BLOQUEOS POR POLÍTICA
    // ==========================================
    _aplicarBloqueos() {
        const bloqueados = [
            { el: this.loginInput,     tooltip: 'El nombre de usuario no se puede modificar' },
            { el: this.emailCorpInput, tooltip: 'El correo corporativo no se puede modificar' },
            { el: this.rolInput,       tooltip: 'El rol no se puede modificar' },
            { el: this.sucursalInput,  tooltip: 'La sucursal no se puede modificar' },
            { el: this.areaInput,      tooltip: 'El área no se puede modificar' }
        ];

        bloqueados.forEach(({ el, tooltip }) => {
            if (!el) return;
            el.disabled = true;
            el.readOnly = true;
            el.setAttribute('aria-readonly', 'true');
            el.title = tooltip;

            // Estilo visual (por si el CSS no lo toma)
            el.style.background = '#f5f5f5';
            el.style.color = '#6c757d';
            el.style.cursor = 'not-allowed';
        });
    }

    _actualizarInfoEmpresa(perfil) {
        if (this.infoSucursal) {
            this.infoSucursal.textContent = perfil.Sucursal || 'No asignada';
        }
        if (this.infoArea) {
            this.infoArea.textContent = perfil.AreaSiglas
                ? `${perfil.AreaSiglas} - ${perfil.AreaNombre || ''}`
                : (perfil.AreaNombre || 'No asignada');
        }
        if (this.infoRol) {
            this.infoRol.textContent = perfil.Rol || '—';
        }
    }

    _sincronizarSesion(perfil) {
        try {
            const nuevo = {
                ...this.usuarioActual,
                nombres: perfil.Nombre || this.usuarioActual.nombres,
                apellidos: perfil.Apellidos || this.usuarioActual.apellidos,
                correo: perfil.Email || this.usuarioActual.correo,
                rol: perfil.Rol || this.usuarioActual.rol,
                nombreUsuario: perfil.Login || this.usuarioActual.nombreUsuario
            };
            this.usuarioActual = nuevo;
            sessionStorage.setItem('usuarioActual', JSON.stringify(nuevo));
            sessionStorage.setItem('userLogged', JSON.stringify(nuevo));
        } catch (e) {
            console.warn('⚠️ No se pudo sincronizar sesión:', e);
        }
    }

    // ==========================================
    // EVENTOS
    // ==========================================
    configurarEventos() {
        // Header
        if (this.userMenu) {
            this.userMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                this.userMenu.classList.toggle('active');
            });
        }
        document.addEventListener('click', () => {
            if (this.userMenu) this.userMenu.classList.remove('active');
        });

        this._configurarTogglePassword();

        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.cerrarSesion();
            });
        }
        if (this.menuBtn) {
            this.menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.irAlMenu();
            });
        }
        if (this.logoArea) {
            this.logoArea.addEventListener('click', () => this.irAlMenu());
        }

        // Formulario
        if (this.form) {
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleGuardar();
            });
        }

        if (this.guardarBtn) {
            this.guardarBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleGuardar();
            });
        }

        if (this.cancelarBtn) {
            this.cancelarBtn.addEventListener('click', () => this.handleCancelar());
        }

        const discardBtn = document.getElementById('discardChangesBtn');
        if (discardBtn) {
            discardBtn.addEventListener('click', () => this.descartarCambios());
        }

        // Detectores de cambios SOLO en campos editables
        const editables = [
            this.nombresInput,
            this.apellidosInput,
            this.emailPersonalInput,
            this.telefonoCorpInput,
            this.telefonoPersonalInput,
            this.direccionGeneralInput,
            this.direccionEspecificaInput,
            this.nuevaPasswordInput,
            this.confirmarPasswordInput
        ].filter(Boolean);

        editables.forEach(el => {
            el.addEventListener('input', () => this.verificarCambios());
        });
    }

    // ==========================================
    // DETECCIÓN DE CAMBIOS
    // ==========================================
    guardarDatosOriginales() {
        this.datosOriginales = {
            nombres:             this.nombresInput?.value || '',
            apellidos:           this.apellidosInput?.value || '',
            emailPersonal:       this.emailPersonalInput?.value || '',
            telefonoCorp:        this.telefonoCorpInput?.value || '',
            telefonoPersonal:    this.telefonoPersonalInput?.value || '',
            direccionGeneral:    this.direccionGeneralInput?.value || '',
            direccionEspecifica: this.direccionEspecificaInput?.value || ''
        };
    }

    verificarCambios() {
    if (!this.datosOriginales) return;

    const actuales = {
        nombres:             this.nombresInput?.value || '',
        apellidos:           this.apellidosInput?.value || '',
        emailPersonal:       this.emailPersonalInput?.value || '',
        telefonoCorp:        this.telefonoCorpInput?.value || '',
        telefonoPersonal:    this.telefonoPersonalInput?.value || '',
        direccionGeneral:    this.direccionGeneralInput?.value || '',
        direccionEspecifica: this.direccionEspecificaInput?.value || ''
    };

    const cambioCampos = Object.keys(actuales).some(k => actuales[k] !== this.datosOriginales[k]);
    const cambioPass = (this.nuevaPasswordInput?.value || '') !== ''
                    || (this.confirmarPasswordInput?.value || '') !== '';

    this.tieneCambios = cambioCampos || cambioPass;

    if (this.unsavedAlert) {
        this.unsavedAlert.classList.toggle('show', this.tieneCambios);
    }
    if (this.guardarBtn) {
        // ✅ Solo depende de tieneCambios (guardando se maneja en handleGuardar)
        this.guardarBtn.disabled = !this.tieneCambios;
    }
}

    // ==========================================
    // VALIDACIÓN
    // ==========================================
    validarFormulario() {
        let ok = true;

        if (!this.nombresInput?.value.trim()) {
            this._mostrarError(this.nombresInput, 'Los nombres son requeridos');
            ok = false;
        } else {
            this._limpiarError(this.nombresInput);
        }

        if (!this.apellidosInput?.value.trim()) {
            this._mostrarError(this.apellidosInput, 'Los apellidos son requeridos');
            ok = false;
        } else {
            this._limpiarError(this.apellidosInput);
        }

        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (this.emailPersonalInput?.value.trim()
            && !emailRe.test(this.emailPersonalInput.value.trim())) {
            this._mostrarError(this.emailPersonalInput, 'Email personal inválido');
            ok = false;
        } else {
            this._limpiarError(this.emailPersonalInput);
        }

        const pass = this.nuevaPasswordInput?.value || '';
        const confirm = this.confirmarPasswordInput?.value || '';

        if (pass || confirm) {
            if (pass.length < 6) {
                this._mostrarError(this.nuevaPasswordInput, 'Mínimo 6 caracteres');
                ok = false;
            } else if (pass !== confirm) {
                this._mostrarError(this.confirmarPasswordInput, 'Las contraseñas no coinciden');
                ok = false;
            } else {
                this._limpiarError(this.nuevaPasswordInput);
                this._limpiarError(this.confirmarPasswordInput);
            }
        }

        return ok;
    }

    _mostrarError(input, msg) {
        if (!input) return;
        input.classList.add('error');
        let span = input.parentElement.querySelector('.field-error');
        if (!span) {
            span = document.createElement('span');
            span.className = 'field-error';
            input.parentElement.appendChild(span);
        }
        span.textContent = msg;
        span.style.color = '#dc3545';
        span.style.fontSize = '11px';
        span.style.marginTop = '5px';
        span.style.display = 'block';
    }

    _limpiarError(input) {
        if (!input) return;
        input.classList.remove('error');
        const span = input.parentElement.querySelector('.field-error');
        if (span) span.remove();
    }

    // ==========================================
    // GUARDAR
    // ==========================================
    async handleGuardar() {
    if (this.guardando) return;
    if (!this.validarFormulario()) {
        this.mostrarMensaje('Revise los campos marcados', 'error');
        return;
    }

    this.guardando = true;
    if (this.guardarBtn) {
        this.guardarBtn.disabled = true;
        this.guardarBtn.dataset.original = this.guardarBtn.innerHTML;
        this.guardarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    }
    this.mostrarMensaje('Guardando cambios...', 'info');

    try {
        const idUsuario = this.usuarioActual.IdUsuario;

        const payload = {
            Nombres:               this.nombresInput.value.trim(),
            Apellidos:             this.apellidosInput.value.trim(),
            EmailPersonal:         this.emailPersonalInput.value.trim() || null,
            TelefonoCorporativo:   this.telefonoCorpInput?.value.trim() || null,
            TelefonoPersonal:      this.telefonoPersonalInput?.value.trim() || null,
            DireccionGeneral:      this.direccionGeneralInput?.value.trim() || null,
            DireccionEspecifica:   this.direccionEspecificaInput?.value.trim() || null,
            IdUsuarioModificacion: idUsuario
        };

        const pass = this.nuevaPasswordInput?.value || '';
        if (pass) {
            payload.PasswordHash = pass;
        }

        const r = await this.perfilService.update(idUsuario, payload);

        if (!r.success) {
            this.mostrarMensaje(`${r.error || 'No se pudo actualizar'}`, 'error');
            return;
        }

        this.mostrarMensaje('Perfil actualizado correctamente', 'success');

        // Limpiar contraseñas
        if (this.nuevaPasswordInput)       this.nuevaPasswordInput.value = '';
        if (this.confirmarPasswordInput)   this.confirmarPasswordInput.value = '';

        // ✅ Resetear guardando ANTES de recargar perfil
        this.guardando = false;
        this._restaurarBotonGuardar();   // restaura icono + texto

        // ✅ Recargar perfil (esto repoblará y recalculará tieneCambios = false)
        await this.cargarPerfil();

    } catch (error) {
        console.error('❌ Error guardando:', error);
        this.mostrarMensaje(`Error de conexión: ${error.message}`, 'error');
    } finally {
        this.guardando = false;
        this._restaurarBotonGuardar();
    }
}

    _restaurarBotonGuardar() {
    if (!this.guardarBtn) return;
    const original = this.guardarBtn.dataset.original || '<i class="fas fa-save"></i> Guardar Cambios';
    this.guardarBtn.innerHTML = original;
    this.guardarBtn.disabled = !this.tieneCambios;   // ✅ habilita solo si hay cambios
}

    // ==========================================
    // CANCELAR / DESCARTAR
    // ==========================================
    handleCancelar() {
        if (this.tieneCambios) {
            if (!confirm('Hay cambios sin guardar. ¿Deseas descartarlos?')) return;
        }
        this.irAlMenu();
    }

    descartarCambios() {
        if (!this.perfil) return;
        this._poblarFormulario(this.perfil);
        if (this.nuevaPasswordInput) this.nuevaPasswordInput.value = '';
        if (this.confirmarPasswordInput) this.confirmarPasswordInput.value = '';
        this.guardarDatosOriginales();
        this.verificarCambios();
        this.mostrarMensaje('Cambios descartados', 'info');
    }

    // ==========================================
    // NAVEGACIÓN
    // ==========================================
    irAlMenu() {
        const ruta = this.config?.ROUTES?.MENU || 'Menu.html';
        window.location.href = ruta;
    }

    redirigirALogin() {
        const ruta = this.config?.ROUTES?.LOGIN || '/index.html';
        window.location.replace(ruta);
    }

    cerrarSesion() {
        this.mostrarMensaje('Sesión cerrada correctamente', 'success');
        setTimeout(() => this.auth.cerrarSesion(), 700);
    }

    // ==========================================
    // MODAL DE CARGA
    // ==========================================
    mostrarCarga(mensaje = 'Cargando...', detalle = '', progreso = 0) {
        if (!this.modalCarga) return;
        if (this.cargaMensaje) this.cargaMensaje.textContent = mensaje;
        if (this.cargaDetalle) this.cargaDetalle.textContent = detalle;
        if (this.cargaProgreso) {
            this.cargaProgreso.style.width = `${progreso}%`;
            this.cargaProgreso.style.background = progreso >= 100
                ? 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)'
                : 'linear-gradient(135deg, #CC0000 0%, #8B0000 100%)';
        }
        this.modalCarga.style.display = 'flex';
        this.modalCarga.classList.add('active');
        document.body.classList.add('modal-carga-active');
    }

    actualizarCarga(mensaje, detalle, progreso) {
        if (!this.modalCarga?.classList.contains('active')) return;
        if (mensaje && this.cargaMensaje) this.cargaMensaje.textContent = mensaje;
        if (detalle && this.cargaDetalle) this.cargaDetalle.textContent = detalle;
        if (progreso !== undefined && progreso !== null && this.cargaProgreso) {
            this.cargaProgreso.style.width = `${progreso}%`;
            this.cargaProgreso.style.background = progreso >= 100
                ? 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)'
                : 'linear-gradient(135deg, #CC0000 0%, #8B0000 100%)';
        }
    }

    ocultarCarga() {
        if (!this.modalCarga) return;
        this.modalCarga.classList.remove('active');
        this.modalCarga.style.display = 'none';
        document.body.classList.remove('modal-carga-active');
    }

    // ==========================================
    // MODAL DE BLOQUEO
    // ==========================================
    mostrarModalBloqueo(titulo, mensaje) {
        let modal = document.getElementById('modalBloqueoPerfil');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modalBloqueoPerfil';
            modal.className = 'modal-bloqueo';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `
            <div class="modal-bloqueo-card">
                <div class="modal-bloqueo-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <h3>${titulo || 'Error'}</h3>
                <p>${mensaje || 'Ocurrió un error inesperado.'}</p>
                <div class="modal-bloqueo-actions">
                    <button class="btn btn-primary" id="modalReintentarBtn">
                        <i class="fas fa-sync-alt"></i> Reintentar
                    </button>
                    <button class="btn btn-secondary" id="modalMenuBtn">
                        <i class="fas fa-home"></i> Ir al Menú
                    </button>
                </div>
            </div>
        `;
        modal.style.display = 'flex';

        document.getElementById('modalReintentarBtn').onclick = () => window.location.reload();
        document.getElementById('modalMenuBtn').onclick = () => this.irAlMenu();
    }

    _configurarTogglePassword() {
    const botones = document.querySelectorAll('[data-toggle-password]');
    console.log(`👁️ Configurando ${botones.length} toggle(s) de contraseña`);

    botones.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.getAttribute('data-toggle-password');
            const input = document.getElementById(targetId);
            if (!input) {
                console.warn(`⚠️ Toggle sin input: ${targetId}`);
                return;
            }

            const icon = btn.querySelector('i');
            const esPassword = input.type === 'password';

            if (esPassword) {
                input.type = 'text';
                if (icon) { icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
                btn.setAttribute('aria-label', 'Ocultar contraseña');
            } else {
                input.type = 'password';
                if (icon) { icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
                btn.setAttribute('aria-label', 'Mostrar contraseña');
            }
        });
    });
}

    // ==========================================
    // TOAST
    // ==========================================
    mostrarMensaje(mensaje, tipo = 'info') {
        let box = document.querySelector('.message-box');
        if (!box) {
            box = document.createElement('div');
            box.className = 'message-box';
            document.body.appendChild(box);
        }

        const iconos = {
            success: 'fa-check-circle',
            error:   'fa-times-circle',
            info:    'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };
        const icono = iconos[tipo] || iconos.info;

        box.innerHTML = `<i class="fas ${icono}"></i> <span>${mensaje}</span>`;
        box.className = `message-box show ${tipo}`;
        box.style.zIndex = '20000';

        clearTimeout(this._msgTimeout);
        this._msgTimeout = setTimeout(() => box.classList.remove('show'), 4000);
    }
}

if (typeof window !== 'undefined') {
    window.PerfilController = PerfilController;
}