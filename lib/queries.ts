// NOTE (18/04/2026): Using sudo queries as we need to be able to read from
// specific graphs, e.g. to retrieve the correct resources.  It is currently not
// advised to mix sudo-queries and scopes.
import {
  querySudo as query,
  SPARQLQueryResult,
  updateSudo as update,
} from "@lblod/mu-auth-sudo";
import {
  sparqlEscapeDateTime,
  sparqlEscapeString,
  sparqlEscapeUri,
  uuid,
} from "mu";
import { InputContainer, Shape, Task, TaskConfiguration } from "../types";
import { getTaskOperations } from "../util/config";
import {
  DEFAULT_BASE_URI,
  JOB_GRAPH,
  SLEEP_BETWEEN_TASKS,
  STATUS,
} from "../util/constants";

// Adapted from the Job controller service
function parseResult<T extends string[]>(result: SPARQLQueryResult<T>) {
  if (!(result.results && result.results.bindings.length)) return [];

  const bindingKeys = result.head.vars as T[number][];
  const bindings = result.results.bindings as unknown as Array<{
    [Key in T[number]]: {
      datatype: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value: any;
    };
  }>;
  return bindings.map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = {} as { [Key in T[number]]: any };
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
  // NOTE (28/09/2026): The UNION clause in this query already checks whether a
  // valid shape is linked in the input container of the task.  This avoids we
  // create tasks that will be thrown away in a later step anyway.
  const data =
    await query(`PREFIX task: <http://redpencil.data.gift/vocabularies/tasks/>
      PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX sh: <http://www.w3.org/ns/shacl#>
      PREFIX cogs: <http://vocab.deri.ie/cogs#>
      SELECT DISTINCT ?task ?index ?operation ?inputContainer ?targetShape ?targetGraph ?job ?jobOperation
      WHERE {
        VALUES ?task {
          ${sparqlEscapeUri(uri)}
        }
        ?task a task:Task ;
              task:index ?index ;
              dcterms:isPartOf ?job ;
              task:operation ?operation ;
              task:inputContainer ?inputContainer .

        ?inputContainer task:hasResource ?targetShape .

        ?targetShape a sh:NodeShape .
        {
          ?targetShape sh:targetNode ?target .
        } UNION {
          ?targetShape sh:targetClass ?class .
          ?inputContainer task:hasGraph ?targetGraph .
        }
      }`);

  const parsedData = parseResult(data!)[0];

  if (parsedData) {
    const inputContainer = parsedData?.inputContainer
      ? ({
          uri: parsedData.inputContainer,
          resource: parsedData.targetShape,
          targetGraph: parsedData.targetGraph,
        } as InputContainer)
      : undefined;

    const task = {
      uri: uri,
      index: parseInt(parsedData.index),
      parentJob: parsedData.job,
      operation: parsedData.operation,
      input: inputContainer,
    } as Task;

    return task;
  }
}

export async function retrieveTargetShape(uri: string) {
  const shapeData = await query(`PREFIX sh: <http://www.w3.org/ns/shacl#>
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

  if (shapeData?.results?.bindings?.length) {
    const { classes, nodes } = shapeData.results.bindings.reduce(
      (acc, binding) => {
        if (binding.class?.value) acc.classes.push(binding.class?.value);
        if (binding.node?.value) acc.nodes.push(binding.node?.value);
        return acc;
      },
      { classes: [] as string[], nodes: [] as string[] },
    );

    const shape = {
      uri: shapeData.results.bindings[0].shape?.value,
      // NOTE (17/04/2026): Currently only a single target class can be specified
      // in the frontend.  To simplify the service's initial implementation we do
      // not support multiple target classes yet.
      targetClass: classes ? classes[0] : undefined,
      targetNodes: nodes,
    } as Shape;

    if (shape.targetClass || shape.targetNodes?.length > 0) {
      return shape;
    }
  }
}

export async function retrieveResourcesFromGraph(
  type: string,
  graph: string,
  taskConfiguration: TaskConfiguration,
  taskUri: string,
) {
  const resourceFilter = taskConfiguration.resourceFilter || "";
  const resourceLimit = taskConfiguration.resourceLimit || 0;
  const limiter = resourceLimit > 0 ? `LIMIT ${resourceLimit}` : "";
  const resourceUris = await query(`
    SELECT DISTINCT ?resource
    WHERE {
      VALUES ?task {
        ${sparqlEscapeUri(taskUri)}
      }
      GRAPH ${sparqlEscapeUri(graph)} {
        ?resource a ${sparqlEscapeUri(type)} .
      }
      ${resourceFilter}
    } ${limiter}`);

  return (
    resourceUris?.results?.bindings.map((binding) => binding.resource.value) ||
    []
  );
}

async function insertTask(task: Task) {
  const now = sparqlEscapeDateTime(new Date());
  const insert = `PREFIX task: <http://redpencil.data.gift/vocabularies/tasks/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
    PREFIX adms: <http://www.w3.org/ns/adms#>
    PREFIX cogs: <http://vocab.deri.ie/cogs#>
    PREFIX hrvst: <http://lblod.data.gift/vocabularies/harvesting/>
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
    INSERT DATA {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        ${sparqlEscapeUri(task.uri)} a task:Task ;
                                     mu:uuid ${sparqlEscapeString(task.id)} ;
                                     dcterms:isPartOf ${sparqlEscapeUri(task.parentJob)} ;
                                     task:operation ${sparqlEscapeUri(task.operation)} ;
                                     dcterms:created ${now} ;
                                     dcterms:modified ${now} ;
                                     adms:status ${sparqlEscapeUri(STATUS.PREPARING)} ;
                                     cogs:dependsOn ${sparqlEscapeUri(task.dependsOn)} ;
                                     task:index ${sparqlEscapeString(task.index.toString())} ;
                                     task:inputContainer ${sparqlEscapeUri(task.input.uri)} .

        ${inputContainerToTriples(task.input)}
      }
    }`;

  try {
    await update(insert);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    throw new Error(`${e.message}\n\nQuery that caused error:\n${insert}`, {
      cause: e,
    });
  }
}

function inputContainerToTriples(container: InputContainer) {
  const triples = `${sparqlEscapeUri(container.uri)} a nfo:DataContainer ;
    mu:uuid ${sparqlEscapeString(container.id)} ;`;

  if (container.harvestingCollection) {
    const collectionUuid = uuid();
    const collectionUri = sparqlEscapeUri(
      DEFAULT_BASE_URI.HARVEST_COLLECTION + collectionUuid,
    );
    const remoteUuid = uuid();
    const remoteURI = sparqlEscapeUri(
      DEFAULT_BASE_URI.REMOTE_DATA_OBJECT + remoteUuid,
    );

    return `${triples}
      task:hasHarvestingCollection ${collectionUri} .
      ${collectionUri} a hrvst:HarvestingCollection ;
                       mu:uuid ${sparqlEscapeString(collectionUuid)} ;
                       dcterms:hasPart ${remoteURI} .
      ${remoteURI} a nfo:RemoteDataObject ;
                   mu:uuid ${sparqlEscapeString(remoteUuid)} ;
                   nie:url ${sparqlEscapeUri(container.resource)} .`;
  } else {
    return `${triples}
      task:hasResource ${sparqlEscapeUri(container.resource)} .`;
  }
}

async function linkOtherInputContainers(inputTask: Task, outputTask: Task) {
  const insert = `PREFIX task: <http://redpencil.data.gift/vocabularies/tasks/>
    INSERT {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        ${sparqlEscapeUri(outputTask.uri)} task:inputContainer ?inputContainer .
      }
    } WHERE {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        VALUES ?inputTask {
          ${sparqlEscapeUri(inputTask.uri)}
        }
        ?inputTask task:inputContainer ?inputContainer .
          FILTER (?inputContainer != ${sparqlEscapeUri(inputTask.input.uri)})
      }
    }`;

  try {
    await update(insert);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    throw new Error(`${e.message}\n\nQuery that caused error:\n${insert}`, {
      cause: e,
    });
  }
}

export async function insertTasks(inputTask: Task, outputTasks: Task[]) {
  for (const outputTask of outputTasks) {
    // 1. Insert new task
    await insertTask(outputTask);
    // 2. Link additional input containers
    await linkOtherInputContainers(inputTask, outputTask);
    // 3. Update status task to scheduled so it can be picked up
    await updateTaskStatus(outputTask.uri, STATUS.SCHEDULED);

    // shortly sleep to avoid overloading triplestore
    sleep();
  }

  await updateTaskStatus(inputTask.uri, STATUS.SUCCESS);
  console.info(`\n>> INFO: Completed task ${inputTask.uri}`);
}

async function sleep() {
  if (SLEEP_BETWEEN_TASKS > 0) {
    console.info(`>> INFO: Sleeping for ${SLEEP_BETWEEN_TASKS} ms.`);
    return new Promise((resolve) => setTimeout(resolve, SLEEP_BETWEEN_TASKS));
  }
}

export async function updateTaskStatus(
  taskUri: string,
  newStatus: string,
  errorMsg?: string,
) {
  const now = sparqlEscapeDateTime(new Date());

  let error = "";
  if (errorMsg && newStatus === STATUS.FAILED) {
    const errorUuid = uuid();
    const errorUri = DEFAULT_BASE_URI.ERROR + errorUuid;
    error = `?task task:error ${sparqlEscapeUri(errorUri)} .
      ${sparqlEscapeUri(errorUri)} a oslc:Error ;
                                   mu:uuid ${sparqlEscapeString(errorUuid)} ;
                                   oslc:message ${sparqlEscapeString(errorMsg)} .`;
  }

  const insert = `PREFIX adms: <http://www.w3.org/ns/adms#>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX oslc: <http://open-services.net/ns/core#>
    PREFIX task: <http://redpencil.data.gift/vocabularies/tasks/>

    DELETE {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        ?task adms:status ?status ;
              dcterms:modified ?modified .
        ?job dcterms:modified ?jobModified .
      }
    }
    INSERT {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        ?task adms:status ${sparqlEscapeUri(newStatus)} ;
              dcterms:modified ${now} .
        ${error}

        ?job dcterms:modified ${now} .
      }
    }
    WHERE {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        VALUES ?task {
          ${sparqlEscapeUri(taskUri)}
        }
        ?task adms:status ?status ;
              dcterms:isPartOf ?job .
        OPTIONAL { ?task dcterms:modified ?modified . }
        OPTIONAL { ?job dcterms:modified ?jobModified . }
      }
    }`;
  try {
    await update(insert);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    throw new Error(`${e.message}\n\nQuery that caused error:\n${insert}`, {
      cause: e,
    });
  }
}

export async function completeJob(task: Task) {
  const now = sparqlEscapeDateTime(new Date());
  const insert = `PREFIX adms: <http://www.w3.org/ns/adms#>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    DELETE {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        ?job adms:status ?status ;
             dcterms:modified ?modified .
      }
    }
    INSERT {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        ?job adms:status ${sparqlEscapeUri(STATUS.SUCCESS)} ;
             dcterms:modified ${now} .
      }
    }
    WHERE {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        VALUES ?task {
          ${sparqlEscapeUri(task.uri)}
        }
        ?task dcterms:isPartOf ?job .
        ?job adms:status ?status .
        OPTIONAL { ?job dcterms:modified ?modified . }
      }
    }`;
  try {
    await update(insert);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    throw new Error(`${e.message}\n\nQuery that caused error:\n${insert}`, {
      cause: e,
    });
  }
}

export async function findOpenTaskUris() {
  const targetOperations = getTaskOperations();
  const safeTargetOpsValues = targetOperations.map(sparqlEscapeUri).join("\n");

  const result = await query(`PREFIX adms: <http://www.w3.org/ns/adms#>
    PREFIX task: <http://redpencil.data.gift/vocabularies/tasks/>
    SELECT DISTINCT ?task WHERE {
      VALUES ?operation {
        ${safeTargetOpsValues}
      }
      ?task adms:status ${sparqlEscapeUri(STATUS.SCHEDULED)} ;
            task:operation ?operation .
  }`);

  return result?.results.bindings?.map((b) => b.task.value) || [];
}

export async function failBusyTasks() {
  const targetOperations = getTaskOperations();
  const safeTargetOpsValues = targetOperations.map(sparqlEscapeUri).join("\n");
  await update(`PREFIX adms: <http://www.w3.org/ns/adms#>
    PREFIX task: <http://redpencil.data.gift/vocabularies/tasks/>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    DELETE {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        ?task adms:status ${sparqlEscapeUri(STATUS.BUSY)} ;
              dcterms:modified ?modified .
      }
    }
    INSERT {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        ?task adms:status ${sparqlEscapeUri(STATUS.FAILED)} ;
              dcterms:modified ${sparqlEscapeDateTime(new Date())} .
      }
    }
    WHERE {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        VALUES ?operation {
          ${safeTargetOpsValues}
        }
        ?task adms:status ${sparqlEscapeUri(STATUS.BUSY)} ;
              task:operation ?operation .
        OPTIONAL { ?task dcterms:modified ?modified . }
    }
  }
`);
}
