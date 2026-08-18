
//better-sqlite version
/*if (typeof window !== "undefined" || typeof document !== "undefined") {
  throw new Error("parse_col.js is a Node-only script and cannot be loaded in the browser. Use a browser-safe SQLite library like sql.js, or run this file in Node.");
}

import Database from "better-sqlite3";

const db = new Database("app.db");

const query = `
    CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name STRING NOT NULL,
        username STRING NOT NULL UNIQUE
    )
`;

console.log("Column parse file run");
db.exec(query);
console.log("Column parse file run");*/

import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

async function loadSampleDatabase() {
  const SQL = await initSqlJs({
    locateFile: () => wasmUrl,
  });

  const response = await fetch("/collection.sqlite");

  if (!response.ok) {
    throw new Error(`Failed to load /collection.sqlite: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const db = new SQL.Database(new Uint8Array(buffer));

  console.log("Loaded database");

  const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'");
  const cards = db.prepare("SELECT * FROM cards");
  
  
  while (stmt.step()) {
    console.log(stmt.getAsObject());
  }
}

loadSampleDatabase().catch((error) => {
  console.error("Database load failed:", error);
});