const fs = require('fs');
const { items } = JSON.parse(fs.readFileSync('monday-dump/items-all.json', 'utf8'));

const groups = {};
for (const item of items) {
  const cv = item.column_values || {};
  const marca = cv.status ? String(cv.status).trim() : '';
  const name = item.name.toLowerCase();
  let g;
  if (marca === 'Vacaciones' || marca === 'Compensa') g = 'Vacaciones/compensaciones';
  else if (marca === 'Guardias') g = 'Guardias finde';
  else if (marca === 'Bajas') g = 'Bajas';
  else if (cv.multiple_person_mknzxxsz != null) g = 'Paid';
  else if (name.includes('newsletter')) g = 'Newsletter';
  else if (name.includes('sms')) g = 'SMS';
  else if (name.includes('push')) g = 'Push';
  else if (name.includes('blog')) g = 'Blog y noticias';
  else if (name.includes('reunión') || name.includes('reunion')) g = 'Reuniones';
  else if (name.includes('banner')) g = 'Web';
  else g = 'Social (default)';
  groups[g] = (groups[g] || 0) + 1;
}
console.log('Routing preview:');
Object.entries(groups).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(` ${k}: ${v}`));
