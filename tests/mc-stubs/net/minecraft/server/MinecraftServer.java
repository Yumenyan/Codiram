// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.minecraft.server;
import net.minecraft.server.command.CommandManager; import net.minecraft.server.command.ServerCommandSource; import net.minecraft.server.world.ServerWorld;
public class MinecraftServer { public PlayerManager getPlayerManager() { return null; } public CommandManager getCommandManager() { return null; } public ServerCommandSource getCommandSource() { return null; } public int getTicks() { return 0; } public int getCurrentPlayerCount() { return 0; } public ServerWorld getOverworld() { return null; } }
