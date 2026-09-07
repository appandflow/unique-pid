import { capture } from "../index.mjs";
const expiry = setTimeout(() => process.exit(2), 20000);
process.on("message", (message) => {
  if (message === "rename") {
    process.title = "unique ) name";
    process.send("renamed");
  }
  if (message === "stop") {
    clearTimeout(expiry);
    process.disconnect();
  }
});
process.send(capture(process.pid));
