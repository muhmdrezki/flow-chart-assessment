import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
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

const mountGrid = (props = {}) =>
  mount(BusinessHoursGrid, { props: { days: WORK_WEEK, timezone: 'UTC', ...props } })

const rows = (wrapper) => wrapper.findAll('li')
const times = (wrapper) => wrapper.findAll('input[type="time"]')
const lastDays = (wrapper) => wrapper.emitted('update:days').at(-1)[0]

describe('BusinessHoursGrid', () => {
  it('shows the whole week, one row per day', () => {
    const wrapper = mountGrid()

    expect(rows(wrapper)).toHaveLength(7)
    expect(rows(wrapper)[0].text()).toContain('Monday')
    expect(rows(wrapper).at(-1).text()).toContain('Sunday')
  })

  it('gives each day a start and an end', () => {
    expect(times(mountGrid())).toHaveLength(14)
    expect(times(mountGrid())[0].element.value).toBe('09:00')
  })

  it('greys out a day that is closed, keeping its times for when it reopens', () => {
    const wrapper = mountGrid()
    const [saturdayStart] = times(wrapper).slice(10)

    expect(saturdayStart.attributes('disabled')).toBeDefined()
    expect(saturdayStart.element.value).toBe('09:00')
  })

  it('reports a time as it is changed', async () => {
    const wrapper = mountGrid()

    await times(wrapper)[0].setValue('10:30')

    expect(lastDays(wrapper)[0]).toEqual({
      day: 'mon',
      isOpen: true,
      startTime: '10:30',
      endTime: '17:00',
    })
  })

  it('reports a day being opened', async () => {
    const wrapper = mountGrid()

    await wrapper.findAll('input[type="checkbox"]').at(-1).setValue(true)

    expect(lastDays(wrapper).at(-1).isOpen).toBe(true)
  })

  it('leaves the other days alone when one changes', async () => {
    const wrapper = mountGrid()

    await times(wrapper)[0].setValue('10:30')

    expect(lastDays(wrapper).slice(1)).toEqual(WORK_WEEK.slice(1))
  })

  it('copies Monday across the week, so an identical week is one click', async () => {
    const wrapper = mountGrid({
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
    it('is chosen from the zones the browser knows', () => {
      const options = mountGrid().findComponent(BaseSelect).props('options')

      expect(options.length).toBeGreaterThan(100)
      expect(options.find((option) => option.value === 'UTC').label).toBe('(GMT+00:00) UTC')
    })

    it('always contains the node’s own zone, even an unknown one', () => {
      const options = mountGrid({ timezone: 'Mars/Olympus' })
        .findComponent(BaseSelect)
        .props('options')

      expect(options.map((option) => option.value)).toContain('Mars/Olympus')
    })

    it('is built once, not rebuilt every time a zone is picked', async () => {
      // 400-odd zones, each needing its own Intl formatter: rebuilding the list would re-render
      // every option to change one.
      const wrapper = mountGrid()
      const before = wrapper.findComponent(BaseSelect).props('options')

      await wrapper.setProps({ timezone: 'Asia/Kuala_Lumpur' })

      expect(wrapper.findComponent(BaseSelect).props('options')).toBe(before)
    })

    it('reports a new zone', async () => {
      const wrapper = mountGrid()

      await wrapper.findComponent(BaseSelect).setValue('Asia/Kuala_Lumpur')

      expect(wrapper.emitted('update:timezone').at(-1)).toEqual(['Asia/Kuala_Lumpur'])
    })
  })

  describe('messages', () => {
    it('shows a day’s message under its row and marks its times', () => {
      const wrapper = mountGrid({ errors: { 'times.mon': 'Monday must end after it starts' } })

      expect(rows(wrapper)[0].text()).toContain('Monday must end after it starts')
      expect(times(wrapper)[0].attributes('aria-invalid')).toBe('true')
      expect(times(wrapper)[2].attributes('aria-invalid')).toBeUndefined()
    })

    it('shows a message about the week as a whole', () => {
      const wrapper = mountGrid({ errors: { days: 'Open at least one day' } })

      expect(wrapper.text()).toContain('Open at least one day')
    })
  })

  it('locks every control while the node is being saved', () => {
    const wrapper = mountGrid({ disabled: true })

    expect(times(wrapper).every((input) => input.attributes('disabled') !== undefined)).toBe(true)
    expect(
      wrapper
        .findAll('input[type="checkbox"]')
        .every((box) => box.attributes('disabled') !== undefined),
    ).toBe(true)
  })
})
