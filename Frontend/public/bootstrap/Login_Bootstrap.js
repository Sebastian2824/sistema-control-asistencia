// ==============================================
// Bootstrap — Punto de entrada del Login
// Responsabilidad: instanciar Services + Controllers
// ==============================================

// ============================================
// Limpiar query string y hash residuales
// ============================================
(function limpiarURL() {
    const url = new URL(window.location.href);
    const tieneQuery = url.search && url.search !== '?';
    const tieneHash  = url.hash && url.hash !== '#';

    if (tieneQuery || tieneHash) {
        url.search = '';
        url.hash = '';
        window.history.replaceState({}, document.title, url.toString());
        console.log('🧹 URL limpiada de query/hash residuales');
    }
})();

(function () {
    'use strict';

    function arrancar() {
        console.log('🚀 Bootstrap: arrancando aplicación...');

        const cfg = window.CONFIG || {};

        // ============================================
        // Services
        // ============================================
        if (typeof AuthService === 'undefined') {
            console.error('❌ AuthService no cargó. Revisa la ruta de Auth_Services.js');
            return;
        }
        const authService = new AuthService(cfg);

        // ============================================
        // Controllers
        // ============================================
        if (typeof LoginController !== 'undefined') {
            window.LoginController = new LoginController(authService, cfg);
        } else {
            console.error('❌ LoginController no cargó. Revisa Login_Controller.js');
        }

        if (typeof RecuperarPasswordController !== 'undefined' &&
            typeof PasswordResetService !== 'undefined') {
            window.recuperarCtrl = new RecuperarPasswordController(cfg);
        } else {
            console.warn('⚠️ RecuperarPasswordController o PasswordResetService no cargaron');
        }

        console.log('✅ Bootstrap completado');
    }

    // Con `defer`, el DOM ya está listo cuando este script se ejecuta.
    // Pero por si acaso, esperamos a DOMContentLoaded si aún no ocurrió.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', arrancar);
    } else {
        arrancar();
    }
})();