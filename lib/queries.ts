// NOTE (18/04/2026): Using sudo queries as we need to be able to read from
// specific graphs, e.g. to retrieve the correct resources.  It is currently not
// advised to mix sudo-queries and scopes.
import { querySudo as query, updateSudo as update } from "@lblod/mu-auth-sudo";
import { sparqlEscapeDateTime, sparqlEscapeString, sparqlEscapeUri } from "mu";
import { InputContainer, Job, Shape, Task } from "../types";
import {
  JOB_GRAPH,
  SLEEP_BETWEEN_BATCHES,
  STATUS,
  TARGET_GRAPH_PREDICATE,
  TARGET_SHAPE_PREDICATE,
  TASKS_PER_BATCH,
} from "../util/constants";

// Adapted from the Job controller service
function parseResult(result) {
  if (!(result.results && result.results.bindings.length)) return [];

  const bindingKeys = result.head.vars;
  return result.results.bindings.map((row) => {
    const obj = {};
    bindingKeys.forEach((key) => {
      if (
        row[key] &&
        row[key].datatype == "http://www.w3.org/2001/XMLSchema#integer" &&
        row[key].value
      ) {
        obj[key] = parseInt(row[key].value);
      } else if (
        row[key] &&
        row[key].datatype == "http://www.w3.org/2001/XMLSchema#dateTime" &&
        row[key].value
      ) {
        obj[key] = new Date(row[key].value);
      } else {
        obj[key] = row[key] ? row[key].value : undefined;
      }
    });
    return obj;
  });
}

export async function retrieveTaskData(uri: string) {
  const task =
    await query(`PREFIX task: <http://redpencil.data.gift/vocabularies/tasks/>
      PREFIX dcterms: <http://purl.org/dc/terms/>
      SELECT DISTINCT ?task ?index ?job ?operation
      WHERE {
        VALUES ?task {
          ${sparqlEscapeUri(uri)}
        }
        ?task a task:Task ;
              task:index ?index ;
              dcterms:isPartOf ?job ;
              task:operation ?operation .
    }`);

  const taskData = parseResult(task)[0];
  if (taskData) {
    const job = await retrieveJob(taskData.job);
    if (job) {
      return {
        uri: uri,
        index: parseInt(taskData.index),
        parentJob: job,
        operation: taskData.operation,
      } as Task;
    } else {
      console.info(
        `\n>> INFO: ignoring task ${uri} as it is not linked to a job`,
      );
    }
  } else {
    console.info(
      `\n>> INFO: ignoring ${uri} as it is not a suitable task resource`,
    );
  }
}

async function retrieveJob(uri: string) {
  const job = await query(`PREFIX cogs: <http://vocab.deri.ie/cogs#>
    PREFIX task: <http://redpencil.data.gift/vocabularies/tasks/>
    SELECT DISTINCT ?job ?operation ?targetShape ?targetGraph
    WHERE {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        VALUES ?job {
          ${sparqlEscapeUri(uri)}
        }
        ?job a cogs:Job ;
             task:operation ?operation .
        OPTIONAL {
          ?job ${sparqlEscapeUri(TARGET_SHAPE_PREDICATE)} ?targetShape .
        }
        OPTIONAL {
          ?job ${sparqlEscapeUri(TARGET_GRAPH_PREDICATE)} ?targetGraph .
        }
      }
    }`);

  const jobData = parseResult(job)[0];
  const shape = jobData.targetShape
    ? await retrieveTargetShape(jobData.targetShape)
    : undefined;

  if (shape) {
    return {
      uri: uri,
      operation: jobData.operation,
      targetShape: shape,
      targetGraph: jobData.targetGraph,
    } as Job;
  } else {
    console.info(
      `\n>> INFO: ignoring job ${uri} as there is no linked node shape`,
    );
  }
}

export async function retrieveTargetShape(uri: string) {
  const shape = await query(`PREFIX sh: <http://www.w3.org/ns/shacl#>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

    SELECT DISTINCT ?shape ?class ?node
    WHERE {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        VALUES ?shape {
          ${sparqlEscapeUri(uri)}
        }
        ?shape a sh:NodeShape .

        OPTIONAL {
          ?shape sh:targetClass ?class .
        }

        OPTIONAL {
          ?shape sh:targetNode ?node .
        }
      }
    }`);

  if (shape.results.bindings && shape.results.bindings.length) {
    const { classes, nodes } = shape.results.bindings.reduce(
      (acc, binding) => {
        if (binding.class?.value) acc.classes.push(binding.class?.value);
        if (binding.node?.value) acc.nodes.push(binding.node?.value);
        return acc;
      },
      { classes: [], nodes: [] },
    );

    return {
      uri: shape.results.bindings[0].shape?.value,
      // NOTE (17/04/2026): Currently only a single target class can be specified
      // in the frontend.  To simplify the service's initial implementation we do
      // not support multiple target classes yet.
      targetClass: classes ? classes[0] : undefined,
      targetNodes: nodes,
    } as Shape;
  }
}

export async function retrieveResourcesFromGraph(type: string, graph: string) {
  const resourceUris = await query(`
    SELECT DISTINCT ?resource
    WHERE {
      GRAPH ${sparqlEscapeUri(graph)} {
        ?resource a ${sparqlEscapeUri(type)} .
      }
    }`);

  return resourceUris.results.bindings.map((binding) => binding.resource.value);
}

export async function batchedInsertTasks(inputTask, outputTasks) {
  for (let i = 0; i < outputTasks.length; i += TASKS_PER_BATCH) {
    const tasksBatch = outputTasks.slice(i, i + TASKS_PER_BATCH);
    console.info(
      `\n>> INFO: Inserting tasks ${i} to ${i + tasksBatch.length - 1} out of ${outputTasks.length} for input task ${inputTask.uri}`,
    );
    await insertTasks(...tasksBatch);

    if (i + TASKS_PER_BATCH < outputTasks.length) await sleep();
  }

  // Update the status of the input tasks as all output tasks are inserted
  await updateTaskStatus(inputTask, STATUS.SUCCESS);
  console.info(`\n>> INFO: Completed task ${inputTask.uri}`);
}

function taskToTriples(task: Task) {
  const now = sparqlEscapeDateTime(new Date());

  const triples = `${sparqlEscapeUri(task.uri)} a task:Task ;
    mu:uuid ${sparqlEscapeString(task.id)} ;
    dcterms:isPartOf ${sparqlEscapeUri(task.parentJob.uri)} ;
    task:operation ${sparqlEscapeUri(task.operation)} ;
    dcterms:created ${now} ;
    dcterms:modified ${now} ;
    adms:status ${sparqlEscapeUri(STATUS.SCHEDULED)} ;
    task:index ${sparqlEscapeString(task.index.toString())} ;
    task:inputContainer ${sparqlEscapeUri(task.target.uri)} .

    ${inputContainerToTriples(task.target)}
  `;

  return triples;
}

function inputContainerToTriples(container: InputContainer) {
  return `${sparqlEscapeUri(container.uri)} a nfo:DataContainer ;
    mu:uuid ${sparqlEscapeString(container.id)} ;
    task:hasResource ${sparqlEscapeUri(container.resource)} .`;
}

async function insertTasks(...tasks: Task[]) {
  const triplesToInsert = tasks.map((task) => taskToTriples(task)).join("\n");

  const insert = `PREFIX task: <http://redpencil.data.gift/vocabularies/tasks/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
    PREFIX adms: <http://www.w3.org/ns/adms#>
    INSERT DATA {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        ${triplesToInsert}
      }
    }`;

  try {
    await update(insert);
  } catch (e) {
    throw new Error(`${e.message}\n\nQuery that caused error:\n${insert}`);
  }
}

async function sleep() {
  if (SLEEP_BETWEEN_BATCHES > 0) {
    console.info(`>> INFO: Sleeping for ${SLEEP_BETWEEN_BATCHES} ms.`);
    return new Promise((resolve) => setTimeout(resolve, SLEEP_BETWEEN_BATCHES));
  }
}

export async function updateTaskStatus(task: Task, newStatus: string) {
  const now = sparqlEscapeDateTime(new Date());
  const insert = `PREFIX adms: <http://www.w3.org/ns/adms#>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    DELETE {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        ?task adms:status ?status ;
              dcterms:modified ?modified .
      }
    }
    INSERT {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        ?task adms:status ${sparqlEscapeUri(newStatus)} ;
              dcterms:modified ${now} .
      }
    }
    WHERE {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        VALUES ?task {
          ${sparqlEscapeUri(task.uri)}
        }
        ?task adms:status ?status .
        OPTIONAL { ?task dcterms:modified ?modified . }
      }
    }`;
  try {
    await update(insert);
  } catch (e) {
    throw new Error(`${e.message}\n\nQuery that caused error:\n${insert}`);
  }
}
