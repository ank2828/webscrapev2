// Past Reports JavaScript

// DOM Elements
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const reportsList = document.getElementById('reports-list');
const pdfModal = document.getElementById('pdf-modal');
const pdfModalTitle = document.getElementById('pdf-modal-title');
const pdfModalViewer = document.getElementById('pdf-modal-viewer');

// Chat elements
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send');

// Delete modal elements
const deleteModal = document.getElementById('delete-modal');
const deleteReportInfo = document.getElementById('delete-report-info');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

// Current report ID for chat and delete operations
let currentReportId = null;
let deleteReportId = null;

// Load past reports when page loads
document.addEventListener('DOMContentLoaded', async () => {
  await loadPastReports();
  
  // Set up chat functionality
  setupChatInterface();
});

// Set up chat interface
function setupChatInterface() {
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
  if (!question || !currentReportId) return;
  
  console.log('Sending chat message:', { question, reportId: currentReportId });
  
  // Add user message to chat
  addChatMessage(question, 'user');
  
  // Clear input and disable send button
  chatInput.value = '';
  chatSendBtn.disabled = true;
  
  // Add loading message
  const loadingMessage = addChatMessage('AI is analyzing the report...', 'loading');
  
  try {
    // Send question to AI
    const response = await fetch(`/api/chat/${currentReportId}`, {
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
  
  // First, fix common clumpy formatting issues
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
  
  // Headers (## Header)
  html = html.replace(/^## (.+)$/gm, '<h3 class="ai-header">$1</h3>');
  html = html.replace(/^### (.+)$/gm, '<h4 class="ai-subheader">$1</h4>');
  
  // Bold text (**text**)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
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
  
  return html;
}

// Clear chat messages
function clearChatMessages() {
  chatMessages.innerHTML = '';
}

// Function to load past reports
async function loadPastReports() {
  try {
    const response = await fetch('/api/past-reports');
    const data = await response.json();

    loadingState.style.display = 'none';

    if (!data.success || data.reports.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    displayReports(data.reports);
  } catch (error) {
    console.error('Error loading past reports:', error);
    loadingState.style.display = 'none';
    emptyState.style.display = 'block';
  }
}

// Function to display reports
function displayReports(reports) {
  reportsList.style.display = 'block';
  
  const reportsHtml = reports.map(report => {
    const createdDate = new Date(report.created_at);
    const formattedDate = createdDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const processingTime = report.processing_time_ms 
      ? `${Math.round(report.processing_time_ms / 1000)}s`
      : 'N/A';

    return `
      <div class="report-card">
        <div class="report-header">
          <div class="report-domain">
            <h3>${report.domain}</h3>
            <a href="${report.url}" target="_blank" class="report-url">${report.url}</a>
          </div>
          <div class="report-date">${formattedDate}</div>
        </div>
        <div class="report-footer">
          <div class="report-stats">
            <span class="stat-item">⏱ ${processingTime}</span>
            ${report.tokens_used ? `<span class="stat-item">🔤 ${report.tokens_used.toLocaleString()} tokens</span>` : ''}
          </div>
          <div class="report-actions">
            <button class="btn-view" onclick="viewReport('${report.id}', '${report.domain}')">
              View Report
            </button>
            <a href="/api/report/${report.id}" target="_blank" class="btn-download">
              Download PDF
            </a>
            <button class="btn-delete" onclick="confirmDeleteReport('${report.id}', '${report.domain}')">
              Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  reportsList.innerHTML = `
    <div class="reports-header">
      <h2>Recent Reports (${reports.length})</h2>
    </div>
    ${reportsHtml}
  `;
}

// Function to view report in modal
function viewReport(reportId, domain) {
  currentReportId = reportId; // Set current report for chat
  pdfModalTitle.textContent = `Report - ${domain}`;
  pdfModalViewer.src = `/api/report/${reportId}`;
  pdfModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  
  // Clear previous chat messages
  clearChatMessages();
  
  // Add welcome message
  addChatMessage(`Hi! I'm here to help you understand this report about ${domain}. Ask me anything about their services, locations, or any details you'd like to know more about.`, 'ai');
}

// Function to close PDF modal
function closePdfModal() {
  pdfModal.style.display = 'none';
  pdfModalViewer.src = '';
  document.body.style.overflow = 'auto';
  currentReportId = null;
  clearChatMessages();
}

// Close modal when pressing Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (pdfModal.style.display === 'flex') {
      closePdfModal();
    }
    if (deleteModal.style.display === 'flex') {
      closeDeleteModal();
    }
  }
});

// Delete functionality
function confirmDeleteReport(reportId, domain) {
  deleteReportId = reportId;
  deleteReportInfo.textContent = `Report for ${domain} will be permanently deleted.`;
  deleteModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeDeleteModal() {
  deleteModal.style.display = 'none';
  document.body.style.overflow = 'auto';
  deleteReportId = null;
}

async function deleteReport() {
  if (!deleteReportId) return;
  
  // Disable the delete button and show loading
  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = 'Deleting...';
  
  try {
    const response = await fetch(`/api/report/${deleteReportId}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Report deleted successfully');
      
      // Close the modal
      closeDeleteModal();
      
      // Reload the reports list
      await loadPastReports();
      
      // Show success message (you could add a toast notification here)
      console.log('Report deleted successfully');
      
    } else {
      console.error('❌ Failed to delete report:', data.message);
      alert('Failed to delete report: ' + data.message);
    }
    
  } catch (error) {
    console.error('❌ Error deleting report:', error);
    alert('Error deleting report. Please try again.');
  } finally {
    // Re-enable the delete button
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = 'Delete Report';
  }
}

// Set up delete confirmation button
confirmDeleteBtn.addEventListener('click', deleteReport); 