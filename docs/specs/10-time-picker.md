# Spec 10: A real time picker for business hours

Status: **Built 2026-09-23** (written after the fact, see §5).
Brief: _"Utilize a date timepicker to update business hours."_ The mockup draws each time as
`HH:mm ⏱`, with a clock beside it.

---

## 1. Goal

The fourteen time fields in the business-hours grid stop being `<input type="time">` and become a
picker that looks like the mockup: a small clock menu, in the app's own colours.

**Out of scope:**

- Dates. These are wall-clock times in the node's own zone (Spec 05 §2.5); nothing here has a date.
- Changing what is stored. `data.times` keeps `{ day, startTime, endTime }` with `HH:mm` strings.
- The time-zone select, which Spec 05 built and this doesn't touch.

---

## 2. Design

### 2.1 Why not keep the native input

`<input type="time">` is accessible, typeable and free, which is why Spec 05 shipped it. It is also
rendered by the browser, not by us: it reads as a browser preference sitting in a designed panel,
its clock popup is the operating system's, and it can't be themed. The brief asks for a picker and
the mockup draws one; a control we can't style can't match a mockup.

### 2.2 The dependency (decision 10a)

`@vuepic/vue-datepicker`, in time-only mode. It is the **only** UI dependency in the project —
every other control in `ui/` is built here — so it is worth saying why this one is bought:

- A clock menu is a popup with focus handling, positioning, teleporting and keyboard support. Built
  here it would be a day's work and worse than a maintained library.
- It themes through its own CSS variables, so `main.css` points `--dp-*` at our tokens and not one
  of its rules is overridden.
- It is time-only out of the box, so there is no date machinery to hide.

Rejected: building one (cost, and it is not what the brief is testing), and `flatpickr` (imperative,
not a Vue component, and heavier).

### 2.3 The shape at the boundary (decision 10b)

The picker works in `{ hours, minutes, seconds }`; the payload stores `"HH:mm"`. Two pure functions
in `utils/businessHours.js` are the whole of the translation:

```
"09:00" ──toClockParts──▶ { hours: 9, minutes: 0, seconds: 0 }
"09:00" ◀──fromClockParts── { hours: 9, minutes: 0, seconds: 0 }
```

They live in utils so they are tested as plain functions, and they are called **only** in
`BusinessHoursGrid`. Nothing behind that component — the draft, the validation, `data.times`, the
API — knows a picker is involved. That is what makes the picker replaceable.

### 2.4 How it is configured (decision 10c)

| setting                                | why                                                               |
| -------------------------------------- | ----------------------------------------------------------------- |
| `timePicker`                            | time only: these fields have no date                              |
| `timeConfig.is24`                       | the payload is 24-hour, and so is the mockup                      |
| `timeConfig.minutesIncrement: 5`        | opening hours land on five-minute marks; typing is still exact    |
| `autoApply`                             | no OK button for a two-field popup                                |
| `teleport`                              | to the body, so the drawer it opens inside can't clip it          |
| `inputAttrs.clearable: false`           | a day is open at some hour; an empty field has nothing to save    |
| `inputAttrs.state`                      | `false` marks a field the validation rejected                     |
| `ariaLabels.input`                      | "Monday opens at" — a bare time field says nothing                |
| `#input-icon`                           | a clock, not the calendar it shows by default                     |

**v14 note:** `is24`/`minutesIncrement` belong to `timeConfig` and `clearable`/`state` to
`inputAttrs`. Passed flat they are silently ignored, which is how the invalid state went missing
until a test asked for it.

### 2.5 Keyboard (decision 10d)

The picker's menu opens on a click and nothing else, so a keyboard user could reach a time field
and never open it — worse than the native input it replaced. And because the menu is teleported to
the body, the drawer around it reads Escape as coming from somewhere else: the menu stays open, or
the drawer closes under it.

The grid answers both keys itself, captured on the way down, because the picker stops them at its
input and the drawer answers Escape on the way up:

| key         | what happens                                                                  |
| ----------- | ----------------------------------------------------------------------------- |
| Enter/Space | on a closed field, stands in for the click the picker wants                   |
| Escape      | closes the open menu and hands the field its focus back; stops there          |
| Escape      | with no menu open, is not touched — it is the drawer's, as it always was      |

Inside the menu, the hour and minute steppers are real buttons, so Tab and Enter work already.

---

## 3. Implementation

| file                                            | change                                                   |
| ------------------------------------------------ | -------------------------------------------------------- |
| `utils/businessHours.js`                         | add `toClockParts` / `fromClockParts`                    |
| `components/forms/BusinessHoursGrid/`            | fourteen `VueDatePicker`s, `pickerOptions`, the key handler |
| `components/ui/BaseIcon/BaseIcon.vue`            | add the `clock` icon                                     |
| `assets/main.css`                                | import its stylesheet; map `--dp-*` to our tokens        |

### Tests

- `businessHours.spec.js`: both functions, including midnight, an unpadded hour, seconds ignored,
  rubbish in, and a round trip.
- `BusinessHoursGrid.spec.js`: fourteen pickers, the value shown, the value read back, a closed
  day, the invalid marking, the names, and the four keyboard cases.
- `NodeDetailsDrawer.spec.js`: the week still renders fourteen fields.

### Acceptance criteria

- [x] Each of the fourteen fields opens a clock menu in the app's colours.
- [x] Picking a time writes `HH:mm` to the draft; nothing else in the app changed shape.
- [x] A closed day's fields are disabled but keep their times.
- [x] A day the validation rejects is marked, and says why under its row.
- [x] Enter or Space opens a field's menu; Escape closes it and gives the field its focus back.
- [x] Escape still closes the drawer when no menu is open.

---

## 4. Decisions

| #   | Decision       | Taken                                                                | Rejected                                 |
| --- | -------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| 10a | The picker     | **`@vuepic/vue-datepicker`**, the one UI dependency                  | Building one; `flatpickr`; keeping native |
| 10b | The data shape | **`HH:mm` everywhere**, translated in the grid alone                 | Storing the picker's parts on the node   |
| 10c | Minutes        | **Five-minute steps**, typing still exact                            | Every minute; fifteen                    |
| 10d | Keyboard       | **The grid answers Enter, Space and Escape** for the picker          | Leaving it mouse-only                    |

---

## 5. Why this spec is dated after the build

It was written from the built feature, not before it. The change began as a one-line swap during a
review session and grew a keyboard story once the browser showed what the picker didn't do. The
record is worth having even late, so it is here — with the order stated rather than hidden.
