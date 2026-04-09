import app from "./app";

const port = 4000;

app.listen(port, "127.0.0.1", () => {
  console.log(`API listening on port ${port}`);
});