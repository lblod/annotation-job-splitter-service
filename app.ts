import bodyParser from "body-parser";
import { app, errorHandler } from "mu";
import { processJob } from "./lib/job";
import { parseDelta } from "./lib/delta";

app.get("/health", async function (_req, res) {
  res.send({ status: "ok" });
});

app.post(
  "/delta",
  bodyParser.json({ limit: "50mb" }),
  async function (req, res) {
    try {
      const jobs = await parseDelta(req.body);
      const tasks = (
        await Promise.all(jobs.flatMap(async (job) => await processJob(job)))
      ).flat();
      // TODO: insert tasks in triplestore
      return res.status(200).send().end();
    } catch (error) {
      console.log(`\n>> ERROR: Something went wrong while processing a delta.`);
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
  },
);

app.use(errorHandler);
