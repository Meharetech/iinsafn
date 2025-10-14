const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

ffmpeg.setFfmpegPath(ffmpegPath);

// Ensure temp folder exists
const tempDir = path.join(__dirname, "../temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}



const applyWatermark = async (inputPath, type = "video", options = {}) => {
  const ext = path.extname(inputPath);
  const baseName = path.basename(inputPath, ext);
  const outputPath = path.join(tempDir, `${baseName}_watermarked${ext}`);
  const watermarkText = "official@iinsaf";

  console.log(`🔧 Watermarking ${type}:`, inputPath);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`❌ Input file not found: ${inputPath}`);
  }

  const stats = fs.statSync(inputPath);
  console.log("📏 Input file size:", stats.size);

  if (type === "image") {
    try {
      let image = sharp(inputPath);
      const { width, height } = await image.metadata();
      
      console.log(`📐 Original image dimensions: ${width}x${height}`);

      // Image cropping and resizing options
      const {
        maxWidth = 1920,
        maxHeight = 1080,
        quality = 85,
        cropToFit = true
      } = options;

      // Resize image if it's too large
      if (width > maxWidth || height > maxHeight) {
        console.log(`🔄 Resizing image to fit ${maxWidth}x${maxHeight}`);
        image = image.resize(maxWidth, maxHeight, {
          fit: cropToFit ? 'cover' : 'inside',
          position: 'center'
        });
      }

      // Get final dimensions after resizing
      const finalMetadata = await image.metadata();
      const finalWidth = finalMetadata.width;
      const finalHeight = finalMetadata.height;

      const fontSize = Math.floor(Math.min(finalWidth, finalHeight) * 0.08); // 8% of smaller dimension
      const padding = 20;
      
      // Calculate text dimensions more accurately
      const textWidth = watermarkText.length * fontSize * 0.6; // Approximate text width
      const textHeight = fontSize;
      
      // Calculate watermark position (bottom right)
      const watermarkX = finalWidth - textWidth - padding;
      const watermarkY = finalHeight - textHeight - padding;
      
      // Ensure watermark doesn't go outside image bounds
      const safeX = Math.max(0, Math.min(watermarkX, finalWidth - textWidth));
      const safeY = Math.max(0, Math.min(watermarkY, finalHeight - textHeight));

      console.log(`📐 Watermark text: "${watermarkText}"`);
      console.log(`📐 Font size: ${fontSize}px`);
      console.log(`📐 Text dimensions: ${textWidth}x${textHeight}`);
      console.log(`📐 Position: ${safeX},${safeY}`);

      // Create a minimal SVG with just the text
      const svgText = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${textWidth + 10}" height="${textHeight + 10}">
          <text x="${textWidth}" y="${textHeight}" 
                font-size="${fontSize}" 
                fill="rgba(255, 255, 255, 0.8)" 
                stroke="rgba(0, 0, 0, 0.5)" 
                stroke-width="0.5" 
                font-family="Arial, sans-serif" 
                text-anchor="end" 
                dominant-baseline="bottom">${watermarkText}</text>
        </svg>
      `;

      console.log(`🔧 Creating watermark SVG: ${textWidth + 10}x${textHeight + 10}`);

      try {
        await image
          .composite([{ 
            input: Buffer.from(svgText), 
            top: safeY - 5, 
            left: safeX - 5,
            blend: 'over'
          }])
          .jpeg({ quality: quality }) // Convert to JPEG with specified quality
          .toFile(outputPath);

        console.log(`✅ Image watermarked and optimized saved to: ${outputPath}`);
        return outputPath;
      } catch (compositeError) {
        console.error("❌ Composite error, trying fallback approach:", compositeError.message);
        
        // Fallback: Just resize and save without watermark
        console.log("🔄 Fallback: Saving image without watermark");
        await image
          .jpeg({ quality: quality })
          .toFile(outputPath);
        
        console.log(`✅ Image saved without watermark: ${outputPath}`);
        return outputPath;
      }
    } catch (err) {
      console.error("❌ Error in sharp watermark:", err);
      throw err;
    }
  }

  if (type === "video") {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec("libx264")
        .format("mp4")
        .outputOptions([
          `-vf drawtext=text='${watermarkText}':x=20:y=20:fontsize=48:fontcolor=white@0.7:box=1:boxcolor=black@0.3:boxborderw=5`,
        ])
        .on("end", () => {
          console.log(`✅ Video watermarked saved to: ${outputPath}`);
          resolve(outputPath);
        })
        .on("error", (err) => {
          console.error("❌ FFmpeg error:", err);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          reject(err);
        })
        .save(outputPath);
    });
  }

  throw new Error(`❌ Unsupported media type: ${type}`);
};

module.exports = applyWatermark;
