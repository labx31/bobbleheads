import Replicate from "replicate";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false, // We use formidable instead of the default parser
  },
};

// Initialize replicate with your environment variable
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN, // Ensure this is set in Vercel
});

const modelVersion = "467d062309da518648ba89d226490e02b8ed09b5abc15026e54e31c5a8cd0769"; 
// ^ Replace with your real version if needed

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Parse incoming form data (including file)
    const data = await new Promise((resolve, reject) => {
      const form = new formidable.IncomingForm();
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const { fields, files } = data;
    const { prompt, styleName } = fields;
    const userPrompt = prompt?.trim() || "A photo of a person img";
    const userStyle = styleName || "(No style)";

    // 2. Extract the uploaded file from formidable
    if (!files.imageUpload) {
      return res.status(400).json({ error: "No image file uploaded." });
    }

    // 'imageUpload' is the name of our input field
    const filePath = files.imageUpload.filepath; // temp path
    const fileBuffer = fs.readFileSync(filePath);

    // 3. Prepare input for replicate
    const input = {
      prompt: userPrompt,
      style_name: userStyle,
      input_image: fileBuffer,    // We can provide a Buffer directly
      num_steps: 20,
      guidance_scale: 5,
      negative_prompt:
        "nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, cropped, worst quality",
      style_strength_ratio: 20,
      num_outputs: 1,
      disable_safety_checker: false,
    };

    // 4. Run the replicate model
    const output = await replicate.run(
      `tencentarc/photomaker-style:${modelVersion}`,
      { input }
    );
    // output is an array of URLs

    return res.status(200).json({ images: output });
  } catch (error) {
    console.error("Error generating image:", error);
    return res
      .status(500)
      .json({ error: "Server error generating bobblehead." });
  }
}
