// Что сейчас читает человек: эталонный текст и подпись (хадис или аяты). Нужны, чтобы сохранённая запись (если человек разрешил)
// сразу содержала, с чем её сверять. Выставляют экраны проверки голосом, читает voiceApi.
let ctx = { ref: '', label: '' }
export const setVoiceContext = (c: { ref: string; label: string }) => { ctx = c }
export const getVoiceContext = () => ctx
