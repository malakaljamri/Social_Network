// date.js
// Enhanced utility to format dates with custom formats

function formatDate(dateString, format = "dd/mm/yyyy") {
  if (!dateString) return '';
  
  // Handle SQLite datetime format (YYYY-MM-DD HH:MM:SS)
  let date;
  if (dateString.includes(' ')) {
    // SQLite format: replace space with T for proper parsing
    date = new Date(dateString.replace(' ', 'T'));
  } else {
    // ISO format or other formats
    date = new Date(dateString);
  }
  
  if (isNaN(date.getTime())) return dateString;
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  // Replace format placeholders
  let formatted = format
    .replace('yyyy', year)
    .replace('YYYY', year)
    .replace('mm', month)
    .replace('MM', month)
    .replace('dd', day)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('MM', minutes)
    .replace('SS', seconds);
  
  return formatted;
}

// Legacy function for backward compatibility
function formatDateDDMMYYYY(dateString) {
  return formatDate(dateString, "dd/mm/yyyy");
}

// Export functions to window
window.formatDate = formatDate;
window.formatDateDDMMYYYY = formatDateDDMMYYYY; 