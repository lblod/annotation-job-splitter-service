// NOTE (18/04/2026): Using sudo queries as we need to be able to read from
// specific graphs, e.g. to retrieve the correct resources.  It is currently not
// advised to mix sudo-queries and scopes.
import { querySudo as query } from "@lblod/mu-auth-sudo";
import { sparqlEscapeUri } from "mu";
import { Shape } from ".,/types";

const JOB_GRAPH =
  process.env.JOB_GRAPH || "http://mu.semte.ch/graphs/harvesting";

export async function retrieveTargetShape(jobUri: string) {
  const shape = await query(`PREFIX sh: <http://www.w3.org/ns/shacl#>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

    SELECT DISTINCT ?shape ?class ?node
    WHERE {
      GRAPH ${sparqlEscapeUri(JOB_GRAPH)} {
        ${sparqlEscapeUri(jobUri)} ext:shapeForTargets ?shape .

        OPTIONAL {
          ?shape sh:targetClass ?class .
        }

        OPTIONAL {
          ?shape sh:targetNode ?node .
        }
      }
    }`);

  const { classes, nodes } = shape.results.bindings.reduce(
    (acc, binding) => {
      if (binding.class?.value) acc.classes.push(binding.class?.value);
      if (binding.node?.value) acc.nodes.push(binding.node?.value);
      return acc;
    },
    { classes: [], nodes: [] },
  );

  return {
    uri: shape.results.bindings[0].shape?.value,
    // NOTE (17/04/2026): Currently only a single target class can be defined in
    // the frontend.
    targetClass: classes ? classes[0] : undefined,
    targetNodes: nodes,
  } as Shape;
}
