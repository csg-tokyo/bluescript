FROM espressif/idf:release-v5.0

RUN (curl -sL https://deb.nodesource.com/setup_20.x | bash -) &&  apt-get install nodejs -y

RUN apt-get update && apt-get install -y \
    build-essential \
    libbluetooth-dev \
    libudev-dev \
    && rm -rf /var/lib/apt/lists/*

COPY ./server /bluescript/server

WORKDIR /bluescript/server

RUN npm install

RUN mkdir -p temp-files

EXPOSE 8080
