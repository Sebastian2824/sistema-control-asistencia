// ==============================================
// SERVICE: AuthService
// Responsabilidad: Login y gestión de sesión.
// Depende de: ApiClient
// ==============================================

class AuthService {

    constructor(config) {
        this.config = config || {};
        this.api = new ApiClient(this.config);
        this.BACKEND_URL = this.api.BASE_URL; // por compatibilidad con código viejo

        if (typeof EnvironmentDetector !== 'undefined' && EnvironmentDetector.isDevelopment()) {
            console.log('🛠️ [DESARROLLO] Backend URL:', this.BACKEND_URL);
        } else {
            console.log('🚀 [PRODUCCIÓN] Backend URL:', this.BACKEND_URL);
        }
    }

    // ==============================================
    // VERIFICAR DISPONIBILIDAD
    // ==============================================
    async verificarBackendDisponible() {
        const r = await this.api.get('/health', { timeout: 3000 });
        return r.success === true && r.raw?.status === 'OK';
    }

    // ==============================================
    // 🔐 AUTENTICAR
    // ==============================================
    async autenticar(username, password) {
        console.log('🔐 Iniciando autenticación para:', username);

        const resultado = await this._autenticarConSQLServer(username, password);

        if (resultado.success) {
            console.log('✅ Autenticación exitosa');
            this._guardarSesion(resultado, 'sqlserver');
        } else {
            console.log('❌ Error de autenticación:', resultado.message);
        }

        return resultado;
    }

    // ==============================================
    // LLAMADA AL ENDPOINT /usuarios/login
    // ==============================================
    async _autenticarConSQLServer(username, password) {
        // Enviamos texto plano: el backend encripta y soporta
        // migración legacy de contraseñas.
        const r = await this.api.post('/usuarios/login', { username, password }, {
            timeout: 10000
        });

        // ============================================
        // 📊 TRADUCIR RESPUESTA DEL ApiClient
        // al contrato que espera el controller:
        // { success, message, errorType }
        // ============================================

        if (!r.success) {
            // Traducir errorType/codigo a mensaje amigable
            let message = r.error || '❌ Error de autenticación';

            switch (r.errorType) {
                case 'BAD_REQUEST':
                    message = r.error || '❌ Usuario/Email y contraseña son requeridos.';
                    break;
                case 'UNAUTHORIZED':
                    message = '❌ Usuario o contraseña incorrectos.';
                    break;
                case 'USUARIO_ELIMINADO':
                    message = r.error || '❌ Su cuenta ha sido desactivada. Contacte al administrador.';
                    break;
                case 'ROL_NO_AUTORIZADO':
                    message = r.error || '⛔ Acceso restringido. No tiene permisos para acceder.';
                    break;
                case 'SERVER_ERROR':
                    message = r.error || '⚠️ Error interno del servidor. Intente más tarde.';
                    break;
                case 'TIMEOUT':
                    message = '⚠️ El servidor tardó demasiado en responder. Intente nuevamente.';
                    break;
                case 'CONNECTION_ERROR':
                    message = '⚠️ No se pudo conectar al servidor. Verifique su conexión.';
                    break;
            }

            return {
                success: false,
                message,
                errorType: r.errorType || 'ERROR_GENERAL'
            };
        }

        // ============================================
        // ✅ LOGIN EXITOSO
        // El backend responde: { success:true, user:{...} }
        // ============================================
        const user = r.raw?.user;

        if (!user) {
            // Respuesta 200 sin user (defensivo)
            return {
                success: false,
                message: 'Error de autenticación',
                errorType: 'ERROR_GENERAL'
            };
        }

        // Defensa en profundidad: el backend ya bloquea IdEstado=2,
        // pero validamos por si acaso
        if (user.IdEstado !== undefined && user.IdEstado !== 1) {
            return {
                success: false,
                message: '❌ Su cuenta ha sido desactivada. Contacte al administrador.',
                errorType: 'USUARIO_ELIMINADO'
            };
        }

        console.log(`✅ Autenticación exitosa para: ${username}`);

        return {
            success: true,
            IdUsuario: user.IdUsuario,
            nombres: user.Nombres,
            apellidos: user.Apellidos || '',
            nombreUsuario: user.NombreUsuario,
            correo: user.Correo || '',
            rol: user.Rol,
            idEstado: user.IdEstado,
            message: 'Autenticación exitosa',
            source: 'sqlserver'
        };
    }

    // ==============================================
    // GUARDAR SESIÓN
    // ==============================================
    _guardarSesion(userData, source) {
        console.log('💾 Guardando sesión para:', userData.nombreUsuario);

        const usuarioActual = {
            IdUsuario: userData.IdUsuario,
            nombres: userData.nombres,
            apellidos: userData.apellidos,
            nombreUsuario: userData.nombreUsuario,
            correo: userData.correo,
            rol: userData.rol,
            idEstado: userData.idEstado,
            loginTime: Date.now(),
            authSource: source
        };

        sessionStorage.setItem('usuarioActual', JSON.stringify(usuarioActual));
        sessionStorage.setItem('loginTime', Date.now().toString());
        sessionStorage.setItem('rolActual', userData.rol);
        sessionStorage.setItem('authSource', source);

        // Formato legacy (compatibilidad con otras vistas)
        const legacy = {
            IdUsuario: userData.IdUsuario,
            nombres: userData.nombres,
            apellidos: userData.apellidos,
            nombreUsuario: userData.nombreUsuario,
            correo: userData.correo,
            rol: userData.rol,
            loginTime: new Date().toISOString()
        };
        sessionStorage.setItem('userLogged', JSON.stringify(legacy));

        console.log('✅ Sesión guardada');
    }

    // ==============================================
    // SESIÓN
    // ==============================================
    getUsuarioLogueado() {
        const userData = sessionStorage.getItem('usuarioActual');
        return userData ? JSON.parse(userData) : null;
    }

    getAuthSource() {
        return sessionStorage.getItem('authSource') || 'unknown';
    }

    cerrarSesion() {
        console.log('🚪 Cerrando sesión...');
        sessionStorage.removeItem('usuarioActual');
        sessionStorage.removeItem('userLogged');
        sessionStorage.removeItem('loginTime');
        sessionStorage.removeItem('rolActual');
        sessionStorage.removeItem('authSource');

        const loginRoute = this.config?.ROUTES?.LOGIN || 'index.html';
        window.location.href = loginRoute;
    }

    prevenirNavegacionAtras() {
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            // Página restaurada desde bfcache
            if (!this.verificarSesion()) {
                const loginUrl = this.config?.ROUTES?.LOGIN || (window.location.origin + '/index.html');
                window.location.replace(loginUrl);
            }
        }
    });
}

    verificarSesion() {
        let userData = sessionStorage.getItem('usuarioActual');
        let loginTime = sessionStorage.getItem('loginTime');

        if (!userData) {
            userData = sessionStorage.getItem('userLogged');
            if (userData) {
                try {
                    const parsed = JSON.parse(userData);
                    loginTime = parsed.loginTime
                        ? new Date(parsed.loginTime).getTime().toString()
                        : null;
                } catch {
                    loginTime = null;
                }
            }
        }

        if (!userData || !loginTime) return false;

        const tiempoExpiracion =
            this.config?.TIMEOUTS?.SESSION_TIMEOUT || 8 * 60 * 60 * 1000;

        if (Date.now() - parseInt(loginTime) > tiempoExpiracion) {
            this.cerrarSesion();
            return false;
        }

        return true;
    }
}

if (typeof window !== 'undefined') {
    window.AuthService = AuthService;
}