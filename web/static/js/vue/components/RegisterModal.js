// RegisterModal Component
const RegisterModal = {
    emits: ['close', 'registered'],
    template: `
        <teleport to="body">
            <div class="modal-overlay" @click.self="close">
                <div class="modal-content">
                    <h2>Register</h2>
                    <form @submit.prevent="submitRegister" style="display: table-caption;">
                        <input type="text" v-model="form.username" placeholder="Nickname" required>
                        <input type="email" v-model="form.email" placeholder="Email" required>
                        <input type="password" v-model="form.password" placeholder="Password" required>
                        <input type="number" v-model="form.age" min="4" max="99" required placeholder="Age"
                            @invalid="setAgeValidity($event)" @input="clearAgeValidity($event)">
                        <select v-model="form.gender" required>
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                        <input type="text" v-model="form.firstName" placeholder="First Name" required>
                        <input type="text" v-model="form.lastName" placeholder="Last Name" required>
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
                age: '',
                gender: '',
                firstName: '',
                lastName: '',
                loading: false,
                error: ''
            }
        };
    },
    methods: {
        setAgeValidity(e) {
            e.target.setCustomValidity('Please enter a valid age between 4 and 99');
        },
        clearAgeValidity(e) {
            e.target.setCustomValidity('');
        },
        convertAgeToBirthDate(age) {
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const birthYear = currentYear - parseInt(age, 10);
            const birthDate = new Date(birthYear, 0, 1);
            return birthDate.toISOString();
        },
        async submitRegister() {
            this.form.loading = true;
            this.form.error = '';
            // Validate all fields
            if (!this.form.username || !this.form.email || !this.form.password || !this.form.age || !this.form.gender || !this.form.firstName || !this.form.lastName) {
                this.form.error = 'All fields are required';
                this.form.loading = false;
                return;
            }
            if (this.form.age < 4 || this.form.age > 99) {
                this.form.error = 'Please enter a valid age between 4 and 99';
                this.form.loading = false;
                return;
            }
            try {
                const birthDate = this.convertAgeToBirthDate(this.form.age);
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: this.form.username,
                        email: this.form.email,
                        password: this.form.password,
                        birthDate: birthDate,
                        gender: this.form.gender,
                        firstName: this.form.firstName,
                        lastName: this.form.lastName
                    })
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