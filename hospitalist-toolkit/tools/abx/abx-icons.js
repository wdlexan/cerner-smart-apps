/* Coloured heading banners with small hand-drawn icons for the Antibiotics tab cards. */
(function (root) {
  'use strict';
  const S = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  const ICONS = {
    // calendar with a capsule on it
    days: `<svg viewBox="0 0 24 24" ${S}><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>
      <g transform="rotate(-35 12 15.5)"><rect x="7.5" y="13.5" width="9" height="4" rx="2"/><path d="M12 13.5v4"/></g></svg>`,
    // clock
    clock: `<svg viewBox="0 0 24 24" ${S}><circle cx="12" cy="13" r="8"/><path d="M12 8.5V13l3 2"/><path d="M9.5 3h5M12 3v2"/>
      <path d="M18.5 6.5l1.3-1.3"/></svg>`,
    // IV bag with drip -> arrow -> capsule
    ivpo: `<svg viewBox="0 0 40 24" ${S}><path d="M4 3h8v9a4 4 0 0 1-8 0z"/><path d="M4 7h8M8 16v3"/><circle cx="8" cy="21" r="0.9" fill="currentColor"/>
      <path d="M15.5 12h8M21 9l3 3-3 3"/>
      <g transform="rotate(-35 32 12)"><rect x="26.5" y="9.5" width="11" height="5" rx="2.5"/><path d="M32 9.5v5"/></g></svg>`,
    // kidney with ureter
    kidney: `<svg viewBox="0 0 24 24" ${S}><path d="M11.5 2.8c4.3 0 7.3 4 7.3 8.9 0 5-2.9 9.5-7.1 9.5-2.8 0-4.2-1.9-4.2-3.9 0-2.4 2.3-3 2.3-5.6S7.5 8.7 7.5 6.4c0-2.1 1.6-3.6 4-3.6z"/>
      <path d="M9.8 12.1c1.6 0 2.8.6 3.6 1.7"/><path d="M9.8 12.1c-2 .1-3.3 1.3-3.6 3.2L5.6 21.5"/></svg>`,
    // clipboard list with a rewind arrow (history)
    history: `<svg viewBox="0 0 24 24" ${S}><rect x="4" y="4" width="13" height="17" rx="2"/><path d="M8 3h5v3H8z"/><path d="M7.5 10h6M7.5 13.5h6M7.5 17h3"/>
      <path d="M20.5 13.5a4 4 0 1 1-1.2-2.9"/><path d="M19.6 9v1.9h-1.9"/></svg>`,
    // heart with ultrasound probe waves
    echo: `<svg viewBox="0 0 24 24" ${S}><path d="M10 20.5S3 16 3 10.4A3.9 3.9 0 0 1 10 8a3.9 3.9 0 0 1 7 2.4c0 5.6-7 10.1-7 10.1z"/>
      <path d="M7 11.5h2l1-2 1.5 4 1-2H14"/><path d="M17.5 3.5a5 5 0 0 1 3.2 3.2"/><path d="M16.6 5.6a2.6 2.6 0 0 1 1.8 1.8"/></svg>`
  };
  function head(kind, title, sub) {
    return `<div class="ab-head ab-h-${kind}"><span class="ab-ico" aria-hidden="true">${ICONS[kind] || ''}</span>
      <span>${title}${sub ? ` <small>${sub}</small>` : ''}</span></div>`;
  }
  root.ABXIcons = { head, ICONS };
})(typeof window !== 'undefined' ? window : globalThis);
