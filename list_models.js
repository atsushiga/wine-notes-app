const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    console.log("Listing models...");
    try {
        // For some SDK versions, listModels is on the genAI instance or via a model manager
        // The current SDK documentation suggests using the API directly or checking supported methods.
        // But let's try to get a model and check info, or use the rest API if SDK doesn't expose list easily in this version.
        // Wait, standard SDK has generic model access.
        // Let's trying to just fetch a model that should exist and print error if specific.
        // Or actually, there is no direct listModels on GoogleGenerativeAI instance in some versions?
        // It might be on a ModelManager if exposed.

        // Let's try the raw Fetch approach to be sure.
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        if (data.models) {
            console.log("Available models:");
            data.models.forEach(m => {
                console.log(`- ${m.name} (${m.supportedGenerationMethods})`);
            });
        } else {
            console.log("No models found or error:", data);
        }
    } catch (e) {
        console.error(e);
    }
}

listModels();
