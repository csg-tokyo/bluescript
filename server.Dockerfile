FROM espressif/idf:release-v5.0

RUN (curl -sL https://deb.nodesource.com/setup_22.x | bash -) &&  apt-get install nodejs -y

COPY ./server /bluescript/server

WORKDIR /bluescript/server

RUN npm install

RUN mkdir -p temp-files

EXPOSE 8080
