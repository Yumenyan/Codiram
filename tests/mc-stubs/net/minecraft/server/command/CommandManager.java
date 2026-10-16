// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.minecraft.server.command;
import com.mojang.brigadier.builder.LiteralArgumentBuilder; import net.minecraft.server.command.ServerCommandSource;
public class CommandManager { public enum RegistrationEnvironment { ALL } public static LiteralArgumentBuilder<ServerCommandSource> literal(String s) { return new LiteralArgumentBuilder<>(); } public int execute(ServerCommandSource source, String command) { return 0; } }
