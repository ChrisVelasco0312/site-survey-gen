export const formatReportDate = (dateValue?: string, createdAt?: number): string => {
  const formatParts = (day: number, month: number, year: number) => {
    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    return `${dd}/${mm}/${year}`;
  };

  if (dateValue) {
    const normalized = dateValue.trim();

    const isoDateOnly = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoDateOnly) {
      const [, year, month, day] = isoDateOnly;
      return formatParts(Number(day), Number(month), Number(year));
    }

    const slashDate = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashDate) {
      const [, day, month, year] = slashDate;
      return formatParts(Number(day), Number(month), Number(year));
    }

    const dashDate = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dashDate) {
      const [, day, month, year] = dashDate;
      return formatParts(Number(day), Number(month), Number(year));
    }

    const parsed = Date.parse(normalized);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
  }

  if (createdAt) {
    return new Date(createdAt).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  return '-';
};
