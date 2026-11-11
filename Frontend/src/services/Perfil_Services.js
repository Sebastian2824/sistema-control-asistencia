// ==============================================
// SERVICE: UsuarioService
// Endpoints: /usuarios
// Depende de: ApiClient
// ==============================================

class PerfilService {

    constructor(config) {
        this.config = config || {};
        this.api = new ApiClient(this.config);
        this.BACKEND_URL = this.api.BASE_URL;
    }

    // GET /usuarios/:id/perfil
    async getPerfil(id) {
        const r = await this.api.get(`/usuarios/${id}/perfil`);
        if (!r.success) {
            return {
                success: false,
                error: r.error || 'No se pudo obtener el perfil',
                codigo: r.codigo,
                errorType: r.errorType
            };
        }
        return { success: true, data: r.data };
    }

    // PUT /usuarios/:id
    async update(id, data) {
        const r = await this.api.put(`/usuarios/${id}`, data);
        if (!r.success) {
            return {
                success: false,
                error: r.error || 'No se pudo actualizar el usuario',
                codigo: r.codigo,
                errorType: r.errorType
            };
        }
        return {
            success: true,
            message: r.message || 'Usuario actualizado exitosamente'
        };
    }

    // GET /usuarios/:id
    async getById(id) {
        const r = await this.api.get(`/usuarios/${id}`);
        if (!r.success) {
            return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        }
        return { success: true, data: r.data };
    }
}

if (typeof window !== 'undefined') {
    window.PerfilService = PerfilService;
}