import { app, errorHandler } from "mu";

app.get("/health", async function (_req, res) {
  res.send({ status: "ok" });
});

app.post("/delta", async function (req, res) {
  // TODO: implement
});

app.use(errorHandler);
