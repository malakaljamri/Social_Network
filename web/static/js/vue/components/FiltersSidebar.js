// FiltersSidebar Component
const FiltersSidebar = {
    template: `
        <div class="filters-sidebar">
            <div class="filter-section">
                <h3 class="collapsible">Categories</h3>
                <div class="content">
                    <div v-if="categories && categories.length">
                        <div v-for="category in categories" :key="category.ID">
                            <input type="checkbox" 
                                   :id="'category-'+category.ID"
                                   :value="category.ID"
                                   v-model="filters.category">
                            <label :for="'category-'+category.ID">
                                [[category.Name]] ([[category.PostCount]])
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <div class="filter-section">
                <h3 class="collapsible">User</h3>
                <div class="content">
                    <input type="checkbox" 
                           id="loggedInUserFilter"
                           v-model="filters.userOnly"
                           :disabled="!currentUser.isLoggedIn">
                    Show only my posts
                </div>
            </div>

            <div class="filter-section">
                <h3 class="collapsible">Date Range</h3>
                <div class="content">
                    <input type="date" 
                           id="fromDate"
                           v-model="filters.dateFrom">
                    <input type="date"
                           id="toDate"
                           v-model="filters.dateTo">
                </div>
            </div>

            <div class="filter-section liked-section">
                <h3 class="collapsible">Liked Posts</h3>
                <div class="content">
                    <input type="checkbox"
                           id="likedPosts"
                           v-model="filters.likedOnly">
                    Show only liked posts
                </div>
            </div>

            <div v-if="isProfile" class="filter-section">
                <h3 class="collapsible">Profile Filters</h3>
                <div class="content">
                    <div class="profile-filter">
                        <label>Show:</label>
                        <select v-model="profileFilter">
                            <option value="all">All Posts</option>
                            <option value="posts">My Posts</option>
                            <option value="likes">Liked Posts</option>
                            <option value="followers">Followers</option>
                            <option value="following">Following</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    `,
    props: {
        isProfile: {
            type: Boolean,
            default: false
        }
    },
    setup(props, { emit }) {
        const currentUser = Vue.inject('currentUser');
        const categories = Vue.ref([]);
        const filters = Vue.reactive({
            category: [],
            userOnly: false,
            dateFrom: '',
            dateTo: '',
            likedOnly: false
        });
        const profileFilter = Vue.ref('all');

        // Fetch categories
        async function fetchCategories() {
            try {
                const response = await fetch('/api/categories');
                const data = await response.json();
                categories.value = data;
            } catch (error) {
                console.error('Error fetching categories:', error);
            }
        }

        // Watch for filter changes
        Vue.watch(filters, (newFilters) => {
            emit('filters-changed', newFilters);
        }, { deep: true });

        // Watch for profile filter changes
        Vue.watch(profileFilter, (newFilter) => {
            emit('profile-filter-changed', newFilter);
        });

        // Initialize
        fetchCategories();

        return {
            currentUser,
            categories,
            filters,
            profileFilter
        };
    }
};

// No mount here, will be registered globally. 