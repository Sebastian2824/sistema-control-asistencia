// ==============================================
// Menu Bootstrap — Punto de entrada de Menu.html
// ==============================================

(function () {
    'use strict';

    function arrancar() {
        console.log('🚀 Menu Bootstrap: arrancando...');

        const cfg = window.CONFIG || {};

        // Verificar dependencias
        if (typeof AuthService === 'undefined') {
            console.error('❌ AuthService no cargó. Revisa Auth_Services.js');
            return;
        }
        if (typeof MenuController === 'undefined') {
            console.error('❌ MenuController no cargó. Revisa Menu_Controller.js');
            return;
        }

        // Instanciar
        const authService = new AuthService(cfg);
        window.menuController = new MenuController(authService, cfg);

        console.log('✅ Menu Bootstrap completado');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', arrancar);
    } else {
        arrancar();
    }
})();