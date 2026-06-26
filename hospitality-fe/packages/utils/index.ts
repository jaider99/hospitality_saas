export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-IE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function calculateRecipeMargin(sellingPrice: number, totalCost: number): number {
  if (sellingPrice <= 0) return 0;
  return ((sellingPrice - totalCost) / sellingPrice) * 100;
}

export function calculateLaborRatio(laborCost: number, salesRevenue: number): number {
  if (salesRevenue <= 0) return 0;
  return (laborCost / salesRevenue) * 100;
}

export function getPriceChangeTrendText(productName: string, changePercentage: number, newCost: number): string {
  const direction = changePercentage > 0 ? 'increased' : 'decreased';
  const absPct = Math.abs(changePercentage).toFixed(1);
  return `${productName} ${direction} by ${absPct}% (now ${formatCurrency(newCost)})`;
}
