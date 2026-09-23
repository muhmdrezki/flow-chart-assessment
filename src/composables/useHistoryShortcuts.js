import { onScopeDispose, toValue } from 'vue'

/** Where typing belongs to the field, not to the flow. */
const TEXT_FIELDS = ['INPUT', 'TEXTAREA', 'SELECT']

/*
 * The attribute rather than `isContentEditable`, which jsdom doesn't implement — and `closest`,
 * because focus inside a rich text area lands on whatever element it is edited through.
 */
const isTyping = (target) =>
  Boolean(target) &&
  (TEXT_FIELDS.includes(target.tagName) || Boolean(target.closest?.('[contenteditable]')))

/**
 * Cmd/Ctrl+Z to undo, Cmd/Ctrl+Shift+Z or Ctrl+Y to redo.
 *
 * Both are ignored while the user is typing, where Cmd+Z means "take back what I just typed" and
 * the browser already handles it. That matters more here than in most apps: the details drawer
 * leaves the canvas live while it is open (Spec 04, decision 4b), so without this, fixing a typo
 * would delete a node.
 *
 * @param {{
 *   undo: () => void,
 *   redo: () => void,
 *   enabled?: boolean | import('vue').Ref<boolean>,
 * }} options
 */
export function useHistoryShortcuts({ undo, redo, enabled = true }) {
  function onKeydown(event) {
    if (!toValue(enabled) || isTyping(event.target)) return
    if (!event.metaKey && !event.ctrlKey) return

    const key = event.key.toLowerCase()
    const isUndo = key === 'z' && !event.shiftKey
    const isRedo = (key === 'z' && event.shiftKey) || key === 'y'
    if (!isUndo && !isRedo) return

    // Otherwise the browser's own undo acts on the page as well.
    event.preventDefault()
    if (isUndo) undo()
    else redo()
  }

  document.addEventListener('keydown', onKeydown)
  onScopeDispose(() => document.removeEventListener('keydown', onKeydown))
}
