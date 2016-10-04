# Dispatch

> Messages come in, messages go out

The dispatch program is designed to front all externally driven changes to the Sparks platform.

What is an externally driven change? A user who wants to do something. They (or more precisely our website) issues a command that arrives at the dispatcher. The dispatcher then:

* Validates the message using a schema from `sparks-schemas`
* Authorizes that the user is allowed to make this change
* Puts the message onto a message bus for services to take actions
* Returns a response that says yea or ney

At the return stage the user (well software) only knows that we accepted the message. Any actual changes happen further down.

## Moving parts:

* index.ts: In / validate / auth / dispatch / respond
* queue.ts: In, currently reads firebase queue for messages
* validate.ts: Validates the command in the message using `sparks-schemas`
* auth.ts: Auth, checks a whole bunch of shit
* dispatch.ts: Out, adds the message to kinesis

## Environment:

The following variables are required:

```
FIREBASE_DATABASE_URL: the database url
KINESIS_STREAM: name of kinesis stream
```

## Running

To run it you need a firebase and a firebase credentials.json file:

```
npm install
npm start
```

