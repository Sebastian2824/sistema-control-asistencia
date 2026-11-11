// ==============================================
// SERVICE: GestionMarcacionesService
// Responsabilidad: Capa de comunicación HTTP del módulo
//                 Gestión de Marcaciones (Admin).
// Depende de: ApiClient
//
// Endpoints usados (nueva arquitectura):
//   - /marcaciones                              (listar todas)
//   - /marcaciones/:id                          (obtener por ID)
//   - /marcaciones/:id                          (actualizar)
//   - /marcaciones/rango                        (por rango de fechas)
//   - /marcaciones/usuario/:id                  (por usuario)
//   - /marcaciones/:id/observaciones            (actualizar obs)
//   - /marcaciones/:id/jornada-completa         (actualizar solo jornada)
//   - /marcaciones/:id/estados-almuerzo         (estados de almuerzo)
//   - /marcacion-evidencia/marcacion/:id        (evidencia por marcación)
//   - /marcacion-evidencia/:id                  (evidencia por ID)
//   - /marcacion-evidencia                      (crear evidencia)
//   - /marcacion-evidencia/:id                  (actualizar evidencia)
//   - /justificaciones/marcacion/:id            (justificación activa)
//   - /justificaciones/marcacion/:id/todas      (todas las justificaciones)
//   - /justificaciones/:id                      (justificación por ID)
//   - /justificaciones                          (crear justificación)
//   - /justificaciones/:id                      (actualizar justificación)
//   - /usuarios                                 (listar usuarios)
//   - /estados                                  (catálogo de estados)
//   - /areas                                    (catálogo de áreas)
//   - /horarios                                 (catálogo de horarios)
//   - /asignaciones                             (asignaciones)
//   - /sucursales/coordenadas                   (sucursales con coords)
// ==============================================

class MarcacionesService {

    constructor(config) {
        this.config = config || {};
        this.api = new ApiClient(this.config);
        this.BACKEND_URL = this.api.BASE_URL;

        console.log('🔧 GestionMarcacionesService - Backend URL:', this.BACKEND_URL);
    }

    // ==========================================
    // MARCACIONES
    // ==========================================

    /**
     * Obtiene todas las marcaciones (con paginación).
     * @param {number} limit
     * @param {number} offset
     * @returns {Promise<{success: boolean, data?: Array, total?: number, error?: string}>}
     */
    async getAllMarcaciones(limit = 10000, offset = 0) {
        const r = await this.api.get('/marcaciones', { query: { limit, offset } });

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
            data: r.data || [],
            total: r.total ?? (Array.isArray(r.data) ? r.data.length : 0)
        };
    }

    /**
     * Obtiene una marcación por ID.
     * @param {number} id
     */
    async getMarcacionById(id) {
        const r = await this.api.get(`/marcaciones/${id}`);

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
     * Obtiene marcaciones de un usuario (con rango opcional).
     * @param {number} usuarioId
     * @param {string} [fechaInicio]
     * @param {string} [fechaFin]
     */
    async getMarcacionesByUsuario(usuarioId, fechaInicio, fechaFin) {
        const r = await this.api.get(`/marcaciones/usuario/${usuarioId}`, {
            query: { fechaInicio, fechaFin }
        });

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
     * Obtiene marcaciones en un rango de fechas.
     * @param {string} fechaInicio
     * @param {string} fechaFin
     */
    async getMarcacionesByRango(fechaInicio, fechaFin) {
        const r = await this.api.get('/marcaciones/rango', {
            query: { fechaInicio, fechaFin }
        });

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
     * Actualiza una marcación (observaciones, estados, horas).
     * @param {number} id
     * @param {object} data
     */
    async updateMarcacion(id, data) {
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

    /**
     * Actualiza solo las observaciones de una marcación.
     * @param {number} id
     * @param {object} data - { ObsGeneral, ObsVestimenta, ObsIngresoAlmuerzo, ObsSalidaAlmuerzo, ObsJornadaCompleta, IdUsuarioModificacion }
     */
    async updateObservaciones(id, data) {
        const r = await this.api.put(`/marcaciones/${id}/observaciones`, data);

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

    /**
     * NUEVO: Actualiza SOLO la observación de jornada completa.
     * El backend ya expone PUT /marcaciones/:id/jornada-completa
     * @param {number} id
     * @param {object} data - { ObsJornadaCompleta, IdUsuarioModificacion }
     */
    async updateJornadaCompleta(id, data) {
        const r = await this.api.put(`/marcaciones/${id}/jornada-completa`, data);

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

    /**
     * Actualiza solo los estados de almuerzo.
     * @param {number} id
     * @param {object} data - { IdEstadoAlmuerzoIng, IdEstadoAlmuerzoSal }
     */
    async updateEstadosAlmuerzo(id, data) {
        const r = await this.api.put(`/marcaciones/${id}/estados-almuerzo`, data);

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
    // EVIDENCIAS DE MARCACIÓN (SELFIES)
    // ==========================================

    /**
     * Obtiene la evidencia activa de una marcación.
     * @param {number} idMarcacion
     */
    async getEvidenciaByMarcacion(idMarcacion) {
        const r = await this.api.get(`/marcacion-evidencia/marcacion/${idMarcacion}`);

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType,
                data: null
            };
        }

        return { success: true, data: r.data };
    }

    /**
     * Obtiene una evidencia por ID.
     * @param {number} id
     */
    async getEvidenciaById(id) {
        const r = await this.api.get(`/marcacion-evidencia/${id}`);

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType,
                data: null
            };
        }

        return { success: true, data: r.data };
    }

    /**
     * Crea una nueva evidencia (selfie).
     * @param {object} data - { IdMarcacion, FotoIngreso, FotoSalida, FotoIngAlmuerzo, FotoSalAlmuerzo, LatitudIng, LongitudIng, LatitudSal, LongitudSal }
     */
    async createEvidencia(data) {
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
     * Actualiza una evidencia existente.
     * @param {number} id
     * @param {object} data
     */
    async updateEvidencia(id, data) {
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
    // JUSTIFICACIONES (TARDANZA / FALTA / EXCESO / JORNADA INCOMPLETA)
    // ==========================================

    /**
     * Obtiene la primera justificación activa de una marcación.
     * @param {number} idMarcacion
     */
    async getJustificacionByMarcacion(idMarcacion) {
        const r = await this.api.get(`/justificaciones/marcacion/${idMarcacion}`);

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType,
                data: null
            };
        }

        return { success: true, data: r.data };
    }

    /**
     * Obtiene TODAS las justificaciones (activas + eliminadas) de una marcación.
     * @param {number} idMarcacion
     */
    async getAllJustificacionesByMarcacion(idMarcacion) {
        const r = await this.api.get(`/justificaciones/marcacion/${idMarcacion}/todas`);

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType,
                data: []
            };
        }

        return { success: true, data: r.data || [] };
    }

    /**
     * Obtiene una justificación por ID.
     * @param {number} id
     */
    async getJustificacionById(id) {
        const r = await this.api.get(`/justificaciones/${id}`);

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType,
                data: null
            };
        }

        return { success: true, data: r.data };
    }

    /**
     * Crea una justificación.
     * Acepta IdTipoJustificacion (ID) o TipoTardanza (string).
     *
     * Tipos válidos (string):
     *   - "TARDANZA - INGRESO"
     *   - "TARDANZA - INGRESO ALMUERZO"
     *   - "EXCESO - SALIDA ALMUERZO"
     *   - "FALTA"
     *   - "JORNADA INCOMPLETA"
     *
     * @param {object} data - { IdMarcacion, IdTipoJustificacion?, TipoTardanza?, ArchivoEvidencia?, TipoArchivo?, IdUsuarioCreacion? }
     */
    async createJustificacion(data) {
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
            IdTipoJustificacion: r.raw?.IdTipoJustificacion,
            TipoJustificacionDescripcion: r.raw?.TipoJustificacionDescripcion
        };
    }

    /**
     * Actualiza una justificación existente.
     * @param {number} id
     * @param {object} data - { IdTipoJustificacion?, TipoTardanza?, ArchivoEvidencia?, TipoArchivo?, IdUsuarioModificacion? }
     */
    async updateJustificacion(id, data) {
        const r = await this.api.put(`/justificaciones/${id}`, data);

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
    // CATÁLOGOS
    // ==========================================

    /**
     * Obtiene todos los usuarios.
     */
    async getUsuarios() {
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

        return { success: true, data: r.data || [] };
    }

    /**
     * Obtiene el catálogo de estados.
     */
    async getEstados() {
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

        return { success: true, data: r.data || [] };
    }

    /**
     * Obtiene el catálogo de áreas.
     */
    async getAreas() {
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

        return { success: true, data: r.data || [] };
    }

    /**
     * Obtiene el catálogo de horarios.
     */
    async getHorarios() {
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

        return { success: true, data: r.data || [] };
    }

    /**
     * Obtiene el catálogo de sucursales con coordenadas.
     */
    async getSucursalesConCoordenadas() {
        const r = await this.api.get('/sucursales/coordenadas');

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType,
                data: []
            };
        }

        return { success: true, data: r.data || [] };
    }

    /**
     * Obtiene todas las asignaciones (para el detalle de ID Control Horario).
     * @param {number} limit
     * @param {number} offset
     */
    async getAsignaciones(limit = 10000, offset = 0) {
        const r = await this.api.get('/asignaciones', { query: { limit, offset } });

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType,
                data: []
            };
        }

        return { success: true, data: r.data || [] };
    }

    /**
     * Obtiene una asignación por ID.
     * @param {number} id
     */
    async getAsignacionById(id) {
        const r = await this.api.get(`/asignaciones/${id}`);

        if (!r.success) {
            return {
                success: false,
                error: r.error,
                codigo: r.codigo,
                errorType: r.errorType,
                data: null
            };
        }

        return { success: true, data: r.data };
    }

    // ==========================================
    // HELPERS DE NEGOCIO
    // ==========================================

    /**
     * Mapea el "tipo de sección" del frontend (observacion, ingresoAlmuerzo, salidaAlmuerzo, jornadaCompleta)
     * al TipoTardanza que espera el backend.
     *
     * El backend resuelve el IdTipoJustificacion a partir de la descripción.
     *
     * @param {string} tipoSeccion
     * @returns {string}
     */
    getTipoTardanzaPorSeccion(tipoSeccion) {
        const map = {
            'observacion': 'TARDANZA - INGRESO',
            'ingresoAlmuerzo': 'TARDANZA - INGRESO ALMUERZO',
            'salidaAlmuerzo': 'EXCESO - SALIDA ALMUERZO',
            'jornadaCompleta': 'JORNADA INCOMPLETA'
        };
        return map[tipoSeccion] || 'TARDANZA - INGRESO';
    }

    /**
     * Mapea el "tipo de sección" del frontend al campo de observación de la BD.
     *
     * @param {string} tipoSeccion
     * @returns {string}
     */
    getCampoObservacionPorSeccion(tipoSeccion) {
        const map = {
            'observacion': 'ObsGeneral',
            'vestimenta': 'ObsVestimenta',
            'ingresoAlmuerzo': 'ObsIngresoAlmuerzo',
            'salidaAlmuerzo': 'ObsSalidaAlmuerzo',
            'jornadaCompleta': 'ObsJornadaCompleta'
        };
        return map[tipoSeccion] || 'ObsGeneral';
    }

    /**
     * Mapea el "tipo de sección" del frontend al campo de evidencia de la BD.
     *
     * @param {string} tipoSeccion
     * @returns {string}
     */
    getCampoEvidenciaPorSeccion(tipoSeccion) {
        const map = {
            'ingreso': 'FotoIngreso',
            'salida': 'FotoSalida',
            'ingresoAlmuerzo': 'FotoIngAlmuerzo',
            'salidaAlmuerzo': 'FotoSalAlmuerzo'
        };
        return map[tipoSeccion] || 'FotoIngreso';
    }

    /**
     * Mapea el "tipo de sección" del frontend al campo de latitud de la BD.
     *
     * @param {string} tipoSeccion
     * @returns {string|null}
     */
    getCampoLatitudPorSeccion(tipoSeccion) {
        const map = {
            'ingreso': 'LatitudIng',
            'salida': 'LatitudSal',
            'ingresoAlmuerzo': 'LatitudIng',
            'salidaAlmuerzo': 'LatitudSal'
        };
        return map[tipoSeccion] || null;
    }

    /**
     * Mapea el "tipo de sección" del frontend al campo de longitud de la BD.
     *
     * @param {string} tipoSeccion
     * @returns {string|null}
     */
    getCampoLongitudPorSeccion(tipoSeccion) {
        const map = {
            'ingreso': 'LongitudIng',
            'salida': 'LongitudSal',
            'ingresoAlmuerzo': 'LongitudIng',
            'salidaAlmuerzo': 'LongitudSal'
        };
        return map[tipoSeccion] || null;
    }

    /**
     * Obtiene la descripción legible de un tipo de sección.
     *
     * @param {string} tipoSeccion
     * @returns {string}
     */
    getDescripcionSeccion(tipoSeccion) {
        const map = {
            'observacion': 'Observación de Ingreso',
            'vestimenta': 'Vestimenta',
            'ingresoAlmuerzo': 'Ingreso Almuerzo',
            'salidaAlmuerzo': 'Salida Almuerzo',
            'jornadaCompleta': 'Jornada Completa'
        };
        return map[tipoSeccion] || 'Observación';
    }
}

// ============================================
// EXPOSICIÓN GLOBAL
// ============================================
if (typeof window !== 'undefined') {
    window.MarcacionesService = MarcacionesService;
}