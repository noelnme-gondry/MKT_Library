import { readdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
const project = process.env.TUTORIAL_PROJECT_DIR || '/tmp/gop-tutorial-videos';
const output = path.resolve('v2-migration/public/tutorials');
const dirs = (await readdir(project)).filter(name => /-(ko|en)$/.test(name));
const run = (cmd, args, cwd = project) => new Promise((resolve, reject) => {
  const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; child.stdout.on('data', data => log += data); child.stderr.on('data', data => log += data);
  child.on('error', reject); child.on('close', code => code === 0 ? resolve(log) : reject(new Error(`${cmd} exited ${code}\n${log}`)));
});
const checks = [];
for (const id of dirs) {
  const dir = path.join(project, id);
  const raw = await run('npx', ['--yes', 'hyperframes@0.8.30', 'check', dir, '--at', '4.5,13.5,22.5,31.5', '--json']);
  await writeFile(path.join(dir, 'check.json'), raw);
  const check = JSON.parse(raw.slice(raw.indexOf('{')));
  if (!check.ok) throw new Error(`Video check failed: ${id}\n${raw}`);
  checks.push({ id, ok: check.ok, lint: check.lint, contrast: check.contrast });
  console.log(`CHECK ${id}`);
  const rendered = await run('npx', ['--yes', 'hyperframes@0.8.30', 'render', dir, '--fps', '24', '--quality', 'high', '--output', path.join(output, `${id}.mp4`)]);
  await writeFile(path.join(dir, 'render.log'), rendered);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '4.5', '-i', path.join(output, `${id}.mp4`), '-frames:v', '1', '-q:v', '3', path.join(output, `${id}.jpg`)]);
  const probe = JSON.parse(await run('ffprobe', ['-v', 'quiet', '-show_streams', '-show_format', '-of', 'json', path.join(output, `${id}.mp4`)]));
  const stream = probe.streams.find(item => item.codec_type === 'video');
  if (stream?.width !== 1280 || stream?.height !== 720 || Math.abs(Number(probe.format.duration) - 36) > 0.1) throw new Error(`Invalid video ${id}`);
  console.log(`RENDER ${id} ${probe.format.duration}s ${probe.format.size} bytes`);
}
await writeFile(path.join(project, 'verification.json'), JSON.stringify(checks, null, 2));
