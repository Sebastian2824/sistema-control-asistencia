// ==============================================
// UTILIDAD: RememberMe
// Responsabilidad: Guardar/recuperar credenciales del usuario
// ==============================================

class RememberMe {
    
    static STORAGE_KEY = 'pr_remember_credentials';
    
    /**
     * Guarda las credenciales si el usuario marcó "recordar"
     * @param {string} username
     * @param {string} password - Texto plano
     */
    static guardar(username, password) {
        try {
            // Ofuscación simple: Base64 + salt
            const datos = {
                u: btoa(unescape(encodeURIComponent(username))),
                p: btoa(unescape(encodeURIComponent(password))),
                v: '1' // versión, por si cambias el formato luego
            };
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(datos));
            console.log('💾 Credenciales guardadas');
            return true;
        } catch (error) {
            console.error('❌ Error guardando credenciales:', error);
            return false;
        }
    }
    
    /**
     * Recupera las credenciales guardadas
     * @returns {{username: string, password: string}|null}
     */
    static obtener() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return null;
            
            const datos = JSON.parse(raw);
            if (!datos.u || !datos.p) return null;
            
            return {
                username: decodeURIComponent(escape(atob(datos.u))),
                password: decodeURIComponent(escape(atob(datos.p)))
            };
        } catch (error) {
            console.error('❌ Error recuperando credenciales:', error);
            this.limpiar(); // Limpiar si está corrupto
            return null;
        }
    }
    
    /**
     * Limpia las credenciales guardadas
     */
    static limpiar() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            console.log('🗑️ Credenciales eliminadas');
        } catch (error) {
            console.error('❌ Error limpiando credenciales:', error);
        }
    }
    
    /**
     * Verifica si hay credenciales guardadas
     * @returns {boolean}
     */
    static hayCredenciales() {
        return localStorage.getItem(this.STORAGE_KEY) !== null;
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.RememberMe = RememberMe;
}