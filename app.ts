import { app, query, errorHandler } from "mu";

app.get("/", function (_req, res) {
  res.send("Hello annotation-job-splitter-service");
});

app.get("/health", async function (_req, res) {
  res.send({ status: "ok" });
});

app.post("/split-jobs", async function (req, res) {
  // TODO: Implement
  res.send("Not implemented yet.");
});

app.post("/delta", async function (req, res) {
  // TODO: implement
});

app.use(errorHandler);
