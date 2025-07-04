window.P_ChangePassword = {
    name: 'P_ChangePassword',
    template: `
        <div class="change-password-form">
            <h3>Change Password</h3>
            <form @submit.prevent="handleSubmit">
                <div class="form-group">
                    <label for="currentPassword">Current Password</label>
                    <input type="password" v-model="currentPassword" id="currentPassword" required autocomplete="current-password" />
                </div>
                <div class="form-group">
                    <label for="newPassword">New Password</label>
                    <input type="password" v-model="newPassword" id="newPassword" required autocomplete="new-password" />
                </div>
                <div class="form-group">
                    <label for="confirmPassword">Confirm New Password</label>
                    <input type="password" v-model="confirmPassword" id="confirmPassword" required autocomplete="new-password" />
                </div>
                <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
                <div v-if="successMessage" class="success-message">{{ successMessage }}</div>
                <button type="submit" class="btn btn-primary">Change Password</button>
                <button type="button" class="btn btn-secondary" @click="$emit('cancel')" style="margin-left:10px;">Cancel</button>
            </form>
        </div>
    `,
    data() {
        return {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
            errorMessage: '',
            successMessage: ''
        };
    },
    methods: {
        async handleSubmit() {
            this.errorMessage = '';
            this.successMessage = '';
            if (this.newPassword !== this.confirmPassword) {
                this.errorMessage = 'New password and confirmation do not match.';
                return;
            }
            if (this.newPassword.length < 6) {
                this.errorMessage = 'Password must be at least 6 characters.';
                return;
            }
            try {
                const response = await fetch('/api/user/change_password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        current_password: this.currentPassword,
                        new_password: this.newPassword,
                        confirm_password: this.confirmPassword
                    })
                });
                const data = await response.json();
                if (!response.ok) {
                    this.errorMessage = data.error || 'Failed to change password.';
                } else {
                    this.successMessage = data.message || 'Password changed successfully!';
                    this.currentPassword = '';
                    this.newPassword = '';
                    this.confirmPassword = '';
                    this.$emit('success');
                }
            } catch (err) {
                this.errorMessage = 'An error occurred. Please try again.';
            }
        }
    }
}; 