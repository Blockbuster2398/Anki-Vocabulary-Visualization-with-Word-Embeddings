import {
    Embedding,
    FilesetResolver,
    TextEmbedder
} from "@mediapipe/tasks-text";

let textEmbedder: TextEmbedder | null = null;

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
                    //"https://storage.googleapis.com/mediapipe-models/text_embedder/bert_embedder/float32/1/bert_embedder.tflite"
            },
            quantize: true
        }
    );

    console.log("Text embedder created!");
}

export async function getEmbedding(expression: string) {
    // Create the model if it hasn't been created yet
    if (!textEmbedder) {
        await createEmbedder();
    }
    if (textEmbedder === null) {
        throw new Error("Failed to initialize TextEmbedder");
    }
    return textEmbedder.embed(expression);
}

export function getCosineSimilarity(embedding1: Embedding, embedding2: Embedding){
    return TextEmbedder.cosineSimilarity(embedding1, embedding2)
}