export function priceBadge(price: number, cash: number, closed = false) {
  const unaffordable = cash < price;
  return { disabled: closed || unaffordable, unaffordable, label: `$${price}${unaffordable ? ` · Need $${Math.ceil(price - cash)}` : ''}` };
}
export function upgradeState(hasNext: boolean, allowed: boolean, price: number, cash: number, closed = false) {
  const reason = !hasNext ? 'Max tier' : !allowed ? 'Locked' : closed ? 'Game over' : cash < price ? `Need $${Math.ceil(price - cash)}` : '';
  return { disabled: !!reason, reason };
}
