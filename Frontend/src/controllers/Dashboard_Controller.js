// ==============================================
// CONTROLLER: DashboardController (Principal)
// Responsabilidad: Orquestar el Dashboard de Asistencia.
//   - Verificar sesión y rol.
//   - Cargar datos iniciales (vía DashboardService).
//   - Instanciar y coordinar sub-controladores.
//   - Gestionar filtros universales (Mes/Año).
//   - Gestionar la exportación a PDF.
//
// Depende de:
//   - DashboardService
//   - DashboardKPIsController
//   - DashboardChartsController
//   - DashboardResumenController
// ==============================================

class DashboardController {

    constructor(config) {
        this.config = config || {};
        this.usuarioActual = null;

        // Service (inyectado en el bootstrap)
        this.service = null;

        // Sub-controladores
        this.kpisController = null;
        this.chartsController = null;
        this.resumenController = null;

        // Estado de los filtros universales
        this.mesActual = new Date().getMonth() + 1;
        this.añoActual = new Date().getFullYear();
        this.hayRegistrosEnMes = false;
        this.esMesActual = true;

        // Referencias DOM
        this._cachearDOM();
    }

    // ==========================================
    // CACHEAR DOM
    // ==========================================
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

        // Acciones
        this.btnExportarPDF = document.getElementById('btnExportarPDF');
        this.btnExportarPDFUsuario = document.getElementById('btnExportarPDFUsuario');
        this.btnVolver = document.getElementById('btnVolver');

        // Filtros universales
        this.filtroMes = document.getElementById('filtroMes');
        this.filtroAnio = document.getElementById('filtroAnio');

        // Loading / Bloqueo
        this.loadingModal = document.getElementById('loadingModal');
        this.loadingModalTitle = document.getElementById('loadingModalTitle');
        this.loadingModalSubtitle = document.getElementById('loadingModalSubtitle');
        this.loadingModalStatus = document.getElementById('loadingModalStatus');
        this.loadingModalProgress = document.getElementById('loadingModalProgress');
        this.loadingModalTip = document.getElementById('loadingModalTip');

        this.blockingModal = document.getElementById('blockingModal');
        this.blockingSubtitle = document.getElementById('blockingSubtitle');

        // Message box
        this.messageBox = document.getElementById('messageBox');
        this.messageText = document.getElementById('messageText');

        // Modal de configuración para exportar por usuario
        this.configModal = document.getElementById('configModal');
        this.configModalClose = document.getElementById('configModalClose');
        this.configBtnCancelar = document.getElementById('configBtnCancelar');
        this.configForm = document.getElementById('configForm');
        this.configUsuario = document.getElementById('configUsuario');
        this.configMomento = document.getElementById('configMomento');
        this.configSemana = document.getElementById('configSemana');
        this.configBtnExportar = document.getElementById('configBtnExportar');
    }

    // ==========================================
    // INICIALIZACIÓN
    // ==========================================
    async init() {
        // 1. Verificar autenticación
        if (!this._verificarAutenticacion()) return;

        // 2. Verificar rol admin
        if (!this._verificarRolAdmin()) return;

        // 3. Mostrar modal de carga
        const nombreMes = this._getNombreMes(this.mesActual);
        this.mostrarModalCarga(
            `Cargando Dashboard - ${nombreMes} ${this.añoActual}`,
            'Por favor espere...',
            'Iniciando...',
            5
        );

        // 4. Cargar datos
        try {
            this.actualizarModalCarga('Cargando datos desde el servidor...', 20);

            const resultado = await this.service.cargarTodoParaDashboard();

            if (!resultado.success) {
                this.ocultarModalCarga();
                this.mostrarModalBloqueo(
                    `No se pudo cargar los datos del dashboard:\n${resultado.error || 'Error de conexión'}`
                );
                return;
            }

            this.data = resultado.data;
            console.log('✅ Datos del dashboard cargados:', {
                usuarios: this.data.usuarios.length,
                marcaciones: this.data.marcaciones.length,
                asignaciones: this.data.asignaciones.length
            });

        } catch (error) {
            console.error('❌ Error cargando datos:', error);
            this.ocultarModalCarga();
            this.mostrarModalBloqueo('Error al cargar los datos. El servidor no responde.');
            return;
        }

        // 5. Actualizar UI de usuario
        this._cargarDatosUsuario();

        // 6. Configurar eventos
        this._configurarEventos();

        // 7. Cargar filtros de mes/año
        this._cargarFiltrosMesAnio();

        // 7.1 Cargar filtros de usuarios, sucursales, áreas
        await this._cargarFiltrosUsuariosYSucursales();

        // 8. Instanciar sub-controladores
        this.actualizarModalCarga('Inicializando módulos...', 40);
        this._instanciarSubControllers();

        // 9. Cargar todo
        await this.cargarTodo();

        // 10. Ocultar modal
        this.ocultarModalCarga();
        console.log('✅ Dashboard inicializado correctamente');
    }

    // ==========================================
    // VERIFICACIÓN DE SESIÓN Y ROL
    // ==========================================
    _verificarAutenticacion() {
        let userLogged = sessionStorage.getItem('usuarioActual');
        if (!userLogged) userLogged = sessionStorage.getItem('userLogged');

        if (!userLogged) {
            console.warn('⚠️ No hay sesión iniciada. Redirigiendo al login...');
            this.redirigirALogin();
            return false;
        }

        try {
            this.usuarioActual = JSON.parse(userLogged);

            // Verificar expiración
            if (this.usuarioActual.loginTime) {
                const tiempoTranscurrido = Date.now() - new Date(this.usuarioActual.loginTime).getTime();
                const tiempoMaximo = this.config.TIMEOUTS?.SESSION_TIMEOUT || 8 * 60 * 60 * 1000;

                if (tiempoTranscurrido > tiempoMaximo) {
                    console.log('⏰ Sesión expirada');
                    sessionStorage.clear();
                    this.redirigirALogin();
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error('❌ Error al parsear sesión:', error);
            sessionStorage.clear();
            this.redirigirALogin();
            return false;
        }
    }

    _verificarRolAdmin() {
        const rol = String(this.usuarioActual?.rol || this.usuarioActual?.Rol || '').toUpperCase();
        if (rol !== 'ADMINISTRADOR') {
            console.warn('⚠️ Acceso denegado. Se requiere rol de administrador.');
            this.mostrarMensaje('Acceso denegado. Se requiere rol de administrador.', 'error');
            setTimeout(() => this.redirigirAlMenu(), 2000);
            return false;
        }
        return true;
    }

    // ==========================================
    // HEADER
    // ==========================================
    _cargarDatosUsuario() {
        const u = this.usuarioActual || {};
        const nombreCompleto = `${u.nombres || u.Nombres || ''} ${u.apellidos || u.Apellidos || ''}`.trim() || 'Usuario';
        const correo = u.correo || u.Correo || '';
        const rol = u.rol || u.Rol || 'Administrador';

        if (this.userNameDisplay) this.userNameDisplay.textContent = nombreCompleto;
        if (this.userRoleDisplay) this.userRoleDisplay.textContent = rol;
        if (this.dropdownUserName) this.dropdownUserName.textContent = nombreCompleto;
        if (this.dropdownUserEmail) this.dropdownUserEmail.textContent = correo;
        if (this.dropdownUserRole) this.dropdownUserRole.textContent = rol;
    }

    // ==========================================
    // EVENTOS
    // ==========================================
    _configurarEventos() {
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
        if (this.menuBtn) this.menuBtn.addEventListener('click', (e) => { e.stopPropagation(); this.redirigirAlMenu(); });
        if (this.perfilBtn) this.perfilBtn.addEventListener('click', (e) => { e.stopPropagation(); this.redirigirAlPerfil(); });
        if (this.logoArea) this.logoArea.addEventListener('click', () => this.redirigirAlMenu());
        if (this.btnVolver) this.btnVolver.addEventListener('click', () => this.redirigirAlMenu());

        // Filtros universales
        if (this.filtroMes) {
            this.filtroMes.addEventListener('change', () => this.aplicarFiltrosUniversales());
        }
        if (this.filtroAnio) {
            this.filtroAnio.addEventListener('change', () => this.aplicarFiltrosUniversales());
        }

        // Exportar PDF
        if (this.btnExportarPDF) {
            this.btnExportarPDF.addEventListener('click', () => this.exportarPDF());
        }

        // Exportar PDF por usuario
        if (this.btnExportarPDFUsuario) {
            this.btnExportarPDFUsuario.addEventListener('click', async () => {
                await this._abrirModalConfigUsuario();
            });
        }

        // Cerrar modal
        if (this.configModalClose) this.configModalClose.onclick = () => this._cerrarModalConfigUsuario();
        if (this.configBtnCancelar) this.configBtnCancelar.onclick = () => this._cerrarModalConfigUsuario();

        // Click fuera del modal
        if (this.configModal) {
            this.configModal.onclick = (e) => {
                if (e.target === this.configModal) this._cerrarModalConfigUsuario();
            };
        }

        // Submit del form
        if (this.configForm) {
            this.configForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this._procesarExportacionPorUsuario();
            });
        }
    }

    // ==========================================
    // FILTROS MES/AÑO
    // ==========================================
    _cargarFiltrosMesAnio() {
        const meses = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        if (this.filtroMes) {
            this.filtroMes.innerHTML = '';
            meses.forEach((nombre, index) => {
                const opt = document.createElement('option');
                opt.value = index + 1;
                opt.textContent = nombre;
                if (index + 1 === this.mesActual) opt.selected = true;
                this.filtroMes.appendChild(opt);
            });
        }

        if (this.filtroAnio) {
            this.filtroAnio.innerHTML = '';
            const añoActual = new Date().getFullYear();
            for (let i = añoActual; i >= añoActual - 4; i--) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = i;
                if (i === this.añoActual) opt.selected = true;
                this.filtroAnio.appendChild(opt);
            }
        }

        // ✅ NUEVO: Poblar los filtros de semana
        this._cargarFiltrosSemanas();
        this._seleccionarSemanaActual();
    }

    // ==========================================
    // HELPER: Poblar selects de semana (1-5)
    // ==========================================
    _cargarFiltrosSemanas() {
        const semanas = [1, 2, 3, 4, 5];

        const filtrosSemana = [
            document.getElementById('filtroSemanaGrafico4'),
            document.getElementById('filtroSemanaGrafico5'),
            document.getElementById('filtroSemanaGrafico7'),
            document.getElementById('filtroSemanaGrafico14'),
            document.getElementById('filtroSemanaGrafico19')
        ].filter(Boolean);

        filtrosSemana.forEach(select => {
            const valorActual = select.value;
            select.innerHTML = '';
            semanas.forEach(num => {
                const opt = document.createElement('option');
                opt.value = num;
                opt.textContent = `Semana ${num}`;
                select.appendChild(opt);
            });
            // Restaurar si había valor
            if (valorActual) select.value = valorActual;
        });
    }

    // ==========================================
    // HELPER: Seleccionar la semana actual del mes
    // ==========================================
    _seleccionarSemanaActual() {
        const hoy = new Date();
        const dia = hoy.getDate();
        let semanaActual;
        if (dia <= 7) semanaActual = 1;
        else if (dia <= 14) semanaActual = 2;
        else if (dia <= 21) semanaActual = 3;
        else if (dia <= 28) semanaActual = 4;
        else semanaActual = 5;

        const filtrosSemana = [
            document.getElementById('filtroSemanaGrafico4'),
            document.getElementById('filtroSemanaGrafico5'),
            document.getElementById('filtroSemanaGrafico7'),
            document.getElementById('filtroSemanaGrafico14'),
            document.getElementById('filtroSemanaGrafico19')
        ].filter(Boolean);

        filtrosSemana.forEach(select => {
            select.value = String(semanaActual);
        });

        console.log(`📅 Semana actual seleccionada: ${semanaActual}`);
    }

    async _cargarFiltrosUsuariosYSucursales() {
        const usuarios = this.data.usuarios || [];
        const sucursales = this.data.sucursales || [];
        const areas = this.data.areas || [];

        // ============================================
        // SELECTS DE USUARIO
        // ============================================
        const selectsUsuario = [
            'filtroUsuarioGrafico2', 'filtroUsuarioGrafico3',
            'filtroUsuarioGrafico4', 'filtroUsuarioGrafico5',
            'filtroUsuarioGrafico11', 'filtroUsuarioGrafico12',
            'filtroUsuarioGrafico16', 'filtroUsuarioGrafico17',
            'filtroUsuarioGrafico21', 'filtroUsuarioGrafico22'
        ];

        selectsUsuario.forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) {
                console.warn(`⚠️ No existe el select: ${id}`);
                return;
            }

            sel.innerHTML = '<option value="">Seleccionar Usuario</option>';

            usuarios.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.IdUsuario;
                const nombre = `${u.Nombres || u.Nombre || ''} ${u.Apellidos || ''}`.trim();
                opt.textContent = nombre || `Usuario ${u.IdUsuario}`;
                sel.appendChild(opt);
            });

            console.log(`✅ ${id}: ${usuarios.length} usuarios cargados`);
        });

        // ============================================
        // SELECTS DE SUCURSAL
        // ============================================
        const selectsSucursal = [
            'filtroSucursalGrafico6', 'filtroSucursalGrafico8', 'filtroSucursalGrafico9',
            'filtroSucursalGrafico23', 'filtroSucursalGrafico24', 'filtroSucursalGrafico25'
        ];

        selectsSucursal.forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) return;

            sel.innerHTML = '<option value="">Todas las Sucursales</option>';

            sucursales.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.IdSucursal;
                opt.textContent = s.NombreSucursal || `Sucursal ${s.IdSucursal}`;
                sel.appendChild(opt);
            });
        });

        // ============================================
        // SELECTS DE ÁREA
        // ============================================
        const selectsArea = [
            'filtroAreaGrafico6', 'filtroAreaGrafico8', 'filtroAreaGrafico9',
            'filtroAreaGrafico23', 'filtroAreaGrafico24', 'filtroAreaGrafico25'
        ];

        selectsArea.forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) return;

            sel.innerHTML = '<option value="">Todas las Áreas</option>';

            areas.forEach(a => {
                const opt = document.createElement('option');
                opt.value = a.IdArea;
                opt.textContent = a.Nombre || a.Descripcion || `Área ${a.IdArea}`;
                sel.appendChild(opt);
            });
        });

        // ============================================
        // SELECTS DE EMPRESA (placeholder si no hay datos)
        // ============================================
        const selectsEmpresa = [
            'filtroEmpresaGrafico6', 'filtroEmpresaGrafico8', 'filtroEmpresaGrafico9',
            'filtroEmpresaGrafico23', 'filtroEmpresaGrafico24', 'filtroEmpresaGrafico25'
        ];

        selectsEmpresa.forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) return;
            sel.innerHTML = '<option value="">Todas las Empresas</option>';
        });

        console.log(`✅ Filtros cargados: ${usuarios.length} usuarios, ${sucursales.length} sucursales, ${areas.length} áreas`);
    }

    async aplicarFiltrosUniversales() {
        const mes = parseInt(this.filtroMes?.value) || this.mesActual;
        const año = parseInt(this.filtroAnio?.value) || this.añoActual;

        console.log(`🔄 Aplicando filtros universales: ${mes}/${año}`);

        this.mesActual = mes;
        this.añoActual = año;

        const nombreMes = this._getNombreMes(mes);
        this.mostrarModalCarga(
            `Actualizando - ${nombreMes} ${año}`,
            'Aplicando filtros...',
            'Procesando...',
            30
        );

        try {
            await this.cargarTodo();
            this.actualizarModalCarga('✅ ¡Datos actualizados!', 100);
            await new Promise(r => setTimeout(r, 400));
            this.ocultarModalCarga();
            this.mostrarMensaje(`Datos actualizados para ${nombreMes} ${año}`, 'success');
        } catch (error) {
            console.error('❌ Error aplicando filtros:', error);
            this.ocultarModalCarga();
            this.mostrarMensaje(`Error al actualizar: ${error.message}`, 'error');
        }
    }

    // ==========================================
    // SUB-CONTROLLERS
    // ==========================================
    _instanciarSubControllers() {
        // KPIs
        if (typeof DashboardKPIsController !== 'undefined') {
            this.kpisController = new DashboardKPIsController(
                this.service,
                this.data,
                this.config
            );
        }

        // Gráficos
        if (typeof DashboardChartsController !== 'undefined') {
            this.chartsController = new DashboardChartsController(
                this.service,
                this.data,
                this.config
            );
        }

        // Resumen
        if (typeof DashboardResumenController !== 'undefined') {
            this.resumenController = new DashboardResumenController(
                this.service,
                this.data,
                this.config
            );
        }

        console.log('✅ Sub-controladores instanciados');
    }

    // ==========================================
    // CARGA GLOBAL
    // ==========================================
    async cargarTodo() {
        const mes = this.mesActual;
        const año = this.añoActual;

        // Detectar si es mes actual
        const hoy = new Date();
        this.esMesActual = (mes === hoy.getMonth() + 1 && año === hoy.getFullYear());

        // 1. KPIs
        if (this.kpisController) {
            this.actualizarModalCarga('Calculando KPIs...', 50);
            await this.kpisController.cargar(mes, año);
            this.hayRegistrosEnMes = this.kpisController.hayRegistros;
        }

        // 2. Gráficos
        if (this.chartsController) {
            this.actualizarModalCarga('Generando gráficos...', 70);
            await this.chartsController.cargar(mes, año, this.hayRegistrosEnMes, this.esMesActual);
        }

        // 3. Tabla resumen
        if (this.resumenController) {
            this.actualizarModalCarga('Cargando tabla de resumen...', 90);
            await this.resumenController.cargar(mes, año, this.hayRegistrosEnMes);
        }
    }

    // ==========================================
    // EXPORTAR PDF
    // ==========================================
    async exportarPDF() {
        this.mostrarModalCarga('Exportando PDF', 'Preparando reporte...', 'Iniciando...', 5);

        try {
            if (!this.hayRegistrosEnMes) {
                this.ocultarModalCarga();
                this.mostrarMensaje('No hay registros en el mes seleccionado', 'warning');
                return;
            }

            if (typeof window.jspdf === 'undefined' || typeof html2canvas === 'undefined') {
                this.ocultarModalCarga();
                throw new Error('Librerías jsPDF o html2canvas no cargadas');
            }

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const contentWidth = pageWidth - margin * 2;

            let yPos = margin;
            let paginaActual = 1;

            // ============================================
            // TÍTULO GENERAL
            // ============================================
            const nombreMes = this._getNombreMes(this.mesActual);
            pdf.setFontSize(18);
            pdf.setTextColor(139, 0, 0);
            pdf.text(`Dashboard de Asistencia - ${nombreMes} ${this.añoActual}`, margin, yPos);
            yPos += 12;

            // ============================================
            // 1. KPIs
            // ============================================
            this.actualizarModalCarga('Capturando KPIs...', 20);

            if (this.kpisController) {
                const kpiCanvas = await this.kpisController.capturarParaPDF();
                if (kpiCanvas) {
                    const imgData = kpiCanvas.toDataURL('image/png');

                    // ✅ Ajuste KPI: Ocupa el 95% del ancho, centrado
                    const imgWidth = contentWidth * 0.95;
                    const imgHeight = (kpiCanvas.height * imgWidth) / kpiCanvas.width;
                    const xPos = margin + (contentWidth - imgWidth) / 2;

                    if (yPos + imgHeight > pageHeight - margin) {
                        pdf.addPage();
                        yPos = margin;
                        paginaActual++;
                    }

                    pdf.addImage(imgData, 'PNG', xPos, yPos, imgWidth, imgHeight);
                    yPos += imgHeight + 10;
                }
            }

            // ============================================
            // 2. GRÁFICOS
            // ============================================
            this.actualizarModalCarga('Capturando gráficos...', 50);

            if (this.chartsController) {
                const charts = await this.chartsController.capturarParaPDF();
                console.log(`📊 Gráficos capturados: ${charts.length}`);

                for (let i = 0; i < charts.length; i++) {
                    const progreso = 50 + Math.round(((i + 1) / charts.length) * 35);
                    this.actualizarModalCarga(`Gráfico ${i + 1}/${charts.length}...`, progreso);

                    const chart = charts[i];
                    const imgData = chart.canvas.toDataURL('image/png');

                    // ✅ Ajuste GRÁFICOS: Ocupa el 80% del ancho, centrado
                    const imgWidth = contentWidth * 0.80;
                    const imgHeight = (chart.canvas.height * imgWidth) / chart.canvas.width;
                    const xPos = margin + (contentWidth - imgWidth) / 2;

                    // Si no cabe, nueva página
                    if (yPos + imgHeight + 10 > pageHeight - margin) {
                        pdf.addPage();
                        yPos = margin;
                        paginaActual++;
                    }

                    pdf.addImage(imgData, 'PNG', xPos, yPos, imgWidth, imgHeight);
                    yPos += imgHeight + 8;
                }
            }

            // ============================================
            // 3. TABLA RESUMEN
            // ============================================
            this.actualizarModalCarga('Capturando tabla resumen...', 90);

            if (this.resumenController) {
                const tablas = await this.resumenController.capturarParaPDF();

                for (const tabla of tablas) {
                    const imgData = tabla.canvas.toDataURL('image/png');

                    // ✅ Ajuste TABLA: Ocupa el 95% del ancho, centrada
                    const imgWidth = contentWidth * 0.95;
                    const imgHeight = (tabla.canvas.height * imgWidth) / tabla.canvas.width;
                    const xPos = margin + (contentWidth - imgWidth) / 2;

                    if (yPos + imgHeight + 10 > pageHeight - margin) {
                        pdf.addPage();
                        yPos = margin;
                        paginaActual++;
                    }

                    pdf.setFontSize(12);
                    pdf.setTextColor(80, 80, 80);
                    // Título de la tabla alineado a la izquierda de la imagen
                    pdf.text(`Resumen de Marcaciones (${tabla.pagina}/${tabla.totalPaginas})`, xPos, yPos);
                    yPos += 6;

                    pdf.addImage(imgData, 'PNG', xPos, yPos, imgWidth, imgHeight);
                    yPos += imgHeight + 8;
                }
            }

            // ============================================
            // GUARDAR
            // ============================================
            this.actualizarModalCarga('Guardando PDF...', 98);
            const fecha = new Date().toISOString().split('T')[0];
            pdf.save(`Dashboard_${nombreMes}_${this.añoActual}_${fecha}.pdf`);

            this.ocultarModalCarga();
            this.mostrarMensaje(`PDF exportado (${paginaActual} páginas)`, 'success');

        } catch (error) {
            console.error('❌ Error exportando PDF:', error);
            this.ocultarModalCarga();
            this.mostrarMensaje(`Error: ${error.message}`, 'error');
        }
    }

    // ==========================================
    // EXPORTAR PDF POR USUARIO
    // ==========================================
    async _exportarPDFPorUsuarioUnico(usuarioId, momento, semana) {
        const usuario = await this._getUsuarioInfo(usuarioId);
        const nombreUsuario = usuario?.nombre || `Usuario ${usuarioId}`;
        const rangoFechas = this._obtenerRangoSemana(semana, this.mesActual, this.añoActual);
        const nombreMes = this._getNombreMes(this.mesActual);
        const añoFinal = this.añoActual;

        // ✅ 1. VERIFICAR SI HAY DATOS ANTES DE INICIAR
        const tieneDatos = await this._verificarUsuarioTieneDatos(usuarioId, momento, semana);
        if (!tieneDatos) {
            this.mostrarMensaje(`El usuario ${nombreUsuario} no tiene registros en la Semana ${semana} (${rangoFechas}) para el momento seleccionado.`, 'warning');
            return; // Detiene la exportación
        }

        console.log(`🔍 Exportando PDF para usuario ${usuarioId} (${momento}, Semana ${semana})`);

        this.mostrarModalCarga(
            'Generando PDF Personalizado',
            `Usuario: ${nombreUsuario}`,
            'Preparando gráficos...',
            10
        );

        try {
            const pdf = await this._generarPDFUsuario(usuarioId, momento, semana, this.mesActual, añoFinal);
            const fecha = new Date().toISOString().split('T')[0];
            pdf.save(`reporte_usuario_${nombreUsuario.replace(/\s+/g, '_')}_${fecha}.pdf`);

            this.ocultarModalCarga();
            this.mostrarMensaje(`PDF exportado para ${nombreUsuario} (Semana ${semana})`, 'success');
            setTimeout(() => location.reload(), 1500);
        } catch (error) {
            console.error('❌ Error exportando PDF por usuario:', error);
            this.ocultarModalCarga();
            this.mostrarMensaje(`Error: ${error.message}`, 'error');
        }
    }

    async _exportarPDFPorUsuarioTodos(momento, semana) {
        this.mostrarModalCarga(
            'Generando PDF - Todos los Usuarios',
            'Procesando usuarios...',
            'Iniciando...',
            5
        );

        try {
            // 1. Obtener usuarios con datos en el período
            const usuarios = await this.service.getUsuarios();
            if (!usuarios.success) throw new Error('No se pudo obtener la lista de usuarios');

            const usuariosConDatos = [];
            for (const u of usuarios.data || []) {
                const tieneDatos = await this._verificarUsuarioTieneDatos(u.IdUsuario, momento, semana);
                if (tieneDatos) {
                    usuariosConDatos.push({
                        id: u.IdUsuario,
                        nombre: `${u.Nombres || ''} ${u.Apellidos || ''}`.trim() || `Usuario ${u.IdUsuario}`
                    });
                }
            }

            if (usuariosConDatos.length === 0) {
                this.ocultarModalCarga();
                this.mostrarMensaje('No hay usuarios con registros en el período seleccionado', 'warning');
                return;
            }

            console.log(`📊 Usuarios con datos: ${usuariosConDatos.length}`);

            // 2. PDF maestro
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const contentWidth = pageWidth - margin * 2;

            const nombreMes = this._getNombreMes(this.mesActual);
            const momentoTexto = {
                ingreso: 'Ingreso',
                ingresoAlmuerzo: 'Ingreso Almuerzo',
                salidaAlmuerzo: 'Salida Almuerzo'
            }[momento] || momento;
            const rangoFechas = this._obtenerRangoSemana(semana, this.mesActual, this.añoActual);

            // ---- PORTADA ----
            pdf.setFontSize(22);
            pdf.setTextColor(139, 0, 0);
            pdf.text('Reporte por Usuario', margin, 30);
            pdf.setFontSize(14);
            pdf.setTextColor(80, 80, 80);
            pdf.text(`${nombreMes} ${this.añoActual}`, margin, 42);
            pdf.setFontSize(12);
            pdf.text(`Momento: ${momentoTexto} | Semana: ${semana} (${rangoFechas})`, margin, 52);
            pdf.text(`Total de usuarios: ${usuariosConDatos.length}`, margin, 60);

            // ---- RECORRER USUARIOS ----
            for (let i = 0; i < usuariosConDatos.length; i++) {
                const u = usuariosConDatos[i];
                const progreso = 10 + Math.round(((i + 1) / usuariosConDatos.length) * 85);
                this.actualizarModalCarga(
                    `Usuario ${i + 1}/${usuariosConDatos.length}: ${u.nombre}`,
                    progreso
                );

                try {
                    // Siempre nueva página para cada usuario
                    pdf.addPage();
                    let yPos = margin;

                    // ---- ENCABEZADO DEL USUARIO ----
                    pdf.setFontSize(16);
                    pdf.setTextColor(80, 80, 80);
                    pdf.text(u.nombre, margin, yPos);
                    yPos += 7;
                    pdf.setFontSize(10);
                    pdf.setTextColor(120, 120, 120);
                    pdf.text(`Momento: ${momentoTexto} | Semana: ${semana} (${rangoFechas})`, margin, yPos);
                    yPos += 10;

                    // ---- DEFINIR GRÁFICOS SEGÚN MOMENTO ----
                    let chartIds = [];
                    let chartTitles = [];
                    if (momento === 'ingreso') {
                        chartIds = ['grafico2', 'grafico3', 'grafico4', 'grafico11', 'grafico16', 'grafico17', 'grafico21', 'grafico22'];
                        chartTitles = [
                            'Rendimiento Semanal por Usuario (Ingreso)',
                            'Rendimiento Mensual por Usuario (Ingreso)',
                            'Evolución Mensual de Minutos de Tardanza por Días',
                            'Evolución Mensual de Minutos de Tardanza por Semanas',
                            'Justificación Semanal de Tardanza por Usuario',
                            'Justificación Mensual de Tardanza por Usuario',
                            'Faltas Justificadas/No Justificadas Semanal por Usuario',
                            'Faltas Justificadas/No Justificadas Mensual por Usuario'
                        ];
                    } else if (momento === 'ingresoAlmuerzo') {
                        chartIds = ['grafico2', 'grafico3'];
                        chartTitles = [
                            'Rendimiento Semanal por Usuario (Ingreso Almuerzo)',
                            'Rendimiento Mensual por Usuario (Ingreso Almuerzo)'
                        ];
                    } else if (momento === 'salidaAlmuerzo') {
                        chartIds = ['grafico2', 'grafico3', 'grafico5', 'grafico12', 'grafico16', 'grafico17'];
                        chartTitles = [
                            'Rendimiento Semanal por Usuario (Salida Almuerzo)',
                            'Rendimiento Mensual por Usuario (Salida Almuerzo)',
                            'Evolución Mensual de Minutos de Exceso (Almuerzo) por Días',
                            'Evolución Mensual de Minutos de Exceso (Almuerzo) por Semanas',
                            'Justificación Semanal de Exceso por Usuario',
                            'Justificación Mensual de Exceso por Usuario'
                        ];
                    }

                    // ---- PROCESAR GRÁFICOS DEL USUARIO ----
                    // ---- PROCESAR GRÁFICOS DEL USUARIO (1 gráfico por página) ----
                    let primeraGraficaDeUsuario = true;
                    for (let j = 0; j < chartIds.length; j++) {
                        const chartId = chartIds[j];
                        try {
                            await this.chartsController._actualizarGraficoParaExportacion(
                                chartId, u.id, momento, semana, this.mesActual, this.añoActual
                            );
                            await new Promise(r => setTimeout(r, 400));

                            if (!this.chartsController._graficoTieneDatosUsuario(chartId)) continue;

                            const captura = await this.chartsController._capturarGraficoCompletoUsuario(chartId);
                            if (!captura) continue;

                            // Cada gráfico en su propia página (excepto el primero, que va en la página del encabezado)
                            if (!primeraGraficaDeUsuario) {
                                pdf.addPage();
                                yPos = margin;
                                pdf.setFontSize(11);
                                pdf.setTextColor(120, 120, 120);
                                pdf.text(`${u.nombre} (continuación)`, margin, yPos);
                                yPos += 8;
                            }
                            primeraGraficaDeUsuario = false;

                            // ✅ Tamaño ajustado y centrado
                            const imgWidth = contentWidth * 0.80;
                            const imgHeight = (captura.height * imgWidth) / captura.width;

                            // ✅ CREAMOS LA VARIABLE xPos QUE FALTABA
                            const xPos = margin + (contentWidth - imgWidth) / 2;

                            if (yPos + imgHeight + 10 > pageHeight - margin) {
                                pdf.addPage();
                                yPos = margin;
                                pdf.setFontSize(11);
                                pdf.setTextColor(120, 120, 120);
                                pdf.text(`${u.nombre} (continuación)`, margin, yPos);
                                yPos += 8;
                            }

                            // Título del gráfico centrado con respecto a la imagen
                            pdf.setFontSize(10);
                            pdf.setTextColor(60, 60, 60);
                            pdf.setFont('helvetica', 'bold');
                            pdf.text(chartTitles[j], xPos, yPos);
                            yPos += 5;

                            pdf.addImage(captura.toDataURL('image/png'), 'PNG', xPos, yPos, imgWidth, imgHeight);
                            yPos += imgHeight + 8;
                        } catch (err) {
                            console.warn(`⚠️ Error procesando ${chartId} para ${u.nombre}:`, err);
                        }
                    }

                    // ---- TABLA RESUMEN DEL USUARIO ----
                    // Verificar si cabe, si no, nueva página
                    if (yPos + 50 > pageHeight - margin) {
                        pdf.addPage();
                        yPos = margin;
                        pdf.setFontSize(11);
                        pdf.setTextColor(120, 120, 120);
                        pdf.text(`${u.nombre} (continuación)`, margin, yPos);
                        yPos += 8;
                    }

                    pdf.setFontSize(10);
                    pdf.setTextColor(60, 60, 60);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text('Resumen de Marcaciones', margin, yPos);
                    yPos += 6;

                    yPos = await this._agregarTablaResumenUsuarioPDF(
                        pdf, u.id, margin, contentWidth, pageHeight, yPos, true
                    );

                    console.log(`✅ PDF de ${u.nombre} completado (página ${pdf.internal.getNumberOfPages()})`);

                } catch (err) {
                    console.warn(`⚠️ Error procesando usuario ${u.nombre}:`, err);
                    // Continuar con el siguiente usuario
                }
            }

            // ---- GUARDAR ----
            this.actualizarModalCarga('Guardando PDF...', 98);
            const fecha = new Date().toISOString().split('T')[0];
            pdf.save(`Reporte_Todos_${nombreMes}_${this.añoActual}_${fecha}.pdf`);

            this.ocultarModalCarga();
            this.mostrarMensaje(`PDF exportado (${usuariosConDatos.length} usuarios, ${pdf.internal.getNumberOfPages()} páginas)`, 'success');

            setTimeout(() => location.reload(), 1500);

        } catch (error) {
            console.error('❌ Error exportando PDF para todos:', error);
            this.ocultarModalCarga();
            this.mostrarMensaje(`Error: ${error.message}`, 'error');
        }
    }

    // ==========================================
    // GENERAR PDF POR USUARIO (SOLO gráficos de usuario + tabla usuario)
    // ==========================================
    async _generarPDFUsuario(usuarioId, momento, semana, mes = null, año = null) {
        const mesFinal = mes || this.mesActual;
        const añoFinal = año || this.añoActual;

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pageWidth - margin * 2;

        let yPos = margin;
        let paginaActual = 1;

        const nombreUsuario = (await this._getUsuarioInfo(usuarioId))?.nombre || `Usuario ${usuarioId}`;
        const nombreMes = this._getNombreMes(mesFinal);
        const rangoFechas = this._obtenerRangoSemana(semana, mesFinal, añoFinal);
        const momentoTexto = { ingreso: 'Ingreso', ingresoAlmuerzo: 'Ingreso Almuerzo', salidaAlmuerzo: 'Salida Almuerzo' }[momento] || momento;

        pdf.setFontSize(18);
        pdf.setTextColor(80, 80, 80);
        pdf.text(`Reporte por Usuario - ${nombreMes} ${añoFinal}`, margin, yPos);
        yPos += 12;
        pdf.setFontSize(11);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Usuario: ${nombreUsuario}`, margin, yPos);
        yPos += 8;
        pdf.text(`Momento: ${momentoTexto} | Semana: ${semana} (${rangoFechas})`, margin, yPos);
        yPos += 14;

        // ---- Definir gráficos según momento (MISMOS del DashboardController viejo) ----
        let chartIds = [];
        let chartTitles = [];
        if (momento === 'ingreso') {
            chartIds = ['grafico2', 'grafico3', 'grafico4', 'grafico11', 'grafico16', 'grafico17', 'grafico21', 'grafico22'];
            chartTitles = [
                'Rendimiento Semanal por Usuario (Ingreso)',
                'Rendimiento Mensual por Usuario (Ingreso)',
                'Evolución Mensual de Minutos de Tardanza por Días',
                'Evolución Mensual de Minutos de Tardanza por Semanas',
                'Justificación Semanal de Tardanza por Usuario',
                'Justificación Mensual de Tardanza por Usuario',
                'Faltas Justificadas/No Justificadas Semanal por Usuario',
                'Faltas Justificadas/No Justificadas Mensual por Usuario'
            ];
        } else if (momento === 'ingresoAlmuerzo') {
            chartIds = ['grafico2', 'grafico3'];
            chartTitles = ['Rendimiento Semanal por Usuario (Ingreso Almuerzo)', 'Rendimiento Mensual por Usuario (Ingreso Almuerzo)'];
        } else if (momento === 'salidaAlmuerzo') {
            chartIds = ['grafico2', 'grafico3', 'grafico5', 'grafico12', 'grafico16', 'grafico17'];
            chartTitles = [
                'Rendimiento Semanal por Usuario (Salida Almuerzo)',
                'Rendimiento Mensual por Usuario (Salida Almuerzo)',
                'Evolución Mensual de Minutos de Exceso (Almuerzo) por Días',
                'Evolución Mensual de Minutos de Exceso (Almuerzo) por Semanas',
                'Justificación Semanal de Exceso por Usuario',
                'Justificación Mensual de Exceso por Usuario'
            ];
        }

        const chartsData = [];

        for (let i = 0; i < chartIds.length; i++) {
            const chartId = chartIds[i];
            try {
                // 🔥 Actualiza el gráfico con datos del usuario (llamada al chartsController)
                await this.chartsController._actualizarGraficoParaExportacion(
                    chartId, usuarioId, momento, semana, mesFinal, añoFinal
                );
                await new Promise(r => setTimeout(r, 400));

                // 🔥 Verifica que tenga datos de usuario
                if (!this.chartsController._graficoTieneDatosUsuario(chartId)) {
                    console.log(`⏭️ Omitiendo ${chartId} - Sin datos de usuario`);
                    continue;
                }

                // 🔥 Captura el gráfico con su tabla resumen
                const captura = await this.chartsController._capturarGraficoCompletoUsuario(chartId);
                if (!captura) continue;

                chartsData.push({ id: chartId, canvas: captura, titulo: chartTitles[i] });
                console.log(`✅ ${chartId} agregado`);
            } catch (err) {
                console.warn(`⚠️ Error procesando ${chartId}:`, err);
            }
        }

        // ---- Agregar gráficos al PDF (uno por página) ----
        if (chartsData.length === 0) {
            pdf.setFontSize(12);
            pdf.setTextColor(150, 150, 150);
            pdf.text('ℹ️ No hay gráficos con datos para este usuario', margin, yPos);
            yPos += 10;
        } else {
            const chartWidth = contentWidth * 0.80;
            const chartHeight = 170;
            for (let i = 0; i < chartsData.length; i++) {
                if (i > 0) {
                    pdf.addPage();
                    yPos = margin;
                    paginaActual++;
                    pdf.setFontSize(14);
                    pdf.setTextColor(100, 100, 100);
                    pdf.text(`Reporte por Usuario - ${nombreMes} ${añoFinal} (pág. ${paginaActual})`, margin, yPos);
                    yPos += 8;
                    pdf.text(`Momento: ${momentoTexto} | Semana: ${semana}`, margin, yPos);
                    yPos += 10;
                } else {
                    yPos += 4;
                }

                const chart = chartsData[i];
                const imgData = chart.canvas.toDataURL('image/png');
                const imgWidth = chartWidth;
                const imgHeight = Math.min((chart.canvas.height * imgWidth) / chart.canvas.width, chartHeight);
                const xPos = margin + (contentWidth - imgWidth) / 2;

                pdf.setFontSize(10);
                pdf.setTextColor(60, 60, 60);
                pdf.setFont('helvetica', 'bold');
                pdf.text(chart.titulo, xPos, yPos);
                yPos += 5;

                pdf.addImage(imgData, 'PNG', xPos, yPos, imgWidth, imgHeight);
                yPos += imgHeight + 5;
            }
        }

        // ---- Tabla resumen del usuario ----
        yPos += 4;
        if (yPos + 40 > pageHeight - margin) {
            pdf.addPage();
            yPos = margin;
            paginaActual++;
        }
        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Resumen de Marcaciones', margin + 2, yPos);
        yPos += 6;
        yPos = await this._agregarTablaResumenUsuarioPDF(pdf, usuarioId, margin, contentWidth, pageHeight, yPos, true);

        return pdf;
    }

    // ==========================================
    // HELPERS: tabla usuario
    // ==========================================
    async _agregarTablaResumenUsuarioPDF(pdf, usuarioId, margin, contentWidth, pageHeight, yPos, sinTitulo = false) {
        try {
            const mes = this.mesActual;
            const año = this.añoActual;

            if (!this.resumenController) return yPos;
            await this.resumenController.cargar(mes, año, true);

            const registros = (this.resumenController.registros || []).filter(r => r.idUsuario === usuarioId);
            if (registros.length === 0) {
                pdf.setFontSize(8);
                pdf.setTextColor(150, 150, 150);
                pdf.text('ℹ️ No hay registros de marcaciones para este usuario', margin + 2, yPos);
                return yPos + 6;
            }

            // Configuración inicial de trazo general
            pdf.setDrawColor(180, 180, 180);
            pdf.setLineWidth(0.1);

            const tableWidth = contentWidth - 4;
            const headers = ['Fecha', 'Hora Ingreso', 'Estado', 'Alm. Ingreso', 'Estado', 'Alm. Salida', 'Estado', 'Falta / Día No Lab.'];
            const baseWidths = [22, 16, 22, 16, 22, 16, 22, 20];
            const baseTotal = baseWidths.reduce((a, b) => a + b, 0);
            const columnWidths = baseWidths.map(w => (w / baseTotal) * tableWidth);
            const rowHeight = 4.5;
            const fontSize = 5.5;
            const headerHeight = 5;

            const abreviar = (txt) => {
                if (!txt || txt === '-') return '-';
                if (txt.includes('Tardanza - No Justificada')) return 'Tardanza No Justif.';
                if (txt.includes('Tardanza - Justificada')) return 'Tardanza Justif.';
                if (txt.includes('Exceso - No Justificado')) return 'Exceso No Justif.';
                if (txt.includes('Exceso - Justificado')) return 'Exceso Justif.';
                if (txt.includes('FALTA - JUSTIFICADA')) return 'Falta Justif.';
                if (txt.includes('FALTA - NO JUSTIFICADA')) return 'Falta No Justif.';
                if (txt.includes('JUSTIFICACIÓN PENDIENTE') || txt.includes('JUSTIFICACION PENDIENTE')) return 'Justif. Pendiente';
                if (txt.includes('NO LABORA -')) return 'Día No Lab.';
                return txt.length > 18 ? txt.substring(0, 17) + '…' : txt;
            };

            // ✅ BUCLE PARA PAGINAR
            let rowIndex = 0;
            while (rowIndex < registros.length) {

                // --- CABECERA DE LA PÁGINA ---
                let currentX = margin + 2;
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(fontSize);

                headers.forEach((h, idx) => {
                    const w = columnWidths[idx];
                    pdf.setFillColor(200, 200, 200);
                    pdf.setDrawColor(180, 180, 180);
                    pdf.rect(currentX, yPos, w, headerHeight, 'FD');
                    pdf.setTextColor(40, 40, 40);
                    pdf.text(h, currentX + 1, yPos + headerHeight - 1);
                    currentX += w;
                });
                yPos += headerHeight;

                // Calcular cuántas filas caben en esta página
                const maxRows = Math.floor((pageHeight - yPos - 15) / rowHeight);

                // --- FILAS ---
                for (let i = 0; i < maxRows && rowIndex < registros.length; i++) {
                    const r = registros[rowIndex];
                    const bg = rowIndex % 2 === 0 ? [255, 255, 255] : [248, 248, 248];
                    currentX = margin + 2;

                    const rowData = [
                        r.fechaDisplay || '-',
                        r.horaIngreso || '-',
                        abreviar(r.estadoIngreso?.texto),
                        r.almuerzoIngreso || '-',
                        abreviar(r.estadoAlmIng?.texto),
                        r.almuerzoSalida || '-',
                        abreviar(r.estadoAlmSal?.texto),
                        abreviar(r.falta?.texto)
                    ];

                    rowData.forEach((cell, cellIdx) => {
                        const w = columnWidths[cellIdx];

                        // 1. Configurar y dibujar fondo
                        pdf.setFillColor(bg[0], bg[1], bg[2]);
                        pdf.setDrawColor(180, 180, 180);
                        pdf.rect(currentX, yPos, w, rowHeight, 'FD');

                        // 2. Procesar texto
                        let text = String(cell);
                        if (text.length > 20) text = text.substring(0, 19) + '…';

                        // 3. Forzar tipografía y color de texto
                        pdf.setFont('helvetica', 'normal');
                        pdf.setFontSize(fontSize);
                        pdf.setTextColor(50, 50, 50);

                        // 4. Escribir texto
                        pdf.text(text, currentX + 1, yPos + rowHeight - 1);
                        currentX += w;
                    });
                    yPos += rowHeight;
                    rowIndex++; // Avanzar a la siguiente fila
                }

                // ✅ Si aún quedan filas por dibujar, creamos una nueva página
                if (rowIndex < registros.length) {
                    pdf.addPage();
                    yPos = margin + 12; // Margen superior en la nueva hoja

                    // Título para avisar que es continuación
                    pdf.setFontSize(10);
                    pdf.setTextColor(100, 100, 100);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text('Resumen de Marcaciones (continuación)', margin, yPos - 5);
                }
            }

            return yPos + 2;
        } catch (error) {
            console.error('Error en _agregarTablaResumenUsuarioPDF:', error);
            return yPos;
        }
    }


    // ==========================================
    // HELPERS: utilidades de usuario/semana
    // ==========================================
    async _verificarUsuarioTieneDatos(usuarioId, momento, semana) {
        try {
            const uid = parseInt(usuarioId);

            // 1. Obtener marcaciones: primero de this.data, si no, del service
            let marcaciones = this.data?.marcaciones;

            if (!Array.isArray(marcaciones) || marcaciones.length === 0) {
                console.warn('⚠️ this.data.marcaciones vacío, consultando al service...');
                const r = await this.service.getAllMarcaciones();
                if (!r.success) {
                    console.error('❌ No se pudieron obtener marcaciones:', r.error);
                    return false;
                }
                marcaciones = r.data || [];
                // Cachear en this.data para no repetir consultas
                if (!this.data) this.data = {};
                this.data.marcaciones = marcaciones;
            }

            console.log(`🔍 _verificarUsuarioTieneDatos: usuario=${uid}, momento=${momento}, semana=${semana}`);
            console.log(`   Total marcaciones en caché: ${marcaciones.length}`);

            // 2. Calcular rango de la semana
            const rango = this._getRangoSemanaDelMes(semana, this.mesActual, this.añoActual);
            console.log(`   Rango semana: ${rango.inicio} → ${rango.fin}`);

            // 3. Buscar coincidencias
            const encontrados = marcaciones.filter(m => {
                if (parseInt(m.IdUsuario) !== uid) return false;

                // Aceptar IdEstado 1 o "ACTIVO"
                const estadoOk = m.IdEstado === 1 || m.IdEstado === '1' || m.DescripcionEstado === 'ACTIVO';
                if (!estadoOk) return false;

                const f = this._normalizarFecha(m.Fecha);
                if (!f || f < rango.inicio || f > rango.fin) return false;

                if (momento === 'ingreso') return !!m.IngMarcado;
                if (momento === 'ingresoAlmuerzo') return !!m.IngAlmuerzoMarcado;
                if (momento === 'salidaAlmuerzo') return !!m.SalAlmuerzoMarcada;
                return true;
            });

            console.log(`   Coincidencias: ${encontrados.length}`);
            if (encontrados.length > 0) {
                console.log('   Ejemplo:', encontrados[0]);
            }

            return encontrados.length > 0;
        } catch (error) {
            console.error('❌ Error en _verificarUsuarioTieneDatos:', error);
            return false;
        }
    }

    async _getUsuarioInfo(usuarioId) {
        const usuarios = this.data.usuarios || [];
        const u = usuarios.find(x => x.IdUsuario === usuarioId);
        if (!u) return null;
        return {
            id: u.IdUsuario,
            nombre: `${u.Nombres || u.Nombre || ''} ${u.Apellidos || ''}`.trim() || `Usuario ${u.IdUsuario}`
        };
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

    _normalizarFecha(valor) {
        if (!valor) return '';
        if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) return valor.slice(0, 10);
        try {
            const d = new Date(valor);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        } catch { return ''; }
    }

    _obtenerRangoSemana(semana, mes, año) {
        const primerDia = new Date(año, mes - 1, 1);
        const start = new Date(primerDia);
        start.setDate(primerDia.getDate() + (semana - 1) * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const ultimoDia = new Date(año, mes, 0);
        if (end > ultimoDia) end.setTime(ultimoDia.getTime());
        const fmt = (f) => `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}`;
        return `${fmt(start)} - ${fmt(end)}`;
    }

    // ==========================================
    // HELPER: Genera canvas de la tabla del usuario
    // ==========================================
    async _generarTablaUsuarioPDF(usuarioId) {
        try {
            // Filtrar registros del usuario desde el resumenController
            const resumenCtrl = this.resumenController;
            if (!resumenCtrl) return null;

            // Asegurar carga
            await resumenCtrl.cargar(this.mesActual, this.añoActual, true);

            const registros = (resumenCtrl.registros || []).filter(r => r.idUsuario === usuarioId);

            if (registros.length === 0) return null;

            // Crear contenedor con tabla HTML
            const container = document.createElement('div');
            container.style.cssText = `
            padding: 15px;
            background: #ffffff;
            width: 750px;
            font-family: 'Segoe UI', Arial, sans-serif;
        `;

            const title = document.createElement('div');
            title.style.cssText = `
            font-size: 14px;
            font-weight: 700;
            color: #8B0000;
            margin-bottom: 10px;
        `;
            title.textContent = '📋 Resumen de Marcaciones';
            container.appendChild(title);

            const table = document.createElement('table');
            table.style.cssText = 'width:100%;border-collapse:collapse;font-size:10px;';

            const thead = document.createElement('thead');
            thead.innerHTML = `
            <tr style="background:#f0f0f0;">
                <th style="padding:5px;border:1px solid #ddd;text-align:left;">Fecha</th>
                <th style="padding:5px;border:1px solid #ddd;text-align:center;">Ingreso</th>
                <th style="padding:5px;border:1px solid #ddd;text-align:center;">Estado</th>
                <th style="padding:5px;border:1px solid #ddd;text-align:center;">Alm. Ing.</th>
                <th style="padding:5px;border:1px solid #ddd;text-align:center;">Estado</th>
                <th style="padding:5px;border:1px solid #ddd;text-align:center;">Alm. Sal.</th>
                <th style="padding:5px;border:1px solid #ddd;text-align:center;">Estado</th>
                <th style="padding:5px;border:1px solid #ddd;text-align:center;">Falta/No Lab.</th>
            </tr>
        `;
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            registros.forEach((r, idx) => {
                const bg = idx % 2 === 0 ? '#fff' : '#f9f9f9';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                <td style="padding:4px 6px;border:1px solid #ddd;background:${bg};">${r.fechaDisplay}</td>
                <td style="padding:4px 6px;border:1px solid #ddd;background:${bg};text-align:center;">${r.horaIngreso}</td>
                <td style="padding:4px 6px;border:1px solid #ddd;background:${bg};text-align:center;">${r.estadoIngreso?.texto || '-'}</td>
                <td style="padding:4px 6px;border:1px solid #ddd;background:${bg};text-align:center;">${r.almuerzoIngreso}</td>
                <td style="padding:4px 6px;border:1px solid #ddd;background:${bg};text-align:center;">${r.estadoAlmIng?.texto || '-'}</td>
                <td style="padding:4px 6px;border:1px solid #ddd;background:${bg};text-align:center;">${r.almuerzoSalida}</td>
                <td style="padding:4px 6px;border:1px solid #ddd;background:${bg};text-align:center;">${r.estadoAlmSal?.texto || '-'}</td>
                <td style="padding:4px 6px;border:1px solid #ddd;background:${bg};text-align:center;">${r.falta?.texto || '-'}</td>
            `;
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            container.appendChild(table);

            document.body.appendChild(container);
            await new Promise(r => setTimeout(r, 300));

            const canvas = await html2canvas(container, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false
            });

            document.body.removeChild(container);
            return canvas;

        } catch (error) {
            console.error('❌ Error generando tabla usuario:', error);
            return null;
        }
    }

    // ==========================================
    // MODAL DE CARGA
    // ==========================================
    mostrarModalCarga(titulo = 'Cargando...', subtitulo = '', status = '', progreso = 0) {
        if (!this.loadingModal) return;
        if (this.loadingModalTitle) this.loadingModalTitle.textContent = titulo;
        if (this.loadingModalSubtitle) this.loadingModalSubtitle.textContent = subtitulo;
        if (this.loadingModalStatus) this.loadingModalStatus.textContent = status;
        if (this.loadingModalProgress) this.loadingModalProgress.style.width = `${progreso}%`;
        if (this.loadingModalTip) {
            const tips = [
                '💡 Los datos se cargan desde el servidor',
                '📊 Preparando gráficos y KPIs',
                '📈 Analizando datos de asistencia',
                '🔄 Actualizando información en tiempo real'
            ];
            this.loadingModalTip.textContent = tips[Math.floor(Math.random() * tips.length)];
        }
        this.loadingModal.classList.add('show');
    }

    actualizarModalCarga(status, progreso = null) {
        if (this.loadingModalStatus) this.loadingModalStatus.textContent = status;
        if (this.loadingModalProgress && progreso !== null) {
            this.loadingModalProgress.style.width = `${Math.min(progreso, 100)}%`;
        }
    }

    ocultarModalCarga() {
        if (this.loadingModal) this.loadingModal.classList.remove('show');
    }

    // ==========================================
    // MODAL DE BLOQUEO
    // ==========================================
    mostrarModalBloqueo(mensaje) {
        if (!this.blockingModal) return;
        if (this.blockingSubtitle) this.blockingSubtitle.textContent = mensaje;

        const btnRecargar = document.getElementById('btnRecargarPagina');
        const btnMenu = document.getElementById('btnIrMenu');

        if (btnRecargar) btnRecargar.onclick = () => location.reload();
        if (btnMenu) btnMenu.onclick = () => this.redirigirAlMenu();

        this.blockingModal.classList.add('show');
    }

    // ==========================================
    // MODAL DE CONFIGURACIÓN (Exportar PDF por Usuario)
    // ==========================================
    async _abrirModalConfigUsuario() {
        if (!this.configModal) return;

        // Poblar el select de usuarios
        await this._poblarSelectUsuariosConfig();

        // Resetear el form
        if (this.configUsuario) this.configUsuario.value = 'all';
        if (this.configMomento) this.configMomento.value = 'ingreso';
        if (this.configSemana) this.configSemana.value = '1';
        if (this.configBtnExportar) {
            this.configBtnExportar.disabled = false;
            this.configBtnExportar.innerHTML = '<i class="fas fa-file-pdf"></i> Exportar PDF';
        }

        this.configModal.classList.add('show');
    }

    _cerrarModalConfigUsuario() {
        if (this.configModal) this.configModal.classList.remove('show');
    }

    async _poblarSelectUsuariosConfig() {
        if (!this.configUsuario) return;

        // Limpiar
        this.configUsuario.innerHTML = '<option value="all">✅ Todos los Usuarios</option>';

        try {
            const usuarios = await this.service.getUsuarios();
            if (usuarios.success && Array.isArray(usuarios.data)) {
                usuarios.data.forEach(u => {
                    const opt = document.createElement('option');
                    opt.value = u.IdUsuario;
                    opt.textContent = `${u.Nombres || u.Nombre || ''} ${u.Apellidos || ''}`.trim() || `Usuario ${u.IdUsuario}`;
                    this.configUsuario.appendChild(opt);
                });
            }
        } catch (error) {
            console.error('Error poblando usuarios en config:', error);
        }
    }

    async _procesarExportacionPorUsuario() {
        const usuarioId = this.configUsuario?.value || 'all';
        const momento = this.configMomento?.value || 'ingreso';
        const semana = parseInt(this.configSemana?.value) || 1;

        if (this.configBtnExportar) {
            this.configBtnExportar.disabled = true;
            this.configBtnExportar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
        }

        this._cerrarModalConfigUsuario();

        try {
            if (usuarioId === 'all') {
                await this._exportarPDFPorUsuarioTodos(momento, semana);
            } else {
                await this._exportarPDFPorUsuarioUnico(parseInt(usuarioId), momento, semana);
            }
        } catch (error) {
            console.error('❌ Error exportando por usuario:', error);
            this.ocultarModalCarga();
            this.mostrarMensaje('Error al exportar: ' + error.message, 'error');
        }
    }
    // ==========================================
    // MENSAJES
    // ==========================================
    mostrarMensaje(mensaje, tipo = 'info') {
        if (!this.messageBox) {
            this.messageBox = document.createElement('div');
            this.messageBox.className = 'message-box';
            document.body.appendChild(this.messageBox);
        }

        const iconos = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };

        this.messageBox.innerHTML = `<i class="fas ${iconos[tipo] || iconos.info}"></i> <span>${mensaje}</span>`;
        this.messageBox.className = `message-box show ${tipo}`;

        clearTimeout(this._msgTimeout);
        this._msgTimeout = setTimeout(() => this.messageBox.classList.remove('show'), 4000);
    }

    // ==========================================
    // HELPERS
    // ==========================================
    _getNombreMes(mes) {
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return meses[mes - 1] || mes;
    }

    // ==========================================
    // NAVEGACIÓN
    // ==========================================
    redirigirALogin() {
        window.location.replace(this.config?.ROUTES?.LOGIN || 'index.html');
    }

    redirigirAlMenu() {
        window.location.href = this.config?.ROUTES?.MENU || 'Menu.html';
    }

    redirigirAlPerfil() {
        window.location.href = this.config?.ROUTES?.PERFIL || 'Mi-Perfil.html';
    }

    cerrarSesion() {
        this.mostrarMensaje('Cerrando sesión...', 'success');
        setTimeout(() => {
            sessionStorage.removeItem('usuarioActual');
            sessionStorage.removeItem('userLogged');
            sessionStorage.removeItem('loginTime');
            sessionStorage.removeItem('rolActual');
            sessionStorage.removeItem('authSource');
            this.redirigirALogin();
        }, 700);
    }
}

// ============================================
// EXPOSICIÓN GLOBAL
// ============================================
if (typeof window !== 'undefined') {
    window.DashboardController = DashboardController;
}