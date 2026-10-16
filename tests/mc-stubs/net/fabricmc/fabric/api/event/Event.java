// Minimal API stub used only to type-check generated code (see tests/minecraft.test.mjs)
package net.fabricmc.fabric.api.event;

public final class Event<T> { public void register(T listener) {} public static <T> Event<T> create() { return new Event<>(); } }
