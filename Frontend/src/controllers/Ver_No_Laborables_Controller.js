// ==============================================
// CONTROLLER: VerNoLaborablesController
// Visualización y eliminación de días no laborables
// Depende de: AsignacionService (vía parentController)
// ==============================================

class VerNoLaborablesController {

    constructor(config, parentController) {
        this.config = config || {};
        this.parentController = parentController;
        this.service = parentController.asignacionService;
        this.usuarioActual = parentController.usuarioActual;

        this.modal = document.getElementById('modalVerNoLaborables');
        this.tablaBody = document.getElementById('tablaNoLaborablesBody');
        this.btnCerrar = document.getElementById('closeVerNoLaborablesBtn');
        this.btnFiltrar = document.getElementById('btnFiltrarNoLaborables');
        this.btnLimpiarFiltros = document.getElementById('btnLimpiarFiltrosNoLaborables');

        this.filtroUsuario = document.getElementById('filtroUsuarioNoLaborable');
        this.filtroFechaDesde = document.getElementById('filtroFechaDesdeNoLaborable');
        this.filtroFechaHasta = document.getElementById('filtroFechaHastaNoLaborable');

        // Paginación
        this.registrosPorPagina = 5;
        this.paginaActual = 1;
        this.totalPaginas = 1;
        this.registros = [];
        this.registrosFiltrados = [];

        this.btnPrimera = document.getElementById('btnPrimeraNoLaborables');
        this.btnAnterior = document.getElementById('btnAnteriorNoLaborables');
        this.btnSiguiente = document.getElementById('btnSiguienteNoLaborables');
        this.btnUltima = document.getElementById('btnUltimaNoLaborables');
        this.paginaActualSpan = document.getElementById('paginaActualNoLaborables');
        this.inicioSpan = document.getElementById('inicioNoLaborables');
        this.finSpan = document.getElementById('finNoLaborables');
        this.totalSpan = document.getElementById('totalNoLaborables');
        this.paginacionContainer = document.getElementById('paginacionNoLaborablesContainer');

        this.verificando = false;

        this.configurarEventos();
    }

    configurarEventos() {
        if (this.parentController.btnVerNoLaborables) {
            const nuevoBoton = this.parentController.btnVerNoLaborables.cloneNode(true);
            this.parentController.btnVerNoLaborables.parentNode.replaceChild(nuevoBoton, this.parentController.btnVerNoLaborables);
            this.parentController.btnVerNoLaborables = nuevoBoton;

            nuevoBoton.addEventListener('click', async () => {
                if (this.verificando) return;
                this.verificando = true;
                try {
                    this._bloquearBoton(nuevoBoton, 'Cargando...');
                    this.cargarSelectFiltroUsuario();
                    await this.cargarNoLaborables();
                    this.modal.classList.add('active');
                } finally {
                    this.verificando = false;
                    this._desbloquearBoton(nuevoBoton);
                }
            });
        }

        if (this.btnCerrar) this.btnCerrar.addEventListener('click', () => this.cerrarModal());
        if (this.btnFiltrar) this.btnFiltrar.addEventListener('click', () => this.aplicarFiltros());
        if (this.btnLimpiarFiltros) this.btnLimpiarFiltros.addEventListener('click', () => this.limpiarFiltros());

        if (this.btnPrimera) this.btnPrimera.addEventListener('click', () => this.irPrimera());
        if (this.btnAnterior) this.btnAnterior.addEventListener('click', () => this.irAnterior());
        if (this.btnSiguiente) this.btnSiguiente.addEventListener('click', () => this.irSiguiente());
        if (this.btnUltima) this.btnUltima.addEventListener('click', () => this.irUltima());
    }

    _bloquearBoton(btn, msg) {
        if (!btn) return;
        if (!btn._textoOriginal) btn._textoOriginal = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${msg}`;
    }

    _desbloquearBoton(btn) {
        if (!btn) return;
        btn.disabled = false;
        if (btn._textoOriginal) { btn.innerHTML = btn._textoOriginal; btn._textoOriginal = null; }
    }

    cerrarModal() {
        if (this.modal) this.modal.classList.remove('active');
    }

    cargarSelectFiltroUsuario() {
        if (!this.filtroUsuario) return;
        this.filtroUsuario.innerHTML = '<option value="">-- Todos los usuarios --</option>';
        this.parentController.usuarios.filter(u => u.seleccionable).forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.IdUsuario;
            opt.textContent = `${u.Nombres} ${u.Apellidos} (${u.NombreUsuario})`;
            this.filtroUsuario.appendChild(opt);
        });
    }

    async cargarNoLaborables() {
        this.mostrarLoading(true);

        // Refrescar marcaciones
        await this.parentController.cargarMarcaciones();

        this.registros = this.parentController.marcacionesExistentes
            .filter(m => {
                const obs = (m.ObsGeneral || m.Observacion || '').toUpperCase();
                return obs.includes('NO LABORA') && m.IdEstado === 1;
            })
            .map(m => {
                // ✅ Leer los campos de auditoría de MarcacionObservacion
                const idCreador = m.IdUsuarioCreacionObservacion ?? m.IdUsuarioCreacion ?? null;
                const fechaCreacion = m.FechaCreacionObservacion ?? m.FechaCreacion ?? null;

                return {
                    IdMarcacion: m.IdMarcacion,
                    IdUsuario: m.IdUsuario,
                    Fecha: this.parentController._normalizarFecha(m.Fecha),
                    Observacion: m.ObsGeneral || m.Observacion || 'NO LABORA - DÍA NO LABORABLE',
                    IdUsuarioCreacion: idCreador,
                    FechaCreacion: fechaCreacion,
                    NombreUsuario: this.parentController._obtenerNombreUsuario(m.IdUsuario),
                    NombreCreador: idCreador
                        ? this.parentController._obtenerNombreUsuario(idCreador)
                        : 'N/A'
                };
            })
            .sort((a, b) => b.Fecha.localeCompare(a.Fecha));

        this.aplicarFiltros();
        this.mostrarLoading(false);
    }

    aplicarFiltros() {
        const uId = parseInt(this.filtroUsuario?.value);
        const desde = this.filtroFechaDesde?.value;
        const hasta = this.filtroFechaHasta?.value;

        this.registrosFiltrados = this.registros.filter(r => {
            if (uId && r.IdUsuario !== uId) return false;
            if (desde && r.Fecha < desde) return false;
            if (hasta && r.Fecha > hasta) return false;
            return true;
        });

        this.totalPaginas = Math.ceil(this.registrosFiltrados.length / this.registrosPorPagina) || 1;
        if (this.paginaActual > this.totalPaginas) this.paginaActual = this.totalPaginas;
        if (this.paginaActual < 1) this.paginaActual = 1;

        this.renderizarPagina();
    }

    limpiarFiltros() {
        if (this.filtroUsuario) this.filtroUsuario.value = '';
        if (this.filtroFechaDesde) this.filtroFechaDesde.value = '';
        if (this.filtroFechaHasta) this.filtroFechaHasta.value = '';
        this.aplicarFiltros();
    }

    renderizarPagina() {
        if (!this.tablaBody) return;

        const inicio = (this.paginaActual - 1) * this.registrosPorPagina;
        const fin = Math.min(inicio + this.registrosPorPagina, this.registrosFiltrados.length);
        const pagina = this.registrosFiltrados.slice(inicio, fin);

        if (pagina.length === 0) {
            this.tablaBody.innerHTML = '<tr><td colspan="7" class="loading">No hay días no laborables</td></tr>';
            if (this.paginacionContainer) this.paginacionContainer.style.display = 'none';
            return;
        }

        if (this.paginacionContainer) this.paginacionContainer.style.display = 'flex';
        this.tablaBody.innerHTML = '';

        pagina.forEach(r => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${r.IdMarcacion}</td>
                <td>${this.parentController._escape(r.NombreUsuario)}</td>
                <td>${this.parentController._formatearFecha(r.Fecha)}</td>
                <td>${this.parentController._escape(r.Observacion)}</td>
                <td>${this.parentController._escape(r.NombreCreador)}</td>
                <td>${this.parentController._formatearFechaPeru(r.FechaCreacion)}</td>
                <td>
                    <button class="btn-eliminar-nl" data-id="${r.IdMarcacion}"
                            style="background:#dc3545;color:white;border:none;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </td>
            `;
            this.tablaBody.appendChild(row);
        });

        this.tablaBody.querySelectorAll('.btn-eliminar-nl').forEach(btn => {
            btn.onclick = () => this.eliminarNoLaborable(parseInt(btn.dataset.id));
        });

        this._actualizarPaginacion();
    }

    async eliminarNoLaborable(id) {
        if (!confirm('¿Eliminar este día no laborable definitivamente?\n\nEsta acción no se puede deshacer.')) {
            return;
        }

        const btn = document.querySelector(`.btn-eliminar-nl[data-id="${id}"]`);
        const orig = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        try {
            // ✅ Llamar al nuevo método de eliminación física
            const r = await this.service.eliminarMarcacionFisica(id);

            if (r.success) {
                this.parentController.mostrarMensaje('Día no laborable eliminado definitivamente', 'success');
                await this.cargarNoLaborables();
                await this.parentController.cargarAsignaciones();
                await this.parentController.cargarMarcaciones();
            } else {
                // Mensajes específicos según el código de error
                let msg = r.error || 'No se pudo eliminar';
                if (r.codigo === 'MARCACION_CON_EVIDENCIAS') {
                    msg = 'Esta marcación tiene evidencias asociadas. No se puede eliminar definitivamente.';
                } else if (r.codigo === 'MARCACION_CON_JUSTIFICACIONES') {
                    msg = 'Esta marcación tiene justificaciones asociadas. No se puede eliminar definitivamente.';
                } else if (r.codigo === 'MARCACION_YA_ELIMINADA') {
                    msg = 'Esta marcación ya fue eliminada.';
                } else if (r.codigo === 'MARCACION_NO_EXISTE') {
                    msg = 'La marcación no existe o ya fue eliminada.';
                }
                this.parentController.mostrarMensaje(`${msg}`, 'error');
            }
        } catch (error) {
            console.error('❌ Error:', error);
            this.parentController.mostrarMensaje('Error de conexión al eliminar', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = orig;
            }
        }
    }

    _actualizarPaginacion() {
        const total = this.registrosFiltrados.length;
        const inicio = total > 0 ? (this.paginaActual - 1) * this.registrosPorPagina + 1 : 0;
        const fin = Math.min(inicio + this.registrosPorPagina - 1, total);

        if (this.inicioSpan) this.inicioSpan.textContent = inicio;
        if (this.finSpan) this.finSpan.textContent = fin;
        if (this.totalSpan) this.totalSpan.textContent = total;
        if (this.paginaActualSpan) this.paginaActualSpan.textContent = `Página ${this.paginaActual} de ${this.totalPaginas}`;

        if (this.btnPrimera) this.btnPrimera.disabled = this.paginaActual === 1;
        if (this.btnAnterior) this.btnAnterior.disabled = this.paginaActual === 1;
        if (this.btnSiguiente) this.btnSiguiente.disabled = this.paginaActual === this.totalPaginas;
        if (this.btnUltima) this.btnUltima.disabled = this.paginaActual === this.totalPaginas;
    }

    irPrimera() { if (this.paginaActual > 1) { this.paginaActual = 1; this.renderizarPagina(); } }
    irAnterior() { if (this.paginaActual > 1) { this.paginaActual--; this.renderizarPagina(); } }
    irSiguiente() { if (this.paginaActual < this.totalPaginas) { this.paginaActual++; this.renderizarPagina(); } }
    irUltima() { if (this.paginaActual < this.totalPaginas) { this.paginaActual = this.totalPaginas; this.renderizarPagina(); } }

    mostrarLoading(m) {
        if (this.tablaBody && m) {
            this.tablaBody.innerHTML = '<tr><td colspan="7" class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>';
        }
    }
}

if (typeof window !== 'undefined') {
    window.VerNoLaborablesController = VerNoLaborablesController;
}