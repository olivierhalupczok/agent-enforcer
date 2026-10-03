import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ROLE_STORAGE_KEY, useRole } from './role'
import { RoleProvider } from './RoleProvider'

const wrapper = ({ children }: { children: ReactNode }) => <RoleProvider>{children}</RoleProvider>

describe('useRole', () => {
  it('defaults to admin when nothing is stored', () => {
    const { result } = renderHook(() => useRole(), { wrapper })
    expect(result.current.role).toBe('admin')
  })

  it('restores the stored role', () => {
    localStorage.setItem(ROLE_STORAGE_KEY, 'dev')
    const { result } = renderHook(() => useRole(), { wrapper })
    expect(result.current.role).toBe('dev')
  })

  it('falls back to admin for an unknown stored value', () => {
    localStorage.setItem(ROLE_STORAGE_KEY, 'superuser')
    const { result } = renderHook(() => useRole(), { wrapper })
    expect(result.current.role).toBe('admin')
  })

  it('persists a new role', () => {
    const { result } = renderHook(() => useRole(), { wrapper })
    act(() => result.current.setRole('tester'))
    expect(result.current.role).toBe('tester')
    expect(localStorage.getItem(ROLE_STORAGE_KEY)).toBe('tester')
  })

  it('still works when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const { result } = renderHook(() => useRole(), { wrapper })
    expect(result.current.role).toBe('admin')
    act(() => result.current.setRole('dev'))
    expect(result.current.role).toBe('dev')
  })

  it('throws outside RoleProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useRole())).toThrow('useRole must be used inside RoleProvider')
  })
})
