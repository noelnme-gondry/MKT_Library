import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
const project = process.env.TUTORIAL_PROJECT_DIR || '/tmp/gop-tutorial-videos';
const output = path.resolve('v2-migration/public/tutorials');
const manifest = JSON.parse(await readFile(path.join(project, 'manifest.json'), 'utf8'));
if (!manifest.length) throw new Error('No tutorial compositions to render');
const run = (cmd, args, cwd = project) => new Promise((resolve, reject) => {
  const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; child.stdout.on('data', data => log += data); child.stderr.on('data', data => log += data);
  child.on('error', reject); child.on('close', code => code === 0 ? resolve(log) : reject(new Error(`${cmd} exited ${code}\n${log}`)));
});
const checks = [];
for (const { id, duration, checks: timestamps } of manifest) {
  const dir = path.join(project, id);
  const raw = await run('npx', ['--yes', 'hyperframes@0.8.36', 'check', dir, '--at', timestamps.join(','), '--json']);
  await writeFile(path.join(dir, 'check.json'), raw);
  const check = JSON.parse(raw.slice(raw.indexOf('{')));
  if (!check.ok) throw new Error(`Video check failed: ${id}\n${raw}`);
  checks.push({ id, ok: check.ok, lint: check.lint, contrast: check.contrast });
  console.log(`CHECK ${id}`);
  const rendered = await run('npx', ['--yes', 'hyperframes@0.8.36', 'render', dir, '--fps', '24', '--quality', 'high', '--output', path.join(output, `${id}.mp4`)]);
  await writeFile(path.join(dir, 'render.log'), rendered);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(timestamps[1]), '-i', path.join(output, `${id}.mp4`), '-frames:v', '1', '-q:v', '3', path.join(output, `${id}.jpg`)]);
  const probe = JSON.parse(await run('ffprobe', ['-v', 'quiet', '-show_streams', '-show_format', '-of', 'json', path.join(output, `${id}.mp4`)]));
  const stream = probe.streams.find(item => item.codec_type === 'video');
  if (stream?.width !== 1280 || stream?.height !== 720 || Math.abs(Number(probe.format.duration) - duration) > 0.1) throw new Error(`Invalid video ${id}`);
  console.log(`RENDER ${id} ${probe.format.duration}s ${probe.format.size} bytes`);
}
await writeFile(path.join(project, 'verification.json'), JSON.stringify(checks, null, 2));
