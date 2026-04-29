import { retrieveTaskData } from "./queries";
import { Changeset, Task } from "../types";
import { isConfiguredTask } from "../util/config";
import { STATUS, TASK_STATUS_PREDICATE } from "../util/constants";

export async function parseDelta(delta: Changeset[]) {
  const inserts = delta.flatMap((changeSet) => changeSet.inserts);

  // NOTE (28/04/2026): We limit ourselves to extracting potential input task
  // URIs from the delta message.  While the delta message might contain more
  // relevant data, e.g. task operation, we make no such assumption and will
  // query for additional data.
  const taskUris = inserts
    .filter(
      (quad) =>
        quad.predicate.value === TASK_STATUS_PREDICATE &&
        quad.object.value === STATUS.SCHEDULED,
    )
    .map((quad) => quad.subject.value);

  const tasks: Task[] = [];
  for (const taskUri of taskUris) {
    const task = await retrieveTaskData(taskUri);
    if (task && isConfiguredTask(task)) {
      tasks.push(task);
    } else {
      console.info(
        `\n>> INFO: Ignoring task ${taskUri} as it does not match a configured task`,
      );
    }
  }

  return tasks;
}
