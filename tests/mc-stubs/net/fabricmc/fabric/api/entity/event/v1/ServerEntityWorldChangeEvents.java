// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.fabricmc.fabric.api.entity.event.v1;
import net.fabricmc.fabric.api.event.Event; import net.minecraft.server.network.ServerPlayerEntity; import net.minecraft.server.world.ServerWorld;
public final class ServerEntityWorldChangeEvents { public interface AfterPlayerChange { void afterChangeWorld(ServerPlayerEntity player, ServerWorld origin, ServerWorld destination); } public static final Event<AfterPlayerChange> AFTER_PLAYER_CHANGE_WORLD = Event.create(); }
