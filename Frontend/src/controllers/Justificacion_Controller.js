// ==============================================
// CONTROLLER: JustificacionController
// Responsabilidad: Modales de justificación de tardanza
//                 y evidencia asociada.
//
// Incluye:
//   - Modal de justificación (textarea + evidencia opcional)
//   - Modal de confirmación de omisión
//   - Subida / preview / eliminación de archivo de evidencia
//
// API pública:
//   - abrirModalJustificacion(tipo, horaEsperada, horaActual)
//       → Promise<{ accion: 'guardar'|'omitir', observacion, evidencia }>
//   - cerrarModalJustificacion()
//   - resetear()
//
// Depende de: RegistroAsistenciaService
// ==============================================

class JustificacionController {

    constructor(config, registroService) {
        this.config = config || {};
        this.service = registroService;

        // ============================================
        // ESTADO DEL MODAL
        // ============================================
        this._resolve = null;
        this._reject = null;
        this._procesando = false;

        this.tipoActual = null;        // 'ingreso' | 'ingreso_almuerzo' | 'salida_almuerzo'
        this.horaEsperada = null;
        this.horaActual = null;

        // ============================================
        // EVIDENCIA DE TARDANZA (archivo adjunto)
        // ============================================
        this.evidenciaData = null;     // Base64
        this.evidenciaTipo = null;     // 'jpg' | 'png' | 'pdf'
        this.evidenciaNombre = null;

        // ============================================
        // CALLBACKS OPCIONALES
        // ============================================
        this._onCancelCallback = null;
        this._onErrorCallback = null;

        // ============================================
        // REFERENCIAS DOM
        // ============================================
        this._cachearDOM();
        this._configurarEventos();

        console.log('✅ JustificacionController inicializado');
    }

    // ============================================
    // CACHEAR DOM
    // ============================================
    _cachearDOM() {
        // Modal de justificación
        this.modalJustificacion = document.getElementById('modalJustificacion');
        this.modalTitulo = document.getElementById('modalJustificacionTitulo');
        this.modalMensaje = document.getElementById('modalJustificacionMensaje');
        this.observacionTextarea = document.getElementById('observacion');

        // Modal de confirmación de omisión
        this.modalConfirmarOmitir = document.getElementById('modalConfirmarOmitir');

        // Evidencia
        this.btnSubirEvidencia = document.getElementById('btnSubirEvidenciaTardanza');
        this.inputEvidencia = document.getElementById('inputEvidenciaTardanza');
        this.btnEliminarEvidencia = document.getElementById('btnEliminarEvidenciaTardanza');
        this.nombreArchivoEvidencia = document.getElementById('nombreArchivoEvidenciaTardanza');
        this.previewEvidencia = document.getElementById('previewEvidenciaTardanza');

        // Botones del modal de justificación
        this.btnGuardarJustificacion = document.getElementById('btnGuardarJustificacion');
        this.btnOmitirJustificacion = document.getElementById('btnOmitirJustificacion');
        this.btnCancelarJustificacion = document.getElementById('btnCancelarJustificacion');

        // Botones del modal de omisión
        this.btnCancelarOmitir = document.getElementById('btnCancelarOmitir');
        this.btnConfirmarOmitir = document.getElementById('btnConfirmarOmitir');
    }

    // ============================================
    // CONFIGURAR EVENTOS
    // ============================================
    _configurarEventos() {
        // ---- Modal de justificación ----
        if (this.btnGuardarJustificacion) {
            this.btnGuardarJustificacion.onclick = () => this._onGuardar();
        }
        if (this.btnOmitirJustificacion) {
            this.btnOmitirJustificacion.onclick = () => this._onOmitir();
        }
        if (this.btnCancelarJustificacion) {
            this.btnCancelarJustificacion.onclick = () => this._onCancelar();
        }

        // ---- Modal de confirmación de omisión ----
        if (this.btnCancelarOmitir) {
            this.btnCancelarOmitir.onclick = () => this._cerrarModalConfirmarOmitir();
        }
        if (this.btnConfirmarOmitir) {
            this.btnConfirmarOmitir.onclick = () => this._onConfirmarOmitir();
        }

        // ---- Evidencia ----
        if (this.btnSubirEvidencia) {
            this.btnSubirEvidencia.onclick = () => {
                if (this.inputEvidencia) this.inputEvidencia.click();
            };
        }
        if (this.inputEvidencia) {
            this.inputEvidencia.onchange = (e) => this._onArchivoSeleccionado(e);
        }
        if (this.btnEliminarEvidencia) {
            this.btnEliminarEvidencia.onclick = () => this._onEliminarEvidencia();
        }
    }

    // ============================================
    // CALLBACKS EXTERNOS
    // ============================================
    setCallbacks({ onCancel, onError } = {}) {
        if (typeof onCancel === 'function') this._onCancelCallback = onCancel;
        if (typeof onError === 'function') this._onErrorCallback = onError;
    }

    // ============================================
    // API PÚBLICA: ABRIR MODAL DE JUSTIFICACIÓN
    // ============================================
    /**
     * Abre el modal de justificación y devuelve una promesa que resuelve con:
     *   { accion: 'guardar', observacion, evidencia }
     *   { accion: 'omitir' }
     *
     * Si el usuario cancela, la promesa se rechaza.
     *
     * @param {string} tipo - 'ingreso' | 'ingreso_almuerzo' | 'salida_almuerzo'
     * @param {string} horaEsperada - 'HH:MM'
     * @param {string} horaActual - 'HH:MM'
     * @returns {Promise<{ accion: 'guardar'|'omitir', observacion?: string, evidencia?: object }>}
     */
    abrirModalJustificacion(tipo, horaEsperada, horaActual) {
        return new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
            this._procesando = false;

            this.tipoActual = tipo;
            this.horaEsperada = horaEsperada;
            this.horaActual = horaActual;

            // Limpiar estado previo
            this._limpiarFormulario();
            this._limpiarEvidencia();

            // Configurar título y mensaje según tipo
            this._configurarMensajeModal(tipo, horaEsperada, horaActual);

            // Mostrar modal
            if (this.modalJustificacion) {
                this.modalJustificacion.classList.add('active');
            }

            // Focus en el textarea
            setTimeout(() => {
                if (this.observacionTextarea) this.observacionTextarea.focus();
            }, 100);
        });
    }

    _configurarMensajeModal(tipo, horaEsperada, horaActual) {
        const configuraciones = {
            'ingreso': {
                titulo: '<i class="fas fa-exclamation-triangle"></i> Justificación de Tardanza',
                mensaje: `⚠️ Ha marcado su ingreso fuera del horario establecido (esperado: ${horaEsperada || '--:--'}). Por favor, justifique el motivo:`
            },
            'ingreso_almuerzo': {
                titulo: '<i class="fas fa-exclamation-triangle"></i> Tardanza en Ingreso de Almuerzo',
                mensaje: `⚠️ Ha marcado su ingreso de almuerzo fuera del horario establecido (${horaEsperada || '--:--'}). Por favor, justifique el motivo:`
            },
            'salida_almuerzo': {
                titulo: '<i class="fas fa-exclamation-triangle"></i> Exceso en Salida de Almuerzo',
                mensaje: `⚠️ Ha excedido el tiempo de almuerzo. Hora esperada de salida: ${horaEsperada || '--:--'}. Por favor, justifique el motivo:`
            }
        };

        const cfg = configuraciones[tipo] || configuraciones.ingreso;

        if (this.modalTitulo) this.modalTitulo.innerHTML = cfg.titulo;
        if (this.modalMensaje) this.modalMensaje.textContent = cfg.mensaje;
    }

    // ============================================
    // GUARDAR JUSTIFICACIÓN
    // ============================================
    _onGuardar() {
        if (this._procesando) return;

        const observacion = this.observacionTextarea?.value.trim() || '';

        if (!observacion) {
            if (this._onErrorCallback) {
                this._onErrorCallback('Por favor, escriba una justificación antes de guardar.');
            }
            if (this.observacionTextarea) this.observacionTextarea.focus();
            return;
        }

        this._procesando = true;

        const resultado = {
            accion: 'guardar',
            observacion,
            evidencia: this.evidenciaData ? {
                data: this.evidenciaData,
                tipo: this.evidenciaTipo,
                nombre: this.evidenciaNombre
            } : null
        };

        this._cerrarModalJustificacion();

        if (this._resolve) {
            this._resolve(resultado);
            this._resolve = null;
            this._reject = null;
        }
    }

    // ============================================
    // OMITIR JUSTIFICACIÓN (con confirmación)
    // ============================================
    _onOmitir() {
        if (this._procesando) return;

        // Abrir modal de confirmación
        if (this.modalConfirmarOmitir) {
            this.modalConfirmarOmitir.classList.add('active');
        }
    }

    _onConfirmarOmitir() {
        this._procesando = true;

        this._cerrarModalConfirmarOmitir();
        this._cerrarModalJustificacion();

        if (this._resolve) {
            this._resolve({ accion: 'omitir' });
            this._resolve = null;
            this._reject = null;
        }
    }

    _cerrarModalConfirmarOmitir() {
        if (this.modalConfirmarOmitir) {
            this.modalConfirmarOmitir.classList.remove('active');
        }
    }

    // ============================================
    // CANCELAR
    // ============================================
    _onCancelar() {
        console.log('📋 Justificación cancelada por el usuario');

        this._cerrarModalJustificacion();
        this._limpiarFormulario();
        this._limpiarEvidencia();

        if (this._reject) {
            this._reject(new Error('Cancelado por el usuario'));
            this._resolve = null;
            this._reject = null;
        }

        if (this._onCancelCallback) {
            this._onCancelCallback();
        }
    }

    _cerrarModalJustificacion() {
        if (this.modalJustificacion) {
            this.modalJustificacion.classList.remove('active');
        }
    }

    // ============================================
    // MANEJO DE EVIDENCIA (archivo adjunto)
    // ============================================
    _onArchivoSeleccionado(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        console.log('📁 Archivo seleccionado:', file.name, 'Tipo:', file.type, 'Tamaño:', file.size);

        // ============================================
        // VALIDAR TIPO
        // ============================================
        const tiposPermitidos = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (!tiposPermitidos.includes(file.type)) {
            if (this._onErrorCallback) {
                this._onErrorCallback('Solo se permiten archivos JPG, PNG o PDF');
            }
            if (this.inputEvidencia) this.inputEvidencia.value = '';
            return;
        }

        // ============================================
        // VALIDAR TAMAÑO (5MB)
        // ============================================
        if (file.size > 5 * 1024 * 1024) {
            if (this._onErrorCallback) {
                this._onErrorCallback('El archivo no debe exceder los 5MB');
            }
            if (this.inputEvidencia) this.inputEvidencia.value = '';
            return;
        }

        // ============================================
        // LEER COMO BASE64
        // ============================================
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                this.evidenciaData = e.target.result;
                this.evidenciaTipo = this._detectarTipoArchivo(file.type);
                this.evidenciaNombre = file.name;

                console.log('📸 Evidencia cargada:', {
                    nombre: file.name,
                    tipo: this.evidenciaTipo,
                    tamaño: file.size
                });

                this._renderizarPreviewEvidencia(file, e.target.result);
                this._actualizarNombreArchivo(file);

                if (this.btnEliminarEvidencia) {
                    this.btnEliminarEvidencia.style.display = 'inline-block';
                }

            } catch (error) {
                console.error('Error procesando archivo:', error);
                if (this._onErrorCallback) {
                    this._onErrorCallback('Error al procesar el archivo');
                }
                if (this.inputEvidencia) this.inputEvidencia.value = '';
            }
        };

        reader.onerror = () => {
            if (this._onErrorCallback) {
                this._onErrorCallback('Error al leer el archivo');
            }
            if (this.inputEvidencia) this.inputEvidencia.value = '';
        };

        reader.readAsDataURL(file);
    }

    _detectarTipoArchivo(mimeType) {
        if (mimeType.includes('pdf')) return 'pdf';
        if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
        if (mimeType.includes('png')) return 'png';
        return 'pdf';
    }

    _renderizarPreviewEvidencia(file, dataUrl) {
        if (!this.previewEvidencia) return;

        if (file.type.startsWith('image/')) {
            this.previewEvidencia.innerHTML = `
                <img src="${dataUrl}" style="max-width: 200px; max-height: 150px; border-radius: 8px; border: 2px solid #28a745;">
                <p style="font-size: 12px; color: #28a745; margin-top: 5px;">
                    <i class="fas fa-check-circle"></i> Imagen cargada
                </p>
            `;
            this.previewEvidencia.style.display = 'block';
        } else if (file.type === 'application/pdf') {
            this.previewEvidencia.innerHTML = `
                <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; border: 2px solid #28a745; text-align: center;">
                    <i class="fas fa-file-pdf" style="font-size: 40px; color: #dc3545;"></i>
                    <p style="font-size: 12px; color: #28a745; margin-top: 5px;">
                        <i class="fas fa-check-circle"></i> PDF cargado
                    </p>
                </div>
            `;
            this.previewEvidencia.style.display = 'block';
        }
    }

    _actualizarNombreArchivo(file) {
        if (!this.nombreArchivoEvidencia) return;

        let icono = '📄';
        if (file.type.includes('pdf')) icono = '📄';
        else if (file.type.includes('image')) icono = '🖼️';

        this.nombreArchivoEvidencia.textContent =
            `${icono} ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        this.nombreArchivoEvidencia.style.color = '#28a745';
    }

    _onEliminarEvidencia() {
        console.log('🗑️ Eliminando evidencia');
        this._limpiarEvidencia();
    }

    _limpiarEvidencia() {
        this.evidenciaData = null;
        this.evidenciaTipo = null;
        this.evidenciaNombre = null;

        if (this.inputEvidencia) this.inputEvidencia.value = '';

        if (this.nombreArchivoEvidencia) {
            this.nombreArchivoEvidencia.textContent = 'Ningún archivo seleccionado';
            this.nombreArchivoEvidencia.style.color = '#6c757d';
        }

        if (this.previewEvidencia) {
            this.previewEvidencia.style.display = 'none';
            this.previewEvidencia.innerHTML = '';
        }

        if (this.btnEliminarEvidencia) {
            this.btnEliminarEvidencia.style.display = 'none';
        }
    }

    _limpiarFormulario() {
        if (this.observacionTextarea) {
            this.observacionTextarea.value = '';
        }
    }

    // ============================================
    // API PÚBLICA: RESET
    // ============================================
    resetear() {
        this._cerrarModalJustificacion();
        this._cerrarModalConfirmarOmitir();
        this._limpiarFormulario();
        this._limpiarEvidencia();

        this._procesando = false;
        this._resolve = null;
        this._reject = null;
        this.tipoActual = null;
        this.horaEsperada = null;
        this.horaActual = null;
    }

    // ============================================
    // HELPERS DE NEGOCIO (opcional)
    // ============================================
    /**
     * Devuelve el TipoTardanza que espera el backend, según el tipo
     * de marcación. El backend resuelve el IdTipoJustificacion por
     * la descripción.
     */
    getTipoTardanzaBackend(tipo) {
        const map = {
            'ingreso': 'TARDANZA - INGRESO',
            'ingreso_almuerzo': 'TARDANZA - INGRESO ALMUERZO',
            'salida_almuerzo': 'EXCESO - SALIDA ALMUERZO'
        };
        return map[tipo] || 'TARDANZA - INGRESO';
    }

    /**
     * Construye el payload que espera `POST /justificaciones` para
     * guardar la evidencia de tardanza.
     *
     * @param {number} idMarcacion
     * @param {object} evidencia  // { data, tipo, nombre }
     * @returns {object}
     */
    construirPayloadEvidenciaTardanza(idMarcacion, evidencia) {
        if (!evidencia || !evidencia.data) return null;

        return {
            IdMarcacion: idMarcacion,
            TipoTardanza: this.getTipoTardanzaBackend(this.tipoActual),
            ArchivoEvidencia: evidencia.data,
            TipoArchivo: evidencia.tipo
        };
    }

    // ============================================
    // GETTERS
    // ============================================
    getTipoActual() { return this.tipoActual; }
    tieneEvidencia() { return !!this.evidenciaData; }
}

// ============================================
// EXPOSICIÓN GLOBAL
// ============================================
if (typeof window !== 'undefined') {
    window.JustificacionController = JustificacionController;
}