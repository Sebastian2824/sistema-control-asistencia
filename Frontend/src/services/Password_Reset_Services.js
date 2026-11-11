// ==============================================
// SERVICE: PasswordResetService
// Endpoints:
//   POST /password-reset/solicitar
//   GET  /password-reset/validar?token=
//   POST /password-reset/actualizar
// Depende de: ApiClient
// ==============================================

class PasswordResetService {

    constructor(config) {
        this.config = config || {};
        this.api = new ApiClient(this.config);
        this.BACKEND_URL = this.api.BASE_URL;

        console.log('🔧 PasswordResetService - Backend URL:', this.BACKEND_URL);
    }

    // ==============================================
    // 1) SOLICITAR ENLACE
    // ==============================================
    async solicitarEnlace(identificador) {
        console.log('📧 Solicitar enlace →', identificador);

        const r = await this.api.post('/password-reset/solicitar',
            { identificador },
            { timeout: 10000 }
        );

        if (!r.success) {
            return {
                success: false,
                error: r.error || 'Error al enviar la solicitud'
            };
        }

        return {
            success: true,
            message: r.message ||
                'Si el correo o usuario está registrado, recibirá un enlace de recuperación en breve.'
        };
    }

    // ==============================================
    // 2) VALIDAR TOKEN
    // ==============================================
    async validarToken(token) {
        // Validación local rápida (defensa)
        if (!token || typeof token !== 'string' || token.length !== 64) {
            return {
                success: false,
                valido: false,
                error: 'Token inválido. Verifique el enlace del correo.'
            };
        }

        const r = await this.api.get('/password-reset/validar', {
            query: { token },
            timeout: 8000
        });

        if (!r.success) {
            return {
                success: false,
                valido: false,
                error: r.error || 'El enlace no es válido o ya expiró.'
            };
        }

        if (r.raw?.success && r.raw?.valido) {
            return {
                success: true,
                valido: true,
                usuario: r.raw.usuario || null
            };
        }

        return {
            success: false,
            valido: false,
            error: r.raw?.error || 'Token inválido o expirado.'
        };
    }

    // ==============================================
    // 3) ACTUALIZAR CONTRASEÑA
    // ==============================================
    async actualizarPassword(token, nuevaPassword) {
        // Validación local (defensa)
        if (!token || typeof token !== 'string' || token.length !== 64) {
            return {
                success: false,
                error: 'Token inválido. Solicite un nuevo enlace.'
            };
        }
        if (!nuevaPassword || nuevaPassword.length < 6) {
            return {
                success: false,
                error: 'La contraseña debe tener al menos 6 caracteres.'
            };
        }

        console.log('🔐 Actualizar contraseña');

        // El backend encripta; enviamos texto plano.
        const r = await this.api.post('/password-reset/actualizar',
            { token, nuevaPassword },
            { timeout: 10000 }
        );

        if (!r.success) {
            return {
                success: false,
                error: r.error || 'No se pudo actualizar la contraseña.'
            };
        }

        if (r.raw?.success) {
            return {
                success: true,
                message: r.message || 'Contraseña actualizada correctamente. Ya puede iniciar sesión.'
            };
        }

        return {
            success: false,
            error: r.raw?.error || 'No se pudo actualizar la contraseña.'
        };
    }
}

if (typeof window !== 'undefined') {
    window.PasswordResetService = PasswordResetService;
}