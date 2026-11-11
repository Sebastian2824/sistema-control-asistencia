// ==============================================
// CONTROLLER: HorarioController
// Módulo "Gestión de Horarios"
// Depende de: AuthService, HorarioService
//
// REGLAS:
//  - TipoHorario: PRESENCIAL | VIRTUAL (sin ALMUERZO)
//  - Almuerzo: opcional (ambas horas o ninguna)
//  - Si se llena almuerzo, diferencia debe ser exactamente 60 minutos
//  - TiempoHoras / TiempoMinutos se envían al backend
// ==============================================

const OPTIMIZACION_HORARIOS = {
    REGISTROS_POR_PAGINA: 10,
    MINUTOS_ALMUERZO: 60
};

class HorarioController {

    constructor(authService, horarioService, config) {
        this.auth = authService;
        this.horarioService = horarioService;
        this.config = config || {};

        this.usuarioActual = null;
        this.horarios = [];
        this.horariosFiltrados = [];
        this.horariosEliminados = [];
        this.estados = [];
        this.usuarios = [];
        this.horarioAEliminar = null;
        this.horarioARestaurar = null;
        this.filtroActual = 'todos';
        this.cargando = false;
        this.guardando = false;
        this.countdownInterval = null;
        this.isDeleting = false;

        this.paginaActual = 1;
        this.registrosPorPagina = OPTIMIZACION_HORARIOS.REGISTROS_POR_PAGINA;
        this.totalPaginas = 1;
        this.horariosEliminadosPaginaActual = 1;
        this.horariosEliminadosRegistrosPorPagina = 5;
        this.horariosEliminadosTotalPaginas = 1;

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
        console.log('🔧 Inicializando HorarioController...');

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

        await this.cargarEstados();
        await this.cargarUsuarios();
        await this.cargarHorarios();

        console.log('✅ HorarioController inicializado');
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
        this.tipoHorarioFiltro = document.getElementById('tipoHorarioFiltro');
        this.estadoFiltro = document.getElementById('estadoFiltro');
        this.btnRestaurarHorarios = document.getElementById('btnRestaurarHorarios');
        this.btnAgregar = document.getElementById('btnAgregar');
        this.btnExportarExcel = document.getElementById('btnExportarExcel');
        this.btnRecargar = document.getElementById('btnRecargar');
        this.tablaBody = document.getElementById('tablaHorariosBody');

        // Modal Horario
        this.modalHorario = document.getElementById('modalHorario');
        this.modalTitle = document.getElementById('modalTitle');
        this.horarioForm = document.getElementById('horarioForm');
        this.horarioId = document.getElementById('horarioId');
        this.closeModalBtn = document.getElementById('closeModalBtn');
        this.btnCancelar = document.getElementById('btnCancelar');
        this.btnGuardar = document.getElementById('btnGuardar');

        // Campos
        this.descripcionInput = document.getElementById('descripcion');
        this.tipoHorarioSelect = document.getElementById('tipoHorario');
        this.tiempoHorasInput = document.getElementById('tiempoHoras');
        this.tiempoMinutosInput = document.getElementById('tiempoMinutos');
        this.horaIngresoInput = document.getElementById('horaIngreso');
        this.horaSalidaInput = document.getElementById('horaSalida');
        this.horaIngAlmuerzoInput = document.getElementById('horaIngAlmuerzo');
        this.horaSalAlmuerzoInput = document.getElementById('horaSalAlmuerzo');
        this.checkTieneAlmuerzo = document.getElementById('tieneAlmuerzo');
        this.idEstadoSelect = document.getElementById('idEstado');
        this.estadoDescripcionSpan = document.getElementById('estadoDescripcion');
        this.checkEsAleatorio = document.getElementById('esAleatorio');
        this.avisoDuracionCorta = document.getElementById('avisoDuracionCorta');
        this.avisoDuracionCortaTexto = document.getElementById('avisoDuracionCortaTexto');

        // Modal Eliminar
        this.modalConfirmar = document.getElementById('modalConfirmar');
        this.confirmarMensajeHorario = document.getElementById('confirmarMensajeHorario');
        this.countdownTimer = document.getElementById('countdownTimer');
        this.btnCancelarEliminar = document.getElementById('btnCancelarEliminar');
        this.btnConfirmarEliminar = document.getElementById('btnConfirmarEliminar');
        this.closeConfirmModalBtn = document.getElementById('closeConfirmModalBtn');

        // Modal Restaurar
        this.modalRestaurarHorarios = document.getElementById('modalRestaurarHorarios');
        this.tablaHorariosEliminadosBody = document.getElementById('tablaHorariosEliminadosBody');
        this.closeRestaurarHorariosModalBtn = document.getElementById('closeRestaurarHorariosModalBtn');
        this.modalRestaurarHorarioConfirmar = document.getElementById('modalRestaurarHorarioConfirmar');
        this.restaurarHorarioMensaje = document.getElementById('restaurarHorarioMensaje');
        this.closeRestaurarHorarioConfirmModalBtn = document.getElementById('closeRestaurarHorarioConfirmModalBtn');
        this.btnCancelarRestaurarHorario = document.getElementById('btnCancelarRestaurarHorario');
        this.btnConfirmarRestaurarHorario = document.getElementById('btnConfirmarRestaurarHorario');

        // Paginación
        this.paginacionContainer = document.getElementById('paginacionContainer');
        this.btnPrimeraPagina = document.getElementById('btnPrimeraPagina');
        this.btnPaginaAnterior = document.getElementById('btnPaginaAnterior');
        this.btnPaginaSiguiente = document.getElementById('btnPaginaSiguiente');
        this.btnUltimaPagina = document.getElementById('btnUltimaPagina');
        this.paginaActualInfo = document.getElementById('paginaActualInfo');
        this.inicioRegistro = document.getElementById('inicioRegistro');
        this.finRegistro = document.getElementById('finRegistro');
        this.totalRegistrosSpan = document.getElementById('totalRegistros');
    }

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
        document.addEventListener('click', () => { if (this.userMenu) this.userMenu.classList.remove('active'); });

        if (this.logoutBtn) this.logoutBtn.addEventListener('click', (e) => { e.stopPropagation(); this.cerrarSesion(); });
        if (this.menuBtn) this.menuBtn.addEventListener('click', (e) => { e.stopPropagation(); this.irAlMenu(); });
        if (this.perfilBtn) this.perfilBtn.addEventListener('click', (e) => { e.stopPropagation(); this.irAlPerfil(); });
        if (this.logoArea) this.logoArea.addEventListener('click', () => this.irAlMenu());

        // Toolbar
        if (this.btnAgregar) this.btnAgregar.addEventListener('click', () => this.abrirModalAgregar());
        if (this.btnRecargar) this.btnRecargar.addEventListener('click', () => this.cargarHorarios(true));
        if (this.btnExportarExcel) this.btnExportarExcel.addEventListener('click', () => this.exportarExcel());
        if (this.btnRestaurarHorarios) this.btnRestaurarHorarios.addEventListener('click', () => this.abrirModalRestaurarHorarios());

        // Filtros
        if (this.tipoHorarioFiltro) this.tipoHorarioFiltro.addEventListener('change', (e) => {
            this.filtroActual = e.target.value; this.paginaActual = 1; this.aplicarFiltroYRenderizar();
        });
        if (this.estadoFiltro) this.estadoFiltro.addEventListener('change', () => {
            this.paginaActual = 1; this.aplicarFiltroYRenderizar();
        });

        // Modal Horario
        if (this.closeModalBtn) this.closeModalBtn.addEventListener('click', () => this.cerrarModalHorario());
        if (this.btnCancelar) this.btnCancelar.addEventListener('click', () => this.cerrarModalHorario());
        if (this.horarioForm) this.horarioForm.addEventListener('submit', (e) => this.guardarHorario(e));

        if (this.horaIngresoInput) {
            this.horaIngresoInput.addEventListener('change', () => this._recalcularDesdeIngreso());
        }
        if (this.horaSalidaInput) {
            this.horaSalidaInput.addEventListener('change', () => this._recalcularDesdeSalida());
        }

        // Auto-completado de almuerzo: definir ingreso → salida +60 min
        if (this.horaIngAlmuerzoInput) {
            this.horaIngAlmuerzoInput.addEventListener('change', () => this._recalcularSalidaAlmuerzoDesdeIngreso());
        }
        // Auto-completado de almuerzo: definir salida → ingreso -60 min
        if (this.horaSalAlmuerzoInput) {
            this.horaSalAlmuerzoInput.addEventListener('change', () => this._recalcularIngresoAlmuerzoDesdeSalida());
        }

        // Duración cambia → recalcular horas y validar almuerzo
        if (this.tiempoHorasInput) {
            this.tiempoHorasInput.addEventListener('input', () => {
                this._sincronizarHorasAMinutos();
                this._actualizarEstadoAlmuerzoPorDuracion();
                this._recalcularDesdeIngreso();
            });
        }
        if (this.tiempoMinutosInput) {
            this.tiempoMinutosInput.addEventListener('input', () => {
                this._sincronizarMinutosAHoras();
                this._actualizarEstadoAlmuerzoPorDuracion();
                this._recalcularDesdeIngreso();
            });
        }

        // Checkbox aleatorio
        if (this.checkEsAleatorio) {
            this.checkEsAleatorio.addEventListener('change', () => this._toggleAleatorio());
        }

        // Checkbox almuerzo
        if (this.checkTieneAlmuerzo) {
            this.checkTieneAlmuerzo.addEventListener('change', () => this._toggleCamposAlmuerzo());
        }

        // Sincronización horas ↔ minutos
        if (this.tiempoHorasInput) this.tiempoHorasInput.addEventListener('input', () => this._sincronizarHorasAMinutos());
        if (this.tiempoMinutosInput) this.tiempoMinutosInput.addEventListener('input', () => this._sincronizarMinutosAHoras());

        // Modal Eliminar
        if (this.closeConfirmModalBtn) this.closeConfirmModalBtn.addEventListener('click', () => this.cancelarEliminacion());
        if (this.btnCancelarEliminar) this.btnCancelarEliminar.addEventListener('click', () => this.cancelarEliminacion());
        if (this.btnConfirmarEliminar) this.btnConfirmarEliminar.addEventListener('click', () => this.confirmarEliminar());

        // Modal Restaurar
        if (this.closeRestaurarHorariosModalBtn) this.closeRestaurarHorariosModalBtn.addEventListener('click', () => this.cerrarModalRestaurarHorarios());
        if (this.closeRestaurarHorarioConfirmModalBtn) this.closeRestaurarHorarioConfirmModalBtn.addEventListener('click', () => this.cerrarModalRestaurarHorarioConfirmar());
        if (this.btnCancelarRestaurarHorario) this.btnCancelarRestaurarHorario.addEventListener('click', () => this.cerrarModalRestaurarHorarioConfirmar());
        if (this.btnConfirmarRestaurarHorario) this.btnConfirmarRestaurarHorario.addEventListener('click', () => this.confirmarRestaurarHorario());

        // Paginación
        if (this.btnPrimeraPagina) this.btnPrimeraPagina.addEventListener('click', () => this.irPrimeraPagina());
        if (this.btnPaginaAnterior) this.btnPaginaAnterior.addEventListener('click', () => this.irPaginaAnterior());
        if (this.btnPaginaSiguiente) this.btnPaginaSiguiente.addEventListener('click', () => this.irPaginaSiguiente());
        if (this.btnUltimaPagina) this.btnUltimaPagina.addEventListener('click', () => this.irUltimaPagina());

        const btnPrimeraElim = document.getElementById('btnPrimeraEliminados');
        const btnAnteriorElim = document.getElementById('btnAnteriorEliminados');
        const btnSiguienteElim = document.getElementById('btnSiguienteEliminados');
        const btnUltimaElim = document.getElementById('btnUltimaEliminados');

        if (btnPrimeraElim) btnPrimeraElim.addEventListener('click', () => this.irPrimeraEliminados());
        if (btnAnteriorElim) btnAnteriorElim.addEventListener('click', () => this.irAnteriorEliminados());
        if (btnSiguienteElim) btnSiguienteElim.addEventListener('click', () => this.irSiguienteEliminados());
        if (btnUltimaElim) btnUltimaElim.addEventListener('click', () => this.irUltimaEliminados());
    }

    // ==========================================
    // SINCRONIZACIÓN HORAS ↔ MINUTOS
    // ==========================================
    _sincronizarHorasAMinutos() {
        const horas = parseInt(this.tiempoHorasInput.value) || 0;
        this.tiempoMinutosInput.value = horas * 60;
    }

    _sincronizarMinutosAHoras() {
        const minutos = parseInt(this.tiempoMinutosInput.value) || 0;
        if (minutos % 60 === 0) {
            this.tiempoHorasInput.value = minutos / 60;
        }
    }

    // ==========================================
    // TOGGLE ALMUERZO
    // ==========================================
    _toggleCamposAlmuerzo() {
        const habilitar = (this.checkTieneAlmuerzo?.checked || false)
            && !this.checkTieneAlmuerzo?.disabled;

        if (this.horaIngAlmuerzoInput) this.horaIngAlmuerzoInput.disabled = !habilitar;
        if (this.horaSalAlmuerzoInput) this.horaSalAlmuerzoInput.disabled = !habilitar;

        if (!habilitar) {
            if (this.horaIngAlmuerzoInput) this.horaIngAlmuerzoInput.value = '';
            if (this.horaSalAlmuerzoInput) this.horaSalAlmuerzoInput.value = '';
        }
    }

    // ==========================================
    // CARGA DE CATÁLOGOS
    // ==========================================
    async cargarEstados() {
        try {
            const r = await this.horarioService.getEstados();
            if (r.success) {
                this.estados = r.data || [];
                this._poblarSelectEstados();
            }
        } catch (error) { console.error('❌ Error estados:', error); }
    }

    _poblarSelectEstados() {
        if (!this.idEstadoSelect) return;
        this.idEstadoSelect.innerHTML = '<option value="">-- Seleccione --</option>';
        this.estados.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.IdEstado;
            opt.textContent = `${e.IdEstado} - ${e.Descripcion}`;
            this.idEstadoSelect.appendChild(opt);
        });
        this.idEstadoSelect.addEventListener('change', () => {
            const id = parseInt(this.idEstadoSelect.value);
            const est = this.estados.find(x => x.IdEstado === id);
            if (this.estadoDescripcionSpan) {
                this.estadoDescripcionSpan.textContent = est ? `📌 ${est.Descripcion}` : '';
            }
        });
    }

    async cargarUsuarios() {
        try {
            const r = await this.horarioService.getUsuarios();
            if (r.success) this.usuarios = r.data || [];
        } catch (error) { console.error('❌ Error usuarios:', error); }
    }

    async cargarHorarios(forzar = false) {
        if (this.cargando) return;
        this.cargando = true;

        try {
            this.mostrarLoading(true);
            const r = await this.horarioService.getAll();

            if (!r.success) {
                this.mostrarMensaje(`Error al cargar horarios: ${r.error}`, 'error');
                if (this.tablaBody) this.tablaBody.innerHTML = `<tr><td colspan="13" class="loading">Error al cargar horarios: ${r.error}</td></tr>`;
                return;
            }

            // Solo activos en la tabla principal
            this.horarios = (r.data || []).filter(h => h.IdEstado === 1);
            this.filtroActual = 'todos';
            if (this.tipoHorarioFiltro) this.tipoHorarioFiltro.value = 'todos';
            if (this.estadoFiltro) this.estadoFiltro.value = '';
            this.paginaActual = 1;

            console.log(`✅ Horarios activos: ${this.horarios.length}`);
            this.aplicarFiltroYRenderizar();

        } catch (error) {
            console.error('❌ Error cargando horarios:', error);
            this.mostrarMensaje(`Error de conexión al cargar horarios`, 'error');
        } finally {
            this.cargando = false;
            this.mostrarLoading(false);
        }
    }

    // ==========================================
    // FILTRADO Y RENDER
    // ==========================================
    aplicarFiltroYRenderizar() {
        this.horariosFiltrados = this._aplicarFiltros();
        this.totalPaginas = Math.ceil(this.horariosFiltrados.length / this.registrosPorPagina) || 1;
        if (this.paginaActual > this.totalPaginas) this.paginaActual = this.totalPaginas;
        this.renderizarPaginaActual();
    }

    _aplicarFiltros() {
        let lista = [...this.horarios];

        const tipo = (this.filtroActual || 'todos').toLowerCase();
        if (tipo !== 'todos') {
            lista = lista.filter(h => String(h.TipoHorario || '').toLowerCase() === tipo);
        }

        if (this.estadoFiltro && this.estadoFiltro.value) {
            const idEstado = parseInt(this.estadoFiltro.value);
            lista = lista.filter(h => h.IdEstado === idEstado);
        }

        return lista;
    }

    renderizarPaginaActual() {
        if (!this.tablaBody) return;

        if (this.horariosFiltrados.length === 0) {
            this.tablaBody.innerHTML = `<tr><td colspan="15" class="loading">No hay horarios registrados</td></tr>`;
            if (this.paginacionContainer) this.paginacionContainer.style.display = 'none';
            return;
        }

        const inicio = (this.paginaActual - 1) * this.registrosPorPagina;
        const pagina = this.horariosFiltrados.slice(inicio, inicio + this.registrosPorPagina);

        this.tablaBody.innerHTML = '';
        pagina.forEach(h => this.tablaBody.appendChild(this._crearFilaHorario(h)));

        if (this.paginacionContainer) this.paginacionContainer.style.display = 'flex';
        this._actualizarControlesPaginacion();
        this._actualizarInfoRegistros();
        this._reasignarEventosBotones();
    }

    _crearFilaHorario(h) {
        const row = document.createElement('tr');
        const estadoDesc = this._obtenerDescripcionEstado(h.IdEstado);
        const estadoClass = estadoDesc.toUpperCase() === 'ACTIVO' ? 'badge-activo' : 'badge-eliminado';
        const nombreCreacion = this._obtenerNombreUsuario(h.IdUsuarioCreacion);
        const nombreModificacion = this._obtenerNombreUsuario(h.IdUsuarioModificacion);

        row.innerHTML = `
        <td>${h.IdHorario}</td>
        <td>${this._escape(h.Descripcion || '')}</td>
        <td>${this._escape(h.TipoHorario || '')}</td>
        <td>${h.TiempoHoras ?? 0}</td>
        <td>${h.TiempoMinutos ?? 0}</td>
        <td>${this._formatearHora(h.HoraIngreso)}</td>
        <td>${this._formatearHora(h.HoraSalida)}</td>
        <td>${this._formatearHora(h.HoraIngAlmuerzo)}</td>
        <td>${this._formatearHora(h.HoraSalAlmuerzo)}</td>
        <td><span class="${estadoClass}">${this._escape(estadoDesc)}</span></td>
        <td>${this._escape(nombreCreacion)}</td>
        <td>${this._formatearFecha(h.FechaCreacion)}</td>
        <td>${this._escape(nombreModificacion)}</td>
        <td>${this._formatearFecha(h.FechaModificacion)}</td>
        <td class="action-buttons">
            <button class="btn-edit" data-id="${h.IdHorario}"> <i class="fas fa-edit"></i> Editar</button>
            <button class="btn-delete" data-id="${h.IdHorario}"> <i class="fas fa-trash"></i> Eliminar</button>
        </td>
    `;
        return row;
    }

    _reasignarEventosBotones() {
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.onclick = () => this.abrirModalEditar(parseInt(btn.getAttribute('data-id')));
        });
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.onclick = () => this.abrirModalEliminar(parseInt(btn.getAttribute('data-id')));
        });
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

    // ============================================
// PAGINACIÓN DE HORARIOS ELIMINADOS
// ============================================
_actualizarControlesPaginacionEliminados() {
    const total = this.horariosEliminadosTotalPaginas || 1;
    const totalReg = this.horariosEliminados.length;
    const inicio = totalReg > 0 ? (this.horariosEliminadosPaginaActual - 1) * this.horariosEliminadosRegistrosPorPagina + 1 : 0;
    const fin = Math.min(inicio + this.horariosEliminadosRegistrosPorPagina - 1, totalReg);

    const inicioEl = document.getElementById('inicioEliminados');
    const finEl = document.getElementById('finEliminados');
    const totalEl = document.getElementById('totalEliminados');
    const paginaInfo = document.getElementById('paginaActualEliminados');

    if (inicioEl) inicioEl.textContent = inicio;
    if (finEl) finEl.textContent = fin;
    if (totalEl) totalEl.textContent = totalReg;
    if (paginaInfo) paginaInfo.textContent = `Página ${this.horariosEliminadosPaginaActual} de ${total}`;

    const btnPrimera = document.getElementById('btnPrimeraEliminados');
    const btnAnterior = document.getElementById('btnAnteriorEliminados');
    const btnSiguiente = document.getElementById('btnSiguienteEliminados');
    const btnUltima = document.getElementById('btnUltimaEliminados');

    if (btnPrimera) btnPrimera.disabled = this.horariosEliminadosPaginaActual === 1;
    if (btnAnterior) btnAnterior.disabled = this.horariosEliminadosPaginaActual === 1;
    if (btnSiguiente) btnSiguiente.disabled = this.horariosEliminadosPaginaActual === total;
    if (btnUltima) btnUltima.disabled = this.horariosEliminadosPaginaActual === total;
}

irPrimeraEliminados() {
    if (this.horariosEliminadosPaginaActual > 1) {
        this.horariosEliminadosPaginaActual = 1;
        this.renderizarPaginaHorariosEliminados();
    }
}

irAnteriorEliminados() {
    if (this.horariosEliminadosPaginaActual > 1) {
        this.horariosEliminadosPaginaActual--;
        this.renderizarPaginaHorariosEliminados();
    }
}

irSiguienteEliminados() {
    if (this.horariosEliminadosPaginaActual < this.horariosEliminadosTotalPaginas) {
        this.horariosEliminadosPaginaActual++;
        this.renderizarPaginaHorariosEliminados();
    }
}

irUltimaEliminados() {
    if (this.horariosEliminadosPaginaActual < this.horariosEliminadosTotalPaginas) {
        this.horariosEliminadosPaginaActual = this.horariosEliminadosTotalPaginas;
        this.renderizarPaginaHorariosEliminados();
    }
}

    _actualizarControlesPaginacion() {
        const total = this.totalPaginas;
        if (this.btnPrimeraPagina) this.btnPrimeraPagina.disabled = this.paginaActual === 1;
        if (this.btnPaginaAnterior) this.btnPaginaAnterior.disabled = this.paginaActual === 1;
        if (this.btnPaginaSiguiente) this.btnPaginaSiguiente.disabled = this.paginaActual === total;
        if (this.btnUltimaPagina) this.btnUltimaPagina.disabled = this.paginaActual === total;
        if (this.paginaActualInfo) this.paginaActualInfo.textContent = `Página ${this.paginaActual} de ${total}`;
    }

    _actualizarInfoRegistros() {
        const total = this.horariosFiltrados.length;
        const inicio = total > 0 ? (this.paginaActual - 1) * this.registrosPorPagina + 1 : 0;
        const fin = Math.min(inicio + this.registrosPorPagina - 1, total);
        if (this.inicioRegistro) this.inicioRegistro.textContent = inicio;
        if (this.finRegistro) this.finRegistro.textContent = fin;
        if (this.totalRegistrosSpan) this.totalRegistrosSpan.textContent = total;
    }

    // ==========================================
    // MODAL: AGREGAR
    // ==========================================
    abrirModalAgregar() {
        if (this.modalTitle) this.modalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Agregar Horario';
        if (this.horarioForm) this.horarioForm.reset();
        if (this.horarioId) this.horarioId.value = '';

        if (this.descripcionInput) this.descripcionInput.value = '';
        if (this.tipoHorarioSelect) this.tipoHorarioSelect.value = 'PRESENCIAL';
        if (this.tiempoHorasInput) this.tiempoHorasInput.value = 8;
        if (this.tiempoMinutosInput) this.tiempoMinutosInput.value = 480;
        if (this.horaIngresoInput) { this.horaIngresoInput.value = '09:00'; this.horaIngresoInput.disabled = false; }
        if (this.horaSalidaInput) { this.horaSalidaInput.value = '18:00'; this.horaSalidaInput.disabled = false; }
        if (this.horaIngAlmuerzoInput) this.horaIngAlmuerzoInput.value = '';
        if (this.horaSalAlmuerzoInput) this.horaSalAlmuerzoInput.value = '';
        if (this.checkTieneAlmuerzo) { this.checkTieneAlmuerzo.checked = false; this.checkTieneAlmuerzo.disabled = false; }
        if (this.checkEsAleatorio) this.checkEsAleatorio.checked = false;

        this._toggleCamposAlmuerzo();
        this._actualizarEstadoAlmuerzoPorDuracion();

        this._seleccionarEstadoActivo();
        if (this.idEstadoSelect) this.idEstadoSelect.disabled = true;

        this.modalHorario.classList.add('active');
    }

    _seleccionarEstadoActivo() {
        if (!this.idEstadoSelect || !this.estados.length) return;
        const activo = this.estados.find(e => String(e.Descripcion || '').toUpperCase().includes('ACTIVO'));
        if (activo) {
            this.idEstadoSelect.value = activo.IdEstado;
            if (this.estadoDescripcionSpan) this.estadoDescripcionSpan.textContent = `📌 ${activo.Descripcion}`;
        }
    }

    // ==========================================
    // MODAL: EDITAR
    // ==========================================
    abrirModalEditar(id) {
        const h = this.horarios.find(x => x.IdHorario === id);
        if (!h) { this.mostrarMensaje('Horario no encontrado', 'error'); return; }

        if (this.modalTitle) this.modalTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Horario';
        if (this.horarioId) this.horarioId.value = h.IdHorario;

        if (this.descripcionInput) this.descripcionInput.value = h.Descripcion || '';
        if (this.tipoHorarioSelect) this.tipoHorarioSelect.value = h.TipoHorario || 'PRESENCIAL';
        if (this.tiempoHorasInput) this.tiempoHorasInput.value = h.TiempoHoras ?? 0;
        if (this.tiempoMinutosInput) this.tiempoMinutosInput.value = h.TiempoMinutos ?? 0;

        // Aleatorio si no hay horas
        const esAleatorio = !h.HoraIngreso && !h.HoraSalida;
        if (this.checkEsAleatorio) this.checkEsAleatorio.checked = esAleatorio;

        if (this.horaIngresoInput) {
            this.horaIngresoInput.value = esAleatorio ? '' : this._formatearHoraInput(h.HoraIngreso);
            this.horaIngresoInput.disabled = esAleatorio;
        }
        if (this.horaSalidaInput) {
            this.horaSalidaInput.value = esAleatorio ? '' : this._formatearHoraInput(h.HoraSalida);
            this.horaSalidaInput.disabled = esAleatorio;
        }
        if (this.horaIngAlmuerzoInput) this.horaIngAlmuerzoInput.value = this._formatearHoraInput(h.HoraIngAlmuerzo);
        if (this.horaSalAlmuerzoInput) this.horaSalAlmuerzoInput.value = this._formatearHoraInput(h.HoraSalAlmuerzo);

        const tieneAlmuerzo = !!(h.HoraIngAlmuerzo && h.HoraSalAlmuerzo);
        if (this.checkTieneAlmuerzo) this.checkTieneAlmuerzo.checked = tieneAlmuerzo;

        this._actualizarEstadoAlmuerzoPorDuracion();
        this._toggleCamposAlmuerzo();

        if (this.idEstadoSelect) {
            this.idEstadoSelect.value = h.IdEstado || '';
            const est = this.estados.find(x => x.IdEstado === h.IdEstado);
            if (this.estadoDescripcionSpan) {
                this.estadoDescripcionSpan.textContent = est ? `📌 ${est.Descripcion}` : '';
            }
            this.idEstadoSelect.disabled = true;
        }

        this.modalHorario.classList.add('active');
    }

    // ==========================================
    // CERRAR MODAL
    // ==========================================
    cerrarModalHorario() {
        if (this.modalHorario) this.modalHorario.classList.remove('active');
        if (this.horarioForm) this.horarioForm.reset();
        if (this.horarioId) this.horarioId.value = '';
        if (this.idEstadoSelect) this.idEstadoSelect.disabled = false;
    }

    // ==========================================
    // GUARDAR (CREATE / UPDATE)
    // ==========================================
    async guardarHorario(event) {
        event.preventDefault();
        if (this.guardando) return;

        // ============================================
        // 1) Leer campos
        // ============================================
        const descripcion = this.descripcionInput?.value.trim() || '';
        const tipoHorario = this.tipoHorarioSelect?.value || '';
        const tiempoHoras = parseInt(this.tiempoHorasInput?.value) || 0;
        const tiempoMinutos = parseInt(this.tiempoMinutosInput?.value) || 0;
        const esAleatorio = this.checkEsAleatorio?.checked || false;

        let horaIngreso = esAleatorio ? null : (this.horaIngresoInput?.value || '');
        let horaSalida = esAleatorio ? null : (this.horaSalidaInput?.value || '');

        const tieneAlmuerzo = !!(this.checkTieneAlmuerzo?.checked && !this.checkTieneAlmuerzo?.disabled);
        let horaIngAlmuerzo = tieneAlmuerzo ? (this.horaIngAlmuerzoInput?.value || '') : null;
        let horaSalAlmuerzo = tieneAlmuerzo ? (this.horaSalAlmuerzoInput?.value || '') : null;

        const idEstado = parseInt(this.idEstadoSelect?.value) || 0;

        // ============================================
        // 2) Validaciones básicas
        // ============================================
        if (!descripcion) { this.mostrarMensaje('La descripción es requerida', 'error'); return; }
        if (!tipoHorario) { this.mostrarMensaje('El tipo de horario es requerido', 'error'); return; }
        if (!idEstado) { this.mostrarMensaje('El estado es requerido', 'error'); return; }
        if (tiempoHoras <= 0 && tiempoMinutos <= 0) {
            this.mostrarMensaje('La duración debe ser mayor a 0', 'error');
            return;
        }
        if (!esAleatorio && (!horaIngreso || !horaSalida)) {
            this.mostrarMensaje('Debe ingresar hora de ingreso y salida (o marcar "Horario aleatorio")', 'error');
            return;
        }

        // ============================================
        // 3) R1: validar coherencia ingreso/salida vs duración
        // ============================================
        if (!esAleatorio) {
            const totalEsperado = this._calcularMinutosTotales(tiempoHoras);
            const diferencia = this._diferenciaMinutos(horaIngreso, horaSalida);

            if (diferencia !== totalEsperado) {
                const detalle = tiempoHoras <= this._umbralAlmuerzo
                    ? `${tiempoHoras}h (sin almuerzo, ≤ ${this._umbralAlmuerzo}h)`
                    : `${tiempoHoras}h + 1h almuerzo = ${totalEsperado / 60}h total`;
                this.mostrarMensaje(
                    `La diferencia ingreso→salida (${diferencia} min) no coincide con la duración esperada (${detalle} = ${totalEsperado} min)`,
                    'error'
                );
                return;
            }
        }

        // ============================================
        // 4) R2: si duración ≤ 5h, almuerzo no aplica
        // ============================================
        if (tiempoHoras <= this._umbralAlmuerzo && tieneAlmuerzo) {
            this.mostrarMensaje(
                `No se puede registrar almuerzo en horarios de ${this._umbralAlmuerzo}h o menos`,
                'error'
            );
            return;
        }

        // ============================================
        // 5) R3: validar almuerzo (60 min exactos y dentro del rango)
        // ============================================
        if (tieneAlmuerzo) {
            if (!horaIngAlmuerzo || !horaSalAlmuerzo) {
                this.mostrarMensaje('Debe ingresar hora de ingreso y salida de almuerzo', 'error');
                return;
            }

            // 60 minutos exactos
            const minAlm = this._diferenciaMinutos(horaIngAlmuerzo, horaSalAlmuerzo);
            if (minAlm !== OPTIMIZACION_HORARIOS.MINUTOS_ALMUERZO) {
                this.mostrarMensaje(
                    `El almuerzo debe ser exactamente ${OPTIMIZACION_HORARIOS.MINUTOS_ALMUERZO} minutos (actual: ${minAlm} min)`,
                    'error'
                );
                return;
            }

            // Dentro del rango (solo si NO es aleatorio)
            if (!esAleatorio) {
                const val = this._validarAlmuerzoDentroDeRango(
                    horaIngreso, horaSalida, horaIngAlmuerzo, horaSalAlmuerzo
                );
                if (!val.ok) {
                    this.mostrarMensaje(val.msg, 'error');
                    return;
                }
            }
        }

        // ============================================
        // 6) Guardar
        // ============================================
        const esNuevo = !this.horarioId?.value;
        const originalText = this.btnGuardar.innerHTML;
        this.guardando = true;
        this.btnGuardar.disabled = true;
        this.btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        try {
            const payload = {
                Descripcion: descripcion,
                TipoHorario: tipoHorario,
                TiempoHoras: tiempoHoras,
                TiempoMinutos: tiempoMinutos,
                HoraIngreso: horaIngreso,
                HoraSalida: horaSalida,
                HoraIngAlmuerzo: horaIngAlmuerzo,
                HoraSalAlmuerzo: horaSalAlmuerzo,
                EsAleatorio: esAleatorio,
                IdEstado: idEstado,
                IdUsuarioCreacion: this.usuarioActual.IdUsuario,
                IdUsuarioModificacion: this.usuarioActual.IdUsuario
            };

            const r = esNuevo
                ? await this.horarioService.create(payload)
                : await this.horarioService.update(parseInt(this.horarioId.value), payload);

            if (!r.success) {
                this.mostrarMensaje(`${r.error || 'No se pudo guardar'}`, 'error');
                return;
            }

            this.mostrarMensaje(
                esNuevo ? 'Horario creado correctamente' : 'Horario actualizado correctamente',
                'success'
            );
            this.cerrarModalHorario();
            await this.cargarHorarios(true);

        } catch (error) {
            console.error('❌ Error guardando horario:', error);
            this.mostrarMensaje(`Error de conexión: ${error.message}`, 'error');
        } finally {
            this.guardando = false;
            if (this.btnGuardar) {
                this.btnGuardar.disabled = false;
                this.btnGuardar.innerHTML = originalText;
            }
        }
    }

    // ==========================================
    // ELIMINAR (con cuenta regresiva 10s)
    // ==========================================
    abrirModalEliminar(id) {
        const h = this.horarios.find(x => x.IdHorario === id);
        if (!h) {
            this.mostrarMensaje('Horario no encontrado', 'error');
            return;
        }

        this.horarioAEliminar = h;
        this.countdownValue = 10;
        this.isDeleting = false;

        if (this.countdownTimer) {
            this.countdownTimer.textContent = `Eliminando en ${this.countdownValue} segundos...`;
            this.countdownTimer.style.color = '#dc3545';
        }
        if (this.btnConfirmarEliminar) {
            this.btnConfirmarEliminar.disabled = false;
            this.btnConfirmarEliminar.textContent = 'Eliminar ahora';
            this.btnConfirmarEliminar.onclick = () => this.eliminarAhora();
        }

        if (this.confirmarMensajeHorario) {
            this.confirmarMensajeHorario.innerHTML = `
                ¿Está seguro que desea eliminar el horario 
                <strong>${this._escape(h.Descripcion)}</strong>?
                <br><br>
                Se eliminarán también: <strong>asignaciones, marcaciones, evidencias y justificaciones</strong>.
                <br>Podrá restaurarlo desde "Restaurar Horarios".
            `;
        }

        this.modalConfirmar.classList.add('active');
        this.iniciarCuentaRegresiva();
    }

    iniciarCuentaRegresiva() {
        if (this.countdownInterval) clearInterval(this.countdownInterval);

        this.countdownValue = 10;
        this.isDeleting = true;

        this.countdownInterval = setInterval(() => {
            this.countdownValue--;

            if (this.countdownTimer) {
                this.countdownTimer.textContent = `Eliminando en ${this.countdownValue} segundos...`;
                if (this.countdownValue <= 3) this.countdownTimer.style.color = '#ff6600';
            }

            if (this.countdownValue <= 0) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
                if (this.countdownTimer) this.countdownTimer.textContent = '¡Eliminando!';
                if (this.btnConfirmarEliminar) {
                    this.btnConfirmarEliminar.disabled = true;
                    this.btnConfirmarEliminar.textContent = 'Eliminando...';
                }
                this.ejecutarEliminacion();
            }
        }, 1000);
    }

    eliminarAhora() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        if (this.countdownTimer) this.countdownTimer.textContent = '¡Eliminando!';
        if (this.btnConfirmarEliminar) {
            this.btnConfirmarEliminar.disabled = true;
            this.btnConfirmarEliminar.textContent = 'Eliminando...';
        }
        this.ejecutarEliminacion();
    }

    cancelarEliminacion() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        this.isDeleting = false;
        this.horarioAEliminar = null;
        this.modalConfirmar.classList.remove('active');
    }

    async ejecutarEliminacion() {
        if (!this.horarioAEliminar) return;

        try {
            const id = this.horarioAEliminar.IdHorario;
            const desc = this.horarioAEliminar.Descripcion;
            const idUsuario = this.usuarioActual.IdUsuario;

            const r = await this.horarioService.deleteCascada(id, idUsuario);

            if (!r.success) {
                this.mostrarMensaje(`${r.error || 'No se pudo eliminar'}`, 'error');
                return;
            }

            this.mostrarMensaje(`Horario "${desc}" eliminado`, 'success');
            this.modalConfirmar.classList.remove('active');
            this.horarioAEliminar = null;
            await this.cargarHorarios(true);

        } catch (error) {
            console.error('❌ Error eliminando:', error);
            this.mostrarMensaje(`Error de conexión: ${error.message}`, 'error');
        }
    }

    // ==========================================
    // RESTAURAR
    // ==========================================
    async abrirModalRestaurarHorarios() {
        this.horariosEliminadosPaginaActual = 1;
        await this.cargarHorariosEliminados();
        this.modalRestaurarHorarios.classList.add('active');
    }

    async cargarHorariosEliminados() {
        try {
            const r = await this.horarioService.getAll();
            if (!r.success) {
                this.mostrarMensaje('No se pudieron cargar horarios eliminados', 'error');
                return;
            }
            this.horariosEliminados = (r.data || []).filter(h => h.IdEstado === 2);
            this.horariosEliminadosTotalPaginas = Math.ceil(this.horariosEliminados.length / this.horariosEliminadosRegistrosPorPagina) || 1;
            this.renderizarPaginaHorariosEliminados();
        } catch (error) {
            console.error('❌ Error horarios eliminados:', error);
        }
    }

   renderizarPaginaHorariosEliminados() {
    if (!this.tablaHorariosEliminadosBody) return;

    const paginacionContainer = document.getElementById('paginacionEliminadosContainer');

    // Sin eliminados
    if (this.horariosEliminados.length === 0) {
        this.tablaHorariosEliminadosBody.innerHTML = '<tr><td colspan="10" class="loading">No hay horarios eliminados</td></tr>';
        if (paginacionContainer) paginacionContainer.style.display = 'none';
        return;
    }

    // Calcular paginación
    this.horariosEliminadosTotalPaginas = Math.ceil(this.horariosEliminados.length / this.horariosEliminadosRegistrosPorPagina) || 1;
    if (this.horariosEliminadosPaginaActual > this.horariosEliminadosTotalPaginas) {
        this.horariosEliminadosPaginaActual = this.horariosEliminadosTotalPaginas;
    }
    if (this.horariosEliminadosPaginaActual < 1) {
        this.horariosEliminadosPaginaActual = 1;
    }

    const inicio = (this.horariosEliminadosPaginaActual - 1) * this.horariosEliminadosRegistrosPorPagina;
    const pagina = this.horariosEliminados.slice(inicio, inicio + this.horariosEliminadosRegistrosPorPagina);

    this.tablaHorariosEliminadosBody.innerHTML = '';
    pagina.forEach(h => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${h.IdHorario}</td>
            <td>${this._escape(h.Descripcion || '')}</td>
            <td>${this._escape(h.TipoHorario || '')}</td>
            <td>${h.TiempoHoras ?? 0}</td>
            <td>${h.TiempoMinutos ?? 0}</td>
            <td>${this._formatearHora(h.HoraIngreso)}</td>
            <td>${this._formatearHora(h.HoraSalida)}</td>
            <td>${this._formatearHora(h.HoraIngAlmuerzo)}</td>
            <td>${this._formatearHora(h.HoraSalAlmuerzo)}</td>
            <td>
                <button class="btn-restore-horario" data-id="${h.IdHorario}" data-desc="${this._escape(h.Descripcion || '')}">
                    <i class="fas fa-undo"></i> Restaurar
                </button>
            </td>
        `;
        this.tablaHorariosEliminadosBody.appendChild(row);
    });

    // Reasignar eventos
    document.querySelectorAll('#tablaHorariosEliminadosBody .btn-restore-horario').forEach(btn => {
        btn.onclick = () => {
            const id = parseInt(btn.getAttribute('data-id'));
            const desc = btn.getAttribute('data-desc');
            this.abrirModalConfirmarRestaurar(id, desc);
        };
    });

    // Mostrar y actualizar controles de paginación
    if (paginacionContainer) paginacionContainer.style.display = 'flex';
    this._actualizarControlesPaginacionEliminados();
}

    abrirModalConfirmarRestaurar(id, desc) {
        this.horarioARestaurar = this.horariosEliminados.find(h => h.IdHorario === id);
        if (!this.horarioARestaurar) return;

        if (this.restaurarHorarioMensaje) {
            this.restaurarHorarioMensaje.innerHTML = `
                ¿Está seguro que desea restaurar el horario 
                <strong>${this._escape(desc)}</strong>?
                <br><br>
                Se restaurarán las asignaciones y marcaciones relacionadas.
            `;
        }
        this.modalRestaurarHorarioConfirmar.classList.add('active');
    }

    cerrarModalRestaurarHorarios() {
        this.modalRestaurarHorarios.classList.remove('active');
    }

    cerrarModalRestaurarHorarioConfirmar() {
        this.modalRestaurarHorarioConfirmar.classList.remove('active');
        this.horarioARestaurar = null;
    }

    async confirmarRestaurarHorario() {
        if (!this.horarioARestaurar) return;

        const originalText = this.btnConfirmarRestaurarHorario.innerHTML;
        this.btnConfirmarRestaurarHorario.disabled = true;
        this.btnConfirmarRestaurarHorario.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Restaurando...';

        try {
            const r = await this.horarioService.restaurarCascada(
                this.horarioARestaurar.IdHorario,
                this.usuarioActual.IdUsuario
            );

            if (!r.success) {
                this.mostrarMensaje(`${r.error || 'No se pudo restaurar'}`, 'error');
                return;
            }

            this.mostrarMensaje('Horario restaurado correctamente', 'success');
            this.cerrarModalRestaurarHorarioConfirmar();
            this.cerrarModalRestaurarHorarios();
            await this.cargarHorarios(true);

        } catch (error) {
            console.error('❌ Error restaurando:', error);
            this.mostrarMensaje(`Error de conexión: ${error.message}`, 'error');
        } finally {
            this.btnConfirmarRestaurarHorario.disabled = false;
            this.btnConfirmarRestaurarHorario.innerHTML = originalText;
        }
    }

    // ==========================================
    // EXPORTAR EXCEL (CSV)
    // ==========================================
    async exportarExcel() {
        if (this.horarios.length === 0) {
            this.mostrarMensaje('No hay horarios para exportar', 'warning');
            return;
        }

        const DELIM = ';';
        const columnas = [
            { header: 'ID', key: 'IdHorario' },
            { header: 'Descripción', key: 'Descripcion' },
            { header: 'Tipo', key: 'TipoHorario' },
            { header: 'Horas', key: 'TiempoHoras' },
            { header: 'Minutos', key: 'TiempoMinutos' },
            { header: 'Ingreso', key: 'HoraIngreso' },
            { header: 'Salida', key: 'HoraSalida' },
            { header: 'Ing. Almuerzo', key: 'HoraIngAlmuerzo' },
            { header: 'Sal. Almuerzo', key: 'HoraSalAlmuerzo' },
            { header: 'Estado', key: 'EstadoDescripcion' },
            { header: 'Usuario Creación', key: 'UsuarioCreacion' },
            { header: 'Fecha Creación', key: 'FechaCreacion' },
            { header: 'Usuario Modif.', key: 'UsuarioModificacion' },
            { header: 'Fecha Modif.', key: 'FechaModificacion' }
        ];

        const datos = this.horarios.map(h => ({
            IdHorario: h.IdHorario,
            Descripcion: h.Descripcion || '',
            TipoHorario: h.TipoHorario || '',
            TiempoHoras: h.TiempoHoras ?? 0,
            TiempoMinutos: h.TiempoMinutos ?? 0,
            HoraIngreso: this._formatearHora(h.HoraIngreso),
            HoraSalida: this._formatearHora(h.HoraSalida),
            HoraIngAlmuerzo: this._formatearHora(h.HoraIngAlmuerzo),
            HoraSalAlmuerzo: this._formatearHora(h.HoraSalAlmuerzo),
            EstadoDescripcion: this._obtenerDescripcionEstado(h.IdEstado),
            UsuarioCreacion: this._obtenerNombreUsuario(h.IdUsuarioCreacion),
            FechaCreacion: this._formatearFecha(h.FechaCreacion),
            UsuarioModificacion: this._obtenerNombreUsuario(h.IdUsuarioModificacion),
            FechaModificacion: this._formatearFecha(h.FechaModificacion)
        }));

        // ============================================
        // Construir CSV con separador ";"
        // ============================================

        // Escapa cada celda: comillas dobles → "", envuelve en comillas
        const escapar = (v) => {
            let s = (v === null || v === undefined) ? '' : String(v);
            s = s.replace(/"/g, '""');
            return `"${s}"`;
        };

        const lineas = [];

        // ✅ Línea 1: hint para Excel (le dice que use ";" como separador)
        lineas.push(`sep=${DELIM}`);

        // ✅ Línea 2: encabezados
        lineas.push(columnas.map(c => escapar(c.header)).join(DELIM));

        // ✅ Líneas 3+: datos
        datos.forEach(row => {
            lineas.push(columnas.map(c => escapar(row[c.key])).join(DELIM));
        });

        const csv = lineas.join('\r\n');   // ✅ CRLF para compatibilidad Excel

        // ✅ BOM UTF-8 para que Excel respete tildes/ñ
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        const now = new Date();
        const sufijo = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

        link.href = url;
        link.download = `Horarios_${sufijo}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.mostrarMensaje(`${datos.length} horarios exportados`, 'success');
    }

    // ==========================================
    // HELPERS
    // ==========================================
    _diferenciaMinutos(ini, fin) {
        if (!ini || !fin) return 0;
        const [h1, m1] = ini.split(':').map(Number);
        const [h2, m2] = fin.split(':').map(Number);
        const a = h1 * 60 + m1;
        const b = h2 * 60 + m2;
        return b < a ? (1440 - a + b) : (b - a);
    }

    _formatearHora(v) {
        if (!v) return 'N/A';
        const s = String(v);
        if (s.includes('T')) {
            const m = s.match(/T(\d{2}):(\d{2})/);
            if (m) return `${m[1]}:${m[2]}`;
        }
        if (s.includes(':')) {
            const p = s.split(':');
            return `${String(p[0]).padStart(2, '0')}:${String(p[1]).padStart(2, '0')}`;
        }
        return s;
    }

    _formatearHoraInput(v) {
        if (!v) return '';
        return this._formatearHora(v);
    }

    _obtenerDescripcionEstado(id) {
        if (!id) return 'N/A';
        const e = this.estados.find(x => x.IdEstado === id);
        return e ? e.Descripcion : 'Desconocido';
    }

    _obtenerNombreUsuario(id) {
        if (!id) return 'N/A';
        const u = this.usuarios.find(x => x.IdUsuario === id);
        if (u) {
            return `${u.Nombres || u.Nombre || ''} ${u.Apellidos || ''}`.trim() || u.LoginNombre || `ID: ${id}`;
        }
        return `ID: ${id}`;
    }

    _escape(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    mostrarLoading(mostrar) {
        if (this.tablaBody && mostrar) {
            this.tablaBody.innerHTML = '<tr><td colspan="15" class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando horarios...</td></tr>';
        }
    }

    // ==========================================
    // CONSTANTE: umbral para considerar "jornada corta"
    // ==========================================
    get _umbralAlmuerzo() { return 5; } // horas

    // ==========================================
    // R1: Duración total → horas + 1h almuerzo (si > 5h)
    // ==========================================
    _calcularMinutosTotales(tiempoHoras) {
        const horas = parseInt(tiempoHoras) || 0;
        if (horas <= this._umbralAlmuerzo) {
            return horas * 60;              // ≤ 5h → sin almuerzo
        }
        return (horas * 60) + 60;           // > 5h → +1h almuerzo
    }

    // ==========================================
    // R1: Dado Ingreso + Duración → calcular Salida
    // ==========================================
    _recalcularDesdeIngreso() {
        if (this.checkEsAleatorio?.checked) return;
        if (!this.horaIngresoInput?.value) return;

        const horas = parseInt(this.tiempoHorasInput?.value) || 0;
        if (horas <= 0) return;

        const totalMinutos = this._calcularMinutosTotales(horas);
        const [hI, mI] = this.horaIngresoInput.value.split(':').map(Number);
        let ingresoMin = hI * 60 + mI;

        let salidaMin = ingresoMin + totalMinutos;
        if (salidaMin >= 1440) salidaMin -= 1440;

        const hS = String(Math.floor(salidaMin / 60)).padStart(2, '0');
        const mS = String(salidaMin % 60).padStart(2, '0');
        if (this.horaSalidaInput) this.horaSalidaInput.value = `${hS}:${mS}`;

        console.log(`🔄 Duración ${horas}h (${totalMinutos}min) → Salida ${hS}:${mS}`);
    }

    // ==========================================
    // R1: Dado Salida + Duración → calcular Ingreso
    // ==========================================
    _recalcularDesdeSalida() {
        if (this.checkEsAleatorio?.checked) return;
        if (!this.horaSalidaInput?.value) return;

        const horas = parseInt(this.tiempoHorasInput?.value) || 0;
        if (horas <= 0) return;

        const totalMinutos = this._calcularMinutosTotales(horas);
        const [hS, mS] = this.horaSalidaInput.value.split(':').map(Number);
        let salidaMin = hS * 60 + mS;

        let ingresoMin = salidaMin - totalMinutos;
        if (ingresoMin < 0) ingresoMin += 1440;

        const hI = String(Math.floor(ingresoMin / 60)).padStart(2, '0');
        const mI = String(ingresoMin % 60).padStart(2, '0');
        if (this.horaIngresoInput) this.horaIngresoInput.value = `${hI}:${mI}`;

        console.log(`🔄 Salida - ${horas}h (${totalMinutos}min) → Ingreso ${hI}:${mI}`);
    }

    // ==========================================
    // R2: Si duración ≤ 5h, bloquear almuerzo
    // ==========================================
    _actualizarEstadoAlmuerzoPorDuracion() {
        const horas = parseInt(this.tiempoHorasInput?.value) || 0;
        const esCorta = horas > 0 && horas <= this._umbralAlmuerzo;
        const tieneAlmuerzoChk = this.checkTieneAlmuerzo;

        // Aviso visual
        if (this.avisoDuracionCorta && this.avisoDuracionCortaTexto) {
            if (esCorta) {
                this.avisoDuracionCorta.style.display = 'block';
                this.avisoDuracionCortaTexto.textContent =
                    `Duración Baja → La hora de almuerzo no se aplicará.`;
            } else {
                this.avisoDuracionCorta.style.display = 'none';
            }
        }

        if (!tieneAlmuerzoChk) return;

        if (esCorta) {
            tieneAlmuerzoChk.checked = false;
            tieneAlmuerzoChk.disabled = true;
            tieneAlmuerzoChk.title = `No aplica para horarios de ${this._umbralAlmuerzo}h o menos`;
            this._toggleCamposAlmuerzo();
        } else {
            tieneAlmuerzoChk.disabled = false;
            tieneAlmuerzoChk.title = '';
        }
    }

    // ==========================================
    // R4: Toggle aleatorio
    // ==========================================
    _toggleAleatorio() {
        const aleatorio = this.checkEsAleatorio?.checked || false;

        if (this.horaIngresoInput) {
            this.horaIngresoInput.disabled = aleatorio;
            if (aleatorio) this.horaIngresoInput.value = '';
        }
        if (this.horaSalidaInput) {
            this.horaSalidaInput.disabled = aleatorio;
            if (aleatorio) this.horaSalidaInput.value = '';
        }

        // NOTA: el almuerzo NO se ve afectado por aleatorio
        // Si el usuario marcó "tiene almuerzo", debe definir las horas de almuerzo
    }

    // ==========================================
    // R3: Validar que el almuerzo esté dentro del rango [ingreso, salida]
    //     y que dure exactamente 60 minutos
    // ==========================================
    _validarAlmuerzoDentroDeRango(horaIngreso, horaSalida, horaIngAlmuerzo, horaSalAlmuerzo) {
        // 1) 60 minutos exactos
        const minAlmuerzo = this._diferenciaMinutos(horaIngAlmuerzo, horaSalAlmuerzo);
        if (minAlmuerzo !== OPTIMIZACION_HORARIOS.MINUTOS_ALMUERZO) {
            return {
                ok: false,
                msg: `El almuerzo debe ser exactamente ${OPTIMIZACION_HORARIOS.MINUTOS_ALMUERZO} minutos (actual: ${minAlmuerzo} min)`
            };
        }

        // 2) Convertir a minutos del día
        const [hI, mI] = horaIngreso.split(':').map(Number);
        const [hS, mS] = horaSalida.split(':').map(Number);
        const [hIA, mIA] = horaIngAlmuerzo.split(':').map(Number);
        const [hSA, mSA] = horaSalAlmuerzo.split(':').map(Number);

        const ingresoMin = hI * 60 + mI;
        let salidaMin = hS * 60 + mS;
        const cruzaMedianoche = salidaMin <= ingresoMin;   // ← rango principal cruza?
        if (cruzaMedianoche) salidaMin += 1440;

        let ingAlmMin = hIA * 60 + mIA;
        let salAlmMin = hSA * 60 + mSA;

        // Solo envolver si el rango principal cruza medianoche Y el almuerzo
        // está antes del ingreso (es decir, en la madrugada del día siguiente)
        if (cruzaMedianoche && ingAlmMin < ingresoMin) {
            ingAlmMin += 1440;
            salAlmMin += 1440;
        }

        // 3) Validar
        if (ingAlmMin < ingresoMin) {
            return {
                ok: false,
                msg: `El almuerzo no puede iniciar antes de la hora de ingreso (${horaIngreso})`
            };
        }
        if (salAlmMin > salidaMin) {
            return {
                ok: false,
                msg: `El almuerzo no puede terminar después de la hora de salida (${horaSalida})`
            };
        }

        return { ok: true };
    }

    // ==========================================
    // AUTO-COMPLETADO ALMUERZO (60 min)
    // Al definir ingreso → salida = ingreso + 60
    // ==========================================
    _recalcularSalidaAlmuerzoDesdeIngreso() {
        if (!this.horaIngAlmuerzoInput?.value) return;
        if (!this.horaSalAlmuerzoInput) return;

        const [h, m] = this.horaIngAlmuerzoInput.value.split(':').map(Number);
        let totalMin = h * 60 + m + OPTIMIZACION_HORARIOS.MINUTOS_ALMUERZO;
        if (totalMin >= 1440) totalMin -= 1440;

        const hS = String(Math.floor(totalMin / 60)).padStart(2, '0');
        const mS = String(totalMin % 60).padStart(2, '0');
        this.horaSalAlmuerzoInput.value = `${hS}:${mS}`;

        console.log(`🔄 Almuerzo: Ingreso ${this.horaIngAlmuerzoInput.value} + 60min → Salida ${hS}:${mS}`);
    }

    // ==========================================
    // AUTO-COMPLETADO ALMUERZO (60 min)
    // Al definir salida → ingreso = salida - 60
    // ==========================================
    _recalcularIngresoAlmuerzoDesdeSalida() {
        if (!this.horaSalAlmuerzoInput?.value) return;
        if (!this.horaIngAlmuerzoInput) return;

        const [h, m] = this.horaSalAlmuerzoInput.value.split(':').map(Number);
        let totalMin = h * 60 + m - OPTIMIZACION_HORARIOS.MINUTOS_ALMUERZO;
        if (totalMin < 0) totalMin += 1440;

        const hI = String(Math.floor(totalMin / 60)).padStart(2, '0');
        const mI = String(totalMin % 60).padStart(2, '0');
        this.horaIngAlmuerzoInput.value = `${hI}:${mI}`;

        console.log(`🔄 Almuerzo: Salida ${this.horaSalAlmuerzoInput.value} - 60min → Ingreso ${hI}:${mI}`);
    }

    // ==========================================
    // FORMATEAR FECHA CON ZONA HORARIA PERÚ
    // Acepta:
    //  - String ISO con Z:  "2026-10-27T16:30:37.100Z"
    //  - String ISO sin Z:  "2026-10-27T16:30:37.100"
    //  - String SQL:        "2026-10-27 16:30:37.100"
    //  - Date object
    // ==========================================
    _formatearFecha(valor) {
        if (!valor) return 'N/A';

        let date;

        try {
            if (valor instanceof Date) {
                date = valor;
            } else {
                let s = String(valor).trim();

                // Si viene en formato SQL "YYYY-MM-DD HH:MM:SS(.mmm)?" sin T ni Z,
                // tratarlo como UTC (Azure SQL guarda UTC).
                // Convertir a formato ISO agregando T y Z.
                if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
                    s = s.replace(' ', 'T');
                    if (!s.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(s)) {
                        s += 'Z';
                    }
                }

                // Si viene ISO sin Z y sin offset, asumir UTC (Azure)
                if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)
                    && !s.endsWith('Z')
                    && !/[+-]\d{2}:\d{2}$/.test(s)) {
                    s += 'Z';
                }

                date = new Date(s);
            }

            if (isNaN(date.getTime())) return String(valor);

            // Formatear con zona horaria Perú (America/Lima = UTC-5)
            const fmt = new Intl.DateTimeFormat('es-PE', {
                timeZone: 'America/Lima',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });

            // Intl devuelve "27/10/2026, 11:30"; lo dejamos así o lo reformateamos
            const partes = fmt.formatToParts(date);
            const get = (t) => partes.find(p => p.type === t)?.value || '';

            const dd = get('day');
            const mm = get('month');
            const yy = get('year');
            const HH = get('hour');
            const MM = get('minute');

            return `${dd}/${mm}/${yy}, ${HH}:${MM}`;

        } catch (e) {
            console.warn('Error formateando fecha:', valor, e);
            return String(valor);
        }
    }

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
    irAlMenu() { window.location.href = this.config?.ROUTES?.MENU || 'Menu.html'; }
    irAlPerfil() { window.location.href = this.config?.ROUTES?.PERFIL || 'Mi-Perfil.html'; }
    redirigirALogin() { window.location.replace(this.config?.ROUTES?.LOGIN || '/index.html'); }

    cerrarSesion() {
        this.mostrarMensaje('Sesión cerrada correctamente', 'success');
        setTimeout(() => this.auth.cerrarSesion(), 700);
    }
}

if (typeof window !== 'undefined') {
    window.HorarioController = HorarioController;
}