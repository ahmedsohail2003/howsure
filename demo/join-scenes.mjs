// Joins the per-scene clips from `npm run demo:record` into one silent draft video.
// Each scene folder in demo/out holds video.webm; demo/out/<scene>.trim.json says how many
// seconds of off-camera setup to cut from its start. Uses the system ffmpeg and ffprobe.
// Usage: node demo/join-scenes.mjs   (run only when no other ffmpeg or Playwright job runs)
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = 'demo/out'
const SCENES = ['s1', 's2', 's3a', 's3b', 's3c', 's3d', 's3e', 's4', 's5', 's6']

const folders = readdirSync(OUT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
const parts = []
for (const scene of SCENES) {
  const folder = folders.find((f) => f.startsWith(`record-${scene}-`))
  const video = folder && join(OUT, folder, 'video.webm')
  if (!video || !existsSync(video)) {
    console.log(`missing clip for ${scene}; re-run that scene`)
    process.exitCode = 1
    continue
  }
  const trim = JSON.parse(readFileSync(join(OUT, `${scene}.trim.json`), 'utf8')).trimSeconds
  const mp4 = join(OUT, `${scene}.mp4`)
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, trim - 0.2)), '-i', video,
    '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-an', mp4], { stdio: 'inherit' })
  parts.push(mp4)
  const d = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', mp4], { encoding: 'utf8' }).trim()
  console.log(`${scene}: trimmed ${trim.toFixed(1)} s of setup -> ${mp4} (${Number(d).toFixed(1)} s)`)
}
if (process.exitCode) process.exit(process.exitCode)

const list = join(OUT, 'scenes.txt')
writeFileSync(list, parts.map((p) => `file '${p.split(/[\\/]/).pop()}'`).join('\n') + '\n')
const draft = join(OUT, 'draft-silent.mp4')
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', draft], { stdio: 'inherit' })
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', draft], { encoding: 'utf8' }).trim()
const size = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'csv=p=0', draft], { encoding: 'utf8' }).trim()
console.log(`draft: ${draft}  duration ${Number(dur).toFixed(1)} s  stream ${size}`)
