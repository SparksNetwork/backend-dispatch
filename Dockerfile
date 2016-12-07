FROM alpine:3.4

RUN apk add --update nodejs git python g++ make
RUN npm install -g yarn@0.18.0

RUN mkdir /app
WORKDIR /app

ADD package.json yarn.lock ./
RUN yarn
ADD . .
RUN node_modules/.bin/tsc

ENTRYPOINT ["npm", "run"]
CMD ["start"]
