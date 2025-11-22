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
  const watermarkText = "The copyright and legal responsibility for this advertisement/Raise Your Voice lie solely with the advertiser/creator. @iinsafofficial”";

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

      const padding = 10;
      const minFontSize = 8; // Minimum font size
      const maxFontSize = Math.floor(Math.min(finalWidth, finalHeight) * 0.025); // 2.5% of smaller dimension
      
      // Calculate maximum allowed watermark width (leave padding on both sides)
      const maxWatermarkWidth = finalWidth - (padding * 2);
      const maxWatermarkHeight = finalHeight - (padding * 2);
      
      // Start with initial font size
      let fontSize = maxFontSize;
      let textWidth = watermarkText.length * fontSize * 0.6; // Approximate text width
      let textHeight = fontSize;
      
      // Reduce font size if text is too wide
      while (textWidth > maxWatermarkWidth && fontSize > minFontSize) {
        fontSize = Math.max(minFontSize, fontSize - 1);
        textWidth = watermarkText.length * fontSize * 0.6;
        textHeight = fontSize;
      }
      
      // If still too wide after font reduction, cap the width
      if (textWidth > maxWatermarkWidth) {
        textWidth = maxWatermarkWidth;
      }
      
      // Ensure text height doesn't exceed available space
      if (textHeight > maxWatermarkHeight) {
        textHeight = maxWatermarkHeight;
      }
      
      // Calculate watermark position (bottom right)
      const watermarkX = finalWidth - textWidth - padding;
      const watermarkY = finalHeight - textHeight - padding;
      
      // Ensure watermark doesn't go outside image bounds
      const safeX = Math.max(padding, Math.min(watermarkX, finalWidth - textWidth - padding));
      const safeY = Math.max(padding, Math.min(watermarkY, finalHeight - textHeight - padding));
      
      // Ensure SVG dimensions never exceed image dimensions
      const svgWidth = Math.min(textWidth + (padding * 2), finalWidth - safeX);
      const svgHeight = Math.min(textHeight + (padding * 2), finalHeight - safeY);

      console.log(`📐 Watermark text: "${watermarkText}"`);
      console.log(`📐 Font size: ${fontSize}px`);
      console.log(`📐 Text dimensions: ${textWidth}x${textHeight}`);
      console.log(`📐 SVG dimensions: ${svgWidth}x${svgHeight}`);
      console.log(`📐 Position: ${safeX},${safeY}`);
      console.log(`📐 Image dimensions: ${finalWidth}x${finalHeight}`);

      // Create SVG with proper dimensions
      const svgText = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">
          <text x="${svgWidth - padding}" y="${svgHeight - padding}" 
                font-size="${fontSize}" 
                fill="rgba(255, 255, 255, 0.8)" 
                stroke="rgba(0, 0, 0, 0.5)" 
                stroke-width="0.5" 
                font-family="Arial, sans-serif" 
                text-anchor="end" 
                dominant-baseline="bottom">${watermarkText}</text>
        </svg>
      `;

      console.log(`🔧 Creating watermark SVG: ${svgWidth}x${svgHeight}`);

      try {
        // Ensure composite position and size are valid
        const compositeLeft = Math.max(0, Math.min(safeX, finalWidth - svgWidth));
        const compositeTop = Math.max(0, Math.min(safeY, finalHeight - svgHeight));
        
        await image
          .composite([{ 
            input: Buffer.from(svgText), 
            top: compositeTop, 
            left: compositeLeft,
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
      // Escape single quotes in watermark text for FFmpeg
      const escapedText = watermarkText.replace(/'/g, "\\'");
      
      ffmpeg(inputPath)
        .videoCodec("libx264")
        .format("mp4")
        .outputOptions([
          `-vf drawtext=text='${escapedText}':x=10:y=10:fontsize=16:fontcolor=white@0.7:box=1:boxcolor=black@0.3:boxborderw=2`,
        ])
        .on("start", (commandLine) => {
          console.log(`🔧 FFmpeg command: ${commandLine}`);
        })
        .on("progress", (progress) => {
          console.log(`⏳ Video watermarking progress: ${Math.round(progress.percent || 0)}%`);
        })
        .on("end", () => {
          console.log(`✅ Video watermarked saved to: ${outputPath}`);
          resolve(outputPath);
        })
        .on("error", (err) => {
          console.error("❌ FFmpeg error:", err);
          console.error("❌ FFmpeg error message:", err.message);
          if (fs.existsSync(outputPath)) {
            try {
              fs.unlinkSync(outputPath);
            } catch (unlinkErr) {
              console.error("❌ Error deleting failed output file:", unlinkErr);
            }
          }
          reject(new Error(`Video watermarking failed: ${err.message || err.toString()}`));
        })
        .save(outputPath);
    });
  }

  throw new Error(`❌ Unsupported media type: ${type}`);
};

module.exports = applyWatermark;
