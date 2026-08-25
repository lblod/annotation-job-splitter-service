import config from "../config/config";
import { Task, TaskConfiguration } from "../types";

function getJobConfiguration(operation: string) {
  return config.jobConfiguration[operation];
}

export function getTaskOperations() {
  return Object.values(config.jobConfiguration).flatMap((jobConfig) => {
    return jobConfig.taskConfiguration.flatMap(
      (taskConfig: TaskConfiguration) => taskConfig.currentOperation,
    );
  });
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

export function getTaskConfiguration(task: Task) {
  const jobConfiguration = getJobConfiguration(task.parentJob.operation);
  if (jobConfiguration) {
    const taskConfiguration = jobConfiguration.taskConfiguration.find(
      (taskConfig: TaskConfiguration) =>
        taskConfig.currentOperation === task.operation,
    );
    return taskConfiguration;
  }
}
