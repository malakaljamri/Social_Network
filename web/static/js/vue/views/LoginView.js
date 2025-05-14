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
                    <div v-if="loginForm.error" class="error">{{ loginForm.error }}</div>
                </form>
            </div>
            <div class="card">
                <p>Don't have an account? <a href="#" @click.prevent="$emit('show-register')">Sign Up</a></p>
            </div>
        </div>
    `,
    data() {
        return {
            loginForm: {
                user_identifier: '',
                password: '',
                loading: false,
                error: ''
            }
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
                        identifier: this.loginForm.user_identifier,
                        password: this.loginForm.password
                    }),
                    credentials: 'include'
                });
                const data = await response.json();
                if (!response.ok || data.message !== 'Logged in successfully') {
                    this.loginForm.error = data.message || 'Incorrect credentials';
                    this.loginForm.password = '';
                    this.loginForm.loading = false;
                    return;
                }
                this.$emit('login', data);
            } catch (error) {
                this.loginForm.error = error.message || 'Login failed. Please try again.';
                this.loginForm.password = '';
            } finally {
                this.loginForm.loading = false;
            }
        }
    }
};

// No mount here, will be registered globally. 