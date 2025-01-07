import Replicate from "replicate";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

if (!process.env.REPLICATE_API_TOKEN) {
  console.error("REPLICATE_API_TOKEN is not set");
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const modelVersion = "467d062309da518648ba89d226490e02b8ed09b5abc15026e54e31c5a8cd0769";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse form data with detailed error handling
    const data = await new Promise((resolve, reject) => {
      const form = formidable({
        maxFileSize: 5 * 1024 * 1024, // 5MB limit
      });
      
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error("Form parsing error:", err);
          return reject(err);
        }
        resolve({ fields, files });
      });
    });

    const { files } = data;
    
    if (!files.imageUpload) {
      console.error("No image file found in request");
      return res.status(400).json({ error: "No image file uploaded." });
    }

    console.log("File received:", {
      name: files.imageUpload.originalFilename,
      type: files.imageUpload.mimetype,
      size: files.imageUpload.size
    });

    const file = files.imageUpload;
    const filePath = file.filepath;
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error("File does not exist at path:", filePath);
      return res.status(500).json({ error: "File processing error" });
    }

    const fileBuffer = fs.readFileSync(filePath);
    console.log("File buffer size:", fileBuffer.length);

    // Convert buffer to base64
    const base64Image = fileBuffer.toString('base64');
    const dataURI = `data:${file.mimetype};base64,${base64Image}`;

    // Hardcoded parameters exactly as specified
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

    console.log("Calling Replicate API...");
    const output = await replicate.run(
      `tencentarc/photomaker-style:${modelVersion}`,
      { input }
    );
    console.log("Creating prediction...");
    const prediction = await replicate.predictions.create({
      version: modelVersion,
      input: input
    });

    console.log("Waiting for prediction...");
    const finalPrediction = await replicate.predictions.wait(prediction.id);
    console.log("Final prediction:", finalPrediction);

    if (finalPrediction.error) {
      throw new Error(`Prediction failed: ${finalPrediction.error}`);
    }

    if (!finalPrediction.output || !Array.isArray(finalPrediction.output)) {
      throw new Error("Invalid prediction output");
    }

    // Return the output URLs
    return res.status(200).json({ images: finalPrediction.output });

  } catch (error) {
    console.error("Error in generate endpoint:", error);
    return res.status(500).json({ 
      error: "Error generating bobblehead",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}