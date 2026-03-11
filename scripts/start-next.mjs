import net from "node:net";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const DEFAULT_PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
const MAX_PORT = 3999;
const hasExplicitPort = Boolean(process.env.PORT);
const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

function checkPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }

      if (error && error.code === "EAFNOSUPPORT") {
        resolve(checkPortWithoutHost(port));
        return;
      }

      reject(error);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen({
      port,
      host: "::",
    });
  });
}

function checkPortWithoutHost(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }

      reject(error);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port);
  });
}

async function findPort(startPort) {
  for (let port = startPort; port <= MAX_PORT; port += 1) {
    if (await checkPort(port)) {
      return port;
    }
  }

  throw new Error(
    `No open port found between ${startPort} and ${MAX_PORT}. Set PORT to a free port and try again.`,
  );
}

async function main() {
  const port = hasExplicitPort ? DEFAULT_PORT : await findPort(DEFAULT_PORT);

  if (!hasExplicitPort && port !== DEFAULT_PORT) {
    console.log(
      `Port ${DEFAULT_PORT} is already in use, so CalorieLens will start on port ${port} instead.`,
    );
  }

  const child = spawn(
    process.execPath,
    [nextBin, "start", "-p", String(port)],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        PORT: String(port),
      },
    },
  );

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on("SIGINT", forwardSignal);
  process.on("SIGTERM", forwardSignal);

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error("Failed to start CalorieLens.", error);
  process.exit(1);
});
