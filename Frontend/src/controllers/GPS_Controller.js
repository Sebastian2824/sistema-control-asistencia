// ==============================================
// CONTROLLER: GPSController
// Responsabilidad: Toda la lógica de geolocalización del
//                 módulo Registro de Asistencia.
//
// Incluye:
//   - Detección de dispositivo/navegador (móvil vs PC)
//   - Obtención de coordenadas GPS (rápida + refinada)
//   - Cálculo de distancias (Haversine)
//   - Verificación contra sucursales (con factor de precisión)
//   - Modal de bloqueo por ubicación
//   - Registro del bloqueo en backend
//
// Depende de: RegistroAsistenciaService (para sucursales y logs)
// ==============================================

class GPSController {

    constructor(config, registroService) {
        this.config = config || {};
        this.service = registroService;

        // ============================================
        // DETECCIÓN DE DISPOSITIVO Y NAVEGADOR
        // ============================================
        this.esMovil = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
        this.esFirefox = /Firefox/i.test(navigator.userAgent);
        this.esChrome = /Chrome/i.test(navigator.userAgent) && !/Edge/i.test(navigator.userAgent);

        // Configuración óptima según dispositivo
        if (this.esMovil) {
            this.GPS_OPCIONES_RAPIDAS = {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 30000
            };
            this.GPS_OPCIONES_PRECISAS = {
                enableHighAccuracy: true,
                timeout: 8000,
                maximumAge: 0
            };
            this.GPS_TIMEOUT_GLOBAL = 10000;
            this.FACTOR_RADIO_PC = 1.0;
        } else {
            this.GPS_OPCIONES_RAPIDAS = {
                enableHighAccuracy: false,
                timeout: 8000,
                maximumAge: 60000
            };
            this.GPS_OPCIONES_PRECISAS = {
                enableHighAccuracy: false,
                timeout: 8000,
                maximumAge: 30000
            };
            this.GPS_TIMEOUT_GLOBAL = 12000;
            this.FACTOR_RADIO_PC = 2.5;
        }

        console.log(`📱 GPSController - Dispositivo: ${this.esMovil ? 'MÓVIL' : 'PC/LAPTOP'}`);
        console.log(`🌐 Navegador: ${this.esFirefox ? 'Firefox' : this.esChrome ? 'Chrome' : 'Otro'}`);
        console.log(`⏱️ Timeout global GPS: ${this.GPS_TIMEOUT_GLOBAL}ms`);
        console.log(`📏 Factor radio PC: ${this.FACTOR_RADIO_PC}x`);

        // ============================================
        // ESTADO
        // ============================================
        this.sucursales = [];
        this.sucursalesCargadas = false;

        this.ubicacionPermitida = false;
        this.permisoGPSDenegado = false;
        this.sucursalDetectada = null;

        this._ultimaUbicacion = null;   // { lat, lng }
        this._ultimaPrecision = null;   // number (metros)
        this._sucursalMasCercana = null; // { id, nombre, distancia, radioMetros }
        this._ultimaVerificacion = null; // timestamp
        this._contadorBloqueos = 0;

        // ============================================
        // ELEMENTOS DEL DOM (modal de bloqueo)
        // ============================================
        this.modalBloqueoUbicacion = document.getElementById('modalBloqueoUbicacion');
        this.modalVerificandoUbicacion = document.getElementById('modalVerificandoUbicacion');
        this.verificandoUbicacionMensaje = document.getElementById('verificandoUbicacionMensaje');

        this.ubicacionDetalle = document.getElementById('ubicacionDetalle');
        this.coordenadasActuales = document.getElementById('coordenadasActuales');
        this.coordenadasEmpresa = document.getElementById('coordenadasEmpresa');

        this.btnReintentarUbicacion = document.getElementById('btnReintentarUbicacion');
        this.btnSalirBloqueo = document.getElementById('btnSalirBloqueo');

        this._configurarEventos();

        console.log('✅ GPSController inicializado');
    }

    // ============================================
    // EVENTOS DEL MODAL DE BLOQUEO
    // ============================================
    _configurarEventos() {
        if (this.btnReintentarUbicacion) {
            const newBtn = this.btnReintentarUbicacion.cloneNode(true);
            this.btnReintentarUbicacion.parentNode.replaceChild(newBtn, this.btnReintentarUbicacion);
            this.btnReintentarUbicacion = newBtn;

            this.btnReintentarUbicacion.addEventListener('click', () => {
                this._onReintentar();
            });
        }

        if (this.btnSalirBloqueo) {
            const newBtn = this.btnSalirBloqueo.cloneNode(true);
            this.btnSalirBloqueo.parentNode.replaceChild(newBtn, this.btnSalirBloqueo);
            this.btnSalirBloqueo = newBtn;

            this.btnSalirBloqueo.addEventListener('click', () => {
                this._onSalir();
            });
        }
    }

    _onReintentar() {
        console.log('🔄 Usuario presionó "Reintentar" en bloqueo');
        this.ocultarBloqueoUbicacion();

        // El controller principal decide qué hacer después
        if (typeof this._onReintentarCallback === 'function') {
            this._onReintentarCallback();
        }
    }

    _onSalir() {
        console.log('🚪 Usuario presionó "Salir al Menú" en bloqueo');
        this.ocultarBloqueoUbicacion();

        if (typeof this._onSalirCallback === 'function') {
            this._onSalirCallback();
        }
    }

    /**
     * Permite al controller principal registrar callbacks para
     * los botones del modal de bloqueo.
     */
    setCallbacks({ onReintentar, onSalir } = {}) {
        if (typeof onReintentar === 'function') this._onReintentarCallback = onReintentar;
        if (typeof onSalir === 'function') this._onSalirCallback = onSalir;
    }

    // ============================================
    // CARGAR SUCURSALES
    // ============================================
    async cargarSucursales() {
        try {
            console.log('🏢 Cargando sucursales desde la base de datos...');

            const result = await this.service.obtenerSucursales();

            if (result.success && result.data && result.data.length > 0) {
                this.sucursales = result.data;
                this.sucursalesCargadas = true;
                console.log(`✅ ${this.sucursales.length} sucursales cargadas`);
                this.sucursales.forEach(s => {
                    console.log(`   📍 ${s.nombre} (${s.lat}, ${s.lng}) - Radio: ${s.radioMetros}m`);
                });
                return true;
            }

            console.error('❌ No se pudieron cargar sucursales:', result.error);
            this.sucursales = [];
            this.sucursalesCargadas = false;
            return false;

        } catch (error) {
            console.error('❌ Error al cargar sucursales:', error);
            this.sucursales = [];
            this.sucursalesCargadas = false;
            return false;
        }
    }

    // ============================================
    // VERIFICAR UBICACIÓN
    // Devuelve { success, motivo, ... }
    // ============================================
    async verificarUbicacion(esVirtual = false) {
        console.log('📍 Verificando ubicación del dispositivo...');
        this.actualizarMensajeVerificando('Verificando disponibilidad de GPS...');

        // ============================================
        // 1. VERIFICAR SOPORTE
        // ============================================
        if (!navigator.geolocation) {
            console.warn('⚠️ El navegador no soporta geolocalización');
            this.actualizarMensajeVerificando('⚠️ Geolocalización no soportada');
            await this._delay(1000);

            this.ubicacionPermitida = false;
            this.permisoGPSDenegado = true;

            return {
                success: false,
                motivo: 'GPS_NO_SOPORTADO',
                mensaje: 'Su navegador no soporta geolocalización'
            };
        }

        try {
            this.actualizarMensajeVerificando('Obteniendo coordenadas GPS...');

            // ============================================
            // 2. VERIFICAR PERMISOS
            // ============================================
            const permissionStatus = await this._verificarPermisoUbicacion();
            if (!permissionStatus) {
                console.warn('⚠️ Usuario denegó el permiso de ubicación');
                this.actualizarMensajeVerificando('⚠️ Permiso de ubicación denegado');
                await this._delay(1000);

                this.ubicacionPermitida = false;
                this.permisoGPSDenegado = true;

                return {
                    success: false,
                    motivo: 'PERMISO_DENEGADO',
                    mensaje: 'Permiso de ubicación denegado'
                };
            }

            // ============================================
            // 3. OBTENER UBICACIÓN CON TIMEOUT GLOBAL
            // ============================================
            const inicioGPS = performance.now();

            const posicion = await Promise.race([
                this.obtenerUbicacionActual(),
                new Promise((_, reject) =>
                    setTimeout(() => reject({
                        code: 3,
                        message: `Timeout global de GPS (${this.GPS_TIMEOUT_GLOBAL / 1000}s)`
                    }), this.GPS_TIMEOUT_GLOBAL)
                )
            ]);

            const tiempoGPS = performance.now() - inicioGPS;
            console.log(`⚡ GPS total: ${tiempoGPS.toFixed(0)}ms`);

            const latActual = posicion.coords.latitude;
            const lngActual = posicion.coords.longitude;
            const precision = posicion.coords.accuracy || 0;

            // ============================================
            // 4. GUARDAR UBICACIÓN INMEDIATAMENTE
            // (antes de cualquier evaluación, para que el
            //  modal siempre tenga datos que mostrar)
            // ============================================
            this._ultimaPrecision = precision;
            this._ultimaUbicacion = { lat: latActual, lng: lngActual };

            console.log(`📍 Ubicación: Lat: ${latActual.toFixed(6)}, Lng: ${lngActual.toFixed(6)}`);
            console.log(`📊 Precisión: ${precision} metros`);

            this.actualizarMensajeVerificando(`📍 Ubicación obtenida: ${latActual.toFixed(6)}, ${lngActual.toFixed(6)}`);
            await this._delay(500);

            // Actualizar coords en el modal
            if (this.coordenadasActuales) {
                this.coordenadasActuales.textContent =
                    `Lat: ${latActual.toFixed(6)}, Lng: ${lngActual.toFixed(6)} (precisión: ${precision.toFixed(0)}m)`;
            }

            // ============================================
            // 5. SI ES VIRTUAL: SOLO VERIFICAR GPS ACTIVO
            // ============================================
            if (esVirtual) {
                console.log('🌐 Horario VIRTUAL - GPS activo, ubicación obtenida');
                this.ubicacionPermitida = true;
                this.permisoGPSDenegado = false;

                this.actualizarMensajeVerificando('✅ GPS activo - Ubicación registrada');
                await this._delay(500);

                if (this.ubicacionDetalle) {
                    this.ubicacionDetalle.textContent =
                        `🌐 Horario VIRTUAL - GPS activo (${precision.toFixed(0)}m)`;
                    this.ubicacionDetalle.style.color = '#28a745';
                }

                return {
                    success: true,
                    motivo: 'OK_VIRTUAL',
                    ubicacion: { lat: latActual, lng: lngActual }
                };
            }

            // ============================================
            // 6. PRESENCIAL: VALIDAR GPS REAL
            // ============================================
            console.log('🏢 Horario PRESENCIAL - Verificando sucursal...');

            if (precision > 500) {
                console.error(`❌ GPS NO REAL: Precisión ${precision}m (esperado <500m)`);
                this.actualizarMensajeVerificando('❌ GPS no detectado correctamente');
                await this._delay(1000);

                this.ubicacionPermitida = false;

                return {
                    success: false,
                    motivo: 'GPS_NO_REAL',
                    mensaje: 'GPS no detectado correctamente (precisión > 500m)'
                };
            }

            if (!this.sucursales || this.sucursales.length === 0) {
                console.error('❌ No hay sucursales cargadas');
                this.actualizarMensajeVerificando('❌ Sin sucursales configuradas');
                await this._delay(1000);

                this.ubicacionPermitida = false;

                return {
                    success: false,
                    motivo: 'SIN_SUCURSALES',
                    mensaje: 'No hay sucursales configuradas en el sistema'
                };
            }

            // ============================================
            // 7. CALCULAR FACTOR DE PRECISIÓN
            // ============================================
            let factorPrecision = this.FACTOR_RADIO_PC;
            let factorDescripcion = this.esMovil ? 'móvil' : 'PC';

            if (precision > 200) {
                factorPrecision = Math.max(factorPrecision, 2.5);
                factorDescripcion = 'baja (>200m)';
            } else if (precision > 100) {
                factorPrecision = Math.max(factorPrecision, 2.5);
                factorDescripcion = 'baja (>100m)';
            } else if (precision > 50) {
                factorPrecision = Math.max(factorPrecision, 1.8);
                factorDescripcion = 'media (>50m)';
            } else if (precision > 30) {
                factorPrecision = Math.max(factorPrecision, 1.3);
                factorDescripcion = 'aceptable (>30m)';
            }

            console.log(`📊 Factor de radio: ${factorPrecision}x (${factorDescripcion})`);
            console.log(`📊 Precisión GPS: ${precision.toFixed(0)}m - Factor: ${factorPrecision}x`);

            // ============================================
            // 8. RECORRER SUCURSALES
            // ============================================
            let sucursalEncontrada = null;
            let distanciaMinima = Infinity;
            const todasLasDistancias = [];

            for (const sucursal of this.sucursales) {
                const distancia = this.calcularDistancia(
                    latActual, lngActual,
                    sucursal.lat, sucursal.lng
                );

                const radioAjustado = sucursal.radioMetros * factorPrecision;

                todasLasDistancias.push({
                    nombre: sucursal.nombre,
                    distancia,
                    radio: radioAjustado,
                    dentro: distancia <= radioAjustado
                });

                console.log(`📍 ${sucursal.nombre}: ${distancia.toFixed(2)}m (radio ajustado: ${radioAjustado.toFixed(0)}m)`);

                if (distancia <= radioAjustado && distancia < distanciaMinima) {
                    distanciaMinima = distancia;
                    sucursalEncontrada = sucursal;
                }
            }

            // Sucursal más cercana
            const sucursalMasCercana = this.sucursales.reduce((a, b) => {
                const distA = this.calcularDistancia(latActual, lngActual, a.lat, a.lng);
                const distB = this.calcularDistancia(latActual, lngActual, b.lat, b.lng);
                return distA < distB ? a : b;
            });

            const distMasCercana = this.calcularDistancia(
                latActual, lngActual,
                sucursalMasCercana.lat, sucursalMasCercana.lng
            );

            if (this.coordenadasEmpresa) {
                this.coordenadasEmpresa.textContent =
                    `📍 Sucursal más cercana: ${sucursalMasCercana.nombre} (${distMasCercana.toFixed(0)}m)`;
            }

            // ============================================
            // 9. DECISIÓN FINAL
            // ============================================
            if (sucursalEncontrada) {
                this.ubicacionPermitida = true;
                this.permisoGPSDenegado = false;
                this.sucursalDetectada = sucursalEncontrada;
                this._ultimaUbicacion = { lat: latActual, lng: lngActual };

                console.log(`✅ DENTRO de ${sucursalEncontrada.nombre} (${distanciaMinima.toFixed(2)}m)`);

                this.actualizarMensajeVerificando(`✅ Ubicado en ${sucursalEncontrada.nombre}`);
                await this._delay(500);

                if (this.ubicacionDetalle) {
                    this.ubicacionDetalle.textContent =
                        `✅ Ubicado en ${sucursalEncontrada.nombre} (${distanciaMinima.toFixed(0)}m)`;
                    this.ubicacionDetalle.style.color = '#28a745';
                }

                return {
                    success: true,
                    motivo: 'OK_PRESENCIAL',
                    sucursal: sucursalEncontrada,
                    ubicacion: { lat: latActual, lng: lngActual }
                };
            }

            // ============================================
            // 10. FUERA DE TODAS LAS SUCURSALES
            // ============================================
            this._sucursalMasCercana = {
                id: sucursalMasCercana.id,
                nombre: sucursalMasCercana.nombre,
                distancia: distMasCercana,
                radioMetros: sucursalMasCercana.radioMetros
            };

            console.warn(`⚠️ Fuera de todas las sucursales. Más cercana: ${sucursalMasCercana.nombre} a ${distMasCercana.toFixed(2)}m`);

            this.actualizarMensajeVerificando('❌ Fuera de todas las sucursales');
            await this._delay(500);

            if (this.ubicacionDetalle) {
                this.ubicacionDetalle.innerHTML = `
                    ❌ No se encuentra en ninguna sucursal.<br>
                    Sucursal más cercana: ${sucursalMasCercana.nombre} (${distMasCercana.toFixed(0)}m)<br>
                    Precisión GPS: ${precision.toFixed(0)}m
                `;
                this.ubicacionDetalle.style.color = '#dc3545';
            }

            console.log('📋 Distancias:');
            todasLasDistancias.forEach(s => {
                console.log(`  ${s.nombre}: ${s.distancia.toFixed(2)}m (radio: ${s.radio.toFixed(0)}m) ${s.dentro ? '✅' : '❌'}`);
            });

            this.ubicacionPermitida = false;
            this.permisoGPSDenegado = false;

            return {
                success: false,
                motivo: 'FUERA_DE_AREA',
                mensaje: 'No se encuentra dentro de ninguna sucursal',
                sucursalMasCercana,
                distancia: distMasCercana
            };

        } catch (error) {
            console.error('❌ Error al obtener ubicación:', error);

            let mensajeError = '';
            let tipoBloqueo = 'ERROR_GPS';
            let motivo = 'ERROR_GPS';

            if (error.code === 1) {
                mensajeError = '⚠️ Permiso de ubicación DENEGADO. Debe permitir el acceso desde Configuración.';
                tipoBloqueo = 'PERMISO_DENEGADO';
                motivo = 'PERMISO_DENEGADO';
                this.permisoGPSDenegado = true;
            } else if (error.code === 2) {
                mensajeError = '⚠️ No se pudo obtener la ubicación. Verifique el GPS.';
                motivo = 'GPS_NO_DISPONIBLE';
            } else if (error.code === 3) {
                mensajeError = '⚠️ Tiempo de espera agotado. Intente en un lugar con mejor señal.';
                motivo = 'GPS_TIMEOUT';
            } else {
                mensajeError = `⚠️ Error al obtener la ubicación: ${error.message || 'Desconocido'}`;
                motivo = 'ERROR_GPS';
            }

            this.actualizarMensajeVerificando(mensajeError);
            await this._delay(1000);

            if (this.ubicacionDetalle) {
                this.ubicacionDetalle.textContent = mensajeError;
                this.ubicacionDetalle.style.color = '#dc3545';
            }

            this.ubicacionPermitida = false;

            return {
                success: false,
                motivo,
                mensaje: mensajeError,
                tipoBloqueo
            };
        }
    }

    // ============================================
    // OBTENER UBICACIÓN ACTUAL (2 intentos)
    // ============================================
    obtenerUbicacionActual() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject({ code: 0, message: 'Geolocalización no soportada' });
                return;
            }

            console.log(`📍 [Intento 1/2] Ubicación rápida (${this.esMovil ? 'GPS' : 'WiFi'})...`);
            const inicioIntento1 = performance.now();

            navigator.geolocation.getCurrentPosition(
                (posicionRapida) => {
                    const tiempo1 = performance.now() - inicioIntento1;
                    console.log(`✅ [Intento 1] Éxito en ${tiempo1.toFixed(0)}ms`);
                    console.log(`📊 Precisión: ${posicionRapida.coords.accuracy.toFixed(0)}m`);

                    const precisionBuena = this.esMovil ? 50 : 150;
                    if (posicionRapida.coords.accuracy <= precisionBuena) {
                        console.log(`✅ Precisión suficiente, no se refina`);
                        resolve(posicionRapida);
                        return;
                    }

                    console.log('📍 [Intento 2/2] Refinando ubicación...');
                    const inicioIntento2 = performance.now();

                    navigator.geolocation.getCurrentPosition(
                        (posicionPrecisa) => {
                            const tiempo2 = performance.now() - inicioIntento2;
                            console.log(`✅ [Intento 2] Éxito en ${tiempo2.toFixed(0)}ms`);
                            console.log(`📊 Precisión final: ${posicionPrecisa.coords.accuracy.toFixed(0)}m`);

                            if (posicionPrecisa.coords.accuracy < posicionRapida.coords.accuracy) {
                                resolve(posicionPrecisa);
                            } else {
                                resolve(posicionRapida);
                            }
                        },
                        (error) => {
                            console.warn('⚠️ [Intento 2] Falló, usando la rápida:', error.message);
                            resolve(posicionRapida);
                        },
                        this.GPS_OPCIONES_PRECISAS
                    );
                },
                (error) => {
                    console.warn('⚠️ [Intento 1] Falló:', error.message);
                    console.log('📍 Reintentando con configuración alternativa...');

                    navigator.geolocation.getCurrentPosition(
                        (posicion) => {
                            console.log('✅ Ubicación obtenida (fallback)');
                            resolve(posicion);
                        },
                        (errorFinal) => {
                            reject({
                                code: errorFinal.code,
                                message: errorFinal.message
                            });
                        },
                        {
                            enableHighAccuracy: this.esMovil,
                            timeout: 10000,
                            maximumAge: 120000
                        }
                    );
                },
                this.GPS_OPCIONES_RAPIDAS
            );
        });
    }

    // ============================================
    // VERIFICAR PERMISO (especialmente en iOS)
    // ============================================
    async _verificarPermisoUbicacion() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

        if (!isIOS) return true;

        console.log('🍎 iOS detectado, verificando permisos...');

        try {
            if (navigator.permissions && navigator.permissions.query) {
                const result = await navigator.permissions.query({ name: 'geolocation' });
                console.log('📊 Estado del permiso en iOS:', result.state);

                if (result.state === 'denied') return false;
                if (result.state === 'granted') return true;
                return true;
            }
            return true;
        } catch (error) {
            console.warn('⚠️ No se pudo verificar permiso:', error);
            return true;
        }
    }

    // ============================================
    // CALCULAR DISTANCIA (Haversine)
    // ============================================
    calcularDistancia(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = this._toRad(lat2 - lat1);
        const dLon = this._toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this._toRad(lat1)) * Math.cos(this._toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    _toRad(deg) {
        return deg * (Math.PI / 180);
    }

    // ============================================
    // MODAL DE VERIFICACIÓN
    // ============================================
    mostrarVerificandoUbicacion(mensaje = 'Obteniendo coordenadas GPS...') {
        if (this.modalVerificandoUbicacion) {
            if (this.verificandoUbicacionMensaje) {
                this.verificandoUbicacionMensaje.textContent = mensaje;
            }
            this.modalVerificandoUbicacion.classList.add('active');
            document.body.classList.add('modal-open');
        }
    }

    ocultarVerificandoUbicacion() {
        if (this.modalVerificandoUbicacion) {
            this.modalVerificandoUbicacion.classList.remove('active');
            document.body.classList.remove('modal-open');
        }
    }

    actualizarMensajeVerificando(mensaje) {
        if (this.verificandoUbicacionMensaje) {
            this.verificandoUbicacionMensaje.textContent = mensaje;
        }
    }

    // ============================================
    // MODAL DE BLOQUEO POR UBICACIÓN
    // ============================================
    mostrarBloqueoUbicacion(tipo = 'FUERA_DE_AREA', context = {}) {
        if (!this.modalBloqueoUbicacion) return;

        // ============================================
        // Registro del bloqueo en backend (sin await)
        // ============================================
        const mensajesBackend = {
            'FUERA_DE_AREA': 'Usuario fuera del área permitida',
            'PERMISO_DENEGADO': 'Usuario denegó permiso de ubicación',
            'PERMISO_DENEGADO_VIRTUAL': 'Usuario denegó permiso (horario virtual)',
            'GPS_NO_SOPORTADO': 'Navegador no soporta geolocalización',
            'GPS_NO_REAL': 'GPS impreciso (>500m)',
            'GPS_PRECISION_BAJA': 'Señal GPS muy débil'
        };

        this._registrarBloqueoEnBackend(
            tipo,
            mensajesBackend[tipo] || 'Bloqueo por ubicación',
            context.accionIntentada || null
        );

        // ============================================
        // Referencias a elementos del modal
        // ============================================
        const esVirtual = context.esVirtual || false;

        const mensajeEl = document.getElementById('bloqueoMensajePrincipal');
        const lineaPrecision = document.getElementById('lineaPrecision');
        const lineaInstruccion = document.getElementById('lineaInstruccion');
        const lineaAdvertencia = document.getElementById('lineaAdvertencia');
        const lineaHorario = document.getElementById('lineaHorario');
        const lineaCoordsActuales = document.getElementById('lineaCoordenadasActuales');
        const lineaCoordsEmpresa = document.getElementById('lineaCoordenadasEmpresa');
        const precisionEl = document.getElementById('bloqueoPrecision');
        const precisionAlerta = document.getElementById('bloqueoPrecisionAlerta');
        const instruccionEl = document.getElementById('bloqueoInstruccion');
        const advertenciaEl = document.getElementById('bloqueoAdvertencia');
        const turnoEl = document.getElementById('bloqueoTurno');
        const coordsActualesEl = document.getElementById('bloqueoCoordenadasActuales');
        const coordsEmpresaEl = document.getElementById('bloqueoCoordenadasEmpresa');
        const nombreEl = document.getElementById('bloqueoUsuarioNombre');
        const idEl = document.getElementById('bloqueoUsuarioId');

        // ============================================
        // Datos del usuario
        // ============================================
        if (nombreEl && context.usuario) {
            const nombreCompleto = `${context.usuario.nombres || context.usuario.Nombres || ''} ${context.usuario.apellidos || context.usuario.Apellidos || ''}`.trim();
            nombreEl.textContent = nombreCompleto || 'USUARIO';
        }
        if (idEl && context.usuario) {
            idEl.textContent = `[ID: ${context.usuario.IdUsuario || '--'}]`;
        }

        // ============================================
        // Horario asignado
        // ============================================
        if (turnoEl) {
            turnoEl.textContent = context.turnoAsignado
                || (context.tipoHorario?.Descripcion)
                || (context.asignacionHoy ? 'Horario asignado' : 'Sin asignación');
        }

        // ============================================
        // Precisión
        // ============================================
        const precision = this._ultimaPrecision;
        if (precisionEl) {
            precisionEl.textContent = (precision !== null && precision !== undefined)
                ? `${precision.toFixed(0)} metros`
                : 'No disponible';
        }
        if (precisionAlerta) {
            precisionAlerta.className = 'bloqueo-alerta';
            if (precision === null || precision === undefined) {
                precisionAlerta.textContent = '';
            } else if (precision > 500) {
                precisionAlerta.textContent = '❌ GPS impreciso';
                precisionAlerta.classList.add('alerta-mala');
            } else if (precision > 100) {
                precisionAlerta.textContent = '⚠️ Precisión baja';
                precisionAlerta.classList.add('alerta-baja');
            } else {
                precisionAlerta.textContent = '✅ Buena';
                precisionAlerta.classList.add('alerta-buena');
            }
        }

        // ============================================
        // Coordenadas actuales
        // ============================================
        const tieneUbicacion = this._ultimaUbicacion
            && this._ultimaUbicacion.lat !== null
            && this._ultimaUbicacion.lng !== null;

        if (coordsActualesEl) {
            if (tieneUbicacion) {
                coordsActualesEl.textContent =
                    `Lat: ${this._ultimaUbicacion.lat.toFixed(6)}, ` +
                    `Lng: ${this._ultimaUbicacion.lng.toFixed(6)} ` +
                    `(precisión: ${precision ? precision.toFixed(0) : '?'}m)`;
            } else {
                coordsActualesEl.textContent = 'No detectadas';
            }
        }

        // ============================================
        // Coordenadas empresa (sucursal más cercana)
        // ============================================
        if (coordsEmpresaEl) {
            if (this._sucursalMasCercana) {
                coordsEmpresaEl.textContent =
                    `📍 Sucursal más cercana: ${this._sucursalMasCercana.nombre} (${this._sucursalMasCercana.distancia.toFixed(0)}m)`;
            } else if (tieneUbicacion && this.sucursales && this.sucursales.length > 0) {
                let sucursalMasCercana = null;
                let distanciaMinima = Infinity;

                for (const sucursal of this.sucursales) {
                    const distancia = this.calcularDistancia(
                        this._ultimaUbicacion.lat,
                        this._ultimaUbicacion.lng,
                        sucursal.lat,
                        sucursal.lng
                    );
                    if (distancia < distanciaMinima) {
                        distanciaMinima = distancia;
                        sucursalMasCercana = sucursal;
                    }
                }

                if (sucursalMasCercana) {
                    coordsEmpresaEl.textContent =
                        `📍 Sucursal más cercana: ${sucursalMasCercana.nombre} (${distanciaMinima.toFixed(0)}m)`;
                } else {
                    coordsEmpresaEl.textContent = 'No disponible';
                }
            } else {
                coordsEmpresaEl.textContent = 'No disponible';
            }
        }

        // ============================================
        // Mensajes según tipo de bloqueo
        // ============================================
        let mensajePrincipal = '';
        let instruccion = '';
        let advertencia = '';
        let mostrarPrecision = true;
        let mostrarInstruccion = true;
        let mostrarAdvertencia = true;
        let mostrarHorario = true;
        let mostrarCoordsActuales = true;
        let mostrarCoordsEmpresa = true;

        switch (tipo) {
            case 'PERMISO_DENEGADO':
            case 'PERMISO_DENEGADO_VIRTUAL':
                mensajePrincipal = esVirtual
                    ? 'Su horario es VIRTUAL, pero necesita el permiso de ubicación.'
                    : 'No puede registrar asistencia sin el permiso de ubicación.';
                instruccion = 'Debe aceptar el permiso de ubicación en su navegador.';
                mostrarPrecision = false;
                mostrarAdvertencia = false;
                mostrarCoordsActuales = false;
                mostrarCoordsEmpresa = false;
                break;

            case 'GPS_NO_SOPORTADO':
                mensajePrincipal = 'Su navegador no soporta geolocalización.';
                instruccion = 'Debe usar un navegador compatible (Chrome, Safari, Firefox o Edge).';
                mostrarPrecision = false;
                mostrarAdvertencia = false;
                mostrarCoordsActuales = false;
                mostrarCoordsEmpresa = false;
                break;

            case 'GPS_NO_REAL':
                mensajePrincipal = 'No se detectó su GPS real.';
                instruccion = 'Su dispositivo usa ubicación por red (WiFi/datos).';
                advertencia = 'Active el GPS de alta precisión y salga a un lugar abierto.';
                mostrarCoordsEmpresa = false;
                break;

            case 'GPS_PRECISION_BAJA':
                mensajePrincipal = 'La señal GPS es muy débil.';
                instruccion = 'Salga a un lugar abierto y espere unos segundos.';
                advertencia = 'Verifique que el GPS esté activado con alta precisión.';
                mostrarCoordsEmpresa = false;
                break;

            case 'FUERA_DE_AREA':
            default:
                mensajePrincipal = 'Usted no se encuentra dentro del área permitida.';
                instruccion = 'Asegúrese de estar dentro del área permitida para marcar su asistencia.';
                advertencia = 'Debe estar en una de las sucursales para registrar asistencia.';
                break;
        }

        if (mensajeEl) mensajeEl.textContent = mensajePrincipal;
        if (instruccionEl) instruccionEl.textContent = instruccion;
        if (advertenciaEl) advertenciaEl.textContent = advertencia;

        if (lineaPrecision) lineaPrecision.style.display = mostrarPrecision ? 'flex' : 'none';
        if (lineaInstruccion) lineaInstruccion.style.display = mostrarInstruccion ? 'flex' : 'none';
        if (lineaAdvertencia) lineaAdvertencia.style.display = mostrarAdvertencia ? 'flex' : 'none';
        if (lineaHorario) lineaHorario.style.display = mostrarHorario ? 'flex' : 'none';
        if (lineaCoordsActuales) lineaCoordsActuales.style.display = mostrarCoordsActuales ? 'block' : 'none';
        if (lineaCoordsEmpresa) lineaCoordsEmpresa.style.display = mostrarCoordsEmpresa ? 'block' : 'none';

        // Mostrar modal
        this.modalBloqueoUbicacion.classList.add('active');
        document.body.classList.add('modal-open');
    }

    ocultarBloqueoUbicacion() {
        if (this.modalBloqueoUbicacion) {
            this.modalBloqueoUbicacion.classList.remove('active');
            document.body.classList.remove('modal-open');
        }
    }

    // ============================================
    // REGISTRAR BLOQUEO EN BACKEND (best-effort)
    // ============================================
    async _registrarBloqueoEnBackend(tipoBloqueo, mensajeBloqueo, accionIntentada = null) {
        try {
            // NOTA: El backend actual no expone un endpoint dedicado para
            // "bloqueos de ubicación". Si lo agregas en el futuro
            // (ej. POST /bloqueo-ubicacion), aquí es donde harías la llamada.
            // Por ahora solo dejamos constancia en consola.
            console.log('📤 Bloqueo detectado:', {
                tipo: tipoBloqueo,
                mensaje: mensajeBloqueo,
                accionIntentada,
                precision: this._ultimaPrecision,
                ubicacion: this._ultimaUbicacion,
                sucursalMasCercana: this._sucursalMasCercana
            });

            this._contadorBloqueos = (this._contadorBloqueos || 0) + 1;

            // TODO: cuando exista endpoint, descomentar:
            // await this.service.registrarBloqueoUbicacion({
            //     TipoBloqueo: tipoBloqueo,
            //     MensajeBloqueo: mensajeBloqueo,
            //     LatitudActual: this._ultimaUbicacion?.lat ?? null,
            //     LongitudActual: this._ultimaUbicacion?.lng ?? null,
            //     PrecisionActual: this._ultimaPrecision ?? null,
            //     IdSucursalCercana: this._sucursalMasCercana?.id ?? null,
            //     DistanciaSucursalCercana: this._sucursalMasCercana?.distancia ?? null,
            //     AccionIntentada: accionIntentada,
            //     Reintentos: this._contadorBloqueos,
            //     Dispositivo: this.esMovil ? 'MÓVIL' : 'PC',
            //     Navegador: this.esFirefox ? 'Firefox' : this.esChrome ? 'Chrome' : 'Otro'
            // });

        } catch (error) {
            console.error('❌ Error registrando bloqueo:', error);
        }
    }

    // ============================================
    // HELPERS
    // ============================================
    _delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    // ============================================
    // GETTERS (para el controller principal)
    // ============================================
    getSucursalDetectada() { return this.sucursalDetectada; }
    getUltimaUbicacion() { return this._ultimaUbicacion; }
    getUltimaPrecision() { return this._ultimaPrecision; }
    getSucursalMasCercana() { return this._sucursalMasCercana; }
    isUbicacionPermitida() { return this.ubicacionPermitida; }
    getUltimaVerificacion() { return this._ultimaVerificacion; }

    /**
     * Marca la verificación actual como exitosa (para evitar
     * re-verificar en cada clic de botón durante 5 min).
     */
    marcarVerificacionExitosa() {
        this._ultimaVerificacion = Date.now();
        this.ubicacionPermitida = true;
    }
}

// ============================================
// EXPOSICIÓN GLOBAL
// ============================================
if (typeof window !== 'undefined') {
    window.GPSController = GPSController;
}