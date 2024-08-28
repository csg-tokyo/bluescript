FROM node:22.1.0-alpine

WORKDIR /notebook

COPY ./notebook/ .

RUN npm install

EXPOSE 3000
