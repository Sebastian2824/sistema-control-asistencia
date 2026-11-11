// ==============================================
// CONFIGURACIÓN GLOBAL DEL SISTEMA - CONTROL DE ASISTENCIA
// ==============================================

const CONFIG = {
   
    BACKEND_URL: (() => {
        const isLocalhost = window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1' ||
                            window.location.hostname.startsWith('192.168.');
        return isLocalhost 
            ? 'http://localhost:3001' 
            : 'https://api-controlhorario.grupoperuroutes.com';
    })(),
    
    // Rutas del sistema
    ROUTES: {
        LOGIN: '/index.html',
        MENULOGIN: 'Frontend/src/views/Menu.html',
        MENU: 'Menu.html',
        REGISTRO_ASISTENCIA: 'Registro-Asistencia.html',
        GESTION_USUARIOS: 'Gestion-Usuarios.html',
        GESTION_ASIGNACION: 'Gestion-Asignaciones.html',
        GESTION_HORARIOS: 'Gestion-Horarios.html',
        GESTION_MARCACIONES: 'Gestion-Marcaciones.html',
        GESTION_ESTADOS: 'Dashboard-Asistencia.html',
        REPORTES: 'Reportes.html',
        MARCACIONES: 'Historial-Marcaciones.html',
        PERFIL: 'Mi-Perfil.html'
    },

    SINCRONIZACION: {
        // Tiempo de espera después del login para iniciar sincronización (ms)
        DELAY_INICIAL: 500,
        
        // Tiempo entre sincronizaciones en background (ms)
        INTERVALO: 5 * 60 * 1000, // 5 minutos
        
        // TTL del cache de sincronización (ms)
        CACHE_TTL: 2 * 60 * 1000, // 2 minutos
        
        // Máximo de reintentos por pendiente
        MAX_REINTENTOS: 3,
        
        // Interfaces a sincronizar
        INTERFACES: ['GestionUsuarios', 'Perfil']
    },
    
    // Tiempos en milisegundos
    TIMEOUTS: {
        MESSAGE_DURATION: 4000,
        REDIRECT_DELAY: 1500,
        REFRESH_INTERVAL: 30000,
        SESSION_TIMEOUT: 28800000
    },
    
    // Formatos de fecha y hora
    FORMATOS: {
        HORA: 'HH:mm',
        FECHA: 'yyyy-MM-dd',
        FECHA_HORA: 'yyyy-MM-dd HH:mm:ss'
    },
    
    // Endpoints de la API
    API_ACTIONS: {
        GET_ALL: 'getAll',
        GET_BY_ID: 'getById',
        CREATE: 'create',
        UPDATE: 'update',
        DELETE: 'delete',
        LOGIN: 'login',
        REGISTRAR_MARCACION: 'registrarMarcacion',
        REPORTE_ASISTENCIA: 'reporteAsistencia',
        
        // NUEVAS acciones SQL Server
        SQL_TEST_CONNECTION: 'sqlTestConnection',
        SQL_GET_TABLE: 'sqlGetTable',
        SQL_EXECUTE_QUERY: 'sqlExecuteQuery'
    }
};

if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}

// Exportar para usar en otros archivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}