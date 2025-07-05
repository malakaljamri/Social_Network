FROM nginx:alpine

# Copy your frontend HTML/CSS/JS
COPY . /usr/share/nginx/html

# Overwrite the default nginx config with your own (for proxying API requests)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
