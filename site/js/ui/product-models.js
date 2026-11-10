"use strict";

(function (shop) {
  const brass = "#b28a4b";
  const gold = "#d5b46e";
  const paper = "#dfc89a";
  const cork = "#9b6d48";
  const tau = Math.PI * 2;

  function surface(mesh, rings, color) {
    const steps = rings[0].length;
    for (let row = 1; row < rings.length; row += 1) {
      for (let index = 0; index < steps; index += 1) {
        const next = (index + 1) % steps;
        mesh.push({
          color,
          points: [rings[row - 1][index], rings[row][index], rings[row][next], rings[row - 1][next]]
        });
      }
    }
  }

  function lathe(mesh, profile, color, { steps = 36, x = 0, y = 0, z = 0, depth = 1, axis = "y", folds = 0, phase = 0 } = {}) {
    const rings = profile.map(([height, radius]) => Array.from({ length: steps }, (_, index) => {
      const angle = tau * index / steps + phase;
      const rippled = radius * (1 + folds * Math.cos(angle * 9 + height * 2));
      const u = rippled * Math.cos(angle);
      const v = rippled * Math.sin(angle) * depth;
      return axis === "z" ? [x + u, y - v, z + height] : [x + u, y + height, z + v];
    }));
    surface(mesh, rings, color);
  }

  function disk(mesh, radius, depth, color, x, y, z, steps = 36) {
    lathe(mesh, [[-depth / 2, 0], [-depth / 2, radius * 0.91], [-depth * 0.32, radius],
      [depth * 0.32, radius], [depth / 2, radius * 0.91], [depth / 2, 0]], color, { axis: "z", x, y, z, steps });
  }

  function plate(mesh, outline, z, thickness, color) {
    const front = outline.map(([x, y]) => [x, y, z + thickness / 2]);
    const back = outline.map(([x, y]) => [x, y, z - thickness / 2]);
    mesh.push({ color, points: front }, { color, points: [...back].reverse() });
    for (let index = 0; index < outline.length; index += 1) {
      const next = (index + 1) % outline.length;
      mesh.push({ color, points: [back[index], back[next], front[next], front[index]] });
    }
  }

  function roundedPlate(mesh, x, y, width, height, z, color) {
    const cut = Math.min(width, height) * 0.14;
    const left = x - width / 2;
    const right = x + width / 2;
    const bottom = y - height / 2;
    const top = y + height / 2;
    plate(mesh, [
      [left + cut, bottom], [right - cut, bottom], [right, bottom + cut], [right, top - cut],
      [right - cut, top], [left + cut, top], [left, top - cut], [left, bottom + cut]
    ], z, 0.028, color);
  }

  function star(mesh, x, y, z, radius, color) {
    const outline = Array.from({ length: 8 }, (_, index) => {
      const angle = Math.PI * index / 4;
      const size = index % 2 === 0 ? radius : radius * 0.28;
      return [x + Math.cos(angle) * size, y + Math.sin(angle) * size];
    });
    plate(mesh, outline, z, 0.018, color);
  }

  function roundProfile(profile) {
    const rounded = [profile[0]];
    for (let index = 1; index < profile.length; index += 1) {
      const [fromY, fromRadius] = profile[index - 1];
      const [toY, toRadius] = profile[index];
      if (fromY === toY) {
        rounded.push(profile[index]);
        continue;
      }
      rounded.push(
        [fromY * 0.8 + toY * 0.2, fromRadius * 0.8 + toRadius * 0.2],
        [fromY * 0.2 + toY * 0.8, fromRadius * 0.2 + toRadius * 0.8]
      );
    }
    rounded.push(profile.at(-1));
    return rounded;
  }

  function flask(mesh, profile, color, trim, { neck, label, depth = 0.8, cap = cork, emblem = false, steps = 40, phase = 0 }) {
    lathe(mesh, steps > 12 ? roundProfile(profile) : profile, color, { depth, steps, phase });
    const [rimY, rimRadius] = neck;
    lathe(mesh, [[rimY - 0.06, rimRadius * 0.91], [rimY - 0.045, rimRadius],
      [rimY + 0.015, rimRadius], [rimY + 0.04, rimRadius * 0.9]], trim);
    lathe(mesh, [[rimY - 0.015, rimRadius * 0.68], [rimY + 0.06, rimRadius * 0.73],
      [rimY + 0.19, rimRadius * 0.86], [rimY + 0.23, rimRadius * 0.78], [rimY + 0.23, 0]], cap, { steps: 28 });
    const [width, height, y, z] = label;
    const trimStart = mesh.length;
    roundedPlate(mesh, 0, y, width, height, z, trim);
    const paperStart = mesh.length;
    roundedPlate(mesh, 0, y, width * 0.85, height * 0.79, z + 0.023, paper);
    const markStart = mesh.length;
    if (emblem) {
      star(mesh, 0, y, z + 0.047, Math.min(width, height) * 0.27, color);
    } else {
      roundedPlate(mesh, 0, y + height * 0.1, width * 0.5, 0.022, z + 0.046, color);
      roundedPlate(mesh, 0, y - height * 0.1, width * 0.32, 0.018, z + 0.046, color);
    }
    for (let index = trimStart; index < mesh.length; index += 1) {
      mesh[index].badgeLayer = index >= markStart ? 3 : index >= paperStart ? 2 : 1;
    }
  }

  function feather(mesh) {
    const outline = [
      [-0.63, -0.79], [-0.38, -0.33], [-0.25, -0.17], [-0.39, -0.21],
      [-0.14, 0.03], [-0.24, 0], [0.03, 0.31], [-0.06, 0.27], [0.24, 0.6],
      [0.67, 0.87], [0.55, 0.39], [0.29, 0.05], [0.3, 0.18], [0.12, -0.14],
      [0.11, -0.04], [-0.14, -0.36], [-0.39, -0.58]
    ];
    plate(mesh, [...outline].reverse(), 0, 0.11, "#b64c31");
    const barbs = [
      [[-0.39, -0.49], [-0.2, -0.33], [0.09, -0.1], [-0.12, -0.37]],
      [[-0.27, -0.24], [-0.12, -0.05], [0.33, 0.23], [0.07, -0.11]],
      [[-0.1, 0.06], [0.11, 0.3], [0.51, 0.52], [0.27, 0.16]],
      [[0.18, 0.4], [0.37, 0.61], [0.63, 0.83], [0.44, 0.47]]
    ];
    for (const barb of barbs) {
      plate(mesh, [...barb].reverse(), 0.069, 0.035, "#e49548");
      plate(mesh, [...barb].reverse(), -0.069, 0.035, "#e49548");
    }
    const quill = [[-0.77, -0.99], [-0.73, -0.99], [0.62, 0.82], [0.33, 0.53], [-0.63, -0.73]];
    plate(mesh, quill, 0, 0.17, gold);
    plate(mesh, [[-0.72, -0.97], [-0.67, -0.97], [-0.45, -0.68], [-0.51, -0.64]], 0, 0.195, brass);
  }

  function scroll(mesh, sealColor, ink) {
    const strip = [[-0.64, -0.67], [0.5, -0.63], [0.62, -0.49], [0.57, 0.62], [-0.46, 0.7], [-0.64, 0.57]];
    plate(mesh, strip, 0, 0.11, paper);
    lathe(mesh, [[-0.84, 0], [-0.84, 0.14], [-0.66, 0.17], [0.56, 0.17],
      [0.74, 0.14], [0.74, 0]], "#c5a46f", { x: -0.54, z: 0.04, steps: 28 });
    lathe(mesh, [[-0.73, 0], [-0.73, 0.12], [-0.64, 0.14], [0.63, 0.14],
      [0.72, 0.11], [0.72, 0]], "#edce94", { x: 0.55, z: 0.07, steps: 28 });
    for (const y of [0.41, 0.27, 0.12]) {
      roundedPlate(mesh, -0.09, y, y === 0.12 ? 0.37 : 0.57, 0.024, 0.058, ink);
    }
    disk(mesh, 0.215, 0.1, sealColor, 0.14, -0.29, 0.09, 22);
    disk(mesh, 0.164, 0.065, sealColor, 0.14, -0.29, 0.14, 22);
    star(mesh, 0.14, -0.29, 0.18, 0.105, gold);
  }

  function compass(mesh) {
    disk(mesh, 0.77, 0.32, brass, 0, -0.06, 0);
    disk(mesh, 0.69, 0.17, "#51432b", 0, -0.06, 0.14);
    disk(mesh, 0.63, 0.11, "#e0d3a9", 0, -0.06, 0.205);
    disk(mesh, 0.66, 0.1, gold, 0, -0.06, -0.15);
    star(mesh, 0, -0.06, -0.22, 0.42, "#75603a");
    for (let index = 0; index < 12; index += 1) {
      const angle = tau * index / 12;
      disk(mesh, index % 3 === 0 ? 0.034 : 0.019, 0.027, "#795e31",
        Math.cos(angle) * 0.52, Math.sin(angle) * 0.52 - 0.06, 0.266, 8);
    }
    star(mesh, 0, -0.06, 0.27, 0.385, "#839181");
    plate(mesh, [[-0.09, -0.12], [0.18, -0.43], [0.08, -0.04]], 0.296, 0.024, brass);
    plate(mesh, [[-0.09, -0.12], [0.08, -0.04], [-0.22, 0.34]], 0.296, 0.024, "#9c4a42");
    disk(mesh, 0.048, 0.033, "#4f4333", 0, -0.06, 0.315, 12);
    disk(mesh, 0.12, 0.18, brass, 0, 0.77, 0);
    disk(mesh, 0.055, 0.19, "#59432b", 0, 0.77, 0.01, 16);
  }

  function pouch(mesh) {
    lathe(mesh, [[-0.84, 0], [-0.82, 0.35], [-0.73, 0.61], [-0.56, 0.7], [-0.25, 0.73],
      [0.02, 0.62], [0.22, 0.47], [0.38, 0.37], [0.52, 0.42], [0.72, 0.48],
      [0.73, 0.36], [0.63, 0.24], [0.51, 0]], "#79543c", { depth: 0.7, folds: 0.065, steps: 54 });
    lathe(mesh, [[0.33, 0.402], [0.37, 0.429], [0.42, 0.412], [0.45, 0.388]], gold, { depth: 0.82 });
    disk(mesh, 0.108, 0.11, brass, 0, 0.35, 0.34, 20);
    plate(mesh, [[0.03, 0.3], [0.26, 0.06], [0.32, -0.29], [0.21, -0.29], [0.16, 0.045], [-0.035, 0.26]], 0.45, 0.047, gold);
    roundedPlate(mesh, 0, -0.27, 0.34, 0.26, 0.522, "#654031");
    star(mesh, 0, -0.27, 0.553, 0.085, gold);
  }

  function amulet(mesh) {
    disk(mesh, 0.63, 0.26, brass, 0, -0.09, 0, 10);
    disk(mesh, 0.55, 0.29, "#d1a85e", 0, -0.09, 0, 10);
    lathe(mesh, [[-0.33, 0], [-0.25, 0.29], [-0.12, 0.49], [0.1, 0.49], [0.27, 0.31],
      [0.36, 0.13], [0.37, 0]], "#8b9fb6", { axis: "z", y: -0.09, steps: 8, phase: Math.PI / 8 });
    for (let index = 0; index < 8; index += 1) {
      const angle = tau * index / 8;
      disk(mesh, 0.047, 0.17, gold, 0.53 * Math.cos(angle), 0.53 * Math.sin(angle) - 0.09, 0.075, 12);
    }
    disk(mesh, 0.133, 0.18, brass, 0, 0.61, 0, 18);
    disk(mesh, 0.056, 0.193, "#66513a", 0, 0.65, 0.012, 16);
  }

  const builds = {
    "phoenix-feather": feather,
    "morning-dew": (mesh) => flask(mesh, [[-0.86, 0], [-0.86, 0.32], [-0.76, 0.4], [-0.1, 0.44],
      [0.22, 0.39], [0.36, 0.25], [0.53, 0.19], [0.61, 0.19], [0.61, 0]], "#5c9a9a", brass,
    { neck: [0.62, 0.22], label: [0.38, 0.39, -0.26, 0.337], depth: 0.73, emblem: true }),
    "troll-honey": (mesh) => flask(mesh, [[-0.72, 0], [-0.72, 0.44], [-0.62, 0.62], [-0.44, 0.67],
      [0.06, 0.67], [0.26, 0.57], [0.38, 0.46], [0.46, 0.46], [0.46, 0]], "#b37429", gold,
    { neck: [0.5, 0.5], label: [0.57, 0.42, -0.19, 0.552], depth: 0.81 }),
    "healing-potion": (mesh) => flask(mesh, [[-0.86, 0], [-0.86, 0.29], [-0.79, 0.42], [-0.68, 0.54],
      [-0.52, 0.62], [-0.35, 0.65], [-0.2, 0.63], [-0.04, 0.56], [0.12, 0.4], [0.25, 0.25],
      [0.36, 0.21], [0.68, 0.21], [0.68, 0]], "#a1433c", brass,
    { neck: [0.67, 0.254], label: [0.55, 0.42, -0.38, 0.581], depth: 0.88, emblem: true }),
    "night-vision-elixir": (mesh) => flask(mesh, [[-0.88, 0], [-0.88, 0.29], [-0.77, 0.42],
      [0.07, 0.43], [0.34, 0.3], [0.43, 0.18], [0.65, 0.18], [0.65, 0]], "#50557d", gold,
    { neck: [0.64, 0.22], label: [0.4, 0.42, -0.28, 0.312], steps: 8, phase: Math.PI / 8, emblem: true }),
    "luck-tonic": (mesh) => flask(mesh, [[-0.83, 0], [-0.83, 0.49], [-0.75, 0.6], [-0.25, 0.55],
      [0.25, 0.29], [0.39, 0.19], [0.67, 0.19], [0.67, 0]], "#537b57", brass,
    { neck: [0.65, 0.24], label: [0.39, 0.36, -0.51, 0.487], depth: 0.81, emblem: true }),
    "invisibility-potion": (mesh) => flask(mesh, [[-0.87, 0], [-0.87, 0.23], [-0.68, 0.4],
      [-0.28, 0.5], [0.08, 0.48], [0.37, 0.22], [0.6, 0.19], [0.62, 0.19], [0.62, 0]], "#8c86a1", "#a78c66",
    { neck: [0.64, 0.23], label: [0.38, 0.35, -0.23, 0.34], depth: 0.75, steps: 6, phase: Math.PI / 6, emblem: true }),
    "fireball-scroll": (mesh) => scroll(mesh, "#a94c40", "#86523c"),
    "teleport-scroll": (mesh) => scroll(mesh, "#5d637e", "#626183"),
    "compass-of-wishes": compass,
    "bottomless-pouch": pouch,
    "moonstone-amulet": amulet
  };

  shop.productModels = Object.fromEntries(Object.entries(builds).map(([id, build]) => [id, () => {
    const faces = [];
    build(faces);
    return faces;
  }]));
})(window.Shop);
