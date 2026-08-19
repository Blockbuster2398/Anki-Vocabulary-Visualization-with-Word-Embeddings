import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

export async function parseCollection() {
  
  let formattedNotes = []
  
  const SQL = await initSqlJs({
    locateFile: () => wasmUrl,
  });

  const response = await fetch("/collection.sqlite");

  if (!response.ok) {
    throw new Error(`Failed to load /collection.sqlite: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const db = new SQL.Database(new Uint8Array(buffer));

  //console.log("Loaded database");

  // Load all desired note/card information from the database
  const notesTable = db.prepare("SELECT did as deck_id, nid as note_id, flds as fields, notes.mid as model_id, lapses FROM cards inner JOIN notes ON cards.nid = notes.id ORDER BY did, nid");

  // Load all deck information from the deck ID to deck name mapping (json)
  let modelsJson;
  let decksJson;
  
  const collectionTable = db.prepare("SELECT * FROM col");
  while (collectionTable.step()) {
    // Object containing all information in the Anki col table
    const collectionDetails = collectionTable.getAsObject();
    // Parse the json string in the models column to get note id to fields mapping
    modelsJson = JSON.parse(collectionDetails.models);
    // Parse the json string in the decks column to get deck id to deck name mapping
    decksJson = JSON.parse(collectionDetails.decks);
    
    //console.log("Collection Note Models:", modelsJson);
    //console.log("Collection Decks:", decksJson);
  }
  
  while (notesTable.step()) {
    const rawNote = notesTable.getAsObject();
    const formattedNote = parseNote(rawNote, modelsJson, decksJson);
    formattedNotes.push(formattedNote);
  }

  //console.log(formattedNotes);
  return formattedNotes
}



parseCollection().catch((error) => {
  console.error("Database load failed:", error);
});

function parseNote(rawNote, colModelJson, colDeckJson){
  // Takes a raw note object and manually formats its note model and deck info information
  //console.log("(Before), ", rawNote, typeof rawNote.model_id);
  rawNote.model_name = colModelJson[rawNote.model_id]["name"];
  rawNote.deck_name = colDeckJson[rawNote.deck_id]["name"];
  //console.log("(After), ", rawNote);
  return rawNote
}