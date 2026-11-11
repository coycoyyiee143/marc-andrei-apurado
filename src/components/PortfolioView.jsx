import { useEffect, useMemo, useState } from 'react'
import { AdvancedImage } from '@cloudinary/react'
import { Cloudinary } from '@cloudinary/url-gen'
import { fill } from '@cloudinary/url-gen/actions/resize'
import { autoGravity } from '@cloudinary/url-gen/qualifiers/gravity'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase'

const emptyProfile = { name: '', role: '', location: '', email: '', bio: '', objective: '', github: '', linkedin: '' }
const DISPLAY_WORD_LIMIT = 50
const ALL = 'All'
const cloudinary = new Cloudinary({ cloud: { cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'cj3iusnm' } })

function ExpandableText({ text, className }) {
  const [open, setOpen] = useState(false)
  const words = text.trim().split(/\s+/)
  const isLong = words.length > DISPLAY_WORD_LIMIT
  const shown = isLong && !open ? `${words.slice(0, DISPLAY_WORD_LIMIT).join(' ')}…` : text

  if (!text.trim()) return null

  return (
    <div className={className}>
      <p>{shown}</p>
      {isLong && (
        <button type="button" className="read-more" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          {open ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}

function ProjectCard({ project, onOpen }) {
  const [imageFailed, setImageFailed] = useState(false)
  const title = project.title || 'Untitled project'
  const shortSummary = project.summary || project.description || ''
  const showImage = project.imageUrl && !imageFailed
  const cloudinaryImage = project.imagePublicId
    ? cloudinary.image(project.imagePublicId)
      .format('auto')
      .quality('auto')
      .resize(fill().gravity(autoGravity()).width(1200).height(675))
    : null

  return (
    <li className="project-card project-card-clickable" onClick={onOpen} onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen();
      }
    }} tabIndex={0} role="button" aria-label={`Open details for ${title}`}>
      {showImage ? (
        cloudinaryImage
          ? <AdvancedImage className="project-image" cldImg={cloudinaryImage} alt={`${title} preview`} />
          : <img className="project-image" src={project.imageUrl} alt={`${title} preview`} loading="lazy" onError={() => setImageFailed(true)} />
      ) : (
        <div className="project-image project-image-placeholder" aria-hidden="true">{title.charAt(0)}</div>
      )}
      <div className="project-body">
        <div className="project-title-row">
          <h3>{title}</h3>
          {project.year && <span className="project-year">{project.year}</span>}
        </div>
        {project.category && <p className="project-category">{project.category}</p>}
        <ExpandableText className="project-description" text={shortSummary} />
        {project.technologies?.length > 0 && (
          <ul className="technology-list" aria-label="Technologies used">
            {project.technologies.slice(0, 3).map((technology) => <li key={technology}>{technology}</li>)}
          </ul>
        )}
        <button type="button" className="project-link project-link-button" onClick={(event) => { event.stopPropagation(); onOpen(); }}>
          View details <span aria-hidden="true">↗</span>
        </button>
      </div>
    </li>
  )
}

function ProjectDetailModal({ project, onClose }) {
  if (!project) return null

  const gallery = Array.isArray(project.gallery) && project.gallery.length > 0
    ? project.gallery
    : (project.imageUrl ? [project.imageUrl] : [])

  return (
    <div className="project-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="project-modal" role="dialog" aria-modal="true" aria-labelledby="project-detail-title">
        <button type="button" className="project-modal-close" onClick={onClose} aria-label="Close project details">×</button>
        <div className="project-modal-header">
          <div>
            {project.category && <p className="project-modal-category">{project.category}</p>}
            <h2 id="project-detail-title">{project.title || 'Untitled project'}</h2>
            {project.year && <span className="project-modal-year">{project.year}</span>}
          </div>
          {project.link && (
            <a className="button button-primary" href={project.link} target="_blank" rel="noreferrer">
              View live project
            </a>
          )}
        </div>

        <div className="project-modal-body">
          {project.summary && <div className="project-modal-section"><h3>Short summary</h3><p>{project.summary}</p></div>}
          {project.problem && <div className="project-modal-section"><h3>Problem / goal</h3><p>{project.problem}</p></div>}
          {project.solution && <div className="project-modal-section"><h3>What I built</h3><p>{project.solution}</p></div>}
          {project.keyFeatures?.length > 0 && (
            <div className="project-modal-section">
              <h3>Key features</h3>
              <ul className="project-modal-list">
                {project.keyFeatures.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
            </div>
          )}
          {project.outcome && <div className="project-modal-section"><h3>Outcome / result</h3><p>{project.outcome}</p></div>}
          {project.technologies?.length > 0 && (
            <div className="project-modal-section">
              <h3>Technologies</h3>
              <ul className="technology-list" aria-label="Technologies used">
                {project.technologies.map((technology) => <li key={technology}>{technology}</li>)}
              </ul>
            </div>
          )}
        </div>

        {gallery.length > 0 && (
          <div className="project-modal-gallery-wrap">
            <div className="project-modal-gallery-label">Project gallery</div>
            <div className="project-modal-gallery" aria-label="Project images">
              {gallery.map((imageUrl, index) => (
                <img key={`${imageUrl}-${index}`} src={imageUrl} alt={`${project.title || 'Project'} screenshot ${index + 1}`} loading="lazy" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PortfolioView() {
  const [profile, setProfile] = useState(emptyProfile)
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(Boolean(db))
  const [error, setError] = useState('')
  const [activeTech, setActiveTech] = useState(ALL)
  const [selectedProject, setSelectedProject] = useState(null)

  useEffect(() => {
    if (!db) return undefined
    const stopProfile = onSnapshot(doc(db, 'profile', 'main'), (snapshot) => {
      setProfile({ ...emptyProfile, ...snapshot.data() })
    }, () => setError('Hindi ma-load ang profile mula sa Firestore.'))
    const stopProjects = onSnapshot(collection(db, 'projects'), (snapshot) => {
      setProjects(snapshot.docs
        .map((project) => ({ id: project.id, ...project.data() }))
        .sort((a, b) => Number(b.year || 0) - Number(a.year || 0)))
      setLoading(false)
    }, () => {
      setError('Hindi ma-load ang projects mula sa Firestore.')
      setLoading(false)
    })
    return () => { stopProfile(); stopProjects() }
  }, [])

  const technologies = useMemo(
    () => [...new Set(projects.flatMap((project) => project.technologies || []))].sort((a, b) => a.localeCompare(b)),
    [projects],
  )
  const selectedTech = technologies.includes(activeTech) ? activeTech : ALL
  const visibleProjects = selectedTech === ALL
    ? projects
    : projects.filter((project) => project.technologies?.includes(selectedTech))

  const name = profile.name || 'Your Name'

  return (
    <div className="portfolio-page">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label={`${name} home`}>{name.split(' ').slice(0, 2).join(' ') || 'Portfolio'}<span className="wordmark-dot">.</span></a>
        <nav className="site-nav" aria-label="Main navigation">
          <a href="#about">About</a>
          <a href="#projects">Projects</a>
          {profile.email && <a className="nav-contact" href={`mailto:${profile.email}`}>Let&apos;s talk</a>}
        </nav>
      </header>

      <main id="main-content">
        <section className="hero" id="top" aria-labelledby="hero-name">
          <div className="hero-panel">
            <p className="availability"><span className="availability-dot" aria-hidden="true" />Open to opportunities</p>
            {profile.location && <p className="hero-location">{profile.location}</p>}
            <h1 id="hero-name">{name}</h1>
            <p className="hero-role">{profile.role || 'Your next role starts here.'}</p>
            <ExpandableText
              className="hero-bio"
              text={profile.bio || 'Your story, work, and next big idea will live here. Sign in to the admin page to add your profile details.'}
            />
            <div className="hero-actions">
              <a className="button button-primary" href="#projects">View my work</a>
              {profile.email && <a className="button button-ghost" href={`mailto:${profile.email}`}>Email me</a>}
            </div>
          </div>
        </section>

        <section className="about-section" id="about" aria-labelledby="about-title">
          <h2 className="section-title" id="about-title">Career objective</h2>
          <div className="about-copy">
            <ExpandableText text={profile.objective || 'My career objective will appear here.'} />
            <div className="social-links">
              {profile.github && <a href={profile.github} target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>}
              {profile.linkedin && <a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn <span aria-hidden="true">↗</span></a>}
              {profile.email && <a href={`mailto:${profile.email}`}>Email <span aria-hidden="true">↗</span></a>}
            </div>
          </div>
        </section>

        <section className="projects-section" id="projects" aria-labelledby="projects-title">
          <div className="section-heading">
            <h2 className="section-title" id="projects-title">Selected work</h2>
            <p className="project-count">{projects.length} {projects.length === 1 ? 'project' : 'projects'}</p>
          </div>

          {technologies.length > 1 && (
            <div className="filter-bar" role="group" aria-label="Filter projects by technology">
              {[ALL, ...technologies].map((technology) => (
                <button
                  type="button"
                  key={technology}
                  className={`filter-chip${selectedTech === technology ? ' is-active' : ''}`}
                  aria-pressed={selectedTech === technology}
                  onClick={() => setActiveTech(technology)}
                >
                  {technology}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="project-grid" aria-busy="true" aria-label="Loading projects">
              {[0, 1].map((item) => (
                <div className="project-card skeleton-card" key={item}>
                  <div className="project-image skeleton" />
                  <div className="project-body">
                    <div className="skeleton skeleton-line skeleton-title" />
                    <div className="skeleton skeleton-line" />
                    <div className="skeleton skeleton-line skeleton-short" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleProjects.length ? (
            <ul
              className="project-grid"
              tabIndex={0}
              aria-label="Projects. Scroll horizontally to browse."
              onWheel={(event) => {
                if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
                const container = event.currentTarget
                const maxScroll = container.scrollWidth - container.clientWidth
                const nextScroll = Math.max(0, Math.min(maxScroll, container.scrollLeft + event.deltaY))
                if (nextScroll !== container.scrollLeft) {
                  event.preventDefault()
                  container.scrollLeft = nextScroll
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault()
                  event.currentTarget.scrollBy({ left: event.key === 'ArrowRight' ? 444 : -444 })
                }
              }}
            >
              {visibleProjects.map((project) => <ProjectCard key={project.id} project={project} onOpen={() => setSelectedProject(project)} />)}
            </ul>
          ) : (
            <div className="empty-state">
              {projects.length ? (
                <>
                  <p>Walang project na gumagamit ng {selectedTech}.</p>
                  <button type="button" className="text-button" onClick={() => setActiveTech(ALL)}>Ipakita lahat ng projects</button>
                </>
              ) : (
                <p>Wala pang projects dito. Idagdag ang unang project sa <a href="#admin">admin dashboard</a>.</p>
              )}
            </div>
          )}
        </section>
      </main>

      <ProjectDetailModal project={selectedProject} onClose={() => setSelectedProject(null)} />

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} {name}</span>
        {error && <span className="connection-error" role="alert">{error}</span>}
        {!isFirebaseConfigured && <span className="connection-note">Firebase setup needed for live content</span>}
        <span className="footer-links">
          <a href="#top">Back to top</a>
          <a href="#admin">Admin</a>
        </span>
      </footer>
    </div>
  )
}

export default PortfolioView