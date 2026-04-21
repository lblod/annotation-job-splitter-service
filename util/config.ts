import config from "../config/config";
import { Job } from "../types";

export function isConfiguredJobType(type: string) {
  return Object.keys(config)?.includes(type);
}

export function isConfiguredJobOperation(jobType: string, operation: string) {
  return Object.keys(config[jobType])?.includes(operation);
}

export function listTaskOperations(job: Job) {
  const jobOperations = config[job.type];
  if (jobOperations) {
    return jobOperations[job.operation]?.taskOperations;
  }
}

export function requiresInputContainer(job: Job) {
  const jobOperations = config[job.type];
  if (jobOperations) {
    return !!jobOperations[job.operation]?.ensureInputContainer;
  }
}
