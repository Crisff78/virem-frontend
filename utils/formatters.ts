export const toInt = (v: any) => parseInt(String(v || 0), 10) || 0;
export const toMoney = (v: any) => parseFloat(String(v || 0)) || 0;

export const formatMoney = (amount: any, currency = 'DOP') => {
  const val = toMoney(amount);
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency,
  }).format(val);
};

export const formatBudgetMoney = (amount: any, currency = 'DOP') => {
  return formatMoney(amount, currency);
};

export const formatDateTime = (date: string | Date | null | undefined) => {
  if (!date) return 'N/A';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Fecha inválida';
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return 'Fecha inválida';
  }
};

export const formatOnlyDate = (date: any) => {
  if (!date) return '';
  const str = String(date).trim();
  // Si viene en formato ISO (YYYY-MM-DD...), extraemos solo la fecha y la ponemos bonita
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`; // DD/MM/YYYY
  }
  // Si ya viene como DD/MM/YYYY, lo dejamos igual
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) return str;
  return str;
};

export const normalizeText = (v: any) => String(v || '').trim();
export const normalizeSearch = (v: any) => normalizeText(v).toLowerCase();

export const isToday = (date: string | Date | null | undefined) => {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  return d.getDate() === now.getDate() &&
         d.getMonth() === now.getMonth() &&
         d.getFullYear() === now.getFullYear();
};

export const titleCase = (value: string) => {
  const text = normalizeText(value);
  if (!text) return '';
  return text
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const formatCedula = (cedula: any) => {
  const val = String(cedula || '').replace(/\D/g, '');
  if (val.length !== 11) return val;
  return `${val.slice(0, 3)}-${val.slice(3, 10)}-${val.slice(10)}`;
};

export const formatPhone = (phone: any) => {
  const val = String(phone || '').replace(/\D/g, '');
  if (val.length !== 10) return val;
  return `(${val.slice(0, 3)}) ${val.slice(3, 6)}-${val.slice(6)}`;
};
