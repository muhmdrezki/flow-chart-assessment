import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import payload from '../../public/payload.json'
import { getNodeSize } from '@/utils/nodeRegistry'
import { HISTORY_LIMIT, useFlowStore } from './flow'

/** The sizes the layout spaces rows by, read from the registry so a card can be resized once. */
const CARD = getNodeSize({ type: 'sendMessage' }).height
const PILL = getNodeSize({ type: 'dateTimeConnector', data: { connectorType: 'success' } }).height

/*
 * The store is the single source of truth for the flow, so this is the suite that matters most:
 * everything the canvas draws and everything the drawer edits comes from here, and a bug in an
 * action corrupts the document rather than just one screen.
 *
 * Three things get the most attention, because they are where the real risk is:
 *
 * 1. `insertNodes` — the only action that both re-parents nodes and moves them. Getting it wrong
 *    detaches a branch or drops one step on top of another.
 * 2. Snapshots — undo restores a whole node list, so the tests check that a snapshot is a *copy*
 *    and contains no reactive proxy. Both of those failed in the browser while every test passed,
 *    which is why they are asserted explicitly now.
 * 3. `hydrate` running once — Vue Query can re-deliver cached data at any time, and the guard is
 *    all that stands between that and silently throwing away the user's edits.
 *
 * A fresh Pinia per test, so no test can be affected by what another one left behind.
 */
describe('useFlowStore', () => {
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useFlowStore()
  })

  it('starts empty and not hydrated', () => {
    expect(store.nodes).toEqual([])
    expect(store.edges).toEqual([])
    expect(store.isHydrated).toBe(false)
  })

  describe('hydrate', () => {
    it('loads every payload node with a position', () => {
      store.hydrate(payload)

      expect(store.isHydrated).toBe(true)
      expect(store.nodes).toHaveLength(7)
      for (const node of store.nodes) {
        expect(node.position).toEqual({ x: expect.any(Number), y: expect.any(Number) })
      }
    })

    it('accepts Vue Query data, which arrives as a reactive proxy', () => {
      // structuredClone throws on proxies; this failed in the browser before hydrate used toRaw.
      expect(() => store.hydrate(reactive(structuredClone(payload)))).not.toThrow()
      expect(store.nodes).toHaveLength(7)
    })

    /*
     * The guard that makes the Query-to-Pinia boundary safe. Query may hand back its cached payload
     * on a remount or a refetch; without this, ten minutes of editing would vanish and look like the
     * app had reset itself. The test edits first, then re-hydrates with a different flow entirely.
     */
    it('ignores later calls so user changes are never overwritten', () => {
      store.hydrate(payload)
      store.updateNodePositions([{ id: '1', position: { x: 999, y: 999 } }])

      store.hydrate([{ id: 'other', parentId: -1, type: 'trigger' }])

      expect(store.nodes).toHaveLength(7)
      expect(store.nodeById.get('1').position).toEqual({ x: 999, y: 999 })
    })

    // Sharing would mean the "server's" copy and the store's copy are the same object, so editing a
    // node here would also change what a refetch is compared against.
    it('does not share objects with the payload it was given', () => {
      const raw = structuredClone(payload)
      store.hydrate(raw)

      raw.find((node) => node.id === 'e879e4').data.comment = 'changed'

      expect(store.nodeById.get('e879e4').data.comment).toBe('User message during off hours')
    })

    // A half-hydrated store is worse than an empty one: `isHydrated` staying false is what lets the
    // view show "couldn't display the flow" rather than a canvas missing most of its nodes.
    it('leaves the store untouched if the payload cannot be processed', () => {
      expect(() => store.hydrate([null])).toThrow()
      expect(store.nodes).toEqual([])
      expect(store.isHydrated).toBe(false)
    })
  })

  describe('getters', () => {
    beforeEach(() => store.hydrate(payload))

    it('looks nodes up by string id', () => {
      expect(store.nodeById.get('1').type).toBe('trigger')
      expect(store.nodeById.get('d09c08').name).toBe('Business Hours')
    })

    it('derives the six payload edges', () => {
      expect(store.edges).toHaveLength(6)
      expect(store.edges).toContainEqual({ id: 'e-1-d09c08', source: '1', target: 'd09c08' })
    })

    it('updates edges and lookups when nodes change', () => {
      store.nodes.push({ id: 'new', parentId: 'e879e4', type: 'addComment', data: {} })

      expect(store.nodeById.has('new')).toBe(true)
      expect(store.edges).toContainEqual({ id: 'e-e879e4-new', source: 'e879e4', target: 'new' })
    })
  })

  describe('nodeDisplayById', () => {
    beforeEach(() => store.hydrate(payload))

    it('gives every node its title, its description and what it holds', () => {
      const plain = (text) => ({ label: '', text })
      const nothing = { label: '', text: '' }

      expect(Object.fromEntries(store.nodeDisplayById)).toEqual({
        1: { title: 'Trigger', description: '', summary: plain('Conversation Opened') },
        b6a0c1: {
          title: 'Away Message',
          description: '',
          summary: {
            label: 'Message',
            text: 'Sorry, we are currently away. We will respond as soon as possible.',
          },
        },
        d09c08: {
          title: 'Business Hours',
          description: '',
          summary: plain('Business Hours - UTC'),
        },
        '161f52': { title: 'Success', description: '', summary: nothing },
        '28c4b9': { title: 'Failure', description: '', summary: nothing },
        b0653a: {
          title: 'Welcome Message',
          description: '',
          summary: { label: 'Message', text: 'Hello there\n\nwelcome to the chat!' },
        },
        e879e4: {
          title: 'Add Comment #1',
          description: '',
          summary: { label: 'Comment', text: 'User message during off hours' },
        },
      })
    })

    it('is not recomputed when positions change', () => {
      const before = store.nodeDisplayById

      store.updateNodePositions([{ id: '1', position: { x: 5, y: 5 } }])

      expect(store.nodeDisplayById).toBe(before)
    })

    it('updates when a node’s text changes', () => {
      store.nodeById.get('e879e4').data.comment = 'Follow up tomorrow'
      expect(store.nodeDisplayById.get('e879e4').summary.text).toBe('Follow up tomorrow')
    })
  })

  describe('layout sizes', () => {
    beforeEach(() => store.hydrate(payload))
    const y = (id) => store.nodeById.get(id).position.y

    it('spaces nodes by the height of their parent, so pills sit closer than cards', () => {
      const gap = 64
      expect(y('d09c08') - y('1')).toBe(CARD + gap)
      expect(y('161f52') - y('d09c08')).toBe(CARD + gap)
      expect(y('b0653a') - y('161f52')).toBe(PILL + gap)
    })

    it('centres the narrow pills under their parent card’s slot', () => {
      const centreX = (id, width) => store.nodeById.get(id).position.x + width / 2
      expect(centreX('161f52', 96)).toBe(centreX('b0653a', 240))
    })
  })

  /*
   * The riskiest action in the store, and the longest block here for that reason. Creating a step
   * does three things at once — adds nodes, re-parents whatever used to follow, and moves that
   * branch down — and each one can fail in a way the others hide. A detached branch still renders;
   * two nodes on the same spot still render.
   *
   * So the assertions come in pairs: what the tree now says (parentId, edges) and where things now
   * are (positions, and `overlappingPairs`, which checks no two boxes touch anywhere in the flow).
   */
  describe('insertNodes', () => {
    beforeEach(() => store.hydrate(payload))

    const node = (id) => store.nodeById.get(id)
    /** Every pair of nodes whose boxes touch: the flow should never have any. */
    const overlappingPairs = () => {
      const boxes = store.nodes.map((n) => {
        const size = getNodeSize(n)
        return {
          id: n.id,
          left: n.position.x,
          right: n.position.x + size.width,
          top: n.position.y,
          bottom: n.position.y + size.height,
        }
      })
      const pairs = []
      for (const [index, a] of boxes.entries()) {
        for (const b of boxes.slice(index + 1)) {
          const overlaps =
            a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
          if (overlaps) pairs.push([a.id, b.id])
        }
      }
      return pairs
    }
    const message = (id, parentId) => ({
      id,
      parentId,
      type: 'sendMessage',
      name: 'Follow up',
      data: { description: 'Checks in later', payload: [] },
    })
    const addMessage = (id, parentId) =>
      store.insertNodes([message(id, parentId)], { insertedId: id, continuationId: id })

    describe('after a step that has nothing following it', () => {
      it('adds the node one row below its parent, centred on it', () => {
        // Welcome Message is a leaf: nothing below it has to move out of the way.
        const parent = { ...node('b0653a').position }

        addMessage('new01', 'b0653a')

        expect(store.nodes).toHaveLength(8)
        expect(node('new01').position).toEqual({ x: parent.x, y: parent.y + CARD + 64 })
      })

      it('connects it to its parent', () => {
        addMessage('new01', 'b0653a')

        expect(node('new01').parentId).toBe('b0653a')
        expect(store.edges).toContainEqual({
          id: 'e-b0653a-new01',
          source: 'b0653a',
          target: 'new01',
        })
      })

      it('returns the id of the node the user created', () => {
        expect(addMessage('new01', 'b0653a')).toBe('new01')
      })
    })

    /*
     * The splice: the case the "+" on a connector relies on. A step added here must end up *in* the
     * chain rather than beside it, so what used to follow the parent now follows the new step and
     * moves down far enough to make room — and everything else in the flow stays exactly put.
     */
    describe('between a step and what used to follow it', () => {
      // Away Message → Add Comment #1, with the new step going in between them.
      let before

      beforeEach(() => {
        before = { away: { ...node('b6a0c1').position }, welcome: { ...node('b0653a').position } }
        addMessage('new01', 'b6a0c1')
      })

      it('reattaches the following step under the new node', () => {
        expect(node('e879e4').parentId).toBe('new01')
        expect(store.edges).toContainEqual({
          id: 'e-new01-e879e4',
          source: 'new01',
          target: 'e879e4',
        })
        expect(store.edges).not.toContainEqual({
          id: 'e-b6a0c1-e879e4',
          source: 'b6a0c1',
          target: 'e879e4',
        })
      })

      it('moves the following step down so it does not overlap the new node', () => {
        expect(node('new01').position.y).toBe(before.away.y + CARD + 64)
        expect(node('e879e4').position.y).toBe(node('new01').position.y + CARD + 64)
      })

      it('leaves the rest of the flow where it was', () => {
        expect(node('b6a0c1').position).toEqual(before.away)
        expect(node('b0653a').position).toEqual(before.welcome)
      })
    })

    it('moves a whole branch down, not just the node directly below', () => {
      // Inserting after Failure moves Away Message and the comment under it.
      const awayBefore = node('b6a0c1').position.y
      const commentBefore = node('e879e4').position.y

      addMessage('new01', '28c4b9')

      const shift = node('b6a0c1').position.y - awayBefore
      expect(shift).toBeGreaterThan(0)
      expect(node('e879e4').position.y - commentBefore).toBe(shift)
    })

    it('only ever moves followers down, even one the user dragged far below', () => {
      // The comment was dragged 600px down; inserting above it must not pull it back up.
      store.updateNodePositions([{ id: 'e879e4', position: { x: 160, y: 1148 } }])

      addMessage('new01', 'b6a0c1')

      expect(node('e879e4').position.y).toBe(1148 + CARD + 64)
    })

    it('keeps positions the user has dragged, instead of laying the flow out again', () => {
      store.updateNodePositions([{ id: '1', position: { x: 999, y: 999 } }])

      addMessage('new01', 'b0653a')

      expect(node('1').position).toEqual({ x: 999, y: 999 })
    })

    /*
     * A condition arrives as three nodes at once and is the case that forced snapshots on undo: it
     * widens the flow, so the layout runs again and every position in the tree can move. The
     * branches must stay attached to it, and the chain must continue on the success side — a flow
     * that forked into nothing would look fine on the canvas and be wrong.
     */
    describe('a business hours node', () => {
      const created = [
        {
          id: 'bh01',
          parentId: 'b6a0c1',
          type: 'dateTime',
          name: 'Office hours',
          data: {
            description: 'Only during office hours',
            action: 'businessHours',
            timezone: 'UTC',
            times: [],
            connectors: ['ok01', 'no01'],
          },
        },
        {
          id: 'ok01',
          parentId: 'bh01',
          type: 'dateTimeConnector',
          name: 'Success',
          data: { connectorType: 'success' },
        },
        {
          id: 'no01',
          parentId: 'bh01',
          type: 'dateTimeConnector',
          name: 'Failure',
          data: { connectorType: 'failure' },
        },
      ]
      const addBusinessHours = () =>
        store.insertNodes(created, { insertedId: 'bh01', continuationId: 'ok01' })

      it('adds the condition and both of its branches', () => {
        addBusinessHours()

        expect(store.nodes).toHaveLength(10)
        expect(node('ok01').parentId).toBe('bh01')
        expect(node('no01').parentId).toBe('bh01')
      })

      it('puts the branches side by side, one row below the condition', () => {
        addBusinessHours()

        expect(node('ok01').position.y).toBe(node('bh01').position.y + CARD + 64)
        expect(node('no01').position.y).toBe(node('ok01').position.y)
        expect(node('no01').position.x - node('ok01').position.x).toBe(280)
      })

      it('moves the followers under their new parent, not just downwards', () => {
        addBusinessHours()

        const centre = (id, width) => node(id).position.x + width / 2
        expect(centre('e879e4', 240)).toBe(centre('ok01', 96))
      })

      it('leaves room for a later step on the failure branch', () => {
        addBusinessHours()
        addMessage('new02', 'no01')

        expect(node('new02').position.x).not.toBe(node('e879e4').position.x)
      })

      it('makes room for the new branch, so nothing ends up on top of anything else', () => {
        // Adding a condition after Success used to drop its failure pill onto Add Comment #1.
        store.insertNodes(created, { insertedId: 'bh01', continuationId: 'ok01' })

        expect(overlappingPairs()).toEqual([])
      })

      it('makes room when added on a branch beside another branch', () => {
        // The original overlap: a condition added after Success put its failure pill on top of
        // Add Comment #1, which lives on the neighbouring failure branch.
        const onSuccess = created.map((n) => (n.id === 'bh01' ? { ...n, parentId: '161f52' } : n))

        store.insertNodes(onSuccess, { insertedId: 'bh01', continuationId: 'ok01' })

        expect(overlappingPairs()).toEqual([])
        expect(node('b0653a').parentId).toBe('ok01')
      })

      it('arranges the whole flow again, since a condition changes the tree’s width', () => {
        store.updateNodePositions([{ id: '1', position: { x: 999, y: 999 } }])

        store.insertNodes(created, { insertedId: 'bh01', continuationId: 'ok01' })

        expect(node('1').position).not.toEqual({ x: 999, y: 999 })
      })

      it('continues the existing flow on the success branch', () => {
        addBusinessHours()

        expect(node('e879e4').parentId).toBe('ok01')
        expect(node('e879e4').position.y).toBe(node('ok01').position.y + 28 + 64)
      })
    })

    it('refuses to add a node after business hours, which branches instead', () => {
      expect(() => addMessage('new01', 'd09c08')).toThrow('which branches instead')
      expect(store.nodes).toHaveLength(7)
    })

    it.each([
      ['the new node is missing', { insertedId: 'ghost', continuationId: 'new01' }],
      ['the continuation is missing', { insertedId: 'new01', continuationId: 'ghost' }],
    ])('refuses to insert when %s', (_, placement) => {
      expect(() => store.insertNodes([message('new01', 'b0653a')], placement)).toThrow()
      expect(store.nodes).toHaveLength(7)
    })

    it('refuses to add a node after a step that does not exist', () => {
      expect(() => addMessage('new01', 'ghost')).toThrow(
        'Cannot add a node after unknown node "ghost"',
      )
      expect(store.nodes).toHaveLength(7)
    })

    it('normalises what the API returns, like the payload', () => {
      store.insertNodes([{ id: 'new01', parentId: 'b0653a', type: 'addComment' }], {
        insertedId: 'new01',
        continuationId: 'new01',
      })

      expect(node('new01').data).toEqual({})
      expect(store.nodeDisplayById.get('new01')).toEqual({
        title: 'Add Comment',
        description: '',
        summary: { label: 'Comment', text: '-' },
      })
    })
  })

  /*
   * The only action a drag produces, and it is called once when the drag ends rather than per
   * frame — Vue Flow moves the node itself while the pointer is down. That is why it takes a list:
   * dragging a multi-selection is one change, and so one undo entry.
   */
  describe('updateNodePositions', () => {
    beforeEach(() => store.hydrate(payload))

    it('moves every node in the update', () => {
      store.updateNodePositions([
        { id: '1', position: { x: 1, y: 2 } },
        { id: 'd09c08', position: { x: 3, y: 4 } },
      ])

      expect(store.nodeById.get('1').position).toEqual({ x: 1, y: 2 })
      expect(store.nodeById.get('d09c08').position).toEqual({ x: 3, y: 4 })
    })

    // Vue Flow goes on mutating the position objects it hands over, so keeping the reference would
    // let the canvas move a node behind the store's back — and undo would restore the moved value.
    it('copies the position rather than keeping the caller’s object', () => {
      const position = { x: 1, y: 2 }
      store.updateNodePositions([{ id: '1', position }])
      position.x = 100

      expect(store.nodeById.get('1').position.x).toBe(1)
    })

    it('ignores unknown ids', () => {
      const snapshot = () => store.nodes.map(({ id, position }) => ({ id, ...position }))
      const before = snapshot()

      store.updateNodePositions([{ id: 'missing', position: { x: 1, y: 1 } }])

      expect(snapshot()).toEqual(before)
    })
  })

  describe('replaceNode', () => {
    beforeEach(() => store.hydrate(payload))

    it('swaps the node for the edited copy', () => {
      const edited = { ...store.nodeById.get('e879e4'), name: 'Renamed' }

      store.replaceNode(edited)

      expect(store.nodeById.get('e879e4').name).toBe('Renamed')
      expect(store.nodes).toHaveLength(7)
    })

    // The drawer edits a draft that has no idea where the node sits, so a save must not be able to
    // move it. Saving a title and watching the card jump across the canvas would be the bug.
    it('keeps the position it already had, since editing never moves a node', () => {
      const before = { ...store.nodeById.get('e879e4').position }

      store.replaceNode({ ...store.nodeById.get('e879e4'), name: 'Renamed', position: undefined })

      expect(store.nodeById.get('e879e4').position).toEqual(before)
    })

    it('shows the new title on the canvas', () => {
      store.replaceNode({ ...store.nodeById.get('e879e4'), name: 'Renamed' })

      expect(store.nodeDisplayById.get('e879e4').title).toBe('Renamed')
    })

    it('ignores a node that is no longer in the flow', () => {
      store.replaceNode({ id: 'ghost', parentId: null, type: 'addComment', data: {} })

      expect(store.nodes).toHaveLength(7)
    })
  })

  /*
   * Delete is given its consequences rather than working them out: `nodeRemoval.js` decides what
   * goes, what is re-parented and what moves up, and this action applies all of it in one step.
   * That split is deliberate — the rules are pure and heavily tested next door, and the drawer can
   * ask the same function what a delete would take *before* the user confirms it.
   *
   * The invariant these tests protect: a delete must never leave the chain broken. Whatever
   * followed the deleted step is handed a new parent in the same operation, so no intermediate
   * state exists where a node's parent is gone.
   */
  describe('removeNodes', () => {
    beforeEach(() => store.hydrate(payload))

    it('drops the nodes it is given', () => {
      store.removeNodes({ removeIds: ['e879e4'] })

      expect(store.nodeById.has('e879e4')).toBe(false)
      expect(store.nodes).toHaveLength(6)
    })

    // Deleting a step in the middle closes the chain: its children are given its parent, and
    // because edges are derived, the line redraws itself with no edge bookkeeping at all.
    it('hands the orphans to their new parent, so the edge follows', () => {
      store.removeNodes({
        removeIds: ['b6a0c1'],
        reparent: [{ id: 'e879e4', parentId: '28c4b9' }],
      })

      expect(store.nodeById.get('e879e4').parentId).toBe('28c4b9')
      expect(store.edges.map((edge) => edge.id)).toContain('e-28c4b9-e879e4')
    })

    it('moves the promoted subtree up into the row that was freed', () => {
      const before = store.nodeById.get('e879e4').position.y

      store.removeNodes({
        removeIds: ['b6a0c1'],
        reparent: [{ id: 'e879e4', parentId: '28c4b9' }],
        shift: { ids: ['e879e4'], dy: -100 },
      })

      expect(store.nodeById.get('e879e4').position.y).toBe(before - 100)
    })

    // Deleting must not re-tidy the canvas. Running the layout again would be easier and would
    // throw away every drag the user had made, which is the trade-off placement.js exists for.
    it('leaves every other position alone, so a dragged node stays where it was put', () => {
      store.updateNodePositions([{ id: 'b0653a', position: { x: 999, y: 888 } }])

      store.removeNodes({ removeIds: ['e879e4'] })

      expect(store.nodeById.get('b0653a').position).toEqual({ x: 999, y: 888 })
    })

    it('drops a whole branch at once', () => {
      store.removeNodes({ removeIds: ['d09c08', '161f52', '28c4b9', 'b0653a', 'b6a0c1', 'e879e4'] })

      expect(store.nodes.map((node) => node.id)).toEqual(['1'])
      expect(store.edges).toEqual([])
    })
  })

  /*
   * Undo keeps snapshots of the whole node list rather than an inverse per action, because one
   * action already forces it: creating a condition re-lays out the flow, so taking it back means
   * restoring every position. The table below runs the same four assertions over all four kinds of
   * change, which is the point — with one mechanism there is nothing action-specific to get wrong.
   *
   * Two of these tests exist because of bugs found in the browser, not in CI: a snapshot must be a
   * *copy* (holding a reference would "restore" the state the user is already in) and must contain
   * no reactive proxy (Vue's reactivity leaking into a layer that is meant to be plain data).
   */
  describe('undo and redo', () => {
    beforeEach(() => store.hydrate(payload))

    const ids = () => store.nodes.map((node) => node.id)
    const positionOf = (id) => ({ ...store.nodeById.get(id).position })

    const newMessage = {
      id: 'new01',
      parentId: 'b0653a',
      type: 'sendMessage',
      name: 'Follow up',
      data: { payload: [] },
    }
    const create = () =>
      store.insertNodes([newMessage], { insertedId: 'new01', continuationId: 'new01' })

    it('has nothing to take back on a freshly loaded flow', () => {
      expect(store.canUndo).toBe(false)
      expect(store.canRedo).toBe(false)
      expect(store.undoLabel).toBe('')
    })

    it('does nothing when asked to undo nothing', () => {
      store.undo()

      expect(store.nodes).toHaveLength(7)
    })

    describe.each([
      ['a create', () => create(), 'Create Follow up'],
      [
        'an edit',
        () => store.replaceNode({ ...store.nodeById.get('e879e4'), name: 'Renamed' }),
        'Edit Add Comment #1',
      ],
      ['a delete', () => store.removeNodes({ removeIds: ['e879e4'] }), 'Delete Add Comment #1'],
      [
        'a drag',
        () => store.updateNodePositions([{ id: '1', position: { x: 11, y: 22 } }]),
        'Move Trigger',
      ],
    ])('%s', (_, change, label) => {
      it('can be taken back', () => {
        const before = ids()

        change()
        expect(store.canUndo).toBe(true)
        store.undo()

        expect(ids()).toEqual(before)
        expect(store.canUndo).toBe(false)
      })

      it('says what it would take back', () => {
        change()

        expect(store.undoLabel).toBe(label)
      })

      it('can be put back again', () => {
        change()
        const after = ids()

        store.undo()
        store.redo()

        expect(ids()).toEqual(after)
        expect(store.canRedo).toBe(false)
      })
    })

    it('restores the positions a drag changed', () => {
      store.updateNodePositions([{ id: '1', position: { x: 11, y: 22 } }])

      store.undo()

      expect(positionOf('1')).not.toEqual({ x: 11, y: 22 })
    })

    it('restores what an edit changed, and nothing else', () => {
      const comment = store.nodeById.get('e879e4')
      store.replaceNode({ ...comment, name: 'Renamed', data: { comment: 'Changed' } })

      store.undo()

      expect(store.nodeById.get('e879e4').name).toBe('Add Comment #1')
      expect(store.nodeById.get('e879e4').data.comment).toBe('User message during off hours')
      expect(store.nodes).toHaveLength(7)
    })

    // Deleting a condition takes six nodes, and undo has to bring back the parent links between
    // them too — which it does for free, because the snapshot holds the nodes and the edges are
    // derived from what is restored.
    it('brings back a deleted step with everything that went with it', () => {
      store.removeNodes({
        removeIds: ['d09c08', '161f52', '28c4b9', 'b0653a', 'b6a0c1', 'e879e4'],
      })
      expect(store.nodes).toHaveLength(1)

      store.undo()

      expect(store.nodes).toHaveLength(7)
      expect(store.edges).toHaveLength(6)
    })

    it('puts back every position when a create re-arranged the whole flow', () => {
      // A condition is wider than the step it follows, so creating one lays the flow out again.
      // This is the case that decided snapshots over an inverse per action.
      store.updateNodePositions([{ id: 'b0653a', position: { x: 999, y: 888 } }])
      const dragged = positionOf('b0653a')

      store.insertNodes(
        [
          {
            id: 'bh01',
            parentId: 'b6a0c1',
            type: 'dateTime',
            name: 'Office hours',
            data: { action: 'businessHours', connectors: ['ok01', 'no01'], times: [] },
          },
          {
            id: 'ok01',
            parentId: 'bh01',
            type: 'dateTimeConnector',
            data: { connectorType: 'success' },
          },
          {
            id: 'no01',
            parentId: 'bh01',
            type: 'dateTimeConnector',
            data: { connectorType: 'failure' },
          },
        ],
        { insertedId: 'bh01', continuationId: 'ok01' },
      )
      expect(positionOf('b0653a')).not.toEqual(dragged)

      store.undo()

      expect(positionOf('b0653a')).toEqual(dragged)
      expect(store.nodes).toHaveLength(7)
    })

    it('steps back through several changes, newest first', () => {
      create()
      store.replaceNode({ ...store.nodeById.get('e879e4'), name: 'Renamed' })
      expect(store.undoLabel).toBe('Edit Add Comment #1')

      store.undo()
      expect(store.undoLabel).toBe('Create Follow up')

      store.undo()
      expect(store.canUndo).toBe(false)
      expect(ids()).toHaveLength(7)
    })

    // The only sane answer to "what does redo mean after you did something else": the branch redo
    // was going to follow no longer describes a flow that ever existed.
    it('forgets the redo branch once something new is done', () => {
      create()
      store.undo()
      expect(store.canRedo).toBe(true)

      store.removeNodes({ removeIds: ['e879e4'] })

      expect(store.canRedo).toBe(false)
    })

    it('keeps a snapshot of its own, not a view of the flow', () => {
      create()

      // Changing the flow afterwards must not reach into what was remembered.
      store.updateNodePositions([{ id: 'new01', position: { x: 1, y: 2 } }])
      store.undo()
      store.undo()

      expect(ids()).not.toContain('new01')
    })

    it('remembers a node that was edited, which holds a live position until it is copied', () => {
      // Read through the store a position is reactive, and structuredClone refuses a proxy.
      store.replaceNode({ ...store.nodeById.get('e879e4'), name: 'Renamed' })

      expect(() => store.removeNodes({ removeIds: ['e879e4'] })).not.toThrow()
    })

    it('stops remembering after fifty changes, dropping the oldest', () => {
      for (let count = 0; count < HISTORY_LIMIT + 10; count += 1) {
        store.updateNodePositions([{ id: '1', position: { x: count, y: count } }])
      }

      for (let count = 0; count < HISTORY_LIMIT; count += 1) store.undo()

      expect(store.canUndo).toBe(false)
      // The first ten moves are gone, so the flow doesn't go all the way back to where it started.
      expect(positionOf('1')).toEqual({ x: 9, y: 9 })
    })

    it.each([
      ['a move of nothing', () => store.updateNodePositions([])],
      [
        'a move of steps that are not there',
        () => store.updateNodePositions([{ id: 'ghost', position: { x: 1, y: 2 } }]),
      ],
      ['a delete of nothing', () => store.removeNodes({ removeIds: [] })],
    ])('does not remember %s, which would undo to no effect', (_, change) => {
      store.removeNodes({ removeIds: ['e879e4'] })
      store.undo()
      expect(store.canRedo).toBe(true)

      change()

      expect(store.undoLabel).toBe('')
      // And the redo branch survives, since nothing was actually done.
      expect(store.canRedo).toBe(true)
    })

    it('starts clean when a flow is loaded', () => {
      create()
      setActivePinia(createPinia())
      const fresh = useFlowStore()

      fresh.hydrate(payload)

      expect(fresh.canUndo).toBe(false)
      expect(fresh.canRedo).toBe(false)
    })
  })
})
