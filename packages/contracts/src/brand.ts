/**
 * The `Branded<B>` nominal-typing primitive — a type-only utility (no runtime
 * code, no harness dependency). Mirrors `@deepseek-ai/dsh-brand` so the
 * contracts package stays dependency-free while preserving nominal identity
 * for cross-boundary ids.
 *
 * A brand makes structurally-identical strings non-interchangeable at the type
 * level: a {@link SessionId} cannot be passed where an {@link FsTargetKey} is
 * expected, even though both are plain strings at runtime.
 *
 * @module @ultimate-ide/contracts/brand
 */

declare const BRAND: unique symbol

/** A string carrying a compile-time-only brand `B`. */
export type Branded<B extends string> = string & { readonly [BRAND]: B }
