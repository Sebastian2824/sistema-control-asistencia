// ==============================================
// CONTROLLER: AsignacionController
// Módulo "Asignación de Horarios"
// Depende de: AuthService, AsignacionService,
//             RegistroMasivoController, VerNoLaborablesController,
//             NoLaborableMasivoController
// ==============================================

const OPTIMIZACION_ASIGNACION = {
    REGISTROS_POR_PAGINA: 10
};

class AsignacionController {

    constructor(authService, asignacionService, config) {
        this.auth = authService;
        this.asignacionService = asignacionService;
        this.config = config || {};

        this.usuarioActual = null;
        this.asignaciones = [];
        this.todasAsignaciones = [];
        this.asignacionesFiltradas = [];
        this.usuarios = [];
        this.horarios = [];
        this.estados = [];
        this.marcacionesExistentes = [];
        this.asignacionAEliminar = null;
        this.asignacionARestaurar = null;
        this.calendario = null;

        this.cargando = false;
        this.guardando = false;
        this.verificando = false;

        // Paginación
        this.paginaActual = 1;
        this.registrosPorPagina = OPTIMIZACION_ASIGNACION.REGISTROS_POR_PAGINA;
        this.totalPaginas = 1;

        // Eliminados (restaurar)
        this.asignacionesEliminadas = [];
        this.asignacionesEliminadasPaginaActual = 1;
        this.asignacionesEliminadasRegistrosPorPagina = 5;
        this.asignacionesEliminadasTotalPaginas = 1;

        // Eliminación con cuenta regresiva
        this.countdownInterval = null;
        this.countdownValue = 10;

        // Sub-controllers
        this.registroMasivoController = null;
        this.verNoLaborablesController = null;
        this.noLaborableMasivoController = null;

        this._cachearDOM();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    // ==========================================
    // INIT
    // ==========================================
    async init() {
        console.log('🔧 Inicializando AsignacionController...');

        if (!this.auth || !this.auth.verificarSesion()) {
            this.redirigirALogin();
            return;
        }
        this.usuarioActual = this.auth.getUsuarioLogueado();
        if (!this.usuarioActual?.IdUsuario) {
            this.redirigirALogin();
            return;
        }

        const rol = String(this.usuarioActual.rol || this.usuarioActual.Rol || '').toUpperCase().trim();
        if (rol !== 'ADMINISTRADOR') {
            this.mostrarMensaje('Acceso denegado. Se requiere rol de administrador.', 'error');
            setTimeout(() => this.irAlMenu(), 1500);
            return;
        }

        this.actualizarHeaderConSesion();
        this.configurarEventos();
        this.crearControlesPaginacion();

        this.inicializarSubControllers();

        await this.cargarDatosIniciales();

        this.auth.prevenirNavegacionAtras();

        console.log('✅ AsignacionController inicializado');
    }

    _cachearDOM() {
        // Header
        this.userMenu = document.getElementById('userMenu');
        this.userNameDisplay = document.getElementById('displayUserName');
        this.userRoleDisplay = document.getElementById('displayUserRole');
        this.dropdownUserName = document.getElementById('dropdownUserName');
        this.dropdownUserEmail = document.getElementById('dropdownUserEmail');
        this.dropdownUserRole = document.getElementById('dropdownUserRole');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.menuBtn = document.getElementById('menuBtn');
        this.perfilBtn = document.getElementById('perfilBtn');
        this.logoArea = document.getElementById('logoArea');

        // Toolbar
        this.btnCalendario = document.getElementById('btnCalendario');
        this.btnExportarExcel = document.getElementById('btnExportarExcel');
        this.btnAsignacionGrupal = document.getElementById('btnAsignacionGrupal');
        this.btnRegistroMasivo = document.getElementById('btnRegistroMasivo');
        this.btnVerNoLaborables = document.getElementById('btnVerNoLaborables');
        this.btnRestaurarAsignaciones = document.getElementById('btnRestaurarAsignaciones');
        this.btnNoLaborable = document.getElementById('btnNoLaborable');
        this.btnNoLaborableMasivo = document.getElementById('btnNoLaborableMasivo');

        // Filtros
        this.filtroFechaEspecifica = document.getElementById('filtroFechaEspecifica');
        this.filtroUsuario = document.getElementById('filtroUsuario');
        this.filtroHorario = document.getElementById('filtroHorario');
        this.filtroFechaDesde = document.getElementById('filtroFechaDesde');
        this.filtroFechaHasta = document.getElementById('filtroFechaHasta');
        this.btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');

        // Tabla principal
        this.tablaBody = document.getElementById('tablaAsignacionesBody');

        // Modal Asignación
        this.modalAsignacion = document.getElementById('modalAsignacion');
        this.modalTitle = document.getElementById('modalTitle');
        this.asignacionForm = document.getElementById('asignacionForm');
        this.asignacionId = document.getElementById('asignacionId');
        this.closeModalBtn = document.getElementById('closeModalBtn');
        this.btnCancelar = document.getElementById('btnCancelar');
        this.btnGuardar = document.getElementById('btnGuardar');

        // Campos del form
        this.idUsuarioSelect = document.getElementById('idUsuario');
        this.idHorarioSelect = document.getElementById('idHorario');
        this.fechaInput = document.getElementById('fecha');
        this.ingEsperadoInput = document.getElementById('ingEsperado');
        this.salEsperadaInput = document.getElementById('salEsperada');
        this.ingAlmuerzoInput = document.getElementById('ingAlmuerzo');
        this.salAlmuerzoInput = document.getElementById('salAlmuerzo');
        this.idEstadoSelect = document.getElementById('idEstado');
        this.notaAlmuerzo = document.getElementById('notaAlmuerzo');

        // Modal Eliminar
        this.modalConfirmar = document.getElementById('modalConfirmar');
        this.confirmarMensajeAsignacion = document.getElementById('confirmarMensajeAsignacion');
        this.countdownTimer = document.getElementById('countdownTimer');
        this.btnCancelarEliminar = document.getElementById('btnCancelarEliminar');
        this.btnConfirmarEliminar = document.getElementById('btnConfirmarEliminar');
        this.closeConfirmModalBtn = document.getElementById('closeConfirmModalBtn');

        // Modal Restaurar
        this.modalRestaurarAsignaciones = document.getElementById('modalRestaurarAsignaciones');
        this.tablaAsignacionesEliminadasBody = document.getElementById('tablaAsignacionesEliminadasBody');
        this.closeRestaurarAsignacionesModalBtn = document.getElementById('closeRestaurarAsignacionesModalBtn');
        this.modalRestaurarAsignacionConfirmar = document.getElementById('modalRestaurarAsignacionConfirmar');
        this.restaurarAsignacionMensaje = document.getElementById('restaurarAsignacionMensaje');
        this.restaurarAdvertencia = document.getElementById('restaurarAdvertencia');
        this.restaurarAdvertenciaTexto = document.getElementById('restaurarAdvertenciaTexto');
        this.closeRestaurarAsignacionConfirmModalBtn = document.getElementById('closeRestaurarAsignacionConfirmModalBtn');
        this.btnCancelarRestaurarAsignacion = document.getElementById('btnCancelarRestaurarAsignacion');
        this.btnConfirmarRestaurarAsignacion = document.getElementById('btnConfirmarRestaurarAsignacion');

        // Modal Calendario
        this.modalCalendario = document.getElementById('modalCalendario');
        this.closeCalendarioBtn = document.getElementById('closeCalendarioBtn');
        this.btnCerrarCalendario = document.getElementById('btnCerrarCalendario');

        // Modal Detalle Fecha
        this.modalDetalleFecha = document.getElementById('modalDetalleFecha');
        this.detalleFechaTitle = document.getElementById('detalleFechaTitle');
        this.detalleFechaBody = document.getElementById('detalleFechaBody');
        this.closeDetalleBtn = document.getElementById('closeDetalleBtn');
        this.btnCerrarDetalle = document.getElementById('btnCerrarDetalle');

        // Modal Grupal (fecha específica)
        this.modalAsignacionGrupal = document.getElementById('modalAsignacionGrupal');
        this.closeGrupalBtn = document.getElementById('closeGrupalBtn');
        this.btnCancelarGrupal = document.getElementById('btnCancelarGrupal');
        this.btnGuardarGrupal = document.getElementById('btnGuardarGrupal');
        this.fechaGrupal = document.getElementById('fechaGrupal');
        this.horarioGrupal = document.getElementById('horarioGrupal');
        this.estadoGrupal = document.getElementById('estadoGrupal');
        this.tablaUsuariosGrupal = document.getElementById('tablaUsuariosGrupal');
        this.seleccionarTodos = document.getElementById('seleccionarTodos');
        this.busquedaGrupal = document.getElementById('busquedaUsuarioGrupal');
        this.btnLimpiarGrupal = document.getElementById('btnLimpiarBusquedaGrupal');
        this.mostradosGrupal = document.getElementById('mostradosGrupal');
        this.totalUsuariosGrupal = document.getElementById('totalUsuariosGrupal');

        // Modal No Laborable (fecha específica)
        this.modalNoLaborable = document.getElementById('modalNoLaborable');
        this.closeNoLaborableBtn = document.getElementById('closeNoLaborableBtn');
        this.btnCancelarNoLaborable = document.getElementById('btnCancelarNoLaborable');
        this.btnGuardarNoLaborable = document.getElementById('btnGuardarNoLaborable');
        this.fechaNoLaborable = document.getElementById('fechaNoLaborable');
        this.tablaUsuariosNoLaborable = document.getElementById('tablaUsuariosNoLaborable');
        this.seleccionarTodosNoLaborable = document.getElementById('seleccionarTodosNoLaborable');
        this.busquedaNoLaborable = document.getElementById('busquedaUsuarioNoLaborable');
        this.btnLimpiarNoLaborable = document.getElementById('btnLimpiarBusquedaNoLaborable');
        this.mostradosNoLaborable = document.getElementById('mostradosNoLaborable');
        this.totalUsuariosNoLaborable = document.getElementById('totalUsuariosNoLaborable');
    }

    // ==========================================
    // SUB CONTROLLERS
    // ==========================================
    inicializarSubControllers() {
        if (this.btnRegistroMasivo && typeof RegistroMasivoController !== 'undefined') {
            this.registroMasivoController = new RegistroMasivoController(this.config, this);
        }
        if (this.btnVerNoLaborables && typeof VerNoLaborablesController !== 'undefined') {
            this.verNoLaborablesController = new VerNoLaborablesController(this.config, this);
        }
        if (this.btnNoLaborableMasivo && typeof NoLaborableMasivoController !== 'undefined') {
            this.noLaborableMasivoController = new NoLaborableMasivoController(this.config, this);
        }
    }

    // ==========================================
    // HEADER
    // ==========================================
    actualizarHeaderConSesion() {
        const u = this.usuarioActual || {};
        const nombreCompleto = `${u.nombres || u.Nombres || ''} ${u.apellidos || u.Apellidos || ''}`.trim() || 'Usuario';
        const email = u.correo || u.Correo || '';
        const rol = u.rol || u.Rol || 'Usuario';

        if (this.userNameDisplay) this.userNameDisplay.textContent = nombreCompleto;
        if (this.userRoleDisplay) this.userRoleDisplay.textContent = rol;
        if (this.dropdownUserName) this.dropdownUserName.textContent = nombreCompleto;
        if (this.dropdownUserEmail) this.dropdownUserEmail.textContent = email;
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
        }
        document.addEventListener('click', () => {
            if (this.userMenu) this.userMenu.classList.remove('active');
        });

        if (this.logoutBtn) this.logoutBtn.addEventListener('click', (e) => { e.stopPropagation(); this.cerrarSesion(); });
        if (this.menuBtn) this.menuBtn.addEventListener('click', (e) => { e.stopPropagation(); this.irAlMenu(); });
        if (this.perfilBtn) this.perfilBtn.addEventListener('click', (e) => { e.stopPropagation(); this.irAlPerfil(); });
        if (this.logoArea) this.logoArea.addEventListener('click', () => this.irAlMenu());

        // Toolbar
        if (this.btnCalendario) this.btnCalendario.addEventListener('click', () => this.abrirModalCalendario());
        if (this.btnExportarExcel) this.btnExportarExcel.addEventListener('click', () => this.exportarExcel());
        if (this.btnAsignacionGrupal) this.btnAsignacionGrupal.addEventListener('click', () => this.abrirModalAsignacionGrupal());
        if (this.btnRestaurarAsignaciones) this.btnRestaurarAsignaciones.addEventListener('click', () => this.abrirModalRestaurarAsignaciones());
        if (this.btnNoLaborable) this.btnNoLaborable.addEventListener('click', () => this.abrirModalNoLaborable());

        // Filtros
        if (this.filtroFechaEspecifica) this.filtroFechaEspecifica.addEventListener('change', () => this.aplicarFiltros());
        if (this.filtroFechaDesde) this.filtroFechaDesde.addEventListener('change', () => this.aplicarFiltros());
        if (this.filtroFechaHasta) this.filtroFechaHasta.addEventListener('change', () => this.aplicarFiltros());
        if (this.filtroUsuario) this.filtroUsuario.addEventListener('change', () => this.aplicarFiltros());
        if (this.filtroHorario) this.filtroHorario.addEventListener('change', () => this.aplicarFiltros());
        if (this.btnLimpiarFiltros) this.btnLimpiarFiltros.addEventListener('click', () => this.limpiarFiltros());

        // Modal Asignación
        if (this.closeModalBtn) this.closeModalBtn.addEventListener('click', () => this.cerrarModalAsignacion());
        if (this.btnCancelar) this.btnCancelar.addEventListener('click', () => this.cerrarModalAsignacion());
        if (this.asignacionForm) this.asignacionForm.addEventListener('submit', (e) => this.guardarAsignacion(e));
        if (this.idHorarioSelect) this.idHorarioSelect.addEventListener('change', () => this.autoCompletarHoras());

        // Modal Eliminar
        if (this.closeConfirmModalBtn) this.closeConfirmModalBtn.addEventListener('click', () => this.cancelarEliminacion());
        if (this.btnCancelarEliminar) this.btnCancelarEliminar.addEventListener('click', () => this.cancelarEliminacion());
        if (this.btnConfirmarEliminar) this.btnConfirmarEliminar.addEventListener('click', () => this.eliminarAhora());

        // Modal Restaurar
        if (this.closeRestaurarAsignacionesModalBtn) this.closeRestaurarAsignacionesModalBtn.addEventListener('click', () => this.cerrarModalRestaurarAsignaciones());
        if (this.closeRestaurarAsignacionConfirmModalBtn) this.closeRestaurarAsignacionConfirmModalBtn.addEventListener('click', () => this.cerrarModalRestaurarAsignacionConfirmar());
        if (this.btnCancelarRestaurarAsignacion) this.btnCancelarRestaurarAsignacion.addEventListener('click', () => this.cerrarModalRestaurarAsignacionConfirmar());
        if (this.btnConfirmarRestaurarAsignacion) this.btnConfirmarRestaurarAsignacion.addEventListener('click', () => this.confirmarRestaurarAsignacion());

        const btnPrimeraAsigElim = document.getElementById('btnPrimeraAsigElim');
        const btnAnteriorAsigElim = document.getElementById('btnAnteriorAsigElim');
        const btnSiguienteAsigElim = document.getElementById('btnSiguienteAsigElim');
        const btnUltimaAsigElim = document.getElementById('btnUltimaAsigElim');

        if (btnPrimeraAsigElim) btnPrimeraAsigElim.addEventListener('click', () => this.irPrimeraAsignacionEliminada());
        if (btnAnteriorAsigElim) btnAnteriorAsigElim.addEventListener('click', () => this.irAnteriorAsignacionEliminada());
        if (btnSiguienteAsigElim) btnSiguienteAsigElim.addEventListener('click', () => this.irSiguienteAsignacionEliminada());
        if (btnUltimaAsigElim) btnUltimaAsigElim.addEventListener('click', () => this.irUltimaAsignacionEliminada());

        // Modal Calendario
        if (this.closeCalendarioBtn) this.closeCalendarioBtn.addEventListener('click', () => this.cerrarModalCalendario());
        if (this.btnCerrarCalendario) this.btnCerrarCalendario.addEventListener('click', () => this.cerrarModalCalendario());

        // Modal Detalle
        if (this.closeDetalleBtn) this.closeDetalleBtn.addEventListener('click', () => this.cerrarModalDetalle());
        if (this.btnCerrarDetalle) this.btnCerrarDetalle.addEventListener('click', () => this.cerrarModalDetalle());

        // Modal Grupal
        if (this.closeGrupalBtn) this.closeGrupalBtn.addEventListener('click', () => this.cerrarModalAsignacionGrupal());
        if (this.btnCancelarGrupal) this.btnCancelarGrupal.addEventListener('click', () => this.cerrarModalAsignacionGrupal());
        if (this.btnGuardarGrupal) this.btnGuardarGrupal.addEventListener('click', () => this.guardarAsignacionesGrupal());
        if (this.fechaGrupal) this.fechaGrupal.addEventListener('change', () => this.renderizarTablaUsuariosGrupal());
        if (this.horarioGrupal) this.horarioGrupal.addEventListener('change', () => this.renderizarTablaUsuariosGrupal());
        if (this.estadoGrupal) this.estadoGrupal.addEventListener('change', () => this.renderizarTablaUsuariosGrupal());
        if (this.busquedaGrupal) this.busquedaGrupal.addEventListener('input', (e) => this.filtrarUsuariosGrupal(e.target.value));
        if (this.btnLimpiarGrupal) {
            this.btnLimpiarGrupal.addEventListener('click', () => {
                if (this.busquedaGrupal) {
                    this.busquedaGrupal.value = '';
                    this.filtrarUsuariosGrupal('');
                }
            });
        }

        // ============================================
        // DELEGACIÓN GLOBAL DE EVENTOS (robusta ante clones)
        // ============================================
        if (!this._delegacionGlobalBound) {
            this._delegacionGlobalBound = true;

            document.addEventListener('click', (e) => {
                const target = e.target.closest('button');
                if (!target) return;

                // Botón "No Laborable — Rango"
                if (target.id === 'btnNoLaborableMasivo') {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('✅ Click en btnNoLaborableMasivo (delegado)');
                    if (this.noLaborableMasivoController) {
                        this.noLaborableMasivoController.abrirModal();
                    } else {
                        this.mostrarMensaje('Error: controlador no disponible', 'error');
                    }
                    return;
                }

                // Botón "Registro Masivo"
                if (target.id === 'btnRegistroMasivo') {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('✅ Click en btnRegistroMasivo (delegado)');
                    if (this.registroMasivoController) {
                        this.registroMasivoController.abrirModal();
                    }
                    return;
                }

                // Botón "Ver No Laborables"
                if (target.id === 'btnVerNoLaborables') {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('✅ Click en btnVerNoLaborables (delegado)');
                    if (this.verNoLaborablesController) {
                        // VerNoLaborablesController tiene su propia lógica en el listener
                        // pero si lo removemos de allí, podemos llamar a un método público
                        if (typeof this.verNoLaborablesController.abrirModal === 'function') {
                            this.verNoLaborablesController.abrirModal();
                        }
                    }
                    return;
                }
            });
        }

        // Modal No Laborable
        if (this.closeNoLaborableBtn) this.closeNoLaborableBtn.addEventListener('click', () => this.cerrarModalNoLaborable());
        if (this.btnCancelarNoLaborable) this.btnCancelarNoLaborable.addEventListener('click', () => this.cerrarModalNoLaborable());
        if (this.btnGuardarNoLaborable) this.btnGuardarNoLaborable.addEventListener('click', () => this.guardarNoLaborables());
        if (this.fechaNoLaborable) this.fechaNoLaborable.addEventListener('change', () => this.renderizarTablaUsuariosNoLaborable());
        if (this.busquedaNoLaborable) this.busquedaNoLaborable.addEventListener('input', (e) => this.filtrarUsuariosNoLaborable(e.target.value));
        if (this.btnLimpiarNoLaborable) {
            this.btnLimpiarNoLaborable.addEventListener('click', () => {
                if (this.busquedaNoLaborable) {
                    this.busquedaNoLaborable.value = '';
                    this.filtrarUsuariosNoLaborable('');
                }
            });
        }
    }

    // ==========================================
    // CARGA DE DATOS
    // ==========================================
    async cargarDatosIniciales() {
        try {
            await Promise.all([
                this.cargarUsuarios(),
                this.cargarHorarios(),
                this.cargarEstados(),
                this.cargarMarcaciones()
            ]);

            this.cargarSelectUsuarios();
            this.cargarSelectHorarios();
            this.cargarSelectEstados();
            this.cargarSelectFiltroUsuario();
            this.cargarSelectFiltroHorario();
            this.cargarSelectHorariosGrupal();
            this.cargarSelectEstadosGrupal();

            await this.cargarAsignaciones();

        } catch (error) {
            console.error('❌ Error en carga inicial:', error);
            this.mostrarMensaje('Error al cargar datos del sistema', 'error');
        }
    }

    async cargarUsuarios() {
        const r = await this.asignacionService.getUsuarios();
        if (!r.success) {
            console.error('❌ Error cargando usuarios:', r.error);
            this.usuarios = [];
            return;
        }
        this.usuarios = (r.data || []).map(u => ({
            IdUsuario: u.IdUsuario,
            Nombres: u.Nombres || u.Nombre || '',
            Apellidos: u.Apellidos || '',
            NombreUsuario: u.LoginNombre || u.NombreUsuario || '',
            IdEstado: u.IdEstado,
            Estado: u.IdEstado === 1 ? 'Activo' : (u.IdEstado === 2 ? 'Eliminado' : 'Inactivo'),
            seleccionable: u.IdEstado === 1
        }));
        console.log(`✅ Usuarios cargados: ${this.usuarios.length}`);
    }

    async cargarHorarios() {
        const r = await this.asignacionService.getHorarios();
        if (!r.success) {
            console.error('❌ Error cargando horarios:', r.error);
            this.horarios = [];
            return;
        }
        // Solo activos
        this.horarios = (r.data || []).filter(h => h.IdEstado === 1);
        console.log(`✅ Horarios activos cargados: ${this.horarios.length}`);
    }

    async cargarEstados() {
        const r = await this.asignacionService.getEstados();
        if (!r.success) {
            console.error('❌ Error cargando estados:', r.error);
            this.estados = [];
            return;
        }
        this.estados = r.data || [];
    }

    async cargarMarcaciones() {
        const r = await this.asignacionService.getMarcaciones();
        if (!r.success) {
            console.warn('No se pudieron cargar marcaciones');
            this.marcacionesExistentes = [];
            return;
        }
        this.marcacionesExistentes = r.data || [];
    }

    async cargarAsignaciones() {
        if (this.cargando) return;
        this.cargando = true;

        try {
            this.mostrarLoading(true);
            const r = await this.asignacionService.getAll();

            if (!r.success) {
                this.mostrarMensaje(`Error al cargar asignaciones: ${r.error}`, 'error');
                if (this.tablaBody) this.tablaBody.innerHTML = `<tr><td colspan="20" class="loading">Error: ${r.error}</td></tr>`;
                return;
            }

            this.todasAsignaciones = r.data || [];
            this.asignaciones = this.todasAsignaciones.filter(a => a.IdEstado === 1);

            console.log(`✅ Asignaciones cargadas: ${this.asignaciones.length} activas de ${this.todasAsignaciones.length} totales`);

            this.aplicarFiltros();

        } catch (error) {
            console.error('❌ Error cargando asignaciones:', error);
            this.mostrarMensaje('Error de conexión al cargar asignaciones', 'error');
        } finally {
            this.cargando = false;
            this.mostrarLoading(false);
        }
    }

    // ==========================================
    // SELECTS
    // ==========================================
    cargarSelectUsuarios() {
        if (!this.idUsuarioSelect) return;
        this.idUsuarioSelect.innerHTML = '<option value="">-- Seleccione --</option>';
        this.usuarios.filter(u => u.seleccionable).forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.IdUsuario;
            opt.textContent = `${u.Nombres} ${u.Apellidos} (${u.NombreUsuario})`;
            this.idUsuarioSelect.appendChild(opt);
        });
    }

    cargarSelectHorarios() {
        if (!this.idHorarioSelect) return;
        this.idHorarioSelect.innerHTML = '<option value="">-- Seleccione --</option>';
        this.horarios.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h.IdHorario;
            let desc = h.Descripcion || '';
            if (h.TiempoHoras || h.TiempoMinutos) {
                desc += ` (${h.TiempoHoras || 0}h ${h.TiempoMinutos || 0}min)`;
            }
            opt.textContent = desc;
            this.idHorarioSelect.appendChild(opt);
        });
    }

    cargarSelectEstados() {
        if (!this.idEstadoSelect) return;
        const activo = this.estados.find(e => String(e.Descripcion || '').toUpperCase() === 'ACTIVO');
        this.idEstadoSelect.innerHTML = '';
        if (activo) {
            const opt = document.createElement('option');
            opt.value = activo.IdEstado;
            opt.textContent = `${activo.IdEstado} - ${activo.Descripcion}`;
            opt.selected = true;
            this.idEstadoSelect.appendChild(opt);
            this.idEstadoSelect.disabled = true;
        } else {
            this.estados.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.IdEstado;
                opt.textContent = `${e.IdEstado} - ${e.Descripcion}`;
                this.idEstadoSelect.appendChild(opt);
            });
        }
    }

    cargarSelectFiltroUsuario() {
        if (!this.filtroUsuario) return;
        this.filtroUsuario.innerHTML = '<option value="">-- Todos --</option>';
        this.usuarios.filter(u => u.seleccionable).forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.IdUsuario;
            opt.textContent = `${u.Nombres} ${u.Apellidos}`;
            this.filtroUsuario.appendChild(opt);
        });
    }

    cargarSelectFiltroHorario() {
        if (!this.filtroHorario) return;
        this.filtroHorario.innerHTML = '<option value="">-- Todos --</option>';
        this.horarios.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h.IdHorario;
            opt.textContent = h.Descripcion;
            this.filtroHorario.appendChild(opt);
        });
    }

    // ==========================================
    // FILTROS
    // ==========================================
    aplicarFiltros() {
        let lista = [...this.asignaciones];

        const fechaEsp = this.filtroFechaEspecifica?.value;
        if (fechaEsp) {
            lista = lista.filter(a => this._normalizarFecha(a.Fecha) === fechaEsp);
        } else {
            const desde = this.filtroFechaDesde?.value;
            const hasta = this.filtroFechaHasta?.value;
            if (desde) lista = lista.filter(a => this._normalizarFecha(a.Fecha) >= desde);
            if (hasta) lista = lista.filter(a => this._normalizarFecha(a.Fecha) <= hasta);
        }

        const uId = this.filtroUsuario?.value;
        if (uId) lista = lista.filter(a => a.IdUsuario == uId);

        const hId = this.filtroHorario?.value;
        if (hId) lista = lista.filter(a => a.IdHorario == hId);

        // Orden: hoy → futuras asc → pasadas desc
        const hoy = this._fechaHoyStr();
        lista.sort((a, b) => {
            const fA = this._normalizarFecha(a.Fecha);
            const fB = this._normalizarFecha(b.Fecha);
            const esHoyA = fA === hoy, esHoyB = fB === hoy;
            const esFutA = fA > hoy, esFutB = fB > hoy;
            if (esHoyA && !esHoyB) return -1;
            if (!esHoyA && esHoyB) return 1;
            if (esFutA && esFutB) return fA.localeCompare(fB);
            if (esFutA && !esFutB) return -1;
            if (!esFutA && esFutB) return 1;
            return fB.localeCompare(fA);
        });

        this.asignacionesFiltradas = lista;
        this.totalPaginas = Math.ceil(lista.length / this.registrosPorPagina) || 1;
        if (this.paginaActual > this.totalPaginas) this.paginaActual = this.totalPaginas;
        if (this.paginaActual < 1) this.paginaActual = 1;

        this.renderizarPaginaActual();
    }

    limpiarFiltros() {
        if (this.filtroFechaEspecifica) this.filtroFechaEspecifica.value = '';
        if (this.filtroFechaDesde) this.filtroFechaDesde.value = '';
        if (this.filtroFechaHasta) this.filtroFechaHasta.value = '';
        if (this.filtroUsuario) this.filtroUsuario.value = '';
        if (this.filtroHorario) this.filtroHorario.value = '';
        this.aplicarFiltros();
        this.mostrarMensaje('Filtros limpiados', 'info');
    }

    // ==========================================
    // RENDER TABLA
    // ==========================================
    renderizarPaginaActual() {
        if (!this.tablaBody) return;

        if (this.asignacionesFiltradas.length === 0) {
            this.tablaBody.innerHTML = `<tr><td colspan="20" class="loading">No hay asignaciones que coincidan con los filtros</td></tr>`;
            if (this.paginacionContainer) this.paginacionContainer.style.display = 'none';
            return;
        }

        const inicio = (this.paginaActual - 1) * this.registrosPorPagina;
        const pagina = this.asignacionesFiltradas.slice(inicio, inicio + this.registrosPorPagina);

        this.tablaBody.innerHTML = '';
        pagina.forEach(a => this.tablaBody.appendChild(this._crearFilaAsignacion(a)));

        if (this.paginacionContainer) this.paginacionContainer.style.display = 'flex';
        this._actualizarControlesPaginacion();
        this._actualizarInfoRegistros();
        this._reasignarEventosBotones();
    }

    _crearFilaAsignacion(a) {
        const row = document.createElement('tr');
        const estadoDesc = this._obtenerDescripcionEstado(a.IdEstado);
        const estadoClass = estadoDesc.toUpperCase() === 'ACTIVO' ? 'badge-activo' : 'badge-eliminado';
        const esEditable = this._esFechaEditable(a.Fecha);

        const usuario = this._obtenerNombreUsuario(a.IdUsuario);
        const horario = this._obtenerNombreHorario(a.IdHorario);
        const creador = this._obtenerNombreUsuario(a.IdUsuarioCreacion);
        const modificador = this._obtenerNombreUsuario(a.IdUsuarioModificacion);

        const botones = esEditable
            ? `<button class="btn-edit" data-id="${a.IdAsignacion}"><i class="fas fa-edit"></i> Editar</button>
               <button class="btn-delete" data-id="${a.IdAsignacion}"> <i class="fas fa-trash"></i> Eliminar</button>`
            : `<button class="btn-edit" disabled style="opacity:0.5;cursor:not-allowed;"><i class="fas fa-lock"></i> Editar</button>
               <button class="btn-delete" disabled style="opacity:0.5;cursor:not-allowed;"><i class="fas fa-lock"></i> Eliminar</button>`;

        row.innerHTML = `
            <td>${a.IdAsignacion}</td>
            <td class="col-id-usuario">${a.IdUsuario || 'N/A'}</td>
            <td>${this._escape(usuario)}</td>
            <td class="col-id-horario">${a.IdHorario || 'N/A'}</td>
            <td>${this._escape(horario)}</td>
            <td>${this._crearBadgeTipoHorario(a.IdHorario)}</td>
            <td>${this._formatearFecha(a.Fecha)}</td>
            <td>${this._formatearHora(a.IngEsperado)}</td>
            <td>${this._formatearHora(a.SalEsperada)}</td>
            <td>${this._formatearHora(a.IngAlmuerzoEsperado)}</td>
            <td>${this._formatearHora(a.SalAlmuerzoEsperado)}</td>
            <td class="col-id-estado">${a.IdEstado}</td>
            <td><span class="badge ${estadoClass}">${this._escape(estadoDesc)}</span></td>
            <td class="col-id-usuario-creacion">${a.IdUsuarioCreacion || 'N/A'}</td>
            <td>${this._escape(creador)}</td>
            <td>${this._formatearFechaPeru(a.FechaCreacion)}</td>
            <td class="col-id-usuario-modificacion">${a.IdUsuarioModificacion || 'N/A'}</td>
            <td>${this._escape(modificador)}</td>
            <td>${this._formatearFechaPeru(a.FechaModificacion)}</td>
            <td class="action-buttons">${botones}</td>
        `;
        return row;
    }

    // ==========================================
    // HELPER: Badge de tipo de horario (PRESENCIAL / VIRTUAL)
    // ==========================================
    _crearBadgeTipoHorario(idHorario) {
        if (!idHorario) return '<span class="badge badge-secondary">N/A</span>';

        const h = this.horarios.find(x => x.IdHorario === idHorario);
        if (!h) return '<span class="badge badge-secondary">--</span>';

        const tipo = String(h.TipoHorario || '').trim().toUpperCase();

        if (tipo === 'VIRTUAL') {
            return '<span class="badge badge-virtual">VIRTUAL</span>';
        }
        if (tipo === 'PRESENCIAL') {
            return '<span class="badge badge-presencial">PRESENCIAL</span>';
        }

        // Fallback por descripción (por si TipoHorario viene vacío)
        const desc = String(h.Descripcion || '').toLowerCase();
        if (desc.includes('virtual')) {
            return '<span class="badge badge-virtual">VIRTUAL</span>';
        }

        return `<span class="badge badge-secondary">${this._escape(tipo || '--')}</span>`;
    }

    _reasignarEventosBotones() {
        document.querySelectorAll('.btn-edit:not([disabled])').forEach(btn => {
            btn.onclick = () => this.abrirModalEditar(parseInt(btn.dataset.id));
        });
        document.querySelectorAll('.btn-delete:not([disabled])').forEach(btn => {
            btn.onclick = () => this.abrirModalEliminar(parseInt(btn.dataset.id));
        });
    }

    // ==========================================
    // MODAL: AGREGAR
    // ==========================================
    abrirModalAgregar() {
        if (this.modalTitle) this.modalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Asignar Horario';
        if (this.asignacionForm) this.asignacionForm.reset();
        if (this.asignacionId) this.asignacionId.value = '';
        if (this.ingEsperadoInput) { this.ingEsperadoInput.value = ''; this.ingEsperadoInput.disabled = false; }
        if (this.salEsperadaInput) { this.salEsperadaInput.value = ''; this.salEsperadaInput.disabled = false; }
        if (this.ingAlmuerzoInput) { this.ingAlmuerzoInput.value = ''; this.ingAlmuerzoInput.disabled = true; }
        if (this.salAlmuerzoInput) { this.salAlmuerzoInput.value = ''; this.salAlmuerzoInput.disabled = true; }
        if (this.notaAlmuerzo) this.notaAlmuerzo.style.display = 'none';

        // Fecha mínima = hoy
        if (this.fechaInput) {
            const hoy = this._fechaHoyStr();
            this.fechaInput.min = hoy;
            this.fechaInput.value = hoy;
        }

        setTimeout(() => this.autoCompletarHoras(), 100);
        this.modalAsignacion.classList.add('active');
    }

    // ==========================================
    // MODAL: EDITAR
    // ==========================================
    abrirModalEditar(id) {
        const a = this.asignaciones.find(x => x.IdAsignacion === id);
        if (!a) { this.mostrarMensaje('Asignación no encontrada', 'error'); return; }

        if (!this._esFechaEditable(a.Fecha)) {
            this.mostrarMensaje('No se puede editar asignaciones con fecha anterior a hoy', 'warning');
            return;
        }

        if (this.modalTitle) this.modalTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Asignación';
        if (this.asignacionId) this.asignacionId.value = a.IdAsignacion;
        if (this.idUsuarioSelect) this.idUsuarioSelect.value = a.IdUsuario || '';
        if (this.idHorarioSelect) this.idHorarioSelect.value = a.IdHorario || '';

        if (this.fechaInput) {
            const hoy = this._fechaHoyStr();
            this.fechaInput.min = hoy;
            this.fechaInput.value = this._normalizarFecha(a.Fecha);
        }

        // Cargar horas guardadas
        if (this.ingEsperadoInput) this.ingEsperadoInput.value = this._normalizarHora(a.IngEsperado) || '';
        if (this.salEsperadaInput) this.salEsperadaInput.value = this._normalizarHora(a.SalEsperada) || '';
        if (this.ingAlmuerzoInput) this.ingAlmuerzoInput.value = this._normalizarHora(a.IngAlmuerzoEsperado) || '';
        if (this.salAlmuerzoInput) this.salAlmuerzoInput.value = this._normalizarHora(a.SalAlmuerzoEsperado) || '';

        if (this.idEstadoSelect) this.idEstadoSelect.value = a.IdEstado || '';

        setTimeout(() => this.autoCompletarHoras(), 100);
        this.modalAsignacion.classList.add('active');
    }

    // ==========================================
    // AUTO-COMPLETAR HORAS
    // ==========================================
    autoCompletarHoras() {
        const idHorario = parseInt(this.idHorarioSelect?.value);
        if (!idHorario) {
            if (this.ingEsperadoInput) this.ingEsperadoInput.disabled = false;
            if (this.salEsperadaInput) this.salEsperadaInput.disabled = false;
            return;
        }

        const h = this.horarios.find(x => x.IdHorario === idHorario);
        if (!h) return;

        const ingreso = this._normalizarHora(h.HoraIngreso);
        const salida = this._normalizarHora(h.HoraSalida);
        const ingAlm = this._normalizarHora(h.HoraIngAlmuerzo);
        const salAlm = this._normalizarHora(h.HoraSalAlmuerzo);

        const esAleatorio = !ingreso && !salida;

        if (!esAleatorio) {
            if (this.ingEsperadoInput) { this.ingEsperadoInput.value = ingreso || ''; this.ingEsperadoInput.disabled = true; }
            if (this.salEsperadaInput) { this.salEsperadaInput.value = salida || ''; this.salEsperadaInput.disabled = true; }
        } else {
            if (this.ingEsperadoInput) this.ingEsperadoInput.disabled = false;
            if (this.salEsperadaInput) this.salEsperadaInput.disabled = false;
        }

        if (this.ingAlmuerzoInput) { this.ingAlmuerzoInput.value = ingAlm || ''; this.ingAlmuerzoInput.disabled = true; }
        if (this.salAlmuerzoInput) { this.salAlmuerzoInput.value = salAlm || ''; this.salAlmuerzoInput.disabled = true; }

        if (this.notaAlmuerzo) {
            this.notaAlmuerzo.style.display = (ingAlm || salAlm) ? 'block' : 'none';
        }
    }

    // ==========================================
    // GUARDAR
    // ==========================================
    async guardarAsignacion(event) {
        event.preventDefault();
        if (this.guardando) return;

        const idUsuario = parseInt(this.idUsuarioSelect?.value);
        const idHorario = parseInt(this.idHorarioSelect?.value);
        const fecha = this.fechaInput?.value;
        const idEstado = parseInt(this.idEstadoSelect?.value);

        const ingEsperado = this.ingEsperadoInput?.value || '';
        const salEsperada = this.salEsperadaInput?.value || '';
        const ingAlm = this.ingAlmuerzoInput?.value || '';
        const salAlm = this.salAlmuerzoInput?.value || '';

        if (!idUsuario) { this.mostrarMensaje('Seleccione un usuario', 'error'); return; }
        if (!idHorario) { this.mostrarMensaje('Seleccione un horario', 'error'); return; }
        if (!fecha) { this.mostrarMensaje('Seleccione una fecha', 'error'); return; }
        if (!idEstado) { this.mostrarMensaje('Estado requerido', 'error'); return; }
        if (!this._esFechaValida(fecha)) { this.mostrarMensaje('Fecha anterior a hoy no permitida', 'warning'); return; }
        if (!ingEsperado || !salEsperada) {
            this.mostrarMensaje('Las horas de ingreso y salida son requeridas', 'error');
            return;
        }

        // Duplicado
        const esNuevo = !this.asignacionId?.value;
        const idExcluir = esNuevo ? null : parseInt(this.asignacionId.value);
        if (this.existeAsignacionDuplicada(idUsuario, fecha, idExcluir)) {
            this.mostrarMensaje(`El usuario ya tiene asignación para ${this._formatearFecha(fecha)}`, 'warning');
            return;
        }

        const payload = {
            IdUsuario: idUsuario,
            IdHorario: idHorario,
            Fecha: fecha,
            IngEsperado: ingEsperado,
            SalEsperada: salEsperada,
            IngAlmuerzoEsperado: ingAlm || null,
            SalAlmuerzoEsperado: salAlm || null,
            IdEstado: idEstado,
            IdUsuarioCreacion: this.usuarioActual.IdUsuario,
            IdUsuarioModificacion: this.usuarioActual.IdUsuario
        };

        const originalText = this.btnGuardar.innerHTML;
        this.guardando = true;
        this.btnGuardar.disabled = true;
        this.btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        try {
            const r = esNuevo
                ? await this.asignacionService.create(payload)
                : await this.asignacionService.update(idExcluir, payload);

            if (!r.success) {
                this.mostrarMensaje(`${r.error || 'No se pudo guardar'}`, 'error');
                return;
            }

            this.mostrarMensaje(
                esNuevo ? 'Asignación creada correctamente' : 'Asignación actualizada correctamente',
                'success'
            );
            this.cerrarModalAsignacion();
            await this.cargarAsignaciones();

        } catch (error) {
            console.error('❌ Error guardando:', error);
            this.mostrarMensaje(`Error de conexión: ${error.message}`, 'error');
        } finally {
            this.guardando = false;
            if (this.btnGuardar) {
                this.btnGuardar.disabled = false;
                this.btnGuardar.innerHTML = originalText;
            }
        }
    }

    cerrarModalAsignacion() {
        if (this.modalAsignacion) this.modalAsignacion.classList.remove('active');
        if (this.asignacionForm) this.asignacionForm.reset();
        if (this.asignacionId) this.asignacionId.value = '';
        if (this.idEstadoSelect) this.idEstadoSelect.disabled = false;
    }

    // ==========================================
    // ELIMINAR
    // ==========================================
    abrirModalEliminar(id) {
        const a = this.asignaciones.find(x => x.IdAsignacion === id);
        if (!a) return;

        if (!this._esFechaEditable(a.Fecha)) {
            this.mostrarMensaje('No se puede eliminar asignaciones del pasado', 'warning');
            return;
        }

        // Verificar NO LABORABLE
        const tieneNoLaborable = this._tieneNoLaborable(a.IdUsuario, a.Fecha);
        if (tieneNoLaborable) {
            this.mostrarMensaje('El usuario está marcado como NO LABORABLE en esa fecha', 'warning');
            return;
        }

        this.asignacionAEliminar = a;
        this.countdownValue = 10;

        if (this.confirmarMensajeAsignacion) {
            this.confirmarMensajeAsignacion.innerHTML = `
                ¿Eliminar la asignación de <strong>${this._escape(this._obtenerNombreUsuario(a.IdUsuario))}</strong>
                en fecha <strong>${this._formatearFecha(a.Fecha)}</strong>?
                <br><br>
                Se eliminarán también: <strong>marcaciones, evidencias, observaciones y justificaciones</strong>.
            `;
        }

        if (this.countdownTimer) this.countdownTimer.textContent = `Eliminando en ${this.countdownValue}s...`;
        if (this.btnConfirmarEliminar) {
            this.btnConfirmarEliminar.disabled = false;
            this.btnConfirmarEliminar.innerHTML = '<i class="fas fa-trash"></i> Eliminar ahora';
        }

        this.modalConfirmar.classList.add('active');
        this._iniciarCountdown();
    }

    _iniciarCountdown() {
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.countdownValue = 10;

        this.countdownInterval = setInterval(() => {
            this.countdownValue--;
            if (this.countdownTimer) this.countdownTimer.textContent = `Eliminando en ${this.countdownValue}s...`;
            if (this.countdownValue <= 0) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
                this.eliminarAhora();
            }
        }, 1000);
    }

    async eliminarAhora() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        if (!this.asignacionAEliminar) return;

        try {
            const r = await this.asignacionService.deleteCascada(
                this.asignacionAEliminar.IdAsignacion,
                this.usuarioActual.IdUsuario
            );

            if (!r.success) {
                this.mostrarMensaje(`${r.error || 'No se pudo eliminar'}`, 'error');
                return;
            }

            this.mostrarMensaje('Asignación eliminada', 'success');
            this.cerrarModalConfirmar();
            await this.cargarAsignaciones();

        } catch (error) {
            console.error('❌ Error eliminando:', error);
            this.mostrarMensaje(`Error de conexión: ${error.message}`, 'error');
        }
    }

    cancelarEliminacion() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        this.asignacionAEliminar = null;
        this.cerrarModalConfirmar();
    }

    cerrarModalConfirmar() {
        if (this.modalConfirmar) this.modalConfirmar.classList.remove('active');
    }

    // ==========================================
    // RESTAURAR
    // ==========================================
    async abrirModalRestaurarAsignaciones() {
        this.asignacionesEliminadasPaginaActual = 1;
        await this.cargarAsignacionesEliminadas();
        this.modalRestaurarAsignaciones.classList.add('active');
    }

    async cargarAsignacionesEliminadas() {
        const r = await this.asignacionService.getAll();
        if (!r.success) {
            this.mostrarMensaje('No se pudieron cargar asignaciones eliminadas', 'error');
            return;
        }
        this.asignacionesEliminadas = (r.data || []).filter(a => a.IdEstado === 2);
        this.asignacionesEliminadasTotalPaginas = Math.ceil(this.asignacionesEliminadas.length / this.asignacionesEliminadasRegistrosPorPagina) || 1;
        this.renderizarPaginaAsignacionesEliminadas();
    }

    renderizarPaginaAsignacionesEliminadas() {
        if (!this.tablaAsignacionesEliminadasBody) return;

        const paginacionContainer = document.getElementById('paginacionAsignacionesEliminadasContainer');

        if (this.asignacionesEliminadas.length === 0) {
            this.tablaAsignacionesEliminadasBody.innerHTML = '<tr><td colspan="9" class="loading">No hay asignaciones eliminadas</td></tr>';
            if (paginacionContainer) paginacionContainer.style.display = 'none';
            return;
        }

        const inicio = (this.asignacionesEliminadasPaginaActual - 1) * this.asignacionesEliminadasRegistrosPorPagina;
        const pagina = this.asignacionesEliminadas.slice(inicio, inicio + this.asignacionesEliminadasRegistrosPorPagina);

        this.tablaAsignacionesEliminadasBody.innerHTML = '';
        pagina.forEach(a => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${a.IdAsignacion}</td>
                <td>${this._escape(this._obtenerNombreUsuario(a.IdUsuario))}</td>
                <td>${this._escape(this._obtenerNombreHorario(a.IdHorario))}</td>
                <td>${this._formatearFecha(a.Fecha)}</td>
                <td>${this._formatearHora(a.IngEsperado)}</td>
                <td>${this._formatearHora(a.SalEsperada)}</td>
                <td>${this._formatearHora(a.IngAlmuerzoEsperado)}</td>
                <td>${this._formatearHora(a.SalAlmuerzoEsperado)}</td>
                <td>
                    <button class="btn-restore-asignacion" data-id="${a.IdAsignacion}"> <i class="fas fa-undo"></i> Restaurar</button>
                </td>
            `;
            this.tablaAsignacionesEliminadasBody.appendChild(row);
        });

        document.querySelectorAll('#tablaAsignacionesEliminadasBody .btn-restore-asignacion').forEach(btn => {
            btn.onclick = () => this.abrirModalConfirmarRestaurar(parseInt(btn.getAttribute('data-id')));
        });

        if (paginacionContainer) paginacionContainer.style.display = 'flex';
        this._actualizarControlesPaginacionAsignacionesEliminadas();
    }

    abrirModalConfirmarRestaurar(id) {
        const a = this.asignacionesEliminadas.find(x => x.IdAsignacion === id);
        if (!a) return;

        this.asignacionARestaurar = a;

        let advertencias = [];
        const usuario = this.usuarios.find(u => u.IdUsuario === a.IdUsuario);
        const horario = this.horarios.find(h => h.IdHorario === a.IdHorario);

        if (!usuario) advertencias.push('❌ El usuario asociado no existe.');
        else if (usuario.IdEstado === 2) advertencias.push('❌ El usuario está eliminado. Restáurelo primero.');
        if (!horario) advertencias.push('❌ El horario asociado no existe o está eliminado. Restáurelo primero.');

        if (this.restaurarAsignacionMensaje) {
            this.restaurarAsignacionMensaje.innerHTML = `
                ¿Restaurar la asignación de <strong>${this._escape(this._obtenerNombreUsuario(a.IdUsuario))}</strong>
                en fecha <strong>${this._formatearFecha(a.Fecha)}</strong>?
                <br><br>
                Se restaurarán las marcaciones y evidencias relacionadas.
            `;
        }

        if (advertencias.length > 0) {
            if (this.restaurarAdvertencia) this.restaurarAdvertencia.style.display = 'block';
            if (this.restaurarAdvertenciaTexto) this.restaurarAdvertenciaTexto.innerHTML = advertencias.join('<br>');
            if (this.btnConfirmarRestaurarAsignacion) {
                this.btnConfirmarRestaurarAsignacion.disabled = true;
                this.btnConfirmarRestaurarAsignacion.style.opacity = '0.5';
            }
        } else {
            if (this.restaurarAdvertencia) this.restaurarAdvertencia.style.display = 'none';
            if (this.btnConfirmarRestaurarAsignacion) {
                this.btnConfirmarRestaurarAsignacion.disabled = false;
                this.btnConfirmarRestaurarAsignacion.style.opacity = '1';
            }
        }

        this.modalRestaurarAsignacionConfirmar.classList.add('active');
    }

    cerrarModalRestaurarAsignaciones() {
        if (this.modalRestaurarAsignaciones) this.modalRestaurarAsignaciones.classList.remove('active');
    }

    cerrarModalRestaurarAsignacionConfirmar() {
        if (this.modalRestaurarAsignacionConfirmar) this.modalRestaurarAsignacionConfirmar.classList.remove('active');
        this.asignacionARestaurar = null;
    }

    async confirmarRestaurarAsignacion() {
        if (!this.asignacionARestaurar) return;

        const originalText = this.btnConfirmarRestaurarAsignacion.innerHTML;
        this.btnConfirmarRestaurarAsignacion.disabled = true;
        this.btnConfirmarRestaurarAsignacion.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Restaurando...';

        try {
            const r = await this.asignacionService.restaurarCascada(
                this.asignacionARestaurar.IdAsignacion,
                this.usuarioActual.IdUsuario
            );

            if (!r.success) {
                this.mostrarMensaje(`${r.error || 'No se pudo restaurar'}`, 'error');
                return;
            }

            this.mostrarMensaje('Asignación restaurada correctamente', 'success');
            this.cerrarModalRestaurarAsignacionConfirmar();
            this.cerrarModalRestaurarAsignaciones();
            await this.cargarAsignaciones();

        } catch (error) {
            console.error('❌ Error restaurando:', error);
            this.mostrarMensaje(`Error de conexión: ${error.message}`, 'error');
        } finally {
            this.btnConfirmarRestaurarAsignacion.disabled = false;
            this.btnConfirmarRestaurarAsignacion.innerHTML = originalText;
        }
    }

    // ==========================================
    // PAGINACIÓN
    // ==========================================
    crearControlesPaginacion() {
        const tableContainer = document.querySelector('.table-container');
        if (!tableContainer || document.getElementById('paginacionContainer')) return;

        const div = document.createElement('div');
        div.id = 'paginacionContainer';
        div.className = 'paginacion-container';
        div.innerHTML = `
            <div class="paginacion-info">
                Mostrando <span id="inicioRegistro">0</span> - <span id="finRegistro">0</span>
                de <span id="totalRegistros">0</span> registros
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

        this.paginacionContainer = document.getElementById('paginacionContainer');
        this.btnPrimeraPagina = document.getElementById('btnPrimeraPagina');
        this.btnPaginaAnterior = document.getElementById('btnPaginaAnterior');
        this.btnPaginaSiguiente = document.getElementById('btnPaginaSiguiente');
        this.btnUltimaPagina = document.getElementById('btnUltimaPagina');
        this.paginaActualInfo = document.getElementById('paginaActualInfo');
        this.inicioRegistro = document.getElementById('inicioRegistro');
        this.finRegistro = document.getElementById('finRegistro');
        this.totalRegistrosSpan = document.getElementById('totalRegistros');

        if (this.btnPrimeraPagina) this.btnPrimeraPagina.addEventListener('click', () => this.irPrimeraPagina());
        if (this.btnPaginaAnterior) this.btnPaginaAnterior.addEventListener('click', () => this.irPaginaAnterior());
        if (this.btnPaginaSiguiente) this.btnPaginaSiguiente.addEventListener('click', () => this.irPaginaSiguiente());
        if (this.btnUltimaPagina) this.btnUltimaPagina.addEventListener('click', () => this.irUltimaPagina());
    }

    irPrimeraPagina() { if (this.paginaActual > 1) { this.paginaActual = 1; this.renderizarPaginaActual(); } }
    irPaginaAnterior() { if (this.paginaActual > 1) { this.paginaActual--; this.renderizarPaginaActual(); } }
    irPaginaSiguiente() { if (this.paginaActual < this.totalPaginas) { this.paginaActual++; this.renderizarPaginaActual(); } }
    irUltimaPagina() { if (this.paginaActual < this.totalPaginas) { this.paginaActual = this.totalPaginas; this.renderizarPaginaActual(); } }

    _actualizarControlesPaginacion() {
        const total = this.totalPaginas;
        if (this.btnPrimeraPagina) this.btnPrimeraPagina.disabled = this.paginaActual === 1;
        if (this.btnPaginaAnterior) this.btnPaginaAnterior.disabled = this.paginaActual === 1;
        if (this.btnPaginaSiguiente) this.btnPaginaSiguiente.disabled = this.paginaActual === total;
        if (this.btnUltimaPagina) this.btnUltimaPagina.disabled = this.paginaActual === total;
        if (this.paginaActualInfo) this.paginaActualInfo.textContent = `Página ${this.paginaActual} de ${total}`;
    }

    _actualizarInfoRegistros() {
        const total = this.asignacionesFiltradas.length;
        const inicio = total > 0 ? (this.paginaActual - 1) * this.registrosPorPagina + 1 : 0;
        const fin = Math.min(inicio + this.registrosPorPagina - 1, total);
        if (this.inicioRegistro) this.inicioRegistro.textContent = inicio;
        if (this.finRegistro) this.finRegistro.textContent = fin;
        if (this.totalRegistrosSpan) this.totalRegistrosSpan.textContent = total;
    }

    // ============================================
    // PAGINACIÓN DE ASIGNACIONES ELIMINADAS
    // ============================================
    _actualizarControlesPaginacionAsignacionesEliminadas() {
        const total = this.asignacionesEliminadasTotalPaginas || 1;
        const totalReg = this.asignacionesEliminadas.length;
        const inicio = totalReg > 0 ? (this.asignacionesEliminadasPaginaActual - 1) * this.asignacionesEliminadasRegistrosPorPagina + 1 : 0;
        const fin = Math.min(inicio + this.asignacionesEliminadasRegistrosPorPagina - 1, totalReg);

        const inicioEl = document.getElementById('inicioAsigElim');
        const finEl = document.getElementById('finAsigElim');
        const totalEl = document.getElementById('totalAsigElim');
        const paginaInfo = document.getElementById('paginaActualAsigElim');

        if (inicioEl) inicioEl.textContent = inicio;
        if (finEl) finEl.textContent = fin;
        if (totalEl) totalEl.textContent = totalReg;
        if (paginaInfo) paginaInfo.textContent = `Página ${this.asignacionesEliminadasPaginaActual} de ${total}`;

        const btnPrimera = document.getElementById('btnPrimeraAsigElim');
        const btnAnterior = document.getElementById('btnAnteriorAsigElim');
        const btnSiguiente = document.getElementById('btnSiguienteAsigElim');
        const btnUltima = document.getElementById('btnUltimaAsigElim');

        if (btnPrimera) btnPrimera.disabled = this.asignacionesEliminadasPaginaActual === 1;
        if (btnAnterior) btnAnterior.disabled = this.asignacionesEliminadasPaginaActual === 1;
        if (btnSiguiente) btnSiguiente.disabled = this.asignacionesEliminadasPaginaActual === total;
        if (btnUltima) btnUltima.disabled = this.asignacionesEliminadasPaginaActual === total;
    }

    irPrimeraAsignacionEliminada() {
        if (this.asignacionesEliminadasPaginaActual > 1) {
            this.asignacionesEliminadasPaginaActual = 1;
            this.renderizarPaginaAsignacionesEliminadas();
        }
    }

    irAnteriorAsignacionEliminada() {
        if (this.asignacionesEliminadasPaginaActual > 1) {
            this.asignacionesEliminadasPaginaActual--;
            this.renderizarPaginaAsignacionesEliminadas();
        }
    }

    irSiguienteAsignacionEliminada() {
        if (this.asignacionesEliminadasPaginaActual < this.asignacionesEliminadasTotalPaginas) {
            this.asignacionesEliminadasPaginaActual++;
            this.renderizarPaginaAsignacionesEliminadas();
        }
    }

    irUltimaAsignacionEliminada() {
        if (this.asignacionesEliminadasPaginaActual < this.asignacionesEliminadasTotalPaginas) {
            this.asignacionesEliminadasPaginaActual = this.asignacionesEliminadasTotalPaginas;
            this.renderizarPaginaAsignacionesEliminadas();
        }
    }

    // ==========================================
    // CALENDARIO
    // ==========================================
    abrirModalCalendario() {
        if (this.modalCalendario) this.modalCalendario.classList.add('active');

        // Si aún no se creó el calendario, lo creamos
        if (!this.calendario) {
            this.inicializarCalendario();
        } else {
            this.calendario.render();
        }

        // ✅ Fix de renderizado: forzar cambio de vista con delay mínimo
        // Esto recalcula tamaños porque el modal estaba display:none al renderizar
        setTimeout(() => {
            if (!this.calendario) return;
            try {
                this.calendario.changeView('dayGridWeek');
            } catch (e) { console.warn('changeView week:', e); }

            setTimeout(() => {
                if (!this.calendario) return;
                try {
                    this.calendario.changeView('dayGridMonth');
                } catch (e) { console.warn('changeView month:', e); }
            }, 30);
        }, 50);
    }

    inicializarCalendario() {
        const calendarEl = document.getElementById('calendario');
        if (!calendarEl) return;

        if (typeof FullCalendar === 'undefined') {
            console.warn('FullCalendar no cargado');
            return;
        }

        this.calendario = new FullCalendar.Calendar(calendarEl, {
            locale: 'es',
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,dayGridWeek'
            },
            // ============================================
            // ✅ Eventos AGRUPADOS por horario + fecha
            // ============================================
            events: (info, successCallback) => {
                // Agrupar por Fecha + IdHorario
                const grupos = new Map();

                this.asignaciones.forEach(a => {
                    const fecha = this._normalizarFecha(a.Fecha);
                    const key = `${fecha}__${a.IdHorario}`;
                    if (!grupos.has(key)) {
                        grupos.set(key, {
                            fecha,
                            IdHorario: a.IdHorario,
                            horarioDesc: this._obtenerNombreHorario(a.IdHorario),
                            usuarios: 0
                        });
                    }
                    grupos.get(key).usuarios += 1;
                });

                const events = [];
                grupos.forEach(g => {
                    events.push({
                        title: `${g.horarioDesc} (${g.usuarios})`,
                        start: g.fecha,
                        allDay: true,
                        extendedProps: {
                            IdHorario: g.IdHorario,
                            horarioDesc: g.horarioDesc,
                            usuarios: g.usuarios,
                            fecha: g.fecha
                        }
                    });
                });

                successCallback(events);
            },
            dateClick: (info) => {
                const fecha = this._formatearFechaISO(info.date);
                this.mostrarDetallePorFecha(fecha);
            },
            eventClick: (info) => {
                // Al clickear un evento, abrir el detalle del día
                const fecha = info.event.extendedProps.fecha;
                if (fecha) this.mostrarDetallePorFecha(fecha);
            },
            height: 'auto',
            dayMaxEvents: false,     // Mostrar todos los eventos (ya están agrupados)
            eventDisplay: 'block',
            eventTextColor: 'white',
            eventBackgroundColor: '#2176c7',
            eventBorderColor: '#1a5fa3'
        });

        this.calendario.render();
    }


    mostrarDetallePorFecha(fecha) {
        const lista = this.asignaciones.filter(a => this._normalizarFecha(a.Fecha) === fecha);

        if (this.detalleFechaTitle) this.detalleFechaTitle.innerHTML =
            `<i class="fas fa-list"></i> Asignaciones del ${this._formatearFecha(fecha)}`;

        if (!this.detalleFechaBody) return;

        if (lista.length === 0) {
            this.detalleFechaBody.innerHTML = '<tr><td colspan="7" class="loading">Sin asignaciones</td></tr>';
        } else {
            this.detalleFechaBody.innerHTML = '';
            lista.forEach(a => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${this._escape(this._obtenerNombreUsuario(a.IdUsuario))}</td>
                    <td>${this._escape(this._obtenerNombreHorario(a.IdHorario))}</td>
                    <td>${this._formatearHora(a.IngEsperado)}</td>
                    <td>${this._formatearHora(a.SalEsperada)}</td>
                    <td>${this._formatearHora(a.IngAlmuerzoEsperado)}</td>
                    <td>${this._formatearHora(a.SalAlmuerzoEsperado)}</td>
                    <td>${this._obtenerDescripcionEstado(a.IdEstado)}</td>
                `;
                this.detalleFechaBody.appendChild(row);
            });
        }
        this.modalDetalleFecha.classList.add('active');
    }

    cerrarModalCalendario() {
        if (this.modalCalendario) this.modalCalendario.classList.remove('active');
    }

    cerrarModalDetalle() {
        if (this.modalDetalleFecha) this.modalDetalleFecha.classList.remove('active');
    }

    // ==========================================
    // ASIGNACIÓN GRUPAL (mismo día)
    // ==========================================
    abrirModalAsignacionGrupal() {
        console.log('📌 abrirModalAsignacionGrupal()');

        // Cerrar otros modales
        document.querySelectorAll('.modal.active').forEach(m => {
            if (m.id !== 'modalAsignacionGrupal') m.classList.remove('active');
        });

        if (this.horarioGrupal) this.horarioGrupal.value = '';
        if (this.seleccionarTodos) this.seleccionarTodos.checked = false;

        // ============================================
        // ✅ FECHA POR DEFECTO = HOY + BLOQUEAR PASADAS
        // ============================================
        if (this.fechaGrupal) {
            const hoy = this._fechaHoyStr();
            this.fechaGrupal.min = hoy;
            this.fechaGrupal.value = hoy;
        }

        if (this.tablaUsuariosGrupal) {
            this.tablaUsuariosGrupal.innerHTML = '<tr><td colspan="8" class="loading">Seleccione una fecha</td></tr>';
        }

        this.cargarSelectHorariosGrupal();
        this.cargarSelectEstadosGrupal();

        this.renderizarTablaUsuariosGrupal();

        this.modalAsignacionGrupal.classList.add('active');
    }

    cerrarModalAsignacionGrupal() {
        this.modalAsignacionGrupal.classList.remove('active');
    }

    cargarSelectHorariosGrupal() {
        if (!this.horarioGrupal) return;
        this.horarioGrupal.innerHTML = '<option value="">-- Opcional --</option>';
        this.horarios.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h.IdHorario;
            opt.textContent = h.Descripcion;
            this.horarioGrupal.appendChild(opt);
        });
    }

    cargarSelectEstadosGrupal() {
        if (!this.estadoGrupal) return;
        const activo = this.estados.find(e => String(e.Descripcion || '').toUpperCase() === 'ACTIVO');
        this.estadoGrupal.innerHTML = '';
        if (activo) {
            const opt = document.createElement('option');
            opt.value = activo.IdEstado;
            opt.textContent = `${activo.IdEstado} - ${activo.Descripcion}`;
            opt.selected = true;
            this.estadoGrupal.appendChild(opt);
            this.estadoGrupal.disabled = true;
        }
    }

    renderizarTablaUsuariosGrupal() {
        if (!this.tablaUsuariosGrupal) return;

        const fecha = this.fechaGrupal?.value;
        if (!fecha) {
            this.tablaUsuariosGrupal.innerHTML = '<tr><td colspan="8" class="loading">Seleccione una fecha</td></tr>';
            return;
        }

        const hoy = this._fechaHoyStr();
        if (fecha < hoy) {
            this.mostrarMensaje('No se puede seleccionar una fecha anterior a hoy', 'warning');
            this.fechaGrupal.value = hoy;
            return this.renderizarTablaUsuariosGrupal();
        }

        if (!this._esFechaValida(fecha)) {
            this.mostrarMensaje('Fecha inválida', 'warning');
            return;
        }

        const horarioDefault = this.horarioGrupal?.value;
        const estadoDefault = this.estadoGrupal?.value;

        this.tablaUsuariosGrupal.innerHTML = '';

        const usuariosActivos = this.usuarios.filter(u => u.seleccionable);

        usuariosActivos.forEach(u => {
            const row = document.createElement('tr');
            const tieneNL = this._tieneNoLaborable(u.IdUsuario, fecha);
            const tieneAsig = this._tieneAsignacion(u.IdUsuario, fecha);

            const disabled = (tieneNL || tieneAsig) ? 'disabled' : '';

            row.innerHTML = `
                <td class="checkbox-column">
                    <input type="checkbox" class="checkbox-usuario-grupal"
                           data-id="${u.IdUsuario}"
                           data-nombre="${u.Nombres} ${u.Apellidos}"
                           ${disabled}>
                </td>
                <td>${this._escape(u.Nombres)} ${this._escape(u.Apellidos)}</td>
                <td>
                    <select class="select-horario-grupal" data-id="${u.IdUsuario}">
                        <option value="">-- Seleccione --</option>
                        ${this.horarios.map(h => `<option value="${h.IdHorario}" ${horarioDefault == h.IdHorario ? 'selected' : ''}>${this._escape(h.Descripcion)}</option>`).join('')}
                    </select>
                </td>
                <td class="ing-cell">--:--</td>
                <td class="sal-cell">--:--</td>
                <td class="ing-alm-cell">--:--</td>
                <td class="sal-alm-cell">--:--</td>
                <td>
                    <select class="select-estado-grupal" disabled>
                        ${this.estados.map(e => `<option value="${e.IdEstado}" ${estadoDefault == e.IdEstado ? 'selected' : ''}>${this._escape(e.Descripcion)}</option>`).join('')}
                    </select>
                </td>
            `;
            this.tablaUsuariosGrupal.appendChild(row);

            const selectH = row.querySelector('.select-horario-grupal');
            if (selectH) {
                selectH.addEventListener('change', () => {

                    const h = this.horarios.find(x => x.IdHorario == selectH.value);
                    if (!h) return;
                    row.querySelector('.ing-cell').textContent = this._formatearHora(h.HoraIngreso);
                    row.querySelector('.sal-cell').textContent = this._formatearHora(h.HoraSalida);
                    row.querySelector('.ing-alm-cell').textContent = this._formatearHora(h.HoraIngAlmuerzo);
                    row.querySelector('.sal-alm-cell').textContent = this._formatearHora(h.HoraSalAlmuerzo);
                });
            }
        });

        if (this.seleccionarTodos) {
            this.seleccionarTodos.onchange = (e) => {
                this.tablaUsuariosGrupal.querySelectorAll('.checkbox-usuario-grupal:not([disabled])').forEach(cb => cb.checked = e.target.checked);
            };
        }

        if (this.totalUsuariosGrupal) this.totalUsuariosGrupal.textContent = usuariosActivos.length;
        if (this.busquedaGrupal) this.filtrarUsuariosGrupal(this.busquedaGrupal.value);

        this.tablaUsuariosGrupal.querySelectorAll('.select-horario-grupal').forEach(sel => {
            if (sel.value) {
                sel.dispatchEvent(new Event('change'));
            }
        });

    }

    filtrarUsuariosGrupal(texto) {
        if (!this.tablaUsuariosGrupal) return;
        const t = texto.toLowerCase().trim();
        const filas = this.tablaUsuariosGrupal.querySelectorAll('tr');
        let visibles = 0;
        filas.forEach(fila => {
            const celdas = fila.querySelectorAll('td');
            let txt = '';
            for (let i = 1; i < celdas.length; i++) txt += celdas[i].textContent.toLowerCase() + ' ';
            if (t === '' || txt.includes(t)) { fila.style.display = ''; visibles++; }
            else fila.style.display = 'none';
        });
        if (this.mostradosGrupal) this.mostradosGrupal.textContent = visibles;
    }

    async guardarAsignacionesGrupal() {
        const fecha = this.fechaGrupal?.value;
        if (!fecha) { this.mostrarMensaje('Seleccione una fecha', 'warning'); return; }
        if (!this._esFechaValida(fecha)) { this.mostrarMensaje('Fecha inválida', 'warning'); return; }

        const checks = this.tablaUsuariosGrupal.querySelectorAll('.checkbox-usuario-grupal:checked:not([disabled])');
        if (checks.length === 0) { this.mostrarMensaje('Seleccione al menos un usuario', 'warning'); return; }
        if (!confirm(`¿Crear ${checks.length} asignaciones para ${this._formatearFecha(fecha)}?`)) return;

        let ok = 0, fail = 0;
        const originalText = this.btnGuardarGrupal.innerHTML;
        this.btnGuardarGrupal.disabled = true;
        this.btnGuardarGrupal.innerHTML = `<i class="fas fa-spinner fa-spin"></i> (0/${checks.length})`;

        for (let i = 0; i < checks.length; i++) {
            const cb = checks[i];
            const idUsuario = parseInt(cb.dataset.id);
            const row = cb.closest('tr');
            const selH = row.querySelector('.select-horario-grupal');
            const selE = row.querySelector('.select-estado-grupal');
            const idHorario = selH ? parseInt(selH.value) : null;
            const idEstado = selE ? parseInt(selE.value) : null;

            if (!idHorario || !idEstado) { fail++; continue; }

            const h = this.horarios.find(x => x.IdHorario === idHorario);
            if (!h) { fail++; continue; }

            if (this._tieneAsignacion(idUsuario, fecha)) { fail++; continue; }

            const payload = {
                IdUsuario: idUsuario,
                IdHorario: idHorario,
                Fecha: fecha,
                IngEsperado: this._normalizarHora(h.HoraIngreso),
                SalEsperada: this._normalizarHora(h.HoraSalida),
                IngAlmuerzoEsperado: this._normalizarHora(h.HoraIngAlmuerzo) || null,
                SalAlmuerzoEsperado: this._normalizarHora(h.HoraSalAlmuerzo) || null,
                IdEstado: idEstado,
                IdUsuarioCreacion: this.usuarioActual.IdUsuario
            };

            const r = await this.asignacionService.create(payload);
            if (r.success) ok++; else fail++;

            this.btnGuardarGrupal.innerHTML = `<i class="fas fa-spinner fa-spin"></i> (${i + 1}/${checks.length})`;
            await new Promise(res => setTimeout(res, 80));
        }

        this.btnGuardarGrupal.disabled = false;
        this.btnGuardarGrupal.innerHTML = originalText;

        if (ok > 0) {
            this.mostrarMensaje(`${ok} asignaciones creadas`, 'success');
            await this.cargarAsignaciones();
        }
        if (fail > 0) {
            this.mostrarMensaje(`${fail} no se pudieron crear`, 'warning');
        }

        this.cerrarModalAsignacionGrupal();
    }

    // ==========================================
    // DÍA NO LABORABLE (individual/fecha específica)
    // ==========================================
    abrirModalNoLaborable() {
        console.log('📌 abrirModalNoLaborable()');

        // Cerrar otros modales
        document.querySelectorAll('.modal.active').forEach(m => {
            if (m.id !== 'modalNoLaborable') m.classList.remove('active');
        });

        if (this.seleccionarTodosNoLaborable) this.seleccionarTodosNoLaborable.checked = false;

        // ============================================
        // ✅ FECHA POR DEFECTO = HOY + BLOQUEAR PASADAS
        // ============================================
        if (this.fechaNoLaborable) {
            const hoy = this._fechaHoyStr();
            this.fechaNoLaborable.min = hoy;
            this.fechaNoLaborable.value = hoy;
        }

        if (this.tablaUsuariosNoLaborable) {
            this.tablaUsuariosNoLaborable.innerHTML = '<tr><td colspan="2" class="loading">Seleccione una fecha</td></tr>';
        }

        this.renderizarTablaUsuariosNoLaborable();

        this.modalNoLaborable.classList.add('active');
    }

    cerrarModalNoLaborable() {
        this.modalNoLaborable.classList.remove('active');
    }

    async renderizarTablaUsuariosNoLaborable() {
        if (!this.tablaUsuariosNoLaborable) return;
        const fecha = this.fechaNoLaborable?.value;
        if (!fecha) {
            this.tablaUsuariosNoLaborable.innerHTML = '<tr><td colspan="2" class="loading">Seleccione una fecha</td></tr>';
            return;
        }

        const hoy = this._fechaHoyStr();
        if (fecha < hoy) {
            this.mostrarMensaje('No se puede seleccionar una fecha anterior a hoy', 'warning');
            this.fechaNoLaborable.value = hoy;
            return this.renderizarTablaUsuariosNoLaborable();
        }

        if (!this._esFechaValida(fecha)) {
            this.mostrarMensaje('Fecha inválida', 'warning');
            return;
        }

        this.tablaUsuariosNoLaborable.innerHTML = '';

        const usuariosActivos = this.usuarios.filter(u => u.seleccionable);

        usuariosActivos.forEach(u => {
            const tieneNL = this._tieneNoLaborable(u.IdUsuario, fecha);
            const tieneAsig = this._tieneAsignacion(u.IdUsuario, fecha);

            if (tieneNL) {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="checkbox-column"><input type="checkbox" disabled></td>
                    <td style="color:#856404;">🚫 ${this._escape(u.Nombres)} ${this._escape(u.Apellidos)} — Ya NO LABORABLE</td>
                `;
                this.tablaUsuariosNoLaborable.appendChild(row);
                return;
            }

            if (tieneAsig) return; // No se muestra

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="checkbox-column">
                    <input type="checkbox" class="checkbox-usuario-nl" data-id="${u.IdUsuario}">
                </td>
                <td>${this._escape(u.Nombres)} ${this._escape(u.Apellidos)} (${this._escape(u.NombreUsuario)})</td>
            `;
            this.tablaUsuariosNoLaborable.appendChild(row);
        });

        if (this.seleccionarTodosNoLaborable) {
            this.seleccionarTodosNoLaborable.onchange = (e) => {
                this.tablaUsuariosNoLaborable.querySelectorAll('.checkbox-usuario-nl').forEach(cb => cb.checked = e.target.checked);
            };
        }

        if (this.totalUsuariosNoLaborable) this.totalUsuariosNoLaborable.textContent = usuariosActivos.length;
        if (this.busquedaNoLaborable) this.filtrarUsuariosNoLaborable(this.busquedaNoLaborable.value);
    }

    filtrarUsuariosNoLaborable(texto) {
        if (!this.tablaUsuariosNoLaborable) return;
        const t = texto.toLowerCase().trim();
        const filas = this.tablaUsuariosNoLaborable.querySelectorAll('tr');
        let visibles = 0;
        filas.forEach(fila => {
            const txt = fila.textContent.toLowerCase();
            if (t === '' || txt.includes(t)) { fila.style.display = ''; visibles++; }
            else fila.style.display = 'none';
        });
        if (this.mostradosNoLaborable) this.mostradosNoLaborable.textContent = visibles;
    }

    async guardarNoLaborables() {
        const fecha = this.fechaNoLaborable?.value;
        if (!fecha) { this.mostrarMensaje('Seleccione una fecha', 'warning'); return; }
        if (!this._esFechaValida(fecha)) { this.mostrarMensaje('Fecha inválida', 'warning'); return; }

        const checks = this.tablaUsuariosNoLaborable.querySelectorAll('.checkbox-usuario-nl:checked');
        if (checks.length === 0) { this.mostrarMensaje('Seleccione al menos un usuario', 'warning'); return; }
        if (!confirm(`¿Marcar ${checks.length} usuarios como NO LABORABLES el ${this._formatearFecha(fecha)}?`)) return;

        const originalText = this.btnGuardarNoLaborable.innerHTML;
        this.btnGuardarNoLaborable.disabled = true;

        let ok = 0, fail = 0;
        for (let i = 0; i < checks.length; i++) {
            const cb = checks[i];
            const idUsuario = parseInt(cb.dataset.id);
            this.btnGuardarNoLaborable.innerHTML = `<i class="fas fa-spinner fa-spin"></i> (${i + 1}/${checks.length})`;

            const r = await this.asignacionService.crearNoLaborable({
                IdUsuario: idUsuario,
                Fecha: fecha,
                Observacion: 'NO LABORA - DÍA NO LABORABLE',
                IdUsuarioCreacion: this.usuarioActual.IdUsuario
            });

            if (r.success) ok++; else fail++;
            await new Promise(res => setTimeout(res, 80));
        }

        this.btnGuardarNoLaborable.disabled = false;
        this.btnGuardarNoLaborable.innerHTML = originalText;

        if (ok > 0) {
            this.mostrarMensaje(`${ok} usuarios marcados como NO LABORABLES`, 'success');
            await this.cargarAsignaciones();
            await this.cargarMarcaciones();
        }
        if (fail > 0) this.mostrarMensaje(`${fail} no se pudieron marcar`, 'warning');

        this.cerrarModalNoLaborable();
    }

    // ==========================================
    // HELPERS
    // ==========================================
    _obtenerNombreUsuario(idUsuario) {
        if (!idUsuario) return 'N/A';
        const u = this.usuarios.find(x => x.IdUsuario === idUsuario);
        return u ? `${u.Nombres} ${u.Apellidos}`.trim() : `ID: ${idUsuario}`;
    }

    _obtenerNombreHorario(idHorario) {
        if (!idHorario) return 'N/A';
        const h = this.horarios.find(x => x.IdHorario === idHorario);
        return h ? h.Descripcion : `ID: ${idHorario}`;
    }

    _obtenerDescripcionEstado(idEstado) {
        if (!idEstado) return 'N/A';
        const e = this.estados.find(x => x.IdEstado === idEstado);
        return e ? e.Descripcion : 'Desconocido';
    }

    _esFechaEditable(fecha) {
        if (!fecha) return false;
        return this._normalizarFecha(fecha) >= this._fechaHoyStr();
    }

    _esFechaValida(fecha) {
        return this._esFechaEditable(fecha);
    }

    _fechaHoyStr() {
        const hoy = new Date();
        return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    }

    _normalizarFecha(v) {
        if (!v) return '';
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
        try {
            const d = new Date(v);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        } catch { return ''; }
    }

    _normalizarHora(v) {
        if (!v) return '';
        const s = String(v);
        if (s.includes('T')) {
            const m = s.match(/T(\d{2}):(\d{2})/);
            if (m) return `${m[1]}:${m[2]}`;
        }
        if (s.includes(':')) {
            const p = s.split(':');
            return `${String(p[0]).padStart(2, '0')}:${String(p[1]).padStart(2, '0')}`;
        }
        return '';
    }

    _formatearFecha(f) {
        const n = this._normalizarFecha(f);
        if (!n) return 'N/A';
        const [y, m, d] = n.split('-');
        return `${d}/${m}/${y}`;
    }

    _formatearHora(h) {
        const n = this._normalizarHora(h);
        return n || 'N/A';
    }

    _formatearFechaISO(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    _formatearFechaPeru(v) {
        if (!v) return 'N/A';
        try {
            let s = String(v).trim();
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) s = s.replace(' ', 'T') + 'Z';
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !s.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(s)) s += 'Z';
            const d = new Date(s);
            if (isNaN(d.getTime())) return String(v);
            const fmt = new Intl.DateTimeFormat('es-PE', {
                timeZone: 'America/Lima',
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false
            });
            const parts = fmt.formatToParts(d);
            const get = (t) => parts.find(p => p.type === t)?.value || '';
            return `${get('day')}/${get('month')}/${get('year')}, ${get('hour')}:${get('minute')}`;
        } catch { return String(v); }
    }

    _tieneNoLaborable(idUsuario, fecha) {
        return this.marcacionesExistentes.some(m => {
            const f = this._normalizarFecha(m.Fecha);
            return m.IdUsuario === idUsuario &&
                f === this._normalizarFecha(fecha) &&
                (m.ObsGeneral || m.Observacion || '').toUpperCase().includes('NO LABORA');
        });
    }

    _tieneAsignacion(idUsuario, fecha) {
        return this.todasAsignaciones.some(a => {
            const f = this._normalizarFecha(a.Fecha);
            return a.IdUsuario === idUsuario &&
                f === this._normalizarFecha(fecha) &&
                a.IdEstado === 1;
        });
    }

    existeAsignacionDuplicada(idUsuario, fecha, idExcluir = null) {
        return this.todasAsignaciones.some(a => {
            if (idExcluir && a.IdAsignacion === idExcluir) return false;
            const f = this._normalizarFecha(a.Fecha);
            return a.IdUsuario === idUsuario &&
                f === this._normalizarFecha(fecha) &&
                a.IdEstado === 1;
        });
    }

    _escape(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    mostrarLoading(mostrar) {
        if (this.tablaBody && mostrar) {
            this.tablaBody.innerHTML = '<tr><td colspan="20" class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>';
        }
    }

    mostrarMensaje(mensaje, tipo = 'info') {
        let box = document.querySelector('.message-box');
        if (!box) {
            box = document.createElement('div');
            box.className = 'message-box';
            document.body.appendChild(box);
        }
        const iconos = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };
        box.innerHTML = `<i class="fas ${iconos[tipo] || iconos.info}"></i> <span>${mensaje}</span>`;
        box.className = `message-box show ${tipo}`;
        clearTimeout(this._msgTimeout);
        this._msgTimeout = setTimeout(() => box.classList.remove('show'), 4000);
    }

    // ==========================================
    // EXPORTAR CSV
    // ==========================================
    async exportarExcel() {
        if (this.asignaciones.length === 0) {
            this.mostrarMensaje('No hay asignaciones para exportar', 'warning');
            return;
        }

        const DELIM = ';';
        const columnas = [
            { header: 'ID', key: 'IdAsignacion' },
            { header: 'Usuario', key: 'Usuario' },
            { header: 'Horario', key: 'Horario' },
            { header: 'Fecha', key: 'Fecha' },
            { header: 'Ingreso Esperado', key: 'IngEsperado' },
            { header: 'Salida Esperada', key: 'SalEsperada' },
            { header: 'Ingreso Almuerzo', key: 'IngAlmuerzo' },
            { header: 'Salida Almuerzo', key: 'SalAlmuerzo' },
            { header: 'Estado', key: 'EstadoDescripcion' },
            { header: 'Usuario Creación', key: 'UsuarioCreacion' },
            { header: 'Fecha Creación', key: 'FechaCreacion' },
            { header: 'Usuario Modificación', key: 'UsuarioModificacion' },
            { header: 'Fecha Modificación', key: 'FechaModificacion' }
        ];

        const datos = this.asignaciones.map(a => ({
            IdAsignacion: a.IdAsignacion,
            Usuario: this._obtenerNombreUsuario(a.IdUsuario),
            Horario: this._obtenerNombreHorario(a.IdHorario),
            Fecha: this._formatearFecha(a.Fecha),
            IngEsperado: this._formatearHora(a.IngEsperado),
            SalEsperada: this._formatearHora(a.SalEsperada),
            IngAlmuerzo: this._formatearHora(a.IngAlmuerzoEsperado),
            SalAlmuerzo: this._formatearHora(a.SalAlmuerzoEsperado),
            EstadoDescripcion: this._obtenerDescripcionEstado(a.IdEstado),
            UsuarioCreacion: this._obtenerNombreUsuario(a.IdUsuarioCreacion),
            FechaCreacion: this._formatearFechaPeru(a.FechaCreacion),
            UsuarioModificacion: this._obtenerNombreUsuario(a.IdUsuarioModificacion),
            FechaModificacion: this._formatearFechaPeru(a.FechaModificacion)
        }));

        const esc = (v) => {
            let s = (v === null || v === undefined) ? '' : String(v);
            return `"${s.replace(/"/g, '""')}"`;
        };

        const lineas = [`sep=${DELIM}`];
        lineas.push(columnas.map(c => esc(c.header)).join(DELIM));
        datos.forEach(row => lineas.push(columnas.map(c => esc(row[c.key])).join(DELIM)));

        const csv = lineas.join('\r\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const now = new Date();
        const sufijo = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        link.href = url;
        link.download = `Asignaciones_${sufijo}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.mostrarMensaje(`${datos.length} asignaciones exportadas`, 'success');
    }

    // ==========================================
    // NAVEGACIÓN
    // ==========================================
    irAlMenu() { window.location.href = this.config?.ROUTES?.MENU || 'Menu.html'; }
    irAlPerfil() { window.location.href = this.config?.ROUTES?.PERFIL || 'Mi-Perfil.html'; }
    redirigirALogin() { window.location.replace(this.config?.ROUTES?.LOGIN || 'index.html'); }

    cerrarSesion() {
        this.mostrarMensaje('Sesión cerrada correctamente', 'success');
        setTimeout(() => this.auth.cerrarSesion(), 700);
    }
}

if (typeof window !== 'undefined') {
    window.AsignacionController = AsignacionController;
}