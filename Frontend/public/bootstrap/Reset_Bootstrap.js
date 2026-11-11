// ==============================================
// Reset Bootstrap — Punto de entrada de Reset-Password.html
// Responsabilidad: instanciar ResetPasswordController
// ==============================================

(function () {
    'use strict';

    function arrancar() {
        console.log('🚀 Reset Bootstrap: arrancando...');

        const cfg = window.CONFIG || {};

        // Verificar que las clases necesarias existan
        if (typeof PasswordResetService === 'undefined') {
            console.error('❌ PasswordResetService no cargó. Revisa Password_Reset_Services.js');
            return;
        }
        if (typeof ResetPasswordController === 'undefined') {
            console.error('❌ ResetPasswordController no cargó. Revisa Reset_Password_Controller.js');
            return;
        }

        window.resetPasswordController = new ResetPasswordController(cfg);
        console.log('✅ Reset Bootstrap completado');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', arrancar);
    } else {
        arrancar();
    }
})();