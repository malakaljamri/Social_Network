// RegisterModal Component
const RegisterModal = {
    emits: ['close', 'registered'],
    template: `
        <teleport to="body">
            <div class="modal-overlay" @click.self="close">
                <div class="modal-content">
                    <h2>Register</h2>
                    <form @submit.prevent="submitRegister" style="display: table-caption;">
                        <input type="email" v-model="form.email" placeholder="Email" required>
                        <input type="password" v-model="form.password" placeholder="Password" required>
                        <input type="text" v-model="form.firstName" placeholder="First Name" required>
                        <input type="text" v-model="form.lastName" placeholder="Last Name" required>
                        <input type="date" v-model="form.birthDate" placeholder="Date of Birth" required>
                        <input type="text" v-model="form.username" placeholder="Username (Optional)">
                        <input type="file" @change="handleAvatarChange" accept="image/*" placeholder="Avatar/Image (Optional)">
                        <textarea v-model="form.aboutMe" placeholder="About Me (Optional)" rows="3"></textarea>
                        <select v-model="form.gender" required>
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                        <button type="submit" class="button" :disabled="form.loading">Register</button>
                        <span v-if="form.error" class="error">{{ form.error }}</span>
                    </form>
                    <button class="button secondary-button" @click="close">Cancel</button>
                </div>
            </div>
        </teleport>
    `,
    data() {
        return {
            form: {
                username: '',
                email: '',
                password: '',
                birthDate: '',
                gender: '',
                firstName: '',
                lastName: '',
                avatar: '',
                aboutMe: '',
                loading: false,
                error: ''
            }
        };
    },
    methods: {
        handleAvatarChange(event) {
            const file = event.target.files[0];
            if (file) {
                // For now, we'll store the filename. In a real app, you'd upload the file
                this.form.avatar = file.name;
            }
        },
        async submitRegister() {
            this.form.loading = true;
            this.form.error = '';
            
            // Validate required fields
            if (!this.form.email || !this.form.password || !this.form.firstName || !this.form.lastName || !this.form.birthDate || !this.form.gender) {
                this.form.error = 'Email, Password, First Name, Last Name, Date of Birth, and Gender are required';
                this.form.loading = false;
                return;
            }

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: this.form.username || '', // Optional field
                        email: this.form.email,
                        password: this.form.password,
                        birthDate: this.form.birthDate + 'T00:00:00Z', // Convert to ISO format
                        gender: this.form.gender,
                        firstName: this.form.firstName,
                        lastName: this.form.lastName,
                        avatar: this.form.avatar || '', // Optional field
                        aboutMe: this.form.aboutMe || '' // Optional field
                    }),
                    credentials: 'include'
                });
                
                const data = await response.json();
                if (!response.ok) {
                    if (data.error === "failed to execute query: UNIQUE constraint failed: users.email") {
                        this.form.error = "Email already exists. Please use a different email.";
                    } else if (data.error === "failed to execute query: UNIQUE constraint failed: users.username") {
                        this.form.error = "Username already exists. Please use a different username.";
                    } else {
                        this.form.error = data.error || 'Registration failed';
                    }
                    this.form.loading = false;
                    return;
                }
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
window.M_Register = RegisterModal;