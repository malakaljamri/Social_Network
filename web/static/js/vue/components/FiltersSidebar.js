// FiltersSidebar Component
const FiltersSidebar = {
    template: `
        <div class="filters-sidebar">
            <div class="filter-section">
                <h3>Categories</h3>
                <div id="categories-list">
                    <div v-for="category in categories" :key="category.ID" class="category-item">
                        <input 
                            type="checkbox" 
                            :id="'category-' + category.ID" 
                            :value="category.ID"
                            v-model="selectedCategories"
                            @change="updateFilters"
                        >
                        <label :for="'category-' + category.ID">
                            [[category.Name]] ([[category.PostCount || 0]])
                        </label>
                    </div>
                </div>
            </div>

            <div class="filter-section">
                <h3>Date Range</h3>
                <div class="date-inputs">
                    <label for="fromDate">From:</label>
                    <input 
                        type="date" 
                        id="fromDate" 
                        v-model="dateFrom"
                        :max="dateTo || maxDate"
                        @change="updateFilters"
                    >
                    
                    <label for="toDate">To:</label>
                    <input 
                        type="date" 
                        id="toDate" 
                        v-model="dateTo"
                        :min="dateFrom || minDate"
                        :max="maxDate"
                        @change="updateFilters"
                    >
                </div>
            </div>

            <div class="filter-section">
                <h3>Other Filters</h3>
                <div class="checkbox-filters">
                    <div class="filter-item">
                        <input 
                            type="checkbox" 
                            id="likedPosts" 
                            v-model="likedOnly"
                            @change="updateFilters"
                        >
                        <label for="likedPosts">Show only liked posts</label>
                    </div>
                    
                    <div class="filter-item">
                        <input 
                            type="checkbox" 
                            id="loggedInUserFilter" 
                            v-model="loggedInUserFilter"
                            :disabled="!currentUser.isLoggedIn"
                            @change="updateFilters"
                        >
                        <label for="loggedInUserFilter">Show only my posts</label>
                    </div>
                </div>
            </div>

            <div class="results-counter">
                <span id="resultsCounter">Total Results: 0</span>
            </div>
        </div>
    `,
    data() {
        return {
            categories: [],
            selectedCategories: [],
            dateFrom: '',
            dateTo: '',
            likedOnly: false,
            loggedInUserFilter: false,
            minDate: '2020-01-01', // Set this based on your oldest post
            maxDate: new Date().toISOString().split('T')[0] // Today
        };
    },
    computed: {
        currentUser() {
            return this.$root.currentUser;
        }
    },
    methods: {
        async fetchCategories() {
            try {
                const response = await fetch('/api/categories');
                if (!response.ok) throw new Error('Failed to fetch categories');
                
                const data = await response.json();
                this.categories = data;
            } catch (error) {
                console.error('Error fetching categories:', error);
            }
        },
        updateFilters() {
            const filters = {
                categories: this.selectedCategories,
                fromDate: this.dateFrom,
                toDate: this.dateTo,
                likedOnly: this.likedOnly,
                loggedInUserFilter: this.loggedInUserFilter
            };
            
            this.$emit('filters-changed', filters);
        }
    },
    mounted() {
        this.fetchCategories();
    }
};

// No mount here, will be registered globally. 