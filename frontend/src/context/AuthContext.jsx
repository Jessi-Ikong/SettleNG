import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [suspendedMessage, setSuspendedMessage] = useState('')

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const sessionUser = session?.user ?? null

        if (sessionUser) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', sessionUser.id)
            .single()

          if (error || !data) {
            setUser(null)
            setProfile(null)
            setLoading(false)
            await supabase.auth.signOut()
            return
          }

          if (data.suspended) {
            setSuspendedMessage(
              `Your account has been suspended: ${data.suspended_reason || 'no reason given'}. Contact support.`,
            )
            setUser(null)
            setProfile(null)
            setLoading(false)
            await supabase.auth.signOut()
            return
          }

          setUser(sessionUser)
          setProfile(data)
        } else {
          setUser(null)
          setProfile(null)
        }

        setLoading(false)
      },
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const signOut = () => supabase.auth.signOut()
  const clearSuspendedMessage = () => setSuspendedMessage('')

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signOut, suspendedMessage, clearSuspendedMessage }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
