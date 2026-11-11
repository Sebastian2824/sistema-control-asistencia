// ==============================================
// Horario Bootstrap — Punto de entrada de Gestion-Horarios.html
// ==============================================

(function () {
    'use strict';

    function arrancar() {
        console.log('🚀 Horario Bootstrap: arrancando...');

        const cfg = (typeof CONFIG !== 'undefined') ? CONFIG : (window.CONFIG || {});

        if (typeof AuthService === 'undefined')   { console.error('❌ AuthService no cargó'); return; }
        if (typeof HorarioService === 'undefined') { console.error('❌ HorarioService no cargó. Revisa Horario_Services.js'); return; }
        if (typeof HorarioController === 'undefined') { console.error('❌ HorarioController no cargó. Revisa Horario_Controller.js'); return; }

        const authService    = new AuthService(cfg);
        const horarioService = new HorarioService(cfg);

        window.horarioController = new HorarioController(authService, horarioService, cfg);

        console.log('✅ Horario Bootstrap completado');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', arrancar);
    } else {
        arrancar();
    }
})();