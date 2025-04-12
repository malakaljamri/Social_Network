// Vue App Implementation
const { createApp, ref, reactive, computed, onMounted } = Vue;

// Main Vue Application
const app = createApp({
    // Use different delimiters to avoid conflict with Go templates
    delimiters: ['[[', ']]'],
    setup() {
        // State variables
        const posts = ref([]);
        const loading = ref(true);
        loading.value = false;
        const currentPage = ref(1);
        const totalPages = ref(1);
        const currentUser = reactive({
            id: null,
            username: null,
            isLoggedIn: false
        });
        const onlineUsers = ref([]);
        const categories = ref([]);
        const filters = reactive({
            category: null,
            //userOnly: false,
            dateFrom: null,
            dateTo: null
            //likedOnly: false
        });

        // Computed properties for Derived Data that depend on other reactive data:
        // This updates automatically when posts or filters change
        const filteredPosts = computed(() => {
            let result = [...posts.value];
            
            if (filters.category) {
                result = result.filter(post => post.Categories.includes(parseInt(filters.category)));
            }
            
            if (filters.userOnly && currentUser.id) {
                result = result.filter(post => post.UserID && post.UserID === currentUser.id);
            }
            
            if (filters.dateFrom) {
                const fromDate = new Date(filters.dateFrom);
                result = result.filter(post => new Date(post.CreatedAt) >= fromDate);
            }
            
            if (filters.dateTo) {
                const toDate = new Date(filters.dateTo);
                result = result.filter(post => new Date(post.CreatedAt) <= toDate);
            }
            
            // if (filters.likedOnly) {
                
            // }
            
            return result;
        });

        // Methods
        const fetchUserStatus = async () => {
            try {
                const response = await fetch('/api/user_status');
                const data = await response.json();
                
                currentUser.isLoggedIn = data.loggedIn;
                if (data.loggedIn) {
                    currentUser.id = data.userID;
                    currentUser.username = data.username;
                }
                
                return data;
            } catch (error) {
                console.error('Error fetching user status:', error);
            }
        };

        const fetchPosts = async (page = 1) => {
            loading.value = true;
            try {
                const response = await fetch(`/posts?page=${page}&limit=10`, {
                    credentials: 'include'
                });
                
                if (!response.ok) throw new Error('Failed to fetch posts');
                
                const data = await response.json();
                posts.value = data;
                currentPage.value = page;
                
                // Get total pages from header if available
                const totalPagesHeader = response.headers.get('X-Total-Pages');
                if (totalPagesHeader) {
                    totalPages.value = parseInt(totalPagesHeader);
                }
                
                return data;
            } catch (error) {
                console.error('Error fetching posts:', error);
            } finally {
                loading.value = false;
            }
        };

        const fetchCategories = async () => {
            try {
                const response = await fetch('/categories');
                if (!response.ok) throw new Error('Failed to fetch categories');
                
                const data = await response.json();
                categories.value = data;
                return data;
            } catch (error) {
                console.error('Error fetching categories:', error);
            }
        };

        const likePost = async (postId) => {
            if (!currentUser.isLoggedIn) {
                alert('Please log in to like posts');
                return;
            }
            
            try {
                const response = await fetch(`/post/like`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: postId }),
                    credentials: 'include'
                });
                
                if (!response.ok) throw new Error('Failed to like post');
                
                // Refresh posts to get updated like count
                await fetchPosts(currentPage.value);
                
                return true;
            } catch (error) {
                console.error('Error liking post:', error);
                return false;
            }
        };

        const dislikePost = async (postId) => {
            if (!currentUser.isLoggedIn) {
                alert('Please log in to dislike posts');
                return;
            }
            
            try {
                const response = await fetch(`/post/dislike`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: postId }),
                    credentials: 'include'
                });
                
                if (!response.ok) throw new Error('Failed to dislike post');
                
                // Refresh posts to get updated dislike count
                await fetchPosts(currentPage.value);
                
                return true;
            } catch (error) {
                console.error('Error disliking post:', error);
                return false;
            }
        };

        // Get category name by ID - needed for displaying category names in posts
        const getCategoryName = (categoryId) => {
            const category = categories.value.find(cat => cat.ID === categoryId);
            return category ? category.Name : 'Unknown';
        };

        // Chat functionality
        const openChat = (userId) => {
            if (!currentUser.isLoggedIn) {
                alert('Please log in to use chat');
                return;
            }
            
            // Call existing chat window function from websocket.js if it exists
            if (typeof openChatWindow === 'function') {
                openChatWindow(userId);
            } else {
                console.log('Chat functionality not fully implemented yet');
            }
        };

        // WebSocket initialization for real-time features
        const initializeWebSocket = () => {
            // Delegate to existing websocket.js functionality
            if (typeof initializeWebSocket === 'function') {
                return window.initializeWebSocket();
            } else {
                console.log('WebSocket not fully implemented yet');
                return Promise.resolve();
            }
        };

        // Fetch online users
        const fetchOnlineUsers = async () => {
            try {
                const response = await fetch('/api/online-users');
                if (!response.ok) throw new Error('Failed to fetch online users');
                
                const data = await response.json();
                onlineUsers.value = data;
                return data;
            } catch (error) {
                console.error('Error fetching online users:', error);
            }
        };

        // Called when component is mounted
        onMounted(async () => {
            await fetchUserStatus();

            if (currentUser.isLoggedIn) {
                await fetchCategories();
                await fetchPosts();
                await fetchOnlineUsers();
                // Initialize websocket for real-time features
                setTimeout(() => {
                    initializeWebSocket();
                }, 1000);
            }
         
            // Set up periodic refresh of online users
            setInterval(fetchOnlineUsers, 30000);
            
            // Set up filter change handlers
            document.getElementById('fromDate')?.addEventListener('change', (e) => {
                filters.dateFrom = e.target.value;
            });
            
            document.getElementById('toDate')?.addEventListener('change', (e) => {
                filters.dateTo = e.target.value;
            });
            
            document.getElementById('loggedInUserFilter')?.addEventListener('change', (e) => {
                filters.userOnly = e.target.checked;
            });
            
            document.getElementById('likedPosts')?.addEventListener('change', (e) => {
                filters.likedOnly = e.target.checked;
            });
        });

        // Return reactive state and methods for template use
        return {
            posts,
            loading,
            currentPage,
            totalPages,
            currentUser,
            onlineUsers,
            categories,
            filters,
            filteredPosts,
            fetchPosts,
            fetchCategories,
            likePost,
            dislikePost,
            getCategoryName,
            openChat
        };
    }
});

// Register and mount the app when document is ready
document.addEventListener('DOMContentLoaded', () => {
    // setTimeout(() => {
        app.mount('#forum-container');
    // }, 1000); // Delay to ensure DOM is ready
});
