// ProfileView Component
const ProfileView = {
    template: `
        <div class="profile-view">
            <filters-sidebar :is-profile="true" @profile-filter-changed="onProfileFilterChanged"></filters-sidebar>
            <div class="profile-main">
                <div v-if="loading" class="loading-indicator">Loading profile...</div>
                <div v-else>
                    <div class="profile-header">
                        <div class="profile-avatar">
                            <img :src="profile.user.avatar || '/static/images/default-avatar.png'" 
                                 class="avatar-large profile-avatar-img"
                                 :alt="profile.user.username">
                            <button v-if="isOwnProfile" 
                                    @click="showEditForm = !showEditForm"
                                    class="btn btn-primary">
                                {{ showEditForm ? 'Cancel Edit' : 'Edit Profile' }}
                            </button>
                        </div>
                        <div class="profile-info">
                            <h2>{{ profile.user.Username || profile.user.username }}'s Profile</h2>
                            <!-- Follow/Unfollow/Request Button for non-own profiles -->
                            <div v-if="!isOwnProfile && !isViewingOwnProfile" class="follow-action">
                                <button v-if="profile.IsFollowing" class="btn btn-danger" @click="unfollowUser" title="Click to unfollow this user">
                                    Unfollow
                                </button>
                                <button v-else-if="profile.IsPending" class="btn btn-secondary" disabled title="Your follow request is awaiting approval">
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
                                        <img :src="user.avatar || '/static/images/default-avatar.png'" class="avatar-small" style="width:24px;height:24px;margin-right:5px;">
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
                                        <img :src="user.avatar || '/static/images/default-avatar.png'" class="avatar-small" style="width:24px;height:24px;margin-right:5px;">
                                        {{ user.Username || user.username }} <span style="color: #888; font-size: 0.9em;">({{ user.Email || user.email }})</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <!-- Profile Content -->
                        <div class="profile-content">
                            <h3>{{ profileFilterLabel }}</h3>
                            <div v-if="filteredPosts.length === 0" class="no-content">
                                No content to show.
                            </div>
                            <div v-else class="content-list">
                                <div v-for="post in filteredPosts" 
                                     :key="post.ID" 
                                     class="post-card">
                                    <div class="post-header">
                                        <h2>{{ post.Title }}</h2>
                                        <div class="post-meta">
                                            <span class="post-date">{{ formatDate(post.CreatedAt) }}</span>
                                        </div>
                                    </div>
                                    <div class="post-content">{{ post.Text }}</div>
                                </div>
                            </div>
                        </div>
                    </template>
                </div>
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
                IsFollowing: false,
                IsPending: false
            },
            loading: false,
            profileFilter: 'all',
            showEditForm: false,
            showFollowers: false,
            showFollowing: false,
            followers: [],
            following: [],
            followStatusMessage: ''
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
            switch (this.profileFilter) {
                case 'posts':
                    return this.profile.posts || [];
                case 'likes':
                    return this.profile.likedPosts || [];
                case 'followers':
                    return this.profile.followers || [];
                case 'following':
                    return this.profile.following || [];
                default:
                    return (this.profile.posts || []).concat(this.profile.likedPosts || []);
            }
        },
        profileFilterLabel() {
            switch (this.profileFilter) {
                case 'posts': return 'My Posts';
                case 'likes': return 'Liked Posts';
                case 'followers': return 'Followers';
                case 'following': return 'Following';
                default: return 'All Posts';
            }
        }
    },
    methods: {
        async fetchProfile() {
            this.loading = true;
            try {
                let userId = this.userId;
                if (!userId) {
                    userId = this.$root.currentUser.value.id;
                }
                const response = await fetch(`/api/user/profile?id=${userId}`, {
                    credentials: 'include'
                });
                if (!response.ok) {
                    throw new Error('Failed to fetch profile');
                }
                this.profile = await response.json();
                // Fetch followers and following lists
                await this.fetchFollowers();
                await this.fetchFollowing();
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                this.loading = false;
            }
        },
        async fetchFollowers() {
            try {
                const response = await fetch('/api/user/followers', { credentials: 'include' });
                if (!response.ok) throw new Error('Failed to fetch followers');
                this.followers = await response.json();
            } catch (error) {
                this.followers = [];
            }
        },
        async fetchFollowing() {
            try {
                let userId = this.userId;
                if (!userId) userId = this.$root.currentUser.value.id;
                const response = await fetch(`/api/user/following?id=${userId}`, { credentials: 'include' });
                if (!response.ok) throw new Error('Failed to fetch following');
                this.following = await response.json();
            } catch (error) {
                this.following = [];
            }
        },
        async togglePrivacy() {
            try {
                const newPrivacy = !this.profile.user.is_private;
                const response = await fetch('/api/profile/privacy', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_private: newPrivacy }),
                    credentials: 'include'
                });
                if (!response.ok) throw new Error('Failed to update privacy');
                this.profile.user.is_private = newPrivacy;
            } catch (error) {
                alert('Failed to update privacy.');
            }
        },
        onProfileFilterChanged(newFilter) {
            this.profileFilter = newFilter;
        },
        formatDate(dateStr) {
            return new Date(dateStr).toLocaleString();
        },
        onProfileUpdated() {
            this.showEditForm = false;
            this.fetchProfile();
        },
        onRequestHandled() {
            this.fetchProfile();
        },
        async followUser() {
            try {
                const response = await fetch('/api/user/follow', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: this.profile.user.ID || this.profile.user.id }),
                    credentials: 'include'
                });
                if (!response.ok) throw new Error('Failed to follow user');
                // Always re-fetch profile to get correct state (IsPending, IsFollowing, followers_count)
                await this.fetchProfile();
                this.followStatusMessage = (this.profile.IsPending ? 'Follow request sent!' : 'Followed!');
                setTimeout(() => { this.followStatusMessage = ''; }, 3000);
            } catch (error) {
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
                await this.fetchProfile();
                this.followStatusMessage = 'Unfollowed!';
                setTimeout(() => { this.followStatusMessage = ''; }, 3000);
            } catch (error) {
                this.followStatusMessage = 'Failed to unfollow user.';
                setTimeout(() => { this.followStatusMessage = ''; }, 3000);
            }
        }
    },
    mounted() {
        //this.fetchProfile(); // Now it is handled by the watch. This is for the van button to work.
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
            }
        }
    },
};

// No mount here, will be registered globally. 