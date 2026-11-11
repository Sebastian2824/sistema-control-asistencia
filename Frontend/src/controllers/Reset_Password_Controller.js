// ==============================================
// CONTROLLER: ResetPasswordController
// Pantalla completa: Reset-Password.html?token=XXX
// Pasos: validar token → pedir nueva contraseña → actualizar
// ==============================================

class ResetPasswordController {

    constructor(config) {
        this.config = config || {};
        this.service = new PasswordResetService(this.config);
        this.token = null;
        this.usuario = null;
        this.enviando = false;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log('🔧 Inicializando ResetPasswordController...');

        // 1) Extraer token del query string
        const params = new URLSearchParams(window.location.search);
        this.token = params.get('token');

        // 2) Referencias DOM
        this.stateLoading = document.getElementById('stateLoading');
        this.stateInvalid = document.getElementById('stateInvalid');
        this.stateForm    = document.getElementById('stateForm');
        this.stateSuccess = document.getElementById('stateSuccess');

        this.invalidMsg    = document.getElementById('invalidMessage');
        this.form          = document.getElementById('resetForm');
        this.passwordInput = document.getElementById('newPassword');
        this.confirmInput  = document.getElementById('confirmPassword');
        this.passwordError = document.getElementById('newPasswordError');
        this.confirmError  = document.getElementById('confirmPasswordError');
        this.messageBox    = document.getElementById('resetMessage');
        this.submitBtn     = document.getElementById('resetSubmitBtn');
        this.userGreeting  = document.getElementById('userGreeting');

        // 3) Validar token
        this.validarToken();
    }

    _mostrarEstado(estado) {
        // estado: 'loading' | 'invalid' | 'form' | 'success'
        [this.stateLoading, this.stateInvalid, this.stateForm, this.stateSuccess]
            .forEach(el => { if (el) el.style.display = 'none'; });

        const map = {
            loading: this.stateLoading,
            invalid: this.stateInvalid,
            form: this.stateForm,
            success: this.stateSuccess
        };
        if (map[estado]) map[estado].style.display = 'block';
    }

    async validarToken() {
        this._mostrarEstado('loading');

        // Validación local rápida
        if (!this.token || this.token.length !== 64) {
            this.invalidMsg.textContent =
                this.token
                    ? 'El enlace no es válido. Verifique que lo copió completo.'
                    : 'No se recibió ningún token. Use el enlace del correo.';
            this._mostrarEstado('invalid');
            return;
        }

        const resultado = await this.service.validarToken(this.token);

        if (!resultado.success || !resultado.valido) {
            this.invalidMsg.textContent =
                resultado.error || 'El enlace ha expirado o no es válido. Solicite uno nuevo.';
            this._mostrarEstado('invalid');
            return;
        }

        // Token válido → mostrar formulario
        this.usuario = resultado.usuario;
        if (this.userGreeting && this.usuario?.Nombre) {
            this.userGreeting.textContent = `Hola, ${this.usuario.Nombre}`;
        } else if (this.userGreeting && this.usuario?.Email) {
            this.userGreeting.textContent = `Hola, ${this.usuario.Email}`;
        }

        this._mostrarEstado('form');
        this.configurarEventos();
    }

    configurarEventos() {
        if (!this.form) return;

        // Toggle visibilidad contraseña
        document.querySelectorAll('[data-toggle-password]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = btn.getAttribute('data-toggle-password');
                const input = document.getElementById(targetId);
                if (!input) return;

                const icon = btn.querySelector('i');
                if (input.type === 'password') {
                    input.type = 'text';
                    if (icon) { icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
                } else {
                    input.type = 'password';
                    if (icon) { icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
                }
            });
        });

        // Limpiar errores al escribir
        if (this.passwordInput) {
            this.passwordInput.addEventListener('input', () => {
                this._clearError(this.passwordInput, this.passwordError);
                this._hideMessage();
            });
        }
        if (this.confirmInput) {
            this.confirmInput.addEventListener('input', () => {
                this._clearError(this.confirmInput, this.confirmError);
                this._hideMessage();
            });
        }

        // Submit
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    _clearError(input, errorEl) {
        if (input) input.classList.remove('error');
        if (errorEl) { errorEl.classList.remove('show'); errorEl.textContent = ''; }
    }

    _showError(input, errorEl, msg) {
        if (input) input.classList.add('error');
        if (errorEl) { errorEl.textContent = msg; errorEl.classList.add('show'); }
    }

    _showMessage(msg, type = 'error') {
        if (!this.messageBox) return;
        this.messageBox.className = `message-box show ${type}`;
        this.messageBox.textContent = msg;
    }

    _hideMessage() {
        if (this.messageBox) this.messageBox.classList.remove('show');
    }

    async handleSubmit(event) {
        event.preventDefault();
        if (this.enviando) return;

        this._hideMessage();

        const pass = this.passwordInput.value;
        const confirm = this.confirmInput.value;

        let isValid = true;

        if (!pass || pass.length < 6) {
            this._showError(this.passwordInput, this.passwordError,
                'Mínimo 6 caracteres');
            isValid = false;
        }
        if (pass !== confirm) {
            this._showError(this.confirmInput, this.confirmError,
                'Las contraseñas no coinciden');
            isValid = false;
        }

        if (!isValid) {
            this._showMessage('❌ Revise los campos marcados', 'error');
            return;
        }

        this.enviando = true;
        this.submitBtn.disabled = true;
        const originalText = this.submitBtn.textContent;
        this.submitBtn.textContent = '⏳ Actualizando...';

        const resultado = await this.service.actualizarPassword(this.token, pass);

        if (resultado.success) {
            this._mostrarEstado('success');
            if (this.passwordInput) this.passwordInput.value = '';
            if (this.confirmInput) this.confirmInput.value = '';
        } else {
            this._showMessage(`❌ ${resultado.error || 'No se pudo actualizar la contraseña'}`, 'error');
            this.submitBtn.disabled = false;
            this.submitBtn.textContent = originalText;
        }

        this.enviando = false;
    }
}