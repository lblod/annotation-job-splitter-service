# Task splitter service

> [!Warning]
> This service is currently under construction

The task splitter service offers functionality to split a task into multiple tasks depending on the resource(s) serving as target. This service operates on delta message it expects to receive when the status of a possibly relevant task changes.

## Data model
In order to be able to process tasks correctly, this service expects that the contents of a task's input container adheres to a given data model. More specifically, a the input container has to link to a SHACL node shape describing its input resources. This node shape either explicitly links to one or more resources, or specifies an RDF type of resources to query for. In the latter case a graph **must** also be specified in which to search for appropriate resources.

More specifically, this service can process tasks whose input container satisfy either of the following structures. In the first snippet below, the linked node shape explicitly specifies two resources that are inputs for a task. Note, that the service does **not** check whether these resources exist, this is the responsibility of the service that will execute the actual task(s).

```ttl
@prefix ext: <http://mu.semte.ch/vocabularies/ext/> .
@prefix nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix task: <http://redpencil.data.gift/vocabularies/tasks/> .


<task> a task:Task ;
  task:inputContainer <input-container> .

<input-container> a nfo:DataContainer ;
  task:hasResource <shape-with-target-nodes> .

<shape-with-target-nodes> a sh:NodeShape ;
  sh:targetNode <resource-1> ,
    <resource-2> .
```

In the second snippet below, the node shape linked to the task's target shape specifies an RDF resource type as its `sh:targetClass`. In this case the input container must also specify a graph in which to look for such resources.

```ttl
@prefix ext: <http://mu.semte.ch/vocabularies/ext/> .
@prefix nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix task: <http://redpencil.data.gift/vocabularies/tasks/> .

<task> a task:Task ;
  task:inputContainer <input-container> .

<input-container> a nfo:DataContainer ;
  task:hasResource <shape-with-target-nodes> ;
  task:hasGraph <graph-uri> .

<shape-with-target-class> a sh:NodeShape ;
  sh:targetClass <rdf-type> .
```

## Getting started
### How to add the service to your application
First, add the service to your application's `docker-compose.yml`. Note that the `config` volume is only necessary if you require a different configuration than the [default one](./config/config.ts). See the [configuration section](#configuration) for more information in writing a configuration file.

```yaml
  task-splitter:
    image: lblod/task-splitter-service:x.y.z
    # Optional volume for custom configuration
    volumes:
      - ../config/task-splitter:/config
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
      url: "http://task-splitter/delta",
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
This service is configured in two ways. First, a configuration file must be provided that specifies which types of task resources should be processed and how. Second, some environment variables can be configured. The following subsections document each of these in turn.

### Configuration file
The configuration specifies which tasks should be split into tasks by this service. This repository contains a default [configuration file](./config.config.ts) that can be overwritten to suite the application at hand. Note, this service's configuration reuses the `taskConfiguration` as used in the [job-controller](https://github.com/lblod/job-controller-service) service.

The configuration should export a list of `TaskConfiguration` objects.  Each task configuration should contain at least a `currentOperation` and `nextOperation` property. The `currentOperation` specifies the task operation for tasks that need to be handled by this service.  The `nextOperation` is used as task operation for follow-up tasks created by this service. The configuration file structure is illustrated in the following snippet:

```js
export default [
  {
    currentOperation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/some-task-operation",
    nextOperation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/another-task-operation",
  },
  ...
];
```

Optionally, and only for tasks that have a `sh:targetClass` in their target shape, a task configuration can add two additional filters for limiting the reach of scheduled tasks, so only a limited amount of tasks are spawned at a time. `resourceLimit` sets a limit to the number of resources of the defined class that are considered, while `resourceFilter` allows defining a SPARQL snippet that the resources must comply before this service creates a task for them. In the example below, the resources should have been modified after a certain date.

```js
export default [
  {
    currentOperation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/some-class-task-operation",
    nextOperation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/another-class-task-operation",
    // optional: limit the number of considered resources for tasks whose
    // target shape specify a sh:targetClass
    resourceLimit: 100,
    resourceFilter: `?resource <http://purl.org/dc/terms/modified> ?modified.
      FILTER(?modified > "2026-06-23"^^xsd:date)`
  },
  ...
];
```

The resource filter has access to the `?resource` and `?task` SPARQL variables, where `?task` is the URI of the current task. `?resource` is a resource that matches the `targetClass`, which the task is being split on.

By default, tasks created by this service are linked to an input container that links to the resource that the task should operate on. If instead the created task requires its input container to contain a harvesting collection, the `harvestingCollection` property should be set to true. In this case the URIs defined by the target shape will be used as URL's for the collection's remote data object. Note, this is intended to be used for jobs that have one or more `sh:targetNode`s in its target shape. Combining this with jobs that have a `sh:targetClass` may result in unexpected behaviour in subsequent tasks as the  resource URIs the service found will be set as remote data object URLs.

For example, the following snippet shows a task configuration for which the tasks created for `nextOperation` will be linked to an input container that contains a harvesting collection resource.

```js
export default [
  {
    currentOperation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/yet-another-task-operation",
    nextOperation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/a-harvest-task-operation",
    // optional: ensure input container of created tasks link to a harvesting
    // collection resource
    harvestingCollection: true,
  },
  ...
];
```

Putting this all together might result in a configuration like the following.

```js
export default [
  {
    currentOperation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/some-task-operation",
    nextOperation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/another-task-operation",
  },
  {
    currentOperation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/some-class-task-operation",
    nextOperation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/another-class-task-operation",
    // optional: limit the number of considered resources for tasks whose
    // target shape specify a sh:targetClass
    resourceLimit: 100,
    resourceFilter: `?resource <http://purl.org/dc/terms/modified> ?modified.
      FILTER(?modified > "2026-06-23"^^xsd:date)`
  },
  {
    currentOperation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/yet-another-task-operation",
    nextOperation: "http://lblod.data.gift/id/jobs/concept/TaskOperation/a-harvesting-task-operation",
    // optional: ensure input container of created tasks link to a harvesting
    // collection resource
    harvestingCollection: true,
  },
];
```

### Environment variables
| Name                  | Description                                                                              | Default value                          |
|-----------------------|------------------------------------------------------------------------------------------|----------------------------------------|
| JOB_GRAPH             | The graph in which the service will look for jobs and insert created tasks               | "http://mu.semte.ch/graphs/harvesting" |
| SLEEP_BETWEEN_TASKS   | The time, in milliseconds, to sleep in between inserting two tasks                       | 1000                                   |
| MISSED_DELTA_CRON     | Frequency with which to check for any missed delta messages, i.e. missed scheduled tasks | "27 */5 * * *"                         |

## API
### GET /health
Returns `{ "status": "ok" }` if the service is running.

### POST /delta
Endpoint on which delta messages from the `delta-notifier` are received for processing. This service expects delta messages in [v0.0.1 ](https://github.com/mu-semtech/delta-notifier/blob/master/README.md#L87) format. When receiving a delta message, the service will query the triplestore to check for any relevant open tasks. The delta message itself is only used as a trigger, its contents are not actually used.

The service will respond with a `200` if it successfully received the delta and **initiated** the process to look for open tasks. This does **not** mean that it necessarily will create new tasks, there may not be any relevant open tasks. Similarly, if there are relevant open tasks, the reply does **not** mean that all new task resources have been inserted into the triplestore. Inserting a large amount of task resources takes some time, we opted not to keep the connection open the entire time. The status of the input tasks will be updated to `success` once all new tasks have been inserted.

## Caveats
- This service expects the jobs and tasks to be stored in single graph.
- This service expects tasks to have exactly one input container with a valid target shape. It a task has multiple input containers with a valid target shape, the behaviour will be unpredictable and depend on which the order of the results returns by the triplestore.
- Any additional input containers linked to an incoming task that do not contain a target shape will be linked to each created task. The service that processes the created tasks is responsible properly handle that multiple tasks have the same input containers.
