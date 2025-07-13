// FiltersSidebar Component
const FiltersSidebar = {
    props: {
        categories: Array,
        totalResults: {
            type: Number,
            default: 0
        },
        isProfile: {
            type: Boolean,
            default: false
        },
        currentUser: {
            type: Object,
            required: true
        }
    },
    template: `
        <div class="filters-sidebar">
            <button v-if="!isProfile" class="button" style="margin-bottom: 12px; width: 100%; position: unset;" @click="$emit('show-create-post-modal')">✍️ Create Post</button>
            <div class="filter-section">
                <h3>Categories</h3>
                <div v-if="loading" class="loading-indicator">Loading categories...</div>
                <div v-if="error" class="error">{{ error }}</div>
                <div v-if="!loading && !error && categories && categories.length" id="categories-list">
                    <div v-for="category in categories" :key="category.ID || category.id" class="category-item">
                        <input 
                            type="checkbox" 
                            :id="'cat-' + (category.ID || category.id)" 
                            :value="category.ID || category.id"
                            v-model="selectedCategories"
                        >
                        <label :for="'cat-' + (category.ID || category.id)">
                            {{ category.Name || category.name }}
                        </label>
                    </div>
                </div>
                 <div v-else-if="!loading && !error">
                    No categories available.
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
                    >
                    
                    <label for="toDate">To:</label>
                    <input 
                        type="date" 
                        id="toDate" 
                        v-model="dateTo"
                        :min="dateFrom || minDate"
                        :max="maxDate"
                    >
                </div>
            </div>

            <div class="filter-section">
                <h3>Other Filters</h3>
                <div class="checkbox-filters">
                    <div v-if="!isProfile" class="filter-item">
                        <input 
                            type="checkbox" 
                            id="loggedInUserFilter" 
                            v-model="loggedInUserFilter"
                            :disabled="!currentUserValue || !currentUserValue.isLoggedIn"
                        >
                        <label for="loggedInUserFilter">Show only my posts</label>
                    </div>
                </div>
            </div>

            <div class="results-counter">
                <span id="resultsCounter">Total Results: {{ totalResults }}</span>
            </div>
        </div>
    `,
    data() {
        return {
            selectedCategories: [],
            dateFrom: '',
            dateTo: '',
            loggedInUserFilter: false,
            minDate: '2020-01-01', // Set this based on your oldest post
            maxDate: new Date().toISOString().split('T')[0], // Today
            loading: false,
            error: '',
        };
    },
    computed: {
        currentUserValue() {
            return this.currentUser || { isLoggedIn: false };
        }
    },
    methods: {
        updateFilters() {
            const filters = {
                categories: this.selectedCategories,
                fromDate: this.dateFrom,
                toDate: this.dateTo,
                loggedInUserFilter: this.loggedInUserFilter
            };
            this.$emit('filters-changed', filters);
        },
    },
    watch: {
        selectedCategories: 'updateFilters',
        dateFrom: 'updateFilters',
        dateTo: 'updateFilters',
        loggedInUserFilter: 'updateFilters'
    },
    mounted() {
    }
};

// No mount here, will be registered globally. 