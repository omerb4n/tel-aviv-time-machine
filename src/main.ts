import * as THREE from 'three';
import './game/game.css';
import { Ambience } from './audio/Ambience';
import { VANISHING_SCHOOL } from './game/cases/vanishingSchool';
import { Game } from './game/Game';
import { CameraRig } from './core/CameraRig';
import { TimeController } from './core/TimeController';
import { smoothstep } from './core/math';
import { devFactor } from './data/development';
import { ERAS, TIME_MAX, TIME_MIN, eraAt, moodAt } from './data/eras';
import { EVENTS, VIEWS } from './data/events';
import { baseHeight, seaward } from './data/geography';
import { populationAt } from './data/population';
import { STYLE_INFO } from './data/styleInfo';
import type { BuildingStyle, TimelineEvent } from './data/types';
import { $, fmtNumber, h } from './ui/dom';
import { InfoPanel } from './ui/InfoPanel';
import { Labels } from './ui/Labels';
import { Timeline } from './ui/Timeline';
import { Toast } from './ui/Toast';
import { Tour } from './ui/Tour';
import { Atmosphere } from './world/Atmosphere';
import { BuildingManager } from './world/buildings/BuildingManager';
import { CityBlanket } from './world/CityBlanket';
import { allSites, phaseAt } from './world/fabric';
import { createMaterials } from './world/materials';
import { People } from './world/People';
import { PostFX } from './world/PostFX';
import { Sea } from './world/Sea';
import { Streets } from './world/Streets';
import { Terrain, duneHeight } from './world/Terrain';
import { createTextures } from './world/textures';
import { Traffic } from './world/Traffic';
import { Vegetation } from './world/Vegetation';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const progress = (p: number) => (($('#loading-fill') as HTMLElement).style.width = `${Math.round(p * 100)}%`);

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const year = Number(p.get('year'));
  return { year: Number.isFinite(year) && year >= TIME_MIN && year <= TIME_MAX ? year : undefined };
}

async function main() {
  // ------------------------------------------------------------ renderer & scene
  const canvas = $('#scene') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 40000);
  camera.position.set(...VIEWS.overview.pos);

  const hashYear = readHash().year;
  const startYear = hashYear ?? VANISHING_SCHOOL.start.year;
  const time = new TimeController(TIME_MIN, TIME_MAX, startYear);
  progress(0.05);
  await nextFrame();

  // ------------------------------------------------------------ world
  const tex = createTextures();
  const mats = createMaterials(tex);
  progress(0.2);
  await nextFrame();
  const sites = allSites();
  progress(0.35);
  await nextFrame();
  const terrain = new Terrain(tex);
  const sea = new Sea();
  const streets = new Streets(tex);
  progress(0.5);
  await nextFrame();
  const vegetation = new Vegetation(sites);
  const blanket = new CityBlanket(tex);
  progress(0.65);
  await nextFrame();
  const buildings = new BuildingManager(sites, mats);
  const people = new People();
  const traffic = new Traffic();
  scene.add(terrain.mesh, sea.mesh, streets.root, vegetation.root, blanket.root, buildings.root, people.root, traffic.root);
  const atmosphere = new Atmosphere(renderer, scene);
  const post = new PostFX(renderer, scene, camera);

  const ground = (x: number, z: number) =>
    baseHeight(x, z) + duneHeight(x, z) * devFactor(x, z, time.year) * (1 - smoothstep(-160, -30, seaward(x, z)));
  const rig = new CameraRig(camera, canvas, ground);
  rig.controls.target.set(...VIEWS.overview.target);
  rig.controls.update();

  // ------------------------------------------------------------ UI
  const info = new InfoPanel($('#info'));
  const toast = new Toast($('#toast'));
  const tour = new Tour($('#tour'));
  const timeline = new Timeline($('#timeline'), time);
  const labels = new Labels($('#labels'), sites, buildings);
  const audio = new Ambience();
  let hour = 16.5;
  let filmOn = true;

  const applyLight = () => {
    atmosphere.set(hour, moodAt(time.year).haze);
    mats.setNight(atmosphere.night);
    streets.setNight(atmosphere.night);
    blanket.setNight(atmosphere.night);
  };

  const selectSite = (id: string | undefined) => {
    buildings.select(id);
    const site = id ? buildings.site(id) : undefined;
    if (site) info.showSite(site, time.year);
    else info.hide();
  };
  labels.onClick = (id) => selectSite(id);
  info.onJump = (y) => time.tweenTo(y + 0.01, 1.2);
  info.onClose = () => buildings.select(undefined);

  const goToEvent = (ev: TimelineEvent, openInfo = false) => {
    time.playing = false;
    time.tweenTo(ev.year, 2.2);
    if (ev.view) rig.flyTo(new THREE.Vector3(...ev.view.pos), new THREE.Vector3(...ev.view.target), 3.2);
    if (openInfo) info.showEvent(ev);
  };
  timeline.onEvent = (ev) => goToEvent(ev, true);
  toast.onShow = (ev) => goToEvent(ev);
  toast.onMore = (ev) => info.showEvent(ev);
  tour.onStop = (ev) => {
    info.hide();
    toast.hide();
    goToEvent(ev);
  };
  tour.onEnd = () => $('#btn-tour').classList.remove('active');

  // ------------------------------------------------------------ year changes
  const stats = $('#stats');
  let lastInt = -1;
  let terrainDirty = true;
  let lastTerrain = 0;
  let toastTimer = 0;
  let hashTimer = 0;
  const onYear = (year: number) => {
    const y = Math.floor(year);
    terrainDirty = true;
    if (y === lastInt) return;
    lastInt = y;
    buildings.setYear(y);
    streets.setYear(y);
    vegetation.setYear(y);
    people.setYear(y);
    traffic.setYear(y);
    blanket.setYear(y);
    applyLight();

    const era = eraAt(y);
    $('#year').textContent = String(y);
    $('#era-title').textContent = era.title.en;
    $('#era-sub').textContent = era.subtitle.en;
    if (info.current && !info.current.startsWith('event:')) {
      const site = buildings.site(info.current);
      if (site) info.showSite(site, y);
    }
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      if (tour.active || !document.body.classList.contains('mode-free')) return;
      const ev = EVENTS.find((e) => e.year === Math.floor(time.year));
      if (ev) toast.show(ev);
    }, 380);
    window.clearTimeout(hashTimer);
    if (document.body.classList.contains('mode-free'))
      hashTimer = window.setTimeout(() => history.replaceState(null, '', `#year=${Math.floor(time.year)}`), 500);
    window.setTimeout(() => buildings.refreshHighlight(), 700);
  };
  time.onChange(onYear);

  const renderStats = () => {
    const y = Math.floor(time.year);
    const pop = populationAt(y);
    const s = buildings.stats();
    let dominant: [BuildingStyle, number] | undefined;
    for (const [style, n] of s.byStyle) if (STYLE_INFO[style] && (!dominant || n > dominant[1])) dominant = [style, n];
    const chips = [
      h('span', { class: 'chip', title: pop.estimated ? 'Estimate' : 'Census figure' }, h('i', {}, `${pop.label} `), h('b', {}, (pop.estimated && pop.value ? '≈ ' : '') + (pop.value ? fmtNumber(pop.value) : '—')), h('i', {}, ' people')),
      h('span', { class: 'chip' }, h('b', {}, fmtNumber(s.total + blanket.count)), h('i', {}, ' buildings')),
    ];
    if (dominant && s.total)
      chips.push(h('span', { class: 'chip' }, h('b', {}, `${Math.round((dominant[1] / s.total) * 100)}%`), h('i', {}, ` ${STYLE_INFO[dominant[0]]!.name.en.replace(/ \(.*\)/, '')}`)));
    stats.replaceChildren(...chips);
  };

  // ------------------------------------------------------------ the exploration game
  /** Instant time travel: no rise/sink animation, terrain recomputed now. */
  const jumpTo = (y: number) => {
    time.set(y);
    buildings.settle();
    terrain.setYear(time.year);
    terrainDirty = false;
  };
  const game = new Game({ time, rig, camera, canvas, post, buildings, scene, audio, ground, jumpTo }, VANISHING_SCHOOL, $('#ui'));
  rig.collide = (x, z) => game.active && buildings.blockedAt(x, z);

  /** The classic free timeline (the original museum-style experience). */
  const enterFree = (fromGame: boolean) => {
    document.body.classList.add('mode-free');
    document.body.classList.remove('mode-game');
    if (!fromGame) {
      time.tweenTo(1909, 0.01);
      rig.setMode('orbit', false);
      rig.flyTo(new THREE.Vector3(...VIEWS.overview.pos), new THREE.Vector3(...VIEWS.overview.target), 2.5);
    }
    $('#btn-street').classList.toggle('active', rig.mode === 'street');
    $('#street-hint').classList.toggle('hidden', rig.mode !== 'street');
    window.setTimeout(() => $('#help').classList.add('fade'), 12000);
    window.setTimeout(() => {
      const ev = EVENTS.find((e) => e.year === Math.floor(time.year));
      if (ev && !tour.active) toast.show(ev);
    }, 1500);
  };
  game.onFreeMode = (fromGame) => enterFree(fromGame);

  // ------------------------------------------------------------ prebuild the first year
  onYear(time.year);
  terrain.setYear(time.year);
  while (buildings.busy) buildings.update(0, 50);
  buildings.update(10);
  progress(0.9);
  await nextFrame();
  if (hashYear === undefined) {
    game.preparePhotos();
    const p = VANISHING_SCHOOL.start.pose;
    rig.teleport(p.x, p.z, p.yaw, p.pitch);
  }
  progress(1);
  renderStats();
  await nextFrame();
  $('#loading').classList.add('done');
  if (hashYear === undefined) game.showTitle(document.body);
  else enterFree(true);

  // ------------------------------------------------------------ toolbar
  const toggle = (sel: string, on: boolean) => $(sel).classList.toggle('active', on);
  let ghosts = false;
  const actions = {
    tour: () => {
      if (tour.active) tour.stop();
      else {
        tour.start();
        toggle('#btn-tour', true);
      }
    },
    walk: () => rig.setMode(rig.mode === 'street' ? 'orbit' : 'street'),
    ghosts: () => {
      ghosts = !ghosts;
      buildings.setGhosts(ghosts);
      toggle('#btn-ghosts', ghosts);
    },
    sound: async () => {
      if (audio.enabled) audio.disable();
      else await audio.enable();
      toggle('#btn-sound', audio.enabled);
    },
  };
  $('#btn-tour').onclick = actions.tour;
  $('#btn-case').onclick = () => {
    if (tour.active) tour.stop();
    info.hide();
    toast.hide();
    buildings.select(undefined);
    game.enter(true);
  };
  $('#btn-street').onclick = actions.walk;
  $('#btn-ghosts').onclick = actions.ghosts;
  $('#btn-sound').onclick = actions.sound;
  $('#btn-settings').onclick = () => {
    $('#settings').classList.toggle('hidden');
    toggle('#btn-settings', !$('#settings').classList.contains('hidden'));
  };
  rig.onModeChange = (mode) => {
    toggle('#btn-street', mode === 'street');
    $('#street-hint').classList.toggle('hidden', mode !== 'street');
    $('#help').classList.add('fade');
  };

  const hourInput = $('#hour') as HTMLInputElement;
  const setHour = (v: number) => {
    hour = v;
    const hh = Math.floor(v);
    $('#hour-label').textContent = `${String(hh).padStart(2, '0')}:${String(Math.round((v - hh) * 60)).padStart(2, '0')}`;
    applyLight();
  };
  hourInput.oninput = () => setHour(Number(hourInput.value));
  ($('#opt-film') as HTMLInputElement).onchange = (e) => (filmOn = (e.target as HTMLInputElement).checked);
  ($('#opt-labels') as HTMLInputElement).onchange = (e) => (labels.enabled = (e.target as HTMLInputElement).checked);
  ($('#opt-people') as HTMLInputElement).onchange = (e) => {
    const on = (e.target as HTMLInputElement).checked;
    people.root.visible = on;
    traffic.root.visible = on;
  };
  ($('#opt-shadows') as HTMLInputElement).onchange = (e) => {
    const on = (e.target as HTMLInputElement).checked;
    renderer.shadowMap.enabled = on;
    atmosphere.sun.castShadow = on;
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (m) for (const mm of Array.isArray(m) ? m : [m]) mm.needsUpdate = true;
    });
  };

  window.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT' || !document.body.classList.contains('mode-free')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      time.togglePlay();
    } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      time.playing = false;
      time.step((e.code === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 10 : 1));
    } else if (e.code === 'KeyT') actions.tour();
    else if (e.code === 'KeyV') actions.walk();
    else if (e.code === 'KeyG') actions.ghosts();
    else if (e.code === 'KeyM') void actions.sound();
    else if (e.code === 'Escape') {
      if (tour.active) tour.stop();
      info.hide();
      buildings.select(undefined);
    }
  });
  window.addEventListener('hashchange', () => {
    const y = readHash().year;
    if (y !== undefined && y !== Math.floor(time.year)) time.tweenTo(y, 1.5);
  });

  // ------------------------------------------------------------ picking & hover
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tooltip = $('#tooltip');
  let down = { x: 0, y: 0 };
  canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener('pointerup', (e) => {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    if (game.active) {
      game.tap(e.clientX, e.clientY);
      return;
    }
    if (!document.body.classList.contains('mode-free')) return;
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = buildings.pick(raycaster);
    selectSite(hit?.site.id);
  });
  let lastHover = 0;
  canvas.addEventListener('pointermove', (e) => {
    const now = performance.now();
    if (now - lastHover < 90 || e.buttons || game.active) return;
    lastHover = now;
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = buildings.pick(raycaster);
    if (!hit) {
      tooltip.classList.add('hidden');
      canvas.style.cursor = '';
      return;
    }
    const ph = phaseAt(hit.site, time.year) ?? hit.phase;
    const name = hit.site.name?.en ?? STYLE_INFO[ph.style]?.name.en ?? 'Building';
    tooltip.textContent = `${name} · ${ph.from}${hit.object.userData.ghost ? ' (demolished)' : ''}`;
    tooltip.style.left = `${e.clientX}px`;
    tooltip.style.top = `${e.clientY}px`;
    tooltip.classList.remove('hidden');
    canvas.style.cursor = 'pointer';
  });
  canvas.addEventListener('pointerleave', () => tooltip.classList.add('hidden'));

  // ------------------------------------------------------------ resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    post.setSize(window.innerWidth, window.innerHeight);
  });

  // ------------------------------------------------------------ loop
  const clock = new THREE.Clock();
  let statsTimer = 0;
  setHour(hour);
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    time.update(dt);
    tour.update(dt);
    rig.update(dt);
    buildings.update(dt);
    const now = performance.now();
    if (terrainDirty && now - lastTerrain > 140) {
      terrain.setYear(time.year);
      terrainDirty = false;
      lastTerrain = now;
    }
    if (people.root.visible) {
      people.update(dt, t);
      traffic.update(dt);
    }
    sea.update(t);
    atmosphere.follow(rig.focus, rig.distance);
    if (!game.active) labels.update(camera, time.year);
    game.update(dt, t);
    timeline.render();
    statsTimer += dt;
    if (statsTimer > 0.5) {
      statsTimer = 0;
      renderStats();
    }
    const mood = moodAt(time.year);
    post.setMood(mood, filmOn, atmosphere.night, t);
    audio.update({
      year: time.year,
      urban: 1 - devFactor(rig.focus.x, rig.focus.z, time.year),
      people: people.count,
      vehicles: traffic.count,
      height: camera.position.y,
      night: atmosphere.night,
    });
    post.render();
  });

  // Expose for debugging and automated screenshots.
  Object.assign(window, { tlvtm: { time, rig, buildings, scene, camera, renderer, ERAS, setHour, selectSite, game } });
}

main().catch((err) => {
  console.error(err);
  const sub = document.querySelector('.loading-sub');
  if (sub) sub.textContent = `Something went wrong: ${err?.message ?? err}. This experience needs WebGL 2.`;
});
