// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.fabricmc.fabric.api.event.lifecycle.v1;
import net.fabricmc.fabric.api.event.Event; import net.minecraft.server.MinecraftServer;
public final class ServerTickEvents { public interface EndTick { void onEndTick(MinecraftServer server); } public static final Event<EndTick> END_SERVER_TICK = Event.create(); }
