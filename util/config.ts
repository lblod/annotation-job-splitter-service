import config from "../config/config";
import { Task } from "../types";

function getJobConfiguration(operation: string) {
  return config.jobConfiguration[operation];
}

export function isConfiguredTaskOperation(operation: string) {
  const configuredOperations = Object.keys(config.jobConfiguration)
    .flatMap((job) => config.jobConfiguration[job]?.taskConfiguration)
    .flatMap((taskConfig) => taskConfig.currentOperation);

  return configuredOperations.includes(operation);
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

type TaskConfiguration = {
  currentOperation: string;
  nextOperation: string;
};
