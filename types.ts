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

export type Job = {
  uri: string;
  operation: string;
};

export type Shape =
  | {
      uri: string;
      targetClass: string;
      targetNodes?: never;
    }
  | {
      uri: string;
      targetNodes: string[];
      targetClass?: never;
    };

export type Task = {
  uri: string;
  id: string;
  index: number;
  parentJob: Job;
  operation: string;
  input: InputContainer;
  dependsOn: string;
};

export type InputContainer = {
  uri: string;
  id: string;
  // NOTE (24/09/2026): For incoming tasks require a Shape to be linked, but for
  // created tasks we will just assign a resource URI.
  // TODO: Can we avoid this or? Maybe retrieve shape at a later point in the
  // flow, e.g. when its content is actually needed?
  resource: Shape | string;
  targetGraph: string;
  harvestingCollection: boolean;
};

export type JobConfig = {
  jobConfiguration: {
    [key: string]: {
      taskConfiguration: TaskConfiguration[];
    };
  };
  targetGraphPredicate?: string;
};

export type TaskConfiguration = {
  currentOperation: string;
  nextOperation: string;
  resourceLimit?: number;
  resourceFilter?: string;
  harvestingCollection?: boolean;
};
