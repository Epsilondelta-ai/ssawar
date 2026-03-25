import fs from "node:fs";
import path from "node:path";

for (const file of ["test.db", "test.db-journal"]) {
  try {
    fs.unlinkSync(path.join(process.cwd(), file));
  } catch {}
}
