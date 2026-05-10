// Weather SVG icons
const weatherIcons = {
  pick(code) {
    if (!code) return this.cloudy;
    const c = parseInt(code);
    const rainCodes = [176,263,266,293,296,299,302,305,308,311,314,353,356,359,386,389,395];
    const snowCodes = [179,182,185,227,230,317,320,323,326,329,332,335,338,350,362,365,368,371,374,377,392];
    if (rainCodes.includes(c)) return this.rain;
    if (snowCodes.includes(c)) return this.snow;
    if ([200,386].includes(c)) return this.thunder;
    if ([116,119].includes(c)) return this.partlyCloudy;
    if (c >= 119 && c <= 122) return this.cloudy;
    if ([143,248,260].includes(c)) return this.fog;
    if (c === 113 || c === 116) return this.sunny;
    return this.default;
  },

  sunny: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="8"/><line x1="18" y1="2" x2="18" y2="6"/><line x1="18" y1="30" x2="18" y2="34"/><line x1="6" y1="18" x2="2" y2="18"/><line x1="34" y1="18" x2="30" y2="18"/><line x1="9.5" y1="9.5" x2="6.7" y2="6.7"/><line x1="29.3" y1="29.3" x2="26.5" y2="26.5"/><line x1="26.5" y1="9.5" x2="29.3" y2="6.7"/><line x1="6.7" y1="29.3" x2="9.5" y2="26.5"/></svg>`,
  partlyCloudy: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="15" cy="14" r="6"/><line x1="15" y1="4" x2="15" y2="7"/><path d="M10 22c-4 0-7 3-7 6s3 6 7 6h14c3.5 0 6-2.5 6-6s-2.5-6-6-6H10z"/></svg>`,
  cloudy: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22c-3.5 0-6 2.8-6 5.5S4.5 33 8 33h16c3 0 5.5-2.2 5.5-5.5S27 22 24 22c-.5-4-3.5-7-7.5-7-3.5 0-6.5 2.5-7.5 5.5"/></svg>`,
  rain: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 20c-4 0-7 3-7 6s3 6 7 6h14c3.5 0 6-2.5 6-6s-2.5-6-6-6H10z"/><line x1="12" y1="28" x2="10" y2="34"/><line x1="18" y1="28" x2="16" y2="34"/><line x1="24" y1="28" x2="22" y2="34"/></svg>`,
  thunder: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 18c-4 0-7 3-7 6s3 6 7 6h14c3.5 0 6-2.5 6-6s-2.5-6-6-6H10z"/><polygon points="20,12 14,22 18,22 16,32 24,20 19,20 22,12"/></svg>`,
  snow: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 18c-4 0-7 3-7 6s3 6 7 6h14c3.5 0 6-2.5 6-6s-2.5-6-6-6H10z"/><circle cx="14" cy="27" r="1.2"/><circle cx="20" cy="29" r="1.2"/><circle cx="17" cy="32" r="1.2"/></svg>`,
  fog: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="14" x2="30" y2="14"/><line x1="8" y1="18" x2="28" y2="18"/><line x1="6" y1="22" x2="30" y2="22"/><line x1="8" y1="26" x2="28" y2="26"/></svg>`,
  default: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22c-3.5 0-6 2.8-6 5.5S4.5 33 8 33h16c3 0 5.5-2.2 5.5-5.5S27 22 24 22c-.5-4-3.5-7-7.5-7-3.5 0-6.5 2.5-7.5 5.5"/></svg>`
};
