document.addEventListener('DOMContentLoaded', function() {
    // fetchPosts();
    const myPostsLink = document.querySelector('a[href="/filter?by=myposts"]');
    if (myPostsLink) {
        myPostsLink.addEventListener('click', function(e) {
            e.preventDefault();
            fetchPosts('myposts');
        });
    }

    setTimeout(() => {
        if (currentUserID && (!socket || socket.readyState !== WebSocket.OPEN)) {
            initializeWebSocket().then(() => {
                console.log('WebSocket initialized on page load');
            }).catch(error => {
                console.error('Failed to initialize WebSocket:', error);
            });
        } else {
            console.log('WebSocket already initialized or not needed');
        }
    }, 2000);
})

var currentPage  = 1;
var postsPerPage = 10;
var filteredPosts = false;
let filters
let currentUserID = null;
let currentUserName = null;
const POST_CACHE = new Map();
const POSTS_PER_PAGE = 10;

function fetchUserStatus() {
    fetch('/api/user_status')
        .then(response => {
            // console.log('Raw user_status response:', response);
            return response.text();
        })
        .then(text => {
            // console.log('Response user_status text:', text);
            try {
                return JSON.parse(text);
            } catch (e) {
                console.log('Parsing user_status failed:', text);
                throw e;
            }
        })
        .then(data => {
            console.log('User status data:', data);
            if (data.loggedIn) {
                document.getElementById('loggedInUserFilter').disabled = false;
                currentUserID = data.userID;
                currentUserName = data.username;
                fetchPosts();
            } else {
                document.getElementById('loggedInUserFilter').disabled = true;
            }
            updateUserStatusUI(data);
        })
        .catch(error => console.log('Error in fetchUserStatus():', error));
}

async function fetchPosts(page = 1) {
    try {
        const response = await fetch(`/posts?page=${page}&limit=${POSTS_PER_PAGE}`, {
            credentials: 'include' // Add credentials for auth
        });
        if (!response.ok) throw new Error('Failed to fetch posts');
        
        const posts = await response.json();
        const postsContainer = document.getElementById('posts-container');
        if (!postsContainer) return;
        
        postsContainer.innerHTML = '';
        posts.forEach(post => {
            POST_CACHE.set(post.ID, post);
            const postCard = createPostCard(post);
            postsContainer.appendChild(postCard);
        });


        const totalPages = parseInt(response.headers.get('X-Total-Pages')) || 1;
        updatePaginationControls(totalPages, page);
        preloadAdjacentPages(page, totalPages);
    } catch (error) {
        console.error('Error fetching posts:', error);
        showErrorMessage('Failed to load posts. Please try again later.');
    }
}

// Error Handling Utility
function showErrorMessage(message, duration = 3000, type = 'error') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-popup ${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 10px 20px;
        border-radius: 4px;
        z-index: 1000;
        background: ${type === 'success' ? '#4CAF50' : '#ff4444'};
        color: white;
    `;
    
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), duration);
}

// Debounced Comment Handler
const debouncedCommentHandler = debounce((event, postId) => {
    handleCommentSubmit(event, postId);
}, 300);

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Improved Chat Window Management
// const activeChats = new Set();

// function openChatWindow(userId) {
//     if (activeChats.has(userId)) {
//         document.querySelector(`#chat-input-${userId}`)?.focus();
//         return;
//     }

//     const chatWindow = createChatWindow(userId);
//     document.querySelector('#chat-section')?.appendChild(chatWindow);
//     activeChats.add(userId);
//     fetchChatHistory(userId);
// }

// function createChatWindow(userId) {
//     const chatWindow = document.createElement('div');
//     chatWindow.className = 'chat-window';
//     chatWindow.innerHTML = `
//         <div class="chat-header">
//             Chat with ${onlineUsers.get(userId)?.username || `User ${userId}`}
//             <button class="close-chat" onclick="closeChatWindow(${userId})">×</button>
//         </div>
//         <div class="chat-messages" id="chat-messages-${userId}"></div>
//         <div class="chat-input-container">
//             <input type="text" id="chat-input-${userId}" placeholder="Type a message...">
//             <button onclick="sendMessage(${userId})">Send</button>
//         </div>
//     `;
//     return chatWindow;
// }

// function closeChatWindow(userId) {
//     document.querySelector(`#chat-window-${userId}`)?.remove();
//     activeChats.delete(userId);
// }

function preloadAdjacentPages(currentPage, totalPages) {
    if (currentPage > 1) {
        filteredPosts ? fetch(`/api/posts?page=${currentPage - 1}&limit=${postsPerPage}&filters=${JSON.stringify(filters)}`) :
                        fetch(    `/posts?page=${currentPage - 1}&limit=${postsPerPage}`);
    }
    if (currentPage < totalPages) {
        filteredPosts ? fetch(`/api/posts?page=${currentPage + 1}&limit=${postsPerPage}&filters=${JSON.stringify(filters)}`) :
                        fetch(    `/posts?page=${currentPage + 1}&limit=${postsPerPage}`);
    }
}

function updatePaginationControls(totalPages, currentPage) {
    const paginationContainer = document.getElementById('pagination-container');
    paginationContainer.innerHTML = '';

    if (currentPage > 1) {
        const prevButton = createPaginationButton('Previous', currentPage - 1);
        paginationContainer.appendChild(prevButton);
    }

    const range = 2; // Number of pages to show before and after current page
    let start = Math.max(1, currentPage - range);
    let end = Math.min(totalPages, currentPage + range);

    if (start > 1) {
        paginationContainer.appendChild(createPaginationButton('1', 1));
        if (start > 2) {
            paginationContainer.appendChild(document.createTextNode('...'));
        }
    }

    for (let i = start; i <= end; i++) {
        const pageButton = createPaginationButton(i.toString(), i, i === currentPage);
        paginationContainer.appendChild(pageButton);
    }

    if (end < totalPages) {
        if (end < totalPages - 1) {
            paginationContainer.appendChild(document.createTextNode('...'));
        }
        paginationContainer.appendChild(createPaginationButton(totalPages.toString(), totalPages));
    }

    if (currentPage < totalPages) {
        const nextButton = createPaginationButton('Next', currentPage + 1);
        paginationContainer.appendChild(nextButton);
    }
}

function createPaginationButton(text, page, isActive = false) {
    const button = document.createElement('button');
    button.textContent = text;
    button.classList.add('pagination-button');
    if (isActive) {
        button.classList.add('active');
    }
    button.addEventListener('click', () => filteredPosts ? fetchPostsFiltered(page) : fetchPosts(page));
    return button;
}

function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'card';
    card.id = `post-${post.ID}`;

    const title = document.createElement('h3');
    title.textContent = `post-${post.ID}: ${post.Title}`;

    const content = document.createElement('p');
    content.textContent = post.Text;

    const createdAt = document.createElement('small');
    createdAt.textContent = `Created at: ${new Date(post.CreatedAt).toLocaleString()} | By: ${post.Author}`;

    const likeDislikeContainer = document.createElement('div');
    likeDislikeContainer.className = 'like-dislike-container';

    const likeButton = document.createElement('button');
    likeButton.className = 'like-dislike-btn like-button';
    likeButton.innerHTML = '<i class="fas fa-thumbs-up">👍</i>';
    //likeButton.innerHTML = '<i class="fas fa-heart"></i> ❤️'; // Added heart icon
    likeButton.addEventListener('click', () => handleLikeDislike(post.ID, true, 'post'));

    const likeCount = document.createElement('span');
    likeCount.className = 'like-count';
    likeCount.textContent = post.Likes || 0;

    const dislikeButton = document.createElement('button');
    dislikeButton.className = 'like-dislike-btn dislike-button';
    dislikeButton.innerHTML = '<i class="fas fa-thumbs-down">👎</i>';
    dislikeButton.addEventListener('click', () => handleLikeDislike(post.ID, false, 'post'));

    const dislikeCount = document.createElement('span');
    dislikeCount.className = 'dislike-count';
    dislikeCount.textContent = post.Dislikes || 0;

    // To do: need fixes
    // likeDislikeContainer.appendChild(likeButton);
    // likeDislikeContainer.appendChild(likeCount);
    // likeDislikeContainer.appendChild(dislikeButton);
    // likeDislikeContainer.appendChild(dislikeCount);

    const commentsSection = document.createElement('div');
    commentsSection.className = 'comments-section';
    commentsSection.innerHTML = '<h4>Comments</h4>';
    
    const commentsList = document.createElement('ul');
    commentsList.id = `comments-list-${post.ID}`;
    commentsSection.appendChild(commentsList);
    const commentToggleBtn = document.createElement('button');
    commentToggleBtn.className = 'comment-toggle-btn';
    commentToggleBtn.innerHTML = '💬 Show Comments';
    
    commentsSection.style.display = 'none';
    
    commentToggleBtn.addEventListener('click', () => {
        const isHidden = commentsSection.style.display === 'none';
        commentsSection.style.display = isHidden ? 'block' : 'none';
        commentToggleBtn.innerHTML = isHidden ? '💬 Hide Comments' : '💬 Show Comments';
        
        if (isHidden) {
            fetchComments(post.ID);
        }
    });
    const commentForm = createCommentForm(post.ID);
    commentsSection.appendChild(commentForm);

    card.appendChild(title);
    card.appendChild(content);
    card.appendChild(createdAt);
    card.appendChild(likeDislikeContainer);
    card.appendChild(commentToggleBtn);
    card.appendChild(commentsSection);
    fetchComments(post.ID);
    return card;
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

function PostInteractions(card, post) {
    const likeBtn = card.querySelector('.like-btn');
    const dislikeBtn = card.querySelector('.dislike-btn');
    const commentBtn = card.querySelector('.comment-btn');
    const commentsSection = card.querySelector('.comments-section');

    likeBtn.onclick = () => handleLikeDislike(post.ID, true, 'post');
    dislikeBtn.onclick = () => handleLikeDislike(post.ID, false, 'post');
    commentBtn.onclick = () => {
        commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
        if (commentsSection.style.display === 'block') {
            fetchComments(post.ID);
        }
    };

    const commentForm = card.querySelector(`#comment-form-${post.ID}`);
    commentForm.onsubmit = (e) => {
        e.preventDefault();
        handleCommentSubmit(e, post.ID);
    };
}



// function handleLikeDislike(id, isLike, type) {
//     const endpoint = isLike ? `/${type}/like` : `/${type}/dislike`;
//     fetch(endpoint, {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ [type === 'post' ? 'PostID' : 'CommentID']: id }),
//         credentials: 'include'
//     })
//     .then(response => response.json())
//     .then(data => {
//         if (data.likeDislike) {
//             updateLikeDislikeUI(id, data.likeDislike.IsLike, data.likes, data.dislikes, type, data.created);
//         } else {
//             console.error('Error:', data.message);
//         }
//     })
//     .catch(error => {
//         console.error('Error:', error);
//     });
// }

function updateLikeDislikeUI(id, isLike, likes, dislikes, type, created) {
    const container = document.querySelector(`#${type}-${id}`);
    const likeButton = container.querySelector('.like-button');
    const dislikeButton = container.querySelector('.dislike-button');
    const likeCount = container.querySelector('.like-count');
    const dislikeCount = container.querySelector('.dislike-count');

    likeCount.textContent = likes;
    dislikeCount.textContent = dislikes;

    likeButton.classList.toggle('active', created && isLike);
    dislikeButton.classList.toggle('active', created && !isLike);
}

// Side bar
document.addEventListener('DOMContentLoaded', function() {
    var coll = document.getElementsByClassName("collapsible");
    for (var i = 0; i < coll.length; i++) {
        coll[i].addEventListener("click", function() {
            this.classList.toggle("active");
            var content = this.nextElementSibling;
            if (content.style.display === "block") {
                content.style.display = "none";
            } else {
                content.style.display = "block";
            }
        });
    }

    fetchCategories()
    fetchOldestAndNewstPostDates()
    fetchUserStatus();

    // Add event listeners for filter changes
    document.querySelectorAll('.filter-section input').forEach(input => {
        input.addEventListener('change', function() {fetchPostsFiltered()});
    });
});

// fetchPosts function to include filters
function fetchPostsFiltered(page = 1) {
    const selectedCategories = Array.from(document.querySelectorAll('#categories-list input[type="checkbox"]:checked'))
    .map(checkbox => checkbox.value);

    filters = {
        categories: selectedCategories,
        users: getSelectedUsers(),
        fromDate: document.getElementById('fromDate').value,
        toDate: document.getElementById('toDate').value,
        likedOnly: document.getElementById('likedPosts').checked,
        loggedInUserFilter: document.getElementById('loggedInUserFilter').checked
    };
    filteredPosts = true;

    if (filters.loggedInUserFilter && currentUserID) {
        filters.userID = currentUserID;
    }
    const queryParams = new URLSearchParams({
        page: page,
        limit: postsPerPage,
        filters: JSON.stringify(filters)
    });

    var totalCount = 0
    fetch(`/api/posts?${queryParams}`)
        .then(response => {
            // totalCount = parseInt(response.headers.get('X-Total-Count')) || 0;
            totalCount = parseInt(response.headers.get('X-Total-Count'), 10);
            document.getElementById('resultsCounter').textContent = `Total Results: ${totalCount}`;
            return response.json();
        })
        .then(posts => {
            const postsContainer = document.getElementById('posts-container');
            postsContainer.innerHTML = '';

            posts.forEach(post => {
                const postCard = createPostCard(post);
                postsContainer.appendChild(postCard);
            });

            const totalPages = Math.ceil(totalCount / postsPerPage);
            updatePaginationControls(totalPages, page);
            preloadAdjacentPages(page, totalPages);
        })
        .catch(error => console.error('Error:', error));
}

function getSelectedUsers() {
    // Implement this based on your user filter options
}

function fetchCategories() {
    fetch('/categories')
        .then(response => response.json())
        .then(categories => {
            // console.log('Fetched categories:', categories);
            const categoriesList = document.getElementById('categories-list');
            categoriesList.innerHTML = '';
            categories.forEach(category => {
                if (category && category.ID && category.Name) {
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `category-${category.ID}`;
                    checkbox.value = category.ID;
                    checkbox.addEventListener('change', () => fetchPostsFiltered());

                    const label = document.createElement('label');
                    label.htmlFor = `category-${category.ID}`;
                    label.textContent = `${category.Name} (${category.PostCount || 0})`;

                    categoriesList.appendChild(checkbox);
                    categoriesList.appendChild(label);
                    categoriesList.appendChild(document.createElement('br'));
                } else {
                    console.error('Invalid category data:', category);
                }
            });
        })
        .catch(error => {
            console.error('Error fetching categories:', error);
        });
}

function fetchOldestAndNewstPostDates() {
    Promise.all([
        fetch('/api/oldest-post-date').then(res => res.json()),
        fetch('/api/newest-post-date').then(res => res.json())
    ]).then(([oldestDate, newestDate]) => {
        document.getElementById('fromDate').value = oldestDate.split(' ')[0];
        document.getElementById('toDate').value = newestDate.split(' ')[0];
    });
}

function fetchComments(postId) {
    fetch(`/comments?post_id=${postId}`, {
        credentials: 'include'
    })
        .then(response => response.json())
        .then(data => {
            if (Array.isArray(data)) {
                const commentContainer = document.getElementById(`comments-list-${postId}`);
                commentContainer.style.display = 'flex';
                commentContainer.style.flexDirection = 'column';
                commentContainer.style.gap = '1.5rem';
                if (commentContainer) {
                    commentContainer.innerHTML = '';
                    data.forEach(comment => {
                        const commentItem = createCommentItem(comment);
                        commentContainer.appendChild(commentItem);
                    });
                } else {
                    console.log(`Comment container not found in DOM. post ID: ${postId}`);
                }
            } else {
                console.log(`No comments found or invalid data structure for post ID: ${postId}`);
            }
        })
        .catch(error => console.error('Error fetching comments:', error));
}

function createCommentItem(comment) {
    // const commentItem = document.createElement('li');
    // commentItem.id = `comment-${comment.ID}`;
    // commentItem.textContent = comment.Text;

    const commentItem = document.createElement('li');

    const timestamp = new Date(comment.CreatedAt).toLocaleString();
    const commentHeader = document.createElement('div');
    commentHeader.className = 'comment-header';
    commentHeader.innerHTML = `
        <span class="comment-author">${comment.Author}</span>
        <span class="comment-timestamp">${timestamp}</span>
    `;
    
    const commentText = document.createElement('div');
    commentText.className = 'comment-text';
    commentText.textContent = comment.Text;
    
    commentItem.appendChild(commentHeader);
    commentItem.appendChild(commentText);


    // const likeDislikeContainer = document.createElement('div');
    // likeDislikeContainer.className = 'like-dislike-container';

    // const likeButton = document.createElement('button');
    // likeButton.className = 'like-dislike-btn like-button';
    // likeButton.innerHTML = '<i class="fas fa-thumbs-up">👍</i>';
    // // likeButton.addEventListener('click', () => handleLikeDislike(comment.ID, true, 'comment'));

    // const likeCount = document.createElement('span');
    // likeCount.className = 'like-count';
    // likeCount.textContent = comment.Likes || 0;

    // const dislikeButton = document.createElement('button');
    // dislikeButton.className = 'like-dislike-btn dislike-button';
    // dislikeButton.innerHTML = '<i class="fas fa-thumbs-down">👎</i>';
    // dislikeButton.addEventListener('click', () => handleLikeDislike(comment.ID, false, 'comment'));

    // const dislikeCount = document.createElement('span');
    // dislikeCount.className = 'dislike-count';
    // dislikeCount.textContent = comment.Dislikes || 0;

    // likeDislikeContainer.appendChild(likeButton);
    // likeDislikeContainer.appendChild(likeCount);
    // likeDislikeContainer.appendChild(dislikeButton);
    // likeDislikeContainer.appendChild(dislikeCount);

    // commentItem.appendChild(likeDislikeContainer);

    // const reactionButtons = document.createElement('div');
    // reactionButtons.className = 'reaction-buttons';
    // reactionButtons.innerHTML = `
    // <button class="reaction">😄</button>
    // <button class="reaction">😂</button>
    // <button class="reaction">❤️</button>
    // <button class="reaction">👍</button>
    // `;
    // commentItem.appendChild(reactionButtons);

    return commentItem;
}

function handleCommentSubmit(event, postId) {
    event.preventDefault();
    const form = event.target;
    const content = form.content.value.trim();
    
    if (!content) return;

    fetch('/comment/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            PostID: postId,
            Text: content
        }),
        credentials: 'include'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        form.reset();
        fetchComments(postId);
        showErrorMessage('Comment posted successfully!', 2000, 'success');
    })
    .catch(error => {
        showErrorMessage('Failed to post comment', 3000, 'error');
    });
}





function createCommentForm(postId) {
    const commentForm = document.createElement('form');
    commentForm.className = 'comment-form';
    commentForm.innerHTML = `
    <!-- <div class="comment-toolbar">
        <button type="button" class="emoji-trigger">😊</button>
    </div> -->
    <textarea name="content" placeholder="Add a comment ✍️" required></textarea>
    <button type="submit">Send 📤</button>
`;
    commentForm.addEventListener('submit', (e) => handleCommentSubmit(e, postId));
    return commentForm;
}

function displayPosts(posts) {
    const postsContainer = document.getElementById('posts-container');
    postsContainer.innerHTML = '';
    posts.forEach(post => {
        const postElement = createPostElement(post);
        postsContainer.appendChild(postElement);
    });
}

function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    postDiv.innerHTML = `
        <h3>${post.Title}</h3>
        <p>${post.Content}</p>
        <small>Posted by: ${post.UserID} on ${post.CreatedAt}</small>
    `;
    return postDiv;
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
