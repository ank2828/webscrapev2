import express from 'express';
import { crawlWebsite } from './utils/crawler.js';
import { summarizeWebsite, chatWithReport } from './utils/openai.js';
import { 
  saveReport, 
  checkExistingReport, 
  logAnalytics, 
  logReportRequest, 
  updateReportRequestStatus,
  extractDomain,
  getPastReports,
  getReportById,
  deleteReport
} from './utils/database.js';
import dotenv from 'dotenv';
import PDFDocument from 'pdfkit';
dotenv.config();

// Function to render text with bold formatting
function renderLineWithBold(doc, text, options = {}) {
  const boldPattern = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match;
  
  // Start with regular font
  doc.font('Helvetica');
  
  while ((match = boldPattern.exec(text)) !== null) {
    // Add text before the bold part
    if (match.index > lastIndex) {
      const regularText = text.substring(lastIndex, match.index);
      doc.font('Helvetica').text(regularText, options.indent || 0, doc.y, { 
        continued: true,
        lineBreak: false 
      });
    }
    
    // Add the bold part
    doc.font('Helvetica-Bold').text(match[1], { 
      continued: true,
      lineBreak: false 
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after the last bold part
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    doc.font('Helvetica').text(remainingText, { 
      continued: false 
    });
  } else {
    // If we ended with bold text, need to break the line
    doc.text('', { continued: false });
  }
}

const app = express();

app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/public/index.html');
});

// Serve past reports page
app.get('/past-reports', (req, res) => {
  res.sendFile(process.cwd() + '/public/past-reports.html');
});

// API endpoint to get past reports
app.get('/api/past-reports', async (req, res) => {
  try {
    const reports = await getPastReports();
    res.json({ success: true, reports });
  } catch (error) {
    console.error('❌ Error fetching past reports:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch past reports' });
  }
});

// API endpoint to get a specific report and regenerate PDF
app.get('/api/report/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const report = await getReportById(id);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    // Generate PDF from stored content
    const doc = new PDFDocument({
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="report-${report.domain}-${new Date(report.created_at).toISOString().split('T')[0]}.pdf"`);
    doc.pipe(res);

    doc.fontSize(18).font('Helvetica-Bold').text('Cosentus Sales Report', { align: 'center' });
    doc.moveDown();

    // Render cached content to PDF
    const pdfLines = report.summary_content.split('\n');
    let currentY = doc.y;
    pdfLines.forEach(line => {
      let trimmedLine = line.trim();
      if (trimmedLine === '') {
        currentY += 8;
        doc.y = currentY;
      } else if (/^[A-Z\s]+$/.test(trimmedLine) && trimmedLine.length > 5) {
        currentY += 15;
        doc.y = currentY;
        doc.fontSize(16).font('Helvetica-Bold').text(trimmedLine, { align: 'left' });
        currentY = doc.y + 8;
      } else if (trimmedLine.startsWith('•')) {
        doc.y = currentY;
        doc.fontSize(11);
        renderLineWithBold(doc, trimmedLine, { indent: 0 });
        currentY = doc.y + 4;
      } else {
        doc.y = currentY;
        doc.fontSize(11);
        renderLineWithBold(doc, trimmedLine, { indent: 0 });
        currentY = doc.y + 8;
      }
    });

    doc.end();

    // Log analytics for past report access
    await logAnalytics('past_report_accessed', report.id, { 
      accessed_at: new Date().toISOString() 
    });

  } catch (error) {
    console.error('❌ Error fetching report:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch report' });
  }
});

app.post('/generate-pdf', async (req, res) => {
  let { url } = req.body;
  const startTime = Date.now();
  let requestRecord = null;

  if (!url.startsWith('http')) {
    url = 'https://' + url;
  }

  if (!url) {
    return res.status(400).json({ success: false, message: 'No URL provided' });
  }

  try {
    // Log the request
    requestRecord = await logReportRequest({
      url,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      status: 'pending'
    });

    // Check if we have a recent report for this URL
    const existingReport = await checkExistingReport(url, 24); // 24 hours cache
    if (existingReport && existingReport.summary_content) {
      console.log('📋 Returning cached report for:', url);
      
      // Update request status
      if (requestRecord) {
        await updateReportRequestStatus(requestRecord.id, 'completed', existingReport.id);
      }

      // Log analytics
      await logAnalytics('cache_hit', existingReport.id, { 
        from_cache: true,
        processing_time_ms: Date.now() - startTime 
      });

      // Generate PDF from cached content
      const doc = new PDFDocument({
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });
      res.setHeader('Content-Type', 'application/pdf');
      doc.pipe(res);

      doc.fontSize(18).font('Helvetica-Bold').text('Cosentus Sales Report', { align: 'center' });
      doc.moveDown();

      // Render cached content to PDF
      const pdfLines = existingReport.summary_content.split('\n');
      let currentY = doc.y;
      pdfLines.forEach(line => {
        let trimmedLine = line.trim();
        if (trimmedLine === '') {
          currentY += 8;
          doc.y = currentY;
        } else if (/^[A-Z\s]+$/.test(trimmedLine) && trimmedLine.length > 5) {
          currentY += 15;
          doc.y = currentY;
          doc.fontSize(16).font('Helvetica-Bold').text(trimmedLine, { align: 'left' });
          currentY = doc.y + 8;
        } else if (trimmedLine.startsWith('•')) {
          doc.y = currentY;
          doc.fontSize(11);
          renderLineWithBold(doc, trimmedLine, { indent: 0 });
          currentY = doc.y + 4;
        } else {
          doc.y = currentY;
          doc.fontSize(11);
          renderLineWithBold(doc, trimmedLine, { indent: 0 });
          currentY = doc.y + 8;
        }
      });

      doc.end();
      return;
    }

    // Update request status to processing
    if (requestRecord) {
      await updateReportRequestStatus(requestRecord.id, 'processing');
    }

    console.log('🔄 Generating new report for:', url);

    // Crawl and filter pages
    const crawlStartTime = Date.now();
    const pagesContent = await crawlWebsite(url, 6, 35); // Increased from (4, 20) to (6, 35)
    const crawlTime = Date.now() - crawlStartTime;

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
            paragraphs: relevantParagraphs,
            lists: page.lists || [],
            contactInfo: page.contactInfo || {},
            tables: page.tables || []
          });
        }
      }
    });

    const fullText = processedContent.map(page => {
      let pageText = `Page: ${page.url}\nTitle: ${page.title || ''}\nMeta: ${page.description || ''}\nHeadings:\n${page.headings.join('\n')}\nParagraphs:\n${page.paragraphs.join('\n')}`;
      
      // Add lists if available
      if (page.lists && page.lists.length > 0) {
        pageText += `\nLists:\n${page.lists.map(list => list.join(', ')).join('\n')}`;
      }
      
      // Add contact info if available
      if (page.contactInfo) {
        if (page.contactInfo.phones && page.contactInfo.phones.length > 0) {
          pageText += `\nPhones: ${page.contactInfo.phones.join(', ')}`;
        }
        if (page.contactInfo.emails && page.contactInfo.emails.length > 0) {
          pageText += `\nEmails: ${page.contactInfo.emails.join(', ')}`;
        }
        if (page.contactInfo.addresses && page.contactInfo.addresses.length > 0) {
          pageText += `\nAddresses: ${page.contactInfo.addresses.join('; ')}`;
        }
      }
      
      return pageText;
    }).join('\n\n');

    // Get bulletproof summary from strict LLM+post-processing
    const aiStartTime = Date.now();
    let finalSummary = await summarizeWebsite(fullText);
    const aiTime = Date.now() - aiStartTime;

    // Save report to database
    const reportData = {
      url,
      domain: extractDomain(url),
      crawled_content: {
        pages: processedContent,
        raw_text: fullText,
        pages_crawled: pagesContent.length,
        crawl_time_ms: crawlTime
      },
      summary_content: finalSummary,
      processing_time_ms: Date.now() - startTime,
      tokens_used: Math.floor(fullText.length / 4) // Rough estimate
    };

    const savedReport = await saveReport(reportData);

    // Update request status
    if (requestRecord && savedReport) {
      await updateReportRequestStatus(requestRecord.id, 'completed', savedReport.id);
    }

    // Log analytics
    if (savedReport) {
      await logAnalytics('report_generated', savedReport.id, {
        pages_crawled: pagesContent.length,
        crawl_time_ms: crawlTime,
        ai_time_ms: aiTime,
        total_time_ms: Date.now() - startTime
      });
    }

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
        // Bullet points - handle bold text within bullets
        doc.y = currentY;
        doc.fontSize(11);
        renderLineWithBold(doc, trimmedLine, { indent: 0 });
        currentY = doc.y + 4;
      } else {
        // Regular text - handle bold text within paragraphs
        doc.y = currentY;
        doc.fontSize(11);
        renderLineWithBold(doc, trimmedLine, { indent: 0 });
        currentY = doc.y + 8;
      }
    });

    doc.end();
  } catch (error) {
    console.error('❌ Error generating report:', error);

    // Update request status to failed
    if (requestRecord) {
      await updateReportRequestStatus(requestRecord.id, 'failed', null, error.message);
    }

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

// API endpoint for AI chat with report
app.post('/api/chat/:reportId', async (req, res) => {
  console.log('📨 Chat API called:', { reportId: req.params.reportId, body: req.body });
  
  try {
    const { reportId } = req.params;
    const { question } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Question is required' });
    }

    console.log('🔍 Fetching report:', reportId);
    
    // Get the full report data including raw content
    const report = await getReportById(reportId);
    if (!report) {
      console.log('❌ Report not found:', reportId);
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    console.log('✅ Report found, calling AI with question:', question);
    
    // Use AI to answer the question
    const chatResponse = await chatWithReport(question, report);

    console.log('🤖 AI response received:', { tokens: chatResponse.tokens_used });

    // Log analytics for chat usage
    await logAnalytics('chat_question', reportId, {
      question: question.substring(0, 100), // First 100 chars for privacy
      tokens_used: chatResponse.tokens_used,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      answer: chatResponse.answer,
      tokens_used: chatResponse.tokens_used
    });

  } catch (error) {
    console.error('❌ Error in chat endpoint:', error);
    console.error('Error details:', error.message, error.stack);
    
    // Check if it's an OpenAI API key issue
    if (error.message && error.message.includes('API key')) {
      return res.status(500).json({ 
        success: false, 
        message: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process your question. Please try again.' 
    });
  }
});

// API endpoint to delete a report
app.delete('/api/report/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    
    console.log('🗑️ Delete request for report:', reportId);
    
    // Check if report exists
    const report = await getReportById(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    
    // Delete the report
    const deleteSuccess = await deleteReport(reportId);
    
    if (deleteSuccess) {
      // Log analytics for deletion
      await logAnalytics('report_deleted', reportId, {
        domain: report.domain,
        deleted_at: new Date().toISOString()
      });
      
      console.log('✅ Report deleted successfully:', reportId);
      res.json({ success: true, message: 'Report deleted successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to delete report' });
    }
    
  } catch (error) {
    console.error('❌ Error in delete endpoint:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete report. Please try again.' 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
