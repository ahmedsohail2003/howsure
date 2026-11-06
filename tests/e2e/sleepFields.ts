// Build-out item 2.2: a date and time is two fields (src/ui/WhenField.tsx), a date input and a
// time field that takes shorthand. These helpers fill both from one "YYYY-MM-DDTHH:MM" value, so a
// test can keep the exact time it used with the older single date-and-time field.
import type { Locator } from '@playwright/test'

/** Fills the date and time fields named `${prefix}-date-input` and `${prefix}-time-input`. */
export async function fillWhen(scope: Locator, prefix: string, when: string): Promise<void> {
  await scope.getByTestId(`${prefix}-date-input`).fill(when.slice(0, 10))
  await scope.getByTestId(`${prefix}-time-input`).fill(when.slice(11, 16))
}
