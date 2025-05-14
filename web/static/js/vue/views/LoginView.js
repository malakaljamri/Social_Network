// LoginView Component
const LoginView = {
    template: `
        <div class="login-view">
            <div class="card">
                <h2>Login</h2>
                <form @submit.prevent="submitLogin">
                    <input type="text" v-model="loginForm.user_identifier" placeholder="Email or Username" required>
                    <input type="password" v-model="loginForm.password" placeholder="Password" required>
                    <button type="submit" class="button" :disabled="loginForm.loading">Login</button>
                    <div v-if="loginForm.error" class="error">[[loginForm.error]]</div>
                </form>
            </div>
            <div class="card">
                <p>Don't have an account? <a href="#" @click.prevent="showRegister">Sign Up</a></p>
            </div>
            <register-modal v-if="showRegisterModal" @close="showRegisterModal = false" @registered="onRegistered"></register-modal>
        </div>
    `,
    data() {
        return {
            loginForm: {
                user_identifier: '',
                password: '',
                loading: false,
                error: ''
            },
            showRegisterModal: false
        };
    },
    methods: {
        async submitLogin() {
            this.loginForm.loading = true;
            this.loginForm.error = '';
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_identifier: this.loginForm.user_identifier,
                        password: this.loginForm.password
                    })
                });
                if (!response.ok) {
                    const err = await response.json();
                    this.loginForm.error = err.error || 'Login failed';
                    this.loginForm.loading = false;
                    return;
                }
                const data = await response.json();
                this.$emit('login', data);
            } catch (e) {
                this.loginForm.error = 'Network error';
            } finally {
                this.loginForm.loading = false;
            }
        },
        showRegister() {
            this.showRegisterModal = true;
        },
        onRegistered(user) {
            this.showRegisterModal = false;
            // Optionally auto-fill login form
            this.loginForm.user_identifier = user.username || user.email;
        }
    }
};

// No mount here, will be registered globally. 