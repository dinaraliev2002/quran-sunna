import { useRef, useState } from 'react'
import { Sheet, SheetHead } from '../components/ui'
import { haptic } from '../lib/telegram'
import { resizeAvatar, useProfile } from '../lib/profile'
import { useStore } from '../store/settings'

/** «Изм.» в профиле: своё имя и фото (в Telegram по умолчанию берутся оттуда, в приложении из магазина — «Гость») */
export function ProfileEdit({ onClose }: { onClose: () => void }) {
  const st = useStore()
  const p = useProfile()
  const [name, setName] = useState(st.profName)
  const [photo, setPhoto] = useState(st.profPhoto)
  const file = useRef<HTMLInputElement>(null)
  const shown = photo || p.photo
  const save = () => { haptic.success(); st.set({ profName: name.trim().slice(0, 40), profPhoto: photo }); onClose() }
  return (
    <Sheet onClose={onClose}>
      <SheetHead title="Профиль" sub="Имя и фото" onClose={onClose} />
      <div className="body">
        <div className="pe-ava">
          <button className="pf-ava" onClick={() => file.current?.click()} aria-label="Выбрать фото">
            {shown ? <img src={shown} alt="" /> : (name.trim()[0] ?? p.initial).toUpperCase()}
          </button>
          <div>
            <button className="dl-link" onClick={() => file.current?.click()}>{shown ? 'Другое фото' : 'Выбрать фото'}</button>
            {photo && <button className="dl-link danger" onClick={() => setPhoto('')}>Убрать своё фото</button>}
          </div>
          <input ref={file} type="file" accept="image/*" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) resizeAvatar(f).then(setPhoto).catch(() => {}); e.target.value = '' }} />
        </div>
        <div className="fld"><label>Имя</label>
          <input className="pe-name" value={name} maxLength={40} placeholder={p.full === 'Гость' ? 'Как к вам обращаться' : p.full}
            onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="bigbtn" onClick={save}>Сохранить</button>
      </div>
    </Sheet>
  )
}
