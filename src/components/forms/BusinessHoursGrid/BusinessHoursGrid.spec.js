import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import BaseSelect from '@/components/ui/BaseSelect/BaseSelect.vue'
import { WEEK_DAYS } from '@/utils/businessHours'
import BusinessHoursGrid from './BusinessHoursGrid.vue'

/** Mon–Fri nine to five, as a new business-hours node starts. */
const WORK_WEEK = WEEK_DAYS.map((day) => ({
  day,
  isOpen: !['sat', 'sun'].includes(day),
  startTime: '09:00',
  endTime: '17:00',
}))

/**
 * The picker fills its input as it mounts, so a grid is always given the chance to finish.
 * `attachTo` is for the keyboard tests: focus and menus need a grid that is really on the page.
 */
async function mountGrid(props = {}, options = {}) {
  const wrapper = mount(BusinessHoursGrid, {
    props: { days: WORK_WEEK, timezone: 'UTC', ...props },
    ...options,
  })
  await flushPromises()
  return wrapper
}

const rows = (wrapper) => wrapper.findAll('li')
const pickers = (wrapper) => wrapper.findAllComponents(VueDatePicker)
/** What a picker shows: its own input, which it fills from the value it was given. */
const pickerInputs = (wrapper) => wrapper.findAll('.dp--input')
const lastDays = (wrapper) => wrapper.emitted('update:days').at(-1)[0]

/** How the picker reports a chosen time: in parts, not as a string. */
const pickTime = (wrapper, index, hours, minutes) =>
  pickers(wrapper)[index].vm.$emit('update:model-value', { hours, minutes, seconds: 0 })

describe('BusinessHoursGrid', () => {
  it('shows the whole week, one row per day', async () => {
    const wrapper = await mountGrid()

    expect(rows(wrapper)).toHaveLength(7)
    expect(rows(wrapper)[0].text()).toContain('Monday')
    expect(rows(wrapper).at(-1).text()).toContain('Sunday')
  })

  it('gives each day a start and an end, each its own picker', async () => {
    const wrapper = await mountGrid()

    expect(pickers(wrapper)).toHaveLength(14)
    expect(pickerInputs(wrapper)[0].element.value).toBe('09:00')
    expect(pickerInputs(wrapper)[1].element.value).toBe('17:00')
  })

  it('shows the time as the payload stores it, and reads it back the same way', async () => {
    const wrapper = await mountGrid()

    await pickTime(wrapper, 0, 10, 30)

    // The picker works in parts; everything behind this component still sees "HH:mm".
    expect(lastDays(wrapper)[0]).toEqual({
      day: 'mon',
      isOpen: true,
      startTime: '10:30',
      endTime: '17:00',
    })
  })

  it('pads an hour the picker reports as a single digit', async () => {
    const wrapper = await mountGrid()

    await pickTime(wrapper, 0, 8, 5)

    expect(lastDays(wrapper)[0].startTime).toBe('08:05')
  })

  it('greys out a day that is closed, keeping its times for when it reopens', async () => {
    const wrapper = await mountGrid()
    const [saturdayStart] = pickers(wrapper).slice(10)

    expect(saturdayStart.props('disabled')).toBe(true)
    expect(pickerInputs(wrapper)[10].element.value).toBe('09:00')
  })

  it('reports a day being opened', async () => {
    const wrapper = await mountGrid()

    await wrapper.findAll('input[type="checkbox"]').at(-1).setValue(true)

    expect(lastDays(wrapper).at(-1).isOpen).toBe(true)
  })

  it('leaves the other days alone when one changes', async () => {
    const wrapper = await mountGrid()

    await pickTime(wrapper, 0, 10, 30)

    expect(lastDays(wrapper).slice(1)).toEqual(WORK_WEEK.slice(1))
  })

  it('copies Monday across the week, so an identical week is one click', async () => {
    const wrapper = await mountGrid({
      days: WEEK_DAYS.map((day) => ({
        day,
        isOpen: day === 'mon',
        startTime: day === 'mon' ? '08:00' : '09:00',
        endTime: day === 'mon' ? '12:00' : '17:00',
      })),
    })

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Copy Monday'))
      .trigger('click')

    expect(lastDays(wrapper)).toEqual(
      WEEK_DAYS.map((day) => ({ day, isOpen: true, startTime: '08:00', endTime: '12:00' })),
    )
  })

  describe('the time zone', () => {
    it('is chosen from the zones the browser knows', async () => {
      const options = (await mountGrid()).findComponent(BaseSelect).props('options')

      expect(options.length).toBeGreaterThan(100)
      expect(options.find((option) => option.value === 'UTC').label).toBe('(GMT+00:00) UTC')
    })

    it('always contains the node’s own zone, even an unknown one', async () => {
      const wrapper = await mountGrid({ timezone: 'Mars/Olympus' })
      const options = wrapper.findComponent(BaseSelect).props('options')

      expect(options.map((option) => option.value)).toContain('Mars/Olympus')
    })

    it('is built once, not rebuilt every time a zone is picked', async () => {
      // 400-odd zones, each needing its own Intl formatter: rebuilding the list would re-render
      // every option to change one.
      const wrapper = await mountGrid()
      const before = wrapper.findComponent(BaseSelect).props('options')

      await wrapper.setProps({ timezone: 'Asia/Kuala_Lumpur' })

      expect(wrapper.findComponent(BaseSelect).props('options')).toBe(before)
    })

    it('reports a new zone', async () => {
      const wrapper = await mountGrid()

      await wrapper.findComponent(BaseSelect).setValue('Asia/Kuala_Lumpur')

      expect(wrapper.emitted('update:timezone').at(-1)).toEqual(['Asia/Kuala_Lumpur'])
    })
  })

  describe('messages', () => {
    it('shows a day’s message under its row and marks its times', async () => {
      const wrapper = await mountGrid({
        errors: { 'times.mon': 'Monday must end after it starts' },
      })

      expect(rows(wrapper)[0].text()).toContain('Monday must end after it starts')
      expect(pickerInputs(wrapper)[0].classes()).toContain('dp--input-invalid')
      expect(pickerInputs(wrapper)[2].classes()).not.toContain('dp--input-invalid')
    })

    it('shows a message about the week as a whole', async () => {
      const wrapper = await mountGrid({ errors: { days: 'Open at least one day' } })

      expect(wrapper.text()).toContain('Open at least one day')
    })
  })

  it('names each picker, since an input on its own says nothing', async () => {
    const wrapper = await mountGrid()

    expect(pickerInputs(wrapper)[0].attributes('aria-label')).toBe('Monday opens at')
    expect(pickerInputs(wrapper)[1].attributes('aria-label')).toBe('Monday closes at')
  })

  it('locks every control while the node is being saved', async () => {
    const wrapper = await mountGrid({ disabled: true })

    expect(pickers(wrapper).every((picker) => picker.props('disabled'))).toBe(true)
    expect(
      wrapper
        .findAll('input[type="checkbox"]')
        .every((box) => box.attributes('disabled') !== undefined),
    ).toBe(true)
  })

  describe('the keyboard', () => {
    let grid = null
    const listeners = []

    afterEach(() => {
      listeners.forEach((listener) => document.removeEventListener('keydown', listener))
      listeners.length = 0
      grid?.unmount()
      grid = null
    })

    /** What the drawer around the grid does: answer Escape once it has bubbled up to document. */
    function watchDocumentKeys() {
      const listener = vi.fn()
      document.addEventListener('keydown', listener)
      listeners.push(listener)
      return listener
    }

    const press = (element, key) =>
      element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

    async function openFirstMenu() {
      grid = await mountGrid({}, { attachTo: document.body })
      const field = pickerInputs(grid)[0].element
      field.focus()
      press(field, 'Enter')
      await flushPromises()
      return field
    }

    it('opens a menu with Enter, which the picker itself leaves to the mouse', async () => {
      const field = await openFirstMenu()

      expect(field.getAttribute('aria-expanded')).toBe('true')
    })

    it('closes the open menu with Escape, and hands the field its focus back', async () => {
      const field = await openFirstMenu()
      expect(document.activeElement).not.toBe(field)

      press(document.activeElement, 'Escape')
      await flushPromises()

      expect(field.getAttribute('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(field)
    })

    it('keeps that Escape to itself, so the panel around it stays open', async () => {
      await openFirstMenu()
      const onDocumentKey = watchDocumentKeys()

      press(document.activeElement, 'Escape')
      await flushPromises()

      expect(onDocumentKey).not.toHaveBeenCalled()
    })

    it('passes Escape on when no menu is open, since then it is the panel’s', async () => {
      grid = await mountGrid({}, { attachTo: document.body })
      const onDocumentKey = watchDocumentKeys()

      press(pickerInputs(grid)[0].element, 'Escape')
      await flushPromises()

      expect(onDocumentKey).toHaveBeenCalled()
    })
  })
})
