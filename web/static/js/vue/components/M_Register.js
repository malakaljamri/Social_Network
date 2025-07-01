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
                avatar: null,
                aboutMe: '',
                loading: false,
                error: '',
                imageError: ''
            },
            imagePreview: null,
            maxFileSize: 2 * 1024 * 1024, // 2MB
            maxDimensions: 2048
        };
    },
    methods: {
        handleAvatarChange(event) {
            const file = event.target.files[0];
            if (file) {
                this.validateAndSetImage(file);
            }
        },
        async validateAndSetImage(file) {
            this.form.imageError = '';
            // Check file type
            if (!file.type.match(/^image\/(jpeg|png|gif)$/)) {
                this.form.imageError = 'Please upload a valid image file (JPEG, PNG, or GIF)';
                return;
            }
            // Check file size
            if (file.size > this.maxFileSize) {
                this.form.imageError = 'Image size must not exceed 2MB';
                return;
            }
            // Check image dimensions
            try {
                const dimensions = await this.getImageDimensions(file);
                if (dimensions.width > this.maxDimensions || dimensions.height > this.maxDimensions) {
                    this.form.imageError = `Image dimensions must not exceed ${this.maxDimensions}x${this.maxDimensions}px`;
                    return;
                }
            } catch (error) {
                this.form.imageError = 'Failed to validate image dimensions';
                return;
            }
            this.form.avatar = file;
            this.imagePreview = URL.createObjectURL(file);
        },
        getImageDimensions(file) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    resolve({ width: img.width, height: img.height });
                };
                img.onerror = reject;
                img.src = URL.createObjectURL(file);
            });
        },
        removeImage() {
            this.form.avatar = null;
            if (this.imagePreview) {
                URL.revokeObjectURL(this.imagePreview);
                this.imagePreview = null;
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
            if (this.form.imageError) {
                this.form.error = this.form.imageError;
                this.form.loading = false;
                return;
            }
            try {
                const formData = new FormData();
                formData.append('username', this.form.username || '');
                formData.append('email', this.form.email);
                formData.append('password', this.form.password);
                formData.append('birthDate', this.form.birthDate + 'T00:00:00Z');
                formData.append('gender', this.form.gender);
                formData.append('firstName', this.form.firstName);
                formData.append('lastName', this.form.lastName);
                formData.append('aboutMe', this.form.aboutMe || '');
                if (this.form.avatar) {
                    formData.append('avatar', this.form.avatar);
                }
                const response = await fetch('/api/register', {
                    method: 'POST',
                    body: formData,
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