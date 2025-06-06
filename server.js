import express from 'express';
import { crawlWebsite } from './utils/crawler.js';
import { summarizeWebsite } from './utils/openai.js';
import dotenv from 'dotenv';
import PDFDocument from 'pdfkit';
dotenv.config();

const app = express();

app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/public/index.html');
});

app.post('/generate-pdf', async (req, res) => {
  let { url } = req.body;

  if (!url.startsWith('http')) {
    url = 'https://' + url;
  }

  if (!url) {
    return res.status(400).json({ success: false, message: 'No URL provided' });
  }

  try {
    // Crawl and filter pages
    const pagesContent = await crawlWebsite(url, 4, 20);

    const uniqueContent = new Map();
    const processedContent = [];
    pagesContent.forEach(page => {
      const contentKey = `${page.title}-${page.description}`.toLowerCase();
      if (!uniqueContent.has(contentKey)) {
        uniqueContent.set(contentKey, true);

        const relevantHeadings = page.headings.filter(h =>
          h.length > 3 &&
          !h.toLowerCase().includes('menu') &&
          !h.toLowerCase().includes('footer') &&
          !h.toLowerCase().includes('navigation') &&
          !h.toLowerCase().includes('cookie')
        );

        const relevantParagraphs = page.paragraphs.filter(p => {
          const lowerP = p.toLowerCase();
          return p.length > 30 &&
            !lowerP.includes('copyright') &&
            !lowerP.includes('privacy policy') &&
            !lowerP.includes('terms of service') &&
            !lowerP.includes('cookie policy') &&
            !lowerP.includes('website disclaimer');
        });

        if (relevantHeadings.length > 0 || relevantParagraphs.length > 0) {
          processedContent.push({
            url: page.url,
            title: page.title,
            description: page.description,
            headings: relevantHeadings,
            paragraphs: relevantParagraphs
          });
        }
      }
    });

    const fullText = processedContent.map(page => {
      return `Page: ${page.url}\nTitle: ${page.title || ''}\nMeta: ${page.description || ''}\nHeadings:\n${page.headings.join('\n')}\nParagraphs:\n${page.paragraphs.join('\n')}`;
    }).join('\n\n');

    // Get bulletproof summary from strict LLM+post-processing
    let finalSummary = await summarizeWebsite(fullText);

    // PDF GENERATION
    const doc = new PDFDocument({
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    doc.fontSize(18).font('Helvetica-Bold').text('Cosentus Sales Report', { align: 'center' });
    doc.moveDown();

    // Render lines to PDF
    const pdfLines = finalSummary.split('\n');
    let currentY = doc.y;
    pdfLines.forEach(line => {
      let trimmedLine = line.trim();
      if (trimmedLine === '') {
        currentY += 8;
        doc.y = currentY;
      } else if (/^[A-Z\s]+$/.test(trimmedLine) && trimmedLine.length > 5) {
        // Section headings - ALL CAPS, bold, larger font
        currentY += 15;
        doc.y = currentY;
        doc.fontSize(16).font('Helvetica-Bold').text(trimmedLine, { align: 'left' });
        currentY = doc.y + 8;
      } else if (trimmedLine.startsWith('•')) {
        // Bullet points
        doc.y = currentY;
        doc.fontSize(11).font('Helvetica').text(trimmedLine, { indent: 0 });
        currentY = doc.y + 4;
      } else {
        // Regular text
        doc.y = currentY;
        doc.fontSize(11).font('Helvetica').text(trimmedLine, { indent: 0 });
        currentY = doc.y + 8;
      }
    });

    doc.end();
  } catch (error) {
    console.error('Error generating report:', error);

    let errorMessage = 'Error generating PDF. Please try again.';
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      errorMessage = 'Unable to access the website. Please check the URL and try again.';
    } else if (error.message.includes('OpenAI') || error.message.includes('API')) {
      errorMessage = 'AI service temporarily unavailable. Please try again in a moment.';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Request timed out. The website may be slow to respond.';
    }

    res.status(500).json({ success: false, message: errorMessage });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
