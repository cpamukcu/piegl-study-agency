// Server-only: decides where private study data lives. Never import from a client component.
import { mkdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export const DEFAULT_DATA_DIR = "~/PIEGL-data";

export class DataDirError extends Error {
  name = "DataDirError";
}

type ResolveOptions = {
  repoRoot: string;
  home?: string;
  caseInsensitive?: boolean;
};

function expandHome(value: string, home: string): string {
  if (value === "~") return home;
  if (value.startsWith("~/")) return path.join(home, value.slice(2));
  return value;
}

function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  if (rel === "") return true;
  return !(rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel));
}

// Follows symlinks so a linked path cannot sneak the data folder into the repo.
// The folder may not exist yet, so resolve its nearest existing ancestor.
function realpathOfNearestExisting(p: string): string {
  const missing: string[] = [];
  let current = p;
  for (;;) {
    try {
      return path.join(realpathSync.native(current), ...missing);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return p;
      missing.unshift(path.basename(current));
      current = parent;
    }
  }
}

export function resolveDataDir(raw: string | undefined, options: ResolveOptions): string {
  const { repoRoot, home = homedir(), caseInsensitive = process.platform === "darwin" } = options;
  const value = raw?.trim() || DEFAULT_DATA_DIR;
  const expanded = expandHome(value, home);

  if (!path.isAbsolute(expanded)) {
    throw new DataDirError(`DATA_DIR must be an absolute path or start with ~/ (got "${value}").`);
  }

  const resolved = path.resolve(/*turbopackIgnore: true*/ expanded);
  const root = path.resolve(/*turbopackIgnore: true*/ repoRoot);
  const fold = (p: string) => (caseInsensitive ? p.toLowerCase() : p);
  const realResolved = fold(realpathOfNearestExisting(resolved));
  const realRoot = fold(realpathOfNearestExisting(root));

  if (isInside(realResolved, realRoot)) {
    throw new DataDirError(`DATA_DIR must be outside the repository (${root}). Got ${resolved}.`);
  }
  return resolved;
}

export function getDataDir(): string {
  return resolveDataDir(process.env.DATA_DIR, { repoRoot: process.cwd() });
}

export function ensureDataDir(dir: string): string {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}
