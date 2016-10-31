FROM alpine:3.4

RUN apk add --update nodejs git

RUN mkdir /app
WORKDIR /app

ADD package.json .
RUN apk add python g++ make && npm install && apk del python g++ make
ADD . .
RUN node_modules/.bin/tsc

ENTRYPOINT ["npm", "run"]
CMD ["start"]
