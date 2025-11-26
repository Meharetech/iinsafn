const puppeteer = require("puppeteer");

const getFacebookViewCount = async (videoUrl) => {
  console.log("🚀 Starting Facebook views extraction with Puppeteer...");
  console.log(`📱 URL: ${videoUrl}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process"
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Set user agent to avoid detection
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.goto(videoUrl, { 
      waitUntil: "networkidle2", 
      timeout: 60000 
    });

    // Wait a bit for dynamic content to load
    await page.waitForTimeout(3000);

    console.log("🔍 Searching for view counts...");

    // ✅ Method 1: Look through all spans for text containing "views"
    let viewsText = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const match = spans.find(el => el.innerText && el.innerText.toLowerCase().includes("views"));
      return match ? match.innerText.trim() : null;
    });

    // ✅ Method 2: Fallback - search for specific attributes/classes
    if (!viewsText) {
      viewsText = await page.evaluate(() => {
        const selectors = [
          'span[data-testid="video-view-count"]',
          'div[class*="view"]',
          '[aria-label*="views"]',
          'span[class*="view"]',
          'div[data-testid*="view"]'
        ];
        for (let sel of selectors) {
          const elements = document.querySelectorAll(sel);
          for (let el of elements) {
            if (el && el.innerText && el.innerText.toLowerCase().includes("views")) {
              return el.innerText.trim();
            }
          }
        }
        return null;
      });
    }

    // ✅ Method 3: Regex fallback (scan page HTML)
    if (!viewsText) {
      const html = await page.content();
      const match = html.match(/(\d+[.,]?\d*\s*[KMB]?\s*views?)/i);
      viewsText = match ? match[0].trim() : null;
    }

    console.log("✅ Found views:", viewsText);
    return viewsText;

  } catch (err) {
    console.error("💥 ERROR:", err.message);
    if (err.stack) {
      console.error("Stack:", err.stack);
    }
    return null;
  } finally {
    await browser.close();
  }
};

module.exports = getFacebookViewCount;

