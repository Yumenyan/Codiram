// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.fabricmc.fabric.api.entity.event.v1;
import net.fabricmc.fabric.api.event.Event; import net.minecraft.server.network.ServerPlayerEntity;
public final class ServerPlayerEvents { public interface AfterRespawn { void afterRespawn(ServerPlayerEntity oldPlayer, ServerPlayerEntity newPlayer, boolean alive); } public static final Event<AfterRespawn> AFTER_RESPAWN = Event.create(); }
