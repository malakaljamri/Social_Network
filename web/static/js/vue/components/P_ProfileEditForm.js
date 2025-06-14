// ProfileEditForm Component
const P_ProfileEditForm = {
    template: `
        <div class="profile-edit-form">
            <h3>Edit Profile</h3>
            <form @submit.prevent="updateProfile">
                <div class="form-group">
                    <label for="first_name">First Name</label>
                    <input type="text" id="first_name" v-model="profileData.first_name" class="form-control">
                </div>
                <div class="form-group">
                    <label for="last_name">Last Name</label>
                    <input type="text" id="last_name" v-model="profileData.last_name" class="form-control">
                </div>
                <div class="form-group">
                    <label for="nickname">Nickname</label>
                    <input type="text" id="nickname" v-model="profileData.nickname" class="form-control">
                </div>
                <div class="form-group">
                    <label for="about_me">About Me</label>
                    <textarea id="about_me" v-model="profileData.about_me" class="form-control" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label for="gender">Gender</label>
                    <select id="gender" v-model="profileData.gender" class="form-control">
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="birth_date">Birth Date</label>
                    <input type="date" id="birth_date" v-model="profileData.birth_date" class="form-control">
                </div>
                <div class="form-group">
                    <label for="profile_image">Profile Image</label>
                    <input type="file" id="profile_image" @change="handleImageUpload" accept="image/*" class="form-control">
                </div>
                <div class="form-group">
                    <label class="privacy-toggle">
                        <input type="checkbox" v-model="isPrivate">
                        Private Profile
                    </label>
                </div>
                <button type="submit" class="btn btn-primary">Save Changes</button>
            </form>
        </div>
    `,
    data() {
        return {
            profileData: {
                first_name: '',
                last_name: '',
                nickname: '',
                about_me: '',
                gender: '',
                birth_date: ''
            },
            isPrivate: false,
            selectedImage: null
        };
    },
    methods: {
        async updateProfile() {
            try {
                // Update profile information
                const response = await fetch('/api/profile/info', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this.profileData),
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error('Failed to update profile');
                }

                // Update profile image if selected
                if (this.selectedImage) {
                    const formData = new FormData();
                    formData.append('image', this.selectedImage);

                    const imageResponse = await fetch('/api/profile/image', {
                        method: 'PUT',
                        body: formData,
                        credentials: 'include'
                    });

                    if (!imageResponse.ok) {
                        throw new Error('Failed to update profile image');
                    }
                }

                // Update privacy settings
                const privacyResponse = await fetch('/api/profile/privacy', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ is_private: this.isPrivate }),
                    credentials: 'include'
                });

                if (!privacyResponse.ok) {
                    throw new Error('Failed to update privacy settings');
                }

                // Emit success event
                this.$emit('profile-updated');
                alert('Profile updated successfully!');
            } catch (error) {
                console.error('Error updating profile:', error);
                alert('Failed to update profile. Please try again.');
            }
        },
        handleImageUpload(event) {
            this.selectedImage = event.target.files[0];
        },
        async loadProfileData() {
            try {
                const response = await fetch('/api/user/profile', {
                    credentials: 'include'
                });
                if (!response.ok) {
                    throw new Error('Failed to load profile data');
                }
                const data = await response.json();
                this.profileData = {
                    first_name: data.user.first_name || '',
                    last_name: data.user.last_name || '',
                    nickname: data.user.nickname || '',
                    about_me: data.user.about_me || '',
                    gender: data.user.gender || '',
                    birth_date: data.user.birthDate || ''
                };
                this.isPrivate = data.user.is_private || false;
            } catch (error) {
                console.error('Error loading profile data:', error);
            }
        }
    },
    mounted() {
        this.loadProfileData();
    }
};

// No mount here, will be registered globally 