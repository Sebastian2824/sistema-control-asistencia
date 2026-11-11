// ==============================================
// CONTROLLER: DashboardResumenController (Sub-controlador)
// Responsabilidad: Tabla de resumen mensual y paginación.
//
// Flujo:
//   1. Filtrar marcaciones del mes seleccionado.
//   2. Clasificar estados (ingreso, almuerzos, faltas).
//   3. Ordenar (hoy → ayer → pasado, o ascendente para meses pasados).
//   4. Paginar (4 registros por página).
//   5. Renderizar tabla + controles de paginación.
//   6. Exportar a PDF (recorrer todas las páginas).
// ==============================================

class DashboardResumenController {

    constructor(service, data, config) {
        this.service = service;
        this.data = data || {};
        this.config = config || {};

        // Estado
        this.mesActual = new Date().getMonth() + 1;
        this.añoActual = new Date().getFullYear();
        this.hayRegistrosEnMes = false;

        // Paginación
        this.paginaActual = 1;
        this.registrosPorPagina = 4;
        this.totalPaginas = 1;
        this.registros = [];          // registros filtrados (del mes)
        this.registrosPaginados = []; // slice de la página actual
        this.totalRegistros = 0;

        // Cachear DOM y configurar eventos
        this._cachearDOM();
        this._configurarEventos();
    }

    // ==========================================
    // CACHEAR DOM
    // ==========================================
    _cachearDOM() {
        this.tablaBody = document.getElementById('tablaResumenBody');
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

    // ==========================================
    // EVENTOS
    // ==========================================
    _configurarEventos() {
        if (this.btnPrimeraPagina) {
            this.btnPrimeraPagina.addEventListener('click', () => this._irPrimera());
        }
        if (this.btnPaginaAnterior) {
            this.btnPaginaAnterior.addEventListener('click', () => this._irAnterior());
        }
        if (this.btnPaginaSiguiente) {
            this.btnPaginaSiguiente.addEventListener('click', () => this._irSiguiente());
        }
        if (this.btnUltimaPagina) {
            this.btnUltimaPagina.addEventListener('click', () => this._irUltima());
        }
    }

    // ==========================================
    // CARGA PRINCIPAL
    // ==========================================
    async cargar(mes, año, hayRegistros) {
        this.mesActual = mes;
        this.añoActual = año;
        this.hayRegistrosEnMes = hayRegistros;
        this.paginaActual = 1;

        console.log(`📊 Resumen: cargando para ${mes}/${año} (hay registros: ${hayRegistros})`);

        // Si no hay registros en el mes, mostrar tabla vacía
        if (!hayRegistros) {
            this.registros = [];
            this.totalRegistros = 0;
            this.totalPaginas = 1;
            this._renderizarTablaVacia();
            return;
        }

        // Procesar marcaciones del mes
        this._procesarRegistros(mes, año);

        // Ordenar según contexto
        this._ordenarRegistros();

        // Paginar y renderizar
        this.totalRegistros = this.registros.length;
        this.totalPaginas = Math.ceil(this.totalRegistros / this.registrosPorPagina) || 1;
        this._renderizarPaginaActual();
    }

    // ==========================================
    // PROCESAR REGISTROS (clasificar y formatear)
    // ==========================================
    _procesarRegistros(mes, año) {
        const fechaInicio = this._getFechaInicioMes(mes, año);
        const fechaFin = this._getFechaFinMes(mes, año);

        // 1. Filtrar marcaciones del mes (activas, en rango)
        const marcaciones = (this.data.marcaciones || []).filter(m => {
            if (m.IdEstado !== 1) return false;
            const f = this._normalizarFecha(m.Fecha);
            return f >= fechaInicio && f <= fechaFin;
        });

        // 2. Mapear a formato de tabla
        const registros = [];

        for (const m of marcaciones) {
            const usuario = this._getUsuario(m.IdUsuario);

            // Clasificar
            const esFaltaJust = this._esFaltaJustificada(m);
            const esFaltaNoJust = this._esFaltaNoJustificada(m);
            const esFaltaPend = this._esJustificacionPendiente(m);
            const esNoLab = this._esDiaNoLaborable(m);

            const tieneHora = m.IngMarcado || m.SalMarcada || m.IngAlmuerzoMarcado || m.SalAlmuerzoMarcada;

            // Incluir si tiene alguna hora o es falta/no laborable
            if (!tieneHora && !esFaltaJust && !esFaltaNoJust && !esFaltaPend && !esNoLab) {
                continue;
            }

            // Estado Ingreso
            const estadoIngreso = this._clasificarEstadoIngreso(m);

            // Estado Almuerzo Ingreso
            const estadoAlmIng = this._clasificarEstadoAlmuerzoIngreso(m);

            // Estado Almuerzo Salida (con justificación)
            const estadoAlmSal = this._clasificarEstadoAlmuerzoSalida(m);

            // Falta / No laborable
            const falta = this._clasificarFalta(m);

            registros.push({
                idUsuario: m.IdUsuario,
                usuario: usuario
                    ? `${usuario.Nombres || usuario.Nombre || ''} ${usuario.Apellidos || ''}`.trim()
                    : `Usuario ${m.IdUsuario}`,
                fecha: this._normalizarFecha(m.Fecha),
                fechaDisplay: this._formatearFecha(m.Fecha),
                horaIngreso: this._formatearHora(m.IngMarcado),
                estadoIngreso,
                almuerzoIngreso: this._formatearHora(m.IngAlmuerzoMarcado),
                estadoAlmIng,
                almuerzoSalida: this._formatearHora(m.SalAlmuerzoMarcada),
                estadoAlmSal,
                falta,
                _fechaOriginal: m.Fecha
            });
        }

        this.registros = registros;
    }

    // ==========================================
    // CLASIFICADORES DE ESTADO
    // ==========================================
    _clasificarEstadoIngreso(m) {
        const desc = this._getDescripcionEstado(m.IdEstadoIng);
        if (!desc) return { texto: '-', clase: 'missing' };

        if (desc === 'A TIEMPO') return { texto: 'A Tiempo', clase: 'ontime' };
        if (desc === 'TARDANZA') {
            const obs = String(m.ObsGeneral || m.Observacion || '').toUpperCase();
            if (obs.includes('TARDANZA JUSTIFICADA')) return { texto: 'Tardanza - Justificada', clase: 'late' };
            if (obs.includes('JUSTIFICACIÓN NO VÁLIDA')) return { texto: 'Tardanza - No Justif.', clase: 'late' };
            return { texto: 'Tardanza - No Justificada', clase: 'late' };
        }
        if (desc === 'EXCESO') return { texto: 'Exceso', clase: 'excess' };
        if (desc === 'FALTO') return { texto: 'Faltó', clase: 'missing' };

        return { texto: desc, clase: 'missing' };
    }

    _clasificarEstadoAlmuerzoIngreso(m) {
        const desc = this._getDescripcionEstado(m.IdEstadoAlmuerzoIng);
        if (!desc) return { texto: '-', clase: 'missing' };

        if (desc === 'A TIEMPO') return { texto: 'A Tiempo', clase: 'ontime' };
        if (desc === 'TARDANZA') {
            const obs = String(m.ObsIngresoAlmuerzo || '').toUpperCase();
            if (obs.includes('TARDANZA JUSTIFICADA')) return { texto: 'Tardanza - Justif.', clase: 'late' };
            return { texto: 'Tardanza - No Justif.', clase: 'late' };
        }
        return { texto: desc, clase: 'missing' };
    }

    _clasificarEstadoAlmuerzoSalida(m) {
        const desc = this._getDescripcionEstado(m.IdEstadoAlmuerzoSal);
        if (!desc) return { texto: '-', clase: 'missing' };

        if (desc === 'A TIEMPO') return { texto: 'A Tiempo', clase: 'ontime' };
        if (desc === 'EXCESO') {
            const obs = String(m.ObsSalidaAlmuerzo || '').toUpperCase();
            if (obs.includes('EXCESO JUSTIFICADO')) return { texto: 'Exceso - Justif.', clase: 'excess' };
            if (obs.includes('JUSTIFICACIÓN NO VÁLIDA')) return { texto: 'Exceso - No Justif.', clase: 'excess' };
            return { texto: 'Exceso - No Justif.', clase: 'excess' };
        }
        return { texto: desc, clase: 'missing' };
    }

    _clasificarFalta(m) {
        if (this._esFaltaJustificada(m)) return { texto: 'FALTA - JUSTIFICADA', clase: 'falta-justificada' };
        if (this._esFaltaNoJustificada(m)) return { texto: 'FALTA - NO JUSTIFICADA', clase: 'falta-no-justificada' };
        if (this._esJustificacionPendiente(m)) return { texto: 'JUSTIFICACIÓN PENDIENTE', clase: 'falta-pendiente' };
        if (this._esDiaNoLaborable(m)) return { texto: 'NO LABORA - DÍA NO LABORABLE', clase: 'falta-no-laborable' };
        return { texto: '-', clase: 'missing' };
    }

    // ==========================================
    // ORDENAMIENTO
    // ==========================================
    _ordenarRegistros() {
        const hoy = new Date();
        const esMesActual = (this.mesActual === hoy.getMonth() + 1 && this.añoActual === hoy.getFullYear());

        if (esMesActual) {
            // Mes actual: hoy → ayer → pasado
            const hoyStr = this._getFechaHoyStr();
            const ayerStr = this._getFechaAyerStr();

            this.registros.sort((a, b) => {
                if (a.fecha === hoyStr && b.fecha !== hoyStr) return -1;
                if (b.fecha === hoyStr && a.fecha !== hoyStr) return 1;
                if (a.fecha === ayerStr && b.fecha !== ayerStr) return -1;
                if (b.fecha === ayerStr && a.fecha !== ayerStr) return 1;
                return b.fecha.localeCompare(a.fecha);
            });
        } else {
            // Mes pasado: ascendente
            this.registros.sort((a, b) => a.fecha.localeCompare(b.fecha));
        }
    }

    // ==========================================
    // RENDERIZADO
    // ==========================================
    _renderizarPaginaActual() {
        const inicio = (this.paginaActual - 1) * this.registrosPorPagina;
        const fin = Math.min(inicio + this.registrosPorPagina, this.totalRegistros);
        this.registrosPaginados = this.registros.slice(inicio, fin);

        this._renderizarTabla(this.registrosPaginados);
        this._actualizarControlesPaginacion();
        this._actualizarInfoRegistros();
    }

    _renderizarTabla(registros) {
        if (!this.tablaBody) return;

        if (!registros || registros.length === 0) {
            this._renderizarTablaVacia();
            return;
        }

        this.tablaBody.innerHTML = '';

        registros.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${this._escape(r.usuario)}</strong></td>
                <td>${this._escape(r.fechaDisplay)}</td>
                <td>${this._escape(r.horaIngreso)}</td>
                <td><span class="estado-badge ${r.estadoIngreso.clase}">${this._escape(r.estadoIngreso.texto)}</span></td>
                <td>${this._escape(r.almuerzoIngreso)}</td>
                <td><span class="estado-badge ${r.estadoAlmIng.clase}">${this._escape(r.estadoAlmIng.texto)}</span></td>
                <td>${this._escape(r.almuerzoSalida)}</td>
                <td><span class="estado-badge ${r.estadoAlmSal.clase}">${this._escape(r.estadoAlmSal.texto)}</span></td>
                <td><span class="estado-badge ${r.falta.clase}">${this._escape(r.falta.texto)}</span></td>
            `;
            this.tablaBody.appendChild(tr);
        });
    }

    _renderizarTablaVacia() {
        if (!this.tablaBody) return;
        const nombreMes = this._getNombreMes(this.mesActual);
        this.tablaBody.innerHTML = `
            <tr>
                <td colspan="9" class="loading">
                    📭 No hay registros de marcaciones para ${nombreMes} ${this.añoActual}
                </td>
            </tr>
        `;
        if (this.paginacionContainer) this.paginacionContainer.style.display = 'none';
    }

    // ==========================================
    // CONTROLES DE PAGINACIÓN
    // ==========================================
    _actualizarControlesPaginacion() {
        if (!this.btnPrimeraPagina) return;

        const total = this.totalPaginas;
        const actual = this.paginaActual;

        this.btnPrimeraPagina.disabled = (actual === 1);
        this.btnPaginaAnterior.disabled = (actual === 1);
        this.btnPaginaSiguiente.disabled = (actual === total);
        this.btnUltimaPagina.disabled = (actual === total);

        if (this.paginaActualInfo) {
            this.paginaActualInfo.textContent = `Página ${actual} de ${total}`;
        }

        if (this.paginacionContainer) {
            this.paginacionContainer.style.display = this.totalRegistros > 0 ? 'flex' : 'none';
        }
    }

    _actualizarInfoRegistros() {
        const total = this.totalRegistros;
        const inicio = total > 0 ? (this.paginaActual - 1) * this.registrosPorPagina + 1 : 0;
        const fin = Math.min(inicio + this.registrosPorPagina - 1, total);

        if (this.inicioRegistro) this.inicioRegistro.textContent = inicio;
        if (this.finRegistro) this.finRegistro.textContent = fin;
        if (this.totalRegistrosSpan) this.totalRegistrosSpan.textContent = total;
    }

    // ==========================================
    // NAVEGACIÓN DE PÁGINAS
    // ==========================================
    _irPrimera() {
        if (this.paginaActual > 1) {
            this.paginaActual = 1;
            this._renderizarPaginaActual();
        }
    }

    _irAnterior() {
        if (this.paginaActual > 1) {
            this.paginaActual--;
            this._renderizarPaginaActual();
        }
    }

    _irSiguiente() {
        if (this.paginaActual < this.totalPaginas) {
            this.paginaActual++;
            this._renderizarPaginaActual();
        }
    }

    _irUltima() {
        if (this.paginaActual < this.totalPaginas) {
            this.paginaActual = this.totalPaginas;
            this._renderizarPaginaActual();
        }
    }

    // ==========================================
    // EXPORTAR A PDF
    // ==========================================
    /**
     * Captura la tabla de resumen en todas sus páginas.
     * Devuelve un array de canvas (uno por página).
     */
    async capturarParaPDF() {
        try {
            if (typeof html2canvas === 'undefined') {
                console.error('html2canvas no está cargado');
                return [];
            }

            if (!this.registros || this.registros.length === 0) {
                return [];
            }

            const tableContainer = document.querySelector('.table-container');
            if (!tableContainer) return [];

            const tablasCapturadas = [];

            // Guardar estado actual para restaurar al final
            const paginaOriginal = this.paginaActual;
            const paginacionOriginal = this.paginacionContainer?.style.display;

            // Ocultar controles durante la captura
            if (this.paginacionContainer) this.paginacionContainer.style.display = 'none';

            // Recorrer todas las páginas
            for (let p = 1; p <= this.totalPaginas; p++) {
                this.paginaActual = p;
                this._renderizarPaginaActual();

                // Esperar renderizado
                await new Promise(r => setTimeout(r, 200));

                // Capturar
                const canvas = await html2canvas(tableContainer, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    width: tableContainer.scrollWidth,
                    height: tableContainer.scrollHeight
                });

                tablasCapturadas.push({
                    canvas,
                    pagina: p,
                    totalPaginas: this.totalPaginas,
                    inicio: (p - 1) * this.registrosPorPagina + 1,
                    fin: Math.min(p * this.registrosPorPagina, this.totalRegistros),
                    total: this.totalRegistros
                });
            }

            // Restaurar estado
            this.paginaActual = paginaOriginal;
            this._renderizarPaginaActual();
            if (this.paginacionContainer) {
                this.paginacionContainer.style.display = paginacionOriginal || 'flex';
            }

            return tablasCapturadas;

        } catch (error) {
            console.error('❌ Error capturando resumen para PDF:', error);
            return [];
        }
    }

    // ==========================================
    // HELPERS: DATOS
    // ==========================================
    _getUsuario(idUsuario) {
        return (this.data.usuarios || []).find(u => u.IdUsuario === idUsuario) || null;
    }

    _getDescripcionEstado(idEstado) {
        if (!idEstado) return '';
        const e = (this.data.estados || []).find(x => x.IdEstado === idEstado);
        return e ? String(e.Descripcion || '').toUpperCase() : '';
    }

    // ==========================================
    // HELPERS: CLASIFICACIÓN
    // ==========================================
    _esFaltaJustificada(m) {
        const obs = String(m.ObsGeneral || m.Observacion || '').toUpperCase();
        return obs.includes('FALTA JUSTIFICADA');
    }
    _esFaltaNoJustificada(m) {
        const obs = String(m.ObsGeneral || m.Observacion || '').toUpperCase();
        return obs.includes('NO JUSTIFICÓ FALTA') || obs.includes('JUSTIFICACIÓN NO VÁLIDA - FALTA');
    }
    _esJustificacionPendiente(m) {
        const obs = String(m.ObsGeneral || m.Observacion || '').toUpperCase();
        return obs.includes('FALTA - JUSTIFICACIÓN PENDIENTE') || obs.includes('FALTA - JUSTIFICACION PENDIENTE');
    }
    _esDiaNoLaborable(m) {
        const obs = String(m.ObsGeneral || m.Observacion || '').toUpperCase();
        return obs.includes('NO LABORA - DIA NO LABORABLE') || obs.includes('NO LABORA - DÍA NO LABORABLE');
    }

    // ==========================================
    // HELPERS: FORMATEO
    // ==========================================
    _formatearFecha(fecha) {
        const f = this._normalizarFecha(fecha);
        if (!f) return '-';
        const [y, m, d] = f.split('-');
        return `${d}/${m}/${y}`;
    }

    _formatearHora(hora) {
        if (!hora) return '-';
        const s = String(hora).trim();
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

    _normalizarFecha(valor) {
        if (!valor) return '';
        if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) return valor.slice(0, 10);
        try {
            const d = new Date(valor);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        } catch { return ''; }
    }

    _getFechaInicioMes(mes, año) {
        return `${año}-${String(mes).padStart(2, '0')}-01`;
    }

    _getFechaFinMes(mes, año) {
        const ultimo = new Date(año, mes, 0).getDate();
        return `${año}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
    }

    _getFechaHoyStr() {
        const h = new Date();
        return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
    }

    _getFechaAyerStr() {
        const h = new Date();
        h.setDate(h.getDate() - 1);
        return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
    }

    _getNombreMes(mes) {
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return meses[mes - 1] || mes;
    }

    _escape(texto) {
        if (texto === null || texto === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(texto);
        return div.innerHTML;
    }
}

// ============================================
// EXPOSICIÓN GLOBAL
// ============================================
if (typeof window !== 'undefined') {
    window.DashboardResumenController = DashboardResumenController;
}