import puppeteer from 'puppeteer';

export async function crawlWebsite(startUrl, maxDepth = 2, maxPages = 30) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-http2',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  });
  const visited = new Set();
  const allContent = [];

  const CONCURRENCY_LIMIT = 5;
  const queue = [{ url: normalizeUrl(startUrl), depth: 0 }];

  function normalizeUrl(url) {
    try {
      const u = new URL(url);
      u.hash = '';
      u.search = '';
      let pathname = u.pathname.replace(/\/+$/, '');
      u.pathname = pathname || '/';
      return u.toString();
    } catch {
      return null;
    }
  }

  async function scrapePage(url, depth) {
    if (!url || visited.has(url) || visited.size >= maxPages) return;
    visited.add(url);

    let page;
    try {
      page = await browser.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

      const title = await page.title();

      const metaDescription = await page.$eval('meta[name="description"]', el => el.content).catch(() => '');

      const headings = await page.$$eval('h1, h2, h3', els =>
        els.map(el => el.innerText.trim()).filter(Boolean)
      );

      const paragraphs = await page.$$eval('p', els =>
        els.map(el => el.innerText.trim()).filter(Boolean)
      );

      const pageData = { url, title, description: metaDescription, headings, paragraphs };

      console.log(`✅ Scraped: ${url}`);
      visited.add(url);
      allContent.push(pageData);
      
      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000)); // 1-2 second delay
      
      // Add new links to queue if within depth limit
      if (depth < maxDepth) {
        const links = await page.$$eval('a[href]', (anchors, base) =>
          anchors.map(a => new URL(a.href, base).toString()), url
        );

        for (const rawLink of links) {
          const cleanLink = normalizeUrl(rawLink);
          if (cleanLink && !visited.has(cleanLink)) {
            queue.push({ url: cleanLink, depth: depth + 1 });
          }
        }
      }
    } catch (err) {
      console.error(`⚠️ Error scraping ${url}:`, err.message);
    } finally {
      if (page) await page.close();
    }
  }

  while (queue.length && visited.size < maxPages) {
    const batch = queue.splice(0, CONCURRENCY_LIMIT);
    await Promise.all(batch.map(({ url, depth }) => scrapePage(url, depth)));
  }

  await browser.close();
  return allContent;
}
