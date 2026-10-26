// Command line entry: `sync`, `login`, `schedule install|remove`. Run through tsx (see package.json).
import { existsSync } from "node:fs";
import path from "node:path";
import { ensureDataDir, getDataDir } from "@/lib/data-dir";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

async function main(): Promise<number> {
  const [command, arg] = process.argv.slice(2);
  const dataDir = ensureDataDir(getDataDir());

  if (command === "login") {
    const { interactiveLogin } = await import("@/sync/browser");
    await interactiveLogin({ dataDir });
    console.log("Login saved. You can now run `npm run sync`.");
    return 0;
  }

  if (command === "sync") {
    const { runSync } = await import("@/sync/run");
    const force = process.argv.includes("--force");
    const outcome = await runSync(dataDir, { force, headless: !process.argv.includes("--show") });
    console.log(`[${new Date().toISOString()}] ${outcome.state}: ${outcome.message}`);
    return outcome.state === "ok" || outcome.state === "skipped" ? 0 : outcome.state === "needs-login" ? 2 : 1;
  }

  if (command === "schedule") {
    const launchd = await import("@/sync/launchd");
    if (arg === "install") {
      const file = launchd.installSchedule({
        nodePath: process.execPath,
        repoRoot: process.cwd(),
        dataDir,
        logFile: path.join(dataDir, "logs", "sync.log"),
      });
      console.log(`Scheduled. It checks every morning at 08:30 and syncs when the last sync is ${process.env.SYNC_EVERY_DAYS ?? 3}+ days old.\n${file}`);
      return 0;
    }
    if (arg === "remove") {
      console.log(launchd.removeSchedule() ? "Schedule removed." : "No schedule was installed.");
      return 0;
    }
  }

  console.error("Usage: sync [--force] [--show] | login | schedule install|remove");
  return 64;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
