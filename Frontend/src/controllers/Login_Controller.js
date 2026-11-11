// ==============================================
// CONTROLLER: LoginController
// Responsabilidad: Manejar eventos del login y UI
// Depende de: AuthService (inyectado como "model" para no romper bootstrap)
// ==============================================

class LoginController {

    constructor(model, config) {
        this.model = model;        // ← AuthService
        this.config = config;
        this.isSubmitting = false;
        this.messageTimeout = null;

        this.form = null;
        this.usernameInput = null;
        this.passwordInput = null;
        this.usernameError = null;
        this.passwordError = null;
        this.messageBox = null;
        this.submitButton = null;
        this.rememberCheckbox = null;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log('🔧 Inicializando LoginController...');

        this.form = document.getElementById('loginForm');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.usernameError = document.getElementById('usernameError');
        this.passwordError = document.getElementById('passwordError');
        this.messageBox = document.getElementById('loginMessage');
        this.submitButton = document.getElementById('loginBtn');
        this.rememberCheckbox = document.getElementById('rememberMe');

        if (!this.form) {
            console.error('No se encontró el formulario de login');
            return;
        }
        if (!this.model) {
            console.error('❌ Error: AuthService no fue inyectado');
            return;
        }

        // Verificar sesión existente
        try {
            if (this.model.verificarSesion()) {
                console.log('✅ Sesión existente, redirigiendo...');
                this.redirigirAlMenu();
                return;
            }
        } catch (error) {
            console.warn('Error verificando sesión:', error);
        }

        // Precargar credenciales recordadas
        setTimeout(() => this.cargarCredencialesRecordadas(), 0);

        // Submit
        this.form.addEventListener('submit', (e) => this.handleLogin(e));

        if (this.usernameInput) {
            this.usernameInput.addEventListener('input', () => {
                this.clearError(this.usernameInput, this.usernameError);
                this.hideMessage();
            });
            this.usernameInput.addEventListener('focus', () => this.hideMessage());
        }

        if (this.passwordInput) {
            this.passwordInput.addEventListener('input', () => {
                this.clearError(this.passwordInput, this.passwordError);
                this.hideMessage();
            });
            this.passwordInput.addEventListener('focus', () => this.hideMessage());
        }

        if (this.rememberCheckbox) {
            this.rememberCheckbox.addEventListener('change', (e) => {
                if (!e.target.checked && typeof RememberMe !== 'undefined') {
                    RememberMe.limpiar();
                    console.log('🗑️ Credenciales eliminadas al desmarcar');
                }
            });
        }

        // Toggle contraseña
        const togglePasswordBtn = document.getElementById('togglePassword');
        if (togglePasswordBtn && this.passwordInput) {
            togglePasswordBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const icon = togglePasswordBtn.querySelector('i');
                if (this.passwordInput.type === 'password') {
                    this.passwordInput.type = 'text';
                    if (icon) { icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
                    togglePasswordBtn.setAttribute('aria-label', 'Ocultar contraseña');
                } else {
                    this.passwordInput.type = 'password';
                    if (icon) { icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
                    togglePasswordBtn.setAttribute('aria-label', 'Mostrar contraseña');
                }
            });
        }

        const forgotLink = document.getElementById('forgotPassword');
        if (forgotLink) {
            forgotLink.addEventListener('click', (e) => {
                e.preventDefault();
                // manejado por RecuperarPasswordController
            });
        }

        this.animateCard();
        console.log('✅ LoginController inicializado');
    }

    cargarCredencialesRecordadas() {
        if (typeof RememberMe === 'undefined') return;

        const credenciales = RememberMe.obtener();
        if (credenciales && this.usernameInput && this.passwordInput) {
            this.usernameInput.value = credenciales.username;
            this.passwordInput.value = credenciales.password;
            if (this.rememberCheckbox) this.rememberCheckbox.checked = true;
            console.log('💾 Credenciales precargadas para:', credenciales.username);
        }
    }

    limpiarSoloPassword() {
        if (this.passwordInput) {
            this.passwordInput.value = '';
            this.passwordInput.classList.remove('error');
            this.passwordInput.style.borderColor = '';
        }
        if (this.passwordError) {
            this.passwordError.classList.remove('show');
        }
    }

    animateCard() {
        const card = document.querySelector('.login-card');
        if (card) {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            setTimeout(() => {
                card.style.transition = 'all 0.5s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 100);
        }
    }

    hideMessage() {
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
            this.messageTimeout = null;
        }
        if (this.messageBox) this.messageBox.classList.remove('show');
    }

    clearError(input, errorElement) {
        if (input) input.classList.remove('error');
        if (errorElement) errorElement.classList.remove('show');
    }

    showError(input, errorElement) {
        if (input) input.classList.add('error');
        if (errorElement) errorElement.classList.add('show');
    }

    showMessage(message, type = 'error') {
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
            this.messageTimeout = null;
        }
        if (!this.messageBox) this.messageBox = document.getElementById('loginMessage');
        if (!this.messageBox) return;

        this.messageBox.className = 'message-box';
        if (type === 'success')      this.messageBox.classList.add('show', 'success');
        else if (type === 'warning') this.messageBox.classList.add('show', 'warning');
        else                         this.messageBox.classList.add('show', 'error');

        this.messageBox.textContent = message;

        this.messageTimeout = setTimeout(() => {
            if (this.messageBox) this.messageBox.classList.remove('show');
            this.messageTimeout = null;
        }, 3000);
    }

    // ==============================================
    // HANDLE LOGIN
    // ==============================================
    async handleLogin(event) {
        if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
    }

        if (this.isSubmitting) return;

        this.hideMessage();

        let isValid = true;
        const usernameValue = this.usernameInput ? this.usernameInput.value.trim() : '';
        const passwordValue = this.passwordInput ? this.passwordInput.value : '';

        if (!usernameValue) {
            this.showError(this.usernameInput, this.usernameError);
            isValid = false;
        }
        if (!passwordValue) {
            this.showError(this.passwordInput, this.passwordError);
            isValid = false;
        }
        if (!isValid) {
            this.showMessage('❌ Campos Incompletos', 'error');
            return;
        }

        this.isSubmitting = true;
        this.submitButton.disabled = true;
        const originalText = this.submitButton.textContent;
        this.submitButton.textContent = '⏳ Verificando credenciales...';

        try {
            const startTime = Date.now();
            const result = await this.model.autenticar(usernameValue, passwordValue);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`⏱️ Autenticación completada en ${elapsed}s`);

            if (result.success) {
                this.showMessage(
                    `¡Bienvenido ${result.nombres} ${result.apellidos || ''}!`,
                    'success'
                );

                // Recordar credenciales
                if (typeof RememberMe !== 'undefined') {
                    if (this.rememberCheckbox && this.rememberCheckbox.checked) {
                        RememberMe.guardar(usernameValue, passwordValue);
                    } else {
                        RememberMe.limpiar();
                    }
                }

                if (this.passwordInput) this.passwordInput.value = '';

                setTimeout(() => this.redirigirAlMenu(), 1000);
            } else {
                const mensajeError =
                    (typeof result.message === 'string' && result.message) ||
                    result.message?.message ||
                    result.error ||
                    '❌ Error de autenticación';

                this.showMessage(String(mensajeError), 'error');
                this.submitButton.disabled = false;
                this.submitButton.textContent = originalText;
                this.isSubmitting = false;
                this.limpiarSoloPassword();
            }
        } catch (error) {
            console.error('❌ Error en login:', error);
            this.showMessage(`Error de conexión: ${error.message}`, 'error');
            this.submitButton.disabled = false;
            this.submitButton.textContent = originalText;
            this.isSubmitting = false;
            this.limpiarSoloPassword();
        }
    }

    redirigirAlMenu() {
        let menuRoute = 'Frontend/src/views/Menu.html';
        if (this.config && this.config.ROUTES) {
            menuRoute = this.config.ROUTES.MENULOGIN
                     || this.config.ROUTES.MENU
                     || menuRoute;
        }
        console.log('🔄 Redirigiendo a:', menuRoute);
        window.location.href = menuRoute;
    }
}