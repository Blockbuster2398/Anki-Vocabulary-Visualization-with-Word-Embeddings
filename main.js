import { getCosineSimilarity } from "./getEmbedding";
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
const PauseNoteAdditionButton = document.getElementById("PauseNoteAdditionButton");
const PauseAnimationButton = document.getElementById("PauseAnimationButton");
const ColorModeChoice = document.getElementById("ColorModeChoice");
const NoteOrderChoice = document.getElementById("NoteOrderChoice");
const EmbeddingModelChoice = document.getElementById("EmbeddingModelChoice");
const ProjectionChoice = document.getElementById("ProjectionChoice");
const projectionMatrixCache = new Map();
const embeddingWorker = new Worker(new URL("./embeddingWorker.ts", import.meta.url), { type: "module" });
const pendingEmbeddingRequests = new Map();
let nextEmbeddingRequestId = 0;
let computationState = null;
let activeGraphState = null;

embeddingWorker.addEventListener("message", event => {
    const { id, embedding, error } = event.data;
    const request = pendingEmbeddingRequests.get(id);
    if (!request) {
        return;
    }

    pendingEmbeddingRequests.delete(id);
    if (error) {
        request.reject(new Error(error));
    } else {
        request.resolve(embedding);
    }
});

embeddingWorker.addEventListener("error", error => {
    for (const request of pendingEmbeddingRequests.values()) {
        request.reject(error.error || new Error(error.message));
    }
    pendingEmbeddingRequests.clear();
});

ColorModeChoice.addEventListener("change", () => {
    if (activeGraphState) {
        activeGraphState.setColorMode(ColorModeChoice.value);
    }
});

PauseNoteAdditionButton.addEventListener("click", () => {
    if (!computationState) {
        return;
    }

    computationState.notesPaused = !computationState.notesPaused;
    PauseNoteAdditionButton.textContent = computationState.notesPaused
        ? "Resume note addition"
        : "Pause note addition";
    document.getElementById("statusMessage").innerHTML = computationState.notesPaused
        ? "Note addition paused"
        : "Creating embeddings...";

    if (!computationState.notesPaused) {
        for (const resolve of computationState.resumeResolvers) {
            resolve();
        }
        computationState.resumeResolvers.clear();
    }
});

PauseAnimationButton.addEventListener("click", () => {
    if (!activeGraphState) {
        return;
    }

    const animationPaused = activeGraphState.toggleAnimation();
    PauseAnimationButton.textContent = animationPaused ? "Resume animation" : "Pause animation";
});

CreateGraphButton.addEventListener("click", async () => {
    if (computationState) {
        return;
    }

    computationState = {
        notesPaused: false,
        resumeResolvers: new Set()
    };
    PauseNoteAdditionButton.disabled = false;
    PauseNoteAdditionButton.textContent = "Pause note addition";
    PauseAnimationButton.disabled = false;
    PauseAnimationButton.textContent = "Pause animation";

    embeddingArr.length = 0;
    linkStrengthArr.length = 0;
    linkArrIn.length = 0;
    linkArrOut.length = 0;

    const selectedDeck = deckInput.value;
    const selectedField = fieldInput.value;
    const alternateCollection = alternateCollectionInput.value;
    const selectedModel = EmbeddingModelChoice.value;
    const projectionDimensions = Number(ProjectionChoice.value);
    const processingNotes = NoteOrderChoice.value === "random"
        ? shuffleNotes(noteArr)
        : [...noteArr];
    console.log(selectedDeck, selectedField, alternateCollection);

    document.getElementById("statusMessage").innerHTML = "Creating embeddings...";
    document.getElementById("totalEmbeddedNotes").innerHTML = "Total Embedded Notes 0";

    const graphState = createGraph3D(processingNotes);
    activeGraphState = graphState;
    const totalNeighbors = 2;
    const graphUpdateInterval = 500;
    const noteLimit = Math.min(9000, processingNotes.length);
    let lastLinkedIndex = 0;

    try {
        for (let i = 0; i < noteLimit; i++) {
            await waitForResume(computationState);
            const noteContent = processingNotes[i].fields;
            const embeddingText = noteContent.split("\u001f")[1];
            const embeddingCacheKey = `${selectedModel}\u0000${projectionDimensions}\u0000${embeddingText}`;
            let noteEmbedding = embeddingCache.get(embeddingCacheKey);
            if (!noteEmbedding) {
                const embedding = await requestEmbedding(embeddingText, selectedModel);
                await waitForResume(computationState);
                noteEmbedding = projectEmbedding(embedding, projectionDimensions);
                embeddingCache.set(embeddingCacheKey, noteEmbedding);
            }
            embeddingArr.push(noteEmbedding);

            if ((i + 1) % graphUpdateInterval === 0 || i === noteLimit - 1) {
                linkNewNotes(lastLinkedIndex, i, totalNeighbors);
                lastLinkedIndex = i + 1;
                updateGraph3D(graphState, processingNotes, embeddingArr, linkArrIn, linkArrOut, linkStrengthArr);
            }
            document.getElementById("totalEmbeddedNotes").innerHTML = "Total Embedded Notes " + (i + 1);
            document.getElementById("statusMessage").innerHTML = "Embedding note " + (i + 1) + "...";
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
    } catch (error) {
        console.error("Embedding failed:", error);
        document.getElementById("statusMessage").innerHTML = "Embedding failed. Check the browser console.";
    }

    graphState.stopAnimation();
    document.getElementById("statusMessage").innerHTML = "Idle...";
    PauseNoteAdditionButton.disabled = true;
    PauseNoteAdditionButton.textContent = "Pause note addition";
    computationState = null;
});

function requestEmbedding(text, model) {
    const id = nextEmbeddingRequestId++;
    return new Promise((resolve, reject) => {
        pendingEmbeddingRequests.set(id, { resolve, reject });
        embeddingWorker.postMessage({ id, text, model });
    });
}

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

function linkNewNotes(fromIndex, toIndex, totalNeighbors) {
    for (let i = fromIndex; i <= toIndex; i++) {
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
    }
}

function projectEmbedding(embedding, outputDimensions) {
    if (!outputDimensions || outputDimensions >= embedding.length) {
        return embedding;
    }

    const cacheKey = `${embedding.length}->${outputDimensions}`;
    let projectionMatrix = projectionMatrixCache.get(cacheKey);
    if (!projectionMatrix) {
        projectionMatrix = createProjectionMatrix(embedding.length, outputDimensions);
        projectionMatrixCache.set(cacheKey, projectionMatrix);
    }

    const projectedEmbedding = new Array(outputDimensions).fill(0);
    for (let outputIndex = 0; outputIndex < outputDimensions; outputIndex++) {
        for (let inputIndex = 0; inputIndex < embedding.length; inputIndex++) {
            projectedEmbedding[outputIndex] += embedding[inputIndex] * projectionMatrix[outputIndex][inputIndex];
        }
    }
    return projectedEmbedding;
}

function createProjectionMatrix(inputDimensions, outputDimensions) {
    let seed = 0x6d2b79f5 + outputDimensions;
    const nextRandom = () => {
        seed += 0x6d2b79f5;
        let value = seed;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    const scale = 1 / Math.sqrt(outputDimensions);
    return Array.from({ length: outputDimensions }, () =>
        Float32Array.from({ length: inputDimensions }, () =>
            (nextRandom() < 0.5 ? -1 : 1) * scale
        )
    );
}

function waitForResume(state) {
    if (!state.notesPaused) {
        return Promise.resolve();
    }

    return new Promise(resolve => {
        state.resumeResolvers.add(resolve);
    });
}

function createGraph3D(noteArray) {
    const gData = { nodes: [], links: [] };
    const graphState = {
        rankedIntervals: []
    };
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
                const rankedIntervals = graphState.rankedIntervals;
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
        rankedIntervals: graphState.rankedIntervals,
        setColorMode: mode => {
            colorMode = mode;
            Graph.graphData({
                nodes: [...gData.nodes],
                links: [...gData.links]
            });
        },
        toggleAnimation: () => {
            graphState.animationPaused = !graphState.animationPaused;
            if (graphState.animationPaused) {
                Graph.pauseAnimation();
            } else {
                Graph.resumeAnimation();
            }
            return graphState.animationPaused;
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
    graphState.rankedIntervals = [...new Set(gData.nodes
        .map(currentNode => Number(currentNode.interval))
        .filter(Number.isFinite))].sort((first, second) => first - second);
    gData.links = inLinks.map((source, index) => ({
        source,
        target: outLinks[index],
        strength: linkStrengths[index]
    }));

    const rankedLinks = [...gData.links].sort((a, b) => b.strength - a.strength);
    rankedLinks.forEach((link, index) => {
        link.rank = index + 1;
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