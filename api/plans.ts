import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── Formulary database (inlined from shared/formulary/database.ts) ────────────
interface DrugProfile { tier: 1 | 2 | 3 | 4; avgMonthlyCost: number; isGeneric: boolean; }

const DRUG_DATABASE: Record<string, DrugProfile> = {
  // TIER 1: Generics
  "lisinopril":            { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "losartan":              { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "amlodipine":            { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "metoprolol":            { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "carvedilol":            { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "hydrochlorothiazide":   { tier: 1, avgMonthlyCost: 8,   isGeneric: true },
  "furosemide":            { tier: 1, avgMonthlyCost: 8,   isGeneric: true },
  "spironolactone":        { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "valsartan":             { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "irbesartan":            { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "ramipril":              { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "enalapril":             { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "benazepril":            { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "diltiazem":             { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "verapamil":             { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "nifedipine":            { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "atenolol":              { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "propranolol":           { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "bisoprolol":            { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "nebivolol":             { tier: 1, avgMonthlyCost: 18,  isGeneric: true },
  "hydralazine":           { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "clonidine":             { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "doxazosin":             { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "terazosin":             { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "prazosin":              { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "triamterene":           { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "chlorthalidone":        { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "bumetanide":            { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "torsemide":             { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "olmesartan":            { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "telmisartan":           { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "candesartan":           { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "atorvastatin":          { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "simvastatin":           { tier: 1, avgMonthlyCost: 8,   isGeneric: true },
  "rosuvastatin":          { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "pravastatin":           { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "lovastatin":            { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "fluvastatin":           { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "ezetimibe":             { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "fenofibrate":           { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "gemfibrozil":           { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "cholestyramine":        { tier: 1, avgMonthlyCost: 18,  isGeneric: true },
  "warfarin":              { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "clopidogrel":           { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "aspirin":               { tier: 1, avgMonthlyCost: 5,   isGeneric: true },
  "dipyridamole":          { tier: 1, avgMonthlyCost: 18,  isGeneric: true },
  "enoxaparin":            { tier: 1, avgMonthlyCost: 25,  isGeneric: true },
  "metformin":             { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "glipizide":             { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "glyburide":             { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "glimepiride":           { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "pioglitazone":          { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "acarbose":              { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "nateglinide":           { tier: 1, avgMonthlyCost: 18,  isGeneric: true },
  "repaglinide":           { tier: 1, avgMonthlyCost: 20,  isGeneric: true },
  "levothyroxine":         { tier: 1, avgMonthlyCost: 18,  isGeneric: true },
  "methimazole":           { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "propylthiouracil":      { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "omeprazole":            { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "pantoprazole":          { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "lansoprazole":          { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "esomeprazole":          { tier: 1, avgMonthlyCost: 16,  isGeneric: true },
  "ranitidine":            { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "famotidine":            { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "sucralfate":            { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "misoprostol":           { tier: 1, avgMonthlyCost: 18,  isGeneric: true },
  "dicyclomine":           { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "ondansetron":           { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "metoclopramide":        { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "lactulose":             { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "polyethylene glycol":   { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "docusate":              { tier: 1, avgMonthlyCost: 6,   isGeneric: true },
  "bisacodyl":             { tier: 1, avgMonthlyCost: 6,   isGeneric: true },
  "loperamide":            { tier: 1, avgMonthlyCost: 8,   isGeneric: true },
  "sulfasalazine":         { tier: 1, avgMonthlyCost: 18,  isGeneric: true },
  "mesalamine":            { tier: 1, avgMonthlyCost: 25,  isGeneric: true },
  "meloxicam":             { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "ibuprofen":             { tier: 1, avgMonthlyCost: 8,   isGeneric: true },
  "naproxen":              { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "diclofenac":            { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "indomethacin":          { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "celecoxib":             { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "acetaminophen":         { tier: 1, avgMonthlyCost: 6,   isGeneric: true },
  "tramadol":              { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "gabapentin":            { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "pregabalin":            { tier: 1, avgMonthlyCost: 18,  isGeneric: true },
  "cyclobenzaprine":       { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "baclofen":              { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "tizanidine":            { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "lidocaine":             { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "capsaicin":             { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "colchicine":            { tier: 1, avgMonthlyCost: 20,  isGeneric: true },
  "allopurinol":           { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "febuxostat":            { tier: 1, avgMonthlyCost: 18,  isGeneric: true },
  "sertraline":            { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "fluoxetine":            { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "escitalopram":          { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "citalopram":            { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "paroxetine":            { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "venlafaxine":           { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "duloxetine":            { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "bupropion":             { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "mirtazapine":           { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "trazodone":             { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "amitriptyline":         { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "nortriptyline":         { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "doxepin":               { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "buspirone":             { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "hydroxyzine":           { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "lorazepam":             { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "alprazolam":            { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "diazepam":              { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "clonazepam":            { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "quetiapine":            { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "olanzapine":            { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "risperidone":           { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "aripiprazole":          { tier: 1, avgMonthlyCost: 18,  isGeneric: true },
  "haloperidol":           { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "lithium":               { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "valproic acid":         { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "lamotrigine":           { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "carbamazepine":         { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "topiramate":            { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "levetiracetam":         { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "phenytoin":             { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "zolpidem":              { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "albuterol":             { tier: 1, avgMonthlyCost: 25,  isGeneric: true },
  "ipratropium":           { tier: 1, avgMonthlyCost: 20,  isGeneric: true },
  "fluticasone":           { tier: 1, avgMonthlyCost: 18,  isGeneric: true },
  "budesonide":            { tier: 1, avgMonthlyCost: 20,  isGeneric: true },
  "montelukast":           { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "theophylline":          { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "tiotropium":            { tier: 1, avgMonthlyCost: 25,  isGeneric: true },
  "benzonatate":           { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "guaifenesin":           { tier: 1, avgMonthlyCost: 8,   isGeneric: true },
  "cetirizine":            { tier: 1, avgMonthlyCost: 6,   isGeneric: true },
  "loratadine":            { tier: 1, avgMonthlyCost: 6,   isGeneric: true },
  "fexofenadine":          { tier: 1, avgMonthlyCost: 8,   isGeneric: true },
  "diphenhydramine":       { tier: 1, avgMonthlyCost: 6,   isGeneric: true },
  "promethazine":          { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "amoxicillin":           { tier: 1, avgMonthlyCost: 8,   isGeneric: true },
  "azithromycin":          { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "ciprofloxacin":         { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "levofloxacin":          { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "doxycycline":           { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "metronidazole":         { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "sulfamethoxazole":      { tier: 1, avgMonthlyCost: 8,   isGeneric: true },
  "cephalexin":            { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "clindamycin":           { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "nitrofurantoin":        { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "fluconazole":           { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "latanoprost":           { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "timolol":               { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "brimonidine":           { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "dorzolamide":           { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "artificial tears":      { tier: 1, avgMonthlyCost: 8,   isGeneric: true },
  "tamsulosin":            { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "finasteride":           { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "dutasteride":           { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "oxybutynin":            { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "tolterodine":           { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "solifenacin":           { tier: 1, avgMonthlyCost: 18,  isGeneric: true },
  "sildenafil":            { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "tadalafil":             { tier: 1, avgMonthlyCost: 18,  isGeneric: true },
  "donepezil":             { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "memantine":             { tier: 1, avgMonthlyCost: 20,  isGeneric: true },
  "rivastigmine":          { tier: 1, avgMonthlyCost: 18,  isGeneric: true },
  "galantamine":           { tier: 1, avgMonthlyCost: 20,  isGeneric: true },
  "prednisone":            { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "prednisolone":          { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "methylprednisolone":    { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "dexamethasone":         { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "testosterone":          { tier: 1, avgMonthlyCost: 25,  isGeneric: true },
  "estradiol":             { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "progesterone":          { tier: 1, avgMonthlyCost: 18,  isGeneric: true },
  "alendronate":           { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "risedronate":           { tier: 1, avgMonthlyCost: 18,  isGeneric: true },
  "methotrexate":          { tier: 1, avgMonthlyCost: 20,  isGeneric: true },
  "hydroxychloroquine":    { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "isosorbide":            { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "nitroglycerin":         { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "digoxin":               { tier: 1, avgMonthlyCost: 12,  isGeneric: true },
  "amiodarone":            { tier: 1, avgMonthlyCost: 15,  isGeneric: true },
  "flecainide":            { tier: 1, avgMonthlyCost: 18,  isGeneric: true },
  "sotalol":               { tier: 1, avgMonthlyCost: 14,  isGeneric: true },
  "potassium chloride":    { tier: 1, avgMonthlyCost: 10,  isGeneric: true },
  "ferrous sulfate":       { tier: 1, avgMonthlyCost: 6,   isGeneric: true },
  "vitamin d":             { tier: 1, avgMonthlyCost: 6,   isGeneric: true },
  "folic acid":            { tier: 1, avgMonthlyCost: 5,   isGeneric: true },
  "cyanocobalamin":        { tier: 1, avgMonthlyCost: 8,   isGeneric: true },
  // TIER 2: Preferred Brand
  "eliquis":               { tier: 2, avgMonthlyCost: 280, isGeneric: false },
  "xarelto":               { tier: 2, avgMonthlyCost: 290, isGeneric: false },
  "pradaxa":               { tier: 2, avgMonthlyCost: 260, isGeneric: false },
  "savaysa":               { tier: 2, avgMonthlyCost: 250, isGeneric: false },
  "brilinta":              { tier: 2, avgMonthlyCost: 240, isGeneric: false },
  "jardiance":             { tier: 2, avgMonthlyCost: 340, isGeneric: false },
  "farxiga":               { tier: 2, avgMonthlyCost: 320, isGeneric: false },
  "invokana":              { tier: 2, avgMonthlyCost: 310, isGeneric: false },
  "januvia":               { tier: 2, avgMonthlyCost: 280, isGeneric: false },
  "tradjenta":             { tier: 2, avgMonthlyCost: 270, isGeneric: false },
  "onglyza":               { tier: 2, avgMonthlyCost: 250, isGeneric: false },
  "ozempic":               { tier: 2, avgMonthlyCost: 450, isGeneric: false },
  "rybelsus":              { tier: 2, avgMonthlyCost: 420, isGeneric: false },
  "trulicity":             { tier: 2, avgMonthlyCost: 400, isGeneric: false },
  "victoza":               { tier: 2, avgMonthlyCost: 380, isGeneric: false },
  "mounjaro":              { tier: 2, avgMonthlyCost: 500, isGeneric: false },
  "byetta":                { tier: 2, avgMonthlyCost: 350, isGeneric: false },
  "bydureon":              { tier: 2, avgMonthlyCost: 380, isGeneric: false },
  "lantus":                { tier: 2, avgMonthlyCost: 180, isGeneric: false },
  "levemir":               { tier: 2, avgMonthlyCost: 180, isGeneric: false },
  "tresiba":               { tier: 2, avgMonthlyCost: 200, isGeneric: false },
  "toujeo":                { tier: 2, avgMonthlyCost: 190, isGeneric: false },
  "basaglar":              { tier: 2, avgMonthlyCost: 170, isGeneric: false },
  "humalog":               { tier: 2, avgMonthlyCost: 170, isGeneric: false },
  "novolog":               { tier: 2, avgMonthlyCost: 170, isGeneric: false },
  "admelog":               { tier: 2, avgMonthlyCost: 160, isGeneric: false },
  "fiasp":                 { tier: 2, avgMonthlyCost: 180, isGeneric: false },
  "novolin":               { tier: 2, avgMonthlyCost: 140, isGeneric: false },
  "humulin":               { tier: 2, avgMonthlyCost: 140, isGeneric: false },
  "entresto":              { tier: 2, avgMonthlyCost: 380, isGeneric: false },
  "corlanor":              { tier: 2, avgMonthlyCost: 280, isGeneric: false },
  "ranexa":                { tier: 2, avgMonthlyCost: 240, isGeneric: false },
  "multaq":                { tier: 2, avgMonthlyCost: 300, isGeneric: false },
  "verquvo":               { tier: 2, avgMonthlyCost: 350, isGeneric: false },
  "vascepa":               { tier: 2, avgMonthlyCost: 200, isGeneric: false },
  "repatha":               { tier: 2, avgMonthlyCost: 400, isGeneric: false },
  "praluent":              { tier: 2, avgMonthlyCost: 380, isGeneric: false },
  "leqvio":                { tier: 2, avgMonthlyCost: 450, isGeneric: false },
  "symbicort":             { tier: 2, avgMonthlyCost: 180, isGeneric: false },
  "spiriva":               { tier: 2, avgMonthlyCost: 260, isGeneric: false },
  "advair":                { tier: 2, avgMonthlyCost: 200, isGeneric: false },
  "breo":                  { tier: 2, avgMonthlyCost: 220, isGeneric: false },
  "trelegy":               { tier: 2, avgMonthlyCost: 350, isGeneric: false },
  "dulera":                { tier: 2, avgMonthlyCost: 190, isGeneric: false },
  "incruse":               { tier: 2, avgMonthlyCost: 200, isGeneric: false },
  "anoro":                 { tier: 2, avgMonthlyCost: 280, isGeneric: false },
  "stiolto":               { tier: 2, avgMonthlyCost: 260, isGeneric: false },
  "nucala":                { tier: 2, avgMonthlyCost: 1800, isGeneric: false },
  "fasenra":               { tier: 2, avgMonthlyCost: 1600, isGeneric: false },
  "lyrica":                { tier: 2, avgMonthlyCost: 240, isGeneric: false },
  "cymbalta":              { tier: 2, avgMonthlyCost: 200, isGeneric: false },
  "nucynta":               { tier: 2, avgMonthlyCost: 280, isGeneric: false },
  "lumigan":               { tier: 2, avgMonthlyCost: 120, isGeneric: false },
  "restasis":              { tier: 2, avgMonthlyCost: 300, isGeneric: false },
  "xiidra":                { tier: 2, avgMonthlyCost: 350, isGeneric: false },
  "eylea":                 { tier: 2, avgMonthlyCost: 800, isGeneric: false },
  "lucentis":              { tier: 2, avgMonthlyCost: 900, isGeneric: false },
  "prolia":                { tier: 2, avgMonthlyCost: 500, isGeneric: false },
  "evenity":               { tier: 2, avgMonthlyCost: 600, isGeneric: false },
  "forteo":                { tier: 2, avgMonthlyCost: 1400, isGeneric: false },
  "tymlos":                { tier: 2, avgMonthlyCost: 1200, isGeneric: false },
  "vraylar":               { tier: 2, avgMonthlyCost: 500, isGeneric: false },
  "rexulti":               { tier: 2, avgMonthlyCost: 480, isGeneric: false },
  "latuda":                { tier: 2, avgMonthlyCost: 450, isGeneric: false },
  "trintellix":            { tier: 2, avgMonthlyCost: 280, isGeneric: false },
  "spravato":              { tier: 2, avgMonthlyCost: 600, isGeneric: false },
  "xeljanz":               { tier: 2, avgMonthlyCost: 2800, isGeneric: false },
  "aubagio":               { tier: 2, avgMonthlyCost: 3000, isGeneric: false },
  "gilenya":               { tier: 2, avgMonthlyCost: 3500, isGeneric: false },
  "tecfidera":             { tier: 2, avgMonthlyCost: 3200, isGeneric: false },
  "synthroid":             { tier: 2, avgMonthlyCost: 40,   isGeneric: false },
  // TIER 3: Non-Preferred Brand
  "humira":                { tier: 3, avgMonthlyCost: 2800, isGeneric: false },
  "enbrel":                { tier: 3, avgMonthlyCost: 2600, isGeneric: false },
  "otezla":                { tier: 3, avgMonthlyCost: 1800, isGeneric: false },
  "rinvoq":                { tier: 3, avgMonthlyCost: 3200, isGeneric: false },
  "cosentyx":              { tier: 3, avgMonthlyCost: 2400, isGeneric: false },
  "taltz":                 { tier: 3, avgMonthlyCost: 3000, isGeneric: false },
  "skyrizi":               { tier: 3, avgMonthlyCost: 3500, isGeneric: false },
  "tremfya":               { tier: 3, avgMonthlyCost: 2800, isGeneric: false },
  "cimzia":                { tier: 3, avgMonthlyCost: 2200, isGeneric: false },
  "simponi":               { tier: 3, avgMonthlyCost: 2500, isGeneric: false },
  "orencia":               { tier: 3, avgMonthlyCost: 2400, isGeneric: false },
  "actemra":               { tier: 3, avgMonthlyCost: 2600, isGeneric: false },
  "kevzara":               { tier: 3, avgMonthlyCost: 2200, isGeneric: false },
  "olumiant":              { tier: 3, avgMonthlyCost: 2500, isGeneric: false },
  "sotyktu":               { tier: 3, avgMonthlyCost: 2800, isGeneric: false },
  "wegovy":                { tier: 3, avgMonthlyCost: 800,  isGeneric: false },
  "zepbound":              { tier: 3, avgMonthlyCost: 750,  isGeneric: false },
  // TIER 4: Specialty
  "keytruda":              { tier: 4, avgMonthlyCost: 10000, isGeneric: false },
  "opdivo":                { tier: 4, avgMonthlyCost: 9500,  isGeneric: false },
  "tecentriq":             { tier: 4, avgMonthlyCost: 9000,  isGeneric: false },
  "yervoy":                { tier: 4, avgMonthlyCost: 12000, isGeneric: false },
  "revlimid":              { tier: 4, avgMonthlyCost: 8000,  isGeneric: false },
  "ibrance":               { tier: 4, avgMonthlyCost: 7500,  isGeneric: false },
  "imbruvica":             { tier: 4, avgMonthlyCost: 8500,  isGeneric: false },
  "jakafi":                { tier: 4, avgMonthlyCost: 9000,  isGeneric: false },
  "stelara":               { tier: 4, avgMonthlyCost: 6000,  isGeneric: false },
  "dupixent":              { tier: 4, avgMonthlyCost: 2400,  isGeneric: false },
  "ocrevus":               { tier: 4, avgMonthlyCost: 5500,  isGeneric: false },
  "tysabri":               { tier: 4, avgMonthlyCost: 5000,  isGeneric: false },
  "kisqali":               { tier: 4, avgMonthlyCost: 7000,  isGeneric: false },
  "verzenio":              { tier: 4, avgMonthlyCost: 7200,  isGeneric: false },
  "tagrisso":              { tier: 4, avgMonthlyCost: 8000,  isGeneric: false },
  "calquence":             { tier: 4, avgMonthlyCost: 7500,  isGeneric: false },
  "venclexta":             { tier: 4, avgMonthlyCost: 6500,  isGeneric: false },
  "pomalyst":              { tier: 4, avgMonthlyCost: 8500,  isGeneric: false },
  "ninlaro":               { tier: 4, avgMonthlyCost: 7000,  isGeneric: false },
  "darzalex":              { tier: 4, avgMonthlyCost: 8000,  isGeneric: false },
  "rituxan":               { tier: 4, avgMonthlyCost: 6000,  isGeneric: false },
  "herceptin":             { tier: 4, avgMonthlyCost: 5500,  isGeneric: false },
  "avastin":               { tier: 4, avgMonthlyCost: 5000,  isGeneric: false },
  "erbitux":               { tier: 4, avgMonthlyCost: 6000,  isGeneric: false },
  "opdualag":              { tier: 4, avgMonthlyCost: 11000, isGeneric: false },
  "enhertu":               { tier: 4, avgMonthlyCost: 9000,  isGeneric: false },
  "padcev":                { tier: 4, avgMonthlyCost: 8500,  isGeneric: false },
  "trodelvy":              { tier: 4, avgMonthlyCost: 8000,  isGeneric: false },
  "spinraza":              { tier: 4, avgMonthlyCost: 12000, isGeneric: false },
  "zolgensma":             { tier: 4, avgMonthlyCost: 15000, isGeneric: false },
  "soliris":               { tier: 4, avgMonthlyCost: 14000, isGeneric: false },
  "ultomiris":             { tier: 4, avgMonthlyCost: 13000, isGeneric: false },
};

// ── Formulary calculator (inlined from shared/formulary/calculator.ts) ─────────
interface DrugInput { name: string; dosage?: string; }

function classifyUnknownDrug(name: string): DrugProfile {
  const lower = name.toLowerCase();
  const genericSuffixes = ["pril","olol","sartan","statin","prazole","tidine","dipine","azepam","oxetine","pram","azole","mycin","cillin","cycline","gliptin","gliflozin","glutide","mab","nib","tinib","zomib","parib","lisib","fenac","profen","coxib","olone","asone","onide","lukast","phylline","tropium","terol","amide","thiazide","pamine","setron","pride"];
  if (genericSuffixes.some(s => lower.endsWith(s))) return { tier: 1, avgMonthlyCost: 15, isGeneric: true };
  const brandIndicators = ["xr","er","sr","cr","la","xl","hfa"];
  if (brandIndicators.some(s => lower.endsWith(s))) return { tier: 2, avgMonthlyCost: 200, isGeneric: false };
  return { tier: 2, avgMonthlyCost: 200, isGeneric: false };
}

function parseCopayAmount(copayStr: string): { type: 'flat' | 'percent'; value: number } {
  if (!copayStr) return { type: 'flat', value: 0 };
  const str = copayStr.toLowerCase().trim();
  const pct = str.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) return { type: 'percent', value: parseFloat(pct[1]) };
  const dollar = str.match(/\$\s*(\d+(?:\.\d+)?)/);
  if (dollar) return { type: 'flat', value: parseFloat(dollar[1]) };
  const num = str.match(/(\d+(?:\.\d+)?)/);
  if (num) return { type: 'flat', value: parseFloat(num[1]) };
  return { type: 'flat', value: 0 };
}

function parseDeductible(d: string | number | undefined): number {
  if (typeof d === 'number') return d;
  if (!d) return 0;
  const m = String(d).match(/\$?\s*(\d+(?:,\d{3})*)/);
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
}

const OOP_CAP_2026 = 2100;
const MAX_DEDUCTIBLE_2026 = 615;

function enrichPlansWithDrugCosts(plans: any[], drugs: DrugInput[]): any[] {
  if (!drugs || drugs.length === 0) return plans;
  return plans.map(plan => {
    const rx = {
      tier1: plan.rxDrugs?.tier1 ?? '$0',
      tier2: plan.rxDrugs?.tier2 ?? '$10',
      tier3: plan.rxDrugs?.tier3 ?? '$42',
      tier4: plan.rxDrugs?.tier4 ?? '25%',
      deductible: plan.rxDrugs?.deductible ?? '$0',
    };
    const drugDeductible = Math.min(parseDeductible(rx.deductible), MAX_DEDUCTIBLE_2026);
    const tierCopays = {
      1: parseCopayAmount(rx.tier1),
      2: parseCopayAmount(rx.tier2),
      3: parseCopayAmount(rx.tier3),
      4: parseCopayAmount(rx.tier4),
    };
    const profiles = drugs.map(d => ({
      drug: d,
      profile: DRUG_DATABASE[d.name.toLowerCase().trim()] ?? classifyUnknownDrug(d.name),
    }));

    let cumulativeOOP = 0;
    let deductibleRemaining = drugDeductible;
    const drugAnnualCosts = new Map<string, number>(drugs.map(d => [d.name, 0]));

    for (let month = 0; month < 12; month++) {
      for (const { drug, profile } of profiles) {
        if (cumulativeOOP >= OOP_CAP_2026) continue;
        let memberPays: number;
        if (deductibleRemaining > 0 && profile.tier > 1) {
          memberPays = Math.min(profile.avgMonthlyCost, deductibleRemaining);
          deductibleRemaining -= memberPays;
        } else {
          const copay = tierCopays[profile.tier as 1 | 2 | 3 | 4];
          memberPays = copay.type === 'flat' ? copay.value : profile.avgMonthlyCost * (copay.value / 100);
        }
        const remaining = OOP_CAP_2026 - cumulativeOOP;
        if (memberPays > remaining) memberPays = remaining;
        cumulativeOOP += memberPays;
        drugAnnualCosts.set(drug.name, (drugAnnualCosts.get(drug.name) ?? 0) + memberPays);
      }
    }

    const annualPremium = (plan.premium ?? 0) * 12;
    return {
      ...plan,
      estimatedAnnualDrugCost: Math.round(cumulativeOOP),
      estimatedTotalAnnualCost: annualPremium + Math.round(cumulativeOOP),
    };
  });
}

// ── CDN / CMS config ──────────────────────────────────────────────────────────
const CDN_BASE = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663319810046/5TY7JcF275WMujMHZWWJT8';
const STATE_CDN_URLS: Record<string, string> = {
  AL: `${CDN_BASE}/AL_67b904f5.json`, AR: `${CDN_BASE}/AR_44da840b.json`,
  AZ: `${CDN_BASE}/AZ_822fc811.json`, CA: `${CDN_BASE}/CA_0e63b144.json`,
  CO: `${CDN_BASE}/CO_d5d0202e.json`, CT: `${CDN_BASE}/CT_fe117f1a.json`,
  DC: `${CDN_BASE}/DC_956b23b8.json`, DE: `${CDN_BASE}/DE_e49d3fed.json`,
  FL: `${CDN_BASE}/FL_49f1876a.json`, GA: `${CDN_BASE}/GA_533e1fca.json`,
  HI: `${CDN_BASE}/HI_fa323526.json`, IA: `${CDN_BASE}/IA_c0fbfe84.json`,
  ID: `${CDN_BASE}/ID_36678396.json`, IL: `${CDN_BASE}/IL_4defe286.json`,
  IN: `${CDN_BASE}/IN_dc82ef53.json`, KS: `${CDN_BASE}/KS_7e35aefd.json`,
  KY: `${CDN_BASE}/KY_d429ac6a.json`, LA: `${CDN_BASE}/LA_135fa9eb.json`,
  MA: `${CDN_BASE}/MA_a8cf20c4.json`, MD: `${CDN_BASE}/MD_e84fb99f.json`,
  ME: `${CDN_BASE}/ME_32265cbc.json`, MI: `${CDN_BASE}/MI_2be468a6.json`,
  MN: `${CDN_BASE}/MN_eda92d03.json`, MO: `${CDN_BASE}/MO_4e9fdf09.json`,
  MS: `${CDN_BASE}/MS_c8f93956.json`, MT: `${CDN_BASE}/MT_686ff40b.json`,
  NC: `${CDN_BASE}/NC_036848e7.json`, ND: `${CDN_BASE}/ND_f12b42a3.json`,
  NE: `${CDN_BASE}/NE_960f49d1.json`, NH: `${CDN_BASE}/NH_d1021c0f.json`,
  NJ: `${CDN_BASE}/NJ_4f264fd0.json`, NM: `${CDN_BASE}/NM_446e840a.json`,
  NV: `${CDN_BASE}/NV_9ca45f94.json`, NY: `${CDN_BASE}/NY_d3c0c09e.json`,
  OH: `${CDN_BASE}/OH_ec644008.json`, OK: `${CDN_BASE}/OK_3e52d056.json`,
  OR: `${CDN_BASE}/OR_4d1de179.json`, PA: `${CDN_BASE}/PA_124dc2c6.json`,
  PR: `${CDN_BASE}/PR_2ff56627.json`, RI: `${CDN_BASE}/RI_74672982.json`,
  SC: `${CDN_BASE}/SC_3ceb6e53.json`, SD: `${CDN_BASE}/SD_0553bb69.json`,
  TN: `${CDN_BASE}/TN_cf7b12c8.json`, TX: `${CDN_BASE}/TX_2dd68bdd.json`,
  UT: `${CDN_BASE}/UT_ac1faf77.json`, VA: `${CDN_BASE}/VA_db8b8a4c.json`,
  VT: `${CDN_BASE}/VT_8e463fe4.json`, WA: `${CDN_BASE}/WA_43e2f67b.json`,
  WI: `${CDN_BASE}/WI_003da44b.json`, WV: `${CDN_BASE}/WV_c5df6929.json`,
  WY: `${CDN_BASE}/WY_02219b63.json`,
};

const CMS_ZIP_API = 'https://marketplace.api.healthcare.gov/api/v1/counties/by/zip';
const CMS_API_KEY = process.env.CMS_MARKETPLACE_API_KEY ?? '';

const stateCache = new Map<string, Record<string, any[]>>();
const zipCache = new Map<string, { stateAbbr: string; countyName: string }>();

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bOf\b/g, 'of').replace(/\bThe\b/g, 'the');
}

function classifySnpCategory(snpType?: string, planName?: string): string | null {
  if (!snpType && !planName) return null;
  const raw = ((snpType || '') + ' ' + (planName || '')).toUpperCase();
  if (raw.includes('D-SNP') || raw.includes('DSNP') || raw.includes('DUAL')) return 'DSNP';
  if (raw.includes('C-SNP') || raw.includes('CSNP') || raw.includes('CHRONIC')) return 'CSNP';
  if (raw.includes('I-SNP') || raw.includes('ISNP') || raw.includes('INSTITUTIONAL')) return 'ISNP';
  if (raw.includes('SNP')) return 'OTHER_SNP';
  return null;
}

async function resolveZipToCounty(zip: string) {
  const cached = zipCache.get(zip);
  if (cached) return cached;
  try {
    const res = await fetch(`${CMS_ZIP_API}/${zip}?apikey=${CMS_API_KEY}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const counties = data.counties;
    if (!counties || counties.length === 0) return null;
    const primary = counties[0];
    const result = { stateAbbr: primary.state.toUpperCase(), countyName: primary.name.toUpperCase() };
    zipCache.set(zip, result);
    return result;
  } catch {
    return null;
  }
}

async function getStateData(stateAbbr: string) {
  const cached = stateCache.get(stateAbbr);
  if (cached) return cached;
  const url = STATE_CDN_URLS[stateAbbr];
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, any[]>;
    stateCache.set(stateAbbr, data);
    return data;
  } catch {
    return null;
  }
}

function findPlansForCounty(stateData: Record<string, any[]>, countyName: string): any[] {
  const upper = countyName.toUpperCase();
  if (stateData[upper]) return stateData[upper];
  const without = upper.replace(/ COUNTY$/, '').trim();
  for (const key of Object.keys(stateData)) {
    if (key === without || key.replace(/ COUNTY$/, '') === without) return stateData[key];
  }
  for (const key of Object.keys(stateData)) {
    if (key.includes(without) || without.includes(key.replace(/ COUNTY$/, ''))) return stateData[key];
  }
  return [];
}

function annotatePlans(plans: any[]): any[] {
  const sorted = [...plans].sort((a: any, b: any) => {
    const moopA = a.maxOutOfPocket ?? a.outOfPocketMax ?? a.moop ?? Infinity;
    const moopB = b.maxOutOfPocket ?? b.outOfPocketMax ?? b.moop ?? Infinity;
    if (moopA !== moopB) return moopA - moopB;
    return (a.premium ?? 0) - (b.premium ?? 0);
  });
  return sorted.map((plan: any, idx) => {
    const snpType = (plan.snpType ?? '').toLowerCase();
    const planName = plan.planName ?? plan.name ?? '';
    const isISnp = snpType.includes('institutional') || planName.includes('I-SNP');
    return {
      ...plan,
      isBestMatch: idx === 0,
      isMostPopular: idx === 1,
      isNonCommissionable: isISnp,
      snpCategory: classifySnpCategory(plan.snpType, planName),
    };
  });
}

function parseDrugsParam(drugsParam: string | string[] | undefined): DrugInput[] {
  if (!drugsParam) return [];
  try {
    if (typeof drugsParam === 'string') return JSON.parse(drugsParam);
    if (Array.isArray(drugsParam)) return JSON.parse(drugsParam[0]);
  } catch (err) {
    console.warn('[Plans API] Failed to parse drugs param:', err);
  }
  return [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigins = ['https://medicare-quote-app.vercel.app', 'http://localhost:5173'];
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes(origin) ? origin : allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const zip = (typeof req.query.zip === 'string' ? req.query.zip : '').trim();
  if (!zip || !/^\d{5}$/.test(zip)) {
    return res.status(400).json({ error: 'Please provide a valid 5-digit ZIP code.', plans: [] });
  }

  try {
    const location = await resolveZipToCounty(zip);
    if (!location) {
      return res.status(404).json({
        error: `Could not find county information for ZIP code ${zip}.`,
        plans: [],
        location: null,
      });
    }

    const { stateAbbr, countyName } = location;
    const stateData = await getStateData(stateAbbr);
    if (!stateData) {
      return res.status(503).json({
        error: `Plan data for ${stateAbbr} is temporarily unavailable.`,
        plans: [],
        location: { stateAbbr, countyName: toTitleCase(countyName), zip },
      });
    }

    const rawPlans = findPlansForCounty(stateData, countyName);
    if (rawPlans.length === 0) {
      return res.status(404).json({
        error: `No Medicare Advantage plans found for ${toTitleCase(countyName)}, ${stateAbbr}.`,
        plans: [],
        location: { stateAbbr, countyName: toTitleCase(countyName), zip },
      });
    }

    let plans = annotatePlans(rawPlans);

    const drugs = parseDrugsParam(req.query.drugs as string | string[] | undefined);
    if (drugs.length > 0) {
      plans = enrichPlansWithDrugCosts(plans, drugs);
    }

    return res.status(200).json({
      plans,
      location: { stateAbbr, countyName: toTitleCase(countyName), zip },
      totalAvailable: rawPlans.length,
      showing: plans.length,
    });
  } catch (err) {
    console.error('[Plans API] Error:', err);
    return res.status(500).json({ error: 'An unexpected error occurred while loading plans.', plans: [] });
  }
}

export { enrichPlansWithDrugCosts };
