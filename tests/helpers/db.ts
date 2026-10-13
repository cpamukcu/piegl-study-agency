import { openDb, type Db } from "@/db/connection";

export function memoryDb(): Db {
  return openDb(":memory:");
}
