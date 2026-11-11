// ==============================================
// Registro Bootstrap — Punto de entrada de Registro-Asistencia.html
// Responsabilidad: Instanciar Services + Controllers
// ==============================================

(function () {
    'use strict';

    function arrancar() {
        console.log('🚀 Registro Bootstrap: arrancando...');

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
        if (typeof RegistroAsistenciaService === 'undefined') {
            console.error('❌ RegistroAsistenciaService no cargó. Revisa Registro_Asistencia_Services.js');
            return;
        }
        if (typeof GPSController === 'undefined') {
            console.error('❌ GPSController no cargó. Revisa GPS_Controller.js');
            return;
        }
        if (typeof SelfieController === 'undefined') {
            console.error('❌ SelfieController no cargó. Revisa Selfie_Controller.js');
            return;
        }
        if (typeof JustificacionController === 'undefined') {
            console.error('❌ JustificacionController no cargó. Revisa Justificacion_Controller.js');
            return;
        }
        if (typeof RegistroAsistenciaController === 'undefined') {
            console.error('❌ RegistroAsistenciaController no cargó. Revisa Registro_Asistencia_Controller.js');
            return;
        }

        // ============================================
        // 3. INSTANCIAR SERVICES
        // ============================================
        const authService = new AuthService(cfg);
        const registroService = new RegistroAsistenciaService(cfg);

        // ============================================
        // 4. INSTANCIAR SUB-CONTROLLERS
        //    (Se pasan entre sí el service para compartir la capa de red)
        // ============================================
        const gpsController = new GPSController(cfg, registroService);
        const selfieController = new SelfieController(cfg);
        const justificacionController = new JustificacionController(cfg, registroService);

        // ============================================
        // 5. INSTANCIAR CONTROLLER PRINCIPAL
        //    (Recibe todas las dependencias)
        // ============================================
        const registroController = new RegistroAsistenciaController(
            authService,
            registroService,
            gpsController,
            selfieController,
            justificacionController,
            cfg
        );

        // ============================================
        // 6. EXPONER GLOBALMENTE (para depuración)
        // ============================================
        window.registroAsistenciaController = registroController;
        window.registroAsistenciaService = registroService;
        window.gpsController = gpsController;
        window.selfieController = selfieController;
        window.justificacionController = justificacionController;

        console.log('✅ Registro Bootstrap completado');
        console.log('📌 Sub-controllers disponibles:');
        console.log('   - window.gpsController');
        console.log('   - window.selfieController');
        console.log('   - window.justificacionController');
        console.log('   - window.registroAsistenciaController (principal)');
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