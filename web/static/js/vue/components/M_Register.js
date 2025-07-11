// RegisterModal Component
const RegisterModal = {
    emits: ['close', 'registered'],
    template: `
        <teleport to="body">
            <div class="modal-overlay" @click.self="close">
                <div class="modal-content register-modal">
                    <div class="modal-header">
                        <h2><i class="fas fa-user-plus"></i> Create Your Account</h2>
                        <button class="modal-close" @click="close" type="button">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <form @submit.prevent="submitRegister" class="register-form">
                        <!-- Personal Information Section -->
                        <div class="form-section">
                            <h3 class="section-title"><i class="fas fa-user"></i> Personal Information</h3>
                            
                            <div class="form-row">
                                <div class="form-group half-width">
                                    <label class="required">First Name</label>
                                    <input 
                                        type="text" 
                                        v-model="form.firstName" 
                                        placeholder="Enter your first name"
                                        :class="{ 'error': form.fieldErrors.firstName }"
                                        required
                                    >
                                    <span v-if="form.fieldErrors.firstName" class="field-error">{{ form.fieldErrors.firstName }}</span>
                                </div>
                                
                                <div class="form-group half-width">
                                    <label class="required">Last Name</label>
                                    <input 
                                        type="text" 
                                        v-model="form.lastName" 
                                        placeholder="Enter your last name"
                                        :class="{ 'error': form.fieldErrors.lastName }"
                                        required
                                    >
                                    <span v-if="form.fieldErrors.lastName" class="field-error">{{ form.fieldErrors.lastName }}</span>
                                </div>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group half-width">
                                    <label class="required">Date of Birth</label>
                                    <input 
                                        type="date" 
                                        v-model="form.birthDate" 
                                        :max="maxDate"
                                        :class="{ 'error': form.fieldErrors.birthDate }"
                                        required
                                    >
                                    <span v-if="form.fieldErrors.birthDate" class="field-error">{{ form.fieldErrors.birthDate }}</span>
                                </div>
                                
                                <div class="form-group half-width">
                                    <label class="required">Gender</label>
                                    <select 
                                        v-model="form.gender" 
                                        :class="{ 'error': form.fieldErrors.gender }"
                                        required
                                    >
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                    <span v-if="form.fieldErrors.gender" class="field-error">{{ form.fieldErrors.gender }}</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Account Information Section -->
                        <div class="form-section">
                            <h3 class="section-title"><i class="fas fa-key"></i> Account Information</h3>
                            
                            <div class="form-group">
                                <label class="required">Email Address</label>
                                <input 
                                    type="email" 
                                    v-model="form.email" 
                                    placeholder="Enter your email address"
                                    :class="{ 'error': form.fieldErrors.email }"
                                    required
                                >
                                <span v-if="form.fieldErrors.email" class="field-error">{{ form.fieldErrors.email }}</span>
                                <small class="field-hint">You can use this email to log in</small>
                            </div>
                            
                            <div class="form-group">
                                <label>Username/Nickname</label>
                                <input 
                                    type="text" 
                                    v-model="form.username" 
                                    placeholder="Choose a username (optional)"
                                    :class="{ 'error': form.fieldErrors.username }"
                                >
                                <span v-if="form.fieldErrors.username" class="field-error">{{ form.fieldErrors.username }}</span>
                                <small class="field-hint">Optional - you can also use this to log in</small>
                            </div>
                            
                            <div class="form-group">
                                <label class="required">Password</label>
                                <div class="password-input-wrapper">
                                    <input 
                                        :type="showPassword ? 'text' : 'password'" 
                                        v-model="form.password" 
                                        placeholder="Create a strong password"
                                        :class="{ 'error': form.fieldErrors.password }"
                                        required
                                    >
                                    <button 
                                        type="button" 
                                        class="password-toggle" 
                                        @click="showPassword = !showPassword"
                                    >
                                        <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
                                    </button>
                                </div>
                                <span v-if="form.fieldErrors.password" class="field-error">{{ form.fieldErrors.password }}</span>
                                <div class="password-strength" v-if="form.password">
                                    <div class="strength-bar">
                                        <div class="strength-fill" :class="passwordStrength.class" :style="{ width: passwordStrength.width }"></div>
                                    </div>
                                    <small :class="passwordStrength.class">{{ passwordStrength.text }}</small>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Profile Information Section -->
                        <div class="form-section">
                            <h3 class="section-title"><i class="fas fa-id-card"></i> Profile Information</h3>
                            
                            <div class="form-group">
                                <label>Profile Picture</label>
                                <div class="avatar-upload-section">
                                    <div class="avatar-preview" v-if="imagePreview">
                                        <img :src="imagePreview" alt="Avatar preview">
                                        <button type="button" class="remove-avatar" @click="removeImage">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                    <div class="avatar-upload" v-else>
                                        <i class="fas fa-camera"></i>
                                        <span>Upload Photo</span>
                                    </div>
                                    <input 
                                        type="file" 
                                        @change="handleAvatarChange" 
                                        accept="image/*"
                                        class="avatar-input"
                                        id="avatar-input"
                                    >
                                    <label for="avatar-input" class="avatar-upload-btn">
                                        <i class="fas fa-upload"></i> Choose Image
                                    </label>
                                </div>
                                <span v-if="form.fieldErrors.avatar" class="field-error">{{ form.fieldErrors.avatar }}</span>
                                <small class="field-hint">Optional - Max 2MB, JPEG/PNG/GIF format</small>
                            </div>
                            
                            <div class="form-group">
                                <label>About Me</label>
                                <textarea 
                                    v-model="form.aboutMe" 
                                    placeholder="Tell us a bit about yourself (optional)"
                                    rows="4"
                                    maxlength="500"
                                    :class="{ 'error': form.fieldErrors.aboutMe }"
                                ></textarea>
                                <span v-if="form.fieldErrors.aboutMe" class="field-error">{{ form.fieldErrors.aboutMe }}</span>
                                <small class="field-hint character-count">{{ form.aboutMe.length }}/500 characters</small>
                            </div>
                        </div>
                        
                        <!-- Error Display -->
                        <div v-if="form.error" class="form-error">
                            <i class="fas fa-exclamation-triangle"></i>
                            {{ form.error }}
                        </div>
                        
                        <!-- Form Actions -->
                        <div class="form-actions">
                            <button type="button" class="button secondary-button" @click="close" :disabled="form.loading">
                                <i class="fas fa-times"></i> Cancel
                            </button>
                            <button type="submit" class="button primary-button" :disabled="form.loading || !isFormValid">
                                <i v-if="form.loading" class="fas fa-spinner fa-spin"></i>
                                <i v-else class="fas fa-user-plus"></i>
                                {{ form.loading ? 'Creating Account...' : 'Create Account' }}
                            </button>
                        </div>
                    </form>
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
                fieldErrors: {
                    firstName: '',
                    lastName: '',
                    email: '',
                    password: '',
                    birthDate: '',
                    gender: '',
                    username: '',
                    avatar: '',
                    aboutMe: ''
                }
            },
            imagePreview: null,
            maxFileSize: 2 * 1024 * 1024, // 2MB
            maxDimensions: 2048,
            showPassword: false
        };
    },
    computed: {
        maxDate() {
            // Set max date to 13 years ago (minimum age)
            const today = new Date();
            const minAge = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
            return minAge.toISOString().split('T')[0];
        },
        passwordStrength() {
            const password = this.form.password;
            if (!password) return { width: '0%', class: '', text: '' };
            
            let score = 0;
            let feedback = [];
            
            // Length check
            if (password.length >= 8) score += 1;
            else feedback.push('at least 8 characters');
            
            // Uppercase check
            if (/[A-Z]/.test(password)) score += 1;
            else feedback.push('uppercase letter');
            
            // Lowercase check
            if (/[a-z]/.test(password)) score += 1;
            else feedback.push('lowercase letter');
            
            // Number check
            if (/\d/.test(password)) score += 1;
            else feedback.push('number');
            
            // Special character check
            if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;
            else feedback.push('special character');
            
            const strength = {
                0: { width: '20%', class: 'very-weak', text: 'Very Weak' },
                1: { width: '30%', class: 'weak', text: 'Weak' },
                2: { width: '50%', class: 'fair', text: 'Fair' },
                3: { width: '70%', class: 'good', text: 'Good' },
                4: { width: '85%', class: 'strong', text: 'Strong' },
                5: { width: '100%', class: 'very-strong', text: 'Very Strong' }
            };
            
            return strength[score] || strength[0];
        },
        isFormValid() {
            return this.form.firstName && 
                   this.form.lastName && 
                   this.form.email && 
                   this.form.password && 
                   this.form.birthDate && 
                   this.form.gender &&
                   !Object.values(this.form.fieldErrors).some(error => error);
        }
    },
    methods: {
        handleAvatarChange(event) {
            const file = event.target.files[0];
            if (file) {
                this.validateAndSetImage(file);
            }
        },
        async validateAndSetImage(file) {
            this.form.fieldErrors.avatar = '';
            // Check file type
            if (!file.type.match(/^image\/(jpeg|png|gif)$/)) {
                this.form.fieldErrors.avatar = 'Please upload a valid image file (JPEG, PNG, or GIF)';
                return;
            }
            // Check file size
            if (file.size > this.maxFileSize) {
                this.form.fieldErrors.avatar = 'Image size must not exceed 2MB';
                return;
            }
            // Check image dimensions
            try {
                const dimensions = await this.getImageDimensions(file);
                if (dimensions.width > this.maxDimensions || dimensions.height > this.maxDimensions) {
                    this.form.fieldErrors.avatar = `Image dimensions must not exceed ${this.maxDimensions}x${this.maxDimensions}px`;
                    return;
                }
            } catch (error) {
                this.form.fieldErrors.avatar = 'Failed to validate image dimensions';
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
        validateForm() {
            // Clear previous errors
            Object.keys(this.form.fieldErrors).forEach(key => {
                this.form.fieldErrors[key] = '';
            });
            this.form.error = '';
            
            let isValid = true;
            
            // Required field validation
            if (!this.form.firstName.trim()) {
                this.form.fieldErrors.firstName = 'First name is required';
                isValid = false;
            }
            
            if (!this.form.lastName.trim()) {
                this.form.fieldErrors.lastName = 'Last name is required';
                isValid = false;
            }
            
            if (!this.form.email.trim()) {
                this.form.fieldErrors.email = 'Email is required';
                isValid = false;
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email)) {
                this.form.fieldErrors.email = 'Please enter a valid email address';
                isValid = false;
            }
            
            if (!this.form.password) {
                this.form.fieldErrors.password = 'Password is required';
                isValid = false;
            } else if (this.form.password.length < 8) {
                this.form.fieldErrors.password = 'Password must be at least 8 characters long';
                isValid = false;
            }
            
            if (!this.form.birthDate) {
                this.form.fieldErrors.birthDate = 'Date of birth is required';
                isValid = false;
            } else {
                const birthDate = new Date(this.form.birthDate);
                const today = new Date();
                const age = today.getFullYear() - birthDate.getFullYear();
                if (age < 13) {
                    this.form.fieldErrors.birthDate = 'You must be at least 13 years old to register';
                    isValid = false;
                }
            }
            
            if (!this.form.gender) {
                this.form.fieldErrors.gender = 'Please select your gender';
                isValid = false;
            }
            
            // Optional username validation
            if (this.form.username && this.form.username.length < 3) {
                this.form.fieldErrors.username = 'Username must be at least 3 characters long';
                isValid = false;
            }
            
            // About me length validation
            if (this.form.aboutMe && this.form.aboutMe.length > 500) {
                this.form.fieldErrors.aboutMe = 'About me section cannot exceed 500 characters';
                isValid = false;
            }
            
            return isValid;
        },
        async submitRegister() {
            this.form.loading = true;
            
            // Validate form
            if (!this.validateForm()) {
                this.form.loading = false;
                return;
            }
            
            // Check for avatar errors
            if (this.form.fieldErrors.avatar) {
                this.form.error = this.form.fieldErrors.avatar;
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
        resetForm() {
            this.form = {
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
                fieldErrors: {
                    firstName: '',
                    lastName: '',
                    email: '',
                    password: '',
                    birthDate: '',
                    gender: '',
                    username: '',
                    avatar: '',
                    aboutMe: ''
                }
            };
            this.showPassword = false;
            this.removeImage();
        },
        close() {
            this.resetForm();
            this.$emit('close');
        }
    }
};

// No mount here, will be registered globally.
window.M_Register = RegisterModal;