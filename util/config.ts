import config from "../config/config";
import { Task, TaskConfiguration } from "../types";

export function getTaskOperations() {
  return config.flatMap(
    (taskConfig: TaskConfiguration) => taskConfig.currentOperation,
  );
}

export function getTaskConfiguration(task: Task) {
  const taskConfiguration = config.find(
    (taskConfig: TaskConfiguration) =>
      taskConfig.currentOperation === task.operation,
  );
  return taskConfiguration;
}
