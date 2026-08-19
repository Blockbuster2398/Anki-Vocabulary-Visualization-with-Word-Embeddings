import { getEmbedding } from "./getEmbedding";
import { parseCollection } from "./parseCollection";
import { getCosineSimilarity } from "./getEmbedding"

let note_arr = await parseCollection()
const embedding_arr = [] // Cache for embedding data
console.log(note_arr)

// Initialize user input data for future use
const deckInput = document.getElementById("deckChoice");
const fieldInput = document.getElementById("fieldChoice")
const alternateCollectionInput = document.getElementById("alternateCollectionChoice")
const CreateGraphButton = document.getElementById("CreateGraphButton")

CreateGraphButton.addEventListener("click", async () => {
    // Computes the graph based on available info
    embedding_arr.length = 0;
    
    // Assign user inputs now that they have (presumable) been entered
    const selectedDeck = deckInput.value;
    const selectedField = fieldInput.value;
    const alternateCollection = alternateCollectionInput.value;
    //console.log(selectedDeck, selectedField, alternateCollection)
    
    document.getElementById("statusMessage").innerHTML = "Creating embeddings...";
    document.getElementById("totalEmbeddedNotes").innerHTML = "Total Embedded Notes 0";

    // Compute note embeddings
    //for (let i = 0; i < note_arr.length; i++){
    for (let i = 0; i < 100; i++){
        //console.log(note_arr[i])
        const noteContent = note_arr[i].fields // Make this field specific later
        const embedding = (await getEmbedding(noteContent))
        embedding_arr.push(embedding.embeddings[0])
        if ((i+1) % 10 == 0){
            document.getElementById("totalEmbeddedNotes").innerHTML = "Total Embedded Notes " + (i+1);
        }
    }
    console.log("Embedding array: ", embedding_arr)
    document.getElementById("statusMessage").innerHTML = "Computing Cosine Similarity...";

    // Compute cosine similarity
    let totalSimilarity = 0
    let comparisons = 0
    for (let i = 0; i < embedding_arr.length; i++){
        for (let j = i+1; j < embedding_arr.length; j++){
            
            const similarity = getCosineSimilarity(embedding_arr[i], embedding_arr[j])
            totalSimilarity += similarity
            comparisons += 1
            console.log("Similarity is ", similarity)
        } 
    }
    console.log("Average similarity is: ", totalSimilarity/comparisons)


    document.getElementById("statusMessage").innerHTML = "Idle...";
})








