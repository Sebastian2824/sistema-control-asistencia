// ==============================================
// Perfil Bootstrap — Punto de entrada de Mi-Perfil.html
// ==============================================

(function () {
    'use strict';

    function arrancar() {
        console.log('🚀 Perfil Bootstrap: arrancando...');

        const cfg = window.CONFIG || {};

        if (typeof AuthService === 'undefined') {
            console.error('❌ AuthService no cargó. Revisa Auth_Services.js');
            return;
        }
        if (typeof PerfilService === 'undefined') {
            console.error('❌ PerfilService no cargó. Revisa Usuario_Services.js');
            return;
        }
        if (typeof PerfilController === 'undefined') {
            console.error('❌ PerfilController no cargó. Revisa Perfil_Controller.js');
            return;
        }

        const authService    = new AuthService(cfg);
        const perfilService = new PerfilService(cfg);

        window.perfilController = new PerfilController(authService, perfilService, cfg);

        console.log('✅ Perfil Bootstrap completado');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', arrancar);
    } else {
        arrancar();
    }
})();