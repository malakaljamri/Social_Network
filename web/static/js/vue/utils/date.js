// date.js
// Utility to format a date string as dd/mm/yyyy (no time)

function formatDateDDMMYYYY(dateString) {
  if (!dateString) return '';
  // Extract only the date part (YYYY-MM-DD) from ISO or SQL string
  let datePart = dateString.split('T')[0].split(' ')[0];
  const parts = datePart.split('-');
  if (parts.length !== 3) return dateString;
  // Reverse to dd/mm/yyyy
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
window.formatDateDDMMYYYY = formatDateDDMMYYYY; 