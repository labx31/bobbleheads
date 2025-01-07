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
    console.log("Starting image generation process...");
    
    const data = await new Promise((resolve, reject) => {
      const form = formidable({
        maxFileSize: 5 * 1024 * 1024, // 5MB limit
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
    console.log("File received:", { 
      name: file.originalFilename, 
      type: file.mimetype, 
      size: file.size 
    });

    const filePath = file.filepath;
    const fileBuffer = fs.readFileSync(filePath);
    console.log("File buffer size:", fileBuffer.length);

    console.log("Calling Replicate API...");
    const output = await replicate.run(
      `tencentarc/photomaker-style:${modelVersion}`,
      {
        input: {
          prompt: "Full body bobblehead on display stand, tiny body with oversized head, collectible toy photography, full figure visible from head to toe, standing pose, detailed facial features, solid white background, 3D rendered, glossy finish, img",
          num_steps: 45,
          style_name: "(No style)",
          input_image: fileBuffer,
          num_outputs: 1,
          guidance_scale: 8,
          negative_prompt: "cropped, partial figure, headshot only, bust only, shoulders only, cutoff body, realistic proportions, photorealistic, blurry, distorted features, double head, low quality, grainy, multiple heads, text, watermark",
          style_strength_ratio: 15
        }
      }
    );

    console.log("Replicate API Raw Output:", output);
    
    // Handle if output is a ReadableStream
    if (output && output[0] && output[0].constructor.name === 'ReadableStream') {
      // Convert stream to string
      const reader = output[0].getReader();
      let result = '';
      
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        result += new TextDecoder().decode(value);
      }
      
      try {
        // Try to parse the result as JSON if it's a string
        const parsedResult = JSON.parse(result);
        console.log("Parsed stream result:", parsedResult);
        return res.status(200).json({ images: parsedResult });
      } catch (e) {
        // If it's not JSON, assume it's a URL string
        console.log("Stream result as URL:", result);
        return res.status(200).json({ images: [result] });
      }
    }

    // Handle regular array response
    if (Array.isArray(output)) {
      console.log("Array output:", output);
      return res.status(200).json({ images: output });
    }

    // If we get here, something unexpected happened
    console.error("Unexpected output format:", output);
    return res.status(500).json({ 
      error: "Unexpected response format from image generation API",
      details: output 
    });

  } catch (error) {
    console.error("Error in generate endpoint:", error);
    return res.status(500).json({ 
      error: "Error generating image", 
      details: error.message 
    });
  }
}