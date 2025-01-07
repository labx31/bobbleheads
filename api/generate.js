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
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse form data
    const data = await new Promise((resolve, reject) => {
      const form = formidable({
        maxFileSize: 5 * 1024 * 1024, // 5MB limit
      });
      
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const { fields, files } = data;
    
    // Validate file
    if (!files.imageUpload) {
      return res.status(400).json({ error: "No image file uploaded." });
    }

    const file = files.imageUpload;
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.mimetype)) {
      return res.status(400).json({ 
        error: "Invalid file type. Please upload a JPEG, PNG, or WebP image." 
      });
    }

    // Read file
    const filePath = file.filepath;
    const fileBuffer = fs.readFileSync(filePath);

    // Prepare model input
    const input = {
      prompt: fields.prompt?.trim() || "A photo of a person img",
      style_name: fields.styleName || "(No style)",
      input_image: fileBuffer,
      num_steps: 20,
      guidance_scale: 5,
      negative_prompt: "nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, cropped, worst quality",
      style_strength_ratio: 20,
      num_outputs: 1,
      disable_safety_checker: false,
    };

    // Run model
    const output = await replicate.run(
      `tencentarc/photomaker-style:${modelVersion}`,
      { input }
    );

    // Cleanup temp file
    fs.unlinkSync(filePath);

    return res.status(200).json({ images: output });

  } catch (error) {
    console.error("Error generating image:", error);
    
    // Return appropriate error message
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? error.message 
      : "Error generating bobblehead. Please try again.";
    
    return res.status(500).json({ 
      error: errorMessage
    });
  }
}