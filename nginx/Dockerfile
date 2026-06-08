FROM nginx:alpine

WORKDIR /etc/nginx/conf.d
COPY conf/default.conf .

WORKDIR /var/www/error
RUN rm -rf ./*
COPY conf/error/ .

WORKDIR /usr/share/nginx/html
RUN rm -rf ./*
COPY frontend/ .
