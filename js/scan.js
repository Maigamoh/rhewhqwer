const $ = id => document.getElementById(id);
const MODEL = 'model/pneumonia_densenet121.onnx', META = 'model/model_meta.json', S = 224;
let session = null, meta = null, picked = [];

async function init() {
  try {
    meta = await (await fetch(META)).json();
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/';
    session = await ort.InferenceSession.create(MODEL, { executionProviders: ['wasm'] });
    $('mstat').textContent = `Model ready · threshold ${meta.threshold.toFixed(2)} · test AUC ${meta.test_metrics.auc.toFixed(3)} · sensitivity ${meta.test_metrics.sensitivity.toFixed(2)} · specificity ${meta.test_metrics.specificity.toFixed(2)}`;
  } catch (e) {
    $('mstat').innerHTML = 'Model not found. Train it with the Colab notebook and place <code>pneumonia_densenet121.onnx</code> and <code>model_meta.json</code> in the <code>model/</code> folder. Serve the site over http (Live Server), not file://.';
  }
  update();
}
function update() { $('go').disabled = !(session && picked.length && $('att').checked); }
$('att').onchange = update;
$('files').onchange = e => { picked = [...e.target.files]; $('fcount').textContent = picked.length ? `${picked.length} image(s) selected` : 'No images selected'; update(); };

const loadImg = f => new Promise((ok, no) => { const u = URL.createObjectURL(f), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); ok(i); }; i.onerror = () => no(new Error('Cannot read ' + f.name)); i.src = u; });

function region(cam) {
  const mx = Math.max(...cam, 1e-6); let tot = 0, L = 0, R = 0; const z = [0, 0, 0];
  cam.forEach((v, i) => { v = Math.max(v, 0) / mx; if (v < 0.5) return; const r = Math.floor(i / 7), c = i % 7;
    tot += v; if (c < 3) L += v; else if (c > 3) R += v; z[r < 2 ? 0 : r < 5 ? 1 : 2] += v; });
  if (!tot) return 'diffuse / no clear focus';
  const zone = ['upper', 'middle', 'lower'][z.indexOf(Math.max(...z))];
  const side = (L / tot >= 0.3 && R / tot >= 0.3) ? 'both lungs' : (L >= R ? "patient's right" : "patient's left");
  return `${side}, ${zone} zone (assumes standard orientation)`;
}
function tier(p) {
  const t = meta.threshold;
  if (p >= t) return ['Higher model signal', 't1'];
  return ['Lower model signal', 't5'];
}
async function analyse(file, n) {
  const img = await loadImg(file), c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, S, S);
  const d = x.getImageData(0, 0, S, S).data, px = S * S, t = new Float32Array(3 * px); let sat = 0;
  for (let i = 0; i < px; i++) { const r = d[4*i], g = d[4*i+1], b = d[4*i+2]; t[i] = r/255; t[px+i] = g/255; t[2*px+i] = b/255; sat += Math.abs(r-g) + Math.abs(g-b); }
  sat /= px;
  const o = await session.run({ image: new ort.Tensor('float32', t, [1, 3, S, S]) });
  const p = o.pneumonia_probability.data[0], cam = Float32Array.from(o.cam.data);
  const warn = []; if (sat > 12) warn.push('Colour image: may be a photo or screenshot, so reliability is lower.');
  if (Math.abs(img.width / img.height - 1) > 0.5) warn.push('Unusual aspect ratio: image is squashed to 224×224.');
  if (img.width < 128 || img.height < 128) warn.push('Low image resolution; model output may be unreliable.');
  return { n, name: file.name, p: Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : 0, cam, canvas: c, region: region(cam), warn };
}
function heat(r) {
  const out = document.createElement('canvas'); out.width = out.height = S; const x = out.getContext('2d');
  x.drawImage(r.canvas, 0, 0);
  const mx = Math.max(...r.cam, 1e-6), s = document.createElement('canvas'); s.width = s.height = 7;
  const sx = s.getContext('2d'), id = sx.createImageData(7, 7);
  r.cam.forEach((v, i) => { id.data.set([255, 40, 0, Math.round(Math.max(v, 0) / mx * 190)], 4 * i); });
  sx.putImageData(id, 0, 0); x.imageSmoothingEnabled = true; x.drawImage(s, 0, 0, S, S); return out;
}
$('go').onclick = async () => {
  $('go').disabled = true; $('out').innerHTML = ''; const res = [];
  for (let i = 0; i < picked.length; i++) {
    $('fcount').textContent = `Analysing ${i + 1} / ${picked.length}…`;
    try { res.push(await analyse(picked[i], i + 1)); } catch (e) { $('out').insertAdjacentHTML('beforeend', `<div class="card warn">Image ${i + 1}: ${e.message}</div>`); }
  }
  res.sort((a, b) => b.p - a.p);
  $('sumcard').hidden = !res.length;
  $('sum').innerHTML = `<p><b>${res.map(r => 'Image ' + r.n).join(' → ')}</b></p><p class="mu">${res.length ? `Image ${res[0].n} ranks first (estimated pneumonia likelihood ${(res[0].p*100).toFixed(0)}%).` : ''} Ranking reflects likelihood of pneumonia, not clinical severity. Check vitals and review every image.</p>`;
  res.forEach((r, i) => {
    const [label, cls] = tier(r.p), close = res[i+1] && r.p - res[i+1].p < 0.05;
    const card = document.createElement('div'); card.className = 'card';
    card.innerHTML = `<div class="res"><div class="rk">#${i + 1}</div><div class="hm"></div><div style="flex:1;min-width:240px">
      <h2>Image ${r.n} <span class="mu">· ${r.name.replace(/[<>&"]/g, '')}</span></h2>
      <span class="pill ${cls}">${label}</span>
      <div style="margin-top:8px">Estimated pneumonia likelihood: <b>${(r.p*100).toFixed(1)}%</b> <span class="mu">(research threshold ${(meta.threshold*100).toFixed(0)}%)</span></div>
      <div class="bar"><i style="width:${(r.p*100).toFixed(0)}%"></i></div>
      <div>Potential model signal: <b>${r.p >= meta.threshold ? 'pneumonia-like pattern may be present; clinician confirmation required' : 'no elevated pneumonia signal detected; disease is not ruled out'}</b></div>
      <div>Model attention location: <b>${r.region}</b></div>
      <div class="mu">Attention location is not a finding. This model does not identify specific signs (such as opacity or consolidation), determine severity, or assess other diseases.</div>
      ${close ? '<div class="mu">Close to the next image’s score: review these together.</div>' : ''}
      ${r.warn.map(w => `<div style="color:var(--r2)">⚠ ${w}</div>`).join('')}</div></div>`;
    card.querySelector('.hm').appendChild(heat(r)); $('out').appendChild(card);
  });
  $('fcount').textContent = `${res.length} image(s) analysed`; update();
};
init();
