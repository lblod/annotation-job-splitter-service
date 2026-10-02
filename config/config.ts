export default [
  {
    currentOperation:
      "http://lblod.data.gift/id/jobs/concept/TaskOperation/codelist-matching/training-split-tasks",
    nextOperation:
      "http://lblod.data.gift/id/jobs/concept/TaskOperation/codelist-matching/annotate",
  },
  {
    currentOperation:
      "http://lblod.data.gift/id/jobs/concept/TaskOperation/codelist-matching/evaluation-split-tasks",
    nextOperation:
      "http://lblod.data.gift/id/jobs/concept/TaskOperation/codelist-matching/annotate",
  },
  {
    currentOperation:
      "http://lblod.data.gift/id/jobs/concept/TaskOperation/annotation-split-tasks",
    nextOperation:
      "http://lblod.data.gift/id/jobs/concept/TaskOperation/eli-translation",
    resourceLimit: 100,
    resourceFilter: `
      FILTER NOT EXISTS {
        ?original <http://purl.org/linguistics/gold/translation> ?resource .
      }
      FILTER NOT EXISTS {
        ?someTask <http://redpencil.data.gift/vocabularies/tasks/operation> <http://lblod.data.gift/id/jobs/concept/TaskOperation/eli-translation> .
        ?someTask <http://redpencil.data.gift/vocabularies/tasks/inputContainer> / <http://redpencil.data.gift/vocabularies/tasks/hasResource> ?resource .
      }`,
  },
  {
    currentOperation:
      "http://lblod.data.gift/id/jobs/concept/TaskOperation/split-task-pdf-to-eli",
    nextOperation:
      "http://lblod.data.gift/id/jobs/concept/TaskOperation/pdf-scraping",
    harvestingCollection: true,
  },
];
