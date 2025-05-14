// Vue App Implementation
// const { createApp, ref, reactive, computed, onMounted, watch } = Vue;

// Main Vue Application
// const app = createApp({
//     // Use different delimiters to avoid conflict with Go templates
//     delimiters: ['[[', ']]'],
//     setup() {
//         // State variables
//         const posts = ref([]);
//         const selectedGroup = ref(null);
//         const groups = ref([]);
//         const selectedGroupId = ref(null);
//         const groupSearchQuery = ref('');
//         const groupPosts = ref([]);
//         const currentView = ref('login'); // 'login', 'register', 'posts', 'profile', 'groups'
//
//         // Modal state
//         const activeModal = ref(''); // '', 'createPost', 'createGroup'
//         const newPost = reactive({
//             title: '',
//             content: '',
//             category_id: null,
//             privacy: 'public',
//             image: null
//         });
//         const newGroup = reactive({
//             name: '',
//             description: '',
//             privacy: 'public'
//         });
//         function openCreatePost() { activeModal.value = 'createPost'; }
//         function openCreateGroup() { activeModal.value = 'createGroup'; }
//         function closeModal() { activeModal.value = ''; }
//
//         // Computed property for sidebar visibility
//         const showSidebar = computed(() => {
//             return currentView.value !== 'groups';
//         });
//
//         function selectGroup(group) {
//             selectedGroup.value = group;
//         }            
//         const loading = ref(true);
//         loading.value = false;
//         const currentPage = ref(1);
//         const totalPages = ref(1);
//         const currentUser = reactive({
//             id: null,
//             username: null,
//             isLoggedIn: false
//         });
//         const onlineUsers = ref([]);
//         const categories = ref([]);
//         const filters = reactive({
//             category: [],
//             userOnly: false,
//             dateFrom: null,
//             dateTo: null,
//             likedOnly: false
//         });
//         
//         // Profile page state - all arrays must be initialized to empty arrays
//         function goToGroups() {
//             currentView.value = 'groups';
//         }
//         const profileUser = reactive({
//             id: null,
//             username: '',
//             email: '',
//             followers_count: 0,
//             following_count: 0,
//             posts_count: 0,
//             is_following: false,
//             is_private: false,
//             is_own_profile: false
//         });
//         const profilePosts = ref([]);
//         const profileLoading = ref(false);
//         const profileFollowers = ref([]);
//         const profileFollowing = ref([]);
//         const profileTab = ref('posts'); // 'posts', 'followers', 'following'
//
//         // User search state
//         const userSearchQuery = ref('');
//         const userSearchResults = ref([]);
//
//         // Login/Register form state
//         const loginForm = reactive({
//             user_identifier: 'example1@gmail.com',
//             password: '12',
//             error: '',
//             loading: false
//         });
//         const registerForm = reactive({
//             username: '',
//             email: '',
//             password: '',
//             confirmPassword: '',
//             error: '',
//             loading: false
//         });
//
//         // Computed properties for Derived Data that depend on other reactive data:
//         // This updates automatically when posts or filters change
//         const filteredPosts = computed(() => {
//             let result = [...posts.value];
//             
//             // Category filter
//             if (filters.category && filters.category.length > 0) {
//                 result = result.filter(post => 
//                     post.Categories && post.Categories.some(catId => 
//                         filters.category.includes(parseInt(catId))
//                     )
//                 );
//             }
//             
//             // User filter
//             if (filters.userOnly && currentUser.isLoggedIn) {
//                 result = result.filter(post => post.UserID === currentUser.id);
//             }
//             
//             // Date range filter
//             if (filters.dateFrom) {
//                 const fromDate = new Date(filters.dateFrom);
//                 result = result.filter(post => new Date(post.CreatedAt) >= fromDate);
//             }
//             
//             if (filters.dateTo) {
//                 const toDate = new Date(filters.dateTo);
//                 result = result.filter(post => new Date(post.CreatedAt) <= toDate);
//             }
//             
//             // Liked posts filter
//             if (filters.likedOnly && currentUser.isLoggedIn) {
//                 // This will need to be implemented when we have the liked posts data
//                 // result = result.filter(post => post.isLiked);
//             }
//             
//             return result;
//         });
//
//         // Watch for filter changes to update posts
//         watch(filters, () => {
//             // The filteredPosts computed property will automatically update
//             // but we might want to trigger a posts refresh here if needed
//             console.log('Filters changed:', filters);
//         }, { deep: true });
//
//         // Computed property for filtered groups
//         const filteredGroups = computed(() => {
//             if (!groupSearchQuery.value) return groups.value;
//             const query = groupSearchQuery.value.toLowerCase();
//             return groups.value.filter(group => 
//                 group.Name.toLowerCase().includes(query)
//             );
//         });
//
//         // Groups state
//         const showCreateGroupPostForm = ref(false);
//         const newGroupPost = reactive({
//             title: '',
//             content: '',
//             privacy_setting: 'public',
//             category_id: null,
//             file_path: ''
//         });
//
//         // Group Events modal state
//         const showGroupEventsModal = ref(false);
//         const groupEvents = reactive({ upcoming: [], past: [] });
//         const todayDate = new Date().toLocaleDateString();
//
//         // Methods
//         const fetchUserStatus = async () => {
//             try {
//                 const response = await fetch('/api/user_status');
//                 const data = await response.json();
//                 
//                 currentUser.isLoggedIn = data.loggedIn;
//                 if (data.loggedIn) {
//                     currentUser.id = data.userID;
//                     currentUser.username = data.username;
//                 }
//                 
//                 return data;
//             } catch (error) {
//                 console.error('Error fetching user status:', error);
//             }
//         };
//
//         /*const fetchPosts = async (page = 1) => { // the older version is better in paginations
//             loading.value = true;
//             try {
//                 const response = await fetch(`/posts?page=${page}&limit=10`, {
//                     credentials: 'include'
//                 });
//                 
//                 if (!response.ok) throw new Error('Failed to fetch posts');
//                 
//                 const data = await response.json();
//                 posts.value = data || [];
//                 currentPage.value = page;
//                 
//                 // Get total pages from header if available
//                 const totalPagesHeader = response.headers.get('X-Total-Pages');
//                 if (totalPagesHeader) {
//                     totalPages.value = parseInt(totalPagesHeader);
//                 }
//                 
//                 return data;
//             } catch (error) {
//                 console.error('Error fetching posts:', error);
//             } finally {
//                 loading.value = false;
//             }
//         };*/
//
//         const fetchCategories = async () => {
//             try {
//                 const response = await fetch('/categories');
//                 if (!response.ok) throw new Error('Failed to fetch categories');
//                 
//                 const data = await response.json();
//                 categories.value = data || [];
//                 return data;
//             } catch (error) {
//                 console.error('Error fetching categories:', error);
//             }
//         };
//
//         const likePost = async (postId) => {
//             if (!currentUser.isLoggedIn) {
//                 alert('Please log in to like posts');
//                 return;
//             }
//             
//             try {
//                 const response = await fetch(`/post/like`, {
//                     method: 'POST',
//                     headers: { 'Content-Type': 'application/json' },
//                     body: JSON.stringify({ id: postId }),
//                     credentials: 'include'
//                 });
//                 
//                 if (!response.ok) throw new Error('Failed to like post');
//                 
//                 // Refresh posts to get updated like count
//                 await fetchPosts(currentPage.value);
//                 
//                 return true;
//             } catch (error) {
//                 console.error('Error liking post:', error);
//                 return false;
//             }
//         };
//
//         const dislikePost = async (postId) => {
//             if (!currentUser.isLoggedIn) {
//                 alert('Please log in to dislike posts');
//                 return;
//             }
//             
//             try {
//                 const response = await fetch(`/post/dislike`, {
//                     method: 'POST',
//                     headers: { 'Content-Type': 'application/json' },
//                     body: JSON.stringify({ id: postId }),
//                     credentials: 'include'
//                 });
//                 
//                 if (!response.ok) throw new Error('Failed to dislike post');
//                 
//                 // Refresh posts to get updated dislike count
//                 await fetchPosts(currentPage.value);
//                 
//                 return true;
//             } catch (error) {
//                 console.error('Error disliking post:', error);
//                 return false;
//             }
//         };
//
//         // Get category name by ID - needed for displaying category names in posts
//         const getCategoryName = (categoryId) => {
//             const category = categories.value.find(cat => cat.ID === categoryId);
//             return category ? category.Name : 'Unknown';
//         };
//
//         // Chat functionality
//         const openChat = (userId) => {
//             if (!currentUser.isLoggedIn) {
//                 showAlert('Please log in to use chat');
//                 return;
//             }
//             
//             // Call existing chat window function from websocket.js if it exists
//             if (typeof openChatWindow === 'function') {
//                 openChatWindow(userId);
//             } else {
//                 console.error('Chat functionality not fully implemented yet');
//                 showAlert('Chat functionality is not available at the moment');
//             }
//         };
//
//         // WebSocket initialization for real-time features
//         const initializeWebSocket = () => {
//             // Delegate to existing websocket.js functionality
//             if (typeof initializeWebSocket === 'function') {
//                 return window.initializeWebSocket();
//             } else {
//                 console.log('WebSocket not fully implemented yet');
//                 return Promise.resolve();
//             }
//         };
//
//         // Fetch online users
//         const fetchOnlineUsers = async () => {
//             try {
//                 const response = await fetch('/api/online-users', {
//                     credentials: 'include'
//                 });
//                 
//                 if (!response.ok) {
//                     console.error("Error fetching online users:", response.statusText);
//                     return;
//                 }
//                 
//                 const data = await response.json();
//                 
//                 // Ensure user IDs are integers for proper comparison and view switching
//                 onlineUsers.value = Array.isArray(data) ? data.map(user => ({
//                     ...user,
//                     id: parseInt(user.id) // Ensure ID is an integer
//                 })) : [];
//                 
//                 console.log("Online users:", onlineUsers.value);
//             } catch (error) {
//                 console.error("Error fetching online users:", error);
//                 onlineUsers.value = [];
//             }
//         };
//         
//         // Profile related methods
//         
//         // Reset profile data to avoid stale data
//         const resetProfileData = () => {
//             profilePosts.value = [];
//             profileFollowers.value = [];
//             profileFollowing.value = [];
//             profileUser.id = null;
//             profileUser.username = '';
//             profileUser.email = '';
//             profileUser.followers_count = 0;
//             profileUser.following_count = 0;
//             profileUser.posts_count = 0;
//             profileUser.is_following = false;
//             profileUser.is_private = false;
//             profileUser.is_own_profile = false;
//         };
//         
//         // View a user's profile
//         const viewUserProfile = async (userId) => {
//             console.log("viewUserProfile called with userId:", userId);
//             if (!userId) {
//                 console.error("viewUserProfile called with invalid userId");
//                 showAlert("Invalid user ID");
//                 return;
//             }
//             
//             // Force reset profile data first
//             resetProfileData();
//             
//             try {
//                 // Set loading state and switch view
//                 profileLoading.value = true;
//                 
//                 // IMPORTANT: Change view BEFORE fetching data to ensure proper UI update
//                 currentView.value = 'profile';
//                 profileTab.value = 'posts';
//                 
//                 console.log("Changed currentView to 'profile', current state:", currentView.value);
//                 
//                 // Fetch user profile data
//                 const response = await fetch(`/api/user/profile?id=${userId}`);
//                 if (!response.ok) {
//                     console.error("API error:", response.status, response.statusText);
//                     throw new Error('Failed to fetch user profile');
//                 }
//                 
//                 const data = await response.json();
//                 console.log("Profile data received:", data);
//                 
//                 // Check if data has expected structure
//                 if (!data || !data.user) {
//                     console.error("Unexpected API response format:", data);
//                     throw new Error('Invalid profile data format');
//                 }
//                 
//                 // Determine if this is the current user's profile
//                 const isOwnProfile = currentUser.isLoggedIn && (parseInt(currentUser.id) === parseInt(userId));
//                 console.log("Is viewing own profile:", isOwnProfile, "Current user ID:", currentUser.id, "Profile user ID:", userId);
//                 
//                 // Update profileUser with the fetched data
//                 Object.assign(profileUser, {
//                     id: parseInt(userId),
//                     username: data.user.Username || '',
//                     email: data.user.Email || '',
//                     followers_count: data.FollowersCount || 0,
//                     following_count: data.FollowingCount || 0,
//                     posts_count: data.PostsCount || 0,
//                     is_following: data.IsFollowing || false,
//                     is_private: data.user.IsPrivate || false,
//                     is_own_profile: isOwnProfile
//                 });
//                 
//                 console.log("Updated profileUser state:", profileUser);
//                 
//                 // Fetch additional profile data in parallel for better performance
//                 await Promise.all([
//                     fetchUserPosts(userId),
//                     fetchUserFollowers(userId),
//                     fetchUserFollowing(userId)
//                 ]).catch(error => {
//                     console.error("Error fetching profile data:", error);
//                     // Continue showing profile even if some data failed to load
//                 });
//                 
//             } catch (error) {
//                 console.error('Error fetching user profile:', error);
//                 showAlert('Could not load profile: ' + error.message);
//                 // Return to posts view in case of error
//                 currentView.value = 'posts';
//             } finally {
//                 profileLoading.value = false;
//                 console.log("Profile loading complete. Current view:", currentView.value);
//             }
//         };
//         
//         // Fetch user's posts
//         const fetchUserPosts = async (userId, page = 1, limit = 10) => {
//             console.log("fetchUserPosts for userId:", userId);
//             if (!userId) {
//                 console.error("fetchUserPosts called with invalid userId");
//                 profilePosts.value = [];
//                 return [];
//             }
//             
//             profileLoading.value = true;
//             try {
//                 const response = await fetch(`/api/user/posts?id=${userId}&page=${page}&limit=${limit}`);
//                 if (!response.ok) {
//                     console.error("API error:", response.status, response.statusText);
//                     throw new Error('Failed to fetch user posts');
//                 }
//                 
//                 const data = await response.json();
//                 console.log("User posts received:", data);
//                 
//                 // Ensure we always have an array
//                 profilePosts.value = Array.isArray(data) ? data : [];
//                 
//                 return profilePosts.value;
//             } catch (error) {
//                 console.error('Error fetching user posts:', error);
//                 profilePosts.value = [];
//                 return [];
//             } finally {
//                 profileLoading.value = false;
//             }
//         };
//         
//         // Fetch user's followers
//         const fetchUserFollowers = async (userId) => {
//             console.log("fetchUserFollowers for userId:", userId);
//             if (!userId) {
//                 console.error("fetchUserFollowers called with invalid userId");
//                 profileFollowers.value = [];
//                 return [];
//             }
//             
//             profileLoading.value = true;
//             try {
//                 const response = await fetch(`/api/user/followers?id=${userId}`);
//                 if (!response.ok) {
//                     console.error("API error:", response.status, response.statusText);
//                     throw new Error('Failed to fetch followers');
//                 }
//                 
//                 const data = await response.json();
//                 console.log("User followers received:", data);
//                 
//                 // Ensure we always have an array
//                 profileFollowers.value = Array.isArray(data) ? data : [];
//                 
//                 return profileFollowers.value;
//             } catch (error) {
//                 console.error('Error fetching followers:', error);
//                 profileFollowers.value = [];
//                 return [];
//             } finally {
//                 profileLoading.value = false;
//             }
//         };
//         
//         // Fetch users the profile user is following
//         const fetchUserFollowing = async (userId) => {
//             console.log("fetchUserFollowing for userId:", userId);
//             if (!userId) {
//                 console.error("fetchUserFollowing called with invalid userId");
//                 profileFollowing.value = [];
//                 return [];
//             }
//             
//             profileLoading.value = true;
//             try {
//                 const response = await fetch(`/api/user/following?id=${userId}`);
//                 if (!response.ok) {
//                     console.error("API error:", response.status, response.statusText);
//                     throw new Error('Failed to fetch following');
//                 }
//                 
//                 const data = await response.json();
//                 console.log("User following received:", data);
//                 
//                 // Ensure we always have an array
//                 profileFollowing.value = Array.isArray(data) ? data : [];
//                 
//                 return profileFollowing.value;
//             } catch (error) {
//                 console.error('Error fetching following:', error);
//                 profileFollowing.value = [];
//                 return [];
//             } finally {
//                 profileLoading.value = false;
//             }
//         };
//         
//         // Follow a user
//         const followUser = async (userId) => {
//             if (!currentUser.isLoggedIn) {
//                 showAlert('Please log in to follow users');
//                 return false;
//             }
//             
//             try {
//                 profileLoading.value = true;
//                 const response = await fetch('/api/user/follow', {
//                     method: 'POST',
//                     headers: { 'Content-Type': 'application/json' },
//                     body: JSON.stringify({ user_id: userId }),
//                     credentials: 'include'
//                 });
//                 
//                 if (!response.ok) {
//                     const errorData = await response.json().catch(() => ({}));
//                     console.error('Follow API error:', response.status, errorData);
//                     throw new Error(errorData.message || 'Failed to follow user');
//                 }
//                 
//                 // Update profile data
//                 profileUser.is_following = true;
//                 profileUser.followers_count++;
//                 showAlert(`You are now following ${profileUser.username}`);
//                 
//                 // Refresh followers list if we're on that tab
//                 if (profileTab.value === 'followers') {
//                     await fetchUserFollowers(userId);
//                 }
//                 
//                 return true;
//             } catch (error) {
//                 console.error('Error following user:', error);
//                 showAlert(error.message || 'Error following user');
//                 return false;
//             } finally {
//                 profileLoading.value = false;
//             }
//         };
//
//         // Unfollow a user
//         const unfollowUser = async (userId) => {
//             if (!currentUser.isLoggedIn) {
//                 showAlert('Please log in to unfollow users');
//                 return false;
//             }
//             
//             try {
//                 profileLoading.value = true;
//                 const response = await fetch('/api/user/unfollow', {
//                     method: 'POST',
//                     headers: { 'Content-Type': 'application/json' },
//                     body: JSON.stringify({ user_id: userId }),
//                     credentials: 'include'
//                 });
//                 
//                 if (!response.ok) {
//                     const errorData = await response.json().catch(() => ({}));
//                     console.error('Unfollow API error:', response.status, errorData);
//                     throw new Error(errorData.message || 'Failed to unfollow user');
//                 }
//                 
//                 // Update profile data
//                 profileUser.is_following = false;
//                 profileUser.followers_count = Math.max(0, profileUser.followers_count - 1);
//                 showAlert(`You are no longer following ${profileUser.username}`);
//                 
//                 // Refresh followers list if we're on that tab
//                 if (profileTab.value === 'followers') {
//                     await fetchUserFollowers(userId);
//                 }
//                 
//                 return true;
//             } catch (error) {
//                 console.error('Error unfollowing user:', error);
//                 showAlert(error.message || 'Error unfollowing user');
//                 return false;
//             } finally {
//                 profileLoading.value = false;
//             }
//         };
//         
//         // Change profile tab
//         const changeProfileTab = async (tab) => {
//             console.log(`Changing profile tab to: ${tab}`);
//             profileTab.value = tab;
//             
//             try {
//                 profileLoading.value = true;
//                 if (tab === 'followers') {
//                     await fetchUserFollowers(profileUser.id);
//                 } else if (tab === 'following') {
//                     await fetchUserFollowing(profileUser.id);
//                 } else if (tab === 'posts' && (!profilePosts.value || profilePosts.value.length === 0)) {
//                     await fetchUserPosts(profileUser.id);
//                 }
//             } catch (error) {
//                 console.error(`Error loading ${tab} tab:`, error);
//                 showAlert(`Could not load ${tab}: ${error.message}`);
//             } finally {
//                 profileLoading.value = false;
//             }
//         };
//         
//         // Go back to main feed
//         const returnToFeed = () => {
//             console.log("Returning to feed view");
//             currentView.value = 'posts';
//         };
//
//         // View posts by user (shortcut from the main feed)
//         const viewPostsByUser = (userId, username) => {
//             viewUserProfile(userId);
//         };
//
//         // Update privacy setting
//         const updatePrivacySetting = (event) => {
//             if (!currentUser.isLoggedIn || currentUser.id !== profileUser.id) {
//                 return;
//             }
//             
//             const privacyValue = event.target.value;
//             const isPrivate = privacyValue === 'private';
//             
//             // Store previous state in case we need to revert
//             const previousState = profileUser.is_private;
//             
//             // Update UI immediately for better UX
//             profileUser.is_private = isPrivate;
//             
//             fetch('/api/user/privacy', {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                 },
//                 body: JSON.stringify({
//                     is_private: isPrivate
//                 })
//             })
//             .then(response => {
//                 if (!response.ok) {
//                     throw new Error('Failed to update privacy settings');
//                 }
//                 return response.json();
//             })
//             .then(data => {
//                 console.log('Privacy settings updated:', data);
//                 // Show success message
//                 showAlert(isPrivate ? 
//                     'Your profile is now private. Only followers can see your posts.' : 
//                     'Your profile is now public. Everyone can see your posts.');
//             })
//             .catch(error => {
//                 console.error('Error updating privacy settings:', error);
//                 // Revert UI change on error
//                 profileUser.is_private = previousState;
//                 showAlert('Failed to update privacy settings. Please try again.');
//             });
//         };
//
//         // User search method
//         const searchUsers = async () => {
//             if (userSearchQuery.value.length < 2) {
//                 userSearchResults.value = [];
//                 return;
//             }
//             try {
//                 const response = await fetch(`/api/search/users?q=${encodeURIComponent(userSearchQuery.value)}`);
//                 if (response.ok) {
//                     userSearchResults.value = await response.json();
//                 } else {
//                     userSearchResults.value = [];
//                 }
//             } catch (err) {
//                 userSearchResults.value = [];
//             }
//         };
//
//         // Show simple alert message
//         const showAlert = (message) => {
//             const alertDiv = document.createElement('div');
//             alertDiv.className = 'custom-alert';
//             alertDiv.textContent = message;
//             document.body.appendChild(alertDiv);
//             
//             // Auto-remove after 3 seconds
//             setTimeout(() => {
//                 alertDiv.classList.add('fade-out');
//                 setTimeout(() => {
//                     document.body.removeChild(alertDiv);
//                 }, 500);
//             }, 3000);
//         };
//
//         // Fetch groups from backend
//         const fetchGroups = async () => {
//             try {
//                 const response = await fetch('/api/groups');
//                 if (!response.ok) throw new Error('Failed to fetch groups');
//                 const data = await response.json();
//                 groups.value = data || [];
//             } catch (error) {
//                 console.error('Error fetching groups:', error);
//                 groups.value = [];
//             }
//         };
//
//         // Select group by ID
//         const selectGroupById = async (groupId) => {
//             selectedGroupId.value = groupId;
//             const group = groups.value.find(g => g.ID === groupId);
//             if (group) {
//                 selectedGroup.value = {
//                     name: group.Name,
//                     creatorUsername: group.Creator?.Username || 'unknown',
//                     createdAt: group.CreatedAt,
//                     description: group.Description || 'No description available.'
//                 };
//                 // Initialize groupPosts as an empty array before fetching
//                 groupPosts.value = [];
//                 // Fetch group posts
//                 await fetchGroupPosts(groupId);
//             }
//         };
//
//         // Fetch group posts
//         const fetchGroupPosts = async (groupId) => {
//             try {
//                 const response = await fetch(`/api/groups/posts?group_id=${groupId}`);
//                 if (!response.ok) throw new Error('Failed to fetch group posts');
//                 const data = await response.json();
//                 groupPosts.value = Array.isArray(data) ? data : [];
//             } catch (error) {
//                 console.error('Error fetching group posts:', error);
//                 groupPosts.value = [];
//             }
//         };
//
//         // Format date helper
//         const formatDate = (dateString) => {
//             if (!dateString) return 'N/A';
//             const date = new Date(dateString);
//             if (isNaN(date)) return 'N/A';
//             return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
//         };
//
//         // Create group post
//         const createGroupPost = async () => {
//             if (!selectedGroupId.value) {
//                 showAlert('Please select a group first');
//                 return;
//             }
//
//             try {
//                 const response = await fetch('/api/groups/posts/create', {
//                     method: 'POST',
//                     headers: {
//                         'Content-Type': 'application/json'
//                     },
//                     credentials: 'include',
//                     body: JSON.stringify({
//                         ...newGroupPost,
//                         group_id: selectedGroupId.value
//                     })
//                 });
//
//                 if (!response.ok) {
//                     throw new Error('Failed to create group post');
//                 }
//
//                 const result = await response.json();
//                 showAlert('Group post created successfully!');
//                 showCreateGroupPostForm.value = false;
//                 
//                 // Reset form
//                 newGroupPost.title = '';
//                 newGroupPost.content = '';
//                 newGroupPost.privacy_setting = 'public';
//                 newGroupPost.category_id = null;
//                 newGroupPost.file_path = '';
//
//                 // Refresh group posts
//                 await fetchGroupPosts(selectedGroupId.value);
//             } catch (error) {
//                 console.error('Error creating group post:', error);
//                 showAlert('Failed to create group post');
//             }
//         };
//
//         // Handle file upload
//         const handleFileUpload = (event) => {
//             const file = event.target.files[0];
//             if (file) {
//                 // Here you would typically upload the file to your server
//                 // and get back a file path. For now, we'll just store the file name
//                 newGroupPost.file_path = file.name;
//             }
//         };
//
//         // Called when component is mounted
//         onMounted(async () => {
//             activeModal.value = '';
//             const status = await fetchUserStatus();
//             if (status && status.loggedIn) {
//                 await fetchOnlineUsers();
//                 currentView.value = 'posts';
//             } else {
//                 currentView.value = 'login';
//             }
//
//             if (currentUser.isLoggedIn) {
//                 await fetchCategories();
//                 await fetchPosts();
//                 await fetchGroups();
//                 setTimeout(() => {
//                     initializeWebSocket();
//                 }, 1000);
//             }
//          
//             // Set up periodic refresh of online users
//             setInterval(fetchOnlineUsers, 30000);
//             
//             // Listen for profile navigation events from nav.js
//             document.addEventListener('showUserProfile', (event) => {
//                 console.log("Received showUserProfile event:", event.detail);
//                 if (event.detail && event.detail.userId) {
//                     viewUserProfile(event.detail.userId);
//                 }
//             });
//             
//             // Example usage: add a button to view a user's profile from a user list or post
//             // This can be placed in your template or component where user info is shown
//             // <button @click="viewUserProfile(user.id)">View Profile</button>
//
//             // If using plain HTML (not Vue template), you can add an event listener dynamically:
//             document.addEventListener('DOMContentLoaded', () => {
//                 document.querySelectorAll('.user-profile-link').forEach(el => {
//                     el.addEventListener('click', (e) => {
//                         const userId = el.getAttribute('data-user-id');
//                         if (userId) viewUserProfile(parseInt(userId));
//                     });
//                 });
//             });
//         });
//
//         // Watch for showSidebar changes and trigger sidebar logic
//         watch(showSidebar, () => {
//             if (window.handleScreenChange) {
//                 window.handleScreenChange(window.matchMedia('(max-width: 1300px)'));
//             }
//         });
//
//         // Fetch group events
//         const fetchGroupEvents = async (groupId) => {
//             try {
//                 const response = await fetch(`/api/groups/events?group_id=${groupId}`);
//                 if (!response.ok) throw new Error('Failed to fetch group events');
//                 const data = await response.json();
//                 groupEvents.upcoming = data.upcoming || [];
//                 groupEvents.past = data.past || [];
//             } catch (error) {
//                 groupEvents.upcoming = [];
//                 groupEvents.past = [];
//             }
//         };
//
//         // Format event date
//         const formatEventDate = (dateString) => {
//             if (!dateString) return '';
//             const date = new Date(dateString);
//             if (isNaN(date)) return dateString;
//             return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
//         };
//
//         // Watch for modal open to fetch events
//         watch(showGroupEventsModal, (val) => {
//             if (val && selectedGroupId.value) {
//                 fetchGroupEvents(selectedGroupId.value);
//             }
//         });
//
//         // Add watcher for create group post form
//         watch(showCreateGroupPostForm, async (newVal) => {
//             if (newVal && (!categories.value || categories.value.length === 0)) {
//                 await fetchCategories();
//             }
//         });
//
//         // Add this method to open chat window from Vue
//         const openUserChat = (userId) => {
//             if (typeof openChatWindow === 'function') {
//                 openChatWindow(userId);
//             } else {
//                 showAlert('Chat functionality is not available.');
//             }
//         };
//
//         // Login method
//         const handleLogin = async () => {
//             loginForm.error = '';
//             loginForm.loading = true;
//             try {
//                 const response = await fetch('/api/login', {
//                     method: 'POST',
//                     headers: { 'Content-Type': 'application/json' },
//                     body: JSON.stringify({
//                         identifier: loginForm.user_identifier,
//                         password: loginForm.password
//                     })
//                 });
//                 const data = await response.json();
//                 if (!response.ok || data.message === 'Invalid credentials.') {
//                     loginForm.error = data.message || 'Login failed. Please try again.';
//                     loginForm.loading = false;
//                     return;
//                 }
//                 // On success, update user state and switch view
//                 await fetchUserStatus();
//                 await fetchOnlineUsers();
//                 currentView.value = 'posts';
//             } catch (error) {
//                 loginForm.error = error.message || 'Login failed. Please try again.';
//             } finally {
//                 loginForm.loading = false;
//             }
//         };
//
//         // Register method (placeholder, to be expanded)
//         const handleRegister = async () => {
//             registerForm.error = '';
//             registerForm.loading = true;
//             if (registerForm.password !== registerForm.confirmPassword) {
//                 registerForm.error = 'Passwords do not match.';
//                 registerForm.loading = false;
//                 return;
//             }
//             try {
//                 const response = await fetch('/api/register', {
//                     method: 'POST',
//                     headers: { 'Content-Type': 'application/json' },
//                     body: JSON.stringify({
//                         username: registerForm.username,
//                         email: registerForm.email,
//                         password: registerForm.password
//                     })
//                 });
//                 const data = await response.json();
//                 if (!response.ok) {
//                     registerForm.error = data.message || 'Registration failed. Please try again.';
//                     registerForm.loading = false;
//                     return;
//                 }
//                 // On success, switch to login view
//                 currentView.value = 'login';
//             } catch (error) {
//                 registerForm.error = error.message || 'Registration failed. Please try again.';
//             } finally {
//                 registerForm.loading = false;
//             }
//         };
//
//         // Navigation methods
//         const goToLogin = () => {
//             currentView.value = 'login';
//             loginForm.error = '';
//         };
//         const goToRegister = () => {
//             currentView.value = 'register';
//             registerForm.error = '';
//         };
//
//         // Navbar navigation methods
//         const goToCreatePost = openCreatePost;
//         const goToCreateGroup = openCreateGroup;
//         const goToProfile = () => {
//             currentView.value = 'profile';
//         };
//         const handleLogout = async () => {
//             try {
//                 await fetch('/api/logout', { method: 'POST', credentials: 'include' });
//             } catch (e) {
//                 // Optionally show an error, but still clear state
//             }
//             // Clear user state and return to login view
//             currentUser.id = null;
//             currentUser.username = null;
//             currentUser.isLoggedIn = false;
//             currentView.value = 'login';
//             // Optionally clear other state as needed
//         };
//         const goToHome = () => {
//             currentView.value = 'posts';
//         };
//
//         // Create post method
//         const createPost = async () => {
//             if (!currentUser.isLoggedIn) {
//                 showAlert('Please log in to create a post');
//                 return;
//             }
//
//             try {
//                 const formData = new FormData();
//                 formData.append('Title', newPost.title);
//                 formData.append('Text', newPost.content);
//                 formData.append('CategoryID', newPost.category_id);
//                 formData.append('Privacy', newPost.privacy);
//                 if (newPost.image) {
//                     formData.append('Image', newPost.image);
//                 }
//
//                 const response = await fetch('/post/create', {
//                     method: 'POST',
//                     credentials: 'include',
//                     body: formData
//                 });
//
//                 if (!response.ok) {
//                     const error = await response.text();
//                     throw new Error(error || 'Failed to create post');
//                 }
//
//                 showAlert('Post created successfully!');
//                 activeModal.value = '';
//                 
//                 // Reset form
//                 newPost.title = '';
//                 newPost.content = '';
//                 newPost.category_id = null;
//                 newPost.privacy = 'public';
//                 newPost.image = null;
//
//                 // Refresh posts
//                 await fetchPosts(currentPage.value);
//             } catch (error) {
//                 console.error('Error creating post:', error);
//                 showAlert(error.message || 'Failed to create post');
//             }
//         };
//
//         // Create group method
//         const createGroup = async () => {
//             if (!currentUser.isLoggedIn) {
//                 showAlert('Please log in to create a group');
//                 return;
//             }
//
//             try {
//                 const response = await fetch('/api/groups/create', {
//                     method: 'POST',
//                     headers: {
//                         'Content-Type': 'application/json'
//                     },
//                     credentials: 'include',
//                     body: JSON.stringify(newGroup)
//                 });
//
//                 if (!response.ok) {
//                     const error = await response.text();
//                     throw new Error(error || 'Failed to create group');
//                 }
//
//                 showAlert('Group created successfully!');
//                 activeModal.value = '';
//                 
//                 // Reset form
//                 newGroup.name = '';
//                 newGroup.description = '';
//                 newGroup.privacy = 'public';
//
//                 // Refresh groups
//                 await fetchGroups();
//             } catch (error) {
//                 console.error('Error creating group:', error);
//                 showAlert(error.message || 'Failed to create group');
//             }
//         };
//
//         // Handle post image upload
//         const handlePostImageUpload = (event) => {
//             const file = event.target.files[0];
//             if (file) {
//                 // Validate file size (2MB limit)
//                 if (file.size > 2 * 1024 * 1024) {
//                     showAlert('File size must not exceed 2MB');
//                     event.target.value = '';
//                     return;
//                 }
//
//                 // Validate image dimensions
//                 const img = new Image();
//                 img.onload = function() {
//                     if (img.width > 2000 || img.height > 2000) {
//                         showAlert('Image dimensions must not exceed 2000x2000 pixels');
//                         event.target.value = '';
//                         return;
//                     }
//                     newPost.image = file;
//                 };
//                 img.src = URL.createObjectURL(file);
//             }
//         };
//
//         // Return reactive state and methods for template use
//         return {
//             // Main feed state
//             posts,
//             loading,
//             currentPage,
//             totalPages,
//             currentUser,
//             onlineUsers,
//             categories,
//             filters,
//             filteredPosts,
//             
//             // Profile state
//             currentView,
//             profileUser,
//             profilePosts,
//             profileLoading,
//             profileFollowers,
//             profileFollowing,
//             profileTab,
//             
//             // User search state
//             userSearchQuery,
//             userSearchResults,
//             
//             // Groups state
//             groups,
//             selectedGroupId,
//             groupSearchQuery,
//             filteredGroups,
//             groupPosts,
//             showCreateGroupPostForm,
//             newGroupPost,
//             
//             // UI state
//             showSidebar,
//             
//             // Modal state and methods
//             activeModal,
//             openCreatePost,
//             openCreateGroup,
//             closeModal,
//             goToCreatePost,
//             goToCreateGroup,
//             createPost,
//             createGroup,
//             newPost,
//             newGroup,
//             handlePostImageUpload,
//             
//             // Methods
//             fetchPosts,
//             fetchCategories,
//             likePost,
//             dislikePost,
//             getCategoryName,
//             openChat,
//             
//             // Profile methods
//             viewUserProfile,
//             fetchUserPosts,
//             fetchUserFollowers,
//             fetchUserFollowing,
//             followUser,
//             unfollowUser,
//             changeProfileTab,
//             returnToFeed,
//             viewPostsByUser,
//             updatePrivacySetting,
//             selectedGroup,
//             selectGroup,
//             formatDate,
//             searchUsers,
//             goToGroups,
//             showAlert,
//             fetchGroups,
//             selectGroupById,
//             fetchGroupPosts,
//             createGroupPost,
//             handleFileUpload,
//             
//             // Group Events state
//             showGroupEventsModal,
//             groupEvents,
//             todayDate,
//             formatEventDate,
//             openUserChat,
//             
//             // Login/Register form state
//             loginForm,
//             registerForm,
//             handleLogin,
//             handleRegister,
//             goToLogin,
//             goToRegister,
//             goToProfile,
//             handleLogout,
//             goToHome,
//         };
//     }
// });
//
// // Register and mount the app when document is ready
// document.addEventListener('DOMContentLoaded', () => {
//     // setTimeout(() => {
//         app.mount('#app');
//     // }, 1000); // Delay to ensure DOM is ready
//     window.__VUE_APP__ = app._instance.proxy;
// });