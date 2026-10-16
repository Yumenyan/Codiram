// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.fabricmc.fabric.api.event.player;
import net.fabricmc.fabric.api.event.Event; import net.minecraft.block.BlockState; import net.minecraft.block.entity.BlockEntity; import net.minecraft.entity.player.PlayerEntity; import net.minecraft.util.math.BlockPos; import net.minecraft.world.World;
public final class PlayerBlockBreakEvents { public interface After { void afterBlockBreak(World world, PlayerEntity player, BlockPos pos, BlockState state, BlockEntity blockEntity); } public static final Event<After> AFTER = Event.create(); }
