"use strict";

(function (shop) {
  const initialYaw = -0.4;
  const initialPitch = 0.16;
  const turn = Math.PI * 2;
  const spellDuration = 1700;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const modelCache = new Map();
  const views = new WeakMap();
  const spells = {
    ingredients: { color: "#ffae53", shine: "#fff0aa", motion: "rise" },
    potions: { color: "#6ef8da", shine: "#e0ffb3", motion: "spin" },
    scrolls: { color: "#ff729d", shine: "#ffcf78", motion: "tilt" },
    artifacts: { color: "#ad8cff", shine: "#d9eeff", motion: "orbit" }
  };
  const seals = {
    fire: { id: "healing-potion", spell: { color: "#ffab50", shine: "#ffe993", motion: "spin" } },
    moon: { id: "night-vision-elixir", spell: spells.artifacts },
    wild: { id: "luck-tonic", spell: { color: "#b1ff72", shine: "#e7ffae", motion: "rise" } }
  };

  function prepareFace({ points, color, badgeLayer = 0 }) {
    const [nx, ny, nz] = points.reduce(([x, y, z], current, index) => {
      const next = points[(index + 1) % points.length];
      return [
        x + (current[1] - next[1]) * (current[2] + next[2]),
        y + (current[2] - next[2]) * (current[0] + next[0]),
        z + (current[0] - next[0]) * (current[1] + next[1])
      ];
    }, [0, 0, 0]);
    const length = Math.hypot(nx, ny, nz);
    const rgb = Number.parseInt(color.slice(1), 16);
    return {
      points,
      badgeLayer,
      normal: length ? [nx / length, ny / length, nz / length] : [0, 0, 0],
      rgb: [rgb >> 16, (rgb >> 8) & 255, rgb & 255]
    };
  }

  function paintSpell(ctx, x, y, scale, progress, spell) {
    const energy = Math.sin(Math.PI * progress);
    ctx.save();
    ctx.globalAlpha = energy * 0.7;
    ctx.strokeStyle = spell.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y + scale * 0.22, scale * (0.88 + progress * 0.3), scale * 0.39, -0.23, 0, turn);
    ctx.stroke();
    ctx.globalAlpha = energy;
    for (let index = 0; index < 12; index += 1) {
      const angle = index * turn / 12 + progress * turn * 0.65;
      const radius = scale * (0.65 + progress * 0.55 + (index % 3) * 0.11);
      const sx = x + Math.cos(angle) * radius;
      const sy = y + Math.sin(angle) * radius * 0.72 + Math.sin(index * 4) * scale * 0.34;
      const size = 2 + index % 4;
      ctx.fillStyle = index % 2 ? spell.shine : spell.color;
      ctx.beginPath();
      ctx.moveTo(sx, sy - size * 1.6);
      ctx.lineTo(sx + size * 0.25, sy - size * 0.25);
      ctx.lineTo(sx + size, sy);
      ctx.lineTo(sx + size * 0.25, sy + size * 0.25);
      ctx.lineTo(sx, sy + size * 1.6);
      ctx.lineTo(sx - size * 0.25, sy + size * 0.25);
      ctx.lineTo(sx - size, sy);
      ctx.lineTo(sx - size * 0.25, sy - size * 0.25);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function motionPose(view, time, progress) {
    const idle = view.hero && !view.manual && !reducedMotion.matches ? time / 1050 : 0;
    let yaw = Math.sin(idle * 0.56) * 0.26;
    let pitch = Math.sin(idle * 0.42) * 0.055;
    let lift = Math.sin(idle) * 0.045;
    if (progress > 0) {
      const swell = Math.sin(Math.PI * progress);
      const wave = Math.sin(turn * progress);
      switch (view.spell.motion) {
        case "rise":
          lift += swell * 0.24;
          yaw += wave * 0.34;
          break;
        case "spin":
          yaw += turn * progress * progress * (3 - 2 * progress);
          lift += swell * 0.11;
          break;
        case "tilt":
          pitch += wave * 0.38;
          yaw += swell * 0.62;
          lift += swell * 0.09;
          break;
        case "orbit":
          yaw += wave * 0.57;
          pitch += swell * 0.26;
          lift += swell * 0.16;
          break;
      }
    }
    return { yaw, pitch, lift };
  }

  function draw(view, time, progress) {
    const { stage, canvas, ctx } = view;
    const { clientWidth: width, clientHeight: height } = stage;
    if (!width || !height) return;

    const density = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * density);
    const pixelHeight = Math.round(height * density);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    ctx.setTransform(density, 0, 0, density, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const scale = Math.min(width * 0.44, height * 0.36);
    const originX = width * 0.5;
    const originY = height * 0.485;
    const pose = motionPose(view, time, progress);
    view.pose = pose;

    ctx.save();
    ctx.translate(originX, originY + scale * 0.99);
    ctx.scale(scale * 0.92, scale * 0.19);
    const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    shadow.addColorStop(0, "rgba(48,34,25,0.26)");
    shadow.addColorStop(1, "rgba(48,34,25,0)");
    ctx.fillStyle = shadow;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();

    const cy = Math.cos(view.yaw + pose.yaw);
    const sy = Math.sin(view.yaw + pose.yaw);
    const cp = Math.cos(view.pitch + pose.pitch);
    const sp = Math.sin(view.pitch + pose.pitch);
    function rotate([x, y, z]) {
      const depth = z * cy - x * sy;
      return [x * cy + z * sy, y * cp - depth * sp, y * sp + depth * cp];
    }

    const faces = [];
    const projections = new Map();
    for (const face of view.faces) {
      const [nx, ny, nz] = rotate(face.normal);
      if (nz < -0.1 || (face.badgeLayer && cy * cp < 0.07)) continue;
      const points = face.points.map((vertex) => {
        if (!projections.has(vertex)) {
          const [x, y, z] = rotate(vertex);
          const perspective = 4.8 / (4.8 - z);
          projections.set(vertex, [originX + x * scale * perspective, originY - (y + pose.lift) * scale * perspective, z]);
        }
        return projections.get(vertex);
      });
      const depth = points.reduce((sum, point) => sum + point[2], 0) / points.length;
      const diffuse = Math.max(0, nx * -0.47 + ny * 0.55 + nz * 0.69);
      const shine = Math.max(0, nx * -0.26 + ny * 0.3 + nz * 0.92) ** 12 * (view.hero ? 40 : 28);
      const rgb = face.rgb.map((component) => Math.min(255, Math.round(component * (0.53 + 0.59 * diffuse) + shine)));
      faces.push({ points, depth, badgeLayer: face.badgeLayer, fill: `rgb(${rgb.join(",")})` });
    }

    faces.sort((a, b) => a.badgeLayer - b.badgeLayer || a.depth - b.depth);
    ctx.lineJoin = "round";
    ctx.lineWidth = 0.55;
    for (const { points, fill } of faces) {
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.strokeStyle = fill;
      ctx.fill();
      ctx.stroke();
    }
    if (progress > 0) paintSpell(ctx, originX, originY - pose.lift * scale, scale, progress, view.spell);
    if (!stage.hasAttribute("data-model-ready")) stage.dataset.modelReady = "true";
  }

  function clearSpell(view) {
    view.spellStarted = null;
    view.pendingSpell = false;
    delete view.stage.dataset.casting;
  }

  function requestDraw(view) {
    if (view.frame) return;
    view.frame = window.requestAnimationFrame((time) => {
      view.frame = 0;
      if (!view.onScreen) return;
      if (view.spellStarted !== null && (reducedMotion.matches || time - view.spellStarted >= spellDuration)) {
        clearSpell(view);
      }
      const progress = view.spellStarted === null ? 0 : Math.max(0, (time - view.spellStarted) / spellDuration);
      const animate = view.spellStarted !== null || (view.hero && !view.manual && !reducedMotion.matches);
      if (!animate || time - view.lastPaint >= 31) {
        draw(view, time, progress);
        view.lastPaint = time;
      }
      if (animate) requestDraw(view);
    });
  }

  function cast(stage) {
    const view = views.get(stage);
    if (!view || reducedMotion.matches) return;
    if (!view.ctx) {
      view.pendingSpell = true;
      return;
    }
    view.spellStarted = window.performance.now();
    stage.dataset.casting = view.spell.motion;
    requestDraw(view);
  }

  function takeControl(view) {
    if (view.pose) {
      view.yaw = (view.yaw + view.pose.yaw) % turn;
      view.pitch = Math.max(-1.1, Math.min(1.1, view.pitch + view.pose.pitch));
      view.pose = null;
    }
    view.manual = true;
    clearSpell(view);
  }

  function facesFor(id) {
    if (!modelCache.has(id)) modelCache.set(id, shop.productModels[id]().map(prepareFace));
    return modelCache.get(id);
  }

  function updateModelLabels(view) {
    view.canvas?.setAttribute("aria-label", `${view.name}. 3D-модель. Вращайте стрелками, Home возвращает исходный ракурс.`);
    view.stage.querySelector("[data-model-spell]")?.setAttribute("aria-label", `Оживить модель: ${view.name}`);
  }

  const resize = typeof ResizeObserver === "function" ? new ResizeObserver((entries) => {
    for (const { target } of entries) requestDraw(views.get(target));
  }) : null;

  function activate(view) {
    const { stage, id } = view;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const category = stage.closest("[data-category]")?.dataset.category;
    Object.assign(view, {
      canvas, ctx, faces: facesFor(id), yaw: initialYaw, pitch: initialPitch,
      frame: 0, lastPaint: -Infinity, spell: view.spell ?? spells[category] ?? spells.potions, spellStarted: null
    });
    canvas.className = "model-canvas";
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    updateModelLabels(view);
    stage.prepend(canvas);
    const spellButton = stage.querySelector("[data-model-spell]");
    spellButton?.addEventListener("click", () => cast(stage));

    let drag = null;
    canvas.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      takeControl(view);
      canvas.setPointerCapture(event.pointerId);
      drag = { x: event.clientX, y: event.clientY };
      requestDraw(view);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!drag || !canvas.hasPointerCapture(event.pointerId)) return;
      view.yaw = (view.yaw + (event.clientX - drag.x) * 0.012) % turn;
      view.pitch = Math.max(-1.1, Math.min(1.1, view.pitch + (event.clientY - drag.y) * 0.01));
      drag = { x: event.clientX, y: event.clientY };
      requestDraw(view);
    });
    canvas.addEventListener("lostpointercapture", () => {
      drag = null;
    });
    canvas.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(event.key)) return;
      takeControl(view);
      switch (event.key) {
        case "ArrowLeft": view.yaw -= 0.16; break;
        case "ArrowRight": view.yaw += 0.16; break;
        case "ArrowUp": view.pitch = Math.max(-1.1, view.pitch - 0.13); break;
        case "ArrowDown": view.pitch = Math.min(1.1, view.pitch + 0.13); break;
        case "Home": view.yaw = initialYaw; view.pitch = initialPitch; break;
      }
      event.preventDefault();
      requestDraw(view);
    });

    if (resize) resize.observe(stage);
    else window.addEventListener("resize", () => requestDraw(view));
    if (view.pendingSpell) {
      view.pendingSpell = false;
      cast(stage);
    }
    requestDraw(view);
  }

  const visible = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const view = views.get(entry.target);
      view.onScreen = entry.isIntersecting;
      if (!view.onScreen) continue;
      if (!view.ctx) activate(view);
      else requestDraw(view);
    }
  }, { rootMargin: "180px" }) : null;

  function mount(stage, id, name) {
    if (!stage || !Object.hasOwn(shop.productModels, id) || views.has(stage)) return;
    const view = { stage, id, name, hero: stage.hasAttribute("data-hero-model"), onScreen: !visible, manual: false };
    views.set(stage, view);
    if (visible) visible.observe(stage);
    else activate(view);
  }

  shop.productView = { mount, cast };
  const hero = document.querySelector("[data-hero-model]");
  if (hero) {
    mount(hero, hero.dataset.heroModel, hero.dataset.modelName);
    const view = views.get(hero);
    const buttons = document.querySelectorAll("[data-seal]");
    const image = hero.querySelector(".hero-image");
    const index = hero.querySelector("[data-hero-index]");
    const caption = document.querySelector("[data-hero-caption]");
    view.spell = seals.fire.spell;

    for (const button of buttons) {
      button.addEventListener("click", () => {
        const element = button.dataset.seal;
        const { id, spell } = seals[element];
        const position = shop.catalog.products.findIndex((product) => product.id === id);
        const product = shop.catalog.products[position];
        hero.dataset.element = element;
        hero.dataset.heroModel = id;
        buttons.forEach((choice) => choice.setAttribute("aria-pressed", String(choice === button)));
        caption.textContent = product.name;
        index.textContent = `ЭКЗЕМПЛЯР ${String(position + 1).padStart(2, "0")}`;
        image.src = `./${product.image}`;
        image.alt = product.name;
        Object.assign(view, { id, name: product.name, spell, yaw: initialYaw, pitch: initialPitch, manual: false });
        if (view.ctx) view.faces = facesFor(id);
        clearSpell(view);
        updateModelLabels(view);
        cast(hero);
        if (view.ctx) requestDraw(view);
      });
    }

    reducedMotion.addEventListener("change", () => {
      if (view?.ctx) requestDraw(view);
    });
  }
})(window.Shop);
