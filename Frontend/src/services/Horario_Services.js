// ==============================================
// SERVICE: HorarioService
// Endpoints: /horarios, /estados, /usuarios
// Depende de: ApiClient
// ==============================================

class HorarioService {

    constructor(config) {
        this.config = config || {};
        this.api = new ApiClient(this.config);
        this.BACKEND_URL = this.api.BASE_URL;
    }

    async getAll(limit = 10000, offset = 0) {
        const r = await this.api.get('/horarios', { query: { limit, offset } });
        if (!r.success) {
            return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        }
        return { success: true, data: r.data, total: r.total ?? (Array.isArray(r.data) ? r.data.length : 0) };
    }

    async getById(id) {
        const r = await this.api.get(`/horarios/${id}`);
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return { success: true, data: r.data };
    }

    async create(data) {
        const r = await this.api.post('/horarios', data);
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return { success: true, id: r.data?.id ?? r.raw?.id, message: r.message || 'Horario creado exitosamente' };
    }

    async update(id, data) {
        const r = await this.api.put(`/horarios/${id}`, data);
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return {
            success: true,
            message: r.message || 'Horario actualizado exitosamente',
            cambioHoras: r.raw?.cambioHoras,
            asignacionesActualizadas: r.raw?.asignacionesActualizadas
        };
    }

    async deleteCascada(id, idUsuarioModificacion) {
        const r = await this.api.del(`/horarios/${id}`, { body: { IdUsuarioModificacion: idUsuarioModificacion } });
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return { success: true, message: r.message || 'Horario eliminado', resumen: r.raw?.resumen };
    }

    async restaurarCascada(id, idUsuarioModificacion) {
        const r = await this.api.post(`/horarios/${id}/restaurar`, { IdUsuarioModificacion: idUsuarioModificacion });
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return { success: true, message: r.message || 'Horario restaurado', resumen: r.raw?.resumen };
    }

    async getEstados() {
        const r = await this.api.get('/estados');
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return { success: true, data: r.data };
    }

    async getUsuarios() {
        const r = await this.api.get('/usuarios');
        if (!r.success) return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        return { success: true, data: r.data };
    }
}

if (typeof window !== 'undefined') {
    window.HorarioService = HorarioService;
}