// ProfileView Component

const ProfileView = {
    template: `
        <div class="profile-view layout-grid">
            <filters-sidebar 
                class="sidebar"
                :is-profile="true" 
                @filters-changed="onFiltersChanged" 
                :categories="categories" 
                :total-results="profile.posts ? profile.posts.length : 0">
            </filters-sidebar>
            <div class="profile-main main-content">
                <div v-if="loading" class="loading-indicator">Loading profile...</div>
                <div v-else>
                    <div class="profile-header">
                        <div class="profile-avatar">
                            <img :src="avatarUrl" 
                                 class="avatar-large profile-avatar-img"
                                 :alt="profile.user.username">
                        </div>
                        <div class="profile-info">
                            <h2>{{ profile.user.Username || profile.user.username }}'s Profile</h2>
                            <!-- Edit Profile Button for own profile -->
                            <button v-if="isOwnProfile" 
                                    @click="showEditForm = !showEditForm"
                                    class="btn btn-primary edit-profile-btn">
                                {{ showEditForm ? 'Cancel Edit' : 'Edit Profile' }}
                            </button>
                            <!-- Follow/Unfollow/Request Button for non-own profiles -->
                            <div v-if="!isOwnProfile && !isViewingOwnProfile" class="follow-action">
                                <button v-if="profile.is_following" class="btn btn-danger" @click="unfollowUser" title="Click to unfollow this user">
                                    Unfollow
                                </button>
                                <button v-else-if="profile.is_pending" class="btn btn-secondary" disabled title="Your follow request is awaiting approval">
                                    Request Pending
                                </button>
                                <button v-else class="btn btn-success" @click="followUser" title="Click to follow. If the profile is private, your request will need approval.">
                                    Follow
                                </button>
                                <span v-if="followStatusMessage" class="follow-status-message" style="margin-left:10px; color: #007bff;">{{ followStatusMessage }}</span>
                            </div>
                            <div class="privacy-status">
                                <span><strong>Status:</strong> {{ (profile.user.IsPrivate !== undefined ? profile.user.IsPrivate : profile.user.is_private) ? 'Private' : 'Public' }}</span>
                                <button v-if="isOwnProfile" @click="togglePrivacy" class="btn btn-secondary btn-sm" style="margin-left: 10px;">
                                    {{ (profile.user.IsPrivate !== undefined ? profile.user.IsPrivate : profile.user.is_private) ? 'Make Public' : 'Make Private' }}
                                </button>
                            </div>
                            <p v-if="profile.user.FirstName || profile.user.LastName">
                                <strong>Name:</strong> {{ profile.user.FirstName }} {{ profile.user.LastName }}
                            </p>
                            <p v-if="profile.user.nickname">
                                <strong>Nickname:</strong> {{ profile.user.nickname }}
                            </p>
                            <p v-if="profile.user.about_me">
                                <strong>About:</strong> {{ profile.user.about_me }}
                            </p>
                            <p v-if="profile.user.gender">
                                <strong>Gender:</strong> {{ profile.user.gender }}
                            </p>
                            <p v-if="profile.user.birthDate">
                                <strong>Birth Date:</strong> {{ formatDate(profile.user.birthDate) }}
                            </p>
                            <p><strong>Email:</strong> {{ profile.user.Email }}</p>
                            <p><strong>Followers:</strong> {{ profile.followers_count }}</p>
                            <p><strong>Following:</strong> {{ profile.following_count }}</p>
                            <p><strong>Posts:</strong> {{ profile.posts_count }}</p>
                        </div>
                    </div>

                    <!-- Profile Edit Form -->
                    <p-profile-edit-form v-if="showEditForm && isOwnProfile"
                                     @profile-updated="onProfileUpdated">
                    </p-profile-edit-form>

                    <!-- Password Change Form -->
                    <button v-if="isOwnProfile" @click="showChangePassword = !showChangePassword" class="btn btn-warning change-password-btn" style="margin-left:10px;">
                        {{ showChangePassword ? 'Cancel Password Change' : 'Change Password' }}
                    </button>
                    <p-change-password v-if="showChangePassword && isOwnProfile" @success="onPasswordChangeSuccess" @cancel="showChangePassword = false"></p-change-password>
                    
                    <!-- Follow Requests -->
                    <p-follow-request-list v-if="isOwnProfile"
                                       @request-handled="onRequestHandled">
                    </p-follow-request-list>

                    <!-- Privacy Enforcement -->
                    <div v-if="(profile.user.IsPrivate !== undefined ? profile.user.IsPrivate : profile.user.is_private) && !isOwnProfile && !isFollower" class="private-profile-message">
                        <p>This profile is private. Only followers can view the full profile.</p>
                    </div>
                    <template v-else>
                        <!-- Expandable Followers Section -->
                        <div class="expandable-section">
                            <button class="btn btn-link" @click="showFollowers = !showFollowers">
                                {{ showFollowers ? 'Hide' : 'Show' }} Followers ({{ followers.length }})
                            </button>
                            <div v-if="showFollowers">
                                <ul>
                                    <li v-for="user in followers" :key="user.id">
                                        <img :src="getAvatarUrl(user.avatar)" class="avatar-small" style="width:24px;height:24px;margin-right:5px;">
                                        {{ user.Username || user.username }} <span style="color: #888; font-size: 0.9em;">({{ user.Email || user.email }})</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <!-- Expandable Following Section -->
                        <div class="expandable-section">
                            <button class="btn btn-link" @click="showFollowing = !showFollowing">
                                {{ showFollowing ? 'Hide' : 'Show' }} Following ({{ following.length }})
                            </button>
                            <div v-if="showFollowing">
                                <ul>
                                    <li v-for="user in following" :key="user.id">
                                        <img :src="getAvatarUrl(user.avatar)" class="avatar-small" style="width:24px;height:24px;margin-right:5px;">
                                        {{ user.Username || user.username }} <span style="color: #888; font-size: 0.9em;">({{ user.Email || user.email }})</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <!-- Profile Content -->
                        <div class="profile-content">
                            <h3>Posts</h3>
                            <div v-if="!profile.posts || profile.posts.length === 0" class="no-content">
                                No posts to show.
                            </div>
                            <div v-else class="content-list">
                                <feed-main
                                    :posts="profile.posts || []"
                                    :categories="categories"
                                    :current-user="$root.currentUser.value"
                                    :total-pages="1"
                                    :current-page="1"
                                    :profile-user-name="profile.user.Username || profile.user.username"
                                ></feed-main>
                            </div>
                        </div>
                    </template>
                </div>
            </div>
            <users-list class="users-list" @open-chat="openChat"></users-list>
            <div id="chat-section">
                <chat-window v-for="user in $root.openChats" :key="user.ID" :user="user" :currentUser="$root.currentUser.value" :onClose="() => closeChat(user.ID)" :style="{ zIndex: getChatZIndex(user.ID) }"></chat-window>
            </div>
        </div>
    `,
    data() {
        return {
            profile: {
                user: {
                    Username: '',
                    Email: '',
                    FirstName: '',
                    LastName: '',
                    nickname: '',
                    about_me: '',
                    gender: '',
                    birthDate: '',
                    avatar: '',
                    is_private: false
                },
                followers_count: 0,
                following_count: 0,
                posts_count: 0,
                is_following: false,
                is_pending: false
            },
            loading: false,
            filters: null,
            categories: [],
            showEditForm: false,
            showFollowers: false,
            showFollowing: false,
            followers: [],
            following: [],
            followStatusMessage: '',
            showChangePassword: false
        };
    },
    computed: {
        isOwnProfile() {
            // Robust check for both ID and id fields
            const currentId = this.$root.currentUser.value.ID || this.$root.currentUser.value.id;
            const profileId = this.profile.user.ID || this.profile.user.id;
            return currentId === profileId;
        },
        isViewingOwnProfile() {
            // Alias for template clarity
            return this.isOwnProfile;
        },
        isFollower() {
            // Check if current user is in followers list
            return this.followers.some(u => u.id === this.$root.currentUser.value.id);
        },
        filteredPosts() {
            return this.profile.posts || [];
        },
        avatarUrl() {
            if (!this.profile.user.Avatar) {
                return '/static/images/default-avatar.png';
            }
            return this.getAvatarUrl(this.profile.user.Avatar);
        }
    },
    methods: {
        async fetchProfile() {
            if (!this.userId) return;
            this.loading = true;
            try {
                const response = await fetch(`/api/user/profile?id=${this.userId}`, { credentials: 'include' });
                if (!response.ok) throw new Error('Failed to fetch profile');
                const data = await response.json();
                this.profile = data;
                if (this.profile.user.is_private === undefined) {
                    this.profile.user.is_private = this.profile.user.IsPrivate;
                }
                await this.fetchFollowers();
                await this.fetchFollowing();
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                this.loading = false;
            }
        },
        async fetchCategories() {
            try {
                const response = await fetch('/api/categories', { credentials: 'include' });
                if (!response.ok) throw new Error('Failed to fetch categories');
                const data = await response.json();
                this.categories = Array.isArray(data) ? data : [];
            } catch (error) {
                console.error('Error fetching categories:', error);
                this.categories = [];
            }
        },
        async fetchFollowers() {
            if (!this.userId) return;
            try {
                const response = await fetch(`/api/user/followers?id=${this.userId}`, { credentials: 'include' });
                if (!response.ok) throw new Error('Failed to fetch followers');
                const data = await response.json();
                this.followers = Array.isArray(data) ? data : [];
            } catch (error) {
                console.error('Error fetching followers:', error);
                this.followers = [];
            }
        },
        async fetchFollowing() {
            if (!this.userId) return;
            try {
                const response = await fetch(`/api/user/following?id=${this.userId}`, { credentials: 'include' });
                if (!response.ok) throw new Error('Failed to fetch following');
                const data = await response.json();
                this.following = Array.isArray(data) ? data : [];
            } catch (error) {
                console.error('Error fetching following:', error);
                this.following = [];
            }
        },
        async togglePrivacy() {
            try {
                const response = await fetch('/api/user/toggle-privacy', {
                    method: 'POST',
                    credentials: 'include'
                });
                if (!response.ok) throw new Error('Failed to toggle privacy');
                const data = await response.json();
                this.profile.user.is_private = data.is_private;
                this.profile.user.IsPrivate = data.is_private;
            } catch (error) {
                console.error('Error toggling privacy:', error);
            }
        },
        onFiltersChanged(newFilters) {
            this.filters = newFilters;
            // Refresh profile posts with new filters
            this.fetchProfile();
        },
        formatDate(dateStr) {
            return new Date(dateStr).toLocaleString();
        },
        onProfileUpdated() {
            this.fetchProfile();
            this.showEditForm = false;
        },
        onRequestHandled() {
            this.fetchProfile();
        },
        async followUser() {
            if (!this.userId) return;
            try {
                const response = await fetch(`/api/user/follow?id=${this.userId}`, {
                    method: 'POST',
                    credentials: 'include'
                });
                if (!response.ok) throw new Error('Failed to follow user');
                const data = await response.json();
                this.profile.is_following = data.is_following;
                this.profile.is_pending = data.is_pending;
                this.profile.followers_count = data.followers_count;
                this.followStatusMessage = data.message || '';
                setTimeout(() => {
                    this.followStatusMessage = '';
                }, 3000);
                await this.fetchFollowers();
            } catch (error) {
                console.error('Error following user:', error);
                this.followStatusMessage = 'Error following user';
                setTimeout(() => {
                    this.followStatusMessage = '';
                }, 3000);
            }
        },
        async unfollowUser() {
            if (!this.userId) return;
            try {
                const response = await fetch(`/api/user/unfollow?id=${this.userId}`, {
                    method: 'POST',
                    credentials: 'include'
                });
                if (!response.ok) throw new Error('Failed to unfollow user');
                const data = await response.json();
                this.profile.is_following = data.is_following;
                this.profile.followers_count = data.followers_count;
                this.followStatusMessage = data.message || '';
                setTimeout(() => {
                    this.followStatusMessage = '';
                }, 3000);
                await this.fetchFollowers();
            } catch (error) {
                console.error('Error unfollowing user:', error);
                this.followStatusMessage = 'Error unfollowing user';
                setTimeout(() => {
                    this.followStatusMessage = '';
                }, 3000);
            }
        },
        getAvatarUrl(avatar) {
            if (!avatar) return '/static/images/default-avatar.png';
            if (avatar.startsWith('http')) return avatar;
            return `${window.location.origin}/web${avatar.startsWith('/') ? '' : '/'}${avatar.replace(/\\/g, '/')}`;
        },
        openChat(user) {
            // Use the centralized chat management from the main app
            this.$root.openChat(user);
        },
        closeChat(userId) {
            // Use the centralized chat management from the main app
            this.$root.closeChat(userId);
        },
        getChatZIndex(userId) {
            // Simple z-index calculation - can be enhanced if needed
            return 1000 + (this.$root.openChats.findIndex(u => u.ID === userId) * 10);
        },
        onPasswordChangeSuccess() {
            this.showChangePassword = false;
            // Optionally show success message
        }
    },
    mounted() {
        if (this.userId) {
            this.fetchProfile();
            this.fetchCategories();
        }
        // Listen for profile updates
        window.addEventListener('profile-updated', () => {
            this.fetchProfile();
        });
    },
    watch: {
        userId(newId) {
            if (newId) {
                this.fetchProfile();
                this.fetchCategories();
            }
        }
    },
    beforeUnmount() {
        window.removeEventListener('profile-updated', () => {
            this.fetchProfile();
        });
    }
};
