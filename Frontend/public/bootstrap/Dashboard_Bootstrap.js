// ==============================================
// Dashboard Bootstrap — Punto de entrada de Dashboard-Asistencia.html
// Responsabilidad: Instanciar Service + Controller al cargar el DOM.
// Depende de: CONFIG, DashboardService, DashboardController
// ==============================================

(function () {
    'use strict';

    function arrancar() {
        console.log('🚀 Dashboard Bootstrap: arrancando...');

        // ============================================
        // 1. OBTENER CONFIGURACIÓN GLOBAL
        // ============================================
        const cfg = (typeof CONFIG !== 'undefined') ? CONFIG : (window.CONFIG || {});

        // ============================================
        // 2. VERIFICAR DEPENDENCIAS
        // ============================================
        if (typeof DashboardService === 'undefined') {
            console.error('❌ DashboardService no cargó. Revisa Dashboard_Services.js');
            return;
        }
        if (typeof DashboardController === 'undefined') {
            console.error('❌ DashboardController no cargó. Revisa Dashboard_Controller.js');
            return;
        }

        // ============================================
        // 3. INSTANCIAR SERVICE
        // ============================================
        const dashboardService = new DashboardService(cfg);

        // ============================================
        // 4. INSTANCIAR CONTROLLER PRINCIPAL
        //    (el controller instancia internamente los sub-controladores)
        // ============================================
        const dashboardController = new DashboardController(cfg);

        // Inyectar el service al controller
        dashboardController.service = dashboardService;

        // Re-inicializar (el controller ya llamó a init() en el constructor,
        // pero como aún no tenía el service, llamamos a init() de nuevo)
        dashboardController.init();

        // ============================================
        // 5. EXPONER GLOBALMENTE (para depuración)
        // ============================================
        window.dashboardController = dashboardController;
        window.dashboardService = dashboardService;

        console.log('✅ Dashboard Bootstrap completado');
        console.log('📌 Controller disponible en: window.dashboardController');
        console.log('📌 Service disponible en: window.dashboardService');
    }

    // ============================================
    // ARRANCAR CUANDO EL DOM ESTÉ LISTO
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', arrancar);
    } else {
        arrancar();
    }
})();