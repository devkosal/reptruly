# Build frontend
FROM node:20-slim AS frontend-build
WORKDIR /app
COPY ./frontend/package*.json ./
RUN npm install
COPY ./frontend ./
RUN npm run build

# Nginx
FROM nginx:1.25

RUN rm /etc/nginx/conf.d/default.conf
COPY ./backend/compose/production/nginx/nginx.conf /etc/nginx/conf.d
COPY --from=frontend-build /app/dist /usr/share/nginx/html
