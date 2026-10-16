// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.fabricmc.fabric.api.object.builder.v1.block;
import java.util.function.ToIntFunction; import net.minecraft.block.AbstractBlock; import net.minecraft.block.BlockState; import net.minecraft.block.Material;
public class FabricBlockSettings extends AbstractBlock.Settings { public static FabricBlockSettings of(Material m) { return new FabricBlockSettings(); } public FabricBlockSettings strength(float hardness, float resistance) { return this; } public FabricBlockSettings luminance(ToIntFunction<BlockState> f) { return this; } }
