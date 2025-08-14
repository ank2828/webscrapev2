import puppeteer from 'puppeteer';

export async function crawlWebsite(startUrl, maxDepth = 6, maxPages = 35) {
  // Vercel-optimized Puppeteer configuration
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-http2',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--single-process', // Critical for Vercel
      '--memory-pressure-off',
      '--max_old_space_size=4096',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ],
    // Vercel-specific optimizations
    ...(process.env.VERCEL ? {
      executablePath: '/usr/bin/google-chrome-stable',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-first-run',
        '--no-zygote',
        '--deterministic-fetch',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection'
      ]
    } : {})
  });
  const visited = new Set();
  const queued = new Set(); // Track all URLs that have been queued to prevent duplicates
  const allContent = [];

  const CONCURRENCY_LIMIT = 5;
  const queue = [{ url: normalizeUrl(startUrl), depth: 0 }];
  const priorityQueue = []; // High priority queue for physician bio pages
  
  // Add initial URL to queued set
  queued.add(normalizeUrl(startUrl));

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
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      
      // Skip 404 pages
      if (response && response.status() === 404) {
        console.log(`⚠️  Skipping 404 page: ${url}`);
        visited.add(url);
        return;
      }

      const title = await page.title();

      const metaDescription = await page.$eval('meta[name="description"]', el => el.content).catch(() => '');

      const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', els =>
        els.map(el => el.innerText.trim()).filter(Boolean)
      );

      const paragraphs = await page.$$eval('p, div.content, div.description, div.text, .service-description', els =>
        els.map(el => el.innerText.trim()).filter(text => text.length > 20)
      );

      // Extract lists (services, specialties, etc.) - Enhanced detection
      const lists = await page.evaluate(() => {
        const foundLists = [];
        
        // Standard list elements
        const listElements = document.querySelectorAll('ul, ol, .services-list, .service-list, .procedures-list, .specialties-list');
        listElements.forEach(listEl => {
          const items = Array.from(listEl.querySelectorAll('li, .service-item, .procedure-item, .specialty-item'));
          const listItems = items
            .map(item => item.innerText.trim())
            .filter(text => text.length > 3 && text.length < 200); // Reasonable length filters
          
          if (listItems.length > 0) {
            foundLists.push(listItems);
          }
        });
        
        // Div-based lists that might not use <ul>/<ol>
        const divLists = document.querySelectorAll('.services, .procedures, .specialties, .treatments, .service-categories');
        divLists.forEach(divEl => {
          const divItems = Array.from(divEl.querySelectorAll('div, p, span'))
            .map(item => item.innerText.trim())
            .filter(text => 
              text.length > 5 && 
              text.length < 150 &&
              !text.toLowerCase().includes('read more') &&
              !text.toLowerCase().includes('learn more')
            );
          
          if (divItems.length > 2) { // At least 3 items to be considered a list
            foundLists.push(divItems);
          }
        });
        
        // Look for services formatted as headers or sections
        const serviceHeaders = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const serviceKeywords = ['service', 'procedure', 'treatment', 'specialty', 'surgery', 'therapy', 'medicine', 'care'];
        
        serviceHeaders.forEach(header => {
          const headerText = header.innerText.toLowerCase();
          const hasServiceKeyword = serviceKeywords.some(keyword => headerText.includes(keyword));
          
          if (hasServiceKeyword) {
            // Look for content after this header
            let nextElement = header.nextElementSibling;
            const sectionItems = [];
            
            while (nextElement && !nextElement.matches('h1, h2, h3, h4, h5, h6')) {
              if (nextElement.matches('ul, ol')) {
                // Found a list after the service header
                const items = Array.from(nextElement.querySelectorAll('li'))
                  .map(li => li.innerText.trim())
                  .filter(text => text.length > 3 && text.length < 150);
                sectionItems.push(...items);
              } else if (nextElement.matches('p, div')) {
                // Check if paragraph contains service names (comma-separated or line-separated)
                const text = nextElement.innerText.trim();
                if (text.includes(',') && text.length < 500) {
                  // Comma-separated services
                  const items = text.split(',').map(item => item.trim()).filter(item => item.length > 3);
                  if (items.length > 1) {
                    sectionItems.push(...items);
                  }
                } else if (text.length > 10 && text.length < 100) {
                  // Single service item
                  sectionItems.push(text);
                }
              }
              nextElement = nextElement.nextElementSibling;
            }
            
            if (sectionItems.length > 0) {
              foundLists.push(sectionItems);
            }
          }
        });
        
        // Look for text-based service lists (like the OSI services page structure)
        const textContent = document.body.innerText;
        const servicePatterns = [
          /(?:Non-Surgical Procedures?|Surgical Procedures?|Services?)[:\s]*\n([\s\S]*?)(?=\n\n|\n[A-Z][^a-z]|$)/gi,
          /(?:We offer|Our services include|Services include)[:\s]*([\s\S]*?)(?=\n\n|$)/gi
        ];
        
        servicePatterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(textContent)) !== null) {
            const serviceText = match[1].trim();
            // Split by common separators and clean up
            const services = serviceText
              .split(/\n|•|\*|-/)
              .map(s => s.trim())
              .filter(s => s.length > 5 && s.length < 100 && !/^(and|or|the|with)$/i.test(s));
            
            if (services.length > 1) {
              foundLists.push(services);
            }
          }
        });
        
        console.log(`Found ${foundLists.length} lists on page`);
        return foundLists;
      }).catch((error) => {
        console.error('Error extracting lists:', error);
        return [];
      });

      // Extract contact information
      const contactInfo = await page.evaluate(() => {
        const phones = Array.from(document.querySelectorAll('a[href^="tel:"], .phone, .contact-phone'))
          .map(el => el.innerText || el.href).filter(Boolean);
        
        const emails = Array.from(document.querySelectorAll('a[href^="mailto:"], .email, .contact-email'))
          .map(el => el.innerText || el.href).filter(Boolean);
          
        const addresses = Array.from(document.querySelectorAll('.address, .location, .contact-address, .office-address'))
          .map(el => el.innerText.trim()).filter(text => text.length > 10);
          
        return { phones, emails, addresses };
      }).catch(() => ({ phones: [], emails: [], addresses: [] }));

      // Extract tables (doctor info, services, etc.)
      const tables = await page.$$eval('table', els =>
        els.map(table => {
          const rows = Array.from(table.querySelectorAll('tr'));
          return rows.map(row => {
            const cells = Array.from(row.querySelectorAll('td, th'));
            return cells.map(cell => cell.innerText.trim()).filter(Boolean);
          }).filter(row => row.length > 0);
        }).filter(table => table.length > 0)
      ).catch(() => []);

      const pageData = { 
        url, 
        title, 
        description: metaDescription, 
        headings, 
        paragraphs,
        lists, // New: service lists, specialty lists, etc.
        contactInfo, // New: phones, emails, addresses
        tables // New: structured data from tables
      };

      console.log(`✅ Scraped: ${url}`);
      visited.add(url);
      allContent.push(pageData);
      
      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000)); // 1-2 second delay
      
      // Add new links to queue if within depth limit
      if (depth < maxDepth) {
        const links = await page.$$eval('a[href]', (anchors, base) =>
          anchors.map(a => {
            try {
              const fullUrl = new URL(a.href, base).toString();
              const linkText = a.innerText.trim().toLowerCase();
              return { url: fullUrl, text: linkText };
            } catch {
              return null;
            }
          }).filter(Boolean), url
        );

        for (const linkData of links) {
          const cleanLink = normalizeUrl(linkData.url);
          // Skip if URL is invalid, already visited, or already queued
          if (!cleanLink || visited.has(cleanLink) || queued.has(cleanLink)) {
            continue;
          }
          
          // Skip external URLs and non-http(s) links
          try {
            const linkUrl = new URL(cleanLink);
            const baseUrl = new URL(url);
            if (linkUrl.hostname !== baseUrl.hostname) {
              continue;
            }
          } catch {
            continue;
          }
          
          // Mark as queued immediately to prevent duplicates
          queued.add(cleanLink);
          
          // Check if this looks like a physician bio page
          const isPhysicianPage = isLikelyPhysicianBioPage(cleanLink);
          
          // Check if this looks like a services/procedures page (more restrictive now)
          const isServicesPage = isLikelyServicesPage(cleanLink, linkData.text);
          
          // Also check if link text contains doctor names/titles
          const hasDoctorInText = /\b(dr\.?|md|physician)\b/i.test(linkData.text);
          
          if (isPhysicianPage || hasDoctorInText) {
            // Physician pages get highest priority
            priorityQueue.unshift({ url: cleanLink, depth: depth + 1 });
            if (priorityQueue.length <= 10) {
              console.log(`👨‍⚕️ Physician page queued: ${cleanLink}`);
            }
          } else if (isServicesPage) {
            // Service pages get normal priority
            priorityQueue.push({ url: cleanLink, depth: depth + 1 });
            if (priorityQueue.length <= 30) {
              console.log(`🏥 Service page queued: ${cleanLink}`);
            }
          } else {
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

  // Helper function to identify likely physician bio pages
  function isLikelyPhysicianBioPage(url) {
    const urlLower = url.toLowerCase();
    
    // Skip obvious non-physician pages
    const excludePatterns = [
      'privacy', 'policy', 'terms', 'disclaimer', 'contact',
      'appointment', 'schedule', 'forms', 'insurance', 'billing',
      'news', 'blog', 'events', 'gallery', 'testimonial'
    ];
    
    if (excludePatterns.some(pattern => urlLower.includes(pattern))) {
      return false;
    }
    
    // Common physician page indicators
    const physicianIndicators = [
      // Direct doctor references
      '/doctor/', '/doctors/', '/physician/', '/physicians/',
      '/provider/', '/providers/', '/practitioner/',
      '/dr-', 'dr_', '/meet-dr', '/about-dr',
      // Team pages
      '/team/', '/staff/', '/our-team/', '/medical-team/',
      '/leadership/', '/faculty/', '/clinicians/',
      // Profile pages
      '/profile/', '/bio/', '/biography/', '/about/',
      // Specialist pages
      '/surgeon/', '/surgeons/', '/specialist/', '/specialists/'
    ];
    
    // Check for physician indicators
    const hasPhysicianIndicator = physicianIndicators.some(indicator => 
      urlLower.includes(indicator)
    );
    
    // Check for name patterns with medical titles
    const namePatterns = [
      /\/[a-z]+-[a-z]+-(md|do|dds|dpm)(\/|$)/i,  // john-smith-md
      /\/dr-[a-z]+-[a-z]+(\/|$)/i,               // dr-john-smith
      /\/(doctors|physicians|team)\/[a-z]+-[a-z]+/i,  // doctors/john-smith
      /\/[a-z]+-[a-z]+\.(md|do|physician)/i      // john-smith.md
    ];
    
    const hasNamePattern = namePatterns.some(pattern => pattern.test(urlLower));
    
    return hasPhysicianIndicator || hasNamePattern;
  }

  // Helper function to identify likely services/procedures pages
  function isLikelyServicesPage(url, linkText) {
    const urlLower = url.toLowerCase();
    const textLower = linkText.toLowerCase();
    
    // Skip common non-service pages
    const excludePatterns = [
      'privacy', 'policy', 'terms', 'disclaimer', 'copyright', 
      'contact', 'about', 'feedback', 'sitemap', 'accessibility',
      'login', 'signin', 'signup', 'cart', 'checkout', 'account',
      'blog', 'news', 'press', 'media', 'gallery', 'videos',
      'career', 'jobs', 'employment', 'testimonial', 'review',
      'facebook', 'twitter', 'linkedin', 'instagram', 'youtube',
      '.pdf', '.doc', '.jpg', '.png', '.gif'
    ];
    
    if (excludePatterns.some(pattern => urlLower.includes(pattern))) {
      return false;
    }
    
    // High-priority medical service indicators
    const strongIndicators = [
      'orthopedic', 'orthopaedic', 'surgery', 'surgical',
      'treatment', 'procedure', 'therapy', 'rehabilitation',
      'spine', 'joint', 'replacement', 'arthroscop',
      'mri', 'xray', 'x-ray', 'imaging', 'diagnostic',
      'injection', 'medicine', 'pain-management',
      'sports-medicine', 'physical-therapy'
    ];
    
    // Check for strong indicators in URL
    const hasStrongIndicator = strongIndicators.some(indicator => 
      urlLower.includes(indicator)
    );
    
    // Medical service patterns in URLs
    const medicalPatterns = [
      /\/services?\//,
      /\/treatments?\//,
      /\/procedures?\//,
      /\/specialt(y|ies)/,
      /\/conditions?\//,
      /\/what-we-(do|treat|offer)/,
      /\/(orthopedic|orthopaedic)/,
      /\/medical-services/,
      /\/(spine|joint|hand|foot|ankle|knee|shoulder|hip)/
    ];
    
    const hasMedicalPattern = medicalPatterns.some(pattern => pattern.test(urlLower));
    
    // Check link text for medical terms (but be more selective)
    const medicalTermsInText = [
      'surgery', 'treatment', 'procedure', 'therapy',
      'spine', 'joint', 'orthopedic', 'orthopaedic'
    ];
    
    const hasMedicalText = medicalTermsInText.some(term => 
      textLower.includes(term) && textLower.length < 100 // Avoid long navigation texts
    );
    
    return hasStrongIndicator || hasMedicalPattern || hasMedicalText;
  }

  // Process priority queue first, then regular queue
  let processedCount = 0;
  while ((priorityQueue.length || queue.length) && visited.size < maxPages) {
    let batch = [];
    
    // Take from priority queue first, then regular queue
    const availableSlots = Math.min(CONCURRENCY_LIMIT, maxPages - visited.size);
    
    // Fill batch with priority pages first
    while (batch.length < availableSlots && priorityQueue.length > 0) {
      batch.push(priorityQueue.shift());
    }
    
    // Fill remaining slots with regular pages
    while (batch.length < availableSlots && queue.length > 0) {
      batch.push(queue.shift());
    }
    
    if (batch.length === 0) break;
    
    // Log progress
    processedCount += batch.length;
    const priorityCount = batch.filter(item => 
      isLikelyPhysicianBioPage(item.url) || isLikelyServicesPage(item.url, '')
    ).length;
    
    if (priorityCount > 0) {
      console.log(`🏥 Processing ${batch.length} pages (${priorityCount} priority)...`);
    } else {
      console.log(`📄 Processing ${batch.length} regular pages...`);
    }
    
    await Promise.all(batch.map(({ url, depth }) => scrapePage(url, depth)));
    
    // Log overall progress
    console.log(`📊 Progress: ${visited.size}/${maxPages} pages crawled, ${priorityQueue.length} priority + ${queue.length} regular pages queued`);
  }

  await browser.close();
  return allContent;
}
