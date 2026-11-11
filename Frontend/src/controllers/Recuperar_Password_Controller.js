// ==============================================
// CONTROLLER: RecuperarPasswordController (modal en Login)
// Depende de: PasswordResetService
// ==============================================

class RecuperarPasswordController {

    constructor(config) {
        this.config = config || {};
        this.service = new PasswordResetService(this.config);   // ← antes: model
        this.modal = null;
        this.enviando = false;

        this.init();
    }

    init() {
        this.crearModal();
        this.configurarEventos();
    }

    crearModal() {
        if (document.getElementById('modalRecuperarPassword')) {
            this.modal = document.getElementById('modalRecuperarPassword');
            return;
        }

        const modalHTML = `
            <div id="modalRecuperarPassword" class="modal-recuperar" style="display: none;">
                <div class="modal-recuperar-content">
                    <div class="modal-recuperar-header">
                        <h3><i class="fas fa-key"></i> Recuperar Contraseña</h3>
                        <span class="modal-recuperar-close">&times;</span>
                    </div>
                    <div class="modal-recuperar-body">
                        <p class="modal-recuperar-desc">
                            Ingrese su <strong>correo electrónico</strong> o <strong>nombre de usuario</strong>
                            y le enviaremos un enlace a su correo corporativo para restablecer su contraseña.
                        </p>
                        <div class="input-group-recuperar">
                            <label for="identificadorRecuperar">
                                <i class="fas fa-envelope"></i> Correo o Usuario
                            </label>
                            <input
                                type="text"
                                id="identificadorRecuperar"
                                placeholder="ejemplo@peruroutes.com o usuario123"
                                autocomplete="off"
                            />
                        </div>
                        <div id="mensajeRecuperar" class="message-recuperar"></div>
                    </div>
                    <div class="modal-recuperar-footer">
                        <button id="btnCancelarRecuperar" class="btn-modal-secondary">Cancelar</button>
                        <button id="btnEnviarRecuperar" class="btn-modal-primary">
                            <i class="fas fa-paper-plane"></i> Enviar Enlace
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('modalRecuperarPassword');
        this.agregarEstilos();
    }

    agregarEstilos() {
        if (document.getElementById('estilos-modal-recuperar')) return;

        const estilos = `
            <style id="estilos-modal-recuperar">
                .modal-recuperar {
                    position: fixed; inset: 0; z-index: 10000;
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(4px);
                    display: flex; align-items: center; justify-content: center;
                    padding: 20px;
                    animation: fadeInModal 0.3s ease;
                }
                @keyframes fadeInModal { from { opacity: 0; } to { opacity: 1; } }

                .modal-recuperar-content {
                    background: white; border-radius: 20px;
                    width: 100%; max-width: 480px;
                    box-shadow: 0 25px 60px rgba(0,0,0,0.3);
                    border-top: 5px solid #CC0000;
                    overflow: hidden;
                }

                .modal-recuperar-header {
                    padding: 20px 25px;
                    border-bottom: 2px solid #f0f0f0;
                    display: flex; justify-content: space-between; align-items: center;
                    background: #fafafa;
                }

                .modal-recuperar-header h3 {
                    margin: 0; color: #1a1a2e; font-size: 18px;
                    display: flex; align-items: center; gap: 10px;
                }
                .modal-recuperar-header h3 i { color: #CC0000; }

                .modal-recuperar-close {
                    font-size: 28px; color: #adb5bd; cursor: pointer;
                    background: none; border: none; line-height: 1;
                    transition: all 0.3s;
                }
                .modal-recuperar-close:hover { color: #CC0000; transform: rotate(90deg); }

                .modal-recuperar-body { padding: 25px; }

                .modal-recuperar-desc {
                    color: #6c757d; font-size: 14px; margin-bottom: 20px;
                    line-height: 1.5;
                }

                .input-group-recuperar { margin-bottom: 15px; }

                .input-group-recuperar label {
                    display: block; color: #1a1a2e; font-weight: 600;
                    font-size: 13px; margin-bottom: 8px;
                }
                .input-group-recuperar label i { color: #CC0000; margin-right: 6px; }

                .input-group-recuperar input {
                    width: 100%; padding: 13px 16px;
                    border: 2px solid #e8e8e8; border-radius: 12px;
                    font-size: 14px; background: #fafafa;
                    font-family: inherit; transition: all 0.3s;
                }
                .input-group-recuperar input:focus {
                    outline: none; border-color: #CC0000;
                    box-shadow: 0 0 0 4px rgba(204,0,0,0.1);
                    background: white;
                }

                .message-recuperar {
                    margin-top: 15px; padding: 12px 15px;
                    border-radius: 10px; font-size: 13px;
                    display: none; font-weight: 500;
                }
                .message-recuperar.show { display: block; }
                .message-recuperar.error { background: #f8d7da; color: #721c24; border-left: 4px solid #dc3545; }
                .message-recuperar.success { background: #d4edda; color: #155724; border-left: 4px solid #28a745; }
                .message-recuperar.warning { background: #fff3cd; color: #856404; border-left: 4px solid #ffc107; }
                .message-recuperar.info { background: #d1ecf1; color: #0c5460; border-left: 4px solid #17a2b8; }

                .modal-recuperar-footer {
                    padding: 18px 25px; border-top: 2px solid #f0f0f0;
                    background: #fafafa; display: flex; justify-content: flex-end; gap: 12px;
                }

                .btn-modal-secondary, .btn-modal-primary {
                    padding: 10px 22px; border: none; border-radius: 10px;
                    cursor: pointer; font-weight: 600; font-size: 14px;
                    display: inline-flex; align-items: center; gap: 8px;
                    font-family: inherit; transition: all 0.3s;
                }

                .btn-modal-secondary { background: #e9ecef; color: #495057; }
                .btn-modal-secondary:hover { background: #dee2e6; }

                .btn-modal-primary {
                    background: linear-gradient(135deg, #CC0000 0%, #8B0000 100%);
                    color: white;
                    box-shadow: 0 4px 12px rgba(204,0,0,0.25);
                }
                .btn-modal-primary:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px rgba(204,0,0,0.35);
                }
                .btn-modal-primary:disabled { opacity: 0.6; cursor: not-allowed; }

                @media (max-width: 480px) {
                    .modal-recuperar-footer { flex-direction: column-reverse; }
                    .modal-recuperar-footer button { width: 100%; justify-content: center; }
                }
            </style>
        `;
        document.head.insertAdjacentHTML('beforeend', estilos);
    }

    configurarEventos() {
        const forgotLink = document.getElementById('forgotPassword');
        if (forgotLink) {
            forgotLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.abrirModal();
            });
        }

        const closeBtn = document.querySelector('#modalRecuperarPassword .modal-recuperar-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this.cerrarModal());

        const cancelBtn = document.getElementById('btnCancelarRecuperar');
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.cerrarModal());

        const sendBtn = document.getElementById('btnEnviarRecuperar');
        if (sendBtn) sendBtn.addEventListener('click', () => this.enviarSolicitud());

        const input = document.getElementById('identificadorRecuperar');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.enviarSolicitud();
                }
            });
        }

        // Cerrar al hacer click fuera del modal
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.cerrarModal();
            });
        }
    }

    abrirModal() {
        this.modal.style.display = 'flex';

        const usernameInput = document.getElementById('username');
        const identificadorInput = document.getElementById('identificadorRecuperar');
        if (usernameInput && usernameInput.value.trim() && identificadorInput) {
            identificadorInput.value = usernameInput.value.trim();
        }

        const msgBox = document.getElementById('mensajeRecuperar');
        if (msgBox) {
            msgBox.className = 'message-recuperar';
            msgBox.textContent = '';
        }

        const btn = document.getElementById('btnEnviarRecuperar');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Enlace';
        }

        this.enviando = false;

        setTimeout(() => {
            const el = document.getElementById('identificadorRecuperar');
            if (el) el.focus();
        }, 100);
    }

    cerrarModal() {
        if (this.modal) this.modal.style.display = 'none';
    }

    async enviarSolicitud() {
        if (this.enviando) return;

        const identificador = document.getElementById('identificadorRecuperar').value.trim();
        const msgBox = document.getElementById('mensajeRecuperar');
        const btn = document.getElementById('btnEnviarRecuperar');

        if (!identificador) {
            msgBox.className = 'message-recuperar error show';
            msgBox.innerHTML = 'Ingrese su correo o nombre de usuario';
            return;
        }

        this.enviando = true;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        msgBox.className = 'message-recuperar';
        msgBox.textContent = '';

        const resultado = await this.service.solicitarEnlace(identificador);

        if (resultado.success) {
            msgBox.className = 'message-recuperar success show';
            msgBox.innerHTML = `✅ ${resultado.message || 'Si el correo está registrado, recibirá un enlace en breve.'}`;
            setTimeout(() => this.cerrarModal(), 6000);
        } else {
            // Distinguir rate limit (warning) vs error
            const esRateLimit = (resultado.error || '').toLowerCase().includes('demasiadas');
            msgBox.className = `message-recuperar ${esRateLimit ? 'warning' : 'error'} show`;
            msgBox.innerHTML = `❌ ${resultado.error || 'Error al enviar la solicitud'}`;
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Enlace';
        }

        this.enviando = false;
    }
}