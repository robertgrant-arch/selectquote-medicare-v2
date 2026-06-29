export default function SkipLink() {
  return (
    <a
      href="#main-content"
      style={{ position:'absolute', top:'-100%', left:'8px', zIndex:99999, padding:'10px 18px', backgroundColor:'#1C3A48', color:'#fff', fontWeight:700, fontSize:'14px', borderRadius:'0 0 8px 8px', textDecoration:'none', outline:'3px solid #237A92', outlineOffset:'2px' }}
      onFocus={(e) => { e.currentTarget.style.top = '0'; }}
      onBlur={(e)  => { e.currentTarget.style.top = '-100%'; }}
    >
      Skip to main content
    </a>
  );
}
