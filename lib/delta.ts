import { Changeset, Job, Triple } from "../types";
import { isConfiguredJobType, isConfiguredJobOperation } from "../util/config";

const TYPE_PREDICATE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const JOB_PREDICATES = {
  OPERATION: "http://redpencil.data.gift/vocabularies/tasks/operation",
  TARGET_SHAPE: "http://mu.semte.ch/vocabularies/ext/shapeForTargets",
  TARGET_GRAPH: "http://mu.semte.ch/vocabularies/ext/graphForTargets",
};

export function parseDelta(delta: Changeset[]): Job[] {
  const inserts = delta.flatMap((changeSet) => changeSet.inserts);

  const jobUris = inserts
    .filter(
      (triple) =>
        triple.predicate.value === TYPE_PREDICATE &&
        isConfiguredJobType(triple.object.value),
    )
    .map((triple) => {
      return { uri: triple.subject.value, type: triple.object.value };
    });

  let jobs: Job[] = [];
  // NOTE (22/04/2026): If a job resource has multiple types that are
  // configured, this can lead to multiple Job objects for the same resource.
  for (const { uri, type } of jobUris) {
    const triplesForJob = inserts.filter(
      (triple) => triple.subject.value === uri,
    );

    const operation = findValueForPredicate(
      triplesForJob,
      JOB_PREDICATES.OPERATION,
    );

    if (isConfiguredJobOperation(type, operation)) {
      jobs.push({
        uri: uri,
        type: type,
        operation: operation,
        // NOTE (22/04/2026): This assumes that each job has at most 1 target
        // shape.
        targetShape: findValueForPredicate(
          triplesForJob,
          JOB_PREDICATES.TARGET_SHAPE,
        ),
        // NOTE (22/04/2026): This assumes that each job has at most 1 target
        // graph.
        targetGraph: findValueForPredicate(
          triplesForJob,
          JOB_PREDICATES.TARGET_GRAPH,
        ),
      } as Job);
    } else {
      console.info(
        `>> INFO: Ignoring job ${uri} as its operation ${operation} is not configured for job type ${type}.`,
      );
    }
  }

  return jobs;
}

function findValueForPredicate(triples: Triple[], predicate: string) {
  return triples.find((triple) => triple.predicate.value === predicate)?.object
    .value;
}
