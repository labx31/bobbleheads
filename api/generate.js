import Replicate from "replicate";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const modelVersion = "467d062309da518648ba89d226490e02b8ed09b5abc15026e54e31c5a8cd0769";

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Handle status check
    const { predictionId } = req.query;
    if (!predictionId) {
      return res.status(400).json({ error: "Prediction ID required" });
    }

    try {
      const prediction = await replicate.predictions.get(predictionId);
      return res.json(prediction);
    } catch (error) {
      console.error("Error checking prediction:", error);
      return res.status(500).json({ error: "Failed to check prediction status" });
    }
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const data = await new Promise((resolve, reject) => {
      const form = formidable({
        maxFileSize: 5 * 1024 * 1024,
      });
      
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const { files } = data;
    
    if (!files.imageUpload) {
      return res.status(400).json({ error: "No image file uploaded." });
    }

    const file = files.imageUpload;
    const filePath = file.filepath;
    const fileBuffer = fs.readFileSync(filePath);
    const base64Image = fileBuffer.toString('base64');
    const dataURI = `data:${file.mimetype};base64,${base64Image}`;

    // Hardcoded parameters
    const input = {
      prompt: "Full body bobblehead on display stand, tiny body with oversized head, collectible toy photography, full figure visible from head to toe, standing pose, detailed facial features, solid white background, 3D rendered, glossy finish, img",
      num_steps: 45,
      style_name: "(No style)",
      input_image: dataURI,
      num_outputs: 1,
      guidance_scale: 8,
      negative_prompt: "cropped, partial figure, headshot only, bust only, shoulders only, cutoff body, realistic proportions, photorealistic, blurry, distorted features, double head, low quality, grainy, multiple heads, text, watermark",
      style_strength_ratio: 15
    };

    // Start the prediction
    const prediction = await replicate.predictions.create({
      version: modelVersion,
      input: input,
    });

    // Clean up the temporary file
    try {
      fs.unlinkSync(filePath);
    } catch (cleanupError) {
      console.error("Error cleaning up temp file:", cleanupError);
    }

    // Return the prediction ID immediately
    return res.json({ predictionId: prediction.id });

  } catch (error) {
    console.error("Error in generate endpoint:", error);
    return res.status(500).json({ error: "Error starting image generation" });
  }
}