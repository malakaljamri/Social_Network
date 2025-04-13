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
        
        // Profile page state - all arrays must be initialized to empty arrays
        const currentView = ref('posts'); // 'posts', 'profile'
        const profileUser = reactive({
            id: null,
            username: '',
            email: '',
            followers_count: 0,
            following_count: 0,
            posts_count: 0,
            is_following: false,
            is_private: false,
            is_own_profile: false
        });
        const profilePosts = ref([]);
        const profileLoading = ref(false);
        const profileFollowers = ref([]);
        const profileFollowing = ref([]);
        const profileTab = ref('posts'); // 'posts', 'followers', 'following'

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
                posts.value = data || [];
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
                categories.value = data || [];
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
                showAlert('Please log in to use chat');
                return;
            }
            
            // Call existing chat window function from websocket.js if it exists
            if (typeof openChatWindow === 'function') {
                openChatWindow(userId);
            } else {
                console.error('Chat functionality not fully implemented yet');
                showAlert('Chat functionality is not available at the moment');
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
                const response = await fetch('/api/online-users', {
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    console.error("Error fetching online users:", response.statusText);
                    return;
                }
                
                const data = await response.json();
                
                // Ensure user IDs are integers for proper comparison and view switching
                onlineUsers.value = Array.isArray(data) ? data.map(user => ({
                    ...user,
                    id: parseInt(user.id) // Ensure ID is an integer
                })) : [];
                
                console.log("Online users:", onlineUsers.value);
            } catch (error) {
                console.error("Error fetching online users:", error);
                onlineUsers.value = [];
            }
        };
        
        // Profile related methods
        
        // Reset profile data to avoid stale data
        const resetProfileData = () => {
            profilePosts.value = [];
            profileFollowers.value = [];
            profileFollowing.value = [];
            profileUser.id = null;
            profileUser.username = '';
            profileUser.email = '';
            profileUser.followers_count = 0;
            profileUser.following_count = 0;
            profileUser.posts_count = 0;
            profileUser.is_following = false;
            profileUser.is_private = false;
            profileUser.is_own_profile = false;
        };
        
        // View a user's profile
        const viewUserProfile = async (userId) => {
            console.log("viewUserProfile called with userId:", userId);
            if (!userId) {
                console.error("viewUserProfile called with invalid userId");
                showAlert("Invalid user ID");
                return;
            }
            
            // Force reset profile data first
            resetProfileData();
            
            try {
                // Set loading state and switch view
                profileLoading.value = true;
                
                // IMPORTANT: Change view BEFORE fetching data to ensure proper UI update
                currentView.value = 'profile';
                profileTab.value = 'posts';
                
                console.log("Changed currentView to 'profile', current state:", currentView.value);
                
                // Fetch user profile data
                const response = await fetch(`/api/user/profile?id=${userId}`);
                if (!response.ok) {
                    console.error("API error:", response.status, response.statusText);
                    throw new Error('Failed to fetch user profile');
                }
                
                const data = await response.json();
                console.log("Profile data received:", data);
                
                // Check if data has expected structure
                if (!data || !data.user) {
                    console.error("Unexpected API response format:", data);
                    throw new Error('Invalid profile data format');
                }
                
                // Determine if this is the current user's profile
                const isOwnProfile = currentUser.isLoggedIn && currentUser.id === parseInt(userId);
                console.log("Is viewing own profile:", isOwnProfile, "Current user ID:", currentUser.id, "Profile user ID:", userId);
                
                // Update profileUser with the fetched data
                Object.assign(profileUser, {
                    id: parseInt(userId),
                    username: data.User.Username || '',
                    email: data.User.Email || '',
                    followers_count: data.FollowersCount || 0,
                    following_count: data.FollowingCount || 0,
                    posts_count: data.PostsCount || 0,
                    is_following: data.IsFollowing || false,
                    is_private: data.User.IsPrivate || false,
                    is_own_profile: isOwnProfile
                });
                
                console.log("Updated profileUser state:", profileUser);
                
                // Fetch additional profile data in parallel for better performance
                await Promise.all([
                    fetchUserPosts(userId),
                    fetchUserFollowers(userId),
                    fetchUserFollowing(userId)
                ]).catch(error => {
                    console.error("Error fetching profile data:", error);
                    // Continue showing profile even if some data failed to load
                });
                
            } catch (error) {
                console.error('Error fetching user profile:', error);
                showAlert('Could not load profile: ' + error.message);
                // Return to posts view in case of error
                currentView.value = 'posts';
            } finally {
                profileLoading.value = false;
                console.log("Profile loading complete. Current view:", currentView.value);
            }
        };
        
        // Fetch user's posts
        const fetchUserPosts = async (userId, page = 1, limit = 10) => {
            console.log("fetchUserPosts for userId:", userId);
            if (!userId) {
                console.error("fetchUserPosts called with invalid userId");
                profilePosts.value = [];
                return [];
            }
            
            profileLoading.value = true;
            try {
                const response = await fetch(`/api/user/posts?id=${userId}&page=${page}&limit=${limit}`);
                if (!response.ok) {
                    console.error("API error:", response.status, response.statusText);
                    throw new Error('Failed to fetch user posts');
                }
                
                const data = await response.json();
                console.log("User posts received:", data);
                
                // Ensure we always have an array
                profilePosts.value = Array.isArray(data) ? data : [];
                
                return profilePosts.value;
            } catch (error) {
                console.error('Error fetching user posts:', error);
                profilePosts.value = [];
                return [];
            } finally {
                profileLoading.value = false;
            }
        };
        
        // Fetch user's followers
        const fetchUserFollowers = async (userId) => {
            console.log("fetchUserFollowers for userId:", userId);
            if (!userId) {
                console.error("fetchUserFollowers called with invalid userId");
                profileFollowers.value = [];
                return [];
            }
            
            profileLoading.value = true;
            try {
                const response = await fetch(`/api/user/followers?id=${userId}`);
                if (!response.ok) {
                    console.error("API error:", response.status, response.statusText);
                    throw new Error('Failed to fetch followers');
                }
                
                const data = await response.json();
                console.log("User followers received:", data);
                
                // Ensure we always have an array
                profileFollowers.value = Array.isArray(data) ? data : [];
                
                return profileFollowers.value;
            } catch (error) {
                console.error('Error fetching followers:', error);
                profileFollowers.value = [];
                return [];
            } finally {
                profileLoading.value = false;
            }
        };
        
        // Fetch users the profile user is following
        const fetchUserFollowing = async (userId) => {
            console.log("fetchUserFollowing for userId:", userId);
            if (!userId) {
                console.error("fetchUserFollowing called with invalid userId");
                profileFollowing.value = [];
                return [];
            }
            
            profileLoading.value = true;
            try {
                const response = await fetch(`/api/user/following?id=${userId}`);
                if (!response.ok) {
                    console.error("API error:", response.status, response.statusText);
                    throw new Error('Failed to fetch following');
                }
                
                const data = await response.json();
                console.log("User following received:", data);
                
                // Ensure we always have an array
                profileFollowing.value = Array.isArray(data) ? data : [];
                
                return profileFollowing.value;
            } catch (error) {
                console.error('Error fetching following:', error);
                profileFollowing.value = [];
                return [];
            } finally {
                profileLoading.value = false;
            }
        };
        
        // Follow a user
        const followUser = async (userId) => {
            if (!currentUser.isLoggedIn) {
                showAlert('Please log in to follow users');
                return false;
            }
            
            try {
                profileLoading.value = true;
                const response = await fetch('/api/user/follow', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId }),
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error('Follow API error:', response.status, errorData);
                    throw new Error(errorData.message || 'Failed to follow user');
                }
                
                // Update profile data
                profileUser.is_following = true;
                profileUser.followers_count++;
                showAlert(`You are now following ${profileUser.username}`);
                
                // Refresh followers list if we're on that tab
                if (profileTab.value === 'followers') {
                    await fetchUserFollowers(userId);
                }
                
                return true;
            } catch (error) {
                console.error('Error following user:', error);
                showAlert(error.message || 'Error following user');
                return false;
            } finally {
                profileLoading.value = false;
            }
        };

        // Unfollow a user
        const unfollowUser = async (userId) => {
            if (!currentUser.isLoggedIn) {
                showAlert('Please log in to unfollow users');
                return false;
            }
            
            try {
                profileLoading.value = true;
                const response = await fetch('/api/user/unfollow', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId }),
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error('Unfollow API error:', response.status, errorData);
                    throw new Error(errorData.message || 'Failed to unfollow user');
                }
                
                // Update profile data
                profileUser.is_following = false;
                profileUser.followers_count = Math.max(0, profileUser.followers_count - 1);
                showAlert(`You are no longer following ${profileUser.username}`);
                
                // Refresh followers list if we're on that tab
                if (profileTab.value === 'followers') {
                    await fetchUserFollowers(userId);
                }
                
                return true;
            } catch (error) {
                console.error('Error unfollowing user:', error);
                showAlert(error.message || 'Error unfollowing user');
                return false;
            } finally {
                profileLoading.value = false;
            }
        };
        
        // Change profile tab
        const changeProfileTab = async (tab) => {
            console.log(`Changing profile tab to: ${tab}`);
            profileTab.value = tab;
            
            try {
                profileLoading.value = true;
                if (tab === 'followers') {
                    await fetchUserFollowers(profileUser.id);
                } else if (tab === 'following') {
                    await fetchUserFollowing(profileUser.id);
                } else if (tab === 'posts' && (!profilePosts.value || profilePosts.value.length === 0)) {
                    await fetchUserPosts(profileUser.id);
                }
            } catch (error) {
                console.error(`Error loading ${tab} tab:`, error);
                showAlert(`Could not load ${tab}: ${error.message}`);
            } finally {
                profileLoading.value = false;
            }
        };
        
        // Go back to main feed
        const returnToFeed = () => {
            console.log("Returning to feed view");
            currentView.value = 'posts';
        };

        // View posts by user (shortcut from the main feed)
        const viewPostsByUser = (userId, username) => {
            viewUserProfile(userId);
        };

        // Update privacy setting
        const updatePrivacySetting = (event) => {
            if (!currentUser.isLoggedIn || currentUser.id !== profileUser.id) {
                return;
            }
            
            const privacyValue = event.target.value;
            const isPrivate = privacyValue === 'private';
            
            // Store previous state in case we need to revert
            const previousState = profileUser.is_private;
            
            // Update UI immediately for better UX
            profileUser.is_private = isPrivate;
            
            fetch('/api/user/privacy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    is_private: isPrivate
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to update privacy settings');
                }
                return response.json();
            })
            .then(data => {
                console.log('Privacy settings updated:', data);
                // Show success message
                showAlert(isPrivate ? 
                    'Your profile is now private. Only followers can see your posts.' : 
                    'Your profile is now public. Everyone can see your posts.');
            })
            .catch(error => {
                console.error('Error updating privacy settings:', error);
                // Revert UI change on error
                profileUser.is_private = previousState;
                showAlert('Failed to update privacy settings. Please try again.');
            });
        };

        // Show simple alert message
        const showAlert = (message) => {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'custom-alert';
            alertDiv.textContent = message;
            document.body.appendChild(alertDiv);
            
            // Auto-remove after 3 seconds
            setTimeout(() => {
                alertDiv.classList.add('fade-out');
                setTimeout(() => {
                    document.body.removeChild(alertDiv);
                }, 500);
            }, 3000);
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
            
            // Listen for profile navigation events from nav.js
            document.addEventListener('showUserProfile', (event) => {
                console.log("Received showUserProfile event:", event.detail);
                if (event.detail && event.detail.userId) {
                    viewUserProfile(event.detail.userId);
                }
            });
        });

        // Return reactive state and methods for template use
        return {
            // Main feed state
            posts,
            loading,
            currentPage,
            totalPages,
            currentUser,
            onlineUsers,
            categories,
            filters,
            filteredPosts,
            
            // Profile state
            currentView,
            profileUser,
            profilePosts,
            profileLoading,
            profileFollowers,
            profileFollowing,
            profileTab,
            
            // Methods
            fetchPosts,
            fetchCategories,
            likePost,
            dislikePost,
            getCategoryName,
            openChat,
            
            // Profile methods
            viewUserProfile,
            fetchUserPosts,
            fetchUserFollowers,
            fetchUserFollowing,
            followUser,
            unfollowUser,
            changeProfileTab,
            returnToFeed,
            viewPostsByUser,
            updatePrivacySetting,
            showAlert
        };
    }
});

// Register and mount the app when document is ready
document.addEventListener('DOMContentLoaded', () => {
    // setTimeout(() => {
        app.mount('#forum-container');
    // }, 1000); // Delay to ensure DOM is ready
});
