import { Job, Task } from "../types";
import { uuid } from "mu";
import { retrieveResourcesFromGraph } from "./queries";
import { getNextOperation } from "../util/config";

const RESOURCE_BASE = {
  TASK: "http://redpencil.data.gift/id/task/",
  DATA_CONTAINER: "http://redpencil.data.gift/id/dataContainers/",
};

export async function processTask(task: Task) {
  const nextOperation = getNextOperation(task);
  if (nextOperation) {
    const nextIndex = task.index + 1;

    const targets = await listTargets(task.parentJob);
    return targets.map((target) =>
      createTask(task.parentJob, nextOperation, target, nextIndex),
    );
  } else {
    throw new Error(
      `Could not process task ${task.uri} as no next operation is configured.`,
    );
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

function createTask(
  parentJob: Job,
  operation: string,
  target: string,
  index: number,
) {
  if (target) {
    const id = uuid();
    return {
      uri: RESOURCE_BASE.TASK + id,
      id: id,
      index: index,
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
