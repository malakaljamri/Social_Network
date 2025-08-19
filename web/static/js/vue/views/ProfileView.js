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
                        <div class="alert alert-warning">
                            <h4>🔒 Private Profile</h4>
                            <p>This profile is private. Only followers can view the full profile information.</p>
                            <p><strong>What you can see:</strong></p>
                            <ul>
                                <li>Username and avatar</li>
                                <li>Profile privacy status</li>
                                <li>Follow/Unfollow button</li>
                            </ul>
                            <p><strong>What's hidden:</strong></p>
                            <ul>
                                <li>Personal information (name, email, about, etc.)</li>
                                <li>Posts and content</li>
                                <li>Followers and following lists</li>
                                <li>Post counts</li>
                            </ul>
                            <p>Send a follow request to see the full profile!</p>
                        </div>
                    </div>
                    <template v-else>
                        <!-- Profile Content (only shown if user can view it) -->
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
                    </template>
                </div>
            </div>
            <users-list class="users-list" @open-chat="openChat"></users-list>
            <div id="chat-section">
                <chat-window v-for="user in openChats" :key="user.ID" :user="user" :currentUser="$root.currentUser.value" :onClose="() => closeChat(user.ID)" :style="{ zIndex: getChatZIndex(user.ID) }"></chat-window>
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
            showChangePassword: false
        };
    },
    computed: {
        isOwnProfile() {
            // Robust check for both ID and id fields
            const currentId = this.$root.currentUser.value.ID || this.$root.currentUser.value.id;
            const profileId = this.profile.user.ID || this.profile.user.id;
            console.log('ProfileView: isOwnProfile computed - currentId:', currentId, 'profileId:', profileId, 'result:', currentId === profileId);
            return currentId === profileId;
        },
        isViewingOwnProfile() {
            // Alias for template clarity
            return this.isOwnProfile;
        },
        isFollower() {
            // Check if current user is in followers list
            const currentUserId = this.$root.currentUser.value.id || this.$root.currentUser.value.ID;
            const isFollower = this.followers.some(u => u.id === currentUserId || u.ID === currentUserId);
            console.log('ProfileView: isFollower computed - currentUserId:', currentUserId, 'followers:', this.followers, 'result:', isFollower);
            return isFollower;
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
        async fetchProfile() {
            this.loading = true;
            console.log('=== Frontend fetchProfile started ===');
            
            try {
                let userId = this.userId;
                if (!userId) {
                    userId = this.$root.currentUser.value.id || this.$root.currentUser.value.ID;
                }
                console.log('Fetching profile for user ID:', userId);
                
                let url = `/api/user/profile?id=${userId}`;
                if (this.filters) {
                    url += `&filters=${encodeURIComponent(JSON.stringify(this.filters))}`;
                }
                console.log('Profile URL:', url);

                const response = await fetch(url, {
                    credentials: 'include'
                });
                
                console.log('Profile response status:', response.status);
                console.log('Profile response ok:', response.ok);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Profile fetch failed:', errorText);
                    throw new Error('Failed to fetch profile');
                }
                
                this.profile = await response.json();
                console.log('Profile data received:', this.profile);
                console.log('Profile follow status - is_following:', this.profile.is_following, 'is_pending:', this.profile.is_pending);
                
                // Fetch followers and following lists
                console.log('Fetching followers and following lists...');
                await this.fetchFollowers();
                await this.fetchFollowing();
                
                console.log('=== Frontend fetchProfile completed successfully ===');
            } catch (error) {
                console.error('=== Frontend fetchProfile failed ===', error);
            } finally {
                this.loading = false;
            }
        },
        async fetchCategories() {
            try {
                const response = await fetch('/api/categories', { credentials: 'include' });
                if (!response.ok) throw new Error('Failed to fetch categories');
                this.categories = await response.json();
            } catch (error) {
                console.error('Error fetching categories:', error);
                this.categories = [];
            }
        },
        async fetchFollowers() {
            try {
                let userId = this.userId;
                if (!userId) {
                    userId = this.$root.currentUser.value.id || this.$root.currentUser.value.ID;
                }
                console.log('ProfileView: Fetching followers for user ID:', userId);
                const response = await fetch(`/api/user/followers?id=${userId}`, { credentials: 'include' });
                if (!response.ok) throw new Error('Failed to fetch followers');
                this.followers = await response.json();
                console.log('ProfileView: Followers fetched:', this.followers);
            } catch (error) {
                console.error('ProfileView: Error fetching followers:', error);
                this.followers = [];
            }
        },
        async fetchFollowing() {
            try {
                let userId = this.userId;
                if (!userId) userId = this.$root.currentUser.value.id || this.$root.currentUser.value.ID;
                console.log('ProfileView: Fetching following for user ID:', userId);
                const response = await fetch(`/api/user/following?id=${userId}`, { credentials: 'include' });
                if (!response.ok) throw new Error('Failed to fetch following');
                this.following = await response.json();
                console.log('ProfileView: Following fetched:', this.following);
            } catch (error) {
                console.error('ProfileView: Error fetching following:', error);
                this.following = [];
            }
        },
        async togglePrivacy() {
            try {
                const currentPrivacy = (this.profile.user.IsPrivate !== undefined ? this.profile.user.IsPrivate : this.profile.user.is_private);
                const newPrivacy = !currentPrivacy;
                const response = await fetch('/api/profile/privacy', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_private: newPrivacy }),
                    credentials: 'include'
                });
                if (!response.ok) throw new Error('Failed to update privacy');
                // After successful update, fetch the latest profile from backend
                await this.fetchProfile();
            } catch (error) {
                alert('Failed to update privacy.');
            }
        },
        onFiltersChanged(newFilters) {
            this.filters = newFilters;
            let userId = this.userId;
            if (!userId) {
                userId = this.$root.currentUser.value.id || this.$root.currentUser.value.ID;
            }
            this.filters.UserID = userId;
            this.fetchProfile();
        },
        formatDate(dateStr) {
            return window.formatDate(dateStr, "YYYY-MM-DD HH:MM");
        },
        onProfileUpdated() {
            this.showEditForm = false;
            this.fetchProfile();
        },
        onRequestHandled() {
            this.fetchProfile();
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
                
                // Update the profile follow status immediately for better UX
                if (responseData.is_pending !== undefined) {
                    this.profile.is_pending = responseData.is_pending;
                }
                if (responseData.is_following !== undefined) {
                    this.profile.is_following = responseData.is_following;
                }
                
                // If it's a direct follow (not pending), update followers count
                if (!this.profile.is_pending && this.profile.is_following) {
                    this.profile.followers_count = (this.profile.followers_count || 0) + 1;
                    
                    // Add current user to followers list
                    const currentUser = this.$root.currentUser.value;
                    const currentUserId = currentUser.id || currentUser.ID;
                    if (currentUser && !this.followers.some(u => u.id === currentUserId || u.ID === currentUserId)) {
                        this.followers.push({
                            id: currentUserId,
                            ID: currentUserId,
                            Username: currentUser.username || currentUser.Username,
                            Email: currentUser.email || currentUser.Email,
                            avatar: currentUser.avatar || currentUser.Avatar
                        });
                    }
                }
                
                // Refresh followers and following lists to ensure UI consistency
                await this.fetchFollowers();
                await this.fetchFollowing();
                
                console.log('Profile after update - is_following:', this.profile.is_following, 'is_pending:', this.profile.is_pending);
                
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
                
                // Update the profile follow status immediately for better UX
                this.profile.is_following = false;
                this.profile.followers_count = Math.max(0, (this.profile.followers_count || 0) - 1);
                
                // Remove current user from followers list
                const currentUserId = this.$root.currentUser.value.id || this.$root.currentUser.value.ID;
                this.followers = this.followers.filter(u => u.id !== currentUserId && u.ID !== currentUserId);
                
                // Refresh followers and following lists to ensure UI consistency
                await this.fetchFollowers();
                await this.fetchFollowing();
                
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
        },
        
        // Handle real-time follow request updates from websocket
        handleFollowAccepted(event) {
            console.log('ProfileView: Follow request accepted event received:', event);
            console.log('ProfileView: Event detail:', event.detail);
            
            const { user_id, reference_id } = event.detail;
            console.log('ProfileView: user_id:', user_id, 'reference_id:', reference_id);
            
            // Check if this event is relevant to the current profile
            const currentUserId = this.$root.currentUser.value.id || this.$root.currentUser.value.ID;
            console.log('ProfileView: Current user ID:', currentUserId);
            console.log('ProfileView: Current user object:', this.$root.currentUser.value);
            
            if (user_id === currentUserId) {
                // This is about the current user's follow request
                // Check if we're viewing the profile of the user who accepted the request
                const profileUserId = this.profile.user.ID || this.profile.user.id;
                console.log('ProfileView: Profile user ID:', profileUserId);
                
                if (reference_id === profileUserId) {
                    console.log('ProfileView: Updating follow status to accepted for profile:', profileUserId);
                    // Update the profile follow status immediately
                    this.profile.is_pending = false;
                    this.profile.is_following = true;
                    // Update followers count
                    this.profile.followers_count = (this.profile.followers_count || 0) + 1;
                    
                    // Add current user to followers list so isFollower computed property works correctly
                    const currentUser = this.$root.currentUser.value;
                    const currentUserId = currentUser.id || currentUser.ID;
                    if (currentUser && !this.followers.some(u => u.id === currentUserId || u.ID === currentUserId)) {
                        this.followers.push({
                            id: currentUserId,
                            ID: currentUserId,
                            Username: currentUser.username || currentUser.Username,
                            Email: currentUser.email || currentUser.Email,
                            avatar: currentUser.avatar || currentUser.Avatar
                        });
                    }
                    
                    // Force Vue to re-evaluate the isFollower computed property
                    this.$forceUpdate();
                    
                    // Also refresh the followers list from the backend to ensure consistency
                    setTimeout(() => {
                        this.fetchFollowers();
                        this.fetchFollowing();
                    }, 100);
                    
                    // Show success message
                    this.followStatusMessage = 'Follow request accepted!';
                    setTimeout(() => { this.followStatusMessage = ''; }, 3000);
                    
                    console.log('ProfileView: Follow status updated - is_pending:', this.profile.is_pending, 'is_following:', this.profile.is_following);
                    console.log('ProfileView: Followers list updated, count:', this.followers.length);
                    console.log('ProfileView: Current user in followers list:', this.followers.some(u => u.id === currentUser.id));
                    console.log('ProfileView: isFollower computed value:', this.isFollower);
                } else {
                    console.log('ProfileView: Event not relevant to current profile view');
                }
            } else {
                console.log('ProfileView: Event not for current user');
            }
        },
        
        handleFollowDeclined(event) {
            console.log('ProfileView: Follow request declined event received:', event);
            console.log('ProfileView: Event detail:', event.detail);
            
            const { user_id, reference_id } = event.detail;
            console.log('ProfileView: user_id:', user_id, 'reference_id:', reference_id);
            
            // Check if this event is relevant to the current profile
            const currentUserId = this.$root.currentUser.value.id || this.$root.currentUser.value.ID;
            console.log('ProfileView: Current user ID:', currentUserId);
            
            if (user_id === currentUserId) {
                // This is about the current user's follow request
                // Check if we're viewing the profile of the user who declined the request
                const profileUserId = this.profile.user.ID || this.profile.user.id;
                console.log('ProfileView: Profile user ID:', profileUserId);
                
                if (reference_id === profileUserId) {
                    console.log('ProfileView: Updating follow status to declined for profile:', profileUserId);
                    // Update the profile follow status immediately
                    this.profile.is_pending = false;
                    this.profile.is_following = false;
                    
                    // Refresh followers and following lists to ensure UI consistency
                    this.fetchFollowers();
                    this.fetchFollowing();
                    
                    // Show declined message
                    this.followStatusMessage = 'Follow request declined.';
                    setTimeout(() => { this.followStatusMessage = ''; }, 3000);
                    
                    console.log('ProfileView: Follow status updated - is_pending:', this.profile.is_pending, 'is_following:', this.profile.is_following);
                } else {
                    console.log('ProfileView: Event not relevant to current profile view');
                }
            } else {
                                    console.log('ProfileView: Event not for current user');
            }
        },
        
        // Handle new follow requests (when viewing own profile)
        handleFollowRequest(event) {
            console.log('ProfileView: New follow request event received:', event);
            console.log('ProfileView: Event detail:', event.detail);
            
            const { user_id, reference_id } = event.detail;
            console.log('ProfileView: user_id:', user_id, 'reference_id:', reference_id);
            
            // Check if this event is relevant to the current profile
            const currentUserId = this.$root.currentUser.value.id || this.$root.currentUser.value.ID;
            console.log('ProfileView: Current user ID:', currentUserId);
            
            if (user_id === currentUserId && this.isOwnProfile) {
                // This is a new follow request for the current user's profile
                console.log('ProfileView: New follow request received for own profile');
                
                // Update followers count immediately
                this.profile.followers_count = (this.profile.followers_count || 0) + 1;
                
                // Refresh the profile to show the new follow request
                this.fetchProfile();
                
                // Show notification message
                this.followStatusMessage = 'New follow request received!';
                setTimeout(() => { this.followStatusMessage = ''; }, 3000);
            }
        },
        
        // Handle when someone unfollows the current user (when viewing own profile)
        handleUnfollowed(event) {
            console.log('ProfileView: Unfollowed event received:', event);
            console.log('ProfileView: Event detail:', event.detail);
            
            const { user_id, reference_id } = event.detail;
            console.log('ProfileView: user_id:', user_id, 'reference_id:', reference_id);
            
            // Check if this event is relevant to the current profile
            const currentUserId = this.$root.currentUser.value.id || this.$root.currentUser.value.ID;
            console.log('ProfileView: Current user ID:', currentUserId);
            
            if (reference_id === currentUserId && this.isOwnProfile) {
                // Someone unfollowed the current user
                console.log('ProfileView: User unfollowed current user');
                
                // Update followers count immediately
                this.profile.followers_count = Math.max(0, (this.profile.followers_count || 0) - 1);
                
                // Refresh the profile to update the followers list
                this.fetchProfile();
                
                // Show notification message
                this.followStatusMessage = 'Someone unfollowed you.';
                setTimeout(() => { this.followStatusMessage = ''; }, 3000);
            }
        },
        
        // Handle when someone starts following the current user (when viewing own profile)
        handleNewFollower(event) {
            console.log('ProfileView: New follower event received:', event);
            console.log('ProfileView: Event detail:', event.detail);
            
            const { user_id, reference_id } = event.detail;
            console.log('ProfileView: user_id:', user_id, 'reference_id:', reference_id);
            
            // Check if this event is relevant to the current profile
            const currentUserId = this.$root.currentUser.value.id || this.$root.currentUser.value.ID;
            console.log('ProfileView: Current user ID:', currentUserId);
            
            if (reference_id === currentUserId && this.isOwnProfile) {
                // Someone started following the current user
                console.log('ProfileView: New follower for current user');
                
                // Update followers count immediately
                this.profile.followers_count = (this.profile.followers_count || 0) + 1;
                
                // Refresh the profile to update the followers list
                this.fetchProfile();
                
                // Show notification message
                this.followStatusMessage = 'New follower!';
                setTimeout(() => { this.followStatusMessage = ''; }, 3000);
            }
        }
    },
    mounted() {
        //this.fetchProfile(); // Now it is handled by the watch. This is for the van button to work.
        
        // Add event listeners for real-time follow updates
        console.log('ProfileView: Adding websocket event listeners for follow updates');
        window.addEventListener('follow-accepted', this.handleFollowAccepted);
        window.addEventListener('follow-declined', this.handleFollowDeclined);
        window.addEventListener('follow-request', this.handleFollowRequest);
        window.addEventListener('unfollowed', this.handleUnfollowed);
        window.addEventListener('new-follower', this.handleNewFollower);
    },
    beforeUnmount() {
        // Clean up event listeners
        console.log('ProfileView: Removing websocket event listeners');
        window.removeEventListener('follow-accepted', this.handleFollowAccepted);
        window.removeEventListener('follow-declined', this.handleFollowDeclined);
        window.removeEventListener('follow-request', this.handleFollowRequest);
        window.removeEventListener('unfollowed', this.handleUnfollowed);
        window.removeEventListener('new-follower', this.handleNewFollower);
    },
    props: {
        userId: {
            type: [String, Number],
            default: null
        }
    },
    watch: {
        userId: {
            immediate: true,
            handler() {
                this.fetchProfile();
                this.fetchCategories();
                //document.querySelector('.category-item input').dispatchEvent(new Event('change', { bubbles: true }));
                this.onFiltersChanged(this.filters || {}); // to load images
            }
        }
    },
    components: {
        'users-list': window.UsersList,
        'p-change-password': window.P_ChangePassword
    },
};
// No mount here, will be registered globally.
