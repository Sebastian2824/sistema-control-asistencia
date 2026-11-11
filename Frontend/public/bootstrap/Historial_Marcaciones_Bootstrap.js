// ==============================================
// HistorialMarcaciones Bootstrap — Punto de entrada de Historial-Marcaciones.html
// Responsabilidad: Instanciar Services + Controller al cargar el DOM
// ==============================================

(function () {
    'use strict';

    function arrancar() {
        console.log('🚀 HistorialMarcaciones Bootstrap: arrancando...');

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
        if (typeof HistorialMarcacionesService === 'undefined') {
            console.error('❌ HistorialMarcacionesService no cargó. Revisa Historial_Marcacion_Service.js');
            return;
        }
        if (typeof HistorialMarcacionesController === 'undefined') {
            console.error('❌ HistorialMarcacionesController no cargó. Revisa Historial_Marcaciones_Controller.js');
            return;
        }

        // ============================================
        // 3. INSTANCIAR SERVICES
        // ============================================
        const authService = new AuthService(cfg);
        const historialMarcacionesService = new HistorialMarcacionesService(cfg);

        // ============================================
        // 4. INSTANCIAR CONTROLLER PRINCIPAL
        // ============================================
        const historialMarcacionesController = new HistorialMarcacionesController(
            authService,
            historialMarcacionesService,
            cfg
        );

        // ============================================
        // 5. EXPONER GLOBALMENTE (para depuración)
        // ============================================
        window.historialMarcacionesController = historialMarcacionesController;
        window.historialMarcacionesService = historialMarcacionesService;

        console.log('✅ HistorialMarcaciones Bootstrap completado');
        console.log('📌 Controller disponible en: window.historialMarcacionesController');
        console.log('📌 Service disponible en: window.historialMarcacionesService');
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