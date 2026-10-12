#!/usr/bin/env node
// svg-diagram icons <add|remove|list|search|notice> — the project's own icon set (svg-diagram.icons.json). svg-diagram ships no icons.
//   icons add <set:icon[=name] | file.svg[=name]>... [--allow-license SPDX] [--color]   install (e.g. mdi:key-variant=key, ./logo.svg)
//   icons remove <name>...
//   icons list
//   icons search <word> [--set mdi] [--limit N]                              find Iconify ids to add
//   icons notice                                                             credits of the installed icons, as Markdown
import {addIcons, manifestPath, noticeText, readManifest, removeIcons, searchIcons} from './lib/icon-install.ts';

const [sub, ...rest] = process.argv.slice(2);
const BOOLEAN = new Set(['color']);
const flags = new Map<string, string>();
const args: string[] = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) flags.set(rest[i].slice(2), BOOLEAN.has(rest[i].slice(2)) ? '1' : rest[++i] ?? '');
  else args.push(rest[i]);
}
const usage = () => { console.error(['usage: svg-diagram icons add <set:icon[=name] | file.svg[=name]>... [--allow-license SPDX] [--color]', '       svg-diagram icons remove <name>...', '       svg-diagram icons list', '       svg-diagram icons search <word> [--set mdi] [--limit N]', '       svg-diagram icons notice'].join('\n')); process.exit(2); };

try {
  switch (sub) {
    case 'add': {
      if (!args.length) usage();
      const r = await addIcons(args, {allowLicense: flags.get('allow-license')?.split(',').filter(Boolean), color: flags.has('color')});
      if (r.added.length) console.log(`✓ 追加: ${r.added.join(', ')}`);
      if (r.replaced.length) console.log(`✓ 置き換え: ${r.replaced.join(', ')}`);
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
      const names = Object.keys(m.icons);
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
    case 'notice': process.stdout.write(noticeText(readManifest(manifestPath()))); break;
    default: usage();
  }
} catch (e) {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
}
