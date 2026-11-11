// ==============================================
// SERVICE: HistorialMarcacionesService
// Responsabilidad: Capa de comunicación HTTP del módulo
//                 Historial de Marcación (empleado).
// Depende de: ApiClient
//
// Endpoints usados:
//   - /marcaciones/usuario/:id                  (marcaciones del usuario)
//   - /marcaciones/:id                          (obtener por ID)
//   - /marcaciones/:id                          (actualizar obs)
//   - /marcaciones/:id/jornada-completa         (actualizar solo jornada)
//   - /marcacion-evidencia/marcacion/:id        (selfie por marcación)
//   - /justificaciones/marcacion/:id            (justificación activa)
//   - /justificaciones/marcacion/:id/todas      (todas)
//   - /justificaciones                          (crear justificación)
//   - /justificaciones/:id                      (actualizar justificación)
//   - /usuarios                                 (catálogo)
//   - /estados                                  (catálogo)
//   - /areas                                    (catálogo)
//   - /horarios                                 (catálogo)
//   - /asignaciones                             (asignaciones)
//   - /sucursales/coordenadas                   (sucursales con coords)
// ==============================================

class HistorialMarcacionesService {

    constructor(config) {
        this.config = config || {};
        this.api = new ApiClient(this.config);
        this.BACKEND_URL = this.api.BASE_URL;

        console.log('🔧 HistorialMarcacionesService - Backend URL:', this.BACKEND_URL);
    }

    // ==========================================
    // MARCACIONES
    // ==========================================

    /**
     * Obtiene TODAS las marcaciones de un usuario en un rango opcional.
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
                errorType: r.errorType,
                data: []
            };
        }

        return { success: true, data: r.data || [] };
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
                errorType: r.errorType,
                data: null
            };
        }

        return { success: true, data: r.data };
    }

    /**
     * Actualiza una marcación (usado para guardar observación de FALTA o JORNADA).
     * @param {number} id
     * @param {object} data - { ObsGeneral?, ObsVestimenta?, ObsIngresoAlmuerzo?, ObsSalidaAlmuerzo?, ObsJornadaCompleta?, IdUsuarioModificacion? }
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
     * @param {object} data
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

    // ==========================================
    // EVIDENCIAS DE MARCACIÓN (SELFIES)
    // ==========================================

    /**
     * Obtiene la evidencia (selfie) activa de una marcación.
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

    // ==========================================
    // JUSTIFICACIONES (TARDANZA / FALTA / EXCESO / JORNADA INCOMPLETA)
    // ==========================================

    /**
     * Obtiene la PRIMERA justificación activa de una marcación.
     * (Puede ser de cualquier tipo: TARDANZA, EXCESO, FALTA, JORNADA INCOMPLETA)
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
     * Obtiene todas las asignaciones.
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
     * Obtiene el perfil completo de un usuario (para dirección específica).
     * @param {number} idUsuario
     */
    async getPerfilUsuario(idUsuario) {
        const r = await this.api.get(`/usuarios/${idUsuario}/perfil`);

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
     * Mapea el "tipo de sección" del frontend al TipoTardanza que espera el backend.
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
            'jornadaCompleta': 'JORNADA INCOMPLETA'  // ✅ NUEVO
        };
        return map[tipoSeccion] || 'TARDANZA - INGRESO';
    }

    /**
     * Mapea el "tipo de sección" al campo de observación de la BD.
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
            'jornadaCompleta': 'ObsJornadaCompleta'  // ✅ NUEVO
        };
        return map[tipoSeccion] || 'ObsGeneral';
    }

    /**
     * Mapea el "tipo de sección" al campo de evidencia (selfie) de la BD.
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
     * Mapea el "tipo de sección" al campo de latitud de la BD.
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
     * Mapea el "tipo de sección" al campo de longitud de la BD.
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
     * Devuelve la descripción legible de un tipo de sección.
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
            'jornadaCompleta': 'Jornada Completa'  // ✅ NUEVO
        };
        return map[tipoSeccion] || 'Observación';
    }

    /**
     * Determina si una marcación es "FALTO" según el estado de ingreso.
     *
     * ⚠️ IMPORTANTE: NO debe confundir "JORNADA INCOMPLETA" con "FALTA".
     * Solo se considera FALTA si:
     *   - IdEstadoIng === 7, O
     *   - ObsGeneral contiene 'FALTO', 'NO ASISTIÓ' o 'AUSENCIA'
     *
     * @param {object} marcacion
     * @returns {boolean}
     */
    esFalta(marcacion) {
        if (!marcacion) return false;

        if (marcacion.IdEstadoIng === 7 || marcacion.IdEstadoMarcacion === 7) {
            return true;
        }

        const obs = String(marcacion.ObsGeneral || marcacion.Observacion || '').toUpperCase();
        // ✅ NO incluir 'FALTA' genérico porque "JORNADA INCOMPLETA" podría contener "JUSTIFICADA"
        return obs.includes('FALTO') ||
               obs.includes('NO ASISTIÓ') ||
               obs.includes('NO ASISTIO') ||
               obs.includes('AUSENCIA');
    }

    /**
     * Determina si la observación de una marcación está en estado
     * "FALTA - JUSTIFICACIÓN PENDIENTE" (es decir, aún no justificada).
     *
     * @param {object} marcacion
     * @returns {boolean}
     */
    estaPendienteJustificacion(marcacion) {
        if (!marcacion) return false;
        const obs = String(marcacion.ObsGeneral || marcacion.Observacion || '').toUpperCase();
        return obs.includes('FALTA - JUSTIFICACIÓN PENDIENTE') ||
               obs.includes('FALTA - JUSTIFICACION PENDIENTE');
    }

    /**
     * Determina si la observación de una marcación ya fue justificada
     * (FALTA JUSTIFICADA, NO JUSTIFICÓ FALTA, JUSTIFICACIÓN NO VÁLIDA, o JORNADA INCOMPLETA).
     *
     * @param {object} marcacion
     * @returns {boolean}
     */
    yaFueJustificada(marcacion) {
        if (!marcacion) return false;
        const obs = String(marcacion.ObsGeneral || marcacion.Observacion || '').toUpperCase();
        return obs.includes('FALTA JUSTIFICADA') ||
               obs.includes('NO JUSTIFICÓ FALTA') ||
               obs.includes('NO JUSTIFICO FALTA') ||
               obs.includes('JUSTIFICACIÓN NO VÁLIDA') ||
               obs.includes('JUSTIFICACION NO VALIDA') ||
               // ✅ NUEVO: JORNADA INCOMPLETA también cuenta como justificada
               obs.includes('JORNADA INCOMPLETA - JUSTIFICADO') ||
               obs.includes('JORNADA INCOMPLETA - JUSTIFICADA');
    }

    // ==========================================
    // HELPERS DE JORNADA INCOMPLETA (NUEVOS)
    // ==========================================

    /**
     * Determina si la marcación tiene alguna observación de jornada completa.
     *
     * @param {object} marcacion
     * @returns {boolean}
     */
    tieneJornadaIncompleta(marcacion) {
        if (!marcacion) return false;
        const obs = String(marcacion.ObsJornadaCompleta || '').toUpperCase().trim();
        return obs.includes('JORNADA INCOMPLETA');
    }

    /**
     * Determina si la jornada completa está marcada como JUSTIFICADA.
     *
     * @param {object} marcacion
     * @returns {boolean}
     */
    esJornadaJustificada(marcacion) {
        if (!marcacion) return false;
        const obs = String(marcacion.ObsJornadaCompleta || '').toUpperCase();
        return obs.includes('JORNADA INCOMPLETA - JUSTIFICADO') ||
               obs.includes('JORNADA INCOMPLETA - JUSTIFICADA');
    }

    /**
     * Determina si la jornada completa está marcada como NO JUSTIFICADA.
     *
     * @param {object} marcacion
     * @returns {boolean}
     */
    esJornadaNoJustificada(marcacion) {
        if (!marcacion) return false;
        const obs = String(marcacion.ObsJornadaCompleta || '').toUpperCase();
        return obs.includes('JORNADA INCOMPLETA - NO JUSTIFICADA');
    }

    /**
     * Determina si la jornada completa está en estado PENDIENTE.
     *
     * @param {object} marcacion
     * @returns {boolean}
     */
    esJornadaPendiente(marcacion) {
        if (!marcacion) return false;
        const obs = String(marcacion.ObsJornadaCompleta || '').toUpperCase();
        return obs.includes('JORNADA INCOMPLETA - JUSTIFICACION PENDIENTE') ||
               obs.includes('JORNADA INCOMPLETA - JUSTIFICACIÓN PENDIENTE');
    }

    /**
     * Determina si el empleado puede EDITAR la observación de jornada completa.
     *
     * Regla: Solo puede editarla UNA VEZ.
     * - Si está vacía → puede editar (por primera vez).
     * - Si ya tiene cualquier prefijo (JUSTIFICADO, NO JUSTIFICADA, JUSTIFICACION PENDIENTE) → NO puede editar.
     *
     * Para verificar si ya subió evidencia, el controller debe consultar
     * `getAllJustificacionesByMarcacion()` y buscar tipo "JORNADA INCOMPLETA".
     *
     * @param {object} marcacion
     * @returns {boolean}
     */
    puedeEditarJornada(marcacion) {
        if (!marcacion) return false;
        const obs = String(marcacion.ObsJornadaCompleta || '').toUpperCase().trim();
        // Vacío → puede editar
        return obs === '';
    }

    /**
     * Determina si el empleado puede ADJUNTAR evidencia de jornada incompleta.
     *
     * Regla: Solo puede adjuntarla UNA VEZ.
     * - Si ya existe una justificación de tipo "JORNADA INCOMPLETA" activa → NO puede volver a adjuntar.
     * - Si no existe → puede adjuntar.
     *
     * ⚠️ Esta función requiere llamar al backend. El controller debe hacer:
     *   const r = await this.getAllJustificacionesByMarcacion(idMarcacion);
     *   const existe = r.data.some(j => j.IdEstado === 1 && j.TipoJustificacionDescripcion === 'JORNADA INCOMPLETA');
     *
     * Esta función es solo un helper sincrónico basado en la observación.
     * Si la obs está vacía o pendiente, se asume que aún puede adjuntar.
     *
     * @param {object} marcacion
     * @returns {boolean}
     */
    puedeAdjuntarEvidenciaJornada(marcacion) {
        if (!marcacion) return false;
        const obs = String(marcacion.ObsJornadaCompleta || '').toUpperCase().trim();

        // Si ya está NO JUSTIFICADA → no puede adjuntar (ya la rechazó)
        if (obs.includes('JORNADA INCOMPLETA - NO JUSTIFICADA')) {
            return false;
        }

        // Si está vacío, pendiente o justificado → en principio puede adjuntar
        // (el controller debe verificar en BD si ya existe evidencia)
        return true;
    }

    /**
     * Determina si la marcación tiene Jornada Cumplida (para mostrar el badge).
     * Se delega al controller porque requiere verificar la asignación (almuerzo configurado).
     *
     * @param {object} marcacion
     * @returns {boolean}
     */
    esJornadaCumplida(marcacion) {
        return String(marcacion?.EstadoJornada || '').toUpperCase() === 'JORNADA CUMPLIDA';
    }

    /**
     * Determina si la marcación tiene Jornada No Cumplida (para mostrar el badge rojo).
     *
     * @param {object} marcacion
     * @returns {boolean}
     */
    esJornadaNoCumplida(marcacion) {
        return String(marcacion?.EstadoJornada || '').toUpperCase() === 'JORNADA NO CUMPLIDA';
    }
}

// ============================================
// EXPOSICIÓN GLOBAL
// ============================================
if (typeof window !== 'undefined') {
    window.HistorialMarcacionesService = HistorialMarcacionesService;
}