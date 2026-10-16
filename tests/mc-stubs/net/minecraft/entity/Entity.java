// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.minecraft.entity;
import net.minecraft.world.World; import net.minecraft.util.math.BlockPos; import net.minecraft.text.Text;
public class Entity { public World world; public double getX() { return 0; } public double getY() { return 0; } public double getZ() { return 0; } public BlockPos getBlockPos() { return null; } public Text getName() { return null; } public EntityType<?> getType() { return null; } public void refreshPositionAndAngles(double x, double y, double z, float yaw, float pitch) {} }
