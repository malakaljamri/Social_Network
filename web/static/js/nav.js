document.addEventListener('DOMContentLoaded', function() {
    const app = createNavbar();
    app.mount('#navbar');
});

function createNavbar() {
    const nav = document.createElement('nav'); nav.id = 'navbar';
    document.body.prepend(nav);
    return Vue.createApp({
        components: {
            Navbar: {
                template: `
                    <a href="/" class="logo">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 100 100">
                            <rect width="100" height="100" rx="20" fill="#7d6ee7"></rect>
                            <path fill="#fff" d="M36.63 22.42L66.52 22.42Q66.78 22.87 67.06 23.63Q67.32 24.40 67.32 25.30L67.32 25.30Q67.32 26.83 66.60 27.73Q65.88 28.63 64.53 28.63L64.53 28.63L40.05 28.63L40.05 47.35L63.36 47.35Q63.63 47.80 63.91 48.56Q64.17 49.33 64.17 50.23L64.17 50.23Q64.17 51.76 63.45 52.66Q62.73 53.56 61.38 53.56L61.38 53.56L40.05 53.56L40.05 77.05Q39.60 77.23 38.66 77.41Q37.71 77.59 36.72 77.59L36.72 77.59Q32.67 77.59 32.67 74.34L32.67 74.34L32.67 26.38Q32.67 24.58 33.75 23.50Q34.84 22.42 36.63 22.42L36.63 22.42Z"></path>
                        </svg>
                    </a>
                    <div class="nav-links">
                        <span id="userStatus"></span>
                    </div>
                `,
                mounted() {
                    console.log('Navbar component mounted');
                },
            },
        },
        template: `
            <Navbar />
        `,
    });
}

function updateUserStatusUI(data) {
    const userStatusElement = document.getElementById('userStatus');
    let chatSection = document.querySelector("#chat-section")
    if (data.loggedIn) {
        userStatusElement.innerHTML = `
            <a title="Create New Post" href="/create-post" class="create-post-btn">
                <i class="fas fa-plus-circle"></i> ✍️ Create Post
            </a>
            <a title="Groups Page" href="/groups" class="groups-page-btn">
                <i class="fas fa-users"></i> 👥 Groups
            </a>
            <a title="Create Group" href="#" class="create-group-btn">
                <i class="fas fa-plus-square"></i> ➕ Create Group
            </a>
            <span class="username">
                <i class="fas fa-user"></i> ${data.username} 👋
            </span>
            <button id="profile-link" class="profile-btn" title="View Profile" data-user-id="${data.userID}">
                <i class="fas fa-user-circle"></i> 👤 My Profile
            </button>
            <button onclick="logout()" class="logout-btn">
                <i class="fas fa-sign-out-alt"></i> 🚪 Logout
            </button>
        `;
        
        document.querySelector('a[href="/groups"]')?.addEventListener('click', async function (e) {
            e.preventDefault();
        
            const vueApp = window.__VUE_APP__;
            if (vueApp) {
                vueApp.goToGroups();
                // Fetch groups when navigating to groups page
                await vueApp.fetchGroups();
            }
        });
        
        // Create Group Listener
        document.querySelector('.create-group-btn').addEventListener('click', function(e) {
            e.preventDefault();
        
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:1000;';
        
            overlay.innerHTML = `
                <div class="card">
                    <h2>Create a New Group</h2>
                    <form id="create-group-form">
                        <label for="group-name">Enter Group Name:</label>
                        <input type="text" id="group-name" placeholder="Group Name" required minlength="3" maxlength="100" />
        
                        <label for="group-description">Enter Group Description:</label>
                        <input type="text" id="group-description" placeholder="Group Description" required minlength="10" maxlength="1000" />
        
                        <button type="submit" id="submit-group-btn">Create Group</button>
                    </form>
                </div>
            `;
        
            document.body.appendChild(overlay);
        
            // Close on outside click
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) overlay.remove();
            });
        
            // Submit handler
            document.getElementById('create-group-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('group-name').value.trim();
                const description = document.getElementById('group-description').value.trim();
        
                const response = await fetch('/api/groups/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ name, description })
                });
        
                if (response.ok) {
                    const card = overlay.querySelector('.card');
                    card.innerHTML = `<h2 style="text-align: center;">Group Created!</h2>`;
                
                    setTimeout(() => {
                        overlay.remove();
                    }, 1000);
                }                
            });
        });
        
        // Create Group Form
        document.getElementById('create-group-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('group-name').value.trim();
            const description = document.getElementById('group-description').value.trim();
        
            const response = await fetch('/api/groups/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, description })
            });
        
            if (response.ok) {
                alert('✅ Group created successfully!');
                overlay.remove();
            } else {
                const err = await response.text();
                alert(`❌ Failed: ${err}`);
            }
        });
        
        if (chatSection) {
            chatSection.style.display = "block";
        }
    } else {
        document.getElementById('pagination-container').innerHTML = "";
        if (chatSection) {
            chatSection.style.display = "none";
        }
        userStatusElement.innerHTML = `<i class="fas fa-info-circle"></i> Please login to continue 🔑`;
        document.querySelector("#posts-container").innerHTML = `<div class="container" style="position: absolute;left: 50%;transform: translateX(-50%);">
                <div class="card">
                    <h2>Login</h2>
                    <form id="login-form">
                        <input type="text" name="user_identifier" placeholder="Email or User name" value="example1@gmail.com">
                        <input type="password" name="password" placeholder="Password" value="12">
                        <button type="submit" id="submit-login-btn" class="button">Login</button>
                        <div id="login-response" style="color: red;"></div>
                    </form>
                </div>
                <div class="card">
                    <p>Don't have an account? <a href="/register">Sign Up</a></p>
                </div>
            </div>`;
    }
}

function logout() {
    cleanupWebSocket(); // Call this first to ensure proper WebSocket cleanup
    fetch('/api/logout', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentUserID = null;
                currentUserName = null;
                onlineUsers.clear();
                updateUserStatusUI({ loggedIn: false });
                updateOnlineUsersList();
            } else {
                console.error('Logout failed:', data.message);
            }
        })
        .catch(error => console.error('Error during logout:', error));
}

const mediaQuery = window.matchMedia('(max-width: 1300px)');
const toggleButton = document.createElement('button');
toggleButton.innerHTML = '☰';
toggleButton.className = 'sidebar-toggle';
const sidebarContent = document.getElementById('sidebarContent');
sidebarContent.parentNode.insertBefore(toggleButton, sidebarContent);

function handleScreenChange(e) {
    // Get Vue's showSidebar state
    const vueApp = window.__VUE_APP__;
    const shouldShowSidebar = vueApp ? vueApp.showSidebar.value : true;

    if (!shouldShowSidebar) {
        sidebarContent.style.display = 'none';
        toggleButton.style.display = 'none';
        return;
    }

    if (e.matches) {
        sidebarContent.style.display = 'none';
        toggleButton.style.display = 'block';
        toggleButton.onclick = () => {
            sidebarContent.style.display = sidebarContent.style.display === 'none' ? 'block' : 'none';
        };
    } else {
        toggleButton.style.display = 'none';
        sidebarContent.style.display = 'block';
    }
}

window.handleScreenChange = handleScreenChange;

mediaQuery.addEventListener('change', handleScreenChange);
handleScreenChange(mediaQuery);

// Also watch for showSidebar changes from Vue
if (window.__VUE_APP__) {
    window.__VUE_APP__.showSidebar.effect.run = () => handleScreenChange(mediaQuery);
}

// Remove previous attachCreatePostListener and related code
// Add event delegation for Create Post button

document.addEventListener('click', function(e) {
    const target = e.target.closest('.create-post-btn');
    if (target) {
        e.preventDefault();
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:1000;';
        overlay.innerHTML = `
            <div class="card">
                <div id="create-post-response"></div>
                <form id="create-post-form">
                    <input type="text" id="post-title" placeholder="Post Title" required
                        minlength="3" 
                        maxlength="100"
                        title="Title must be between 3 and 100 characters and contain only letters, numbers, spaces, and basic punctuation."
                        oninvalid="this.setCustomValidity('Please enter a valid title.')"
                        oninput="this.setCustomValidity('')"
                    >
                    <textarea id="post-content" placeholder="Write your post content here..." required
                        minlength="10" 
                        maxlength="5000" 
                        title="Content must be between 10 and 5000 characters."
                        oninvalid="this.setCustomValidity('Please enter valid content.')"
                        oninput="this.setCustomValidity('')"
                    ></textarea>
                    <select id="post-category" required>
                        <option value="6" selected>Other categories</option>
                    </select>
                    <select id="post-privacy" required>
                        <option value="public" selected>Public</option>
                        <option value="almost_private">Followers</option>
                        <option value="private">Chosen followers</option>
                    </select>
                    <input type="file" id="post-image" accept="image/jpeg, image/png, image/gif" />
                    <button type="submit" id="submit-post-btn">Create Post</button>
                </form>
            </div>`;
        document.body.appendChild(overlay);

        // Add file validation for size and dimensions
        document.getElementById('post-image').addEventListener('change', function () {
            const file = this.files[0];
            const maxSize = 2 * 1024 * 1024; // 2MB
            const maxWidth = 2000;
            const maxHeight = 2000;

            if (file) {
                if (file.size > maxSize) {
                    alert('File size must not exceed 2MB.');
                    this.value = ''; // Clear the input
                    return;
                }

                const img = new Image();
                img.onload = function () {
                    if (img.width > maxWidth || img.height > maxHeight) {
                        alert(`Image dimensions must not exceed ${maxWidth}x${maxHeight}px.`);
                        document.getElementById('post-image').value = ''; // Clear the input
                    }
                };
                img.src = URL.createObjectURL(file);
            }
        });
    
        // Fetch categories dynamically
        fetch('/categories')
            .then(response => response.json())
            .then(categories => {
                const categorySelect = document.getElementById('post-category');
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.ID;
                    option.textContent = category.Name;
                    categorySelect.appendChild(option);
                });
            });
    
        document.getElementById('create-post-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const responseElement = document.getElementById('create-post-response');
            responseElement.textContent = 'Creating post...';
            
            const title = document.getElementById('post-title').value;
            const content = document.getElementById('post-content').value;
            const category = document.getElementById('post-category').value;
            const privacy = document.getElementById('post-privacy').value;
            const formData = new FormData();
                formData.append('Title', title);
                formData.append('Text', content);
                formData.append('CategoryID', parseInt(category));
                formData.append('UserID', parseInt(currentUserID));
                formData.append('Privacy', privacy);
                const imageFile = document.getElementById('post-image').files[0];
                    if (imageFile)  formData.append('Image', imageFile);
    
            try {
                const response = await fetch('/post/create', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData,
                });
                
                try {
                    const data = await response.json();
                    if (response.ok) {
                        overlay.remove();
                        window.scrollTo(0, 0);
                        document.querySelector("#categories-list input").dispatchEvent(new Event('change'));
                    } else {
                        throw new Error(data.error || 'Failed to create post');
                    }
                } catch (error) {
                    if (response.status === 400) {
                        responseElement.textContent = await response.text();
                    } else {
                        responseElement.textContent = error.message;
                    }
                    responseElement.style.color = 'red';
                }
            } catch (error) {
                responseElement.textContent = 'An error occurred while creating the post.';
                responseElement.style.color = 'red';
            }
        });
    
        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.remove();
        });
    }
});

// Also call after updateUserStatusUI, since it rewrites the navbar
const originalUpdateUserStatusUI = updateUserStatusUI;
updateUserStatusUI = function(data) {
    originalUpdateUserStatusUI(data);
}