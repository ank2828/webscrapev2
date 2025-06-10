// Sales Reporter functionality
function initSalesReporter() {
  const generateBtn = document.querySelector('.generate-btn');
  const inputBox = document.querySelector('.input-box');
  const pdfViewer = document.getElementById('pdf-viewer');
  const downloadLink = document.getElementById('download-link');

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

    // Array of loading messages that cycle during analysis
    const loadingMessages = [
      'Analyzing Practice...',
      'Scanning Website...',
      'Identifying Services...',
      'Mapping Providers...',
      'Evaluating Technology...',
      'Assessing Market Position...',
      'Reviewing Patient Experience...',
      'Analyzing Competition...',
      'Calculating Opportunities...',
      'Finalizing Intelligence...'
    ];

    let messageIndex = 0;
    generateBtn.textContent = loadingMessages[0];
    generateBtn.disabled = true;
    generateBtn.classList.add('pulsing');

    // Start cycling through messages every 8 seconds
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % loadingMessages.length;
      generateBtn.textContent = loadingMessages[messageIndex];
    }, 8000);

    try {
      const response = await fetch('/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (response.ok) {
        const pdfBlob = await response.blob();
        const pdfUrl = URL.createObjectURL(pdfBlob);

        pdfViewer.src = pdfUrl;
        pdfViewer.style.display = 'block';

        // Set download filename based on URL
        const domain = new URL(url.startsWith('http') ? url : 'https://' + url).hostname;
        downloadLink.href = pdfUrl;
        downloadLink.download = `${domain}_sales_intelligence_report.pdf`;
        downloadLink.style.display = 'inline-block';
        
        // Scroll to PDF
        pdfViewer.scrollIntoView({ behavior: 'smooth' });
      } else {
        const errorData = await response.json();
        alert(`Error generating report: ${errorData.message || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('Network error:', error);
      alert('Network error. Please check your connection and try again.');
    } finally {
      clearInterval(messageInterval);
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
}

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', () => {
  initSalesReporter();
}); 