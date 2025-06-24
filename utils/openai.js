import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

// Check if API key exists
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.warn('⚠️ OPENAI_API_KEY not found in environment variables');
}

const openai = new OpenAI({
  apiKey: apiKey || 'dummy-key-for-testing' // Provide dummy key to prevent initialization error
});

export async function summarizeWebsite(text) {
  const prompt = `You are an elite healthcare billing intelligence analyst creating a sales report for Cosentus RCM. You MUST follow the exact structure and formatting rules below with ZERO deviations.

ABOUT COSENTUS:
Cosentus provides comprehensive revenue cycle management (RCM) for healthcare providers including complex medical billing, insurance claim processing, patient collections, denial management, EMR integration, financial reporting, credentialing, and compliance support. Specializes in orthopedic surgery centers, pain management clinics, hospitals, ASCs, complex procedures with high reimbursement rates, worker's compensation billing, and multi-location practice coordination.

ENHANCED COSENTUS INTELLIGENCE:
- 25+ years experience (largest non-PE backed RCM company)
- 98-99% collection rate vs 75-85% industry average
- 34 days average A/R vs 45+ industry average  
- 100% clean claim submissions vs 82% industry average
- 18% average revenue increase for clients
- Specialized expertise: Orthopedics, Pain Management, ASCs, OB/GYN, Anesthesia, Urgent Care
- In-house employees only (no offshore)
- Proactive process optimization and documentation improvement
- Dedicated account management with transparent reporting

CRITICAL FORMATTING RULES:

1. SECTION ORDER (NEVER CHANGE THIS):
PRACTICE OVERVIEW
SERVICES OFFERED
OPERATIONAL DETAILS
PATIENT INFORMATION
LEADERSHIP TEAM
BUSINESS INDICATORS
CONTACT INFORMATION
COSENTUS VALUE OPPORTUNITIES

2. BULLET USAGE:
- ONLY use bullets in: SERVICES OFFERED, OPERATIONAL DETAILS, LEADERSHIP TEAM, CONTACT INFORMATION
- NEVER use bullets in: PRACTICE OVERVIEW, PATIENT INFORMATION, BUSINESS INDICATORS, COSENTUS VALUE OPPORTUNITIES

3. SERVICES OFFERED FORMAT:
- Start with: "The practice provides comprehensive [specialty] services, including:"
- Each service MUST be a bullet with complexity in parentheses: "• [Service name] ([simple/moderate/complex/premium])"
- NEVER create complexity breakdown sections like "Premium:", "Complex:", etc.
- After bullets, add 2-3 analysis sentences (NOT as bullets)

4. LEADERSHIP TEAM FORMAT:
- Start with: "Key practice leaders are:"
- Each leader on separate bullet: "• [Name, Title/Specialty]"
- After bullets, add 1-2 summary sentences

5. ABSOLUTELY FORBIDDEN:
- "Procedures are categorized by complexity:"
- "Premium:", "Complex:", "Moderate:", "Simple:" sections
- Any sub-headings within sections
- Complexity breakdown analysis as bullets

EXACT OUTPUT TEMPLATE:

PRACTICE OVERVIEW
[Dense paragraph about practice type, specialties, locations, providers, years in operation, revenue]

SERVICES OFFERED
The practice provides comprehensive [specialty] services, including:
• [Service 1] ([complexity])
• [Service 2] ([complexity])
• [Service 3] ([complexity])
• [Service 4] ([complexity])
• [Service 5] ([complexity])
[2-3 analysis sentences about billing complexity and revenue opportunities]

- Note: When listing services, make sure to include all services that are listed on the main services page (no need to go to the sub-pages), and write the service name in the same way as it is written on the website. This is very important. Do not deviate from the website.

OPERATIONAL DETAILS
Facility locations:
• [Address 1]
• [Address 2]
• [Address 3]
[2-3 sentences about providers, technology, coordination challenges]

PATIENT INFORMATION
[2-4 sentences about insurance, scheduling, billing setup - NO BULLETS]

LEADERSHIP TEAM
Key practice leaders are:
• [Name, Title/Specialty - Personal background/education/achievements from their individual bio page]
• [Name, Title/Specialty - Personal background/education/achievements from their individual bio page]
• [Name, Title/Specialty - Personal background/education/achievements from their individual bio page]
[1-2 sentences about ownership and stability]

CRITICAL: For each physician/leader listed above, you MUST search through ALL the provided website content for their individual biography pages, "About Dr. [Name]" pages, physician profile pages, or any dedicated pages about each doctor. Extract and include specific personal details such as: education, medical school, residency, fellowships, years of experience, specializations, research interests, publications, awards, personal interests, family information, or any other biographical details found on their individual pages. DO NOT just list names - always include substantive personal/professional details for each person when available in the content. w

BUSINESS INDICATORS
[Dense paragraph about patient volume, procedures, growth, revenue potential]

CONTACT INFORMATION
• Phone: [number]
• [Other contact details]

COSENTUS VALUE OPPORTUNITIES
[1-2 paragraphs about how Cosentus aligns with the practice's goals and values based on Cosentus value proposition and website content (visit cosentus.com website and read the content including sub-pages) - NO BULLETS]
- For reference, here is the Cosentus value proposition: Cosentus offers a comprehensive billing solution that alleviates the burdensome billing process from your shoulders, utilizing in-house employees to ensure transparency and accountability. Our proactive approach means we don't wait for issues to arise; instead, we actively help you optimize your documentation and processes to maximize revenue. With a straightforward percentage structure, there are no hidden fees, and our reporting transparency provides clear insights into your practice's performance. Our dedicated account service ensures you have a single point of contact, avoiding the frustration of being passed around. With over 20 years of experience and a 99% collection rate, our clients trust us to deliver valuable service consistently.
- Use separate paragraphs for different thoughts to make it easier to read.

Based on this information: ${text}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a professional sales assistant. Output ONLY plain text with NO markdown formatting. Section headings must be ALL CAPS. Follow the exact template provided. Include bullets in the specified sections only. Extract actual content from the provided data.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  let aiOutput = response.choices[0].message.content.trim();

  // Simple cleanup - just remove forbidden complexity breakdowns
  aiOutput = aiOutput.replace(/Procedures are categorized by complexity:[\s\S]*?(?=OPERATIONAL DETAILS|$)/gi, '');
  aiOutput = aiOutput.replace(/• Premium:[\s\S]*?(?=• Complex:|• Moderate:|• Simple:|OPERATIONAL DETAILS|$)/gi, '');
  aiOutput = aiOutput.replace(/• Complex:[\s\S]*?(?=• Moderate:|• Simple:|OPERATIONAL DETAILS|$)/gi, '');
  aiOutput = aiOutput.replace(/• Moderate:[\s\S]*?(?=• Simple:|OPERATIONAL DETAILS|$)/gi, '');
  aiOutput = aiOutput.replace(/• Simple:[\s\S]*?(?=OPERATIONAL DETAILS|$)/gi, '');
  
  // Convert single asterisks to double asterisks for bold names
  // Convert *name* to **name** so PDF renderer can detect them
  aiOutput = aiOutput.replace(/\*([^*]+)\*/g, '**$1**').trim();

  // MINIMAL SAFEGUARDS - Only remove the most problematic patterns without touching formatting
  aiOutput = aiOutput.replace(/Billing Complexity Analysis:/gi, '');
  aiOutput = aiOutput.replace(/Enhanced Services Analysis:/gi, '');
  aiOutput = aiOutput.replace(/The patient population includes[\s\S]*?(?=OPERATIONAL DETAILS|PATIENT INFORMATION|LEADERSHIP TEAM|$)/gi, '');

  return aiOutput;
}

// Function for AI chat agent to answer questions about reports
export async function chatWithReport(question, reportData) {
  if (!question || !reportData) {
    throw new Error('Question and report data are required');
  }

  try {
    // Prepare comprehensive context from all available data
    const summary = reportData.summary_content || '';
    const crawledPages = reportData.crawled_content?.pages || [];
    const domain = reportData.domain || '';
    
    // Create a more structured data format for the AI
    let structuredData = `DOMAIN: ${domain}\n\n`;
    
    // Add the summary report
    structuredData += `GENERATED REPORT SUMMARY:\n${summary}\n\n`;
    
    // Add detailed raw data from each page
    structuredData += `RAW WEBSITE DATA FROM ${crawledPages.length} PAGES:\n\n`;
    
    crawledPages.forEach((page, index) => {
      structuredData += `=== PAGE ${index + 1}: ${page.url} ===\n`;
      structuredData += `TITLE: ${page.title || 'No title'}\n`;
      structuredData += `META DESCRIPTION: ${page.description || 'No description'}\n`;
      
      if (page.headings && page.headings.length > 0) {
        structuredData += `HEADINGS:\n${page.headings.map(h => `- ${h}`).join('\n')}\n`;
      }
      
      if (page.paragraphs && page.paragraphs.length > 0) {
        structuredData += `CONTENT:\n${page.paragraphs.map(p => `- ${p}`).join('\n')}\n`;
      }
      
      // Add lists (services, specialties, etc.)
      if (page.lists && page.lists.length > 0) {
        structuredData += `LISTS/SERVICES:\n`;
        page.lists.forEach((list, listIndex) => {
          structuredData += `List ${listIndex + 1}:\n${list.map(item => `  - ${item}`).join('\n')}\n`;
        });
      }
      
      // Add contact information
      if (page.contactInfo) {
        if (page.contactInfo.phones && page.contactInfo.phones.length > 0) {
          structuredData += `PHONE NUMBERS: ${page.contactInfo.phones.join(', ')}\n`;
        }
        if (page.contactInfo.emails && page.contactInfo.emails.length > 0) {
          structuredData += `EMAIL ADDRESSES: ${page.contactInfo.emails.join(', ')}\n`;
        }
        if (page.contactInfo.addresses && page.contactInfo.addresses.length > 0) {
          structuredData += `ADDRESSES:\n${page.contactInfo.addresses.map(addr => `- ${addr}`).join('\n')}\n`;
        }
      }
      
      // Add tables (structured data)
      if (page.tables && page.tables.length > 0) {
        structuredData += `TABLES/STRUCTURED DATA:\n`;
        page.tables.forEach((table, tableIndex) => {
          structuredData += `Table ${tableIndex + 1}:\n`;
          table.forEach(row => {
            structuredData += `  ${row.join(' | ')}\n`;
          });
        });
      }
      
      structuredData += `\n`;
    });
    
    const systemPrompt = `You are an AI sales assistant that helps users understand and work with a specific company's report about ${domain}.

CRITICAL DATA USAGE INSTRUCTIONS:
1. ALWAYS prioritize the scraped data provided below as your PRIMARY source of truth
2. When asked about "all services" or "what services they offer", you MUST list EVERY service mentioned in ANY part of the data
3. Search through BOTH the summary report AND all the detailed raw page data thoroughly
4. When you find relevant information, cite which page it came from (e.g., "According to their Services page...")
5. Be comprehensive and detailed - provide ALL relevant details from the scraped data
6. Focus on factual information from the scraped website content as your foundation

ENHANCED CAPABILITIES:
- For factual questions: Use ONLY the provided data
- For analytical/strategic questions (like "discovery call cheat sheet", "talking points", "competitive analysis"): 
  * Use the scraped data as your foundation
  * Apply general sales/business knowledge to create useful formats and insights
  * Always base recommendations on the specific company details you found
  * Clearly distinguish between facts from the data vs. your strategic recommendations

EXAMPLE APPROACHES:
- "What services do they offer?" → List ALL services from scraped data only
- "Create a discovery call cheat sheet" → Use company data + sales methodology to create useful format
- "What are their contact details?" → Use only scraped contact information
- "What questions should I ask about their spine surgery program?" → Combine their specific spine services with general discovery questions

FORMATTING REQUIREMENTS - CRITICAL:
- ALWAYS use markdown formatting for better readability
- Use ## for main section headers (e.g., ## Services Offered)
- Use ### for subsections (e.g., ### Surgical Services)
- Use **bold** for important terms, names, and key information
- ALWAYS use bullet points (-) for lists - NEVER put multiple items on one line
- Each service/item must be on its own line with a dash (-)
- Use numbered lists (1.) when showing steps or priorities
- Add proper spacing between sections with double line breaks
- NEVER create run-on sentences with multiple items separated by dashes
- Example of CORRECT formatting:
  ### Surgical Services
  - **Spine Surgery** (complex procedures)
  - **Total Joint Replacement** (hip, knee, shoulder)
  - **Sports Medicine** (arthroscopic procedures)
  
- Example of INCORRECT formatting (DO NOT DO THIS):
  - Spine Surgery (complex) - Total Joint Replacement (complex) - Sports Medicine (moderate)

SPECIAL INSTRUCTION FOR SERVICES QUESTIONS:
If asked about services, procedures, or what they offer, you must:
- Check the summary report for condensed services
- Check ALL raw page data for complete service lists
- Look in headings, content paragraphs, lists, and any other sections
- Provide the MOST COMPLETE list possible from all sources
- Organize services by category if possible (surgical vs non-surgical, by specialty, etc.)
- Format as clear bullet points with **bold** service names

AVAILABLE DATA:
${structuredData.substring(0, 20000)} ${structuredData.length > 20000 ? '\n\n[Note: Some data truncated due to context limits, but comprehensive data included above]' : ''}

When answering, always:
- Search through both the summary report AND the raw page data
- For services questions, be comprehensive and list everything found
- Cite your sources (which page the information came from)
- Be specific about what you found
- If information isn't in the data, clearly state that`;

    // Check if this is a services-related question to provide specific formatting instructions
    const isServicesQuestion = question.toLowerCase().includes('service') || 
                               question.toLowerCase().includes('procedure') || 
                               question.toLowerCase().includes('treatment') ||
                               question.toLowerCase().includes('offer') ||
                               question.toLowerCase().includes('provide');
    
    // Detect question type to provide appropriate instructions
    const isFactualQuestion = question.toLowerCase().includes('what') && 
                              (question.toLowerCase().includes('service') || 
                               question.toLowerCase().includes('contact') ||
                               question.toLowerCase().includes('location') ||
                               question.toLowerCase().includes('phone') ||
                               question.toLowerCase().includes('address'));
    
    const isStrategicQuestion = question.toLowerCase().includes('cheat sheet') ||
                               question.toLowerCase().includes('talking points') ||
                               question.toLowerCase().includes('discovery call') ||
                               question.toLowerCase().includes('questions to ask') ||
                               question.toLowerCase().includes('competitive') ||
                               question.toLowerCase().includes('strategy') ||
                               question.toLowerCase().includes('approach');
    
    let userPrompt;
    
    if (isFactualQuestion) {
      userPrompt = `Based ONLY on the provided scraped data about ${domain}, please answer this factual question: ${question}`;
    } else if (isStrategicQuestion) {
      userPrompt = `Using the provided scraped data about ${domain} as your foundation, create a strategic response to this request: ${question}

INSTRUCTIONS FOR STRATEGIC RESPONSES:
- Use ALL the specific company details from the scraped data as your foundation
- Apply general sales/business methodology to create useful formats
- Clearly distinguish between facts from the data vs. strategic recommendations
- Make it practical and actionable for someone working with this specific company`;
    } else {
      userPrompt = `Using the provided data about ${domain} as your primary source, please answer this question: ${question}`;
    }
    
    if (isServicesQuestion) {
      userPrompt += `

CRITICAL FORMATTING REMINDER FOR SERVICES:
- Use ### for service categories (e.g., ### Surgical Services)
- Put each individual service on its own line with a dash (-)
- Use **bold** for service names
- NEVER put multiple services on the same line separated by dashes
- Example format:
  ### Surgical Services
  - **Spine Surgery** (complex procedures)
  - **Total Joint Replacement** (hip, knee, shoulder)
  - **Sports Medicine** (arthroscopic procedures)`;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: userPrompt
        }
      ],
      max_tokens: 600, // Increased for more detailed responses
      temperature: 0.3 // Lower temperature for more factual responses
    });

    const answer = response.choices[0].message.content.trim();
    
    return {
      answer,
      tokens_used: response.usage?.total_tokens || 0
    };

  } catch (error) {
    console.error('❌ Error in chat with report:', error);
    throw new Error('Failed to generate response. Please try again.');
  }
}
