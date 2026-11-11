// ==============================================
// SESSION GUARD - Control de sesión y limpieza de formularios
// Responsabilidad: Limpiar sessionStorage y resetear formularios
// SOLO en la página de login
// Sistema: Control de Asistencia
// ==============================================

const SessionGuard = {
    /**
     * Claves de sessionStorage que deben limpiarse
     */
    clavesSesion: [
        'usuarioActual',    // Nueva clave (reemplaza userLogged)
        'loginTime',
        'rolActual',
        'authSource',
        'userLogged'        // Por compatibilidad con versiones anteriores
    ],
    
    /**
     * Verifica si la página actual es el login
     */
    esPaginaLogin: function() {
        const path = window.location.pathname;
        const filename = path.split('/').pop();
        // Considerar como login: index.html, página vacía o raíz
        return filename === 'index.html' || filename === '' || path === '/' || path.endsWith('/');
    },
    
    /**
     * Inicializa el guardia de sesión solo en login
     */
    init: function() {
        if (this.esPaginaLogin()) {
            console.log('🔐 Página de login detectada, activando guardia de sesión');
            this.limpiarStorage();
            this.configurarEventos();
            this.prevenirRestauracionEstado();
            this.limpiarYResetearLogin();
        } else {
            console.log('📍 No es página de login, sessionGuard inactivo');
        }
    },
    
    /**
     * Limpia sessionStorage (todas las claves relacionadas con sesión)
     */
    limpiarStorage: function() {
        this.clavesSesion.forEach(clave => {
            if (sessionStorage.getItem(clave)) {
                sessionStorage.removeItem(clave);
                console.log(`🗑️ Eliminada clave: ${clave}`);
            }
        });
        console.log('✅ SessionStorage limpiado completamente (solo en login)');
    },
    
    /**
     * Limpia campos y resetea el formulario de login
     */
    limpiarYResetearLogin: function() {
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const loginForm = document.getElementById('loginForm');
        const loginBtn = document.getElementById('loginBtn');
        const messageBox = document.getElementById('loginMessage');
        
        // Limpiar valores de inputs
        if (usernameInput) {
            usernameInput.value = '';
            usernameInput.removeAttribute('value');
            usernameInput.classList.remove('error');
        }
        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.removeAttribute('value');
            passwordInput.classList.remove('error');
        }
        
        // Resetear el formulario
        if (loginForm) {
            loginForm.reset();
        }
        
        // Habilitar botón y resetear su texto
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Iniciar Sesión';
        }
        
        // Limpiar mensajes de error
        if (messageBox) {
            messageBox.classList.remove('show');
            messageBox.className = 'message-box';
            messageBox.textContent = '';
        }
        
        // Limpiar errores específicos
        const usernameError = document.getElementById('usernameError');
        const passwordError = document.getElementById('passwordError');
        if (usernameError) usernameError.classList.remove('show');
        if (passwordError) passwordError.classList.remove('show');
        
        console.log('🧹 Formulario de login reseteado completamente');
    },
    
    /**
     * Previene cualquier submit automático
     */
    prevenirAutoSubmit: function() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.removeAttribute('submitted');
            // Asegurar que el formulario no tenga valores autocompletados
            loginForm.setAttribute('autocomplete', 'off');
        }
    },
    
    /**
     * Previene que el navegador restaure el estado del formulario
     */
    prevenirRestauracionEstado: function() {
        if (window.history && window.history.replaceState) {
            window.history.replaceState({ page: 'login' }, document.title, window.location.href);
        }
        
        // También prevenir restauración de scroll
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
    },
    
    /**
     * Configura todos los eventos necesarios
     */
    configurarEventos: function() {
        // Forzar limpieza al cargar la página (cuando viene del caché)
        window.addEventListener('pageshow', (event) => {
            if (event.persisted) {
                console.log('🔄 Página de login cargada desde caché, limpiando y reseteando...');
                this.limpiarStorage();
                this.limpiarYResetearLogin();
                this.prevenirAutoSubmit();
            }
        });
        
        // Limpiar también cuando la página se oculta
        window.addEventListener('beforeunload', () => {
            if (typeof RememberMe !== 'undefined' && RememberMe.hayCredenciales()) {
        return;
    }
            // No limpiar completamente en beforeunload para no afectar redirecciones
            // Solo limpiar campos del formulario si existe
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            if (usernameInput) usernameInput.value = '';
            if (passwordInput) passwordInput.value = '';
        });
        
        // Prevenir autocompletado del navegador
        setTimeout(() => {
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            if (usernameInput) usernameInput.setAttribute('autocomplete', 'off');
            if (passwordInput) passwordInput.setAttribute('autocomplete', 'off');
        }, 100);
    },
    
    /**
     * Método para forzar limpieza manual (útil en casos específicos)
     */
    forzarLimpieza: function() {
        console.log('🧹 Forzando limpieza manual de sesión');
        this.limpiarStorage();
        this.limpiarYResetearLogin();
    }
};

// Inicializar automáticamente cuando se carga el script
SessionGuard.init();

// Exportar para usar en otros archivos (si es necesario)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionGuard;
}