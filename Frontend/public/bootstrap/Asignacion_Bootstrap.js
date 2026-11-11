// ==============================================
// Asignacion Bootstrap — Punto de entrada de Asignacion-Horarios.html
// ==============================================

(function () {
    'use strict';

    function arrancar() {
        console.log('🚀 Asignacion Bootstrap: arrancando...');

        const cfg = (typeof CONFIG !== 'undefined') ? CONFIG : (window.CONFIG || {});

        if (typeof AuthService === 'undefined')       { console.error('❌ AuthService no cargó'); return; }
        if (typeof AsignacionService === 'undefined') { console.error('❌ AsignacionService no cargó'); return; }
        if (typeof AsignacionController === 'undefined') { console.error('❌ AsignacionController no cargó'); return; }

        const authService = new AuthService(cfg);
        const asignacionService = new AsignacionService(cfg);

        window.asignacionController = new AsignacionController(authService, asignacionService, cfg);

        console.log('✅ Asignacion Bootstrap completado');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', arrancar);
    } else {
        arrancar();
    }
})();