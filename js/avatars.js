/* ================================================================
   PIXEL AVATARS — HABBO-STYLE STRIKER SHOTS
   ================================================================
   Generates SVG-based pixel-art avatars of each club's top scorer
   wearing the team's kit colours. Original artwork — avoids any
   copyrighted crest imagery.

   Grid: 16×20 pixels. Each "pixel" is an SVG rect of size 1.
   Scaled by the CSS .badge-wrap to any size; image-rendering:
   pixelated preserves the crisp art.

   Usage:
     PMD.Avatar.render(teamConfig, sizeClass)
     → returns HTML string of a wrapped SVG avatar.
   ================================================================ */

(function(root) {
  const W = 16;
  const H = 20;

  const COLORS = {
    eyeWhite: '#F5F5F0',
    eyePupil: '#1A1A2A',
    mouth: '#7A2A2A',
    shade: 'rgba(0,0,0,0.25)',
    collar: 'rgba(0,0,0,0.35)',
  };

  function rect(x, y, color, w, h) {
    w = w || 1; h = h || 1;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" shape-rendering="crispEdges"/>`;
  }

  function drawHair(style, color) {
    let out = '';
    switch (style) {
      case 'bald':
        break;
      case 'buzz':
        out += rect(5, 1, color, 6, 1);
        out += rect(4, 2, color, 8, 1);
        break;
      case 'short':
        out += rect(5, 1, color, 6, 1);
        out += rect(4, 2, color, 8, 1);
        out += rect(3, 3, color, 10, 1);
        out += rect(3, 4, color, 2, 1);
        out += rect(11, 4, color, 2, 1);
        break;
      case 'medium':
        out += rect(5, 1, color, 6, 1);
        out += rect(4, 2, color, 8, 1);
        out += rect(3, 3, color, 10, 1);
        out += rect(3, 4, color, 2, 2);
        out += rect(11, 4, color, 2, 2);
        out += rect(3, 6, color, 1, 1);
        out += rect(12, 6, color, 1, 1);
        break;
      case 'long':
        out += rect(4, 1, color, 8, 1);
        out += rect(3, 2, color, 10, 1);
        out += rect(3, 3, color, 10, 1);
        out += rect(2, 4, color, 2, 4);
        out += rect(12, 4, color, 2, 4);
        out += rect(3, 8, color, 1, 1);
        out += rect(12, 8, color, 1, 1);
        break;
      case 'mohawk':
        out += rect(7, 0, color, 2, 1);
        out += rect(7, 1, color, 2, 1);
        out += rect(7, 2, color, 2, 1);
        out += rect(5, 3, color, 1, 1);
        out += rect(10, 3, color, 1, 1);
        out += rect(4, 4, color, 1, 1);
        out += rect(11, 4, color, 1, 1);
        break;
      default:
        out += rect(5, 1, color, 6, 1);
        out += rect(4, 2, color, 8, 1);
        out += rect(3, 3, color, 10, 1);
    }
    return out;
  }

  function drawFace(skin, facial) {
    let out = '';
    out += rect(4, 3, skin, 8, 1);
    out += rect(3, 4, skin, 10, 1);
    out += rect(3, 5, skin, 10, 1);
    out += rect(3, 6, skin, 10, 1);
    out += rect(3, 7, skin, 10, 1);
    out += rect(4, 8, skin, 8, 1);
    out += rect(5, 9, skin, 6, 1);

    // Eyes
    out += rect(5, 5, COLORS.eyeWhite, 2, 1);
    out += rect(9, 5, COLORS.eyeWhite, 2, 1);
    out += rect(6, 5, COLORS.eyePupil);
    out += rect(10, 5, COLORS.eyePupil);

    // Nose shadow
    out += rect(7, 6, COLORS.shade);
    out += rect(8, 6, COLORS.shade);

    // Mouth + facial hair
    if (facial === 'beard') {
      out += rect(5, 7, COLORS.shade, 6, 1);
      out += rect(4, 8, COLORS.shade, 8, 1);
      out += rect(5, 9, COLORS.shade, 6, 1);
      out += rect(7, 8, COLORS.mouth, 2, 1);
    } else if (facial === 'moustache') {
      out += rect(6, 7, COLORS.shade, 4, 1);
      out += rect(7, 8, COLORS.mouth, 2, 1);
    } else if (facial === 'stubble') {
      out += rect(5, 8, COLORS.shade, 6, 1);
      out += rect(7, 7, COLORS.mouth, 2, 1);
    } else {
      out += rect(7, 7, COLORS.mouth, 2, 1);
    }

    return out;
  }

  function drawNeck(skin) {
    return rect(6, 10, skin, 4, 1);
  }

  function drawJersey(template, primary, accent) {
    let out = '';
    out += rect(2, 11, primary, 12, 1);
    for (let y = 12; y <= 18; y++) {
      out += rect(1, y, primary, 14, 1);
    }

    switch (template) {
      case 'stripes-v':
        for (let y = 11; y <= 18; y++) {
          out += rect(3, y, accent);
          out += rect(6, y, accent);
          out += rect(9, y, accent);
          out += rect(12, y, accent);
        }
        break;
      case 'stripes-h':
        out += rect(1, 13, accent, 14, 1);
        out += rect(1, 16, accent, 14, 1);
        break;
      case 'hoops':
        out += rect(1, 12, accent, 14, 1);
        out += rect(1, 14, accent, 14, 1);
        out += rect(1, 16, accent, 14, 1);
        out += rect(1, 18, accent, 14, 1);
        break;
      case 'cross':
        for (let y = 11; y <= 18; y++) {
          out += rect(7, y, accent);
          out += rect(8, y, accent);
        }
        break;
      case 'shield':
        out += rect(5, 13, accent, 6, 3);
        break;
      default:
        break;
    }

    // Collar (v-neck look)
    out += rect(6, 11, COLORS.collar, 4, 1);
    out += rect(7, 11, primary, 2, 1);

    // Sleeve/hem shadows
    out += rect(1, 12, COLORS.shade);
    out += rect(14, 12, COLORS.shade);
    out += rect(1, 18, COLORS.shade);
    out += rect(14, 18, COLORS.shade);

    return out;
  }

  function drawBackground(primary) {
    const dark = darken(primary, 0.55);
    return rect(0, 0, dark, W, H);
  }

  function darken(hex, factor) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = Math.round(parseInt(hex.slice(0, 2), 16) * factor);
    const g = Math.round(parseInt(hex.slice(2, 4), 16) * factor);
    const b = Math.round(parseInt(hex.slice(4, 6), 16) * factor);
    return `rgb(${r},${g},${b})`;
  }

  function render(team, sizeClass) {
    if (!team) return '';
    const size = sizeClass || 'sm';
    const scorer = team.topScorer || {};
    const style = scorer.style || {};
    const hairColor = style.hair || '#1A0F0A';
    const skinColor = style.skin || '#F4CFA3';
    const facial = style.facial || 'none';
    const hairstyle = style.hairstyle || 'short';
    const jerseyColor = team.color || '#333333';
    const accentColor = team.accent || team.fg || '#FFFFFF';
    const badgeTemplate = team.badge || 'solid';

    const svgContent =
      drawBackground(jerseyColor) +
      drawHair(hairstyle, hairColor) +
      drawFace(skinColor, facial) +
      drawNeck(skinColor) +
      drawJersey(badgeTemplate, jerseyColor, accentColor);

    return `<span class="badge-wrap ${size}" title="${escapeAttr(team.name)} — ${escapeAttr(scorer.name || '')}">
      <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>
    </span>`;
  }

  function escapeAttr(s) {
    return String(s || '').replace(/[&<>"']/g, c => (
      {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
    ));
  }

  root.PMD = root.PMD || {};
  root.PMD.Avatar = { render };
})(window);
