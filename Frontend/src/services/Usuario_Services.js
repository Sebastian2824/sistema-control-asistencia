// ==============================================
// SERVICE: UsuarioService
// Endpoints: /usuarios
// Depende de: ApiClient, PasswordEncryption
// ==============================================

class UsuarioService {

    constructor(config) {
        this.config = config || {};
        this.api = new ApiClient(this.config);
        this.BACKEND_URL = this.api.BASE_URL;

        // Mapeo exacto de roles según la BD
        this.rolesMap = {
            'ADMINISTRADOR': 1,
            'COLABORADOR - COUNTER': 2,
            'COLABORADOR - MAYORISTA': 3
        };
    }

    // ==========================================
    // GET /usuarios
    // ==========================================
    async getAll() {
        const r = await this.api.get('/usuarios');
        if (!r.success) {
            return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        }

        const rolesPermitidos = ['ADMINISTRADOR', 'COLABORADOR - COUNTER', 'COLABORADOR - MAYORISTA'];

        const data = (r.data || [])
            .map(u => ({
                IdUsuario: u.IdUsuario,
                IdSucursal: u.IdSucursal || null,
                IdArea: u.IdArea || null,
                Nombres: u.Nombres || '',
                Apellidos: u.Apellidos || '',
                NombreUsuario: u.LoginNombre || '',
                Correo: u.EmailCorporativo || '',
                EmailPersonal: u.EmailPersonal || null,

                // Mapeo exacto de los campos existentes en el backend
                TelefonoCorporativo: u.TelefonoCorporativo || null,
                TelefonoPersonal: u.TelefonoPersonal || null,
                DireccionGeneral: u.DireccionGeneral || null,
                DireccionEspecifica: u.DireccionEspecifica || null,

                Rol: u.RolNombre || 'COLABORADOR - COUNTER',
                Contraseña: u.PasswordHash || '******',
                IdEstado: u.IdEstado || 1
            }))
            .filter(u => rolesPermitidos.includes(u.Rol)); // Solo roles válidos

        return { success: true, data };
    }

    // ==========================================
    // POST /usuarios
    // ==========================================
    async create(datos) {

        const payload = {
            IdSucursal: parseInt(datos.IdSucursal),
            IdRol: this.rolesMap[datos.Rol] || 2, // Default: COUNTER
            IdArea: parseInt(datos.IdArea),
            LoginNombre: datos.Login,
            Nombres: datos.Nombre,
            Apellidos: datos.Apellidos,
            PasswordHash: datos.Pass,
            EmailCorporativo: datos.Email,
            EmailPersonal: datos.EmailPersonal || null,
            DireccionGeneral: datos.DireccionGeneral || null,
            DireccionEspecifica: datos.DireccionEspecifica || null,
            TelefonoCorporativo: datos.TelefonoCorporativo ? parseInt(datos.TelefonoCorporativo) : null,
            TelefonoPersonal: datos.TelefonoPersonal ? parseInt(datos.TelefonoPersonal) : null,
            IdEstado: parseInt(datos.IdEstado) || 1,
            IdUsuarioCreacion: JSON.parse(sessionStorage.getItem('usuarioActual') || '{}').IdUsuario || 1
        };

        const r = await this.api.post('/usuarios', payload);
        if (!r.success) {
            return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        }
        return { success: true, id: r.data?.id, message: r.message };
    }

    // ==========================================
    // PUT /usuarios/:id
    // ==========================================
    async update(id, datos) {

        const payload = {
            LoginNombre: datos.NombreUsuario,
            Nombres: datos.Nombres,
            Apellidos: datos.Apellidos,
            EmailCorporativo: datos.Correo,
            EmailPersonal: datos.EmailPersonal || null,
            IdRol: this.rolesMap[datos.Rol] || 2,
            IdSucursal: parseInt(datos.IdSucursal),
            IdArea: parseInt(datos.IdArea),
            IdEstado: parseInt(datos.IdEstado),
            DireccionGeneral: datos.DireccionGeneral || null,
            DireccionEspecifica: datos.DireccionEspecifica || null,
            TelefonoCorporativo: datos.TelefonoCorporativo ? parseInt(datos.TelefonoCorporativo) : null,
            TelefonoPersonal: datos.TelefonoPersonal ? parseInt(datos.TelefonoPersonal) : null,
            IdUsuarioModificacion: JSON.parse(sessionStorage.getItem('usuarioActual') || '{}').IdUsuario || 1
        };

        if (datos.Contraseña && datos.Contraseña.trim() !== '') {
            payload.PasswordHash = datos.Contraseña;
        }

        const r = await this.api.put(`/usuarios/${id}`, payload);
        if (!r.success) {
            return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        }
        return { success: true, message: r.message };
    }

    // ==========================================
    // DELETE /usuarios/:id (cascada)
    // ==========================================
    async deleteCascada(id, idUsuarioModificacion) {
        const r = await this.api.del(`/usuarios/${id}`, {
            body: { IdUsuarioModificacion: idUsuarioModificacion }
        });
        if (!r.success) {
            return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        }
        return { success: true, message: r.message };
    }

    // ==========================================
    // POST /usuarios/:id/restaurar (cascada)
    // ==========================================
    async restaurarCascada(id, idUsuarioModificacion) {
        const r = await this.api.post(`/usuarios/${id}/restaurar`, {
            IdUsuarioModificacion: idUsuarioModificacion
        });
        if (!r.success) {
            return { success: false, error: r.error, codigo: r.codigo, errorType: r.errorType };
        }
        return { success: true, message: r.message };
    }

    // ==========================================
    // GET catálogos
    // ==========================================
    async getSucursales() {
        const r = await this.api.get('/sucursales');
        return r.success ? { success: true, data: r.data } : { success: false, error: r.error };
    }

    async getAreas() {
        const r = await this.api.get('/areas');
        return r.success ? { success: true, data: r.data } : { success: false, error: r.error };
    }

    async getRoles() {
        const r = await this.api.get('/roles');
        return r.success ? { success: true, data: r.data } : { success: false, error: r.error };
    }

    async verificarDuplicados(nombre, apellido, correo, login) {
        let url = `/usuarios/duplicados?nombre=${encodeURIComponent(nombre)}&apellido=${encodeURIComponent(apellido)}&correo=${encodeURIComponent(correo)}&login=${encodeURIComponent(login)}`;
        const r = await this.api.get(url);
        if (!r.success) return { success: false, error: r.error };
        return { success: true, data: r.raw };
    }

    // ==========================================
    // GET /usuarios/:id/password
    // Devuelve la contraseña desencriptada (solo admin)
    // Requiere header X-Usuario-Id
    // ==========================================
    async getPasswordDesencriptada(id, idUsuarioAdmin) {
        const r = await this.api.get(`/usuarios/${id}/password`, {
            headers: { 'X-Usuario-Id': String(idUsuarioAdmin) }
        });
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
            tienePassword: r.raw?.tienePassword ?? false,
            password: r.raw?.password ?? null
        };
    }

    // ==========================================
    // POST /usuarios/:id/enviar-credenciales
    // Envía credenciales por correo (solo admin)
    // ==========================================
    async enviarCredenciales(id, idUsuarioAdmin) {
        const r = await this.api.post(
            `/usuarios/${id}/enviar-credenciales`,
            {},
            { headers: { 'X-Usuario-Id': String(idUsuarioAdmin) } }
        );
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
            message: r.raw?.message || r.message || 'Credenciales enviadas'
        };
    }

}

if (typeof window !== 'undefined') {
    window.UsuarioService = UsuarioService;
}