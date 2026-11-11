// ==============================================
// GestionMarcaciones Bootstrap — Punto de entrada de Gestion-Marcaciones.html
// Responsabilidad: Instanciar Services + Controller al cargar el DOM
// ==============================================

(function () {
    'use strict';

    function arrancar() {
        console.log('🚀 GestionMarcaciones Bootstrap: arrancando...');

        // ============================================
        // 1. OBTENER CONFIGURACIÓN GLOBAL
        // ============================================
        const cfg = (typeof CONFIG !== 'undefined') ? CONFIG : (window.CONFIG || {});

        // ============================================
        // 2. VERIFICAR DEPENDENCIAS
        // ============================================
        if (typeof AuthService === 'undefined') {
            console.error('❌ AuthService no cargó. Revisa Auth_Services.js');
            return;
        }
        if (typeof MarcacionesService === 'undefined') {
            console.error('❌ GestionMarcacionesService no cargó. Revisa Marcaciones_Service.js');
            return;
        }
        if (typeof MarcacionesController === 'undefined') {
            console.error('❌ GestionMarcacionesController no cargó. Revisa Marcaciones_Controller.js');
            return;
        }

        // ============================================
        // 3. INSTANCIAR SERVICES
        // ============================================
        const authService = new AuthService(cfg);
        const marcacionesService = new MarcacionesService(cfg);

        // ============================================
        // 4. INSTANCIAR CONTROLLER PRINCIPAL
        // ============================================
        const marcacionesController = new MarcacionesController(
            authService,
            marcacionesService,
            cfg
        );

        // ============================================
        // 5. EXPONER GLOBALMENTE (para depuración)
        // ============================================
        window.MarcacionesController = marcacionesController;
        window.MarcacionesService = marcacionesService;

        console.log('✅ GestionMarcaciones Bootstrap completado');
        console.log('📌 Controller disponible en: window.gestionMarcacionesController');
        console.log('📌 Service disponible en: window.gestionMarcacionesService');
    }

    // ============================================
    // ARRANCAR CUANDO EL DOM ESTÉ LISTO
    // (con defer, el DOM ya está listo, pero por seguridad)
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', arrancar);
    } else {
        arrancar();
    }
})();