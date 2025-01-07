import Replicate from "replicate";

// We read the environment variable on the server (no client exposure)
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { input_image_dataurl, prompt, style_name } = request.body;

    // We'll convert the base64 dataURL to pass it to Replicate
    // Data URLs can be used directly as the input_image for many models
    const input = {
      prompt: prompt || "A photo of a person img",
      input_image: input_image_dataurl,
      style_name: style_name || "(No style)",

      // For simplicity, set some defaults (you can adjust as you wish)
      seed: null,  // let Replicate choose random seed
      num_steps: 20,
      guidance_scale: 5,
      negative_prompt: "nsfw, lowres, bad anatomy, bad hands, text, error, signature",
      style_strength_ratio: 20,
      num_outputs: 1,
      disable_safety_checker: false,
    };

    // Replace "YOUR_MODEL_VERSION_ID" below with the real version for tencentarc/photomaker-style
    const modelVersionId = "YOUR_MODEL_VERSION_ID";

    // Kick off the replicate job
    const output = await replicate.run(`tencentarc/photomaker-style:${modelVersionId}`, {
      input,
    });

    // The output should be an array of URLs
    return response.status(200).json({ images: output });
  } catch (error) {
    console.error("Error generating bobblehead:", error);
    return response.status(500).json({ error: "Failed to generate image" });
  }
}
