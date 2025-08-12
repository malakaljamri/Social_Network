-- Insert sample categories
INSERT OR IGNORE INTO categories (name) VALUES 
    ('Technology'),
    ('Sports'),
    ('Movies'),
    ('Food'),
    ('Travel');

-- Insert sample users (passwords are hashed versions of usernames)
INSERT OR IGNORE INTO users (username, email, password, first_name, last_name, birthDate, gender) VALUES 
    ('john_doe', 'john_doe@gmail.com', '$2a$10$hashed_password_placeholder', 'John', 'Doe', '1990-01-01', 'Male'),
    ('jane_smith', 'jane_smith@gmail.com', '$2a$10$hashed_password_placeholder', 'Jane', 'Smith', '1992-05-15', 'Female'),
    ('mike_johnson', 'mike_johnson@gmail.com', '$2a$10$hashed_password_placeholder', 'Mike', 'Johnson', '1988-12-10', 'Male'),
    ('emily_brown', 'emily_brown@gmail.com', '$2a$10$hashed_password_placeholder', 'Emily', 'Brown', '1995-08-20', 'Female'),
    ('chris_wilson', 'chris_wilson@gmail.com', '$2a$10$hashed_password_placeholder', 'Chris', 'Wilson', '1991-03-25', 'Male');
