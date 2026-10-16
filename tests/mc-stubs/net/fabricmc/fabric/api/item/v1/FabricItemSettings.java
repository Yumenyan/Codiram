// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.fabricmc.fabric.api.item.v1;
import net.minecraft.item.FoodComponent; import net.minecraft.item.Item; import net.minecraft.item.ItemGroup;
public class FabricItemSettings extends Item.Settings { public FabricItemSettings group(ItemGroup g) { return this; } public FabricItemSettings maxCount(int n) { return this; } public FabricItemSettings food(FoodComponent f) { return this; } }
