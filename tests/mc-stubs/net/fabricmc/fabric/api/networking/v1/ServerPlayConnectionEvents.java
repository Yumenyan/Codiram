// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.fabricmc.fabric.api.networking.v1;
import net.fabricmc.fabric.api.event.Event; import net.minecraft.server.MinecraftServer; import net.minecraft.server.network.ServerPlayNetworkHandler;
public final class ServerPlayConnectionEvents { public interface Join { void onPlayReady(ServerPlayNetworkHandler handler, PacketSender sender, MinecraftServer server); } public interface Disconnect { void onPlayDisconnect(ServerPlayNetworkHandler handler, MinecraftServer server); } public static final Event<Join> JOIN = Event.create(); public static final Event<Disconnect> DISCONNECT = Event.create(); }
