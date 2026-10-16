// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.minecraft.world;
import net.minecraft.block.BlockState; import net.minecraft.entity.player.PlayerEntity; import net.minecraft.sound.SoundCategory; import net.minecraft.sound.SoundEvent; import net.minecraft.util.math.BlockPos;
public class World { public boolean isClient() { return false; } public BlockState getBlockState(BlockPos p) { return null; } public boolean setBlockState(BlockPos p, BlockState s) { return true; } public void playSound(PlayerEntity player, BlockPos pos, SoundEvent sound, SoundCategory category, float volume, float pitch) {} }
