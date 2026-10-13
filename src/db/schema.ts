// Each entry is one migration; never edit an entry that has shipped, add a new one.
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE terms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    weeks INTEGER NOT NULL CHECK (weeks > 0),
    periods_json TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE courses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    code TEXT,
    instructor TEXT,
    semester TEXT,
    color TEXT NOT NULL DEFAULT '#2f5d62',
    links_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT,
    ai_allowed INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'zju')),
    external_id TEXT UNIQUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE meeting_times (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    term_id TEXT REFERENCES terms(id) ON DELETE SET NULL,
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
    start_minute INTEGER NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
    end_minute INTEGER NOT NULL CHECK (end_minute > start_minute AND end_minute <= 1440),
    room TEXT,
    weeks_json TEXT NOT NULL DEFAULT '[]',
    external_id TEXT UNIQUE
  );

  CREATE TABLE recurrence_rules (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    lead_minutes INTEGER NOT NULL CHECK (lead_minutes >= 0),
    est_minutes INTEGER CHECK (est_minutes > 0),
    importance INTEGER NOT NULL DEFAULT 2 CHECK (importance BETWEEN 1 AND 3),
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('assignment', 'reading', 'presentation', 'exam', 'personal', 'prep')),
    title TEXT NOT NULL,
    due_at INTEGER,
    est_minutes INTEGER CHECK (est_minutes > 0),
    importance INTEGER NOT NULL DEFAULT 2 CHECK (importance BETWEEN 1 AND 3),
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done', 'postponed')),
    notes TEXT,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'zju', 'rule')),
    external_id TEXT UNIQUE,
    rule_id TEXT REFERENCES recurrence_rules(id) ON DELETE SET NULL,
    occurrence_key TEXT,
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (rule_id, occurrence_key)
  );

  CREATE INDEX tasks_due_at ON tasks(due_at);

  CREATE TABLE import_runs (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    file_name TEXT NOT NULL,
    imported_at INTEGER NOT NULL,
    counts_json TEXT NOT NULL
  );
  `,
  // 2: soft delete, so a deleted prep task or ZJU task is not created again.
  `ALTER TABLE tasks ADD COLUMN deleted_at INTEGER;`,
  // 3: remember what ZJU last sent, so an import only changes fields the owner has not edited.
  `
  ALTER TABLE tasks ADD COLUMN source_due_at INTEGER;
  ALTER TABLE courses ADD COLUMN source_code TEXT;
  ALTER TABLE courses ADD COLUMN source_instructor TEXT;
  ALTER TABLE courses ADD COLUMN source_semester TEXT;
  UPDATE tasks SET source_due_at = due_at WHERE source = 'zju';
  UPDATE courses SET source_code = code, source_instructor = instructor, source_semester = semester WHERE source = 'zju';
  `,
];
