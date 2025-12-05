'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from './supabase-client'
import type { User, AuthError } from '@supabase/supabase-js'

export interface AuthState {
  user: User | null
  isLoading: boolean
  error: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
  })

  const supabase = createClient()

  // 初始化：取得目前使用者
  useEffect(() => {
    const getUser = async () => {
      try {
        // 加入超時處理，避免 CORS 錯誤時卡住
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Auth timeout')), 5000)
        })

        const authPromise = supabase.auth.getUser()

        const { data: { user }, error } = await Promise.race([authPromise, timeoutPromise]) as Awaited<typeof authPromise>

        // 未登入不算錯誤，只是沒有 user
        if (error && error.message !== 'Auth session missing!') {
          console.error('取得使用者失敗:', error)
        }
        setState({ user: user ?? null, isLoading: false, error: null })
      } catch (err) {
        // 超時或 CORS 錯誤時，直接設為未登入狀態
        console.warn('Auth 初始化失敗（可能是網路問題）:', err)
        setState({ user: null, isLoading: false, error: null })
      }
    }

    getUser()

    // 監聽 auth 狀態變化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] 狀態變化:', event)
        setState(prev => ({
          ...prev,
          user: session?.user ?? null,
          isLoading: false,
        }))
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // 登入
  const signIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      setState({ user: data.user, isLoading: false, error: null })
      return { success: true }
    } catch (err) {
      const error = err as AuthError
      const errorMessage = getErrorMessage(error)
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }, [])

  // 註冊
  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || email.split('@')[0],
          },
        },
      })
      if (error) throw error

      // 如果需要驗證信箱
      if (data.user && !data.session) {
        return { success: true, needsEmailConfirmation: true }
      }

      setState({ user: data.user, isLoading: false, error: null })
      return { success: true }
    } catch (err) {
      const error = err as AuthError
      const errorMessage = getErrorMessage(error)
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }, [])

  // 登出
  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }))
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setState({ user: null, isLoading: false, error: null })
    } catch (err) {
      console.error('登出失敗:', err)
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  // 清除錯誤
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    clearError,
  }
}

// 錯誤訊息轉換
function getErrorMessage(error: AuthError): string {
  const messages: Record<string, string> = {
    'Invalid login credentials': '帳號或密碼錯誤',
    'Email not confirmed': '請先驗證您的信箱',
    'User already registered': '此信箱已被註冊',
    'Password should be at least 6 characters': '密碼至少需要 6 個字元',
    'Unable to validate email address: invalid format': '信箱格式不正確',
    'Signup requires a valid password': '請輸入有效的密碼',
  }

  return messages[error.message] || error.message || '發生錯誤，請稍後再試'
}
