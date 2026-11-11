// ==============================================
// CONTROLLER: MenuController
// Pantalla principal post-login
// Depende de: AuthService (para sesión) y CONFIG
// ==============================================

class MenuController {

    constructor(authService, config) {
        this.auth = authService;
        this.config = config || {};

        this.usuarioActual = null;
        this.inicializado = false;

        // DOM
        this.userMenu = null;
        this.userNameDisplay = null;
        this.userRoleDisplay = null;
        this.dropdownUserName = null;
        this.dropdownUserEmail = null;
        this.dropdownUserRole = null;
        this.welcomeUserName = null;
        this.logoutBtn = null;
        this.perfilBtn = null;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    // ============================================
    // INICIALIZACIÓN
    // ============================================
    init() {
        if (this.inicializado) return;
        console.log('🔧 Inicializando MenuController...');

        // 1) Verificar sesión
        if (!this.auth || !this.auth.verificarSesion()) {
            console.warn('⚠️ No hay sesión válida. Redirigiendo al login...');
            this.redirigirALogin();
            return;
        }

        this.usuarioActual = this.auth.getUsuarioLogueado();
        if (!this.usuarioActual) {
            console.warn('⚠️ Usuario no encontrado en sesión. Redirigiendo...');
            this.redirigirALogin();
            return;
        }

        console.log('📌 Usuario actual:', this.usuarioActual);
        console.log('📌 Rol del usuario:', this.usuarioActual.rol);

        // 2) Referencias DOM
        this._cachearDOM();

        // 3) Cargar datos en pantalla
        this.cargarDatosUsuario();

        // 4) Configurar eventos
        this.configurarEventos();
        this.configurarAccesoModulos();

        // 5) Prevenir caché (bfcache)
        this.prevenirCache();

        this.inicializado = true;
        console.log('✅ MenuController inicializado');
    }

    _cachearDOM() {
        this.userMenu          = document.getElementById('userMenu');
        this.userNameDisplay   = document.getElementById('displayUserName');
        this.userRoleDisplay   = document.getElementById('displayUserRole');
        this.dropdownUserName  = document.getElementById('dropdownUserName');
        this.dropdownUserEmail = document.getElementById('dropdownUserEmail');
        this.dropdownUserRole  = document.getElementById('dropdownUserRole');
        this.welcomeUserName   = document.getElementById('welcomeUserName');
        this.logoutBtn         = document.getElementById('logoutBtn');
        this.perfilBtn         = document.getElementById('perfilBtn');
    }

    // ============================================
    // REDIRECCIONES
    // ============================================
    redirigirALogin() {
        const loginRoute = this.config?.ROUTES?.LOGIN || '/index.html';
        window.location.replace(loginRoute);
    }

    // ============================================
    // CARGAR DATOS DEL USUARIO EN LA UI
    // ============================================
    cargarDatosUsuario() {
        const u = this.usuarioActual;
        const nombres   = u.nombres   || u.Nombres   || '';
        const apellidos = u.apellidos || u.Apellidos || '';
        const nombreCompleto = `${nombres} ${apellidos}`.trim() || u.nombreUsuario || 'Usuario';
        const correo = u.correo || u.Correo || 'sin correo';
        const rol    = u.rol    || u.Rol    || 'Usuario';

        if (this.userNameDisplay)   this.userNameDisplay.textContent = nombreCompleto;
        if (this.welcomeUserName)   this.welcomeUserName.textContent = nombres || nombreCompleto;
        if (this.dropdownUserName)  this.dropdownUserName.textContent = nombreCompleto;
        if (this.dropdownUserEmail) this.dropdownUserEmail.textContent = correo;
        if (this.userRoleDisplay)   this.userRoleDisplay.textContent = rol;
        if (this.dropdownUserRole)  this.dropdownUserRole.textContent = rol;
    }

    // ============================================
    // EVENTOS
    // ============================================
    configurarEventos() {
        // Toggle dropdown usuario
        if (this.userMenu) {
            this.userMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                this.userMenu.classList.toggle('active');
            });
        }

        // Cerrar dropdown al hacer clic fuera
        document.addEventListener('click', () => {
            if (this.userMenu) this.userMenu.classList.remove('active');
        });

        // Logout
        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.cerrarSesion();
            });
        }

        // Perfil
        if (this.perfilBtn) {
            this.perfilBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.irAPerfil();
            });
        }

        // Tarjetas del menú
        this.configurarTarjetasMenu();
    }

    configurarTarjetasMenu() {
        const cards = document.querySelectorAll('.menu-card');
        cards.forEach(card => {
            const module = card.getAttribute('data-module');
            if (!module) return;

            card.addEventListener('click', (e) => {
                if (e.target.closest('.card-btn')) e.stopPropagation();
                this.redirigirModulo(module);
            });
        });
    }

    // ============================================
    // NAVEGACIÓN
    // ============================================
    redirigirModulo(module) {
        const R = this.config?.ROUTES || {};
        const rutas = {
            marcacion:          R.REGISTRO_ASISTENCIA,
            miHistorial:        R.MARCACIONES,
            perfil:             R.PERFIL,
            usuarios:           R.GESTION_USUARIOS,
            tipoHorario:        R.GESTION_HORARIOS,
            asignacionHorario:  R.GESTION_ASIGNACION,
            reportes:           R.REPORTES,
            todasMarcaciones:   R.GESTION_MARCACIONES
        };

        const ruta = rutas[module];

        if (ruta) {
            console.log(`🚀 Redirigiendo a: ${ruta}`);
            window.location.href = ruta;
        } else {
            this.mostrarMensaje('Módulo en desarrollo. Próximamente disponible.', 'info');
        }
    }

    irAPerfil() {
        const ruta = this.config?.ROUTES?.PERFIL;
        if (ruta) {
            window.location.href = ruta;
        } else {
            this.mostrarMensaje('Módulo de perfil no disponible.', 'info');
        }
    }

    // ============================================
    // LOGOUT
    // ============================================
    cerrarSesion() {
        console.log('🚪 Cerrando sesión...');
        this.mostrarMensaje('Sesión cerrada correctamente', 'success');

        setTimeout(() => {
            // AuthService.cerrarSesion() limpia sessionStorage y redirige
            this.auth.cerrarSesion();
        }, 800);
    }

    // ============================================
    // ACCESO POR ROL
    // Roles reales del backend:
    //   ADMINISTRADOR, COLABORADOR - COUNTER, COLABORADOR - MAYORISTA
    // ============================================
    configurarAccesoModulos() {
        const rolRaw = this.usuarioActual?.rol || this.usuarioActual?.Rol || '';
        const rolUpper = String(rolRaw).toUpperCase().trim();

        // Normalizar
        const esAdmin = rolUpper === 'ADMINISTRADOR';
        const esColaborador = rolUpper.includes('COLABORADOR');
        const esEmpleado = esColaborador; // todos los colaboradores son "empleado"

        console.log(`🔐 Configurando acceso para rol: ${rolRaw}`);
        console.log(`   esAdmin: ${esAdmin} | esColaborador: ${esColaborador}`);

        const cards = document.querySelectorAll('.menu-card');

        cards.forEach(card => {
            const rolesAttr = card.getAttribute('data-role');
            if (!rolesAttr) return;

            const permitidos = rolesAttr.split(',').map(r => r.trim().toLowerCase());

            let tieneAcceso = false;

            if (esAdmin) {
                tieneAcceso = true; // admin ve todo
            } else if (esEmpleado) {
                tieneAcceso = permitidos.includes('empleado');
            }

            if (tieneAcceso) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });
    }

    // ============================================
    // BFCACHE
    // ============================================
    prevenirCache() {
        window.addEventListener('pageshow', (event) => {
            if (event.persisted) {
                console.log('🔄 Página cargada desde caché, revalidando sesión...');
                if (!this.auth.verificarSesion()) {
                    this.redirigirALogin();
                }
            }
        });
    }

    // ============================================
    // MENSAJES TOAST
    // ============================================
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

        clearTimeout(this._msgTimeout);
        this._msgTimeout = setTimeout(() => {
            box.classList.remove('show');
        }, 4000);
    }
}

if (typeof window !== 'undefined') {
    window.MenuController = MenuController;
}