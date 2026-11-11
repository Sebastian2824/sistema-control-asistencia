// ==============================================
// CONTROLLER: DashboardChartsController (Sub-controlador)
// Responsabilidad: Cálculo y renderizado de los 25 gráficos.
//
// Organización interna por bloques:
//   A. Constructor + DOM + Eventos
//   B. Carga principal + Captura para PDF
//   C. Gráficos de Rendimiento       (1, 2, 3, 7, 10)
//   D. Gráficos de Evolución         (4, 5, 11, 12)
//   E. Justificación Tardanza/Exceso (13, 14, 15, 16, 17)
//   F. Justificación Faltas          (18, 19, 20, 21, 22)
//   G. Ranking Tardanza/Exceso       (6, 8, 9)
//   H. Ranking Faltas                (23, 24, 25)
//   I. Helpers
// ==============================================

class DashboardChartsController {

    constructor(service, data, config) {
        this.service = service;
        this.data = data || {};
        this.config = config || {};

        // Estado
        this.mesActual = new Date().getMonth() + 1;
        this.añoActual = new Date().getFullYear();
        this.esMesActual = true;
        this.hayRegistrosEnMes = false;

        // Instancias de Chart.js
        this.charts = {};

        // Cachear DOM y configurar eventos
        this._cachearDOM();
        this._configurarEventos();
    }

    // ==========================================
    // A. CACHEAR DOM
    // ==========================================
    _cachearDOM() {
        // Filtros de los gráficos
        this.filtroMomentoGrafico1 = document.getElementById('filtroMomentoGrafico1');
        this.filtroUsuarioGrafico2 = document.getElementById('filtroUsuarioGrafico2');
        this.filtroMomentoGrafico2 = document.getElementById('filtroMomentoGrafico2');
        this.filtroUsuarioGrafico3 = document.getElementById('filtroUsuarioGrafico3');
        this.filtroMomentoGrafico3 = document.getElementById('filtroMomentoGrafico3');
        this.filtroUsuarioGrafico4 = document.getElementById('filtroUsuarioGrafico4');
        this.filtroSemanaGrafico4 = document.getElementById('filtroSemanaGrafico4');
        this.filtroUsuarioGrafico5 = document.getElementById('filtroUsuarioGrafico5');
        this.filtroSemanaGrafico5 = document.getElementById('filtroSemanaGrafico5');
        this.filtroMomentoGrafico6 = document.getElementById('filtroMomentoGrafico6');
        this.filtroSucursalGrafico6 = document.getElementById('filtroSucursalGrafico6');
        this.filtroAreaGrafico6 = document.getElementById('filtroAreaGrafico6');
        this.filtroEmpresaGrafico6 = document.getElementById('filtroEmpresaGrafico6');
        this.filtroMomentoGrafico7 = document.getElementById('filtroMomentoGrafico7');
        this.filtroSemanaGrafico7 = document.getElementById('filtroSemanaGrafico7');
        this.filtroMomentoGrafico8 = document.getElementById('filtroMomentoGrafico8');
        this.filtroSucursalGrafico8 = document.getElementById('filtroSucursalGrafico8');
        this.filtroAreaGrafico8 = document.getElementById('filtroAreaGrafico8');
        this.filtroEmpresaGrafico8 = document.getElementById('filtroEmpresaGrafico8');
        this.filtroMomentoGrafico9 = document.getElementById('filtroMomentoGrafico9');
        this.filtroSucursalGrafico9 = document.getElementById('filtroSucursalGrafico9');
        this.filtroAreaGrafico9 = document.getElementById('filtroAreaGrafico9');
        this.filtroEmpresaGrafico9 = document.getElementById('filtroEmpresaGrafico9');
        this.filtroMomentoGrafico10 = document.getElementById('filtroMomentoGrafico10');
        this.filtroUsuarioGrafico11 = document.getElementById('filtroUsuarioGrafico11');
        this.filtroUsuarioGrafico12 = document.getElementById('filtroUsuarioGrafico12');
        this.filtroMomentoGrafico13 = document.getElementById('filtroMomentoGrafico13');
        this.filtroMomentoGrafico14 = document.getElementById('filtroMomentoGrafico14');
        this.filtroSemanaGrafico14 = document.getElementById('filtroSemanaGrafico14');
        this.filtroMomentoGrafico15 = document.getElementById('filtroMomentoGrafico15');
        this.filtroUsuarioGrafico16 = document.getElementById('filtroUsuarioGrafico16');
        this.filtroMomentoGrafico16 = document.getElementById('filtroMomentoGrafico16');
        this.filtroUsuarioGrafico17 = document.getElementById('filtroUsuarioGrafico17');
        this.filtroMomentoGrafico17 = document.getElementById('filtroMomentoGrafico17');
        this.filtroSemanaGrafico19 = document.getElementById('filtroSemanaGrafico19');
        this.filtroUsuarioGrafico21 = document.getElementById('filtroUsuarioGrafico21');
        this.filtroUsuarioGrafico22 = document.getElementById('filtroUsuarioGrafico22');
        this.filtroSucursalGrafico23 = document.getElementById('filtroSucursalGrafico23');
        this.filtroAreaGrafico23 = document.getElementById('filtroAreaGrafico23');
        this.filtroEmpresaGrafico23 = document.getElementById('filtroEmpresaGrafico23');
        this.filtroSucursalGrafico24 = document.getElementById('filtroSucursalGrafico24');
        this.filtroAreaGrafico24 = document.getElementById('filtroAreaGrafico24');
        this.filtroEmpresaGrafico24 = document.getElementById('filtroEmpresaGrafico24');
        this.filtroSucursalGrafico25 = document.getElementById('filtroSucursalGrafico25');
        this.filtroAreaGrafico25 = document.getElementById('filtroAreaGrafico25');
        this.filtroEmpresaGrafico25 = document.getElementById('filtroEmpresaGrafico25');
    }

    // ==========================================
    // A. CONFIGURAR EVENTOS
    // ==========================================
    _configurarEventos() {
        const bind = (el, fn) => { if (el) el.addEventListener('change', fn.bind(this)); };

        // Gráfico 1
        bind(this.filtroMomentoGrafico1, () => this._actualizarGrafico1());

        // Gráfico 2
        bind(this.filtroUsuarioGrafico2, () => this._actualizarGrafico2());
        bind(this.filtroMomentoGrafico2, () => this._actualizarGrafico2());

        // Gráfico 3
        bind(this.filtroUsuarioGrafico3, () => this._actualizarGrafico3());
        bind(this.filtroMomentoGrafico3, () => this._actualizarGrafico3());

        // Gráfico 4
        bind(this.filtroUsuarioGrafico4, () => this._actualizarGrafico4());
        bind(this.filtroSemanaGrafico4, () => this._actualizarGrafico4());

        // Gráfico 5
        bind(this.filtroUsuarioGrafico5, () => this._actualizarGrafico5());
        bind(this.filtroSemanaGrafico5, () => this._actualizarGrafico5());

        // Gráfico 6
        bind(this.filtroMomentoGrafico6, () => this._actualizarGrafico6());
        bind(this.filtroSucursalGrafico6, () => this._actualizarGrafico6());
        bind(this.filtroAreaGrafico6, () => this._actualizarGrafico6());
        bind(this.filtroEmpresaGrafico6, () => this._actualizarGrafico6());

        // Gráfico 7
        bind(this.filtroMomentoGrafico7, () => this._actualizarGrafico7());
        bind(this.filtroSemanaGrafico7, () => this._actualizarGrafico7());

        // Gráfico 8
        bind(this.filtroMomentoGrafico8, () => this._actualizarGrafico8());
        bind(this.filtroSucursalGrafico8, () => this._actualizarGrafico8());
        bind(this.filtroAreaGrafico8, () => this._actualizarGrafico8());
        bind(this.filtroEmpresaGrafico8, () => this._actualizarGrafico8());

        // Gráfico 9
        bind(this.filtroMomentoGrafico9, () => this._actualizarGrafico9());
        bind(this.filtroSucursalGrafico9, () => this._actualizarGrafico9());
        bind(this.filtroAreaGrafico9, () => this._actualizarGrafico9());
        bind(this.filtroEmpresaGrafico9, () => this._actualizarGrafico9());

        // Gráfico 10
        bind(this.filtroMomentoGrafico10, () => this._actualizarGrafico10());

        // Gráfico 11 y 12
        bind(this.filtroUsuarioGrafico11, () => this._actualizarGrafico11());
        bind(this.filtroUsuarioGrafico12, () => this._actualizarGrafico12());

        // Gráfico 13
        bind(this.filtroMomentoGrafico13, () => this._actualizarGrafico13());

        // Gráfico 14
        bind(this.filtroMomentoGrafico14, () => this._actualizarGrafico14());
        bind(this.filtroSemanaGrafico14, () => this._actualizarGrafico14());

        // Gráfico 15
        bind(this.filtroMomentoGrafico15, () => this._actualizarGrafico15());

        // Gráfico 16
        bind(this.filtroUsuarioGrafico16, () => this._actualizarGrafico16());
        bind(this.filtroMomentoGrafico16, () => this._actualizarGrafico16());

        // Gráfico 17
        bind(this.filtroUsuarioGrafico17, () => this._actualizarGrafico17());
        bind(this.filtroMomentoGrafico17, () => this._actualizarGrafico17());

        // Gráfico 19
        bind(this.filtroSemanaGrafico19, () => this._actualizarGrafico19());

        // Gráfico 21 y 22
        bind(this.filtroUsuarioGrafico21, () => this._actualizarGrafico21());
        bind(this.filtroUsuarioGrafico22, () => this._actualizarGrafico22());

        // Gráfico 23
        bind(this.filtroSucursalGrafico23, () => this._actualizarGrafico23());
        bind(this.filtroAreaGrafico23, () => this._actualizarGrafico23());
        bind(this.filtroEmpresaGrafico23, () => this._actualizarGrafico23());

        // Gráfico 24
        bind(this.filtroSucursalGrafico24, () => this._actualizarGrafico24());
        bind(this.filtroAreaGrafico24, () => this._actualizarGrafico24());
        bind(this.filtroEmpresaGrafico24, () => this._actualizarGrafico24());

        // Gráfico 25
        bind(this.filtroSucursalGrafico25, () => this._actualizarGrafico25());
        bind(this.filtroAreaGrafico25, () => this._actualizarGrafico25());
        bind(this.filtroEmpresaGrafico25, () => this._actualizarGrafico25());
    }

    // ==========================================
    // B. CARGA PRINCIPAL
    // ==========================================
    async cargar(mes, año, hayRegistros, esMesActual) {
        this.mesActual = mes;
        this.añoActual = año;
        this.hayRegistrosEnMes = hayRegistros;
        this.esMesActual = esMesActual;

        console.log(`📊 Gráficos: cargando para ${mes}/${año} (registros: ${hayRegistros}, mesActual: ${esMesActual})`);

        // Si no hay registros, mostrar todos vacíos
        if (!hayRegistros) {
            this._mostrarTodosVacios();
            return;
        }

        // Cargar gráficos mensuales (siempre)
        await this._actualizarGrafico3();
        await this._actualizarGrafico7();
        await this._actualizarGrafico9();
        await this._actualizarGrafico10();
        await this._actualizarGrafico11();
        await this._actualizarGrafico12();
        await this._actualizarGrafico14();
        await this._actualizarGrafico15();
        await this._actualizarGrafico17();
        await this._actualizarGrafico19();
        await this._actualizarGrafico20();
        await this._actualizarGrafico22();
        await this._actualizarGrafico25();

        // Gráficos de evolución por días (funcionan para cualquier mes)
        await this._actualizarGrafico4();
        await this._actualizarGrafico5();

        // Gráficos semanales/diarios (solo si es mes actual)
        if (esMesActual) {
            await this._actualizarGrafico1();
            await this._actualizarGrafico2();
            await this._actualizarGrafico6();
            await this._actualizarGrafico8();
            await this._actualizarGrafico13();
            await this._actualizarGrafico16();
            await this._actualizarGrafico18();
            await this._actualizarGrafico21();
            await this._actualizarGrafico23();
            await this._actualizarGrafico24();
        } else {
            // Mensaje "solo mes actual" para los diarios/semanales
            const idsSoloMesActual = ['grafico1', 'grafico2', 'grafico6', 'grafico8',
                'grafico13', 'grafico16', 'grafico18', 'grafico21', 'grafico23', 'grafico24'];
            idsSoloMesActual.forEach(id => this._mostrarMensajeVacio(id, '📅 Disponible solo para el mes actual'));
        }
    }

    // ==========================================
    // B. CAPTURAR PARA PDF
    // ==========================================
    async capturarParaPDF() {
        const idsPDF = [
            'grafico1',
            'grafico6', 'grafico7', 'grafico8', 'grafico9', 'grafico10',
            'grafico13', 'grafico14', 'grafico15',
            'grafico18', 'grafico19', 'grafico20',
            'grafico23', 'grafico24', 'grafico25'
        ];

        const capturados = [];

        for (const id of idsPDF) {
            try {
                // Verificar datos reales
                const chart = this.charts[id];
                if (!chart) {
                    console.warn(`⏭️ Sin chart instance: ${id}`);
                    continue;
                }

                const datasets = chart.config.data?.datasets || [];
                const tieneDatos = datasets.some(ds => (ds.data || []).some(v => Number(v) > 0));
                if (!tieneDatos) {
                    console.log(`⏭️ Omitiendo ${id} - Sin datos`);
                    continue;
                }

                const canvas = await this._capturarGraficoCompleto(id);
                if (canvas) {
                    capturados.push({ id, canvas });
                }
            } catch (err) {
                console.warn(`⚠️ Error capturando ${id}:`, err.message);
            }
        }

        return capturados;
    }

    async _capturarGraficoCompleto(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const chartCard = canvas.closest('.chart-card');
        if (!chartCard) return null;

        // ============================================
        // 1. OBTENER TÍTULO COMPLETO
        // ============================================
        const titleEl = chartCard.querySelector('.chart-title');
        const tituloCompleto = titleEl ? titleEl.textContent.trim() : canvasId;

        // ============================================
        // 2. OBTENER RESUMEN DE DATOS DEL GRÁFICO
        // ============================================
        const resumen = this._obtenerResumenGrafico(canvasId);

        // ============================================
        // 3. CREAR CONTENEDOR TEMPORAL
        // ============================================
        const container = document.createElement('div');
        container.style.cssText = `
        padding: 20px;
        background: #ffffff;
        border-radius: 8px;
        width: 750px;
        font-family: 'Segoe UI', Arial, sans-serif;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;

        // Título
        const titleDiv = document.createElement('div');
        titleDiv.style.cssText = `
        font-size: 16px;
        font-weight: bold;
        color: #8B0000;
        margin-bottom: 12px;
        text-align: center;
        border-bottom: 2px solid #f0f0f0;
        padding-bottom: 8px;
    `;
        titleDiv.textContent = tituloCompleto || 'Gráfico';
        container.appendChild(titleDiv);

        // ============================================
        // 4. MOVER EL CANVAS REAL AL CONTENEDOR
        // ============================================
        const parent = canvas.parentElement;
        const canvasStyle = canvas.style.cssText;
        const originalContainer = canvas.closest('.chart-container') || canvas.closest('.chart-container-large');

        canvas.style.cssText = `
        width: 100%;
        height: 280px;
        display: block;
    `;
        container.appendChild(canvas);

        // ============================================
        // 5. AGREGAR TABLA DE RESUMEN DEBAJO DEL GRÁFICO
        // ============================================
        if (resumen && resumen.datos && resumen.datos.length > 0) {
            const tieneValores = resumen.datos.some(ds => ds.valores && ds.valores.length > 0);
            if (tieneValores) {
                this._agregarTablaResumenHTML(container, resumen);
            }
        }

        // ============================================
        // 6. AGREGAR AL DOM Y CAPTURAR
        // ============================================
        document.body.appendChild(container);
        await new Promise(r => setTimeout(r, 300));

        const result = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: container.scrollWidth,
            height: container.scrollHeight
        });

        // ============================================
        // 7. RESTAURAR CANVAS A SU POSICIÓN ORIGINAL
        // ============================================
        if (originalContainer) {
            originalContainer.appendChild(canvas);
            canvas.style.cssText = canvasStyle || '';
        } else if (parent) {
            parent.appendChild(canvas);
            canvas.style.cssText = canvasStyle || '';
        }

        document.body.removeChild(container);
        return result;
    }

    // ==========================================
    // I. HELPERS: RESUMEN Y TABLA PDF
    // ==========================================

    /**
     * Devuelve un resumen estructurado del gráfico para dibujar la tabla debajo.
     * Estructura:
     *   {
     *     titulo, tipo,
     *     datos: [{ titulo, tipo, valores: [...] }]
     *   }
     */
    _obtenerResumenGrafico(canvasId) {
        const resumen = { titulo: '', tipo: '', datos: [] };

        const chart = this.charts[canvasId];
        if (!chart) return resumen;

        const config = chart.config;
        const type = config.type;
        const labels = config.data.labels || [];
        const datasets = config.data.datasets || [];

        // Título desde el DOM
        const canvasEl = document.getElementById(canvasId);
        if (canvasEl) {
            const card = canvasEl.closest('.chart-card');
            const titleEl = card?.querySelector('.chart-title');
            if (titleEl) resumen.titulo = titleEl.textContent.trim();
        }

        resumen.tipo = type;

        // ============================================
        // DOUGHNUT / PIE
        // ============================================
        if (type === 'doughnut' || type === 'pie') {
            const ds = datasets[0] || {};
            const data = ds.data || [];

            const valores = labels.map((label, i) => {
                const categoria = String(label || '').split(':')[0].trim();
                return {
                    categoria: categoria || 'N/A',
                    valor: Number(data[i]) || 0
                };
            });

            resumen.datos.push({
                titulo: 'Distribución',
                tipo: 'circular',
                valores
            });
            return resumen;
        }

        // ============================================
        // BAR (Ranking apilado vs Barra normal)
        // ============================================
        if (type === 'bar') {
            const esRanking = config.options?.indexAxis === 'y'
                || ['grafico6', 'grafico8', 'grafico9', 'grafico23', 'grafico24', 'grafico25'].includes(canvasId);

            if (esRanking) {
                if (datasets.length >= 2) {
                    // Ranking apilado (justificados + no justificados)
                    const ds1 = datasets[0];
                    const ds2 = datasets[1];
                    const valores = labels.map((label, i) => ({
                        usuario: label || 'N/A',
                        justificados: Number(ds1.data[i]) || 0,
                        noJustificados: Number(ds2.data[i]) || 0,
                        total: (Number(ds1.data[i]) || 0) + (Number(ds2.data[i]) || 0)
                    })).filter(v => v.total > 0);

                    resumen.datos.push({
                        titulo: `${ds1.label || 'Grupo 1'} / ${ds2.label || 'Grupo 2'}`,
                        tipo: 'ranking_apilado',
                        valores
                    });
                } else {
                    const ds = datasets[0] || {};
                    const valores = labels.map((label, i) => ({
                        usuario: label || 'N/A',
                        total: Number(ds.data[i]) || 0
                    })).filter(v => v.total > 0);

                    resumen.datos.push({
                        titulo: ds.label || 'Ranking',
                        tipo: 'ranking',
                        valores
                    });
                }
                return resumen;
            }

            // Barra normal: excluir datasets de evolución (líneas)
            const datasetsBar = datasets.filter(ds => !String(ds.label || '').includes('Evolución') && ds.type !== 'line');

            datasetsBar.forEach(ds => {
                const data = ds.data || [];
                const valores = labels.map((label, i) => ({
                    dia: label || 'N/A',
                    valor: Number(data[i]) || 0
                }));

                resumen.datos.push({
                    titulo: ds.label || 'Datos',
                    tipo: 'barra',
                    valores
                });
            });
            return resumen;
        }

        // ============================================
        // LINE (Evolución)
        // ============================================
        if (type === 'line') {
            datasets.forEach(ds => {
                const data = ds.data || [];
                const valores = labels.map((label, i) => ({
                    dia: label || 'N/A',
                    valor: Number(data[i]) || 0
                }));

                resumen.datos.push({
                    titulo: ds.label || 'Datos',
                    tipo: 'evolucion',
                    valores
                });
            });
            return resumen;
        }

        return resumen;
    }

    /**
     * Agrega una tabla HTML de resumen al contenedor (para capturar con html2canvas).
     */
    _agregarTablaResumenHTML(container, resumen) {
        if (!resumen?.datos?.length) return;

        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
        margin-top: 14px;
        padding-top: 10px;
        border-top: 1px solid #e0e0e0;
        width: 100%;
    `;

        const title = document.createElement('div');
        title.style.cssText = `
        font-size: 12px;
        font-weight: 700;
        color: #555;
        margin-bottom: 8px;
    `;
        title.textContent = '📋 Resumen de datos:';
        wrapper.appendChild(title);

        resumen.datos.forEach(dataset => {
            const valores = dataset.valores || [];
            if (!valores.length) return;

            // Título del dataset
            const dsTitle = document.createElement('div');
            dsTitle.style.cssText = `
            font-size: 11px;
            font-weight: 600;
            color: #666;
            margin: 8px 0 4px 0;
        `;
            dsTitle.textContent = dataset.titulo;
            wrapper.appendChild(dsTitle);

            // Construir headers y rows según el tipo
            let headers = [];
            let rows = [];

            if (dataset.tipo === 'circular') {
                headers = ['Categoría', 'Cantidad'];
                rows = valores.map(v => [v.categoria, v.valor]);
            } else if (dataset.tipo === 'ranking_apilado') {
                headers = ['Usuario', 'Justificados', 'No Justif.', 'Total'];
                rows = valores.map(v => [v.usuario, v.justificados, v.noJustificados, v.total]);
            } else if (dataset.tipo === 'ranking') {
                headers = ['Usuario', 'Total'];
                rows = valores.map(v => [v.usuario, v.total]);
            } else if (dataset.tipo === 'evolucion') {
                headers = ['Día/Semana', 'Minutos'];
                rows = valores.map(v => [v.dia, v.valor]);
            } else {
                headers = ['Día/Semana', 'Cantidad'];
                rows = valores.map(v => [v.dia, v.valor]);
            }

            if (!rows.length) return;

            const table = document.createElement('table');
            table.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin-bottom: 8px;
        `;

            // Headers
            const thead = document.createElement('thead');
            const trHead = document.createElement('tr');
            headers.forEach((h, idx) => {
                const th = document.createElement('th');
                th.textContent = h;
                th.style.cssText = `
                background: #f0f0f0;
                padding: 4px 8px;
                text-align: ${idx === 0 ? 'left' : 'center'};
                border: 1px solid #d0d0d0;
                font-weight: 700;
                font-size: 10px;
                color: #333;
            `;
                trHead.appendChild(th);
            });
            thead.appendChild(trHead);
            table.appendChild(thead);

            // Rows
            const tbody = document.createElement('tbody');
            rows.forEach((row, idx) => {
                const tr = document.createElement('tr');
                const bg = idx % 2 === 0 ? '#ffffff' : '#f9f9f9';
                row.forEach((cell, cellIdx) => {
                    const td = document.createElement('td');
                    td.textContent = String(cell);
                    td.style.cssText = `
                    padding: 3px 8px;
                    border: 1px solid #d0d0d0;
                    background: ${bg};
                    text-align: ${cellIdx === 0 ? 'left' : 'center'};
                    font-size: 10px;
                    color: #444;
                    font-weight: ${Number(cell) > 0 ? '600' : '400'};
                `;
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            wrapper.appendChild(table);
        });

        container.appendChild(wrapper);
    }

    // ==========================================
    // C. GRÁFICOS DE RENDIMIENTO (1, 2, 3, 7, 10)
    // ==========================================

    async _actualizarGrafico1() {
        if (!this.esMesActual && !this._forzandoExportacion) {
            this._mostrarMensajeVacio('grafico1', '📅 Disponible solo para el mes actual');
            return;
        }

        const momento = this.filtroMomentoGrafico1?.value || 'ingreso';
        const data = this._calcularRendimientoSemanal(momento);

        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico1');
            return;
        }

        this._renderBarChart('grafico1', data, {
            title: 'Rendimiento Semanal'
        });
    }

    async _actualizarGrafico2() {
        if (!this.esMesActual && !this._forzandoExportacion) {
            this._mostrarMensajeVacio('grafico2', '📅 Disponible solo para el mes actual');
            return;
        }

        const usuarioId = parseInt(this.filtroUsuarioGrafico2?.value);
        if (!usuarioId) { this._mostrarVacio('grafico2'); return; }

        const momento = this.filtroMomentoGrafico2?.value || 'ingreso';
        const data = this._calcularRendimientoUsuario(usuarioId, momento, 'semana');

        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico2');
            return;
        }

        this._renderDoughnutChart('grafico2', data, {
            title: 'Rendimiento Semanal por Usuario'
        });
    }

    async _actualizarGrafico3() {
        const usuarioId = parseInt(this.filtroUsuarioGrafico3?.value);
        if (!usuarioId) { this._mostrarVacio('grafico3'); return; }

        const momento = this.filtroMomentoGrafico3?.value || 'ingreso';
        const data = this._calcularRendimientoUsuario(usuarioId, momento, 'mes');

        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico3');
            return;
        }

        this._renderDoughnutChart('grafico3', data, {
            title: 'Rendimiento Mensual por Usuario'
        });
    }

    async _actualizarGrafico7() {
        const momento = this.filtroMomentoGrafico7?.value || 'ingreso';
        const semana = parseInt(this.filtroSemanaGrafico7?.value) || 1;

        const data = this._calcularRendimientoMensualPorDias(momento, semana);
        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico7');
            return;
        }

        this._renderBarChart('grafico7', data, {
            title: `Rendimiento Mensual por Días - Semana ${semana}`
        });
    }

    async _actualizarGrafico10() {
        const momento = this.filtroMomentoGrafico10?.value || 'ingreso';
        const data = this._calcularRendimientoMensualPorSemanas(momento);

        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico10');
            return;
        }

        this._renderBarChart('grafico10', data, {
            title: 'Rendimiento Mensual por Semanas'
        });
    }

    // ==========================================
    // D. GRÁFICOS DE EVOLUCIÓN (4, 5, 11, 12)
    // ==========================================

    async _actualizarGrafico4() {
        const usuarioId = parseInt(this.filtroUsuarioGrafico4?.value);
        if (!usuarioId) { this._mostrarVacio('grafico4'); return; }

        const semana = parseInt(this.filtroSemanaGrafico4?.value) || 1;
        const data = this._calcularEvolucionTardanza(usuarioId, semana);

        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico4');
            return;
        }

        this._renderLineChart('grafico4', data, {
            title: `Minutos de Tardanza - Semana ${semana}`
        });
    }

    async _actualizarGrafico5() {
        const usuarioId = parseInt(this.filtroUsuarioGrafico5?.value);
        if (!usuarioId) { this._mostrarVacio('grafico5'); return; }

        const semana = parseInt(this.filtroSemanaGrafico5?.value) || 1;
        const data = this._calcularEvolucionExceso(usuarioId, semana);

        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico5');
            return;
        }

        this._renderLineChart('grafico5', data, {
            title: `Minutos de Exceso - Semana ${semana}`
        });
    }

    async _actualizarGrafico11() {
        const usuarioId = parseInt(this.filtroUsuarioGrafico11?.value);
        if (!usuarioId) { this._mostrarVacio('grafico11'); return; }

        const data = this._calcularEvolucionTardanzaMensual(usuarioId);
        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico11');
            return;
        }

        this._renderLineChart('grafico11', data, {
            title: 'Minutos de Tardanza por Semanas'
        });
    }

    async _actualizarGrafico12() {
        const usuarioId = parseInt(this.filtroUsuarioGrafico12?.value);
        if (!usuarioId) { this._mostrarVacio('grafico12'); return; }

        const data = this._calcularEvolucionExcesoMensual(usuarioId);
        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico12');
            return;
        }

        this._renderLineChart('grafico12', data, {
            title: 'Minutos de Exceso por Semanas'
        });
    }

    // ==========================================
    // E. JUSTIFICACIÓN TARDANZA/EXCESO (13, 14, 15, 16, 17)
    // ==========================================

    async _actualizarGrafico13() {
        if (!this.esMesActual && !this._forzandoExportacion) {
            this._mostrarMensajeVacio('grafico13', '📅 Disponible solo para el mes actual');
            return;
        }

        const momento = this.filtroMomentoGrafico13?.value || 'ingreso';
        const data = this._calcularJustificacionSemanal(momento);

        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico13');
            return;
        }

        this._renderBarChart('grafico13', data, {
            title: 'Justificación Semanal de Tardanza/Exceso'
        });
    }

    async _actualizarGrafico14() {
        const momento = this.filtroMomentoGrafico14?.value || 'ingreso';
        const semana = parseInt(this.filtroSemanaGrafico14?.value) || 1;
        const data = this._calcularJustificacionMensualPorDias(momento, semana);

        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico14');
            return;
        }

        this._renderBarChart('grafico14', data, {
            title: `Justificación - Semana ${semana}`
        });
    }

    async _actualizarGrafico15() {
        const momento = this.filtroMomentoGrafico15?.value || 'ingreso';
        const data = this._calcularJustificacionMensualPorSemanas(momento);

        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico15');
            return;
        }

        this._renderBarChart('grafico15', data, {
            title: 'Justificación Mensual por Semanas'
        });
    }

    async _actualizarGrafico16() {
        if (!this.esMesActual && !this._forzandoExportacion) {
            this._mostrarMensajeVacio('grafico16', '📅 Disponible solo para el mes actual');
            return;
        }

        const usuarioId = parseInt(this.filtroUsuarioGrafico16?.value);
        if (!usuarioId) { this._mostrarVacio('grafico16'); return; }

        const momento = this.filtroMomentoGrafico16?.value || 'ingreso';
        const data = this._calcularJustificacionUsuario(usuarioId, momento, 'semana');

        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico16');
            return;
        }

        this._renderDoughnutChart('grafico16', data, {
            title: 'Justificación Semanal por Usuario'
        });
    }

    async _actualizarGrafico17() {
        const usuarioId = parseInt(this.filtroUsuarioGrafico17?.value);
        if (!usuarioId) { this._mostrarVacio('grafico17'); return; }

        const momento = this.filtroMomentoGrafico17?.value || 'ingreso';
        const data = this._calcularJustificacionUsuario(usuarioId, momento, 'mes');

        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico17');
            return;
        }

        this._renderDoughnutChart('grafico17', data, {
            title: 'Justificación Mensual por Usuario'
        });
    }

    // ==========================================
    // F. JUSTIFICACIÓN FALTAS (18, 19, 20, 21, 22)
    // ==========================================

    async _actualizarGrafico18() {
        if (!this.esMesActual && !this._forzandoExportacion) {
            this._mostrarMensajeVacio('grafico18', '📅 Disponible solo para el mes actual');
            return;
        }

        const data = this._calcularJustificacionFaltasSemanal();
        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico18');
            return;
        }

        this._renderBarChart('grafico18', data, {
            title: 'Justificación Semanal de Faltas'
        });
    }

    async _actualizarGrafico19() {
        const semana = parseInt(this.filtroSemanaGrafico19?.value) || 1;
        const data = this._calcularJustificacionFaltasPorDias(semana);

        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico19');
            return;
        }

        this._renderBarChart('grafico19', data, {
            title: `Faltas - Semana ${semana}`
        });
    }

    async _actualizarGrafico20() {
        const data = this._calcularJustificacionFaltasPorSemanas();
        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico20');
            return;
        }

        this._renderBarChart('grafico20', data, {
            title: 'Justificación Mensual de Faltas por Semanas'
        });
    }

    async _actualizarGrafico21() {
        if (!this.esMesActual && !this._forzandoExportacion) {
            this._mostrarMensajeVacio('grafico21', '📅 Disponible solo para el mes actual');
            return;
        }

        const usuarioId = parseInt(this.filtroUsuarioGrafico21?.value);
        if (!usuarioId) { this._mostrarVacio('grafico21'); return; }

        const data = this._calcularFaltasUsuario(usuarioId, 'semana');
        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico21');
            return;
        }

        this._renderDoughnutChart('grafico21', data, {
            title: 'Faltas Semanal por Usuario'
        });
    }

    async _actualizarGrafico22() {
        const usuarioId = parseInt(this.filtroUsuarioGrafico22?.value);
        if (!usuarioId) { this._mostrarVacio('grafico22'); return; }

        const data = this._calcularFaltasUsuario(usuarioId, 'mes');
        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico22');
            return;
        }

        this._renderDoughnutChart('grafico22', data, {
            title: 'Faltas Mensual por Usuario'
        });
    }

    // ==========================================
    // G. RANKING TARDANZA/EXCESO (6, 8, 9)
    // ==========================================

    async _actualizarGrafico6() {
        if (!this.esMesActual && !this._forzandoExportacion) {
            this._mostrarMensajeVacio('grafico6', '📅 Disponible solo para el mes actual');
            return;
        }

        const momento = this.filtroMomentoGrafico6?.value || 'ingreso';
        const filtros = {
            sucursal: this.filtroSucursalGrafico6?.value,
            area: this.filtroAreaGrafico6?.value,
            empresa: this.filtroEmpresaGrafico6?.value
        };

        const data = this._calcularRanking(momento, filtros, 'dia');
        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico6');
            return;
        }

        this._renderRankingStackedChart('grafico6', data, {
            title: 'Ranking del Día'
        });
    }

    async _actualizarGrafico8() {
        if (!this.esMesActual && !this._forzandoExportacion) {
            this._mostrarMensajeVacio('grafico8', '📅 Disponible solo para el mes actual');
            return;
        }

        const momento = this.filtroMomentoGrafico8?.value || 'ingreso';
        const filtros = {
            sucursal: this.filtroSucursalGrafico8?.value,
            area: this.filtroAreaGrafico8?.value,
            empresa: this.filtroEmpresaGrafico8?.value
        };

        const data = this._calcularRanking(momento, filtros, 'semana');
        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico8');
            return;
        }

        this._renderRankingStackedChart('grafico8', data, {
            title: 'Ranking de la Semana'
        });
    }

    async _actualizarGrafico9() {
        const momento = this.filtroMomentoGrafico9?.value || 'ingreso';
        const filtros = {
            sucursal: this.filtroSucursalGrafico9?.value,
            area: this.filtroAreaGrafico9?.value,
            empresa: this.filtroEmpresaGrafico9?.value
        };

        const data = this._calcularRanking(momento, filtros, 'mes');
        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico9');
            return;
        }

        this._renderRankingStackedChart('grafico9', data, {
            title: 'Ranking del Mes'
        });
    }

    // ==========================================
    // H. RANKING FALTAS (23, 24, 25)
    // ==========================================

    async _actualizarGrafico23() {
        if (!this.esMesActual && !this._forzandoExportacion) {
            this._mostrarMensajeVacio('grafico23', '📅 Disponible solo para el mes actual');
            return;
        }

        const filtros = {
            sucursal: this.filtroSucursalGrafico23?.value,
            area: this.filtroAreaGrafico23?.value,
            empresa: this.filtroEmpresaGrafico23?.value
        };
        const data = this._calcularRankingFaltas(filtros, 'dia');

        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico23');
            return;
        }

        this._renderRankingStackedChart('grafico23', data, {
            title: 'Ranking de Faltas del Día'
        });
    }

    async _actualizarGrafico24() {
        if (!this.esMesActual && !this._forzandoExportacion) {
            this._mostrarMensajeVacio('grafico24', '📅 Disponible solo para el mes actual');
            return;
        }

        const filtros = {
            sucursal: this.filtroSucursalGrafico24?.value,
            area: this.filtroAreaGrafico24?.value,
            empresa: this.filtroEmpresaGrafico24?.value
        };
        const data = this._calcularRankingFaltas(filtros, 'semana');

        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico24');
            return;
        }

        this._renderRankingStackedChart('grafico24', data, {
            title: 'Ranking de Faltas de la Semana'
        });
    }

    async _actualizarGrafico25() {
        const filtros = {
            sucursal: this.filtroSucursalGrafico25?.value,
            area: this.filtroAreaGrafico25?.value,
            empresa: this.filtroEmpresaGrafico25?.value
        };
        const data = this._calcularRankingFaltas(filtros, 'mes');

        if (!this._tieneDatos(data)) {
            this._mostrarVacio('grafico25');
            return;
        }

        this._renderRankingStackedChart('grafico25', data, {
            title: 'Ranking de Faltas del Mes'
        });
    }

    // ==========================================
    // CÁLCULOS: RENDIMIENTO
    // ==========================================

    _calcularRendimientoSemanal(momento) {
        const rango = this._getRangoSemanaActual();
        const dias = this._getDiasDeSemana(rango);

        const marcaciones = this._filtrarMarcacionesEnRango(rango.inicio, rango.fin)
            .filter(m => !this._esExcluida(m));

        const campo = this._getCampoEstadoPorMomento(momento);
        const datos = { 'A Tiempo': [], 'Tardanza': [], 'Exceso': [] };

        dias.forEach(dia => {
            const marcacionesDia = marcaciones.filter(m => this._normalizarFecha(m.Fecha) === dia.fecha);
            datos['A Tiempo'].push(marcacionesDia.filter(m => this._getDescripcionEstado(m[campo]) === 'A TIEMPO').length);
            datos['Tardanza'].push(marcacionesDia.filter(m => this._getDescripcionEstado(m[campo]) === 'TARDANZA').length);
            datos['Exceso'].push(marcacionesDia.filter(m => this._getDescripcionEstado(m[campo]) === 'EXCESO').length);
        });

        return {
            labels: dias.map(d => d.label),
            datasets: this._buildBarLineDatasets('A Tiempo', 'Tardanza', 'Exceso',
                datos['A Tiempo'], datos['Tardanza'], datos['Exceso'])
        };
    }

    _calcularRendimientoUsuario(usuarioId, momento, periodo) {
        const rango = periodo === 'semana' ? this._getRangoSemanaActual() : this._getRangoMesActual();
        const campo = this._getCampoEstadoPorMomento(momento);

        const marcaciones = this._filtrarMarcacionesEnRango(rango.inicio, rango.fin)
            .filter(m => m.IdUsuario === usuarioId && !this._esExcluida(m));

        const counts = { 'A Tiempo': 0, 'Tardanza': 0, 'Exceso': 0 };
        marcaciones.forEach(m => {
            const desc = this._getDescripcionEstado(m[campo]);
            if (desc === 'A TIEMPO') counts['A Tiempo']++;
            else if (desc === 'TARDANZA') counts['Tardanza']++;
            else if (desc === 'EXCESO') counts['Exceso']++;
        });

        return {
            labels: ['A Tiempo', 'Tardanza', 'Exceso'],
            datasets: [{
                data: [counts['A Tiempo'], counts['Tardanza'], counts['Exceso']],
                backgroundColor: ['rgba(40,167,69,0.8)', 'rgba(255,193,7,0.8)', 'rgba(220,53,69,0.8)'],
                borderWidth: 2
            }]
        };
    }

    _calcularRendimientoMensualPorDias(momento, semana) {
        const rangoSemana = this._getRangoSemanaDelMes(semana, this.mesActual, this.añoActual);
        const dias = this._getDiasDeSemana(rangoSemana);

        const campo = this._getCampoEstadoPorMomento(momento);
        const marcaciones = this._filtrarMarcacionesEnRango(rangoSemana.inicio, rangoSemana.fin)
            .filter(m => !this._esExcluida(m));

        const datos = { 'A Tiempo': [], 'Tardanza': [], 'Exceso': [] };
        dias.forEach(dia => {
            const diaMarc = marcaciones.filter(m => this._normalizarFecha(m.Fecha) === dia.fecha);
            datos['A Tiempo'].push(diaMarc.filter(m => this._getDescripcionEstado(m[campo]) === 'A TIEMPO').length);
            datos['Tardanza'].push(diaMarc.filter(m => this._getDescripcionEstado(m[campo]) === 'TARDANZA').length);
            datos['Exceso'].push(diaMarc.filter(m => this._getDescripcionEstado(m[campo]) === 'EXCESO').length);
        });

        return {
            labels: dias.map(d => d.label),
            datasets: this._buildBarLineDatasets('A Tiempo', 'Tardanza', 'Exceso',
                datos['A Tiempo'], datos['Tardanza'], datos['Exceso'])
        };
    }

    _calcularRendimientoMensualPorSemanas(momento) {
        const rangoMes = this._getRangoMesActual();
        const campo = this._getCampoEstadoPorMomento(momento);

        const marcaciones = this._filtrarMarcacionesEnRango(rangoMes.inicio, rangoMes.fin)
            .filter(m => !this._esExcluida(m));

        const datos = { 'A Tiempo': [], 'Tardanza': [], 'Exceso': [] };
        for (let sem = 1; sem <= 5; sem++) {
            const r = this._getRangoSemanaDelMes(sem, this.mesActual, this.añoActual);
            const marcSem = marcaciones.filter(m => {
                const f = this._normalizarFecha(m.Fecha);
                return f >= r.inicio && f <= r.fin;
            });
            datos['A Tiempo'].push(marcSem.filter(m => this._getDescripcionEstado(m[campo]) === 'A TIEMPO').length);
            datos['Tardanza'].push(marcSem.filter(m => this._getDescripcionEstado(m[campo]) === 'TARDANZA').length);
            datos['Exceso'].push(marcSem.filter(m => this._getDescripcionEstado(m[campo]) === 'EXCESO').length);
        }

        return {
            labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'],
            datasets: this._buildBarLineDatasets('A Tiempo', 'Tardanza', 'Exceso',
                datos['A Tiempo'], datos['Tardanza'], datos['Exceso'])
        };
    }

    // ==========================================
    // CÁLCULOS: EVOLUCIÓN
    // ==========================================

    _calcularEvolucionTardanza(usuarioId, semana) {
        const rango = this._getRangoSemanaDelMes(semana, this.mesActual, this.añoActual);
        const dias = this._getDiasDeSemana(rango);

        const marcaciones = this._filtrarMarcacionesEnRango(rango.inicio, rango.fin)
            .filter(m => m.IdUsuario === usuarioId && !this._esExcluida(m) && m.IngMarcado);

        const justificados = [];
        const noJustificados = [];

        dias.forEach(dia => {
            const m = marcaciones.find(x => this._normalizarFecha(x.Fecha) === dia.fecha);
            if (!m || !m.IngMarcado) {
                justificados.push(0);
                noJustificados.push(0);
                return;
            }

            const minutos = this._calcularMinutosTardanza(m);
            const obs = String(m.ObsGeneral || m.Observacion || '').toUpperCase();

            if (obs.includes('TARDANZA JUSTIFICADA')) {
                justificados.push(minutos);
                noJustificados.push(0);
            } else if (minutos > 0) {
                justificados.push(0);
                noJustificados.push(minutos);
            } else {
                justificados.push(0);
                noJustificados.push(0);
            }
        });

        return {
            labels: dias.map(d => d.label),
            datasets: [
                this._buildLineDataset('Tardanza Justificada', justificados, '#ffc107'),
                this._buildLineDataset('Tardanza No Justificada', noJustificados, '#d39e00')
            ]
        };
    }

    _calcularEvolucionExceso(usuarioId, semana) {
        const rango = this._getRangoSemanaDelMes(semana, this.mesActual, this.añoActual);
        const dias = this._getDiasDeSemana(rango);

        const marcaciones = this._filtrarMarcacionesEnRango(rango.inicio, rango.fin)
            .filter(m => m.IdUsuario === usuarioId && !this._esExcluida(m));

        const justificados = [];
        const noJustificados = [];

        dias.forEach(dia => {
            const m = marcaciones.find(x => this._normalizarFecha(x.Fecha) === dia.fecha);
            if (!m) {
                justificados.push(0);
                noJustificados.push(0);
                return;
            }

            const minutos = this._calcularMinutosExceso(m);
            const obs = String(m.ObsSalidaAlmuerzo || '').toUpperCase();

            if (obs.includes('EXCESO JUSTIFICADO')) {
                justificados.push(minutos);
                noJustificados.push(0);
            } else if (minutos > 0) {
                justificados.push(0);
                noJustificados.push(minutos);
            } else {
                justificados.push(0);
                noJustificados.push(0);
            }
        });

        return {
            labels: dias.map(d => d.label),
            datasets: [
                this._buildLineDataset('Exceso Justificado', justificados, '#dc3545'),
                this._buildLineDataset('Exceso No Justificado', noJustificados, '#ff6b6b')
            ]
        };
    }

    _calcularEvolucionTardanzaMensual(usuarioId) {
        const semanas = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'];
        const justificados = [];
        const noJustificados = [];

        for (let sem = 1; sem <= 5; sem++) {
            const r = this._getRangoSemanaDelMes(sem, this.mesActual, this.añoActual);
            const marcSem = this._filtrarMarcacionesEnRango(r.inicio, r.fin)
                .filter(m => m.IdUsuario === usuarioId && !this._esExcluida(m) && m.IngMarcado);

            let totalJ = 0, totalN = 0;
            marcSem.forEach(m => {
                const min = this._calcularMinutosTardanza(m);
                const obs = String(m.ObsGeneral || m.Observacion || '').toUpperCase();
                if (obs.includes('TARDANZA JUSTIFICADA')) totalJ += min;
                else if (min > 0) totalN += min;
            });
            justificados.push(totalJ);
            noJustificados.push(totalN);
        }

        return {
            labels: semanas,
            datasets: [
                this._buildLineDataset('Tardanza Justificada', justificados, '#ffc107'),
                this._buildLineDataset('Tardanza No Justificada', noJustificados, '#d39e00')
            ]
        };
    }

    _calcularEvolucionExcesoMensual(usuarioId) {
        const semanas = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'];
        const justificados = [];
        const noJustificados = [];

        for (let sem = 1; sem <= 5; sem++) {
            const r = this._getRangoSemanaDelMes(sem, this.mesActual, this.añoActual);
            const marcSem = this._filtrarMarcacionesEnRango(r.inicio, r.fin)
                .filter(m => m.IdUsuario === usuarioId && !this._esExcluida(m));

            let totalJ = 0, totalN = 0;
            marcSem.forEach(m => {
                const min = this._calcularMinutosExceso(m);
                const obs = String(m.ObsSalidaAlmuerzo || '').toUpperCase();
                if (obs.includes('EXCESO JUSTIFICADO')) totalJ += min;
                else if (min > 0) totalN += min;
            });
            justificados.push(totalJ);
            noJustificados.push(totalN);
        }

        return {
            labels: semanas,
            datasets: [
                this._buildLineDataset('Exceso Justificado', justificados, '#dc3545'),
                this._buildLineDataset('Exceso No Justificado', noJustificados, '#ff6b6b')
            ]
        };
    }

    // ==========================================
    // CÁLCULOS: JUSTIFICACIÓN TARDANZA/EXCESO
    // ==========================================

    _calcularJustificacionSemanal(momento) {
        const rango = this._getRangoSemanaActual();
        const dias = this._getDiasDeSemana(rango);

        const campo = momento === 'ingreso' ? 'IdEstadoIng' : 'IdEstadoAlmuerzoSal';
        const campoObs = momento === 'ingreso' ? 'ObsGeneral' : 'ObsSalidaAlmuerzo';
        const textoJ = momento === 'ingreso' ? 'TARDANZA JUSTIFICADA' : 'EXCESO JUSTIFICADO';
        const textoNJ = momento === 'ingreso' ? 'TARDANZA NO JUSTIFICADA' : 'EXCESO NO JUSTIFICADO';

        const marcaciones = this._filtrarMarcacionesEnRango(rango.inicio, rango.fin)
            .filter(m => !this._esExcluida(m));

        const justificados = [];
        const noJustificados = [];

        dias.forEach(dia => {
            const marcDia = marcaciones.filter(m => this._normalizarFecha(m.Fecha) === dia.fecha);
            let j = 0, nj = 0;
            marcDia.forEach(m => {
                const desc = this._getDescripcionEstado(m[campo]);
                if (desc !== 'TARDANZA' && desc !== 'EXCESO') return;
                const obs = String(m[campoObs] || '').toUpperCase();
                if (obs.includes(textoJ)) j++;
                else if (obs.includes(textoNJ) || obs.includes('JUSTIFICACIÓN NO VÁLIDA')) nj++;
                else nj++;
            });
            justificados.push(j);
            noJustificados.push(nj);
        });

        return {
            labels: dias.map(d => d.label),
            datasets: this._buildBarLineDatasets('Justificados', 'No Justificados', null,
                justificados, noJustificados, null)
        };
    }

    _calcularJustificacionMensualPorDias(momento, semana) {
        const rango = this._getRangoSemanaDelMes(semana, this.mesActual, this.añoActual);
        const dias = this._getDiasDeSemana(rango);

        const campo = momento === 'ingreso' ? 'IdEstadoIng' : 'IdEstadoAlmuerzoSal';
        const campoObs = momento === 'ingreso' ? 'ObsGeneral' : 'ObsSalidaAlmuerzo';
        const textoJ = momento === 'ingreso' ? 'TARDANZA JUSTIFICADA' : 'EXCESO JUSTIFICADO';

        const marcaciones = this._filtrarMarcacionesEnRango(rango.inicio, rango.fin)
            .filter(m => !this._esExcluida(m));

        const justificados = [];
        const noJustificados = [];

        dias.forEach(dia => {
            const marcDia = marcaciones.filter(m => this._normalizarFecha(m.Fecha) === dia.fecha);
            let j = 0, nj = 0;
            marcDia.forEach(m => {
                const desc = this._getDescripcionEstado(m[campo]);
                if (desc !== 'TARDANZA' && desc !== 'EXCESO') return;
                const obs = String(m[campoObs] || '').toUpperCase();
                if (obs.includes(textoJ)) j++; else nj++;
            });
            justificados.push(j);
            noJustificados.push(nj);
        });

        return {
            labels: dias.map(d => d.label),
            datasets: this._buildBarLineDatasets('Justificados', 'No Justificados', null,
                justificados, noJustificados, null)
        };
    }

    _calcularJustificacionMensualPorSemanas(momento) {
        const campo = momento === 'ingreso' ? 'IdEstadoIng' : 'IdEstadoAlmuerzoSal';
        const campoObs = momento === 'ingreso' ? 'ObsGeneral' : 'ObsSalidaAlmuerzo';
        const textoJ = momento === 'ingreso' ? 'TARDANZA JUSTIFICADA' : 'EXCESO JUSTIFICADO';

        const semanas = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'];
        const justificados = [];
        const noJustificados = [];

        for (let sem = 1; sem <= 5; sem++) {
            const r = this._getRangoSemanaDelMes(sem, this.mesActual, this.añoActual);
            const marcSem = this._filtrarMarcacionesEnRango(r.inicio, r.fin)
                .filter(m => !this._esExcluida(m));
            let j = 0, nj = 0;
            marcSem.forEach(m => {
                const desc = this._getDescripcionEstado(m[campo]);
                if (desc !== 'TARDANZA' && desc !== 'EXCESO') return;
                const obs = String(m[campoObs] || '').toUpperCase();
                if (obs.includes(textoJ)) j++; else nj++;
            });
            justificados.push(j);
            noJustificados.push(nj);
        }

        return {
            labels: semanas,
            datasets: this._buildBarLineDatasets('Justificados', 'No Justificados', null,
                justificados, noJustificados, null)
        };
    }

    _calcularJustificacionUsuario(usuarioId, momento, periodo) {
        const rango = periodo === 'semana' ? this._getRangoSemanaActual() : this._getRangoMesActual();
        const campo = momento === 'ingreso' ? 'IdEstadoIng' : 'IdEstadoAlmuerzoSal';
        const campoObs = momento === 'ingreso' ? 'ObsGeneral' : 'ObsSalidaAlmuerzo';
        const textoJ = momento === 'ingreso' ? 'TARDANZA JUSTIFICADA' : 'EXCESO JUSTIFICADO';

        const marcaciones = this._filtrarMarcacionesEnRango(rango.inicio, rango.fin)
            .filter(m => m.IdUsuario === usuarioId && !this._esExcluida(m));

        let justificados = 0;
        let noJustificados = 0;

        marcaciones.forEach(m => {
            const desc = this._getDescripcionEstado(m[campo]);
            if (desc !== 'TARDANZA' && desc !== 'EXCESO') return;
            const obs = String(m[campoObs] || '').toUpperCase();
            if (obs.includes(textoJ)) justificados++; else noJustificados++;
        });

        return {
            labels: ['Justificados', 'No Justificados'],
            datasets: [{
                data: [justificados, noJustificados],
                backgroundColor: ['rgba(40,167,69,0.8)', 'rgba(220,53,69,0.8)'],
                borderWidth: 2
            }]
        };
    }

    // ==========================================
    // CÁLCULOS: JUSTIFICACIÓN FALTAS
    // ==========================================

    _calcularJustificacionFaltasSemanal() {
        const rango = this._getRangoSemanaActual();
        return this._agregarFaltasPorRango(rango);
    }

    _calcularJustificacionFaltasPorDias(semana) {
        const rango = this._getRangoSemanaDelMes(semana, this.mesActual, this.añoActual);
        return this._agregarFaltasPorRango(rango);
    }

    _calcularJustificacionFaltasPorSemanas() {
        const semanas = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'];
        const justificados = [];
        const noJustificados = [];
        const pendientes = [];

        for (let sem = 1; sem <= 5; sem++) {
            const r = this._getRangoSemanaDelMes(sem, this.mesActual, this.añoActual);
            const marcSem = this._filtrarMarcacionesEnRango(r.inicio, r.fin);
            let j = 0, nj = 0, p = 0;
            marcSem.forEach(m => {
                if (this._esFaltaJustificada(m)) j++;
                else if (this._esFaltaNoJustificada(m)) nj++;
                else if (this._esJustificacionPendiente(m)) p++;
            });
            justificados.push(j);
            noJustificados.push(nj);
            pendientes.push(p);
        }

        return {
            labels: semanas,
            datasets: [
                this._buildBarDataset('Faltas Justificadas', justificados, 'rgba(40,167,69,0.7)', 'rgba(40,167,69,1)'),
                this._buildBarDataset('Faltas No Justificadas', noJustificados, 'rgba(220,53,69,0.7)', 'rgba(220,53,69,1)'),
                this._buildBarDataset('Justificación Pendiente', pendientes, 'rgba(255,193,7,0.7)', 'rgba(255,193,7,1)')
            ]
        };
    }

    _agregarFaltasPorRango(rango) {
        const dias = this._getDiasDeSemana(rango);
        const marcaciones = this._filtrarMarcacionesEnRango(rango.inicio, rango.fin);

        const justificados = [];
        const noJustificados = [];
        const pendientes = [];

        dias.forEach(dia => {
            const marcDia = marcaciones.filter(m => this._normalizarFecha(m.Fecha) === dia.fecha);
            justificados.push(marcDia.filter(m => this._esFaltaJustificada(m)).length);
            noJustificados.push(marcDia.filter(m => this._esFaltaNoJustificada(m)).length);
            pendientes.push(marcDia.filter(m => this._esJustificacionPendiente(m)).length);
        });

        return {
            labels: dias.map(d => d.label),
            datasets: [
                this._buildBarDataset('Faltas Justificadas', justificados, 'rgba(40,167,69,0.7)', 'rgba(40,167,69,1)'),
                this._buildBarDataset('Faltas No Justificadas', noJustificados, 'rgba(220,53,69,0.7)', 'rgba(220,53,69,1)'),
                this._buildBarDataset('Justificación Pendiente', pendientes, 'rgba(255,193,7,0.7)', 'rgba(255,193,7,1)')
            ]
        };
    }

    _calcularFaltasUsuario(usuarioId, periodo) {
        const rango = periodo === 'semana' ? this._getRangoSemanaActual() : this._getRangoMesActual();
        const marcaciones = this._filtrarMarcacionesEnRango(rango.inicio, rango.fin)
            .filter(m => m.IdUsuario === usuarioId);

        let j = 0, nj = 0, p = 0;
        marcaciones.forEach(m => {
            if (this._esFaltaJustificada(m)) j++;
            else if (this._esFaltaNoJustificada(m)) nj++;
            else if (this._esJustificacionPendiente(m)) p++;
        });

        return {
            labels: ['Justificadas', 'No Justificadas', 'Pendientes'],
            datasets: [{
                data: [j, nj, p],
                backgroundColor: ['rgba(40,167,69,0.8)', 'rgba(220,53,69,0.8)', 'rgba(255,193,7,0.8)'],
                borderWidth: 2
            }]
        };
    }

    // ==========================================
    // CÁLCULOS: RANKING
    // ==========================================

    _calcularRanking(momento, filtros, periodo) {
        let rango;
        if (periodo === 'dia') {
            const hoy = this._getFechaHoyStr();
            rango = { inicio: hoy, fin: hoy };
        } else if (periodo === 'semana') {
            rango = this._getRangoSemanaActual();
        } else {
            rango = this._getRangoMesActual();
        }

        const campo = momento === 'ingreso' ? 'IdEstadoIng' : 'IdEstadoAlmuerzoSal';
        const campoObs = momento === 'ingreso' ? 'ObsGeneral' : 'ObsSalidaAlmuerzo';
        const textoJ = momento === 'ingreso' ? 'TARDANZA JUSTIFICADA' : 'EXCESO JUSTIFICADO';

        const marcaciones = this._filtrarMarcacionesEnRango(rango.inicio, rango.fin)
            .filter(m => !this._esExcluida(m));

        const ranking = {};

        marcaciones.forEach(m => {
            const desc = this._getDescripcionEstado(m[campo]);
            if (desc !== 'TARDANZA' && desc !== 'EXCESO') return;

            const usuario = this._getUsuario(m.IdUsuario);
            if (!usuario) return;
            if (!this._pasaFiltros(usuario, filtros)) return;

            const minutos = momento === 'ingreso'
                ? this._calcularMinutosTardanza(m)
                : this._calcularMinutosExceso(m);
            if (minutos <= 0) return;

            const obs = String(m[campoObs] || '').toUpperCase();
            const esJust = obs.includes(textoJ);

            if (!ranking[m.IdUsuario]) {
                ranking[m.IdUsuario] = {
                    id: m.IdUsuario,
                    nombre: `${usuario.Nombres || usuario.Nombre || ''} ${usuario.Apellidos || ''}`.trim() || `Usuario ${m.IdUsuario}`,
                    justificados: 0,
                    noJustificados: 0,
                    total: 0
                };
            }

            if (esJust) ranking[m.IdUsuario].justificados += minutos;
            else ranking[m.IdUsuario].noJustificados += minutos;
            ranking[m.IdUsuario].total += minutos;
        });

        const arr = Object.values(ranking).sort((a, b) => b.total - a.total).slice(0, 10);

        return {
            labels: arr.map(u => u.nombre),
            datasets: [
                {
                    label: momento === 'ingreso' ? 'Tardanza Justificada' : 'Exceso Justificado',
                    data: arr.map(u => Math.round(u.justificados)),
                    backgroundColor: '#dc3545',
                    borderColor: '#dc3545',
                    borderWidth: 1
                },
                {
                    label: momento === 'ingreso' ? 'Tardanza No Justificada' : 'Exceso No Justificado',
                    data: arr.map(u => Math.round(u.noJustificados)),
                    backgroundColor: '#ff6b6b',
                    borderColor: '#ff6b6b',
                    borderWidth: 1
                }
            ]
        };
    }

    _calcularRankingFaltas(filtros, periodo) {
        let rango;
        if (periodo === 'dia') {
            const hoy = this._getFechaHoyStr();
            rango = { inicio: hoy, fin: hoy };
        } else if (periodo === 'semana') {
            rango = this._getRangoSemanaActual();
        } else {
            rango = this._getRangoMesActual();
        }

        const marcaciones = this._filtrarMarcacionesEnRango(rango.inicio, rango.fin);
        const ranking = {};

        marcaciones.forEach(m => {
            const esJ = this._esFaltaJustificada(m);
            const esNJ = this._esFaltaNoJustificada(m);
            const esP = this._esJustificacionPendiente(m);
            if (!esJ && !esNJ && !esP) return;

            const usuario = this._getUsuario(m.IdUsuario);
            if (!usuario) return;
            if (!this._pasaFiltros(usuario, filtros)) return;

            if (!ranking[m.IdUsuario]) {
                ranking[m.IdUsuario] = {
                    nombre: `${usuario.Nombres || usuario.Nombre || ''} ${usuario.Apellidos || ''}`.trim() || `Usuario ${m.IdUsuario}`,
                    justificadas: 0,
                    noJustificadas: 0,
                    pendientes: 0,
                    total: 0
                };
            }

            if (esJ) ranking[m.IdUsuario].justificadas++;
            else if (esP) ranking[m.IdUsuario].pendientes++;
            else ranking[m.IdUsuario].noJustificadas++;
            ranking[m.IdUsuario].total++;
        });

        const arr = Object.values(ranking).sort((a, b) => b.total - a.total).slice(0, 10);

        return {
            labels: arr.map(u => u.nombre),
            datasets: [
                {
                    label: 'Faltas Justificadas',
                    data: arr.map(u => u.justificadas),
                    backgroundColor: '#e74c3c',
                    borderWidth: 1
                },
                {
                    label: 'Faltas No Justificadas',
                    data: arr.map(u => u.noJustificadas),
                    backgroundColor: '#c0392b',
                    borderWidth: 1
                },
                {
                    label: 'Justificación Pendiente',
                    data: arr.map(u => u.pendientes),
                    backgroundColor: '#e67e22',
                    borderWidth: 1
                }
            ]
        };
    }

    // ==========================================
    // I. RENDERIZADO
    // ==========================================

    _renderBarChart(canvasId, data, opts = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        this._limpiarMensaje(canvasId);
        if (this.charts[canvasId]) { this.charts[canvasId].destroy(); this.charts[canvasId] = null; }

        const ctx = canvas.getContext('2d');
        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const label = ctx.dataset.label || '';
                                const value = ctx.parsed.y ?? 0;
                                return `${label}: ${value}`;
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } },
                    x: {}
                }
            }
        });

        if (opts.title) this._actualizarTitulo(canvasId, opts.title);
    }

    _renderDoughnutChart(canvasId, data, opts = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        this._limpiarMensaje(canvasId);
        if (this.charts[canvasId]) { this.charts[canvasId].destroy(); this.charts[canvasId] = null; }

        // Etiquetas con porcentaje
        const total = (data.datasets[0].data || []).reduce((a, b) => a + b, 0);
        const labelsConPct = data.labels.map((label, i) => {
            const v = data.datasets[0].data[i] || 0;
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            return `${label}: ${v} (${pct}%)`;
        });

        const ctx = canvas.getContext('2d');
        this.charts[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: { ...data, labels: labelsConPct },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } }
                }
            }
        });

        if (opts.title) this._actualizarTitulo(canvasId, opts.title);
    }

    _renderLineChart(canvasId, data, opts = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        this._limpiarMensaje(canvasId);
        if (this.charts[canvasId]) { this.charts[canvasId].destroy(); this.charts[canvasId] = null; }

        const ctx = canvas.getContext('2d');
        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } }
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Minutos' } }
                }
            }
        });

        if (opts.title) this._actualizarTitulo(canvasId, opts.title);
    }

    _renderRankingStackedChart(canvasId, data, opts = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        this._limpiarMensaje(canvasId);
        if (this.charts[canvasId]) { this.charts[canvasId].destroy(); this.charts[canvasId] = null; }

        const ctx = canvas.getContext('2d');
        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data,
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } }
                },
                scales: {
                    x: { stacked: true, beginAtZero: true },
                    y: { stacked: true }
                }
            }
        });

        if (opts.title) this._actualizarTitulo(canvasId, opts.title);
    }

    // ==========================================
    // I. HELPERS: DATASETS
    // ==========================================

    // ==========================================
    // I. HELPERS: DATASETS
    // ==========================================

    /**
     * Convierte cualquier color (hex o rgb) a rgba con la opacidad indicada.
     * Acepta: '#ffc107', 'rgb(255,193,7)', 'rgba(255,193,7,1)'
     */
    _colorARgba(color, opacidad = 0.15) {
        if (!color) return `rgba(0,0,0,${opacidad})`;
        const c = String(color).trim();

        // Si ya es rgba
        if (c.startsWith('rgba')) {
            return c.replace(/,\s*[\d.]+\)$/, `, ${opacidad})`);
        }

        // Si es rgb
        if (c.startsWith('rgb(')) {
            return c.replace('rgb(', 'rgba(').replace(')', `, ${opacidad})`);
        }

        // Si es hex (#rgb o #rrggbb)
        if (c.startsWith('#')) {
            let hex = c.slice(1);
            if (hex.length === 3) {
                hex = hex.split('').map(ch => ch + ch).join('');
            }
            if (hex.length === 6) {
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                return `rgba(${r},${g},${b},${opacidad})`;
            }
        }

        // Fallback
        return `rgba(0,0,0,${opacidad})`;
    }

    _buildBarDataset(label, data, bg, border) {
        return {
            label, data,
            backgroundColor: bg,
            borderColor: border,
            borderWidth: 2,
            type: 'bar',
            order: 3
        };
    }

    _buildLineDataset(label, data, color) {
        return {
            label, data,
            borderColor: color,
            backgroundColor: this._colorARgba(color, 0.15),
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: color,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            fill: true,
            tension: 0.3,
            type: 'line',
            order: 1
        };
    }

    _buildBarLineDatasets(labelA, labelB, labelC, dataA, dataB, dataC) {
        const ds = [];

        ds.push(this._buildBarDataset(labelA, dataA, 'rgba(40,167,69,0.7)', 'rgba(40,167,69,1)'));
        ds.push(this._buildBarDataset(labelB, dataB, 'rgba(255,193,7,0.7)', 'rgba(255,193,7,1)'));
        if (labelC && dataC) ds.push(this._buildBarDataset(labelC, dataC, 'rgba(220,53,69,0.7)', 'rgba(220,53,69,1)'));

        ds.push(this._buildLineDataset(`Evolución ${labelA}`, dataA, 'rgba(40,167,69,1)'));
        ds.push(this._buildLineDataset(`Evolución ${labelB}`, dataB, 'rgba(255,193,7,1)'));
        if (labelC && dataC) ds.push(this._buildLineDataset(`Evolución ${labelC}`, dataC, 'rgba(220,53,69,1)'));

        return ds;
    }

    // ==========================================
    // I. HELPERS: FECHAS
    // ==========================================

    _getFechaHoyStr() {
        const h = new Date();
        return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
    }

    _getRangoMesActual() {
        return {
            inicio: `${this.añoActual}-${String(this.mesActual).padStart(2, '0')}-01`,
            fin: `${this.añoActual}-${String(this.mesActual).padStart(2, '0')}-${String(new Date(this.añoActual, this.mesActual, 0).getDate()).padStart(2, '0')}`
        };
    }

    _getRangoSemanaActual() {
        const hoy = new Date();
        const sem = this._getSemanaDelMes(hoy);
        return this._getRangoSemanaDelMes(sem, this.mesActual, this.añoActual);
    }

    _getRangoSemanaDelMes(semana, mes, año) {
        const inicioDia = (semana - 1) * 7 + 1;
        const ultimoDia = new Date(año, mes, 0).getDate();
        const finDia = Math.min(inicioDia + 6, ultimoDia);
        return {
            inicio: `${año}-${String(mes).padStart(2, '0')}-${String(inicioDia).padStart(2, '0')}`,
            fin: `${año}-${String(mes).padStart(2, '0')}-${String(finDia).padStart(2, '0')}`
        };
    }

    _getDiasDeSemana(rango) {
        const dias = [];
        const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const inicio = new Date(rango.inicio + 'T00:00:00');
        const fin = new Date(rango.fin + 'T00:00:00');

        for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
            dias.push({
                fecha: this._normalizarFecha(d),
                label: nombresDias[d.getDay()]
            });
        }
        return dias;
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
        if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) return valor.slice(0, 10);
        try {
            const d = new Date(valor);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        } catch { return ''; }
    }

    _filtrarMarcacionesEnRango(inicio, fin) {
        return (this.data.marcaciones || []).filter(m => {
            if (m.IdEstado !== 1) return false;
            const f = this._normalizarFecha(m.Fecha);
            return f >= inicio && f <= fin;
        });
    }

    // ==========================================
    // I. HELPERS: ESTADOS
    // ==========================================

    _getDescripcionEstado(idEstado) {
        if (!idEstado) return '';
        const e = (this.data.estados || []).find(x => x.IdEstado === idEstado);
        return e ? String(e.Descripcion || '').toUpperCase() : '';
    }

    _getCampoEstadoPorMomento(momento) {
        return momento === 'ingresoAlmuerzo' ? 'IdEstadoAlmuerzoIng'
            : momento === 'salidaAlmuerzo' ? 'IdEstadoAlmuerzoSal'
                : 'IdEstadoIng';
    }

    _getUsuario(idUsuario) {
        return (this.data.usuarios || []).find(u => u.IdUsuario === idUsuario) || null;
    }

    _pasaFiltros(usuario, filtros) {
        if (filtros.sucursal && usuario.IdSucursal !== parseInt(filtros.sucursal)) return false;
        if (filtros.area && usuario.IdArea !== parseInt(filtros.area)) return false;
        if (filtros.empresa && usuario.IdEmpresa !== parseInt(filtros.empresa)) return false;
        return true;
    }

    // ==========================================
    // I. HELPERS: CLASIFICACIÓN
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
    _esExcluida(m) {
        return this._esFaltaJustificada(m)
            || this._esFaltaNoJustificada(m)
            || this._esJustificacionPendiente(m)
            || this._esDiaNoLaborable(m);
    }

    // ==========================================
    // I. HELPERS: CÁLCULOS DE MINUTOS
    // ==========================================

    _horaAMinutos(hora) {
        if (!hora) return null;
        const s = String(hora).trim();
        const m = s.match(/T(\d{2}):(\d{2})/) || s.match(/^(\d{1,2}):(\d{2})/);
        if (!m) return null;
        const hh = parseInt(m[1]);
        const mm = parseInt(m[2]);
        if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
        return hh * 60 + mm;
    }

    _calcularMinutosTardanza(m) {
        if (!m.IngMarcado) return 0;

        // Buscar asignación del usuario en la fecha
        const fecha = this._normalizarFecha(m.Fecha);
        const asig = (this.data.asignaciones || []).find(a =>
            a.IdUsuario === m.IdUsuario
            && a.IdEstado === 1
            && this._normalizarFecha(a.Fecha) === fecha
        );
        if (!asig || !asig.IngEsperado) return 0;

        const esperado = this._horaAMinutos(asig.IngEsperado);
        const real = this._horaAMinutos(m.IngMarcado);
        if (esperado === null || real === null) return 0;

        return Math.max(0, real - esperado);
    }

    _calcularMinutosExceso(m) {
        if (!m.SalAlmuerzoMarcada) return 0;

        const fecha = this._normalizarFecha(m.Fecha);
        const asig = (this.data.asignaciones || []).find(a =>
            a.IdUsuario === m.IdUsuario
            && a.IdEstado === 1
            && this._normalizarFecha(a.Fecha) === fecha
        );

        if (asig && asig.SalAlmuerzoEsperado) {
            const esperado = this._horaAMinutos(asig.SalAlmuerzoEsperado);
            const real = this._horaAMinutos(m.SalAlmuerzoMarcada);
            if (esperado !== null && real !== null) {
                return Math.max(0, real - esperado);
            }
        }

        // Fallback: > 60 min de almuerzo
        if (m.IngAlmuerzoMarcado && m.SalAlmuerzoMarcada) {
            const ing = this._horaAMinutos(m.IngAlmuerzoMarcado);
            const sal = this._horaAMinutos(m.SalAlmuerzoMarcada);
            if (ing !== null && sal !== null) {
                const dur = sal - ing;
                return dur > 60 ? dur - 60 : 0;
            }
        }

        return 0;
    }

    // ==========================================
    // I. HELPERS: TÍTULOS Y MENSAJES
    // ==========================================

    _actualizarTitulo(canvasId, titulo) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const card = canvas.closest('.chart-card');
        if (!card) return;
        const titleEl = card.querySelector('.chart-title');
        if (!titleEl) return;

        const icono = titleEl.querySelector('i');
        titleEl.innerHTML = icono
            ? `${icono.outerHTML} ${titulo}`
            : titulo;
    }

    _tieneDatos(data) {
        if (!data || !data.datasets || data.datasets.length === 0) return false;
        return data.datasets.some(ds => (ds.data || []).some(v => Number(v) > 0));
    }

    _graficoTieneDatos(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return false;
    const container = canvas.parentElement;
    if (container) {
        const msg = container.querySelector('.chart-empty-message');
        if (msg) {
            const texto = msg.textContent || '';
            if (texto.includes('Sin datos') && !texto.includes('Disponible')) return false;
            if (texto.includes('Disponible') && !this._forzandoExportacion) return false;
        }
    }
    const chart = this.charts[canvasId];
    if (!chart) return false;
    return chart.config.data.datasets.some(
        ds => (ds.data || []).some(v => Number(v) > 0)
    );
}

    _mostrarVacio(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        this._limpiarMensaje(canvasId);

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
            this.charts[canvasId] = null;
        }

        this._agregarMensaje(canvasId, '📭 Sin datos disponibles');
    }

    _mostrarMensajeVacio(canvasId, mensaje) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        this._limpiarMensaje(canvasId);

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
            this.charts[canvasId] = null;
        }

        this._agregarMensaje(canvasId, mensaje);
    }

    _agregarMensaje(canvasId, mensaje) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const container = canvas.parentElement;
        if (!container) return;

        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        const div = document.createElement('div');
        div.className = 'chart-empty-message';
        div.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 15px;
            color: #adb5bd;
            font-weight: 500;
            pointer-events: none;
            z-index: 10;
            background: rgba(255,255,255,0.92);
            padding: 12px 24px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            border: 2px solid rgba(0,0,0,0.06);
            text-align: center;
            max-width: 80%;
        `;
        div.textContent = mensaje;
        container.appendChild(div);
    }

    _limpiarMensaje(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const container = canvas.parentElement;
        if (!container) return;
        container.querySelectorAll('.chart-empty-message').forEach(m => m.remove());
    }

    _mostrarTodosVacios() {
        const ids = [
            'grafico1', 'grafico2', 'grafico3', 'grafico4', 'grafico5',
            'grafico6', 'grafico7', 'grafico8', 'grafico9', 'grafico10',
            'grafico11', 'grafico12', 'grafico13', 'grafico14', 'grafico15',
            'grafico16', 'grafico17', 'grafico18', 'grafico19', 'grafico20',
            'grafico21', 'grafico22', 'grafico23', 'grafico24', 'grafico25'
        ];
        ids.forEach(id => this._mostrarVacio(id));
    }

    // ==========================================
    // J. EXPORTACIÓN POR USUARIO
    // ==========================================

    // ==========================================
// J. EXPORTACIÓN POR USUARIO
// ==========================================

/**
 * Actualiza un gráfico específico para la exportación por usuario.
 * Fuerza mes/año y activa la bandera _forzandoExportacion.
 */
async _actualizarGraficoParaExportacion(chartId, usuarioId, momento, semana, mes = null, año = null) {
    const oldMes = this.mesActual;
    const oldAño = this.añoActual;
    const oldForzando = this._forzandoExportacion;

    this.mesActual = mes || this.mesActual;
    this.añoActual = año || this.añoActual;
    this._forzandoExportacion = true;

    try {
        switch (chartId) {
            case 'grafico2':  await this._exportGrafico2(usuarioId, momento); break;
            case 'grafico3':  await this._exportGrafico3(usuarioId, momento); break;
            case 'grafico4':  await this._exportGrafico4(usuarioId, semana); break;
            case 'grafico5':  await this._exportGrafico5(usuarioId, semana); break;
            case 'grafico11': await this._exportGrafico11(usuarioId); break;
            case 'grafico12': await this._exportGrafico12(usuarioId); break;
            case 'grafico16': await this._exportGrafico16(usuarioId, momento); break;
            case 'grafico17': await this._exportGrafico17(usuarioId, momento); break;
            case 'grafico21': await this._exportGrafico21(usuarioId); break;
            case 'grafico22': await this._exportGrafico22(usuarioId); break;
            default:
                console.warn(`⚠️ chartId no soportado en exportación: ${chartId}`);
        }
        await new Promise(r => setTimeout(r, 400));
    } catch (error) {
        console.warn(`⚠️ Error actualizando ${chartId} para exportación:`, error);
    } finally {
        this.mesActual = oldMes;
        this.añoActual = oldAño;
        this._forzandoExportacion = oldForzando;
    }
}

// ---- Métodos individuales (leen el filtro, lo asignan, actualizan, restauran) ----

async _exportGrafico2(usuarioId, momento) {
    const oldU = this.filtroUsuarioGrafico2?.value;
    const oldM = this.filtroMomentoGrafico2?.value;
    if (this.filtroUsuarioGrafico2) this.filtroUsuarioGrafico2.value = usuarioId;
    if (this.filtroMomentoGrafico2) this.filtroMomentoGrafico2.value = momento;
    await this._actualizarGrafico2();
    if (this.filtroUsuarioGrafico2) this.filtroUsuarioGrafico2.value = oldU;
    if (this.filtroMomentoGrafico2) this.filtroMomentoGrafico2.value = oldM;
}

async _exportGrafico3(usuarioId, momento) {
    const oldU = this.filtroUsuarioGrafico3?.value;
    const oldM = this.filtroMomentoGrafico3?.value;
    if (this.filtroUsuarioGrafico3) this.filtroUsuarioGrafico3.value = usuarioId;
    if (this.filtroMomentoGrafico3) this.filtroMomentoGrafico3.value = momento;
    await this._actualizarGrafico3();
    if (this.filtroUsuarioGrafico3) this.filtroUsuarioGrafico3.value = oldU;
    if (this.filtroMomentoGrafico3) this.filtroMomentoGrafico3.value = oldM;
}

async _exportGrafico4(usuarioId, semana) {
    const oldU = this.filtroUsuarioGrafico4?.value;
    const oldS = this.filtroSemanaGrafico4?.value;
    if (this.filtroUsuarioGrafico4) this.filtroUsuarioGrafico4.value = usuarioId;
    if (this.filtroSemanaGrafico4) this.filtroSemanaGrafico4.value = semana;
    await this._actualizarGrafico4();
    if (this.filtroUsuarioGrafico4) this.filtroUsuarioGrafico4.value = oldU;
    if (this.filtroSemanaGrafico4) this.filtroSemanaGrafico4.value = oldS;
}

async _exportGrafico5(usuarioId, semana) {
    const oldU = this.filtroUsuarioGrafico5?.value;
    const oldS = this.filtroSemanaGrafico5?.value;
    if (this.filtroUsuarioGrafico5) this.filtroUsuarioGrafico5.value = usuarioId;
    if (this.filtroSemanaGrafico5) this.filtroSemanaGrafico5.value = semana;
    await this._actualizarGrafico5();
    if (this.filtroUsuarioGrafico5) this.filtroUsuarioGrafico5.value = oldU;
    if (this.filtroSemanaGrafico5) this.filtroSemanaGrafico5.value = oldS;
}

async _exportGrafico11(usuarioId) {
    const oldU = this.filtroUsuarioGrafico11?.value;
    if (this.filtroUsuarioGrafico11) this.filtroUsuarioGrafico11.value = usuarioId;
    await this._actualizarGrafico11();
    if (this.filtroUsuarioGrafico11) this.filtroUsuarioGrafico11.value = oldU;
}

async _exportGrafico12(usuarioId) {
    const oldU = this.filtroUsuarioGrafico12?.value;
    if (this.filtroUsuarioGrafico12) this.filtroUsuarioGrafico12.value = usuarioId;
    await this._actualizarGrafico12();
    if (this.filtroUsuarioGrafico12) this.filtroUsuarioGrafico12.value = oldU;
}

async _exportGrafico16(usuarioId, momento) {
    const oldU = this.filtroUsuarioGrafico16?.value;
    const oldM = this.filtroMomentoGrafico16?.value;
    if (this.filtroUsuarioGrafico16) this.filtroUsuarioGrafico16.value = usuarioId;
    if (this.filtroMomentoGrafico16) this.filtroMomentoGrafico16.value = momento;
    await this._actualizarGrafico16();
    if (this.filtroUsuarioGrafico16) this.filtroUsuarioGrafico16.value = oldU;
    if (this.filtroMomentoGrafico16) this.filtroMomentoGrafico16.value = oldM;
}

async _exportGrafico17(usuarioId, momento) {
    const oldU = this.filtroUsuarioGrafico17?.value;
    const oldM = this.filtroMomentoGrafico17?.value;
    if (this.filtroUsuarioGrafico17) this.filtroUsuarioGrafico17.value = usuarioId;
    if (this.filtroMomentoGrafico17) this.filtroMomentoGrafico17.value = momento;
    await this._actualizarGrafico17();
    if (this.filtroUsuarioGrafico17) this.filtroUsuarioGrafico17.value = oldU;
    if (this.filtroMomentoGrafico17) this.filtroMomentoGrafico17.value = oldM;
}

async _exportGrafico21(usuarioId) {
    const oldU = this.filtroUsuarioGrafico21?.value;
    if (this.filtroUsuarioGrafico21) this.filtroUsuarioGrafico21.value = usuarioId;
    await this._actualizarGrafico21();
    if (this.filtroUsuarioGrafico21) this.filtroUsuarioGrafico21.value = oldU;
}

async _exportGrafico22(usuarioId) {
    const oldU = this.filtroUsuarioGrafico22?.value;
    if (this.filtroUsuarioGrafico22) this.filtroUsuarioGrafico22.value = usuarioId;
    await this._actualizarGrafico22();
    if (this.filtroUsuarioGrafico22) this.filtroUsuarioGrafico22.value = oldU;
}

// ==========================================
// HELPERS DE EXPORTACIÓN POR USUARIO
// ==========================================

/**
 * Verifica si un gráfico tiene datos VISIBLES (para usuario).
 * Durante exportación ignora mensajes "Disponible solo..." pero bloquea "Sin datos".
 */
_graficoTieneDatosUsuario(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return false;

    const container = canvas.parentElement;
    if (container) {
        const msg = container.querySelector('.chart-empty-message');
        if (msg) {
            const texto = msg.textContent || '';
            if (texto.includes('Sin datos') && !texto.includes('Disponible')) return false;
            if (texto.includes('Disponible') && !this._forzandoExportacion) return false;
        }
    }

    const chart = this.charts[canvasId];
    if (!chart) return false;

    const datasets = chart.config.data?.datasets || [];
    const total = datasets.reduce((sum, ds) =>
        sum + (ds.data || []).reduce((a, b) => a + (Number(b) || 0), 0), 0);

    if (chart.config.type === 'doughnut' || chart.config.type === 'pie') {
        return total > 0;
    }
    return datasets.some(ds => (ds.data || []).some(v => Number(v) > 0));
}

/**
 * Captura un gráfico + su tabla de resumen como imagen (versión usuario).
 */
async _capturarGraficoCompletoUsuario(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    if (!this._graficoTieneDatosUsuario(canvasId)) {
        console.log(`⏭️ Omitiendo ${canvasId} - Sin datos de usuario`);
        return null;
    }

    // Reutiliza el método general de captura (ya incluye la tabla de resumen)
    return await this._capturarGraficoCompleto(canvasId);
}

}

// ============================================
// EXPOSICIÓN GLOBAL
// ============================================
if (typeof window !== 'undefined') {
    window.DashboardChartsController = DashboardChartsController;
}