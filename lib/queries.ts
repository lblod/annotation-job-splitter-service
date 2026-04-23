// NOTE (18/04/2026): Using sudo queries as we need to be able to read from
// specific graphs, e.g. to retrieve the correct resources.  It is currently not
// advised to mix sudo-queries and scopes.
import { querySudo as query, updateSudo as update } from "@lblod/mu-auth-sudo";
import {
  sparqlEscapeDateTime,
  sparqlEscapeString,
  sparqlEscapeUri,
  uuid,
} from "mu";
import { Shape, Task } from "../types";

const JOB_GRAPH =
  process.env.JOB_GRAPH || "http://mu.semte.ch/graphs/harvesting";

// NOTE (18/04/2026): This is the base that is also used in the resources
// configuration.  The job/task data model ion gitbook uses
// `.../data-container/` instead.
const DATA_CONTAINER_URI_BASE =
  process.env.DATA_CONTAINER_BASE ||
  "http://redpencil.data.gift/id/dataContainers/";

const STATUS = {
  PREPARING: "http://redpencil.data.gift/id/concept/JobStatus/preparing",
  BUSY: "http://redpencil.data.gift/id/concept/JobStatus/busy",
  SCHEDULED: "http://redpencil.data.gift/id/concept/JobStatus/scheduled",
  SUCCESS: "http://redpencil.data.gift/id/concept/JobStatus/success",
  FAILED: "http://redpencil.data.gift/id/concept/JobStatus/failed",
};

export async function retrieveTargetShape(jobUri: string) {
  const shape = await query(`PREFIX sh: <http://www.w3.org/ns/shacl#>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

    SELECT DISTINCT ?shape ?class ?node
    WHERE {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        ${sparqlEscapeUri(jobUri)} ext:shapeForTargets ?shape .

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
    // NOTE (17/04/2026): Currently only a single target class can be defined in
    // the frontend.
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

function taskToTriples(task: Task) {
  const now = sparqlEscapeDateTime(new Date());

  let triples = `${sparqlEscapeUri(task.uri)} a task:Task ;
    mu:uuid ${sparqlEscapeString(task.id)} ;
    dcterms:isPartOf ${sparqlEscapeUri(task.parentJob.uri)} ;
    task:operation ${sparqlEscapeUri(task.operation)} ;
    dcterms:created ${now} ;
    dcterms:modified ${now} ;
    adms:status ${sparqlEscapeUri(STATUS.SCHEDULED)} .`;

  if (task.target) {
    const icId = uuid();
    const icUri = DATA_CONTAINER_URI_BASE + icId;
    triples += `
      ${sparqlEscapeUri(task.uri)} task:inputContainer ${sparqlEscapeUri(icUri)} .
      ${sparqlEscapeUri(icUri)} a nfo:DataContainer ;
        mu:uuid ${sparqlEscapeString(icId)} ;
        task:hasResource ${sparqlEscapeUri(task.target)} .`;
  }

  return triples;
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
