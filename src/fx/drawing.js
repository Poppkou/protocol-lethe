// Детский рисунок «МЫ»: старший(-ая) с телефоном в руке, Соня в жёлтом дождевике.
export function drawingSVG() {
  return `<svg class="drawing" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Детский рисунок: двое держатся за руки, у старшего в руке телефон">
  <defs>
    <filter id="crayon" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2"/>
    </filter>
  </defs>
  <rect width="400" height="300" fill="#fbf8ef"/>
  <g filter="url(#crayon)" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <circle cx="56" cy="52" r="22" stroke="#f2b705" stroke-width="5"/>
    <path d="M56 18v-10M56 96v-10M22 52h-10M100 52h-10M32 28l-7-7M80 28l7-7M32 76l-7 7M80 76l7 7" stroke="#f2b705" stroke-width="4"/>
    <path d="M10 262C80 252 160 268 240 256C300 248 360 262 392 256" stroke="#5aa02c" stroke-width="6"/>
    <circle cx="150" cy="108" r="20" stroke="#3b3b3b" stroke-width="4"/>
    <path d="M132 100c6-14 30-16 36 0" stroke="#5a3a22" stroke-width="6"/>
    <path d="M142 106h3M151 106h3" stroke="#3b3b3b" stroke-width="4"/>
    <path d="M144 118h10" stroke="#3b3b3b" stroke-width="3"/>
    <path d="M150 128v86M150 214l-18 44M150 214l18 44" stroke="#3b3b3b" stroke-width="4"/>
    <path d="M150 150l-28-16M150 150l22 22" stroke="#3b3b3b" stroke-width="4"/>
    <rect x="106" y="116" width="16" height="26" rx="3" fill="#3a6ad6" stroke="#1d3c8a" stroke-width="3"/>
    <path d="M236 122c-14 0-18 12-18 22l-10 66h56l-10-66c0-10-4-22-18-22z" fill="#f2c21b" stroke="#c99a08" stroke-width="3"/>
    <circle cx="236" cy="142" r="11" fill="#f6dcc4" stroke="#7a5233" stroke-width="2"/>
    <path d="M231 140h1M240 140h1" stroke="#222" stroke-width="3"/>
    <path d="M230 147q6 6 12 0" stroke="#c43c2c" stroke-width="2.5"/>
    <path d="M212 176l-40-4" stroke="#3b3b3b" stroke-width="4"/>
    <path d="M226 210v46M246 210v46" stroke="#3b3b3b" stroke-width="4"/>
    <path d="M196 92c-6-10-20-4-12 6l12 12 12-12c8-10-6-16-12-6z" fill="#e0453a" stroke="#c3352b" stroke-width="2"/>
    <text x="200" y="62" text-anchor="middle" font-family="Neucha, 'Comic Sans MS', cursive" font-size="46" fill="#d9302c" stroke="none">МЫ</text>
    <text x="388" y="290" text-anchor="end" font-family="Neucha, 'Comic Sans MS', cursive" font-size="18" fill="#3a6ad6" stroke="none">Соня, 8 лет</text>
  </g>
</svg>`;
}
