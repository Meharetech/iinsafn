const puppeteer = require("puppeteer");

const getFacebookViewCount = async (videoUrl) => {
  console.log("🚀 Starting Facebook views extraction with Puppeteer...");
  console.log(`📱 URL: ${videoUrl}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.goto(videoUrl, { waitUntil: "networkidle2", timeout: 60000 });

    console.log("🔍 Searching for view counts...");

    // ✅ Method 1: Look through all spans for text containing "views"
    let viewsText = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const match = spans.find(el => el.innerText.includes("views"));
      return match ? match.innerText : null;
    });

    // ✅ Method 2: Fallback - search for specific attributes/classes
    if (!viewsText) {
      viewsText = await page.evaluate(() => {
        const selectors = [
          'span[data-testid="video-view-count"]',
          'div[class*="view"]',
          '[aria-label*="views"]'
        ];
        for (let sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.innerText.includes("views")) {
            return el.innerText;
          }
        }
        return null;
      });
    }

    // ✅ Method 3: Regex fallback (scan page HTML)
    if (!viewsText) {
      const html = await page.content();
      const match = html.match(/(\d+[.,]?\d*\s*[KMB]?\s*views)/i);
      viewsText = match ? match[0] : null;
    }

    console.log("✅ Found views:", viewsText);
    return viewsText;

  } catch (err) {
    console.error("💥 ERROR:", err.message);
    return null;
  } finally {
    await browser.close();
  }
};

module.exports = getFacebookViewCount;

