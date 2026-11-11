// ==============================================
// SERVICE: AsignacionService
// Endpoints: /asignaciones, /asignaciones/activas,
//            /asignaciones/rango, /asignaciones/usuario/:id,
//            /asignaciones/masivo
// Depende de: ApiClient
// ==============================================

class AsignacionService {

    constructor(config) {
        this.config = config || {};
        this.api = new ApiClient(this.config);
        this.BACKEND_URL = this.api.BASE_URL;
    }

    // ==========================================
    // GET /asignaciones
    // ==========================================
    async getAll(limit = 10000, offset = 0) {
        const r = await this.api.get('/asignaciones', { query: { limit, offset } });
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return { success: true, data: r.data, total: r.total ?? (Array.isArray(r.data) ? r.data.length : 0) };
    }

    // ==========================================
    // GET /asignaciones/:id
    // ==========================================
    async getById(id) {
        const r = await this.api.get(`/asignaciones/${id}`);
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return { success: true, data: r.data };
    }

    // ==========================================
    // GET /asignaciones/activas
    // ==========================================
    async getActivas() {
        const r = await this.api.get('/asignaciones/activas');
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return { success: true, data: r.data };
    }

    // ==========================================
    // GET /asignaciones/rango?fechaInicio=&fechaFin=
    // ==========================================
    async getByRango(fechaInicio, fechaFin) {
        const r = await this.api.get('/asignaciones/rango', { query: { fechaInicio, fechaFin } });
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return { success: true, data: r.data };
    }

    // ==========================================
    // GET /asignaciones/usuario/:id
    // ==========================================
    async getByUsuario(usuarioId, fechaInicio, fechaFin) {
        const r = await this.api.get(`/asignaciones/usuario/${usuarioId}`, {
            query: { fechaInicio, fechaFin }
        });
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return { success: true, data: r.data };
    }

    // ==========================================
    // POST /asignaciones
    // Body: { IdUsuario, IdHorario, Fecha, IngEsperado,
    //         SalEsperada, IngAlmuerzoEsperado, SalAlmuerzoEsperado,
    //         IdEstado?, IdUsuarioCreacion? }
    // ==========================================
    async create(data) {
        const r = await this.api.post('/asignaciones', data);
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return {
            success: true,
            id: r.data?.id ?? r.raw?.id,
            message: r.message || 'Asignación creada exitosamente'
        };
    }

    // ==========================================
    // PUT /asignaciones/:id
    // ==========================================
    async update(id, data) {
        const r = await this.api.put(`/asignaciones/${id}`, data);
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return { success: true, message: r.message || 'Asignación actualizada exitosamente' };
    }

    // ==========================================
    // DELETE /asignaciones/:id (cascada lógica)
    // ==========================================
    async deleteCascada(id, idUsuarioModificacion) {
        const r = await this.api.del(`/asignaciones/${id}`, {
            body: { IdUsuarioModificacion: idUsuarioModificacion }
        });
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return {
            success: true,
            message: r.message || 'Asignación eliminada correctamente',
            resumen: r.raw?.resumen
        };
    }

    // ==========================================
    // POST /asignaciones/:id/restaurar (cascada)
    // ==========================================
    async restaurarCascada(id, idUsuarioModificacion) {
        const r = await this.api.post(`/asignaciones/${id}/restaurar`, {
            IdUsuarioModificacion: idUsuarioModificacion
        });
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return {
            success: true,
            message: r.message || 'Asignación restaurada correctamente',
            resumen: r.raw?.resumen
        };
    }

    // ==========================================
    // POST /asignaciones/masivo (SP)
    // ==========================================
    async registroMasivo(asignaciones, idUsuarioCreacion) {
        const r = await this.api.post('/asignaciones/masivo', {
            asignaciones: asignaciones,
            idUsuarioCreacion: idUsuarioCreacion
        });
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return {
            success: true,
            resultado: r.raw?.resultado,
            detalle: r.raw?.detalle || []
        };
    }

    // ==========================================
    // Catálogos auxiliares
    // ==========================================
    async getHorarios() {
        const r = await this.api.get('/horarios');
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return { success: true, data: r.data };
    }

    async getUsuarios() {
        const r = await this.api.get('/usuarios');
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return { success: true, data: r.data };
    }

    async getEstados() {
        const r = await this.api.get('/estados');
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return { success: true, data: r.data };
    }

    async getMarcaciones() {
        const r = await this.api.get('/marcaciones', { query: { limit: 10000 } });
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return { success: true, data: r.data };
    }

    // ==========================================
    // POST /marcaciones/no-laborable
    // ==========================================
    async crearNoLaborable(data) {
    const payload = {
        ...data,
        IdUsuarioCreacion: data.IdUsuarioCreacion || 1
    };
    const r = await this.api.post('/marcaciones/no-laborable', payload);
    if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
    return { success: true, id: r.data?.id ?? r.raw?.id, message: r.message };
}

    // ==========================================
    // POST /marcaciones/masivo/no-laborable
    // ==========================================
    async registroMasivoNoLaborables(noLaborables, idUsuarioCreacion) {
        const r = await this.api.post('/marcaciones/masivo/no-laborable', {
            noLaborables: noLaborables,
            idUsuarioCreacion: idUsuarioCreacion
        });
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return {
            success: true,
            resultado: r.raw?.resultado,
            detalle: r.raw?.detalle || []
        };
    }

    // ==========================================
    // DELETE /marcaciones/:id/fisica
    // Eliminación física definitiva de no laborable
    // ==========================================
    async eliminarMarcacionFisica(id) {
        const r = await this.api.del(`/marcaciones/${id}/fisica`);
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

}

if (typeof window !== 'undefined') {
    window.AsignacionService = AsignacionService;
}