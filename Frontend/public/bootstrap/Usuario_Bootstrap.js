// ==============================================
// GestionUsuarios Bootstrap — Punto de entrada de Gestion-Usuarios.html
// ==============================================

(function () {
    'use strict';

    function arrancar() {
        console.log('🚀 GestionUsuarios Bootstrap: arrancando...');

        const cfg = (typeof CONFIG !== 'undefined') ? CONFIG : (window.CONFIG || {});

        if (typeof AuthService === 'undefined')          { console.error('❌ AuthService no cargó'); return; }
        if (typeof UsuarioService === 'undefined')      { console.error('❌ UsuarioService no cargó'); return; }
        if (typeof GestionUsuariosController === 'undefined') { console.error('❌ GestionUsuariosController no cargó'); return; }

        const authService = new AuthService(cfg);
        const usuarioService = new UsuarioService(cfg);

        window.gestionUsuariosController = new GestionUsuariosController(authService, usuarioService, cfg);

        console.log('✅ GestionUsuarios Bootstrap completado');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', arrancar);
    } else {
        arrancar();
    }
})();