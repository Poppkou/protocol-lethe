// Фигура в жёлтом дождевике. face: 'pixel' — лицо стёрто в пиксели,
// 'void' — пустота, 'crayon' — лицо, каким Соня рисовала себя. back — вид со спины.
import { rand } from '../core/dom.js';

let uid = 0;

export function figureSVG({ face = 'pixel', back = false, cls = '' } = {}) {
  const id = `fig${++uid}`;
  const coat = '#d6a21e';
  const shade = '#94700f';
  const dark = '#1b1a18';
  let faceSVG = '';
  if (!back) {
    if (face === 'pixel') {
      let cells = '';
      for (let y = 30; y < 68; y += 4.75) {
        for (let x = 34; x < 66; x += 4.6) {
          const v = Math.floor(rand(18, 120));
          cells += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="4.7" height="4.85" fill="rgb(${v},${Math.floor(v * 0.95)},${Math.floor(v * 0.9)})"/>`;
        }
      }
      faceSVG = `<ellipse cx="50" cy="49" rx="16" ry="19" fill="#0b0b0b"/><g clip-path="url(#${id}c)">${cells}</g>`;
    } else if (face === 'void') {
      faceSVG = '<ellipse cx="50" cy="49" rx="16" ry="19" fill="#040404"/>';
    } else {
      faceSVG = `<ellipse cx="50" cy="49" rx="16" ry="19" fill="#3b2a1c"/>
      <g filter="url(#${id}w)">
        <ellipse cx="50" cy="50" rx="14" ry="17" fill="#f0cfae"/>
        <path d="M36 42 C39 31 61 29 64 42 C57 37 44 37 36 42 Z" fill="#5a3a22"/>
        <path d="M37 44 C35 52 36 60 38 64 M63 44 C65 52 64 60 62 64" stroke="#5a3a22" stroke-width="2.2" fill="none"/>
        <circle cx="44.5" cy="49" r="1.9" fill="#2b2622"/><circle cx="55.5" cy="49" r="1.9" fill="#2b2622"/>
        <circle cx="41" cy="56" r="2.8" fill="#ef9a86" opacity="0.55"/><circle cx="59" cy="56" r="2.8" fill="#ef9a86" opacity="0.55"/>
        <g fill="#b3693f"><circle cx="46" cy="54" r="0.6"/><circle cx="48" cy="55.5" r="0.55"/><circle cx="52" cy="55.5" r="0.55"/><circle cx="54" cy="54" r="0.6"/><circle cx="50" cy="53.4" r="0.5"/></g>
        <path d="M44.5 59 Q50 64 55.5 59" stroke="#8c3b2a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      </g>`;
    }
  }
  return `<svg class="figure ${cls}" viewBox="0 0 100 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="${coat}"/><stop offset="1" stop-color="${shade}"/></linearGradient>
    <clipPath id="${id}c"><ellipse cx="50" cy="49" rx="16" ry="19"/></clipPath>
    <filter id="${id}w" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="1.8"/></filter>
  </defs>
  <rect x="38" y="150" width="9" height="34" rx="3" fill="#23262b"/>
  <rect x="53" y="150" width="9" height="34" rx="3" fill="#23262b"/>
  <path d="M35 182 h14 v8 h-16 z" fill="${dark}"/><path d="M51 182 h14 l2 8 h-16 z" fill="${dark}"/>
  <path d="M31 70 C26 100 22 130 20 156 C34 162 66 162 80 156 C78 130 74 100 69 70 Z" fill="url(#${id}g)"/>
  <path d="M31 74 C24 92 19 112 18 132 L26 134 C28 116 32 98 37 84 Z" fill="${coat}"/>
  <path d="M69 74 C76 92 81 112 82 132 L74 134 C72 116 68 98 63 84 Z" fill="${shade}"/>
  <circle cx="22" cy="136" r="4" fill="#d9b49a"/><circle cx="78" cy="136" r="4" fill="#c49c80"/>
  <path d="M50 12 C30 12 22 30 22 48 C22 62 28 72 36 76 L64 76 C72 72 78 62 78 48 C78 30 70 12 50 12 Z" fill="url(#${id}g)"/>
  ${back ? '<path d="M50 14 C41 30 41 60 50 74" stroke="#7d5c0c" stroke-width="1.2" fill="none"/>' : faceSVG}
  <line x1="50" y1="78" x2="50" y2="156" stroke="${shade}" stroke-width="1"/>
  <circle cx="54" cy="92" r="1.6" fill="${dark}"/><circle cx="54" cy="110" r="1.6" fill="${dark}"/><circle cx="54" cy="128" r="1.6" fill="${dark}"/>
  <path d="M28 100 l-1 6 M74 118 l1 5 M44 140 l0 5" stroke="#f1e2a8" stroke-width="0.8" opacity="0.6"/>
</svg>`;
}
