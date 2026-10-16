// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.minecraft.inventory;
import java.util.function.Predicate; import net.minecraft.item.ItemStack;
public final class Inventories { public static int remove(Inventory inventory, Predicate<ItemStack> shouldRemove, int maxCount, boolean dryRun) { return 0; } }
