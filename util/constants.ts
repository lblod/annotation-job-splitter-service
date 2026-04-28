import config from "../config/config";

export const JOB_GRAPH =
  process.env.JOB_GRAPH || "http://mu.semte.ch/graphs/harvesting";

export const TASK_STATUS_PREDICATE = "http://www.w3.org/ns/adms#status";

export const STATUS = {
  PREPARING: "http://redpencil.data.gift/id/concept/JobStatus/preparing",
  BUSY: "http://redpencil.data.gift/id/concept/JobStatus/busy",
  SCHEDULED: "http://redpencil.data.gift/id/concept/JobStatus/scheduled",
  SUCCESS: "http://redpencil.data.gift/id/concept/JobStatus/success",
  FAILED: "http://redpencil.data.gift/id/concept/JobStatus/failed",
};

const DEFAULT_PREDICATES = {
  TARGET_SHAPE: "http://mu.semte.ch/vocabularies/ext/shapeForTargets",
  TARGET_GRAPH: "http://mu.semte.ch/vocabularies/ext/graphForTargets",
};

export const TARGET_SHAPE_PREDICATE =
  config["targetShapePredicate"] || DEFAULT_PREDICATES.TARGET_SHAPE;

export const TARGET_GRAPH_PREDICATE =
  config["targetGraphPredicate"] || DEFAULT_PREDICATES.TARGET_GRAPH;

export const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 120;
export const SLEEP_BETWEEN_BATCHES =
  parseInt(process.env.SLEEP_BETWEEN_BATCHES) || 1000;
// NOTE (20/04/2026): For consistency with other services we opted to use
// `BATCH_SIZE` as environment variable to specify the maximum number of
// triples to insert at once.  Per task 12 triples (9 for the task resource, 3
// for the input container) will be inserted.  The following uses this to
// split the received tasks into smaller batches thereby ensuring each task is
// fully contained within a single batch so we do not insert incomplete tasks.
export const TASKS_PER_BATCH = Math.ceil(BATCH_SIZE / 12);
