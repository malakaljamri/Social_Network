// RegisterModal Component
const RegisterModal = {
    emits: ['close', 'registered'],
    template: `
        <teleport to="body">
            <div class="modal-overlay" @click.self="close">
                <div class="modal-content">
                    <h2>Register</h2>
                    <form @submit.prevent="submitRegister">
                        <input type="text" v-model="form.firstName" placeholder="First Name" required>
                        <input type="text" v-model="form.lastName" placeholder="Last Name" required>
                        <input type="text" v-model="form.username" placeholder="Username" required>
                        <input type="email" v-model="form.email" placeholder="Email" required>
                        <input type="date" v-model="form.birthDate" placeholder="Birth Date" required>
                        <select v-model="form.gender" required>
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                        <input type="password" v-model="form.password" placeholder="Password" required>
                        <input type="password" v-model="form.confirmPassword" placeholder="Confirm Password" required>
                        <button type="submit" class="button" :disabled="form.loading">Register</button>
                        <div v-if="form.error" class="error">{{ form.error }}</div>
                    </form>
                    <button class="button secondary-button" @click="close">Cancel</button>
                </div>
            </div>
        </teleport>
    `,
    data() {
        return {
            form: {
                firstName: '',
                lastName: '',
                username: '',
                email: '',
                birthDate: '',
                gender: '',
                password: '',
                confirmPassword: '',
                loading: false,
                error: ''
            }
        };
    },
    methods: {
        async submitRegister() {
            this.form.loading = true;
            this.form.error = '';
            if (this.form.password !== this.form.confirmPassword) {
                this.form.error = 'Passwords do not match';
                this.form.loading = false;
                return;
            }
            // Validate all fields
            if (!this.form.firstName || !this.form.lastName || !this.form.username || !this.form.email || !this.form.birthDate || !this.form.gender || !this.form.password) {
                this.form.error = 'All fields are required';
                this.form.loading = false;
                return;
            }
            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        firstName: this.form.firstName,
                        lastName: this.form.lastName,
                        username: this.form.username,
                        email: this.form.email,
                        birthDate: this.form.birthDate,
                        gender: this.form.gender,
                        password: this.form.password
                    })
                });
                if (!response.ok) {
                    const err = await response.json();
                    this.form.error = err.error || 'Registration failed';
                    this.form.loading = false;
                    return;
                }
                const data = await response.json();
                this.$emit('registered', data);
                this.close();
            } catch (e) {
                this.form.error = 'Network error';
            } finally {
                this.form.loading = false;
            }
        },
        close() {
            this.$emit('close');
        }
    }
};

// No mount here, will be registered globally. 