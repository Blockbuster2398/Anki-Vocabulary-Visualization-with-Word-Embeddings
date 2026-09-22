import { getEmbedding } from "./getEmbedding";

type EmbedRequest = {
    id: number;
    text: string;
    model: string;
};

self.onmessage = async (event: MessageEvent<EmbedRequest>) => {
    const { id, text, model } = event.data;

    try {
        const embedding = await getEmbedding(text, model);
        self.postMessage({
            id,
            embedding: embedding.embeddings[0]
        });
    } catch (error) {
        self.postMessage({
            id,
            error: error instanceof Error ? error.message : String(error)
        });
    }
};
