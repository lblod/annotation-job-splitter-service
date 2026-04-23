import config from "../config/config";

export function isConfiguredJobType(type: string) {
  return Object.keys(config)?.includes(type);
}

export function isConfiguredJobOperation(jobType: string, operation: string) {
  return Object.keys(config[jobType])?.includes(operation);
}
