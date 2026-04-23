export default {
  jobs: {
    "http://mu.semte.ch/vocabularies/ext/AnnotationJob": {
      "http://lblod.data.gift/id/jobs/concept/JobOperation/codelist-matching/training":
        {
          taskOperations: [
            "http://lblod.data.gift/id/jobs/concept/TaskOperation/codelist-matching/annotate",
          ],
          ensureInputContainer: true,
        },
      "http://lblod.data.gift/id/jobs/concept/JobOperation/codelist-matching/evaluation":
        {
          taskOperations: [
            "http://lblod.data.gift/id/jobs/concept/TaskOperation/codelist-matching/annotate",
          ],
        },
      "http://lblod.data.gift/id/jobs/concept/JobOperation/ner-and-nel-annotations":
        {
          taskOperations: [
            "http://lblod.data.gift/id/jobs/concept/TaskOperation/eli-translation",
          ],
        },
    },
  },
  defaultTargetShapePredicate:
    "http://mu.semte.ch/vocabularies/ext/shapeForTargets",
  defaultTargetGraphPredicate:
    "http://mu.semte.ch/vocabularies/ext/graphForTargets",
};
