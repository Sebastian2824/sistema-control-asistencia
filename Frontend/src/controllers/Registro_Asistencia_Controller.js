// ==============================================
// CONTROLLER: RegistroAsistenciaController (principal)
// Responsabilidad: Orquesta todo el módulo de Registro
//                 de Asistencia. Incluye la lógica de negocio,
//                 cálculos y formateo.
//
// Depende de:
//   - AuthService
//   - RegistroAsistenciaService
//   - GPSController
//   - SelfieController
//   - JustificacionController
// ==============================================

const OPTIMIZACION_REGISTRO = {
    DIAS_LIMITE_FALTAS: 30,
    DIAS_LIMITE_ASIGNACION: 365
};

class RegistroAsistenciaController {

    constructor(authService, registroService, gpsController, selfieController, justificacionController, config) {
        this.auth = authService;
        this.service = registroService;
        this.gps = gpsController;
        this.selfie = selfieController;
        this.justificacion = justificacionController;
        this.config = config || {};

        // ============================================
        // ESTADO DEL USUARIO Y DEL DÍA
        // ============================================
        this.usuarioActual = null;
        this.asignacionHoy = null;
        this.marcacionHoy = null;
        this.tipoHorario = null;
        this.estados = [];
        this.horarios = [];
        this.horariosAlmuerzo = null;

        // Banderas de estado
        this.horarioEsVirtual = false;
        this.asignacionEliminada = false;
        this.marcacionEliminada = false;

        // Horas de almuerzo esperadas (desde la asignación)
        this.horaIngresoAlmuerzoEsperada = null;
        this.horaSalidaAlmuerzoEsperada = null;
        this.tiempoAlmuerzoAsignado = 60;

        // ============================================
        // ESTADO DE CARGA
        // ============================================
        this.cargando = false;
        this.procesando = false;
        this._selfiePendiente = null;

        // ============================================
        // CACHEAR DOM
        // ============================================
        this._cachearDOM();
        this._configurarCallbacksSubControllers();

        // ============================================
        // INICIAR CUANDO EL DOM ESTÉ LISTO
        // ============================================
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    // ============================================
    // CACHEAR DOM
    // ============================================
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

        // Fecha
        this.fechaActualSpan = document.getElementById('fechaActual');

        // Botones de marcación
        this.btnIngreso = document.getElementById('btnIngreso');
        this.btnIngresoAlmuerzo = document.getElementById('btnIngresoAlmuerzo');
        this.btnSalidaAlmuerzo = document.getElementById('btnSalidaAlmuerzo');
        this.btnSalida = document.getElementById('btnSalida');

        // Spans de hora registrada
        this.horaIngresoSpan = document.getElementById('horaIngreso');
        this.horaIngresoAlmuerzoSpan = document.getElementById('horaIngresoAlmuerzo');
        this.horaSalidaAlmuerzoSpan = document.getElementById('horaSalidaAlmuerzo');
        this.horaSalidaSpan = document.getElementById('horaSalida');

        // Info del turno
        this.turnoAsignadoSpan = document.getElementById('turnoAsignado');
        this.tipoHorarioValueSpan = document.getElementById('tipoHorarioValue');
        this.horaIngresoEsperadaSpan = document.getElementById('horaIngresoEsperada');
        this.horaSalidaEsperadaSpan = document.getElementById('horaSalidaEsperada');
        this.estadoMarcacionSpan = document.getElementById('estadoMarcacion');
        this.horaIngresoAlmuerzoEsperadaSpan = document.getElementById('horaIngresoAlmuerzoEsperada');
        this.horaSalidaAlmuerzoEsperadaSpan = document.getElementById('horaSalidaAlmuerzoEsperada');
        this.duracionAlmuerzoSpan = document.getElementById('duracionAlmuerzo');

        // Tabla de registro del día
        this.tablaRegistroBody = document.getElementById('tablaRegistroBody');

        // Modales de carga
        this.modalCarga = document.getElementById('modalCarga');
        this.modalCargaProceso = document.getElementById('modalCargaProceso');
        this.cargaProcesoTitulo = document.getElementById('cargaProcesoTitulo');
        this.cargaProcesoMensaje = document.getElementById('cargaProcesoMensaje');

        // Toast de carga silenciosa
        this.toastCarga = document.getElementById('toastCarga');
        this.toastCargaTexto = document.getElementById('toastCargaTexto');
    }

    // ============================================
    // CALLBACKS DE SUB-CONTROLLERS
    // ============================================
    _configurarCallbacksSubControllers() {
        // GPS: callbacks del modal de bloqueo
        this.gps.setCallbacks({
            onReintentar: () => {
                console.log('🔄 Reintentando verificación de ubicación...');
                this.init();
            },
            onSalir: () => {
                console.log('🚪 Saliendo al menú por bloqueo de ubicación...');
                this.redirigirAlMenu();
            }
        });

        // Selfie: callbacks de error y cancelación
        this.selfie.setCallbacks({
            onError: (msg) => {
                this.mostrarMensaje(msg, 'error');
            },
            onCancel: () => {
                console.log('📸 Selfie cancelada');
            }
        });

        // Justificación: callbacks de error y cancelación
        this.justificacion.setCallbacks({
            onError: (msg) => {
                this.mostrarMensaje(msg, 'error');
            },
            onCancel: () => {
                console.log('📋 Justificación cancelada');
            }
        });
    }

    // ============================================
    // INIT
    // ============================================
    async init() {
        // Verificar autenticación
        if (!this.auth.verificarSesion()) {
            this.redirigirALogin();
            return;
        }

        this.usuarioActual = this.auth.getUsuarioLogueado();
        if (!this.usuarioActual?.IdUsuario) {
            this.redirigirALogin();
            return;
        }

        // Cargar datos del header
        this.cargarDatosUsuario();
        this.configurarEventosHeader();
        this.mostrarFechaActual();

        // Mostrar carga silenciosa
        this._mostrarCargaSilenciosa();

        try {
            const hoy = this.obtenerFechaActual();

            // ============================================
            // 1. CARGAS PARALELAS: estados, horarios, sucursales
            // ============================================
            this._actualizarMensajeToast('Sincronizando datos...');
            const [estadosOk, horariosOk, sucursalesOk] = await Promise.all([
                this.cargarEstados(),
                this.cargarHorarios(),
                this.gps.cargarSucursales()
            ]);

            if (!estadosOk) {
                this._ocultarCargaSilenciosa(false);
                this.mostrarErrorCarga(['No se pudieron cargar los estados']);
                return;
            }

            if (!horariosOk) {
                this._ocultarCargaSilenciosa(false);
                this.mostrarErrorCarga(['No se pudieron cargar los horarios']);
                return;
            }

            if (!sucursalesOk) {
                console.warn('⚠️ No se pudieron cargar las sucursales');
            }

            // ============================================
            // 2. CARGAR ASIGNACIÓN DEL DÍA
            // ============================================
            this._actualizarMensajeToast('Cargando asignación...');
            const asignacionOk = await this.cargarAsignacionHoy();

            if (!asignacionOk) {
                this._ocultarCargaSilenciosa(false);
                this.bloquearTodosLosBotones('Sin asignación');
                return;
            }

            // ============================================
            // 3. CARGAR HORARIO DE ALMUERZO (depende de asignación)
            // ============================================
            this._actualizarMensajeToast('Verificando horario de almuerzo...');
            await this.cargarHorarioAlmuerzo();

            // ============================================
            // 4. VERIFICAR UBICACIÓN (GPS)
            // ============================================
            this._actualizarMensajeToast('Verificando ubicación...');

            const resultadoGPS = await this.gps.verificarUbicacion(this.horarioEsVirtual);
            this.gps.ocultarVerificandoUbicacion();

            if (!resultadoGPS.success) {
                console.warn('📍 Ubicación no válida:', resultadoGPS.motivo);

                // 🟢 CASO VIRTUAL: solo bloquear si el permiso es denegado o no hay soporte GPS
                if (this.horarioEsVirtual) {
                    const motivosQueBloqueanVirtual = ['PERMISO_DENEGADO', 'GPS_NO_SOPORTADO'];

                    if (!motivosQueBloqueanVirtual.includes(resultadoGPS.motivo)) {
                        console.log(`🌐 Horario VIRTUAL - Motivo "${resultadoGPS.motivo}" NO bloquea el init. Continuando...`);
                        // Continuar con la carga normal (marcación + UI)
                    } else {
                        this._ocultarCargaSilenciosa(false);
                        const tipoBloqueo = resultadoGPS.motivo === 'GPS_NO_SOPORTADO'
                            ? 'GPS_NO_SOPORTADO'
                            : 'PERMISO_DENEGADO_VIRTUAL';

                        this.gps.mostrarBloqueoUbicacion(tipoBloqueo, {
                            usuario: this.usuarioActual,
                            tipoHorario: this.tipoHorario,
                            asignacionHoy: this.asignacionHoy,
                            turnoAsignado: this.tipoHorario?.Descripcion,
                            esVirtual: true
                        });
                        return;
                    }
                } else {
                    // 🔴 CASO PRESENCIAL: bloquear normalmente
                    this._ocultarCargaSilenciosa(false);

                    let tipoBloqueo = 'FUERA_DE_AREA';
                    switch (resultadoGPS.motivo) {
                        case 'PERMISO_DENEGADO': tipoBloqueo = 'PERMISO_DENEGADO'; break;
                        case 'GPS_NO_SOPORTADO': tipoBloqueo = 'GPS_NO_SOPORTADO'; break;
                        case 'GPS_NO_REAL': tipoBloqueo = 'GPS_NO_REAL'; break;
                        case 'GPS_PRECISION_BAJA': tipoBloqueo = 'GPS_PRECISION_BAJA'; break;
                        case 'FUERA_DE_AREA':
                        default: tipoBloqueo = 'FUERA_DE_AREA'; break;
                    }

                    this.gps.mostrarBloqueoUbicacion(tipoBloqueo, {
                        usuario: this.usuarioActual,
                        tipoHorario: this.tipoHorario,
                        asignacionHoy: this.asignacionHoy,
                        turnoAsignado: this.tipoHorario?.Descripcion,
                        esVirtual: false
                    });
                    return;
                }
            }

            this.gps.marcarVerificacionExitosa();

            // ============================================
            // 5. CARGAR MARCACIÓN DEL DÍA
            // ============================================
            this._actualizarMensajeToast('Cargando marcación...');
            await this.cargarMarcacionHoy(true);

            // ============================================
            // 6. VERIFICAR FALTAS DE DÍAS ANTERIORES (background)
            // ============================================
            this.verificarFaltasDiasAnteriores().catch(err =>
                console.warn('⚠️ Error verificando faltas:', err)
            );

            // ============================================
            // 7. ACTUALIZAR UI
            // ============================================
            this.actualizarInfoTurno();
            this.actualizarBotones();
            this.renderizarTablaRegistro();

            // ============================================
            // 8. OCULTAR CARGA
            // ============================================
            this._ocultarCargaSilenciosa(true);
            if (this.modalCarga) this.modalCarga.classList.remove('active');

            console.log('✅ Registro de Asistencia inicializado correctamente');

        } catch (error) {
            console.error('❌ Error en init:', error);
            this._ocultarCargaSilenciosa(false);
            this.mostrarErrorCarga(['Error inesperado al cargar los datos']);
            this.bloquearTodosLosBotones('Error de carga');
        }

        this.auth.prevenirNavegacionAtras();
    }

    // ============================================
    // CONFIGURAR EVENTOS DEL HEADER
    // ============================================
    configurarEventosHeader() {
        // Menú de usuario
        if (this.userMenu) {
            this.userMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                this.userMenu.classList.toggle('active');
            });
        }
        document.addEventListener('click', () => {
            if (this.userMenu) this.userMenu.classList.remove('active');
        });

        // Logout
        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.cerrarSesion();
            });
        }

        // Menú
        if (this.menuBtn) {
            this.menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.redirigirAlMenu();
            });
        }

        // Perfil
        if (this.perfilBtn) {
            this.perfilBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.redirigirAlPerfil();
            });
        }

        // Logo
        if (this.logoArea) {
            this.logoArea.addEventListener('click', () => this.redirigirAlMenu());
        }

        // ============================================
        // BOTONES DE MARCAACIÓN
        // ============================================
        if (this.btnIngreso) {
            this.btnIngreso.addEventListener('click', () => this.registrarIngreso());
        }
        if (this.btnIngresoAlmuerzo) {
            this.btnIngresoAlmuerzo.addEventListener('click', () => this.registrarIngresoAlmuerzo());
        }
        if (this.btnSalidaAlmuerzo) {
            this.btnSalidaAlmuerzo.addEventListener('click', () => this.registrarSalidaAlmuerzo());
        }
        if (this.btnSalida) {
            this.btnSalida.addEventListener('click', () => this.registrarSalida());
        }
    }

    // ============================================
    // CARGAR DATOS DEL USUARIO
    // ============================================
    cargarDatosUsuario() {
        const u = this.usuarioActual;
        const nombreCompleto = `${u.nombres || u.Nombres || ''} ${u.apellidos || u.Apellidos || ''}`.trim();

        if (this.userNameDisplay) this.userNameDisplay.textContent = nombreCompleto;
        if (this.dropdownUserName) this.dropdownUserName.textContent = nombreCompleto;
        if (this.dropdownUserEmail) this.dropdownUserEmail.textContent = u.correo || u.Correo || '';

        const rol = u.rol || u.Rol || 'Usuario';
        if (this.userRoleDisplay) this.userRoleDisplay.textContent = rol;
        if (this.dropdownUserRole) this.dropdownUserRole.textContent = rol;
    }

    mostrarFechaActual() {
        if (!this.fechaActualSpan) return;
        const hoy = new Date();
        this.fechaActualSpan.textContent = hoy.toLocaleDateString('es-PE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // ============================================
    // CARGAR ESTADOS
    // ============================================
    async cargarEstados() {
        try {
            const r = await this.service.obtenerEstados();
            if (r.success) {
                this.estados = (r.data || []).map(e => ({
                    IdEstado: e.IdEstado,
                    Descripcion: (e.Descripcion || '').trim().toUpperCase()
                }));
                console.log(`✅ Estados cargados: ${this.estados.length}`);
                return true;
            }
            console.error('❌ Error cargando estados:', r.error);
            return false;
        } catch (error) {
            console.error('❌ Error cargando estados:', error);
            return false;
        }
    }

    // ============================================
    // CARGAR HORARIOS
    // ============================================
    async cargarHorarios() {
        try {
            const r = await this.service.obtenerHorarios();
            if (r.success) {
                this.horarios = r.data || [];
                console.log(`✅ Horarios cargados: ${this.horarios.length}`);
                return true;
            }
            console.error('❌ Error cargando horarios:', r.error);
            return false;
        } catch (error) {
            console.error('❌ Error cargando horarios:', error);
            return false;
        }
    }

    // ============================================
    // CARGAR ASIGNACIÓN DEL DÍA
    // ============================================
    async cargarAsignacionHoy() {
        try {
            const hoy = this.obtenerFechaActual();
            console.log('🔍 Buscando asignación para:', hoy);

            const r = await this.service.obtenerAsignacion(this.usuarioActual.IdUsuario, hoy);

            if (!r.success || !r.data) {
                console.warn('❌ Sin asignación para hoy:', r.error);
                this.asignacionHoy = null;
                this.asignacionEliminada = true;

                this.bloquearTodosLosBotones('Sin asignación para hoy');
                this.mostrarErrorCarga([
                    `No tiene asignación de horario para hoy (${this.formatearFecha(hoy)}) o su asignación fue eliminada`,
                    'Comuníquese con los administradores para asignar su horario correspondiente'
                ]);
                return false;
            }

            this.asignacionHoy = r.data;
            console.log('✅ Asignación cargada:', this.asignacionHoy);

            // Verificar si está eliminada
            if (this.asignacionHoy.IdEstado === 2) {
                console.warn('⚠️ Asignación ELIMINADA');
                this.asignacionEliminada = true;
                this.bloquearTodosLosBotones('Asignación eliminada');
                this.mostrarErrorCarga([
                    'Su asignación de horario ha sido eliminada',
                    'Comuníquese con el administrador para reactivarla'
                ]);
                return false;
            }

            // Cargar tipo de horario
            await this.cargarTipoHorario(this.asignacionHoy.IdHorario);

            // Detectar si es virtual
            this.horarioEsVirtual = this.esHorarioVirtual();
            console.log(`📌 Tipo de horario: ${this.horarioEsVirtual ? 'VIRTUAL' : 'PRESENCIAL'}`);

            // Guardar horas de almuerzo
            this.horaIngresoAlmuerzoEsperada = this.asignacionHoy.IngAlmuerzoEsperado || null;
            this.horaSalidaAlmuerzoEsperada = this.asignacionHoy.SalAlmuerzoEsperado || null;

            console.log(`📌 Hora INGRESO ALMUERZO: ${this.horaIngresoAlmuerzoEsperada || 'No definida'}`);
            console.log(`📌 Hora SALIDA ALMUERZO: ${this.horaSalidaAlmuerzoEsperada || 'No definida'}`);

            this.asignacionEliminada = false;
            return true;

        } catch (error) {
            console.error('❌ Error al cargar asignación:', error);
            this.asignacionEliminada = true;
            return false;
        }
    }

    // ============================================
    // CARGAR TIPO DE HORARIO
    // ============================================
    async cargarTipoHorario(idHorario) {
        try {
            // Primero buscar en caché local
            let tipo = this.horarios.find(h => h.IdHorario === idHorario);

            if (!tipo) {
                // Si no está en caché, pedirlo al backend
                const r = await this.service.obtenerHorarioPorId(idHorario);
                if (!r.success || !r.data) {
                    console.warn(`⚠️ No se encontró el horario ${idHorario}`);
                    this.tipoHorario = null;
                    return;
                }
                tipo = r.data;
            }

            this.tipoHorario = tipo;
            console.log('✅ Tipo de horario cargado:', this.tipoHorario);

        } catch (error) {
            console.error('❌ Error al cargar tipo de horario:', error);
            this.tipoHorario = null;
        }
    }

    // ============================================
    // DETECTAR SI EL HORARIO ES VIRTUAL
    // Prioriza el campo TipoHorario (PRESENCIAL | VIRTUAL).
    // Fallback a la descripción por compatibilidad con datos legacy.
    // ============================================
    esHorarioVirtual() {
        if (!this.tipoHorario) return false;

        // ============================================
        // 1. PRIORIDAD: campo TipoHorario (nueva BD)
        // ============================================
        const tipoHorario = String(this.tipoHorario.TipoHorario || '').trim().toUpperCase();
        if (tipoHorario === 'VIRTUAL') {
            console.log('🌐 Horario detectado como VIRTUAL (campo TipoHorario)');
            return true;
        }
        if (tipoHorario === 'PRESENCIAL') {
            console.log('🏢 Horario detectado como PRESENCIAL (campo TipoHorario)');
            return false;
        }

        // ============================================
        // 2. FALLBACK: revisar la descripción
        // (por si TipoHorario viene vacío en datos legacy)
        // ============================================
        const descripcion = String(this.tipoHorario.Descripcion || '').toLowerCase();
        const esVirtualPorDescripcion =
            descripcion.includes('- virtual') ||
            descripcion.includes('virtual');

        if (esVirtualPorDescripcion) {
            console.log('🌐 Horario detectado como VIRTUAL (por descripción, fallback)');
        }

        return esVirtualPorDescripcion;
    }

    // ============================================
    // CARGAR HORARIO DE ALMUERZO
    // ============================================
    async cargarHorarioAlmuerzo() {
        try {
            // El horario de almuerzo ya viene implícito en las horas de la asignación
            // (IngAlmuerzoEsperado, SalAlmuerzoEsperado). Solo calculamos duración.
            if (this.horaIngresoAlmuerzoEsperada && this.horaSalidaAlmuerzoEsperada) {
                const duracion = this._calcularDiferenciaMinutos(
                    this.horaIngresoAlmuerzoEsperada,
                    this.horaSalidaAlmuerzoEsperada
                );
                this.tiempoAlmuerzoAsignado = duracion > 0 ? duracion : 60;
                console.log(`✅ Horario de almuerzo definido: ${this.tiempoAlmuerzoAsignado}min`);
            } else {
                this.tiempoAlmuerzoAsignado = 60;
                console.log('ℹ️ Sin horario de almuerzo definido, usando 60min por defecto');
            }
        } catch (error) {
            console.error('❌ Error al cargar horario de almuerzo:', error);
            this.tiempoAlmuerzoAsignado = 60;
        }
    }

    // ============================================
    // CARGAR MARCACIÓN DEL DÍA
    // ============================================
    async cargarMarcacionHoy(forzarRecarga = false) {
        try {
            const hoy = this.obtenerFechaActual();
            console.log(`🔍 Cargando marcación de hoy: ${hoy}`);

            const r = await this.service.obtenerMarcacion(this.usuarioActual.IdUsuario, hoy);

            if (r.success && r.data) {
                this.marcacionHoy = r.data;
                this._normalizarMarcacion(this.marcacionHoy);
                console.log('✅ Marcación de hoy:', this.marcacionHoy);

                if (this.marcacionHoy.IdEstado === 2) {
                    this.marcacionEliminada = true;
                    this.mostrarMensaje('Su marcación de hoy ha sido eliminada', 'error');
                } else {
                    this.marcacionEliminada = false;
                }
            } else {
                this.marcacionHoy = null;
                this.marcacionEliminada = false;
                console.log('📭 No hay marcación registrada para hoy');
            }

            this.actualizarBotones();
            this.renderizarTablaRegistro();

        } catch (error) {
            console.error('❌ Error al cargar marcación:', error);
            this.marcacionHoy = null;
        }
    }

    _normalizarMarcacion(marcacion) {
        if (!marcacion) return;

        // Formatear horas
        if (marcacion.IngMarcado) marcacion.IngresoReal = this._formatearHoraMostrar(marcacion.IngMarcado);
        if (marcacion.SalMarcada) marcacion.SalidaReal = this._formatearHoraMostrar(marcacion.SalMarcada);
        if (marcacion.IngAlmuerzoMarcado) marcacion.IngAlmuerzo = this._formatearHoraMostrar(marcacion.IngAlmuerzoMarcado);
        if (marcacion.SalAlmuerzoMarcada) marcacion.SalAlmuerzo = this._formatearHoraMostrar(marcacion.SalAlmuerzoMarcada);

        // Observaciones (arrays a string)
        if (Array.isArray(marcacion.ObsGeneral)) {
            marcacion.Observacion = marcacion.ObsGeneral.find(v => v) || '';
        } else {
            marcacion.Observacion = marcacion.ObsGeneral || '';
        }
        if (Array.isArray(marcacion.ObsIngresoAlmuerzo)) {
            marcacion.ObsIngresoAlmuerzo = marcacion.ObsIngresoAlmuerzo.find(v => v) || '';
        }
        if (Array.isArray(marcacion.ObsSalidaAlmuerzo)) {
            marcacion.ObsSalidaAlmuerzo = marcacion.ObsSalidaAlmuerzo.find(v => v) || '';
        }
    }

    // ============================================
    // ACTUALIZAR INFO DEL TURNO
    // ============================================
    actualizarInfoTurno() {
        if (!this.tipoHorario) {
            if (this.turnoAsignadoSpan) this.turnoAsignadoSpan.textContent = 'No encontrado';
            if (this.tipoHorarioValueSpan) {
                this.tipoHorarioValueSpan.textContent = '--';
                this.tipoHorarioValueSpan.className = 'value';
            }
            if (this.horaIngresoEsperadaSpan) this.horaIngresoEsperadaSpan.textContent = '--:--';
            if (this.horaSalidaEsperadaSpan) this.horaSalidaEsperadaSpan.textContent = '--:--';
            if (this.horaIngresoAlmuerzoEsperadaSpan) this.horaIngresoAlmuerzoEsperadaSpan.textContent = '--:--';
            if (this.horaSalidaAlmuerzoEsperadaSpan) this.horaSalidaAlmuerzoEsperadaSpan.textContent = '--:--';
            if (this.duracionAlmuerzoSpan) this.duracionAlmuerzoSpan.textContent = '-- min';
            return;
        }

        // Nombre del turno
        if (this.turnoAsignadoSpan) {
            this.turnoAsignadoSpan.textContent = this.tipoHorario.Descripcion || 'N/A';
        }

        // ============================================
        // TIPO DE HORARIO (PRESENCIAL / VIRTUAL)
        // ============================================
        if (this.tipoHorarioValueSpan) {
            const tipoRaw = String(this.tipoHorario.TipoHorario || '').trim().toUpperCase();

            if (tipoRaw === 'VIRTUAL') {
                this.tipoHorarioValueSpan.textContent = 'VIRTUAL';
                this.tipoHorarioValueSpan.className = 'value activo'; // Verde
            } else if (tipoRaw === 'PRESENCIAL') {
                this.tipoHorarioValueSpan.textContent = 'PRESENCIAL';
                this.tipoHorarioValueSpan.className = 'value normal'; // Color normal
            } else {
                // Fallback: intentar detectar por descripción
                const desc = String(this.tipoHorario.Descripcion || '').toLowerCase();
                if (desc.includes('virtual')) {
                    this.tipoHorarioValueSpan.textContent = 'VIRTUAL';
                    this.tipoHorarioValueSpan.className = 'value activo';
                } else {
                    this.tipoHorarioValueSpan.textContent = tipoRaw || '--';
                    this.tipoHorarioValueSpan.className = 'value';
                }
            }
        }

        // Horas esperadas (priorizar asignación)
        const ingreso = this.asignacionHoy?.IngEsperado
            ? this._formatearHoraMostrar(this.asignacionHoy.IngEsperado)
            : this._formatearHoraMostrar(this.tipoHorario.HoraIngreso);
        const salida = this.asignacionHoy?.SalEsperada
            ? this._formatearHoraMostrar(this.asignacionHoy.SalEsperada)
            : this._formatearHoraMostrar(this.tipoHorario.HoraSalida);

        if (this.horaIngresoEsperadaSpan) this.horaIngresoEsperadaSpan.textContent = ingreso || '--:--';
        if (this.horaSalidaEsperadaSpan) this.horaSalidaEsperadaSpan.textContent = salida || '--:--';

        // Almuerzo
        const ingAlm = this.asignacionHoy?.IngAlmuerzoEsperado
            ? this._formatearHoraMostrar(this.asignacionHoy.IngAlmuerzoEsperado)
            : '--:--';
        const salAlm = this.asignacionHoy?.SalAlmuerzoEsperado
            ? this._formatearHoraMostrar(this.asignacionHoy.SalAlmuerzoEsperado)
            : '--:--';

        if (this.horaIngresoAlmuerzoEsperadaSpan) this.horaIngresoAlmuerzoEsperadaSpan.textContent = ingAlm;
        if (this.horaSalidaAlmuerzoEsperadaSpan) this.horaSalidaAlmuerzoEsperadaSpan.textContent = salAlm;

        // Duración
        let duracion = '-- min';
        if (ingAlm !== '--:--' && salAlm !== '--:--') {
            const min = this._calcularDiferenciaMinutos(ingAlm, salAlm);
            if (min > 0) duracion = `${min} min`;
        } else {
            duracion = '60 min (predeterminado)';
        }
        if (this.duracionAlmuerzoSpan) this.duracionAlmuerzoSpan.textContent = duracion;
    }

    // ============================================
    // ACTUALIZAR BOTONES
    // ============================================
    actualizarBotones() {
        console.log('🔄 Actualizando botones...');

        // Estado bloqueado
        if (this.asignacionEliminada || this.marcacionEliminada) {
            this.bloquearTodosLosBotones('Datos bloqueados');
            return;
        }

        if (!this.asignacionHoy || !this.tipoHorario) {
            this.bloquearTodosLosBotones('Sin asignación');
            return;
        }

        // Desbloquear
        [this.btnIngreso, this.btnIngresoAlmuerzo, this.btnSalidaAlmuerzo, this.btnSalida].forEach(btn => {
            if (btn) {
                btn.classList.remove('disabled');
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                btn.style.pointerEvents = 'auto';
            }
        });

        // Actualizar cada botón
        this._actualizarHoraBoton(this.btnIngreso, this.horaIngresoSpan, this.marcacionHoy?.IngresoReal, 'Ingreso');
        this._actualizarHoraBoton(this.btnIngresoAlmuerzo, this.horaIngresoAlmuerzoSpan, this.marcacionHoy?.IngAlmuerzo, 'Ing. Almuerzo');
        this._actualizarHoraBoton(this.btnSalidaAlmuerzo, this.horaSalidaAlmuerzoSpan, this.marcacionHoy?.SalAlmuerzo, 'Sal. Almuerzo');
        this._actualizarHoraBoton(this.btnSalida, this.horaSalidaSpan, this.marcacionHoy?.SalidaReal, 'Salida');

        // Estado general
        if (this.estadoMarcacionSpan) {
            if (this.marcacionHoy?.IdEstadoIng) {
                const estado = this.estados.find(e => e.IdEstado === this.marcacionHoy.IdEstadoIng);
                this.estadoMarcacionSpan.textContent = estado?.Descripcion || 'PENDIENTE';
            } else {
                this.estadoMarcacionSpan.textContent = 'PENDIENTE';
            }
        }
    }

    _actualizarHoraBoton(btn, span, hora, label) {
        if (!btn || !span) return;

        const jornadaFinalizada = !!this.marcacionHoy?.SalidaReal;

        if (hora) {
            // Ya registrado - verde
            span.textContent = hora;
            span.style.display = 'block';
            span.style.color = '#28a745';
            span.style.fontWeight = '700';
            span.style.fontSize = '18px';
            span.style.marginTop = '10px';
            span.style.padding = '5px 10px';
            span.style.background = 'rgba(40, 167, 69, 0.1)';
            span.style.borderRadius = '8px';

            btn.classList.add('completed');
            btn.style.opacity = '0.6';
            btn.style.cursor = 'not-allowed';
            btn.style.pointerEvents = 'none';
        } else if (jornadaFinalizada) {
            // No registrado y jornada cerrada - gris
            span.textContent = '—';
            span.style.display = 'block';
            span.style.color = '#5b5f63';
            span.style.fontWeight = '700';
            span.style.fontSize = '18px';
            span.style.marginTop = '10px';
            span.style.padding = '5px 10px';
            span.style.background = 'rgba(108, 117, 125, 0.15)';
            span.style.borderRadius = '8px';

            btn.classList.remove('completed');
            btn.classList.add('disabled');
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.style.pointerEvents = 'none';
        } else {
            // Disponible
            span.textContent = '';
            span.style.display = 'none';

            btn.classList.remove('completed', 'disabled');
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.style.pointerEvents = 'auto';
        }
    }

    bloquearTodosLosBotones(mensaje) {
        [this.btnIngreso, this.btnIngresoAlmuerzo, this.btnSalidaAlmuerzo, this.btnSalida].forEach(btn => {
            if (btn) {
                btn.classList.add('disabled');
                btn.style.opacity = '0.4';
                btn.style.cursor = 'not-allowed';
                btn.style.pointerEvents = 'none';
                btn.title = mensaje || 'No disponible';
            }
        });
        if (this.turnoAsignadoSpan) this.turnoAsignadoSpan.textContent = '⚠️ BLOQUEADO';
        if (this.estadoMarcacionSpan) this.estadoMarcacionSpan.textContent = 'BLOQUEADO';
    }

    // ============================================
    // RENDERIZAR TABLA DE REGISTRO DEL DÍA
    // ============================================
    renderizarTablaRegistro() {
        if (!this.tablaRegistroBody) return;

        const eventos = [];
        const m = this.marcacionHoy;

        if (m) {
            if (m.IngresoReal) {
                eventos.push({
                    evento: 'Ingreso Real',
                    hora: m.IngresoReal,
                    estado: this._obtenerDescripcionEstado(m.IdEstadoIng),
                    observacion: m.Observacion || '--'
                });
            }
            if (m.IngAlmuerzo) {
                eventos.push({
                    evento: 'Ingreso Almuerzo',
                    hora: m.IngAlmuerzo,
                    estado: this._obtenerDescripcionEstado(m.IdEstadoAlmuerzoIng),
                    observacion: m.ObsIngresoAlmuerzo || '--'
                });
            }
            if (m.SalAlmuerzo) {
                eventos.push({
                    evento: 'Salida Almuerzo',
                    hora: m.SalAlmuerzo,
                    estado: this._obtenerDescripcionEstado(m.IdEstadoAlmuerzoSal),
                    observacion: m.ObsSalidaAlmuerzo || '--'
                });
            }
            if (m.SalidaReal) {
                eventos.push({
                    evento: 'Salida Real',
                    hora: m.SalidaReal,
                    estado: '--',
                    observacion: '--'
                });
            }
        }

        if (eventos.length === 0) {
            this.tablaRegistroBody.innerHTML = '<tr><td colspan="4" class="loading">Aún no hay registros hoy</td></tr>';
            return;
        }

        this.tablaRegistroBody.innerHTML = '';
        eventos.forEach(ev => {
            const row = document.createElement('tr');
            let badgeClass = 'badge-info';
            if (ev.estado === 'A TIEMPO') badgeClass = 'badge-success';
            else if (ev.estado === 'TARDANZA') badgeClass = 'badge-warning';
            else if (ev.estado === 'EXCESO') badgeClass = 'badge-danger';

            row.innerHTML = `
                <td>${ev.evento}</td>
                <td>${ev.hora}</td>
                <td><span class="${badgeClass}">${ev.estado}</span></td>
                <td style="font-size:12px;max-width:200px;word-wrap:break-word;">${ev.observacion}</td>
            `;
            this.tablaRegistroBody.appendChild(row);
        });
    }

    _obtenerDescripcionEstado(idEstado) {
        if (!idEstado) return '--';
        const e = this.estados.find(e => e.IdEstado === idEstado);
        return e ? e.Descripcion : '--';
    }

    // ============================================
    // REGISTRAR INGRESO
    // ============================================
    async registrarIngreso() {
        if (!this._puedeMarcar('ingreso')) return;

        // Verificar ubicación (solo si presencial)
        if (!this.horarioEsVirtual) {
            const ok = await this._verificarUbicacionAntesDeMarcar();
            if (!ok) return;
        }

        // Obtener coordenadas (para evidencia)
        const coordenadas = await this._obtenerCoordenadasActuales();

        // Capturar selfie
        let selfieData = null;
        try {
            this.mostrarMensaje('Abriendo cámara...', 'info');
            selfieData = await this.selfie.abrirModalSelfie('ingreso');
        } catch (error) {
            console.warn('Selfie cancelada o fallida:', error.message);
            return;
        }

        this._selfiePendiente = {
            data: selfieData,
            campo: 'Evidencia_Ingreso',
            coordenadas
        };

        this.mostrarModalCargaProceso('Registrando Ingreso', 'Espere un momento...');

        try {
            const ahora = new Date();
            const horaActual = this.formatearHoraActual(ahora);
            const horaConSegundos = this.formatearHoraConSegundos(ahora);

            // Comparar con hora esperada
            const horaEsperada = this._formatearHoraMostrar(this.asignacionHoy?.IngEsperado)
                || this._formatearHoraMostrar(this.tipoHorario?.HoraIngreso);

            let idEstado = this._obtenerIdEstadoPorDescripcion('A TIEMPO');
            let necesitaJustificacion = false;

            if (horaEsperada && this.compararHoras(horaActual, horaEsperada) > 0) {
                idEstado = this._obtenerIdEstadoPorDescripcion('TARDANZA');
                necesitaJustificacion = true;
                console.log(`⚠️ Tardanza: ${horaActual} > ${horaEsperada}`);
            }

            // Si hay tardanza, abrir modal de justificación
            let observacion = null;
            let evidenciaJustif = null;

            if (necesitaJustificacion) {
                this.ocultarModalCargaProceso();

                try {
                    const resultado = await this.justificacion.abrirModalJustificacion('ingreso', horaEsperada, horaActual);

                    if (resultado.accion === 'guardar') {
                        observacion = `TARDANZA JUSTIFICADA: ${resultado.observacion}`;
                        evidenciaJustif = resultado.evidencia;
                    } else {
                        observacion = 'TARDANZA NO JUSTIFICADA';
                    }
                } catch (error) {
                    console.log('📋 Justificación cancelada');
                    this.mostrarMensaje('Registro cancelado', 'info');
                    this._selfiePendiente = null;
                    return;
                }

                this.mostrarModalCargaProceso('Registrando Ingreso', 'Guardando...');
            }

            // Crear marcación
            const datosMarcacion = {
                IdUsuario: this.usuarioActual.IdUsuario,
                IdAsignacion: this.asignacionHoy.IdAsignacion,
                Fecha: this.obtenerFechaActual(),
                IngMarcado: horaConSegundos,
                IdEstadoIng: idEstado,
                ObsGeneral: observacion,
                IdUsuarioCreacion: this.usuarioActual.IdUsuario
            };

            const result = await this.service.crearMarcacion(datosMarcacion);

            if (!result.success) {
                this.ocultarModalCargaProceso();
                this.mostrarMensaje(`${result.error || 'Error al registrar'}`, 'error');
                return;
            }

            const idMarcacion = result.id;
            console.log(`✅ Marcación creada con ID: ${idMarcacion}`);

            // Subir selfie
            if (idMarcacion && this._selfiePendiente) {
                await this._subirEvidenciaSelfie(idMarcacion, this._selfiePendiente);
                this._selfiePendiente = null;
            }

            // Subir evidencia de justificación
            if (idMarcacion && evidenciaJustif) {
                await this._subirEvidenciaJustificacion(idMarcacion, evidenciaJustif, 'ingreso');
            }

            this.ocultarModalCargaProceso();
            this.mostrarMensaje('Ingreso registrado correctamente', 'success');

            await this.cargarMarcacionHoy(true);

        } catch (error) {
            console.error('❌ Error en registrarIngreso:', error);
            this.ocultarModalCargaProceso();
            this.mostrarMensaje('Error al procesar el registro', 'error');
        }
    }

    // ============================================
    // REGISTRAR INGRESO ALMUERZO
    // ============================================
    async registrarIngresoAlmuerzo() {
        if (!this._puedeMarcar('ingreso_almuerzo')) return;

        // Capturar selfie
        let selfieData = null;
        try {
            this.mostrarMensaje('Abriendo cámara...', 'info');
            selfieData = await this.selfie.abrirModalSelfie('ingreso_almuerzo');
        } catch (error) {
            console.warn('Selfie cancelada:', error.message);
            return;
        }

        this.mostrarModalCargaProceso('Registrando Ingreso de Almuerzo', 'Espere un momento...');

        try {
            const ahora = new Date();
            const horaActual = this.formatearHoraActual(ahora);
            const horaConSegundos = this.formatearHoraConSegundos(ahora);

            // Verificar si tiene horario de almuerzo definido
            const tieneHorarioAlmuerzo = this._tieneHorarioAlmuerzoDefinido();
            let idEstadoAlmuerzoIng = this._obtenerIdEstadoPorDescripcion('A TIEMPO');
            let necesitaJustificacion = false;
            let horaEsperada = null;

            if (tieneHorarioAlmuerzo && this.horaIngresoAlmuerzoEsperada) {
                horaEsperada = this._formatearHoraMostrar(this.horaIngresoAlmuerzoEsperada);
                if (this.compararHoras(horaActual, horaEsperada) > 0) {
                    idEstadoAlmuerzoIng = this._obtenerIdEstadoPorDescripcion('TARDANZA');
                    necesitaJustificacion = true;
                }
            }

            let observacion = null;
            let evidenciaJustif = null;

            if (necesitaJustificacion) {
                this.ocultarModalCargaProceso();
                try {
                    const resultado = await this.justificacion.abrirModalJustificacion('ingreso_almuerzo', horaEsperada, horaActual);

                    if (resultado.accion === 'guardar') {
                        observacion = `TARDANZA JUSTIFICADA: ${resultado.observacion}`;
                        evidenciaJustif = resultado.evidencia;
                    } else {
                        observacion = 'TARDANZA NO JUSTIFICADA';
                    }
                } catch (error) {
                    this.mostrarMensaje('Registro cancelado', 'info');
                    return;
                }
                this.mostrarModalCargaProceso('Registrando Ingreso de Almuerzo', 'Guardando...');
            }

            const datos = {
                IdUsuario: this.usuarioActual.IdUsuario,
                IdAsignacion: this.asignacionHoy.IdAsignacion,
                Fecha: this.obtenerFechaActual(),
                IngAlmuerzoMarcado: horaConSegundos,
                IdEstadoAlmuerzoIng: idEstadoAlmuerzoIng,
                ObsIngresoAlmuerzo: observacion,
                IdUsuarioModificacion: this.usuarioActual.IdUsuario
            };

            const result = await this.service.actualizarMarcacion(this.marcacionHoy.IdMarcacion, datos);

            if (!result.success) {
                this.ocultarModalCargaProceso();
                this.mostrarMensaje(`${result.error || 'Error al registrar'}`, 'error');
                return;
            }

            // Subir selfie
            if (selfieData) {
                await this._subirEvidenciaSelfie(this.marcacionHoy.IdMarcacion, {
                    data: selfieData,
                    campo: 'Evidencia_IngAlmuerzo'
                });
            }

            // Subir evidencia justificación
            if (evidenciaJustif) {
                await this._subirEvidenciaJustificacion(this.marcacionHoy.IdMarcacion, evidenciaJustif, 'ingreso_almuerzo');
            }

            this.ocultarModalCargaProceso();
            this.mostrarMensaje('Ingreso de almuerzo registrado', 'success');

            await this.cargarMarcacionHoy(true);

        } catch (error) {
            console.error('❌ Error en registrarIngresoAlmuerzo:', error);
            this.ocultarModalCargaProceso();
            this.mostrarMensaje('Error al procesar', 'error');
        }
    }

    // ============================================
    // REGISTRAR SALIDA ALMUERZO
    // ============================================
    async registrarSalidaAlmuerzo() {
        if (!this._puedeMarcar('salida_almuerzo')) return;

        // Verificar ubicación (si presencial)
        if (!this.horarioEsVirtual) {
            const ok = await this._verificarUbicacionAntesDeMarcar();
            if (!ok) return;
        }

        // Capturar selfie
        let selfieData = null;
        try {
            this.mostrarMensaje('Abriendo cámara...', 'info');
            selfieData = await this.selfie.abrirModalSelfie('salida_almuerzo');
        } catch (error) {
            console.warn('Selfie cancelada:', error.message);
            return;
        }

        this.mostrarModalCargaProceso('Registrando Salida de Almuerzo', 'Espere un momento...');

        try {
            const ahora = new Date();
            const horaActual = this.formatearHoraActual(ahora);
            const horaConSegundos = this.formatearHoraConSegundos(ahora);

            let idEstadoAlmuerzoSal = this._obtenerIdEstadoPorDescripcion('A TIEMPO');
            let necesitaJustificacion = false;
            let horaEsperada = null;

            // Verificar hora de salida esperada
            const tieneHoraSalida = this.horaSalidaAlmuerzoEsperada && this.horaSalidaAlmuerzoEsperada !== '';

            if (tieneHoraSalida) {
                horaEsperada = this._formatearHoraMostrar(this.horaSalidaAlmuerzoEsperada);
                if (this.compararHoras(horaActual, horaEsperada) > 0) {
                    idEstadoAlmuerzoSal = this._obtenerIdEstadoPorDescripcion('EXCESO');
                    necesitaJustificacion = true;
                }
            } else if (this.marcacionHoy?.IngAlmuerzo) {
                // Sin hora fija: comparar duración
                const duracion = this.calcularDiferenciaMinutos(this.marcacionHoy.IngAlmuerzo, horaActual);
                if (duracion > this.tiempoAlmuerzoAsignado) {
                    idEstadoAlmuerzoSal = this._obtenerIdEstadoPorDescripcion('EXCESO');
                    necesitaJustificacion = true;
                    horaEsperada = this._calcularHoraEsperada(this.marcacionHoy.IngAlmuerzo, this.tiempoAlmuerzoAsignado);
                }
            }

            let observacion = null;
            let evidenciaJustif = null;

            if (necesitaJustificacion) {
                this.ocultarModalCargaProceso();
                try {
                    const resultado = await this.justificacion.abrirModalJustificacion('salida_almuerzo', horaEsperada, horaActual);

                    if (resultado.accion === 'guardar') {
                        observacion = `EXCESO JUSTIFICADO: ${resultado.observacion}`;
                        evidenciaJustif = resultado.evidencia;
                    } else {
                        observacion = 'EXCESO NO JUSTIFICADO';
                    }
                } catch (error) {
                    this.mostrarMensaje('Registro cancelado', 'info');
                    return;
                }
                this.mostrarModalCargaProceso('Registrando Salida de Almuerzo', 'Guardando...');
            }

            const datos = {
                IdUsuario: this.usuarioActual.IdUsuario,
                IdAsignacion: this.asignacionHoy.IdAsignacion,
                Fecha: this.obtenerFechaActual(),
                SalAlmuerzoMarcada: horaConSegundos,
                IdEstadoAlmuerzoSal: idEstadoAlmuerzoSal,
                ObsSalidaAlmuerzo: observacion,
                IdUsuarioModificacion: this.usuarioActual.IdUsuario
            };

            const result = await this.service.actualizarMarcacion(this.marcacionHoy.IdMarcacion, datos);

            if (!result.success) {
                this.ocultarModalCargaProceso();
                this.mostrarMensaje(`${result.error}`, 'error');
                return;
            }

            // Subir selfie
            if (selfieData) {
                await this._subirEvidenciaSelfie(this.marcacionHoy.IdMarcacion, {
                    data: selfieData,
                    campo: 'Evidencia_SalAlmuerzo'
                });
            }

            // Evidencia justificación
            if (evidenciaJustif) {
                await this._subirEvidenciaJustificacion(this.marcacionHoy.IdMarcacion, evidenciaJustif, 'salida_almuerzo');
            }

            this.ocultarModalCargaProceso();
            this.mostrarMensaje('Salida de almuerzo registrada', 'success');

            await this.cargarMarcacionHoy(true);

        } catch (error) {
            console.error('❌ Error:', error);
            this.ocultarModalCargaProceso();
            this.mostrarMensaje('Error al procesar', 'error');
        }
    }

    // ============================================
    // REGISTRAR SALIDA
    // ============================================
    async registrarSalida() {
        if (!this._puedeMarcar('salida')) return;

        if (!this.horarioEsVirtual) {
            const ok = await this._verificarUbicacionAntesDeMarcar();
            if (!ok) return;
        }

        const coordenadas = await this._obtenerCoordenadasActuales();

        let selfieData = null;
        try {
            this.mostrarMensaje('Abriendo cámara...', 'info');
            selfieData = await this.selfie.abrirModalSelfie('salida');
        } catch (error) {
            console.warn('Selfie cancelada:', error.message);
            return;
        }

        this.mostrarModalCargaProceso('Registrando Salida', 'Espere un momento...');

        try {
            const ahora = new Date();
            const horaActual = this.formatearHoraActual(ahora);
            const horaConSegundos = this.formatearHoraConSegundos(ahora);

            const datos = {
                IdUsuario: this.usuarioActual.IdUsuario,
                IdAsignacion: this.asignacionHoy.IdAsignacion,
                Fecha: this.obtenerFechaActual(),
                SalMarcada: horaConSegundos,
                IdUsuarioModificacion: this.usuarioActual.IdUsuario
            };

            const result = await this.service.actualizarMarcacion(this.marcacionHoy.IdMarcacion, datos);

            if (!result.success) {
                this.ocultarModalCargaProceso();
                this.mostrarMensaje(`${result.error}`, 'error');
                return;
            }

            if (selfieData) {
                await this._subirEvidenciaSelfie(this.marcacionHoy.IdMarcacion, {
                    data: selfieData,
                    campo: 'Evidencia_Salida',
                    coordenadas
                });
            }

            this.ocultarModalCargaProceso();
            this.mostrarMensaje('Salida registrada correctamente', 'success');

            await this.cargarMarcacionHoy(true);

        } catch (error) {
            console.error('❌ Error:', error);
            this.ocultarModalCargaProceso();
            this.mostrarMensaje('Error al procesar', 'error');
        }
    }

    // ============================================
    // VALIDACIONES DE NEGOCIO
    // ============================================
    _puedeMarcar(tipo) {
        if (this.asignacionEliminada) {
            this.mostrarMensaje('Su asignación está eliminada', 'error');
            return false;
        }
        if (this.marcacionEliminada) {
            this.mostrarMensaje('Su marcación está eliminada', 'error');
            return false;
        }
        if (!this.asignacionHoy || !this.tipoHorario) {
            this.mostrarMensaje('Sin asignación de horario', 'warning');
            return false;
        }

        const m = this.marcacionHoy;
        switch (tipo) {
            case 'ingreso':
                if (m?.IngresoReal) {
                    this.mostrarMensaje('Ya registró su ingreso', 'warning');
                    return false;
                }
                return true;

            case 'ingreso_almuerzo':
                if (!m?.IngresoReal) {
                    this.mostrarMensaje('Debe registrar primero su ingreso', 'warning');
                    return false;
                }
                if (m?.IngAlmuerzo) {
                    this.mostrarMensaje('Ya registró su ingreso de almuerzo', 'warning');
                    return false;
                }
                return true;

            case 'salida_almuerzo':
                if (!m?.IngAlmuerzo) {
                    this.mostrarMensaje('Debe registrar primero su ingreso de almuerzo', 'warning');
                    return false;
                }
                if (m?.SalAlmuerzo) {
                    this.mostrarMensaje('Ya registró su salida de almuerzo', 'warning');
                    return false;
                }
                return true;

            case 'salida':
                if (!m?.IngresoReal) {
                    this.mostrarMensaje('Debe registrar primero su ingreso', 'warning');
                    return false;
                }
                if (m?.SalidaReal) {
                    this.mostrarMensaje('Ya registró su salida', 'warning');
                    return false;
                }

                // ============================================
                // CASO A: marcó ingreso de almuerzo pero no salida
                // → debe completar el ciclo
                // ============================================
                if (m?.IngAlmuerzo && !m?.SalAlmuerzo) {
                    this.mostrarMensaje('Debe registrar su salida de almuerzo antes de marcar su salida final', 'warning');
                    return false;
                }

                // ============================================
                // CASO B: NO marcó ingreso de almuerzo
                // → solo puede salir dentro de los 10 min previos a su hora de salida
                // (aplica SIEMPRE, tenga o no el horario almuerzo configurado)
                // ============================================
                if (!m?.IngAlmuerzo) {
                    const horaSalidaAsignada = this._formatearHoraMostrar(
                        this.asignacionHoy?.SalEsperada
                    ) || this._formatearHoraMostrar(this.tipoHorario?.HoraSalida);

                    console.log('🔍 [Validación salida sin almuerzo]');
                    console.log('   horaSalidaAsignada:', horaSalidaAsignada);
                    console.log('   Hora actual:', this.formatearHoraActual(new Date()));

                    if (!horaSalidaAsignada) {
                        this.mostrarMensaje('No se pudo determinar su hora de salida asignada. Contacte al administrador.', 'error');
                        return false;
                    }

                    const dentroDeVentana = this._estaEnVentanaSalida(horaSalidaAsignada, 10);
                    console.log('   dentroDeVentana:', dentroDeVentana);

                    if (!dentroDeVentana) {
                        const horaVentana = this._calcularHoraVentana(horaSalidaAsignada, 10);
                        this.mostrarMensaje(
                            `Aún no puede marcar su salida. Debe registrar su ingreso y salida de almuerzo, o esperar a las ${horaVentana} (10 min antes de su salida a las ${horaSalidaAsignada}).`,
                            'warning'
                        );
                        return false;
                    }

                    console.log(`✅ Salida sin almuerzo permitida (dentro de ventana de 10 min antes de ${horaSalidaAsignada})`);
                }

                return true;

            default:
                return false;
        }
    }

    // ============================================
    // VERIFICAR SI EL USUARIO ESTÁ EN LA VENTANA DE SALIDA
    // (dentro de los X minutos previos a la hora de salida)
    // ============================================
    _estaEnVentanaSalida(horaSalidaAsignada, ventanaMinutos = 10) {
        if (!horaSalidaAsignada) return false;

        const ahora = new Date();
        const horaActual = this.formatearHoraActual(ahora);

        const [hAsig, mAsig] = horaSalidaAsignada.split(':').map(Number);
        const [hAct, mAct] = horaActual.split(':').map(Number);

        const minutosAsignados = hAsig * 60 + mAsig;
        const minutosActuales = hAct * 60 + mAct;

        // Permitir desde (horaSalida - ventanaMinutos) en adelante
        const inicioVentana = minutosAsignados - ventanaMinutos;

        // Manejar cruce de medianoche (ej: salida a las 00:05, ventana empieza a las 23:55)
        let enVentana = false;
        if (inicioVentana < 0) {
            // Caso especial: la ventana cruza medianoche
            enVentana = minutosActuales >= (inicioVentana + 1440) || minutosActuales <= minutosAsignados;
        } else {
            enVentana = minutosActuales >= inicioVentana;
        }

        console.log(`📌 Ventana de salida: desde ${this._calcularHoraVentana(horaSalidaAsignada, ventanaMinutos)}`);
        console.log(`   Hora actual: ${horaActual} → ${enVentana ? '✅ DENTRO' : '❌ FUERA'}`);

        return enVentana;
    }

    // ============================================
    // CALCULAR LA HORA DE INICIO DE LA VENTANA
    // (ej: salida 18:00, ventana 10 → "17:50")
    // ============================================
    _calcularHoraVentana(horaSalidaAsignada, ventanaMinutos = 10) {
        if (!horaSalidaAsignada) return '--:--';

        const [h, m] = horaSalidaAsignada.split(':').map(Number);
        let minutos = h * 60 + m - ventanaMinutos;

        if (minutos < 0) minutos += 1440;

        const horas = Math.floor(minutos / 60) % 24;
        const mins = minutos % 60;

        return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }

    _tieneHorarioAlmuerzoDefinido() {
        if (!this.asignacionHoy) return false;
        return !!(this.asignacionHoy.IngAlmuerzoEsperado || this.asignacionHoy.SalAlmuerzoEsperado);
    }

    // ============================================
    // VERIFICAR UBICACIÓN ANTES DE MARCAR
    // ============================================
    // ============================================
    // VERIFICAR UBICACIÓN ANTES DE MARCAR
    // ============================================
    async _verificarUbicacionAntesDeMarcar() {
        console.log('📍 Verificando ubicación antes de marcar...');
        console.log(`📌 Tipo de horario: ${this.horarioEsVirtual ? 'VIRTUAL' : 'PRESENCIAL'}`);

        // ============================================
        // Si ya se verificó recientemente (5 min), permitir
        // ============================================
        if (this.gps.isUbicacionPermitida() && this.gps.getUltimaVerificacion()) {
            const transcurrido = Date.now() - this.gps.getUltimaVerificacion();
            if (transcurrido < 300000) {
                console.log('✅ Verificación reciente (< 5 min)');
                return true;
            }
        }

        this.gps.mostrarVerificandoUbicacion('Verificando ubicación...');
        const resultado = await this.gps.verificarUbicacion(this.horarioEsVirtual);
        this.gps.ocultarVerificandoUbicacion();

        if (resultado.success) {
            this.gps.marcarVerificacionExitosa();
            return true;
        }

        // ============================================
        // MANEJO DE ERRORES SEGÚN TIPO DE HORARIO
        // ============================================

        // 🟢 CASO VIRTUAL: solo bloquear si el permiso es denegado o no hay soporte GPS
        if (this.horarioEsVirtual) {
            const motivosQueBloqueanVirtual = [
                'PERMISO_DENEGADO',
                'GPS_NO_SOPORTADO'
            ];

            if (!motivosQueBloqueanVirtual.includes(resultado.motivo)) {
                // Cualquier otro motivo (FUERA_DE_AREA, GPS_NO_REAL, GPS_TIMEOUT, etc.)
                // NO debe bloquear al usuario con horario virtual.
                console.log(`🌐 Horario VIRTUAL - Motivo "${resultado.motivo}" NO bloquea. Continuando...`);
                return true;
            }

            // Solo permiso denegado / GPS no soportado → mostrar bloqueo
            const tipoBloqueo = resultado.motivo === 'GPS_NO_SOPORTADO'
                ? 'GPS_NO_SOPORTADO'
                : 'PERMISO_DENEGADO_VIRTUAL';

            this.gps.mostrarBloqueoUbicacion(tipoBloqueo, {
                usuario: this.usuarioActual,
                tipoHorario: this.tipoHorario,
                asignacionHoy: this.asignacionHoy,
                turnoAsignado: this.tipoHorario?.Descripcion,
                esVirtual: true
            });
            return false;
        }

        // 🔴 CASO PRESENCIAL: mostrar bloqueo con el motivo específico
        let tipoBloqueo = 'FUERA_DE_AREA';
        switch (resultado.motivo) {
            case 'PERMISO_DENEGADO':
                tipoBloqueo = 'PERMISO_DENEGADO';
                break;
            case 'GPS_NO_SOPORTADO':
                tipoBloqueo = 'GPS_NO_SOPORTADO';
                break;
            case 'GPS_NO_REAL':
                tipoBloqueo = 'GPS_NO_REAL';
                break;
            case 'GPS_PRECISION_BAJA':
                tipoBloqueo = 'GPS_PRECISION_BAJA';
                break;
            case 'FUERA_DE_AREA':
            default:
                tipoBloqueo = 'FUERA_DE_AREA';
                break;
        }

        this.gps.mostrarBloqueoUbicacion(tipoBloqueo, {
            usuario: this.usuarioActual,
            tipoHorario: this.tipoHorario,
            asignacionHoy: this.asignacionHoy,
            turnoAsignado: this.tipoHorario?.Descripcion,
            esVirtual: false
        });
        return false;
    }

    // ============================================
    // OBTENER COORDENADAS (para evidencia)
    // ============================================
    async _obtenerCoordenadasActuales() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                }),
                (err) => {
                    console.warn('⚠️ Error obteniendo coords:', err.message);
                    resolve(null);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        });
    }

    // ============================================
    // SUBIR EVIDENCIA SELFIE
    // ============================================
    async _subirEvidenciaSelfie(idMarcacion, selfiePendiente) {
        try {
            console.log('📸 Subiendo selfie...');

            // Verificar si ya existe evidencia
            const existente = await this.service.obtenerEvidenciaPorMarcacion(idMarcacion);
            const existeEvidencia = existente.success && existente.data && existente.data.IdMarcacionEvidencia;

            const payload = { IdMarcacion: idMarcacion };
            const campo = selfiePendiente.campo;
            payload[campo] = selfiePendiente.data;

            // Coordenadas
            if (selfiePendiente.coordenadas) {
                if (campo === 'Evidencia_Ingreso' || campo === 'Evidencia_IngAlmuerzo') {
                    payload.LatitudIng = selfiePendiente.coordenadas.lat;
                    payload.LongitudIng = selfiePendiente.coordenadas.lng;
                } else {
                    payload.LatitudSal = selfiePendiente.coordenadas.lat;
                    payload.LongitudSal = selfiePendiente.coordenadas.lng;
                }
            }

            if (existeEvidencia) {
                await this.service.actualizarEvidencia(existente.data.IdMarcacionEvidencia, payload);
                console.log('✅ Evidencia actualizada');
            } else {
                await this.service.crearEvidencia(payload);
                console.log('✅ Evidencia creada');
            }
        } catch (error) {
            console.error('❌ Error subiendo selfie:', error);
        }
    }

    // ============================================
    // SUBIR EVIDENCIA DE JUSTIFICACIÓN (tardanza)
    // ============================================
    async _subirEvidenciaJustificacion(idMarcacion, evidencia, tipo) {
        try {
            const payload = this.justificacion.construirPayloadEvidenciaTardanza(idMarcacion, evidencia);
            if (!payload) return;

            const r = await this.service.crearJustificacionTardanza(payload);
            if (r.success) {
                console.log('✅ Evidencia de justificación guardada');
            } else {
                console.warn('⚠️ No se pudo guardar evidencia de justificación:', r.error);
            }
        } catch (error) {
            console.error('❌ Error subiendo evidencia justificación:', error);
        }
    }

    // ============================================
    // VERIFICAR FALTAS DE DÍAS ANTERIORES
    // ============================================
    async verificarFaltasDiasAnteriores() {
        try {
            console.log('=== VERIFICANDO FALTAS DÍAS ANTERIORES ===');

            const hoy = this.obtenerFechaActual();
            const fechaLimite = this.obtenerFechaHaceDias(OPTIMIZACION_REGISTRO.DIAS_LIMITE_FALTAS);

            // Obtener asignaciones del usuario en el rango
            const r = await this.service.api.get(`/asignaciones/usuario/${this.usuarioActual.IdUsuario}`, {
                query: { fechaInicio: fechaLimite, fechaFin: this.obtenerFechaAyer() }
            });

            if (!r.success) {
                console.warn('⚠️ No se pudieron obtener asignaciones para faltas');
                return;
            }

            const asignaciones = r.data || [];
            if (asignaciones.length === 0) {
                console.log('Sin asignaciones en el rango');
                return;
            }

            // Obtener marcaciones del usuario en el rango
            const rm = await this.service.api.get(`/marcaciones/usuario/${this.usuarioActual.IdUsuario}`, {
                query: { fechaInicio: fechaLimite, fechaFin: this.obtenerFechaAyer() }
            });

            const marcaciones = rm.success ? (rm.data || []) : [];

            // Set de fechas con marcación
            const fechasConMarcacion = new Set(
                marcaciones.map(m => this._normalizarFecha(m.Fecha)).filter(Boolean)
            );

            let faltasRegistradas = 0;

            for (const asignacion of asignaciones) {
                const fechaAsig = this._normalizarFecha(asignacion.Fecha);
                if (!fechaAsig) continue;
                if (fechaAsig >= hoy) continue;
                if (fechaAsig < fechaLimite) continue;
                if (fechasConMarcacion.has(fechaAsig)) continue;

                // Registrar falta
                try {
                    const datosFalta = {
                        IdUsuario: this.usuarioActual.IdUsuario,
                        IdAsignacion: asignacion.IdAsignacion,
                        Fecha: fechaAsig,
                        IdEstadoIng: this._obtenerIdEstadoFalto(),
                        ObsGeneral: 'FALTA - JUSTIFICACIÓN PENDIENTE',
                        IdUsuarioCreacion: this.usuarioActual.IdUsuario
                    };

                    const result = await this.service.crearMarcacion(datosFalta);
                    if (result.success) {
                        faltasRegistradas++;
                        fechasConMarcacion.add(fechaAsig);
                        console.log(`✅ Falta registrada para ${fechaAsig}`);
                    }

                    await new Promise(res => setTimeout(res, 100));
                } catch (error) {
                    console.warn(`⚠️ Error registrando falta ${fechaAsig}:`, error.message);
                }
            }

            if (faltasRegistradas > 0) {
                this.mostrarMensaje(
                    `Se registraron ${faltasRegistradas} falta(s) con "JUSTIFICACIÓN PENDIENTE"`,
                    'info'
                );
            }

        } catch (error) {
            console.error('❌ Error verificando faltas:', error);
        }
    }

    // ============================================
    // OBTENER ID DEL ESTADO "MARCACION FALTO"
    // Busca en el catálogo por descripción, con fallback a 7
    // ============================================
    _obtenerIdEstadoFalto() {
        // Buscar en el catálogo de estados cargados
        if (this.estados && this.estados.length > 0) {
            const descripcionesPosibles = [
                'MARCACION FALTO',
                'FALTO',
                'FALTA',
                'MARCACION FALTA'
            ];

            for (const desc of descripcionesPosibles) {
                const estado = this.estados.find(e =>
                    String(e.Descripcion || '').toUpperCase().trim() === desc
                );
                if (estado) {
                    console.log(`✅ Estado "${desc}" encontrado con ID: ${estado.IdEstado}`);
                    return estado.IdEstado;
                }
            }

            // Búsqueda por LIKE (si no coincide exacto)
            for (const desc of descripcionesPosibles) {
                const estado = this.estados.find(e =>
                    String(e.Descripcion || '').toUpperCase().includes(desc)
                );
                if (estado) {
                    console.log(`✅ Estado "${desc}" (LIKE) encontrado con ID: ${estado.IdEstado}`);
                    return estado.IdEstado;
                }
            }
        }

        // Fallback: usar el ID 7 que corresponde a MARCACION FALTO
        console.warn('⚠️ Estado "MARCACION FALTO" no encontrado en catálogo, usando ID 7 por defecto');
        return 7;
    }

    // ============================================
    // MOSTRAR ERROR DE CARGA
    // ============================================
    mostrarErrorCarga(errores) {
        const mensaje = errores.join('\n');

        let overlay = document.getElementById('errorCargaOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'errorCargaOverlay';
            overlay.style.cssText = `
                position: fixed; inset: 0;
                background: rgba(0,0,0,0.92);
                backdrop-filter: blur(8px);
                z-index: 9999;
                display: none;
                justify-content: center;
                align-items: center;
                padding: 20px;
            `;
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = `
            <div style="max-width:580px;width:100%;background:#1a1a2e;color:white;border-radius:24px;padding:40px;text-align:center;">
                <div style="font-size:70px;margin-bottom:15px;">⚠️</div>
                <h2 style="color:#ff6b6b;margin-bottom:15px;">
                    <i class="fas fa-exclamation-circle"></i> Marcación Bloqueada
                </h2>
                <p style="color:rgba(255,255,255,0.8);margin-bottom:25px;">
                    No se pudieron cargar los datos necesarios.
                </p>
                <div style="background:rgba(255,255,255,0.05);padding:16px;border-radius:12px;text-align:left;margin-bottom:20px;">
                    ${errores.map(e => `<div style="padding:4px 0;">• ${e}</div>`).join('')}
                </div>
                <div style="display:flex;gap:15px;justify-content:center;flex-wrap:wrap;">
                    <button onclick="location.reload()" style="padding:14px 35px;background:linear-gradient(135deg,#CC0000,#8B0000);color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;">
                        <i class="fas fa-sync-alt"></i> Recargar
                    </button>
                    <button onclick="window.location.href='Menu.html'" style="padding:14px 35px;background:rgba(108,117,125,0.8);color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;">
                        <i class="fas fa-home"></i> Ir al Menú
                    </button>
                </div>
            </div>
        `;
        overlay.style.display = 'flex';
    }

    // ============================================
    // UTILIDADES DE FECHA Y HORA
    // ============================================
    obtenerFechaActual() {
        const hoy = new Date();
        return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    }

    obtenerFechaAyer() {
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        return `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`;
    }

    obtenerFechaHaceDias(dias) {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() - dias);
        return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
    }

    _normalizarFecha(valor) {
        if (!valor) return null;
        if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
        if (typeof valor === 'string' && valor.includes('T')) {
            const p = valor.split('T')[0];
            if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
        }
        if (typeof valor === 'string' && valor.includes(' ')) {
            const p = valor.split(' ')[0];
            if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
        }
        try {
            const d = new Date(valor);
            if (!isNaN(d.getTime())) {
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
        } catch { }
        return null;
    }

    formatearFecha(fecha) {
        if (!fecha) return '';
        const [y, m, d] = fecha.split('-');
        return `${d}/${m}/${y}`;
    }

    formatearHoraActual(fecha) {
        return `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
    }

    formatearHoraConSegundos(fecha) {
        return `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}:${String(fecha.getSeconds()).padStart(2, '0')}`;
    }

    _formatearHoraMostrar(hora) {
        if (!hora) return '';
        if (typeof hora === 'string' && /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(hora)) return hora;
        if (typeof hora === 'string' && /^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(hora)) return hora.substring(0, 5);
        if (typeof hora === 'string' && hora.includes('T')) {
            const m = hora.match(/T(\d{2}):(\d{2})/);
            if (m) return `${m[1]}:${m[2]}`;
        }
        if (hora instanceof Date) {
            return `${String(hora.getHours()).padStart(2, '0')}:${String(hora.getMinutes()).padStart(2, '0')}`;
        }
        if (typeof hora === 'string' && hora.includes(' ')) {
            const p = hora.split(' ')[1];
            if (p) {
                const t = p.split(':');
                if (t.length >= 2) return `${t[0]}:${t[1]}`;
            }
        }
        return hora;
    }

    compararHoras(hora1, hora2) {
        const [h1, m1] = hora1.split(':').map(Number);
        const [h2, m2] = hora2.split(':').map(Number);
        return (h1 * 60 + m1) - (h2 * 60 + m2);
    }

    calcularDiferenciaMinutos(ini, fin) {
        const [hi, mi] = ini.split(':').map(Number);
        const [hf, mf] = fin.split(':').map(Number);
        let diff = (hf * 60 + mf) - (hi * 60 + mi);
        if (diff < 0) diff += 1440;
        return diff;
    }

    _calcularDiferenciaMinutos(ini, fin) {
        return this.calcularDiferenciaMinutos(ini, fin);
    }

    _calcularHoraEsperada(horaInicio, minutos) {
        const [h, m] = horaInicio.split(':').map(Number);
        let total = h * 60 + m + minutos;
        if (total >= 1440) total -= 1440;
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }

    _obtenerIdEstadoPorDescripcion(desc) {
        const d = (desc || '').toUpperCase();
        const e = this.estados.find(x => x.Descripcion === d);
        if (e) return e.IdEstado;

        // Fallback
        const fallback = { 'A TIEMPO': 1, 'TARDANZA': 2, 'EXCESO': 3 };
        return fallback[d] || 1;
    }

    // ============================================
    // CARGA SILENCIOSA (skeleton + toast)
    // ============================================
    _mostrarCargaSilenciosa() {
        [this.btnIngreso, this.btnIngresoAlmuerzo, this.btnSalidaAlmuerzo, this.btnSalida].forEach(btn => {
            if (btn) btn.classList.add('loading');
        });
        this._ponerSkeletonsInfo();

        this._timerToastCarga = setTimeout(() => {
            this._mostrarToastCarga('⏳ Preparando tu jornada...');
        }, 800);
    }

    _ocultarCargaSilenciosa(exito = true) {
        if (this._timerToastCarga) {
            clearTimeout(this._timerToastCarga);
            this._timerToastCarga = null;
        }

        [this.btnIngreso, this.btnIngresoAlmuerzo, this.btnSalidaAlmuerzo, this.btnSalida].forEach(btn => {
            if (btn) btn.classList.remove('loading');
        });

        this._quitarSkeletonsInfo();

        if (exito) {
            this._mostrarToastCarga('✅ Listo', true);
            setTimeout(() => this._ocultarToastCarga(), 1500);
        } else {
            this._ocultarToastCarga();
        }
    }

    _mostrarToastCarga(texto, esExito = false) {
        if (!this.toastCarga || !this.toastCargaTexto) return;
        const icono = this.toastCarga.querySelector('i');
        if (icono) icono.className = esExito ? 'fas fa-check-circle' : 'fas fa-spinner';
        this.toastCargaTexto.textContent = texto.replace(/^[⏳✅]\s*/, '');
        this.toastCarga.classList.toggle('exito', esExito);
        this.toastCarga.classList.add('show');
    }

    _ocultarToastCarga() {
        if (this.toastCarga) {
            this.toastCarga.classList.remove('show', 'exito');
        }
    }

    _actualizarMensajeToast(mensaje) {
        if (this.toastCarga?.classList.contains('show') && this.toastCargaTexto) {
            this.toastCargaTexto.textContent = mensaje;
        }
    }

    _ponerSkeletonsInfo() {
        const campos = [
            this.turnoAsignadoSpan,
            this.tipoHorarioValueSpan,
            this.horaIngresoEsperadaSpan,
            this.horaSalidaEsperadaSpan,
            this.estadoMarcacionSpan,
            this.horaIngresoAlmuerzoEsperadaSpan,
            this.horaSalidaAlmuerzoEsperadaSpan,
            this.duracionAlmuerzoSpan
        ];
        campos.forEach(c => {
            if (c) {
                c.dataset.textoOriginal = c.textContent;
                c.textContent = '···';
                c.classList.add('skeleton');
            }
        });
    }

    _quitarSkeletonsInfo() {
        const campos = [
            this.turnoAsignadoSpan,
            this.tipoHorarioValueSpan,
            this.horaIngresoEsperadaSpan,
            this.horaSalidaEsperadaSpan,
            this.estadoMarcacionSpan,
            this.horaIngresoAlmuerzoEsperadaSpan,
            this.horaSalidaAlmuerzoEsperadaSpan,
            this.duracionAlmuerzoSpan
        ];
        campos.forEach(c => {
            if (c) c.classList.remove('skeleton');
        });
    }

    // ============================================
    // MODALES DE CARGA
    // ============================================
    mostrarModalCargaProceso(titulo, mensaje) {
        if (this.modalCargaProceso) {
            if (this.cargaProcesoTitulo) this.cargaProcesoTitulo.textContent = titulo || 'Procesando...';
            if (this.cargaProcesoMensaje) this.cargaProcesoMensaje.textContent = mensaje || 'Espere...';
            this.modalCargaProceso.classList.add('active', 'modal-obligatorio');
            document.body.classList.add('modal-open');
        }
    }

    ocultarModalCargaProceso() {
        if (this.modalCargaProceso) {
            this.modalCargaProceso.classList.remove('active', 'modal-obligatorio');
            document.body.classList.remove('modal-open');
        }
    }

    // ============================================
    // MENSAJES TOAST
    // ============================================
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

    // ============================================
    // NAVEGACIÓN
    // ============================================
    redirigirALogin() {
        const ruta = this.config?.ROUTES?.LOGIN || 'index.html';
        window.location.replace(ruta);
    }

    redirigirAlMenu() {
        const ruta = this.config?.ROUTES?.MENU || 'Menu.html';
        window.location.href = ruta;
    }

    redirigirAlPerfil() {
        const ruta = this.config?.ROUTES?.PERFIL || 'Mi-Perfil.html';
        window.location.href = ruta;
    }

    cerrarSesion() {
        this.mostrarMensaje('Cerrando sesión...', 'success');
        setTimeout(() => {
            this.auth.cerrarSesion();
        }, 700);
    }
}

// ============================================
// EXPOSICIÓN GLOBAL
// ============================================
if (typeof window !== 'undefined') {
    window.RegistroAsistenciaController = RegistroAsistenciaController;
}