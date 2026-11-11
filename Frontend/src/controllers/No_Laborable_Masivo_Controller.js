// ==============================================
// CONTROLLER: NoLaborableMasivoController
// Registro masivo de días no laborables por rango
// Depende de: AsignacionService (vía parentController)
// ==============================================

class NoLaborableMasivoController {

    constructor(config, parentController) {
        this.config = config || {};
        this.parentController = parentController;
        this.service = parentController.asignacionService;
        this.usuarioActual = parentController.usuarioActual;

        this.modal = document.getElementById('modalNoLaborableMasivo');
        this.modalProgreso = document.getElementById('modalProgresoNoLaborableMasivo');
        this.modalConfirmarRegistroDirecto = document.getElementById('modalConfirmarRegistroDirectoNoLaborable');

        this.fechaInicio = document.getElementById('fechaInicioNoLaborableMasivo');
        this.fechaFin = document.getElementById('fechaFinNoLaborableMasivo');
        this.tablaUsuarios = document.getElementById('tablaUsuariosNoLaborableMasivo');
        this.seleccionarTodos = document.getElementById('seleccionarTodosNoLaborableMasivo');

        this.busqueda = document.getElementById('busquedaUsuarioNoLaborableMasivo');
        this.btnLimpiarBusqueda = document.getElementById('btnLimpiarBusquedaNoLaborableMasivo');
        this.mostrados = document.getElementById('mostradosNoLaborableMasivo');
        this.totalUsuarios = document.getElementById('totalUsuariosNoLaborableMasivo');

        this.previsualizacionDiv = document.getElementById('previsualizacionNoLaborableMasivo');
        this.tablaPrevisualizacion = document.getElementById('tablaPrevisualizacionNoLaborableMasivo');
        this.totalAsignacionesSpan = document.getElementById('totalNoLaborableMasivo');

        this.btnCancelar = document.getElementById('btnCancelarNoLaborableMasivo');
        this.btnPrevisualizar = document.getElementById('btnPrevisualizarNoLaborableMasivo');
        this.btnVolverForm = document.getElementById('btnVolverFormNoLaborableMasivo');
        this.btnConfirmarGenerar = document.getElementById('btnConfirmarGenerarNoLaborableMasivo');
        this.btnRegistrarYa = document.getElementById('btnRegistrarYaNoLaborableMasivo');

        this.btnCancelarConfirmar = document.getElementById('btnCancelarConfirmarRegistroDirectoNoLaborable');
        this.btnDeseoPrevisualizar = document.getElementById('btnDeseoPrevisualizarNoLaborableMasivo');
        this.btnConfirmarDirecto = document.getElementById('btnConfirmarRegistroDirectoNoLaborableMasivo');
        this.closeConfirmarBtn = document.getElementById('closeConfirmarRegistroDirectoNoLaborableBtn');

        // Progreso
        this.progresoBar = document.getElementById('progresoNoLaborableMasivoBar');
        this.progresoTexto = document.getElementById('progresoNoLaborableMasivoTexto');
        this.progresoPorcentaje = document.getElementById('progresoNoLaborableMasivoPorcentaje');
        this.detalleProgreso = document.getElementById('detalleProgresoNoLaborableMasivo');
        this.estadoSQL = document.getElementById('estadoSQLNoLaborableMasivo');
        this.btnCerrarProgreso = document.getElementById('btnCerrarProgresoNoLaborableMasivo');

        this.asignacionesPendientes = [];
        this.usuariosActivos = [];

        if (this.modal) this.configurarEventos();
    }

    configurarEventos() {
        const closeBtn = document.getElementById('closeNoLaborableMasivoBtn');
        if (closeBtn) closeBtn.addEventListener('click', () => this.cerrarModal());
        if (this.btnCancelar) this.btnCancelar.addEventListener('click', () => this.cerrarModal());

        if (this.btnPrevisualizar) this.btnPrevisualizar.addEventListener('click', () => this.previsualizar());
        if (this.btnRegistrarYa) this.btnRegistrarYa.addEventListener('click', () => this.abrirModalConfirmar());
        if (this.btnConfirmarGenerar) this.btnConfirmarGenerar.addEventListener('click', () => this.confirmarRegistrar());
        if (this.btnVolverForm) this.btnVolverForm.addEventListener('click', () => this.volverFormulario());

        if (this.closeConfirmarBtn) this.closeConfirmarBtn.addEventListener('click', () => this.cerrarModalConfirmar());
        if (this.btnCancelarConfirmar) this.btnCancelarConfirmar.addEventListener('click', () => this.cerrarModalConfirmar());
        if (this.btnDeseoPrevisualizar) {
            this.btnDeseoPrevisualizar.addEventListener('click', () => {
                this.cerrarModalConfirmar();
                this.previsualizar();
            });
        }
        if (this.btnConfirmarDirecto) this.btnConfirmarDirecto.addEventListener('click', () => this.confirmarRegistroDirecto());

        if (this.btnCerrarProgreso) this.btnCerrarProgreso.addEventListener('click', () => this.cerrarProgreso());

        if (this.fechaInicio) this.fechaInicio.addEventListener('change', () => { this.sincronizarFechas(); this.renderizarTablaUsuarios(); });
        if (this.fechaFin) this.fechaFin.addEventListener('change', () => { this.sincronizarFechas(); this.renderizarTablaUsuarios(); });

        if (this.seleccionarTodos) {
            this.seleccionarTodos.addEventListener('change', (e) => {
                this.tablaUsuarios.querySelectorAll('.checkbox-usuario-nl-masivo:not([disabled])').forEach(cb => cb.checked = e.target.checked);
            });
        }

        if (this.busqueda) this.busqueda.addEventListener('input', (e) => this.filtrar(e.target.value));
        if (this.btnLimpiarBusqueda) {
            this.btnLimpiarBusqueda.addEventListener('click', () => {
                if (this.busqueda) { this.busqueda.value = ''; this.filtrar(''); }
            });
        }
    }

    async abrirModal() {
    console.log('📌 NoLaborableMasivoController.abrirModal()');

    if (!this.modal) {
        console.error('❌ modalNoLaborableMasivo no encontrado');
        this.parentController.mostrarMensaje('Error: modal no encontrado', 'error');
        return;
    }

    this.limpiarFormulario();

    // Refrescar datos
    try { await this.parentController.cargarAsignaciones(); } catch(e) {}
    try { await this.parentController.cargarMarcaciones(); } catch(e) {}

    this.usuariosActivos = this.parentController.usuarios.filter(u => u.seleccionable);
    this.sincronizarFechas();
    this.renderizarTablaUsuarios();

    this.modal.classList.add('active');
    console.log('✅ Modal No Laborable — Rango abierto');
}

    cerrarModal() {
        if (this.modal) this.modal.classList.remove('active');
        if (this.previsualizacionDiv) this.previsualizacionDiv.style.display = 'none';
        const form = document.getElementById('formNoLaborableMasivo');
        if (form) form.style.display = 'block';
    }

    limpiarFormulario() {
        const hoy = this._fechaHoy();
        if (this.fechaInicio) this.fechaInicio.value = hoy;
        if (this.fechaFin) this.fechaFin.value = hoy;
        if (this.seleccionarTodos) this.seleccionarTodos.checked = false;
        if (this.previsualizacionDiv) this.previsualizacionDiv.style.display = 'none';
        const form = document.getElementById('formNoLaborableMasivo');
        if (form) form.style.display = 'block';
        this.asignacionesPendientes = [];
    }

    _fechaHoy() {
        const hoy = new Date();
        return `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
    }

    sincronizarFechas() {
        const hoy = this._fechaHoy();
        if (!this.fechaInicio.value || this.fechaInicio.value < hoy) this.fechaInicio.value = hoy;

        if (!this.fechaFin.value || this.fechaFin.value < this.fechaInicio.value) {
            this.fechaFin.value = this.fechaInicio.value;
        }

        this.fechaInicio.min = hoy;
        this.fechaFin.min = this.fechaInicio.value;

        const info = document.getElementById('infoRangoNoLaborableMasivo');
        if (info) {
            const dias = this.calcularDias(this.fechaInicio.value, this.fechaFin.value);
            info.textContent = `Rango de ${dias} día(s)`;
        }
    }

    calcularDias(inicio, fin) {
        const ini = new Date(inicio + 'T00:00:00');
        const f = new Date(fin + 'T00:00:00');
        return Math.ceil(Math.abs(f - ini) / (1000 * 60 * 60 * 24)) + 1;
    }

    generarFechasRango(inicio, fin) {
        const fechas = [];
        const cur = new Date(inicio + 'T00:00:00');
        const end = new Date(fin + 'T00:00:00');
        while (cur <= end) {
            fechas.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`);
            cur.setDate(cur.getDate() + 1);
        }
        return fechas;
    }

    renderizarTablaUsuarios() {
        if (!this.tablaUsuarios) return;

        const inicio = this.fechaInicio?.value;
        const fin = this.fechaFin?.value;
        if (!inicio || !fin) {
            this.tablaUsuarios.innerHTML = '<tr><td colspan="3" class="loading">Seleccione un rango</td></tr>';
            return;
        }

        const fechas = this.generarFechasRango(inicio, fin);
        const total = fechas.length;

        this.tablaUsuarios.innerHTML = '';

        this.usuariosActivos.forEach(u => {
            const ocupadas = this._fechasOcupadas(u.IdUsuario, fechas);
            const bloqueado = ocupadas.length === total;

            const row = document.createElement('tr');
            const indicador = ocupadas.length > 0 && !bloqueado
                ? `<span style="color:#856404;font-size:10px;display:block;"> ${ocupadas.length} día(s) ocupado(s)</span>`
                : '';

            row.innerHTML = `
                <td class="checkbox-column">
                    <input type="checkbox" class="checkbox-usuario-nl-masivo"
                           data-id="${u.IdUsuario}"
                           data-nombre="${u.Nombres} ${u.Apellidos}"
                           ${bloqueado ? 'disabled' : ''}>
                    ${indicador}
                </td>
                <td>${this.parentController._escape(u.Nombres)} ${this.parentController._escape(u.Apellidos)}</td>
                <td style="color:${bloqueado ? '#dc3545' : (ocupadas.length > 0 ? '#856404' : '#28a745')};">
                    ${bloqueado ? '🔴 Todas ocupadas' : (ocupadas.length > 0 ? `${ocupadas.length} ocupadas` : '✅ Disponible')}
                </td>
            `;
            this.tablaUsuarios.appendChild(row);
        });

        if (this.totalUsuarios) this.totalUsuarios.textContent = this.usuariosActivos.length;
        if (this.busqueda) this.filtrar(this.busqueda.value);
    }

    _fechasOcupadas(idUsuario, fechas) {
        const ocupadas = new Set();

        this.parentController.todasAsignaciones.forEach(a => {
            if (a.IdUsuario !== idUsuario) return;
            if (a.IdEstado !== 1 && a.IdEstado !== 2) return;
            const f = this.parentController._normalizarFecha(a.Fecha);
            if (fechas.includes(f)) ocupadas.add(f);
        });

        this.parentController.marcacionesExistentes.forEach(m => {
            if (m.IdUsuario !== idUsuario) return;
            const f = this.parentController._normalizarFecha(m.Fecha);
            const obs = (m.ObsGeneral || m.Observacion || '').toUpperCase();
            if (obs.includes('NO LABORA') && fechas.includes(f)) ocupadas.add(f);
        });

        return Array.from(ocupadas);
    }

    generarAsignacionesDesdeFormulario() {
        const inicio = this.fechaInicio.value;
        const fin = this.fechaFin.value;
        if (!inicio || !fin) { this.parentController.mostrarMensaje('Seleccione un rango', 'warning'); return null; }
        if (inicio > fin) { this.parentController.mostrarMensaje('Rango inválido', 'warning'); return null; }

        const checks = this.tablaUsuarios.querySelectorAll('.checkbox-usuario-nl-masivo:checked:not([disabled])');
        if (checks.length === 0) { this.parentController.mostrarMensaje('Seleccione al menos un usuario', 'warning'); return null; }

        const fechas = this.generarFechasRango(inicio, fin);
        const asignaciones = [];
        let omitidas = 0;

        checks.forEach(cb => {
            const idUsuario = parseInt(cb.dataset.id);
            const nombre = cb.dataset.nombre || `Usuario ${idUsuario}`;

            fechas.forEach(fecha => {
                const tieneNL = this.parentController._tieneNoLaborable(idUsuario, fecha);
                if (tieneNL) { omitidas++; return; }

                const tieneAsig = this.parentController._tieneAsignacion(idUsuario, fecha);
                if (tieneAsig) { omitidas++; return; }

                asignaciones.push({
                    IdUsuario: idUsuario,
                    Fecha: fecha,
                    Observacion: 'NO LABORA - DÍA NO LABORABLE',
                    NombreUsuario: nombre
                });
            });
        });

        if (omitidas > 0) {
            this.parentController.mostrarMensaje(`${omitidas} fecha(s) omitidas`, 'warning');
        }

        if (asignaciones.length === 0) {
            this.parentController.mostrarMensaje('No se generaron días no laborables', 'warning');
            return null;
        }

        return asignaciones;
    }

    previsualizar() {
        const asignaciones = this.generarAsignacionesDesdeFormulario();
        if (!asignaciones) return;
        this.mostrarPrevisualizacion(asignaciones);
    }

    mostrarPrevisualizacion(asignaciones) {
        if (!this.previsualizacionDiv) return;
        this.previsualizacionDiv.style.display = 'block';
        document.getElementById('formNoLaborableMasivo').style.display = 'none';
        this.tablaPrevisualizacion.innerHTML = '';

        asignaciones.slice(0, 100).forEach(a => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${this.parentController._escape(a.NombreUsuario)}</td>
                <td>${this.parentController._formatearFecha(a.Fecha)}</td>
                <td>${a.Observacion}</td>
            `;
            this.tablaPrevisualizacion.appendChild(row);
        });

        if (asignaciones.length > 100) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="3" style="text-align:center;color:#6c757d;">... y ${asignaciones.length - 100} más</td>`;
            this.tablaPrevisualizacion.appendChild(row);
        }

        if (this.totalAsignacionesSpan) this.totalAsignacionesSpan.textContent = asignaciones.length;
        this.asignacionesPendientes = asignaciones;
    }

    volverFormulario() {
        if (this.previsualizacionDiv) this.previsualizacionDiv.style.display = 'none';
        const form = document.getElementById('formNoLaborableMasivo');
        if (form) form.style.display = 'block';
    }

    abrirModalConfirmar() {
        const inicio = this.fechaInicio.value;
        const fin = this.fechaFin.value;
        if (!inicio || !fin) { this.parentController.mostrarMensaje('Seleccione un rango', 'warning'); return; }

        const checks = this.tablaUsuarios.querySelectorAll('.checkbox-usuario-nl-masivo:checked:not([disabled])');
        if (checks.length === 0) { this.parentController.mostrarMensaje('Seleccione al menos un usuario', 'warning'); return; }

        if (this.modalConfirmarRegistroDirecto) this.modalConfirmarRegistroDirecto.classList.add('active');
    }

    cerrarModalConfirmar() {
        if (this.modalConfirmarRegistroDirecto) this.modalConfirmarRegistroDirecto.classList.remove('active');
    }

    confirmarRegistroDirecto() {
        this.cerrarModalConfirmar();
        const asignaciones = this.generarAsignacionesDesdeFormulario();
        if (!asignaciones) return;

        this.asignacionesPendientes = asignaciones;
        if (!confirm(`¿Marcar ${asignaciones.length} días no laborables?`)) {
            this.asignacionesPendientes = [];
            return;
        }
        this.cerrarModal();
        this.iniciarRegistroMasivo();
    }

    confirmarRegistrar() {
        if (this.asignacionesPendientes.length === 0) {
            this.parentController.mostrarMensaje('Previsualice primero', 'warning');
            return;
        }
        if (!confirm(`¿Registrar ${this.asignacionesPendientes.length} días no laborables?`)) return;
        this.cerrarModal();
        this.iniciarRegistroMasivo();
    }

    iniciarRegistroMasivo() {
        if (this.asignacionesPendientes.length === 0) return;

        this.modalProgreso.classList.add('active');
        this.progresoBar.style.width = '0%';
        this.progresoTexto.textContent = 'Iniciando...';
        this.progresoPorcentaje.textContent = '0%';
        this.detalleProgreso.innerHTML = '<div>⏳ Preparando...</div>';
        this.estadoSQL.textContent = '⏳ Pendiente';
        this.btnCerrarProgreso.style.display = 'none';

        this.ejecutarRegistroMasivo();
    }

    async ejecutarRegistroMasivo() {
        const total = this.asignacionesPendientes.length;

        const payload = this.asignacionesPendientes.map(a => ({
            IdUsuario: a.IdUsuario,
            Fecha: a.Fecha,
            Observacion: a.Observacion || 'NO LABORA - DÍA NO LABORABLE'
        }));

        this.actualizarProgreso(0, total);
        this.estadoSQL.textContent = '🔄 Procesando...';

        try {
            const r = await this.service.registroMasivoNoLaborables(payload, this.usuarioActual.IdUsuario);

            if (!r.success) {
                this.mostrarDetalle(`❌ Error: ${r.error}`, 'error');
                this.estadoSQL.textContent = '❌ Falló';
                this.btnCerrarProgreso.style.display = 'inline-block';
                this.btnCerrarProgreso.textContent = '❌ Cerrar';
                this.btnCerrarProgreso.onclick = () => this.cerrarProgreso();
                return;
            }

            const data = r.resultado || {};
            const detalle = r.detalle || [];
            const estadoGeneral = data.EstadoGeneral || 'COMPLETADO';
            const errores = data.Errores || detalle.filter(d => d.Estado === 'ERROR').length || 0;
            const insertados = data.Insertados !== undefined ? data.Insertados : (estadoGeneral === 'COMPLETADO' && errores === 0 ? total : total - errores);
            const noRegistrados = total - insertados;

            this.mostrarDetalle(`📊 Resumen:`, 'info');
            this.mostrarDetalle(`   Total: ${total}`);
            this.mostrarDetalle(`   Insertadas: ${insertados}`);
            this.mostrarDetalle(`   No registradas: ${noRegistrados}`);
            this.mostrarDetalle(`   Errores: ${errores}`);

            if (detalle.length > 0) {
                detalle.filter(d => d.Estado === 'ERROR').forEach(e => {
                    this.mostrarDetalle(`   Usuario ${e.IdUsuario} - ${e.Fecha}: ${e.Mensaje}`, 'warning');
                });
            }

            this.actualizarProgreso(total, total);

            if (insertados > 0) {
                this.parentController.mostrarMensaje(`${insertados} días no laborables registrados`, 'success');
                await this.parentController.cargarAsignaciones();
                await this.parentController.cargarMarcaciones();
            }

            this.estadoSQL.textContent = insertados > 0 ? '✅ Completado' : '❌ Sin registros';
            this.btnCerrarProgreso.style.display = 'inline-block';
            this.btnCerrarProgreso.textContent = '✅ Finalizado';
            this.btnCerrarProgreso.onclick = () => this.cerrarProgreso();

        } catch (error) {
            console.error('❌ Error:', error);
            this.mostrarDetalle(`❌ Error de conexión: ${error.message}`, 'error');
            this.estadoSQL.textContent = '❌ Error';
            this.btnCerrarProgreso.style.display = 'inline-block';
            this.btnCerrarProgreso.textContent = '❌ Cerrar';
            this.btnCerrarProgreso.onclick = () => this.cerrarProgreso();
        }
    }

    actualizarProgreso(actual, total) {
        const pct = Math.round((actual / total) * 100);
        this.progresoBar.style.width = `${pct}%`;
        this.progresoBar.textContent = `${pct}%`;
        this.progresoPorcentaje.textContent = `${pct}%`;
        this.progresoTexto.textContent = `Procesando ${actual}/${total}`;
    }

    mostrarDetalle(msg) {
        const div = document.createElement('div');
        div.textContent = msg;
        this.detalleProgreso.appendChild(div);
        this.detalleProgreso.scrollTop = this.detalleProgreso.scrollHeight;
    }

    cerrarProgreso() {
        if (this.modalProgreso) this.modalProgreso.classList.remove('active');
        this.asignacionesPendientes = [];
    }

    filtrar(texto) {
        if (!this.tablaUsuarios) return;
        const t = texto.toLowerCase().trim();
        let visibles = 0;
        this.tablaUsuarios.querySelectorAll('tr').forEach(fila => {
            const txt = fila.textContent.toLowerCase();
            if (t === '' || txt.includes(t)) { fila.style.display = ''; visibles++; }
            else fila.style.display = 'none';
        });
        if (this.mostrados) this.mostrados.textContent = visibles;
    }
}

if (typeof window !== 'undefined') {
    window.NoLaborableMasivoController = NoLaborableMasivoController;
}