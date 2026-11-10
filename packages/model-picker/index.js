/**
 * Host half of the Hermes-style model picker.
 *
 * The picker itself is a client-only surface: it shadows the composer's
 * `conversation.input.model` seat and reads the shared `modelDirectories`
 * service. Nothing here registers routes, tools, or host state — the entry
 * exists so the package composes as an ordinary Loader plugin and its client
 * half is served at `/plugins/@dsh-local/hermes-model-picker/client.js`.
 */

/**
 * Register nothing on the Host side.
 */
export function apply() {}
