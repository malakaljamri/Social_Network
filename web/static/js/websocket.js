let socket;
const onlineUsers = new Map();
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5; const RECONNECT_DELAY = 5000;
const activeNotifications = new Map();
function initializeWebSocket() {
    return new Promise((resolve, reject) => {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.error('Max reconnection attempts reached');
            reject(new Error('Max reconnection attempts reached'));
            return;
        }

        try {
            if (socket?.readyState === WebSocket.OPEN) {
                socket.close();
            }

            socket = new WebSocket('ws://localhost:8080/ws');
            
            socket.onopen = async function() {
                console.log('WebSocket connected');
                reconnectAttempts = 0; // Reset on successful connection
                
                try {
                    if (currentUserID) {
                        // Send login status and request user list update
                        sendUserStatus('online');
                        // Request full users list update
                        // socket.send(JSON.stringify({
                        //     type: 'users_update',
                        //     // content: {
                        //     //     user_id: currentUserID,
                        //     //     status: 'online',
                        //     //     currentUserName: currentUserName
                        //     // }
                        // }));
                    }
                    await fetchOnlineUsers();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };

            socket.onerror = function(error) {
                console.error('WebSocket error:', error);
                reject(error);
            };

            socket.onmessage = function(event) {
                try {
                    console.log('Raw WebSocket message:', event.data);
                    const message = JSON.parse(event.data);
                    console.log('Parsed WebSocket message:', message);
                    handleWebSocketMessage(message);
                } catch (error) {
                    console.error('Error handling WebSocket message:', error);
                    console.error('Raw message:', event.data);
                }
            };

            socket.onclose = function(event) {
                console.log(`Connection closed: ${event.code} ${event.reason}`);
                if (currentUserID) {
                    reconnectAttempts++;
                    setTimeout(initializeWebSocket, RECONNECT_DELAY);
                }
            };
        } catch (error) {
            reject(error);
        }
    });
}

function sendUserStatus(status) {
    if (socket?.readyState === WebSocket.OPEN && currentUserID) {
        const message = {
            type: 'user_status',
            content: {
                user_id: currentUserID,
                status: status,
                username: currentUserName
            }
        };
        socket.send(JSON.stringify(message));
    }
}

function sendPublicChatMessage(messageContent) {
    console.log('Sending public chat message:', messageContent);
    const input = document.getElementById('publicChatInput');
    if (socket?.readyState === WebSocket.OPEN) {
        const chatMessage = {
            type: "chat",
            content: messageContent,
            Receiver_id: 0  // 0 indicates public message
        };
        socket.send(JSON.stringify(chatMessage));
        input.value = '';input.focus();
    } else {
        console.error('Socket not connected');
    }
}

document.getElementById('publicChatInput').addEventListener('keydown', () => {
    clearTimeout(typingTimeout);
    sendTypingStatus(0, true); // 0 for public chat
    
    typingTimeout = setTimeout(() => {
        sendTypingStatus(0, false);
    }, 1000);
});

function handleWebSocketMessage(message) {
    console.log("Handling message:", message);
    switch(message.type) {
        case 'user_status':
            const userData = message.content;
            console.log("User status update:", userData);
            if (userData.user_id && userData.status) {
                if (userData.status === 'offline') {
                    // onlineUsers.delete(userData.user_id);
                    console.log(`User ${userData.user_id} is now offline`);
                } else {
                    // Update the online users list
                    onlineUsers.set(userData.user_id, {
                        online: true,
                        username: userData.username || `User ${userData.user_id}`,
                        LastMessageTime: Date.now()
                    });
                    console.log(`User ${userData.user_id} is now online`);
                }
                updateOnlineUsersList();
                
                // Force a refresh of online users from server
                fetchOnlineUsers().then(() => {
                    updateOnlineUsersList();
                });
            }
            break;
        // case 'users_update':
        //     // Handle bulk updates to online users list
        //     if (message.content.users) {
        //         onlineUsers.clear();
        //         message.content.users.forEach(user => {
        //             if (user.ID !== currentUserID) {
        //                 onlineUsers.set(user.ID, {
        //                     online: true,
        //                     username: user.Username
        //                 });
        //             }
        //         });
        //         updateOnlineUsersList();
        //     }
        //     break;
        case 'chat':
            if (message.content.Receiver_id === 0) { // Public chat message
                const publicChatContainer = document.querySelector('.public_chat_messagesContainer');
                if (publicChatContainer) {
                    const messageElement = document.createElement('div');
                    messageElement.className = 'chat-message';
                    const timestamp = new Date(message.content.timestamp).toLocaleString();
                    // Use username instead of sender_id
                    const senderUsername = message.content.sender_username || 
                                        (message.content.sender_id === currentUserID ? currentUserName : 
                                        onlineUsers.get(message.content.sender_id)?.username || `User ${message.content.sender_id}`);
                    messageElement.innerHTML = `<span>[${timestamp}]</span></br> ${senderUsername}: ${message.content.content}`;
                    publicChatContainer.appendChild(messageElement);
                    publicChatContainer.scrollTop = publicChatContainer.scrollHeight;
                }
            } else { // Private chat message handling
                displayChatMessage(message.content);
                notifyNewMessage(message.content);
            }
            break;
        case 'typing_status':
            updateTypingStatus(message.content);
            notifyNewMessage(message.content);
            break;
        case 'time':
            console.log("Current server time:", message.content);
            break;
        case 'error':
            console.error("Server error:", message.content);
            break;
        default:
            console.warn('Unknown message type:', message);
    }
}

function notifyNewMessage(message) {
    if (message.Receiver_id === currentUserID && message.username) {
        if (activeNotifications.has(message.username)) {
            return;
        }

        const notification = document.createElement('div');
        notification.className = 'floating-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-title">${message.username}</div>
                <div class="notification-body">
                    Is typing<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        activeNotifications.set(message.username, notification);
        
        setTimeout(() => notification.classList.add('show'), 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
                activeNotifications.delete(message.username);
            }, 300);
        }, 3000);
    }
}

function updateUserStatus(data) {
    if (!data.user_id) return;
    onlineUsers.set(data.user_id, {
        online: data.status === 'online',
        username: data.username
    });
    updateOnlineUsersList();
}
function updateOnlineUsersList() {
    const userList = document.querySelector('#online-users .users-container');
    if (!userList) return;
    
    const sortedUsers = Array.from(onlineUsers.entries()).sort((a, b) => {
        // First sort by online status
        if (a[1].online !== b[1].online) {
            return a[1].online ? -1 : 1;
        }
        // Then sort by last message time if available
        if (a[1].LastMessageTime && b[1].LastMessageTime) {
            return new Date(b[1].LastMessageTime) - new Date(a[1].LastMessageTime);
        }
        // If no messages or equal times, sort alphabetically by username
        // return a[1].username.toLowerCase().localeCompare(b[1].username.toLowerCase());
        return 0;
    });

    userList.innerHTML = '';
    sortedUsers.forEach(([userId, userData]) => {
        if (userId === currentUserID) return;
        
        const userElement = document.createElement('div');
        userElement.className = `user-item ${userData.online ? 'online-user' : 'offline-user'}`;
        const statusDot = document.createElement('span');
        statusDot.style.display = 'inline-block';
        statusDot.style.width = '8px';
        statusDot.style.height = '8px';
        statusDot.style.borderRadius = '50%';
        statusDot.style.marginRight = '5px';
        statusDot.style.backgroundColor = userData.online ? 'green' : 'red';

        userElement.appendChild(statusDot);
        userElement.appendChild(document.createTextNode(userData.username));
        userElement.onclick = () => openChatWindow(userId);
        userList.appendChild(userElement);
    });
}

function fetchOnlineUsers() {
    return new Promise((resolve, reject) => {   
        fetch('/api/online-users')
            .then(response => response.json())
            .then(users => {
                if (users && !users.hasOwnProperty('error')) {
                    onlineUsers.clear();
                    users.forEach(user => {
                        if (user.ID !== currentUserID) {
                            onlineUsers.set(user.ID, {
                                online: user.Online,
                                username: user.Username,
                                LastMessageTime: user.LastMessageTime
                            });
                        }
                    });
                    updateOnlineUsersList();
                }
                resolve(users);
            })
            .catch(error => {
                console.error('Error fetching online users:', error);
                reject(error);
            });
    });
}

fetchOnlineUsers();

function openChatWindow(userId) {
    if (document.querySelector(`#chat-input-${userId}`)) {
        document.querySelector(`#chat-input-${userId}`).focus();
        document.querySelector(`#chat-input-${userId}`).parentElement.style.zIndex = Math.floor(new Date().getTime() / 1000) % 2147483647;
        return;
    }

    const userData = onlineUsers.get(userId);
    const username = userData ? userData.username : `User ${userId}`;
    const chatWindow = document.createElement('div');
    chatWindow.className = 'chat-window card';
    const closeId = `close-btn-${userId}`;
    chatWindow.innerHTML = `
        <div class="chat-header">Chat with ${username}<span class="close-span" id="${closeId}">X</span></div>
        <div class="chat-messages" id="chat-messages-${userId}"></div>
        <input type="text" id="chat-input-${userId}" placeholder="Type a message..." onkeydown="
        if(event.key === 'Enter') sendMessage(${userId})
        else if(event.key === 'Escape') this.parentElement.remove()"
        oninput="handleTyping(${userId})"
        >
        <button onclick="sendMessage(${userId})">Send</button>
    `;
    document.querySelector('#chat-section').appendChild(chatWindow);
    // get the close span element
    // document.querySelector('#close-span').onclick = () => chatWindow.remove();
    const closeBtn = document.getElementById(closeId);
    if (closeBtn) {
        closeBtn.onclick = () => chatWindow.remove();
    }
    // const closeButton = document.createElement('button');
    // closeButton.className = 'close-chat';
    // closeButton.textContent = 'X';
    // closeButton.onclick = () => chatWindow.remove();
    // chatWindow.appendChild(closeButton);
    chatWindow.style.zIndex = Math.floor(new Date().getTime() / 1000) % 2147483647;
    fetchChatHistory(userId);
    initializeScrollHandler(userId);
    // handleTyping(userId);
    document.querySelector(`#chat-input-${userId}`).focus();
}

const throttle = (func, limit) => {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

function fetchChatHistory(userId, offset = 0) {
    const chatMessages = document.getElementById(`chat-messages-${userId}`);
    if (!chatMessages) return Promise.resolve();

    const previousHeight = chatMessages.scrollHeight;

    return fetch(`/api/chat-history?user_id=${userId}&offset=${offset}`)
        .then(response => response.json())
        .then(messages => {
            if (messages && messages.length > 0) {
                const fragment = document.createDocumentFragment();
                messages.reverse().forEach(message => {
                    const messageElement = document.createElement('div');
                    messageElement.className = 'chat-message';
                    const timestamp = new Date(message.timestamp).toLocaleString();
                    
                    // Get username for sender
                    const senderUsername = message.sender_id === currentUserID ? 
                        currentUserName : 
                        onlineUsers.get(parseInt(message.sender_id))?.username || 
                        `User ${message.sender_id}`;

                    messageElement.innerHTML = `<span>[${timestamp}]</span></br> ${senderUsername}: ${message.content}`;
                    fragment.appendChild(messageElement);
                });
                
                chatMessages.insertBefore(fragment, chatMessages.firstChild);
                
                if (offset === 0) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                } else {
                    chatMessages.scrollTop = chatMessages.scrollHeight - previousHeight;
                }
            }
            return messages;
        });
}

let isLoading = false;
const SCROLL_THRESHOLD = 100;

// function initializeScrollHandler(userId) { // throttle issue: scrolling fast (via mouse wheel or Pressing Home) will not trigger the fetch.
//     const chatMessages = document.getElementById(`chat-messages-${userId}`);
//     let messageOffset = 10;
    
//     const handleScroll = throttle(() => {
//         console.log("Scroll position:", chatMessages.scrollTop);
        
//         if (!isLoading && chatMessages.scrollTop === 0) {
//             console.log("Top reached, loading messages from offset:", messageOffset);
//             isLoading = true;
//             const previousHeight = chatMessages.scrollHeight;
            
//             fetchChatHistory(userId, messageOffset)
//                 .then(() => {
//                     chatMessages.scrollTop = chatMessages.scrollHeight - previousHeight;
//                     messageOffset += 10;
//                     isLoading = false;
//                 });
//         }
//     }, 250);

//     chatMessages.addEventListener('scroll', handleScroll);
// }
function initializeScrollHandler(userId) {
    const chatMessages = document.getElementById(`chat-messages-${userId}`);
    let messageOffset = 10;
    let ticking = false;
    
    const handleScroll = () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                if (!isLoading && chatMessages.scrollTop === 0) {
                    console.log("Loading messages from offset:", messageOffset);
                    isLoading = true;
                    const previousHeight = chatMessages.scrollHeight;
                    
                    fetchChatHistory(userId, messageOffset)
                        .then(() => {
                            chatMessages.scrollTop = chatMessages.scrollHeight - previousHeight;
                            messageOffset += 10;
                            isLoading = false;
                        });
                }
                ticking = false;
            });
            ticking = true;
        }
    };

    chatMessages.addEventListener('scroll', handleScroll);
}

function sendMessage(userId) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        initializeWebSocket().then(() => {
            sendMessageToSocket(userId);
        });
    } else {
        sendMessageToSocket(userId);
    }
}

function sendMessageToSocket(userId) {
    const input = document.getElementById(`chat-input-${userId}`);
    const message = input.value.trim();

    // Check if user is online before sending
    /*const userData = onlineUsers.get(userId);
    if (!userData || !userData.online) {
        const chatContainer = document.getElementById(`chat-messages-${userId}`);
        const errorMessage = document.createElement('div');
        errorMessage.className = 'chat-message error';
        errorMessage.textContent = 'Cannot send message. User is offline.';
        chatContainer.appendChild(errorMessage);
        return;
    }*/
     
    if (message) {
        const chatMessage = {
            type: "chat",
            Receiver_id: userId,
            content: message,
            sender_username: currentUserName  // Add sender's username
        };
        socket.send(JSON.stringify(chatMessage));
        input.value = '';
    }
}

function displayChatMessage(message) {
    let chatContainer;
    let isNewWindow = false;
    
    // For direct messages between users
    if (message.sender_id === currentUserID) {
        chatContainer = document.getElementById(`chat-messages-${message.Receiver_id}`);
        if (!chatContainer) {
            // clear all existing chat widows
            document.querySelectorAll('.chat-window').forEach(window => {
                window.remove();
            });
            openChatWindow(message.Receiver_id);
            isNewWindow = true;
            chatContainer = document.getElementById(`chat-messages-${message.Receiver_id}`);
        }
    } else if (message.Receiver_id === currentUserID) {
        chatContainer = document.getElementById(`chat-messages-${message.sender_id}`);
        if (!chatContainer) {
            openChatWindow(message.sender_id);
            isNewWindow = true;
            chatContainer = document.getElementById(`chat-messages-${message.sender_id}`);
        }
    }

    if (chatContainer && !isNewWindow) {
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        const timestamp = new Date(message.timestamp).toLocaleString();
        // Use the sender's username from the message or fall back to the cached username
        const senderUsername = message.sender_username || 
                             (message.sender_id === currentUserID ? currentUserName : 
                             onlineUsers.get(message.sender_id)?.username || `User ${message.sender_id}`);
        messageElement.innerHTML = `<span>[${timestamp}]</span></br> ${senderUsername}: ${message.content}`;
        chatContainer.appendChild(messageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }   
}



window.addEventListener('beforeunload', () => {
    if (!socket) return;
    // Store the current state to handle cleanup
    const currentState = socket.readyState;
    
    // Only attempt to send if connection is open
    if (currentState === WebSocket.OPEN) {
        // Send a synchronous close message
        socket.send(JSON.stringify({
            type: "user_status",
            content: {
                status: "offline"
            }
        }));
        
        // Close the connection cleanly
        socket.close();
    }
    cleanupWebSocket();
});

// window.addEventListener('load', () => {
//     if (socket.readyState != WebSocket.OPEN) { return; }
//     socket.send(JSON.stringify({
//         type: "user_status",
//         content: {
//             status: "online"
//         }
//     }));
// });

// When logout is called
function cleanupWebSocket() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        try {
            console.log("Sending offline status for user:", currentUserID);
            socket.send(JSON.stringify({
                type: "user_status",
                content: {
                    user_id: currentUserID,
                    status: "offline",
                    currentUserName: currentUserName
                }
            }));
            socket.close();
            console.log("WebSocket connection closed");
        } catch (error) {
            console.error("Error during WebSocket cleanup:", error);
        }
    }
}

let typingTimeout;

function handleTyping(userId) {
    const input = document.getElementById(`chat-input-${userId}`);
    input.addEventListener('input', () => {
        clearTimeout(typingTimeout);
        sendTypingStatus(userId, true);
        
        typingTimeout = setTimeout(() => {
            sendTypingStatus(userId, false);
        }, 1000);
    });
}

function sendTypingStatus(receiverId, isTyping) {
    if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'typing_status',
            content: {
                Receiver_id: receiverId,
                is_typing: isTyping,
                username: currentUserName
            }
        }));
    }
}


function updateTypingStatus(data) {
    const container = data.Receiver_id === 0 ? 
        document.getElementById('public_chat_messagesContainer') :
        document.getElementById(`chat-messages-${data.sender_id}`);
        
    if (!container || !data.username) return;

    let typingIndicator = container.querySelector('.typing-indicator');
    
    if (data.is_typing) {
        if (!typingIndicator) {
            typingIndicator = document.createElement('div');
            typingIndicator.className = 'typing-indicator';
            typingIndicator.innerHTML = `
                <span class="username">${data.username}</span> is typing
                <span class="dots">
                    <span>.</span><span>.</span><span>.</span>
                </span>
            `;
            container.appendChild(typingIndicator);
        }
    } else if (typingIndicator) {
        typingIndicator.remove();
    }
}