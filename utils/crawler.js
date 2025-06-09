import puppeteer from 'puppeteer';

export async function crawlWebsite(startUrl, maxDepth = 3, maxPages = 50) {
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
  const priorityQueue = []; // High priority queue for physician bio pages

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
            // Check if this looks like a physician bio page
            const isPhysicianPage = isLikelyPhysicianBioPage(cleanLink);
            
            if (isPhysicianPage) {
              // Add to priority queue for immediate processing
              priorityQueue.push({ url: cleanLink, depth: depth + 1 });
            } else {
              queue.push({ url: cleanLink, depth: depth + 1 });
            }
          }
        }
      }
    } catch (err) {
      console.error(`⚠️ Error scraping ${url}:`, err.message);
    } finally {
      if (page) await page.close();
    }
  }

  // Helper function to identify likely physician bio pages
  function isLikelyPhysicianBioPage(url) {
    const urlLower = url.toLowerCase();
    
    // Common physician page indicators
    const physicianIndicators = [
      // Doctor/physician terms
      'doctor', 'dr-', 'dr_', 'physician', 'provider', 'practitioner', 'clinician',
      // Bio/profile terms  
      'bio', 'biography', 'profile', 'about', 'meet', 'cv', 'resume',
      // Team/staff terms
      'staff', 'team', 'our-team', 'medical-team', 'providers', 'faculty',
      // Leadership terms
      'leadership', 'management', 'administration', 'directors',
      // Specialty terms
      'surgeons', 'specialists', 'doctors', 'physicians', 'practitioners',
      // Common URL patterns
      'our-doctors', 'our-physicians', 'meet-our', 'about-dr', 'meet-dr',
      'physician-profile', 'doctor-profile', 'provider-profile',
      // Medical titles that might appear in URLs
      'md-', '_md', 'do-', '_do', 'dds-', '_dds', 'dpm-', '_dpm'
    ];
    
    // Check for common patterns
    const hasPhysicianIndicator = physicianIndicators.some(indicator => urlLower.includes(indicator));
    
    // Also check for name patterns (common physician name patterns in URLs)
    const namePatterns = [
      /\/[a-z]+-[a-z]+-m\.?d\.?[\/-]/,  // john-smith-md/ or john-smith-m-d/
      /\/dr-[a-z]+-[a-z]+[\/-]/,        // dr-john-smith/
      /\/[a-z]+_[a-z]+_m\.?d\.?[\/-]/,  // john_smith_md/
      /\/[a-z]+-[a-z]+\.html$/,         // john-smith.html (if it's in a doctors section)
    ];
    
    const hasNamePattern = namePatterns.some(pattern => pattern.test(urlLower));
    
    // Check if URL path contains words suggesting it's in a doctors/team section
    const pathSegments = urlLower.split('/');
    const inDoctorSection = pathSegments.some(segment => 
      ['doctors', 'physicians', 'providers', 'team', 'staff', 'faculty', 'leadership'].includes(segment)
    );
    
    return hasPhysicianIndicator || (hasNamePattern && inDoctorSection);
  }

  // Process priority queue first, then regular queue
  while ((priorityQueue.length || queue.length) && visited.size < maxPages) {
    let batch;
    
    if (priorityQueue.length > 0) {
      // Process physician bio pages with priority
      batch = priorityQueue.splice(0, CONCURRENCY_LIMIT);
      console.log(`🏥 Processing ${batch.length} priority physician pages...`);
    } else {
      // Process regular pages
      batch = queue.splice(0, CONCURRENCY_LIMIT);
    }
    
    await Promise.all(batch.map(({ url, depth }) => scrapePage(url, depth)));
  }

  await browser.close();
  return allContent;
}
