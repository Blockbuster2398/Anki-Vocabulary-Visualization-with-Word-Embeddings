import { getEmbedding, getCosineSimilarity } from "./getEmbedding";
import { parseCollection } from "./parseCollection";
import SpriteText from "https://esm.sh/three-spritetext";

let noteArr = await parseCollection();
const embeddingArr = [];
const embeddingCache = new Map();
const linkStrengthArr = [];
const linkArrIn = [];
const linkArrOut = [];

const deckInput = document.getElementById("deckChoice");
const fieldInput = document.getElementById("fieldChoice");
const alternateCollectionInput = document.getElementById("alternateCollectionChoice");
const CreateGraphButton = document.getElementById("CreateGraphButton");
const PauseGraphButton = document.getElementById("PauseGraphButton");
const ColorModeChoice = document.getElementById("ColorModeChoice");
const NoteOrderChoice = document.getElementById("NoteOrderChoice");
let computationState = null;
let activeGraphState = null;

ColorModeChoice.addEventListener("change", () => {
    if (activeGraphState) {
        activeGraphState.setColorMode(ColorModeChoice.value);
    }
});

PauseGraphButton.addEventListener("click", () => {
    if (!computationState) {
        return;
    }

    computationState.paused = !computationState.paused;
    PauseGraphButton.textContent = computationState.paused ? "Resume" : "Pause";
    document.getElementById("statusMessage").innerHTML = computationState.paused
        ? "Paused"
        : "Creating embeddings...";

    if (!computationState.paused) {
        for (const resolve of computationState.resumeResolvers) {
            resolve();
        }
        computationState.resumeResolvers.clear();
    }
});

CreateGraphButton.addEventListener("click", async () => {
    if (computationState) {
        return;
    }

    computationState = {
        paused: false,
        resumeResolvers: new Set()
    };
    PauseGraphButton.disabled = false;
    PauseGraphButton.textContent = "Pause";

    embeddingArr.length = 0;
    linkStrengthArr.length = 0;
    linkArrIn.length = 0;
    linkArrOut.length = 0;

    const selectedDeck = deckInput.value;
    const selectedField = fieldInput.value;
    const alternateCollection = alternateCollectionInput.value;
    const processingNotes = NoteOrderChoice.value === "random"
        ? shuffleNotes(noteArr)
        : [...noteArr];
    console.log(selectedDeck, selectedField, alternateCollection);

    document.getElementById("statusMessage").innerHTML = "Creating embeddings...";
    document.getElementById("totalEmbeddedNotes").innerHTML = "Total Embedded Notes 0";

    const graphState = createGraph3D(processingNotes);
    activeGraphState = graphState;
    const totalNeighbors = 2;
    const graphUpdateInterval = 50;
    const noteLimit = Math.min(9000, processingNotes.length);

    for (let i = 0; i < noteLimit; i++) {
        await waitForResume(computationState);
        const noteContent = processingNotes[i].fields;
        const embeddingText = noteContent.split("\u001f")[1];
        let noteEmbedding = embeddingCache.get(embeddingText);
        if (!noteEmbedding) {
            const embedding = await getEmbedding(embeddingText);
            noteEmbedding = embedding.embeddings[0];
            embeddingCache.set(embeddingText, noteEmbedding);
        }
        embeddingArr.push(noteEmbedding);

        const nearestNeighbors = [];
        for (let j = 0; j < i; j++) {
            const candidate = {
                similarity: getCosineSimilarity(embeddingArr[i], embeddingArr[j]),
                index: j
            };
            const insertionIndex = nearestNeighbors.findIndex(
                neighbor => candidate.similarity > neighbor.similarity
            );
            if (insertionIndex === -1 && nearestNeighbors.length < totalNeighbors) {
                nearestNeighbors.push(candidate);
            } else if (insertionIndex !== -1) {
                nearestNeighbors.splice(insertionIndex, 0, candidate);
            }
            if (nearestNeighbors.length > totalNeighbors) {
                nearestNeighbors.pop();
            }
        }

        for (const neighbor of nearestNeighbors) {
            linkArrIn.push(i);
            linkArrOut.push(neighbor.index);
            linkStrengthArr.push(neighbor.similarity);
        }

        if ((i + 1) % graphUpdateInterval === 0 || i === noteLimit - 1) {
            updateGraph3D(graphState, processingNotes, embeddingArr, linkArrIn, linkArrOut, linkStrengthArr);
        }
        document.getElementById("totalEmbeddedNotes").innerHTML = "Total Embedded Notes " + (i + 1);
        document.getElementById("statusMessage").innerHTML = "Embedding and linking note " + (i + 1) + "...";
        await new Promise(resolve => requestAnimationFrame(resolve));
    }

    graphState.stopAnimation();
    document.getElementById("statusMessage").innerHTML = "Idle...";
    PauseGraphButton.disabled = true;
    computationState = null;
});

function shuffleNotes(notes) {
    const shuffledNotes = [...notes];
    for (let index = shuffledNotes.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffledNotes[index], shuffledNotes[randomIndex]] = [
            shuffledNotes[randomIndex],
            shuffledNotes[index]
        ];
    }
    return shuffledNotes;
}

function waitForResume(state) {
    if (!state.paused) {
        return Promise.resolve();
    }

    return new Promise(resolve => {
        state.resumeResolvers.add(resolve);
    });
}

function createGraph3D(noteArray) {
    const gData = { nodes: [], links: [] };
    let colorMode = ColorModeChoice.value;
    const graphEl = document.getElementById("graph");
    graphEl.replaceChildren();

    const Graph = new ForceGraph3D(graphEl)
        .linkDirectionalParticles(1)
        .graphData(gData)
        .nodeId("id")
        .backgroundColor("rgb(255, 255, 255)")
        .nodeColor(node => {
            const interval = Number(node.interval);
            if (colorMode === "gradient") {
                const rankedIntervals = [...new Set(gData.nodes
                    .map(currentNode => Number(currentNode.interval))
                    .filter(Number.isFinite))].sort((first, second) => first - second);
                const intervalRank = rankedIntervals.indexOf(interval);
                const relativeInterval = intervalRank > -1 && rankedIntervals.length > 1
                    ? intervalRank / (rankedIntervals.length - 1)
                    : 0;
                const red = Math.round(255 * (1 - relativeInterval));
                const green = Math.round(255 * relativeInterval);
                return `rgb(${red}, ${green}, 0)`;
            }
            if (Number.isFinite(interval) && interval >= 21) {
                return "rgb(0, 200, 0)";
            }
            if (Number.isFinite(interval) && interval >= 1) {
                return "rgb(255, 200, 0)";
            }
            return "rgb(220, 0, 0)";
        })
        .nodeThreeObject(node => {
            const sprite = new SpriteText(noteArray[node.id].fields.split("\u001f")[1]);
            sprite.material.depthWrite = false;
            sprite.color = node.color;
            sprite.textHeight = 16;
            sprite.center.y = -0.6;
            return sprite;
        })
        .nodeThreeObjectExtend(true)
        .linkColor(link => {
            const shade = 255 - Math.round((link.rank / gData.links.length) * 255);
            return `rgb(${shade}, ${shade}, ${shade})`;
        })
        .linkOpacity(link => 1 - (link.rank / gData.links.length))
        .linkWidth(1);

    const controls = Graph.controls();
    const camera = Graph.camera();
    const target = controls.target;
    let animating = true;
    const zoomStep = 0.0005;
    const initialDistance = camera.position.distanceTo(target);
    const maximumDistance = initialDistance * 2;
    let distance = initialDistance;
    const stopRotation = () => {
        animating = false;
    };

    controls.addEventListener("start", stopRotation);
    graphEl.addEventListener("pointerdown", stopRotation);
    graphEl.addEventListener("wheel", stopRotation, { passive: true });
    graphEl.addEventListener("touchstart", stopRotation, { passive: true });

    const zoomCamera = () => {
        if (!animating) {
            return;
        }

        distance = Math.min(distance + initialDistance * zoomStep, maximumDistance);
        const direction = camera.position.clone().sub(target).normalize();
        camera.position.copy(target).add(direction.multiplyScalar(distance));
        camera.lookAt(target);
        controls.update();
        if (distance < maximumDistance) {
            requestAnimationFrame(zoomCamera);
        }
    };
    requestAnimationFrame(zoomCamera);

    return {
        Graph,
        gData,
        setColorMode: mode => {
            colorMode = mode;
            Graph.graphData({
                nodes: [...gData.nodes],
                links: [...gData.links]
            });
        },
        stopAnimation: () => {
            animating = false;
        }
    };
}

function updateGraph3D(graphState, noteArray, embeddingArray, inLinks, outLinks, linkStrengths) {
    const { Graph, gData } = graphState;

    for (let nodeIndex = gData.nodes.length; nodeIndex < embeddingArray.length; nodeIndex++) {
        gData.nodes.push({
            id: nodeIndex,
            interval: Number(noteArray[nodeIndex].interval)
        });
    }
    gData.links = inLinks.map((source, index) => ({
        source,
        target: outLinks[index],
        strength: linkStrengths[index]
    }));

    const rankedLinks = [...gData.links].sort((a, b) => b.strength - a.strength);
    rankedLinks.forEach((link, index) => {
        link.rank = index + 1;
    });
    gData.links.forEach(link => {
        link.rank = rankedLinks.indexOf(link) + 1;
    });
    Graph.graphData({
        nodes: [...gData.nodes],
        links: [...gData.links]
    });
}

async function drawGraph2D(noteArray, embeddingArray, inLinks, outLinks) {
    const gData = {
        nodes: [...embeddingArray.keys()].map(i => ({ id: i })),
        links: inLinks.map((source, index) => ({
            source,
            target: outLinks[index]
        }))
    };

    const graphEl = document.getElementById("graph");
    if (graphEl) {
        const Graph = new ForceGraph(graphEl)
            .graphData(gData)
            .nodeId("id")
            .nodeAutoColorBy("group")
            .nodeCanvasObject((node, ctx, globalScale) => {
                const label = noteArray[node.id].fields.split("\u001f")[1];
                const fontSize = 25 / globalScale;
                ctx.font = `${fontSize}px Sans-Serif`;
                const textWidth = ctx.measureText(label).width;
                const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

                ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
                ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "rgb(33, 38, 56)";
                ctx.fillText(label, node.x, node.y);
                node.__bckgDimensions = bckgDimensions;
            });
    }
}
