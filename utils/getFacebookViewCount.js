const { Builder } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

const getFacebookViewCount = async (videoUrl, options = {}) => {
  const {
    headless = true,
    timeout = 60000,
    waitTime = 5000
  } = options;

  console.log("🚀 Starting Facebook views extraction with Selenium...");
  console.log(`📱 URL: ${videoUrl}\n`);

  let driver = null;

  try {
    const chromeOptions = new chrome.Options();
    
    if (headless) {
      chromeOptions.addArguments("--headless");
    }
    
    chromeOptions.addArguments(
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1920,1080"
    );

    driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(chromeOptions)
      .build();

    await driver.get(videoUrl);
    await driver.manage().setTimeouts({ implicit: timeout });
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, waitTime));

    console.log("🔍 Searching for view counts...");

    // ✅ Method 1: Look through all spans for text containing "views"
    let viewsText = await driver.executeScript(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const match = spans.find(el => el.innerText && el.innerText.includes("views"));
      return match ? match.innerText : null;
    });

    // ✅ Method 2: Fallback - search for specific attributes/classes
    if (!viewsText) {
      viewsText = await driver.executeScript(() => {
        const selectors = [
          'span[data-testid="video-view-count"]',
          'div[class*="view"]',
          '[aria-label*="views"]'
        ];
        for (let sel of selectors) {
          try {
            const el = document.querySelector(sel);
            if (el && el.innerText && el.innerText.includes("views")) {
              return el.innerText;
            }
          } catch (e) {
            continue;
          }
        }
        return null;
      });
    }

    // ✅ Method 3: Regex fallback (scan page HTML)
    if (!viewsText) {
      const html = await driver.getPageSource();
      const match = html.match(/(\d+[.,]?\d*\s*[KMB]?\s*views)/i);
      viewsText = match ? match[0] : null;
    }

    console.log("✅ Found views:", viewsText);
    return viewsText;

  } catch (err) {
    console.error("💥 ERROR:", err.message);
    return null;
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
};

module.exports = getFacebookViewCount;

