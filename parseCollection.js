import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

export async function parseCollection() {
  
  let formattedNotes = []
  
  const SQL = await initSqlJs({
    locateFile: () => wasmUrl,
  });

  //const response = await fetch("/collection.sqlite");
  const response = await fetch("/simpleChinese.sqlite");
  //const response = await fetch("/simpleSpanish.sqlite");


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

export function sanitizeFields(fieldStr) {
  // Anki fields can contain repeated HTML, escaped newlines, and cloze markers.
  fieldStr = fieldStr
    .replace(/'/g, " ")
    .replace(/\\n|\r?\n/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/{{c\d+::/gi, " ")
  //fieldStr = fieldStr.replace("\u001F", " ")  //removes \x1F
  ////fieldStr = re.sub("\[sound:.*?\]", " ", content)  //extract title of
  //images (usually OCRed text) before html is removed
  ////fieldStr = re.sub("paste-.*?\....", "", content)
  ////fieldStr = re.sub("title=(\".*?\")", ">OCR:\\1<", content)  //extract
  //title of images (usually OCR'd text) before html is removed
  ////fieldStr = re.sub("<.*?>", " ", content)  //removes all html
  ////fieldStr = re.sub("{{c\d+::", "", content)  //removes clozing
  fieldStr = fieldStr.replace(/}}/g, " ")  //replace clozing with a space
  fieldStr = fieldStr.replace(/::/g, " ")  //part of clozing + punct
  fieldStr = fieldStr.replace(/&nbsp;/g, " ")  //html spaces
  fieldStr = fieldStr.replace(/\//g, " ")  //slash
  return fieldStr
}

function parseNote(rawNote, colModelJson, colDeckJson){
  // Takes a raw note object and manually formats its note model and deck info information
  //console.log("(Before), ", rawNote, typeof rawNote.model_id);
  rawNote.model_name = colModelJson[rawNote.model_id]["name"];
  rawNote.deck_name = colDeckJson[rawNote.deck_id]["name"];
  rawNote.fields = sanitizeFields(rawNote.fields)
  //console.log("(After), ", rawNote);
  return rawNote
}

