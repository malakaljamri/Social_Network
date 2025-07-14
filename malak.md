# 1- caddy is done i think 
By running the command:
caddy file-server --root ~/Social_Network/web --listen :8080

We installed and ran Caddy to serve your website’s static files from your project folder on localhost:8080. 
we confirmed the site loads correctly, ensuring your web server setup works.

-------------

# Modify the User struct to align with the registration requirements.
# Update the following files:
db_users.go
auth.go
M_register.js

# In each, implement validation for the required fields at the section marked:
// Validate required fields
Keep using nickname as the username.
In the database schema, modify the username column to:
username TEXT UNIQUE
(Remove the NOT NULL constraint.)
Keep the following INSERT query as-is:

query := `INSERT INTO users (email, password, birthDate, first_name, last_name, avatar, nickname, about_me) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`

-----------

# ignore the Docker for now i will make sure it will work if we finish inshallah 

-------------

# Docker now is done 

to run it use " docker-compose up "

![alt text](image.png)
![alt text](image-1.png)


// If username is empty, generate a unique one from first and last name
	if user.Username == "" {
		user.Username = database.GenerateUniqueUsername(user.FirstName, user.LastName)
	}


in auth.go

// GenerateUniqueUsername generates a username from first and last name and ensures it is unique in the database.
func GenerateUniqueUsername(first, last string) string {
	base := fmt.Sprintf("%s%s", first, last)
	username := base
	count := 1
	for {
		var exists int
		query := "SELECT COUNT(1) FROM users WHERE username = ?"
		err := db.QueryRow(query, username).Scan(&exists)
		if err != nil {
			return username // fallback
		}
		if exists == 0 {
			return username
		}
		username = fmt.Sprintf("%s%d", base, count)
		count++
	}
}.  in db_users.go


// chat.go --> for send msg notification to receiver
// START: SEND NOTIFICATION TO RECEIVER
		sender, err := database.GetUserByID(chatMessage.SenderID)
		if err != nil {
			log.Printf("Error getting sender details for notification: %v", err)
		} else {
			notification := websocket.Message{
				Type: "private_message_notification",
				Content: map[string]string{
					"sender_name": sender.FirstName + " " + sender.LastName,
				},
				UserID: chatMessage.ReceiverID,
			}
			jsonNotification, _ := json.Marshal(notification)
			h.hub.Broadcast <- jsonNotification
		}
		// END: SEND NOTIFICATION TO RECEIVER

// websocket.js --> for receive msg notification to receiver

 case 'private_message_notification':
                    handlePrivateMessageNotification(message.content);
                    break;




            const messageText = document.createElement('span');
            messageText.textContent = message;

            const progressBar = document.createElement('div');
            progressBar.className = 'toast-progress';

            toast.appendChild(messageText);
            toast.appendChild(progressBar);



