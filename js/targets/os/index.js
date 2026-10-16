// OS generator (bootloader only): a 16-bit x86 boot sector (NASM) that prints text and halts, plus a Makefile for NASM + QEMU
// and an optional script that builds a Linux kernel. Deliberately tiny: only "print text", "wait" and "stop" (see docs/GENERATOR_SDK.md).
import './../rust/blocks.js';
import '../../sdk/common-ir.js';
import { defineGenerator, buildSemanticModel } from '../../sdk/index.js';
import { J } from '../../i18n-helpers.js';
import { cm, noteFor } from '../../comments.js';
import { projectFile } from '../../sdk/emit.js';
import { emptyProject, newScript, newBlock } from '../../model.js';

/** text of a string-only expression (literals and joins of literals) or null */
const literal = (e) => (e.k === 'str' ? e.v : e.k === 'num' ? String(e.v) : e.k === 'call' && e.fn === 'concat' && e.args.every((a) => literal(a) !== null) ? e.args.map(literal).join('') : null);
const asmBytes = (s) => [...new TextEncoder().encode(s)].map((b) => b);
const db = (s) => {
  // printable ASCII in quotes, everything else as numbers (the BIOS font is CP437: only ASCII is safe)
  const parts = []; let cur = '';
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (code >= 32 && code < 127 && ch !== "'") cur += ch;
    else { if (cur) { parts.push(`'${cur}'`); cur = ''; } parts.push(code < 128 ? String(code) : '63'); }
  }
  if (cur) parts.push(`'${cur}'`);
  return parts.join(', ');
};

function generate(project) {
  const t = cm(project), problems = [], ir = buildSemanticModel(project, 'os-bootloader');
  problems.push(...ir.problems.filter((p) => !p.unsupported));
  const code = [], data = [];
  let n = 0;
  const walk = (list) => {
    for (const s of list) {
      if (s.op === 'comment') code.push(`    ; ${s.text}`);
      else if (s.op === 'cli.print' || s.op === 'log') {
        const text = literal(s.value);
        if (text === null) { problems.push({ msg: 'ブートローダーで表示できるのは文字列(と数値)の固定テキストだけです。変数は使えません' }); continue; }
        if (/[^\x00-\x7f]/.test(text)) problems.push({ msg: `「${text.slice(0, 20)}」: BIOS の文字は ASCII のみです(日本語などは「?」で表示されます)`, level: 'info' });
        const label = `msg${++n}`;
        data.push(`${label}: db ${db(text)}${s.newline === false ? '' : ', 13, 10'}, 0`);
        code.push(`    mov si, ${label}`, '    call print_string');
      } else if (s.op === 'wait') {
        const ms = s.ms.k === 'num' ? Math.max(0, Math.round(s.ms.v)) : null;
        if (ms === null) { problems.push({ msg: '待つ時間は数値で指定してください' }); continue; }
        const us = ms * 1000;
        code.push(`    mov cx, ${(us >>> 16) & 0xffff}`, `    mov dx, ${us & 0xffff}`, '    mov ah, 0x86           ; BIOS wait (microseconds in CX:DX)', '    int 0x15');
      } else if (s.op === 'cli.exit') code.push('    jmp hang');
      else if (s.op === 'if' || s.op === 'repeat' || s.op === 'set' || s.op === 'call') problems.push({ msg: `ブートローダーは「${s.op}」に未対応です(表示・待つ・コメント・停止のみ)` });
      else problems.push({ msg: `unsupported: ${s.op}` });
    }
  };
  for (const h of ir.handlers) if (h.kind === 'main') walk(h.body);
  if (ir.functions.length) problems.push({ msg: 'ブートローダーは関数に未対応です' });
  const asm = `; ${project.name} — ${noteFor(project, 'x86 boot sector (NASM)')}
; ${t('ビルド: nasm -f bin boot.asm -o boot.img   実行: qemu-system-x86_64 -drive format=raw,file=boot.img', 'Build: nasm -f bin boot.asm -o boot.img   Run: qemu-system-x86_64 -drive format=raw,file=boot.img')}
bits 16
org 0x7C00

start:
    cli
    xor ax, ax
    mov ds, ax
    mov es, ax
    mov ss, ax
    mov sp, 0x7C00
    sti
    mov ax, 0x0003          ; ${t('テキストモード 80x25 に設定(画面クリア)', 'text mode 80x25 (clears the screen)')}
    int 0x10

${code.join('\n') || '    ; (' + t('ブロックがありません', 'no blocks') + ')'}

hang:
    cli
    hlt
    jmp hang

; ${t('SI の指す 0 終端文字列を BIOS で表示する', 'Prints the 0-terminated string at SI with the BIOS')}
print_string:
    lodsb
    or al, al
    jz .done
    mov ah, 0x0E
    int 0x10
    jmp print_string
.done:
    ret

${data.join('\n')}

times 510 - ($ - $$) db 0   ; ${t('512 バイトのブートセクタにする', 'pad to a 512-byte boot sector')}
dw 0xAA55                    ; ${t('ブートシグネチャ', 'boot signature')}
`;
  const files = {
    'boot.asm': asm,
    'Makefile': `# ${t('ブートローダーのビルドと QEMU での実行', 'Build the boot sector and run it in QEMU')}\nboot.img: boot.asm\n\tnasm -f bin boot.asm -o boot.img\n\nrun: boot.img\n\tqemu-system-x86_64 -drive format=raw,file=boot.img\n\nclean:\n\trm -f boot.img\n\n.PHONY: run clean\n`,
    'build-linux-kernel.sh': `#!/bin/sh
# ${t('(任意)Linux カーネルをビルドする補助スクリプト。ブートローダーとは独立しています。', '(Optional) helper that builds a Linux kernel. Independent of the boot sector.')}
# ${t('必要: gcc make flex bison libelf-dev libssl-dev bc', 'Needs: gcc make flex bison libelf-dev libssl-dev bc')}
set -e
VERSION="\${KERNEL_VERSION:-6.6.30}"
MAJOR="\${VERSION%%.*}"
[ -f "linux-$VERSION.tar.xz" ] || curl -LO "https://cdn.kernel.org/pub/linux/kernel/v$MAJOR.x/linux-$VERSION.tar.xz"
[ -d "linux-$VERSION" ] || tar xf "linux-$VERSION.tar.xz"
cd "linux-$VERSION"
make defconfig
make -j"$(nproc)"
echo "kernel image: linux-$VERSION/arch/x86/boot/bzImage"
echo "try: qemu-system-x86_64 -kernel linux-$VERSION/arch/x86/boot/bzImage -append 'console=ttyS0' -nographic"
`,
    'README.md': `# ${project.name}\n\n${t('x86 のブートセクタ(16 ビット・NASM)です。BIOS で文字を表示して停止します。', 'An x86 boot sector (16-bit, NASM) that prints text with the BIOS and halts.')}\n\n\`\`\`sh\nmake run     # nasm + qemu-system-x86_64\n\`\`\`\n\n${t('使えるブロック: 「画面に出力」(固定テキスト)・「待つ」・コメント・「プログラムを終了」。Linux カーネルが必要なら build-linux-kernel.sh を使います。', 'Supported blocks: Print (fixed text), Wait, comments, Exit program. Use build-linux-kernel.sh if you need a Linux kernel.')}\n\n${t('これは学習用の最小構成です(OS 本体ではありません)。', 'This is a minimal teaching setup (not a full OS).')}\n`,
    '.gitignore': 'boot.img\nlinux-*\n',
    'codiram.project.json': projectFile(project),
  };
  void asmBytes;
  return { files, problems, root: 'bootloader', entry: 'boot.asm' };
}

defineGenerator({
  id: 'os-bootloader', order: 7, portable: true,
  name: J('OS ブートローダー (x86)', 'OS bootloader (x86)'), icon: '💾',
  desc: J('NASM の 512 バイトブートセクタ(+ Makefile / QEMU / Linux カーネルのビルドスクリプト)', 'NASM 512-byte boot sector (+ Makefile / QEMU / Linux kernel build script)'),
  version: '0.1.0', language: ['asm'], platforms: ['x86', 'qemu'], supports: ['io', 'entry', 'cli'], views: ['logic', 'output'],
  defaultConfig: () => ({ type: 'os-bootloader' }), generate,
  sample() { const p = emptyProject('Boot sample'); const s = newScript(p, 'main', 'cli_main', {}); s.body.push(newBlock('cli_print', { value: '"Hello"', nl: '1' })); p.scripts.push(s); return p; },
  verify: { requiredFiles: ['boot.asm', 'Makefile', 'build-linux-kernel.sh', 'README.md'], contains: { 'boot.asm': ['0xAA55', 'org 0x7C00'] }, build: { tool: 'nasm', args: ['-f', 'bin', 'boot.asm', '-o', 'boot.img'] } },
});
