# Annotation job splitter service

> [!Warning]
> This service is currently under construction

TODO: explain service

## Getting started
TODO

## Configuration
TODO

## API
### GET /health
Returns `{ "status": "ok" }` if the service is running.

### POST /delta
Endpoint on which delta messages from the `delta-notifier` are received for processing. This service expects delta messages in [v0.0.1 ](https://github.com/mu-semtech/delta-notifier/blob/master/README.md#L87) format.

The service will respond with a `200` if it could successfully parse the received delta message.
