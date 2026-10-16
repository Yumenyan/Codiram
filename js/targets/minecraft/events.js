// What each Minecraft event provides to its handler body. `player` / `block` / `entity` are Java locals in the generated code.
export const EVENTS = {
  player_join: { player: true },
  player_leave: { player: true },
  player_respawn: { player: true },
  player_death: { player: true },
  dimension_change: { player: true },
  right_click_block: { player: true, block: true },
  block_break: { player: true, block: true },
  block_place: { player: true, block: true },
  item_use: { player: true },
  attack_entity: { player: true, entity: true },
  use_entity: { player: true, entity: true },
  command: { player: true },
  server_start: {},
  server_stop: {},
  server_tick: {},
  function: { player: 'maybe', block: false, entity: false }, // functions receive the player (null when called from a server event)
};
export const eventHas = (event, what) => !!EVENTS[event]?.[what];
