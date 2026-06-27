
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

const search = document.querySelector('#resource-search');
if (search) {
  const cards = [...document.querySelectorAll('.resource-card')];
  const empty = document.querySelector('.empty-state');
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    let count = 0;
    cards.forEach((card) => {
      const show = card.textContent.toLowerCase().includes(query);
      card.style.display = show ? '' : 'none';
      if (show) count++;
    });
    empty.style.display = count ? 'none' : 'block';
  });
}

const enableChartZoom = () => {
  document.querySelectorAll('.line-chart svg, .mini-chart svg').forEach((svg) => {
    if (svg.dataset.zoomReady) return;
    svg.dataset.zoomReady = 'true';

    const originalBox = svg.viewBox.baseVal;
    const original = {
      x: originalBox.x,
      y: originalBox.y,
      width: originalBox.width,
      height: originalBox.height
    };
    let current = { ...original };
    let dragStart = null;
    let suppressNextClick = false;
    const card = svg.closest('.mini-chart-card, .royale-chart-card, .brawl-chart-card');
    if (card) card.classList.add('chart-zoom-card');

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const applyViewBox = () => {
      svg.setAttribute('viewBox', `${current.x} ${current.y} ${current.width} ${current.height}`);
    };
    const panBy = (dx, dy) => {
      const rect = svg.getBoundingClientRect();
      const nextX = clamp(
        current.x - (dx / rect.width) * current.width,
        original.x,
        original.x + original.width - current.width
      );
      const nextY = clamp(
        current.y - (dy / rect.height) * current.height,
        original.y,
        original.y + original.height - current.height
      );
      current = { ...current, x: nextX, y: nextY };
      applyViewBox();
    };
    const resetZoom = () => {
      current = { ...original };
      applyViewBox();
    };

    svg.addEventListener('click', (event) => {
      if (suppressNextClick) {
        event.preventDefault();
        suppressNextClick = false;
        return;
      }
      document.querySelectorAll('.chart-zoom-card.chart-zoom-active').forEach((activeCard) => {
        if (activeCard !== card) activeCard.classList.remove('chart-zoom-active');
      });
      if (card) card.classList.toggle('chart-zoom-active');
    });

    svg.addEventListener('pointerdown', (event) => {
      if (!card?.classList.contains('chart-zoom-active')) return;
      dragStart = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        moved: false
      };
      svg.classList.add('chart-dragging');
      svg.setPointerCapture?.(event.pointerId);
    });

    svg.addEventListener('pointermove', (event) => {
      if (!dragStart || event.pointerId !== dragStart.pointerId) return;
      const dx = event.clientX - dragStart.x;
      const dy = event.clientY - dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) dragStart.moved = true;
      panBy(dx, dy);
      dragStart.x = event.clientX;
      dragStart.y = event.clientY;
    });

    const endDrag = (event) => {
      if (!dragStart || event.pointerId !== dragStart.pointerId) return;
      suppressNextClick = dragStart.moved;
      dragStart = null;
      svg.classList.remove('chart-dragging');
      svg.releasePointerCapture?.(event.pointerId);
    };

    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);

    svg.addEventListener('wheel', (event) => {
      if (!card?.classList.contains('chart-zoom-active')) return;
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const pointerX = current.x + ((event.clientX - rect.left) / rect.width) * current.width;
      const pointerY = current.y + ((event.clientY - rect.top) / rect.height) * current.height;
      const factor = event.deltaY < 0 ? 0.86 : 1.16;
      const minWidth = original.width / 2.8;
      const minHeight = original.height / 2.8;
      const nextWidth = clamp(current.width * factor, minWidth, original.width);
      const nextHeight = clamp(current.height * factor, minHeight, original.height);
      const xRatio = (pointerX - current.x) / current.width;
      const yRatio = (pointerY - current.y) / current.height;
      const nextX = clamp(pointerX - nextWidth * xRatio, original.x, original.x + original.width - nextWidth);
      const nextY = clamp(pointerY - nextHeight * yRatio, original.y, original.y + original.height - nextHeight);

      current = {
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight
      };
      applyViewBox();
    }, { passive: false });

    svg.addEventListener('dblclick', resetZoom);
  });
};

enableChartZoom();
new MutationObserver(enableChartZoom).observe(document.body, { childList: true, subtree: true });

const starfield = document.querySelector('#starfield');
if (starfield) {
  const ctx = starfield.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isGalaxyPage = document.body.matches('.about-page, .research-page');
  const modes = {
    deep: isGalaxyPage
      ? { density: 130, max: 7000, speed: 0.19, brightness: 0.88, scale: 155 }
      : { density: 340, max: 3000, speed: 0.13, brightness: 0.8, scale: 155 },
    nebula: { density: 230, max: 3000, speed: 0.1, brightness: 0.94, scale: 175 },
    cloud: { density: 145, max: 4500, speed: 0.065, brightness: 0.8, scale: 170 }
  };
  let width = 0;
  let height = 0;
  let stars = [];
  let animationFrame;
  let nebulaTex = null;
  let bgStars = [];
  let pointerX = 0;
  let pointerY = 0;
  let driftX = 0;
  let driftY = 0;
  let fabX = 0;
  let fabY = 0;
  let pushStr = 0;
  const mode = 'deep';
  document.body.dataset.spaceMode = mode;

  const buildNebulaTexture = () => {
    const nc = document.createElement('canvas');
    nc.width = width; nc.height = height;
    const nCtx = nc.getContext('2d');
    const span = Math.max(width, height);

    if (mode === 'nebula') {
      const cx = width * 0.54, cy = height * 0.50;
      let s = 1337;
      const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
      // Real Crab Nebula (M1) is wider than tall — semi-axes match that aspect
      const na = span * 0.36, nb = span * 0.22;

      // Layer 1: outer OIII diffuse glow (faint teal envelope)
      nCtx.save();
      nCtx.translate(cx, cy);
      nCtx.scale(1, nb / na);
      const outerGrad = nCtx.createRadialGradient(0, 0, na * 0.10, 0, 0, na);
      outerGrad.addColorStop(0,   'rgba(30,120,170,0.16)');
      outerGrad.addColorStop(0.5, 'rgba(20,90,145,0.07)');
      outerGrad.addColorStop(1,   'rgba(10,60,120,0)');
      nCtx.beginPath();
      nCtx.arc(0, 0, na, 0, Math.PI * 2);
      nCtx.fillStyle = outerGrad;
      nCtx.fill();
      nCtx.restore();

      // Layer 2: synchrotron core (blue-white, not smooth — pulsar wind nebula)
      nCtx.save();
      nCtx.translate(cx, cy);
      nCtx.scale(1, 0.62);
      const coreGrad = nCtx.createRadialGradient(0, 0, 0, 0, 0, span * 0.15);
      coreGrad.addColorStop(0,    'rgba(210,230,255,0.58)');
      coreGrad.addColorStop(0.22, 'rgba(160,210,255,0.40)');
      coreGrad.addColorStop(0.50, 'rgba(90,175,240,0.18)');
      coreGrad.addColorStop(0.82, 'rgba(50,140,210,0.05)');
      coreGrad.addColorStop(1,    'rgba(50,140,210,0)');
      nCtx.beginPath();
      nCtx.arc(0, 0, span * 0.15, 0, Math.PI * 2);
      nCtx.fillStyle = coreGrad;
      nCtx.fill();
      nCtx.restore();

      // Layer 3: circular wisps — concentric arc segments from pulsar wind shocks
      for (let w = 0; w < 4; w++) {
        const wr = span * (0.038 + w * 0.028 + rnd() * 0.010);
        const wa = 0.13 - w * 0.022;
        const wStart = rnd() * Math.PI * 2;
        nCtx.save();
        nCtx.translate(cx, cy);
        nCtx.scale(1, 0.62);
        nCtx.beginPath();
        nCtx.strokeStyle = `rgba(180,220,255,${wa})`;
        nCtx.lineWidth = 1.8 + rnd() * 2.5;
        nCtx.arc(0, 0, wr, wStart, wStart + Math.PI * (1.1 + rnd() * 0.8));
        nCtx.stroke();
        nCtx.restore();
      }

      // Layer 4: dense filament cage — short, randomly-oriented strands distributed
      // throughout the nebula forming a mesh (Rayleigh-Taylor instability fingers,
      // NOT a radial starburst — they criss-cross in all directions)
      for (let i = 0; i < 180; i++) {
        const theta = rnd() * Math.PI * 2;
        const radFrac = 0.04 + Math.pow(rnd(), 0.55) * 0.90;
        const fx = cx + Math.cos(theta) * radFrac * na;
        const fy = cy + Math.sin(theta) * radFrac * nb;
        const dir = rnd() * Math.PI * 2;
        const len = span * (0.022 + rnd() * 0.082);
        const ex = fx + Math.cos(dir) * len;
        const ey = fy + Math.sin(dir) * len;
        const cpDir = dir + (rnd() - 0.5) * 1.1;
        const cpLen = len * (0.3 + rnd() * 0.4);
        const cpx = fx + Math.cos(cpDir) * cpLen;
        const cpy = fy + Math.sin(cpDir) * cpLen;
        const alpha = 0.28 + rnd() * 0.36;
        const lw = 0.5 + rnd() * 1.8;
        const cr = rnd();
        let fr, fgc, fb;
        if (cr > 0.90)      { fr = 155; fgc = 195; fb = 75;  } // OI yellow-green
        else if (cr > 0.62) { fr = 240; fgc = 100; fb = 42;  } // [NII] orange
        else                { fr = 215; fgc = 48;  fb = 42;  } // SII red
        const fgrad = nCtx.createLinearGradient(fx, fy, ex, ey);
        fgrad.addColorStop(0,    `rgba(${fr},${fgc},${fb},0)`);
        fgrad.addColorStop(0.10, `rgba(${fr},${fgc},${fb},${alpha})`);
        fgrad.addColorStop(0.90, `rgba(${fr},${fgc},${fb},${alpha})`);
        fgrad.addColorStop(1,    `rgba(${fr},${fgc},${fb},0)`);
        nCtx.beginPath();
        nCtx.strokeStyle = fgrad;
        nCtx.lineWidth = lw;
        nCtx.moveTo(fx, fy);
        nCtx.quadraticCurveTo(cpx, cpy, ex, ey);
        nCtx.stroke();
      }

      // Layer 5: filament knots — bright condensations at intersections
      for (let i = 0; i < 50; i++) {
        const theta = rnd() * Math.PI * 2;
        const radFrac = 0.05 + rnd() * 0.88;
        const kx = cx + Math.cos(theta) * radFrac * na;
        const ky = cy + Math.sin(theta) * radFrac * nb;
        const kr = 1.8 + rnd() * 5.0;
        const ka = 0.35 + rnd() * 0.35;
        const kGrad = nCtx.createRadialGradient(kx, ky, 0, kx, ky, kr);
        kGrad.addColorStop(0,   `rgba(255,165,100,${ka})`);
        kGrad.addColorStop(0.5, `rgba(220,65,52,${+(ka * 0.5).toFixed(3)})`);
        kGrad.addColorStop(1,   'rgba(195,45,38,0)');
        nCtx.beginPath();
        nCtx.arc(kx, ky, kr, 0, Math.PI * 2);
        nCtx.fillStyle = kGrad;
        nCtx.fill();
      }

    } else {
      // Molecular cloud — smooth blurry blobs are accurate for dark nebulae / ISM
      const cloudLobes = [
        { px: 0.50, py: 0.46, rx: 0.52, ry: 0.39, rot:  0.00, r: 96,  g: 110, b: 150, a: 0.21 },
        { px: 0.15, py: 0.18, rx: 0.35, ry: 0.27, rot: -0.30, r: 48,  g: 72,  b: 124, a: 0.16 },
        { px: 0.78, py: 0.72, rx: 0.31, ry: 0.22, rot:  0.42, r: 70,  g: 90,  b: 140, a: 0.13 },
        { px: 0.40, py: 0.76, rx: 0.27, ry: 0.19, rot: -0.12, r: 55,  g: 65,  b: 110, a: 0.11 },
      ];
      cloudLobes.forEach(({ px, py, rx, ry, rot, r, g, b, a }) => {
        const lcx = px * width, lcy = py * height;
        const rMaj = rx * span, rMin = ry * span;
        nCtx.save();
        nCtx.translate(lcx, lcy);
        nCtx.rotate(rot);
        nCtx.scale(1, rMin / rMaj);
        const grad = nCtx.createRadialGradient(0, 0, 0, 0, 0, rMaj);
        grad.addColorStop(0,    `rgba(${r},${g},${b},${a})`);
        grad.addColorStop(0.38, `rgba(${r},${g},${b},${+(a * 0.62).toFixed(3)})`);
        grad.addColorStop(0.72, `rgba(${r},${g},${b},${+(a * 0.22).toFixed(3)})`);
        grad.addColorStop(1,    `rgba(${r},${g},${b},0)`);
        nCtx.beginPath();
        nCtx.arc(0, 0, rMaj, 0, Math.PI * 2);
        nCtx.fillStyle = grad;
        nCtx.fill();
        nCtx.restore();
      });
    }

    nebulaTex = nc;
  };

  const starColorRgb = (temperature, isDust) => {
    if (isDust && mode === 'nebula') {
      if (temperature > 0.75) return '255,110,160';
      if (temperature < 0.28) return '80,220,240';
      if (temperature < 0.52) return '200,160,255';
      return '255,160,120';
    }
    if (temperature > 0.995) return '155,176,255';
    if (temperature > 0.985) return '170,191,255';
    if (temperature > 0.940) return '202,215,255';
    if (temperature > 0.820) return '248,247,255';
    if (temperature > 0.620) return '255,244,234';
    if (temperature > 0.380) return '255,210,161';
    return '255,188,108';
  };

  const makeStar = (randomDepth = true) => ({
    x: (Math.random() - 0.5) * width,
    y: (Math.random() - 0.5) * height,
    z: randomDepth ? Math.random() * width : width,
    size: Math.pow(Math.random(), 5) * 1.05 + 0.12,
    temperature: Math.random(),
    luminosity: Math.pow(Math.random(), 2.8),
    phase: Math.random() * Math.PI * 2,
    dust: Math.random() < (mode === 'cloud' ? 0.46 : mode === 'nebula' ? 0.26 : 0.1)
  });

  const populateStars = () => {
    const config = modes[mode];
    const count = Math.min(config.max, Math.floor(width * height / config.density));
    stars = Array.from({ length: count }, () => makeStar());
    if (mode === 'nebula' || mode === 'cloud') buildNebulaTexture();
    else nebulaTex = null;
    if (mode === 'deep') {
      bgStars = Array.from({ length: isGalaxyPage ? 3200 : 1500 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 0.52 + 0.12,
        color: starColorRgb(Math.random(), false),
        alpha: 0.05 + Math.random() * 0.22,
      }));
    } else {
      bgStars = [];
    }
  };

  const resizeStarfield = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    starfield.width = Math.round(width * dpr);
    starfield.height = Math.round(height * dpr);
    starfield.style.width = `${width}px`;
    starfield.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    populateStars();
  };

  const drawStars = () => {
    ctx.clearRect(0, 0, width, height);
    driftX += (pointerX - driftX) * 0.018;
    driftY += (pointerY - driftY) * 0.018;

    if (document.body.dataset.theme === 'light') {
      const targX = (pointerX / 10 + 0.5) * width;
      const targY = (pointerY / 10 + 0.5) * height;

      // Snap on first frame to avoid lerp-in from (0,0)
      if (fabX === 0 && fabY === 0) { fabX = targX; fabY = targY; }

      const prevFabX = fabX, prevFabY = fabY;
      fabX += (targX - fabX) * 0.12;
      fabY += (targY - fabY) * 0.12;

      // pushStr: rises quickly while cursor moves, decays slowly when still
      const moved = Math.hypot(fabX - prevFabX, fabY - prevFabY);
      if (moved > 0.5) {
        pushStr = Math.min(1, pushStr + 0.18);
      } else {
        pushStr *= 0.978; // ~2.4s to reach 5%
      }

      ctx.fillStyle = '#f5f2e9';
      ctx.fillRect(0, 0, width, height);

      const pushR = Math.min(width, height) * 0.30;
      const pushAmt = 90;
      const s = 22;

      const disp = (px, py) => {
        const dx = px - fabX, dy = py - fabY;
        const dist = Math.hypot(dx, dy);
        if (dist === 0 || dist >= pushR) return [px, py];
        const t = 1 - dist / pushR;
        const f = t * t * pushAmt * pushStr;
        return [px + dx / dist * f, py + dy / dist * f];
      };

      // weft (horizontal)
      for (let row = 0; row * s <= height + s; row++) {
        const by = row * s;
        const primary = row % 2 === 0;
        ctx.strokeStyle = primary ? 'rgba(0,0,0,.09)' : 'rgba(0,0,0,.038)';
        ctx.lineWidth = primary ? 1.0 : 0.55;
        ctx.beginPath();
        let first = true;
        for (let x = 0; x <= width; x += 5) {
          const [nx, ny] = disp(x, by);
          if (first) { ctx.moveTo(nx, ny); first = false; } else ctx.lineTo(nx, ny);
        }
        ctx.stroke();
      }
      // warp (vertical)
      for (let col = 0; col * s <= width + s; col++) {
        const bx = col * s;
        const primary = col % 2 === 0;
        ctx.strokeStyle = primary ? 'rgba(0,0,0,.09)' : 'rgba(0,0,0,.038)';
        ctx.lineWidth = primary ? 1.0 : 0.55;
        ctx.beginPath();
        let first = true;
        for (let y = 0; y <= height; y += 5) {
          const [nx, ny] = disp(bx, y);
          if (first) { ctx.moveTo(nx, ny); first = false; } else ctx.lineTo(nx, ny);
        }
        ctx.stroke();
      }

      if (!reduceMotion) animationFrame = requestAnimationFrame(drawStars);
      return;
    }

    const cx = width / 2 + driftX;
    const cy = height / 2 + driftY;
    const config = modes[mode];

    if (nebulaTex) ctx.drawImage(nebulaTex, 0, 0);
    bgStars.forEach(({ x, y, r, color, alpha }) => {
      ctx.beginPath();
      ctx.fillStyle = `rgba(${color},${alpha})`;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    stars.forEach((star) => {
      if (!reduceMotion) star.z -= config.speed;
      if (star.z < 1) Object.assign(star, makeStar(false));

      const scale = config.scale / star.z;
      const x = star.x * scale + cx;
      const y = star.y * scale + cy;

      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) {
        Object.assign(star, makeStar(false));
        return;
      }

      const depth = 1 - star.z / width;
      const distanceFade = Math.pow(depth, 0.72);
      const radius = Math.max(star.dust ? 0.12 : 0.18, star.size * (0.4 + distanceFade * (star.dust ? 0.72 : 1.15)));
      const twinkle = 0.94 + Math.sin(Date.now() * 0.00045 + star.phase) * 0.06;
      const dustFade = star.dust ? 0.42 : 1;
      const alpha = Math.min(config.brightness, (0.075 + distanceFade * 0.52) * (0.5 + star.luminosity * 0.5) * twinkle * dustFade);
      const color = starColorRgb(star.temperature, star.dust);

      ctx.beginPath();
      ctx.fillStyle = `rgba(${color},${alpha})`;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      if (radius > 0.65 && star.luminosity > 0.55) {
        const outerR = radius * (star.luminosity > 0.88 ? 5.5 : 3.8);
        const glow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, outerR);
        glow.addColorStop(0,    `rgba(${color},${alpha * 0.38})`);
        glow.addColorStop(0.45, `rgba(${color},${alpha * 0.10})`);
        glow.addColorStop(1,    `rgba(${color},0)`);
        ctx.beginPath();
        ctx.fillStyle = glow;
        ctx.arc(x, y, outerR, 0, Math.PI * 2);
        ctx.fill();
      }

      if (radius > 1.4 && star.luminosity > 0.88 && !star.dust) {
        const spikeLen = radius * 9;
        const spikeAlpha = alpha * 0.50;
        [0, Math.PI / 4, Math.PI / 2, Math.PI * 3 / 4].forEach((angle) => {
          const cos = Math.cos(angle), sin = Math.sin(angle);
          const grad = ctx.createLinearGradient(
            x + cos * spikeLen, y + sin * spikeLen,
            x - cos * spikeLen, y - sin * spikeLen
          );
          grad.addColorStop(0,   `rgba(${color},0)`);
          grad.addColorStop(0.5, `rgba(${color},${spikeAlpha})`);
          grad.addColorStop(1,   `rgba(${color},0)`);
          ctx.beginPath();
          ctx.strokeStyle = grad;
          ctx.lineWidth = 0.55;
          ctx.moveTo(x + cos * spikeLen, y + sin * spikeLen);
          ctx.lineTo(x - cos * spikeLen, y - sin * spikeLen);
          ctx.stroke();
        });
      }
    });

    if (!reduceMotion) animationFrame = requestAnimationFrame(drawStars);
  };

  resizeStarfield();
  drawStars();
  window.addEventListener('pointermove', (event) => {
    pointerX = (event.clientX / width - 0.5) * 10;
    pointerY = (event.clientY / height - 0.5) * 10;
  });
  window.addEventListener('resize', resizeStarfield);
  window.addEventListener('pagehide', () => cancelAnimationFrame(animationFrame), { once: true });
}

if (window.matchMedia('(pointer: fine)').matches) {
  const cursor = document.createElement('div');
  cursor.className = 'cosmic-cursor';
  document.body.appendChild(cursor);
  let lastTrail = 0;
  let lastX = null;
  let lastY = null;
  let angle = 0;

  window.addEventListener('pointermove', (event) => {
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;

    if (lastX !== null) {
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      if (dx * dx + dy * dy > 3) {
        const target = Math.atan2(dy, dx) * (180 / Math.PI);
        const diff = ((target - angle + 540) % 360) - 180;
        angle += diff * 0.32;
        cursor.style.setProperty('--comet-angle', `${angle}deg`);
      }
    }
    lastX = event.clientX;
    lastY = event.clientY;

    const now = performance.now();
    if (now - lastTrail > 24) {
      const rad = angle * (Math.PI / 180);
      const perp = rad + Math.PI / 2;
      const back = 20 + Math.random() * 36;
      const fan = (Math.random() - 0.5) * 46;
      const behindX = -Math.cos(rad) * back + Math.cos(perp) * fan;
      const behindY = -Math.sin(rad) * back + Math.sin(perp) * fan;
      const particle = document.createElement('i');
      particle.className = 'cursor-star';
      particle.style.left = `${event.clientX + behindX}px`;
      particle.style.top = `${event.clientY + behindY}px`;
      particle.style.setProperty('--drift-x', `${-Math.cos(rad) * (18 + Math.random() * 26) + Math.cos(perp) * (Math.random() - 0.5) * 20}px`);
      particle.style.setProperty('--drift-y', `${-Math.sin(rad) * (18 + Math.random() * 26) + Math.sin(perp) * (Math.random() - 0.5) * 20}px`);
      document.body.appendChild(particle);
      particle.addEventListener('animationend', () => particle.remove(), { once: true });
      lastTrail = now;
    }
  });

  document.addEventListener('pointerover', (event) => {
    cursor.classList.toggle('hover', Boolean(event.target.closest('a, button')));
  });
}

// Only re-randomize the theme/font on an actual page refresh, not when
// navigating between tabs (which loads a fresh static HTML file each time).
const isHardRefresh = (() => {
  const nav = performance.getEntriesByType('navigation')[0];
  return nav ? nav.type === 'reload' : true;
})();

const themeToggle = document.querySelector('.theme-toggle');
if (themeToggle) {
  const apply = (light) => {
    document.body.dataset.theme = light ? 'light' : '';
    themeToggle.textContent = light ? '☾' : '☀';
    themeToggle.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
  };
  let lightMode;
  if (isHardRefresh || sessionStorage.getItem('site-theme') === null) {
    lightMode = Math.random() < 0.5;
    sessionStorage.setItem('site-theme', lightMode ? 'light' : 'dark');
  } else {
    lightMode = sessionStorage.getItem('site-theme') === 'light';
  }
  apply(lightMode);
  themeToggle.addEventListener('click', () => {
    const next = document.body.dataset.theme !== 'light';
    apply(next);
    sessionStorage.setItem('site-theme', next ? 'light' : 'dark');
  });
}

const fontSwitcher = document.querySelector('.font-switcher');
if (fontSwitcher) {
  const toggle = fontSwitcher.querySelector('.font-toggle');
  const menu = fontSwitcher.querySelector('.font-menu');
  const buttons = Array.from(menu.querySelectorAll('button[data-font]'));
  const fontClasses = ['font-lora', 'font-rubik', 'font-hieroglyphs', 'font-alien'];
  const fontOptions = buttons.map((btn) => btn.dataset.font);

  // Noto Sans Egyptian Hieroglyphs / Linear A only contain glyphs for their own
  // ancient scripts, not Latin letters, so plain English text silently falls
  // back to the default font. Transliterate the actual page text into real
  // codepoints from those scripts so the swap is visible, and restore the
  // original text when switching to a Latin font.
  const GLYPH_MAPS = {
    hieroglyphs: { base: 0x13000, digitBase: 0x1301a },
    alien: { base: 0x10600, digitBase: 0x1061a },
  };
  const originalText = new WeakMap();

  const transliterate = (text, key) => {
    const cfg = GLYPH_MAPS[key];
    let out = '';
    for (const ch of text) {
      const lower = ch.toLowerCase();
      if (lower >= 'a' && lower <= 'z') {
        out += String.fromCodePoint(cfg.base + (lower.charCodeAt(0) - 97));
      } else if (ch >= '0' && ch <= '9') {
        out += String.fromCodePoint(cfg.digitBase + (ch.charCodeAt(0) - 48));
      } else {
        out += ch;
      }
    }
    return out;
  };

  const collectTextNodes = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || parent.closest('.font-menu, script, style')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  };

  const setGlyphMode = (key) => {
    collectTextNodes().forEach((node) => {
      const cached = originalText.get(node);
      const expected = cached === undefined ? null : (key ? transliterate(cached, key) : cached);
      // If a tracker script overwrote this node with fresh English text
      // (live stats refreshing), the live value won't match what we last
      // wrote, so treat it as the new source-of-truth original.
      if (cached === undefined || node.nodeValue !== expected) {
        originalText.set(node, node.nodeValue);
      }
      const base = originalText.get(node);
      node.nodeValue = key ? transliterate(base, key) : base;
    });
  };

  let currentGlyphKey = null;
  // Tracker pages render their stats asynchronously after the font is first
  // applied, so watch for new content and re-run the transliteration over it.
  const glyphObserver = new MutationObserver(() => {
    if (!currentGlyphKey) return;
    glyphObserver.disconnect();
    setGlyphMode(currentGlyphKey);
    glyphObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  glyphObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

  const applyFont = (font) => {
    document.body.classList.remove(...fontClasses);
    if (font) document.body.classList.add(`font-${font}`);
    buttons.forEach((btn) => btn.classList.toggle('active', btn.dataset.font === font));
    currentGlyphKey = GLYPH_MAPS[font] ? font : null;
    setGlyphMode(currentGlyphKey);
  };

  let initialFont;
  if (isHardRefresh || sessionStorage.getItem('site-font') === null) {
    initialFont = fontOptions[Math.floor(Math.random() * fontOptions.length)];
    sessionStorage.setItem('site-font', initialFont);
  } else {
    initialFont = sessionStorage.getItem('site-font');
  }
  applyFont(initialFont);

  const closeMenu = () => {
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  };
  const openMenu = () => {
    menu.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
  };

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    menu.classList.contains('open') ? closeMenu() : openMenu();
  });

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      applyFont(btn.dataset.font);
      sessionStorage.setItem('site-font', btn.dataset.font);
      closeMenu();
    });
  });

  document.addEventListener('click', (event) => {
    if (!fontSwitcher.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });
}

const setupPanelStarfields = () => {
  const gamePage = document.body.matches('.starfield-page.coc-tracker-page, .starfield-page.royale-tracker-page, .starfield-page.brawl-tracker-page');
  if (!gamePage) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const selector = [
    '.site-header',
    '.coc-intro .shell',
    '.account-tabs button',
    '.weekly-summary-panel',
    '.weekly-summary-card',
    '.tracker-dashboard',
    '.tracker-profile',
    '.tracker-panel',
    '.tracker-stat',
    '.mini-chart-card',
    '.league-season-card',
    '.ranked-row',
    '.royale-dashboard',
    '.royale-stats div',
    '.royale-chart-card',
    '.royale-battle-grid li:not(.win):not(.loss):not(.draw)',
    '.brawl-intro-card',
    '.brawl-dashboard',
    '.brawl-chart-card',
    '.brawl-game-card',
    '.brawl-hall'
  ].join(',');

  const panels = new Map();
  const starColor = (temperature) => {
    if (temperature > 0.985) return '170,191,255';
    if (temperature > 0.94) return '202,215,255';
    if (temperature > 0.82) return '248,247,255';
    if (temperature > 0.62) return '255,244,234';
    if (temperature > 0.38) return '255,210,161';
    return '255,188,108';
  };

  const buildStars = (width, height) => {
    const area = Math.max(width * height, 1);
    const count = Math.max(70, Math.min(900, Math.round(area / 650)));
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * width,
      y: (Math.random() - 0.5) * height,
      z: Math.random() * Math.max(width, 180),
      size: Math.pow(Math.random(), 5) * 1.05 + 0.12,
      temperature: Math.random(),
      luminosity: Math.pow(Math.random(), 2.8),
      phase: Math.random() * Math.PI * 2
    }));
  };

  const ensurePanels = () => {
    document.querySelectorAll(selector).forEach((panel) => {
      if (panels.has(panel) || panel.closest('.panel-starfield')) return;
      panel.classList.add('has-panel-starfield');
      const canvas = document.createElement('canvas');
      canvas.className = 'panel-starfield';
      canvas.setAttribute('aria-hidden', 'true');
      panel.prepend(canvas);
      panels.set(panel, {
        canvas,
        ctx: canvas.getContext('2d'),
        width: 0,
        height: 0,
        stars: []
      });
    });
  };

  const resize = (state) => {
    const parent = state.canvas.parentElement;
    if (!parent) return false;
    const rect = parent.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (width === state.width && height === state.height) return true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = width;
    state.height = height;
    state.canvas.width = Math.round(width * dpr);
    state.canvas.height = Math.round(height * dpr);
    state.canvas.style.width = `${width}px`;
    state.canvas.style.height = `${height}px`;
    state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.stars = buildStars(width, height);
    return true;
  };

  const drawPanel = (state, time) => {
    if (!resize(state)) return;
    const { ctx, width, height } = state;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#010207';
    ctx.fillRect(0, 0, width, height);

    const glowA = ctx.createRadialGradient(width * 0.68, height * 0.30, 0, width * 0.68, height * 0.30, Math.max(width, height) * 0.72);
    glowA.addColorStop(0, 'rgba(37,64,124,.075)');
    glowA.addColorStop(1, 'rgba(55,95,190,0)');
    ctx.fillStyle = glowA;
    ctx.fillRect(0, 0, width, height);

    state.stars.forEach((star) => {
      const depth = Math.max(width, 180);
      if (!reduceMotion) star.z -= 0.055;
      if (star.z < 1) {
        star.x = (Math.random() - 0.5) * width;
        star.y = (Math.random() - 0.5) * height;
        star.z = depth;
        star.size = Math.pow(Math.random(), 5) * 1.05 + 0.12;
        star.temperature = Math.random();
        star.luminosity = Math.pow(Math.random(), 2.8);
      }

      const cx = width / 2;
      const cy = height / 2;
      const scale = 155 / star.z;
      const x = star.x * scale + cx;
      const y = star.y * scale + cy;
      if (x < -10 || x > width + 10 || y < -10 || y > height + 10) {
        star.x = (Math.random() - 0.5) * width;
        star.y = (Math.random() - 0.5) * height;
        star.z = depth;
        return;
      }
      const distanceFade = Math.pow(1 - star.z / depth, 0.72);
      const radius = Math.max(0.16, star.size * (0.4 + distanceFade * 1.15));
      const twinkle = 0.94 + Math.sin(time * 0.00045 + star.phase) * 0.06;
      const alpha = Math.min(0.8, (0.075 + distanceFade * 0.52) * (0.5 + star.luminosity * 0.5) * twinkle);
      const color = starColor(star.temperature);

      ctx.beginPath();
      ctx.fillStyle = `rgba(${color},${alpha})`;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      if (radius > 0.65 && star.luminosity > 0.55) {
        const outerR = radius * (star.luminosity > 0.88 ? 5.5 : 3.8);
        const glow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, outerR);
        glow.addColorStop(0, `rgba(${color},${alpha * 0.38})`);
        glow.addColorStop(0.45, `rgba(${color},${alpha * 0.10})`);
        glow.addColorStop(1, `rgba(${color},0)`);
        ctx.beginPath();
        ctx.fillStyle = glow;
        ctx.arc(x, y, outerR, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  };

  let animationFrame = null;
  const draw = (time = 0) => {
    ensurePanels();
    panels.forEach((state, panel) => {
      if (!document.body.contains(panel)) {
        panels.delete(panel);
        return;
      }
      drawPanel(state, time);
    });
    animationFrame = requestAnimationFrame(draw);
  };

  ensurePanels();
  draw();
  const panelObserver = new MutationObserver(ensurePanels);
  panelObserver.observe(document.body, { childList: true, subtree: true });
  const resizePanels = () => panels.forEach((state, panel) => {
    if (document.body.contains(panel)) resize(state);
  });
  window.addEventListener('resize', resizePanels);
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(animationFrame);
    panelObserver.disconnect();
    window.removeEventListener('resize', resizePanels);
  }, { once: true });
};

setupPanelStarfields();
