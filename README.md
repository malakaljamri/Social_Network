# Social Network

**This Project is Based of:** Go, Vue.js, JavaScript, HTML, CSS, SQLite, Docker, WebSockets  

---

## Project Overview
This project is a **instagram-like social network** that allows users to interact through posts, comments, groups, notifications, and private/group chats.  
It is built with **Vue.js** for the frontend and **Go** for the backend, using **SQLite** for data storage and **Docker** for containerization. The app supports real-time messaging via **WebSockets**.

---

## Features
- **User Profiles**: Public and private profiles with personal info, posts, followers/following lists.  
- **Posts**: Create posts with images or GIFs; set post privacy (public, followers, selected followers).  
- **Followers**: Follow/unfollow users; send follow requests if the profile is private.  
- **Groups**: Create groups, invite users, post within groups, and create events with RSVP options.  
- **Chats**: Private messaging between followers or public profiles; group chats for members.  
- **Notifications**: Real-time notifications for follow requests, group invitations, events, and more.  

---

## Frontend
- Built with **Vue.js**  
- Responsive UI for desktop and mobile  
- Components for profile, posts, groups, chats, and notifications  
- Real-time chat using **WebSockets**  

---

## Backend
- Built with **Go**  
- REST API for posts, users, groups, and notifications  
- WebSocket server for real-time messaging  
- Handles authentication, image uploads, and session management  

---

## Database
- **SQLite** is used for storing user data, posts, groups, and messages  
- Database migrations are implemented with `golang-migrate`  
- Folder structure for migrations:

