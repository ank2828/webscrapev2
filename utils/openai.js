import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
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

CRITICAL: For each physician/leader listed above, you MUST search through ALL the provided website content for their individual biography pages, "About Dr. [Name]" pages, physician profile pages, or any dedicated pages about each doctor. Extract and include specific personal details such as: education, medical school, residency, fellowships, years of experience, specializations, research interests, publications, awards, personal interests, family information, or any other biographical details found on their individual pages. DO NOT just list names - always include substantive personal/professional details for each person when available in the content.

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
