import { pipeline } from "@huggingface/transformers";

type FeatureExtractor = (text: string, options: {
    pooling: "mean";
    normalize: boolean;
}) => Promise<{ data: Float32Array }>;

let textEmbedder: FeatureExtractor | null = null;
let loadedModel: string | null = null;

async function createEmbedder(modelName: string) {
    console.log(`Loading multilingual embedding model: ${modelName}`);
    textEmbedder = await pipeline(
        "feature-extraction",
        modelName,
        { dtype: "q8" }
    ) as unknown as FeatureExtractor;
    loadedModel = modelName;
    console.log(`Multilingual embedding model created: ${modelName}`);
}

export async function getEmbedding(
    expression: string,
    modelName = "Xenova/paraphrase-multilingual-MiniLM-L12-v2"
) {
    // Create the model if it hasn't been created yet
    if (!textEmbedder || loadedModel !== modelName) {
        await createEmbedder(modelName);
    }
    if (textEmbedder === null) {
        throw new Error("Failed to initialize TextEmbedder");
    }
    const embedding = await textEmbedder(expression, {
        pooling: "mean",
        normalize: true
    });
    return { embeddings: [Array.from(embedding.data)] };
}

export function getCosineSimilarity(embedding1: number[], embedding2: number[]) {
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let index = 0; index < embedding1.length; index++) {
        dotProduct += embedding1[index] * embedding2[index];
        magnitude1 += embedding1[index] ** 2;
        magnitude2 += embedding2[index] ** 2;
    }

    return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
}