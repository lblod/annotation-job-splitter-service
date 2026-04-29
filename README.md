# Annotation job splitter service

> [!Warning]
> This service is currently under construction

The annotation job splitter service offers functionality to split jobs into multiple tasks depending on the resource(s) serving as target for a job. This service operates on delta message it expects to receive when the status of a possibly relevant task changes.

## Data model
In order to be able to process tasks correctly, this service expects that the containing job adheres to a given data model. More specifically, a job has to to link to a SHACL node shape describing its input resources. This node shape either explicitly links to one or more resources, or specifies an RDF type of resources to query for. In the latter case a graph **must** also be specified in which to search for appropriate resources.

More specifically, this service can process tasks part of a job that satisfy either of the following structures. In the first snippet below, the linked node shape explicitly specifies two resources that are inputs for a job. Note, that the service does **not** check whether these resources exist, this is the responsibility of the service that will execute the actual task(s).

```ttl
@prefix cogs: <http://vocab.deri.ie/cogs#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix ext: <http://mu.semte.ch/vocabularies/ext/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix task: <http://redpencil.data.gift/vocabularies/tasks/> .

<task> a task:Task ;
  dcterms:isPartOf <job> .

<job> a cogs:Job ;
  ext:shapeForTargets <shape-with-target-nodes> .

<shape-with-target-nodes> a sh:NodeShape ;
  sh:targetNode <resource-1> ,
    <resource-2> .
```

In the second snippet below, the node shape linked to the job resource specifies an RDF resource type as its `sh:targetClass`. In this case the job itself must also specify a graph in which to look for such resources.

```ttl
@prefix cogs: <http://vocab.deri.ie/cogs#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix ext: <http://mu.semte.ch/vocabularies/ext/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix task: <http://redpencil.data.gift/vocabularies/tasks/> .

<task> a task:Task ;
  dcterms:isPartOf <job> .

<job> a cogs:Job ;
  ext:shapeForTargets <shape-with-target-class> ;
  ext:graphForTargets <graph-uri> .

<shape-with-target-class> a sh:NodeShape ;
  sh:targetClass <rdf-type> .
```

Note, the predicates `ext:shapeForTargets` and `ext:graphForTargets` used above to link a job to its target shape and graph respectively can be configured. See the [configuration](#configuration) section for more information.

## Getting started
### How to add the service to your application
First, add the service to your application's `docker-compose.yml`. Note that the `config` volume is only necessary if you require a different configuration than the [default one](./config/config.ts). See the [configuration section](#configuration) for more information in writing a configuration file.

```yaml
  annotation-job-splitter:
    image: lblod/annotation-job-splitter:x.y.z
    # Optional volume for custom configuration
    volumes:
      - ../config/annotation-job-splitter:/config
```

Second, configure your application's [delta notifier](https://github.com/mu-semtech/delta-notifier/blob/master/README.md#L87) to forward the appropriate delta messages to this service. The simplest configuration would be to forward a delta message each time an `adms:status` is set to the `scheduled` status used for tasks:

```js
// delta notifier configuration
export default [
  {
    match: {
      predicate: {
        type: "uri",
        value: "http://www.w3.org/ns/adms#status",
      },
      object: {
        type: "uri",
        value: "http://redpencil.data.gift/id/concept/JobStatus/scheduled",
      },
    },
    callback: {
      method: "POST",
      url: "http://annotation-job-splitter/delta",
    },
    options: {
      resourceFormat: "v0.0.1", // Make sure to use this format, v0.0.0-genesis is NOT suported
      gracePeriod: 1000,
      ignoreFromSelf: true,
      sendMatchesOnly: true,
    },
  },
];
```

## Configuration
This service is configured in two ways. First, a configuration file must be provided that specifies which types of job resources should be processed and how. Second, some environment variables can be configured. The following subsections document each of these in turn.

### Configuration file
The configuration specifies which types of jobs should be split into tasks by this service. This repository contains a default [configuration file](./config.config.ts) that can be overwritten to suite the application at hand. Note, this service's configuration is structured similarly to that of the [job-controller](https://github.com/lblod/job-controller-service) service.

The configuration should export a single object. It has to contain at least a mandatory `jobConfiguration` property. This property in turn contains properties specifying which combinations of jobs and tasks should be processed. Each contained property has as key a full URI of a job operation. Tasks that are not part of a job with either of these operations will be ignored. Furthermore, you can configure custom predicates linking jobs to their target shapes and graphs using `targetShapePredicate` and `targetGraphPredicate` respectively. This structure is illustrated in the following snippet:

```js
export default {
  jobConfiguration: {
    "http://lblod.data.gift/id/jobs/concept/JobOperation/some-job-operation": {
      ...
    },
    "http://lblod.data.gift/id/jobs/concept/JobOperation/another-job-operation": {
      ...
    },
  },
  // optional settings to overwrite the default values
  targetShapePredicate: "http://predicate-for-target-shape",
  targetGraphPredicate: "http://predicate-for-target-graph",
}
```

Each job configuration property has to specify one or more task configuration properties. Such a task configuration contains the task operations of relevant tasks and maps them to follow-up operation. As before the the operations must be specified as full URIs. For example, the following snippet configures one task configuration for a job. It essentially means that when the service receives a task that (1) is part of job with operation `"http://lblod.data.gift/id/jobs/concept/JobOperation/some-job-operation"`; and (2) has as task operation the value for `currentOperation`.
Then a follow-up task should be created with as task operation the value of `nextOperation`.

```js
"http://lblod.data.gift/id/jobs/concept/JobOperation/some-job-operation": {
  taskConfiguration: [
    {
      currentOperation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/operation-for-input-task",
      nextOpertation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/operation-for-created-tasks"
    },
  ...
  ]
},
```

Putting this all together might result in a configuration like the following.

```js
export default {
  jobConfiguration: {
    // This service is configured to process tasks for two kinds of jobs.
    "http://lblod.data.gift/id/jobs/concept/JobOperation/some-job-operation": {
      taskConfiguration: [
        // For this kind of job, support processing two kinds of tasks
        {
          currentOperation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/operation-for-input-task",
          nextOpertation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/operation-for-created-tasks"
        },
        {
          currentOperation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/another-task-operation",
          nextOpertation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/next-for-another-task"
        },
      ]
    },
    "http://lblod.data.gift/id/jobs/concept/JobOperation/another-job-operation": {
      taskConfiguration: [
        {
          currentOperation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/some-operation",
          nextOpertation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/another-operation"
        },
      ]
    },
  },
  // optional settings to overwrite the default values
  targetShapePredicate: "http://example.org/shape",
  targetGraphPredicate: "http://example.org/graph",
};

```

### Environment variables
| Name                  | Description                                                                | Default value                                   |
|-----------------------|----------------------------------------------------------------------------|-------------------------------------------------|
| JOB_GRAPH             | The graph in which the service will look for jobs and insert created tasks | "http://mu.semte.ch/graphs/harvesting"          |
| BATCH_SIZE            | The maximum number of triples inserted in a single query.                  | 100                                             |
| SLEEP_BETWEEN_BATCHES | The time, in milliseconds, to sleep in between inserting two batches       | 1000                                            |

## API
### GET /health
Returns `{ "status": "ok" }` if the service is running.

### POST /delta
Endpoint on which delta messages from the `delta-notifier` are received for processing. This service expects delta messages in [v0.0.1 ](https://github.com/mu-semtech/delta-notifier/blob/master/README.md#L87) format.

The service will respond with a `200` if it could successfully parse the received delta message and create the necessary tasks for the extracted jobs. This does **not** mean that all tasks have been created and inserted into the triplestore. Inserting a large amount of task resources takes some time, we opted not to keep the connection open the entire time.
