import * as React from "react"
const SvgComponent = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={800}
    height={800}
    aria-hidden="true"
    className="iconify iconify--emojione"
    viewBox="0 0 64 64"
    {...props}
  >
    <path fill="#333" d="M14 4.5v55c0 3.4 6 3.4 6 0v-55c0-3.3-6-3.3-6 0" />
    <path
      fill="#6d7275"
      d="M6.6 42h20.8c2.5 0 4.6-2.3 4.6-5s-2.1-5-4.6-5H6.6C4.1 32 2 34.3 2 37s2.1 5 4.6 5"
    />
    <path
      fill="#94989b"
      d="M6.9 39.6h20.2c2.4 0 4.5-1.7 4.5-3.8s-2-3.8-4.5-3.8H6.9c-2.4 0-4.5 1.7-4.5 3.8s2 3.8 4.5 3.8"
    />
    <g fill="#5b636b">
      <path d="M59 10H39c-4 0-4-6 0-6h20c4 0 4 6 0 6M57 20H39c-4 0-4-6 0-6h18c4 0 4 6 0 6M55 30H39c-4 0-4-6 0-6h16c4 0 4 6 0 6" />
    </g>
    <g fill="#c7e755">
      <path d="M53 40H39c-4 0-4-6 0-6h14c4 0 4 6 0 6M51 50H39c-4 0-4-6 0-6h12c4 0 4 6 0 6M49 60H39c-4 0-4-6 0-6h10c4 0 4 6 0 6" />
    </g>
  </svg>
)
export default SvgComponent
