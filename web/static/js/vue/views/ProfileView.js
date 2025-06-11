// ProfileView Component
const ProfileView = {
    template: `
        <div class="profile-view">
            <filters-sidebar :is-profile="true" @profile-filter-changed="onProfileFilterChanged"></filters-sidebar>
            <div class="profile-main">
                <div v-if="loading" class="loading-indicator">Loading profile...</div>
                <div v-else>
                    <h2>[[profile.username]]'s Profile</h2>
                    <div class="profile-info">
                        <p><strong>Email:</strong> [[profile.email]]</p>
                        <p><strong>Followers:</strong> [[profile.followers.length]]</p>
                        <p><strong>Following:</strong> [[profile.following.length]]</p>
                    </div>
                    <div class="profile-posts">
                        <h3>[[profileFilterLabel]]</h3>
                        <div v-if="filteredPosts.length === 0">No posts to show.</div>
                        <div v-for="post in filteredPosts" :key="post.ID" class="post-card">
                            <div class="post-header">
                                <h2>[[post.Title]]</h2>
                                <div class="post-meta">
                                    <span class="post-date">[[formatDate(post.CreatedAt)]]</span>
                                </div>
                            </div>
                            <div class="post-content">[[post.Text]]</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            profile: {
                username: '',
                email: '',
                followers: [],
                following: [],
                posts: [],
                likedPosts: []
            },
            loading: false,
            profileFilter: 'all'
        };
    },
    computed: {
        filteredPosts() {
            switch (this.profileFilter) {
                case 'posts':
                    return this.profile.posts;
                case 'likes':
                    return this.profile.likedPosts;
                case 'followers':
                    return this.profile.followers;
                case 'following':
                    return this.profile.following;
                default:
                    return this.profile.posts.concat(this.profile.likedPosts);
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
                const response = await fetch('/api/profile');
                const data = await response.json();
                this.profile = data;
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
        }
    },
    mounted() {
        this.fetchProfile();
    }
};

// No mount here, will be registered globally. 