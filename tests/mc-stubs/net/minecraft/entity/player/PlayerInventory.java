// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.minecraft.entity.player;
import net.minecraft.inventory.Inventory; import net.minecraft.item.Item; import net.minecraft.item.ItemStack;
public class PlayerInventory implements Inventory { public int count(Item item) { return 0; } public void offerOrDrop(ItemStack stack) {} }
