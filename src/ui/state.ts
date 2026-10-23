export function priceBadge(price: number, cash: number, closed = false) {
  const unaffordable = cash < price;
  // The tile shows only the price (red when short, like the game); the shortfall goes to the tooltip / screen readers.
  return { disabled: closed || unaffordable, unaffordable, label: `$${price.toLocaleString()}`, need: unaffordable ? `Need $${Math.ceil(price - cash).toLocaleString()}` : '' };
}
export function upgradeState(hasNext: boolean, allowed: boolean, price: number, cash: number, closed = false) {
  const reason = !hasNext ? 'Max tier' : !allowed ? 'Locked' : closed ? 'Game over' : cash < price ? `Need $${Math.ceil(price - cash)}` : '';
  return { disabled: !!reason, reason };
}
