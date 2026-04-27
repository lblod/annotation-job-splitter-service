import { Job, Task } from "../types";
import { uuid } from "mu";
import { retrieveResourcesFromGraph } from "./queries";
import { listTaskOperations } from "../util/config";

const RESOURCE_BASE = {
  TASK: "http://redpencil.data.gift/id/task/",
  DATA_CONTAINER: "http://redpencil.data.gift/id/dataContainers/",
};

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
    throw new Error(`No targets found for job ${job.uri}.`);
  }
}

async function listTargets(job: Job) {
  const shape = job.targetShape;

  let targets: string[];
  // NOTE (18/04/2026): This assumes that it is not meaningful to specify both a
  // `targetClass` as well as `targetNodes`.  Should both be specified, the
  // `targetNodes` will simply be ignored.
  if (shape.targetClass) {
    // NOTE (22/04/2026): This assumes that a target graph is always specified.
    // Otherwise, the called function will fail trying to escape an undefined
    // graph URI.
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
  if (target) {
    const id = uuid();
    return {
      uri: RESOURCE_BASE.TASK + id,
      id: id,
      parentJob: parentJob,
      operation: operation,
      target: createInputContainer(target),
    } as Task;
  } else {
    throw new Error(
      `Could not create task for job ${parentJob.uri} with task operation ${operation} due to missing target.`,
    );
  }
}

function createInputContainer(target: string) {
  const id = uuid();
  return {
    uri: RESOURCE_BASE.DATA_CONTAINER + id,
    id: id,
    resource: target,
  };
}
