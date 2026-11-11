// ==============================================
// API CLIENT — Wrapper fetch común para todos los services
// Responsabilidad: URL, headers, JSON, timeout,
//                  normalización de respuestas y errores.
// ==============================================

class ApiClient {

    constructor(config) {
        this.config = config || {};
        this.BASE_URL = (typeof EnvironmentDetector !== 'undefined')
            ? EnvironmentDetector.getBackendURL()
            : (this.config.BACKEND_URL || 'http://localhost:3001');
        this.BASE_URL = this.BASE_URL.replace(/\/+$/, '');
        this.DEFAULT_TIMEOUT = 5000000;

        console.log('🔧 ApiClient - Backend URL:', this.BASE_URL);
    }

    // ============================================
    // Construir URL con query string
    // ============================================
    _buildUrl(path, query) {
        const url = new URL(`${this.BASE_URL}${path.startsWith('/') ? path : '/' + path}`);
        if (query && typeof query === 'object') {
            Object.entries(query).forEach(([k, v]) => {
                if (v !== undefined && v !== null && v !== '') {
                    url.searchParams.set(k, v);
                }
            });
        }
        return url.toString();
    }

    // ============================================
    // Normalizar respuesta
    // ============================================
    _normalizarExito(data, response) {
        // Backend devuelve { success:true, data?, total?, message? }
        // Si viene { success:false } en un 2xx (raro), tratarlo como error.
        if (data && data.success === false) {
            return {
                success: false,
                error: data.error || 'Error desconocido',
                codigo: data.codigo,
                errorType: data.codigo || 'ERROR_LOGICO'
            };
        }

        return {
            success: true,
            data: data?.data ?? data,
            total: data?.total,
            message: data?.message,
            raw: data
        };
    }

    _normalizarError(status, data, response) {
        const codigo = data?.codigo;
        const mensajeBackend = data?.error || data?.message;

        // 400
        if (status === 400) {
            return {
                success: false,
                error: mensajeBackend || 'Datos inválidos.',
                codigo,
                errorType: codigo || 'BAD_REQUEST'
            };
        }

        // 401
        if (status === 401) {
            return {
                success: false,
                error: mensajeBackend || 'No autorizado.',
                codigo,
                errorType: codigo || 'UNAUTHORIZED'
            };
        }

        // 403
        if (status === 403) {
            return {
                success: false,
                error: mensajeBackend || 'Acceso denegado.',
                codigo,
                errorType: codigo || 'FORBIDDEN'
            };
        }

        // 404
        if (status === 404) {
            return {
                success: false,
                error: mensajeBackend || 'Recurso no encontrado.',
                codigo,
                errorType: codigo || 'NOT_FOUND'
            };
        }

        // 409
        if (status === 409) {
            return {
                success: false,
                error: mensajeBackend || 'Conflicto de datos.',
                codigo,
                errorType: codigo || 'CONFLICT'
            };
        }

        // 429
        if (status === 429) {
            return {
                success: false,
                error: mensajeBackend || 'Demasiadas solicitudes. Intente más tarde.',
                codigo,
                errorType: codigo || 'RATE_LIMIT'
            };
        }

        // 500+
        if (status >= 500) {
            return {
                success: false,
                error: mensajeBackend || 'Error interno del servidor.',
                codigo,
                errorType: codigo || 'SERVER_ERROR'
            };
        }

        // Otros
        return {
            success: false,
            error: mensajeBackend || `Error inesperado (HTTP ${status})`,
            codigo,
            errorType: codigo || 'ERROR_GENERAL'
        };
    }

    // ============================================
    // Request core
    // ============================================
    async request(method, path, { query, body, timeout, headers } = {}) {
        const url = this._buildUrl(path, query);
        const ms = timeout || this.DEFAULT_TIMEOUT;

        const init = {
            method,
            headers: {
                'Accept': 'application/json',
                ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                ...(headers || {})
            },
            signal: AbortSignal.timeout(ms)
        };

        if (body !== undefined) {
            init.body = JSON.stringify(body);
        }

        try {
            console.log(`📡 ${method} ${url}`);
            const response = await fetch(url, init);

            let data = null;
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                try { data = await response.json(); } catch { data = null; }
            } else {
                try { data = await response.text(); } catch { data = null; }
            }

            if (!response.ok) {
                return this._normalizarError(response.status, data, response);
            }

            return this._normalizarExito(data, response);

        } catch (error) {
            console.error('❌ Error de red:', error.message);

            if (error.name === 'TimeoutError' || error.name === 'AbortError') {
                return {
                    success: false,
                    error: 'El servidor tardó demasiado en responder. Intente nuevamente.',
                    errorType: 'TIMEOUT'
                };
            }

            return {
                success: false,
                error: 'No se pudo conectar al servidor. Verifique su conexión.',
                errorType: 'CONNECTION_ERROR'
            };
        }
    }

    // ============================================
    // Verbos
    // ============================================
    get(path, opts = {})    { return this.request('GET',    path, opts); }
    post(path, body, opts = {})  { return this.request('POST',   path, { ...opts, body }); }
    put(path, body, opts = {})   { return this.request('PUT',    path, { ...opts, body }); }
    del(path, opts = {})    { return this.request('DELETE', path, opts); }
}

if (typeof window !== 'undefined') {
    window.ApiClient = ApiClient;
}