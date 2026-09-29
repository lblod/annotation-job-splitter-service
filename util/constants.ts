export const JOB_GRAPH =
  process.env.JOB_GRAPH || "http://mu.semte.ch/graphs/harvesting";

export const STATUS = {
  PREPARING: "http://redpencil.data.gift/id/concept/JobStatus/preparing",
  BUSY: "http://redpencil.data.gift/id/concept/JobStatus/busy",
  SCHEDULED: "http://redpencil.data.gift/id/concept/JobStatus/scheduled",
  SUCCESS: "http://redpencil.data.gift/id/concept/JobStatus/success",
  FAILED: "http://redpencil.data.gift/id/concept/JobStatus/failed",
};

export const DEFAULT_BASE_URI = {
  HARVEST_COLLECTION: "http://lblod.data.gift/id/harvest-collections/",
  REMOTE_DATA_OBJECT: "http://lblod.data.gift/id/remote-data-objects/",
  ERROR: "http://redpencil.data.gift/id/jobs/error/",
};

export const SLEEP_BETWEEN_TASKS = parseInt(
  process.env.SLEEP_BETWEEN_TASKS || "1000",
);
