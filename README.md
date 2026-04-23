# Annotation job splitter service

> [!Warning]
> This service is currently under construction

TODO: explain service

## Getting started
TODO

## Configuration
### Configuration file
The configuration specifies which types of jobs should be split into tasks by this service. This repository contains a default [configuration file](./config.config.ts) that can be overwritten to suite the application at hand.

The configuration should export a single object. This object has a property for each type of job the service should split. Note that the key of a job property should be a string containing the full URI for the RDF type of the job.

```js
export default {
  "http://mu.semte.ch/vocabularies/ext/some-job": {
    ...
  },
  "http://mu.semte.ch/vocabularies/ext/another-job": {
    ...
  },
  ...
}
```

Each job type property contains one or properties specifying per job operation which kind of tasks should be created. Similar to above, the key for each property has to be the full URI for the job operation at hand.

```js
"http://mu.semte.ch/vocabularies/ext/some-job": {
  "http://lblod.data.gift/id/jobs/concept/JobOperation/some-job-operation": {
    ...
  },
  "http://lblod.data.gift/id/jobs/concept/JobOperation/another-job-operation": {
    ...
  },
}
```

Finally, each operation property specifies a list of one or more task operations for which tasks should be created. Each task operation must be specified as its full URI.

```js
"http://lblod.data.gift/id/jobs/concept/JobOperation/some-job-operation": {
  taskOperations: [
    "http://lblod.data.gift/id/jobs/concept/TaskOperation/first-task-operation",
    "http://lblod.data.gift/id/jobs/concept/TaskOperation/second-task-operation",
  ],
},
```

Putting this all together might result in a configuration like the following.

```js
export default {
  // The service is configured to process two types of job resources. The first
  // one is specified here, the second one further below.
  "http://mu.semte.ch/vocabularies/ext/some-job": {
    // For this job resource type, process job resources with either of the
    // following two job operations.
    "http://lblod.data.gift/id/jobs/concept/JobOperation/some-job-operation": {
      // For each job instance of this type and with this operation: create two
      // task resources, one for each of the following task operations.
      taskOperations: [
        "http://lblod.data.gift/id/jobs/concept/TaskOperation/first-task-operation",
        "http://lblod.data.gift/id/jobs/concept/TaskOperation/second-task-operation",
      ],
    },
    // The second job operation for `some-job` job resources.
    "http://lblod.data.gift/id/jobs/concept/JobOperation/another-job-operation": {
      // For each job instance with the above operation: create a single task
      // for the operation below.
      taskOperations: [
        "http://lblod.data.gift/id/jobs/concept/TaskOperation/the-only-operation",
      ],
    },
  },
  // The second job resource type.
  "http://mu.semte.ch/vocabularies/ext/another-job": {
    // For this type of job resource, we are only interested in jobs that have
    // the following operation.
    "http://lblod.data.gift/id/jobs/concept/JobOperation/a-job-operation": {
      // Three tasks will be created for each processed job resource.
      taskOperations: [
        "http://lblod.data.gift/id/jobs/concept/TaskOperation/task-operation-one",
        "http://lblod.data.gift/id/jobs/concept/TaskOperation/task-operation-two",
        "http://lblod.data.gift/id/jobs/concept/TaskOperation/task-operation-three",
      ],
    },
  },
};

```

### Environment variables
| Name                  | Description                                                                | Default value                                   |
|-----------------------|----------------------------------------------------------------------------|-------------------------------------------------|
| JOB_GRAPH             | The graph in which the service will look for jobs and insert created tasks | "http://mu.semte.ch/graphs/harvesting"          |
| DATA_CONTAINER_BASE   | The base URI to use for newly created input container resources.           | "http://redpencil.data.gift/id/dataContainers/" |
| BATCH_SIZE            | The maximum number of triples inserted in a single query.                  | 100                                             |
| SLEEP_BETWEEN_BATCHES | The time, in milliseconds, to sleep in between inserting two batches       | 1000                                            |

## API
### GET /health
Returns `{ "status": "ok" }` if the service is running.

### POST /delta
Endpoint on which delta messages from the `delta-notifier` are received for processing. This service expects delta messages in [v0.0.1 ](https://github.com/mu-semtech/delta-notifier/blob/master/README.md#L87) format.

The service will respond with a `200` if it could successfully parse the received delta message and create the necessary tasks for the extracted jobs. This does **not** mean that all tasks have been created and inserted into the triplestore. Inserting a large amount of task resources takes some time, we opted not to keep the connection open the entire time.
