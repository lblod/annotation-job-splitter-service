import bodyParser from "body-parser";
import { app, errorHandler } from "mu";
import { processTask } from "./lib/task";
import { parseDelta } from "./lib/delta";
import { batchedInsertTasks } from "./lib/queries";

app.get("/health", async function (_req, res) {
  res.send({ status: "ok" });
});

app.post(
  "/delta",
  bodyParser.json({ limit: "50mb" }),
  async function (req, res, next) {
    try {
      const inputTasks = await parseDelta(req.body);
      const outputTasks = await Promise.all(
        inputTasks.map(async (task) => {
          return { inputTask: task, outputTasks: await processTask(task) };
        }),
      );
      // NOTE (22/04/2026): Do not await here as this can take a long time,
      // e.g. when creating tasks for all decisions in a given graph.
      outputTasks.forEach((tasks) =>
        batchedInsertTasks(tasks.inputTask, tasks.outputTasks),
      );
      return res.status(200).send().end();
    } catch (error) {
      console.log(`\n>> ERROR: Something went wrong while processing a delta.`);
      console.error(error);
      return next(error);
    }
  },
);

app.use(errorHandler);
