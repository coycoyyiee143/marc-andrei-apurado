import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { signOut } from 'firebase/auth'
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import './AdminDashboard.css'

const profileFields = [
  { name: 'name', label: 'Name', type: 'text', hint: 'Shown as the large heading on your site.' },
  { name: 'role', label: 'Role / headline', type: 'text', hint: 'Appears right under your name.' },
  { name: 'location', label: 'Location or short label', type: 'text', hint: 'Appears above your name, like a city or a short label.' },
  { name: 'email', label: 'Contact email', type: 'email', hint: 'Used for the "Email me" and "Let\'s talk" buttons.' },
  { name: 'objective', label: 'Career objective', type: 'textarea', wide: true },
  { name: 'bio', label: 'About / bio', type: 'textarea', wide: true, hint: 'Long text is shortened on your site with a "Read more" link.' },
  { name: 'github', label: 'GitHub URL', type: 'url', hint: 'Full link starting with https://' },
  { name: 'linkedin', label: 'LinkedIn URL', type: 'url', hint: 'Full link starting with https://' },
]
const emptyProfile = Object.fromEntries(profileFields.map(({ name }) => [name, '']))
emptyProfile.resumeUrl = ''
const emptyProject = {
  title: '',
  category: '',
  year: '',
  summary: '',
  problem: '',
  solution: '',
  keyFeatures: '',
  outcome: '',
  technologies: '',
  link: '',
  imageUrl: '',
  imagePublicId: '',
  gallery: [],
}

const icons = {
  success: <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  error: <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 7v6" /><path d="M12 17h.01" /></svg>,
  confirm: <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6.5 7l1 12h9l1-12" /><path d="M10 11v5M14 11v5" /></svg>,
}

function Modal({ dialog, busy, onClose, onConfirm }) {
  const panelRef = useRef(null)
  const closeRef = useRef(onClose)

  useEffect(() => { closeRef.current = busy ? () => {} : onClose })

  useEffect(() => {
    if (!dialog) return undefined
    const previouslyFocused = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector('[data-autofocus]')?.focus()

    function onKeyDown(event) {
      if (event.key === 'Escape') { closeRef.current(); return }
      if (event.key !== 'Tab' || !panelRef.current) return
      const items = [...panelRef.current.querySelectorAll('button:not([disabled])')]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previouslyFocused && previouslyFocused.isConnected) previouslyFocused.focus?.()
    }
  }, [dialog])

  if (!dialog) return null
  const isConfirm = dialog.type === 'confirm'

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeRef.current() }}>
      <div
        className={`modal modal-${dialog.type}`}
        ref={panelRef}
        role={dialog.type === 'error' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-message"
      >
        <div className="modal-icon" aria-hidden="true">{icons[dialog.type]}</div>
        <h2 id="modal-title">{dialog.title}</h2>
        <p id="modal-message">{dialog.message}</p>
        <div className="modal-actions">
          {isConfirm ? (
            <>
              <button type="button" className="dash-btn" data-autofocus onClick={onClose} disabled={busy}>Cancel</button>
              <button type="button" className="dash-btn dash-btn-danger" onClick={onConfirm} disabled={busy}>{busy ? 'Deleting...' : 'Yes, delete'}</button>
            </>
          ) : (
            <button type="button" className="dash-btn dash-btn-primary" data-autofocus onClick={onClose}>OK</button>
          )}
        </div>
      </div>
    </div>
  )
}

function AdminDashboard({ user }) {
  const [profile, setProfile] = useState(emptyProfile)
  const [projects, setProjects] = useState([])
  const [projectForm, setProjectForm] = useState(emptyProject)
  const [editingId, setEditingId] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [resumeFile, setResumeFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [galleryFiles, setGalleryFiles] = useState([])
  const [galleryPreviewUrls, setGalleryPreviewUrls] = useState([])
  const [isGalleryDragging, setIsGalleryDragging] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const imageInput = useRef(null)
  const galleryInput = useRef(null)
  const imagePreviewUrl = useRef('')
  const projectFormRef = useRef(null)

  const closeDialog = useCallback(() => setDialog(null), [])
  const showSuccess = (title, message) => setDialog({ type: 'success', title, message })
  const showError = (message) => setDialog({ type: 'error', title: 'Something went wrong', message })

  useEffect(() => {
    return () => {
      if (imagePreviewUrl.current) URL.revokeObjectURL(imagePreviewUrl.current)
      galleryPreviewUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [galleryPreviewUrls])

  function updateImagePreview(file) {
    if (imagePreviewUrl.current) URL.revokeObjectURL(imagePreviewUrl.current)
    imagePreviewUrl.current = file ? URL.createObjectURL(file) : ''
    setImagePreview(imagePreviewUrl.current)
  }

  function updateGalleryPreview(files) {
    const nextFiles = Array.from(files || [])
    setGalleryFiles((current) => [...current, ...nextFiles])
    setGalleryPreviewUrls((current) => [...current, ...nextFiles.map((file) => URL.createObjectURL(file))])
  }

  useEffect(() => {
    const stopProfile = onSnapshot(doc(db, 'profile', 'main'), (snapshot) => setProfile({ ...emptyProfile, ...snapshot.data() }), () => setDialog({ type: 'error', title: 'Something went wrong', message: 'Hindi ma-load ang profile. I-check ang Firestore rules.' }))
    const stopProjects = onSnapshot(collection(db, 'projects'), (snapshot) => setProjects(snapshot.docs.map((project) => ({ id: project.id, ...project.data() }))), () => setDialog({ type: 'error', title: 'Something went wrong', message: 'Hindi ma-load ang projects. I-check ang Firestore rules.' }))
    return () => { stopProfile(); stopProjects() }
  }, [])

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => Number(b.year || 0) - Number(a.year || 0)),
    [projects],
  )

  function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function saveProfile(event) {
    event.preventDefault(); setIsSaving(true)
    try {
      let resumeUrl = profile.resumeUrl || ''
      if (resumeFile) {
        resumeUrl = await uploadResume()
      }
      await setDoc(doc(db, 'profile', 'main'), {
        ...Object.fromEntries(profileFields.map(({ name }) => [name, profile[name] || ''])),
        resumeUrl,
        updatedAt: serverTimestamp(),
      }, { merge: true })
      setResumeFile(null)
      showSuccess('Profile saved', 'Makikita agad ito sa public portfolio.')
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Hindi na-save ang profile. I-check ang Firebase setup at Firestore rules.')
    } finally { setIsSaving(false) }
  }

  function editProject(project) {
    setEditingId(project.id)
    setProjectForm({
      title: project.title || '',
      category: project.category || '',
      year: project.year || '',
      summary: project.summary || project.description || '',
      problem: project.problem || '',
      solution: project.solution || '',
      keyFeatures: (project.keyFeatures || []).join(', '),
      outcome: project.outcome || '',
      technologies: (project.technologies || []).join(', '),
      link: project.link || '',
      imageUrl: project.imageUrl || '',
      imagePublicId: project.imagePublicId || '',
      gallery: Array.isArray(project.gallery) ? project.gallery : [],
    })
    setImageFile(null)
    updateImagePreview(null)
    setGalleryFiles([])
    setGalleryPreviewUrls([])
    if (imageInput.current) imageInput.current.value = ''
    if (galleryInput.current) galleryInput.current.value = ''
    requestAnimationFrame(() => {
      projectFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      document.getElementById('project-title')?.focus({ preventScroll: true })
    })
  }
  function resetProject() {
    setEditingId('')
    setProjectForm(emptyProject)
    setImageFile(null)
    updateImagePreview(null)
    setGalleryFiles([])
    setGalleryPreviewUrls([])
    if (imageInput.current) imageInput.current.value = ''
    if (galleryInput.current) galleryInput.current.value = ''
  }

  function selectImage(event) {
    const file = event.target.files?.[0] || null
    if (file && !file.type.startsWith('image/')) {
      showError('Image file lang ang puwedeng i-upload.')
      event.target.value = ''
      return
    }
    if (file && file.size > 5 * 1024 * 1024) {
      showError('Maximum na 5 MB ang image file.')
      event.target.value = ''
      return
    }
    setImageFile(file)
    updateImagePreview(file)
  }

  function addGalleryImages(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) return

    const validFiles = files.filter((file) => file.type.startsWith('image/'))
    const invalidFiles = files.filter((file) => !file.type.startsWith('image/'))
    const tooLargeFiles = validFiles.filter((file) => file.size > 5 * 1024 * 1024)

    if (invalidFiles.length) {
      showError('Image file lang ang puwedeng i-upload sa gallery.')
      return
    }
    if (tooLargeFiles.length) {
      showError('Maximum na 5 MB ang bawat image file sa gallery.')
      return
    }

    updateGalleryPreview(validFiles)
  }

  function selectGalleryImages(event) {
    addGalleryImages(event.target.files)
    event.target.value = ''
  }

  function selectResume(event) {
    const file = event.target.files?.[0] || null
    if (!file) return
    if (file.type !== 'application/pdf') {
      showError('PDF file lang ang puwedeng i-upload sa resume.')
      event.target.value = ''
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      showError('Maximum na 10 MB ang resume PDF.')
      event.target.value = ''
      return
    }
    setResumeFile(file)
  }

  async function uploadResume() {
    if (!resumeFile) return profile.resumeUrl || ''
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'cj3iusnm'
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
    if (!uploadPreset) throw new Error('I-set ang VITE_CLOUDINARY_UPLOAD_PRESET sa .env.local.')

    const uploadData = new FormData()
    uploadData.append('file', resumeFile)
    uploadData.append('upload_preset', uploadPreset)
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
      method: 'POST',
      body: uploadData,
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error?.message || 'Hindi na-upload ang resume PDF.')
    return result.secure_url
  }

  async function saveProject(event) {
    event.preventDefault(); setIsSaving(true)
    const mergedGallery = [...(projectForm.gallery || [])]
    const uploadedGalleryUrls = []
    const data = {
      title: projectForm.title.trim(),
      category: projectForm.category.trim(),
      year: Number(projectForm.year) || null,
      summary: projectForm.summary.trim(),
      problem: projectForm.problem.trim(),
      solution: projectForm.solution.trim(),
      keyFeatures: projectForm.keyFeatures.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean),
      outcome: projectForm.outcome.trim(),
      description: projectForm.summary.trim(),
      technologies: projectForm.technologies.split(',').map((item) => item.trim()).filter(Boolean),
      link: projectForm.link.trim(),
      updatedAt: serverTimestamp(),
      imageUrl: projectForm.imageUrl || '',
      imagePublicId: projectForm.imagePublicId || '',
      gallery: mergedGallery,
    }
    let savedTitle = 'Project added'
    try {
      if (imageFile) {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'cj3iusnm'
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
        if (!uploadPreset) throw new Error('I-set ang VITE_CLOUDINARY_UPLOAD_PRESET sa .env.local.')

        const uploadData = new FormData()
        uploadData.append('file', imageFile)
        uploadData.append('upload_preset', uploadPreset)
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: uploadData,
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error?.message || 'Hindi na-upload ang image sa Cloudinary.')
        data.imageUrl = result.secure_url
        data.imagePublicId = result.public_id
      }

      if (galleryFiles.length) {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'cj3iusnm'
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
        if (!uploadPreset) throw new Error('I-set ang VITE_CLOUDINARY_UPLOAD_PRESET sa .env.local.')

        for (const file of galleryFiles) {
          const uploadData = new FormData()
          uploadData.append('file', file)
          uploadData.append('upload_preset', uploadPreset)
          const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: uploadData,
          })
          const result = await response.json()
          if (!response.ok) throw new Error(result.error?.message || 'Hindi na-upload ang gallery image sa Cloudinary.')
          uploadedGalleryUrls.push(result.secure_url)
        }
        data.gallery = [...mergedGallery, ...uploadedGalleryUrls]
      }
      if (editingId) { await updateDoc(doc(db, 'projects', editingId), data); savedTitle = 'Project updated' }
      else { await addDoc(collection(db, 'projects'), { ...data, createdAt: serverTimestamp() }) }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Hindi na-save ang project. I-check ang Cloudinary preset at Firestore rules.')
      setIsSaving(false)
      return
    }
    resetProject()
    setIsSaving(false)
    showSuccess(savedTitle, `"${data.title}" ay nasa public portfolio mo na.`)
  }

  function askRemoveProject(project) {
    setDialog({
      type: 'confirm',
      projectId: project.id,
      title: 'Delete this project?',
      message: `Permanenteng matatanggal ang "${project.title || 'Untitled project'}" sa portfolio mo. Hindi na ito mababalik.`,
    })
  }

  async function removeProject(projectId) {
    setIsDeleting(true)
    try {
      await deleteDoc(doc(db, 'projects', projectId))
      if (editingId === projectId) resetProject()
      showSuccess('Project deleted', 'Natanggal na ang project sa portfolio mo.')
    } catch { showError('Hindi ma-delete ang project. I-check ang Firestore rules.') }
    finally { setIsDeleting(false) }
  }

  return (
    <div className="dash">
      <header className="dash-topbar">
        <div className="dash-brand">
          <a className="wordmark" href="#">Portfolio<span className="wordmark-dot">.</span></a>
          <span className="dash-badge">Admin</span>
        </div>
        <div className="dash-account">
          <span className="dash-email">{user.email}</span>
          <button type="button" className="dash-btn" onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </header>

      <div className="dash-layout">
        <aside className="dash-sidebar">
          <nav aria-label="Dashboard sections">
            <button type="button" className="dash-nav-item" onClick={() => scrollToSection('dash-profile')}>Profile</button>
            <button type="button" className="dash-nav-item" onClick={() => scrollToSection('dash-projects')}>
              Projects <span className="dash-count">{projects.length}</span>
            </button>
          </nav>
          <a className="dash-public" href="#" target="_blank" rel="noreferrer">View public site <span aria-hidden="true">↗</span></a>
        </aside>

        <main className="dash-main">
          <div className="dash-intro">
            <h1>Manage your portfolio</h1>
            <p>Lahat ng i-save mo dito ay lalabas agad sa public site mo.</p>
          </div>

          <section className="dash-card" id="dash-profile" aria-labelledby="dash-profile-title">
            <div className="dash-card-head">
              <h2 id="dash-profile-title">Profile</h2>
              <p>Your name, headline, and links.</p>
            </div>
            <form className="dash-form dash-form-grid" onSubmit={saveProfile}>
              {profileFields.map((field) => (
                <div className={`dash-field${field.wide ? ' dash-span-2' : ''}`} key={field.name}>
                  <label htmlFor={`profile-${field.name}`}>{field.label}</label>
                  {field.type === 'textarea' ? (
                    <textarea id={`profile-${field.name}`} rows={field.name === 'objective' ? 3 : 5} aria-describedby={field.hint ? `profile-${field.name}-hint` : undefined} value={profile[field.name] || ''} onChange={(event) => setProfile({ ...profile, [field.name]: event.target.value })} />
                  ) : (
                    <input id={`profile-${field.name}`} type={field.type} aria-describedby={field.hint ? `profile-${field.name}-hint` : undefined} value={profile[field.name] || ''} onChange={(event) => setProfile({ ...profile, [field.name]: event.target.value })} />
                  )}
                  {field.hint && <span className="dash-hint" id={`profile-${field.name}-hint`}>{field.hint}</span>}
                </div>
              ))}
              <div className="dash-field dash-span-2">
                <label htmlFor="profile-resume">Resume (PDF)</label>
                <input id="profile-resume" type="file" accept="application/pdf" onChange={selectResume} />
                <span className="dash-hint">Upload a PDF resume for visitors to download from your portfolio.</span>
                {profile.resumeUrl && (
                  <div className="dash-file-actions">
                    <a className="dash-file-link" href={profile.resumeUrl} target="_blank" rel="noreferrer">Open current resume</a>
                    <button type="button" className="dash-link-btn dash-link-danger" onClick={() => setProfile({ ...profile, resumeUrl: '' })}>Remove resume</button>
                  </div>
                )}
              </div>
              <div className="dash-actions dash-span-2">
                <button className="dash-btn dash-btn-primary" type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save profile'}</button>
              </div>
            </form>
          </section>

          <section className="dash-card" id="dash-projects" aria-labelledby="dash-projects-title">
            <div className="dash-card-head">
              <h2 id="dash-projects-title">Projects</h2>
              <p>Add, update, or remove the work on your portfolio.</p>
            </div>
            <div className="dash-projects-layout">
              <form className={`dash-form dash-project-form${editingId ? ' is-editing' : ''}`} ref={projectFormRef} onSubmit={saveProject}>
                <h3>{editingId ? 'Edit project' : 'New project'}</h3>
                <div className="dash-field">
                  <label htmlFor="project-title">Project title</label>
                  <input id="project-title" value={projectForm.title} onChange={(event) => setProjectForm({ ...projectForm, title: event.target.value })} required />
                </div>
                <div className="dash-row">
                  <div className="dash-field">
                    <label htmlFor="project-category">Category</label>
                    <input id="project-category" placeholder="Portfolio, Dashboard, Web App" value={projectForm.category} onChange={(event) => setProjectForm({ ...projectForm, category: event.target.value })} />
                  </div>
                  <div className="dash-field">
                    <label htmlFor="project-year">Year</label>
                    <input id="project-year" type="number" min="1900" max="2100" value={projectForm.year} onChange={(event) => setProjectForm({ ...projectForm, year: event.target.value })} />
                  </div>
                </div>
                <div className="dash-field">
                  <label htmlFor="project-summary">Short summary</label>
                  <textarea id="project-summary" rows="3" value={projectForm.summary} onChange={(event) => setProjectForm({ ...projectForm, summary: event.target.value })} />
                </div>
                <div className="dash-field">
                  <label htmlFor="project-problem">Problem / goal</label>
                  <textarea id="project-problem" rows="3" value={projectForm.problem} onChange={(event) => setProjectForm({ ...projectForm, problem: event.target.value })} />
                </div>
                <div className="dash-field">
                  <label htmlFor="project-solution">What I built</label>
                  <textarea id="project-solution" rows="3" value={projectForm.solution} onChange={(event) => setProjectForm({ ...projectForm, solution: event.target.value })} />
                </div>
                <div className="dash-field">
                  <label htmlFor="project-key-features">Key features</label>
                  <textarea id="project-key-features" rows="3" value={projectForm.keyFeatures} onChange={(event) => setProjectForm({ ...projectForm, keyFeatures: event.target.value })} />
                  <span className="dash-hint" id="project-key-features-hint">Use commas or one item per line.</span>
                </div>
                <div className="dash-field">
                  <label htmlFor="project-outcome">Outcome / result</label>
                  <textarea id="project-outcome" rows="3" value={projectForm.outcome} onChange={(event) => setProjectForm({ ...projectForm, outcome: event.target.value })} />
                </div>
                <div className="dash-field">
                  <label htmlFor="project-technologies">Technologies</label>
                  <input id="project-technologies" placeholder="React, Firebase, Figma" aria-describedby="project-technologies-hint" value={projectForm.technologies} onChange={(event) => setProjectForm({ ...projectForm, technologies: event.target.value })} />
                  <span className="dash-hint" id="project-technologies-hint">Separate with commas. These become filters on your site.</span>
                </div>
                <div className="dash-field">
                  <label htmlFor="project-link">Project URL</label>
                  <input id="project-link" type="url" placeholder="https://" value={projectForm.link} onChange={(event) => setProjectForm({ ...projectForm, link: event.target.value })} />
                </div>
                <div className="dash-field">
                  <label htmlFor="project-image">Project image</label>
                  <input ref={imageInput} id="project-image" type="file" accept="image/*" aria-describedby="project-image-hint" onChange={selectImage} />
                  <span className="dash-hint" id="project-image-hint">Cloudinary upload · JPG, PNG, WebP or GIF, up to 5 MB.</span>
                </div>
                <div className="dash-field">
                  <label htmlFor="project-gallery">Project gallery</label>
                  <div
                    className={`dash-gallery-dropzone${isGalleryDragging ? ' is-dragging' : ''}`}
                    onDragEnter={(event) => { event.preventDefault(); setIsGalleryDragging(true) }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) setIsGalleryDragging(false)
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      setIsGalleryDragging(false)
                      addGalleryImages(event.dataTransfer.files)
                    }}
                  >
                    <div className="dash-gallery-preview">
                      {[(projectForm.gallery || []).map((url, index) => ({ url, source: 'existing', index })), ...galleryPreviewUrls.map((url, index) => ({ url, source: 'new', index }))].flat().map((item) => (
                        <div className="dash-gallery-thumb" key={`${item.source}-${item.index}-${item.url}`}>
                          <img src={item.url} alt={`Project gallery ${item.index + 1}`} />
                          <button type="button" className="dash-gallery-remove" onClick={() => {
                            if (item.source === 'new') {
                              setGalleryPreviewUrls((current) => current.filter((_, idx) => idx !== item.index))
                              setGalleryFiles((current) => current.filter((_, idx) => idx !== item.index))
                            } else {
                              setProjectForm((current) => ({ ...current, gallery: (current.gallery || []).filter((_, idx) => idx !== item.index) }))
                            }
                          }} aria-label="Remove gallery image">−</button>
                        </div>
                      ))}
                      <button type="button" className="dash-gallery-add" onClick={() => galleryInput.current?.click()} aria-label="Add project gallery image">+</button>
                    </div>
                    <input ref={galleryInput} id="project-gallery" type="file" accept="image/*" multiple className="dash-gallery-input" aria-describedby="project-gallery-hint" onChange={selectGalleryImages} />
                    <p className="dash-gallery-drop-hint">Drop images here, or use + to browse.</p>
                  </div>
                  <span className="dash-hint" id="project-gallery-hint">Add multiple screenshots. Up to 5 MB each.</span>
                </div>
                {(imagePreview || projectForm.imageUrl) && (
                  <div className="dash-image-preview">
                    <img src={imagePreview || projectForm.imageUrl} alt="Project preview" />
                    <button className="dash-btn" type="button" onClick={() => { setImageFile(null); updateImagePreview(null); setProjectForm({ ...projectForm, imageUrl: '', imagePublicId: '' }); if (imageInput.current) imageInput.current.value = '' }}>Remove image</button>
                  </div>
                )}
                <div className="dash-actions">
                  <button className="dash-btn dash-btn-primary" type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : editingId ? 'Update project' : 'Add project'}</button>
                  {editingId && <button className="dash-btn" type="button" onClick={resetProject}>Cancel</button>}
                </div>
              </form>

              <div className="dash-project-list">
                <h3>Published projects <span className="dash-count">{projects.length}</span></h3>
                {sortedProjects.length === 0 ? (
                  <p className="dash-empty">Wala pang project. Gamitin ang form para magdagdag.</p>
                ) : (
                  <ul>
                    {sortedProjects.map((project) => (
                      <li className={`dash-project-item${editingId === project.id ? ' is-editing' : ''}`} key={project.id}>
                        {project.imageUrl
                          ? <img className="dash-thumb" src={project.imageUrl} alt="" loading="lazy" />
                          : <div className="dash-thumb dash-thumb-empty" aria-hidden="true">{(project.title || '?').charAt(0)}</div>}
                        <div className="dash-project-info">
                          <h4>{project.title || 'Untitled project'}</h4>
                          <p>{project.year || 'No year'}{project.technologies?.length ? ` · ${project.technologies.join(', ')}` : ''}</p>
                        </div>
                        <div className="dash-project-actions">
                          <button type="button" className="dash-link-btn" onClick={() => editProject(project)} aria-label={`Edit ${project.title}`}>Edit</button>
                          <button type="button" className="dash-link-btn dash-link-danger" onClick={() => askRemoveProject(project)} aria-label={`Delete ${project.title}`}>Delete</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>

      <Modal
        dialog={dialog}
        busy={isDeleting}
        onClose={closeDialog}
        onConfirm={() => dialog?.projectId && removeProject(dialog.projectId)}
      />
    </div>
  )
}

export default AdminDashboard