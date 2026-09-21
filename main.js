import { getEmbedding } from "./getEmbedding";
import { parseCollection } from "./parseCollection";
import { getCosineSimilarity } from "./getEmbedding"

import SpriteText from "https://esm.sh/three-spritetext";

let noteArr = await parseCollection()
const embeddingArr = [] // Cache for embedding data
const linkStrengthArr = [] // Cache for link strength data
const linkArrIn = []
const linkArrOut = []
console.log(noteArr)

// Initialize user input data for future use
const deckInput = document.getElementById("deckChoice");
const fieldInput = document.getElementById("fieldChoice")
const alternateCollectionInput = document.getElementById("alternateCollectionChoice")
const CreateGraphButton = document.getElementById("CreateGraphButton")

CreateGraphButton.addEventListener("click", async () => {
    // Computes the graph based on available info
    embeddingArr.length = 0;
    
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
        const noteContent = noteArr[i].fields // Make this field specific later
        //console.log("Note content is " + noteContent.split("\u001f")[1])
        const embedding = (await getEmbedding(noteContent.split("\u001f")[5]))
        embeddingArr.push(embedding.embeddings[0])
        if ((i+1) % 10 == 0){
            document.getElementById("totalEmbeddedNotes").innerHTML = "Total Embedded Notes " + (i+1);
        }
    }
    console.log("Embedding array: ", embeddingArr)
    document.getElementById("statusMessage").innerHTML = "Computing Cosine Similarity...";

    // Compute cosine similarity
    let totalSimilarity = 0
    let comparisons = 0
    const mode = "fixedNeighbors" // "standard" or "fixedNeighbors"

    if (mode == "standard"){
        for (let i = 0; i < embeddingArr.length; i++){
            for (let j = i+1; j < embeddingArr.length; j++){
                
                const similarity = getCosineSimilarity(embeddingArr[i], embeddingArr[j])
                totalSimilarity += similarity
                comparisons += 1
                //console.log("Similarity is ", similarity)
                //console.log("i", i, "j", j)
                // Create link between nodes if...
                if (similarity > .95){
                    linkArrIn.push(i)
                    linkArrOut.push(j)
                    linkStrengthArr.push(similarity)
                }
            } 
        }
    } else if (mode == "fixedNeighbors"){
        const totalNeighbors = 2; // Will require user interface later
        for (let i = 0; i < embeddingArr.length; i++){
            const rankedSimilarities = []
            for (let j = 0; j < embeddingArr.length; j++){
                if (i != j){
                    const indexedSimilarity = new Object()
                    indexedSimilarity.similarity = getCosineSimilarity(embeddingArr[i], embeddingArr[j])
                    indexedSimilarity.index = j

                    rankedSimilarities.push(indexedSimilarity)
                    
                    totalSimilarity += indexedSimilarity.similarity
                    comparisons += 1
                    //console.log("Similarity is ", similarity)
                    //console.log("i", i, "j", j)
                    // Create link between nodes if...
                    //if (similarity > .95){
                        //linkArrIn.push(i)
                        //linkArrOut.push(j)
                    //}
                }
                
            } 

            rankedSimilarities.sort(function(a, b) {return (a.similarity > b.similarity) ? -1 : ((b.similarity > a.similarity) ? 1 : 0);});
            //objs.sort(function(a,b) {return (a.last_nom > b.last_nom) ? 1 : ((b.last_nom > a.last_nom) ? -1 : 0);} );
            //console.log(rankedSimilarities)

            for (let j = 0; j < Math.min(totalNeighbors, rankedSimilarities.length); j++){
                linkArrIn.push(i)
                linkArrOut.push(rankedSimilarities[j].index)
                linkStrengthArr.push(rankedSimilarities[j].similarity)
            }

        }

        
    }
    console.log("Average similarity is: ", totalSimilarity/comparisons)
    
    // Normalize length strength array to use range from 0 to 1 (for opacity)
    let max = 0
    let min = 1
    for (let i = 0; i < linkStrengthArr.length; i++){
        max = Math.max(max, linkStrengthArr[i])
        min = Math.min(min, linkStrengthArr[i])
    }
    for (let i = 0; i < linkStrengthArr.length; i++){
        linkStrengthArr[i] = (((linkStrengthArr[i]-min)/(max - min)))
    }
    console.log("Link Strengths", linkStrengthArr)
    

    const linkData = []
    for (let i = 0; i < linkArrIn.length; i++){
        const linkObj = new Object()
        linkObj.inLink = linkArrIn[i];
        linkObj.outLink = linkArrOut[i];
        linkObj.strength = linkStrengthArr[i];
        linkData.push(linkObj)
    }
    
    linkData.sort(function(a, b) {return (a.strength >= b.strength) ? -1 : ((a.strength < b.strength) ? 1 : 0);});
    for (let i = 0; i < linkData.length; i++){
        linkData[i].rank = (i+1)
    }
    console.log("Link Data (sorted", linkData)

    document.getElementById("statusMessage").innerHTML = "Drawing Graph"
    drawGraph3D(noteArr, embeddingArr, linkArrIn, linkArrOut, linkStrengthArr, linkData)

    document.getElementById("statusMessage").innerHTML = "Idle...";
})



async function drawGraph3D(noteArray, embeddingArray, inLinks, outLinks, linkStrengths, sortedLinkData){
    

    //console.log(inLinks)
    //console.log(outLinks)
    const gData = {
    nodes: [...embeddingArray.keys()].map(i => ({ id: i })),
    links: inLinks.map((source, index) => ({
        source,
        target: outLinks[index],
        strength: linkStrengths[index],
        rank: sortedLinkData[index].rank
        }))
    };
    

    const graphEl = document.getElementById('graph');
    if (graphEl) {
        graphEl.replaceChildren();
        const Graph = new ForceGraph3D(graphEl)
            .linkDirectionalParticles(1)
            .graphData(gData)
            .nodeId('id')
            .backgroundColor('rgb(255, 255, 255)')
            .nodeColor(node => 'rgb(0, 255, 0)')
            //.nodeColor(node => '')
            .nodeThreeObject(node => {
                //const sprite = new SpriteText(node.id)
                const sprite = new SpriteText(noteArray[node.id].fields.split("\u001f")[5]);
                sprite.material.depthWrite = false; // make sprite background transparent
                
                sprite.color = node.color;
                sprite.textHeight = 16;
                sprite.center.y = -0.6; // shift above node
                return sprite;
            })
            .nodeThreeObjectExtend(true)
            .linkColor(link => {
                const shade = 255-Math.round((link.rank / sortedLinkData.length)*255);
                return `rgb(${shade}, ${shade}, ${shade})`;
            })
            .linkOpacity(link => {
                const opacity = 1-Math.round((link.rank / sortedLinkData.length)*255)
                return opacity
            })
            .linkWidth(1);

        
    }
}


async function drawGraph2D(noteArray, embeddingArray, inLinks, outLinks, linkStrengths, sortedLinkStrengths){
    console.log(inLinks)
    console.log(outLinks)
    const gData = {
    nodes: [...embeddingArray.keys()].map(i => ({ id: i })),
    links: inLinks.map((source, index) => ({
        source,
        target: outLinks[index]
        }))
    };

    const graphEl = document.getElementById('graph');
    if (graphEl) {
        const Graph = new ForceGraph(graphEl)
            //.linkDirectionalParticles(1)
            .graphData(gData)
            .nodeId('id')
            .nodeAutoColorBy('group')
            .nodeCanvasObject((node, ctx, globalScale) => {
                const label = noteArray[node.id].fields.split("\u001f")[1];
                const fontSize = 25/globalScale;
                ctx.font = `${fontSize}px Sans-Serif`;
                const textWidth = ctx.measureText(label).width;
                const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding

                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);

                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = "rgb(33, 38, 56)";
                ctx.fillText(label, node.x, node.y);

                node.__bckgDimensions = bckgDimensions; // to re-use in nodePointerAreaPaint
            })

        
    }
}



