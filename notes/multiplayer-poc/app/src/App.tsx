import { useState } from 'react'
import { Tldraw, useEditor, useValue } from 'tldraw'
import { useSyncDemo } from '@tldraw/sync'
import 'tldraw/tldraw.css'

// Room comes from ?room=… so anyone with the same link lands on the same board.
function getRoom() {
  const params = new URLSearchParams(location.search)
  let room = params.get('room')
  if (!room) {
    room = 'class'
    params.set('room', room)
    history.replaceState(null, '', `?${params}`)
  }
  return room
}

function PresenceBar() {
  const room = getRoom()
  const editor = useEditor()
  const others = useValue('collaborators', () => editor.getCollaborators().length, [editor])
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const newRoom = () => {
    location.search = `?room=${Math.random().toString(36).slice(2, 8)}`
  }

  return (
    <div className="bar">
      <span><span className="dot" />{others + 1} here</span>
      <span className="room">room: <b>{room}</b></span>
      <button onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>
      <button className="ghost" onClick={newRoom}>New room</button>
    </div>
  )
}

const components = { InFrontOfTheCanvas: PresenceBar }

export default function App() {
  const room = getRoom()
  // Prefix keeps us out of other people's rooms on tldraw's shared demo server.
  const store = useSyncDemo({ roomId: `mw-multiplayer-poc-${room}` })
  return (
    <Tldraw store={store} components={components} />
  )
}
