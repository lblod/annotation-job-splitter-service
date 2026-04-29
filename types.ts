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
  operation: string;
  targetShape?: Shape;
  targetGraph?: string;
};

export type Shape = {
  uri: string;
  targetClass?: string;
  targetNodes?: string[];
};

export type Task = {
  uri: string;
  id?: string;
  index: number;
  parentJob: Job;
  operation: string;
  target?: InputContainer;
};

export type InputContainer = {
  uri: string;
  id: string;
  resource: string;
};
