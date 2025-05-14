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
    let chatSection = document.querySelector("#chat-section");

    //Update Vue's reactive currentUser object
    if (window.__VUE_APP__) {
        const vueApp = window.__VUE_APP__;
        vueApp.currentUser.isLoggedIn = data.loggedIn;
        vueApp.currentUser.username = data.username || null;
        vueApp.currentUser.userID = data.userID || null;
    }

    if (data.loggedIn) {
        userStatusElement.innerHTML = `
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
        const createGroupForm = document.getElementById('create-group-form');
        if (!createGroupForm) {
            console.warn('Create Group Form not found!');
        } else {
            createGroupForm.addEventListener('submit', async (e) => {
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
        }
        
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

        document.getElementById('login-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            const userIdentifier = document.querySelector('#login-form [name="user_identifier"]').value.trim();
            const password = document.querySelector('#login-form [type="password"]').value.trim();
            const loginResponse = document.getElementById('login-response');
            
            if (!userIdentifier || !password) {
                loginResponse.innerText = 'Email and password are required fields.';
                return;
            }
        
            loginResponse.style.color = 'Green';
            loginResponse.innerText = 'Logging in...';
            
        
            try {
                // First do the login
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        identifier: userIdentifier,
                        password: password
                    })
                });
        
                const data = await response.json();
                if (!response.ok) {
                    loginResponse.textContent = data.message || 'Login failed. Please try again.';
                    loginResponse.style.color = 'red';
                    throw new Error(data.message || 'Login failed');
                } else if (data.message === "Invalid credentials.") {
                    loginResponse.textContent = data.message || 'Login failed. Please try again.';
                    loginResponse.style.color = 'red';
                }
        
                handleLogin(data)
            } catch (error) {
                console.error('Login error:', error);
                loginResponse.textContent = error.message || 'Login failed. Please try again.';
                loginResponse.style.color = 'red';
            }
        });
    }
}

async function handleLogin(data) {
    if (data.message === "Logged in successfully") {
        currentUserID = data.user_id;
        currentUserName = data.username;
        
        try {
            // Initialize WebSocket first
            await initializeWebSocket();
            
            // Then update UI and fetch posts
            console.log("CALLING UPDATE USER STATUS UI")
            updateUserStatusUI({ loggedIn: true, username: data.username });
            console.log("FINISHED CALLING UPDATE USER STATUS UI")
            console.log("CALLING fetchPosts")
            fetchPosts();
            console.log("FINISHED CALLING fetchPosts")

            console.log(document.getElementById('loggedInUserFilter').disabled);

            document.getElementById('loggedInUserFilter').disabled = false;
            
            // Broadcast user status to all clients
            if (socket?.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'user_status',
                    content: {
                        user_id: data.user_id,
                        status: 'online',
                        username: data.username
                    }
                }));
            }
        } catch (error) {
            console.error('Error during login:', error);
            // fetchPosts(); // Still fetch posts even if WebSocket fails
        }
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
