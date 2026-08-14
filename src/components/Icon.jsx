const PATHS = {
  // grade glyphs
  map: <><path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2z" /><path d="M9 3v16M15 5v16" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="M15 9l-2 6-6 2 2-6 6-2z" /></>,
  camera: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7l1.5-2.5h5L16 7" /><circle cx="12" cy="13.5" r="3.5" /></>,
  backpack: <><rect x="5" y="8" width="14" height="12" rx="2" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /><path d="M9 12h6" /></>,
  tent: <><path d="M12 4l9 16H3z" /><path d="M12 4v16" /></>,
  binoculars: <><rect x="4" y="10" width="6" height="8" rx="2" /><rect x="14" y="10" width="6" height="8" rx="2" /><path d="M9 10 8 6h3l1 4M15 10l-1-4h3l1 4" /></>,
  train: <><rect x="4" y="4" width="16" height="13" rx="3" /><path d="M4 12h16M8 17l-2 3M16 17l2 3" /><circle cx="8.5" cy="14" r="1" /><circle cx="15.5" cy="14" r="1" /></>,
  sun: <><circle cx="12" cy="12" r="4.5" /><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M4 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></>,
  leaf: <path d="M20 4S9 4 6 9s0 11 0 11 9 3 12-6c1.5-4.5-1-10-1-10z" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 5h13l-3 4 3 4H5" /></>,
  kite: <><path d="M12 3l7 8-7 10-7-10 7-8z" /><path d="M12 13v8" /></>,
  star: <path d="M12 3l2.7 6 6.3.6-4.8 4.2 1.5 6.2L12 16.9 6.3 20l1.5-6.2L3 9.6 9.3 9z" />,
  pencil: <><path d="M4 20h4l10-10a2.83 2.83 0 0 0-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></>,

  // section glyphs
  overview: <><path d="M4 19V6a2 2 0 0 1 2-2h9l5 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M14 4v5h5" /></>,
  resources: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.5-1.5" /></>,
  itinerary: <><path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  safety: <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" />,
  dodont: <path d="M20 6L9 17l-5-5" />,
  close: <path d="M7 7l10 10M17 7L7 17" />,
  ticket: <><rect x="4" y="7" width="16" height="12" rx="2" /><path d="M9 4v3M15 4v3M4 13h16" /></>,
  reminder: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  photo: <><rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2h5L16 6" /></>,
  comm: <path d="M22 16.9v2a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 1h2a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.4 2.1L7 8.9a16 16 0 0 0 6 6l1.4-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.7.6A2 2 0 0 1 22 16.9z" />,
  carry: <><rect x="5" y="8" width="14" height="12" rx="2" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /><path d="M9 12h6" /></>,

  // document kinds
  slides: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M12 16v4M8 20h8" /></>,
  doc: <><path d="M6 3h8l5 5v13H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  sheet: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 10v10M15 10v10" /></>,
  form: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 9h8M8 13h8M8 17h4" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  file: <><path d="M6 3h8l5 5v13H6z" /><path d="M14 3v5h5" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.5-1.5" /></>,
}

export function Icon({ name, stroke = 'currentColor', width, height, ...rest }) {
  const path = PATHS[name] || PATHS.map
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={width}
      height={height}
      aria-hidden="true"
      {...rest}
    >
      {path}
    </svg>
  )
}
