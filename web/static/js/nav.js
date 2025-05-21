document.addEventListener('DOMContentLoaded', function() {
    const app = createNavbar();
    app.mount('#navbar');
});

const mediaQuery = window.matchMedia('(max-width: 1300px)');
const toggleButton = document.createElement('button');
toggleButton.innerHTML = '☰';
toggleButton.className = 'sidebar-toggle';
const sidebarContent = document.getElementById('sidebarContent');
sidebarContent.parentNode.insertBefore(toggleButton, sidebarContent);

// window.handleScreenChange = handleScreenChange;

mediaQuery.addEventListener('change', handleScreenChange);
handleScreenChange(mediaQuery);

// Also watch for showSidebar changes from Vue
if (window.__VUE_APP__) {
    window.__VUE_APP__.showSidebar.effect.run = () => handleScreenChange(mediaQuery);
}

// Add event delegation for Create Post button
document.addEventListener('click', function(e) {
    const target = e.target.closest('.create-post-btn');
    // Only trigger if Vue app is in posts view
    if (target && window.__VUE_APP__ && window.__VUE_APP__.currentView === 'posts') {
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
                    <div class="category-select-container" style="margin-bottom: 15px;">
                        <input type="text" id="category-search" placeholder="Search categories..." style="width: 100%; padding: 8px; margin-bottom: 8px;">
                        <div id="categories-container" style="max-height: 200px; overflow-y: auto; border: 1px solid #ccc; padding: 10px;">
                            <!-- Categories will be populated here -->
                        </div>
                    </div>
                    <select id="post-privacy" required>
                        <option value="public" selected>Public</option>
                        <option value="almost_private">Followers</option>
                        <option value="private">Chosen followers</option>
                    </select>
                    <div id="chosen-followers-container" style="display: none; margin-top: 10px;">
                        <div style="margin-bottom: 10px;">
                            <input type="text" id="follower-search" placeholder="Search followers..." style="width: 100%; padding: 8px;">
                        </div>
                        <div id="followers-list" style="max-height: 200px; overflow-y: auto; border: 1px solid #ccc; padding: 10px;">
                            <!-- Followers will be populated here -->
                        </div>
                    </div>
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
                const categoriesContainer = document.getElementById('categories-container');
                categories.forEach(category => {
                    const categoryDiv = document.createElement('div');
                    categoryDiv.className = 'category-item';
                    categoryDiv.style.cssText = 'display: flex; align-items: center; padding: 5px; cursor: pointer;';
                    categoryDiv.innerHTML = `
                        <input type="checkbox" id="category-${category.ID}" value="${category.ID}" style="margin-right: 10px;">
                        <label for="category-${category.ID}">${category.Name}</label>
                    `;
                    categoriesContainer.appendChild(categoryDiv);
                });

                // Add search functionality for categories
                document.getElementById('category-search').addEventListener('input', function(e) {
                    const searchTerm = e.target.value.toLowerCase();
                    const categoryItems = document.querySelectorAll('.category-item');
                    categoryItems.forEach(item => {
                        const categoryName = item.querySelector('label').textContent.toLowerCase();
                        item.style.display = categoryName.includes(searchTerm) ? 'flex' : 'none';
                    });
                });
            });
    
        // Add event listener for privacy select
        document.getElementById('post-privacy').addEventListener('change', function() {
            const chosenFollowersContainer = document.getElementById('chosen-followers-container');
            if (this.value === 'private') {
                chosenFollowersContainer.style.display = 'block';
                // Fetch followers when container is shown
                fetch('/api/user/followers?id=' + currentUserID)
                    .then(response => response.json())
                    .then(followers => {
                        const followersList = document.getElementById('followers-list');
                        followersList.innerHTML = '';
                        followers.forEach(follower => {
                            const followerDiv = document.createElement('div');
                            followerDiv.className = 'follower-item';
                            followerDiv.style.cssText = 'display: flex; align-items: center; padding: 5px; cursor: pointer;';
                            followerDiv.innerHTML = `
                                <input type="checkbox" id="follower-${follower.ID}" value="${follower.ID}" style="margin-right: 10px;">
                                <label for="follower-${follower.ID}">${follower.Username}</label>
                            `;
                            followersList.appendChild(followerDiv);
                        });
                    })
                    .catch(error => console.error('Error fetching followers:', error));
            } else {
                chosenFollowersContainer.style.display = 'none';
            }
        });

        // Add search functionality for followers
        document.getElementById('follower-search').addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const followerItems = document.querySelectorAll('.follower-item');
            followerItems.forEach(item => {
                const username = item.querySelector('label').textContent.toLowerCase();
                item.style.display = username.includes(searchTerm) ? 'flex' : 'none';
            });
        });

        document.getElementById('create-post-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const responseElement = document.getElementById('create-post-response');
            responseElement.textContent = 'Creating post...';
            
            const title = document.getElementById('post-title').value;
            const content = document.getElementById('post-content').value;
            const privacy = document.getElementById('post-privacy').value;
            const formData = new FormData();
            formData.append('Title', title);
            formData.append('Text', content);
            // Get all selected categories
            const selectedCategories = Array.from(document.querySelectorAll('#categories-container input[type="checkbox"]:checked'))
                .map(checkbox => parseInt(checkbox.value));
            formData.append('CategoryIDs', JSON.stringify(selectedCategories));
            formData.append('UserID', parseInt(currentUserID));
            formData.append('Privacy', privacy);

            // Add chosen followers if privacy is private
            if (privacy === 'private') {
                const chosenFollowers = Array.from(document.querySelectorAll('#followers-list input[type="checkbox"]:checked'))
                    .map(checkbox => parseInt(checkbox.value));
                formData.append('ChosenFollowers', JSON.stringify(chosenFollowers));
            }

            const imageFile = document.getElementById('post-image').files[0];
            if (imageFile) formData.append('Image', imageFile);
    
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
                        // Check if we're using Vue app or vanilla JS
                        if (window.__VUE_APP__) {
                            // If using Vue app, call its fetchPosts method
                            window.__VUE_APP__.fetchPosts(1);
                        } else {
                            // If using vanilla JS, call the global fetchPosts function
                            fetchPosts(1);
                        }
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
