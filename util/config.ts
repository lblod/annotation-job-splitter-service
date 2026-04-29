import config from "../config/config";
import { Task } from "../types";

const DEFAULT_PREDICATES = {
  TARGET_SHAPE: "http://mu.semte.ch/vocabularies/ext/shapeForTargets",
  TARGET_GRAPH: "http://mu.semte.ch/vocabularies/ext/graphForTargets",
};

function getJobConfiguration(operation: string) {
  return config.jobConfiguration[operation];
}

export function isConfiguredTask(task: Task) {
  const jobConfiguration = getJobConfiguration(task.parentJob.operation);
  if (jobConfiguration) {
    return jobConfiguration.taskConfiguration.some(
      (taskConfig: TaskConfiguration) =>
        taskConfig.currentOperation === task.operation,
    );
  }
}

export function getNextOperation(task: Task) {
  const jobConfiguration = getJobConfiguration(task.parentJob.operation);
  if (jobConfiguration) {
    const taskConfiguration = jobConfiguration.taskConfiguration.find(
      (taskConfig: TaskConfiguration) =>
        taskConfig.currentOperation === task.operation,
    );
    return taskConfiguration?.nextOperation;
  }
}

export function targetShapePredicate() {
  return config.targetShapePredicate || DEFAULT_PREDICATES.TARGET_SHAPE;
}

export function targetGraphPredicate() {
  return config.targetGraphPredicate || DEFAULT_PREDICATES.TARGET_GRAPH;
}

type TaskConfiguration = {
  currentOperation: string;
  nextOperation: string;
};
