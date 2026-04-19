import type { Column } from '../../lib/types'

export const NAME_COL_WIDTH = 360

export function widthForColumn(col: Column): number {
  switch (col.type) {
    case 'PEOPLE':
      return 96
    case 'CHECKBOX':
    case 'RATING':
      return 80
    case 'STATUS':
      return 130
    case 'TIMELINE':
      return 180
    case 'LONG_TEXT':
      return 220
    default:
      return 150
  }
}
