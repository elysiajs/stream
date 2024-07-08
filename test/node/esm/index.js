if ("Bun" in globalThis) {
  throw new Error("❌ Use Node.js to run this test!");
}

import { Stream } from "@elysiajs/stream";

if (typeof Stream !== "function" && Stream["name"] === "Stream") {
  throw new Error("❌ ESM Node.js failed");
}

console.log("✅ ESM Node.js works!");
