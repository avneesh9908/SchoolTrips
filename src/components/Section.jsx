import { Icon } from './Icon'

const SECTION_COLOR = {
  overview: '#2AA8DE',
  resources: '#B45BD4',
  itinerary: '#8C6BE0',
  safety: '#FF6B5B',
  dodont: '#4CAF6D',
  ticket: '#FFB100',
  reminder: '#FF8A3D',
  photo: '#EF5DA8',
  comm: '#26C0B0',
  carry: '#5B7FFF',
}

export function Section({ icon, title, children }) {
  return (
    <section className="section">
      <div className="section-head">
        <div className="badge" style={{ background: SECTION_COLOR[icon] || '#767066' }}>
          <Icon name={icon} stroke="#fff" />
        </div>
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  )
}
