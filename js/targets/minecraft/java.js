// IR -> Java (Fabric, Minecraft 1.19.2, yarn mappings). Output is plain, readable Java.
import { irType } from '../../ir.js';

const KEYWORDS = new Set('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null var record'.split(' '));

/** Java-safe identifier (keeps readable ASCII names, escapes everything else) */
export function javaIdent(name, prefix = 'v_') {
  let s = String(name ?? '').replace(/[^A-Za-z0-9_]/g, (ch) => '_u' + ch.codePointAt(0).toString(16));
  if (!s || /^\d/.test(s)) s = prefix + s;
  if (KEYWORDS.has(s)) s = prefix + s;
  return s;
}
export const pascal = (s) => String(s).split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('') || 'Mod';
const jstr = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
const jnum = (v) => { const s = String(v); return /^-?\d+$/.test(s) ? s + '.0' : s; };

export function generateJava(ir, cfg) {
  const problems = [];
  const pkg = cfg.package;
  const fnNames = new Map(ir.functions.map((f) => [f.fnName, { id: 'fn_' + javaIdent(f.fnName, 'f_'), params: f.params }]));
  let counter = 0;

  // ------------------------------------------------------------ expressions
  const asNum = (e) => (irType(e) === 'num' ? jx(e) : `Cx.num(${jx(e)})`);
  const asStr = (e) => (irType(e) === 'str' ? jx(e) : `Cx.str(${jx(e)})`);
  const asBool = (e) => (irType(e) === 'bool' ? jx(e) : `Cx.bool(${jx(e)})`);
  const coerce = (e, type) => (type === 'Number' ? asNum(e) : type === 'String' ? asStr(e) : asBool(e));

  function jx(e) {
    switch (e.k) {
      case 'num': return jnum(e.v);
      case 'str': return jstr(e.v);
      case 'bool': return String(e.v);
      case 'var': return e.scope === 'local' ? javaIdent(e.name, 'p_') : 'Vars.' + javaIdent(e.name);
      case 'un': return e.op === '!' ? `!${asBool(e.a)}` : `(-${asNum(e.a)})`;
      case 'bin': {
        const { op } = e, ta = irType(e.a), tb = irType(e.b);
        if (op === '&&' || op === '||') return `(${asBool(e.a)} ${op} ${asBool(e.b)})`;
        if (op === '==' || op === '!=') {
          let r;
          if (ta === 'num' && tb === 'num') r = `(${jx(e.a)} == ${jx(e.b)})`;
          else if (ta === 'bool' && tb === 'bool') r = `(${jx(e.a)} == ${jx(e.b)})`;
          else if (ta === 'str' && tb === 'str') r = `${jx(e.a)}.equals(${jx(e.b)})`;
          else r = `Cx.eq(${jx(e.a)}, ${jx(e.b)})`;
          return op === '!=' ? `!${r}` : r;
        }
        if (op === '+') {
          if (ta === 'str' || tb === 'str') return `(${asStr(e.a)} + ${asStr(e.b)})`;
          if (ta === 'num' && tb === 'num') return `(${jx(e.a)} + ${jx(e.b)})`;
          return `Cx.add(${jx(e.a)}, ${jx(e.b)})`;
        }
        return `(${asNum(e.a)} ${op} ${asNum(e.b)})`;
      }
      case 'call': {
        const a = e.args || [];
        switch (e.fn) {
          case 'concat': return '(' + a.map(asStr).join(' + ') + ')';
          case 'contains': return `${asStr(a[0])}.contains(${asStr(a[1])})`;
          case 'isEmpty': return `${asStr(a[0])}.isEmpty()`;
          case 'bool': return asBool(a[0]);
          case 'num': return asNum(a[0]);
          case 'pow': return `Math.pow(${asNum(a[0])}, ${asNum(a[1])})`;
          case 'random': return `Cx.random(${asNum(a[0])}, ${asNum(a[1])})`;
          case 'ternary': return `(${asBool(a[0])} ? (Object) ${jx(a[1])} : (Object) ${jx(a[2])})`;
          default: problems.push({ msg: `unknown IR call: ${e.fn}` }); return 'null';
        }
      }
      case 'mc': {
        switch (e.fn) {
          case 'playerName': return 'player.getName().getString()';
          case 'player_x': return 'player.getX()';
          case 'player_y': return 'player.getY()';
          case 'player_z': return 'player.getZ()';
          case 'heldItem': return 'Registry.ITEM.getId(player.getMainHandStack().getItem()).toString()';
          case 'blockId': return 'Registry.BLOCK.getId(blockState.getBlock()).toString()';
          case 'block_x': return '((double) blockPos.getX())';
          case 'block_y': return '((double) blockPos.getY())';
          case 'block_z': return '((double) blockPos.getZ())';
          case 'hasItem': return `(player.getInventory().count(Cx.item(${jstr(e.item)})) >= ${intOf(e.count)})`;
          case 'sneaking': return 'player.isSneaking()';
          default: problems.push({ msg: `unknown Minecraft value: ${e.fn}` }); return 'null';
        }
      }
      default: return 'null';
    }
  }
  const intOf = (e) => `(int) ${irType(e) === 'num' ? `(${jx(e)})` : `Cx.num(${jx(e)})`}`;

  // ------------------------------------------------------------ statements
  const pad = (n) => '    '.repeat(n);
  function stmts(list, depth) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (s.op === 'wait') {
        // everything after a "wait" runs later, on a server tick
        out.push(pad(depth) + `Cx.later(server, Cx.ticks(${asNum(s.ms)}), () -> {`);
        out.push(...stmts(list.slice(i + 1), depth + 1));
        out.push(pad(depth) + '});');
        return out;
      }
      out.push(...stmt(s, depth));
    }
    return out;
  }
  function stmt(s, d) {
    const p = pad(d);
    switch (s.op) {
      case 'comment': return [p + '// ' + String(s.text).replace(/[\r\n]+/g, ' ')];
      case 'log': return [p + `Cx.LOGGER.info(${asStr(s.value)});`];
      case 'set': return [p + `${jx(s.var)} = ${coerce(s.value, s.var.type)};`];
      case 'if': {
        const out = [p + `if (${asBool(s.cond)}) {`, ...stmts(s.then, d + 1)];
        if (s.else.length) out.push(p + '} else {', ...stmts(s.else, d + 1));
        out.push(p + '}');
        return out;
      }
      case 'repeat': { const v = '_i' + ++counter; return [p + `for (int ${v} = 0; ${v} < ${intOf(s.count)}; ${v}++) {`, ...stmts(s.body, d + 1), p + '}']; }
      case 'call': {
        const f = fnNames.get(s.fn);
        if (!f) { problems.push({ script: null, block: s.block, msg: `関数「${s.fn}」が定義されていません` }); return [p + `// (undefined function: ${s.fn})`]; }
        if (s.args.length !== f.params.length) problems.push({ block: s.block, msg: `関数「${s.fn}」の引数は ${f.params.length} 個です(${s.args.length} 個指定)` });
        const args = f.params.map((_, i) => (s.args[i] ? jx(s.args[i]) : 'null'));
        return [p + `${f.id}(${['player', ...args].join(', ')});`];
      }
      case 'mc.send_message': {
        const t = `Text.literal(${asStr(s.text)})`;
        return [p + (s.to === 'all' ? `server.getPlayerManager().broadcast(${t}, false);` : `player.sendMessage(${t}, false);`)];
      }
      case 'mc.give_item': return [p + `player.getInventory().offerOrDrop(new ItemStack(Cx.item(${jstr(s.item)}), ${intOf(s.count)}));`];
      case 'mc.remove_item': return [p + `{`, p + `    Item _item = Cx.item(${jstr(s.item)});`, p + `    Inventories.remove(player.getInventory(), stack -> stack.isOf(_item), ${intOf(s.count)}, false);`, p + '}'];
      case 'mc.set_block': {
        const base = s.mode === 'absolute' ? ['0', '0', '0'] : s.mode === 'event' ? ['blockPos.getX()', 'blockPos.getY()', 'blockPos.getZ()'] : ['player.getBlockPos().getX()', 'player.getBlockPos().getY()', 'player.getBlockPos().getZ()'];
        const c3 = [s.x, s.y, s.z].map((e, i) => (s.mode === 'absolute' ? intOf(e) : `${base[i]} + ${intOf(e)}`));
        return [p + `player.world.setBlockState(new BlockPos(${c3.join(', ')}), Cx.block(${jstr(s.block)}).getDefaultState());`];
      }
      case 'mc.teleport': {
        const c3 = [s.x, s.y, s.z].map((e, i) => (s.mode === 'absolute' ? asNum(e) : `player.get${'XYZ'[i]}() + ${asNum(e)}`));
        return [p + `player.teleport(${c3.join(', ')});`];
      }
      case 'mc.play_sound': return [p + '{', p + `    SoundEvent _sound = Cx.sound(${jstr(s.sound)});`,
        p + `    if (_sound != null) player.world.playSound(null, player.getBlockPos(), _sound, SoundCategory.PLAYERS, (float) ${asNum(s.volume)}, (float) ${asNum(s.pitch)});`, p + '}'];
      default: problems.push({ msg: `unsupported IR statement: ${s.op}` }); return [p + `// unsupported: ${s.op}`];
    }
  }

  // ------------------------------------------------------------ handlers
  const prologue = (d) => [pad(d) + 'MinecraftServer server = player.getServer();'];
  const blockCtx = (d, posExpr, stateExpr) => [pad(d) + `BlockPos blockPos = ${posExpr};`, pad(d) + `BlockState blockState = ${stateExpr};`];
  const GUARD = 'if (world.isClient() || hand != Hand.MAIN_HAND || !(p instanceof ServerPlayerEntity player))';
  function handler(h) {
    const body = (d) => stmts(h.body, d);
    switch (h.event) {
      case 'player_join': return ['        ServerPlayConnectionEvents.JOIN.register((handler, sender, srv) -> {', '            ServerPlayerEntity player = handler.getPlayer();', '            MinecraftServer server = srv;', ...body(3), '        });'];
      case 'right_click_block': return ['        UseBlockCallback.EVENT.register((p, world, hand, hit) -> {', `            ${GUARD} return ActionResult.PASS;`, ...prologue(3), ...blockCtx(3, 'hit.getBlockPos()', 'world.getBlockState(blockPos)'), ...body(3), '            return ActionResult.PASS;', '        });'];
      case 'block_place': return ['        UseBlockCallback.EVENT.register((p, world, hand, hit) -> {', `            ${GUARD} return ActionResult.PASS;`, '            if (!(player.getStackInHand(hand).getItem() instanceof BlockItem blockItem)) return ActionResult.PASS;', ...prologue(3), ...blockCtx(3, 'hit.getBlockPos().offset(hit.getSide())', 'blockItem.getBlock().getDefaultState()'), ...body(3), '            return ActionResult.PASS;', '        });'];
      case 'item_use': return ['        UseItemCallback.EVENT.register((p, world, hand) -> {', `            ${GUARD} return TypedActionResult.pass(p.getStackInHand(hand));`, ...prologue(3), ...body(3), '            return TypedActionResult.pass(player.getStackInHand(hand));', '        });'];
      case 'block_break': return ['        PlayerBlockBreakEvents.AFTER.register((world, p, pos, state, blockEntity) -> {', '            if (!(p instanceof ServerPlayerEntity player)) return;', ...prologue(3), ...blockCtx(3, 'pos', 'state'), ...body(3), '        });'];
      default: problems.push({ script: h.script, msg: `unknown event: ${h.event}` }); return [];
    }
  }
  const fn = (f) => {
    const id = fnNames.get(f.fnName).id;
    const params = ['ServerPlayerEntity player', ...f.params.map((x) => 'Object ' + javaIdent(x, 'p_'))];
    return ['', `    // ƒ ${f.fnName}`, `    private static void ${id}(${params.join(', ')}) {`, ...prologue(2), ...stmts(f.body, 2), '    }'];
  };
  // generate handlers/functions first (fills `problems`)
  const handlerLines = ir.handlers.flatMap((h) => ['', `        // ▶ ${h.name || h.event}`, ...handler(h)]);
  const fnLines = ir.functions.flatMap(fn);

  const imports = [
    'net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents', 'net.fabricmc.fabric.api.event.player.UseBlockCallback', 'net.fabricmc.fabric.api.event.player.UseItemCallback',
    'net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents', 'net.minecraft.block.BlockState', 'net.minecraft.inventory.Inventories', 'net.minecraft.item.BlockItem',
    'net.minecraft.item.Item', 'net.minecraft.item.ItemStack', 'net.minecraft.server.MinecraftServer', 'net.minecraft.server.network.ServerPlayerEntity', 'net.minecraft.sound.SoundCategory',
    'net.minecraft.sound.SoundEvent', 'net.minecraft.text.Text', 'net.minecraft.util.ActionResult', 'net.minecraft.util.Hand', 'net.minecraft.util.TypedActionResult',
    'net.minecraft.util.math.BlockPos', 'net.minecraft.util.registry.Registry',
  ];
  const handlers = [
    `package ${pkg};`, '', ...imports.map((i) => `import ${i};`), '',
    '/**', ' * Event handlers generated by Codiram from your Logic blocks.', ' * Re-exporting overwrites this file — put hand-written code in Custom.java instead.', ' */',
    'public final class Handlers {', '    private Handlers() {}', '', '    public static void register() {',
    ...(handlerLines.length ? handlerLines : ['        // (no events yet — add an event block in Codiram)']), '    }', ...fnLines, '}', '',
  ].join('\n');

  // ------------------------------------------------------------ Vars
  const fields = ir.variables.filter((v) => ['Number', 'String', 'Boolean'].includes(v.type)).map((v) => {
    const t = { Number: 'double', String: 'String', Boolean: 'boolean' }[v.type];
    const init = v.type === 'Number' ? jnum(Number(v.initial) || 0) : v.type === 'Boolean' ? String(String(v.initial) === 'true') : jstr(v.initial ?? '');
    return `    public static ${t} ${javaIdent(v.name)} = ${init};`;
  });
  const vars = [`package ${pkg};`, '', '/**', ' * Global variables (Codiram "Variables"). Shared by all players on the server.', ' * Generated — re-exporting overwrites this file.', ' */', 'public final class Vars {', '    private Vars() {}', '', ...(fields.length ? fields : ['    // (no variables)']), '}', ''].join('\n');
  return { handlers, vars, problems };
}
