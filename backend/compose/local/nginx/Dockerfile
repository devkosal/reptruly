FROM nginx:1.25

RUN rm /etc/nginx/conf.d/default.conf
COPY ./backend/compose/local/nginx/nginx.conf /etc/nginx/conf.d
