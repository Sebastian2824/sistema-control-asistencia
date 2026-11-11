// ==============================================
// CONTROLLER: HistorialMarcacionesController
// Responsabilidad: Visualización de marcaciones del usuario logueado
// Sistema: Control de Asistencia - Historial de Marcación
// Depende de: AuthService, HistorialMarcacionesService
// ==============================================

const OPTIMIZACION_HISTORIAL = {
    REGISTROS_POR_PAGINA: 6,
    CACHE_TTL: 300000
};

class HistorialMarcacionesController {

    constructor(authService, marcacionService, config) {
        this.auth = authService;
        this.service = marcacionService;
        this.config = config || {};

        // ============================================
        // ESTADO
        // ============================================
        this.usuarioActual = null;
        this.marcaciones = [];
        this.usuarios = [];
        this.estados = [];
        this.areasCache = null;
        this.horariosCache = null;
        this.asignacionesCache = null;
        this.marcacionesFiltradas = [];

        // Cache
        this.cacheMarcaciones = null;
        this.cacheUsuarios = null;
        this.cacheEstados = null;
        this.cacheTimestamp = null;
        this.cacheEvidencias = new Map();

        // Notificaciones
        this.notificaciones = [];
        this.notificacionesLeidas = new Set(); // IDs de marcaciones leídas (en memoria)

        // Paginación principal
        this.paginaActual = 1;
        this.registrosPorPagina = OPTIMIZACION_HISTORIAL.REGISTROS_POR_PAGINA;
        this.totalPaginas = 1;

        // Paginación tardanzas
        this.datosTardanzas = [];
        this.paginaTardanzas = 1;
        this.totalPaginasTardanzas = 1;

        // Modales / acciones pendientes
        this.accionPendiente = null;
        this.datosPendientes = null;
        this.marcacionDetalleActual = null;

        // Evidencia temporal (solo para FALTAS)
        this._marcacionEvidencia = null;
        this._tipoEvidencia = null;
        this._evidenciaTempData = null;
        this._evidenciaTempTipo = null;
        this._evidenciaTempNombre = null;

        // Mapa Leaflet
        this.mapaEvidencia = null;

        // Handlers de normalización en el textarea
        this._handlerNormalizacionTiempoReal = null;
        this._handlerNormalizacionBlur = null;
        this._handlerNormalizacionEnter = null;
        this._ultimoTextoNormalizado = null;

        // ============================================
        // CACHEAR DOM
        // ============================================
        this._cachearDOM();

        // ============================================
        // INICIAR CUANDO EL DOM ESTÉ LISTO
        // ============================================
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    // ==========================================
    // CACHEAR DOM
    // ==========================================
    _cachearDOM() {
        // Header
        this.userNameDisplay = document.getElementById('displayUserName');
        this.userRoleDisplay = document.getElementById('displayUserRole');
        this.dropdownUserName = document.getElementById('dropdownUserName');
        this.dropdownUserEmail = document.getElementById('dropdownUserEmail');
        this.dropdownUserRole = document.getElementById('dropdownUserRole');
        this.userMenu = document.getElementById('userMenu');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.menuBtn = document.getElementById('menuBtn');
        this.perfilBtn = document.getElementById('perfilBtn');
        this.logoArea = document.getElementById('logoArea');

        // Tabla y filtros
        this.tablaBody = document.getElementById('tablaMarcacionesBody');
        this.filtroFechaEspecifica = document.getElementById('filtroFechaEspecifica');
        this.filtroFechaDesde = document.getElementById('filtroFechaDesde');
        this.filtroFechaHasta = document.getElementById('filtroFechaHasta');
        this.filtroEstadoMarcacion = document.getElementById('filtroEstadoMarcacion');
        this.filtroObservacion = document.getElementById('filtroObservacion');
        this.filtroEstadoAlmuerzoIng = document.getElementById('filtroEstadoAlmuerzoIng');
        this.filtroEstadoAlmuerzoSal = document.getElementById('filtroEstadoAlmuerzoSal');
        this.filtroObsVestimenta = document.getElementById('filtroObsVestimenta');
        this.filtroObsIngAlmuerzo = document.getElementById('filtroObsIngAlmuerzo');
        this.filtroObsSalAlmuerzo = document.getElementById('filtroObsSalAlmuerzo');
        this.filtroCumplioJornada = document.getElementById('filtroCumplioJornada');
        this.btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');

        // Modales
        this.modalConfirmar = document.getElementById('modalConfirmar');
        this.confirmarMensaje = document.getElementById('confirmarMensaje');
        this.closeConfirmModalBtn = document.getElementById('closeConfirmModalBtn');
        this.btnCancelarConfirmacion = document.getElementById('btnCancelarConfirmacion');
        this.btnConfirmarAccion = document.getElementById('btnConfirmarAccion');

        this.modalDetalleAsignacion = document.getElementById('modalDetalleAsignacion');
        this.detalleAsignacionBody = document.getElementById('detalleAsignacionBody');

        // Notificaciones
        this.btnNotificaciones = document.getElementById('btnNotificaciones');
        this.badgeNotificaciones = document.getElementById('badgeNotificaciones');
        this.modalNotificaciones = document.getElementById('modalNotificaciones');

    }

    // ==========================================
    // INIT
    // ==========================================
    async init() {
        console.log('🔧 Inicializando HistorialMarcacionesController...');

        // 1) Verificar autenticación
        if (!this.auth || !this.auth.verificarSesion()) {
            this.redirigirALogin();
            return;
        }
        this.usuarioActual = this.auth.getUsuarioLogueado();
        if (!this.usuarioActual?.IdUsuario) {
            this.redirigirALogin();
            return;
        }

        // 2) Cargar datos del header
        this.cargarDatosUsuario();

        // 3) Configurar eventos
        this.configurarEventos();
        this.configurarEventosEvidencia();
        this.configurarEventosEvidenciaTardanza();
        this.configurarEventosCargarEvidencia();
        this.crearControlesPaginacion();

        // 4) Cargar datos iniciales
        await this.cargarDatosIniciales();

        this.auth.prevenirNavegacionAtras();

        console.log('✅ HistorialMarcacionesController inicializado');
    }

    // ==========================================
    // HEADER
    // ==========================================
    cargarDatosUsuario() {
        const u = this.usuarioActual || {};
        const nombreCompleto = `${u.nombres || u.Nombres || ''} ${u.apellidos || u.Apellidos || ''}`.trim() || 'Usuario';
        const correo = u.correo || u.Correo || '';
        const rol = u.rol || u.Rol || 'Empleado';

        if (this.userNameDisplay) this.userNameDisplay.textContent = nombreCompleto;
        if (this.dropdownUserName) this.dropdownUserName.textContent = nombreCompleto;
        if (this.dropdownUserEmail) this.dropdownUserEmail.textContent = correo;
        if (this.userRoleDisplay) this.userRoleDisplay.textContent = rol;
        if (this.dropdownUserRole) this.dropdownUserRole.textContent = rol;
    }

    // ==========================================
    // EVENTOS
    // ==========================================
    configurarEventos() {
        // Header
        if (this.userMenu) {
            this.userMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                this.userMenu.classList.toggle('active');
            });
            document.addEventListener('click', () => {
                if (this.userMenu) this.userMenu.classList.remove('active');
            });
        }

        if (this.logoutBtn) this.logoutBtn.addEventListener('click', (e) => { e.stopPropagation(); this.cerrarSesion(); });
        if (this.menuBtn) this.menuBtn.addEventListener('click', (e) => { e.stopPropagation(); this.redirigirAlMenu(); });
        if (this.perfilBtn) this.perfilBtn.addEventListener('click', (e) => { e.stopPropagation(); this.redirigirAlPerfil(); });
        if (this.logoArea) this.logoArea.addEventListener('click', () => this.redirigirAlMenu());

        // Filtros
        if (this.filtroFechaEspecifica) this.filtroFechaEspecifica.addEventListener('change', () => { this.paginaActual = 1; this.aplicarFiltros(); });
        if (this.filtroFechaDesde) this.filtroFechaDesde.addEventListener('change', () => { this.paginaActual = 1; this.aplicarFiltros(); });
        if (this.filtroFechaHasta) this.filtroFechaHasta.addEventListener('change', () => { this.paginaActual = 1; this.aplicarFiltros(); });
        if (this.filtroEstadoMarcacion) this.filtroEstadoMarcacion.addEventListener('change', () => { this.paginaActual = 1; this.aplicarFiltros(); });
        if (this.filtroObservacion) this.filtroObservacion.addEventListener('change', () => { this.paginaActual = 1; this.aplicarFiltros(); });
        if (this.filtroEstadoAlmuerzoIng) this.filtroEstadoAlmuerzoIng.addEventListener('change', () => { this.paginaActual = 1; this.aplicarFiltros(); });
        if (this.filtroEstadoAlmuerzoSal) this.filtroEstadoAlmuerzoSal.addEventListener('change', () => { this.paginaActual = 1; this.aplicarFiltros(); });
        if (this.filtroObsVestimenta) this.filtroObsVestimenta.addEventListener('change', () => { this.paginaActual = 1; this.aplicarFiltros(); });
        if (this.filtroObsIngAlmuerzo) this.filtroObsIngAlmuerzo.addEventListener('change', () => { this.paginaActual = 1; this.aplicarFiltros(); });
        if (this.filtroObsSalAlmuerzo) this.filtroObsSalAlmuerzo.addEventListener('change', () => { this.paginaActual = 1; this.aplicarFiltros(); });
        if (this.filtroCumplioJornada) this.filtroCumplioJornada.addEventListener('change', () => { this.paginaActual = 1; this.aplicarFiltros(); });
        if (this.btnLimpiarFiltros) this.btnLimpiarFiltros.addEventListener('click', () => this.limpiarFiltros());

        // Modal confirmación
        if (this.closeConfirmModalBtn) this.closeConfirmModalBtn.addEventListener('click', () => this.cerrarModalConfirmacion());
        if (this.btnCancelarConfirmacion) this.btnCancelarConfirmacion.addEventListener('click', () => this.cerrarModalConfirmacion());
        if (this.btnConfirmarAccion) this.btnConfirmarAccion.addEventListener('click', () => this.ejecutarConfirmacion());

        // Modal detalle asignación
        const closeDetalleBtn = document.getElementById('closeDetalleAsignacionBtn');
        const btnCerrarDetalle = document.getElementById('btnCerrarDetalleAsignacion');
        if (closeDetalleBtn) closeDetalleBtn.addEventListener('click', () => this.cerrarModalDetalleAsignacion());
        if (btnCerrarDetalle) btnCerrarDetalle.addEventListener('click', () => this.cerrarModalDetalleAsignacion());

        // Modal detalle observaciones
        const closeDetalleObsBtn = document.getElementById('closeDetalleObsBtn');
        const btnCerrarDetalleObs = document.getElementById('btnCerrarDetalleObs');
        if (closeDetalleObsBtn) closeDetalleObsBtn.addEventListener('click', () => this.cerrarModalDetalleObservaciones());
        if (btnCerrarDetalleObs) btnCerrarDetalleObs.addEventListener('click', () => this.cerrarModalDetalleObservaciones());

        // Modal editar observación
        const closeEditObsBtn = document.getElementById('closeEditObsBtn');
        const btnCancelarEditObs = document.getElementById('btnCancelarEditObs');
        const editarObsForm = document.getElementById('editarObsForm');
        if (closeEditObsBtn) closeEditObsBtn.addEventListener('click', () => this.cerrarModalEditarObservacion());
        if (btnCancelarEditObs) btnCancelarEditObs.addEventListener('click', () => this.cerrarModalEditarObservacion());
        if (editarObsForm) editarObsForm.addEventListener('submit', (e) => this.guardarEdicionObservacion(e));

        // Tardanzas
        const btnVerTardanzas = document.getElementById('btnVerTardanzas');
        if (btnVerTardanzas) btnVerTardanzas.addEventListener('click', () => this.abrirModalTardanzas());

        const closeTardanzasModalBtn = document.getElementById('closeTardanzasModalBtn');
        if (closeTardanzasModalBtn) {
            closeTardanzasModalBtn.addEventListener('click', () => {
                const modal = document.getElementById('modalTardanzas');
                if (modal) modal.classList.remove('active');
            });
        }

        const btnFiltrarTardanzas = document.getElementById('btnFiltrarTardanzas');
        if (btnFiltrarTardanzas) btnFiltrarTardanzas.addEventListener('click', () => this.cargarDatosTardanzas());

        // Paginación tardanzas
        document.getElementById('btnTardanzasPrimera')?.addEventListener('click', () => this.irPrimeraPaginaTardanzas());
        document.getElementById('btnTardanzasAnterior')?.addEventListener('click', () => this.irPaginaAnteriorTardanzas());
        document.getElementById('btnTardanzasSiguiente')?.addEventListener('click', () => this.irPaginaSiguienteTardanzas());
        document.getElementById('btnTardanzasUltima')?.addEventListener('click', () => this.irUltimaPaginaTardanzas());

        // Notificaciones
        const btnNotificaciones = document.getElementById('btnNotificaciones');
        if (btnNotificaciones) {
            btnNotificaciones.addEventListener('click', () => this.abrirModalNotificaciones());
        }

        const closeNotifBtn = document.getElementById('closeNotificacionesBtn');
        if (closeNotifBtn) {
            closeNotifBtn.addEventListener('click', () => this.cerrarModalNotificaciones());
        }

        const btnCerrarNotif = document.getElementById('btnCerrarNotificaciones');
        if (btnCerrarNotif) {
            btnCerrarNotif.addEventListener('click', () => this.cerrarModalNotificaciones());
        }

        // Cerrar modal al hacer clic fuera (opcional pero recomendado)
        const modalNotif = document.getElementById('modalNotificaciones');
        if (modalNotif) {
            modalNotif.addEventListener('click', (e) => {
                if (e.target === modalNotif) this.cerrarModalNotificaciones();
            });
        }

        // Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modalTardanzas = document.getElementById('modalTardanzas');
                if (modalTardanzas?.classList.contains('active')) {
                    modalTardanzas.classList.remove('active');
                }
            }
        });
    }

    configurarEventosEvidencia() {
        const closeBtn = document.getElementById('closeEvidenciaModal');
        const cerrarBtn = document.getElementById('btnCerrarEvidencia');
        const modal = document.getElementById('modalEvidencia');

        const cerrar = () => {
            modal.classList.remove('active');
            this._limpiarMapa();
            const infoUbicacionEl = document.getElementById('evidenciaInfoUbicacion');
            if (infoUbicacionEl) infoUbicacionEl.remove();
        };

        if (closeBtn) closeBtn.onclick = cerrar;
        if (cerrarBtn) cerrarBtn.onclick = cerrar;
        modal.onclick = (e) => { if (e.target === modal) cerrar(); };
    }

    configurarEventosEvidenciaTardanza() {
        const closeBtn = document.getElementById('closeEvidenciaTardanzaBtn');
        const cerrarBtn = document.getElementById('btnCerrarEvidenciaTardanza');
        const modal = document.getElementById('modalEvidenciaTardanzaFalta');
        if (!modal) return;

        const cerrar = () => {
            modal.classList.remove('active');
            const pdfPreview = document.getElementById('evidenciaTardanzaPdfPreview');
            if (pdfPreview) { pdfPreview.src = ''; pdfPreview.style.display = 'none'; }
            const imgWrapper = document.getElementById('evidenciaTardanzaImagenWrapper');
            const pdfWrapper = document.getElementById('evidenciaTardanzaPdfWrapper');
            if (imgWrapper) imgWrapper.style.display = 'none';
            if (pdfWrapper) pdfWrapper.style.display = 'none';
        };

        if (closeBtn) closeBtn.onclick = cerrar;
        if (cerrarBtn) cerrarBtn.onclick = cerrar;
    }

    configurarEventosCargarEvidencia() {
        const modal = document.getElementById('modalCargarEvidenciaJustificacion');
        const closeBtn = document.getElementById('closeCargarEvidenciaBtn');
        const cancelarBtn = document.getElementById('btnCancelarCargarEvidencia');
        const guardarBtn = document.getElementById('btnGuardarCargarEvidencia');
        const inputFile = document.getElementById('inputCargarEvidencia');
        if (!modal) return;

        const cerrar = () => {
            modal.classList.remove('active');
            this._resetearModalCargarEvidencia();
        };

        if (closeBtn) closeBtn.onclick = cerrar;
        if (cancelarBtn) cancelarBtn.onclick = cerrar;
        modal.onclick = (e) => { if (e.target === modal) cerrar(); };

        if (inputFile) inputFile.onchange = (e) => this._procesarArchivoEvidencia(e);
        if (guardarBtn) guardarBtn.onclick = () => this._guardarEvidenciaJustificacion();
    }

    _resetearModalCargarEvidencia() {
        const inputFile = document.getElementById('inputCargarEvidencia');
        if (inputFile) inputFile.value = '';
        const preview = document.getElementById('previewCargarEvidencia');
        if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
        const estadoActual = document.getElementById('estadoEvidenciaActual');
        if (estadoActual) estadoActual.style.display = 'none';
        const guardarBtn = document.getElementById('btnGuardarCargarEvidencia');
        if (guardarBtn) guardarBtn.disabled = true;
        this._evidenciaTempData = null;
        this._evidenciaTempTipo = null;
        this._evidenciaTempNombre = null;
    }

    // ==========================================
    // CARGA DE DATOS
    // ==========================================
    async cargarDatosIniciales() {
        try {
            this.mostrarLoading(true);
            await this.cargarEstados();
            await this.cargarUsuarios();
            await this.cargarHorariosCache();
            await this.cargarAreasCache();
            await this.cargarMarcaciones();
        } catch (error) {
            console.error('Error al cargar datos iniciales:', error);
            this.mostrarMensaje('Error al cargar datos', 'error');
        } finally {
            this.mostrarLoading(false);
        }
    }

    async cargarUsuarios() {
        const r = await this.service.getUsuarios();
        if (!r.success) {
            console.error('❌ Error cargando usuarios:', r.error);
            this.usuarios = [];
            return;
        }

        this.usuarios = (r.data || [])
            .filter(u => u.IdEstado === 1)
            .map(u => ({
                IdUsuario: u.IdUsuario,
                Nombres: u.Nombres || u.Nombre || '',
                Apellidos: u.Apellidos || '',
                NombreUsuario: u.LoginNombre || u.NombreUsuario || '',
                IdArea: u.IdArea,
                IdEstado: u.IdEstado
            }));

        this.cacheUsuarios = this.usuarios;
        console.log(`✅ Usuarios activos: ${this.usuarios.length}`);
    }

    async cargarEstados() {
        const r = await this.service.getEstados();
        if (!r.success) {
            console.error('❌ Error cargando estados:', r.error);
            this.estados = [];
            return;
        }

        this.estados = (r.data || []).map(e => ({
            IdEstado: e.IdEstado,
            Descripcion: (e.Descripcion || '').trim()
        }));

        this.cacheEstados = this.estados;
        console.log(`✅ Estados: ${this.estados.length}`);
        this.cargarSelectEstados();
    }

    cargarSelectEstados() {
        const normalizarDesc = (desc) => desc ? desc.trim().toUpperCase() : '';

        // Estado marcación
        if (this.filtroEstadoMarcacion) {
            this.filtroEstadoMarcacion.innerHTML = '<option value="">-- Todos --</option>';
            const estados = this.estados.filter(e => {
                const d = normalizarDesc(e.Descripcion);
                return d === 'A TIEMPO' || d === 'TARDANZA' || d === 'FALTO' || d === 'NO LABORA';
            });
            estados.forEach(estado => {
                const opt = document.createElement('option');
                opt.value = estado.Descripcion.toUpperCase();
                opt.textContent = this._formatearEtiquetaEstado(estado.Descripcion);
                this.filtroEstadoMarcacion.appendChild(opt);
            });
        }

        // Estado almuerzo ingreso
        if (this.filtroEstadoAlmuerzoIng) {
            this.filtroEstadoAlmuerzoIng.innerHTML = '<option value="">-- Todos --</option>';
            const estados = this.estados.filter(e => {
                const d = normalizarDesc(e.Descripcion);
                return d === 'A TIEMPO' || d === 'TARDANZA';
            });
            estados.forEach(estado => {
                const opt = document.createElement('option');
                opt.value = estado.Descripcion.toUpperCase();
                opt.textContent = estado.Descripcion;
                this.filtroEstadoAlmuerzoIng.appendChild(opt);
            });
        }

        // Estado almuerzo salida
        if (this.filtroEstadoAlmuerzoSal) {
            this.filtroEstadoAlmuerzoSal.innerHTML = '<option value="">-- Todos --</option>';
            const estados = this.estados.filter(e => {
                const d = normalizarDesc(e.Descripcion);
                return d === 'A TIEMPO' || d === 'EXCESO';
            });
            estados.forEach(estado => {
                const opt = document.createElement('option');
                opt.value = estado.Descripcion.toUpperCase();
                opt.textContent = estado.Descripcion;
                this.filtroEstadoAlmuerzoSal.appendChild(opt);
            });
        }
    }

    _formatearEtiquetaEstado(descripcion) {
        const desc = String(descripcion || '').trim().toUpperCase();
        switch (desc) {
            case 'A TIEMPO': return 'A TIEMPO';
            case 'TARDANZA': return 'TARDANZA';
            case 'FALTO': return 'FALTO';
            case 'NO LABORA': return 'NO LABORA';
            case 'EXCESO': return 'EXCESO';
            default: return descripcion;
        }
    }

    async cargarHorariosCache() {
        const r = await this.service.getHorarios();
        if (r.success && r.data) {
            this.horariosCache = r.data;
            console.log(`✅ Horarios cargados: ${this.horariosCache.length}`);
        } else {
            console.error('❌ Error cargando horarios:', r.error);
            this.horariosCache = [];
        }
    }

    async cargarAreasCache() {
        const r = await this.service.getAreas();
        if (r.success && r.data) {
            this.areasCache = r.data;
            console.log(`✅ Áreas cargadas: ${this.areasCache.length}`);
        } else {
            console.error('❌ Error cargando áreas:', r.error);
            this.areasCache = [];
        }
    }

    async cargarAsignacionesCache() {
        if (this.asignacionesCache) return this.asignacionesCache;
        const r = await this.service.getAsignaciones();
        if (r.success && r.data) {
            this.asignacionesCache = r.data;
            return this.asignacionesCache;
        }
        this.asignacionesCache = [];
        return [];
    }

    // ==========================================
    // CARGA DE MARCACIONES (SOLO DEL USUARIO)
    // ==========================================
    async cargarMarcaciones(forzarRecarga = false) {
        try {
            this.mostrarLoading(true);

            if (!forzarRecarga && this.cacheMarcaciones && this.cacheTimestamp &&
                (Date.now() - this.cacheTimestamp) < OPTIMIZACION_HISTORIAL.CACHE_TTL) {
                this.marcaciones = this.cacheMarcaciones;
                this.aplicarFiltros();
                this.mostrarLoading(false);
                return;
            }

            const idUsuario = this.usuarioActual.IdUsuario;
            const r = await this.service.getMarcacionesByUsuario(idUsuario);

            if (!r.success) {
                throw new Error(r.error || 'Error al cargar marcaciones');
            }

            let marcaciones = (r.data || []).map(m => ({
                IdCHMarcacion: m.IdMarcacion,
                IdUsuario: m.IdUsuario,
                IdControlHorarioSys: m.IdAsignacion,
                Fecha: this._normalizarFecha(m.Fecha),
                IngresoReal: this._normalizarHora(m.IngMarcado),
                SalidaReal: this._normalizarHora(m.SalMarcada),
                IngAlmuerzo: this._normalizarHora(m.IngAlmuerzoMarcado),
                SalAlmuerzo: this._normalizarHora(m.SalAlmuerzoMarcada),

                IdEstadoMarcacion: m.IdEstadoIng,
                IdEstadoAlmuerzoIng: m.IdEstadoAlmuerzoIng,
                IdEstadoAlmuerzoSal: m.IdEstadoAlmuerzoSal,
                IdEstado: m.IdEstado,

                ObsGeneral: m.ObsGeneral || '',
                Observacion: m.ObsGeneral || '',
                ObsVestimenta: m.ObsVestimenta || '',
                ObsIngresoAlmuerzo: m.ObsIngresoAlmuerzo || '',
                ObsSalidaAlmuerzo: m.ObsSalidaAlmuerzo || '',
                ObsJornadaCompleta: m.ObsJornadaCompleta || '',   // ✅ NUEVO

                EstadoIngDescripcion: m.EstadoIngDescripcion || '',
                EstadoAlmuerzoIngDescripcion: m.EstadoAlmuerzoIngDescripcion || '',
                EstadoAlmuerzoSalDescripcion: m.EstadoAlmuerzoSalDescripcion || '',
                EstadoDescripcion: m.EstadoDescripcion || ''
            }));

            marcaciones = marcaciones.filter(m => m.IdEstado === 1 || m.IdEstado === undefined);

            // ✅ Calcular estado de "¿Cumplió la Jornada?"
            for (const m of marcaciones) {
                m.EstadoJornada = await this._calcularEstadoJornada(m);
            }

            this.marcaciones = marcaciones;
            this.cacheMarcaciones = marcaciones;
            this.cacheTimestamp = Date.now();

            console.log(`✅ Marcaciones del usuario ${idUsuario}: ${this.marcaciones.length}`);

            this.aplicarFiltros();
            this._cargarNotificaciones();
        } catch (error) {
            console.error('❌ Error al cargar marcaciones:', error);
            this.mostrarMensaje('Error al cargar marcaciones', 'error');
            if (this.tablaBody) {
                this.tablaBody.innerHTML = '<tr><td colspan="16" class="loading">Error al cargar datos</td></tr>';
            }
        } finally {
            this.mostrarLoading(false);
        }
    }

    // ==========================================
    // FILTROS
    // ==========================================
    aplicarFiltros() {
        let filtradas = [...this.marcaciones];

        // Fechas
        const fechaEspecifica = this.filtroFechaEspecifica?.value;
        if (fechaEspecifica) {
            filtradas = filtradas.filter(m => m.Fecha === fechaEspecifica);
        } else {
            const desde = this.filtroFechaDesde?.value;
            const hasta = this.filtroFechaHasta?.value;
            if (desde) filtradas = filtradas.filter(m => m.Fecha >= desde);
            if (hasta) filtradas = filtradas.filter(m => m.Fecha <= hasta);
        }

        // Estado marcación
        const estadoMarcacion = this.filtroEstadoMarcacion?.value;
        if (estadoMarcacion) {
            const estadoUpper = estadoMarcacion.toUpperCase().trim();
            filtradas = filtradas.filter(m => {
                if (estadoUpper === 'NO LABORA') {
                    const obs = (m.Observacion || '').toUpperCase();
                    return obs.includes('NO LABORA');
                }
                if (estadoUpper === 'FALTO') {
                    if (m.IdEstadoMarcacion === 7) return true;
                    const obs = (m.Observacion || '').toUpperCase();
                    return obs.includes('FALTO') || obs.includes('FALTA');
                }
                const desc = this.obtenerDescripcionEstado(m.IdEstadoMarcacion);
                return desc && desc.toUpperCase() === estadoUpper;
            });
        }

        // Estado almuerzo ingreso
        const estadoAlmuerzoIng = this.filtroEstadoAlmuerzoIng?.value;
        if (estadoAlmuerzoIng) {
            filtradas = filtradas.filter(m => {
                const desc = this.obtenerDescripcionEstado(m.IdEstadoAlmuerzoIng);
                return desc && desc.toUpperCase() === estadoAlmuerzoIng.toUpperCase();
            });
        }

        // Estado almuerzo salida
        const estadoAlmuerzoSal = this.filtroEstadoAlmuerzoSal?.value;
        if (estadoAlmuerzoSal) {
            filtradas = filtradas.filter(m => {
                const desc = this.obtenerDescripcionEstado(m.IdEstadoAlmuerzoSal);
                return desc && desc.toUpperCase() === estadoAlmuerzoSal.toUpperCase();
            });
        }

        // Obs vestimenta
        const obsVestimenta = this.filtroObsVestimenta?.value;
        if (obsVestimenta) {
            filtradas = filtradas.filter(m => {
                const obs = m.ObsVestimenta || '';
                if (obsVestimenta === 'NINGUNO') return !obs || obs.trim() === '' || obs === '--';
                if (obsVestimenta === 'CUMPLIO') return obs.startsWith('CUMPLIO');
                if (obsVestimenta === 'NO CUMPLIO') return obs.startsWith('NO CUMPLIO');
                return obs.includes(obsVestimenta);
            });
        }

        // Obs ingreso almuerzo
        const obsIngAlmuerzo = this.filtroObsIngAlmuerzo?.value;
        if (obsIngAlmuerzo) {
            filtradas = filtradas.filter(m => {
                const obs = m.ObsIngresoAlmuerzo || '';
                if (obsIngAlmuerzo === 'NINGUNA') return !obs || obs.trim() === '' || obs === '--';
                return obs.includes(obsIngAlmuerzo);
            });
        }

        // Obs salida almuerzo
        const obsSalAlmuerzo = this.filtroObsSalAlmuerzo?.value;
        if (obsSalAlmuerzo) {
            filtradas = filtradas.filter(m => {
                const obs = m.ObsSalidaAlmuerzo || '';
                if (obsSalAlmuerzo === 'NINGUNA') return !obs || obs.trim() === '' || obs === '--';
                return obs.includes(obsSalAlmuerzo);
            });
        }

        // Obs general
        const observacionFiltro = this.filtroObservacion?.value;
        if (observacionFiltro) {
            filtradas = filtradas.filter(m => {
                const obs = m.Observacion || '';
                if (observacionFiltro === 'NINGUNO') {
                    return !obs || obs.trim() === '' || obs === '--';
                } else if (observacionFiltro === 'NO LABORA') {
                    return obs.includes('NO LABORA');
                } else if (observacionFiltro === 'FALTA JUSTIFICADA') {
                    return obs.includes('FALTA JUSTIFICADA');
                } else if (observacionFiltro === 'FALTA - JUSTIFICACIÓN PENDIENTE') {
                    return obs.toUpperCase().includes('FALTA - JUSTIFICACIÓN PENDIENTE');
                } else if (observacionFiltro === 'NO JUSTIFICÓ FALTA') {
                    return obs === 'NO JUSTIFICÓ FALTA';
                } else if (observacionFiltro === 'TARDANZA JUSTIFICADA') {
                    return obs.includes('TARDANZA JUSTIFICADA');
                } else if (observacionFiltro === 'TARDANZA NO JUSTIFICADA') {
                    return obs === 'TARDANZA NO JUSTIFICADA';
                } else if (observacionFiltro === 'JUSTIFICACIÓN NO VÁLIDA') {
                    return obs === 'JUSTIFICACIÓN NO VÁLIDA';
                }
                return obs.toLowerCase().includes(observacionFiltro.toLowerCase());
            });
        }

        // ✅ NUEVO: Filtro "¿Cumplió la Jornada?"
        const filtroJornada = this.filtroCumplioJornada?.value;
        if (filtroJornada) {
            if (filtroJornada === 'CUMPLIDA') {
                filtradas = filtradas.filter(m => m.EstadoJornada === 'JORNADA CUMPLIDA');
            } else if (filtroJornada === 'NO_CUMPLIDA') {
                filtradas = filtradas.filter(m => m.EstadoJornada === 'JORNADA NO CUMPLIDA');
            } else if (filtroJornada === 'NA') {
                filtradas = filtradas.filter(m => m.EstadoJornada === 'N/A');
            }
        }

        // Orden descendente por fecha
        filtradas.sort((a, b) => {
            if (a.Fecha > b.Fecha) return -1;
            if (a.Fecha < b.Fecha) return 1;
            return 0;
        });

        this.marcacionesFiltradas = filtradas;
        this.totalPaginas = Math.ceil(this.marcacionesFiltradas.length / this.registrosPorPagina) || 1;
        this.paginaActual = Math.min(this.paginaActual, this.totalPaginas);
        this.renderizarPaginaActual();
    }

    limpiarFiltros() {
        if (this.filtroFechaEspecifica) this.filtroFechaEspecifica.value = '';
        if (this.filtroFechaDesde) this.filtroFechaDesde.value = '';
        if (this.filtroFechaHasta) this.filtroFechaHasta.value = '';
        if (this.filtroEstadoMarcacion) this.filtroEstadoMarcacion.value = '';
        if (this.filtroCumplioJornada) this.filtroCumplioJornada.value = '';
        if (this.filtroObservacion) this.filtroObservacion.value = '';
        ['filtroEstadoAlmuerzoIng', 'filtroEstadoAlmuerzoSal', 'filtroObsVestimenta', 'filtroObsIngAlmuerzo', 'filtroObsSalAlmuerzo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        this.paginaActual = 1;
        this.aplicarFiltros();
        this.mostrarMensaje('Filtros limpiados', 'info');
    }

    // ==========================================
    // RENDER
    // ==========================================
    renderizarPaginaActual() {
        this.actualizarControlesPaginacion();
        this.actualizarInfoRegistros();
        this.renderizarTabla(this.obtenerRegistrosPagina());
    }

    obtenerRegistrosPagina() {
        const inicio = (this.paginaActual - 1) * this.registrosPorPagina;
        return this.marcacionesFiltradas.slice(inicio, inicio + this.registrosPorPagina);
    }

    renderizarTabla(registrosPagina) {
        if (!this.tablaBody) return;

        if (registrosPagina.length === 0) {
            this.tablaBody.innerHTML = '<tr><td colspan="15" class="loading">No hay registros</td></tr>';
            return;
        }

        this.tablaBody.innerHTML = '';
        registrosPagina.forEach(m => this.tablaBody.appendChild(this.crearFilaMarcacion(m)));
        this.reasignarEventosBotones();
    }

    crearFilaMarcacion(marcacion) {
        const row = document.createElement('tr');
        const nombreUsuario = this.obtenerNombreUsuario(marcacion.IdUsuario);

        const estadoMarcacionDesc = this.obtenerDescripcionEstado(marcacion.IdEstadoMarcacion);
        const estadoAlmuerzoIngDesc = this.obtenerDescripcionEstado(marcacion.IdEstadoAlmuerzoIng);
        const estadoAlmuerzoSalDesc = this.obtenerDescripcionEstado(marcacion.IdEstadoAlmuerzoSal);
        const claseEstadoMarcacion = this.obtenerClaseEstado(estadoMarcacionDesc);
        const claseEstadoAlmuerzoIng = this.obtenerClaseEstado(estadoAlmuerzoIngDesc);
        const claseEstadoAlmuerzoSal = this.obtenerClaseEstado(estadoAlmuerzoSalDesc);

        const tieneObservaciones = this._tieneAlgunaObservacion(marcacion);

        const observacionHtml = `
        <div style="display: flex; align-items: center; gap: 6px; justify-content: center;">
            <button class="btn-detalle-obs"
                    data-id="${marcacion.IdCHMarcacion}"
                    style="background: ${tieneObservaciones ? '#28a745' : '#6c757d'}; color: white; border: none; border-radius: 6px; padding: 4px 12px; cursor: pointer; font-size: 11px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px;">
                <i class="fas fa-${tieneObservaciones ? 'check-circle' : 'eye'}"></i>
                Ver Detalle
            </button>
        </div>
    `;

        const idControlHorario = marcacion.IdControlHorarioSys;
        let idControlHorarioHtml = idControlHorario || 'N/A';
        if (idControlHorario && idControlHorario !== 'N/A') {
            idControlHorarioHtml = `<a href="#" class="link-id-control" data-id="${idControlHorario}" style="color: #CC0000; text-decoration: underline; cursor: pointer;">${idControlHorario}</a>`;
        }

        const horaIngreso = this._crearHoraClickeable(marcacion.IdCHMarcacion, 'ingreso', marcacion.IngresoReal);
        const horaSalida = this._crearHoraClickeable(marcacion.IdCHMarcacion, 'salida', marcacion.SalidaReal);
        const horaIngAlmuerzo = this._crearHoraClickeable(marcacion.IdCHMarcacion, 'ingresoAlmuerzo', marcacion.IngAlmuerzo);
        const horaSalAlmuerzo = this._crearHoraClickeable(marcacion.IdCHMarcacion, 'salidaAlmuerzo', marcacion.SalAlmuerzo);

        // ✅ Badge de "¿Cumplió la Jornada?"
        const jornadaBadge = this._crearBadgeJornada(marcacion.EstadoJornada);

        row.innerHTML = `
        <td>${marcacion.IdCHMarcacion || 'N/A'}</td>
        <td>${this.escapeHtml(nombreUsuario)}</td>
        <td class="id-control-cell">${idControlHorarioHtml}</td>
        <td>${this.formatearFecha(marcacion.Fecha)}</td>
        <td>${horaIngreso}</td>
        <td>${horaSalida}</td>
        <td>${horaIngAlmuerzo}</td>
        <td>${horaSalAlmuerzo}</td>
        <td class="col-id-estado-marcacion">${marcacion.IdEstadoMarcacion || 'N/A'}</td>
        <td><span class="${claseEstadoMarcacion}">${estadoMarcacionDesc}</span></td>
        <td class="col-id-estado-almuerzo-ingreso">${marcacion.IdEstadoAlmuerzoIng ?? 'N/A'}</td>
        <td><span class="${claseEstadoAlmuerzoIng}">${estadoAlmuerzoIngDesc}</span></td>
        <td class="col-id-estado-almuerzo-salida">${marcacion.IdEstadoAlmuerzoSal ?? 'N/A'}</td>
        <td><span class="${claseEstadoAlmuerzoSal}">${estadoAlmuerzoSalDesc}</span></td>
        <td class="col-cumplio-jornada">${jornadaBadge}</td>
        <td class="observacion-cell">${observacionHtml}</td>
    `;
        return row;
    }

    _tieneAlgunaObservacion(marcacion) {
        const campos = [
            marcacion.Observacion,
            marcacion.ObsVestimenta,
            marcacion.ObsIngresoAlmuerzo,
            marcacion.ObsSalidaAlmuerzo,
            marcacion.ObsJornadaCompleta   // ✅ NUEVO
        ];
        return campos.some(c => c && c.trim() !== '' && c !== '--');
    }

    _crearHoraClickeable(idMarcacion, tipo, hora) {
        if (!hora || hora === '' || hora === '--:--') {
            return `<span class="hora-no-clickeable">--:--</span>`;
        }
        const horaDisplay = this.formatearHora(hora);
        return `<span class="hora-clickeable" data-id="${idMarcacion}" data-tipo="${tipo}" data-hora="${horaDisplay}">${horaDisplay}</span>`;
    }

    reasignarEventosBotones() {
        document.querySelectorAll('.btn-detalle-obs').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                const id = parseInt(btn.getAttribute('data-id'));
                this.abrirModalDetalleObservaciones(id);
            };
        });

        document.querySelectorAll('.link-id-control').forEach(link => {
            link.onclick = (e) => {
                e.preventDefault();
                const id = link.getAttribute('data-id');
                this.mostrarDetalleAsignacion(id);
            };
        });

        document.querySelectorAll('.hora-clickeable').forEach(el => {
            el.onclick = async (e) => {
                e.stopPropagation();
                if (el.dataset.cargando === 'true') return;
                const id = parseInt(el.getAttribute('data-id'));
                const tipo = el.getAttribute('data-tipo');
                el.dataset.cargando = 'true';
                el.style.opacity = '0.5';
                try {
                    await this.mostrarEvidencia(id, tipo);
                } finally {
                    el.dataset.cargando = 'false';
                    el.style.opacity = '1';
                }
            };
        });
    }

    // ==========================================
    // HELPERS DE ESTADO / USUARIO
    // ==========================================
    obtenerNombreUsuario(idUsuario) {
        if (!idUsuario) return 'N/A';
        const u = this.usuarios.find(x => x.IdUsuario === idUsuario);
        return u ? `${u.Nombres} ${u.Apellidos}`.trim() : `ID: ${idUsuario}`;
    }

    obtenerDescripcionEstado(idEstado) {
        if (!idEstado && idEstado !== 0) return 'N/A';
        const e = this.estados.find(x => x.IdEstado == idEstado);
        return e ? e.Descripcion : String(idEstado);
    }

    obtenerClaseEstado(descripcion) {
        switch (descripcion) {
            case 'A TIEMPO': return 'badge-success';
            case 'TARDANZA': return 'badge-warning';
            case 'EXCESO': return 'badge-danger';
            case 'FALTO': return 'badge-danger';
            case 'NO LABORA': return 'badge-secondary';
            default: return 'badge-secondary';
        }
    }

    _normalizarFecha(fecha) {
        if (!fecha) return null;
        if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
        if (typeof fecha === 'string' && fecha.includes('T')) return fecha.split('T')[0];
        if (typeof fecha === 'string' && fecha.includes(' ')) return fecha.split(' ')[0];
        try {
            const d = new Date(fecha);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        } catch { return fecha; }
    }

    _normalizarHora(hora) {
        if (!hora || hora === '') return '';
        if (typeof hora === 'string' && /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(hora)) return hora;
        if (typeof hora === 'string' && hora.includes('T')) {
            const m = hora.match(/T(\d{2}):(\d{2})/);
            if (m) return `${m[1]}:${m[2]}`;
        }
        if (typeof hora === 'string' && hora.includes(':')) {
            const p = hora.split(':');
            if (p.length >= 2) return `${p[0].padStart(2, '0')}:${p[1].padStart(2, '0')}`;
        }
        return '';
    }

    formatearFecha(fecha) {
        if (!fecha) return 'N/A';
        try {
            if (typeof fecha === 'string' && fecha.includes('T')) {
                const m = fecha.match(/(\d{4})-(\d{2})-(\d{2})/);
                if (m) return `${m[3]}/${m[2]}/${m[1]}`;
            }
            if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fecha)) {
                const p = fecha.split(' ')[0].split('-');
                return `${p[2]}/${p[1]}/${p[0]}`;
            }
            if (typeof fecha === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(fecha)) return fecha;
            const d = new Date(fecha);
            if (!isNaN(d.getTime())) {
                return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
            }
            return fecha;
        } catch { return fecha || 'N/A'; }
    }

    formatearHora(hora) {
        if (!hora || hora === '') return '--:--';
        if (hora.match(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)) return hora;
        if (hora.includes('T')) {
            const m = hora.match(/T(\d{2}):(\d{2})/);
            if (m) return `${m[1]}:${m[2]}`;
        }
        return hora;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    mostrarLoading(mostrar) {
        if (!this.tablaBody) return;
        if (mostrar) {
            this.tablaBody.innerHTML = `
                <tr>
                    <td colspan="15" class="loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        Cargando marcaciones...
                    </td>
                </tr>
            `;
        }
    }

    // ==========================================
    // PAGINACIÓN PRINCIPAL
    // ==========================================
    crearControlesPaginacion() {
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer && !document.getElementById('paginacionContainer')) {
            const div = document.createElement('div');
            div.id = 'paginacionContainer';
            div.className = 'paginacion-container';
            div.innerHTML = `
                <div class="paginacion-info">
                    Mostrando <span id="inicioRegistro">0</span> - <span id="finRegistro">0</span> de <span id="totalRegistros">0</span> registros
                </div>
                <div class="paginacion-buttons">
                    <button class="btn-paginacion" id="btnPrimeraPagina" disabled>⏮ Primera</button>
                    <button class="btn-paginacion" id="btnPaginaAnterior" disabled>◀ Anterior</button>
                    <span class="paginacion-pagina" id="paginaActualInfo">Página 1 de 1</span>
                    <button class="btn-paginacion" id="btnPaginaSiguiente" disabled>Siguiente ▶</button>
                    <button class="btn-paginacion" id="btnUltimaPagina" disabled>Última ⏭</button>
                </div>
            `;
            tableContainer.parentNode.insertBefore(div, tableContainer.nextSibling);
            this.agregarEstilosPaginacion();
        }

        this.btnPrimeraPagina = document.getElementById('btnPrimeraPagina');
        this.btnPaginaAnterior = document.getElementById('btnPaginaAnterior');
        this.btnPaginaSiguiente = document.getElementById('btnPaginaSiguiente');
        this.btnUltimaPagina = document.getElementById('btnUltimaPagina');
        this.paginaActualInfo = document.getElementById('paginaActualInfo');
        this.inicioRegistro = document.getElementById('inicioRegistro');
        this.finRegistro = document.getElementById('finRegistro');
        this.totalRegistrosSpan = document.getElementById('totalRegistros');

        if (this.btnPrimeraPagina) this.btnPrimeraPagina.onclick = () => this.irPrimeraPagina();
        if (this.btnPaginaAnterior) this.btnPaginaAnterior.onclick = () => this.irPaginaAnterior();
        if (this.btnPaginaSiguiente) this.btnPaginaSiguiente.onclick = () => this.irPaginaSiguiente();
        if (this.btnUltimaPagina) this.btnUltimaPagina.onclick = () => this.irUltimaPagina();
    }

    agregarEstilosPaginacion() {
        if (document.querySelector('#paginacionStyles')) return;
        const styles = document.createElement('style');
        styles.id = 'paginacionStyles';
        styles.textContent = `
            .paginacion-container { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding: 15px; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); flex-wrap: wrap; gap: 15px; }
            .paginacion-info { font-size: 13px; color: #666; }
            .paginacion-buttons { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
            .btn-paginacion { background: #f8f9fa; border: 1px solid #ddd; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px; transition: all 0.3s ease; }
            .btn-paginacion:hover:not(:disabled) { background: #CC0000; color: white; border-color: #CC0000; }
            .btn-paginacion:disabled { opacity: 0.5; cursor: not-allowed; }
            .paginacion-pagina { font-size: 13px; font-weight: 600; color: #333; margin: 0 10px; }
        `;
        document.head.appendChild(styles);
    }

    irPrimeraPagina() { if (this.paginaActual > 1) { this.paginaActual = 1; this.renderizarPaginaActual(); } }
    irPaginaAnterior() { if (this.paginaActual > 1) { this.paginaActual--; this.renderizarPaginaActual(); } }
    irPaginaSiguiente() { if (this.paginaActual < this.totalPaginas) { this.paginaActual++; this.renderizarPaginaActual(); } }
    irUltimaPagina() { if (this.paginaActual < this.totalPaginas) { this.paginaActual = this.totalPaginas; this.renderizarPaginaActual(); } }

    actualizarControlesPaginacion() {
        if (!this.btnPrimeraPagina) return;
        this.btnPrimeraPagina.disabled = this.paginaActual === 1;
        this.btnPaginaAnterior.disabled = this.paginaActual === 1;
        this.btnPaginaSiguiente.disabled = this.paginaActual === this.totalPaginas;
        this.btnUltimaPagina.disabled = this.paginaActual === this.totalPaginas;
        if (this.paginaActualInfo) this.paginaActualInfo.textContent = `Página ${this.paginaActual} de ${this.totalPaginas}`;
    }

    actualizarInfoRegistros() {
        const total = this.marcacionesFiltradas.length;
        const inicio = total > 0 ? (this.paginaActual - 1) * this.registrosPorPagina + 1 : 0;
        const fin = Math.min(inicio + this.registrosPorPagina - 1, total);
        if (this.inicioRegistro) this.inicioRegistro.textContent = inicio;
        if (this.finRegistro) this.finRegistro.textContent = fin;
        if (this.totalRegistrosSpan) this.totalRegistrosSpan.textContent = total;
    }

    // ==========================================
    // MODAL: DETALLE DE ASIGNACIÓN (con Tipo de Horario)
    // ==========================================
    // [MÉTODOS HEREDADOS DE GESTIÓN]
    // Copia tal cual desde Gestion_Marcaciones_Controller.js:
    //   - mostrarDetalleAsignacion(idControlHorario)
    //   - _normalizarHoraComparacion(hora)
    //   - cerrarModalDetalleAsignacion()
    // Ajusta solo los nombres de campos si el backend cambió (ya están alineados).
    // Este bloque debe incluir la fila "Tipo de Horario" (VIRTUAL/PRESENCIAL) que ya agregamos.

    // ==========================================
    // MODAL: DETALLE DE OBSERVACIONES
    // ==========================================
    // [NUEVO] - Solo lectura, con excepción de FALTAS o JORNADA
    async abrirModalDetalleObservaciones(idMarcacion) {
        const marcacion = this.marcaciones.find(m => m.IdCHMarcacion === idMarcacion);
        if (!marcacion) {
            this.mostrarMensaje('Marcación no encontrada', 'error');
            return;
        }

        this.marcacionDetalleActual = marcacion;

        const modal = document.getElementById('modalDetalleObservaciones');
        if (!modal) return;

        document.getElementById('detalleObsId').textContent = marcacion.IdCHMarcacion;
        document.getElementById('detalleObsUsuario').textContent = this.obtenerNombreUsuario(marcacion.IdUsuario);
        document.getElementById('detalleObsFecha').textContent = this.formatearFecha(marcacion.Fecha);

        document.getElementById('obsGeneralTexto').textContent = marcacion.Observacion || '--';
        document.getElementById('obsVestimentaTexto').textContent = marcacion.ObsVestimenta || '--';
        document.getElementById('obsIngAlmuerzoTexto').textContent = marcacion.ObsIngresoAlmuerzo || '--';
        document.getElementById('obsSalAlmuerzoTexto').textContent = marcacion.ObsSalidaAlmuerzo || '--';

        // ✅ NUEVO: Setear texto de jornada completa
        const obsJornadaEl = document.getElementById('obsJornadaCompletaTexto');
        if (obsJornadaEl) {
            obsJornadaEl.textContent = marcacion.ObsJornadaCompleta || '--';
        }

        // ✅ Actualizar botones según reglas (falta + jornada + otros)
        await this._actualizarBotonesPorEstadoFalta(marcacion);

        this.asignarEventosBotonesDetalle();

        modal.classList.add('active');
    }

    // [NUEVO] - Reglas específicas del Historial para FALTAS
    async _actualizarBotonesPorEstadoFalta(marcacion) {
        const esFalta = this.service.esFalta(marcacion);
        const obsActual = (marcacion.Observacion || '').toUpperCase();
        const estaPendiente = obsActual.includes('FALTA - JUSTIFICACIÓN PENDIENTE');
        const yaJustificada = this.service.yaFueJustificada(marcacion);

        // ============================================
        // 1. Verificar justificación FALTA activa en BD
        // ============================================
        let tieneJustificacionFalta = false;
        if (esFalta) {
            const r = await this.service.getAllJustificacionesByMarcacion(marcacion.IdCHMarcacion);
            if (r.success && r.data) {
                tieneJustificacionFalta = r.data.some(j => {
                    if (j.IdEstado !== 1) return false;
                    const desc = String(j.TipoJustificacionDescripcion || '').trim().toUpperCase();
                    return desc === 'FALTA';
                });
            }
        }

        // ============================================
        // 2. Estado de JORNADA INCOMPLETA
        // ============================================
        const obsJornada = (marcacion.ObsJornadaCompleta || '').toUpperCase().trim();
        const esNoLaborable = obsActual.includes('NO LABORA');

        // ¿Es una marcación con Jornada No Cumplida?
        const esJornadaNoCumplida = String(marcacion.EstadoJornada || '').toUpperCase() === 'JORNADA NO CUMPLIDA';

        // ¿Ya tiene alguna observación de jornada?
        const tieneObsJornada = obsJornada !== '';

        // ¿Ya subió evidencia de JORNADA INCOMPLETA?
        let tieneJustificacionJornada = false;
        if (esJornadaNoCumplida || tieneObsJornada) {
            const rJ = await this.service.getAllJustificacionesByMarcacion(marcacion.IdCHMarcacion);
            if (rJ.success && rJ.data) {
                tieneJustificacionJornada = rJ.data.some(j => {
                    if (j.IdEstado !== 1) return false;
                    const desc = String(j.TipoJustificacionDescripcion || '').trim().toUpperCase();
                    return desc === 'JORNADA INCOMPLETA';
                });
            }
        }

        // ============================================
        // 3. BOTÓN "EDITAR/VER OBSERVACIÓN" (ingreso)
        // ============================================
        const btnEditObs = document.querySelector('.btn-obs-edit[data-tipo="observacion"]');
        if (btnEditObs) {
            const puedeEditar = esFalta && estaPendiente && !tieneJustificacionFalta && !yaJustificada;
            if (puedeEditar) {
                btnEditObs.disabled = false;
                btnEditObs.style.opacity = '1';
                btnEditObs.style.cursor = 'pointer';
                btnEditObs.title = 'Editar observación para justificar la falta';
                btnEditObs.innerHTML = '<i class="fas fa-edit"></i> Editar Observación';
                btnEditObs.dataset.modo = 'editar';
            } else {
                btnEditObs.disabled = false;
                btnEditObs.style.opacity = '1';
                btnEditObs.style.cursor = 'pointer';
                btnEditObs.title = 'Ver observación';
                btnEditObs.innerHTML = '<i class="fas fa-eye"></i> Ver Observación';
                btnEditObs.dataset.modo = 'ver';
            }
        }

        // ============================================
        // 4. BOTÓN "AGREGAR EVIDENCIA" (ingreso - FALTA)
        // ============================================
        const btnUploadObs = document.querySelector('.btn-obs-upload-evidence[data-tipo="observacion"]');
        if (btnUploadObs) {
            if (!esFalta) {
                btnUploadObs.style.display = 'none';
            } else {
                btnUploadObs.style.display = 'inline-flex';
                const puedeSubir = !tieneJustificacionFalta;
                btnUploadObs.disabled = !puedeSubir;
                btnUploadObs.style.opacity = puedeSubir ? '1' : '0.5';
                btnUploadObs.style.cursor = puedeSubir ? 'pointer' : 'not-allowed';
                btnUploadObs.title = puedeSubir
                    ? 'Agregar evidencia de justificación de falta'
                    : 'Ya subió su evidencia. Contacte al administrador para cambios.';
            }
        }

        // ============================================
        // 5. BOTONES DE ALMUERZO: "AGREGAR EVIDENCIA" OCULTOS
        // ============================================
        ['ingresoAlmuerzo', 'salidaAlmuerzo'].forEach(tipo => {
            const btn = document.querySelector(`.btn-obs-upload-evidence[data-tipo="${tipo}"]`);
            if (btn) btn.style.display = 'none';
        });

        // ============================================
        // 6. BOTÓN "VER EVIDENCIA" (ingreso, almuerzo)
        // ============================================
        const secciones = {
            'observacion': marcacion.Observacion,
            'ingresoAlmuerzo': marcacion.ObsIngresoAlmuerzo,
            'salidaAlmuerzo': marcacion.ObsSalidaAlmuerzo
        };

        Object.entries(secciones).forEach(([tipo, obs]) => {
            const btnVer = document.querySelector(`.btn-obs-evidence[data-tipo="${tipo}"]`);
            if (!btnVer) return;

            const obsUpper = (obs || '').toUpperCase();
            const tieneJustif = obsUpper.includes('JUSTIFICADA') ||
                obsUpper.includes('JUSTIFICADO') ||
                obsUpper.includes('FALTA - JUSTIFICACIÓN PENDIENTE') ||
                obsUpper.includes('NO JUSTIFICÓ FALTA');

            btnVer.disabled = !tieneJustif;
            btnVer.style.opacity = tieneJustif ? '1' : '0.5';
            btnVer.style.cursor = tieneJustif ? 'pointer' : 'not-allowed';
        });

        // ============================================
        // 7. ✅ NUEVO: BOTONES DE JORNADA INCOMPLETA
        // ============================================
        const btnEditJornada = document.querySelector('.btn-obs-edit[data-tipo="jornadaCompleta"]');
        const btnVerJornada = document.querySelector('.btn-obs-evidence[data-tipo="jornadaCompleta"]');
        const btnUploadJornada = document.querySelector('.btn-obs-upload-evidence[data-tipo="jornadaCompleta"]');

        // ---- Bloqueo total si es FALTA o NO LABORABLE ----
        const bloqueoTotalJornada = esFalta || esNoLaborable;

        if (bloqueoTotalJornada) {
            [btnEditJornada, btnVerJornada, btnUploadJornada].forEach(btn => {
                if (!btn) return;
                btn.disabled = true;
                btn.style.opacity = '0.3';
                btn.style.cursor = 'not-allowed';
                btn.title = esFalta ? 'No aplica para faltas' : 'No aplica para días no laborables';
            });
            return; // ← salir, no procesar más
        }

        // ---- Si NO hay jornada no cumplida → deshabilitar todo ----
        if (!esJornadaNoCumplida && !tieneObsJornada) {
            [btnEditJornada, btnVerJornada, btnUploadJornada].forEach(btn => {
                if (!btn) return;
                btn.disabled = true;
                btn.style.opacity = '0.3';
                btn.style.cursor = 'not-allowed';
                btn.title = 'Jornada cumplida - no aplica';
            });
            return;
        }

        // ---- BOTÓN "VER / EDITAR JORNADA" ----
        // El empleado puede editarla UNA SOLA VEZ:
        // - Si ObsJornadaCompleta está VACÍA → puede editar (1ª vez)
        // - Si ya tiene cualquier prefijo → solo puede VER
        if (btnEditJornada) {
            const puedeEditar = !tieneObsJornada;

            btnEditJornada.disabled = false;
            btnEditJornada.style.opacity = '1';
            btnEditJornada.style.cursor = 'pointer';
            btnEditJornada.title = puedeEditar
                ? 'Justificar jornada incompleta (solo 1 vez)'
                : 'Ver observación (ya justificada, no editable)';
            btnEditJornada.innerHTML = puedeEditar
                ? '<i class="fas fa-edit"></i> Justificar Jornada'
                : '<i class="fas fa-eye"></i> Ver Observación';
            btnEditJornada.dataset.modo = puedeEditar ? 'editar' : 'ver';
        }

        // ---- BOTÓN "AGREGAR EVIDENCIA JORNADA" ----
        // Solo se puede subir UNA VEZ:
        // - Si aún no existe justificación JORNADA INCOMPLETA → habilitado
        // - Si ya existe → deshabilitado
        if (btnUploadJornada) {
            btnUploadJornada.style.display = 'inline-flex';
            const puedeSubir = !tieneJustificacionJornada;
            btnUploadJornada.disabled = !puedeSubir;
            btnUploadJornada.style.opacity = puedeSubir ? '1' : '0.5';
            btnUploadJornada.style.cursor = puedeSubir ? 'pointer' : 'not-allowed';
            btnUploadJornada.title = puedeSubir
                ? 'Agregar evidencia de jornada incompleta (solo 1 vez)'
                : 'Ya subió su evidencia. Contacte al administrador para cambios.';
        }

        // ---- BOTÓN "VER EVIDENCIA JORNADA" ----
        if (btnVerJornada) {
            const tieneEvidencia = tieneJustificacionJornada || tieneObsJornada;
            btnVerJornada.disabled = !tieneEvidencia;
            btnVerJornada.style.opacity = tieneEvidencia ? '1' : '0.5';
            btnVerJornada.style.cursor = tieneEvidencia ? 'pointer' : 'not-allowed';
        }
    }

    asignarEventosBotonesDetalle() {
        const marcacion = this.marcacionDetalleActual;
        if (!marcacion) return;

        // Botones Editar/Ver
        document.querySelectorAll('.btn-obs-edit').forEach(btn => {
            btn.onclick = () => {
                if (btn.disabled) return;
                const tipo = btn.dataset.tipo;
                const modo = btn.dataset.modo || 'ver';
                if (modo === 'editar') {
                    this.abrirModalEditarObservacion(marcacion, tipo);
                } else {
                    this.abrirModalVerObservacion(marcacion, tipo);
                }
            };
        });

        // Botón Agregar Evidencia
        document.querySelectorAll('.btn-obs-upload-evidence').forEach(btn => {
            btn.onclick = () => {
                if (btn.disabled) return;
                this.abrirModalCargarEvidencia(marcacion, btn.dataset.tipo);
            };
        });

        // Botones Ver Evidencia
        document.querySelectorAll('.btn-obs-evidence').forEach(btn => {
            btn.onclick = () => {
                if (btn.disabled) return;
                this.abrirModalEvidenciaTardanzaFalta(marcacion, btn.dataset.tipo);
            };
        });
    }

    cerrarModalDetalleObservaciones() {
        const modal = document.getElementById('modalDetalleObservaciones');
        if (modal) modal.classList.remove('active');
        this.marcacionDetalleActual = null;
    }

    // ==========================================
    // MODAL: VER OBSERVACIÓN (solo lectura)
    // ==========================================
    abrirModalVerObservacion(marcacion, tipo) {
        const modal = document.getElementById('modalEditarObservacion');
        if (!modal) return;

        const titulo = document.getElementById('editObsTitulo');
        const campoLabel = document.getElementById('editObsCampoLabel');
        const texto = document.getElementById('editObsTexto');
        const idDisplay = document.getElementById('editObsIdDisplay');
        const usuarioDisplay = document.getElementById('editObsUsuarioDisplay');

        document.getElementById('editObsIdMarcacion').value = marcacion.IdCHMarcacion;
        document.getElementById('editObsCampo').value = tipo;
        if (idDisplay) idDisplay.value = marcacion.IdCHMarcacion;
        if (usuarioDisplay) usuarioDisplay.value = this.obtenerNombreUsuario(marcacion.IdUsuario);

        let valorActual = '';
        let tituloTexto = '';
        let labelTexto = '';

        switch (tipo) {
            case 'observacion':
                tituloTexto = 'Ver Observación de Ingreso';
                labelTexto = 'Observación General';
                valorActual = marcacion.Observacion || '--';
                break;
            case 'vestimenta':
                tituloTexto = 'Ver Observación de Vestimenta';
                labelTexto = 'Observación de Vestimenta';
                valorActual = marcacion.ObsVestimenta || '--';
                break;
            case 'ingresoAlmuerzo':
                tituloTexto = 'Ver Observación de Ingreso Almuerzo';
                labelTexto = 'Ingreso Almuerzo';
                valorActual = marcacion.ObsIngresoAlmuerzo || '--';
                break;
            case 'salidaAlmuerzo':
                tituloTexto = 'Ver Observación de Salida Almuerzo';
                labelTexto = 'Salida Almuerzo';
                valorActual = marcacion.ObsSalidaAlmuerzo || '--';
                break;
            case 'jornadaCompleta':  // ✅ NUEVO
                tituloTexto = 'Ver Observación de Jornada Completa';
                labelTexto = 'Observación de Jornada';
                valorActual = marcacion.ObsJornadaCompleta || '--';
                break;
            default:
                this.mostrarMensaje('Tipo no válido', 'error');
                return;
        }

        if (titulo) titulo.innerHTML = `<i class="fas fa-eye"></i> ${tituloTexto}`;
        if (campoLabel) campoLabel.innerHTML = `<i class="fas fa-comment"></i> ${labelTexto}`;
        if (texto) {
            texto.value = valorActual;
            texto.disabled = true;
            texto.style.background = '#f5f5f5';
            texto.style.cursor = 'not-allowed';
        }

        ['btnObsJustificacionNoValida', 'btnObsNoJustificoFalta', 'btnObsAnularJustificacion',
            'btnVestimentaGroup', 'btnJornadaJustificada', 'btnJornadaNoJustificada'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });

        const btnGuardar = document.querySelector('#editarObsForm button[type="submit"]');
        if (btnGuardar) btnGuardar.style.display = 'none';

        const btnCancelar = document.getElementById('btnCancelarEditObs');
        if (btnCancelar) btnCancelar.innerHTML = '<i class="fas fa-times"></i> Cerrar';

        modal.classList.add('active');
    }

    // ==========================================
    // MODAL: EDITAR OBSERVACIÓN (solo FALTAS pendientes)
    // ==========================================
    abrirModalEditarObservacion(marcacion, tipo) {
        const modal = document.getElementById('modalEditarObservacion');
        if (!modal) return;

        const titulo = document.getElementById('editObsTitulo');
        const campoLabel = document.getElementById('editObsCampoLabel');
        const texto = document.getElementById('editObsTexto');
        const idDisplay = document.getElementById('editObsIdDisplay');
        const usuarioDisplay = document.getElementById('editObsUsuarioDisplay');

        document.getElementById('editObsIdMarcacion').value = marcacion.IdCHMarcacion;
        document.getElementById('editObsCampo').value = tipo;
        if (idDisplay) idDisplay.value = marcacion.IdCHMarcacion;
        if (usuarioDisplay) usuarioDisplay.value = this.obtenerNombreUsuario(marcacion.IdUsuario);

        // ============================================
        // CASO: JORNADA COMPLETA (solo se permite editar 1 vez)
        // ============================================
        if (tipo === 'jornadaCompleta') {
            if (titulo) titulo.innerHTML = '<i class="fas fa-edit"></i> Justificar Jornada Incompleta';
            if (campoLabel) campoLabel.innerHTML = '<i class="fas fa-clipboard-check"></i> Motivo de Jornada Incompleta';

            let valorActual = marcacion.ObsJornadaCompleta || '';

            // Si no tiene prefijo → precargar
            const upper = valorActual.toUpperCase();
            if (!upper.includes('JORNADA INCOMPLETA')) {
                const motivo = valorActual.trim();
                valorActual = motivo
                    ? `JORNADA INCOMPLETA - JUSTIFICADO: ${motivo}`
                    : 'JORNADA INCOMPLETA - JUSTIFICADO: ';
            }

            if (texto) {
                texto.value = valorActual;
                texto.disabled = false;
                texto.style.background = '';
                texto.style.cursor = '';
            }

            // Ocultar TODOS los botones (el empleado solo tiene Guardar/Cancelar)
            ['btnObsJustificacionNoValida', 'btnObsNoJustificoFalta', 'btnObsAnularJustificacion',
                'btnVestimentaGroup', 'btnJornadaJustificada', 'btnJornadaNoJustificada'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });

            const btnGuardar = document.querySelector('#editarObsForm button[type="submit"]');
            if (btnGuardar) btnGuardar.style.display = 'inline-flex';

            const btnCancelar = document.getElementById('btnCancelarEditObs');
            if (btnCancelar) btnCancelar.innerHTML = '<i class="fas fa-times"></i> Cancelar';

            this._configurarNormalizacionTextarea();

            modal.classList.add('active');

            setTimeout(() => {
                if (!texto) return;
                texto.focus();
                texto.setSelectionRange(texto.value.length, texto.value.length);
            }, 100);
            return;
        }

        // ============================================
        // CASO: FALTA (flujo original sin cambios)
        // ============================================
        if (titulo) titulo.innerHTML = '<i class="fas fa-edit"></i> Justificar Falta';
        if (campoLabel) campoLabel.innerHTML = '<i class="fas fa-comment"></i> Motivo de la Falta';

        let valorActual = marcacion.Observacion || '';
        const obsUpper = valorActual.toUpperCase();
        if (obsUpper.includes('FALTA - JUSTIFICACIÓN PENDIENTE')) {
            let motivo = valorActual;
            motivo = motivo.replace(/FALTA\s*-\s*JUSTIFICACI[ÓO]N\s+PENDIENTE\s*[:;.]?\s*/i, '');
            motivo = motivo.trim();
            valorActual = motivo ? `FALTA JUSTIFICADA: ${motivo}` : 'FALTA JUSTIFICADA: ';
        }

        if (texto) {
            texto.value = valorActual;
            texto.disabled = false;
            texto.style.background = '';
            texto.style.cursor = '';
        }

        ['btnObsJustificacionNoValida', 'btnObsNoJustificoFalta', 'btnObsAnularJustificacion',
            'btnVestimentaGroup', 'btnJornadaJustificada', 'btnJornadaNoJustificada'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });

        const btnGuardar = document.querySelector('#editarObsForm button[type="submit"]');
        if (btnGuardar) btnGuardar.style.display = 'inline-flex';

        const btnCancelar = document.getElementById('btnCancelarEditObs');
        if (btnCancelar) btnCancelar.innerHTML = '<i class="fas fa-times"></i> Cancelar';

        this._configurarNormalizacionTextarea();

        modal.classList.add('active');

        setTimeout(() => {
            if (!texto) return;
            texto.focus();
            texto.setSelectionRange(texto.value.length, texto.value.length);
        }, 100);
    }

    _configurarNormalizacionTextarea() {
        const texto = document.getElementById('editObsTexto');
        if (!texto) return;

        texto.removeEventListener('input', this._handlerNormalizacionTiempoReal);
        texto.removeEventListener('blur', this._handlerNormalizacionBlur);
        texto.removeEventListener('keydown', this._handlerNormalizacionEnter);

        this._handlerNormalizacionTiempoReal = () => this._normalizarEnTiempoReal();
        this._handlerNormalizacionBlur = () => this._normalizarAlPerderFoco();
        this._handlerNormalizacionEnter = (e) => this._normalizarAlEnter(e);

        texto.addEventListener('input', this._handlerNormalizacionTiempoReal);
        texto.addEventListener('blur', this._handlerNormalizacionBlur);
        texto.addEventListener('keydown', this._handlerNormalizacionEnter);

        this._ultimoTextoNormalizado = texto.value;
    }

    _normalizarEnTiempoReal() {
        const texto = document.getElementById('editObsTexto');
        if (!texto) return;

        const valorActual = texto.value;
        const cursorPos = texto.selectionStart;

        if (!valorActual || valorActual.trim() === '') {
            this._ultimoTextoNormalizado = valorActual;
            return;
        }

        if (valorActual !== this._ultimoTextoNormalizado) {
            const normalizado = this._normalizarTextoFalta(valorActual);

            if (normalizado !== valorActual && normalizado !== this._ultimoTextoNormalizado) {
                const diff = normalizado.length - valorActual.length;
                texto.value = normalizado;
                let nuevaPos = cursorPos + diff;
                if (cursorPos > 0 && valorActual.charAt(cursorPos - 1) === ' ') {
                    nuevaPos = Math.min(cursorPos + 1, normalizado.length);
                }
                nuevaPos = Math.max(0, Math.min(nuevaPos, normalizado.length));
                texto.selectionStart = nuevaPos;
                texto.selectionEnd = nuevaPos;
                this._ultimoTextoNormalizado = normalizado;
            } else {
                this._ultimoTextoNormalizado = valorActual;
            }
        }
    }

    _normalizarAlPerderFoco() {
        const texto = document.getElementById('editObsTexto');
        if (!texto) return;
        const normalizado = this._normalizarTextoFalta(texto.value);
        if (normalizado !== texto.value) {
            texto.value = normalizado;
            this._ultimoTextoNormalizado = normalizado;
        }
    }

    _normalizarAlEnter(event) {
        if (event.key === 'Enter') {
            const texto = document.getElementById('editObsTexto');
            if (!texto) return;
            const normalizado = this._normalizarTextoFalta(texto.value);
            if (normalizado !== texto.value) {
                texto.value = normalizado;
                this._ultimoTextoNormalizado = normalizado;
            }
        }
    }

    _normalizarTextoFalta(texto) {
        if (!texto || texto.trim() === '') return texto;

        let limpio = texto;
        const upper = limpio.toUpperCase();

        // Preservar estados especiales
        if (upper.includes('NO JUSTIFICÓ FALTA') ||
            upper.includes('JUSTIFICACIÓN NO VÁLIDA')) {
            return limpio.replace(/\s{2,}/g, ' ').trim();
        }

        // ✅ JORNADA INCOMPLETA: preservar si ya tiene prefijo válido
        if (upper.includes('JORNADA INCOMPLETA')) {
            return limpio.replace(/\s{2,}/g, ' ').trim();
        }

        // ✅ Si estamos editando JORNADA COMPLETA y el usuario borró el prefijo → restaurar
        if (this.marcacionDetalleActual &&
            document.getElementById('editObsCampo')?.value === 'jornadaCompleta') {
            if (limpio.trim().length > 3) {
                const motivo = limpio.trim();
                return `JORNADA INCOMPLETA - JUSTIFICADO: ${motivo}`;
            }
            return limpio;
        }

        // FALTA (flujo original)
        if (upper.includes('FALTA') && !upper.includes('FALTA JUSTIFICADA')) {
            const motivo = limpio.replace(/^FALTA\s*:?\s*/i, '').trim();
            limpio = motivo ? `FALTA JUSTIFICADA: ${motivo}` : 'FALTA JUSTIFICADA: ';
        } else if (upper.includes('FALTA JUSTIFICADA') && !upper.includes('FALTA JUSTIFICADA:')) {
            limpio = limpio.replace(/FALTA JUSTIFICADA/gi, 'FALTA JUSTIFICADA:');
        }

        limpio = limpio.replace(/\s{3,}/g, ' ');
        limpio = limpio.replace(/:\s*/g, ': ');
        return limpio.trim();
    }

    cerrarModalEditarObservacion() {
        const modal = document.getElementById('modalEditarObservacion');
        if (modal) modal.classList.remove('active');

        const texto = document.getElementById('editObsTexto');
        if (texto) {
            if (this._handlerNormalizacionTiempoReal) texto.removeEventListener('input', this._handlerNormalizacionTiempoReal);
            if (this._handlerNormalizacionBlur) texto.removeEventListener('blur', this._handlerNormalizacionBlur);
            if (this._handlerNormalizacionEnter) texto.removeEventListener('keydown', this._handlerNormalizacionEnter);
        }
        this._ultimoTextoNormalizado = null;
    }

    guardarEdicionObservacion(event) {
        event.preventDefault();

        const idMarcacion = parseInt(document.getElementById('editObsIdMarcacion').value);
        const campo = document.getElementById('editObsCampo').value;
        let texto = document.getElementById('editObsTexto').value;

        // Normalizar
        const normalizado = this._normalizarTextoFalta(texto);
        texto = normalizado;

        if (!texto || texto.trim() === '') {
            this.mostrarMensaje('Por favor, escriba el motivo', 'warning');
            return;
        }

        // ✅ MAPEO EXPLÍCITO
        let campoDB;
        switch (campo) {
            case 'observacion': campoDB = 'ObsGeneral'; break;
            case 'vestimenta': campoDB = 'ObsVestimenta'; break;
            case 'ingresoAlmuerzo': campoDB = 'ObsIngresoAlmuerzo'; break;
            case 'salidaAlmuerzo': campoDB = 'ObsSalidaAlmuerzo'; break;
            case 'jornadaCompleta': campoDB = 'ObsJornadaCompleta'; break;
            default:
                this.mostrarMensaje('Campo no válido', 'error');
                return;
        }

        // ✅ Validar contenido según el tipo
        if (campo === 'jornadaCompleta') {
            if (!texto.toUpperCase().includes('JORNADA INCOMPLETA')) {
                this.mostrarMensaje('Debe justificar la jornada incompleta con un motivo válido', 'warning');
                return;
            }
        } else {
            // FALTA
            if (!texto.toUpperCase().includes('FALTA JUSTIFICADA')) {
                this.mostrarMensaje('Debe justificar la falta con un motivo válido', 'warning');
                return;
            }
        }

        this.cerrarModalEditarObservacion();

        this.accionPendiente = 'guardarObservacionFalta'; // reutilizamos el mismo flujo
        this.datosPendientes = {
            id: idMarcacion,
            campoDB,
            valor: texto.trim(),
            idUsuario: this.usuarioActual.IdUsuario
        };

        const mensajeConfirm = campo === 'jornadaCompleta'
            ? '¿Está seguro de guardar el motivo de su jornada incompleta?'
            : '¿Está seguro de guardar el motivo de su falta?';

        this.confirmarMensaje.textContent = mensajeConfirm;
        if (this.modalConfirmar) this.modalConfirmar.classList.add('active');
    }

    // ==========================================
    // CONFIRMACIÓN
    // ==========================================
    cerrarModalConfirmacion() {
        if (this.modalConfirmar) this.modalConfirmar.classList.remove('active');
        this.accionPendiente = null;
        this.datosPendientes = null;
    }

    async ejecutarConfirmacion() {
        const accion = this.accionPendiente;
        const datos = this.datosPendientes;
        if (this.modalConfirmar) this.modalConfirmar.classList.remove('active');

        if (accion === 'guardarObservacionFalta' && datos) {
            await this._ejecutarGuardarObservacionFalta(datos);
        }

        this.accionPendiente = null;
        this.datosPendientes = null;
    }

    async _ejecutarGuardarObservacionFalta(datos) {
        this.mostrarModalCargaProceso('Guardando', 'Guardando...');

        try {
            const r = await this.service.updateMarcacion(datos.id, {
                [datos.campoDB]: datos.valor,
                IdUsuarioModificacion: datos.idUsuario
            });

            this.ocultarModalCargaProceso();

            if (r.success) {
                const esJornada = datos.campoDB === 'ObsJornadaCompleta';
                this.mostrarMensaje(
                    esJornada
                        ? 'Su jornada incompleta ha sido justificada. Ahora puede subir la evidencia.'
                        : 'Su falta ha sido justificada. Ahora puede subir la evidencia.',
                    'success'
                );

                this.cerrarModalDetalleObservaciones();
                await this.cargarMarcaciones(true);
                await this._reabrirDetalleObservaciones(datos.id);
            } else {
                this.mostrarMensaje(`${r.error || 'Error al guardar'}`, 'error');
            }
        } catch (error) {
            this.ocultarModalCargaProceso();
            this.mostrarMensaje(`${error.message}`, 'error');
        }
    }

    async _reabrirDetalleObservaciones(idMarcacion) {
        try {
            const marcacion = this.marcaciones.find(m => m.IdCHMarcacion === idMarcacion);
            if (!marcacion) return;
            await new Promise(resolve => setTimeout(resolve, 200));
            await this.abrirModalDetalleObservaciones(idMarcacion);
        } catch (error) {
            console.error('Error reabriendo detalle:', error);
        }
    }

    // ==========================================
    // MODAL: CARGAR EVIDENCIA (solo FALTAS)
    // ==========================================
    abrirModalCargarEvidencia(marcacion, tipo) {
        if (!marcacion) return;

        if (tipo !== 'observacion' && tipo !== 'jornadaCompleta') {
            this.mostrarMensaje('Solo puede subir evidencia para faltas o jornada incompleta', 'warning');
            return;
        }

        this._marcacionEvidencia = marcacion;
        this._tipoEvidencia = tipo;

        const idEl = document.getElementById('cargarEvidenciaId');
        const usuarioEl = document.getElementById('cargarEvidenciaUsuario');
        const fechaEl = document.getElementById('cargarEvidenciaFecha');
        const tipoEl = document.getElementById('cargarEvidenciaTipo');

        if (idEl) idEl.textContent = marcacion.IdCHMarcacion;
        if (usuarioEl) usuarioEl.textContent = this.obtenerNombreUsuario(marcacion.IdUsuario);
        if (fechaEl) fechaEl.textContent = this.formatearFecha(marcacion.Fecha);

        if (tipoEl) {
            if (tipo === 'jornadaCompleta') {
                tipoEl.innerHTML = `<span style="color: #CC0000; font-weight: 700;">JORNADA INCOMPLETA</span> <span style="color: #6c757d; font-size: 11px; margin-left: 8px;">(ID: 5)</span>`;
            } else {
                tipoEl.innerHTML = `<span style="color: #CC0000; font-weight: 700;">FALTA</span> <span style="color: #6c757d; font-size: 11px; margin-left: 8px;">(ID: 4)</span>`;
            }
        }

        this._resetearModalCargarEvidencia();

        const modal = document.getElementById('modalCargarEvidenciaJustificacion');
        if (modal) modal.classList.add('active');
    }

    _procesarArchivoEvidencia(event) {
        const file = event.target.files[0];
        if (!file) return;

        const tiposPermitidos = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (!tiposPermitidos.includes(file.type)) {
            this.mostrarMensaje('Solo JPG, PNG o PDF', 'error');
            event.target.value = '';
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            this.mostrarMensaje('Máximo 5MB', 'error');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this._evidenciaTempData = e.target.result;
            this._evidenciaTempTipo = file.type;
            this._evidenciaTempNombre = file.name;

            const preview = document.getElementById('previewCargarEvidencia');
            const inner = document.getElementById('previewCargarEvidenciaContainer');

            if (preview && inner) {
                if (file.type.startsWith('image/')) {
                    inner.innerHTML = `<img src="${e.target.result}" style="max-width:100%;max-height:300px;border-radius:8px;border:2px solid #28a745;"><p style="font-size:12px;color:#28a745;margin-top:5px;"><i class="fas fa-check-circle"></i> ${file.name} (${(file.size / 1024).toFixed(1)} KB)</p>`;
                } else {
                    inner.innerHTML = `<div style="padding:30px;background:#f8f9fa;border-radius:8px;border:2px solid #28a745;text-align:center;"><i class="fas fa-file-pdf" style="font-size:48px;color:#dc3545;"></i><p style="font-size:14px;color:#28a745;margin-top:10px;"><i class="fas fa-check-circle"></i> ${file.name}</p></div>`;
                }
                preview.style.display = 'block';
            }

            const guardarBtn = document.getElementById('btnGuardarCargarEvidencia');
            if (guardarBtn) guardarBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    }

    async _guardarEvidenciaJustificacion() {
        const marcacion = this._marcacionEvidencia;
        if (!marcacion || !this._evidenciaTempData) {
            this.mostrarMensaje('Debe seleccionar un archivo', 'warning');
            return;
        }

        this.mostrarModalCargaProceso('Guardando', 'Guardando evidencia...');

        try {
            const extension = this._obtenerExtensionArchivo(this._evidenciaTempTipo);

            // ✅ Determinar tipo según la sección
            const tipoTardanza = this._tipoEvidencia === 'jornadaCompleta'
                ? 'JORNADA INCOMPLETA'
                : 'FALTA';

            const r = await this.service.createJustificacion({
                IdMarcacion: marcacion.IdCHMarcacion,
                TipoTardanza: tipoTardanza,
                ArchivoEvidencia: this._evidenciaTempData,
                TipoArchivo: extension,
                IdUsuarioCreacion: this.usuarioActual.IdUsuario
            });

            if (!r.success) throw new Error(r.error);

            this.ocultarModalCargaProceso();
            this.mostrarMensaje(
                this._tipoEvidencia === 'jornadaCompleta'
                    ? 'Evidencia de jornada incompleta subida correctamente'
                    : 'Evidencia de justificación subida correctamente',
                'success'
            );

            const modal = document.getElementById('modalCargarEvidenciaJustificacion');
            if (modal) modal.classList.remove('active');

            this.cerrarModalDetalleObservaciones();

            await this.cargarMarcaciones(true);
            await this._reabrirDetalleObservaciones(marcacion.IdCHMarcacion);

        } catch (error) {
            this.ocultarModalCargaProceso();
            this.mostrarMensaje(`${error.message}`, 'error');
        }
    }

    // ==========================================
    // NUEVO: CALCULAR ESTADO DE "¿CUMPLIÓ LA JORNADA?"
    // ==========================================
    async _calcularEstadoJornada(marcacion) {
        try {
            if (!marcacion) return 'N/A';

            const obs = String(marcacion.Observacion || marcacion.ObsGeneral || '').toUpperCase();

            // 1. Si es NO LABORABLE → N/A
            if (obs.includes('NO LABORA')) {
                return 'N/A';
            }

            // 2. Si es FALTA → N/A
            const descEstado = String(
                marcacion.EstadoIngDescripcion ||
                this.obtenerDescripcionEstado(marcacion.IdEstadoMarcacion) ||
                ''
            ).toUpperCase();
            if (descEstado.includes('FALTO') || descEstado.includes('FALTA')) {
                return 'N/A';
            }

            // 3. Determinar si la asignación tiene almuerzo configurado
            const tieneAlmuerzo = await this._tieneAlmuerzoConfigurado(marcacion);

            const tieneIngreso = !!marcacion.IngresoReal && marcacion.IngresoReal !== '--:--';
            const tieneSalida = !!marcacion.SalidaReal && marcacion.SalidaReal !== '--:--';
            const tieneIngAlm = !!marcacion.IngAlmuerzo && marcacion.IngAlmuerzo !== '--:--';
            const tieneSalAlm = !!marcacion.SalAlmuerzo && marcacion.SalAlmuerzo !== '--:--';

            if (tieneAlmuerzo) {
                return (tieneIngreso && tieneSalida && tieneIngAlm && tieneSalAlm)
                    ? 'JORNADA CUMPLIDA'
                    : 'JORNADA NO CUMPLIDA';
            } else {
                return (tieneIngreso && tieneSalida)
                    ? 'JORNADA CUMPLIDA'
                    : 'JORNADA NO CUMPLIDA';
            }
        } catch (error) {
            console.warn('Error calculando estado de jornada:', error);
            return 'N/A';
        }
    }

    // ==========================================
    // NUEVO: VERIFICAR SI LA ASIGNACIÓN TIENE ALMUERZO
    // ==========================================
    async _tieneAlmuerzoConfigurado(marcacion) {
        try {
            if (!marcacion?.IdControlHorarioSys) return false;

            const asignaciones = await this.cargarAsignacionesCache();
            const asignacion = asignaciones.find(a => a.IdAsignacion == marcacion.IdControlHorarioSys);
            if (!asignacion) return false;

            const ingAlm = asignacion.IngAlmuerzoEsperado;
            const salAlm = asignacion.SalAlmuerzoEsperado;

            return !!(ingAlm || salAlm);
        } catch (error) {
            console.warn('Error verificando almuerzo:', error);
            return false;
        }
    }

    // ==========================================
    // NUEVO: CREAR BADGE "¿CUMPLIÓ LA JORNADA?"
    // ==========================================
    _crearBadgeJornada(estado) {
        if (!estado) return '<span class="badge badge-secondary">N/A</span>';

        const estados = {
            'JORNADA CUMPLIDA': { clase: 'badge-jornada-cumplida', texto: 'JORNADA CUMPLIDA' },
            'JORNADA NO CUMPLIDA': { clase: 'badge-jornada-no-cumplida', texto: 'JORNADA NO CUMPLIDA' },
            'N/A': { clase: 'badge-jornada-na', texto: 'N/A' }
        };

        const cfg = estados[estado] || estados['N/A'];
        return `<span class="badge ${cfg.clase}" style="font-weight: 700; font-size: 10px; padding: 4px 10px; border-radius: 12px;">${cfg.texto}</span>`;
    }

    _obtenerExtensionArchivo(tipoMime) {
        if (!tipoMime) return 'pdf';
        if (tipoMime.includes('pdf')) return 'pdf';
        if (tipoMime.includes('jpeg') || tipoMime.includes('jpg')) return 'jpg';
        if (tipoMime.includes('png')) return 'png';
        return 'pdf';
    }

    // ==========================================
    // MODAL: TARDANZAS (SIN FILTRO DE USUARIO NI EXPORTACIÓN)
    // ==========================================
    async abrirModalTardanzas() {
        const modal = document.getElementById('modalTardanzas');
        if (!modal) return;

        // Limpiar filtros (solo mes y año)
        ['filtroTardanzaMes', 'filtroTardanzaAnio'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        // Cargar años
        this.cargarAniosSelect();

        // Cargar datos
        await this.cargarDatosTardanzas();

        modal.classList.add('active');
    }

    cargarAniosSelect() {
        const select = document.getElementById('filtroTardanzaAnio');
        if (!select) return;
        const actual = new Date().getFullYear();
        select.innerHTML = '<option value="">-- Año --</option>';
        for (let a = actual; a >= 2024; a--) {
            const opt = document.createElement('option');
            opt.value = a;
            opt.textContent = a;
            select.appendChild(opt);
        }
    }

    async cargarDatosTardanzas() {
        const tbody = document.getElementById('tablaTardanzasBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="25" class="loading"><i class="fas fa-spinner"></i> Calculando tardanzas...</td></tr>';

        try {
            const mesSel = document.getElementById('filtroTardanzaMes')?.value;
            const anioSel = document.getElementById('filtroTardanzaAnio')?.value;

            const asignaciones = await this.cargarAsignacionesCache();
            const asignacionesMap = new Map();
            asignaciones.forEach(a => asignacionesMap.set(a.IdAsignacion, a));

            let marcaciones = [...this.marcaciones].filter(m => m.IdEstado !== 3);

            // Filtros mes/año (igual que en Gestión)
            let fechaInicio = null, fechaFin = null;
            if (mesSel && anioSel) {
                fechaInicio = `${anioSel}-${mesSel}-01`;
                const ult = new Date(parseInt(anioSel), parseInt(mesSel), 0);
                fechaFin = `${anioSel}-${mesSel}-${String(ult.getDate()).padStart(2, '0')}`;
            } else if (mesSel) {
                const anio = new Date().getFullYear();
                fechaInicio = `${anio}-${mesSel}-01`;
                const ult = new Date(anio, parseInt(mesSel), 0);
                fechaFin = `${anio}-${mesSel}-${String(ult.getDate()).padStart(2, '0')}`;
            } else if (anioSel) {
                marcaciones = marcaciones.filter(m => m.Fecha && m.Fecha.substring(0, 4) === anioSel);
            } else {
                const ahora = new Date();
                const mes = String(ahora.getMonth() + 1).padStart(2, '0');
                const anio = ahora.getFullYear();
                fechaInicio = `${anio}-${mes}-01`;
                const ult = new Date(anio, ahora.getMonth() + 1, 0);
                fechaFin = `${anio}-${mes}-${String(ult.getDate()).padStart(2, '0')}`;
            }

            if (fechaInicio && fechaFin) {
                marcaciones = marcaciones.filter(m => m.Fecha >= fechaInicio && m.Fecha <= fechaFin);
            }

            // Excluir no laborables / faltas justificadas
            const excluir = ['NO LABORA', 'DÍA NO LABORABLE', 'NO JUSTIFICÓ FALTA', 'FALTA JUSTIFICADA'];
            marcaciones = marcaciones.filter(m => {
                const o = (m.Observacion || '').toUpperCase();
                return !excluir.some(e => o.includes(e));
            });

            marcaciones = marcaciones.filter(m => {
                const tieneIng = m.IngresoReal && m.IngresoReal !== '--:--';
                const tieneSal = m.SalidaReal && m.SalidaReal !== '--:--';
                const tieneIA = m.IngAlmuerzo && m.IngAlmuerzo !== '--:--';
                const tieneSA = m.SalAlmuerzo && m.SalAlmuerzo !== '--:--';
                return tieneIng || tieneSal || tieneIA || tieneSA;
            });

            marcaciones.sort((a, b) => (a.Fecha > b.Fecha ? -1 : 1));

            const datos = [];
            for (const m of marcaciones) {
                const d = this._calcularTardanzas(m, asignacionesMap);
                if (d) datos.push(d);
            }

            this.datosTardanzas = datos;
            this.paginaTardanzas = 1;
            this.totalPaginasTardanzas = Math.ceil(datos.length / this.registrosPorPagina) || 1;

            this.renderizarTablaTardanzas();
            this.actualizarPaginacionTardanzas();
            this._actualizarTotalesMensuales(datos);
        } catch (error) {
            console.error('Error tardanzas:', error);
            tbody.innerHTML = `<tr><td colspan="25" class="loading" style="color:#dc3545;">Error: ${error.message}</td></tr>`;
        }
    }

    // [MÉTODOS HEREDADOS DE GESTIÓN]
    // Copia tal cual desde Gestion_Marcaciones_Controller.js:
    //   - _calcularTardanzas(marcacion, asignacionesMap)
    //   - _determinarMotivoDescuento(observacion, tipo, tieneMarcacion)
    //   - _debeAplicarDescuento(motivo)
    //   - _obtenerColorMotivo(motivo)
    //   - _obtenerIconoMotivo(motivo)
    //   - _calcularHorasProgramadasSemanales(idUsuario, fecha, asignacionesMap)
    //   - _actualizarTotalesMensuales(datosTardanzas)
    //   - renderizarTablaTardanzas()
    //   - actualizarPaginacionTardanzas()
    //   - irPrimeraPaginaTardanzas(), irPaginaAnteriorTardanzas(),
    //     irPaginaSiguienteTardanzas(), irUltimaPaginaTardanzas()
    //   - _horaAMinutos(), _sumarMinutosAHora(), _calcularDiferenciaMinutos()
    //   - _formatearMinutos()
    //   - _obtenerSueldoUsuario(idUsuario) ← con la Opción B (siempre null)

    // ==========================================
    // MODALES DE CARGA
    // ==========================================
    mostrarModalCargaProceso(titulo, mensaje) {
        let modal = document.getElementById('modalCargaProceso');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modalCargaProceso';
            modal.className = 'modal';
            modal.innerHTML = `<div class="modal-content" style="max-width:400px;text-align:center;"><div class="modal-body" style="padding:30px;"><div class="spinner"></div><h3 id="cargaProcesoTitulo" style="margin-top:15px;">${titulo}</h3><p id="cargaProcesoMensaje">${mensaje}</p></div></div>`;
            document.body.appendChild(modal);
        } else {
            const t = document.getElementById('cargaProcesoTitulo');
            const m = document.getElementById('cargaProcesoMensaje');
            if (t) t.textContent = titulo;
            if (m) m.textContent = mensaje;
        }
        modal.classList.add('active');
    }

    ocultarModalCargaProceso() {
        const modal = document.getElementById('modalCargaProceso');
        if (modal) modal.classList.remove('active');
    }

    mostrarModalCargaEvidencia(titulo, mensaje) {
        let modal = document.getElementById('modalCargaEvidencia');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modalCargaEvidencia';
            modal.className = 'modal';
            modal.innerHTML = `<div class="modal-content" style="max-width:400px;text-align:center;"><div class="modal-body" style="padding:30px;"><div class="spinner"></div><h3 id="cargaEvidenciaTitulo" style="margin-top:15px;">${titulo}</h3><p id="cargaEvidenciaMensaje">${mensaje}</p></div></div>`;
            document.body.appendChild(modal);
        } else {
            const t = document.getElementById('cargaEvidenciaTitulo');
            const m = document.getElementById('cargaEvidenciaMensaje');
            if (t) t.textContent = titulo;
            if (m) m.textContent = mensaje;
        }
        modal.classList.add('active');
    }

    ocultarModalCargaEvidencia() {
        const modal = document.getElementById('modalCargaEvidencia');
        if (modal) modal.classList.remove('active');
    }

    // ==========================================
    // MENSAJES
    // ==========================================
    mostrarMensaje(mensaje, tipo = 'info') {
        let box = document.querySelector('.message-box');
        if (!box) {
            box = document.createElement('div');
            box.className = 'message-box';
            document.body.appendChild(box);
        }
        const iconos = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
        box.innerHTML = `<i class="fas ${iconos[tipo] || iconos.info}"></i> <span>${mensaje}</span>`;
        box.className = `message-box show ${tipo}`;
        clearTimeout(this._msgTimeout);
        this._msgTimeout = setTimeout(() => box.classList.remove('show'), 4000);
    }

    // ==========================================
    // NAVEGACIÓN
    // ==========================================
    redirigirALogin() { window.location.replace(this.config?.ROUTES?.LOGIN || 'index.html'); }
    redirigirAlMenu() { window.location.href = this.config?.ROUTES?.MENU || 'Menu.html'; }
    redirigirAlPerfil() { window.location.href = this.config?.ROUTES?.PERFIL || 'Mi-Perfil.html'; }

    cerrarSesion() {
        this.mostrarMensaje('Sesión cerrada correctamente', 'success');
        setTimeout(() => this.auth.cerrarSesion(), 700);
    }

    // ==========================================
    // [MÉTODOS HEREDADOS DE GESTIÓN]
    // Copiados desde Gestion_Marcaciones_Controller.js
    // ==========================================

    // ------------------------------------------
    // MODAL: DETALLE DE ASIGNACIÓN (con Tipo de Horario + Versión Anterior)
    // ------------------------------------------
    async mostrarDetalleAsignacion(idControlHorario) {
        if (!idControlHorario || idControlHorario === 'N/A') return;

        this.mostrarModalCargaProceso('Cargando', 'Obteniendo detalles de la asignación...');

        try {
            const asignaciones = await this.cargarAsignacionesCache();
            const asignacion = asignaciones.find(a => a.IdAsignacion == idControlHorario);

            if (!asignacion) {
                this.mostrarMensaje('No se encontró la asignación', 'warning');
                this.ocultarModalCargaProceso();
                return;
            }

            let nombreHorario = 'No encontrado';
            let horarioCompleto = null;

            if (this.horariosCache) {
                horarioCompleto = this.horariosCache.find(h => h.IdHorario == asignacion.IdHorario);
                if (horarioCompleto) nombreHorario = horarioCompleto.Descripcion;
            }

            const ingresoAsignacion = asignacion.IngEsperado || '';
            const salidaAsignacion = asignacion.SalEsperada || '';
            const ingresoAlmuerzoAsignacion = asignacion.IngAlmuerzoEsperado || '';
            const salidaAlmuerzoAsignacion = asignacion.SalAlmuerzoEsperado || '';

            let ingresoHorario = '', salidaHorario = '', ingresoAlmuerzoHorario = '', salidaAlmuerzoHorario = '';
            if (horarioCompleto) {
                ingresoHorario = horarioCompleto.HoraIngreso || '';
                salidaHorario = horarioCompleto.HoraSalida || '';
                ingresoAlmuerzoHorario = horarioCompleto.HoraIngAlmuerzo || '';
                salidaAlmuerzoHorario = horarioCompleto.HoraSalAlmuerzo || '';
            }

            const compararHoras = (h1, h2) => this._normalizarHoraComparacion(h1) === this._normalizarHoraComparacion(h2);

            const coincideIngreso = compararHoras(ingresoAsignacion, ingresoHorario);
            const coincideSalida = compararHoras(salidaAsignacion, salidaHorario);
            const coincideIngresoAlmuerzo = compararHoras(ingresoAlmuerzoAsignacion, ingresoAlmuerzoHorario);
            const coincideSalidaAlmuerzo = compararHoras(salidaAlmuerzoAsignacion, salidaAlmuerzoHorario);
            const todoCoincide = coincideIngreso && coincideSalida && coincideIngresoAlmuerzo && coincideSalidaAlmuerzo;

            const nombreHorarioFinal = todoCoincide
                ? `${nombreHorario} (ID: ${horarioCompleto?.IdHorario || 'N/A'})`
                : `${nombreHorario} (ID: ${horarioCompleto?.IdHorario || 'N/A'}) - ⚠️ Versión Anterior`;

            // Detectar tipo de horario
            let tipoHorario = 'N/A';
            let tipoHorarioBadge = 'badge-secondary';
            if (horarioCompleto) {
                const tipoRaw = String(horarioCompleto.TipoHorario || '').trim().toUpperCase();
                if (tipoRaw === 'VIRTUAL') { tipoHorario = 'VIRTUAL'; tipoHorarioBadge = 'badge-virtual'; }
                else if (tipoRaw === 'PRESENCIAL') { tipoHorario = 'PRESENCIAL'; tipoHorarioBadge = 'badge-presencial'; }
                else {
                    const descLower = String(horarioCompleto.Descripcion || '').toLowerCase();
                    if (descLower.includes('virtual')) { tipoHorario = 'VIRTUAL'; tipoHorarioBadge = 'badge-virtual'; }
                    else if (descLower.includes('presencial')) { tipoHorario = 'PRESENCIAL'; tipoHorarioBadge = 'badge-presencial'; }
                    else { tipoHorario = tipoRaw || 'N/A'; }
                }
            }

            const estado = this.estados.find(e => e.IdEstado == asignacion.IdEstado);
            const nombreEstado = estado ? estado.Descripcion : 'No encontrado';

            if (this.detalleAsignacionBody) {
                this.detalleAsignacionBody.innerHTML = `
                <tr><th>ID Asignación</th><td><strong>${asignacion.IdAsignacion || 'N/A'}</strong></td></tr>
                <tr><th>Usuario</th><td>${this.obtenerNombreUsuario(asignacion.IdUsuario)}</td></tr>
                <tr><th>Horario</th><td>${this.escapeHtml(nombreHorarioFinal)}</td></tr>
                <tr>
                    <th>Tipo de Horario</th>
                    <td>
                        <span class="badge ${tipoHorarioBadge}" style="font-size: 12px; padding: 4px 14px;">
                            ${tipoHorario === 'VIRTUAL' ? 'VIRTUAL' : tipoHorario === 'PRESENCIAL' ? 'PRESENCIAL' : tipoHorario}
                        </span>
                    </td>
                </tr>
                <tr><th>Fecha</th><td>${this.formatearFecha(asignacion.Fecha)}</td></tr>
                <tr><th>Ingreso Esperado</th><td>${this.formatearHora(ingresoAsignacion)}</td></tr>
                <tr><th>Salida Esperada</th><td>${this.formatearHora(salidaAsignacion)}</td></tr>
                <tr><th>Ingreso Almuerzo</th><td>${this.formatearHora(ingresoAlmuerzoAsignacion)}</td></tr>
                <tr><th>Salida Almuerzo</th><td>${this.formatearHora(salidaAlmuerzoAsignacion)}</td></tr>
                <tr><th>Estado</th><td>${nombreEstado}</td></tr>
            `;
            }

            this.ocultarModalCargaProceso();
            if (this.modalDetalleAsignacion) this.modalDetalleAsignacion.classList.add('active');
        } catch (error) {
            console.error('Error mostrando detalle:', error);
            this.mostrarMensaje('Error al cargar el detalle', 'error');
            this.ocultarModalCargaProceso();
        }
    }

    _normalizarHoraComparacion(hora) {
        if (!hora) return '';
        const s = String(hora).trim();
        if (/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(s)) return s;
        if (s.includes('T')) {
            const m = s.match(/T(\d{2}):(\d{2})/);
            if (m) return `${m[1]}:${m[2]}`;
        }
        if (/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(s)) return s.substring(0, 5);
        if (/^([0-9]):[0-5][0-9]$/.test(s)) return `0${s}`;
        return s;
    }

    cerrarModalDetalleAsignacion() {
        if (this.modalDetalleAsignacion) this.modalDetalleAsignacion.classList.remove('active');
    }

    // ------------------------------------------
    // MODAL: VER EVIDENCIA TARDANZA/FALTA
    // ------------------------------------------
    async abrirModalEvidenciaTardanzaFalta(marcacion, tipo) {
        const modal = document.getElementById('modalEvidenciaTardanzaFalta');
        if (!modal) return;

        const titulo = document.getElementById('evidenciaTardanzaTitulo');
        const idSpan = document.getElementById('evidenciaTardanzaId');
        const usuarioSpan = document.getElementById('evidenciaTardanzaUsuario');
        const fechaSpan = document.getElementById('evidenciaTardanzaFecha');
        const tipoSpan = document.getElementById('evidenciaTardanzaTipo');

        if (idSpan) idSpan.textContent = marcacion.IdCHMarcacion;
        if (usuarioSpan) usuarioSpan.textContent = this.obtenerNombreUsuario(marcacion.IdUsuario);
        if (fechaSpan) fechaSpan.textContent = this.formatearFecha(marcacion.Fecha);

        // ============================================
        // TÍTULO Y TIPO PROVISIONAL SEGÚN SECCIÓN
        // (luego se sobrescribe con el tipo real de BD)
        // ============================================
        let tituloTexto = '';
        let tipoTexto = '';
        let tipoBadgeClass = 'tipo-badge tardanza';

        switch (tipo) {
            case 'observacion': tituloTexto = 'Evidencia - Ingreso'; tipoTexto = 'INGRESO'; break;
            case 'ingresoAlmuerzo': tituloTexto = 'Evidencia - Ingreso Almuerzo'; tipoTexto = 'INGRESO ALMUERZO'; break;
            case 'salidaAlmuerzo': tituloTexto = 'Evidencia - Salida Almuerzo'; tipoTexto = 'SALIDA ALMUERZO'; break;
            default: tipoTexto = tipo.toUpperCase();
        }

        if (titulo) titulo.textContent = tituloTexto;
        if (tipoSpan) { tipoSpan.textContent = tipoTexto; tipoSpan.className = tipoBadgeClass; }

        this.mostrarModalCargaEvidencia('Cargando evidencia...', 'Obteniendo datos...');
        modal.classList.add('active');

        try {
            // ============================================
            // 1. OBTENER TODAS LAS JUSTIFICACIONES
            // ============================================
            const rAll = await this.service.getAllJustificacionesByMarcacion(marcacion.IdCHMarcacion);
            this.ocultarModalCargaEvidencia();

            if (!rAll.success || !rAll.data || rAll.data.length === 0) {
                this._mostrarPlaceholderEvidencia('No hay evidencia disponible');
                return;
            }

            // ============================================
            // 2. FILTRAR SEGÚN LA SECCIÓN
            // ============================================
            const mapTipos = {
                'observacion': ['TARDANZA - INGRESO', 'FALTA'],
                'ingresoAlmuerzo': ['TARDANZA - INGRESO ALMUERZO'],
                'salidaAlmuerzo': ['EXCESO - SALIDA ALMUERZO']
            };
            const tiposEsperados = mapTipos[tipo] || [];

            let justificacionEncontrada = rAll.data.find(j => {
                const desc = String(j.TipoJustificacionDescripcion || '').trim().toUpperCase();
                return tiposEsperados.some(t => desc === t || desc.includes(t));
            });

            // Fallback: primera activa con archivo
            if (!justificacionEncontrada) {
                justificacionEncontrada = rAll.data.find(j => j.IdEstado === 1 && j.ArchivoEvidencia);
            }

            if (!justificacionEncontrada) {
                this._mostrarPlaceholderEvidencia('No hay evidencia para esta sección');
                return;
            }

            // ============================================
            // 3. ✅ SOBRESCRIBIR EL TIPO CON EL VALOR REAL DE BD
            // ============================================
            const tipoRealBD = String(justificacionEncontrada.TipoJustificacionDescripcion || '').trim();

            if (tipoSpan && tipoRealBD) {
                tipoSpan.textContent = tipoRealBD;

                // Ajustar el badge según el tipo real
                if (tipoRealBD.toUpperCase().includes('FALTA')) {
                    tipoSpan.className = 'tipo-badge falta';
                } else {
                    tipoSpan.className = 'tipo-badge tardanza';
                }
            }

            // Ajustar el título con el tipo real (opcional, mejora la claridad)
            if (titulo && tipoRealBD) {
                titulo.textContent = `Evidencia - ${tipoRealBD}`;
            }

            // ============================================
            // 4. MOSTRAR LA EVIDENCIA
            // ============================================
            const base64 = this._normalizarBase64(justificacionEncontrada.ArchivoEvidencia);
            const tipoArchivo = justificacionEncontrada.TipoArchivo || 'image/jpeg';

            if (!base64) {
                this._mostrarPlaceholderEvidencia('Sin archivo adjunto');
                return;
            }

            if (this._esPdf(base64, tipoArchivo)) {
                this._mostrarPdfTardanza(base64, tipoArchivo, marcacion);
            } else {
                this._mostrarImagenTardanza(base64, tipoArchivo, marcacion);
            }
        } catch (error) {
            console.error('Error cargando evidencia:', error);
            this.ocultarModalCargaEvidencia();
            this._mostrarPlaceholderEvidencia('Error al cargar evidencia');
        }
    }

    _normalizarBase64(valor) {
        if (!valor) return null;
        if (typeof valor === 'string') {
            if (valor.startsWith('data:')) {
                const partes = valor.split(',');
                return partes.length > 1 ? partes[1] : null;
            }
            return valor;
        }
        if (typeof valor === 'object' && valor.type === 'Buffer' && Array.isArray(valor.data)) {
            try {
                const bytes = new Uint8Array(valor.data);
                let binary = '';
                for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                return btoa(binary);
            } catch (e) { return null; }
        }
        if (Array.isArray(valor)) {
            try {
                const bytes = new Uint8Array(valor);
                let binary = '';
                for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                return btoa(binary);
            } catch (e) { return null; }
        }
        if (typeof valor === 'object' && valor.data) return this._normalizarBase64(valor.data);
        return null;
    }

    _mostrarPlaceholderEvidencia(mensaje) {
        const placeholder = document.getElementById('evidenciaTardanzaPlaceholder');
        const imgWrapper = document.getElementById('evidenciaTardanzaImagenWrapper');
        const pdfWrapper = document.getElementById('evidenciaTardanzaPdfWrapper');
        if (placeholder) {
            placeholder.style.display = 'flex';
            placeholder.innerHTML = `<i class="fas fa-info-circle" style="color:#17a2b8;font-size:48px;"></i><p style="margin-top:10px;">${mensaje}</p>`;
        }
        if (imgWrapper) imgWrapper.style.display = 'none';
        if (pdfWrapper) pdfWrapper.style.display = 'none';
    }

    _esPdf(base64Data, tipoArchivo) {
        if (tipoArchivo && tipoArchivo.includes('pdf')) return true;
        if (base64Data && base64Data.startsWith('JVBER')) return true;
        return false;
    }

    _mostrarImagenTardanza(base64Data, tipoArchivo, marcacion) {
        const img = document.getElementById('evidenciaTardanzaImagen');
        const imgWrapper = document.getElementById('evidenciaTardanzaImagenWrapper');
        const placeholder = document.getElementById('evidenciaTardanzaPlaceholder');
        const pdfWrapper = document.getElementById('evidenciaTardanzaPdfWrapper');
        if (pdfWrapper) pdfWrapper.style.display = 'none';
        if (placeholder) placeholder.style.display = 'none';
        if (imgWrapper) imgWrapper.style.display = 'block';
        let formato = 'jpeg';
        if (base64Data.startsWith('iVBORw')) formato = 'png';
        else if (base64Data.startsWith('R0lGZD')) formato = 'gif';
        if (img) {
            img.src = `data:image/${formato};base64,${base64Data}`;
            img.style.display = 'block';
        }
    }

    _mostrarPdfTardanza(base64Data, tipoArchivo, marcacion) {
        const pdfWrapper = document.getElementById('evidenciaTardanzaPdfWrapper');
        const pdfPreview = document.getElementById('evidenciaTardanzaPdfPreview');
        const placeholder = document.getElementById('evidenciaTardanzaPlaceholder');
        const imgWrapper = document.getElementById('evidenciaTardanzaImagenWrapper');
        const btnDescargar = document.getElementById('btnDescargarPdf');
        const btnDescargarDirecto = document.getElementById('btnDescargarPdfDirecto');
        if (imgWrapper) imgWrapper.style.display = 'none';
        if (placeholder) placeholder.style.display = 'none';
        if (pdfWrapper) pdfWrapper.style.display = 'block';
        if (pdfPreview) {
            pdfPreview.src = `data:application/pdf;base64,${base64Data}`;
            pdfPreview.style.display = 'block';
        }
        if (btnDescargar) { btnDescargar.style.display = 'inline-flex'; btnDescargar.onclick = () => this._descargarPdfTardanza(base64Data, marcacion); }
        if (btnDescargarDirecto) { btnDescargarDirecto.style.display = 'inline-flex'; btnDescargarDirecto.onclick = () => this._descargarPdfTardanza(base64Data, marcacion); }
    }

    _descargarPdfTardanza(base64Data, marcacion) {
        try {
            const binary = atob(base64Data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `evidencia_${marcacion.IdCHMarcacion}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (e) { this.mostrarMensaje('Error al descargar PDF', 'error'); }
    }

    _formatearTamanioBase64(base64) {
        if (!base64) return '0 KB';
        try {
            const bytes = (base64.length * 3) / 4;
            if (bytes < 1024) return `${Math.round(bytes)} bytes`;
            if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / 1048576).toFixed(1)} MB`;
        } catch (e) { return '?'; }
    }

    cerrarModalEvidenciaTardanzaFalta() {
        const modal = document.getElementById('modalEvidenciaTardanzaFalta');
        if (modal) modal.classList.remove('active');
        const pdfPreview = document.getElementById('evidenciaTardanzaPdfPreview');
        if (pdfPreview) { pdfPreview.src = ''; pdfPreview.style.display = 'none'; }
        const imgWrapper = document.getElementById('evidenciaTardanzaImagenWrapper');
        const pdfWrapper = document.getElementById('evidenciaTardanzaPdfWrapper');
        if (imgWrapper) imgWrapper.style.display = 'none';
        if (pdfWrapper) pdfWrapper.style.display = 'none';
        const btnDescargar = document.getElementById('btnDescargarPdf');
        const btnDescargarDirecto = document.getElementById('btnDescargarPdfDirecto');
        if (btnDescargar) btnDescargar.style.display = 'none';
        if (btnDescargarDirecto) btnDescargarDirecto.style.display = 'none';
    }

    // ------------------------------------------
    // MODAL: VER EVIDENCIA (SELFIE) + MAPA
    // ------------------------------------------
    async mostrarEvidencia(idMarcacion, tipo) {
        this.mostrarModalCargaEvidencia('Cargando evidencia...', 'Obteniendo datos...');

        try {
            const marcacion = this.marcaciones.find(m => m.IdCHMarcacion === idMarcacion);
            if (!marcacion) {
                this.ocultarModalCargaEvidencia();
                this.mostrarMensaje('Marcación no encontrada', 'warning');
                return;
            }

            let evidencia = this.cacheEvidencias.get(idMarcacion);
            if (!evidencia) {
                const r = await this.service.getEvidenciaByMarcacion(idMarcacion);
                if (r.success && r.data) {
                    evidencia = r.data;
                    this.cacheEvidencias.set(idMarcacion, evidencia);
                } else {
                    this.ocultarModalCargaEvidencia();
                    this.mostrarMensaje('No hay evidencia para esta marcación', 'warning');
                    return;
                }
            }

            let campoImagen = '', campoLat = '', campoLng = '', titulo = '';
            switch (tipo) {
                case 'ingreso': campoImagen = 'FotoIngreso'; campoLat = 'LatitudIng'; campoLng = 'LongitudIng'; titulo = 'Evidencia - Ingreso'; break;
                case 'salida': campoImagen = 'FotoSalida'; campoLat = 'LatitudSal'; campoLng = 'LongitudSal'; titulo = 'Evidencia - Salida'; break;
                case 'ingresoAlmuerzo': campoImagen = 'FotoIngAlmuerzo'; titulo = 'Evidencia - Ingreso Almuerzo'; break;
                case 'salidaAlmuerzo': campoImagen = 'FotoSalAlmuerzo'; titulo = 'Evidencia - Salida Almuerzo'; break;
                default: this.ocultarModalCargaEvidencia(); return;
            }

            let infoUbicacion = null;
            if (tipo === 'ingreso' || tipo === 'salida') {
                infoUbicacion = await this._obtenerInfoUbicacionParaEvidencia(marcacion);
            }

            this._mostrarEvidenciaEnModal(evidencia, campoImagen, campoLat, campoLng, titulo, marcacion, infoUbicacion, tipo);
        } catch (error) {
            console.error('Error mostrando evidencia:', error);
            this.ocultarModalCargaEvidencia();
            this.mostrarMensaje('Error al cargar evidencia', 'error');
        }
    }

    async _obtenerInfoUbicacionParaEvidencia(marcacion) {
        try {
            // ============================================
            // 1. OBTENER ASIGNACIÓN Y HORARIO
            // ============================================
            const asignaciones = await this.cargarAsignacionesCache();
            const asignacion = asignaciones.find(a => a.IdAsignacion == marcacion.IdControlHorarioSys);

            let tipoHorario = 'DESCONOCIDO';
            let horarioCompleto = null;

            if (asignacion && this.horariosCache) {
                horarioCompleto = this.horariosCache.find(h => h.IdHorario == asignacion.IdHorario);
                if (horarioCompleto) {
                    const tipoRaw = String(horarioCompleto.TipoHorario || '').trim().toUpperCase();
                    if (tipoRaw === 'VIRTUAL') tipoHorario = 'VIRTUAL';
                    else if (tipoRaw === 'PRESENCIAL') tipoHorario = 'PRESENCIAL';
                    else {
                        const descLower = String(horarioCompleto.Descripcion || '').toLowerCase();
                        if (descLower.includes('virtual')) tipoHorario = 'VIRTUAL';
                        else if (descLower.includes('presencial')) tipoHorario = 'PRESENCIAL';
                    }
                }
            }

            // ============================================
            // 2. OBTENER USUARIO DEL CACHÉ
            // ============================================
            const usuarioCache = this.usuarios.find(u => u.IdUsuario === marcacion.IdUsuario);

            let idSucursal = usuarioCache?.IdSucursal || null;
            let nombreSucursal = usuarioCache?.NombreSucursal || null;
            let direccionSucursal = null;
            let direccionGeneral = usuarioCache?.DireccionGeneral || null;
            let direccionEspecifica = usuarioCache?.DireccionEspecifica || null;

            // ============================================
            // 3. SI FALTA INFO, CONSULTAR PERFIL DEL USUARIO
            // ============================================
            const faltaInfoPerfil = !idSucursal || !direccionGeneral || !direccionEspecifica;

            if (faltaInfoPerfil) {
                try {
                    const rPerfil = await this.service.getPerfilUsuario(marcacion.IdUsuario);
                    if (rPerfil.success && rPerfil.data) {
                        const p = rPerfil.data;
                        idSucursal = idSucursal || p.IdSucursal || null;
                        nombreSucursal = nombreSucursal || p.Sucursal || null;
                        direccionGeneral = direccionGeneral || p.DireccionGeneral || null;
                        direccionEspecifica = direccionEspecifica || p.DireccionEspecifica || null;
                    }
                } catch (e) {
                    console.warn('No se pudo obtener perfil del usuario:', e.message);
                }
            }

            // ============================================
            // 4. OBTENER DIRECCIÓN DE LA SUCURSAL
            // ============================================
            // Primero intenta por ID (más confiable)
            if (idSucursal) {
                try {
                    const rSuc = await this.service.api.get(`/sucursales/${idSucursal}`);
                    if (rSuc.success && rSuc.data) {
                        nombreSucursal = rSuc.data.NombreSucursal || nombreSucursal;
                        direccionSucursal = rSuc.data.Direccion || null;
                    }
                } catch (e) {
                    console.warn('No se pudo obtener sucursal por ID:', e.message);
                }
            }

            // Fallback: buscar por nombre en el listado de sucursales
            if (!direccionSucursal && nombreSucursal) {
                try {
                    const rSucs = await this.service.api.get('/sucursales');
                    if (rSucs.success && rSucs.data) {
                        const encontrada = rSucs.data.find(s =>
                            String(s.NombreSucursal || '').trim().toUpperCase() ===
                            String(nombreSucursal).trim().toUpperCase()
                        );
                        if (encontrada) {
                            direccionSucursal = encontrada.Direccion || null;
                            if (!idSucursal) idSucursal = encontrada.IdSucursal;
                        }
                    }
                } catch (e) {
                    console.warn('No se pudo obtener listado de sucursales:', e.message);
                }
            }

            // ============================================
            // 5. RESULTADO
            // ============================================
            return {
                tipoHorario,
                nombreHorario: horarioCompleto?.Descripcion || 'No encontrado',
                nombreSucursal: nombreSucursal || 'No asignada',
                direccionSucursal: direccionSucursal || 'No registrada',
                direccionGeneral: direccionGeneral || 'No registrada',
                direccionEspecifica: direccionEspecifica || 'No registrada'
            };

        } catch (error) {
            console.error('Error obteniendo info de ubicación:', error);
            return {
                tipoHorario: 'DESCONOCIDO',
                nombreHorario: 'No encontrado',
                nombreSucursal: 'No asignada',
                direccionSucursal: 'No registrada',
                direccionGeneral: 'No registrada',
                direccionEspecifica: 'No registrada'
            };
        }
    }

    _mostrarEvidenciaEnModal(evidencia, campoImagen, campoLat, campoLng, titulo, marcacion, infoUbicacion, tipo) {
        this._limpiarMapa();
        this.ocultarModalCargaEvidencia();

        const modal = document.getElementById('modalEvidencia');
        const tituloEl = document.getElementById('evidenciaTitulo');
        const imgEl = document.getElementById('evidenciaImagen');
        const placeholderImg = document.getElementById('evidenciaImagenPlaceholder');
        const infoEl = document.getElementById('evidenciaInfo');
        const mapaEl = document.getElementById('evidenciaMapa');
        const mapaPlaceholder = document.getElementById('evidenciaMapaPlaceholder');

        if (tituloEl) tituloEl.textContent = titulo;

        const fechaMarcacion = this.formatearFecha(marcacion?.Fecha);
        const base64 = this._normalizarBase64(evidencia[campoImagen]);

        if (base64 && base64.length > 0) {
            let formato = 'jpeg';
            if (base64.startsWith('iVBORw')) formato = 'png';
            else if (base64.startsWith('R0lGZD')) formato = 'gif';
            else if (base64.startsWith('UklGR')) formato = 'webp';

            if (imgEl) { imgEl.src = `data:image/${formato};base64,${base64}`; imgEl.style.display = 'block'; }
            if (placeholderImg) placeholderImg.style.display = 'none';

            const kb = Math.round((base64.length * 3) / 4 / 1024);
            if (infoEl) infoEl.textContent = `📅 ${fechaMarcacion} | ${kb} KB | ${formato.toUpperCase()}`;
        } else {
            if (imgEl) imgEl.style.display = 'none';
            if (placeholderImg) placeholderImg.style.display = 'block';
            if (infoEl) infoEl.textContent = `📅 ${fechaMarcacion} | Sin imagen`;
        }

        const mostrarInfoUbicacion = (tipo === 'ingreso' || tipo === 'salida');
        let infoUbicacionEl = document.getElementById('evidenciaInfoUbicacion');

        if (!mostrarInfoUbicacion) {
            if (infoUbicacionEl) infoUbicacionEl.remove();
            infoUbicacionEl = null;
        } else if (!infoUbicacionEl) {
            infoUbicacionEl = document.createElement('div');
            infoUbicacionEl.id = 'evidenciaInfoUbicacion';
            const mapaContainer = document.getElementById('evidenciaMapaContainer');
            if (mapaContainer) mapaContainer.appendChild(infoUbicacionEl);
        }

        if (mostrarInfoUbicacion && infoUbicacionEl) {
            const tipoHorario = infoUbicacion?.tipoHorario || 'DESCONOCIDO';
            let html = '';

            if (tipoHorario === 'PRESENCIAL') {
                const nombreSucursal = infoUbicacion.nombreSucursal || 'No asignada';
                const direccionSucursal = infoUbicacion.direccionSucursal || 'No registrada';

                html = `
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-weight: 700; color: #CC0000;"><i class="fas fa-building"></i> Sucursal del Usuario:</span>
            <span style="font-weight: 600; color: #1a1a2e;">${this.escapeHtml(nombreSucursal)}</span>
            <span class="badge badge-presencial" style="font-size: 10px; padding: 2px 10px;">PRESENCIAL</span>
        </div>
        <div style="margin-top: 4px; font-size: 12.5px; color: #495057; word-break: break-word;">
            <i class="fas fa-map-marker-alt" style="color: #6c757d; margin-right: 4px;"></i>
            ${this.escapeHtml(direccionSucursal)}
        </div>
        <div style="margin-top: 6px; font-size: 11px; color: #6c757d;">
            <i class="fas fa-info-circle"></i> Verifique que el colaborador haya marcado dentro de esta sucursal.
        </div>`;
            } else if (tipoHorario === 'VIRTUAL') {
                const dirG = infoUbicacion.direccionGeneral || 'No registrada';
                const dirE = infoUbicacion.direccionEspecifica || 'No registrada';
                const tieneG = dirG && dirG !== 'No registrada';
                const tieneE = dirE && dirE !== 'No registrada';
                let dirCombinada = 'No registrada';
                if (tieneG && tieneE) dirCombinada = `${dirG} / ${dirE}`;
                else if (tieneG) dirCombinada = dirG;
                else if (tieneE) dirCombinada = dirE;

                html = `
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="font-weight: 700; color: #CC0000;"><i class="fas fa-home"></i> Dirección del Domicilio del Usuario:</span>
                    <span class="badge badge-virtual" style="font-size: 10px; padding: 2px 10px;">VIRTUAL</span>
                </div>
                <div style="margin-top: 4px; font-weight: 600; color: #1a1a2e; font-size: 13px; word-break: break-word;">
                    ${this.escapeHtml(dirCombinada)}
                </div>
                <div style="margin-top: 5px; font-size: 11px; color: #6c757d;">
                    <i class="fas fa-info-circle"></i> El horario es virtual. Se muestra la dirección registrada del colaborador.
                </div>`;
            } else {
                html = `<div style="color: #6c757d; font-size: 12px;"><i class="fas fa-question-circle"></i> No se pudo determinar el tipo de horario.</div>`;
            }

            infoUbicacionEl.innerHTML = html;
        }

        const lat = campoLat ? evidencia[campoLat] : null;
        const lng = campoLng ? evidencia[campoLng] : null;

        if (lat && lng && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            if (mapaPlaceholder) mapaPlaceholder.style.display = 'none';
            if (mapaEl) { mapaEl.style.display = 'block'; this._inicializarMapa(mapaEl, lat, lng); }
        } else {
            if (mapaEl) mapaEl.style.display = 'none';
            if (mapaPlaceholder) mapaPlaceholder.style.display = 'block';
        }

        if (modal) modal.classList.add('active');
    }

    _limpiarMapa() {
        if (this.mapaEvidencia) {
            try { this.mapaEvidencia.off(); this.mapaEvidencia.remove(); } catch (e) { }
            this.mapaEvidencia = null;
        }
        const el = document.getElementById('evidenciaMapa');
        if (el) { if (el._leaflet_id) delete el._leaflet_id; el.innerHTML = ''; }
    }

    _inicializarMapa(container, lat, lng) {
        container.innerHTML = '';
        if (typeof L === 'undefined') {
            this._cargarLeaflet(() => this._crearMapa(container, lat, lng));
        } else {
            this._crearMapa(container, lat, lng);
        }
    }

    _cargarLeaflet(cb) {
        if (!document.querySelector('#leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }
        if (typeof L === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = cb;
            document.head.appendChild(script);
        } else cb();
    }

    _crearMapa(container, lat, lng) {
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.minHeight = '300px';

        if (this.mapaEvidencia) {
            try { this.mapaEvidencia.off(); this.mapaEvidencia.remove(); } catch (e) { }
            this.mapaEvidencia = null;
        }
        if (container._leaflet_id) { delete container._leaflet_id; container.innerHTML = ''; }

        this.mapaEvidencia = L.map(container).setView([lat, lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap', maxZoom: 19
        }).addTo(this.mapaEvidencia);

        L.marker([lat, lng]).addTo(this.mapaEvidencia)
            .bindPopup(`<strong>📍 Ubicación</strong><br>Lat: ${lat}<br>Lng: ${lng}`).openPopup();

        setTimeout(() => { if (this.mapaEvidencia) this.mapaEvidencia.invalidateSize(); }, 100);
        setTimeout(() => { if (this.mapaEvidencia) this.mapaEvidencia.invalidateSize(); }, 400);
    }

    // ==========================================
    // NOTIFICACIONES DE FALTAS PENDIENTES
    // ==========================================

    /**
     * Carga las faltas pendientes del usuario (ObsGeneral = 'FALTA - JUSTIFICACIÓN PENDIENTE')
     * y actualiza el badge y la lista del modal.
     */
    // ==========================================
    // CARGAR NOTIFICACIONES (faltas + jornadas incompletas)
    // ==========================================
    async _cargarNotificaciones() {
        try {
            if (!this.marcaciones || this.marcaciones.length === 0) {
                this._actualizarBadgeNotificaciones(0);
                return;
            }

            // ============================================
            // 1. FALTAS PENDIENTES DE JUSTIFICAR
            // ============================================
            const faltasPendientes = this.marcaciones.filter(m => {
                if (!this.service.esFalta(m)) return false;
                const obs = String(m.Observacion || m.ObsGeneral || '').toUpperCase();
                return obs.includes('FALTA - JUSTIFICACIÓN PENDIENTE') ||
                    obs.includes('FALTA - JUSTIFICACION PENDIENTE');
            });

            // ============================================
            // 2. JORNADAS INCOMPLETAS SIN JUSTIFICAR
            //    (EstadoJornada = NO CUMPLIDA y ObsJornadaCompleta vacío/null)
            // ============================================
            const jornadasPendientes = this.marcaciones.filter(m => {
                const estadoJornada = String(m.EstadoJornada || '').toUpperCase();
                if (estadoJornada !== 'JORNADA NO CUMPLIDA') return false;

                const obsJornada = String(m.ObsJornadaCompleta || '').trim();
                return obsJornada === ''; // sin justificar
            });

            // ============================================
            // 3. BADGE = suma de ambas
            // ============================================
            const totalNotif = faltasPendientes.length + jornadasPendientes.length;
            this._actualizarBadgeNotificaciones(totalNotif);

            // ============================================
            // 4. GUARDAR EN ESTADO INTERNO
            // ============================================
            this._faltasPendientes = faltasPendientes;
            this._jornadasPendientes = jornadasPendientes;

        } catch (error) {
            console.error('❌ Error cargando notificaciones:', error);
            this._actualizarBadgeNotificaciones(0);
        }
    }

    // ==========================================
    // ACTUALIZAR BADGE DE NOTIFICACIONES
    // ==========================================
    _actualizarBadgeNotificaciones(total) {
        const btn = document.getElementById('btnNotificaciones');
        const badge = document.getElementById('badgeNotificaciones');

        if (badge) {
            if (total > 0) {
                badge.textContent = total;
                badge.style.display = 'flex';
            } else {
                badge.textContent = '0';
                badge.style.display = 'none'; // ocultar badge cuando es 0
            }
        }

        // El botón siempre visible (aunque no haya notif)
        if (btn) {
            btn.style.display = 'inline-flex';
        }
    }

    // ==========================================
    // ABRIR MODAL DE NOTIFICACIONES
    // ==========================================
    // ==========================================
    // ABRIR MODAL DE NOTIFICACIONES
    // ==========================================
    async abrirModalNotificaciones() {
        const modal = document.getElementById('modalNotificaciones');
        if (!modal) return;

        // Asegurar que las notificaciones estén cargadas
        if (!this._faltasPendientes || !this._jornadasPendientes) {
            await this._cargarNotificaciones();
        }

        // Renderizar ambas listas
        this._renderizarFaltasPendientes();
        this._renderizarJornadasPendientes();

        // Actualizar badges de las tabs
        this._actualizarBadgesTabs();

        // Configurar eventos de tabs (solo una vez)
        this._configurarTabsNotificaciones();

        // Mostrar la tab de faltas por defecto
        this._activarTabNotificaciones('faltas');

        // Abrir modal
        modal.classList.add('active');
    }

    // ==========================================
    // CONFIGURAR EVENTOS DE LAS TABS
    // ==========================================
    _configurarTabsNotificaciones() {
        const tabFaltas = document.getElementById('tabFaltas');
        const tabJornadas = document.getElementById('tabJornadas');

        if (tabFaltas && !tabFaltas._listenerAdded) {
            tabFaltas.addEventListener('click', () => this._activarTabNotificaciones('faltas'));
            tabFaltas._listenerAdded = true;
        }
        if (tabJornadas && !tabJornadas._listenerAdded) {
            tabJornadas.addEventListener('click', () => this._activarTabNotificaciones('jornadas'));
            tabJornadas._listenerAdded = true;
        }
    }

    // ==========================================
    // CAMBIAR ENTRE TABS
    // ==========================================
    _activarTabNotificaciones(seccion) {
        const tabFaltas = document.getElementById('tabFaltas');
        const tabJornadas = document.getElementById('tabJornadas');
        const panelFaltas = document.getElementById('panelFaltas');
        const panelJornadas = document.getElementById('panelJornadas');

        if (!tabFaltas || !tabJornadas || !panelFaltas || !panelJornadas) return;

        if (seccion === 'faltas') {
            tabFaltas.classList.add('active');
            tabJornadas.classList.remove('active');
            panelFaltas.style.display = 'block';
            panelJornadas.style.display = 'none';
        } else {
            tabJornadas.classList.add('active');
            tabFaltas.classList.remove('active');
            panelFaltas.style.display = 'none';
            panelJornadas.style.display = 'block';
        }
    }

    // ==========================================
    // ACTUALIZAR BADGES DE LAS TABS
    // ==========================================
    _actualizarBadgesTabs() {
        const badgeFaltas = document.getElementById('tabBadgeFaltas');
        const badgeJornadas = document.getElementById('tabBadgeJornadas');

        const totalFaltas = (this._faltasPendientes || []).length;
        const totalJornadas = (this._jornadasPendientes || []).length;

        if (badgeFaltas) {
            badgeFaltas.textContent = totalFaltas;
            badgeFaltas.dataset.count = totalFaltas;
            badgeFaltas.style.display = totalFaltas > 0 ? 'inline-flex' : 'none';
        }

        if (badgeJornadas) {
            badgeJornadas.textContent = totalJornadas;
            badgeJornadas.dataset.count = totalJornadas;
            badgeJornadas.style.display = totalJornadas > 0 ? 'inline-flex' : 'none';
        }
    }

    // ==========================================
    // RENDERIZAR FALTAS PENDIENTES EN EL MODAL
    // ==========================================
    // ==========================================
    // RENDERIZAR FALTAS PENDIENTES
    // ==========================================
    _renderizarFaltasPendientes() {
        const contador = document.getElementById('notifContadorFaltas');
        const lista = document.getElementById('notifListaFaltas');
        if (!contador || !lista) return;

        const faltas = this._faltasPendientes || [];

        const txt = faltas.length === 1
            ? '1 falta pendiente'
            : `${faltas.length} faltas pendientes`;
        contador.textContent = txt;

        if (faltas.length === 0) {
            lista.innerHTML = `
            <div class="notif-vacio" style="padding: 30px 20px;">
                <i class="fas fa-check-circle"></i>
                <p>No tienes faltas pendientes de justificar</p>
            </div>
        `;
            return;
        }

        lista.innerHTML = '';
        faltas.forEach(m => {
            const item = document.createElement('div');
            item.className = 'notif-item no-leido';
            item.dataset.id = m.IdCHMarcacion;

            const fechaFormateada = this.formatearFecha(m.Fecha);

            item.innerHTML = `
            <div class="notif-avatar">
                <i class="fas fa-user-times"></i>
            </div>
            <div class="notif-contenido">
                <div class="notif-header-row">
                    <h4 class="notif-titulo">Falta pendiente de justificar</h4>
                    <span class="notif-fecha">${fechaFormateada}</span>
                </div>
                <p class="notif-descripcion">
                    Tienes una falta registrada el <strong>${fechaFormateada}</strong>
                    que requiere justificación. Haz clic para revisarla y subir tu evidencia.
                </p>
                <div class="notif-accion">
                    <i class="fas fa-arrow-right"></i> Justificar ahora
                </div>
            </div>
        `;

            item.addEventListener('click', () => {
                this.cerrarModalNotificaciones();
                this.abrirModalDetalleObservaciones(m.IdCHMarcacion);
            });

            lista.appendChild(item);
        });
    }

    // ==========================================
    // RENDERIZAR JORNADAS INCOMPLETAS PENDIENTES
    // ==========================================
    _renderizarJornadasPendientes() {
        const contador = document.getElementById('notifContadorJornadas');
        const lista = document.getElementById('notifListaJornadas');
        if (!contador || !lista) return;

        const jornadas = this._jornadasPendientes || [];

        const txt = jornadas.length === 1
            ? '1 jornada incompleta sin justificar'
            : `${jornadas.length} jornadas incompletas sin justificar`;
        contador.textContent = txt;

        if (jornadas.length === 0) {
            lista.innerHTML = `
            <div class="notif-vacio" style="padding: 30px 20px;">
                <i class="fas fa-check-circle"></i>
                <p>No tienes jornadas incompletas pendientes</p>
            </div>
        `;
            return;
        }

        lista.innerHTML = '';
        jornadas.forEach(m => {
            const item = document.createElement('div');
            item.className = 'notif-item notif-item-jornada no-leido';
            item.dataset.id = m.IdCHMarcacion;

            const fechaFormateada = this.formatearFecha(m.Fecha);

            item.innerHTML = `
            <div class="notif-avatar">
                <i class="fas fa-clipboard-check"></i>
            </div>
            <div class="notif-contenido">
                <div class="notif-header-row">
                    <h4 class="notif-titulo">Jornada incompleta sin justificar</h4>
                    <span class="notif-fecha">${fechaFormateada}</span>
                </div>
                <p class="notif-descripcion">
                    El <strong>${fechaFormateada}</strong> no completaste tu jornada.
                    Justifícala con un motivo y adjunta tu evidencia.
                </p>
                <div class="notif-accion">
                    <i class="fas fa-arrow-right"></i> Justificar jornada
                </div>
            </div>
        `;

            // ✅ FIX: al hacer clic, abrir modal de detalle + modal de edición de jornada
            item.addEventListener('click', () => {
                this.cerrarModalNotificaciones();
                this._abrirJornadaDesdeNotificacion(m.IdCHMarcacion);
            });

            lista.appendChild(item);
        });
    }

    // ==========================================
    // ✅ NUEVO: ABRIR JORNADA DESDE NOTIFICACIÓN
    // Abre el detalle y, tras un pequeño delay,
    // abre directamente el modal de edición de jornada.
    // ==========================================
    async _abrirJornadaDesdeNotificacion(idMarcacion) {
        try {
            // 1. Buscar la marcación
            const marcacion = this.marcaciones.find(m => m.IdCHMarcacion === idMarcacion);
            if (!marcacion) {
                this.mostrarMensaje('Marcación no encontrada', 'error');
                return;
            }

            // 2. Abrir modal de detalle
            await this.abrirModalDetalleObservaciones(idMarcacion);

            // 3. Esperar un tick para que el modal de detalle se pinte
            await new Promise(resolve => setTimeout(resolve, 200));

            // 4. Abrir el modal de edición de jornada
            //    (solo si la marcación tiene jornada no cumplida y obs vacía)
            const estadoJornada = String(marcacion.EstadoJornada || '').toUpperCase();
            const obsJornada = String(marcacion.ObsJornadaCompleta || '').trim();

            if (estadoJornada === 'JORNADA NO CUMPLIDA' && obsJornada === '') {
                this.abrirModalEditarObservacion(marcacion, 'jornadaCompleta');
            } else {
                // Si ya no aplica (por alguna razón), solo dejar el detalle abierto
                console.log('ℹ️ La jornada ya no requiere edición (puede haber sido justificada)');
            }

        } catch (error) {
            console.error('❌ Error abriendo jornada desde notificación:', error);
            this.mostrarMensaje('Error al abrir la jornada', 'error');
        }
    }

    // ==========================================
    // CERRAR MODAL DE NOTIFICACIONES
    // ==========================================
    cerrarModalNotificaciones() {
        const modal = document.getElementById('modalNotificaciones');
        if (modal) modal.classList.remove('active');
    }

    /**
     * Renderiza la lista de faltas pendientes estilo Gmail.
     */
    _renderizarNotificaciones() {
        const lista = document.getElementById('notifLista');
        const contadorTexto = document.getElementById('notifContadorTexto');
        if (!lista) return;

        const total = this.notificaciones.length;

        // Actualizar contador
        if (contadorTexto) {
            contadorTexto.textContent = total === 1
                ? '1 falta pendiente de justificar'
                : `${total} faltas pendientes de justificar`;
        }

        // Estado vacío
        if (total === 0) {
            lista.innerHTML = `
            <div class="notif-vacio">
                <i class="fas fa-check-circle"></i>
                <p><strong>¡Todo en orden!</strong></p>
                <p style="margin-top: 8px;">No tienes faltas pendientes de justificar.</p>
            </div>
        `;
            return;
        }

        // Renderizar lista
        lista.innerHTML = '';
        this.notificaciones.forEach(marcacion => {
            const item = document.createElement('div');
            item.className = 'notif-item no-leido';
            item.dataset.id = marcacion.IdCHMarcacion;

            const fechaFormateada = this.formatearFecha(marcacion.Fecha);

            item.innerHTML = `
            <div class="notif-avatar">
                <i class="fas fa-user-times"></i>
            </div>
            <div class="notif-contenido">
                <div class="notif-header-row">
                    <span class="notif-titulo">Falta Pendiente de Justificar</span>
                    <span class="notif-fecha">${fechaFormateada}</span>
                </div>
                <p class="notif-descripcion">
                    Se registró una <strong>falta</strong> el ${fechaFormateada}.
                    Debes justificarla y subir una evidencia para que sea considerada válida.
                </p>
                <div class="notif-accion">
                    <i class="fas fa-arrow-right"></i>
                    Haga clic aquí para justificar
                </div>
            </div>
        `;

            item.onclick = () => this._abrirJustificacionDesdeNotificacion(marcacion.IdCHMarcacion);

            lista.appendChild(item);
        });
    }

    /**
     * Abre el modal de edición de observación directamente desde una notificación.
     */
    async _abrirJustificacionDesdeNotificacion(idMarcacion) {
        this.cerrarModalNotificaciones();

        // Buscar la marcación actualizada
        const marcacion = this.marcaciones.find(m => m.IdCHMarcacion === idMarcacion);
        if (!marcacion) {
            this.mostrarMensaje('Marcación no encontrada', 'warning');
            return;
        }

        // Abrir modal de detalle primero (para tener contexto)
        await this.abrirModalDetalleObservaciones(idMarcacion);

        // Abrir modal de edición de observación de FALTA
        setTimeout(() => {
            this.abrirModalEditarObservacion(marcacion, 'observacion');
        }, 300);
    }

    // ------------------------------------------
    // MÉTODOS DE CÁLCULO DE TARDANZAS
    // ------------------------------------------
    _calcularTardanzas(marcacion, asignacionesMap) {
        const asignacion = asignacionesMap.get(marcacion.IdControlHorarioSys);
        if (!asignacion) return null;

        const usuario = this.usuarios.find(u => u.IdUsuario === marcacion.IdUsuario);
        let nombreArea = 'Sin área', estadoUsuario = 'Desconocido';
        if (usuario) {
            if (usuario.IdArea && this.areasCache) {
                const area = this.areasCache.find(a => a.IdArea === usuario.IdArea);
                nombreArea = area ? area.Descripcion : 'Sin área';
            }
            estadoUsuario = usuario.IdEstado === 1 ? 'Activo' : 'Inactivo';
        }

        const ingresoAsignacion = asignacion.IngEsperado || '';
        const ingresoReal = marcacion.IngresoReal || '';
        const minutosTardanzaIngreso = this._calcularDiferenciaMinutos(ingresoAsignacion, ingresoReal);

        const ingresoAlmuerzoReal = marcacion.IngAlmuerzo || '';
        const salidaAlmuerzoReal = marcacion.SalAlmuerzo || '';
        let minutosTardanzaSalAlmuerzo = 0;
        let tieneMarcacionSalidaAlmuerzo = false;

        if (salidaAlmuerzoReal && salidaAlmuerzoReal !== '--:--') {
            tieneMarcacionSalidaAlmuerzo = true;
            if (ingresoAlmuerzoReal && ingresoAlmuerzoReal !== '--:--') {
                const mIA = this._horaAMinutos(ingresoAlmuerzoReal);
                const mSA = this._horaAMinutos(salidaAlmuerzoReal);
                if (mIA !== null && mSA !== null) {
                    const dif = mSA - mIA;
                    if (dif > 60) minutosTardanzaSalAlmuerzo = dif - 60;
                }
            }
        }

        const obsGeneral = marcacion.Observacion || '';
        const obsIngAlm = marcacion.ObsIngresoAlmuerzo || '';
        const obsSalAlm = marcacion.ObsSalidaAlmuerzo || '';

        const tieneMarcacionIngreso = ingresoReal && ingresoReal !== '--:--';
        const motivoDescuentoTardanza = this._determinarMotivoDescuento(obsGeneral, 'TARDANZA', tieneMarcacionIngreso);
        const descuentoTardanzaAplicado = this._debeAplicarDescuento(motivoDescuentoTardanza);

        const obsAlmCombinada = `${obsIngAlm} ${obsSalAlm}`.trim();
        const motivoDescuentoExceso = this._determinarMotivoDescuento(obsAlmCombinada, 'EXCESO', tieneMarcacionSalidaAlmuerzo);
        const descuentoExcesoAplicado = this._debeAplicarDescuento(motivoDescuentoExceso);

        const totalMinutosTardanza = minutosTardanzaIngreso + minutosTardanzaSalAlmuerzo;
        const minutosConDesc = (descuentoTardanzaAplicado ? minutosTardanzaIngreso : 0) + (descuentoExcesoAplicado ? minutosTardanzaSalAlmuerzo : 0);

        const extraerHora = (v) => {
            if (!v) return '';
            if (typeof v === 'string' && v.includes('T')) { const m = v.match(/T(\d{2}):(\d{2})/); if (m) return `${m[1]}:${m[2]}`; }
            if (typeof v === 'string' && /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v)) return v;
            try { const d = new Date(v); if (!isNaN(d.getTime())) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; } catch (e) { }
            return v || '';
        };

        const ingresoAsignado = extraerHora(asignacion.IngEsperado || '');
        const salidaAsignado = extraerHora(asignacion.SalEsperada || '');
        const ingresoAlAsignado = extraerHora(asignacion.IngAlmuerzoEsperado || '');
        const salidaAlAsignado = extraerHora(asignacion.SalAlmuerzoEsperado || '');

        const horasProgramadas = this._calcularHorasProgramadasSemanales(marcacion.IdUsuario, marcacion.Fecha, asignacionesMap);
        const sueldo = this._obtenerSueldoUsuario(marcacion.IdUsuario);
        const tieneSueldoValido = sueldo !== null && sueldo > 0;

        let pagoPorHora = 0, pagoPorMinuto = 0, descTardanza = 0, descAdicAlmuerzo = 0, totalDescuento = 0;
        if (tieneSueldoValido && horasProgramadas > 0) {
            pagoPorHora = sueldo / horasProgramadas;
            pagoPorMinuto = pagoPorHora / 60;
            if (descuentoTardanzaAplicado) descTardanza = pagoPorMinuto * minutosTardanzaIngreso;
            if (descuentoExcesoAplicado) descAdicAlmuerzo = pagoPorMinuto * minutosTardanzaSalAlmuerzo;
            totalDescuento = descTardanza + descAdicAlmuerzo;
        }

        return {
            IdCHMarcacion: marcacion.IdCHMarcacion,
            IdUsuario: marcacion.IdUsuario,
            Area: nombreArea,
            EstadoUsuario: estadoUsuario,
            Fecha: marcacion.Fecha,
            IngresoReal: ingresoReal,
            MinutosTardanzaIngreso: minutosTardanzaIngreso,
            IngAlmuerzoReal: ingresoAlmuerzoReal,
            SalAlmuerzoReal: salidaAlmuerzoReal,
            MinutosTardanzaSalAlmuerzo: minutosTardanzaSalAlmuerzo,
            IngresoAsignado: ingresoAsignado,
            SalidaAsignado: salidaAsignado,
            IngresoAlAsignado: ingresoAlAsignado,
            SalidaAlAsignado: salidaAlAsignado,
            TotalMinutosTardanza: totalMinutosTardanza,
            TotalMinutosConDescuento: minutosConDesc,
            HorasProgramadas: horasProgramadas,
            Sueldo: sueldo,
            TieneSueldoValido: tieneSueldoValido,
            PagoPorHora: pagoPorHora,
            PagoPorMinuto: pagoPorMinuto,
            MotivoDescuentoTardanza: motivoDescuentoTardanza,
            MotivoDescuentoExceso: motivoDescuentoExceso,
            DescuentoTardanzaAplicado: descuentoTardanzaAplicado,
            DescuentoExcesoAplicado: descuentoExcesoAplicado,
            DescTardanza: descTardanza,
            DescAdicAlmuerzo: descAdicAlmuerzo,
            TotalDescuento: totalDescuento
        };
    }

    _determinarMotivoDescuento(observacion, tipo, tieneMarcacion = true) {
        if (!tieneMarcacion) return 'SIN OBSERVACIÓN';
        if (!observacion || observacion.trim() === '') return 'SIN OBSERVACIÓN';
        const u = observacion.toUpperCase().trim();

        if (u.includes('JUSTIFICACIÓN NO VÁLIDA') || u.includes('JUSTIFICACION NO VALIDA')) return 'JUST. NO VÁLIDA';

        if (tipo === 'TARDANZA') {
            if (u.includes('TARDANZA JUSTIFICADA')) return 'FUE JUSTIFICADO';
            if (u.includes('TARDANZA NO JUSTIFICADA') || u.includes('TARDANZA NO JUSTIFICA')) return 'NO FUE JUSTIFICADO';
        }
        if (tipo === 'EXCESO') {
            if (u.includes('EXCESO JUSTIFICADO')) return 'FUE JUSTIFICADO';
            if (u.includes('EXCESO NO JUSTIFICADO') || u.includes('EXCESO NO JUSTIFICA')) return 'NO FUE JUSTIFICADO';
        }

        if (u.includes('JUSTIFICADA') || u.includes('JUSTIFICADO')) {
            if (tipo === 'TARDANZA' && u.includes('TARDANZA')) return 'FUE JUSTIFICADO';
            if (tipo === 'EXCESO' && u.includes('EXCESO')) return 'FUE JUSTIFICADO';
            return 'NO FUE JUSTIFICADO';
        }
        return 'NO FUE JUSTIFICADO';
    }

    _debeAplicarDescuento(motivo) {
        return motivo === 'NO FUE JUSTIFICADO' || motivo === 'JUST. NO VÁLIDA';
    }

    _obtenerColorMotivo(motivo) {
        switch (motivo) {
            case 'FUE JUSTIFICADO': return '#28a745';
            case 'NO FUE JUSTIFICADO': return '#dc3545';
            case 'JUST. NO VÁLIDA': return '#ffc107';
            case 'SIN OBSERVACIÓN': return '#6c757d';
            default: return '#6c757d';
        }
    }

    _obtenerIconoMotivo(motivo) { return ''; }

    _calcularHorasProgramadasSemanales(idUsuario, fecha, asignacionesMap) {
        if (!idUsuario || !fecha) return 0;

        let fechaObj;
        if (typeof fecha === 'string') {
            const m = fecha.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (m) fechaObj = new Date(Date.UTC(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])));
            else fechaObj = new Date(fecha);
        } else fechaObj = new Date(fecha);
        if (isNaN(fechaObj.getTime())) return 0;

        const diaSemana = fechaObj.getUTCDay();
        const diasParaLunes = diaSemana === 0 ? 6 : diaSemana - 1;
        const inicioSemana = new Date(Date.UTC(fechaObj.getUTCFullYear(), fechaObj.getUTCMonth(), fechaObj.getUTCDate() - diasParaLunes));
        const finSemana = new Date(Date.UTC(inicioSemana.getUTCFullYear(), inicioSemana.getUTCMonth(), inicioSemana.getUTCDate() + 5));

        const fmt = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        const inicioStr = fmt(inicioSemana);
        const finStr = fmt(finSemana);

        const asigsSemana = [];
        for (const [, a] of asignacionesMap) {
            if (a.IdUsuario != idUsuario || !a.Fecha) continue;
            let fStr;
            if (typeof a.Fecha === 'string') {
                const mm = a.Fecha.match(/(\d{4})-(\d{2})-(\d{2})/);
                if (mm) fStr = `${mm[1]}-${mm[2]}-${mm[3]}`;
                else { const d = new Date(a.Fecha); if (isNaN(d.getTime())) continue; fStr = fmt(d); }
            } else { const d = new Date(a.Fecha); if (isNaN(d.getTime())) continue; fStr = fmt(d); }
            if (fStr >= inicioStr && fStr <= finStr) asigsSemana.push(a);
        }

        if (asigsSemana.length === 0) return 0;

        const horasPorDia = new Map();
        for (const a of asigsSemana) {
            let fA;
            if (typeof a.Fecha === 'string') {
                const mm = a.Fecha.match(/(\d{4})-(\d{2})-(\d{2})/);
                if (mm) fA = new Date(Date.UTC(parseInt(mm[1]), parseInt(mm[2]) - 1, parseInt(mm[3])));
                else fA = new Date(a.Fecha);
            } else fA = new Date(a.Fecha);
            if (isNaN(fA.getTime())) continue;
            const dia = fA.getUTCDay();
            const idx = dia === 0 ? 6 : dia - 1;
            if (idx >= 6) continue;
            const h = this.horariosCache?.find(x => x.IdHorario == a.IdHorario);
            if (h && h.TiempoHoras) horasPorDia.set(idx, parseFloat(h.TiempoHoras));
        }

        const dias = Array.from(horasPorDia.keys()).sort((a, b) => a - b);
        const primerHorario = dias.length > 0 ? horasPorDia.get(dias[0]) : null;
        if (primerHorario === null) return 0;

        let total = 0;
        for (let i = 0; i < 6; i++) {
            total += horasPorDia.has(i) ? horasPorDia.get(i) : primerHorario;
        }
        return total;
    }

    _actualizarTotalesMensuales(datos) {
        const elMin = document.getElementById('totalMinutosMensual');
        const elApl = document.getElementById('totalDescuentoAplicado');
        const elBase = document.getElementById('totalDescuentoBase');

        const mesSel = document.getElementById('filtroTardanzaMes')?.value;
        const anioSel = document.getElementById('filtroTardanzaAnio')?.value;

        if ((!mesSel || mesSel === '') && anioSel) {
            if (elMin) elMin.textContent = '---';
            if (elApl) elApl.textContent = '---';
            if (elBase) elBase.textContent = '---';
            return;
        }

        if (!datos || datos.length === 0) {
            if (elMin) elMin.textContent = '0 min';
            if (elApl) elApl.textContent = 'S/ 0.00';
            if (elBase) elBase.textContent = 'S/ 0.00';
            return;
        }

        const usuariosMap = new Map();
        for (const d of datos) {
            if (!usuariosMap.has(d.IdUsuario)) usuariosMap.set(d.IdUsuario, { minutos: 0, descuento: 0 });
            const u = usuariosMap.get(d.IdUsuario);
            u.minutos += d.TotalMinutosTardanza || 0;
            u.descuento += d.TotalDescuento || 0;
        }

        let totalMin = 0, totalApl = 0, totalBase = 0;
        for (const [, v] of usuariosMap) {
            totalMin += v.minutos;
            totalBase += v.descuento;
            totalApl += (v.minutos > 120) ? v.descuento * 5 : v.descuento;
        }

        if (elMin) elMin.textContent = this._formatearMinutos(totalMin);
        if (elApl) elApl.textContent = `S/ ${totalApl.toFixed(2)}`;
        if (elBase) elBase.textContent = `S/ ${totalBase.toFixed(2)}`;
    }

    _calcularDiferenciaMinutos(esperada, real) {
        if (!esperada || !real) return 0;
        const h1 = this._horaAMinutos(esperada);
        const h2 = this._horaAMinutos(real);
        if (h1 === null || h2 === null) return 0;
        return Math.max(0, h2 - h1);
    }

    _horaAMinutos(hora) {
        if (!hora) return null;
        const s = String(hora).trim();
        if (s.includes('T')) { const m = s.match(/T(\d{2}):(\d{2})/); if (m) return parseInt(m[1]) * 60 + parseInt(m[2]); }
        if (/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(s)) { const p = s.split(':'); return parseInt(p[0]) * 60 + parseInt(p[1]); }
        if (/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(s)) { const p = s.split(':'); return parseInt(p[0]) * 60 + parseInt(p[1]); }
        if (/^([0-9]):[0-5][0-9]$/.test(s)) { const p = s.split(':'); return parseInt(p[0]) * 60 + parseInt(p[1]); }
        return null;
    }

    _sumarMinutosAHora(hora, minutos) {
        if (!hora) return '';
        const t = this._horaAMinutos(hora);
        if (t === null) return '';
        const n = t + minutos;
        return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
    }

    _formatearMinutos(minutos) {
        if (!minutos || minutos <= 0) return '0 min / 0 min';
        let fmt = minutos < 60 ? `${minutos} min` : (minutos % 60 === 0 ? `${Math.floor(minutos / 60)} h` : `${Math.floor(minutos / 60)} h ${minutos % 60} min`);
        return `${fmt} / ${minutos} min`;
    }

    _obtenerSueldoUsuario(idUsuario) {
        // Opción B: sin sueldo → S/ 0.00
        return null;
    }

    renderizarTablaTardanzas() {
        const tbody = document.getElementById('tablaTardanzasBody');
        if (!tbody) return;
        const inicio = (this.paginaTardanzas - 1) * this.registrosPorPagina;
        const fin = Math.min(inicio + this.registrosPorPagina, this.datosTardanzas.length);
        const pagina = this.datosTardanzas.slice(inicio, fin);

        if (pagina.length === 0) {
            tbody.innerHTML = '<tr><td colspan="25" class="loading">No hay registros</td></tr>';
            this._actualizarTotalesMensuales(this.datosTardanzas);
            return;
        }

        tbody.innerHTML = '';
        pagina.forEach(d => {
            const row = document.createElement('tr');
            const nombre = this.obtenerNombreUsuario(d.IdUsuario);
            const color = (m) => m === 0 ? '#28a745' : m <= 15 ? '#ffc107' : m <= 30 ? '#fd7e14' : '#dc3545';
            const money = (v) => `S/ ${(v || 0).toFixed(2)}`;

            row.innerHTML = `
            <td>${d.IdCHMarcacion}</td>
            <td>${this.escapeHtml(nombre)}</td>
            <td>${this.escapeHtml(d.Area || '--')}</td>
            <td><span class="${d.EstadoUsuario === 'Activo' ? 'badge-success' : 'badge-danger'}" style="font-size:10px;padding:2px 10px;border-radius:12px;">${d.EstadoUsuario}</span></td>
            <td>${this.formatearFecha(d.Fecha)}</td>
            <td>${d.IngresoReal || '--:--'}</td>
            <td style="font-weight:600;color:${color(d.MinutosTardanzaIngreso)};font-size:11px;">${this._formatearMinutos(d.MinutosTardanzaIngreso)}</td>
            <td>${d.IngAlmuerzoReal || '--:--'}</td>
            <td>${d.SalAlmuerzoReal || '--:--'}</td>
            <td style="font-weight:600;color:${color(d.MinutosTardanzaSalAlmuerzo)};font-size:11px;">${this._formatearMinutos(d.MinutosTardanzaSalAlmuerzo)}</td>
            <td>${d.IngresoAsignado || '--:--'}</td>
            <td>${d.SalidaAsignado || '--:--'}</td>
            <td>${d.IngresoAlAsignado || '--:--'}</td>
            <td>${d.SalidaAlAsignado || '--:--'}</td>
            <td style="font-weight:700;color:${color(d.TotalMinutosTardanza)};font-size:11px;text-align:center;">${this._formatearMinutos(d.TotalMinutosTardanza)}</td>
            <td style="font-weight:700;color:${color(d.TotalMinutosConDescuento)};font-size:11px;text-align:center;">${this._formatearMinutos(d.TotalMinutosConDescuento)}</td>
            <td style="font-weight:600;">${d.HorasProgramadas.toFixed(1)} h</td>
            <td>${d.TieneSueldoValido ? money(d.Sueldo) : 'S/ 0.00'}</td>
            <td>${d.TieneSueldoValido ? money(d.PagoPorHora) : 'S/ 0.00'}</td>
            <td>${d.TieneSueldoValido ? money(d.PagoPorMinuto) : 'S/ 0.00'}</td>
            <td style="font-weight:600;color:${this._obtenerColorMotivo(d.MotivoDescuentoTardanza)};font-size:11px;text-align:center;">${d.MotivoDescuentoTardanza || 'SIN OBSERVACIÓN'}</td>
            <td style="text-align:center;">${d.DescuentoTardanzaAplicado && d.TieneSueldoValido ? money(d.DescTardanza) : 'S/ 0.00'}</td>
            <td style="font-weight:600;color:${this._obtenerColorMotivo(d.MotivoDescuentoExceso)};font-size:11px;text-align:center;">${d.MotivoDescuentoExceso || 'SIN OBSERVACIÓN'}</td>
            <td style="text-align:center;">${d.DescuentoExcesoAplicado && d.TieneSueldoValido ? money(d.DescAdicAlmuerzo) : 'S/ 0.00'}</td>
            <td style="font-weight:700;color:${d.TieneSueldoValido ? '#dc3545' : '#6c757d'};text-align:center;">${d.TieneSueldoValido ? money(d.TotalDescuento) : 'S/ 0.00'}</td>
        `;
            tbody.appendChild(row);
        });

        this._actualizarTotalesMensuales(this.datosTardanzas);
    }

    actualizarPaginacionTardanzas() {
        const total = this.datosTardanzas?.length || 0;
        const inicio = (this.paginaTardanzas - 1) * this.registrosPorPagina + 1;
        const fin = Math.min(inicio + this.registrosPorPagina - 1, total);
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('inicioTardanzas', total > 0 ? inicio : 0);
        set('finTardanzas', total > 0 ? fin : 0);
        set('totalTardanzas', total);
        set('paginaTardanzasInfo', `Página ${this.paginaTardanzas} de ${this.totalPaginasTardanzas}`);
        const d = (id, v) => { const el = document.getElementById(id); if (el) el.disabled = v; };
        d('btnTardanzasPrimera', this.paginaTardanzas === 1);
        d('btnTardanzasAnterior', this.paginaTardanzas === 1);
        d('btnTardanzasSiguiente', this.paginaTardanzas === this.totalPaginasTardanzas);
        d('btnTardanzasUltima', this.paginaTardanzas === this.totalPaginasTardanzas);
    }

    irPrimeraPaginaTardanzas() { if (this.paginaTardanzas > 1) { this.paginaTardanzas = 1; this.renderizarTablaTardanzas(); this.actualizarPaginacionTardanzas(); } }
    irPaginaAnteriorTardanzas() { if (this.paginaTardanzas > 1) { this.paginaTardanzas--; this.renderizarTablaTardanzas(); this.actualizarPaginacionTardanzas(); } }
    irPaginaSiguienteTardanzas() { if (this.paginaTardanzas < this.totalPaginasTardanzas) { this.paginaTardanzas++; this.renderizarTablaTardanzas(); this.actualizarPaginacionTardanzas(); } }
    irUltimaPaginaTardanzas() { if (this.paginaTardanzas < this.totalPaginasTardanzas) { this.paginaTardanzas = this.totalPaginasTardanzas; this.renderizarTablaTardanzas(); this.actualizarPaginacionTardanzas(); } }

}

// ============================================
// EXPOSICIÓN GLOBAL
// ============================================
if (typeof window !== 'undefined') {
    window.HistorialMarcacionesController = HistorialMarcacionesController;
}