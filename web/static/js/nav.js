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
    let sideDivs = document.querySelectorAll("#sidebar, #chat-section")
    if (data.loggedIn) {
        userStatusElement.innerHTML = `
            <a title="Create New Post" href="/create-post" class="create-post-btn">
                <i class="fas fa-plus-circle"></i> ✍️ Create Post
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
        
        // Add event listener for the profile link
        document.getElementById('profile-link').addEventListener('click', function() {
            const userId = this.getAttribute('data-user-id');
            console.log("Clicking profile button for user ID:", userId);
            
            if (userId) {
                // Create a custom event that Vue app can listen for
                const event = new CustomEvent('showUserProfile', { 
                    detail: { userId: parseInt(userId) } 
                });
                console.log("Dispatching showUserProfile event with ID:", userId);
                document.dispatchEvent(event);
                
                // Try direct DOM manipulation as a fallback
                const forumContainer = document.getElementById('forum-container');
                const postsView = document.getElementById('posts-feed');
                const profileView = document.getElementById('profile-view');
                
                if (forumContainer && postsView && profileView) {
                    // Try to show profile view via DOM manipulation
                    postsView.style.display = 'none';
                    profileView.style.display = 'block';
                    console.log("Profile view displayed via DOM manipulation");
                }
            }
        });
        
        document.querySelector('a[href="/create-post"]').addEventListener('click', function(e) {
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
                            pattern="^[a-zA-Z0-9\\s!?.,'-]+$" 
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
                            <option value="private">Choosen followers</option>
                        </select>
                        <button type="submit" id="submit-post-btn">Create Post</button>
                    </form>
                </div>`;
            
            document.body.appendChild(overlay);
        
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
        
                try {
                    const response = await fetch('/post/create', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            Title: title,
                            Text: content,
                            CategoryID: parseInt(category),
                            UserID: parseInt(currentUserID),
                            Privacy: privacy,
                        })
                    });
                    
                    try {
                        const data = await response.json();
                        if (response.ok) {
                            overlay.remove();
                            // fetchPosts();
                            window.scrollTo(0, 0);
                            fetchCategories();
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
        });        
        
        sideDivs.forEach(function(element) {
            element.style.display = "block";
        });
    } else {
        document.getElementById('pagination-container').innerHTML = "";
        sideDivs.forEach(function(element) {
            element.style.display = "none";
        });
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
            document.querySelector('a[href="/register"]').addEventListener('click', function(e) {
                e.preventDefault();
                const overlay = document.createElement('div');
                overlay.style.cssText = `
                    position: fixed;top: 0;left: 0;
                    width: 100%;height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;justify-content: center;
                    align-items: center;z-index: 1000;
                `;
                overlay.innerHTML = `<div class="container">
                        <div class="card">
                            <h2>Register</h2>
                            <form id="register-form" method="POST" style="display: table-caption;">
                                <input type="text" name="username" placeholder="Nickname" required>
                                <input type="email" name="email" placeholder="Email" required>
                                <input type="password" name="password" placeholder="Password" required>
                                <!-- <input type="date" name="birthDate" placeholder="yyyy-mm-dd" required> -->
                                <input type="number" name="Age" min="4" max="99" required oninvalid="this.setCustomValidity('Please enter a valid age between 4 and 99')" oninput="this.setCustomValidity('')" placeholder="Age">
                                <select name="Gender" required>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Prefer not to say">Prefer not to say</option>
                                </select>
                                <input type="text" name="First_Name" placeholder="First Name" required>
                                <input type="text" name="Last_Name" placeholder="Last Name" required>
                                <button type="submit" class="button">Register</button>
                                <span id="register-response"></span>
                            </form>
                        </div>
                    </div>`
                    document.body.appendChild(overlay);
                    document.getElementById('register-form').addEventListener('submit', function(e) {
                    e.preventDefault();
                    const username = this.username.value;const email = this.email.value;
                    const password = this.password.value;const age = this.Age.value;
                    const gender = this.Gender.value;const firstName = this.First_Name.value;
                    const lastName = this.Last_Name.value;
                    register();
                    function register() {
                        const responseElement = document.getElementById('register-response');
                        const birthDate = convertAgeToBirthDate(age);
                        // console.log("🎂📅 birthDate: ", age, birthDate);
                        fetch('/api/register', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', },
                            body: JSON.stringify({ username, email, password, birthDate, gender, firstName, lastName }),
                        })
                        .then(response => response.json())
                        .then(data => {
                            responseElement.textContent = "Registring...";
                            if (data.message === "User registered and logged in successfully") {
                                window.location.reload();  // Redirect to home page
                                // updateUserStatusUI({ loggedIn: true, username: data.username });
                                // fetchPosts();
                                // updateUserStatus({user_id: data.user_id, status: "online"});
                                // overlay.remove();
                                // responseElement.textContent = "Registration successful. Welcome to the forum!";
                                // alert('Registration successful. Welcome to the forum!');
                                // fetchOnlineUsers();
                            } else {
                                responseElement.textContent = data.error;
                                if (data.error == "failed to execute query: UNIQUE constraint failed: users.email") {
                                    responseElement.textContent = "Email already exists. Please use a different email.";
                                } else if (data.error == "failed to execute query: UNIQUE constraint failed: users.username") {
                                    responseElement.textContent = "Username already exists. Please use a different username.";
                                }
                            }
                        })
                        .catch(error => {
                            console.error('Error: ', error);
                            responseElement.textContent = 'Error: ', error
                        });
                        function convertAgeToBirthDate(age) {
                            const currentDate = new Date(); const currentYear = currentDate.getFullYear(); const birthYear = currentYear - age; const birthDate = new Date(birthYear, 0, 1);
                            const formattedBirthDate = birthDate.toISOString().split('T')[0];
                            return formattedBirthDate+"T00:00:00.000Z";
                        }
                    }
                });
                overlay.addEventListener('click', function(e) {
                    if (e.target === overlay) {
                        overlay.remove();
                    }
                });
            });

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
  updateOnlineUsersList();
}
async function handleLogin(data) {
    if (data.message === "Logged in successfully") {
        currentUserID = data.user_id;
        currentUserName = data.username;
        
        try {
            // Initialize WebSocket first
            await initializeWebSocket();
            
            // Then update UI and fetch posts
            updateUserStatusUI({ loggedIn: true, username: data.username });
            fetchPosts();

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

const mediaQuery = window.matchMedia('(max-width: 1300px)');
const toggleButton = document.createElement('button');
toggleButton.innerHTML = '☰';
toggleButton.className = 'sidebar-toggle';
const sidebarContent = document.getElementById('sidebarContent');
sidebarContent.parentNode.insertBefore(toggleButton, sidebarContent);

function handleScreenChange(e) {
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

mediaQuery.addEventListener('change', handleScreenChange);
handleScreenChange(mediaQuery);

// class WebSocketClient {
//     constructor(url) {
//         this.url = url;
//         this.socket = null;
//         this.connected = false;
//     }

//     connect() {
//         this.socket = new WebSocket(this.url);

//         this.socket.onopen = () => {
//             console.log('Connected to server');
//             this.connected = true;
//         };

//         this.socket.onmessage = (event) => {
//             try {
//                 const data = JSON.parse(event.data);
//                 this.handleMessage(data);
//             } catch (error) {
//                 console.error('Error parsing message:', error);
//             }
//         };

//         this.socket.onclose = () => {
//             console.log('Disconnected from server');
//             this.connected = false;
//             // Attempt to reconnect after 5 seconds
//             setTimeout(() => this.connect(), 5000);
//         };

//         this.socket.onerror = (error) => {
//             console.error('WebSocket error:', error);
//         };
//     }

//     handleMessage(data) {
//         // Handle different types of messages from the server
//         switch (data.type) {
//             case 'chat':
//                 // Handle chat messages
//                 break;
//             case 'notification':
//                 // Handle notifications
//                 break;
//             case 'status':
//                 // Handle status updates
//                 break;
//             default:
//                 console.log('Received message:', data);
//         }
//     }

//     send(message) {
//         if (this.connected && this.socket) {
//             this.socket.send(JSON.stringify(message));
//         } else {
//             console.error('Not connected to server');
//         }
//     }
// }

// // Usage example:
// const wsClient = new WebSocketClient('ws://localhost:8080/ws'); // Adjust the URL to match your server
// wsClient.connect();

// To send a message:
// wsClient.send({ type: 'chat', message: 'Hello!', userId: 123 });