export type Term = {
  type: string;
  value: string;
};

export type Triple = {
  subject: Term;
  predicate: Term;
  object: Term;
};

export type Quad = {
  subject: Term;
  predicate: Term;
  object: Term;
  graph: Term;
};

export type Changeset = {
  inserts: Quad[];
  deletes: Quad[];
};

export type Job = {
  uri: string;
  type: string;
  operation: string;
  // NOTE (22/04/2026): We cannot rely on the shape resource being part of the
  // delta message. At best we can assign the resource's URI here to facilitate
  // retrieval later in the flow.
  targetShape?: string;
  targetGraph?: string;
};
