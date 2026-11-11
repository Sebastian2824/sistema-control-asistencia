// ==============================================
// SERVICE: DashboardService
// Responsabilidad: Capa de comunicación HTTP del módulo Dashboard.
// Depende de: ApiClient
//
// Endpoints usados:
//   - /usuarios                                  (catálogo de usuarios)
//   - /sucursales                                (catálogo de sucursales)
//   - /areas                                     (catálogo de áreas)
//   - /horarios                                  (catálogo de horarios)
//   - /estados                                   (catálogo de estados)
//   - /marcaciones                               (TODAS las marcaciones)
//   - /asignaciones                              (TODAS las asignaciones)
// ==============================================

class DashboardService {

    constructor(config) {
        this.config = config || {};
        this.api = new ApiClient(this.config);
        this.BACKEND_URL = this.api.BASE_URL;

        // Cache simple en memoria para evitar peticiones duplicadas
        this.cache = {
            usuarios: null,
            sucursales: null,
            areas: null,
            horarios: null,
            estados: null,
            marcaciones: null,
            asignaciones: null
        };

        console.log('🔧 DashboardService - Backend URL:', this.BACKEND_URL);
    }

    // ==========================================
    // CATÁLOGOS
    // ==========================================

    /**
     * Obtiene el catálogo de usuarios activos.
     * @param {boolean} forzarRecarga - Si true, ignora la caché.
     * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
     */
    async getUsuarios(forzarRecarga = false) {
        if (!forzarRecarga && this.cache.usuarios) {
            return { success: true, data: this.cache.usuarios };
        }

        const r = await this.api.get('/usuarios');

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType,
                data: []
            };
        }

        const usuarios = (r.data || []).filter(u => u.IdEstado === 1);
        this.cache.usuarios = usuarios;
        return { success: true, data: usuarios };
    }

    /**
     * Obtiene el catálogo de sucursales.
     * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
     */
    async getSucursales() {
        if (this.cache.sucursales) {
            return { success: true, data: this.cache.sucursales };
        }

        const r = await this.api.get('/sucursales');

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType,
                data: []
            };
        }

        const sucursales = r.data || [];
        this.cache.sucursales = sucursales;
        return { success: true, data: sucursales };
    }

    /**
     * Obtiene el catálogo de áreas.
     * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
     */
    async getAreas() {
        if (this.cache.areas) {
            return { success: true, data: this.cache.areas };
        }

        const r = await this.api.get('/areas');

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType,
                data: []
            };
        }

        const areas = r.data || [];
        this.cache.areas = areas;
        return { success: true, data: areas };
    }

    /**
     * Obtiene el catálogo de horarios.
     * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
     */
    async getHorarios() {
        if (this.cache.horarios) {
            return { success: true, data: this.cache.horarios };
        }

        const r = await this.api.get('/horarios');

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType,
                data: []
            };
        }

        const horarios = r.data || [];
        this.cache.horarios = horarios;
        return { success: true, data: horarios };
    }

    /**
     * Obtiene el catálogo de estados.
     * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
     */
    async getEstados() {
        if (this.cache.estados) {
            return { success: true, data: this.cache.estados };
        }

        const r = await this.api.get('/estados');

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType,
                data: []
            };
        }

        const estados = r.data || [];
        this.cache.estados = estados;
        return { success: true, data: estados };
    }

    // ==========================================
    // DATOS PRINCIPALES (grandes volúmenes)
    // ==========================================

    /**
     * Obtiene TODAS las marcaciones (con paginación alta).
     * Es la fuente principal de datos para el dashboard.
     * @param {boolean} forzarRecarga - Si true, ignora la caché.
     * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
     */
    async getAllMarcaciones(forzarRecarga = false) {
        if (!forzarRecarga && this.cache.marcaciones) {
            return { success: true, data: this.cache.marcaciones };
        }

        const r = await this.api.get('/marcaciones', {
            query: { limit: 100000, offset: 0 }
        });

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType,
                data: []
            };
        }

        const marcaciones = r.data || [];
        this.cache.marcaciones = marcaciones;
        return { success: true, data: marcaciones };
    }

    /**
     * Obtiene TODAS las asignaciones (con paginación alta).
     * @param {boolean} forzarRecarga - Si true, ignora la caché.
     * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
     */
    async getAllAsignaciones(forzarRecarga = false) {
        if (!forzarRecarga && this.cache.asignaciones) {
            return { success: true, data: this.cache.asignaciones };
        }

        const r = await this.api.get('/asignaciones', {
            query: { limit: 100000, offset: 0 }
        });

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType,
                data: []
            };
        }

        const asignaciones = r.data || [];
        this.cache.asignaciones = asignaciones;
        return { success: true, data: asignaciones };
    }

    // ==========================================
    // MÉTODOS COMBINADOS
    // ==========================================

    /**
     * Carga en paralelo todos los datos necesarios para el dashboard:
     * usuarios, sucursales, áreas, horarios, estados,
     * marcaciones y asignaciones.
     *
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async cargarTodoParaDashboard(forzarRecarga = false) {
        try {
            console.log('📡 Cargando todos los datos del dashboard...');

            const [
                usuariosResult,
                sucursalesResult,
                areasResult,
                horariosResult,
                estadosResult,
                marcacionesResult,
                asignacionesResult
            ] = await Promise.all([
                this.getUsuarios(forzarRecarga),
                this.getSucursales(),
                this.getAreas(),
                this.getHorarios(),
                this.getEstados(),
                this.getAllMarcaciones(forzarRecarga),
                this.getAllAsignaciones(forzarRecarga)
            ]);

            // Verificar errores críticos (usuarios, marcaciones, asignaciones)
            if (!usuariosResult.success) {
                return { success: false, error: `Error cargando usuarios: ${usuariosResult.error}` };
            }
            if (!marcacionesResult.success) {
                return { success: false, error: `Error cargando marcaciones: ${marcacionesResult.error}` };
            }
            if (!asignacionesResult.success) {
                return { success: false, error: `Error cargando asignaciones: ${asignacionesResult.error}` };
            }

            // Los catálogos secundarios pueden fallar sin bloquear (se manejan con arrays vacíos)
            const data = {
                usuarios: usuariosResult.data || [],
                sucursales: sucursalesResult.success ? sucursalesResult.data : [],
                areas: areasResult.success ? areasResult.data : [],
                horarios: horariosResult.success ? horariosResult.data : [],
                estados: estadosResult.success ? estadosResult.data : [],
                marcaciones: marcacionesResult.data || [],
                asignaciones: asignacionesResult.data || []
            };

            console.log(`✅ Datos cargados:
                - Usuarios: ${data.usuarios.length}
                - Sucursales: ${data.sucursales.length}
                - Áreas: ${data.areas.length}
                - Horarios: ${data.horarios.length}
                - Estados: ${data.estados.length}
                - Marcaciones: ${data.marcaciones.length}
                - Asignaciones: ${data.asignaciones.length}
            `);

            return { success: true, data };

        } catch (error) {
            console.error('❌ Error en cargarTodoParaDashboard:', error);
            return { success: false, error: error.message || 'Error de conexión al cargar datos' };
        }
    }

    // ==========================================
    // HELPERS DE CATÁLOGOS (búsquedas locales)
    // ==========================================

    /**
     * Devuelve un usuario por ID desde la caché (o null).
     */
    getUsuarioById(idUsuario) {
        if (!this.cache.usuarios) return null;
        return this.cache.usuarios.find(u => u.IdUsuario === idUsuario) || null;
    }

    /**
     * Devuelve una sucursal por ID desde la caché (o null).
     */
    getSucursalById(idSucursal) {
        if (!this.cache.sucursales) return null;
        return this.cache.sucursales.find(s => s.IdSucursal === idSucursal) || null;
    }

    /**
     * Devuelve un área por ID desde la caché (o null).
     */
    getAreaById(idArea) {
        if (!this.cache.areas) return null;
        return this.cache.areas.find(a => a.IdArea === idArea) || null;
    }

    /**
     * Devuelve un horario por ID desde la caché (o null).
     */
    getHorarioById(idHorario) {
        if (!this.cache.horarios) return null;
        return this.cache.horarios.find(h => h.IdHorario === idHorario) || null;
    }

    /**
     * Devuelve un estado por ID desde la caché (o null).
     */
    getEstadoById(idEstado) {
        if (!this.cache.estados) return null;
        return this.cache.estados.find(e => e.IdEstado === idEstado) || null;
    }

    /**
     * Devuelve la descripción de un estado por ID.
     */
    getDescripcionEstado(idEstado) {
        const estado = this.getEstadoById(idEstado);
        return estado ? estado.Descripcion : null;
    }

    // ==========================================
    // CACHE
    // ==========================================

    /**
     * Limpia toda la caché en memoria.
     */
    clearCache() {
        this.cache = {
            usuarios: null,
            sucursales: null,
            areas: null,
            horarios: null,
            estados: null,
            marcaciones: null,
            asignaciones: null
        };
        console.log('🗑️ DashboardService: caché limpiada');
    }
}

// ============================================
// EXPOSICIÓN GLOBAL
// ============================================
if (typeof window !== 'undefined') {
    window.DashboardService = DashboardService;
}