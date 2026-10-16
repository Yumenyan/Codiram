// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.fabricmc.fabric.api.command.v2;
import net.fabricmc.fabric.api.event.Event; import com.mojang.brigadier.CommandDispatcher; import net.minecraft.server.command.ServerCommandSource; import net.minecraft.command.CommandRegistryAccess; import net.minecraft.server.command.CommandManager;
public interface CommandRegistrationCallback { Event<CommandRegistrationCallback> EVENT = Event.create(); void register(CommandDispatcher<ServerCommandSource> dispatcher, CommandRegistryAccess registryAccess, CommandManager.RegistrationEnvironment environment); }
