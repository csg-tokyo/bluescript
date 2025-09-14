FROM node:20

WORKDIR /notebook

COPY ./notebook/ .

RUN npm install

EXPOSE 3000
