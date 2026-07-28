import { Job, Task, TaskConfiguration } from "../types";
import { uuid } from "mu";
import { retrieveResourcesFromGraph } from "./queries";
import { getTaskConfiguration } from "../util/config";

const RESOURCE_BASE = {
  TASK: "http://redpencil.data.gift/id/task/",
  DATA_CONTAINER: "http://redpencil.data.gift/id/dataContainers/",
};

export async function processTask(task: Task) {
  const taskConfiguration = getTaskConfiguration(task);
  if (taskConfiguration) {
    const nextIndex = task.index + 1;

    const targets = await listTargets(task.parentJob, taskConfiguration);
    return targets.map((target) =>
      createTask(
        task.parentJob,
        target,
        nextIndex,
        task.uri,
        taskConfiguration,
      ),
    );
  } else {
    throw new Error(
      `Could not process task ${task.uri} as no next operation is configured.`,
    );
  }
}

async function listTargets(job: Job, taskConfiguration: TaskConfiguration) {
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
      taskConfiguration,
    );
  } else if (shape.targetNodes) {
    targets = shape.targetNodes;
  } else {
    throw new Error(
      `Misconfigured target shape, either targetClass or targetNodes is required`,
    );
  }

  return targets;
}

function createTask(
  parentJob: Job,
  target: string,
  index: number,
  dependsOn: string,
  taskConfiguration: TaskConfiguration,
) {
  if (target) {
    const id = uuid();
    return {
      uri: RESOURCE_BASE.TASK + id,
      id: id,
      index: index,
      parentJob: parentJob,
      operation: taskConfiguration.nextOperation,
      dependsOn: dependsOn,
      target: createInputContainer(
        target,
        taskConfiguration.harvestingCollection,
      ),
    } as Task;
  } else {
    throw new Error(
      `Could not create task for job ${parentJob.uri} with task operation ${taskConfiguration.nextOperation} due to missing target.`,
    );
  }
}

function createInputContainer(
  target: string,
  harvestingCollection: boolean = false,
) {
  const id = uuid();
  return {
    uri: RESOURCE_BASE.DATA_CONTAINER + id,
    id: id,
    resource: target,
    harvestingCollection: harvestingCollection,
  };
}
