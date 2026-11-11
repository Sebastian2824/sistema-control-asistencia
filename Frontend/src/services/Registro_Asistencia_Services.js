// ==============================================
// SERVICE: RegistroAsistenciaService
// Responsabilidad: Capa de comunicación HTTP del módulo
//                 Registro de Asistencia.
// Depende de: ApiClient
//
// Endpoints usados:
//   - /asignaciones/usuario/:id          (asignación del día)
//   - /marcaciones/usuario/:id           (marcación del día)
//   - /marcaciones                       (crear marcación)
//   - /marcaciones/:id                   (actualizar marcación)
//   - /marcacion-evidencia/marcacion/:id (obtener evidencia)
//   - /marcacion-evidencia               (crear evidencia)
//   - /marcacion-evidencia/:id           (actualizar evidencia)
//   - /justificaciones                   (crear justificación/evidencia tardanza)
//   - /sucursales/coordenadas            (sucursales con coords)
//   - /estados                           (catálogo de estados)
//   - /horarios                          (catálogo de horarios)
// ==============================================

class RegistroAsistenciaService {

    constructor(config) {
        this.config = config || {};
        this.api = new ApiClient(this.config);
        this.BACKEND_URL = this.api.BASE_URL; // por compatibilidad con código viejo

        console.log('🔧 RegistroAsistenciaService - Backend URL:', this.BACKEND_URL);
    }

    // ==========================================
    // ASIGNACIONES
    // ==========================================

    /**
     * Obtiene la asignación de un usuario para una fecha.
     * Filtra en cliente porque el backend devuelve todas del usuario en rango.
     *
     * @param {number} idUsuario
     * @param {string} fecha  // 'YYYY-MM-DD'
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    async obtenerAsignacion(idUsuario, fecha) {
        // Pedimos solo el rango de ese día (fechaInicio = fechaFin)
        const r = await this.api.get(`/asignaciones/usuario/${idUsuario}`, {
            query: { fechaInicio: fecha, fechaFin: fecha }
        });

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType
            };
        }

        const lista = Array.isArray(r.data) ? r.data : [];
        const asignacion = lista.find(a => this._normalizarFecha(a.Fecha) === fecha);

        if (!asignacion) {
            return { success: false, error: 'No hay asignación para hoy' };
        }

        return { success: true, data: asignacion };
    }

    // ==========================================
    // MARCACIONES
    // ==========================================

    /**
     * Obtiene la marcación de un usuario para una fecha.
     */
    async obtenerMarcacion(idUsuario, fecha) {
        const r = await this.api.get(`/marcaciones/usuario/${idUsuario}`, {
            query: { fechaInicio: fecha, fechaFin: fecha }
        });

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType
            };
        }

        const lista = Array.isArray(r.data) ? r.data : [];
        const marcacion = lista.find(m => this._normalizarFecha(m.Fecha) === fecha);

        if (!marcacion) {
            return { success: false, error: 'No hay marcación para hoy' };
        }

        return { success: true, data: marcacion };
    }

    /**
     * Crea una nueva marcación (ingreso o falta).
     *
     * @param {object} data  // payload normalizado (ver controller)
     * @returns {Promise<{success: boolean, id?: number, error?: string}>}
     */
    async crearMarcacion(data) {
        const r = await this.api.post('/marcaciones', data);

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType
            };
        }

        return {
            success: true,
            id: r.data?.id ?? r.raw?.id,
            message: r.message
        };
    }

    /**
     * Actualiza una marcación existente (salida, almuerzo, etc.).
     */
    async actualizarMarcacion(id, data) {
        const r = await this.api.put(`/marcaciones/${id}`, data);

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType
            };
        }

        return { success: true, message: r.message };
    }

    // ==========================================
    // EVIDENCIAS (selfies)
    // ==========================================

    /**
     * Obtiene la evidencia activa de una marcación.
     */
    async obtenerEvidenciaPorMarcacion(idMarcacion) {
        const r = await this.api.get(`/marcacion-evidencia/marcacion/${idMarcacion}`);

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType
            };
        }

        return { success: true, data: r.data };
    }

    /**
     * Crea una nueva evidencia (primera vez).
     */
    async crearEvidencia(data) {
        const r = await this.api.post('/marcacion-evidencia', data);

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType
            };
        }

        return {
            success: true,
            id: r.data?.id ?? r.raw?.id,
            message: r.message
        };
    }

    /**
     * Actualiza una evidencia existente (agrega otra foto).
     */
    async actualizarEvidencia(id, data) {
        const r = await this.api.put(`/marcacion-evidencia/${id}`, data);

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType
            };
        }

        return { success: true, message: r.message };
    }

    // ==========================================
    // JUSTIFICACIONES (evidencia de tardanza)
    // ==========================================

    /**
     * Crea una justificación de tardanza con evidencia.
     *
     * El backend resuelve el IdTipoJustificacion a partir de
     * la descripción (TipoTardanza). Acepta:
     *   - "TARDANZA - INGRESO"
     *   - "TARDANZA - INGRESO ALMUERZO"
     *   - "EXCESO - SALIDA ALMUERZO"
     *   - "FALTA"
     */
    async crearJustificacionTardanza(data) {
        // data: { IdMarcacion, TipoTardanza, ArchivoEvidencia, TipoArchivo }
        const r = await this.api.post('/justificaciones', data);

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType
            };
        }

        return {
            success: true,
            id: r.data?.id ?? r.raw?.id,
            message: r.message,
            IdTipoJustificacion: r.raw?.IdTipoJustificacion
        };
    }

    /**
     * Obtiene las justificaciones activas de una marcación.
     */
    async obtenerJustificacionPorMarcacion(idMarcacion) {
        const r = await this.api.get(`/justificaciones/marcacion/${idMarcacion}`);

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType
            };
        }

        return { success: true, data: r.data };
    }

    // ==========================================
    // CATÁLOGOS
    // ==========================================

    /**
     * Obtiene el catálogo de sucursales con coordenadas válidas.
     */
    async obtenerSucursales() {
        const r = await this.api.get('/sucursales/coordenadas');

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType
            };
        }

        // Normalizar para que el controller reciba siempre el mismo shape
        const sucursales = (r.data || [])
            .map(s => ({
                id: s.IdSucursal,
                nombre: s.NombreSucursal,
                direccion: s.Direccion,
                telefono: s.Telefono,
                lat: parseFloat(s.Latitud),
                lng: parseFloat(s.Longitud),
                radioMetros: parseFloat(s.RadioMetros) || 80,
                IdEstado: s.IdEstado
            }))
            .filter(s => !isNaN(s.lat) && !isNaN(s.lng) && s.radioMetros > 0);

        return { success: true, data: sucursales };
    }

    /**
     * Obtiene el catálogo de estados.
     */
    async obtenerEstados() {
        const r = await this.api.get('/estados');

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType
            };
        }

        return { success: true, data: r.data || [] };
    }

    /**
     * Obtiene el catálogo de horarios (tipos de horario).
     */
    async obtenerHorarios() {
        const r = await this.api.get('/horarios');

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType
            };
        }

        return { success: true, data: r.data || [] };
    }

    /**
     * Obtiene un tipo de horario por su ID.
     */
    async obtenerHorarioPorId(idHorario) {
        const r = await this.api.get(`/horarios/${idHorario}`);

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType
            };
        }

        return { success: true, data: r.data };
    }

    // ==========================================
    // HELPERS
    // ==========================================

    /**
     * Normaliza cualquier formato de fecha a 'YYYY-MM-DD'.
     * (Duplicado del controller para no acoplar capas.)
     */
    _normalizarFecha(valor) {
        if (!valor) return null;

        if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
            return valor;
        }

        if (typeof valor === 'string' && valor.includes('T')) {
            const partes = valor.split('T');
            if (partes[0].match(/^\d{4}-\d{2}-\d{2}$/)) return partes[0];
        }

        if (typeof valor === 'string' && valor.includes(' ')) {
            const partes = valor.split(' ');
            if (partes[0].match(/^\d{4}-\d{2}-\d{2}$/)) return partes[0];
        }

        try {
            const d = new Date(valor);
            if (!isNaN(d.getTime())) {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${dd}`;
            }
        } catch (e) {
            console.warn('⚠️ Fecha no reconocida en service:', valor);
        }

        return null;
    }
}

// ============================================
// EXPOSICIÓN GLOBAL
// ============================================
if (typeof window !== 'undefined') {
    window.RegistroAsistenciaService = RegistroAsistenciaService;
}