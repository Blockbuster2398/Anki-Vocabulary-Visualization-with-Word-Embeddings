import {
    FilesetResolver,
    TextEmbedder
} from "@mediapipe/tasks-text";

let textEmbedder: TextEmbedder;

async function createEmbedder() {
    console.log("Loading MediaPipe...");

    const textFiles = await FilesetResolver.forTextTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-text/wasm"
    );

    console.log("WASM loaded.");

    textEmbedder = await TextEmbedder.createFromOptions(
        textFiles,
        {
            baseOptions: {
                modelAssetPath:
                    "https://storage.googleapis.com/mediapipe-tasks/text_embedder/universal_sentence_encoder.tflite"
            },
            quantize: true
        }
    );
    // Embedding logic goes here
    console.log("Text embedder created!");

    const result1 = textEmbedder.embed("Pick it up").embeddings[0]
    const result2 = textEmbedder.embed("Winter breeze").embeddings[0]
    console.log("Embedding:", result1.quantizedEmbedding);
    console.log("Embedding:", result1.quantizedEmbedding);
    const similarity = TextEmbedder.cosineSimilarity(result1, result2)
    console.log(similarity)

}

createEmbedder();