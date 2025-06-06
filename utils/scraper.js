import puppeteer from 'puppeteer';

export async function scrapeBasicInfo(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Grab the main heading (<h1>)
  const heading = await page.$eval('h1', el => el.innerText).catch(() => 'No heading found');

  // Try to grab <meta name="description"> content
  let description = await page.$eval('meta[name="description"]', el => el.content).catch(() => '');

  // If no meta description, try the first <p>
  if (!description) {
    description = await page.$eval('p', el => el.innerText).catch(() => 'No description found');
  }

  await browser.close();

  return { heading, description };
}
