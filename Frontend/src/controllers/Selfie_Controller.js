// ==============================================
// CONTROLLER: SelfieController
// Responsabilidad: Toda la lógica del modal de captura
//                 de selfie y la detección facial.
//
// Incluye:
//   - Apertura de cámara (frontal/trasera)
//   - Cambio de cámara (botón + dropdown)
//   - Captura con cuenta regresiva
//   - Compresión de imagen (canvas)
//   - Detección facial robusta (face-api → native → píxeles)
//
// Depende de: nada (solo navigator.mediaDevices + canvas)
// ==============================================

class SelfieController {

    constructor(config) {
        this.config = config || {};

        // ============================================
        // ESTADO DE LA CÁMARA
        // ============================================
        this.stream = null;
        this.selfieData = null;
        this.selfieTipo = null;      // 'ingreso' | 'ingreso_almuerzo' | 'salida_almuerzo' | 'salida'
        this.selfieResolve = null;
        this.selfieReject = null;
        this._selfieConfirmada = false;
        this._selfieFallida = null;

        // ============================================
        // CONTROL DE CÁMARAS
        // ============================================
        this.camarasDisponibles = [];
        this.camaraSeleccionadaId = null;
        this.facingModeActual = 'user';
        this.tieneCamaraTrasera = false;

        // ============================================
        // DETECCIÓN FACIAL
        // ============================================
        this.faceDetector = new FaceDetectorRobust();

        // ============================================
        // INTERVALO DE VERIFICACIÓN DE CÁMARA
        // ============================================
        this._cameraCheckInterval = null;

        // ============================================
        // CALLBACKS OPCIONALES
        // ============================================
        this._onErrorCallback = null;
        this._onCancelCallback = null;

        console.log('✅ SelfieController inicializado');
    }

    // ============================================
    // CONFIGURAR EVENTOS DE BOTONES DEL MODAL
    // (Tomar / Cancelar / Confirmar / Reintentar)
    // ============================================
    _configurarEventosBotones() {
        // ============================================
        // BOTÓN TOMAR FOTO
        // ============================================
        const btnTomar = document.getElementById('btnTomarSelfie');
        if (btnTomar) {
            const newBtn = btnTomar.cloneNode(true);
            btnTomar.parentNode.replaceChild(newBtn, btnTomar);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('📸 Botón Tomar Foto presionado');
                this.tomarSelfie();
            });
        }

        // ============================================
        // BOTÓN CANCELAR
        // ============================================
        const btnCancelar = document.getElementById('btnCancelarSelfie');
        if (btnCancelar) {
            const newBtn = btnCancelar.cloneNode(true);
            btnCancelar.parentNode.replaceChild(newBtn, btnCancelar);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('❌ Botón Cancelar presionado');
                this.cancelar();
            });
        }

        // ============================================
        // BOTÓN CONFIRMAR
        // ============================================
        const btnConfirmar = document.getElementById('btnConfirmarSelfie');
        if (btnConfirmar) {
            const newBtn = btnConfirmar.cloneNode(true);
            btnConfirmar.parentNode.replaceChild(newBtn, btnConfirmar);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('✅ Botón Confirmar presionado');
                this.confirmarSelfie();
            });
        }

        // ============================================
        // BOTÓN REINTENTAR
        // ============================================
        const btnReintentar = document.getElementById('btnReintentarSelfie');
        if (btnReintentar) {
            const newBtn = btnReintentar.cloneNode(true);
            btnReintentar.parentNode.replaceChild(newBtn, btnReintentar);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔄 Botón Reintentar presionado');
                this.reintentarSelfie();
            });
        }

        // ============================================
        // CLIC FUERA DEL MODAL (fondo oscuro)
        // ============================================
        const modal = document.getElementById('modalSelfie');
        if (modal) {
            modal.onclick = (e) => {
                if (e.target === modal) {
                    console.log('📸 Clic fuera del modal - cancelando');
                    this.cancelar();
                }
            };
        }

        console.log('✅ Eventos de botones del modal de selfie configurados');
    }

    /**
     * Permite al controller principal registrar callbacks opcionales
     * para los eventos de error / cancelación.
     */
    setCallbacks({ onError, onCancel } = {}) {
        if (typeof onError === 'function') this._onErrorCallback = onError;
        if (typeof onCancel === 'function') this._onCancelCallback = onCancel;
    }

    // ============================================
    // API PÚBLICA: ABRIR MODAL DE SELFIE
    // ============================================
    /**
     * Abre el modal de selfie y devuelve una promesa que resuelve
     * con la imagen Base64 confirmada, o rechaza si el usuario cancela.
     *
     * @param {string} tipo - 'ingreso' | 'ingreso_almuerzo' | 'salida_almuerzo' | 'salida'
     * @returns {Promise<string>} - Base64 de la imagen
     */
    async abrirModalSelfie(tipo) {
        return new Promise(async (resolve, reject) => {
            this.selfieTipo = tipo;
            this.selfieResolve = resolve;
            this.selfieReject = reject;
            this._selfieConfirmada = false;
            this.selfieData = null;
            this._selfieFallida = null;

            try {
                // ============================================
                // 1. INICIALIZAR DETECTOR FACIAL
                // ============================================
                if (!this.faceDetector.initialized) {
                    await this.faceDetector.init();
                }

                // ============================================
                // 2. ACTUALIZAR MENSAJE SEGÚN EL TIPO
                // ============================================
                const mensajes = {
                    'ingreso': '📸 Por favor, tome una foto para registrar su INGRESO',
                    'ingreso_almuerzo': '📸 Por favor, tome una foto para registrar el INICIO DE ALMUERZO',
                    'salida_almuerzo': '📸 Por favor, tome una foto para registrar el FIN DE ALMUERZO',
                    'salida': '📸 Por favor, tome una foto para registrar su SALIDA'
                };
                const mensajeEl = document.getElementById('selfieMensaje');
                if (mensajeEl) {
                    mensajeEl.textContent = mensajes[tipo] || 'Por favor, tome una foto';
                }

                // ============================================
                // 3. RESETEAR UI DEL MODAL
                // ============================================
                this._resetearModal();

                // ============================================
                // 4. RESETEAR VARIABLES DE CÁMARA
                // ============================================
                this.facingModeActual = 'user';
                this.camaraSeleccionadaId = null;
                this.camarasDisponibles = [];
                this.tieneCamaraTrasera = false;

                // ============================================
                // 5. INICIAR CÁMARA FRONTAL
                // ============================================
                await this._iniciarCamara('user', null);

                // ============================================
                // 6. CONFIGURAR EVENTOS DE CÁMARA
                // ============================================
                this._configurarEventosCamara();

                // ============================================
                // 6.1 CONFIGURAR EVENTOS DE BOTONES (Tomar/Cancelar/Confirmar/Reintentar)
                // ============================================
                this._configurarEventosBotones();

                // ============================================
                // 7. MOSTRAR MODAL
                // ============================================
                const modal = document.getElementById('modalSelfie');
                if (modal) modal.classList.add('active');

                // ============================================
                // 8. VERIFICAR PERIÓDICAMENTE QUE LA CÁMARA NO SE CONGELE
                // ============================================
                this._iniciarVerificacionCamara();

            } catch (error) {
                console.error('❌ Error al abrir modal de selfie:', error);
                this._notificarError(error.message || 'Error al abrir cámara');
                reject(new Error(error.message || 'Error al abrir cámara'));
            }
        });
    }

    // ============================================
    // RESETEAR MODAL
    // ============================================
    _resetearModal() {
        const btnTomar = document.getElementById('btnTomarSelfie');
        const btnReintentar = document.getElementById('btnReintentarSelfie');
        const btnConfirmar = document.getElementById('btnConfirmarSelfie');

        if (btnTomar) {
            btnTomar.style.display = 'inline-block';
            btnTomar.disabled = true;
            btnTomar.textContent = '📸 Tomar Foto';
        }
        if (btnReintentar) btnReintentar.style.display = 'none';
        if (btnConfirmar) {
            btnConfirmar.style.display = 'none';
            btnConfirmar.disabled = true;
        }

        const previewContainer = document.getElementById('previewContainer');
        if (previewContainer) {
            previewContainer.style.display = 'none';
            previewContainer.style.border = '2px solid #ddd';
        }

        const compressionProgress = document.getElementById('compressionProgress');
        if (compressionProgress) compressionProgress.style.display = 'none';

        const overlay = document.getElementById('countdownOverlay');
        if (overlay) overlay.style.display = 'none';

        const indicator = document.getElementById('faceDetectionIndicator');
        if (indicator) {
            indicator.style.display = 'none';
            indicator.textContent = '🟢 Detectando rostro...';
            indicator.style.color = 'white';
            indicator.className = '';
        }

        const btnCambiarOverlay = document.getElementById('btnCambiarCamara');
        if (btnCambiarOverlay) btnCambiarOverlay.style.display = 'none';

        const btnCambiarBtn = document.getElementById('btnCambiarCamaraBtn');
        if (btnCambiarBtn) btnCambiarBtn.style.display = 'none';

        const selectorContainer = document.getElementById('selectorCamaraContainer');
        if (selectorContainer) selectorContainer.style.display = 'none';

        this.selfieData = null;
        this._selfieFallida = null;
        this._selfieConfirmada = false;
    }

    // ============================================
    // INICIAR CÁMARA
    // ============================================
    async _iniciarCamara(facingMode = 'user', deviceId = null) {
        try {
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }

            const video = document.getElementById('videoSelfie');
            if (!video) {
                throw new Error('Elemento videoSelfie no encontrado');
            }

            // ============================================
            // CONSTRAINTS
            // ============================================
            let videoConstraints;
            if (deviceId) {
                videoConstraints = {
                    deviceId: { exact: deviceId },
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                };
                console.log(`📷 Usando cámara por deviceId: ${deviceId}`);
            } else {
                videoConstraints = {
                    facingMode: { ideal: facingMode },
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                };
                console.log(`📷 Usando facingMode: ${facingMode}`);
            }

            const constraints = { video: videoConstraints, audio: false };

            console.log('📷 Solicitando acceso a la cámara...');
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = this.stream;
            await video.play();

            this.facingModeActual = facingMode;

            const track = this.stream.getVideoTracks()[0];
            if (track) {
                const settings = track.getSettings();
                this.camaraSeleccionadaId = settings.deviceId || null;
                console.log('📷 Cámara activa:', {
                    deviceId: this.camaraSeleccionadaId,
                    facingMode: settings.facingMode || facingMode,
                    label: track.label
                });
            }

            // ============================================
            // DETECTAR CÁMARAS DISPONIBLES
            // ============================================
            await this._detectarCamaras();

            // ============================================
            // VERIFICAR QUE LA CÁMARA TENGA CONTENIDO REAL
            // ============================================
            const checkResult = await this.faceDetector.checkVideoHasContent(video);

            if (!checkResult.hasContent) {
                console.warn('⚠️ La cámara parece estar bloqueada o tapada');

                const indicator = document.getElementById('faceDetectionIndicator');
                if (indicator) {
                    indicator.textContent = '⚠️ No se detecta imagen. Verifique que no esté tapada.';
                    indicator.style.color = '#ffc107';
                    indicator.style.display = 'block';
                }

                if (this._onErrorCallback) {
                    this._onErrorCallback('No se detecta imagen de la cámara');
                }

                const btnTomar = document.getElementById('btnTomarSelfie');
                if (btnTomar) btnTomar.disabled = false;
                return;
            }

            console.log('✅ Cámara funcionando, contenido detectado');

            const indicator = document.getElementById('faceDetectionIndicator');
            if (indicator) {
                const nombreCamara = this._obtenerNombreCamaraActual();
                indicator.textContent = `🟢 ${nombreCamara} activa, posicione su rostro`;
                indicator.style.color = '#28a745';
                indicator.style.display = 'block';
            }

            const btnTomar = document.getElementById('btnTomarSelfie');
            if (btnTomar) btnTomar.disabled = false;

        } catch (error) {
            console.error('Error al iniciar cámara:', error);

            let mensajeError = '⚠️ No se pudo acceder a la cámara. ';
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                mensajeError += 'Permiso denegado. Habilite la cámara en la configuración del navegador.';
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                mensajeError += 'No se encontró una cámara en el dispositivo.';
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                mensajeError += 'La cámara está siendo usada por otra aplicación o está bloqueada.';
            } else if (error.name === 'OverconstrainedError') {
                // Fallback: intentar sin restricciones estrictas
                try {
                    this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                    const video = document.getElementById('videoSelfie');
                    video.srcObject = this.stream;
                    await video.play();
                    await this._detectarCamaras();
                    const btnTomar = document.getElementById('btnTomarSelfie');
                    if (btnTomar) btnTomar.disabled = false;
                    return;
                } catch (fallbackError) {
                    mensajeError += ' Tampoco se pudo acceder a la cámara predeterminada.';
                }
            } else {
                mensajeError += 'Error inesperado: ' + (error.message || 'Desconocido');
            }

            const indicator = document.getElementById('faceDetectionIndicator');
            if (indicator) {
                indicator.textContent = '❌ ' + mensajeError;
                indicator.style.color = '#dc3545';
                indicator.style.display = 'block';
            }

            this._notificarError(mensajeError);

            // Rechazar la promesa para que el controller principal aborte
            if (this.selfieReject) {
                this.selfieReject(new Error(mensajeError));
                this.selfieReject = null;
            }
        }
    }

    // ============================================
    // DETECTAR CÁMARAS DISPONIBLES
    // ============================================
    async _detectarCamaras() {
        try {
            if (!navigator.mediaDevices?.enumerateDevices) return;

            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');

            console.log(`📷 Cámaras detectadas: ${videoDevices.length}`);

            this.camarasDisponibles = videoDevices.map((device, index) => {
                const label = (device.label || '').toLowerCase();
                let tipo = 'desconocida';

                if (label.includes('back') || label.includes('rear') ||
                    label.includes('trasera') || label.includes('environment') ||
                    label.includes('posterior')) {
                    tipo = 'trasera';
                } else if (label.includes('front') || label.includes('user') ||
                    label.includes('frontal') || label.includes('face') ||
                    label.includes('anterior') || label.includes('selfie')) {
                    tipo = 'frontal';
                }

                return {
                    deviceId: device.deviceId,
                    label: device.label || `Cámara ${index + 1}`,
                    tipo,
                    index
                };
            });

            this.tieneCamaraTrasera = this.camarasDisponibles.some(c => c.tipo === 'trasera');

            if (!this.tieneCamaraTrasera && this.camarasDisponibles.length >= 2) {
                this.tieneCamaraTrasera = true;
                this.camarasDisponibles.forEach((cam, i) => {
                    if (cam.tipo === 'desconocida') {
                        cam.tipo = i === 0 ? 'frontal' : 'trasera';
                    }
                });
            }

            this._actualizarUICamaras();

        } catch (error) {
            console.error('❌ Error detectando cámaras:', error);
        }
    }

    _actualizarUICamaras() {
        const btnCambiarOverlay = document.getElementById('btnCambiarCamara');
        const btnCambiarBtn = document.getElementById('btnCambiarCamaraBtn');
        const selectorContainer = document.getElementById('selectorCamaraContainer');
        const selectCamara = document.getElementById('selectCamara');

        const mostrarBoton = this.camarasDisponibles.length > 1;

        if (btnCambiarOverlay) btnCambiarOverlay.style.display = mostrarBoton ? 'flex' : 'none';
        if (btnCambiarBtn) btnCambiarBtn.style.display = mostrarBoton ? 'inline-flex' : 'none';

        if (selectCamara && this.camarasDisponibles.length > 0) {
            selectCamara.innerHTML = '';

            this.camarasDisponibles.forEach((cam, index) => {
                const option = document.createElement('option');
                option.value = cam.deviceId;

                let icono = '📷';
                if (cam.tipo === 'frontal') icono = '🤳';
                else if (cam.tipo === 'trasera') icono = '📸';

                let labelMostrar = cam.label.replace(/\([^)]*\)/g, '').trim();
                if (!labelMostrar || labelMostrar.length > 40) {
                    labelMostrar = cam.tipo === 'frontal' ? 'Cámara Frontal'
                        : cam.tipo === 'trasera' ? 'Cámara Trasera'
                            : `Cámara ${index + 1}`;
                }

                option.textContent = `${icono} ${labelMostrar}`;

                if (this.camaraSeleccionadaId && cam.deviceId === this.camaraSeleccionadaId) {
                    option.selected = true;
                }

                selectCamara.appendChild(option);
            });

            if (selectorContainer) {
                selectorContainer.style.display = this.camarasDisponibles.length > 1 ? 'block' : 'none';
            }
        }
    }

    // ============================================
    // CONFIGURAR EVENTOS DE CÁMARA
    // ============================================
    _configurarEventosCamara() {
        // Botón overlay (esquina superior derecha)
        const btnCambiarOverlay = document.getElementById('btnCambiarCamara');
        if (btnCambiarOverlay) {
            const newBtn = btnCambiarOverlay.cloneNode(true);
            btnCambiarOverlay.parentNode.replaceChild(newBtn, btnCambiarOverlay);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.cambiarCamara();
            });
        }

        // Botón en la barra inferior
        const btnCambiarBtn = document.getElementById('btnCambiarCamaraBtn');
        if (btnCambiarBtn) {
            const newBtn = btnCambiarBtn.cloneNode(true);
            btnCambiarBtn.parentNode.replaceChild(newBtn, btnCambiarBtn);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.cambiarCamara();
            });
        }

        // Dropdown de selección
        const selectCamara = document.getElementById('selectCamara');
        if (selectCamara) {
            const newSelect = selectCamara.cloneNode(true);
            selectCamara.parentNode.replaceChild(newSelect, selectCamara);
            newSelect.addEventListener('change', (e) => {
                e.preventDefault();
                if (e.target.value) this.cambiarCamaraPorId(e.target.value);
            });
        }
    }

    // ============================================
    // CAMBIAR CÁMARA
    // ============================================
    async cambiarCamara() {
        if (this.camarasDisponibles.length < 2) {
            this._notificarError('No hay otras cámaras disponibles');
            return;
        }

        console.log('🔄 Cambiando cámara...');

        let nuevoFacingMode;
        if (this.facingModeActual === 'user') {
            nuevoFacingMode = 'environment';
        } else {
            nuevoFacingMode = 'user';
        }

        if (nuevoFacingMode === 'environment' && !this.tieneCamaraTrasera) {
            // No hay trasera: alternar por índice
            const indexActual = this.camarasDisponibles.findIndex(
                c => c.deviceId === this.camaraSeleccionadaId
            );
            const siguienteIndex = (indexActual + 1) % this.camarasDisponibles.length;
            const siguienteCamara = this.camarasDisponibles[siguienteIndex];

            console.log(`📷 Cambiando a: ${siguienteCamara.label}`);
            await this._reiniciarConCamara(
                siguienteCamara.deviceId,
                siguienteCamara.tipo === 'trasera' ? 'environment' : 'user'
            );
            return;
        }

        console.log(`📷 Cambiando a facingMode: ${nuevoFacingMode}`);
        await this._reiniciarConCamara(null, nuevoFacingMode);
    }

    async cambiarCamaraPorId(deviceId) {
        const camara = this.camarasDisponibles.find(c => c.deviceId === deviceId);
        if (!camara) return;

        console.log(`📷 Cambiando a cámara específica: ${camara.label}`);
        const facingMode = camara.tipo === 'trasera' ? 'environment' : 'user';
        await this._reiniciarConCamara(deviceId, facingMode);
    }

    async _reiniciarConCamara(deviceId, facingMode) {
        // Resetear preview
        const previewContainer = document.getElementById('previewContainer');
        if (previewContainer) previewContainer.style.display = 'none';

        const btnTomar = document.getElementById('btnTomarSelfie');
        const btnConfirmar = document.getElementById('btnConfirmarSelfie');
        const btnReintentar = document.getElementById('btnReintentarSelfie');

        if (btnTomar) {
            btnTomar.style.display = 'inline-block';
            btnTomar.disabled = true;
            btnTomar.textContent = '📸 Tomar Foto';
        }
        if (btnConfirmar) {
            btnConfirmar.style.display = 'none';
            btnConfirmar.disabled = true;
        }
        if (btnReintentar) btnReintentar.style.display = 'none';

        await this._iniciarCamara(facingMode, deviceId);
    }

    _obtenerNombreCamaraActual() {
        const camara = this.camarasDisponibles.find(c => c.deviceId === this.camaraSeleccionadaId);
        if (camara) {
            if (camara.tipo === 'frontal') return 'Cámara frontal';
            if (camara.tipo === 'trasera') return 'Cámara trasera';
            return camara.label || 'Cámara';
        }
        if (this.facingModeActual === 'user') return 'Cámara frontal';
        if (this.facingModeActual === 'environment') return 'Cámara trasera';
        return 'Cámara';
    }

    // ============================================
    // TOMAR SELFIE (con cuenta regresiva + validación)
    // ============================================
    async tomarSelfie() {
        const btnTomar = document.getElementById('btnTomarSelfie');
        const btnReintentar = document.getElementById('btnReintentarSelfie');

        if (!btnTomar) return;

        btnTomar.disabled = true;
        btnTomar.textContent = '⏳ Procesando...';

        const indicator = document.getElementById('faceDetectionIndicator');
        if (indicator) {
            indicator.textContent = '⏳ Analizando imagen...';
            indicator.style.color = '#ffc107';
            indicator.style.display = 'block';
        }

        // Cuenta regresiva
        const overlay = document.getElementById('countdownOverlay');
        const countdownNumber = document.getElementById('countdownNumber');
        if (overlay && countdownNumber) {
            overlay.style.display = 'flex';
            for (let i = 3; i > 0; i--) {
                countdownNumber.textContent = i;
                await this._delay(800);
            }
            overlay.style.display = 'none';
        }

        const video = document.getElementById('videoSelfie');
        const canvas = document.getElementById('canvasSelfie');
        if (!video || !canvas) {
            this._notificarError('Error al capturar la foto');
            btnTomar.disabled = false;
            btnTomar.textContent = '📸 Tomar Foto';
            return;
        }

        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = canvas.toDataURL('image/jpeg', 0.8);

        // ============================================
        // VALIDAR CON DETECCIÓN FACIAL
        // ============================================
        console.log('🔍 Validando imagen capturada...');
        const result = await this.faceDetector.detectFace(imageData);
        console.log('📊 Resultado detección:', result);

        if (!result.hasFace) {
            console.warn('❌ No se detectó rostro');

            if (indicator) {
                indicator.textContent = '❌ NO SE DETECTÓ ROSTRO. Intente nuevamente.';
                indicator.style.color = '#dc3545';
                indicator.style.display = 'block';
            }

            this._notificarError('No se detectó un rostro en la foto. Asegúrese de estar frente a la cámara.');

            const previewContainer = document.getElementById('previewContainer');
            if (previewContainer) {
                previewContainer.style.display = 'block';
                previewContainer.style.border = '3px solid #dc3545';
                const preview = document.getElementById('previewSelfie');
                if (preview) preview.src = imageData;
            }

            const btnConfirmar = document.getElementById('btnConfirmarSelfie');
            if (btnConfirmar) {
                btnConfirmar.style.display = 'none';
                btnConfirmar.disabled = true;
            }
            if (btnReintentar) btnReintentar.style.display = 'inline-block';

            btnTomar.disabled = false;
            btnTomar.textContent = '📸 Reintentar';

            this._selfieFallida = imageData;
            this.selfieData = null;
            return;
        }

        console.log(`✅ Rostro detectado (${(result.confidence * 100).toFixed(0)}%)`);

        if (indicator) {
            indicator.textContent = `✅ Rostro detectado (${(result.confidence * 100).toFixed(0)}%)`;
            indicator.style.color = '#28a745';
            indicator.style.display = 'block';
        }

        // Preview con borde verde
        const preview = document.getElementById('previewSelfie');
        const previewContainer = document.getElementById('previewContainer');
        if (preview && previewContainer) {
            preview.src = imageData;
            previewContainer.style.display = 'block';
            previewContainer.style.border = '3px solid #28a745';
        }

        // Comprimir imagen
        await this._comprimirImagen(imageData);

        this.selfieData = this.selfieData || imageData;

        if (btnTomar) btnTomar.style.display = 'none';
        if (btnReintentar) btnReintentar.style.display = 'inline-block';

        const btnConfirmar = document.getElementById('btnConfirmarSelfie');
        if (btnConfirmar) {
            btnConfirmar.style.display = 'inline-block';
            btnConfirmar.disabled = false;
            btnConfirmar.textContent = '✅ Confirmar Foto';
        }

        console.log('📸 Selfie válida - Tamaño:', this.selfieData.length);
    }

    // ============================================
    // COMPRIMIR IMAGEN
    // ============================================
    async _comprimirImagen(imageData) {
        return new Promise((resolve) => {
            const progressBar = document.getElementById('compressionBar');
            const progressContainer = document.getElementById('compressionProgress');

            if (progressContainer) progressContainer.style.display = 'block';

            let progreso = 0;
            const interval = setInterval(() => {
                progreso += 10;
                if (progressBar) progressBar.style.width = `${progreso}%`;

                if (progreso >= 100) {
                    clearInterval(interval);

                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');

                        let width = img.width;
                        let height = img.height;
                        const maxSize = 800;

                        if (width > maxSize || height > maxSize) {
                            if (width > height) {
                                height = (height / width) * maxSize;
                                width = maxSize;
                            } else {
                                width = (width / height) * maxSize;
                                height = maxSize;
                            }
                        }

                        canvas.width = Math.round(width);
                        canvas.height = Math.round(height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                        let compressedData = canvas.toDataURL('image/jpeg', 0.5);

                        // Compresión adicional si es > 500KB
                        if (compressedData.length > 500000) {
                            const smallerCanvas = document.createElement('canvas');
                            smallerCanvas.width = Math.round(width * 0.6);
                            smallerCanvas.height = Math.round(height * 0.6);
                            const ctx2 = smallerCanvas.getContext('2d');
                            ctx2.drawImage(img, 0, 0, smallerCanvas.width, smallerCanvas.height);
                            compressedData = smallerCanvas.toDataURL('image/jpeg', 0.4);
                        }

                        this.selfieData = compressedData;

                        console.log('📸 Imagen comprimida:', {
                            original: imageData.length,
                            comprimida: compressedData.length,
                            reduccion: ((1 - compressedData.length / imageData.length) * 100).toFixed(1) + '%'
                        });

                        if (progressBar) progressBar.style.width = '100%';
                        setTimeout(() => {
                            if (progressContainer) progressContainer.style.display = 'none';
                            resolve();
                        }, 500);
                    };
                    img.src = imageData;
                }
            }, 100);
        });
    }

    // ============================================
    // CONFIRMAR SELFIE
    // ============================================
    confirmarSelfie() {
        if (!this.selfieData) {
            this._notificarError('Debe tomar una foto primero');
            return;
        }

        console.log('📸 Confirmando selfie - Tamaño:', this.selfieData.length);

        const datosSelfie = this.selfieData;
        this._selfieConfirmada = true;

        this._cerrarCamara();
        const modal = document.getElementById('modalSelfie');
        if (modal) modal.classList.remove('active');

        if (this.selfieResolve) {
            this.selfieResolve(datosSelfie);
            this.selfieResolve = null;
            this.selfieReject = null;
        }
    }

    // ============================================
    // REINTENTAR SELFIE
    // ============================================
    reintentarSelfie() {
        this.selfieData = null;

        const btnTomar = document.getElementById('btnTomarSelfie');
        const btnReintentar = document.getElementById('btnReintentarSelfie');
        const btnConfirmar = document.getElementById('btnConfirmarSelfie');
        const previewContainer = document.getElementById('previewContainer');
        const compressionProgress = document.getElementById('compressionProgress');

        if (btnTomar) {
            btnTomar.style.display = 'inline-block';
            btnTomar.disabled = false;
            btnTomar.textContent = '📸 Tomar Foto';
        }
        if (btnReintentar) btnReintentar.style.display = 'none';
        if (btnConfirmar) btnConfirmar.style.display = 'none';
        if (previewContainer) previewContainer.style.display = 'none';
        if (compressionProgress) compressionProgress.style.display = 'none';

        this._iniciarCamara(this.facingModeActual, this.camaraSeleccionadaId);
    }

    // ============================================
    // CANCELAR (por botón, clic fuera, etc.)
    // ============================================
    cancelar() {
        console.log('📸 Selfie cancelada por el usuario');

        this._selfieConfirmada = false;
        this.selfieData = null;

        this._cerrarCamara();
        const modal = document.getElementById('modalSelfie');
        if (modal) modal.classList.remove('active');

        if (this.selfieReject) {
            this.selfieReject(new Error('Cancelado por el usuario'));
            this.selfieResolve = null;
            this.selfieReject = null;
        }

        if (this._onCancelCallback) {
            this._onCancelCallback();
        }
    }

    // ============================================
    // CERRAR MODAL (forzado, sin resolver/rechazar)
    // ============================================
    cerrarModalSelfie() {
        this._cerrarCamara();
        const modal = document.getElementById('modalSelfie');
        if (modal) modal.classList.remove('active');
    }

    // ============================================
    // CERRAR CÁMARA Y LIMPIAR RECURSOS
    // ============================================
    _cerrarCamara() {
        if (this._cameraCheckInterval) {
            clearInterval(this._cameraCheckInterval);
            this._cameraCheckInterval = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        const video = document.getElementById('videoSelfie');
        if (video) video.srcObject = null;

        this._resetearModal();
    }

    // ============================================
    // VERIFICAR PERIÓDICAMENTE QUE LA CÁMARA NO SE CONGELE
    // ============================================
    _iniciarVerificacionCamara() {
        if (this._cameraCheckInterval) {
            clearInterval(this._cameraCheckInterval);
        }

        this._cameraCheckInterval = setInterval(() => {
            const video = document.getElementById('videoSelfie');
            if (video && this.stream && this.stream.active) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 100;
                canvas.height = 75;
                ctx.drawImage(video, 0, 0, 100, 75);
                const imageData = ctx.getImageData(0, 0, 100, 75);
                const data = imageData.data;

                let isAllBlack = true;
                let isAllWhite = true;
                for (let i = 0; i < data.length && (isAllBlack || isAllWhite); i += 4) {
                    if (data[i] > 10 || data[i + 1] > 10 || data[i + 2] > 10) isAllBlack = false;
                    if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) isAllWhite = false;
                }

                if (isAllBlack || isAllWhite) {
                    console.warn('⚠️ La cámara parece estar bloqueada o tapada');
                    const indicator = document.getElementById('faceDetectionIndicator');
                    if (indicator) {
                        indicator.textContent = '⚠️ La cámara no está capturando imagen.';
                        indicator.style.color = '#ffc107';
                        indicator.style.display = 'block';
                    }
                }
            }
        }, 3000);
    }

    // ============================================
    // HELPERS
    // ============================================
    _delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    _notificarError(mensaje) {
        console.warn('⚠️ SelfieController:', mensaje);
        if (this._onErrorCallback) {
            this._onErrorCallback(mensaje);
        }
    }

    // ============================================
    // GETTERS
    // ============================================
    getSelfieData() { return this.selfieData; }
    getTipo() { return this.selfieTipo; }
    estaConfirmada() { return this._selfieConfirmada; }
}

// ==============================================
// CLASE AUXILIAR: DETECTOR FACIAL ROBUSTO
// Estrategia en cascada:
//   1. face-api.js (más preciso, si está disponible)
//   2. FaceDetector nativo del navegador
//   3. Análisis de píxeles (fallback universal)
// ==============================================
class FaceDetectorRobust {

    constructor() {
        this.initialized = false;
        this.initializing = false;
        this.detectionMethod = null;  // 'faceapi' | 'native' | 'fallback'
        this.faceapiReady = false;
        this.fallbackDetector = null;
        this._initPromise = null;
    }

    async init() {
        if (this.initialized) return true;
        if (this.initializing) return this._initPromise;

        this.initializing = true;
        this._initPromise = this._doInit();
        return this._initPromise;
    }

    async _doInit() {
        try {
            console.log('🔍 Inicializando detector facial...');

            // ============================================
            // 1. Intentar face-api.js
            // ============================================
            if (typeof faceapi !== 'undefined') {
                const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
                try {
                    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
                    console.log('✅ Modelos face-api cargados');
                    this.faceapiReady = true;
                    this.detectionMethod = 'faceapi';
                    this.initialized = true;
                    this.initializing = false;
                    return true;
                } catch (error) {
                    console.warn('⚠️ Error cargando face-api, usando fallback:', error);
                    this.faceapiReady = false;
                }
            }

            // ============================================
            // 2. Intentar FaceDetector nativo
            // ============================================
            if (typeof FaceDetector !== 'undefined') {
                this.fallbackDetector = new FaceDetector({
                    maxDetectedFaces: 1,
                    fastMode: true
                });
                console.log('✅ Usando FaceDetector nativo');
                this.detectionMethod = 'native';
                this.initialized = true;
                this.initializing = false;
                return true;
            }

            // ============================================
            // 3. Fallback universal (análisis de píxeles)
            // ============================================
            console.log('⚠️ Usando análisis de píxeles como fallback');
            this.detectionMethod = 'fallback';
            this.initialized = true;
            this.initializing = false;
            return true;

        } catch (error) {
            console.error('❌ Error inicializando detector:', error);
            this.detectionMethod = 'fallback';
            this.initialized = true;
            this.initializing = false;
            return true;
        }
    }

    async detectFace(imageData) {
        try {
            if (!this.initialized) await this.init();

            const img = await this._loadImage(imageData);

            // ============================================
            // MÉTODO 1: face-api.js
            // ============================================
            if (this.detectionMethod === 'faceapi' && this.faceapiReady) {
                try {
                    const detections = await faceapi.detectAllFaces(
                        img,
                        new faceapi.TinyFaceDetectorOptions({
                            inputSize: 224,
                            scoreThreshold: 0.5
                        })
                    );

                    const hasFace = detections && detections.length > 0;
                    console.log(`📸 face-api: ${hasFace ? '✅' : '❌'} ${detections?.length || 0} rostros`);

                    if (hasFace) {
                        const confidence = detections[0].score || 0;
                        if (confidence < 0.5) {
                            return { hasFace: false, confidence, method: 'faceapi' };
                        }
                        return { hasFace: true, confidence, method: 'faceapi' };
                    }
                    return { hasFace: false, confidence: 0, method: 'faceapi' };
                } catch (error) {
                    console.warn('⚠️ Error en face-api, probando siguiente método:', error);
                }
            }

            // ============================================
            // MÉTODO 2: FaceDetector nativo
            // ============================================
            if ((this.detectionMethod === 'native' || this.detectionMethod === 'faceapi')
                && this.fallbackDetector) {
                try {
                    const faces = await this.fallbackDetector.detect(img);
                    const hasFace = faces && faces.length > 0;
                    console.log(`📸 FaceDetector: ${hasFace ? '✅' : '❌'} ${faces?.length || 0} rostros`);
                    return { hasFace, confidence: hasFace ? 1 : 0, method: 'native' };
                } catch (error) {
                    console.warn('⚠️ Error en FaceDetector, usando fallback:', error);
                }
            }

            // ============================================
            // MÉTODO 3: Fallback (píxeles)
            // ============================================
            return this._detectFaceFallback(img);

        } catch (error) {
            console.error('❌ Error en detección facial:', error);
            return { hasFace: false, confidence: 0, method: 'error' };
        }
    }

    _detectFaceFallback(img) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const size = 200;
            canvas.width = size;
            canvas.height = size * (img.height / img.width);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Brillo general
            let totalBrightness = 0;
            let minBrightness = 255;
            let maxBrightness = 0;
            let pixelCount = 0;

            for (let i = 0; i < data.length; i += 4) {
                const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                totalBrightness += brightness;
                pixelCount++;
                if (brightness < minBrightness) minBrightness = brightness;
                if (brightness > maxBrightness) maxBrightness = brightness;
            }

            const avgBrightness = totalBrightness / pixelCount;
            const brightnessRange = maxBrightness - minBrightness;

            if (brightnessRange < 30 || avgBrightness < 15 || avgBrightness > 245) {
                resolve({ hasFace: false, confidence: 0, method: 'fallback' });
                return;
            }

            // Detección de píxeles de piel
            let skinPixels = 0;
            const skinThreshold = 0.10;

            for (let i = 0; i < data.length; i += 4) {
                if (this._isSkinColor(data[i], data[i + 1], data[i + 2])) skinPixels++;
            }

            const skinPercentage = skinPixels / (data.length / 4);

            // Detección de forma ovalada
            const hasFaceShape = this._detectOvalShape(data, canvas.width, canvas.height);

            const hasFace = skinPercentage >= skinThreshold || hasFaceShape;

            let confidence = 0;
            if (hasFace) {
                confidence = Math.min(
                    (skinPercentage / skinThreshold) * 0.7 + (hasFaceShape ? 0.3 : 0),
                    1.0
                );
            }

            console.log(`📸 Fallback: ${hasFace ? '✅' : '❌'} (piel ${(skinPercentage * 100).toFixed(1)}%, forma ${hasFaceShape})`);

            resolve({
                hasFace,
                confidence,
                method: 'fallback',
                details: { skinPercentage, hasFaceShape, avgBrightness, brightnessRange }
            });
        });
    }

    _isSkinColor(r, g, b) {
        const sum = r + g + b;
        if (sum === 0) return false;

        const rNorm = r / sum;
        const gNorm = g / sum;
        const bNorm = b / sum;

        const ranges = [
            { rMin: 0.35, rMax: 0.55, gMin: 0.25, gMax: 0.40, bMin: 0.15, bMax: 0.30 },
            { rMin: 0.40, rMax: 0.58, gMin: 0.28, gMax: 0.42, bMin: 0.18, bMax: 0.32 },
            { rMin: 0.42, rMax: 0.60, gMin: 0.30, gMax: 0.45, bMin: 0.20, bMax: 0.35 }
        ];

        for (const range of ranges) {
            if (rNorm >= range.rMin && rNorm <= range.rMax &&
                gNorm >= range.gMin && gNorm <= range.gMax &&
                bNorm >= range.bMin && bNorm <= range.bMax) {
                return true;
            }
        }
        return false;
    }

    _detectOvalShape(data, width, height) {
        const centerX = width / 2;
        const centerY = height / 2;
        const radiusX = width * 0.3;
        const radiusY = height * 0.35;

        let centerPixels = 0;
        let totalPixels = 0;

        for (let y = 0; y < height; y += 4) {
            for (let x = 0; x < width; x += 4) {
                const idx = (y * width + x) * 4;
                if (idx >= data.length) continue;

                const brightness = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                totalPixels++;

                const dx = (x - centerX) / radiusX;
                const dy = (y - centerY) / radiusY;

                if (dx * dx + dy * dy <= 1) {
                    if (brightness > 30 && brightness < 225) centerPixels++;
                }
            }
        }

        const centerPercentage = totalPixels > 0 ? centerPixels / totalPixels : 0;
        return centerPercentage > 0.25;
    }

    _loadImage(imageData) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Error cargando imagen'));
            img.src = imageData;
        });
    }

    async checkVideoHasContent(videoElement) {
        if (!videoElement || videoElement.readyState < 2) {
            return { hasContent: false, reason: 'Video no listo' };
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const width = videoElement.videoWidth || 640;
        const height = videoElement.videoHeight || 480;

        if (width === 0 || height === 0) {
            return { hasContent: false, reason: 'Dimensiones cero' };
        }

        canvas.width = 100;
        canvas.height = 75;
        ctx.drawImage(videoElement, 0, 0, 100, 75);

        const imageData = ctx.getImageData(0, 0, 100, 75);
        const data = imageData.data;

        let totalBrightness = 0;
        let pixelCount = 0;
        let minBrightness = 255;
        let maxBrightness = 0;

        for (let i = 0; i < data.length; i += 4) {
            const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            totalBrightness += brightness;
            pixelCount++;
            if (brightness < minBrightness) minBrightness = brightness;
            if (brightness > maxBrightness) maxBrightness = brightness;
        }

        const avgBrightness = totalBrightness / pixelCount;
        const brightnessRange = maxBrightness - minBrightness;

        const hasContent = brightnessRange > 20 && avgBrightness > 15 && avgBrightness < 245;

        return {
            hasContent,
            avgBrightness,
            brightnessRange,
            reason: hasContent ? 'OK' : 'Sin contenido válido'
        };
    }
}

// ============================================
// EXPOSICIÓN GLOBAL
// ============================================
if (typeof window !== 'undefined') {
    window.SelfieController = SelfieController;
    window.FaceDetectorRobust = FaceDetectorRobust;
}