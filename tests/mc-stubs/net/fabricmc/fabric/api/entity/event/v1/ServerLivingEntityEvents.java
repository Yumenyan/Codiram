// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.fabricmc.fabric.api.entity.event.v1;
import net.fabricmc.fabric.api.event.Event; import net.minecraft.entity.LivingEntity; import net.minecraft.entity.damage.DamageSource;
public final class ServerLivingEntityEvents { public interface AfterDeath { void afterDeath(LivingEntity entity, DamageSource damageSource); } public static final Event<AfterDeath> AFTER_DEATH = Event.create(); }
