import { useState } from 'react'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from '../firebase'

function AdminLogin({ isConfigured, hasAdminUid, user }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try { await signInWithEmailAndPassword(auth, email, password) }
    catch { setError('Hindi nag-match ang email at password. Subukan ulit.') }
    finally { setIsSubmitting(false) }
  }

  return (
    <main className="admin-shell">
      <a className="admin-back" href="#">← Back to portfolio</a>
      <section className="login-panel">
        <p className="admin-eyebrow">PRIVATE AREA / 01</p><h1>Welcome back<span>.</span></h1>
        <p className="login-description">Sign in para i-update ang portfolio mo.</p>
        {!isConfigured ? <div className="setup-alert" role="status">Kailangan munang ilagay ang Firebase settings sa `.env.local`. Tingnan ang setup steps sa README.</div>
          : !hasAdminUid ? <div className="setup-alert" role="status">I-set ang `VITE_ADMIN_UID` sa `.env.local` para ma-limit ang dashboard sa admin account.</div>
            : user ? <div className="setup-alert" role="status">Hindi ito ang naka-configure na admin account.<button className="text-button" type="button" onClick={() => signOut(auth)}>Sign out</button></div>
              : <form className="login-form" onSubmit={handleSubmit}>
                <label htmlFor="admin-email">Email address</label>
                <input id="admin-email" autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                <label htmlFor="admin-password">Password</label>
                <input id="admin-password" autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Sign in'} <span aria-hidden="true">↗</span></button>
              </form>}
      </section>
      <span className="admin-side-label">CONTENT MANAGEMENT / AUTHORIZED USERS ONLY</span>
    </main>
  )
}

export default AdminLogin