# Annotation job splitter service

> [!Warning]
> This service is currently under construction

The annotation job splitter service offers functionality to split jobs into multiple tasks depending on the resource(s) serving as target for a job. This service operates on delta message it receives when appropriate job resources are created.

This service expects that the processed jobs specify the (kind of) input resources they concern as a SHACL node. This node either explicitly links to one or more resources, or specifies a type of resource. In the latter case a graph must be specified in which to search for appropriate resources.

More specifically, this service can process graphs that satisfy either of the following structures. In either case, the custom `ext:shapeForTargets` predicate is used to link a job resources to its node shape. In the first snippet, the linked node shape explicitly specifies two resources that are inputs for this job. Note, that the service does **not** check whether these resources exist, this is the responsibility of the service that will execute the actual task(s).

```ttl
@prefix ext: <http://mu.semte.ch/vocabularies/ext/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .

<job> a ext:some-job ;
  ext:shapeForTargets <shape-with-target-nodes> .

<shape-with-target-nodes> a sh:NodeShape ;
  sh:targetNode <resource-1> ,
    <resource-2> .
```

In the second snippet below, the node shape link to the job resource specifies an RDF resource type as its `sh:targetClass`. In this case the job itself must also specify a graph in which to look for such resources using the `ext:graphForTargets` predicate.

```ttl
@prefix ext: <http://mu.semte.ch/vocabularies/ext/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .

<job> a ext:some-job ;
  ext:shapeForTargets <shape-with-target-class> ;
  ext:graphForTargets <graph-uri> .

<shape-with-target-class> a sh:NodeShape ;
  sh:targetClass <rdf-type> .
```

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

Second, configure your application's [delta notifier](https://github.com/mu-semtech/delta-notifier/blob/master/README.md#L87) in to forward the appropriate delta messages to this service. For example, the following delta notifier configuration would send deltas involving resources of type `ext:AnnotationJob` to this service. If you use a custom configuration file, make sure to define such a rule for each job resources type you define.

```js
// delta notifier configuration
export default [
  {
    match: {
      predicate: {
        type: "uri",
        value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      },
      object: {
        type: "uri",
        value: "http://mu.semte.ch/vocabularies/ext/AnnotationJob",
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
The configuration specifies which types of jobs should be split into tasks by this service. This repository contains a default [configuration file](./config.config.ts) that can be overwritten to suite the application at hand.

The configuration should export a single object. Providing a value for the `jobs` property is mandatory. This property specifies which types of job resources the service should split into tasks. For each job resource type it should specify a property with the type's full URI as key. Furthermore, you must also specify `defaultTargetShapePredicate` and `defaultTargetGraphPredicate` properties. These specify the predicates that are used to link jobs to their target shape and graph respectively.

```js
export default {
  jobs: {
    "http://mu.semte.ch/vocabularies/ext/some-job": {
      ...
    },
    "http://mu.semte.ch/vocabularies/ext/another-job": {
      ...
    },
  },
  defaultTargetShapePredicate: "http://predicate-for-target-shape",
  defaultTargetGraphPredicate: "http://predicate-for-target-graph",
}
```

Each job type property contains one or more properties specifying per job operation which kind of tasks should be created. The key for each operation property has to be the full URI for the job operation at hand. Optionally, you can also specify `targetShapePredicate` and `targetGraphPredicate`. These properties specify which predicates are used for this job type for, respectively, the target shape and target graph. If specified these overwrite the `defaultTargetShapePredicate` and `defaultTargetGraphPredicate` for this job type.

```js
"http://mu.semte.ch/vocabularies/ext/some-job": {
  "http://lblod.data.gift/id/jobs/concept/JobOperation/some-job-operation": {
    ...
  },
  "http://lblod.data.gift/id/jobs/concept/JobOperation/another-job-operation": {
    ...
  },
  // Optional settings
  targetShapePredicate: "http://predicate-for-target-shape",
  targetGraphPredicate: "http://predicate-for-target-graph",
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
  jobs: {
    // The service is configured to process two types of job resources. The
    // first one is specified here, the second one further below.
    "http://mu.semte.ch/vocabularies/ext/some-job": {
      // For this job resource type, process job resources with either of the
      // following two job operations.
      "http://lblod.data.gift/id/jobs/concept/JobOperation/some-job-operation": {
        // For each job instance of this type and with this operation: create
        // two task resources, one for each of the following task operations.
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
      // Configure type-specific target predicates
      targetShapePredicate: "http://mu.semte.ch/vocabularies/ext/shapeForTargets",
      targetGraphPredicate: "http://mu.semte.ch/vocabularies/ext/graphForTargets",
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
  },
  // Configure application-specific target predicates
  defaultTargetShapePredicate: "http://example.org/target-shape",
  defaultTargetGraphPredicate: "http://example.org/target-graph",
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
