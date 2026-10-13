#!/usr/bin/env node
// svg-diagram icons <add|remove|list|search|notice> — the project's own icon set (svg-diagram.icons.json). svg-diagram ships no icons.
//   icons add <set:icon[=name] | file.svg[=name]>... [--allow-license SPDX] [--color] [--skip-missing]   install (e.g. mdi:key-variant=key, ./logo.svg)
//   icons sets / icons add-set <name>                                        recommended use-case sets (accounting, office, infra), all mdi
//   icons remove <name>...
//   icons list
//   icons search <word> [--set mdi] [--limit N]                              find Iconify ids to add
//   icons find <word>... [--style fill|line|color] [--set mdi,lucide] [--limit N] [--color] [--png sheet.png]
//                                                                            candidates for a wanted icon (English words), main set first
//   icons main [set]                                                         the set icons mainly come from (no argument: show it; `-`: clear)
//   icons add-pack <dir|vendor.zip> --prefix aws --terms <url> --accept-terms [--match REGEX] [--exclude REGEX] [--all] [--list]
//                                                                            a vendor's own icon set (AWS / Azure / ...), under its terms
//   icons notice                                                             credits of the installed icons, as Markdown
import {addIcons, addSet, manifestPath, noticeText, readManifest, removeIcons, searchIcons, setMainSet} from './lib/icon-install.ts';
import {ICON_SETS} from './lib/icon-sets.ts';
import {addPack} from './lib/icon-pack.ts';
import {findIcons} from './lib/icon-find.ts';
import type {Candidate} from './lib/icon-find.ts';

const [sub, ...rest] = process.argv.slice(2);
const BOOLEAN = new Set(['color', 'accept-terms', 'all', 'list', 'skip-missing']);
const flags = new Map<string, string>();
const args: string[] = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) flags.set(rest[i].slice(2), BOOLEAN.has(rest[i].slice(2)) ? '1' : rest[++i] ?? '');
  else args.push(rest[i]);
}
const usage = () => { console.error(['usage: svg-diagram icons add <set:icon[=name] | file.svg[=name]>... [--allow-license SPDX] [--color] [--skip-missing]', '       svg-diagram icons sets                      (list the recommended sets)', '       svg-diagram icons add-set <accounting|office|infra> [--allow-license SPDX] [--color]', '       svg-diagram icons remove <name>...', '       svg-diagram icons list [regex]', '       svg-diagram icons search <word> [--set mdi] [--limit N]', '       svg-diagram icons find <word>... [--style fill|line|color] [--set mdi,lucide] [--limit N] [--color] [--png sheet.png]', '       svg-diagram icons main [set|-]', '       svg-diagram icons add-pack <dir|vendor.zip> --prefix aws --terms <url> --accept-terms [--match REGEX] [--exclude REGEX] [--all] [--list]', '       svg-diagram icons notice'].join('\n')); process.exit(2); };

try {
  switch (sub) {
    case 'add': {
      if (!args.length) usage();
      const r = await addIcons(args, {allowLicense: flags.get('allow-license')?.split(',').filter(Boolean), color: flags.has('color'), skipMissing: flags.has('skip-missing')});
      if (r.added.length) console.log(`✓ 追加: ${r.added.join(', ')}`);
      if (r.replaced.length) console.log(`✓ 置き換え: ${r.replaced.join(', ')}`);
      if (r.skipped.length) console.log(`・セットに無いので飛ばした: ${r.skipped.join(', ')}`);
      for (const w of r.warnings) console.log(`⚠ ${w}`);
      console.log(`→ ${r.file}（図のソースでは box({icon: '<名前>'})。このファイルをコミットする）`);
      break;
    }
    case 'sets': {
      for (const [n, s] of Object.entries(ICON_SETS)) console.log(`${n.padEnd(12)} ${String(Object.keys(s.icons).length).padStart(3)} 個  ${s.description}\n${' '.repeat(17)}${Object.keys(s.icons).join(' ')}`);
      console.log('\n→ svg-diagram icons add-set <名前>');
      break;
    }
    case 'add-set': {
      if (args.length !== 1) usage();
      const r = await addSet(args[0], {allowLicense: flags.get('allow-license')?.split(',').filter(Boolean), color: flags.has('color')});
      if (r.added.length) console.log(`✓ 追加 ${r.added.length} 個: ${r.added.join(', ')}`);
      if (r.kept.length) console.log(`・入っている名前はそのまま（上書きしない）: ${r.kept.join(', ')}`);
      for (const w of r.warnings) console.log(`⚠ ${w}`);
      console.log(`→ ${r.file}（図のソースでは box({icon: '<名前>'})。このファイルをコミットする）`);
      break;
    }
    case 'remove': {
      if (!args.length) usage();
      const r = removeIcons(args);
      console.log(`✓ 削除: ${r.removed.join(', ')}  (${r.file})`);
      break;
    }
    case 'list': {
      const file = manifestPath();
      const m = readManifest(file);
      const names = Object.keys(m.icons).filter(n => !args[0] || new RegExp(args[0], 'i').test(n));
      if (!names.length) console.log(`インストール済みのアイコンは無い（${file}）。svg-diagram icons add mdi:key-variant=key`);
      for (const n of names) console.log(`${n.padEnd(20)} ${m.icons[n].from.padEnd(34)} ${m.icons[n].license}${m.icons[n].fixed ? '  【固定色】' : ''}`);
      break;
    }
    case 'search': {
      if (!args.length) usage();
      const found = await searchIcons(args.join(' '), {set: flags.get('set'), limit: flags.has('limit') ? Number(flags.get('limit')) : undefined});
      console.log(found.length ? found.join('\n') : '見つからない');
      break;
    }
    case 'add-pack': {
      if (args.length !== 1 || !flags.get('prefix')) usage();
      const r = addPack(args[0], {prefix: flags.get('prefix')!, terms: flags.get('terms'), acceptTerms: flags.has('accept-terms'), all: flags.has('all'), list: flags.has('list'), match: flags.get('match') ? new RegExp(flags.get('match')!, 'i') : undefined, exclude: flags.get('exclude') ? new RegExp(flags.get('exclude')!, 'i') : undefined});
      if (r.listed) console.log(r.added.join('\n'));
      else {
        console.log(`✓ ${flags.get('prefix')}: ${r.added.length} 個を追加${r.replaced.length ? `、${r.replaced.length} 個を置き換え` : ''}`);
        console.log(`→ ${r.file}（規約の場所と同意の日付を packs に記録した。使うときは box({icon: '<名前>'}) / node({icon})。名前は icons list ${flags.get('prefix')}）`);
      }
      for (const [why, fs] of Object.entries(r.skipped)) console.log(`  取り込めない ${fs.length} 個: ${why}${fs.length <= 3 ? ` (${fs.join(', ')})` : ''}`);
      if (r.collisions.length) console.log(`  同じ名前のファイル（サイズ違いなど）: ${r.collisions.length} 組 — 48px を優先した`);
      break;
    }
    case 'main': {
      if (!args.length) { const m = readManifest(manifestPath()); console.log(m.mainSet ? `主セット: ${m.mainSet}` : '主セットは未設定（最初に icons add した Iconify のセットが主セットになる）'); break; }
      const r = setMainSet(args[0] === '-' ? undefined : args[0]);
      console.log(r.mainSet ? `✓ 主セット: ${r.mainSet}  (${r.file})` : `✓ 主セットを解除  (${r.file})`);
      break;
    }
    case 'find': {
      if (!args.length) usage();
      const style = flags.get('style');
      if (style && !['fill', 'line', 'color', 'any'].includes(style)) throw new Error('--style is fill, line or color');
      const m = readManifest(manifestPath());
      const found = await findIcons(args, {
        sets: flags.get('set')?.split(',').filter(Boolean), style: style as 'fill' | 'line' | 'color' | undefined, mainSet: m.mainSet,
        limit: flags.has('limit') ? Number(flags.get('limit')) : undefined, color: flags.has('color'), allowLicense: flags.get('allow-license')?.split(',').filter(Boolean),
      });
      console.log(m.mainSet ? `主セット: ${m.mainSet}（先に出す。見た目が揃う）` : '主セット: 未設定（最初に入れたセットが主セットになる）');
      for (const f of found) {
        console.log(`\n${f.word}:`);
        if (!f.candidates.length) console.log('  （候補なし。別の英単語で探すか、--style / --set / --allow-license を見直す）');
        for (const c of f.candidates) console.log(`  ${c.id.padEnd(40)} ${c.style.padEnd(6)} ${c.license}${c.mainSet ? '  ★主セット' : ''}\n    → svg-diagram icons add ${c.add}`);
        if (f.skipped.length) console.log(`  ライセンスのため除外: ${f.skipped.join(', ')}（使うなら --allow-license <SPDX>）`);
      }
      const flat = found.flatMap(f => f.candidates.map(c => ({word: f.word, c})));
      const png = flags.get('png');
      if (png && flat.length) { await writeSheet(flat, png); console.log(`\n候補の一覧を ${png} に書いた（目で選ぶ）`); }
      break;
    }
    case 'notice': process.stdout.write(noticeText(readManifest(manifestPath()))); break;
    default: usage();
  }
} catch (e) {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
}

// The candidates on one picture: each icon in a box labelled with its id, drawn the way box({icon}) will draw it.
async function writeSheet(flat: {word: string; c: Candidate}[], file: string): Promise<void> {
  const fs = await import('node:fs');
  const {diagram, icon, iconRow, closeMeasurer, renderDiagram} = await import('./lib/dsl.ts');
  const {rasterize} = await import('./lib/raster.ts');
  const names = flat.map((_, i) => `c${i}`);
  icon.use({version: 1, icons: Object.fromEntries(flat.map(({c}, i) => [names[i], {...c.glyph, from: c.id, license: c.license}]))});
  try {
    const rows = [];
    for (let i = 0; i < flat.length; i += 3) rows.push(iconRow(flat.slice(i, i + 3).map(({word, c}, k) => ({icon: names[i + k], label: c.id, body: `${word} · ${c.style} · ${c.license}`, tone: c.mainSet ? 'accent' as const : undefined}))));
    const {svg} = await renderDiagram(diagram({theme: 'blue', title: '候補（accent の枠は主セット）'}).add(...rows), {name: 'find.svg', budget: 'measure'});
    fs.writeFileSync(file, (await rasterize(svg, {png: true})).png!);
  } finally { icon.use(undefined); await closeMeasurer(); }
}
