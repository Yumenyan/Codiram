// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.minecraft.entity.player;
import net.minecraft.entity.LivingEntity; import net.minecraft.item.ItemStack; import net.minecraft.text.Text; import net.minecraft.util.Hand;
public class PlayerEntity extends LivingEntity { public int experienceLevel; public void sendMessage(Text message, boolean overlay) {} public PlayerInventory getInventory() { return null; } public ItemStack getStackInHand(Hand hand) { return null; } public ItemStack getMainHandStack() { return null; } public boolean isSneaking() { return false; } public HungerManager getHungerManager() { return null; } public void addExperience(int points) {} }
