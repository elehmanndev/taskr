export type ColumnType =
  | 'STATUS' | 'PEOPLE' | 'DATE' | 'TIMELINE' | 'TEXT' | 'NUMBERS'
  | 'DROPDOWN' | 'TAGS' | 'URL' | 'LONG_TEXT' | 'CHECKBOX' | 'RATING'
  | 'PROGRESS' | 'TIME_TRACKING' | 'CREATION_LOG' | 'LAST_UPDATED'
  | 'EMAIL' | 'PHONE' | 'LINK' | 'FILE'

export type LanguageCode = 'es' | 'ca' | 'en' | 'fr' | 'pt' | 'de' | 'it'
export type LanguageLevel = 1 | 2 | 3 | 4

export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  department?: string | null
  group?: string | null
  claudeMd?: string | null
  expertise?: string[]
  languages?: Partial<Record<LanguageCode, LanguageLevel>>
  slackUrl?: string | null
  createdAt?: string
}

export interface OrgMember {
  id: string
  orgId: string
  userId: string
  role: string
  org: Org
}

export interface Org {
  id: string
  name: string
  slug: string
}

export interface StatusLabel {
  id: number
  label: string
  color: string
  index: number
  is_done?: boolean
}

export interface Column {
  id: string
  boardId: string
  title: string
  type: ColumnType
  position: number
  settings: any
}

export interface ItemAssignee {
  id: string
  itemId: string
  userId: string
  user: User
}

export interface Item {
  id: string
  boardId: string
  groupId: string
  name: string
  position: number
  columnValues: Record<string, any>
  createdAt: string
  updatedAt: string
  assignees: ItemAssignee[]
  _count?: { comments: number; attachments?: number }
}

export interface Group {
  id: string
  boardId: string
  name: string
  color: string
  position: number
  collapsed: boolean
  /** undefined = not loaded yet (lazy). Empty array = loaded but empty. */
  items?: Item[]
  /** undefined = haven't fetched. null = fully loaded. string = position cursor for next page. */
  nextCursor?: string | null
  _count?: { items: number }
}

export interface Board {
  id: string
  orgId: string
  name: string
  description?: string | null
  kind: 'PUBLIC' | 'PRIVATE' | 'SHAREABLE'
  columns: Column[]
  groups: Group[]
  _count?: { items: number }
}

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  entityId?: string | null
  readAt?: string | null
  createdAt: string
}
