import { nextTick, onScopeDispose, watch } from 'vue'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]',
].join(',')

// `offsetParent` would be the usual visibility check, but jsdom always reports null for it, so
// unreachable elements are recognised by their attributes instead. Anything with tabindex="-1" can
// be focused by script but never by Tab, so it must not count as the panel's first or last stop.
const isReachable = (node) =>
  node.getAttribute('tabindex') !== '-1' &&
  !node.hasAttribute('hidden') &&
  !node.closest('[aria-hidden="true"]')

const focusableWithin = (element) => [...element.querySelectorAll(FOCUSABLE)].filter(isReachable)

/**
 * Keeps keyboard focus inside an open panel: focus moves in when it opens, Tab cycles within it,
 * Esc asks to close, and focus returns to wherever it was when the panel closes.
 *
 * @param {import('vue').Ref<HTMLElement|null>} container
 * @param {{
 *   active: import('vue').Ref<boolean>,
 *   onEscape?: () => void,
 *   initialFocus?: import('vue').Ref<HTMLElement|null>,
 * }} options
 *   `initialFocus` is where focus should start, when it shouldn't simply be the first control in
 *   the panel: a drawer starts on its first field rather than on the close button in its header.
 */
export function useFocusTrap(container, { active, onEscape, initialFocus }) {
  let previouslyFocused = null

  function onKeydown(event) {
    if (event.key === 'Escape') {
      // Only when the key came from the panel (or from nothing in particular). A control elsewhere
      // on the page, such as a popup that lives outside the panel, handles its own Escape first
      // instead of the whole panel closing under the user.
      const { target } = event
      const fromPanel =
        !target ||
        target === document ||
        target === document.body ||
        container.value?.contains(target)
      if (fromPanel) onEscape?.()
      return
    }
    if (event.key !== 'Tab' || !container.value) return

    const focusable = focusableWithin(container.value)
    if (!focusable.length) {
      event.preventDefault()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    // Wrap around at both ends, so Tab can never reach the page behind the panel.
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function stopListening() {
    document.removeEventListener('keydown', onKeydown)
  }

  // Immediate, so a panel that is already open when it mounts is trapped too.
  watch(
    active,
    async (isActive) => {
      if (isActive) {
        previouslyFocused = document.activeElement
        document.addEventListener('keydown', onKeydown)
        // Wait for the panel to render before looking for something to focus.
        await nextTick()
        const preferred = initialFocus?.value ? focusableWithin(initialFocus.value) : []
        const [firstField] = preferred.length ? preferred : focusableWithin(container.value ?? [])
        // A panel with nothing to focus (read-only content) takes focus itself, so the keyboard
        // starts inside it rather than on the page behind.
        ;(firstField ?? container.value)?.focus()
        return
      }

      stopListening()
      previouslyFocused?.focus?.()
      previouslyFocused = null
    },
    { immediate: true },
  )

  // The panel can be destroyed while still open (a route change, a v-if above it). Without this the
  // listener would stay on `document` and swallow every later Tab and Escape on the page.
  onScopeDispose(stopListening)
}
