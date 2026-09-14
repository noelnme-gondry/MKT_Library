// Build localized video compositions and captions from the application's SSOT.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
const app = path.resolve('v2-migration');
const require = createRequire(path.join(app, 'package.json'));
const { build } = require('esbuild');
const project = process.env.TUTORIAL_PROJECT_DIR || '/tmp/gop-tutorial-videos';
await build({ entryPoints: [path.join(app, 'src/lib/videoTutorials.js')], bundle: true, platform: 'node', format: 'cjs', outfile: path.join(project, 'tutorials.cjs'), logLevel: 'silent' });
const { VIDEO_TUTORIALS, TUTORIAL_STEP_SECONDS } = require(path.join(project, 'tutorials.cjs'));
await mkdir(path.join(project, 'assets'), { recursive: true });
await copyFile(path.join(app, 'public/fonts/PretendardVariable.woff2'), path.join(project, 'assets/PretendardVariable.woff2'));
await writeFile(path.join(project, 'design.md'), `# Product tutorial design\nUse real local UI captures as the focal evidence, with synthetic-data label. Pretendard matches the application; no second display face. Palette: #eef1f6 background, #1e293b text, #315be8 accent. Each frame has top title, actual UI in a 1000×560 crop displayed at 844×472.64, right step explanation, and bottom chapter progress. Minimum caption size 24px. Deliberate silence; no decorative effects. Still UI screenshots with chapter transitions are intentionally calmer than a marketing film.\n`);
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const ts = seconds => `00:00:${String(seconds).padStart(2, '0')}.000`;
const storyboard = [];
for (const tutorial of VIDEO_TUTORIALS) for (const locale of ['ko', 'en']) {
  const id = `${tutorial.id}-${locale}`, en = locale === 'en';
  const dir = path.join(project, id);
  await mkdir(path.join(dir, 'compositions'), { recursive: true });
  await mkdir(path.join(dir, 'assets'), { recursive: true });
  await copyFile(path.join(project, 'assets/PretendardVariable.woff2'), path.join(dir, 'assets/PretendardVariable.woff2'));
  await copyFile(path.join(project, 'assets/gsap.min.js'), path.join(dir, 'assets/gsap.min.js'));
  const font = 'assets/PretendardVariable.woff2';
  const styles = `@font-face{font-family:Tutorial;src:url('${font}') format('woff2');font-weight:100 900}html,body{margin:0;width:100%;height:100%;background:#eef1f6;color:#1e293b;font-family:Tutorial,sans-serif}*{box-sizing:border-box}#root{width:100%;height:100%;position:relative;overflow:hidden}.slot{position:absolute;inset:0}.scene{width:100%;height:100%;padding:34px 36px;display:flex;flex-direction:column;gap:24px;background:#eef1f6}.top{display:flex;justify-content:space-between;align-items:center;gap:24px}.top h1{font-size:32px;font-weight:750;margin:0;letter-spacing:-.03em}.top span{font-size:18px;color:#475569}.work{display:grid;grid-template-columns:844px minmax(0,1fr);gap:28px;align-items:center;flex:1;min-height:0}.shot{width:844px;height:472.64px;border:1px solid #c6cfdf;border-radius:10px;overflow:hidden;background:#f8fafc;box-shadow:0 10px 24px #13243a14}.shot img{display:block;width:100%;height:100%;object-fit:contain}.text h2{margin:14px 0 22px;font-size:30px;line-height:1.4;letter-spacing:-.035em;word-break:keep-all}.text p{margin:0;font-size:24px;line-height:1.65;word-break:keep-all}.number{font-size:20px;font-weight:700;color:#315be8}.bottom{display:flex;align-items:center;justify-content:space-between;gap:20px;color:#475569;font-size:18px}.progress{height:4px;display:block;background:#315be8;transform-origin:left center;width:100%;position:absolute;bottom:0;left:0}`;
  await writeFile(path.join(dir, 'styles.css'), styles);
  let vtt = 'WEBVTT\n\n';
  for (let i = 0; i < tutorial.steps.length; i++) {
    const step = tutorial.steps[i], text = step[locale], scene = `${id}-step-${i}`;
    // Fail if a step has not actually been captured; no fallback screenshots.
    await copyFile(path.join(project, 'assets', `${step.frame}-${locale}.png`), path.join(dir, 'assets', `${step.frame}-${locale}.png`));
    await writeFile(path.join(dir, 'compositions', `${scene}.html`), `<!doctype html><html><body><template><style>#${scene}{width:100%;height:100%}</style><div id="${scene}" data-composition-id="${scene}" data-width="1280" data-height="720" data-duration="${TUTORIAL_STEP_SECONDS}"><section class="scene"><header class="top"><h1>${escape(tutorial[locale])}</h1><span>GROWTH OPT PLAYBOOK</span></header><div class="work"><div class="shot"><img src="assets/${step.frame}-${locale}.png" alt="${escape(text.title)}"></div><div class="text"><span class="number">${String(i + 1).padStart(2, '0')} / 04</span><h2>${escape(text.title)}</h2><p>${escape(text.body)}</p></div></div><footer class="bottom"><span>${en ? 'Actual app · synthetic demo · account actions simulated locally' : '실제 앱 화면 · 가상 데이터 · 계정 동작은 로컬 시연'}</span><span>${en ? 'Pause to follow along' : '잠시 멈추고 따라 해보세요'}</span></footer></section></div><script>window.__timelines['${scene}']=gsap.timeline({paused:true});</script></template></body></html>`);
    vtt += `${i + 1}\n${ts(i * TUTORIAL_STEP_SECONDS)} --> ${ts((i + 1) * TUTORIAL_STEP_SECONDS)}\n${text.title}\n${text.body}\n\n`;
    storyboard.push(`## Frame ${id}-${i + 1}\nstatus: outline\nsrc: ${id}/compositions/${scene}.html\nRule: stat-bars-and-fills (continuous elapsed chapter progress at parent). Hold actual screen for ${TUTORIAL_STEP_SECONDS}s; hard cut chapters for clear instruction.\n${text.title}: ${text.body}\n`);
  }
  await writeFile(path.join(app, 'public/tutorials', `${id}.vtt`), `${vtt.trimEnd()}\n`);
  await writeFile(path.join(dir, 'index.html'), `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>${escape(tutorial[locale])}</title><link rel="stylesheet" href="styles.css"><script src="assets/gsap.min.js"></script></head><body><div id="root" data-composition-id="${id}" data-width="1280" data-height="720" data-duration="${TUTORIAL_STEP_SECONDS * tutorial.steps.length}">${tutorial.steps.map((step, i) => `<div id="slot-${id}-${i}" class="slot clip" data-composition-id="${id}-step-${i}" data-composition-src="compositions/${id}-step-${i}.html" data-start="${i * TUTORIAL_STEP_SECONDS}" data-duration="${TUTORIAL_STEP_SECONDS}" data-track-index="1" data-width="1280" data-height="720"></div>`).join('')}<div class="progress" id="progress"></div></div><script>const tl=gsap.timeline({paused:true});tl.fromTo('#progress',{scaleX:0},{scaleX:1,duration:${TUTORIAL_STEP_SECONDS * tutorial.steps.length},ease:'none'},0);window.__timelines['${id}']=tl;</script></body></html>`);
}
await writeFile(path.join(project, 'STORYBOARD.md'), storyboard.join('\n'));
console.log(`Built ${VIDEO_TUTORIALS.length * 2} localized compositions`);
