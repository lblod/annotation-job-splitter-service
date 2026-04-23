import { Job, Task } from "../types";
import { uuid } from "mu";
import { retrieveResourcesFromGraph } from "./queries";
import { listTaskOperations } from "../util/config";

const TASK_URI_PREFIX = "http://redpencil.data.gift/id/task/";

export async function processJob(job: Job) {
  const taskOperations: string[] = listTaskOperations(job);
  if (!taskOperations || taskOperations.length === 0) {
    console.info(
      `\n>> INFO: Ignoring job ${job.uri} as its operation ${job.operation} is not configured for job type ${job.type}.\n`,
    );
    return;
  }

  // NOTE (17/04/2026): Assume we might support creating multiple tasks per
  // job and target (class or node).  This allows to easily map all targets to
  // each task operation.
  const cartesian = (...a) =>
    a.reduce(
      (acc, current) => acc.flatMap((d) => current.map((e) => [d, e].flat())),
      [[]],
    );

  const targets = await listTargets(job);
  if (targets && targets.length > 0) {
    const tasks: Task[] = cartesian(targets, taskOperations).map(
      ([target, taskOp]) => createTask(job, taskOp, target),
    );
    return tasks;
  } else {
    console.info(
      `>> INFO: Ignoring job ${job.uri} as no targets were found for it.`,
    );
    return;
  }
}

async function listTargets(job: Job) {
  const shape = job.targetShape;

  let targets: string[];
  // NOTE (18/04/2026): This assumes that it is not meaningful to specify both a
  // `targetClass` as well as `targetNodes`.  Should both be specified, the
  // `targetNodes` will simply be ignored.
  if (shape.targetClass) {
    // NOTE (22/04/2026): Should we consider the situation where no target graph
    // is specified? It that case one could just search in ALL graphs.
    targets = await retrieveResourcesFromGraph(
      shape.targetClass,
      job.targetGraph,
    );
  } else {
    targets = shape.targetNodes;
  }

  return targets;
}

function createTask(parentJob: Job, operation: string, target: string) {
  const id = uuid();
  return {
    uri: TASK_URI_PREFIX + id,
    id: id,
    parentJob: parentJob,
    operation: operation,
    target: target,
  } as Task;
}
