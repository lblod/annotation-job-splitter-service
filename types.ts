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
  targetShape: Shape;
  targetGraph: string;
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
  target: InputContainer;
  dependsOn: string;
};

export type InputContainer = {
  uri: string;
  id: string;
  resource: string;
  harvestingCollection: boolean;
};

export type JobConfig = {
  jobConfiguration: {
    [key: string]: {
      taskConfiguration: TaskConfiguration[];
    };
  };
  targetShapePredicate?: string;
  targetGraphPredicate?: string;
};

export type TaskConfiguration = {
  currentOperation: string;
  nextOperation: string;
  resourceLimit?: number;
  resourceFilter?: string;
  harvestingCollection?: boolean;
};
