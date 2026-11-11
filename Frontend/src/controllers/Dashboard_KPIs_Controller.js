// ==============================================
// CONTROLLER: DashboardKPIsController (Sub-controlador)
// Responsabilidad: Cálculo, renderizado y visibilidad de los KPIs.
//
// Secciones:
//   1. KPIs del MES (siempre visibles)
//   2. KPIs de la SEMANA (solo si es mes actual)
//   3. KPIs del DÍA (solo si es mes actual)
//
// Depende de:
//   - DashboardService (inyectado por el padre)
//   - data (usuarios, marcaciones, asignaciones, estados, etc.)
// ==============================================

class DashboardKPIsController {

    constructor(service, data, config) {
        this.service = service;
        this.data = data || {};
        this.config = config || {};

        // Estado
        this.mesActual = new Date().getMonth() + 1;
        this.añoActual = new Date().getFullYear();
        this.esMesActual = true;
        this.hayRegistros = false;

        // Cachear DOM
        this._cachearDOM();
    }

    // ==========================================
    // CACHEAR DOM
    // ==========================================
    _cachearDOM() {
        // KPIs del MES
        this.kpiTotalUsuarios = document.getElementById('kpiTotalUsuarios');
        this.kpiAsignacionesMes = document.getElementById('kpiAsignacionesMes');
        this.kpiMarcacionesMes = document.getElementById('kpiMarcacionesMes');
        this.kpiFaltantesMes = document.getElementById('kpiFaltantesMes');
        this.kpiFaltasJustificadas = document.getElementById('kpiFaltasJustificadas');
        this.kpiFaltasNoJustificadas = document.getElementById('kpiFaltasNoJustificadas');
        this.kpiDiasNoLaborables = document.getElementById('kpiDiasNoLaborables');

        // KPIs de la SEMANA
        this.kpiAsignacionesSemana = document.getElementById('kpiAsignacionesSemana');
        this.kpiMarcacionesSemana = document.getElementById('kpiMarcacionesSemana');
        this.kpiFaltantesSemana = document.getElementById('kpiFaltantesSemana');
        this.kpiFaltasJustificadasSemana = document.getElementById('kpiFaltasJustificadasSemana');
        this.kpiFaltasNoJustificadasSemana = document.getElementById('kpiFaltasNoJustificadasSemana');
        this.kpiDiasNoLaborablesSemana = document.getElementById('kpiDiasNoLaborablesSemana');

        // KPIs del DÍA
        this.kpiAsignacionesHoy = document.getElementById('kpiAsignacionesHoy');
        this.kpiMarcacionesHoy = document.getElementById('kpiMarcacionesHoy');
        this.kpiFaltantesHoy = document.getElementById('kpiFaltantesHoy');
        this.kpiTardanza = document.getElementById('kpiTardanza');
        this.kpiATiempo = document.getElementById('kpiATiempo');
        this.kpiExcesoAlmuerzo = document.getElementById('kpiExcesoAlmuerzo');
        this.kpiCumplieronAlmuerzo = document.getElementById('kpiCumplieronAlmuerzo');

        // Secciones (para ocultar/mostrar)
        this.kpiSectionMes = document.getElementById('kpiSectionMes');
        this.kpiSectionSemana = document.getElementById('kpiSectionSemana');
        this.kpiSectionDia = document.getElementById('kpiSectionDia');

        // Subtítulos
        this.kpiMesSubtitle = document.getElementById('kpiMesSubtitle');
        this.kpiSemanaSubtitle = document.getElementById('kpiSemanaSubtitle');
        this.kpiDiaSubtitle = document.getElementById('kpiDiaSubtitle');
    }

    // ==========================================
    // CARGA / CÁLCULO PRINCIPAL
    // ==========================================
    async cargar(mes = null, año = null) {
        const mesFinal = mes || new Date().getMonth() + 1;
        const añoFinal = año || new Date().getFullYear();

        this.mesActual = mesFinal;
        this.añoActual = añoFinal;

        const hoy = new Date();
        this.esMesActual = (mesFinal === hoy.getMonth() + 1 && añoFinal === hoy.getFullYear());

        console.log(`📊 KPIs: calculando para ${mesFinal}/${añoFinal} - ¿Mes actual? ${this.esMesActual}`);

        // 1. Calcular KPIs del mes
        const kpisMes = this._calcularKPIsMes(mesFinal, añoFinal);
        this.hayRegistros = kpisMes.hayRegistros;

        console.log('📊 KPIs del Mes:', kpisMes);

        // 2. Renderizar KPIs del mes
        this._renderizarKPIsMes(kpisMes);

        // 3. Actualizar subtítulos
        this._actualizarSubtitulos();

        // 4. Mostrar u ocultar secciones Semana/Día
        this._actualizarVisibilidadSecciones();

        // 5. KPIs de semana/día solo si es mes actual
        if (this.esMesActual) {
            const kpisSemana = this._calcularKPIsSemana();
            this._renderizarKPIsSemana(kpisSemana);
            console.log('📊 KPIs de la Semana:', kpisSemana);

            const kpisHoy = this._calcularKPIsHoy();
            this._renderizarKPIsHoy(kpisHoy);
            console.log('📊 KPIs del Día:', kpisHoy);
        }
    }

    // ==========================================
    // CÁLCULO DE KPIs DEL MES
    // ==========================================
    _calcularKPIsMes(mes, año) {
        // 1. Total usuarios activos
        const totalUsuarios = (this.data.usuarios || []).filter(u => u.IdEstado === 1).length;

        // 2. Rango del mes
        const fechaInicio = this._getFechaInicioMes(mes, año);
        const fechaFin = this._getFechaFinMes(mes, año);

        // 3. Asignaciones del mes (activas y en rango)
        const asignacionesMes = (this.data.asignaciones || []).filter(a => {
            if (a.IdEstado !== 1) return false;
            const f = this._normalizarFecha(a.Fecha);
            return f >= fechaInicio && f <= fechaFin;
        });

        // 4. Marcaciones del mes (activas y en rango)
        const marcacionesMes = (this.data.marcaciones || []).filter(m => {
            if (m.IdEstado !== 1) return false;
            const f = this._normalizarFecha(m.Fecha);
            return f >= fechaInicio && f <= fechaFin;
        });

        // 5. Clasificar marcaciones
        const faltasJustificadas = marcacionesMes.filter(m => this._esFaltaJustificada(m));
        const faltasNoJustificadas = marcacionesMes.filter(m => this._esFaltaNoJustificada(m));
        const justificacionesPendientes = marcacionesMes.filter(m => this._esJustificacionPendiente(m));
        const diasNoLaborables = marcacionesMes.filter(m => this._esDiaNoLaborable(m));

        // 6. Marcaciones "válidas" (excluyen faltas y no laborables)
        const marcacionesValidas = marcacionesMes.filter(m => {
            return !this._esFaltaJustificada(m)
                && !this._esFaltaNoJustificada(m)
                && !this._esJustificacionPendiente(m)
                && !this._esDiaNoLaborable(m)
                && (m.IngMarcado || m.SalMarcada || m.IngAlmuerzoMarcado || m.SalAlmuerzoMarcada);
        });

        // 7. Faltantes = Asignaciones - Marcaciones válidas - Faltas (just/no just/pendientes) - No laborables
        const totalFaltas = faltasJustificadas.length
            + faltasNoJustificadas.length
            + justificacionesPendientes.length
            + diasNoLaborables.length;

        const faltantes = Math.max(
            0,
            asignacionesMes.length - marcacionesValidas.length - totalFaltas
        );

        // 8. ¿Hay registros?
        const hayRegistros = asignacionesMes.length > 0
            || marcacionesValidas.length > 0
            || totalFaltas > 0;

        return {
            totalUsuarios,
            asignacionesMes: asignacionesMes.length,
            marcacionesMes: marcacionesValidas.length,
            faltantesMes: faltantes,
            faltasJustificadas: faltasJustificadas.length,
            faltasNoJustificadas: faltasNoJustificadas.length,
            justificacionesPendientes: justificacionesPendientes.length,
            diasNoLaborables: diasNoLaborables.length,
            hayRegistros
        };
    }

    // ==========================================
    // CÁLCULO DE KPIs DE LA SEMANA
    // ==========================================
    _calcularKPIsSemana() {
        const hoy = new Date();
        const rango = this._getRangoSemanaActual();

        const asignacionesSemana = (this.data.asignaciones || []).filter(a => {
            if (a.IdEstado !== 1) return false;
            const f = this._normalizarFecha(a.Fecha);
            return f >= rango.inicio && f <= rango.fin;
        });

        const marcacionesSemana = (this.data.marcaciones || []).filter(m => {
            if (m.IdEstado !== 1) return false;
            const f = this._normalizarFecha(m.Fecha);
            return f >= rango.inicio && f <= rango.fin;
        });

        const faltasJustificadas = marcacionesSemana.filter(m => this._esFaltaJustificada(m));
        const faltasNoJustificadas = marcacionesSemana.filter(m => this._esFaltaNoJustificada(m));
        const justificacionesPendientes = marcacionesSemana.filter(m => this._esJustificacionPendiente(m));
        const diasNoLaborables = marcacionesSemana.filter(m => this._esDiaNoLaborable(m));

        const marcacionesValidas = marcacionesSemana.filter(m => {
            return !this._esFaltaJustificada(m)
                && !this._esFaltaNoJustificada(m)
                && !this._esJustificacionPendiente(m)
                && !this._esDiaNoLaborable(m)
                && (m.IngMarcado || m.SalMarcada || m.IngAlmuerzoMarcado || m.SalAlmuerzoMarcada);
        });

        const totalFaltas = faltasJustificadas.length
            + faltasNoJustificadas.length
            + justificacionesPendientes.length
            + diasNoLaborables.length;

        const faltantes = Math.max(
            0,
            asignacionesSemana.length - marcacionesValidas.length - totalFaltas
        );

        return {
            asignacionesSemana: asignacionesSemana.length,
            marcacionesSemana: marcacionesValidas.length,
            faltantesSemana: faltantes,
            faltasJustificadas: faltasJustificadas.length,
            faltasNoJustificadas: faltasNoJustificadas.length,
            justificacionesPendientes: justificacionesPendientes.length,
            diasNoLaborables: diasNoLaborables.length
        };
    }

    // ==========================================
    // CÁLCULO DE KPIs DE HOY
    // ==========================================
    _calcularKPIsHoy() {
        const hoy = this._getFechaHoyStr();

        const asignacionesHoy = (this.data.asignaciones || []).filter(a => {
            if (a.IdEstado !== 1) return false;
            return this._normalizarFecha(a.Fecha) === hoy;
        });

        const marcacionesHoy = (this.data.marcaciones || []).filter(m => {
            if (m.IdEstado !== 1) return false;
            return this._normalizarFecha(m.Fecha) === hoy;
        });

        // Marcaciones válidas (con al menos una hora registrada y no faltas)
        const validas = marcacionesHoy.filter(m => {
            return !this._esFaltaJustificada(m)
                && !this._esFaltaNoJustificada(m)
                && !this._esJustificacionPendiente(m)
                && !this._esDiaNoLaborable(m)
                && (m.IngMarcado || m.SalMarcada || m.IngAlmuerzoMarcado || m.SalAlmuerzoMarcada);
        });

        // Faltantes
        const totalFaltasHoy = marcacionesHoy.filter(m =>
            this._esFaltaJustificada(m)
            || this._esFaltaNoJustificada(m)
            || this._esJustificacionPendiente(m)
            || this._esDiaNoLaborable(m)
        ).length;

        const faltantes = Math.max(
            0,
            asignacionesHoy.length - validas.length - totalFaltasHoy
        );

        // Usuarios con tardanza (estado IdEstadoIng = 'TARDANZA')
        const tardanzaIds = new Set();
        const aTiempoIds = new Set();

        validas.forEach(m => {
            const desc = this._getDescripcionEstado(m.IdEstadoIng);
            if (desc === 'TARDANZA') tardanzaIds.add(m.IdUsuario);
            else if (desc === 'A TIEMPO') aTiempoIds.add(m.IdUsuario);
        });

        // Exceso almuerzo (IdEstadoAlmuerzoSal = 'EXCESO')
        const excesoAlmuerzoIds = new Set();
        const cumplieronAlmuerzoIds = new Set();

        validas.forEach(m => {
            const desc = this._getDescripcionEstado(m.IdEstadoAlmuerzoSal);
            if (desc === 'EXCESO') excesoAlmuerzoIds.add(m.IdUsuario);
            else if (desc === 'A TIEMPO') cumplieronAlmuerzoIds.add(m.IdUsuario);
        });

        return {
            asignacionesHoy: asignacionesHoy.length,
            marcacionesHoy: validas.length,
            faltantesHoy: faltantes,
            tardanzaHoy: tardanzaIds.size,
            aTiempoHoy: aTiempoIds.size,
            excesoAlmuerzoHoy: excesoAlmuerzoIds.size,
            cumplieronAlmuerzoHoy: cumplieronAlmuerzoIds.size
        };
    }

    // ==========================================
    // RENDERIZADO DEL MES
    // ==========================================
    _renderizarKPIsMes(kpis) {
        if (!kpis.hayRegistros) {
            // Mostrar '--' en todos los KPIs excepto TotalUsuarios
            this._animar(this.kpiTotalUsuarios, kpis.totalUsuarios);
            ['kpiAsignacionesMes', 'kpiMarcacionesMes', 'kpiFaltantesMes',
                'kpiFaltasJustificadas', 'kpiFaltasNoJustificadas', 'kpiDiasNoLaborables'
            ].forEach(id => this._animar(this[id], '--'));
            return;
        }

        this._animar(this.kpiTotalUsuarios, kpis.totalUsuarios);
        this._animar(this.kpiAsignacionesMes, kpis.asignacionesMes);
        this._animar(this.kpiMarcacionesMes, kpis.marcacionesMes);
        this._animar(this.kpiFaltantesMes, kpis.faltantesMes);
        this._animar(this.kpiFaltasJustificadas, kpis.faltasJustificadas);
        this._animar(this.kpiFaltasNoJustificadas, kpis.faltasNoJustificadas);
        this._animar(this.kpiDiasNoLaborables, kpis.diasNoLaborables);
    }

    // ==========================================
    // RENDERIZADO DE LA SEMANA
    // ==========================================
    _renderizarKPIsSemana(kpis) {
        this._animar(this.kpiAsignacionesSemana, kpis.asignacionesSemana);
        this._animar(this.kpiMarcacionesSemana, kpis.marcacionesSemana);
        this._animar(this.kpiFaltantesSemana, kpis.faltantesSemana);
        this._animar(this.kpiFaltasJustificadasSemana, kpis.faltasJustificadas);
        this._animar(this.kpiFaltasNoJustificadasSemana, kpis.faltasNoJustificadas);
        this._animar(this.kpiDiasNoLaborablesSemana, kpis.diasNoLaborables);
    }

    // ==========================================
    // RENDERIZADO DE HOY
    // ==========================================
    _renderizarKPIsHoy(kpis) {
        this._animar(this.kpiAsignacionesHoy, kpis.asignacionesHoy);
        this._animar(this.kpiMarcacionesHoy, kpis.marcacionesHoy);
        this._animar(this.kpiFaltantesHoy, kpis.faltantesHoy);
        this._animar(this.kpiTardanza, kpis.tardanzaHoy);
        this._animar(this.kpiATiempo, kpis.aTiempoHoy);
        this._animar(this.kpiExcesoAlmuerzo, kpis.excesoAlmuerzoHoy);
        this._animar(this.kpiCumplieronAlmuerzo, kpis.cumplieronAlmuerzoHoy);
    }

    // ==========================================
    // VISIBILIDAD DE SECCIONES
    // ==========================================
    _actualizarVisibilidadSecciones() {
        if (this.kpiSectionSemana) {
            this.kpiSectionSemana.style.display = this.esMesActual ? '' : 'none';
        }
        if (this.kpiSectionDia) {
            this.kpiSectionDia.style.display = this.esMesActual ? '' : 'none';
        }
    }

    // ==========================================
    // SUBTÍTULOS
    // ==========================================
    _actualizarSubtitulos() {
        // Mes
        if (this.kpiMesSubtitle) {
            this.kpiMesSubtitle.textContent = `${this._getNombreMes(this.mesActual)} ${this.añoActual}`;
        }

        // Semana
        if (this.kpiSemanaSubtitle) {
            const hoy = new Date();
            const semana = this._getSemanaDelMes(hoy);
            this.kpiSemanaSubtitle.textContent = `Semana ${semana}`;
        }

        // Día
        if (this.kpiDiaSubtitle) {
            const hoy = new Date();
            const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const dia = String(hoy.getDate()).padStart(2, '0');
            const mes = this._getNombreMes(hoy.getMonth() + 1);
            this.kpiDiaSubtitle.textContent = `${dias[hoy.getDay()]} ${dia} - ${mes}`;
        }
    }

    // ==========================================
    // ANIMACIÓN DE KPIs
    // ==========================================
    _animar(elemento, valor) {
        if (!elemento) return;

        // Si es '--' o texto, mostrar directo
        if (valor === '--' || typeof valor !== 'number') {
            elemento.textContent = valor;
            return;
        }

        const startValue = parseInt(elemento.textContent) || 0;
        const endValue = valor || 0;
        const duration = 800;
        const startTime = performance.now();

        const animate = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = Math.round(startValue + (endValue - startValue) * progress);
            elemento.textContent = current;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                elemento.textContent = endValue;
            }
        };

        requestAnimationFrame(animate);
    }

    // ==========================================
    // HELPERS DE CLASIFICACIÓN
    // ==========================================
    _esFaltaJustificada(m) {
        const obs = String(m.ObsGeneral || m.Observacion || '').toUpperCase();
        return obs.includes('FALTA JUSTIFICADA');
    }

    _esFaltaNoJustificada(m) {
        const obs = String(m.ObsGeneral || m.Observacion || '').toUpperCase();
        return obs.includes('NO JUSTIFICÓ FALTA')
            || obs.includes('JUSTIFICACIÓN NO VÁLIDA - FALTA');
    }

    _esJustificacionPendiente(m) {
        const obs = String(m.ObsGeneral || m.Observacion || '').toUpperCase();
        return obs.includes('FALTA - JUSTIFICACIÓN PENDIENTE')
            || obs.includes('FALTA - JUSTIFICACION PENDIENTE');
    }

    _esDiaNoLaborable(m) {
        const obs = String(m.ObsGeneral || m.Observacion || '').toUpperCase();
        return obs.includes('NO LABORA - DIA NO LABORABLE')
            || obs.includes('NO LABORA - DÍA NO LABORABLE');
    }

    // ==========================================
    // HELPERS DE FECHAS
    // ==========================================
    _getFechaInicioMes(mes, año) {
        return `${año}-${String(mes).padStart(2, '0')}-01`;
    }

    _getFechaFinMes(mes, año) {
        const ultimoDia = new Date(año, mes, 0).getDate();
        return `${año}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
    }

    _getFechaHoyStr() {
        const hoy = new Date();
        return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    }

    _getRangoSemanaActual() {
        const hoy = new Date();
        const diaMes = hoy.getDate();
        const mes = hoy.getMonth() + 1;
        const año = hoy.getFullYear();

        // Semana 1: 1-7, 2: 8-14, 3: 15-21, 4: 22-28, 5: 29-fin
        let semanaNum;
        if (diaMes >= 1 && diaMes <= 7) semanaNum = 1;
        else if (diaMes >= 8 && diaMes <= 14) semanaNum = 2;
        else if (diaMes >= 15 && diaMes <= 21) semanaNum = 3;
        else if (diaMes >= 22 && diaMes <= 28) semanaNum = 4;
        else semanaNum = 5;

        const inicioDia = (semanaNum - 1) * 7 + 1;
        const ultimoDiaMes = new Date(año, mes, 0).getDate();
        const finDia = Math.min(inicioDia + 6, ultimoDiaMes);

        return {
            inicio: `${año}-${String(mes).padStart(2, '0')}-${String(inicioDia).padStart(2, '0')}`,
            fin: `${año}-${String(mes).padStart(2, '0')}-${String(finDia).padStart(2, '0')}`
        };
    }

    _getSemanaDelMes(fecha) {
        const dia = fecha.getDate();
        if (dia <= 7) return 1;
        if (dia <= 14) return 2;
        if (dia <= 21) return 3;
        if (dia <= 28) return 4;
        return 5;
    }

    _normalizarFecha(valor) {
        if (!valor) return '';
        if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
            return valor.slice(0, 10);
        }
        try {
            const d = new Date(valor);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        } catch { return ''; }
    }

    _getDescripcionEstado(idEstado) {
        if (!idEstado) return '';
        const estado = (this.data.estados || []).find(e => e.IdEstado === idEstado);
        return estado ? String(estado.Descripcion || '').toUpperCase() : '';
    }

    _getNombreMes(mes) {
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return meses[mes - 1] || mes;
    }

    // ==========================================
    // EXPORTAR PDF
    // ==========================================
    async capturarParaPDF() {
        try {
            if (typeof html2canvas === 'undefined') {
                console.error('html2canvas no está cargado');
                return null;
            }

            const container = document.createElement('div');
            container.style.cssText = `
                padding: 15px;
                background: #f8f9fa;
                width: 100%;
                font-family: 'Segoe UI', Arial, sans-serif;
            `;

            // Título
            const titulo = document.createElement('div');
            titulo.style.cssText = `
                font-size: 18px;
                font-weight: bold;
                color: #8B0000;
                text-align: center;
                margin-bottom: 15px;
                border-bottom: 2px solid #8B0000;
                padding-bottom: 8px;
            `;
            titulo.textContent = 'Resumen de KPIs';
            container.appendChild(titulo);

            // Clonar secciones visibles
            const secciones = [
                { el: this.kpiSectionMes, visible: true },
                { el: this.kpiSectionSemana, visible: this.esMesActual },
                { el: this.kpiSectionDia, visible: this.esMesActual }
            ];

            for (const s of secciones) {
                if (!s.el || !s.visible) continue;
                const clone = s.el.cloneNode(true);
                clone.style.cssText = `
                    margin-bottom: 15px;
                    padding: 5px;
                    background: white;
                    border-radius: 8px;
                `;
                container.appendChild(clone);
            }

            document.body.appendChild(container);
            await new Promise(r => setTimeout(r, 300));

            const canvas = await html2canvas(container, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#f8f9fa',
                logging: false,
                width: container.scrollWidth,
                height: container.scrollHeight
            });

            document.body.removeChild(container);
            return canvas;

        } catch (error) {
            console.error('❌ Error capturando KPIs para PDF:', error);
            return null;
        }
    }
}

// ============================================
// EXPOSICIÓN GLOBAL
// ============================================
if (typeof window !== 'undefined') {
    window.DashboardKPIsController = DashboardKPIsController;
}