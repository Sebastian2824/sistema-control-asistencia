// ==============================================
// CONTROLLER: RegistroMasivoController
// Asignación masiva por rango de fechas (SP)
// Depende de: AsignacionService (vía parentController)
// ==============================================

class RegistroMasivoController {

    constructor(config, parentController) {
        this.config = config || {};
        this.parentController = parentController;
        this.service = parentController.asignacionService;
        this.usuarioActual = parentController.usuarioActual;

        this.modal = document.getElementById('modalRegistroMasivo');
        this.modalProgreso = document.getElementById('modalProgresoMasivo');
        this.modalConfirmarRegistroDirecto = document.getElementById('modalConfirmarRegistroDirectoMasivo');

        // Formulario
        this.fechaInicio = document.getElementById('fechaInicioMasivo');
        this.fechaFin = document.getElementById('fechaFinMasivo');
        this.horarioSelect = document.getElementById('horarioMasivo');
        this.estadoSelect = document.getElementById('estadoMasivo');
        this.tablaUsuarios = document.getElementById('tablaUsuariosMasivo');
        this.seleccionarTodos = document.getElementById('seleccionarTodosMasivo');

        // Búsqueda
        this.busquedaMasivo = document.getElementById('busquedaUsuarioMasivo');
        this.btnLimpiarMasivo = document.getElementById('btnLimpiarBusquedaMasivo');
        this.mostradosMasivo = document.getElementById('mostradosMasivo');
        this.totalUsuariosMasivo = document.getElementById('totalUsuariosMasivo');

        // Previsualización
        this.previsualizacionDiv = document.getElementById('previsualizacionMasivo');
        this.tablaPrevisualizacion = document.getElementById('tablaPrevisualizacionMasivo');
        this.totalAsignacionesSpan = document.getElementById('totalAsignacionesMasivo');

        // Botones
        this.btnCancelar = document.getElementById('btnCancelarMasivo');
        this.btnPrevisualizar = document.getElementById('btnPrevisualizarMasivo');
        this.btnVolverForm = document.getElementById('btnVolverFormMasivo');
        this.btnConfirmarGenerar = document.getElementById('btnConfirmarGenerarMasivo');
        this.btnRegistrarYaMasivo = document.getElementById('btnRegistrarYaMasivo');

        // Confirmar registro directo
        this.btnCancelarConfirmarRegistroDirecto = document.getElementById('btnCancelarConfirmarRegistroDirecto');
        this.btnDeseoPrevisualizarMasivo = document.getElementById('btnDeseoPrevisualizarMasivo');
        this.btnConfirmarRegistroDirectoMasivo = document.getElementById('btnConfirmarRegistroDirectoMasivo');
        this.closeConfirmarRegistroDirectoBtn = document.getElementById('closeConfirmarRegistroDirectoBtn');

        // Progreso
        this.progresoBar = document.getElementById('progresoMasivoBar');
        this.progresoTexto = document.getElementById('progresoMasivoTexto');
        this.progresoPorcentaje = document.getElementById('progresoMasivoPorcentaje');
        this.detalleProgreso = document.getElementById('detalleProgresoMasivo');
        this.estadoSQL = document.getElementById('estadoSQLMasivo');
        this.btnCerrarProgreso = document.getElementById('btnCerrarProgresoMasivo');

        // Estado
        this.asignacionesPendientes = [];
        this.usuariosActivos = [];
        this.usuariosGrupalActivos = [];
        this.procesoActivo = false;

        if (this.modal) this.configurarEventos();
    }

    // ==========================================
    // EVENTOS
    // ==========================================
    configurarEventos() {
        const closeBtn = document.getElementById('closeRegistroMasivoBtn');
        if (closeBtn) closeBtn.addEventListener('click', () => this.cerrarModal());
        if (this.btnCancelar) this.btnCancelar.addEventListener('click', () => this.cerrarModal());

        if (this.btnPrevisualizar) this.btnPrevisualizar.addEventListener('click', () => this.previsualizar());
        if (this.btnRegistrarYaMasivo) {
            this.btnRegistrarYaMasivo.addEventListener('click', () => this.abrirModalConfirmarRegistroDirecto());
        }
        if (this.btnConfirmarGenerar) this.btnConfirmarGenerar.addEventListener('click', () => this.confirmarRegistrar());
        if (this.btnVolverForm) this.btnVolverForm.addEventListener('click', () => this.volverFormulario());

        // Confirmar directo
        if (this.closeConfirmarRegistroDirectoBtn) this.closeConfirmarRegistroDirectoBtn.addEventListener('click', () => this.cerrarModalConfirmarRegistroDirecto());
        if (this.btnCancelarConfirmarRegistroDirecto) this.btnCancelarConfirmarRegistroDirecto.addEventListener('click', () => this.cerrarModalConfirmarRegistroDirecto());
        if (this.btnDeseoPrevisualizarMasivo) {
            this.btnDeseoPrevisualizarMasivo.addEventListener('click', () => {
                this.cerrarModalConfirmarRegistroDirecto();
                this.previsualizar();
            });
        }
        if (this.btnConfirmarRegistroDirectoMasivo) {
            this.btnConfirmarRegistroDirectoMasivo.addEventListener('click', () => this.confirmarRegistroDirecto());
        }

        // Progreso
        if (this.btnCerrarProgreso) this.btnCerrarProgreso.addEventListener('click', () => this.cerrarProgreso());

        // Cambios en formulario
        if (this.fechaInicio) this.fechaInicio.addEventListener('change', () => { this.sincronizarFechas(); this.actualizarInfoRango(); this.renderizarTablaUsuarios(); });
        if (this.fechaFin) this.fechaFin.addEventListener('change', () => { this.validarFechaFin(); this.actualizarInfoRango(); this.renderizarTablaUsuarios(); });
        if (this.horarioSelect) this.horarioSelect.addEventListener('change', () => this.renderizarTablaUsuarios());
        if (this.estadoSelect) this.estadoSelect.addEventListener('change', () => this.renderizarTablaUsuarios());

        if (this.seleccionarTodos) {
            this.seleccionarTodos.addEventListener('change', (e) => {
                this.tablaUsuarios.querySelectorAll('.checkbox-usuario-masivo:not([disabled])').forEach(cb => cb.checked = e.target.checked);
            });
        }

        if (this.tablaUsuarios) {
            this.tablaUsuarios.addEventListener('change', (e) => {
                if (e.target.classList.contains('checkbox-usuario-masivo')) this.actualizarSeleccionarTodos();
            });
        }

        if (this.busquedaMasivo) {
            this.busquedaMasivo.addEventListener('input', (e) => this.filtrarUsuarios(e.target.value));
        }
        if (this.btnLimpiarMasivo) {
            this.btnLimpiarMasivo.addEventListener('click', () => {
                if (this.busquedaMasivo) { this.busquedaMasivo.value = ''; this.filtrarUsuarios(''); }
            });
        }
    }

    // ==========================================
    // MODAL
    // ==========================================
    async abrirModal() {
        this.limpiarFormulario();
        await this.parentController.cargarAsignaciones();
        await this.parentController.cargarMarcaciones();
        await this.cargarDatos();
        this.sincronizarFechas();
        this.actualizarInfoRango();
        this.modal.classList.add('active');
    }

    cerrarModal() {
        if (this.modal) this.modal.classList.remove('active');
        if (this.previsualizacionDiv) this.previsualizacionDiv.style.display = 'none';
        const form = document.getElementById('formRegistroMasivo');
        if (form) form.style.display = 'block';
    }

    // ==========================================
    // CARGA DE DATOS
    // ==========================================
    async cargarDatos() {
        this.cargarHorarios();
        this.cargarEstados();
        this.cargarUsuarios();
    }

    cargarHorarios() {
        if (!this.horarioSelect) return;
        this.horarioSelect.innerHTML = '<option value="">-- Seleccione un horario --</option>';

        const horarios = this.parentController.horarios.filter(h => {
            const esActivo = h.IdEstado === 1;
            const noEsAlmuerzo = !h.Descripcion || !h.Descripcion.toLowerCase().includes('almuerzo');
            return esActivo && noEsAlmuerzo;
        });

        horarios.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h.IdHorario;
            let desc = h.Descripcion || '';
            if (h.TiempoHoras || h.TiempoMinutos) {
                desc += ` (${h.TiempoHoras || 0}h ${h.TiempoMinutos || 0}min)`;
            }
            opt.textContent = desc;
            this.horarioSelect.appendChild(opt);
        });
    }

    cargarEstados() {
        if (!this.estadoSelect) return;
        const activo = this.parentController.estados.find(e => String(e.Descripcion || '').toUpperCase() === 'ACTIVO');
        this.estadoSelect.innerHTML = '';
        if (activo) {
            const opt = document.createElement('option');
            opt.value = activo.IdEstado;
            opt.textContent = `${activo.IdEstado} - ${activo.Descripcion}`;
            opt.selected = true;
            this.estadoSelect.appendChild(opt);
            this.estadoSelect.disabled = true;
        } else {
            this.parentController.estados.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.IdEstado;
                opt.textContent = `${e.IdEstado} - ${e.Descripcion}`;
                this.estadoSelect.appendChild(opt);
            });
        }
    }

    cargarUsuarios() {
        this.usuariosActivos = this.parentController.usuarios.filter(u => u.seleccionable);
        this.renderizarTablaUsuarios();
    }

    // ==========================================
    // FECHAS
    // ==========================================
    sincronizarFechas() {
        const inicio = this.fechaInicio.value;
        const fin = this.fechaFin.value;
        if (!inicio) return;

        const hoy = this._fechaHoyStr();
        if (inicio < hoy) { this.fechaInicio.value = hoy; }
        if (!fin || fin < this.fechaInicio.value) {
            this.fechaFin.value = this.fechaInicio.value;
        }

        this.fechaInicio.min = hoy;
        this.fechaFin.min = this.fechaInicio.value;
    }

    validarFechaFin() {
        if (!this.fechaInicio.value || !this.fechaFin.value) return;
        if (this.fechaFin.value < this.fechaInicio.value) {
            this.parentController.mostrarMensaje('La fecha fin no puede ser anterior a la fecha inicio', 'warning');
            this.fechaFin.value = this.fechaInicio.value;
        }
    }

    actualizarInfoRango() {
        const inicio = this.fechaInicio?.value;
        const fin = this.fechaFin?.value;
        const infoSpan = document.getElementById('infoRangoMasivo');
        if (!infoSpan) return;

        if (inicio && fin) {
            const dias = this.calcularDiasRango(inicio, fin);
            infoSpan.textContent = `Rango de ${dias} día(s) (${this._formatearFecha(inicio)} - ${this._formatearFecha(fin)})`;
        } else {
            infoSpan.textContent = 'Seleccione un rango de fechas (hoy o futuro)';
        }
    }

    calcularDiasRango(inicio, fin) {
        const ini = new Date(inicio + 'T00:00:00');
        const f = new Date(fin + 'T00:00:00');
        return Math.ceil(Math.abs(f - ini) / (1000 * 60 * 60 * 24)) + 1;
    }

    _fechaHoyStr() {
        const hoy = new Date();
        return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    }

    _formatearFecha(f) {
        if (!f) return 'N/A';
        const [y, m, d] = f.slice(0, 10).split('-');
        return `${d}/${m}/${y}`;
    }

    // ==========================================
    // TABLA USUARIOS
    // ==========================================
    // ==========================================
    // TABLA USUARIOS
    // ==========================================
    renderizarTablaUsuarios() {
        if (!this.tablaUsuarios) return;

        const inicio = this.fechaInicio?.value;
        const fin = this.fechaFin?.value;

        if (!inicio || !fin) {
            this.tablaUsuarios.innerHTML = '<tr><td colspan="8" class="loading">Seleccione un rango de fechas primero</td></tr>';
            return;
        }

        if (this.usuariosActivos.length === 0) {
            this.tablaUsuarios.innerHTML = '<tr><td colspan="8" class="loading">No hay usuarios activos</td></tr>';
            return;
        }

        const fechas = this.generarFechasRango(inicio, fin);
        const totalFechas = fechas.length;

        // Horario general (selector del header del modal)
        const horarioGeneralId = parseInt(this.horarioSelect?.value) || null;
        const horarioGeneral = horarioGeneralId
            ? this.parentController.horarios.find(h => h.IdHorario === horarioGeneralId)
            : null;

        // Estado por defecto
        const estadoId = parseInt(this.estadoSelect?.value);
        const estado = this.parentController.estados.find(e => e.IdEstado === estadoId);

        this.tablaUsuarios.innerHTML = '';

        this.usuariosActivos.forEach(u => {
            const ocupadas = this._fechasOcupadas(u.IdUsuario, fechas);
            const bloqueado = ocupadas.length === totalFechas;

            const row = document.createElement('tr');

            const indicador = ocupadas.length > 0 && !bloqueado
                ? `<span style="color: #856404; font-size: 10px; display: block;">${ocupadas.length} día(s) ocupado(s)</span>`
                : '';

            row.innerHTML = `
            <td class="checkbox-column">
                <input type="checkbox" class="checkbox-usuario-masivo"
                       data-id="${u.IdUsuario}"
                       data-nombre="${u.Nombres} ${u.Apellidos}"
                       ${bloqueado ? 'disabled' : ''}
                       title="${bloqueado ? 'Todas las fechas ocupadas' : ''}">
                ${indicador}
            </td>
            <td>${this.parentController._escape(u.Nombres)} ${this.parentController._escape(u.Apellidos)}</td>
            <td>
                <select class="select-horario-masivo" data-id="${u.IdUsuario}">
                    <option value="">-- Seleccione --</option>
                    ${this.parentController.horarios.map(h => `
                        <option value="${h.IdHorario}" ${horarioGeneralId === h.IdHorario ? 'selected' : ''}>
                            ${this.parentController._escape(h.Descripcion)}
                        </option>
                    `).join('')}
                </select>
            </td>
            <td class="ing-cell">--:--</td>
            <td class="sal-cell">--:--</td>
            <td class="ing-alm-cell">--:--</td>
            <td class="sal-alm-cell">--:--</td>
            <td>${estado ? `<span class="badge badge-activo">${this.parentController._escape(estado.Descripcion)}</span>` : '--'}</td>
        `;

            this.tablaUsuarios.appendChild(row);

            // ============================================
            // LISTENER INDIVIDUAL DEL SELECT DE HORARIO
            // ============================================
            const selectH = row.querySelector('.select-horario-masivo');
            if (selectH) {
                selectH.addEventListener('change', () => {
                    const idHorario = parseInt(selectH.value);
                    const h = this.parentController.horarios.find(x => x.IdHorario === idHorario);

                    if (!h) {
                        row.querySelector('.ing-cell').textContent = '--:--';
                        row.querySelector('.sal-cell').textContent = '--:--';
                        row.querySelector('.ing-alm-cell').textContent = '--:--';
                        row.querySelector('.sal-alm-cell').textContent = '--:--';
                        return;
                    }

                    row.querySelector('.ing-cell').textContent = this.parentController._formatearHora(h.HoraIngreso);
                    row.querySelector('.sal-cell').textContent = this.parentController._formatearHora(h.HoraSalida);
                    row.querySelector('.ing-alm-cell').textContent = this.parentController._formatearHora(h.HoraIngAlmuerzo);
                    row.querySelector('.sal-alm-cell').textContent = this.parentController._formatearHora(h.HoraSalAlmuerzo);
                });
            }
        });

        if (this.totalUsuariosMasivo) this.totalUsuariosMasivo.textContent = this.usuariosActivos.length;
        if (this.busquedaMasivo) this.filtrarUsuarios(this.busquedaMasivo.value);

        // ============================================
        // FIX: disparar 'change' en selects con valor pre-seleccionado
        // (para que se pinten las horas del horario general)
        // ============================================
        this.tablaUsuarios.querySelectorAll('.select-horario-masivo').forEach(sel => {
            if (sel.value) {
                sel.dispatchEvent(new Event('change'));
            }
        });

        // Actualizar el estado de "seleccionar todos"
        this.actualizarSeleccionarTodos();
    }

    // ==========================================
    // SINCRONIZACIÓN HORAS
    // ==========================================
    _configurarSincronizacionHoras(horario) {
        const duracion = this._calcularDuracionTotal(horario);
        if (!duracion) return;

        const ingresos = this.tablaUsuarios.querySelectorAll('.ingreso-personalizado-masivo');
        const salidas = this.tablaUsuarios.querySelectorAll('.salida-personalizada-masivo');

        ingresos.forEach((ingInput, i) => {
            const salInput = salidas[i];
            if (!salInput) return;

            const nuevoIng = ingInput.cloneNode(true);
            const nuevoSal = salInput.cloneNode(true);
            ingInput.parentNode.replaceChild(nuevoIng, ingInput);
            salInput.parentNode.replaceChild(nuevoSal, salInput);

            nuevoIng.addEventListener('change', () => {
                if (nuevoIng.value) {
                    const calc = this._calcularSalida(nuevoIng.value, duracion);
                    if (calc) nuevoSal.value = calc;
                }
            });
            nuevoSal.addEventListener('change', () => {
                if (nuevoSal.value) {
                    const calc = this._calcularIngreso(nuevoSal.value, duracion);
                    if (calc) nuevoIng.value = calc;
                }
            });
        });
    }

    _calcularDuracionTotal(horario) {
        if (!horario) return 0;
        const base = horario.TiempoMinutos || (horario.TiempoHoras * 60) || 0;
        // Regla: > 5h → +1h almuerzo
        if (base > 300) return base + 60;
        return base;
    }

    _calcularSalida(ingreso, duracion) {
        const [h, m] = ingreso.split(':').map(Number);
        let total = h * 60 + m + duracion;
        if (total >= 1440) total -= 1440;
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }

    _calcularIngreso(salida, duracion) {
        const [h, m] = salida.split(':').map(Number);
        let total = h * 60 + m - duracion;
        if (total < 0) total += 1440;
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }

    // ==========================================
    // HELPERS FECHAS OCUPADAS
    // ==========================================
    _fechasOcupadas(idUsuario, fechas) {
        const ocupadas = new Set();

        // Asignaciones activas (IdEstado=1) o eliminadas (IdEstado=2)
        this.parentController.todasAsignaciones.forEach(a => {
            if (a.IdUsuario !== idUsuario) return;
            if (a.IdEstado !== 1 && a.IdEstado !== 2) return;
            const f = this.parentController._normalizarFecha(a.Fecha);
            if (fechas.includes(f)) ocupadas.add(f);
        });

        // Marcaciones NO LABORABLE
        this.parentController.marcacionesExistentes.forEach(m => {
            if (m.IdUsuario !== idUsuario) return;
            const f = this.parentController._normalizarFecha(m.Fecha);
            const obs = (m.ObsGeneral || m.Observacion || '').toUpperCase();
            if (obs.includes('NO LABORA') && fechas.includes(f)) ocupadas.add(f);
        });

        return Array.from(ocupadas);
    }

    generarFechasRango(inicio, fin) {
        const fechas = [];
        const cur = new Date(inicio + 'T00:00:00');
        const end = new Date(fin + 'T00:00:00');
        while (cur <= end) {
            fechas.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
            cur.setDate(cur.getDate() + 1);
        }
        return fechas;
    }

    // ==========================================
    // GENERAR ASIGNACIONES
    // ==========================================
    // ==========================================
    // GENERAR ASIGNACIONES
    // ==========================================
    generarAsignacionesDesdeFormulario() {
        const inicio = this.fechaInicio.value;
        const fin = this.fechaFin.value;
        const estadoId = parseInt(this.estadoSelect.value);

        if (!inicio || !fin) { this.parentController.mostrarMensaje('Seleccione un rango', 'warning'); return null; }
        if (inicio > fin) { this.parentController.mostrarMensaje('Rango inválido', 'warning'); return null; }
        if (!estadoId) { this.parentController.mostrarMensaje('Seleccione un estado', 'warning'); return null; }

        const checks = this.tablaUsuarios.querySelectorAll('.checkbox-usuario-masivo:checked:not([disabled])');
        if (checks.length === 0) { this.parentController.mostrarMensaje('Seleccione al menos un usuario', 'warning'); return null; }

        const estado = this.parentController.estados.find(e => e.IdEstado === estadoId);
        const estadoDesc = estado ? estado.Descripcion : '--';

        const fechas = this.generarFechasRango(inicio, fin);
        const asignaciones = [];

        let omitidas = 0;
        let sinHorario = 0;

        checks.forEach(cb => {
            const idUsuario = parseInt(cb.dataset.id);
            const row = cb.closest('tr');
            const selH = row.querySelector('.select-horario-masivo');
            const idHorario = selH ? parseInt(selH.value) : null;

            if (!idHorario) {
                sinHorario++;
                return;
            }

            const horario = this.parentController.horarios.find(h => h.IdHorario === idHorario);
            if (!horario) {
                sinHorario++;
                return;
            }

            const ingHorario = this.parentController._normalizarHora(horario.HoraIngreso);
            const salHorario = this.parentController._normalizarHora(horario.HoraSalida);
            const ingAlm = this.parentController._normalizarHora(horario.HoraIngAlmuerzo);
            const salAlm = this.parentController._normalizarHora(horario.HoraSalAlmuerzo);

            fechas.forEach(fecha => {
                // Duplicado
                if (this.parentController.existeAsignacionDuplicada(idUsuario, fecha)) {
                    omitidas++;
                    return;
                }

                // NO LABORABLE
                if (this.parentController._tieneNoLaborable(idUsuario, fecha)) {
                    omitidas++;
                    return;
                }

                if (!ingHorario || !salHorario) return;

                asignaciones.push({
                    IdUsuario: idUsuario,
                    IdHorario: idHorario,
                    Fecha: fecha,
                    IngEsperado: ingHorario,
                    SalEsperada: salHorario,
                    IngAlmuerzoEsperado: ingAlm || null,
                    SalAlmuerzoEsperado: salAlm || null,
                    IdEstado: estadoId,
                    NombreUsuario: this.parentController._obtenerNombreUsuario(idUsuario),
                    DescripcionHorario: horario.Descripcion,
                    EstadoDescripcion: estadoDesc
                });
            });
        });

        if (omitidas > 0) {
            this.parentController.mostrarMensaje(`${omitidas} fecha(s) omitidas por duplicado o no laborable`, 'warning');
        }

        if (sinHorario > 0) {
            this.parentController.mostrarMensaje(`${sinHorario} usuario(s) sin horario seleccionado`, 'warning');
        }

        if (asignaciones.length === 0) {
            this.parentController.mostrarMensaje('No se generaron asignaciones', 'warning');
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
        document.getElementById('formRegistroMasivo').style.display = 'none';
        this.tablaPrevisualizacion.innerHTML = '';

        const ordenadas = [...asignaciones].sort((a, b) => a.Fecha.localeCompare(b.Fecha));

        ordenadas.forEach(a => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${this.parentController._escape(a.NombreUsuario)}</td>
                <td>${this.parentController._escape(a.DescripcionHorario)}</td>
                <td>${this._formatearFecha(a.Fecha)}</td>
                <td><span class="hora-fija">${a.IngEsperado || '--:--'}</span></td>
                <td><span class="hora-fija">${a.SalEsperada || '--:--'}</span></td>
                <td><span class="hora-fija">${a.IngAlmuerzoEsperado || '--:--'}</span></td>
                <td><span class="hora-fija">${a.SalAlmuerzoEsperado || '--:--'}</span></td>
                <td><span class="badge badge-activo">${this.parentController._escape(a.EstadoDescripcion)}</span></td>
            `;
            this.tablaPrevisualizacion.appendChild(row);
        });

        if (this.totalAsignacionesSpan) this.totalAsignacionesSpan.textContent = ordenadas.length;
        this.asignacionesPendientes = ordenadas;
    }

    volverFormulario() {
        if (this.previsualizacionDiv) this.previsualizacionDiv.style.display = 'none';
        const form = document.getElementById('formRegistroMasivo');
        if (form) form.style.display = 'block';
    }

    // ==========================================
    // CONFIRMAR REGISTRO
    // ==========================================
    confirmarRegistrar() {
        if (this.asignacionesPendientes.length === 0) {
            this.parentController.mostrarMensaje('Previsualice primero', 'warning');
            return;
        }
        if (!confirm(`¿Registrar ${this.asignacionesPendientes.length} asignaciones?`)) return;
        this.cerrarModal();
        this.iniciarRegistroMasivo();
    }

    abrirModalConfirmarRegistroDirecto() {
        const inicio = this.fechaInicio.value;
        const fin = this.fechaFin.value;

        if (!inicio || !fin) { this.parentController.mostrarMensaje('Seleccione un rango', 'warning'); return; }

        const checks = this.tablaUsuarios.querySelectorAll('.checkbox-usuario-masivo:checked:not([disabled])');
        if (checks.length === 0) { this.parentController.mostrarMensaje('Seleccione al menos un usuario', 'warning'); return; }

        // Verificar que al menos uno tenga horario seleccionado
        let conHorario = 0;
        checks.forEach(cb => {
            const row = cb.closest('tr');
            const selH = row.querySelector('.select-horario-masivo');
            if (selH && selH.value) conHorario++;
        });

        if (conHorario === 0) {
            this.parentController.mostrarMensaje('Ningún usuario seleccionado tiene horario asignado', 'warning');
            return;
        }

        if (this.modalConfirmarRegistroDirecto) this.modalConfirmarRegistroDirecto.classList.add('active');
    }

    cerrarModalConfirmarRegistroDirecto() {
        if (this.modalConfirmarRegistroDirecto) this.modalConfirmarRegistroDirecto.classList.remove('active');
    }

    confirmarRegistroDirecto() {
        this.cerrarModalConfirmarRegistroDirecto();
        const asignaciones = this.generarAsignacionesDesdeFormulario();
        if (!asignaciones) return;

        this.asignacionesPendientes = asignaciones;
        if (!confirm(`¿Registrar ${asignaciones.length} asignaciones?`)) {
            this.asignacionesPendientes = [];
            return;
        }
        this.cerrarModal();
        this.iniciarRegistroMasivo();
    }

    // ==========================================
    // REGISTRO MASIVO
    // ==========================================
    iniciarRegistroMasivo() {
        if (this.asignacionesPendientes.length === 0) return;

        this.modalProgreso.classList.add('active');
        this.progresoBar.style.width = '0%';
        this.progresoTexto.textContent = 'Iniciando registro masivo...';
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
            IdHorario: a.IdHorario,
            Fecha: a.Fecha,
            IngEsperado: a.IngEsperado || null,
            SalEsperada: a.SalEsperada || null,
            IngAlmuerzoEsperado: a.IngAlmuerzoEsperado || null,
            SalAlmuerzoEsperado: a.SalAlmuerzoEsperado || null,
            IdEstado: a.IdEstado
        }));

        this.actualizarProgreso(0, total);
        this.progresoTexto.textContent = 'Ejecutando en servidor...';
        this.estadoSQL.textContent = '🔄 Procesando...';

        try {
            const r = await this.service.registroMasivo(payload, this.usuarioActual.IdUsuario);

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
            this.mostrarDetalle(`   Total enviadas: ${total}`);
            this.mostrarDetalle(`   Insertadas: ${insertados}`);
            this.mostrarDetalle(`   No registradas: ${noRegistrados}`);
            this.mostrarDetalle(`   Errores: ${errores}`);
            this.mostrarDetalle(`   Estado: ${estadoGeneral}`);

            if (detalle.length > 0) {
                detalle.filter(d => d.Estado === 'ERROR').forEach(e => {
                    this.mostrarDetalle(`   Usuario ${e.IdUsuario} - ${e.Fecha}: ${e.Mensaje}`, 'warning');
                });
            }

            this.actualizarProgreso(total, total);

            if (insertados > 0) {
                this.parentController.mostrarMensaje(`${insertados} asignaciones creadas`, 'success');
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
        this.procesoActivo = false;
    }

    // ==========================================
    // HELPERS
    // ==========================================
    actualizarSeleccionarTodos() {
        if (!this.seleccionarTodos) return;
        const checks = this.tablaUsuarios.querySelectorAll('.checkbox-usuario-masivo:not([disabled])');
        const checked = this.tablaUsuarios.querySelectorAll('.checkbox-usuario-masivo:checked:not([disabled])');
        this.seleccionarTodos.checked = checks.length > 0 && checks.length === checked.length;
        this.seleccionarTodos.indeterminate = checked.length > 0 && checked.length < checks.length;
    }

    filtrarUsuarios(texto) {
        if (!this.tablaUsuarios) return;
        const t = texto.toLowerCase().trim();
        const filas = this.tablaUsuarios.querySelectorAll('tr');
        let visibles = 0;
        filas.forEach(fila => {
            const txt = fila.textContent.toLowerCase();
            if (t === '' || txt.includes(t)) { fila.style.display = ''; visibles++; }
            else fila.style.display = 'none';
        });
        if (this.mostradosMasivo) this.mostradosMasivo.textContent = visibles;
    }

    limpiarFormulario() {
        const hoy = this._fechaHoyStr();
        if (this.fechaInicio) this.fechaInicio.value = hoy;
        if (this.fechaFin) this.fechaFin.value = hoy;
        if (this.previsualizacionDiv) this.previsualizacionDiv.style.display = 'none';
        const form = document.getElementById('formRegistroMasivo');
        if (form) form.style.display = 'block';
        if (this.seleccionarTodos) this.seleccionarTodos.checked = false;
        this.asignacionesPendientes = [];
    }
}

if (typeof window !== 'undefined') {
    window.RegistroMasivoController = RegistroMasivoController;
}