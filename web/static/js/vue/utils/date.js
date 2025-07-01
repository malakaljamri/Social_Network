// date.js
// Utility to format a date string as dd/mm/yyyy

export function formatDateDDMMYYYY(dateString) {
  if (!dateString) return '';
  // Extract only the date part (YYYY-MM-DD) from ISO or SQL string
  let datePart = dateString.split('T')[0].split(' ')[0];
  // Now datePart should be YYYY-MM-DD
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return dateString;
  return `${day}/${month}/${year}`;
}
// Optionally attach to window for global use
window.formatDateDDMMYYYY = formatDateDDMMYYYY; 