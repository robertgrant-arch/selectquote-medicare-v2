import type { ZipCounty } from '../lib/zipValidator';

interface Props {
  zip: string;
  counties: ZipCounty[];
  onSelect: (county: ZipCounty) => void;
}

export default function CountySelector({ zip, counties, onSelect }: Props) {
  return (
    <div
      role="group"
      aria-labelledby="county-selector-label"
      data-testid="county-selector"
      style={{ marginTop:'10px', padding:'12px 14px', borderRadius:'10px', backgroundColor:'#EFF6FF', border:'1px solid #BFDBFE' }}
    >
      <p
        id="county-selector-label"
        style={{ fontSize:'12px', fontWeight:700, color:'#1B365D', margin:'0 0 8px' }}
      >
        ZIP {zip} covers multiple counties. Which county are you in?
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
        {counties.map((county) => (
          <button
            key={`${county.state}-${county.name}`}
            onClick={() => onSelect(county)}
            aria-label={`Select ${county.name}, ${county.state}`}
            style={{
              padding:'9px 14px', borderRadius:'8px', border:'1px solid #BFDBFE',
              backgroundColor:'#fff', cursor:'pointer', textAlign:'left',
              fontSize:'13px', fontWeight:600, color:'#1B365D',
              display:'flex', alignItems:'center', justifyContent:'space-between',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor='#DBEAFE'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor='#fff'; }}
          >
            <span>{county.name}, {county.state}</span>
            <span style={{ fontSize:'11px', color:'#6B7280' }}>→</span>
          </button>
        ))}
      </div>
    </div>
  );
}
