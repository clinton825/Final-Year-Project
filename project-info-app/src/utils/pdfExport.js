import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generates a PDF from a specified HTML element
 * 
 * @param {string} elementId - ID of the HTML element to convert to PDF
 * @param {string} filename - Name for the downloaded PDF file (without extension)
 * @param {Object} options - Additional options for PDF generation
 * @param {boolean} options.includeDate - Whether to include date in filename (default: true)
 * @param {string} options.orientation - 'portrait' or 'landscape' (default: 'portrait')
 * @param {number} options.quality - Image quality between 0 and 1 (default: 0.95)
 * @param {number} options.scale - Scale factor for rendering (default: 2)
 */
export const generatePDFFromElement = async (elementId, filename, options = {}) => {
  try {
    // Default options
    const {
      includeDate = true,
      orientation = 'portrait',
      quality = 0.95,
      scale = 2
    } = options;
    
    // Get element to export
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID "${elementId}" not found`);
    }
    
    // Add loading state to the page
    const loadingElement = document.createElement('div');
    loadingElement.className = 'pdf-export-loading';
    loadingElement.style.position = 'fixed';
    loadingElement.style.top = '0';
    loadingElement.style.left = '0';
    loadingElement.style.width = '100%';
    loadingElement.style.height = '100%';
    loadingElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    loadingElement.style.display = 'flex';
    loadingElement.style.justifyContent = 'center';
    loadingElement.style.alignItems = 'center';
    loadingElement.style.zIndex = '9999';
    loadingElement.innerHTML = '<div style="background: white; padding: 20px; border-radius: 5px;">Generating PDF, please wait...</div>';
    document.body.appendChild(loadingElement);
    
    // Give the browser time to render the loading message
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Prepare filename with date if requested
    let fullFilename = filename;
    if (includeDate) {
      const date = new Date();
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
      fullFilename = `${filename}_${dateString}`;
    }
    
    // Generate canvas from element
    const canvas = await html2canvas(element, {
      scale: scale,
      logging: false,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      imageTimeout: 15000,
      quality: quality
    });
    
    // Convert canvas to image
    const imgData = canvas.toDataURL('image/jpeg', quality);
    
    // Calculate PDF dimensions
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = imgWidth / imgHeight;
    
    // Create PDF with proper dimensions
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: 'a4'
    });
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (orientation === 'landscape') 
      ? pdfWidth / ratio 
      : pdfWidth * (imgHeight / imgWidth);
    
    // Add image to PDF
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    
    // Generate and download PDF
    pdf.save(`${fullFilename}.pdf`);
    
    // Clean up the loading element
    document.body.removeChild(loadingElement);
    
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    
    // Clean up the loading element if it exists
    const loadingElement = document.querySelector('.pdf-export-loading');
    if (loadingElement) {
      document.body.removeChild(loadingElement);
    }
    
    // Show error message to user
    alert('Error generating PDF. Please try again later.');
    return false;
  }
};

/**
 * Generates a PDF with project data in a formatted layout
 * 
 * @param {Object} project - The project data
 * @param {Object} options - Additional options for PDF generation
 */
export const generateProjectPDF = (project, options = {}) => {
  try {
    const {
      includeNotes = true,
      includeTimeline = true,
      title = 'Project Details'
    } = options;
    
    // Create a PDF document
    const pdf = new jsPDF();
    
    // Add title
    pdf.setFontSize(22);
    pdf.setTextColor(44, 62, 80);
    pdf.text(title, 20, 20);
    
    // Add project title
    pdf.setFontSize(18);
    pdf.setTextColor(52, 73, 94);
    const projectTitle = project.planning_title || project.planning_name || project.title || 'Untitled Project';
    pdf.text(projectTitle, 20, 30);
    
    // Add horizontal line
    pdf.setDrawColor(189, 195, 199);
    pdf.setLineWidth(0.5);
    pdf.line(20, 35, 190, 35);
    
    // Add project basic info
    pdf.setFontSize(12);
    pdf.setTextColor(44, 62, 80);
    let y = 45;
    
    // Helper function to add key-value pairs
    const addKeyValue = (key, value, indent = 0) => {
      if (value === undefined || value === null || value === '') return;
      
      pdf.setFont(undefined, 'bold');
      pdf.text(`${key}:`, 20 + indent, y);
      pdf.setFont(undefined, 'normal');
      
      // Handle different value types
      let textValue = value;
      if (typeof value === 'number') {
        if (key.toLowerCase().includes('value')) {
          textValue = new Intl.NumberFormat('en-IE', { 
            style: 'currency', 
            currency: 'EUR' 
          }).format(value);
        } else {
          textValue = value.toString();
        }
      } else if (typeof value === 'boolean') {
        textValue = value ? 'Yes' : 'No';
      } else if (value instanceof Date) {
        textValue = value.toLocaleDateString('en-IE');
      }
      
      pdf.text(textValue.toString(), 75, y);
      y += 8;
      
      // If y is close to bottom of page, add a new page
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
    };
    
    // Add project details
    addKeyValue('Project ID', project.planning_id || project.id);
    addKeyValue('Category', project.planning_category || project.category);
    addKeyValue('Subcategory', project.planning_subcategory || project.subcategory);
    addKeyValue('Value', project.planning_value || project.value);
    addKeyValue('Location', project.planning_county || project.county);
    addKeyValue('Town', project.planning_town || project.town);
    addKeyValue('Description', project.planning_description || project.description);
    
    // Add dates if available
    if (project.planning_date || project.date) {
      y += 4;
      pdf.setFont(undefined, 'bold');
      pdf.text('Key Dates:', 20, y);
      y += 8;
      
      if (project.planning_date || project.date) {
        addKeyValue('Planning Date', project.planning_date || project.date, 5);
      }
      if (project.decision_date) {
        addKeyValue('Decision Date', project.decision_date, 5);
      }
      if (project.commencement_date) {
        addKeyValue('Start Date', project.commencement_date, 5);
      }
      if (project.completion_date) {
        addKeyValue('Completion Date', project.completion_date, 5);
      }
    }
    
    // Add status information
    if (project.planning_status || project.status) {
      y += 4;
      addKeyValue('Status', project.planning_status || project.status);
    }
    
    // Save the PDF
    const filename = `project_${project.planning_id || project.id || 'export'}`;
    pdf.save(`${filename}.pdf`);
    
    return true;
  } catch (error) {
    console.error('Error generating project PDF:', error);
    alert('Error generating PDF. Please try again later.');
    return false;
  }
};

/**
 * Generates a comparison PDF with multiple projects
 * 
 * @param {Array} projects - Array of project data objects
 * @param {string} title - Title for the PDF
 */
export const generateComparisonPDF = (projects, title = 'Project Comparison') => {
  try {
    if (!projects || !Array.isArray(projects) || projects.length === 0) {
      throw new Error('No projects provided for comparison');
    }
    
    // Create a PDF document
    const pdf = new jsPDF();
    
    // Add title
    pdf.setFontSize(22);
    pdf.setTextColor(44, 62, 80);
    pdf.text(title, 20, 20);
    
    // Add date
    const today = new Date().toLocaleDateString('en-IE');
    pdf.setFontSize(10);
    pdf.setTextColor(127, 140, 141);
    pdf.text(`Generated on: ${today}`, 20, 27);
    
    // Add horizontal line
    pdf.setDrawColor(189, 195, 199);
    pdf.setLineWidth(0.5);
    pdf.line(20, 30, 190, 30);
    
    // Add project count
    pdf.setFontSize(12);
    pdf.setTextColor(44, 62, 80);
    pdf.text(`Comparing ${projects.length} projects`, 20, 40);
    
    let y = 50;
    
    // Process each project
    projects.forEach((project, index) => {
      // Check if we need a new page
      if (y > 240 && index < projects.length - 1) {
        pdf.addPage();
        y = 20;
      }
      
      // Add project title
      pdf.setFontSize(14);
      pdf.setTextColor(41, 128, 185);
      pdf.setFont(undefined, 'bold');
      const projectTitle = project.planning_title || project.planning_name || project.title || `Project ${index + 1}`;
      pdf.text(projectTitle, 20, y);
      y += 8;
      
      // Add project details
      pdf.setFontSize(10);
      pdf.setTextColor(44, 62, 80);
      pdf.setFont(undefined, 'normal');
      
      // Helper function to add key-value pairs for comparison
      const addComparisonItem = (key, value) => {
        if (value === undefined || value === null || value === '') return;
        
        pdf.setFont(undefined, 'bold');
        pdf.text(`${key}:`, 25, y);
        pdf.setFont(undefined, 'normal');
        
        // Format values appropriately
        let textValue = value;
        if (typeof value === 'number') {
          if (key.toLowerCase().includes('value')) {
            textValue = new Intl.NumberFormat('en-IE', { 
              style: 'currency', 
              currency: 'EUR' 
            }).format(value);
          } else {
            textValue = value.toString();
          }
        } else if (typeof value === 'boolean') {
          textValue = value ? 'Yes' : 'No';
        } else if (value instanceof Date) {
          textValue = value.toLocaleDateString('en-IE');
        }
        
        pdf.text(textValue.toString(), 80, y);
        y += 6;
      };
      
      // Add common project details
      addComparisonItem('Project ID', project.planning_id || project.id);
      addComparisonItem('Category', project.planning_category || project.category);
      addComparisonItem('Value', project.planning_value || project.value);
      addComparisonItem('Location', project.planning_county || project.county);
      addComparisonItem('Status', project.planning_status || project.status);
      
      // Add spacing between projects
      y += 10;
      
      // Add a divider between projects (except for the last one)
      if (index < projects.length - 1) {
        pdf.setDrawColor(189, 195, 199);
        pdf.setLineWidth(0.1);
        pdf.line(20, y - 5, 190, y - 5);
      }
    });
    
    // Generate filename
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `project_comparison_${date}`;
    
    // Save the PDF
    pdf.save(`${filename}.pdf`);
    
    return true;
  } catch (error) {
    console.error('Error generating comparison PDF:', error);
    alert('Error generating PDF. Please try again.');
    return false;
  }
};

export default {
  generatePDFFromElement,
  generateProjectPDF,
  generateComparisonPDF
};
