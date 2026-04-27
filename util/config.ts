import config from "../config/config";
import { Job } from "../types";

export function isConfiguredJobType(type: string) {
  return Object.keys(config.jobs)?.includes(type);
}

export function isConfiguredJobOperation(jobType: string, operation: string) {
  return Object.keys(config.jobs[jobType])?.includes(operation);
}

function getJobOperations(type: string) {
  return config.jobs[type];
}

export function listTaskOperations(job: Job) {
  const jobOperations = getJobOperations(job.type);
  if (jobOperations) {
    return jobOperations[job.operation]?.taskOperations;
  }
}

export function targetShapePredicate(type: string) {
  const jobOperations = getJobOperations(type);
  return (
    jobOperations.targetShapePredicate || config.defaultTargetShapePredicate
  );
}

export function targetGraphPredicate(type: string) {
  const jobOperations = getJobOperations(type);
  return (
    jobOperations.targetGraphPredicate || config.defaultTargetGraphPredicate
  );
}
