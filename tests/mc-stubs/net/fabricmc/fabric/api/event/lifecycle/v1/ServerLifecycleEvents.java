// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.fabricmc.fabric.api.event.lifecycle.v1;
import net.fabricmc.fabric.api.event.Event; import net.minecraft.server.MinecraftServer;
public final class ServerLifecycleEvents { public interface ServerStarted { void onServerStarted(MinecraftServer server); } public interface ServerStopping { void onServerStopping(MinecraftServer server); } public interface ServerStopped { void onServerStopped(MinecraftServer server); } public static final Event<ServerStarted> SERVER_STARTED = Event.create(); public static final Event<ServerStopping> SERVER_STOPPING = Event.create(); public static final Event<ServerStopped> SERVER_STOPPED = Event.create(); }
