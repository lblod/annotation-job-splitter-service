// NOTE (18/04/2026): Using sudo queries as we need to be able to read from
// specific graphs, e.g. to retrieve the correct resources.  It is currently not
// advised to mix sudo-queries and scopes.
import { querySudo as query, updateSudo as update } from "@lblod/mu-auth-sudo";
import { sparqlEscapeDateTime, sparqlEscapeString, sparqlEscapeUri } from "mu";
import { InputContainer, Shape, Task } from "../types";
import {
  BATCH_SIZE,
  JOB_GRAPH,
  SLEEP_BETWEEN_BATCHES,
  STATUS,
} from "../util/constants";

export async function retrieveTargetShape(
  jobUri: string,
  shapePredicate: string,
) {
  const shape = await query(`PREFIX sh: <http://www.w3.org/ns/shacl#>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

    SELECT DISTINCT ?shape ?class ?node
    WHERE {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        ${sparqlEscapeUri(jobUri)} ${sparqlEscapeUri(shapePredicate)} ?shape .

        OPTIONAL {
          ?shape sh:targetClass ?class .
        }

        OPTIONAL {
          ?shape sh:targetNode ?node .
        }
      }
    }`);

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

export async function batchedInsertTasks(...tasks: Task[]) {
  // NOTE (20/04/2026): For consistency with other services we opted to use
  // `BATCH_SIZE` as environment variable to specify the maximum number of
  // triples to insert at once.  Per task 9 triples (5 triples if the task has
  // no target) will be inserted.  The following uses this to split the received
  // tasks into smaller batches thereby ensuring each task is fully contained
  // within a single batch so we do not insert incomplete tasks.
  const tasksPerBatch = Math.ceil(BATCH_SIZE / 10);
  for (let i = 0; i < tasks.length; i += tasksPerBatch) {
    const tasksBatch = tasks.slice(i, i + tasksPerBatch);
    console.info(
      `>> INFO: Inserting tasks ${i} to ${i + tasksBatch.length - 1} out of ${tasks.length}`,
    );
    await insertTasks(...tasksBatch);

    if (i + tasksPerBatch < tasks.length) await sleep();
  }
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
