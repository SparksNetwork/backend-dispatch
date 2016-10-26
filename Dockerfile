FROM alpine:3.4

RUN apk add --update nodejs
RUN npm install -g yarn

RUN mkdir /app
WORKDIR /app

ADD package.json .
ADD yarn.lock .
RUN sh -c "yarn || cat yarn-error.log && false"
ADD . .
RUN node_modules/.bin/tsc

ENTRYPOINT ["npm", "run"]
CMD ["start"]
