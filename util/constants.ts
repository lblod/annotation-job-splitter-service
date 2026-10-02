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

const PREFIXES = {
  adms: "http://www.w3.org/ns/adms#",
  cogs: "http://vocab.deri.ie/cogs#",
  dcterms: "http://purl.org/dc/terms/",
  hrvst: "http://lblod.data.gift/vocabularies/harvesting/",
  mu: "http://mu.semte.ch/vocabularies/core/",
  nfo: "http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#",
  nie: "http://www.semanticdesktop.org/ontologies/2007/01/19/nie#",
  oslc: "http://open-services.net/ns/core#",
  sh: "http://www.w3.org/ns/shacl#",
  task: "http://redpencil.data.gift/vocabularies/tasks/",
};

export const SPARQL_PREFIXES = (() => {
  const all = [];
  for (const key in PREFIXES) all.push(`PREFIX ${key}: <${PREFIXES[key]}>`);
  return all.join("\n");
})();
