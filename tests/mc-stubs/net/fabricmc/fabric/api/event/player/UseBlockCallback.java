// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.fabricmc.fabric.api.event.player;
import net.fabricmc.fabric.api.event.Event; import net.minecraft.entity.player.PlayerEntity; import net.minecraft.util.ActionResult; import net.minecraft.util.Hand; import net.minecraft.util.hit.BlockHitResult; import net.minecraft.world.World;
public interface UseBlockCallback { Event<UseBlockCallback> EVENT = Event.create(); ActionResult interact(PlayerEntity player, World world, Hand hand, BlockHitResult hitResult); }
