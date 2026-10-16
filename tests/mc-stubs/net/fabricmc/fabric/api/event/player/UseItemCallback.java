// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.fabricmc.fabric.api.event.player;
import net.fabricmc.fabric.api.event.Event; import net.minecraft.entity.player.PlayerEntity; import net.minecraft.item.ItemStack; import net.minecraft.util.Hand; import net.minecraft.util.TypedActionResult; import net.minecraft.world.World;
public interface UseItemCallback { Event<UseItemCallback> EVENT = Event.create(); TypedActionResult<ItemStack> interact(PlayerEntity player, World world, Hand hand); }
