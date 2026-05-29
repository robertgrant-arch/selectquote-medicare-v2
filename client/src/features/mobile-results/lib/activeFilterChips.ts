export interface ActiveChip { id: string; label: string; filterKey: string; value: string; }
const BENEFIT_LABELS: Record<string,string> = { dental:'Dental', vision:'Vision', hearing:'Hearing', otc:'OTC', fitness:'Fitness', transportation:'Transportation', telehealth:'Telehealth' };
const SNP_LABELS: Record<string,string> = { DSNP:'D-SNP', CSNP:'C-SNP', ISNP:'I-SNP' };

export function computeActiveChips(filters: any, defaultPremiumMax = 500): ActiveChip[] {
  const chips: ActiveChip[] = [];
  for (const t of (filters.planType ?? [])) chips.push({ id:`type-${t}`, label:t, filterKey:'planType', value:t });
  for (const c of (filters.snpCategories ?? [])) chips.push({ id:`snp-${c}`, label:SNP_LABELS[c]??c, filterKey:'snpCategories', value:c });
  for (const c of (filters.carriers ?? [])) {
    const label = c.length > 12 ? c.slice(0,12)+'…' : c;
    chips.push({ id:`carrier-${c}`, label, filterKey:'carriers', value:c });
  }
  for (const b of (filters.benefits ?? [])) chips.push({ id:`benefit-${b}`, label:BENEFIT_LABELS[b]??b, filterKey:'benefits', value:b });
  if (filters.premiumRange?.[1] < defaultPremiumMax) chips.push({ id:'premium-cap', label:`≤$${filters.premiumRange[1]}/mo`, filterKey:'premiumRange', value:'cap' });
  return chips;
}

export function removeChip(filters: any, chip: ActiveChip): any {
  const f = { ...filters };
  switch (chip.filterKey) {
    case 'planType': f.planType = (filters.planType??[]).filter((v:string)=>v!==chip.value); break;
    case 'snpCategories': f.snpCategories = (filters.snpCategories??[]).filter((v:string)=>v!==chip.value); break;
    case 'carriers': f.carriers = (filters.carriers??[]).filter((v:string)=>v!==chip.value); break;
    case 'benefits': f.benefits = (filters.benefits??[]).filter((v:string)=>v!==chip.value); break;
    case 'premiumRange': f.premiumRange = [0, 500]; break;
  }
  return f;
}

export function chipCount(filters: any): number { return computeActiveChips(filters).length; }
