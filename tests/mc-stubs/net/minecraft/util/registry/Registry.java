// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.minecraft.util.registry;
import net.minecraft.block.Block; import net.minecraft.item.Item; import net.minecraft.sound.SoundEvent; import net.minecraft.util.Identifier;
public class Registry<T> { public static final Registry<Item> ITEM = new Registry<>(); public static final Registry<Block> BLOCK = new Registry<>(); public static final Registry<SoundEvent> SOUND_EVENT = new Registry<>(); public T get(Identifier id) { return null; } public Identifier getId(T value) { return null; } }
