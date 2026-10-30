FROM nginx:latest
EXPOSE 80
COPY ./docker/config/web-server.conf /etc/nginx/conf.d/default.conf   