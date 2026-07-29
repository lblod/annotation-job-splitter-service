import bodyParser from "body-parser";
import { app, errorHandler } from "mu";
import { processTask } from "./lib/task";
import {
  batchedInsertTasks,
  findOpenTaskUris,
  retrieveTaskData,
} from "./lib/queries";
import { CronJob } from "cron";
import { Task } from "./types";
import { isConfiguredTask } from "./util/config";

app.get("/health", async function (_req, res) {
  res.send({ status: "ok" });
});

app.post(
  "/delta",
  bodyParser.json({ limit: "50mb" }),
  async function (_req, res) {
    // NOTE (23/06/2026): Don't check delta, simply look for open tasks left
    // to be processed. We're not doing too much here as the deltas will be
    // filtered by the deltanotifier config already.
    // NOTE (22/04/2026): Do not await here as this can take a long time,
    // e.g. when creating tasks for all decisions in a given graph.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handleOpenTasks().catch((e: any) => {
      console.error(`Something went wrong while processing delta: ${e}`);
    });

    return res.status(200).send().end();
  },
);

let running: Date | null = null;
async function handleOpenTasks() {
  if (running) {
    console.log(
      `Already processing tasks, letting runner know to rerun when done.`,
    );
    running = new Date();
    return [];
  }
  const myRunning = new Date();
  running = myRunning;

  const inputTasks = await unsafeHandleOpenTasks().catch((e) => {
    console.log(`Something went wrong while splitting tasks: ${e}`);
    return [];
  });

  if (running != myRunning) {
    running = null;
    return handleOpenTasks();
  } else {
    running = null;
    return inputTasks;
  }
}

async function unsafeHandleOpenTasks() {
  const taskUris = await findOpenTaskUris();

  const inputTasks: Task[] = [];
  for (const taskUri of taskUris) {
    const task = await retrieveTaskData(taskUri);
    if (task && isConfiguredTask(task)) {
      inputTasks.push(task);
    } else {
      console.info(
        `\n>> INFO: Ignoring task ${taskUri} as its resource does not match a configured task`,
      );
    }
  }

  const outputTasks = await Promise.all(
    inputTasks.map(async (task) => {
      return { inputTask: task, outputTasks: await processTask(task) };
    }),
  );
  await Promise.all(
    outputTasks.map((tasks) => {
      return batchedInsertTasks(tasks.inputTask, tasks.outputTasks).catch(
        (error) => {
          console.log(
            `\n>> ERROR: Something went wrong while inserting tasks for ${tasks.inputTask.uri}`,
          );
          console.error(error);
          throw error;
        },
      );
    }),
  );

  return inputTasks;
}

CronJob.from({
  cronTime: process.env.MISSED_DELTA_CRON || "27 */5 * * *",
  onTick: function () {
    handleOpenTasks().catch((e) => {
      console.log("Something went wrong checking for missed deltas, ", e);
    });
  },
  start: true,
});

handleOpenTasks().catch((e) => {
  console.log(
    "Something went wrong checking for missed deltas on startup, ",
    e,
  );
  process.exit(1);
});

app.use(errorHandler);
