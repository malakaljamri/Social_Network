// ProfileView Component

const ProfileView = {
    template: `
        <div class="profile-view layout-grid layer-content" :key="forceRerenderKey">
            <div v-if="errorMessage" class="error-message" style="color:red;text-align:center;margin:2em;">{{ errorMessage }}</div>
            <filters-sidebar 
                v-else
                class="sidebar layer-sidebar"
                :is-profile="true" 
                @filters-changed="onFiltersChanged" 
                :categories="categories" 
                :loading="categoriesLoading"
                :error="categoriesError"
                :total-results="profile.posts ? profile.posts.length : 0"
                :current-user="currentUser"
            >
            </filters-sidebar>
            <div class="profile-main main-content layer-content">
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
                            <div v-if="canViewPosts">
                                <div v-if="!profile.posts || profile.posts.length === 0" class="no-content">
                                    No posts to show.
                                </div>
                                <div v-else class="content-list">
                                    <feed-main
                                        :posts="profile.posts || []"
                                        :categories="categories"
                                        :current-user="currentUser"
                                        :total-pages="1"
                                        :current-page="1"
                                        :profile-user-name="profile.user.Username || profile.user.username"
                                    ></feed-main>
                                </div>
                            </div>
                            <div v-else class="private-profile-message">
                                <p>This user's posts are private.</p>
                            </div>
                        </div>
                    </template>
                </div>
            </div>
            <users-list :users="$root.users" class="users-list layer-sidebar" @open-chat="openChat" :current-user="currentUser"></users-list>
            <div id="chat-section" class="chat-window-fixed layer-fixed">
                <chat-window v-for="user in openChats" :key="user.ID" :user="user" :currentUser="currentUser" :onClose="() => closeChat(user.ID)" :style="{ zIndex: getChatZIndex(user.ID) }"></chat-window>
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
            openChats: [],
            showChangePassword: false,
            triedFetchWithoutUserId: false, // Prevent repeated error logs
            errorMessage: '',
            categoriesLoading: false,
            categoriesError: '',
            forceRerenderKey: 0
        };
    },
    computed: {
        isOwnProfile() {
            const currentId = this.currentUser.ID || this.currentUser.id;
            const profileId = this.profile.user.ID || this.profile.user.id;
            return currentId === profileId;
        },
        isViewingOwnProfile() {
            return this.isOwnProfile;
        },
        isFollower() {
            return this.followers.some(u => u.id === this.currentUser.id);
        },
        canViewPosts() {
            const isPrivate = (this.profile.user.IsPrivate !== undefined ? this.profile.user.IsPrivate : this.profile.user.is_private);
            return !isPrivate || this.isOwnProfile || this.isFollower;
        },
        filteredPosts() {
            return this.profile.posts || [];
        },
        avatarUrl() {
            if (!this.profile.user.Avatar) {
                return '/static/images/default-avatar.png';
            }
            // If it's already a full URL, return as is
            if (this.profile.user.Avatar.startsWith('http')) {
                return this.profile.user.Avatar;
            }
            // Construct the proper URL for uploaded files
            return `/web/${this.profile.user.Avatar}`;
        }
    },
    methods: {
        async fetchAll() {
            this.loading = true;
            this.categoriesLoading = true;
            this.errorMessage = '';
            this.categoriesError = '';
            try {
                let userId = this.userId;
                if (!userId) userId = this.currentUser && this.currentUser.id;
                if (!userId) {
                    if (!this.triedFetchWithoutUserId) {
                        this.errorMessage = 'Cannot load profile. Please log in again.';
                        console.error('ProfileView: userId is undefined, cannot fetch profile');
                        this.triedFetchWithoutUserId = true;
                    }
                    this.profile = { user: {}, followers_count: 0, following_count: 0, posts_count: 0 };
                    this.followers = [];
                    this.following = [];
                    this.categories = [];
                    this.loading = false;
                    this.categoriesLoading = false;
                    return;
                }
                this.triedFetchWithoutUserId = false;
                this.errorMessage = '';
                // Fetch profile
                let url = `/api/user/profile?id=${userId}`;
                if (this.filters) {
                    url += `&filters=${encodeURIComponent(JSON.stringify(this.filters))}`;
                }
                const profileRes = await fetch(url, { credentials: 'include' });
                if (!profileRes.ok) throw new Error('Failed to fetch profile');
                this.profile = await profileRes.json();
                // Fetch followers
                const followersRes = await fetch(`/api/user/followers?id=${userId}`, { credentials: 'include' });
                this.followers = followersRes.ok ? await followersRes.json() : [];
                // Fetch following
                const followingRes = await fetch(`/api/user/following?id=${userId}`, { credentials: 'include' });
                this.following = followingRes.ok ? await followingRes.json() : [];
                // Fetch categories
                const categoriesRes = await fetch('/api/categories', { credentials: 'include' });
                if (!categoriesRes.ok) throw new Error('Failed to fetch categories');
                this.categories = await categoriesRes.json();
            } catch (e) {
                this.errorMessage = 'Failed to load profile or categories.';
                this.categoriesError = 'Failed to load categories.';
                this.profile = { user: {}, followers_count: 0, following_count: 0, posts_count: 0 };
                this.followers = [];
                this.following = [];
                this.categories = [];
            } finally {
                this.loading = false;
                this.categoriesLoading = false;
            }
        },
        async togglePrivacy() {
            try {
                const currentPrivacy = (this.profile.user.IsPrivate !== undefined ? this.profile.user.IsPrivate : this.profile.user.is_private);
                const newPrivacy = !currentPrivacy;
                const response = await fetch('/api/user/privacy', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_private: newPrivacy }),
                    credentials: 'include'
                });
                if (!response.ok) throw new Error('Failed to update privacy');
                // After successful update, fetch the latest profile from backend
                await this.fetchAll();
            } catch (error) {
                alert('Failed to update privacy.');
            }
        },
        onFiltersChanged(newFilters) {
            this.filters = newFilters;
            let userId = this.userId;
            if (!userId) {
                userId = this.currentUser.id;
            }
            this.filters.UserID = userId;
            this.fetchAll();
        },
        formatDate(dateStr) {
            return new Date(dateStr).toLocaleString();
        },
        onProfileUpdated() {
            this.showEditForm = false;
            this.fetchAll();
        },
        onRequestHandled() {
            this.fetchAll();
        },
        async followUser() {
            console.log('=== Frontend followUser started ===');
            console.log('Profile user ID:', this.profile.user.ID || this.profile.user.id);
            console.log('Current follow status - is_following:', this.profile.is_following, 'is_pending:', this.profile.is_pending);
            
            try {
                const requestBody = { user_id: this.profile.user.ID || this.profile.user.id };
                console.log('Sending follow request with body:', requestBody);
                
                const response = await fetch('/api/user/follow', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                    credentials: 'include'
                });
                
                console.log('Follow response status:', response.status);
                console.log('Follow response ok:', response.ok);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Follow request failed:', errorText);
                    throw new Error('Failed to follow user');
                }
                
                const responseData = await response.json();
                console.log('Follow response data:', responseData);
                
                // Always re-fetch profile to get correct state (is_following, is_pending, followers_count)
                console.log('Re-fetching profile after follow...');
                await this.fetchAll();
                
                console.log('Profile after re-fetch - is_following:', this.profile.is_following, 'is_pending:', this.profile.is_pending);
                
                this.followStatusMessage = (this.profile.is_pending ? 'Follow request sent!' : 'Followed!');
                console.log('Setting follow status message:', this.followStatusMessage);
                
                setTimeout(() => { 
                    this.followStatusMessage = '';
                    console.log('Follow status message cleared');
                }, 3000);
                
                console.log('=== Frontend followUser completed successfully ===');
            } catch (error) {
                console.error('=== Frontend followUser failed ===', error);
                this.followStatusMessage = 'Failed to follow user.';
                setTimeout(() => { this.followStatusMessage = ''; }, 3000);
            }
        },
        async unfollowUser() {
            try {
                const response = await fetch('/api/user/unfollow', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: this.profile.user.ID || this.profile.user.id }),
                    credentials: 'include'
                });
                if (!response.ok) throw new Error('Failed to unfollow user');
                // Always re-fetch profile to get correct state
                await this.fetchAll();
                this.followStatusMessage = 'Unfollowed!';
                setTimeout(() => { this.followStatusMessage = ''; }, 3000);
            } catch (error) {
                this.followStatusMessage = 'Failed to unfollow user.';
                setTimeout(() => { this.followStatusMessage = ''; }, 3000);
            }
        },
        getAvatarUrl(avatar) {
            if (!avatar) {
                return '/static/images/default-avatar.png';
            }
            // If it's already a full URL, return as is
            if (avatar.startsWith('http')) {
                return avatar;
            }
            // Construct the proper URL for uploaded files
            return `/web/${avatar}`;
        },
        openChat(user) {
            this.openChats.push(user);
        },
        closeChat(userId) {
            this.openChats = this.openChats.filter(user => user.ID !== userId);
        },
        getChatZIndex(userId) {
            return this.openChats.length - this.openChats.indexOf(this.openChats.find(user => user.ID === userId));
        },
        onPasswordChangeSuccess() {
            this.showChangePassword = false;
        }
    },
    mounted() {
        this.fetchAll();
        // Listen for WebSocket privacy update events
        if (this.$root && this.$root.websocket && this.$root.websocket.eventBus) {
            this.$root.websocket.eventBus.on('profile-privacy-update', (data) => {
                if (!data || !data.user_id) return;
                const viewedId = this.userId || (this.currentUser && this.currentUser.id);
                if (viewedId && String(data.user_id) === String(viewedId)) {
                    this.fetchAll();
                }
            });
            // Listen for follow status updates
            this.$root.websocket.eventBus.on('follow-status-update', async (data) => {
                if (!data) return;
                const viewedId = this.userId || (this.currentUser && this.currentUser.id);
                if (
                    viewedId &&
                    (String(data.follower_id) === String(viewedId) || String(data.followed_id) === String(viewedId))
                ) {
                    await this.fetchAll();
                    this.forceRerenderKey++;
                    this.$forceUpdate && this.$forceUpdate();
                }
            });
        }
    },
    props: {
        userId: {
            type: [String, Number],
            default: null
        },
        currentUser: {
            type: Object,
            required: true
        }
    },
    watch: {
        userId: {
            immediate: true,
            handler() {
                this.fetchAll();
            }
        },
        currentUser: {
            deep: true,
            handler(newVal) {
                if (newVal && newVal.id) {
                    this.fetchAll();
                }
            }
        }
    },
    components: {
        'users-list': window.UsersList,
        'p-change-password': window.P_ChangePassword
    },
};
// No mount here, will be registered globally.
