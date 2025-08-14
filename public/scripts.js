// Sales Reporter functionality
function initSalesReporter() {
  const generateBtn = document.querySelector('.generate-btn');
  const inputBox = document.querySelector('.input-box');
  const pdfViewer = document.getElementById('pdf-viewer');
  const downloadLink = document.getElementById('download-link');
  const reportDisplay = document.getElementById('report-display');
  
  // Chat elements
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSendBtn = document.getElementById('chat-send');
  
  // Current report ID for chat operations
  let currentReportId = null;

  if (!generateBtn || !inputBox) return; // Exit if elements don't exist on this page

  generateBtn.addEventListener('click', async () => {
    const url = inputBox.value.trim();
    if (!url) {
      alert('Please enter a practice URL.');
      return;
    }

    // Validate URL format
    try {
      new URL(url.startsWith('http') ? url : 'https://' + url);
    } catch {
      alert('Please enter a valid URL (e.g., www.practice.com)');
      return;
    }

    generateBtn.textContent = 'Analyzing Practice...';
    generateBtn.disabled = true;
    generateBtn.classList.add('pulsing');

    try {
      const response = await fetch('/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (response.ok) {
        const { reportId } = await response.json();

        if (reportId) {
          pdfViewer.src = `/api/report/${reportId}`;
          
          const domain = new URL(url.startsWith('http') ? url : 'https://' + url).hostname;
          downloadLink.href = `/api/report/${reportId}`;
          downloadLink.download = `${domain}_sales_intelligence_report.pdf`;
          
          reportDisplay.style.display = 'flex';
          currentReportId = reportId;
          
          clearChatMessages();
          addChatMessage("Hi! I'm your Cosentus sales assistant...", 'ai');
        } else {
          alert('Failed to get report ID. Please try again.');
        }
        
      } else {
        const errorData = await response.json();
        alert(`Error generating report: ${errorData.message || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('Network error:', error);
      alert('Network error. Please check your connection and try again.');
    } finally {
      generateBtn.textContent = 'Generate Report';
      generateBtn.disabled = false;
      generateBtn.classList.remove('pulsing');
    }
  });

  inputBox.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      generateBtn.click();
    }
  });

  // Auto-focus input on page load
  window.addEventListener('load', () => {
    inputBox.focus();
  });
  
  // Set up chat functionality
  setupChatInterface();
  
  // Add initial welcome message for home page chat
  setTimeout(() => {
    if (chatMessages && !currentReportId) {
      addChatMessage('Hi! I\'m your Cosentus sales assistant. I can help you with discovery questions, sales strategies, objection handling, and understanding prospects. What would you like to know about?', 'ai');
    }
  }, 500);
  
  // Set up chat interface
  function setupChatInterface() {
    if (!chatSendBtn || !chatInput) return; // Exit if chat elements don't exist
    
    // Send message on button click
    chatSendBtn.addEventListener('click', sendChatMessage);
    
    // Send message on Enter key
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
    
    // Auto-resize input and enable/disable send button
    chatInput.addEventListener('input', () => {
      const hasText = chatInput.value.trim().length > 0;
      chatSendBtn.disabled = !hasText;
    });
  }
  
  // Send chat message
  async function sendChatMessage() {
    const question = chatInput.value.trim();
    if (!question) return;
    
    console.log('Sending chat message:', { question, hasReport: !!currentReportId });
    
    // Add user message to chat
    addChatMessage(question, 'user');
    
    // Clear input and disable send button
    chatInput.value = '';
    chatSendBtn.disabled = true;
    
    // Add loading message
    const loadingMessage = addChatMessage(
      currentReportId ? 'AI is analyzing the report...' : 'AI is thinking...', 
      'loading'
    );
    
    try {
      // Choose endpoint based on whether we have a report
      const endpoint = currentReportId 
        ? `/api/chat/${currentReportId}` 
        : '/api/chat';
        
      // Send question to AI
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question })
      });
      
      console.log('Chat API response status:', response.status);
      const data = await response.json();
      console.log('Chat API response data:', data);
      
      // Remove loading message
      chatMessages.removeChild(loadingMessage);
      
      if (data.success) {
        // Add AI response
        addChatMessage(data.answer, 'ai');
      } else {
        // Add error message with details
        const errorMsg = data.message || 'Sorry, I encountered an error. Please try again.';
        addChatMessage(errorMsg, 'ai');
        console.error('Chat API error:', errorMsg);
      }
      
    } catch (error) {
      console.error('Chat error:', error);
      // Remove loading message
      if (chatMessages.contains(loadingMessage)) {
        chatMessages.removeChild(loadingMessage);
      }
      // Add error message
      addChatMessage('Sorry, I couldn\'t connect to the AI service. Please check your connection and try again.', 'ai');
    }
  }
  
  // Add message to chat
  function addChatMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    
    if (type === 'ai') {
      // Parse markdown for AI messages
      messageDiv.innerHTML = parseMarkdown(text);
    } else {
      // Use plain text for user messages
      messageDiv.textContent = text;
    }
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return messageDiv;
  }
  
  // Enhanced markdown parser for AI responses
  function parseMarkdown(text) {
    let html = text;
    
    // FIRST: Fix doctor listings that are split across lines
    // Remove all ** bold formatting first to prevent display issues
    html = html.replace(/\*\*/g, '');
    
    // COMPREHENSIVE doctor name cleanup - handle all variations
    // Replace any pattern of "Dr. Name." + line break + "M.D." with clean format
    html = html.replace(/\bDr\.\s+([A-Za-z\s]+)\.\s*[\r\n]+\s*M\.D\./g, 'Dr. $1 M.D.');
    
    // Clean up any remaining doctor name patterns with extra content
    html = html.replace(/\bDr\.\s+([A-Za-z\s]+)\.\s*[\r\n]+\s*M\.D\.\s*([^.])/g, 'Dr. $1 M.D. $2');
    
    // Remove any stray periods that might be left
    html = html.replace(/Dr\.\s+([^.]+)\s+M\.D\./g, 'Dr. $1 M.D.');
    
    // Fix run-on bullet points like "- Item1 - Item2 - Item3"
    html = html.replace(/^([-*] .+?)( - .+)+$/gm, (match) => {
      return match.split(' - ').map((item, index) => {
        if (index === 0) return item; // First item already has dash
        return '- ' + item.trim();
      }).join('\n');
    });
    
    // Fix inline lists that should be bullet points
    // Pattern: "Services: Service1, Service2, Service3"
    html = html.replace(/^(.+?:)\s*(.+,\s*.+)/gm, (match, label, items) => {
      const itemList = items.split(',').map(item => `- ${item.trim()}`).join('\n');
      return `${label}\n${itemList}`;
    });
    
    // Headers (## Header, ### Subheader, #### Bold subheader)
    html = html.replace(/^## (.+)$/gm, '<h3 class="ai-header">$1</h3>');
    html = html.replace(/^### (.+)$/gm, '<h4 class="ai-subheader">$1</h4>');
    html = html.replace(/^#### (.+)$/gm, '<strong class="ai-bold-subheader">$1</strong><br>');
    
    // Doctor names should remain as plain text - no bold formatting needed
    
    // Bullet points (- item or * item)
    html = html.replace(/^[-*] (.+)$/gm, '<li class="ai-bullet">$1</li>');
    
    // Wrap consecutive bullet points in ul
    html = html.replace(/(<li class="ai-bullet">.*?<\/li>(?:\s*<li class="ai-bullet">.*?<\/li>)*)/gs, (match) => {
      return '<ul class="ai-list">' + match + '</ul>';
    });
    
    // Numbered lists (1. item)
    html = html.replace(/^\d+\. (.+)$/gm, '<li class="ai-numbered">$1</li>');
    
    // Wrap consecutive numbered items in ol
    html = html.replace(/(<li class="ai-numbered">.*?<\/li>(?:\s*<li class="ai-numbered">.*?<\/li>)*)/gs, (match) => {
      return '<ol class="ai-numbered-list">' + match + '</ol>';
    });
    
    // Handle section labels that end with colon (like "Surgical Services:")
    html = html.replace(/^([A-Z][^:]+:)$/gm, '<h4 class="ai-subheader">$1</h4>');
    
    // Clean up unwanted periods after sections (before creating paragraphs)
    // Remove periods that appear at the end of lines that are followed by headers or lists
    html = html.replace(/\.\s*\n(?=<h[34]|<[uo]l)/g, '\n');
    
    // Remove periods at the end of section headers
    html = html.replace(/(<h[34][^>]*>[^<]*)\.<\/h[34]>/g, '$1</h$2>');
    
    // Line breaks (double newlines become paragraphs)
    html = html.replace(/\n\n/g, '</p><p class="ai-paragraph">');
    html = '<p class="ai-paragraph">' + html + '</p>';
    
    // Clean up empty paragraphs
    html = html.replace(/<p class="ai-paragraph"><\/p>/g, '');
    html = html.replace(/<p class="ai-paragraph">\s*<\/p>/g, '');
    html = html.replace(/<p class="ai-paragraph">\s*<\/p>/g, '');
    
    // Clean up paragraphs that only contain headers or lists
    html = html.replace(/<p class="ai-paragraph">(<h[34][^>]*>.*?<\/h[34]>)<\/p>/g, '$1');
    html = html.replace(/<p class="ai-paragraph">(<[uo]l[^>]*>.*?<\/[uo]l>)<\/p>/gs, '$1');
    
    // Remove periods that appear right before closing paragraph tags when followed by headers/lists
    html = html.replace(/\.<\/p>(\s*<h[34])/g, '</p>$1');
    html = html.replace(/\.<\/p>(\s*<[uo]l)/g, '</p>$1');
    
    // Merge lines where a name ends with a period and the next line starts with credentials (handles multiple credentials and edge cases)
    html = html.replace(/([A-Za-z\-\'\. ]+)\.\s*[\r\n]+((?:[A-Z][a-z]*\.?)+(?:,? [A-Z][a-z]*\.?)*)(?:\s*[\r\n]+)?( is| who| with| known| recognized| focuses| provides| offers| specializes| addresses| emphasizes| Board Certified| is Board Certified|,|\.)/g, '$1, $2$3');
    
    return html;
  }
  
  // Clear chat messages
  function clearChatMessages() {
    if (chatMessages) {
      chatMessages.innerHTML = '';
    }
  }
}

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', () => {
  initSalesReporter();
}); 