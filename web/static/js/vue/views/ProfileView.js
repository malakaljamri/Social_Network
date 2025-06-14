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
                                 :alt="profile.user.username" 
                                 class="avatar-large">
                            <button v-if="isOwnProfile" 
                                    @click="showEditForm = !showEditForm"
                                    class="btn btn-primary">
                                {{ showEditForm ? 'Cancel Edit' : 'Edit Profile' }}
                            </button>
                        </div>
                        <div class="profile-info">
                            <h2>{{ profile.user.username }}'s Profile</h2>
                            <p v-if="profile.user.first_name || profile.user.last_name">
                                <strong>Name:</strong> {{ profile.user.first_name }} {{ profile.user.last_name }}
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
                            <p><strong>Email:</strong> {{ profile.user.email }}</p>
                            <p><strong>Followers:</strong> {{ profile.followers_count }}</p>
                            <p><strong>Following:</strong> {{ profile.following_count }}</p>
                            <p><strong>Posts:</strong> {{ profile.posts_count }}</p>
                        </div>
                    </div>

                    <!-- Profile Edit Form -->
                    <profile-edit-form v-if="showEditForm && isOwnProfile"
                                     @profile-updated="onProfileUpdated">
                    </profile-edit-form>

                    <!-- Follow Requests -->
                    <follow-request-list v-if="isOwnProfile"
                                       @request-handled="onRequestHandled">
                    </follow-request-list>

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
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            profile: {
                user: {
                    username: '',
                    email: '',
                    first_name: '',
                    last_name: '',
                    nickname: '',
                    about_me: '',
                    gender: '',
                    birthDate: '',
                    avatar: ''
                },
                followers_count: 0,
                following_count: 0,
                posts_count: 0
            },
            loading: false,
            profileFilter: 'all',
            showEditForm: false
        };
    },
    computed: {
        isOwnProfile() {
            return this.profile.user.id === this.$root.currentUser.value.id;
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
                const response = await fetch('/api/user/profile', {
                    credentials: 'include'
                });
                if (!response.ok) {
                    throw new Error('Failed to fetch profile');
                }
                this.profile = await response.json();
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                this.loading = false;
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
        }
    },
    mounted() {
        this.fetchProfile();
    }
};

// No mount here, will be registered globally. 