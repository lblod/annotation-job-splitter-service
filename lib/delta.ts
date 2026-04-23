import { retrieveTargetShape } from "./queries";
import { Changeset, Job, Triple } from "../types";
import { isConfiguredJobType, isConfiguredJobOperation } from "../util/config";

const TYPE_PREDICATE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const JOB_PREDICATES = {
  OPERATION: "http://redpencil.data.gift/vocabularies/tasks/operation",
  TARGET_SHAPE: "http://mu.semte.ch/vocabularies/ext/shapeForTargets",
  TARGET_GRAPH: "http://mu.semte.ch/vocabularies/ext/graphForTargets",
};

export async function parseDelta(delta: Changeset[]) {
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
      // NOTE (22/04/2026): We cannot rely on the shape being part of the
      // received delta message.  Therefore, we explicitly retrieve it from the
      // triplestore here.
      const shape = await retrieveTargetShape(uri);
      if (shape) {
        jobs.push({
          uri: uri,
          type: type,
          operation: operation,
          targetShape: shape,
          // NOTE (22/04/2026): This assumes that each job has at most 1 target
          // graph.
          targetGraph: findValueForPredicate(
            triplesForJob,
            JOB_PREDICATES.TARGET_GRAPH,
          ),
        } as Job);
      } else {
        console.log(
          `>> INFO: Ignoring job ${uri} since no target shape node was found.`,
        );
      }
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
