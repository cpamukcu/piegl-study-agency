// The macOS schedule: launchd wakes the sync every morning, and the sync itself decides
// whether the last good run is old enough (see isDue). A run missed while the Mac sleeps
// is made up on wake.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export const LABEL = "com.piegl.study-sync";

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type PlistOptions = {
  nodePath: string;
  repoRoot: string;
  logFile: string;
  dataDir: string;
  hour?: number;
  minute?: number;
};

export function buildPlist(o: PlistOptions): string {
  const args = [o.nodePath, path.join(o.repoRoot, "node_modules", "tsx", "dist", "cli.mjs"), path.join(o.repoRoot, "src", "sync", "cli.ts"), "sync"];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args.map((a) => `    <string>${xml(a)}</string>`).join("\n")}
  </array>
  <key>WorkingDirectory</key><string>${xml(o.repoRoot)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>DATA_DIR</key><string>${xml(o.dataDir)}</string>
    <key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>${o.hour ?? 8}</integer>
    <key>Minute</key><integer>${o.minute ?? 30}</integer>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${xml(o.logFile)}</string>
  <key>StandardErrorPath</key><string>${xml(o.logFile)}</string>
</dict>
</plist>
`;
}

export const plistPath = () => path.join(homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);

function launchctl(...args: string[]): void {
  execFileSync("launchctl", args, { stdio: "ignore" });
}

export function installSchedule(options: PlistOptions): string {
  if (process.platform !== "darwin") throw new Error("The schedule uses launchd, which exists only on macOS.");
  const file = plistPath();
  mkdirSync(path.dirname(file), { recursive: true });
  mkdirSync(path.dirname(options.logFile), { recursive: true, mode: 0o700 });
  writeFileSync(file, buildPlist(options));
  const domain = `gui/${process.getuid?.() ?? 501}`;
  try {
    launchctl("bootout", `${domain}/${LABEL}`);
  } catch {
    // Not loaded yet.
  }
  launchctl("bootstrap", domain, file);
  return file;
}

export function removeSchedule(): boolean {
  const file = plistPath();
  if (!existsSync(file)) return false;
  try {
    launchctl("bootout", `gui/${process.getuid?.() ?? 501}/${LABEL}`);
  } catch {
    // Already unloaded.
  }
  rmSync(file);
  return true;
}
