// ==============================================
// ENVIRONMENT DETECTOR - DETECCIÓN DE ENTORNO
// ==============================================

class EnvironmentDetector {
    
    /**
     * Determina si estamos en entorno de desarrollo local
     */
    static isDevelopment() {
        const hostname = window.location.hostname;
        return hostname === 'localhost' || 
               hostname === '127.0.0.1' ||
               hostname.startsWith('192.168.') ||
               hostname.startsWith('10.') ||
               hostname.startsWith('172.') ||
               hostname.includes('.local') || 
               hostname.endsWith('.dev') ||      
               hostname.endsWith('.test') ||   
               hostname.includes('staging') ||
               hostname.includes('test');   
    }
    
    /**
     * Determina si estamos en entorno de producción
     */
    static isProduction() {
        return !this.isDevelopment();
    }
    
    /**
     * Obtiene la URL del backend según el entorno
     */
    static getBackendURL() {
        if (this.isDevelopment()) {
            return 'http://localhost:3001';
        }
        return 'https://bancked-control-asistencia-production.up.railway.app';
    }
    
    /**
     * Obtiene la URL del backend con un endpoint específico
     */
    static getBackendEndpoint(endpoint) {
        const base = this.getBackendURL();
        // Asegurar que no haya doble slash
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${base}${cleanEndpoint}`;
    }
    
    /**
     * Obtiene la configuración completa según el entorno
     */
    static getConfig() {
        return {
            isDevelopment: this.isDevelopment(),
            isProduction: this.isProduction(),
            backendURL: this.getBackendURL(),
            environment: this.isDevelopment() ? 'development' : 'production'
        };
    }
}

// Exportar para usar en otros archivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnvironmentDetector;
}

// Hacer disponible globalmente
window.EnvironmentDetector = EnvironmentDetector;